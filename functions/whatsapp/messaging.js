/**
 * WhatsApp Messaging Functions
 * Send messages via Meta WhatsApp Business API
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
// Updated to match Meta Dashboard API version
const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const META_SYSTEM_USER_TOKEN_SECRET = defineSecret("META_SYSTEM_USER_TOKEN");

function getSystemUserToken() {
  try {
    return META_SYSTEM_USER_TOKEN_SECRET.value() || process.env.META_SYSTEM_USER_TOKEN;
  } catch (e) {
    return process.env.META_SYSTEM_USER_TOKEN;
  }
}

/**
 * Send WhatsApp message via Tech Provider
 */
exports.sendMessageViaTechProvider = onCall(
  {
    region: "us-central1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
      }

      const { to, message, template, options = {} } = request.data || {};

      if (!to || !message) {
        throw new HttpsError("invalid-argument", "Recipient phone number and message are required");
      }

      const businessDoc = await db.collection("businesses").doc(uid).get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const phoneNumberId = businessData.whatsappPhoneNumberId;
      const isTestMode = businessData.whatsappTestMode === true;
      const testAccessToken = businessData.whatsappTestAccessToken;
      const testRecipient = businessData.whatsappTestRecipient;

      if (!phoneNumberId) {
        throw new HttpsError(
          "failed-precondition",
          "Phone number not configured. Please add and verify a phone number first."
        );
      }

      // For test mode, use the temp access token instead of system user token
      let accessToken;
      if (isTestMode) {
        if (!testAccessToken) {
          throw new HttpsError(
            "failed-precondition",
            "Test mode requires a temporary access token. Please update your test configuration with a fresh token from Meta Dashboard → WhatsApp → API Testing."
          );
        }
        accessToken = testAccessToken;
        console.log("📧 Using TEST MODE with temporary access token");
        
        // Validate recipient in test mode
        const normalizedTo = to.replace(/[\s-]/g, "");
        const normalizedTestRecipient = (testRecipient || "").replace(/[\s-]/g, "");
        if (testRecipient && !normalizedTo.includes(normalizedTestRecipient.replace("+", ""))) {
          console.warn(`⚠️ Test mode: Recipient ${to} may not be whitelisted. Expected: ${testRecipient}`);
        }
      } else {
        accessToken = getSystemUserToken();
        if (!accessToken) {
          throw new HttpsError(
            "failed-precondition",
            "System User Token not configured. Please set META_SYSTEM_USER_TOKEN in Firebase secrets."
          );
        }
      }

      // Format phone number (remove +)
      const formattedPhone = to.replace(/\+/g, "");

      // Build message payload
      let payload;
      if (template) {
        payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language || "en" },
            components: template.components || [],
          },
        };
      } else if (options.imageUrl) {
        payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "image",
          image: {
            link: options.imageUrl,
            caption: message || "",
          },
        };
      } else if (options.documentUrl) {
        payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "document",
          document: {
            link: options.documentUrl,
            filename: options.filename || "document",
            caption: message || "",
          },
        };
      } else {
        payload = {
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        };
      }

      // Send message
      const sendResponse = await fetch(
        `${META_API_BASE}/${phoneNumberId}/messages?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        const errorMessage = errorData.error?.message || "Failed to send message";
        const errorCode = errorData.error?.code;
        const errorSubcode = errorData.error?.error_subcode;

        let userMessage = errorMessage;
        if (errorCode === 10 || errorSubcode === 10) {
          userMessage = "Application does not have permission. Request Production Access in Meta Business Suite.";
        } else if (errorCode === 131030 || errorSubcode === 131030) {
          userMessage = `Recipient phone number (${to}) is not in the allowed list. Add this number to your WABA's allowed list in Meta Business Suite.`;
        } else if (errorCode === 131047 || errorMessage.includes("phone number")) {
          userMessage = "Invalid phone number format. Use format: +91XXXXXXXXXX";
        } else if (errorMessage.includes("rate limit")) {
          userMessage = "Rate limit exceeded. Please wait a few minutes before sending again.";
        }

        throw new HttpsError("internal", userMessage);
      }

      const result = await sendResponse.json();
      const messageId = result.messages?.[0]?.id;

      // Log message in Firestore
      try {
        await db.collection("businesses").doc(uid).collection("whatsappMessages").add({
          to: formattedPhone,
          message,
          status: "sent",
          method: "tech_provider",
          messageId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          metadata: options.metadata || {},
        });
      } catch (logError) {
        console.warn("Could not log message (non-critical):", logError);
      }

      return {
        success: true,
        messageId,
        data: result,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to send message");
    }
  }
);
