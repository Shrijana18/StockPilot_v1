/**
 * WhatsApp Tech Provider Gateway
 * Manages WhatsApp Business Accounts (WABAs) for clients
 * Uses System User token to create and manage WABAs on behalf of clients
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Define secrets for Firebase Functions v2
const META_SYSTEM_USER_TOKEN_SECRET = defineSecret("META_SYSTEM_USER_TOKEN");
const META_APP_SECRET_SECRET = defineSecret("META_APP_SECRET");

// Helper to get env vars (supports both local .env and Firebase Secrets/Config)
function getEnvVar(name, defaultValue = null) {
  // For Firebase Functions v2, secrets are available via process.env
  // For local development, use .env file (loaded by dotenv)
  // For production, use Firebase Secrets (set via firebase functions:secrets:set)
  // For config values, use Firebase Config (set via firebase functions:config:set)
  
  // Try process.env first (works for local .env, Firebase Secrets, and Firebase Config)
  let value = process.env[name];
  
  // If not found and we're in Firebase Functions, try Firebase Config
  if (!value && typeof require !== 'undefined') {
    try {
      const functions = require('firebase-functions');
      if (functions && functions.config) {
        const config = functions.config();
        // Handle nested config (e.g., meta.app_id)
        const keys = name.toLowerCase().split('_');
        let configValue = config;
        for (const key of keys) {
          if (configValue && configValue[key]) {
            configValue = configValue[key];
          } else {
            configValue = null;
            break;
          }
        }
        if (configValue) {
          value = configValue;
        }
      }
    } catch (e) {
      // Firebase config not available (e.g., in local emulator)
      // Continue to use process.env or defaultValue
    }
  }
  
  return value || defaultValue;
}

// Meta API base URL
const META_API_VERSION = "v18.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Get System User Token (for managing client WABAs)
 */
function getSystemUserToken() {
  // Try Firebase Secret first (for production)
  let token = null;
  try {
    token = META_SYSTEM_USER_TOKEN_SECRET.value();
  } catch (e) {
    // Secret not available, try env var (for local development)
    token = getEnvVar("META_SYSTEM_USER_TOKEN");
  }
  
  if (!token) {
    throw new HttpsError(
      "failed-precondition",
      "System User Token not configured. Please set META_SYSTEM_USER_TOKEN secret or environment variable."
    );
  }
  return token;
}

/**
 * Get Tech Provider App ID
 */
function getTechProviderAppId() {
  const appId = getEnvVar("META_APP_ID");
  if (!appId) {
    throw new HttpsError(
      "failed-precondition",
      "Meta App ID not configured. Please set META_APP_ID environment variable."
    );
  }
  return appId;
}

/**
 * Create or Get WhatsApp Business Account (WABA) for a client
 * This is the core Tech Provider function - creates WABA on behalf of client
 */
exports.createClientWABA = onCall(
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
        throw new HttpsError("unauthenticated", "You must be signed in to create WhatsApp Business Account.");
      }

      const systemUserToken = getSystemUserToken();
      const businessDoc = await db.collection("businesses").doc(uid).get();
      
      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const businessName = businessData.businessName || businessData.ownerName || "My Business";

      // Check if WABA already exists for this client
      const existingWABAId = businessData.whatsappBusinessAccountId;
      if (existingWABAId) {
        // Verify WABA still exists and is accessible
        try {
          const wabaResponse = await fetch(
            `${META_API_BASE}/${existingWABAId}?access_token=${systemUserToken}&fields=id,name,message_template_namespace,account_review_status,ownership_type`
          );

          if (wabaResponse.ok) {
            const wabaData = await wabaResponse.json();
            return {
              success: true,
              wabaId: existingWABAId,
              wabaData,
              message: "WABA already exists for this client",
            };
          }
        } catch (error) {
          console.warn("Existing WABA not accessible, creating new one:", error);
          // Continue to create new WABA
        }
      }

      // Get Business Manager ID (required for WABA creation)
      // First, get the business manager associated with the System User
      const businessManagerResponse = await fetch(
        `${META_API_BASE}/me?access_token=${systemUserToken}&fields=business`
      );

      if (!businessManagerResponse.ok) {
        const errorData = await businessManagerResponse.json();
        throw new Error(errorData.error?.message || "Failed to get Business Manager");
      }

      const businessManagerData = await businessManagerResponse.json();
      const businessManagerId = businessManagerData.business?.id;

      if (!businessManagerId) {
        throw new HttpsError(
          "failed-precondition",
          "Business Manager not found. Please ensure System User has access to a Business Manager."
        );
      }

      // Create WABA for the client
      const createWABAResponse = await fetch(
        `${META_API_BASE}/${businessManagerId}/owned_whatsapp_business_accounts?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: businessName,
            timezone_id: "Asia/Kolkata", // Default to India timezone
          }),
        }
      );

      if (!createWABAResponse.ok) {
        const errorData = await createWABAResponse.json();
        throw new HttpsError(
          "internal",
          errorData.error?.message || "Failed to create WhatsApp Business Account"
        );
      }

      const wabaData = await createWABAResponse.json();
      const wabaId = wabaData.id;

      // Store WABA ID in client's business document
      await db.collection("businesses").doc(uid).update({
        whatsappBusinessAccountId: wabaId,
        whatsappProvider: "meta_tech_provider",
        whatsappEnabled: true,
        whatsappCreatedVia: "tech_provider",
        whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        wabaId,
        wabaData,
        message: "WhatsApp Business Account created successfully",
      };
    } catch (error) {
      console.error("Error creating client WABA:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to create WhatsApp Business Account");
    }
  }
);

/**
 * Get client's WABA details
 */
exports.getClientWABA = onCall(
  {
    region: "us-central1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
      }

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;

      if (!wabaId) {
        return {
          success: false,
          message: "No WABA found. Please create one first.",
        };
      }

      // Get WABA details
      const wabaResponse = await fetch(
        `${META_API_BASE}/${wabaId}?access_token=${systemUserToken}&fields=id,name,message_template_namespace,account_review_status,ownership_type,timezone_id`
      );

      if (!wabaResponse.ok) {
        const errorData = await wabaResponse.json();
        throw new HttpsError("internal", errorData.error?.message || "Failed to get WABA details");
      }

      const wabaData = await wabaResponse.json();

      // Get phone numbers for this WABA
      const phoneNumbersResponse = await fetch(
        `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}`
      );

      let phoneNumbers = [];
      if (phoneNumbersResponse.ok) {
        const phoneNumbersData = await phoneNumbersResponse.json();
        phoneNumbers = phoneNumbersData.data || [];
      }

      return {
        success: true,
        wabaId,
        wabaData,
        phoneNumbers,
      };
    } catch (error) {
      console.error("Error getting client WABA:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to get WABA details");
    }
  }
);

/**
 * Request phone number for client's WABA
 * This initiates the phone number verification process
 */
exports.requestPhoneNumber = onCall(
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

      const { phoneNumber, displayName } = request.data || {};
      if (!phoneNumber) {
        throw new HttpsError("invalid-argument", "Phone number is required");
      }

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;

      if (!wabaId) {
        throw new HttpsError(
          "failed-precondition",
          "WABA not found. Please create WABA first."
        );
      }

      // Format phone number (remove + and spaces)
      const formattedPhone = phoneNumber.replace(/[^0-9]/g, "");

      // Request phone number verification
      const requestPhoneResponse = await fetch(
        `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verified_name: displayName || businessData.businessName || businessData.ownerName || "My Business",
            code_verification_status: "UNVERIFIED",
            display_phone_number: formattedPhone,
          }),
        }
      );

      if (!requestPhoneResponse.ok) {
        const errorData = await requestPhoneResponse.json();
        throw new HttpsError(
          "internal",
          errorData.error?.message || "Failed to request phone number verification"
        );
      }

      const phoneData = await requestPhoneResponse.json();
      const phoneNumberId = phoneData.id;

      // Store phone number ID
      await db.collection("businesses").doc(uid).update({
        whatsappPhoneNumberId: phoneNumberId,
        whatsappPhoneNumber: phoneNumber,
        whatsappPhoneVerificationStatus: "pending",
      });

      return {
        success: true,
        phoneNumberId,
        message: "Phone number verification requested. Please complete OTP verification in Meta Business Suite.",
        instructions: [
          "1. Go to Meta Business Suite → WhatsApp Manager",
          "2. Find your phone number in the list",
          "3. Click 'Verify' and complete OTP verification",
          "4. Once verified, your phone number will be ready to use",
        ],
      };
    } catch (error) {
      console.error("Error requesting phone number:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to request phone number");
    }
  }
);

/**
 * Send message via Tech Provider
 * Uses System User token to send messages on behalf of client
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

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const phoneNumberId = businessData.whatsappPhoneNumberId;

      if (!phoneNumberId) {
        throw new HttpsError(
          "failed-precondition",
          "Phone number not configured. Please add and verify a phone number first."
        );
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
        `${META_API_BASE}/${phoneNumberId}/messages?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        throw new HttpsError("internal", errorData.error?.message || "Failed to send message");
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
      console.error("Error sending message via Tech Provider:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to send message");
    }
  }
);

/**
 * Setup webhook for client's WABA
 * Configures webhook to receive message status updates
 */
exports.setupWebhookForClient = onCall(
  {
    region: "us-central1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
      }

      const systemUserToken = getSystemUserToken();
      const BASE_URL = getEnvVar("BASE_URL", "https://stockpilotv1.web.app");
      const webhookUrl = `${BASE_URL}/whatsapp/tech-provider/webhook`;
      const verifyToken = getEnvVar("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "flyp_tech_provider_webhook_token");

      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;

      if (!wabaId) {
        throw new HttpsError(
          "failed-precondition",
          "WABA not found. Please create WABA first."
        );
      }

      // First, verify WABA exists and System User has access
      const verifyWABAResponse = await fetch(
        `${META_API_BASE}/${wabaId}?access_token=${systemUserToken}&fields=id,name,ownership_type`
      );

      if (!verifyWABAResponse.ok) {
        const errorData = await verifyWABAResponse.json();
        const errorMessage = errorData.error?.message || "Failed to access WABA";
        
        // Check if WABA was created via OAuth (not Tech Provider)
        if (errorMessage.includes("does not exist") || errorMessage.includes("missing permissions")) {
          throw new HttpsError(
            "failed-precondition",
            `WABA ${wabaId} is not accessible. It may have been created via OAuth (legacy method). Please create a new WABA via Tech Provider first, or ensure the System User has access to this WABA.`
          );
        }
        
        throw new HttpsError("internal", errorMessage);
      }

      const wabaInfo = await verifyWABAResponse.json();
      console.log(`✅ WABA ${wabaId} verified, ownership_type: ${wabaInfo.ownership_type}`);

      // Get App ID
      const appId = getEnvVar("META_APP_ID");
      if (!appId) {
        throw new HttpsError(
          "failed-precondition",
          "META_APP_ID not configured. Please set META_APP_ID environment variable."
        );
      }

      // Subscribe app to WABA (required for Tech Provider)
      // First, check if app is already subscribed
      const subscribedAppsResponse = await fetch(
        `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemUserToken}`
      );

      let appSubscribed = false;
      if (subscribedAppsResponse.ok) {
        const subscribedApps = await subscribedAppsResponse.json();
        appSubscribed = subscribedApps.data?.some(app => app.id === appId || app.app_id === appId);
        console.log(`App ${appId} subscribed: ${appSubscribed}`);
      }

      // If not subscribed, subscribe the app first
      if (!appSubscribed) {
        console.log(`Subscribing app ${appId} to WABA ${wabaId}...`);
        
        // Try with app_id in body (some API versions require this)
        const subscribeResponse = await fetch(
          `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemUserToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_id: appId, // Include app_id in body
              subscribed_fields: ["messages", "message_status", "message_template_status_update"],
            }),
          }
        );

        if (!subscribeResponse.ok) {
          const errorData = await subscribeResponse.json();
          const errorMessage = errorData.error?.message || "Failed to subscribe app to WABA";
          
          // Provide more helpful error message
          if (errorMessage.includes("does not support this operation")) {
            throw new HttpsError(
              "failed-precondition",
              `Cannot subscribe app ${appId} to WABA ${wabaId}. The WABA may need to be created via Tech Provider, or the app needs to be added to the Business Manager first.`
            );
          }
          
          throw new HttpsError("internal", errorMessage);
        }
        
        console.log(`✅ App ${appId} subscribed to WABA ${wabaId}`);
      }

      // Setup webhook configuration
      // Note: The webhook URL is configured in Meta App Dashboard, not via API
      // This function just verifies the subscription
      const webhookResponse = { ok: true };

      if (!webhookResponse.ok) {
        const errorData = await webhookResponse.json();
        const errorMessage = errorData.error?.message || "Failed to setup webhook";
        
        // Provide more helpful error message
        if (errorMessage.includes("does not support this operation")) {
          throw new HttpsError(
            "failed-precondition",
            `Cannot subscribe app to WABA ${wabaId}. This WABA may not support webhook subscriptions, or the System User doesn't have the required permissions. Please ensure the WABA was created via Tech Provider.`
          );
        }
        
        throw new HttpsError("internal", errorMessage);
      }

      // Store webhook configuration
      await db.collection("businesses").doc(uid).update({
        whatsappWebhookUrl: webhookUrl,
        whatsappWebhookConfigured: true,
        whatsappWebhookConfiguredAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        webhookUrl,
        message: "Webhook configured successfully",
      };
    } catch (error) {
      console.error("Error setting up webhook:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to setup webhook");
    }
  }
);

/**
 * Tech Provider Webhook Handler
 * Handles webhooks from Meta for all client WABAs
 */
exports.whatsappTechProviderWebhook = onRequest(
  {
    region: "us-central1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        // Webhook verification (GET request)
        if (req.method === "GET") {
          const mode = req.query["hub.mode"];
          const token = req.query["hub.verify_token"];
          const challenge = req.query["hub.challenge"];

          const verifyToken = getEnvVar("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "flyp_tech_provider_webhook_token");

          if (mode === "subscribe" && token === verifyToken) {
            console.log("✅ Tech Provider Webhook verified");
            return res.status(200).send(challenge);
          } else {
            console.error("❌ Tech Provider Webhook verification failed");
            return res.status(403).send("Forbidden");
          }
        }

        // Webhook events (POST request)
        if (req.method === "POST") {
          const body = req.body;
          
          console.log("📥 Webhook POST received:", JSON.stringify(body, null, 2));

          if (body.object === "whatsapp_business_account") {
            for (const entry of body.entry || []) {
              const wabaId = entry.id;
              console.log(`🔍 Processing WABA ID: ${wabaId}`);

              // Find client(s) with this WABA ID
              const businessesSnapshot = await db
                .collection("businesses")
                .where("whatsappBusinessAccountId", "==", wabaId)
                .get();
              
              console.log(`📊 Found ${businessesSnapshot.size} business(es) with WABA ID ${wabaId}`);

              for (const businessDoc of businessesSnapshot.docs) {
                const distributorId = businessDoc.id;

                for (const change of entry.changes || []) {
                  const value = change.value;

                  // Handle message status updates
                  if (value.statuses && value.statuses.length > 0) {
                    for (const status of value.statuses) {
                      await updateMessageStatus(status, distributorId);
                    }
                  }

                  // Handle incoming messages
                  if (value.messages && value.messages.length > 0) {
                    console.log(`📨 Processing ${value.messages.length} incoming message(s) for distributor ${distributorId}`);
                    for (const message of value.messages) {
                      await handleIncomingMessage(message, value.metadata, distributorId);
                    }
                  } else {
                    console.log("ℹ️ No messages in webhook payload");
                  }
                }
              }
            }
          }

          return res.status(200).send("OK");
        }

        return res.status(405).send("Method Not Allowed");
      } catch (error) {
        console.error("❌ Tech Provider Webhook error:", error);
        return res.status(500).send("Internal Server Error");
      }
    });
  }
);

/**
 * Update message status in Firestore
 */
async function updateMessageStatus(status, distributorId) {
  try {
    const messageId = status.id;
    const statusType = status.status;
    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();

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
          timestamp: timestamp.toISOString(),
          error: status.errors?.[0] || null,
        },
      });

      console.log(`✅ Updated message ${messageId} status to ${statusType}`);
    }
  } catch (error) {
    console.error("❌ Error updating message status:", error);
  }
}

/**
 * Handle incoming messages from customers
 */
async function handleIncomingMessage(message, metadata, distributorId) {
  try {
    const messageId = message.id;
    const from = message.from;
    const text = message.text?.body || "";
    const timestamp = message.timestamp ? new Date(parseInt(message.timestamp) * 1000) : new Date();

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
        phoneNumberId: metadata.phone_number_id,
        wabaId: metadata.phone_number_id, // Will be updated with actual WABA ID
      },
    });

    console.log(`✅ Stored incoming message from ${from}`);
  } catch (error) {
    console.error("❌ Error handling incoming message:", error);
  }
}

