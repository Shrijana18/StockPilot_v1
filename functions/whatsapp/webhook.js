/**
 * WhatsApp Webhook Handler
 * Handles incoming webhooks from Meta WhatsApp Business API
 * 
 * IMPORTANT: Webhook URL Configuration
 * =====================================
 * This function is deployed as: whatsappWebhook
 * 
 * Correct Webhook URL for Meta Dashboard:
 * https://us-central1-stockpilotv1.cloudfunctions.net/whatsappWebhook
 * 
 * Verify Token: flyp_tech_provider_webhook_token
 * (or set via WHATSAPP_WEBHOOK_VERIFY_TOKEN environment variable)
 * 
 * To configure in Meta Dashboard:
 * 1. Go to: https://developers.facebook.com/apps/{APP_ID}/webhooks/
 * 2. Select "Whatsapp Business Account" product
 * 3. Set Callback URL: https://us-central1-stockpilotv1.cloudfunctions.net/whatsappWebhook
 * 4. Set Verify Token: flyp_tech_provider_webhook_token
 * 5. Subscribe to fields: messages, message_status, account_update, account_review_update
 * 6. Click "Verify and Save"
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Define secrets
const META_SYSTEM_USER_TOKEN_SECRET = defineSecret("META_SYSTEM_USER_TOKEN");

// IMPORTANT: This token MUST match what's configured in Meta Developer Dashboard
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 
  "flyp_tech_provider_webhook_token";

/**
 * Get System User Token from secret or environment
 */
function getSystemUserToken() {
  try {
    return META_SYSTEM_USER_TOKEN_SECRET.value() || process.env.META_SYSTEM_USER_TOKEN;
  } catch (e) {
    return process.env.META_SYSTEM_USER_TOKEN;
  }
}

// Webhook URL constant for reference
const WEBHOOK_URL = "https://us-central1-stockpilotv1.cloudfunctions.net/whatsappWebhook";

/**
 * Verify webhook subscription (Meta sends GET request)
 */
async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verification request:", {
    mode,
    tokenProvided: !!token,
    tokenMatches: token === WEBHOOK_VERIFY_TOKEN,
    challenge: challenge?.substring(0, 20) + "...",
  });

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Webhook verification failed:", {
      modeMatch: mode === "subscribe",
      tokenMatch: token === WEBHOOK_VERIFY_TOKEN,
      expectedToken: WEBHOOK_VERIFY_TOKEN.substring(0, 10) + "...",
    });
    res.status(403).send("Forbidden");
  }
}

/**
 * Find business by phone number ID OR WABA ID (with fallback)
 * This is more robust and handles various configuration scenarios
 */
async function findBusinessByPhoneOrWABA(phoneNumberId, wabaId) {
  // Try finding by phone number ID first (most specific)
  if (phoneNumberId) {
    const byPhone = await db
      .collection("businesses")
      .where("whatsappPhoneNumberId", "==", phoneNumberId)
      .limit(1)
      .get();
    
    if (!byPhone.empty) {
      console.log(`✅ Found business by phoneNumberId: ${phoneNumberId}`);
      return byPhone.docs[0];
    }
    console.log(`⚠️ No business found for phoneNumberId: ${phoneNumberId}`);
  }

  // Fallback: Try finding by WABA ID
  if (wabaId) {
    const byWABA = await db
      .collection("businesses")
      .where("whatsappBusinessAccountId", "==", wabaId)
      .limit(1)
      .get();
    
    if (!byWABA.empty) {
      console.log(`✅ Found business by wabaId: ${wabaId}`);
      
      // Update the business with the phone number ID for future lookups
      if (phoneNumberId) {
        try {
          await byWABA.docs[0].ref.update({
            whatsappPhoneNumberId: phoneNumberId,
            whatsappPhoneNumberIdUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`📝 Updated business with phoneNumberId: ${phoneNumberId}`);
        } catch (updateErr) {
          console.warn("Could not update phoneNumberId (non-critical):", updateErr);
        }
      }
      
      return byWABA.docs[0];
    }
    console.log(`⚠️ No business found for wabaId: ${wabaId}`);
  }

  return null;
}

/**
 * Handle webhook events from Meta
 */
async function handleWebhookEvent(req, res) {
  try {
    const body = req.body;
    
    // Log the raw webhook payload for debugging
    console.log("📥 Webhook received:", JSON.stringify(body, null, 2));

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        const wabaId = entry.id;
        console.log(`📦 Processing entry for WABA: ${wabaId}`);

        for (const change of entry.changes || []) {
          const value = change.value;
          const field = change.field;
          
          console.log(`🔄 Change field: ${field}`);

          // Handle message status updates
          if (value.statuses && value.statuses.length > 0) {
            console.log(`📊 Processing ${value.statuses.length} status update(s)`);
            for (const status of value.statuses) {
              await updateMessageStatus(status, wabaId, value.metadata?.phone_number_id);
            }
          }

          // Handle incoming messages
          if (value.messages && value.messages.length > 0) {
            console.log(`💬 Processing ${value.messages.length} incoming message(s)`);
            for (const message of value.messages) {
              await handleIncomingMessage(message, value.metadata, wabaId);
            }
          }

          // Handle account review status updates
          if (field === "account_review_update") {
            await updateAccountReviewStatus(wabaId, value);
          }
          
          // Handle account update (phone verification, etc.)
          if (field === "account_update") {
            console.log("📋 Account update received:", JSON.stringify(value));
          }
        }
      }
    } else {
      console.log(`⚠️ Unknown webhook object type: ${body.object}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    console.error("❌ Error stack:", error.stack);
    // Still return 200 to prevent Meta from retrying
    res.status(200).send("OK");
  }
}

/**
 * Update message status in Firestore
 */
async function updateMessageStatus(status, wabaId, phoneNumberId) {
  try {
    const messageId = status.id;
    const statusType = status.status;
    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
    const recipientId = status.recipient_id;

    console.log(`📊 Status update: ${statusType} for message ${messageId}`);

    // Find business
    const businessDoc = await findBusinessByPhoneOrWABA(phoneNumberId, wabaId);
    
    if (!businessDoc) {
      console.warn(`⚠️ No business found for status update (WABA: ${wabaId}, Phone: ${phoneNumberId})`);
      return;
    }

    const distributorId = businessDoc.id;

    // Find message in Firestore by messageId
    const messagesRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappMessages");

    const messagesSnapshot = await messagesRef
      .where("messageId", "==", messageId)
      .limit(1)
      .get();

    if (!messagesSnapshot.empty) {
      const messageDoc = messagesSnapshot.docs[0];
      
      // Update status based on type
      const updateData = {
        status: statusType,
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        [`statusTimestamps.${statusType}`]: timestamp.toISOString(),
      };
      
      // Mark as read/delivered
      if (statusType === 'read') {
        updateData.read = true;
        updateData.readAt = timestamp;
      } else if (statusType === 'delivered') {
        updateData.delivered = true;
        updateData.deliveredAt = timestamp;
      }
      
      // Handle errors
      if (status.errors && status.errors.length > 0) {
        updateData.error = status.errors[0];
        updateData.status = 'failed';
      }
      
      await messageDoc.ref.update(updateData);
      console.log(`✅ Updated message ${messageId} status to ${statusType}`);
    } else {
      console.warn(`⚠️ Message ${messageId} not found in Firestore for status update`);
    }
  } catch (error) {
    console.error("❌ Error updating message status:", error);
  }
}

/**
 * Handle incoming messages from customers
 */
async function handleIncomingMessage(message, metadata, wabaId) {
  try {
    const messageId = message.id;
    const from = message.from; // Sender's phone number without +
    const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date();
    const phoneNumberId = metadata?.phone_number_id;
    const displayPhoneNumber = metadata?.display_phone_number;

    console.log(`💬 Incoming message from ${from}:`, {
      messageId,
      type: message.type,
      phoneNumberId,
      wabaId,
      hasText: !!message.text?.body,
    });

    // Find business
    const businessDoc = await findBusinessByPhoneOrWABA(phoneNumberId, wabaId);
    
    if (!businessDoc) {
      console.error(`❌ CRITICAL: No business found for incoming message!`);
      console.error(`   Phone Number ID: ${phoneNumberId}`);
      console.error(`   WABA ID: ${wabaId}`);
      console.error(`   From: ${from}`);
      console.error(`   This message will be LOST. Please check whatsappPhoneNumberId in Firestore.`);
      return;
    }

    const distributorId = businessDoc.id;
    console.log(`✅ Matched to business: ${distributorId}`);

    // Extract message content based on type
    let text = '';
    let messageType = message.type || 'text';
    let mediaInfo = null;
    
    switch (message.type) {
      case 'text':
        text = message.text?.body || '';
        break;
      case 'image':
        text = message.image?.caption || '';
        mediaInfo = {
          id: message.image?.id,
          mimeType: message.image?.mime_type,
          sha256: message.image?.sha256,
        };
        break;
      case 'document':
        text = message.document?.caption || '';
        mediaInfo = {
          id: message.document?.id,
          filename: message.document?.filename,
          mimeType: message.document?.mime_type,
        };
        break;
      case 'audio':
        mediaInfo = {
          id: message.audio?.id,
          mimeType: message.audio?.mime_type,
        };
        break;
      case 'video':
        text = message.video?.caption || '';
        mediaInfo = {
          id: message.video?.id,
          mimeType: message.video?.mime_type,
        };
        break;
      case 'sticker':
        mediaInfo = {
          id: message.sticker?.id,
          mimeType: message.sticker?.mime_type,
        };
        break;
      case 'location':
        mediaInfo = {
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          name: message.location?.name,
          address: message.location?.address,
        };
        break;
      case 'contacts':
        mediaInfo = { contacts: message.contacts };
        break;
      case 'button':
        text = message.button?.text || '';
        break;
      case 'interactive':
        if (message.interactive?.button_reply) {
          text = message.interactive.button_reply.title || '';
        } else if (message.interactive?.list_reply) {
          text = message.interactive.list_reply.title || '';
        }
        break;
      case 'reaction':
        mediaInfo = {
          emoji: message.reaction?.emoji,
          messageId: message.reaction?.message_id,
        };
        break;
      default:
        console.log(`⚠️ Unknown message type: ${message.type}`);
    }

    // Store incoming message in whatsappInbox collection
    const inboxRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappInbox");

    // Check for duplicate (prevent double-processing)
    const existingMsg = await inboxRef.where("messageId", "==", messageId).limit(1).get();
    if (!existingMsg.empty) {
      console.log(`⏭️ Duplicate message ${messageId}, skipping`);
      return;
    }

    const messageData = {
      messageId,
      from: `+${from}`, // Store with + prefix for consistency
      phoneNumber: `+${from}`, // Alias for easier querying
      text,
      message: text, // Alias for compatibility
      type: messageType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      receivedAt: timestamp,
      read: false,
      direction: 'incoming', // Explicitly mark as incoming
      metadata: {
        phoneNumberId,
        wabaId,
        displayPhoneNumber,
        rawTimestamp: message.timestamp,
      },
    };
    
    // Add media info if present
    if (mediaInfo) {
      messageData.media = mediaInfo;
    }
    
    // Add context if this is a reply
    if (message.context) {
      messageData.context = {
        from: message.context.from,
        id: message.context.id,
      };
    }

    await inboxRef.add(messageData);
    console.log(`✅ Stored incoming message from +${from} (ID: ${messageId})`);
    
    // Update conversation timestamp for sorting
    try {
      const convRef = db
        .collection("businesses")
        .doc(distributorId)
        .collection("whatsappConversations")
        .doc(from);
      
      await convRef.set({
        phone: `+${from}`,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessage: text || `[${messageType}]`,
        unreadCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (convErr) {
      console.warn("Could not update conversation (non-critical):", convErr);
    }

    // Process automated flows and interactive responses
    try {
      if (messageType === 'interactive') {
        // Handle button/list clicks
        console.log("🔘 Processing interactive message");
        await handleInteractiveResponse(distributorId, from, phoneNumberId, businessDoc.data(), message.interactive);
      } else if (text && messageType === 'text') {
        // Handle text messages - check for flow automation
        await processFlowAutomation(distributorId, from, text, phoneNumberId, businessDoc.data());
      } else if (messageType === 'button') {
        // Handle quick reply buttons (legacy format)
        const buttonText = message.button?.text || '';
        if (buttonText) {
          await processFlowAutomation(distributorId, from, buttonText, phoneNumberId, businessDoc.data());
        }
      }
    } catch (flowErr) {
      console.error("❌ Flow/Interactive automation error:", flowErr);
    }
    
  } catch (error) {
    console.error("❌ Error handling incoming message:", error);
    console.error("❌ Error stack:", error.stack);
  }
}

/**
 * Process automated flows based on incoming message
 */
async function processFlowAutomation(distributorId, customerPhone, messageText, phoneNumberId, businessData) {
  try {
    const normalizedText = messageText.toLowerCase().trim();
    console.log(`🤖 ========== FLOW AUTOMATION START ==========`);
    console.log(`🤖 Processing flow automation for customer: +${customerPhone}`);
    console.log(`🤖 Message: "${messageText}" -> normalized: "${normalizedText}"`);
    console.log(`🤖 Distributor: ${distributorId}`);
    console.log(`🤖 Phone Number ID: ${phoneNumberId}`);

    const accessToken = businessData.whatsappAccessToken || getSystemUserToken();
    if (!accessToken) {
      console.error("❌ CRITICAL: No access token available for flow automation");
      console.error("   - This will prevent the bot from sending responses!");
      return;
    }
    console.log(`🔑 Access token available (${businessData.whatsappAccessToken ? 'businessData' : 'systemUser'})`);

    // Get session to check current state
    const session = await getOrCreateSession(distributorId, customerPhone);

    // --- Resilient state handling (user may type instead of clicking buttons) ---
    // If we're waiting for customer-info decision during checkout
    if (session?.state === 'collecting_customer_info') {
      const yesWords = ['yes', 'y', 'ok', 'okay', 'sure', 'haan', 'ha', 'yes please'];
      const noWords = ['no', 'n', 'skip', 'later', 'not now', 'nah'];

      const accessTokenForState = businessData.whatsappAccessToken || getSystemUserToken();
      if (!accessTokenForState) return;

      if (yesWords.includes(normalizedText)) {
        await startCollectingCustomerName(distributorId, customerPhone, phoneNumberId, accessTokenForState);
        return;
      }
      if (noWords.includes(normalizedText)) {
        await updateSession(distributorId, customerPhone, {
          state: 'confirming',
          tempCustomerInfo: { name: null, address: null },
        });
        await showOrderSummaryWithInfo(
          distributorId,
          customerPhone,
          phoneNumberId,
          accessTokenForState,
          session,
          businessData,
          null,
          null
        );
        return;
      }

      // Re-send prompt if user typed something else
      await sendCustomerInfoPrompt(distributorId, customerPhone, phoneNumberId, accessTokenForState);
      return;
    }

    // If customer is in support mode, record message for a human
    if (session?.state === 'support') {
      const accessTokenForSupport = businessData.whatsappAccessToken || getSystemUserToken();
      if (!accessTokenForSupport) return;

      // Store/append support request for distributor follow-up
      await upsertSupportTicket(distributorId, customerPhone, messageText);

      // Light acknowledgment + remind main menu
      await sendWhatsAppTextMessage(
        phoneNumberId,
        customerPhone,
        accessTokenForSupport,
        "✅ Thanks! Our support team has your message and will respond shortly.\n\nSend *menu* anytime to go back to the main menu."
      );
      await storeOutgoingMessage(distributorId, customerPhone, "Support acknowledgment sent", "support_ack");
      return;
    }

    // Handle common commands first (quick shortcuts)
    const quickCommands = {
      'cart': 'view_cart',
      'orders': 'view_orders',
      'my orders': 'view_orders',
      'browse': 'browse_products',
      'products': 'browse_products',
      'catalog': 'browse_products',
      'menu': 'main_menu',
      'help': 'contact_support',
      'support': 'contact_support',
      'cancel': 'cancel_order',
      'checkout': 'checkout',
    };

    for (const [command, actionId] of Object.entries(quickCommands)) {
      if (normalizedText === command || normalizedText.startsWith(command + ' ')) {
        console.log(`⚡ Quick command matched: ${command} -> ${actionId}`);
        await handleInteractiveResponse(distributorId, customerPhone, phoneNumberId, businessData, {
          button_reply: { id: actionId, title: command }
        });
        return;
      }
    }

    // Check for greeting patterns (more comprehensive)
    const greetingPatterns = [
      'hi', 'hello', 'hey', 'hii', 'hiii', 'hiiii', 'helo', 'hallo',
      'start', 'begin', 'home', 'main menu', 'menu',
      'good morning', 'good afternoon', 'good evening',
      'namaste', 'namaskar', 'नमस्ते'
    ];
    
    const isGreeting = greetingPatterns.some(g => 
      normalizedText === g || 
      normalizedText.startsWith(g + ' ') ||
      normalizedText.startsWith(g + '!')
    );
    
    if (isGreeting) {
      console.log(`👋 Greeting detected: "${messageText}" -> normalized: "${normalizedText}"`);
    }

    // Fetch active flows
    const flowsRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappFlows");
    
    const flowsSnapshot = await flowsRef.where("isActive", "==", true).get();
    console.log(`📋 Found ${flowsSnapshot.size} active flow(s)`);

    // Find matching flow
    let matchedFlow = null;
    if (!flowsSnapshot.empty) {
      for (const flowDoc of flowsSnapshot.docs) {
        const flow = flowDoc.data();
        const keywords = flow.triggerKeywords || [];
        console.log(`  🔍 Checking flow "${flow.name}" with keywords: [${keywords.join(', ')}]`);
        
        for (const keyword of keywords) {
          const keywordLower = keyword?.toLowerCase() || '';
          if (normalizedText === keywordLower || 
              normalizedText.includes(keywordLower)) {
            matchedFlow = { id: flowDoc.id, ...flow };
            console.log(`✅ Matched flow: ${flow.name} (keyword: "${keyword}")`);
            break;
          }
        }
        if (matchedFlow) break;
      }
    }
    
    if (!matchedFlow) {
      console.log(`📭 No flow matched for: "${normalizedText}"`);
    }

    if (matchedFlow) {
      // Execute matched flow
      try {
        await executeFlowNodes(distributorId, customerPhone, phoneNumberId, businessData, matchedFlow);
        return;
      } catch (flowError) {
        console.error("❌ Error executing matched flow, trying fallback:", flowError);
        // Fall through to Order Bot welcome as backup
      }
    }

    // No flow matched - check Order Bot config
    const orderBotRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappBot")
      .doc("orderConfig");
    
    const orderBotDoc = await orderBotRef.get();
    
    if (orderBotDoc.exists && orderBotDoc.data().enabled) {
      const config = orderBotDoc.data();
      
      if (isGreeting) {
        // Send Order Bot welcome for greetings
        console.log("👋 Greeting detected, sending Order Bot welcome");
        try {
          await sendOrderBotWelcome(distributorId, customerPhone, phoneNumberId, businessData, config);
          return;
        } catch (welcomeError) {
          console.error("❌ Error sending Order Bot welcome, trying fallback:", welcomeError);
          // Fall through to basic greeting
          try {
            const accessToken = businessData.whatsappAccessToken || getSystemUserToken();
            if (accessToken) {
              await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
                "Hello! 👋\n\nHow can I help you today?\n\nSend:\n• *Browse* - View products\n• *Orders* - View your orders\n• *Help* - Get support");
              await storeOutgoingMessage(distributorId, customerPhone, "Fallback greeting sent", "fallback_greeting");
              console.log("✅ Sent fallback greeting message");
              return;
            }
          } catch (fallbackError) {
            console.error("❌ Fallback greeting also failed:", fallbackError);
          }
        }
      }
      
      // Check if user is collecting customer info
      if (session?.state === 'collecting_name') {
        const normalizedText = text.toLowerCase().trim();
        if (normalizedText === 'skip') {
          // Skip name, go to address (or skip both)
          await updateSession(distributorId, customerPhone, { 
            state: 'collecting_address',
            tempCustomerInfo: { name: null }
          });
          await updateSession(distributorId, customerPhone, { state: 'collecting_address' });
          await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
            "⏭️ Name skipped.\n\n📍 *Your Address*\n\nPlease send your complete delivery address:\n\nExample:\n123, Main Street\nNear Park\nCity, State - 123456\n\n_Or send 'skip' to skip this step_");
          return;
        }
        // Process name and ask for address
        await processCustomerName(distributorId, customerPhone, phoneNumberId, accessToken, text, session);
        return;
      }
      
      if (session?.state === 'collecting_address') {
        const normalizedText = text.toLowerCase().trim();
        if (normalizedText === 'skip') {
          // Skip address, proceed with name only or none
          const customerName = session.tempCustomerInfo?.name || null;
          if (customerName) {
            // Save name only
            await saveCustomerInfo(distributorId, customerPhone, { name: customerName, address: null });
          }
          // Show order summary
          await showOrderSummaryWithInfo(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData, customerName, null);
          return;
        }
        // Process address
        await processCustomerAddress(distributorId, customerPhone, phoneNumberId, accessToken, text, session, businessData);
        return;
      }
      
      // Check if user is in a specific state and handle accordingly
      if (session?.state === 'tracking') {
        // User is trying to track an order
        const orderIdMatch = normalizedText.match(/(?:track\s*#?|order\s*#?|status\s*#?)([a-z0-9]+)|^([a-z0-9]{6,})$/i);
        const orderId = orderIdMatch?.[1] || orderIdMatch?.[2];
        if (orderId && session.state === 'tracking') {
          await sendOrderStatus(distributorId, customerPhone, phoneNumberId, accessToken, orderId.toUpperCase());
          await updateSession(distributorId, customerPhone, { state: 'idle' });
          return;
        } else if (orderIdMatch && session.state !== 'tracking') {
          // User directly typed order ID without being in tracking state
          await sendOrderStatus(distributorId, customerPhone, phoneNumberId, accessToken, orderId.toUpperCase());
          return;
        } else if (session.state === 'tracking') {
          // In tracking state but order ID not found, prompt again
          await sendOrderStatusPrompt(distributorId, customerPhone, phoneNumberId, accessToken);
          return;
        }
      }
      
      // For unrecognized messages, send helpful response
      if (!session?.state || session.state === 'idle') {
        console.log("❓ Unrecognized message, sending help");
        await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
          type: "button",
          body: { 
            text: `I'm not sure what you mean by "${messageText}".\n\nHere's what I can help you with:` 
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "browse_products", title: "🛒 Browse Products" }},
              { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" }},
              { type: "reply", reply: { id: "contact_support", title: "💬 Get Help" }},
            ]
          }
        });
        await storeOutgoingMessage(distributorId, customerPhone, "Help menu sent", "help_response");
      }
    } else {
      // Bot not enabled - log clearly for debugging
      if (isGreeting) {
        console.log("⚠️ WARNING: Customer sent greeting but bot is not enabled!");
        console.log("   - Order Bot config exists:", orderBotDoc.exists);
        if (orderBotDoc.exists) {
          console.log("   - Order Bot enabled:", orderBotDoc.data()?.enabled);
        }
        console.log("   - Active flows count:", flowsSnapshot.size);
        console.log("   ACTION REQUIRED: Enable bot in Dashboard > WhatsApp Hub > Bot Setup");
      } else {
        console.log("📭 Order Bot not enabled and no flows match for:", normalizedText);
      }
    }
    
  } catch (error) {
    console.error("❌ Flow automation error:", error);
  }
}

/**
 * Send Order Bot welcome message with buttons
 */
async function sendOrderBotWelcome(distributorId, customerPhone, phoneNumberId, businessData, config) {
  try {
        // Try multiple sources for access token
    const accessToken = businessData.whatsappAccessToken || getSystemUserToken();
    if (!accessToken) {
      console.warn("⚠️ No WhatsApp access token available (checked businessData and system user token)");
      return;
    }
    console.log("🔑 Using access token for Order Bot (source: " + (businessData.whatsappAccessToken ? "businessData" : "systemUser") + ")");

    const welcomeMessage = config.welcomeMessage || "Welcome! How can I help you today?";
    const menuOptions = config.menuOptions || {};

    // Use a LIST for main menu so we can show 4+ options cleanly (more scalable than 3 buttons)
    const rows = [];
    if (menuOptions.browseProducts?.enabled !== false) {
      rows.push({
        id: "browse_products",
        title: (menuOptions.browseProducts?.label || "🛒 Browse Products").substring(0, 24),
        description: "Browse items and add to cart".substring(0, 72),
      });
    }
    if (menuOptions.viewOrders?.enabled !== false) {
      rows.push({
        id: "view_orders",
        title: (menuOptions.viewOrders?.label || "📦 My Orders").substring(0, 24),
        description: "View and track your recent orders".substring(0, 72),
      });
    }
    if (menuOptions.trackOrder?.enabled !== false) {
      rows.push({
        id: "track_order",
        title: (menuOptions.trackOrder?.label || "🚚 Track Order").substring(0, 24),
        description: "Check status by Order ID".substring(0, 72),
      });
    }
    // Support option (important for end-to-end flow)
    if (menuOptions.support?.enabled !== false) {
      rows.push({
        id: "contact_support",
        title: (menuOptions.support?.label || "💬 Get Help").substring(0, 24),
        description: "Talk to support / customer representative".substring(0, 72),
      });
    }

    if (rows.length > 0) {
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "list",
        header: { type: "text", text: (businessData.businessName || "Main Menu").substring(0, 60) },
        body: { text: welcomeMessage },
        footer: { text: "Select an option to continue" },
        action: {
          button: "Open Menu",
          sections: [{ title: "Menu", rows }],
        },
      });
      await storeOutgoingMessage(distributorId, customerPhone, "Main menu list sent", "order_bot_welcome");
    } else {
      await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken, welcomeMessage);
      await storeOutgoingMessage(distributorId, customerPhone, "Welcome text sent", "order_bot_welcome");
    }

    console.log(`✅ Sent Order Bot welcome to +${customerPhone}`);
  } catch (error) {
    console.error("❌ Error sending Order Bot welcome:", error);
  }
}

/**
 * Upsert a support ticket for a customer (for human follow-up)
 */
async function upsertSupportTicket(distributorId, customerPhone, messageText) {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const ticketRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappSupportTickets")
      .doc(cleanPhone);

    await ticketRef.set({
      phone: customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`,
      status: "open",
      lastMessage: messageText,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Also append message into a subcollection for full transcript
    await ticketRef.collection("messages").add({
      direction: "incoming",
      text: messageText,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("Could not upsert support ticket (non-critical):", e);
  }
}

/**
 * Execute flow nodes and send responses
 */
async function executeFlowNodes(distributorId, customerPhone, phoneNumberId, businessData, flow) {
  try {
    // Validate required parameters
    if (!phoneNumberId) {
      console.error("❌ CRITICAL: phoneNumberId is missing!");
      console.error("   - phoneNumberId:", phoneNumberId);
      console.error("   - businessData.whatsappPhoneNumberId:", businessData?.whatsappPhoneNumberId);
      throw new Error("phoneNumberId is required");
    }

    // Try multiple sources for access token
    const accessToken = businessData.whatsappAccessToken || getSystemUserToken();
    if (!accessToken) {
      console.error("❌ CRITICAL: No WhatsApp access token available for flow execution");
      console.error("   - businessData.whatsappAccessToken:", !!businessData.whatsappAccessToken);
      console.error("   - systemUserToken:", !!getSystemUserToken());
      throw new Error("No access token available");
    }
    
    console.log("🔑 Using access token for flow execution (source: " + (businessData.whatsappAccessToken ? "businessData" : "systemUser") + ")");
    console.log(`📋 Executing flow: ${flow.name} with ${flow.nodes?.length || 0} nodes`);
    console.log(`📋 Parameters: phoneNumberId=${phoneNumberId}, customerPhone=${customerPhone}`);

    const nodes = flow.nodes || [];
    
    if (nodes.length === 0) {
      console.warn("⚠️ Flow has no nodes to execute");
      throw new Error("Flow has no nodes");
    }
    
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      console.log(`  📍 Executing node ${i + 1}/${nodes.length}: ${node.type}`);
      
      try {
        switch (node.type) {
          case 'message':
            if (node.text) {
              const processedText = processTemplateVariables(node.text, businessData, customerPhone);
              console.log(`  📤 Sending message: ${processedText.substring(0, 50)}...`);
              await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken, processedText);
              await storeOutgoingMessage(distributorId, customerPhone, processedText, "flow_message");
              console.log(`  ✅ Message sent successfully`);
            }
            break;
            
          case 'buttons':
            if (node.buttons && node.buttons.length > 0) {
              const buttons = node.buttons.slice(0, 3).map((btn, idx) => ({
                type: "reply",
                reply: { id: btn.action || `btn_${idx}`, title: btn.label.substring(0, 20) }
              }));
              
              console.log(`  📤 Sending buttons: ${buttons.map(b => b.reply.title).join(', ')}`);
              await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
                type: "button",
                body: { text: node.text || "Please select an option:" },
                action: { buttons }
              });
              await storeOutgoingMessage(distributorId, customerPhone, "Interactive buttons sent", "flow_buttons");
              console.log(`  ✅ Buttons sent successfully`);
            }
            break;
            
          case 'list':
            // For list, we need to fetch products from inventory
            if (node.action === 'view_products') {
              console.log(`  📤 Sending product catalog`);
              await sendProductCatalog(distributorId, customerPhone, phoneNumberId, accessToken);
              console.log(`  ✅ Product catalog sent`);
            }
            break;
        }
      } catch (nodeError) {
        console.error(`  ❌ Error executing node ${i + 1} (${node.type}):`, nodeError);
        // Continue to next node instead of failing completely
      }
      
      // Small delay between messages to respect rate limits
      if (i < nodes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`✅ Successfully executed flow "${flow.name}" for +${customerPhone}`);
    
  } catch (error) {
    console.error("❌ Error executing flow nodes:", error);
    console.error("❌ Flow execution error stack:", error.stack);
    throw error; // Re-throw so caller can handle fallback
  }
}

/**
 * Send product catalog as list message
 */
async function sendProductCatalog(distributorId, customerPhone, phoneNumberId, accessToken) {
  try {
    console.log(`📦 ========== SEND PRODUCT CATALOG ==========`);
    console.log(`📦 Distributor ID: ${distributorId}`);
    console.log(`📦 Customer Phone: ${customerPhone}`);
    
    // Fetch products from inventory - increase limit and ensure we get products
    const productsRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("products");
    
    // First check if collection exists and has products
    const productsSnapshot = await productsRef.limit(100).get();
    console.log(`📦 Total products in database: ${productsSnapshot.size}`);
    
    if (productsSnapshot.empty) {
      console.log(`❌ No products found in inventory`);
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: { 
          text: "📦 *Our Catalog*\n\nSorry, no products are currently available.\n\nPlease check back later or contact us for assistance." 
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
            { type: "reply", reply: { id: "contact_support", title: "💬 Contact Support" }},
          ]
        }
      });
      await storeOutgoingMessage(distributorId, customerPhone, "Catalog empty message sent", "catalog_empty");
      return;
    }

    // Group products by category - process all products
    const productsByCategory = {};
    let totalProductsWithStock = 0;
    
    productsSnapshot.docs.forEach(doc => {
      try {
        const product = doc.data();
        const category = product.category || "General";
        if (!productsByCategory[category]) {
          productsByCategory[category] = [];
        }
        
        const productName = (product.productName || product.name || "Product");
        const price = product.sellingPrice || product.price || product.mrp || 0;
        const stock = product.stock !== undefined ? product.stock : (product.quantity !== undefined ? product.quantity : 999);
        
        // Only include products with stock > 0 (or if stock field doesn't exist, assume in stock)
        if (stock > 0 || (product.stock === undefined && product.quantity === undefined)) {
          productsByCategory[category].push({
            id: doc.id, // This ID will be sent back when user selects
            title: productName.substring(0, 24),
            description: `₹${price.toLocaleString('en-IN')}${stock && stock !== 999 ? ' • In stock' : ' • Available'}`.substring(0, 72),
          });
          totalProductsWithStock++;
        }
      } catch (err) {
        console.error(`❌ Error processing product ${doc.id}:`, err);
      }
    });
    
    console.log(`📦 Products with stock: ${totalProductsWithStock} across ${Object.keys(productsByCategory).length} categories`);

    // Build list sections with proper structure
    const sections = Object.entries(productsByCategory)
      .filter(([category, products]) => products.length > 0) // Only include categories with products
      .slice(0, 10)
      .map(([category, products]) => {
        const rows = products.slice(0, 10).map(p => {
          console.log(`📦 Adding product to list: id=${p.id}, title=${p.title}`);
          return {
            id: p.id, // This MUST be the Firestore document ID - will be returned as list_reply.id
            title: p.title,
            description: p.description,
          };
        });
        return {
          title: category.substring(0, 24),
          rows: rows,
        };
      });
    
    // If no products in stock, send a helpful message
    if (sections.length === 0 || sections.every(s => s.rows.length === 0)) {
      console.log(`❌ No products available in stock after filtering`);
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: { 
          text: "📦 *Product Catalog*\n\nSorry, all products are currently out of stock.\n\nWe're restocking soon. Please check back later!" 
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
            { type: "reply", reply: { id: "contact_support", title: "💬 Contact Us" }},
          ]
        }
      });
      await storeOutgoingMessage(distributorId, customerPhone, "All products out of stock", "catalog_out_of_stock");
      return;
    }

    const totalProducts = sections.reduce((sum, s) => sum + s.rows.length, 0);
    console.log(`📦 Sending product list with ${sections.length} categories, ${totalProducts} total products`);
    sections.forEach(s => {
      console.log(`  📁 Category: ${s.title} - ${s.rows.length} products`);
      s.rows.forEach(r => console.log(`    - ${r.title} (ID: ${r.id})`));
    });

    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "list",
      header: { type: "text", text: "Our Products" },
      body: { text: "Browse our product catalog and select items to order:" },
      footer: { text: "Select a product to add to cart" },
      action: {
        button: "View Products",
        sections
      }
    });

    console.log(`✅ Product catalog sent successfully`);
    await storeOutgoingMessage(distributorId, customerPhone, "Product catalog sent", "flow_catalog");
    
  } catch (error) {
    console.error("❌ Error sending product catalog:", error);
  }
}

/**
 * Process template variables in message text
 */
function processTemplateVariables(text, businessData, customerPhone) {
  return text
    .replace(/{business_name}/g, businessData.businessName || "Our Store")
    .replace(/{customer_name}/g, "Valued Customer")
    .replace(/{customer_phone}/g, customerPhone);
}

/**
 * Send WhatsApp text message
 */
async function sendWhatsAppTextMessage(phoneNumberId, to, accessToken, text) {
  try {
    // Validate inputs
    if (!phoneNumberId) {
      throw new Error("phoneNumberId is required");
    }
    if (!to) {
      throw new Error("Recipient phone number is required");
    }
    if (!accessToken) {
      throw new Error("Access token is required");
    }
    if (!text) {
      throw new Error("Message text is required");
    }

    // Clean phone number
    const cleanTo = to.replace("+", "").replace(/\D/g, "");
    if (cleanTo.length < 10) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    console.log(`📤 Sending text message to ${cleanTo} via phoneNumberId: ${phoneNumberId}`);
    
    // Use native fetch (Node 18+) or fallback to node-fetch
    let fetchFn;
    try {
      // Try native fetch first (Node 18+)
      if (typeof fetch !== 'undefined') {
        fetchFn = fetch;
      } else {
        // Fallback to node-fetch
        const nodeFetch = await import("node-fetch");
        fetchFn = nodeFetch.default;
      }
    } catch (importError) {
      console.error("❌ Failed to import fetch:", importError);
      throw new Error("Failed to load fetch library");
    }
    
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "text",
      text: { body: text }
    };

    console.log(`📤 API URL: ${url}`);
    console.log(`📤 Payload: ${JSON.stringify({ ...payload, text: { body: text.substring(0, 50) + "..." } })}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error("❌ WhatsApp API error response:", JSON.stringify(result, null, 2));
      console.error("❌ Status code:", response.status);
      console.error("❌ Status text:", response.statusText);
      throw new Error(result.error?.message || `Failed to send message: ${response.status} ${response.statusText}`);
    }
    
    console.log(`✅ Message sent successfully. Message ID: ${result.messages?.[0]?.id || 'N/A'}`);
    return result;
    
  } catch (error) {
    console.error("❌ Error in sendWhatsAppTextMessage:", error);
    console.error("❌ Error details:", {
      phoneNumberId: phoneNumberId ? `${phoneNumberId.substring(0, 10)}...` : 'undefined',
      to: to ? `${to.substring(0, 10)}...` : 'undefined',
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken ? accessToken.length : 0,
      errorMessage: error.message,
      errorStack: error.stack
    });
    throw error;
  }
}

/**
 * Send WhatsApp interactive message (buttons or list)
 */
async function sendWhatsAppInteractiveMessage(phoneNumberId, to, accessToken, interactive) {
  try {
    // Validate inputs
    if (!phoneNumberId) {
      throw new Error("phoneNumberId is required");
    }
    if (!to) {
      throw new Error("Recipient phone number is required");
    }
    if (!accessToken) {
      throw new Error("Access token is required");
    }
    if (!interactive) {
      throw new Error("Interactive payload is required");
    }

    // Clean phone number
    const cleanTo = to.replace("+", "").replace(/\D/g, "");
    if (cleanTo.length < 10) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    console.log(`📤 Sending interactive message to ${cleanTo} via phoneNumberId: ${phoneNumberId}`);
    console.log(`📤 Interactive type: ${interactive.type}`);
    
    // Use native fetch (Node 18+) or fallback to node-fetch
    let fetchFn;
    try {
      // Try native fetch first (Node 18+)
      if (typeof fetch !== 'undefined') {
        fetchFn = fetch;
      } else {
        // Fallback to node-fetch
        const nodeFetch = await import("node-fetch");
        fetchFn = nodeFetch.default;
      }
    } catch (importError) {
      console.error("❌ Failed to import fetch:", importError);
      throw new Error("Failed to load fetch library");
    }
    
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "interactive",
      interactive
    };

    console.log(`📤 API URL: ${url}`);
    console.log(`📤 Interactive payload keys: ${Object.keys(interactive).join(', ')}`);

    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error("❌ WhatsApp API error response:", JSON.stringify(result, null, 2));
      console.error("❌ Status code:", response.status);
      console.error("❌ Status text:", response.statusText);
      throw new Error(result.error?.message || `Failed to send interactive message: ${response.status} ${response.statusText}`);
    }
    
    console.log(`✅ Interactive message sent successfully. Message ID: ${result.messages?.[0]?.id || 'N/A'}`);
    return result;
    
  } catch (error) {
    console.error("❌ Error in sendWhatsAppInteractiveMessage:", error);
    console.error("❌ Error details:", {
      phoneNumberId: phoneNumberId ? `${phoneNumberId.substring(0, 10)}...` : 'undefined',
      to: to ? `${to.substring(0, 10)}...` : 'undefined',
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken ? accessToken.length : 0,
      interactiveType: interactive?.type || 'undefined',
      errorMessage: error.message,
      errorStack: error.stack
    });
    throw error;
  }
}

/**
 * Store outgoing message in Firestore
 */
async function storeOutgoingMessage(distributorId, to, text, messageType) {
  try {
    const messagesRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappMessages");
    
    await messagesRef.add({
      to: to.startsWith("+") ? to : `+${to}`,
      text,
      message: text,
      messageType,
      direction: "outgoing",
      status: "sent",
      automated: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn("Could not store outgoing message:", error);
  }
}

/**
 * ============================================
 * SESSION MANAGEMENT - Track conversation state
 * ============================================
 */

/**
 * Get or create a conversation session for a customer
 */
async function getOrCreateSession(distributorId, customerPhone) {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const sessionRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappSessions")
      .doc(cleanPhone);
    
    const sessionDoc = await sessionRef.get();
    
    if (sessionDoc.exists) {
      const data = sessionDoc.data();
      // Check if session is stale (more than 24 hours old)
      const lastActivity = data.lastActivity?.toDate?.() || new Date(0);
      const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceActivity > 24) {
        // Reset stale session
        const newSession = {
          phone: `+${cleanPhone}`,
          state: "idle",
          currentFlow: null,
          currentStep: 0,
          cart: [],
          cartTotal: 0,
          paymentMethod: null, // COD | ONLINE | CREDIT
          creditDays: null,
          lastActivity: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await sessionRef.set(newSession);
        return { id: cleanPhone, ...newSession, isNew: true };
      }
      
      // Update last activity
      await sessionRef.update({
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return { id: cleanPhone, ...data, isNew: false };
    }
    
    // Create new session
    const newSession = {
      phone: `+${cleanPhone}`,
      state: "idle",
      currentFlow: null,
      currentStep: 0,
      cart: [],
      cartTotal: 0,
      paymentMethod: null, // COD | ONLINE | CREDIT
      creditDays: null,
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await sessionRef.set(newSession);
    return { id: cleanPhone, ...newSession, isNew: true };
    
  } catch (error) {
    console.error("❌ Error getting/creating session:", error);
    return null;
  }
}

/**
 * Update session state
 */
async function updateSession(distributorId, customerPhone, updates) {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const sessionRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappSessions")
      .doc(cleanPhone);
    
    await sessionRef.update({
      ...updates,
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return true;
  } catch (error) {
    console.error("❌ Error updating session:", error);
    return false;
  }
}

/**
 * ============================================
 * PAYMENT MODE (COD / ONLINE / CREDIT)
 * ============================================
 */
async function getOrderBotConfig(distributorId) {
  try {
    const ref = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappBot")
      .doc("orderConfig");
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn("Could not load order bot config (non-critical):", e);
    return null;
  }
}

function getEnabledPaymentMethods(orderBotConfig) {
  const ps = orderBotConfig?.paymentSettings || {};
  const methods = [];
  if (ps.acceptCOD) methods.push("COD");
  if (ps.acceptOnline) methods.push("ONLINE");
  if (ps.acceptCredit) methods.push("CREDIT");
  return methods;
}

function formatPaymentLine(paymentMethod, creditDays) {
  if (paymentMethod === "ONLINE") return "💳 Payment: Online Payment";
  if (paymentMethod === "CREDIT") return `🧾 Payment: Credit${creditDays ? ` (${creditDays} days)` : ""}`;
  if (paymentMethod === "COD") return "💵 Payment: Cash on Delivery";
  return "💳 Payment: Not selected";
}

async function promptPaymentMethod(distributorId, customerPhone, phoneNumberId, accessToken, enabledMethods) {
  const buttons = [];
  // WhatsApp button title max length is 20 characters
  if (enabledMethods.includes("COD")) buttons.push({ type: "reply", reply: { id: "pay_cod", title: "💵 COD" } });
  if (enabledMethods.includes("ONLINE")) buttons.push({ type: "reply", reply: { id: "pay_online", title: "💳 Online" } });
  if (enabledMethods.includes("CREDIT")) buttons.push({ type: "reply", reply: { id: "pay_credit", title: "🧾 Credit" } });

  await updateSession(distributorId, customerPhone, { state: "selecting_payment" });

  await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
    type: "button",
    body: { text: "💳 *Choose Payment Method*\n\nPlease select how you want to pay:" },
    action: { buttons: buttons.slice(0, 3) },
  });
  await storeOutgoingMessage(distributorId, customerPhone, "Payment method prompt sent", "payment_prompt");
}

async function ensurePaymentSelected(distributorId, customerPhone, phoneNumberId, accessToken, session) {
  const orderBotConfig = await getOrderBotConfig(distributorId);
  const enabledMethods = getEnabledPaymentMethods(orderBotConfig);

  if (enabledMethods.length === 0) {
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: {
        text:
          "⚠️ *Payment not available*\n\nThis store has no payment methods enabled right now.\n\nPlease contact support or try again later.",
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "contact_support", title: "💬 Get Help" } },
          { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" } },
        ],
      },
    });
    await storeOutgoingMessage(distributorId, customerPhone, "No payment methods enabled", "payment_unavailable");
    return { ok: false, orderBotConfig, enabledMethods };
  }

  if (session?.paymentMethod && enabledMethods.includes(session.paymentMethod)) {
    return {
      ok: true,
      orderBotConfig,
      enabledMethods,
      paymentMethod: session.paymentMethod,
      creditDays: session.creditDays || null,
    };
  }

  if (enabledMethods.length === 1) {
    const method = enabledMethods[0];
    const creditDays = method === "CREDIT" ? (orderBotConfig?.paymentSettings?.creditDays || null) : null;
    await updateSession(distributorId, customerPhone, { paymentMethod: method, creditDays, state: "confirming" });
    return { ok: true, orderBotConfig, enabledMethods, paymentMethod: method, creditDays };
  }

  await promptPaymentMethod(distributorId, customerPhone, phoneNumberId, accessToken, enabledMethods);
  return { ok: false, orderBotConfig, enabledMethods };
}

/**
 * ============================================
 * INTERACTIVE RESPONSE HANDLER
 * ============================================
 */

/**
 * Handle interactive button/list responses from customers
 */
async function handleInteractiveResponse(distributorId, customerPhone, phoneNumberId, businessData, interactiveData) {
  try {
    const accessToken = businessData.whatsappAccessToken || getSystemUserToken();
    if (!accessToken) {
      console.warn("⚠️ No access token available for interactive response");
      return;
    }

    const buttonId = interactiveData.button_reply?.id;
    const listId = interactiveData.list_reply?.id;
    const actionId = buttonId || listId;
    const actionTitle = interactiveData.button_reply?.title || interactiveData.list_reply?.title || '';
    
    console.log(`🔘 ========== INTERACTIVE RESPONSE ==========`);
    console.log(`🔘 Button ID: ${buttonId}`);
    console.log(`🔘 List ID: ${listId}`);
    console.log(`🔘 Action ID: ${actionId}`);
    console.log(`🔘 Action Title: "${actionTitle}"`);
    console.log(`🔘 Full interactive data:`, JSON.stringify(interactiveData, null, 2));

    // Get or create session
    const session = await getOrCreateSession(distributorId, customerPhone);

    // Handle standard actions
    switch (actionId) {
      case 'browse_products':
      case 'browse_catalog':  // FlowBuilder uses this action ID
      case 'view_products':
        console.log(`📦 Sending product catalog for action: ${actionId}`);
        await updateSession(distributorId, customerPhone, { state: 'browsing' });
        await sendProductCatalog(distributorId, customerPhone, phoneNumberId, accessToken);
        break;
        
      case 'view_orders':
      case 'my_orders':
        console.log(`📋 Sending customer orders for: ${customerPhone}`);
        await updateSession(distributorId, customerPhone, { state: 'viewing_orders' });
        await sendCustomerOrders(distributorId, customerPhone, phoneNumberId, accessToken);
        break;
        
      case 'track_order':
        await sendOrderStatusPrompt(distributorId, customerPhone, phoneNumberId, accessToken);
        await updateSession(distributorId, customerPhone, { state: 'tracking' });
        break;
        
      case 'view_cart':
        await sendCartSummary(distributorId, customerPhone, phoneNumberId, accessToken, session);
        break;
        
      case 'checkout':
        await processCheckout(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData);
        break;
        
      case 'use_saved_address':
        // Use saved address and proceed to order summary
        const savedInfo = session.tempCustomerInfo || {};
        await showOrderSummaryWithInfo(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData, savedInfo.name, savedInfo.address);
        break;
        
      case 'update_address':
        // Start collecting new address
        await startCollectingCustomerName(distributorId, customerPhone, phoneNumberId, accessToken);
        break;
        
      case 'add_customer_info':
        // Start collecting customer info
        await startCollectingCustomerName(distributorId, customerPhone, phoneNumberId, accessToken);
        break;
        
      case 'skip_customer_info':
        // Skip customer info and proceed with phone only
        await updateSession(distributorId, customerPhone, { 
          state: 'confirming',
          tempCustomerInfo: { name: null, address: null }
        });
        await showOrderSummaryWithInfo(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData, null, null);
        break;

      // Payment method selection (during checkout)
      case 'pay_cod':
      case 'pay_online':
      case 'pay_credit': {
        const orderBotConfig = await getOrderBotConfig(distributorId);
        const enabledMethods = getEnabledPaymentMethods(orderBotConfig);
        const map = { pay_cod: "COD", pay_online: "ONLINE", pay_credit: "CREDIT" };
        const chosen = map[actionId];
        if (!chosen || !enabledMethods.includes(chosen)) {
          await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken, "⚠️ This payment option is not available. Please choose another.");
          await promptPaymentMethod(distributorId, customerPhone, phoneNumberId, accessToken, enabledMethods);
          break;
        }

        const creditDays = chosen === "CREDIT" ? (orderBotConfig?.paymentSettings?.creditDays || null) : null;
        await updateSession(distributorId, customerPhone, { paymentMethod: chosen, creditDays, state: "confirming" });

        const latest = await getOrCreateSession(distributorId, customerPhone);
        const savedInfo = latest?.tempCustomerInfo || {};
        await showOrderSummaryWithInfo(
          distributorId,
          customerPhone,
          phoneNumberId,
          accessToken,
          latest,
          businessData,
          savedInfo.name || null,
          savedInfo.address || null
        );
        break;
      }
        
      case 'confirm_order':
        await createWhatsAppOrder(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData);
        break;
        
      case 'cancel_order':
        await updateSession(distributorId, customerPhone, { 
          state: 'idle', 
          cart: [], 
          cartTotal: 0 
        });
        await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
          "❌ Order cancelled. Your cart has been cleared.\n\nSend *Hi* to start again!");
        break;
        
      case 'clear_cart':
        await updateSession(distributorId, customerPhone, { cart: [], cartTotal: 0 });
        await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
          "🗑️ Cart cleared!\n\nSend *Browse* to see products again.");
        break;
        
      case 'continue_shopping':
        await sendProductCatalog(distributorId, customerPhone, phoneNumberId, accessToken);
        break;
        
      case 'contact_support':
      case 'talk_to_human':
        await updateSession(distributorId, customerPhone, { state: 'support' });
        await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
          type: "button",
          body: {
            text:
              "👋 *Support*\n\nPlease describe your issue. A team member will respond shortly.\n\nYou can also go back to the main menu anytime.",
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" } },
              { type: "reply", reply: { id: "track_order", title: "🚚 Track Order" } },
              { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" } },
            ],
          },
        });
        break;

      case 'order_support':
        await updateSession(distributorId, customerPhone, { state: 'support' });
        await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
          type: "button",
          body: {
            text:
              "📦 *Order Support*\n\nPlease share your Order ID (example: WAABC123) and what issue you are facing.\n\nWe’ll help you quickly.",
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "track_order", title: "🚚 Track Order" } },
              { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" } },
              { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" } },
            ],
          },
        });
        break;

      case 'payment_support':
        await updateSession(distributorId, customerPhone, { state: 'support' });
        await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
          type: "button",
          body: {
            text:
              "💰 *Payment Help*\n\nPlease share your Order ID and what payment issue you are facing (pending, paid but not updated, etc.).",
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" } },
              { type: "reply", reply: { id: "talk_to_human", title: "👤 Talk to Human" } },
              { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" } },
            ],
          },
        });
        break;
        
      case 'main_menu':
      case 'back_to_menu':
        await updateSession(distributorId, customerPhone, { state: 'idle' });
        // Re-send welcome menu
        const orderBotRef = db.collection("businesses").doc(distributorId).collection("whatsappBot").doc("orderConfig");
        const orderBotDoc = await orderBotRef.get();
        if (orderBotDoc.exists && orderBotDoc.data().enabled) {
          await sendOrderBotWelcome(distributorId, customerPhone, phoneNumberId, businessData, orderBotDoc.data());
        } else {
          await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
            "👋 How can I help you?\n\nSend:\n• *Browse* - View products\n• *Orders* - View your orders\n• *Help* - Contact support");
        }
        break;
        
      default:
        // Check if this is a known action pattern first (exclude common button actions)
        const knownActions = ['browse', 'catalog', 'products', 'orders', 'order', 'track', 'view', 'my', 'menu', 'support', 'help', 'contact', 'cart', 'checkout', 'confirm', 'cancel', 'clear', 'continue', 'create'];
        const isKnownAction = knownActions.some(action => actionId && actionId.toLowerCase().includes(action));
        
        if (isKnownAction) {
          console.log(`⚠️ Action pattern recognized but not mapped: ${actionId}`);
          // Try to send catalog if it's a browse/catalog related action
          if (actionId.toLowerCase().includes('browse') || actionId.toLowerCase().includes('catalog') || actionId.toLowerCase().includes('products')) {
            console.log(`📦 Redirecting to product catalog for action: ${actionId}`);
            await sendProductCatalog(distributorId, customerPhone, phoneNumberId, accessToken);
          } else {
            // Send help menu
            await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
              type: "button",
              body: { 
                text: `I didn't understand that option.\n\nHere's what I can help you with:` 
              },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "browse_products", title: "🛒 Browse Products" }},
                  { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" }},
                  { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
                ]
              }
            });
          }
        } else if (actionId && !actionId.startsWith('btn_') && actionId.length > 10 && !actionId.includes('_')) {
          // Product IDs from Firestore are usually alphanumeric strings without underscores
          // Button actions often have underscores, so exclude those
          console.log(`🛒 Treating as product selection: ${actionId}`);
          await handleProductSelection(distributorId, customerPhone, phoneNumberId, accessToken, actionId, session);
        } else {
          console.log(`⚠️ Unknown action: ${actionId}`);
          await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
            type: "button",
            body: { 
              text: `I didn't understand that option.\n\nHere's what I can help you with:` 
            },
            action: {
              buttons: [
                { type: "reply", reply: { id: "browse_products", title: "🛒 Browse Products" }},
                { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" }},
                { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
              ]
            }
          });
        }
    }
    
  } catch (error) {
    console.error("❌ Error handling interactive response:", error);
  }
}

/**
 * Handle product selection from catalog list
 */
async function handleProductSelection(distributorId, customerPhone, phoneNumberId, accessToken, productId, session) {
  try {
    console.log(`🛒 ========== PRODUCT SELECTION ==========`);
    console.log(`🛒 Product ID received: "${productId}"`);
    console.log(`🛒 Distributor ID: ${distributorId}`);
    console.log(`🛒 Customer: ${customerPhone}`);
    
    // Fetch product details
    const productRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("products")
      .doc(productId);
    
    console.log(`🛒 Fetching product document: ${productRef.path}`);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      console.error(`❌ Product not found in Firestore!`);
      console.error(`   - Product ID: ${productId}`);
      console.error(`   - Document path: ${productRef.path}`);
      
      // Try to list all available product IDs for debugging
      const allProductsRef = db.collection("businesses").doc(distributorId).collection("products");
      const allProductsSnap = await allProductsRef.limit(5).get();
      console.error(`   - Available product IDs:`, allProductsSnap.docs.map(d => d.id));
      
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: { 
          text: "❌ Sorry, this product is no longer available.\n\nPlease browse our catalog again to select another product." 
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "browse_products", title: "🛒 Browse Products" }},
            { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
          ]
        }
      });
      return;
    }
    
    console.log(`✅ Product found in Firestore`);
    
    const product = productDoc.data();
    const productName = product.productName || product.name || 'Product';
    const price = product.sellingPrice || product.price || 0;
    const stock = product.stock || product.quantity || 0;
    
    if (stock <= 0) {
      await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
        `❌ Sorry, *${productName}* is currently out of stock.\n\nPlease select another product.`);
      return;
    }
    
    // Add to cart
    const cart = session.cart || [];
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      cart.push({
        productId,
        name: productName,
        price,
        quantity: 1,
        total: price,
      });
    }
    
    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);
    
    // Update session
    await updateSession(distributorId, customerPhone, {
      state: 'cart',
      cart,
      cartTotal,
    });
    
    // Send confirmation with options
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { 
        text: `✅ *Added to cart!*\n\n${productName}\nPrice: ₹${price}\n\n🛒 *Cart Total: ₹${cartTotal}* (${cart.length} item${cart.length > 1 ? 's' : ''})`
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "checkout", title: "🛍️ Checkout" }},
          { type: "reply", reply: { id: "continue_shopping", title: "➕ Add More" }},
          { type: "reply", reply: { id: "view_cart", title: "🛒 View Cart" }},
        ]
      }
    });
    
    await storeOutgoingMessage(distributorId, customerPhone, `Added ${productName} to cart`, "cart_update");
    
  } catch (error) {
    console.error("❌ Error handling product selection:", error);
  }
}

/**
 * Send cart summary
 */
async function sendCartSummary(distributorId, customerPhone, phoneNumberId, accessToken, session) {
  try {
    const cart = session.cart || [];
    
    if (cart.length === 0) {
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: { text: "🛒 *Your cart is empty*\n\nBrowse our products to add items to your cart." },
        action: {
          buttons: [
            { type: "reply", reply: { id: "browse_products", title: "🛒 Browse Products" }},
            { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
          ]
        }
      });
      return;
    }
    
    let cartText = "🛒 *Your Cart*\n\n";
    cart.forEach((item, idx) => {
      cartText += `${idx + 1}. *${item.name}*\n`;
      cartText += `   ${item.quantity} × ₹${item.price} = ₹${item.total}\n\n`;
    });
    
    const cartTotal = session.cartTotal || cart.reduce((sum, item) => sum + item.total, 0);
    cartText += `━━━━━━━━━━━━━━━\n*Total: ₹${cartTotal}*`;
    
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { text: cartText },
      action: {
        buttons: [
          { type: "reply", reply: { id: "checkout", title: "🛍️ Checkout" }},
          { type: "reply", reply: { id: "continue_shopping", title: "➕ Add More" }},
          { type: "reply", reply: { id: "clear_cart", title: "🗑️ Clear Cart" }},
        ]
      }
    });
    
    await storeOutgoingMessage(distributorId, customerPhone, "Cart summary sent", "cart_view");
    
  } catch (error) {
    console.error("❌ Error sending cart summary:", error);
  }
}

/**
 * Get customer info by phone number
 */
async function getCustomerInfo(distributorId, customerPhone) {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const customerRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappCustomers")
      .doc(cleanPhone);
    
    const customerDoc = await customerRef.get();
    if (customerDoc.exists) {
      return { id: cleanPhone, ...customerDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("❌ Error getting customer info:", error);
    return null;
  }
}

/**
 * Save customer info
 */
async function saveCustomerInfo(distributorId, customerPhone, customerData) {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const customerRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappCustomers")
      .doc(cleanPhone);
    
    await customerRef.set({
      phone: customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`,
      ...customerData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastOrderAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    console.log(`✅ Customer info saved for: ${cleanPhone}`);
    return true;
  } catch (error) {
    console.error("❌ Error saving customer info:", error);
    return false;
  }
}

/**
 * Process checkout - check for customer info first
 */
async function processCheckout(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData) {
  try {
    const cart = session.cart || [];
    
    if (cart.length === 0) {
      await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
        "Your cart is empty. Please add products before checkout.");
      return;
    }
    
    // Check if we have existing customer info
    const customerInfo = await getCustomerInfo(distributorId, customerPhone);
    
    if (customerInfo && customerInfo.name && customerInfo.address) {
      // Customer has saved info - show options
      const cartTotal = session.cartTotal || cart.reduce((sum, item) => sum + item.total, 0);
      const businessName = businessData.businessName || "Our Store";
      
      let infoText = `📋 *Checkout*\n\n`;
      infoText += `*Saved Delivery Address:*\n`;
      infoText += `👤 Name: ${customerInfo.name}\n`;
      infoText += `📍 Address: ${customerInfo.address}\n`;
      infoText += `📱 Phone: ${customerPhone}\n\n`;
      infoText += `Would you like to use this address or update it?`;
      
      await updateSession(distributorId, customerPhone, { 
        state: 'reviewing_customer_info',
        tempCustomerInfo: { name: customerInfo.name, address: customerInfo.address }
      });
      
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: { text: infoText },
        action: {
          buttons: [
            { type: "reply", reply: { id: "use_saved_address", title: "✅ Use This Address" }},
            { type: "reply", reply: { id: "update_address", title: "📝 Update Address" }},
            { type: "reply", reply: { id: "skip_customer_info", title: "⏭️ Skip" }},
          ]
        }
      });
    } else {
      // No saved info - ask if they want to add
      await sendCustomerInfoPrompt(distributorId, customerPhone, phoneNumberId, accessToken);
    }
    
    await storeOutgoingMessage(distributorId, customerPhone, "Checkout initiated", "checkout");
    
  } catch (error) {
    console.error("❌ Error processing checkout:", error);
  }
}

/**
 * Prompt customer for info (with skip option)
 */
async function sendCustomerInfoPrompt(distributorId, customerPhone, phoneNumberId, accessToken) {
  try {
    await updateSession(distributorId, customerPhone, { state: 'collecting_customer_info' });
    
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { 
        text: "📋 *Delivery Information*\n\nWe need your delivery details to complete the order.\n\nWould you like to provide your name and address?" 
      },
      action: {
        buttons: [
          // WhatsApp button title max length is 20 characters
          { type: "reply", reply: { id: "add_customer_info", title: "✅ Add Details" }},
          { type: "reply", reply: { id: "skip_customer_info", title: "⏭️ Skip" }},
        ]
      }
    });
  } catch (error) {
    console.error("❌ Error sending customer info prompt:", error);
  }
}

/**
 * Start collecting customer name
 */
async function startCollectingCustomerName(distributorId, customerPhone, phoneNumberId, accessToken) {
  try {
    await updateSession(distributorId, customerPhone, { state: 'collecting_name' });
    
    await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
      "👤 *Your Name*\n\nPlease send your name for delivery:\n\nExample: Rahul Kumar\n\n_Or send 'skip' to use phone number only_");
  } catch (error) {
    console.error("❌ Error starting name collection:", error);
  }
}

/**
 * Process customer name and ask for address
 */
async function processCustomerName(distributorId, customerPhone, phoneNumberId, accessToken, name, session) {
  try {
    if (!name || name.trim().length < 2) {
      await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
        "Please enter a valid name (at least 2 characters) or send 'skip' to skip this step.");
      return;
    }
    
    await updateSession(distributorId, customerPhone, { 
      state: 'collecting_address',
      tempCustomerInfo: { name: name.trim() }
    });
    
    await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
      `✅ Name saved: *${name.trim()}*\n\n📍 *Your Address*\n\nPlease send your complete delivery address:\n\nExample:\n123, Main Street\nNear Park\nCity, State - 123456\n\n_Or send 'skip' to skip this step_`);
  } catch (error) {
    console.error("❌ Error processing customer name:", error);
  }
}

/**
 * Process customer address and show order summary
 */
async function processCustomerAddress(distributorId, customerPhone, phoneNumberId, accessToken, address, session, businessData) {
  try {
    const name = session.tempCustomerInfo?.name || '';
    const fullAddress = address.trim();
    
    if (fullAddress.length < 10) {
      await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
        "Please enter a complete address (at least 10 characters) or send 'skip' to skip this step.");
      return;
    }
    
    // Save customer info for future orders
    if (name && fullAddress) {
      await saveCustomerInfo(distributorId, customerPhone, {
        name: name,
        address: fullAddress,
      });
    }
    
    // Show order summary with customer info
    await showOrderSummaryWithInfo(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData, name, fullAddress);
    
  } catch (error) {
    console.error("❌ Error processing customer address:", error);
  }
}

/**
 * Show order summary with customer info and confirm
 */
async function showOrderSummaryWithInfo(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData, customerName = null, customerAddress = null) {
  try {
    const cart = session.cart || [];
    const cartTotal = session.cartTotal || cart.reduce((sum, item) => sum + item.total, 0);
    const businessName = businessData.businessName || "Our Store";

    // Ensure payment is selected (based on Order Bot settings)
    const payment = await ensurePaymentSelected(distributorId, customerPhone, phoneNumberId, accessToken, session);
    if (!payment.ok) return;
    
    let orderSummary = `📋 *Order Summary*\n\n`;
    cart.forEach((item, idx) => {
      orderSummary += `${idx + 1}. ${item.name} × ${item.quantity} = ₹${item.total}\n`;
    });
    orderSummary += `\n━━━━━━━━━━━━━━━\n`;
    orderSummary += `*Total: ₹${cartTotal}*\n\n`;
    
    if (customerName && customerAddress) {
      orderSummary += `*Delivery Details:*\n`;
      orderSummary += `👤 Name: ${customerName}\n`;
      orderSummary += `📍 Address: ${customerAddress}\n`;
      orderSummary += `📱 Phone: ${customerPhone}\n\n`;
    } else {
      orderSummary += `📍 Delivery to: ${customerPhone}\n`;
    }

    orderSummary += `${formatPaymentLine(payment.paymentMethod, payment.creditDays)}\n\n`;
    orderSummary += `_From: ${businessName}_`;
    
    await updateSession(distributorId, customerPhone, { 
      state: 'confirming',
      tempCustomerInfo: { name: customerName, address: customerAddress },
      paymentMethod: payment.paymentMethod,
      creditDays: payment.creditDays || null,
    });
    
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { text: orderSummary },
      action: {
        buttons: [
          { type: "reply", reply: { id: "confirm_order", title: "✅ Confirm Order" }},
          { type: "reply", reply: { id: "cancel_order", title: "❌ Cancel" }},
        ]
      }
    });
    
    await storeOutgoingMessage(distributorId, customerPhone, "Order summary with customer info", "checkout");
    
  } catch (error) {
    console.error("❌ Error showing order summary:", error);
  }
}

/**
 * Create WhatsApp order
 */
async function createWhatsAppOrder(distributorId, customerPhone, phoneNumberId, accessToken, session, businessData) {
  try {
    const cart = session.cart || [];
    
    if (cart.length === 0) {
      await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
        "Your cart is empty. Order could not be created.");
      return;
    }
    
    const cartTotal = session.cartTotal || cart.reduce((sum, item) => sum + item.total, 0);
    
    // Generate order ID
    const orderId = `WA${Date.now().toString(36).toUpperCase()}`;
    
    // Create order document
    const orderRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappOrders")
      .doc(orderId);
    
    // Get customer info from session
    const customerName = session.tempCustomerInfo?.name || null;
    const customerAddress = session.tempCustomerInfo?.address || null;
    
    // If customer info exists, save it for future orders
    if (customerName && customerAddress) {
      await saveCustomerInfo(distributorId, customerPhone, {
        name: customerName,
        address: customerAddress,
      });
    }
    
    // Payment selection from session + Order Bot defaults
    const orderBotConfig = await getOrderBotConfig(distributorId);
    const enabledMethods = getEnabledPaymentMethods(orderBotConfig);
    let paymentMethod = session.paymentMethod || null;
    if (!paymentMethod || !enabledMethods.includes(paymentMethod)) {
      paymentMethod = enabledMethods[0] || "COD";
    }
    const creditDays = paymentMethod === "CREDIT"
      ? (session.creditDays || orderBotConfig?.paymentSettings?.creditDays || null)
      : null;

    const orderData = {
      orderId,
      customerPhone: customerPhone.startsWith('+') ? customerPhone : `+${customerPhone}`,
      customerName: customerName || null,
      customerAddress: customerAddress || null,
      items: cart,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      total: cartTotal,
      status: 'pending',
      paymentMethod,
      creditDays: creditDays || null,
      paymentStatus: 'pending',
      source: 'whatsapp_bot',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await orderRef.set(orderData);
    console.log(`✅ Created WhatsApp order: ${orderId}`);
    
    // Clear cart and reset session
    await updateSession(distributorId, customerPhone, {
      state: 'idle',
      cart: [],
      cartTotal: 0,
      lastOrderId: orderId,
    });
    
    // Send confirmation
    const businessName = businessData.businessName || "Our Store";
    const orderCustomerName = orderData.customerName;
    const orderCustomerAddress = orderData.customerAddress;
    
    let confirmationMsg = `🎉 *Order Confirmed!*\n\n`;
    confirmationMsg += `Order ID: *#${orderId}*\n`;
    confirmationMsg += `Amount: *₹${cartTotal}*\n`;
    confirmationMsg += `Items: ${cart.length}\n\n`;
    
    if (orderCustomerName && orderCustomerAddress) {
      confirmationMsg += `*Delivery Details:*\n`;
      confirmationMsg += `👤 ${orderCustomerName}\n`;
      confirmationMsg += `📍 ${orderCustomerAddress}\n`;
      confirmationMsg += `📱 ${customerPhone}\n\n`;
    } else if (orderCustomerName) {
      confirmationMsg += `*Delivery Details:*\n`;
      confirmationMsg += `👤 ${orderCustomerName}\n`;
      confirmationMsg += `📱 ${customerPhone}\n\n`;
    } else {
      confirmationMsg += `📱 Delivery to: ${customerPhone}\n\n`;
    }
    
    confirmationMsg += `${formatPaymentLine(paymentMethod, creditDays)}\n\n`;
    confirmationMsg += `We'll notify you when your order is ready!\n\n`;
    confirmationMsg += `_Thank you for ordering from ${businessName}_`;
    
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { text: confirmationMsg },
      action: {
        buttons: [
          { type: "reply", reply: { id: "view_orders", title: "📦 My Orders" }},
          { type: "reply", reply: { id: "browse_products", title: "🛒 Order More" }},
          { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
        ]
      }
    });
    
    await storeOutgoingMessage(distributorId, customerPhone, `Order confirmed: ${orderId}`, "order_confirmed");
    
  } catch (error) {
    console.error("❌ Error creating order:", error);
    await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
      "Sorry, there was an error processing your order. Please try again or contact support.");
  }
}

/**
 * Send customer's orders
 */
async function sendCustomerOrders(distributorId, customerPhone, phoneNumberId, accessToken) {
  try {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    
    // Fetch customer's orders
    const ordersRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappOrders");
    
    // Try different phone formats
    const phoneFormats = [
      `+${cleanPhone}`,
      cleanPhone,
      `+91${cleanPhone.slice(-10)}`,
    ];
    
    let orders = [];
    // Try multiple phone formats
    for (const phone of phoneFormats) {
      console.log(`📋 Trying phone format: ${phone}`);
      try {
        const snapshot = await ordersRef
          .where("customerPhone", "==", phone)
          .orderBy("createdAt", "desc")
          .limit(10) // Increased limit to show more orders
          .get();
        
        console.log(`📋 Found ${snapshot.size} orders with format: ${phone}`);
        
        if (!snapshot.empty) {
          orders = snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
              id: doc.id, 
              ...data,
              orderId: data.orderId || doc.id,
            };
          });
          console.log(`📋 Successfully loaded ${orders.length} orders`);
          break;
        }
      } catch (queryError) {
        console.error(`❌ Error querying with format ${phone}:`, queryError);
        // If orderBy fails, try without it
        try {
          const snapshot = await ordersRef
            .where("customerPhone", "==", phone)
            .limit(10)
            .get();
          
          if (!snapshot.empty) {
            orders = snapshot.docs.map(doc => {
              const data = doc.data();
              return { 
                id: doc.id, 
                ...data,
                orderId: data.orderId || doc.id,
              };
            }).sort((a, b) => {
              const aDate = a.createdAt?.toDate?.() || new Date(0);
              const bDate = b.createdAt?.toDate?.() || new Date(0);
              return bDate - aDate;
            });
            console.log(`📋 Loaded ${orders.length} orders (without orderBy)`);
            break;
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback query also failed:`, fallbackError);
        }
      }
    }
    
    if (orders.length === 0) {
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: { text: "📦 *Your Orders*\n\nYou haven't placed any orders yet.\n\nBrowse our products to place your first order!" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "browse_products", title: "🛒 Browse Products" }},
            { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
          ]
        }
      });
      return;
    }
    
    let ordersText = "📦 *Your Orders*\n\n";
    orders.forEach((order, idx) => {
      const statusEmoji = {
        'pending': '⏳',
        'confirmed': '✅',
        'processing': '🔄',
        'shipped': '🚚',
        'delivered': '📬',
        'cancelled': '❌',
      }[order.status?.toLowerCase()] || '📋';
      
      const orderDate = order.createdAt?.toDate?.();
      const date = orderDate ? orderDate.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }) : 'Recent';
      
      const orderId = order.orderId || order.id;
      const orderStatus = (order.status || 'pending').toUpperCase();
      const orderTotal = order.total || 0;
      const itemCount = order.itemCount || order.items?.length || 0;
      
      ordersText += `${idx + 1}. *#${orderId}*\n`;
      ordersText += `   ${statusEmoji} Status: ${orderStatus}\n`;
      ordersText += `   💰 Total: ₹${orderTotal.toLocaleString('en-IN')}\n`;
      ordersText += `   📦 Items: ${itemCount}\n`;
      ordersText += `   📅 Date: ${date}\n\n`;
    });
    
    ordersText += `_Showing ${orders.length} order${orders.length !== 1 ? 's' : ''}_`;
    
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { text: ordersText },
      action: {
        buttons: [
          { type: "reply", reply: { id: "track_order", title: "🚚 Track Order" }},
          { type: "reply", reply: { id: "browse_products", title: "🛒 Order More" }},
          { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
        ]
      }
    });
    
    console.log(`✅ Successfully sent ${orders.length} orders to customer`);
    await storeOutgoingMessage(distributorId, customerPhone, `Orders list sent (${orders.length} orders)`, "orders_view");
    
  } catch (error) {
    console.error("❌ Error sending customer orders:", error);
  }
}

/**
 * Send order status prompt
 */
async function sendOrderStatusPrompt(distributorId, customerPhone, phoneNumberId, accessToken) {
  try {
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: {
        text: "📦 *Track Your Order*\n\nPlease enter your order ID or select from recent orders:\n\nExample: Track #WA123 or just type your order ID"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "view_orders", title: "📋 Recent Orders" }},
          { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
        ]
      }
    });
  } catch (error) {
    console.error("❌ Error sending order status prompt:", error);
  }
}

/**
 * Send order status for a specific order ID
 */
async function sendOrderStatus(distributorId, customerPhone, phoneNumberId, accessToken, orderId) {
  try {
    console.log(`📦 Looking up order: ${orderId} for customer: ${customerPhone}`);
    
    const ordersRef = db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappOrders");
    
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const phoneFormats = [`+${cleanPhone}`, cleanPhone, `+91${cleanPhone.slice(-10)}`];
    
    let order = null;
    // First try to find by orderId (could be stored as orderId field or doc.id)
    for (const phone of phoneFormats) {
      const snapshot = await ordersRef
        .where("customerPhone", "==", phone)
        .where("orderId", "==", orderId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        order = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        break;
      }
      
      // Also try matching with document ID
      try {
        const docRef = ordersRef.doc(orderId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          if (phoneFormats.includes(docData.customerPhone)) {
            order = { id: docSnap.id, ...docData };
            break;
          }
        }
      } catch (err) {
        // Document ID lookup failed, continue
      }
    }
    
    if (!order) {
      await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
        type: "button",
        body: {
          text: `❌ *Order Not Found*\n\nOrder *#${orderId}* not found. Please check your order ID and try again.\n\nYou can view your recent orders below.`
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "view_orders", title: "📋 My Orders" }},
            { type: "reply", reply: { id: "track_order", title: "🔍 Track Another" }},
            { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
          ]
        }
      });
      return;
    }
    
    // Format order status message
    const statusEmoji = {
      'pending': '⏳',
      'confirmed': '✅',
      'processing': '🔄',
      'shipped': '🚚',
      'delivered': '📬',
      'cancelled': '❌',
    }[order.status?.toLowerCase()] || '📋';
    
    const statusText = order.status?.toUpperCase() || 'PENDING';
    const date = order.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || 'Recent';
    const time = order.createdAt?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) || '';
    
    let statusDetails = `📦 *Order Status*\n\n`;
    statusDetails += `Order ID: *#${order.orderId || order.id}*\n`;
    statusDetails += `Status: ${statusEmoji} ${statusText}\n`;
    statusDetails += `Total: ₹${order.total || 0}\n`;
    statusDetails += `Items: ${order.itemCount || order.items?.length || 0}\n`;
    statusDetails += `Date: ${date}${time ? ' at ' + time : ''}\n\n`;
    
    if (order.shippingAddress) {
      statusDetails += `📍 Delivery Address:\n${order.shippingAddress}\n\n`;
    }
    
    if (order.status === 'shipped' && order.trackingNumber) {
      statusDetails += `🚚 Tracking: ${order.trackingNumber}\n\n`;
    }
    
    if (order.status === 'delivered') {
      statusDetails += `✅ Your order has been delivered!\n\nThank you for shopping with us. 🎉`;
    } else if (order.status === 'shipped') {
      statusDetails += `🚚 Your order is on the way!\n\nWe'll notify you once it's delivered.`;
    } else if (order.status === 'confirmed' || order.status === 'processing') {
      statusDetails += `⏳ Your order is being prepared.\n\nWe'll update you as soon as it ships!`;
    }
    
    await sendWhatsAppInteractiveMessage(phoneNumberId, customerPhone, accessToken, {
      type: "button",
      body: { text: statusDetails },
      action: {
        buttons: [
          { type: "reply", reply: { id: "view_orders", title: "📋 All Orders" }},
          { type: "reply", reply: { id: "track_order", title: "🔍 Track Another" }},
          { type: "reply", reply: { id: "main_menu", title: "🏠 Main Menu" }},
        ]
      }
    });
    
    await storeOutgoingMessage(distributorId, customerPhone, `Order status for #${orderId}`, "order_status");
    
  } catch (error) {
    console.error("❌ Error sending order status:", error);
    await sendWhatsAppTextMessage(phoneNumberId, customerPhone, accessToken,
      "Sorry, there was an error fetching your order status. Please try again or contact support.");
  }
}

/**
 * Update account review status
 */
async function updateAccountReviewStatus(wabaId, value) {
  try {
    console.log(`📋 Account review update for WABA ${wabaId}:`, value);
    
    // Find business with this WABA ID
    const businessDoc = await findBusinessByPhoneOrWABA(null, wabaId);

    if (!businessDoc) {
      console.warn(`⚠️ No business found for account review update (WABA: ${wabaId})`);
      return;
    }

    const reviewStatus = value.account_review_status || "PENDING";

    await businessDoc.ref.update({
      whatsappAccountReviewStatus: reviewStatus,
      whatsappVerified: reviewStatus === "APPROVED",
      whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Updated account review status to ${reviewStatus} for WABA ${wabaId}`);
  } catch (error) {
    console.error("❌ Error updating account review status:", error);
  }
}

/**
 * Main webhook handler
 */
module.exports = onRequest(
  {
    cors: true,
    region: "us-central1",
    // Reasonable instance limit within quota
    maxInstances: 10,
    // Access to secrets for sending automated responses
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "GET") {
        await verifyWebhook(req, res);
      } else if (req.method === "POST") {
        await handleWebhookEvent(req, res);
      } else {
        res.status(405).send("Method Not Allowed");
      }
    });
  }
);
