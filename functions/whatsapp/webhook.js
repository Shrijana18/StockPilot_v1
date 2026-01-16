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
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
// IMPORTANT: This token MUST match what's configured in Meta Developer Dashboard
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 
  "flyp_tech_provider_webhook_token";

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
    
  } catch (error) {
    console.error("❌ Error handling incoming message:", error);
    console.error("❌ Error stack:", error.stack);
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
