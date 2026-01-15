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
 * Handle webhook events from Meta
 */
async function handleWebhookEvent(req, res) {
  try {
    const body = req.body;

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

          // Handle account review status updates
          if (change.field === "account_review_update") {
            await updateAccountReviewStatus(wabaId, value);
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
    const statusType = status.status;
    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();

    // Find business with this WABA ID
    const businessesSnapshot = await db
      .collection("businesses")
      .where("whatsappBusinessAccountId", "==", wabaId)
      .limit(1)
      .get();

    if (businessesSnapshot.empty) {
      console.warn(`⚠️ No business found for WABA ${wabaId}`);
      return;
    }

    const businessDoc = businessesSnapshot.docs[0];
    const distributorId = businessDoc.id;

    // Find message in Firestore
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
      await messageDoc.ref.update({
        status: statusType,
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        statusDetails: {
          recipientId: status.recipient_id,
          timestamp: timestamp.toISOString(),
          error: status.errors?.[0] || null,
        },
      });

      console.log(`✅ Updated message ${messageId} status to ${statusType}`);
    } else {
      console.warn(`⚠️ Message ${messageId} not found in Firestore`);
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
    const from = message.from;
    const text = message.text?.body || "";
    const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date();
    const phoneNumberId = metadata.phone_number_id;

    // Find business with this phone number ID
    const businessesSnapshot = await db
      .collection("businesses")
      .where("whatsappPhoneNumberId", "==", phoneNumberId)
      .limit(1)
      .get();

    if (businessesSnapshot.empty) {
      console.warn(`⚠️ No business found for phone number ID ${phoneNumberId}`);
      return;
    }

    const businessDoc = businessesSnapshot.docs[0];
    const distributorId = businessDoc.id;

    // Store incoming message
    const inboxRef = db
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
  } catch (error) {
    console.error("❌ Error handling incoming message:", error);
  }
}

/**
 * Update account review status
 */
async function updateAccountReviewStatus(wabaId, value) {
  try {
    // Find business with this WABA ID
    const businessesSnapshot = await db
      .collection("businesses")
      .where("whatsappBusinessAccountId", "==", wabaId)
      .limit(1)
      .get();

    if (businessesSnapshot.empty) {
      return;
    }

    const businessDoc = businessesSnapshot.docs[0];
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
