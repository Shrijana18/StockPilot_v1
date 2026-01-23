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
// Internal export so other functions can declare secrets access
exports._META_SYSTEM_USER_TOKEN_SECRET = META_SYSTEM_USER_TOKEN_SECRET;

function getSystemUserToken() {
  try {
    return META_SYSTEM_USER_TOKEN_SECRET.value() || process.env.META_SYSTEM_USER_TOKEN;
  } catch (e) {
    return process.env.META_SYSTEM_USER_TOKEN;
  }
}

/**
 * Internal helper: send message for a distributorId (server-side)
 * Not exported from functions/index.js, but reusable by other modules.
 */
async function sendViaTechProvider({ distributorId, to, message, template, options = {} }) {
  if (!distributorId) throw new Error("distributorId is required");
  if (!to) throw new Error("Recipient phone number is required");
  if (!message && !template) throw new Error("message or template is required");

  const businessDoc = await db.collection("businesses").doc(distributorId).get();
  if (!businessDoc || !businessDoc.exists) throw new Error("Business profile not found");

  const businessData = businessDoc.data();
  const phoneNumberId = businessData.whatsappPhoneNumberId;
  const isTestMode = businessData.whatsappTestMode === true;
  const testAccessToken = businessData.whatsappTestAccessToken;
  const testRecipient = businessData.whatsappTestRecipient;

  if (!phoneNumberId) throw new Error("Phone number not configured");

  // Token selection
  let accessToken;
  if (isTestMode) {
    if (!testAccessToken) throw new Error("Test mode requires whatsappTestAccessToken");
    accessToken = testAccessToken;
    const normalizedTo = to.replace(/[\s-]/g, "");
    const normalizedTestRecipient = (testRecipient || "").replace(/[\s-]/g, "");
    if (testRecipient && !normalizedTo.includes(normalizedTestRecipient.replace("+", ""))) {
      console.warn(`⚠️ Test mode: Recipient ${to} may not be whitelisted. Expected: ${testRecipient}`);
    }
  } else {
    // Prefer distributor-specific token if present, else fallback to system token
    accessToken = businessData.whatsappAccessToken || getSystemUserToken();
    if (!accessToken) throw new Error("System User Token not configured");
  }

  // Format phone number (remove +)
  const formattedPhone = to.replace(/\+/g, "");

  // Build payload
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
      image: { link: options.imageUrl, caption: message || "" },
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

  const sendResponse = await fetch(
    `${META_API_BASE}/${phoneNumberId}/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const result = await sendResponse.json().catch(() => ({}));
  if (!sendResponse.ok) {
    const errorMessage = result?.error?.message || "Failed to send message";
    const errorCode = result?.error?.code;
    const errorSubcode = result?.error?.error_subcode;
    const err = new Error(errorMessage);
    err.meta = { errorCode, errorSubcode, result };
    throw err;
  }

  const messageId = result.messages?.[0]?.id;

  // Log message
  try {
    await db.collection("businesses").doc(distributorId).collection("whatsappMessages").add({
      to: formattedPhone,
      message: message || "",
      status: "sent",
      method: "tech_provider",
      messageId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: options.metadata || {},
    });
  } catch (logError) {
    console.warn("Could not log message (non-critical):", logError);
  }

  return { success: true, messageId, data: result };
}

// Internal export for other functions files (not exposed via functions/index.js)
exports._sendViaTechProvider = sendViaTechProvider;

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

      const sendRes = await sendViaTechProvider({ distributorId: uid, to, message, template, options });
      return sendRes;
    } catch (error) {
      console.error("Error sending message:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to send message");
    }
  }
);
