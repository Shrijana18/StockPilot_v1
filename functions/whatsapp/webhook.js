/**
 * WhatsApp Business API Webhook Handler
 * Handles incoming webhooks from Meta WhatsApp Business API
 * Updates message status (sent, delivered, read, failed) in Firestore
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Webhook verification token (should match what you set in Meta)
// Using unified token - same as tech provider webhook
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "flyp_tech_provider_webhook_token";

/**
 * Verify webhook subscription (required by Meta)
 * Meta sends GET request with hub.mode, hub.verify_token, and hub.challenge
 */
async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Webhook verification failed");
    res.status(403).send("Forbidden");
  }
}

/**
 * Handle webhook events from Meta WhatsApp Business API
 * Events include: message status updates, incoming messages, etc.
 */
async function handleWebhookEvent(req, res) {
  try {
    const body = req.body;
    
    // Meta sends events in this format:
    // {
    //   "object": "whatsapp_business_account",
    //   "entry": [{
    //     "id": "WABA_ID",
    //     "changes": [{
    //       "value": {
    //         "messaging_product": "whatsapp",
    //         "metadata": { "phone_number_id": "...", "display_phone_number": "..." },
    //         "statuses": [{ "id": "message_id", "status": "sent|delivered|read|failed", ... }],
    //         "messages": [{ "id": "...", "from": "...", "text": { "body": "..." }, ... }]
    //       },
    //       "field": "messages"
    //     }]
    //   }]
    // }

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        const wabaId = entry.id;
        
        for (const change of entry.changes || []) {
          const value = change.value;
          
          // Handle message status updates
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              await updateMessageStatus(status, wabaId);
            }
          }
          
          // Handle incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await handleIncomingMessage(message, value.metadata, wabaId);
            }
          }
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    res.status(500).send("Internal Server Error");
  }
}

/**
 * Update message status in Firestore
 */
async function updateMessageStatus(status, wabaId) {
  try {
    const messageId = status.id;
    const statusType = status.status; // sent, delivered, read, failed
    const recipientId = status.recipient_id;
    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
    
    // Find the message in Firestore
    // Messages are stored in: businesses/{distributorId}/whatsappMessages/{messageId}
    // We need to search across all businesses to find the message
    
    const businessesRef = admin.firestore().collection("businesses");
    const businessesSnapshot = await businessesRef.get();
    
    for (const businessDoc of businessesSnapshot.docs) {
      const distributorId = businessDoc.id;
      const businessData = businessDoc.data();
      
      // Check if this business has the matching WABA ID
      if (businessData.whatsappBusinessAccountId === wabaId) {
        const messagesRef = admin.firestore()
          .collection("businesses")
          .doc(distributorId)
          .collection("whatsappMessages");
        
        // Query for message with matching messageId
        const messagesSnapshot = await messagesRef
          .where("messageId", "==", messageId)
          .limit(1)
          .get();
        
        if (!messagesSnapshot.empty) {
          const messageDoc = messagesSnapshot.docs[0];
          await messageDoc.ref.update({
            status: statusType,
            statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            statusDetails: {
              recipientId,
              timestamp: timestamp.toISOString(),
              error: status.errors?.[0] || null,
            },
          });
          
          console.log(`✅ Updated message ${messageId} status to ${statusType}`);
          return; // Found and updated, exit
        }
      }
    }
    
    console.warn(`⚠️ Message ${messageId} not found in Firestore`);
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
    const from = message.from; // Customer phone number
    const text = message.text?.body || "";
    const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date();
    const phoneNumberId = metadata.phone_number_id;
    
    // Find the business that owns this phone number
    const businessesRef = admin.firestore().collection("businesses");
    const businessesSnapshot = await businessesRef.get();
    
    for (const businessDoc of businessesSnapshot.docs) {
      const distributorId = businessDoc.id;
      const businessData = businessDoc.data();
      
      // Check if this business has the matching phone number ID
      if (businessData.whatsappPhoneNumberId === phoneNumberId) {
        // Store incoming message
        const inboxRef = admin.firestore()
          .collection("businesses")
          .doc(distributorId)
          .collection("whatsappInbox");
        
        await inboxRef.add({
          messageId,
          from: `+${from}`,
          text,
          type: message.type || "text",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          receivedAt: timestamp.toISOString(),
          read: false,
          metadata: {
            phoneNumberId,
            wabaId,
          },
        });
        
        console.log(`✅ Stored incoming message from ${from}`);
        return; // Found and stored, exit
      }
    }
    
    console.warn(`⚠️ Phone number ID ${phoneNumberId} not found in Firestore`);
  } catch (error) {
    console.error("❌ Error handling incoming message:", error);
  }
}

/**
 * Main webhook handler
 * GET: Webhook verification
 * POST: Webhook events
 */
module.exports = onRequest(
  {
    cors: true,
    region: "us-central1",
  },
  async (req, res) => {
    cors(req, res, async () => {
      if (req.method === "GET") {
        // Webhook verification
        await verifyWebhook(req, res);
      } else if (req.method === "POST") {
        // Webhook events
        await handleWebhookEvent(req, res);
      } else {
        res.status(405).send("Method Not Allowed");
      }
    });
  }
);

