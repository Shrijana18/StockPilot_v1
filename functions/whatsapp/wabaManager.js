/**
 * WhatsApp Business Account (WABA) Manager
 * Core functions for managing WABAs: create, get, save, detect
 * 
 * FLYP Tech Provider - Meta App ID: 190256595068087
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
// Updated to match Meta Dashboard API version
const META_API_VERSION = "v24.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Secrets
const META_SYSTEM_USER_TOKEN_SECRET = defineSecret("META_SYSTEM_USER_TOKEN");

/**
 * Get System User Token
 */
function getSystemUserToken() {
  try {
    return META_SYSTEM_USER_TOKEN_SECRET.value() || process.env.META_SYSTEM_USER_TOKEN;
  } catch (e) {
    return process.env.META_SYSTEM_USER_TOKEN;
  }
}

/**
 * Save WABA to Firestore and perform post-signup orchestration
 * This is called after embedded signup completes
 */
exports.saveWABADirect = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    // UPDATED: Now accepting 'pin' from the request
    const { wabaId, phoneNumberId, phoneNumber, embeddedData, pin } = request.data || {};

    if (!wabaId) {
      throw new HttpsError("invalid-argument", "WABA ID is required");
    }

    try {
      const systemToken = getSystemUserToken();
      if (!systemToken) {
        throw new HttpsError("failed-precondition", "System User Token not configured");
      }

      // UPDATED: PIN is ALWAYS required for phone registration per Meta docs
      // Priority for getting PIN:
      // 1. Explicit PIN passed from frontend (user entered it in modal)
      // 2. PIN from embedded data (rare, but check anyway)
      const registrationPin = pin || embeddedData?.pin || embeddedData?.registration_pin || embeddedData?.data?.pin;

      // Step 1: Register phone number with Meta (if phoneNumberId provided)
      // IMPORTANT: Per Meta Cloud API docs (2025+), PIN is REQUIRED for registration
      // If no PIN provided, we need to ask user for it
      let registrationSuccess = false;
      
      if (phoneNumberId) {
        // If no PIN provided, ask frontend to get it from user
        if (!registrationPin) {
          console.log("⚠️ Phone registration requires PIN. Asking frontend for PIN input.");
          return {
            success: false,
            requirePin: true,
            wabaId,
            phoneNumberId,
            phoneNumber,
            message: "Phone registration requires a 6-digit PIN. If this phone has Two-Step Verification enabled, enter your existing PIN. Otherwise, create a new PIN.",
            pinRequired: true,
            embeddedData // Pass back so frontend doesn't lose context
          };
        }

        try {
          console.log(`📞 Registering phone ${phoneNumberId} with PIN...`);

          const registerResponse = await fetch(
            `${META_API_BASE}/${phoneNumberId}/register`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${systemToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                pin: registrationPin, 
              }),
            }
          );

          if (!registerResponse.ok) {
            const error = await registerResponse.json();
            console.warn("Phone registration warning:", JSON.stringify(error));
            
            // Detect PIN-related errors
            const errorCode = error.error?.code;
            const errorSubcode = error.error?.error_subcode;
            const errorMessage = (error.error?.message || "").toLowerCase();
            
            // Check if PIN was incorrect (not missing, since we provided one)
            const isPinIncorrect = 
              errorCode === 136025 ||
              errorSubcode === 136025 ||
              errorMessage.includes("incorrect pin") ||
              errorMessage.includes("invalid pin") ||
              errorMessage.includes("wrong pin");

            // Check if PIN is required (shouldn't happen since we provide one, but just in case)
            const isPinMissing = 
              errorMessage.includes("pin is required") ||
              errorMessage.includes("pin required") ||
              errorMessage.includes("two-step verification");

            console.log(`📋 PIN Error Check: code=${errorCode}, subcode=${errorSubcode}, isPinIncorrect=${isPinIncorrect}, isPinMissing=${isPinMissing}`);

            if (isPinIncorrect) {
              console.log("⚠️ PIN was incorrect. Asking user to try again.");
              return {
                success: false,
                requirePin: true,
                pinIncorrect: true,
                wabaId,
                phoneNumberId,
                phoneNumber,
                message: "Incorrect PIN. Please enter your WhatsApp Two-Step Verification PIN.",
                errorCode: errorCode,
                embeddedData
              };
            }

            if (isPinMissing) {
              console.log("⚠️ PIN still required (unexpected). Asking user again.");
              return {
                success: false,
                requirePin: true,
                wabaId,
                phoneNumberId,
                phoneNumber,
                message: "PIN required for registration.",
                errorCode: errorCode,
                embeddedData
              };
            }
            
            // Log other registration errors for debugging
            console.error(`❌ Phone registration failed with error code ${errorCode}: ${error.error?.message}`);
          } else {
            console.log("✅ Phone number registered successfully");
            registrationSuccess = true;
          }
        } catch (regErr) {
          console.warn("Phone registration error (non-critical):", regErr);
        }
      }

      // Step 2: Subscribe app to WABA fields
      // This enables the webhook to start receiving events
      try {
        console.log(`🔗 Subscribing app to WABA ${wabaId}...`);
        const subscribeResponse = await fetch(
          `${META_API_BASE}/${wabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${systemToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subscribed_fields: ["messages", "message_status", "account_update", "account_review_update"],
            }),
          }
        );

        if (!subscribeResponse.ok) {
          const error = await subscribeResponse.json();
          console.warn("App subscription warning:", JSON.stringify(error));
        } else {
          console.log("✅ App subscribed to WABA events");
        }
      } catch (subErr) {
        console.warn("App subscription error (non-critical):", subErr);
      }

      // Step 3: Save WABA data to Firestore
      const createdVia = embeddedData?.manualEntry ? "manual_entry" : "embedded_signup";
      const wabaData = {
        whatsappBusinessAccountId: wabaId,
        whatsappPhoneNumberId: phoneNumberId || null,
        whatsappPhoneNumber: phoneNumber || null,
        whatsappProvider: "meta_tech_provider",
        whatsappEnabled: true,
        whatsappCreatedVia: createdVia,
        whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // If registration succeeded, mark as registered. If pending PIN, leave as pending/not_registered
        whatsappPhoneRegistered: registrationSuccess,
        whatsappPhoneVerificationStatus: registrationSuccess ? "valid" : (phoneNumberId ? "pending" : "not_registered"),
        whatsappVerified: false,
        whatsappAccountReviewStatus: "PENDING",
        embeddedSignupData: embeddedData || {},
        whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("businesses").doc(uid).set(wabaData, { merge: true });

      console.log(`✅ WABA ${wabaId} saved and configured for user ${uid}`);

      return {
        success: true,
        wabaId,
        phoneNumberId,
        phoneNumber,
        message: "WABA saved and configured successfully",
      };
    } catch (error) {
      console.error("Error saving WABA:", error);
      throw new HttpsError("internal", error.message || "Failed to save WABA");
    }
  }
);

/**
 * Register Phone Number with Cloud API
 * This is called when phone is verified (OTP done) but not registered for Cloud API
 * 
 * Per Meta docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration
 * - PIN is REQUIRED (6-digit)
 * - If 2FA is enabled on the phone, use the existing 2FA PIN
 * - If 2FA is NOT enabled, this will set the PIN as the new 2FA PIN
 */
exports.registerPhoneNumber = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { phoneNumberId, pin, dataLocalization } = request.data || {};

    if (!phoneNumberId) {
      throw new HttpsError("invalid-argument", "Phone Number ID is required");
    }

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      throw new HttpsError("invalid-argument", "PIN must be exactly 6 digits");
    }

    try {
      const systemToken = getSystemUserToken();
      if (!systemToken) {
        throw new HttpsError("failed-precondition", "System User Token not configured");
      }

      console.log(`📞 Registering phone number ${phoneNumberId} with Cloud API...`);

      // Call the /register endpoint
      // https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration
      const requestBody = {
        messaging_product: "whatsapp",
        pin: pin,
      };

      // Optional: Add data localization if provided (for compliance)
      if (dataLocalization) {
        requestBody.data_localization_region = dataLocalization;
      }

      const registerResponse = await fetch(
        `${META_API_BASE}/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${systemToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const responseData = await registerResponse.json();

      if (!registerResponse.ok) {
        console.error("❌ Registration failed:", JSON.stringify(responseData));
        
        const errorCode = responseData.error?.code;
        const errorSubcode = responseData.error?.error_subcode;
        const errorMessage = responseData.error?.message || "Unknown error";

        // Check for specific errors
        // Error 136025: Incorrect PIN (Two-step verification PIN is incorrect)
        if (errorCode === 136025 || errorSubcode === 136025 || 
            errorMessage.toLowerCase().includes("incorrect pin") ||
            errorMessage.toLowerCase().includes("invalid pin")) {
          return {
            success: false,
            error: "incorrect_pin",
            message: "Incorrect PIN. If you have Two-Step Verification enabled, enter your existing PIN. Otherwise, the PIN you entered might have a typo.",
            errorCode: errorCode,
          };
        }

        // Error: Already registered
        if (errorMessage.toLowerCase().includes("already registered")) {
          // This is actually success - phone is already registered
          console.log("✅ Phone was already registered");
          
          // Update Firestore to reflect registered status
          await db.collection("businesses").doc(uid).update({
            whatsappPhoneRegistered: true,
            whatsappPhoneVerificationStatus: "CONNECTED",
            whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
          });

          return {
            success: true,
            message: "Phone number is already registered and ready to use!",
            alreadyRegistered: true,
          };
        }

        // Other errors
        return {
          success: false,
          error: "registration_failed",
          message: errorMessage,
          errorCode: errorCode,
          errorSubcode: errorSubcode,
        };
      }

      console.log("✅ Phone number registered successfully:", JSON.stringify(responseData));

      // Update Firestore with registered status
      await db.collection("businesses").doc(uid).update({
        whatsappPhoneRegistered: true,
        whatsappPhoneVerificationStatus: "CONNECTED",
        whatsappPhoneHas2FA: true, // 2FA is now enabled since we provided a PIN
        whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: "Phone number registered successfully! You can now send and receive messages.",
        data: responseData,
      };

    } catch (error) {
      console.error("Registration error:", error);
      throw new HttpsError("internal", error.message || "Failed to register phone number");
    }
  }
);

/**
 * Get WABA status from Meta API
 */
exports.getWABAStatus = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const businessDoc = await db.collection("businesses").doc(uid).get();
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Business not found");
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;

      if (!wabaId) {
        return {
          success: false,
          message: "No WABA found",
        };
      }

      const systemToken = getSystemUserToken();
      if (!systemToken) {
        throw new HttpsError("failed-precondition", "System User Token not configured");
      }

      // Get WABA details
      const wabaResponse = await fetch(
        `${META_API_BASE}/${wabaId}?fields=id,name,timezone,account_review_status,message_template_namespace,is_enabled&access_token=${systemToken}`
      );

      if (!wabaResponse.ok) {
        // Handle token errors or permission issues
        const errData = await wabaResponse.json();
        console.error("Meta API Error:", errData);
        throw new Error(errData.error?.message || "Failed to fetch WABA details");
      }

      const wabaData = await wabaResponse.json();

      // Get phone number details
      let phoneData = null;
      if (businessData.whatsappPhoneNumberId) {
        try {
          const phoneResponse = await fetch(
            `${META_API_BASE}/${businessData.whatsappPhoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${systemToken}`
          );

          if (phoneResponse.ok) {
            phoneData = await phoneResponse.json();
          }
        } catch (phoneErr) {
          console.warn("Phone number fetch error:", phoneErr);
        }
      }

      // Format status response
      const status = {
        waba: {
          id: wabaData.id,
          name: wabaData.name,
          timezone: wabaData.timezone,
          isEnabled: wabaData.is_enabled || false,
        },
        accountReview: {
          status: wabaData.account_review_status || "PENDING",
          isApproved: wabaData.account_review_status === "APPROVED",
          isPending: wabaData.account_review_status === "PENDING",
        },
        phone: {
          phoneNumberId: phoneData?.id || businessData.whatsappPhoneNumberId,
          phoneNumber: phoneData?.display_phone_number || businessData.whatsappPhoneNumber,
          verified: phoneData?.code_verification_status === "VERIFIED",
          registered: !!phoneData?.id,
          verificationStatus: phoneData?.code_verification_status || "not_registered",
          needsVerification: phoneData?.code_verification_status !== "VERIFIED",
        },
        overall: {
          ready: wabaData.account_review_status === "APPROVED" && 
                 phoneData?.code_verification_status === "VERIFIED",
          needsAction: wabaData.account_review_status !== "APPROVED" || 
                      phoneData?.code_verification_status !== "VERIFIED",
          pendingActions: [],
        },
      };

      // Add pending actions
      if (status.accountReview.isPending) {
        status.overall.pendingActions.push("Complete account review in Meta Business Suite");
      }
      if (status.phone.needsVerification) {
        status.overall.pendingActions.push("Complete phone number verification");
      }

      // Update Firestore with latest status
      await db.collection("businesses").doc(uid).update({
        whatsappAccountReviewStatus: status.accountReview.status,
        whatsappPhoneVerificationStatus: status.phone.verificationStatus,
        whatsappVerified: status.overall.ready,
        whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        status,
      };
    } catch (error) {
      console.error("Error getting WABA status:", error);
      throw new HttpsError("internal", error.message || "Failed to get WABA status");
    }
  }
);

/**
 * Repair/Refresh WABA Webhook Subscription
 * This function checks and re-subscribes the app to WABA webhook events
 * Call this if incoming messages are not being received
 */
exports.repairWebhookSubscription = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    try {
      const businessDoc = await db.collection("businesses").doc(uid).get();
      if (!businessDoc.exists) {
        throw new HttpsError("not-found", "Business not found");
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;
      const phoneNumberId = businessData.whatsappPhoneNumberId;

      if (!wabaId) {
        return {
          success: false,
          message: "No WABA ID found. Please complete WhatsApp setup first.",
        };
      }

      const systemToken = getSystemUserToken();
      if (!systemToken) {
        throw new HttpsError("failed-precondition", "System User Token not configured");
      }

      const results = {
        wabaId,
        phoneNumberId,
        checks: [],
        repairs: [],
      };

      // Step 1: Check current subscription status
      console.log(`🔍 Checking webhook subscription for WABA: ${wabaId}`);
      try {
        const subCheckResponse = await fetch(
          `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemToken}`
        );
        
        if (subCheckResponse.ok) {
          const subData = await subCheckResponse.json();
          results.currentSubscription = subData;
          results.checks.push({
            name: "Check Subscription",
            status: "success",
            data: subData
          });
          
          // Check if our app is subscribed
          const ourApp = subData.data?.find(app => app.id === "190256595068087"); // FLYP App ID
          if (ourApp) {
            results.checks.push({
              name: "App Subscribed",
              status: "success",
              subscribedFields: ourApp.subscribed_fields || []
            });
          } else {
            results.checks.push({
              name: "App Subscribed",
              status: "warning",
              message: "FLYP app not found in subscriptions"
            });
          }
        } else {
          const errData = await subCheckResponse.json();
          results.checks.push({
            name: "Check Subscription",
            status: "error",
            error: errData.error?.message
          });
        }
      } catch (checkErr) {
        results.checks.push({
          name: "Check Subscription",
          status: "error",
          error: checkErr.message
        });
      }

      // Step 2: Re-subscribe to webhook events
      console.log(`🔧 Re-subscribing app to WABA events...`);
      try {
        const subscribeResponse = await fetch(
          `${META_API_BASE}/${wabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${systemToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subscribed_fields: ["messages", "message_status", "account_update", "account_review_update"],
            }),
          }
        );

        if (subscribeResponse.ok) {
          const subResult = await subscribeResponse.json();
          results.repairs.push({
            name: "Resubscribe to Webhook",
            status: "success",
            result: subResult
          });
          console.log("✅ Successfully re-subscribed to WABA webhook events");
        } else {
          const errData = await subscribeResponse.json();
          results.repairs.push({
            name: "Resubscribe to Webhook",
            status: "error",
            error: errData.error?.message || "Failed to subscribe"
          });
          console.error("❌ Failed to subscribe:", errData);
        }
      } catch (subErr) {
        results.repairs.push({
          name: "Resubscribe to Webhook",
          status: "error",
          error: subErr.message
        });
      }

      // Step 3: Verify subscription after repair
      console.log(`🔍 Verifying subscription after repair...`);
      try {
        const verifyResponse = await fetch(
          `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemToken}`
        );
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          results.finalSubscription = verifyData;
          
          // Check for messages field
          const hasMessages = verifyData.data?.some(app => 
            app.subscribed_fields?.includes("messages")
          );
          
          results.repairs.push({
            name: "Verify Messages Subscription",
            status: hasMessages ? "success" : "warning",
            message: hasMessages 
              ? "✅ 'messages' field is now subscribed" 
              : "⚠️ 'messages' field still not subscribed - check Meta Dashboard manually"
          });
        }
      } catch (verifyErr) {
        console.warn("Verification check failed:", verifyErr);
      }

      // Update Firestore
      await db.collection("businesses").doc(uid).update({
        webhookSubscriptionRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
        webhookSubscriptionStatus: results.repairs.some(r => r.status === "success") ? "repaired" : "needs_attention",
      });

      return {
        success: true,
        message: "Webhook subscription repair completed. Please test by sending a message from a customer phone.",
        results,
        nextSteps: [
          "1. Send a test message from a customer phone to your WhatsApp Business number",
          "2. Check Cloud Function logs for '💬 Incoming message from...'",
          "3. If still not working, verify webhook URL in Meta Developer Dashboard",
          "4. Webhook URL should be: https://us-central1-stockpilotv1.cloudfunctions.net/whatsappWebhook",
          "5. Verify Token should be: flyp_tech_provider_webhook_token"
        ]
      };
    } catch (error) {
      console.error("Error repairing webhook subscription:", error);
      throw new HttpsError("internal", error.message || "Failed to repair webhook subscription");
    }
  }
);

/**
 * Detect newly created WABA (for fallback detection)
 */
/**
 * Detect newly created OR updated WABA
 */
exports.detectNewWABA = onRequest(
    {
      region: "us-central1",
      memory: "256MiB",
      timeoutSeconds: 30,
      cors: true,
      secrets: [META_SYSTEM_USER_TOKEN_SECRET],
    },
    async (req, res) => {
      cors(req, res, async () => {
        try {
          // Verify authentication
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Unauthorized" });
          }
  
          const idToken = authHeader.split("Bearer ")[1];
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          const uid = decodedToken.uid;
  
          const systemToken = getSystemUserToken();
          if (!systemToken) {
            return res.status(500).json({ error: "System token not configured" });
          }
  
          // Get user's business data
          const businessDoc = await db.collection("businesses").doc(uid).get();
          if (!businessDoc.exists) {
            return res.status(404).json({ error: "Business not found" });
          }
  
          const currentWABAId = businessDoc.data()?.whatsappBusinessAccountId;
          const allWABAs = [];

          console.log("🔍 Detecting WABAs for user:", uid);

          // FLYP Tech Provider Business ID (from Meta Business Manager)
          // This is the business that owns the Tech Provider app
          const FLYP_BUSINESS_ID = "880857384343434"; // From your WhatsApp Manager URL

          // METHOD 1: Get businesses associated with System User
          let businessIds = [];
          try {
            console.log("📋 Fetching businesses for System User...");
            const businessesResponse = await fetch(
              `${META_API_BASE}/me/businesses?fields=id,name&access_token=${systemToken}`
            );

            if (businessesResponse.ok) {
              const businessesData = await businessesResponse.json();
              console.log("📋 Businesses found:", businessesData.data?.length || 0, 
                businessesData.data?.map(b => ({ id: b.id, name: b.name })));
              
              businessIds = businessesData.data?.map(b => b.id) || [];
            } else {
              const errData = await businessesResponse.json();
              console.warn("Businesses fetch failed:", JSON.stringify(errData));
            }
          } catch (err) {
            console.warn("Error fetching businesses:", err);
          }

          // Add FLYP Business ID if not already in list
          if (!businessIds.includes(FLYP_BUSINESS_ID)) {
            businessIds.push(FLYP_BUSINESS_ID);
            console.log("📋 Added FLYP Business ID to search:", FLYP_BUSINESS_ID);
          }

          // METHOD 2: For each business, get owned and client WABAs
          for (const businessId of businessIds) {
            console.log(`🔍 Checking business ${businessId} for WABAs...`);
            
            // Get OWNED WABAs
            try {
              const ownedResponse = await fetch(
                `${META_API_BASE}/${businessId}/owned_whatsapp_business_accounts?fields=id,name,account_review_status,phone_numbers{id,display_phone_number}&access_token=${systemToken}`
              );
              if (ownedResponse.ok) {
                const ownedData = await ownedResponse.json();
                console.log(`✅ Owned WABAs for ${businessId}:`, ownedData.data?.length || 0);
                for (const waba of ownedData.data || []) {
                  if (!allWABAs.find(w => w.id === waba.id)) {
                    allWABAs.push({
                      id: waba.id,
                      name: waba.name,
                      accountReviewStatus: waba.account_review_status,
                      phoneNumbers: waba.phone_numbers?.data || [],
                      businessId: businessId,
                      source: "owned",
                    });
                  }
                }
              } else {
                const errData = await ownedResponse.json();
                console.log(`⚠️ Owned WABAs error for ${businessId}:`, errData.error?.message);
              }
            } catch (e) {
              console.warn(`Error fetching owned WABAs for ${businessId}:`, e.message);
            }

            // Get CLIENT WABAs (shared via Embedded Signup)
            try {
              const clientResponse = await fetch(
                `${META_API_BASE}/${businessId}/client_whatsapp_business_accounts?fields=id,name,account_review_status,phone_numbers{id,display_phone_number}&access_token=${systemToken}`
              );
              if (clientResponse.ok) {
                const clientData = await clientResponse.json();
                console.log(`✅ Client WABAs for ${businessId}:`, clientData.data?.length || 0, 
                  clientData.data?.map(w => ({ id: w.id, name: w.name })));
                for (const waba of clientData.data || []) {
                  if (!allWABAs.find(w => w.id === waba.id)) {
                    allWABAs.push({
                      id: waba.id,
                      name: waba.name,
                      accountReviewStatus: waba.account_review_status,
                      phoneNumbers: waba.phone_numbers?.data || [],
                      businessId: businessId,
                      source: "client_embedded_signup",
                    });
                  }
                }
              } else {
                const errData = await clientResponse.json();
                console.log(`⚠️ Client WABAs error for ${businessId}:`, errData.error?.message);
              }
            } catch (e) {
              console.warn(`Error fetching client WABAs for ${businessId}:`, e.message);
            }
          }

          console.log("📊 Total WABAs found:", allWABAs.length, allWABAs.map(w => ({ id: w.id, name: w.name, source: w.source })));
  
          // LOGIC UPDATE: Priority 1 - New WABA, Priority 2 - Existing WABA with new info
          // We look for the most recently created or relevant WABA
          
          let targetWABA = null;
          let matchReason = "";
  
          // 1. Try to find a WABA that is NOT the current one (New Account)
          const newWABA = allWABAs.find(w => w.id !== currentWABAId);
          
          if (newWABA) {
            targetWABA = newWABA;
            matchReason = "new_waba_detected";
          } 
          // 2. If no new WABA, check the CURRENT WABA (maybe they added a phone number to it)
          else if (currentWABAId) {
             const existingWABA = allWABAs.find(w => w.id === currentWABAId);
             if (existingWABA) {
               targetWABA = existingWABA;
               matchReason = "existing_waba_refresh";
             }
          }
  
          if (targetWABA) {
            let primaryPhone = null;
            
            // First check if we already have phone numbers from the WABA query
            if (targetWABA.phoneNumbers && targetWABA.phoneNumbers.length > 0) {
              primaryPhone = targetWABA.phoneNumbers[0];
              console.log("📱 Using phone from WABA data:", primaryPhone.id, primaryPhone.display_phone_number);
            } else {
              // Fallback: Fetch phone numbers separately
              try {
                const phonesResponse = await fetch(
                  `${META_API_BASE}/${targetWABA.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status&access_token=${systemToken}`
                );
    
                if (phonesResponse.ok) {
                  const phonesData = await phonesResponse.json();
                  console.log("📱 Phone numbers for WABA:", phonesData.data?.length || 0);
                  primaryPhone = phonesData.data?.[0] || null;
                } else {
                  const errData = await phonesResponse.json();
                  console.warn("Phone fetch error:", errData.error?.message);
                }
              } catch (err) {
                console.warn("Error fetching phone numbers:", err);
              }
            }

            console.log("✅ Found WABA:", {
              wabaId: targetWABA.id,
              name: targetWABA.name,
              phoneId: primaryPhone?.id,
              phoneNumber: primaryPhone?.display_phone_number,
              matchReason,
            });
  
            return res.json({
              success: true,
              found: true,
              wabaId: targetWABA.id,
              wabaData: targetWABA,
              primaryPhone: primaryPhone ? {
                id: primaryPhone.id,
                number: primaryPhone.display_phone_number,
              } : null,
              isSuggested: false,
              matchReason: matchReason,
            });
          }
  
        return res.json({
          success: true,
          found: false,
          message: "No WABA detected",
        });
      } catch (error) {
        console.error("Error detecting WABA:", error);
        return res.status(500).json({ error: error.message || "Internal server error" });
      }
    });
  }
);

/**
 * Get Client WABA details - callable function for fetching a client's WABA info
 * Used by frontend to get WABA details from Firestore and optionally refresh from Meta API
 */
exports.getClientWABA = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { refreshFromMeta = false } = request.data || {};

    try {
      // Get business document from Firestore
      const businessDoc = await db.collection("businesses").doc(uid).get();
      
      if (!businessDoc.exists) {
        return {
          success: false,
          connected: false,
          message: "No business profile found",
        };
      }

      const businessData = businessDoc.data();
      
      // Check if WABA is configured
      if (!businessData.whatsappBusinessAccountId) {
        return {
          success: true,
          connected: false,
          message: "WhatsApp not connected",
        };
      }

      // Build response from Firestore data
      const wabaInfo = {
        wabaId: businessData.whatsappBusinessAccountId,
        phoneNumberId: businessData.whatsappPhoneNumberId || null,
        phoneNumber: businessData.whatsappPhoneNumber || null,
        provider: businessData.whatsappProvider || "meta_tech_provider",
        enabled: businessData.whatsappEnabled || false,
        verified: businessData.whatsappVerified || false,
        phoneRegistered: businessData.whatsappPhoneRegistered || false,
        accountReviewStatus: businessData.whatsappAccountReviewStatus || "PENDING",
        phoneVerificationStatus: businessData.whatsappPhoneVerificationStatus || "unknown",
        createdVia: businessData.whatsappCreatedVia || "unknown",
        createdAt: businessData.whatsappCreatedAt || null,
        lastChecked: businessData.whatsappStatusLastChecked || null,
      };

      // If refresh requested, get live data from Meta API
      if (refreshFromMeta && wabaInfo.wabaId) {
        const systemToken = getSystemUserToken();
        
        if (systemToken) {
          try {
            // Fetch WABA details from Meta
            const wabaResponse = await fetch(
              `${META_API_BASE}/${wabaInfo.wabaId}?fields=id,name,account_review_status,is_enabled&access_token=${systemToken}`
            );

            if (wabaResponse.ok) {
              const wabaData = await wabaResponse.json();
              wabaInfo.accountReviewStatus = wabaData.account_review_status || wabaInfo.accountReviewStatus;
              wabaInfo.enabled = wabaData.is_enabled || wabaInfo.enabled;
              wabaInfo.wabaName = wabaData.name;

              // Update Firestore with fresh data
              await db.collection("businesses").doc(uid).update({
                whatsappAccountReviewStatus: wabaInfo.accountReviewStatus,
                whatsappEnabled: wabaInfo.enabled,
                whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            // Fetch phone number details if available
            if (wabaInfo.phoneNumberId) {
              const phoneResponse = await fetch(
                `${META_API_BASE}/${wabaInfo.phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${systemToken}`
              );

              if (phoneResponse.ok) {
                const phoneData = await phoneResponse.json();
                wabaInfo.phoneVerificationStatus = phoneData.code_verification_status || wabaInfo.phoneVerificationStatus;
                wabaInfo.verifiedName = phoneData.verified_name;
                wabaInfo.qualityRating = phoneData.quality_rating;
                wabaInfo.phoneRegistered = !!phoneData.id;

                // Update Firestore
                await db.collection("businesses").doc(uid).update({
                  whatsappPhoneVerificationStatus: wabaInfo.phoneVerificationStatus,
                  whatsappPhoneRegistered: wabaInfo.phoneRegistered,
                });
              }
            }
          } catch (metaError) {
            console.warn("Failed to refresh from Meta API:", metaError);
            // Continue with Firestore data
          }
        }
      }

      // Determine overall status
      const isFullyReady = 
        wabaInfo.accountReviewStatus === "APPROVED" && 
        wabaInfo.phoneVerificationStatus === "VERIFIED" &&
        wabaInfo.phoneRegistered;

      return {
        success: true,
        connected: true,
        waba: wabaInfo,
        isFullyReady,
        pendingActions: getPendingActions(wabaInfo),
      };

    } catch (error) {
      console.error("Error getting client WABA:", error);
      throw new HttpsError("internal", error.message || "Failed to get WABA info");
    }
  }
);

/**
 * Admin function to manually link WABA to a client
 * Use this when Embedded Signup callback fails to capture data
 */
exports.adminLinkWABA = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    // TODO: Add admin check here if needed
    // For now, only allow tech provider admin

    const { 
      clientUid,        // The client's Firebase UID
      wabaId,           // WABA ID from Meta Dashboard
      phoneNumberId,    // Phone Number ID from Meta Dashboard
      phoneNumber,      // Display phone number
      businessId,       // Meta Business ID (optional)
    } = request.data || {};

    if (!clientUid || !wabaId) {
      throw new HttpsError("invalid-argument", "clientUid and wabaId are required");
    }

    try {
      // Verify the client exists
      const clientDoc = await db.collection("businesses").doc(clientUid).get();
      if (!clientDoc.exists) {
        throw new HttpsError("not-found", "Client business profile not found");
      }

      const systemToken = getSystemUserToken();
      
      // Try to fetch additional info from Meta API
      let wabaName = null;
      let accountReviewStatus = "PENDING";
      let phoneVerificationStatus = "pending_registration";
      
      if (systemToken && wabaId) {
        try {
          const wabaResponse = await fetch(
            `${META_API_BASE}/${wabaId}?fields=id,name,account_review_status&access_token=${systemToken}`
          );
          if (wabaResponse.ok) {
            const wabaData = await wabaResponse.json();
            wabaName = wabaData.name;
            accountReviewStatus = wabaData.account_review_status || "PENDING";
          }
        } catch (e) {
          console.warn("Could not fetch WABA details:", e);
        }
      }

      // If phone number ID provided, check its status
      if (systemToken && phoneNumberId) {
        try {
          const phoneResponse = await fetch(
            `${META_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,code_verification_status&access_token=${systemToken}`
          );
          if (phoneResponse.ok) {
            const phoneData = await phoneResponse.json();
            phoneVerificationStatus = phoneData.code_verification_status || "pending_registration";
          }
        } catch (e) {
          console.warn("Could not fetch phone details:", e);
        }
      }

      // Save to Firestore
      const wabaData = {
        whatsappBusinessAccountId: wabaId,
        whatsappPhoneNumberId: phoneNumberId || null,
        whatsappPhoneNumber: phoneNumber || null,
        whatsappProvider: "meta_tech_provider",
        whatsappEnabled: true,
        whatsappCreatedVia: "admin_linked",
        whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        whatsappPhoneRegistered: false, // Will be true after phone registration
        whatsappPhoneVerificationStatus: phoneVerificationStatus,
        whatsappVerified: false,
        whatsappAccountReviewStatus: accountReviewStatus,
        whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
        ...(businessId && { metaBusinessId: businessId }),
        ...(wabaName && { whatsappBusinessName: wabaName }),
      };

      await db.collection("businesses").doc(clientUid).set(wabaData, { merge: true });

      console.log(`✅ Admin linked WABA ${wabaId} to client ${clientUid}`);

      return {
        success: true,
        message: `WABA ${wabaId} linked to client successfully`,
        wabaData: {
          wabaId,
          phoneNumberId,
          phoneNumber,
          accountReviewStatus,
          phoneVerificationStatus,
        },
        nextSteps: [
          "Complete phone registration using saveWABADirect with 2FA PIN",
          "Client may need to complete setup tasks in Meta Business Suite",
        ],
      };

    } catch (error) {
      console.error("Error in adminLinkWABA:", error);
      throw new HttpsError("internal", error.message || "Failed to link WABA");
    }
  }
);

/**
 * Register phone number for a client WABA
 * This completes the phone setup after Embedded Signup
 */
exports.registerClientPhone = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { 
      clientUid,     // The client's Firebase UID (optional, defaults to caller)
      phoneNumberId, // Phone Number ID to register
      pin,           // 2FA PIN (6 digits)
    } = request.data || {};

    const targetUid = clientUid || callerUid;

    if (!phoneNumberId) {
      throw new HttpsError("invalid-argument", "phoneNumberId is required");
    }

    try {
      const systemToken = getSystemUserToken();
      if (!systemToken) {
        throw new HttpsError("failed-precondition", "System token not configured");
      }

      console.log(`📞 Registering phone ${phoneNumberId} for ${targetUid}...`);

      // Call Meta API to register the phone number
      const registerResponse = await fetch(
        `${META_API_BASE}/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${systemToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            ...(pin && { pin }),
          }),
        }
      );

      const registerResult = await registerResponse.json();

      if (!registerResponse.ok) {
        const errorCode = registerResult.error?.code;
        const errorMessage = registerResult.error?.message;

        // Check for 2FA PIN requirement
        if (errorCode === 136025 || errorMessage?.includes("two-step") || errorMessage?.includes("pin")) {
          return {
            success: false,
            requiresPin: true,
            message: "Two-step verification PIN required. Please provide the 6-digit PIN.",
            error: registerResult.error,
          };
        }

        throw new HttpsError("internal", errorMessage || "Phone registration failed");
      }

      // Update Firestore with registration success
      await db.collection("businesses").doc(targetUid).update({
        whatsappPhoneRegistered: true,
        whatsappPhoneVerificationStatus: "pending_verification",
        whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Phone ${phoneNumberId} registered successfully`);

      return {
        success: true,
        message: "Phone number registered successfully!",
        data: registerResult,
      };

    } catch (error) {
      console.error("Error registering phone:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to register phone");
    }
  }
);

/**
 * Helper function to determine pending actions for WABA setup
 */
function getPendingActions(wabaInfo) {
  const actions = [];
  
  if (wabaInfo.accountReviewStatus !== "APPROVED") {
    actions.push({
      type: "account_review",
      message: "Complete account review in Meta Business Suite",
      priority: "high",
    });
  }
  
  if (!wabaInfo.phoneRegistered) {
    actions.push({
      type: "phone_registration",
      message: "Register phone number with WhatsApp",
      priority: "high",
    });
  }
  
  if (wabaInfo.phoneVerificationStatus !== "VERIFIED" && wabaInfo.phoneRegistered) {
    actions.push({
      type: "phone_verification",
      message: "Verify phone number",
      priority: "medium",
    });
  }
  
  return actions;
}

// App configuration for code exchange
const META_APP_ID = "1902565950686087";

/**
 * Get Meta App Secret (if configured)
 */
function getMetaAppSecret() {
  // Try environment variable first (for cases where secret isn't available)
  return process.env.META_APP_SECRET || null;
}

/**
 * Exchange Facebook Auth Code for WABA Details
 * This is the PROPER way to complete Embedded Signup per Meta docs
 * 
 * Flow:
 * 1. Frontend calls FB.login() → gets auth code
 * 2. Frontend sends auth code to this function
 * 3. This function exchanges code for access token
 * 4. This function fetches WABA details using the token
 * 5. Saves everything to Firestore
 */
exports.exchangeCodeForWABA = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { code, phoneNumberId, wabaId } = request.data || {};

    // If wabaId is provided directly (from SDK FINISH event), skip code exchange
    if (wabaId) {
      console.log("📥 Direct WABA ID provided, skipping code exchange");
      return await processWABAData(uid, { wabaId, phoneNumberId });
    }

    if (!code) {
      throw new HttpsError("invalid-argument", "Authorization code is required");
    }

    try {
      const appSecret = getMetaAppSecret();
      if (!appSecret) {
        console.warn("⚠️ META_APP_SECRET not configured, using System User Token flow");
      }

      let accessToken = null;
      let tokenType = "exchanged";

      // Step 1: Exchange auth code for access token
      if (appSecret) {
        console.log("🔄 Exchanging auth code for access token...");
        
        const tokenResponse = await fetch(
          `${META_API_BASE}/oauth/access_token?` +
          `client_id=${META_APP_ID}&` +
          `client_secret=${appSecret}&` +
          `code=${code}`
        );

        if (!tokenResponse.ok) {
          const error = await tokenResponse.json();
          console.error("Token exchange failed:", error);
          
          // Fall back to System User Token
          accessToken = getSystemUserToken();
          tokenType = "system_user_fallback";
          
          if (!accessToken) {
            throw new HttpsError("internal", error.error?.message || "Token exchange failed");
          }
        } else {
          const tokenData = await tokenResponse.json();
          accessToken = tokenData.access_token;
          console.log("✅ Access token obtained successfully");
        }
      } else {
        // No app secret, use system user token
        accessToken = getSystemUserToken();
        tokenType = "system_user";
      }

      if (!accessToken) {
        throw new HttpsError("failed-precondition", "No valid access token available");
      }

      // Step 2: Get user's WABA from the shared business accounts
      console.log(`🔍 Fetching WABAs using ${tokenType} token...`);
      
      let detectedWABA = null;
      let detectedPhone = null;

      // Method 1: Get WABAs directly accessible via the token
      try {
        const wabasResponse = await fetch(
          `${META_API_BASE}/me/whatsapp_business_accounts?fields=id,name,account_review_status,phone_numbers{id,display_phone_number,verified_name,code_verification_status}&access_token=${accessToken}`
        );

        if (wabasResponse.ok) {
          const wabasData = await wabasResponse.json();
          console.log("📋 WABAs found:", wabasData.data?.length || 0);

          if (wabasData.data?.length > 0) {
            // Get the most recently connected/created WABA
            detectedWABA = wabasData.data[0];
            
            // Get phone number if available
            if (detectedWABA.phone_numbers?.data?.length > 0) {
              detectedPhone = detectedWABA.phone_numbers.data[0];
            }
          }
        } else {
          const errData = await wabasResponse.json();
          console.warn("WABA fetch failed:", JSON.stringify(errData));
        }
      } catch (fetchErr) {
        console.warn("Error fetching WABAs:", fetchErr);
      }

      // Method 2: If no WABA found via direct access, check System User's shared WABAs
      if (!detectedWABA && tokenType !== "system_user") {
        const systemToken = getSystemUserToken();
        if (systemToken) {
          console.log("🔄 Falling back to System User token for WABA detection...");
          
          try {
            const sysWabasResponse = await fetch(
              `${META_API_BASE}/me/whatsapp_business_accounts?fields=id,name,account_review_status&access_token=${systemToken}`
            );
            
            if (sysWabasResponse.ok) {
              const sysWabas = await sysWabasResponse.json();
              
              // Check existing WABAs in Firestore
              const businessDoc = await db.collection("businesses").doc(uid).get();
              const existingWabaId = businessDoc.data()?.whatsappBusinessAccountId;
              
              // Find a new WABA (not the existing one)
              for (const waba of sysWabas.data || []) {
                if (waba.id !== existingWabaId) {
                  detectedWABA = waba;
                  
                  // Fetch phone numbers for this WABA
                  const phonesResponse = await fetch(
                    `${META_API_BASE}/${waba.id}/phone_numbers?fields=id,display_phone_number,code_verification_status&access_token=${systemToken}`
                  );
                  
                  if (phonesResponse.ok) {
                    const phonesData = await phonesResponse.json();
                    if (phonesData.data?.length > 0) {
                      detectedPhone = phonesData.data[0];
                    }
                  }
                  
                  break;
                }
              }
            }
          } catch (sysErr) {
            console.warn("System user WABA fetch failed:", sysErr);
          }
        }
      }

      if (!detectedWABA) {
        console.log("⚠️ No WABA detected after code exchange");
        return {
          success: false,
          detected: false,
          message: "No WhatsApp Business Account found. Please complete the setup in the popup window.",
        };
      }

      // Process and save the WABA data
      return await processWABAData(uid, {
        wabaId: detectedWABA.id,
        wabaName: detectedWABA.name,
        accountReviewStatus: detectedWABA.account_review_status,
        phoneNumberId: detectedPhone?.id || phoneNumberId,
        phoneNumber: detectedPhone?.display_phone_number,
        phoneVerificationStatus: detectedPhone?.code_verification_status,
      });

    } catch (error) {
      console.error("Error in exchangeCodeForWABA:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Failed to exchange code for WABA");
    }
  }
);

/**
 * Helper function to process and save WABA data
 */
async function processWABAData(uid, data) {
  const {
    wabaId,
    wabaName,
    accountReviewStatus,
    phoneNumberId,
    phoneNumber,
    phoneVerificationStatus,
    pin,
  } = data;

  const systemToken = getSystemUserToken();

  // Register phone number if we have one
  let registrationSuccess = false;
  let requirePin = false;

  if (phoneNumberId && systemToken) {
    try {
      console.log(`📞 Registering phone ${phoneNumberId}...`);
      
      const registerResponse = await fetch(
        `${META_API_BASE}/${phoneNumberId}/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${systemToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            ...(pin && { pin }),
          }),
        }
      );

      if (!registerResponse.ok) {
        const error = await registerResponse.json();
        const errorCode = error.error?.code;
        const errorMessage = (error.error?.message || "").toLowerCase();
        
        const isPinError = 
          errorCode === 136025 ||
          errorMessage.includes("two-step") ||
          errorMessage.includes("two step") ||
          errorMessage.includes("2fa") ||
          errorMessage.includes("pin");

        if (isPinError) {
          console.log("⚠️ 2FA PIN required for phone registration");
          requirePin = true;
        } else {
          console.warn("Phone registration warning:", JSON.stringify(error));
        }
      } else {
        console.log("✅ Phone registered successfully");
        registrationSuccess = true;
      }
    } catch (regErr) {
      console.warn("Phone registration error:", regErr);
    }
  }

  // Subscribe app to WABA if we have system token
  if (systemToken && wabaId) {
    try {
      await fetch(
        `${META_API_BASE}/${wabaId}/subscribed_apps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${systemToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscribed_fields: ["messages", "message_status", "account_update", "account_review_update"],
          }),
        }
      );
      console.log("✅ App subscribed to WABA events");
    } catch (subErr) {
      console.warn("App subscription error:", subErr);
    }
  }

  // Save to Firestore
  const wabaData = {
    whatsappBusinessAccountId: wabaId,
    whatsappBusinessName: wabaName || null,
    whatsappPhoneNumberId: phoneNumberId || null,
    whatsappPhoneNumber: phoneNumber || null,
    whatsappProvider: "meta_tech_provider",
    whatsappEnabled: true,
    whatsappCreatedVia: "embedded_signup_sdk",
    whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
    whatsappPhoneRegistered: registrationSuccess,
    whatsappPhoneVerificationStatus: registrationSuccess ? "valid" : (phoneVerificationStatus || "pending"),
    whatsappVerified: false,
    whatsappAccountReviewStatus: accountReviewStatus || "PENDING",
    whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("businesses").doc(uid).set(wabaData, { merge: true });

  console.log(`✅ WABA ${wabaId} saved for user ${uid}`);

  if (requirePin) {
    return {
      success: false,
      requirePin: true,
      wabaId,
      phoneNumberId,
      phoneNumber,
      message: "Two-step verification PIN required to complete phone registration",
    };
  }

  return {
    success: true,
    wabaId,
    wabaName,
    phoneNumberId,
    phoneNumber,
    registrationSuccess,
    message: "WhatsApp Business Account connected successfully!",
  };
}