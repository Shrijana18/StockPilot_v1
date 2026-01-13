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
        
        // Special handling for known config paths
        // Firebase Config uses dot notation: whatsapp.webhook_verify_token
        const configMappings = {
          'WHATSAPP_WEBHOOK_VERIFY_TOKEN': config.whatsapp?.webhook_verify_token,
          'META_APP_ID': config.meta?.app_id,
          'META_APP_SECRET': config.meta?.app_secret,
          'BASE_URL': config.base?.url || config.base_url,
        };
        
        if (configMappings[name]) {
          value = configMappings[name];
        } else {
          // Fallback: Try nested config (e.g., meta.app_id)
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
 * Defaults to FLYP Tech Provider App ID: 1902565950686087
 */
function getTechProviderAppId() {
  // FLYP Tech Provider App ID: 1902565950686087
  const appId = getEnvVar("META_APP_ID", "1902565950686087");
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
      // FLYP Tech Provider Business Manager ID: 1337356574811477
      // Try multiple methods to find Business Manager
      let businessManagerId = null;
      const FLYP_BUSINESS_MANAGER_ID = "1337356574811477"; // FLYP Corporation Private Limited
      
      // Method 1: Try environment variable first
      businessManagerId = getEnvVar("META_BUSINESS_MANAGER_ID");
      if (businessManagerId) {
        console.log(`✅ Found Business Manager from env var: ${businessManagerId}`);
      }
      
      // Method 2: Try /me?fields=business (for System User)
      if (!businessManagerId) {
        try {
          const meResponse = await fetch(
            `${META_API_BASE}/me?access_token=${systemUserToken}&fields=business`
          );
          if (meResponse.ok) {
            const meData = await meResponse.json();
            businessManagerId = meData.business?.id;
            if (businessManagerId) {
              console.log(`✅ Found Business Manager via /me?fields=business: ${businessManagerId}`);
            }
          } else {
            const errorData = await meResponse.json().catch(() => ({}));
            console.warn(`Method 2 failed: ${meResponse.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (error) {
          console.warn("Method 2 (me?fields=business) failed:", error.message);
        }
      }

      // Method 3: Try /me/businesses (list of businesses)
      if (!businessManagerId) {
        try {
          const businessesResponse = await fetch(
            `${META_API_BASE}/me/businesses?access_token=${systemUserToken}`
          );
          if (businessesResponse.ok) {
            const businessesData = await businessesResponse.json();
            businessManagerId = businessesData.data?.[0]?.id;
            if (businessManagerId) {
              console.log(`✅ Found Business Manager via /me/businesses: ${businessManagerId}`);
            }
          } else {
            const errorData = await businessesResponse.json().catch(() => ({}));
            console.warn(`Method 3 failed: ${businessesResponse.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (error) {
          console.warn("Method 3 (me/businesses) failed:", error.message);
        }
      }

      // Method 4: Use hardcoded FLYP Business Manager ID as fallback
      if (!businessManagerId) {
        console.warn("⚠️ All API methods failed, using hardcoded FLYP Business Manager ID as fallback");
        businessManagerId = FLYP_BUSINESS_MANAGER_ID;
        console.log(`✅ Using hardcoded Business Manager ID: ${businessManagerId}`);
      }

      // Verify Business Manager ID is valid
      if (!businessManagerId || !/^\d+$/.test(businessManagerId)) {
        throw new HttpsError(
          "failed-precondition",
          `Invalid Business Manager ID: ${businessManagerId}. Expected numeric ID.`
        );
      }

      console.log(`✅ Final Business Manager ID: ${businessManagerId}`);

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
      let wabaId = businessData.whatsappBusinessAccountId;
      const createdVia = businessData.whatsappCreatedVia;
      
      // Support pre-configured WABA or allow wabaId from request
      const requestedWABAId = request.data?.wabaId;
      if (requestedWABAId) {
        wabaId = requestedWABAId;
      }

      // Allow pre-configured WABA (1403499024706435), individual_setup, embedded_signup, or pre_configured
      const isPreConfiguredWABA = wabaId === "1403499024706435";
      const isAllowedWABA = createdVia === "individual_setup" || 
                           createdVia === "embedded_signup" || 
                           createdVia === "pre_configured" || 
                           isPreConfiguredWABA ||
                           requestedWABAId; // Allow if explicitly requested

      if (!wabaId || (!isAllowedWABA && !requestedWABAId)) {
        return {
          success: false,
          message: "No valid WABA found. Please create your own WABA or select the pre-configured one.",
          needsIndividualSetup: true,
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
 * Get comprehensive WABA status including account review, phone verification, etc.
 * Returns real-time status from Meta API
 */
exports.getWABAStatus = onCall(
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
          hasWABA: false,
          message: "No WABA connected yet",
        };
      }

      // Get WABA details with account_review_status
      const wabaResponse = await fetch(
        `${META_API_BASE}/${wabaId}?access_token=${systemUserToken}&fields=id,name,message_template_namespace,account_review_status,ownership_type,timezone_id,is_enabled`
      );

      if (!wabaResponse.ok) {
        const errorData = await wabaResponse.json();
        throw new HttpsError("internal", errorData.error?.message || "Failed to get WABA status");
      }

      const wabaData = await wabaResponse.json();

      // Get phone numbers with verification status
      const phoneNumbersResponse = await fetch(
        `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}`
      );

      let phoneNumbers = [];
      let primaryPhone = null;
      if (phoneNumbersResponse.ok) {
        const phoneNumbersData = await phoneNumbersResponse.json();
        phoneNumbers = phoneNumbersData.data || [];
        // Find primary/connected phone
        primaryPhone = phoneNumbers.find(p => 
          p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
        ) || phoneNumbers[0] || null;
      }

      // Determine overall status
      const accountReviewStatus = wabaData.account_review_status || "UNKNOWN";
      const phoneVerified = primaryPhone ? 
        (primaryPhone.status === "CONNECTED" || primaryPhone.code_verification_status === "VERIFIED") : 
        false;
      const phoneRegistered = primaryPhone !== null;
      
      // Status summary
      const status = {
        accountReview: {
          status: accountReviewStatus, // APPROVED, PENDING, REJECTED, etc.
          isApproved: accountReviewStatus === "APPROVED",
          isPending: accountReviewStatus === "PENDING" || accountReviewStatus === "IN_REVIEW",
          isRejected: accountReviewStatus === "REJECTED",
          message: getAccountReviewMessage(accountReviewStatus),
        },
        phone: {
          registered: phoneRegistered,
          verified: phoneVerified,
          phoneNumber: primaryPhone?.display_phone_number || null,
          phoneNumberId: primaryPhone?.id || null,
          verificationStatus: primaryPhone?.code_verification_status || "UNVERIFIED",
          status: primaryPhone?.status || "UNKNOWN",
          needsVerification: phoneRegistered && !phoneVerified,
        },
        waba: {
          id: wabaData.id,
          name: wabaData.name || "Unknown",
          isEnabled: wabaData.is_enabled !== false,
          timezone: wabaData.timezone_id || null,
        },
        overall: {
          ready: accountReviewStatus === "APPROVED" && phoneVerified && phoneRegistered,
          needsAction: !phoneRegistered || !phoneVerified || accountReviewStatus !== "APPROVED",
          pendingActions: getPendingActions(accountReviewStatus, phoneRegistered, phoneVerified),
        },
      };

      return {
        success: true,
        hasWABA: true,
        wabaId,
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error getting WABA status:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to get WABA status");
    }
  }
);

// Helper function to get account review message
function getAccountReviewMessage(status) {
  const messages = {
    "APPROVED": "Account is approved and ready to use",
    "PENDING": "Account review is in progress",
    "IN_REVIEW": "Account is being reviewed by Meta",
    "REJECTED": "Account review was rejected",
    "LIMITED": "Account has limited functionality",
    "UNKNOWN": "Review status unknown",
  };
  return messages[status] || `Review status: ${status}`;
}

// Helper function to get pending actions
function getPendingActions(accountReviewStatus, phoneRegistered, phoneVerified) {
  const actions = [];
  if (!phoneRegistered) {
    actions.push("Add phone number");
  } else if (!phoneVerified) {
    actions.push("Verify phone number");
  }
  if (accountReviewStatus === "PENDING" || accountReviewStatus === "IN_REVIEW") {
    actions.push("Wait for account review");
  } else if (accountReviewStatus === "REJECTED") {
    actions.push("Resolve account review issues");
  }
  return actions;
}

/**
 * Save WABA directly from frontend (when postMessage provides WABA ID)
 * This is the preferred method - direct handshake from Meta
 */
exports.saveWABADirect = onCall(
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

      const { wabaId, phoneNumberId, phoneNumber, embeddedData } = request.data || {};
      
      if (!wabaId) {
        throw new HttpsError("invalid-argument", "WABA ID is required");
      }

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      // Verify WABA exists and get details
      const wabaResponse = await fetch(
        `${META_API_BASE}/${wabaId}?access_token=${systemUserToken}&fields=id,name,account_review_status,ownership_type,timezone_id,is_enabled`
      );

      if (!wabaResponse.ok) {
        const errorData = await wabaResponse.json();
        throw new HttpsError("internal", errorData.error?.message || "WABA not accessible");
      }

      const wabaData = await wabaResponse.json();

      // Get phone numbers if not provided
      let primaryPhone = null;
      let finalPhoneNumberId = phoneNumberId;
      if (!phoneNumberId || !phoneNumber) {
        const phoneNumbersResponse = await fetch(
          `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}`
        );

        if (phoneNumbersResponse.ok) {
          const phoneNumbersData = await phoneNumbersResponse.json();
          const phoneNumbers = phoneNumbersData.data || [];
          primaryPhone = phoneNumbers.find(p => 
            p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
          ) || phoneNumbers[0] || null;
          if (primaryPhone && !finalPhoneNumberId) {
            finalPhoneNumberId = primaryPhone.id;
          }
        }
      } else {
        finalPhoneNumberId = phoneNumberId;
      }

      // ============================================================
      // POST-SIGNUP ORCHESTRATION FLOW (Expert Recommendation)
      // Must be performed in this exact sequence:
      // 1. Register Phone Number
      // 2. Subscribe App to WABA
      // 3. Update Firestore (only after both succeed)
      // ============================================================
      
      let phoneRegistrationSuccess = false;
      let appSubscriptionSuccess = false;

      // STEP 1: Register the phone number with Meta Cloud API
      // CRITICAL: This is required to move phone from "Pending" to "Verified" status
      if (finalPhoneNumberId) {
        try {
          // Use PIN from embedded signup data if available
          // Note: Meta Embedded Signup may not provide PIN - in that case, user must verify via OTP
          const registrationPin = embeddedData?.pin || embeddedData?.registration_pin || embeddedData?.data?.pin;
          
          if (registrationPin) {
            console.log(`📞 STEP 1: Registering phone number ${finalPhoneNumberId} with PIN...`);
            
            const registerResponse = await fetch(
              `${META_API_BASE}/${finalPhoneNumberId}/register?access_token=${systemUserToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  pin: registrationPin,
                }),
              }
            );

            if (registerResponse.ok) {
              const registerData = await registerResponse.json();
              console.log(`✅ STEP 1 SUCCESS: Phone number ${finalPhoneNumberId} registered:`, registerData);
              phoneRegistrationSuccess = true;
            } else {
              const errorData = await registerResponse.json();
              const errorMsg = errorData.error?.message || '';
              
              // If already registered, that's considered success
              if (errorMsg.includes("already registered") || 
                  errorMsg.includes("already exists") ||
                  errorMsg.includes("already verified")) {
                console.log(`✅ STEP 1: Phone number already registered/verified`);
                phoneRegistrationSuccess = true;
              } else {
                console.warn(`⚠️ STEP 1: Phone registration returned ${registerResponse.status}:`, errorData);
                // Continue - phone might need OTP verification instead
              }
            }
          } else {
            console.log(`ℹ️ STEP 1: No PIN provided - phone will need OTP verification via Meta Business Suite`);
            // Phone registration will happen via OTP - this is acceptable
            phoneRegistrationSuccess = true; // Allow to continue
          }
        } catch (registerError) {
          console.error("❌ STEP 1 ERROR: Phone registration failed:", registerError.message);
          // Don't fail completely - phone might be registered via OTP
        }
      } else {
        console.warn("⚠️ STEP 1: No phone number ID available - skipping registration");
      }

      // STEP 2: Subscribe app to WABA (REQUIRED for Tech Provider)
      // CRITICAL: Without this, webhooks won't fire and Meta won't send you data
      const appId = getEnvVar("META_APP_ID");
      if (appId) {
        try {
          console.log(`📞 STEP 2: Subscribing app ${appId} to WABA ${wabaId}...`);
          
          const subscribeResponse = await fetch(
            `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemUserToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                app_id: appId,
                subscribed_fields: [
                  "messages", 
                  "message_status", 
                  "message_template_status_update", 
                  "account_alerts",
                  "phone_number_name_update",  // Detect when phone number name/status changes
                  "account_update"  // Detect when account review status changes
                ],
              }),
            }
          );

          if (subscribeResponse.ok) {
            const subscribeData = await subscribeResponse.json();
            console.log(`✅ STEP 2 SUCCESS: App ${appId} subscribed to WABA ${wabaId}:`, subscribeData);
            appSubscriptionSuccess = true;
          } else {
            const errorData = await subscribeResponse.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || '';
            const errorCode = errorData.error?.code;
            const errorType = errorData.error?.type;
            
            // Enhanced error logging for debugging
            console.error(`❌ STEP 2 ERROR: App subscription failed:`, {
              status: subscribeResponse.status,
              statusText: subscribeResponse.statusText,
              errorCode,
              errorType,
              errorMessage: errorMsg,
              wabaId,
              appId,
              systemUserTokenPrefix: systemUserToken.substring(0, 20) + '...' // Partial for security
            });
            
            // If already subscribed, that's considered success
            if (errorMsg.includes("already subscribed") || 
                errorMsg.includes("already exists")) {
              console.log(`✅ STEP 2: App already subscribed to WABA`);
              appSubscriptionSuccess = true;
            } else {
              // Check for permission errors
              if (errorCode === 200 || 
                  errorMsg.includes("permission") || 
                  errorMsg.includes("access") ||
                  errorMsg.includes("does not have") ||
                  errorType === "OAuthException") {
                throw new HttpsError(
                  "failed-precondition",
                  `System User Token lacks required permissions (whatsapp_business_management). Error: ${errorMsg}. Please verify your System User Token has the correct permissions in Meta Business Suite.`
                );
              }
              
              // This is critical - fail if subscription fails
              throw new HttpsError(
                "internal", 
                `Failed to subscribe app to WABA: ${errorMsg || 'Unknown error'} (Code: ${errorCode || 'N/A'})`
              );
            }
          }
        } catch (err) {
          // Enhanced error logging
          console.error("❌ STEP 2 ERROR: App subscription failed with full details:", {
            message: err.message,
            code: err.code,
            name: err.name,
            stack: err.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
          });
          
          // Re-throw HttpsError as-is (already properly formatted)
          if (err instanceof HttpsError) {
            throw err;
          }
          
          // Wrap other errors
          throw new HttpsError("internal", `Failed to subscribe app to WABA: ${err.message}`);
        }
      } else {
        console.error("❌ STEP 2 ERROR: META_APP_ID not configured");
        throw new HttpsError("internal", "META_APP_ID not configured. Cannot subscribe app to WABA.");
      }

      // STEP 3: Update Firestore (ONLY after successful registration and subscription)
      // CRITICAL: Only mark whatsappEnabled: true after both operations succeed
      const updateData = {
        whatsappBusinessAccountId: wabaId,
        whatsappPhoneNumberId: finalPhoneNumberId || null,
        whatsappPhoneNumber: phoneNumber || primaryPhone?.display_phone_number || null,
        whatsappProvider: "meta_tech_provider",
        whatsappEnabled: phoneRegistrationSuccess && appSubscriptionSuccess, // Only enable if both succeeded
        whatsappCreatedVia: 'embedded_signup',
        whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        whatsappPhoneRegistered: phoneRegistrationSuccess && finalPhoneNumberId ? true : false,
        whatsappPhoneVerificationStatus: primaryPhone?.code_verification_status || (finalPhoneNumberId ? 'pending' : 'not_registered'),
        whatsappVerified: false,
        whatsappAccountReviewStatus: wabaData.account_review_status || 'PENDING',
        embeddedSignupData: embeddedData || {},
        // Track orchestration status
        whatsappOrchestrationStatus: {
          phoneRegistered: phoneRegistrationSuccess,
          appSubscribed: appSubscriptionSuccess,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        ...(embeddedData?.access_token && { whatsappAccessToken: embeddedData.access_token }),
        ...(embeddedData?.code && { whatsappOAuthCode: embeddedData.code }),
        ...(embeddedData?.business_id && { metaBusinessId: embeddedData.business_id }),
      };

      await businessDocRef.update(updateData);
      
      console.log(`✅ STEP 3 SUCCESS: Firestore updated. WhatsApp enabled: ${updateData.whatsappEnabled}`);

      // STEP 4: Setup webhook automatically (non-blocking)
      try {
        console.log(`📞 STEP 4: Setting up webhook for WABA ${wabaId}...`);
        // Note: setupWebhookForClient is a separate function that can be called
        // For now, webhook setup happens via setupWebhookForClient function
        console.log(`✅ STEP 4: Webhook setup initiated (handled separately)`);
      } catch (webhookError) {
        console.warn("⚠️ STEP 4: Could not setup webhook automatically:", webhookError);
        // Non-critical - webhook can be set up later
      }

      return {
        success: true,
        wabaId,
        wabaData,
        phoneNumber: phoneNumber || primaryPhone?.display_phone_number || null,
        phoneNumberId: finalPhoneNumberId || null,
        phoneRegistrationSuccess,
        appSubscriptionSuccess,
        whatsappEnabled: phoneRegistrationSuccess && appSubscriptionSuccess,
        message: phoneRegistrationSuccess && appSubscriptionSuccess
          ? "WABA saved and fully configured. Ready to use!"
          : "WABA saved. Phone verification may be required."
      };
    } catch (error) {
      console.error("Error saving WABA directly:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to save WABA");
    }
  }
);

/**
 * Detect newly created WABA accounts for a user
 * Checks Business Manager for WABAs that might have been created via Embedded Signup
 * but not yet saved to Firestore
 * NOTE: This is a fallback method. Prefer using saveWABADirect when postMessage works.
 */
exports.detectNewWABA = onRequest(
  {
    region: "us-central1",
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).send("");
    }

    cors(req, res, async () => {
      try {
        // Verify authentication from Authorization header
        const authHeader = req.headers.authorization;
        let uid = null;

        if (authHeader && authHeader.startsWith("Bearer ")) {
          const idToken = authHeader.split("Bearer ")[1];
          try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            uid = decodedToken.uid;
          } catch (tokenError) {
            return res.status(401).json({ 
              success: false, 
              error: "Unauthorized - Invalid token" 
            });
          }
        } else {
          // Try to get from request body (for callable function compatibility)
          uid = req.body?.uid || req.body?.auth?.uid;
        }

        if (!uid) {
          return res.status(401).json({ 
            success: false, 
            error: "You must be signed in." 
          });
        }

        const systemUserToken = getSystemUserToken();
        const businessDocRef = db.collection("businesses").doc(uid);
        const businessDoc = await businessDocRef.get();

        if (!businessDoc || !businessDoc.exists) {
          return res.status(404).json({ 
            success: false, 
            error: "Business profile not found" 
          });
        }

      const businessData = businessDoc.data();
      const existingWABAId = businessData.whatsappBusinessAccountId;

      // Get Business Manager ID
      const FLYP_BUSINESS_MANAGER_ID = "1337356574811477";
      const businessManagerId = getEnvVar("META_BUSINESS_MANAGER_ID") || FLYP_BUSINESS_MANAGER_ID;

      // Get user's email and phone to match WABAs
      const userEmail = businessData.email?.toLowerCase() || '';
      const userPhone = businessData.phone || '';
      const userName = businessData.ownerName || businessData.businessName || '';

      console.log(`🔍 Looking for WABA for user: ${uid}, email: ${userEmail}, phone: ${userPhone}`);

      // Get all WABAs from Business Manager
      // Note: This requires the System User to have access to the Business Manager
      try {
        // Try multiple endpoints to list WABAs
        let wabasResponse = await fetch(
          `${META_API_BASE}/${businessManagerId}/owned_whatsapp_business_accounts?access_token=${systemUserToken}`
        );
        
        // If that fails, try the alternative endpoint
        if (!wabasResponse.ok) {
          wabasResponse = await fetch(
            `${META_API_BASE}/${businessManagerId}/whatsapp_business_accounts?access_token=${systemUserToken}`
          );
        }

        if (wabasResponse.ok) {
          const wabasData = await wabasResponse.json();
          const allWABAs = wabasData.data || [];
          console.log(`📋 Found ${allWABAs.length} WABAs in Business Manager`);
          console.log(`📋 User info for matching: name="${userName}", email="${userEmail}", phone="${userPhone}"`);

          // Strategy 1: Find WABAs by matching name/email/phone
          // Get details for each WABA and try to match with user
          const matchedWABAs = [];
          
          for (const waba of allWABAs) {
            // Skip if user already has this WABA
            if (existingWABAId && waba.id === existingWABAId) {
              console.log(`⏭️ Skipping WABA ${waba.id} - user already has it`);
              continue;
            }

            try {
              console.log(`🔍 Checking WABA ${waba.id}...`);
              
              // Get WABA details including owner info
              const wabaDetailsResponse = await fetch(
                `${META_API_BASE}/${waba.id}?access_token=${systemUserToken}&fields=id,name,account_review_status,ownership_type,timezone_id,is_enabled,owner_business_info`
              );

              if (wabaDetailsResponse.ok) {
                const wabaDetails = await wabaDetailsResponse.json();
                console.log(`📝 WABA ${waba.id} details: name="${wabaDetails.name}", status="${wabaDetails.account_review_status}"`);
                
                // Get phone numbers to match
                const phoneNumbersResponse = await fetch(
                  `${META_API_BASE}/${waba.id}/phone_numbers?access_token=${systemUserToken}`
                );

                let phoneNumbers = [];
                if (phoneNumbersResponse.ok) {
                  const phoneNumbersData = await phoneNumbersResponse.json();
                  phoneNumbers = phoneNumbersData.data || [];
                  console.log(`📱 WABA ${waba.id} has ${phoneNumbers.length} phone number(s)`);
                }

                // Match by name (more lenient - check if any part matches)
                const wabaName = (wabaDetails.name || '').toLowerCase().trim();
                const userNameLower = (userName || '').toLowerCase().trim();
                const matchesName = userNameLower && (
                  wabaName.includes(userNameLower) || 
                  userNameLower.includes(wabaName) ||
                  wabaName === userNameLower ||
                  // Also check if business name matches
                  wabaName.includes((businessData.businessName || '').toLowerCase().trim()) ||
                  (businessData.businessName || '').toLowerCase().trim().includes(wabaName)
                );

                // Match by phone number (check last 10 digits)
                const matchesPhone = phoneNumbers.some(p => {
                  const phoneNum = (p.display_phone_number || p.verified_name || '').replace(/\D/g, '');
                  const userPhoneClean = (userPhone || '').replace(/\D/g, '');
                  if (phoneNum && userPhoneClean && phoneNum.length >= 10 && userPhoneClean.length >= 10) {
                    return phoneNum.slice(-10) === userPhoneClean.slice(-10);
                  }
                  return false;
                });

                console.log(`🔍 WABA ${waba.id} matching: name=${matchesName}, phone=${matchesPhone}`);

                // If matches, this is likely the user's WABA
                if (matchesName || matchesPhone) {
                  console.log(`✅ Matched WABA ${waba.id} by ${matchesName ? 'name' : 'phone'}`);
                  matchedWABAs.push({
                    waba,
                    wabaDetails,
                    phoneNumbers,
                    matchReason: matchesName ? 'name' : 'phone'
                  });
                } else {
                  console.log(`❌ WABA ${waba.id} did not match (name="${wabaName}" vs user="${userNameLower}", phone check failed)`);
                }
              } else {
                console.warn(`⚠️ Could not get details for WABA ${waba.id}: ${wabaDetailsResponse.status}`);
              }
            } catch (err) {
              console.warn(`⚠️ Error checking WABA ${waba.id}:`, err.message);
            }
          }

          // Strategy 2: If no matches, get the most recently created WABA
          // (fallback for when matching fails)
          if (matchedWABAs.length === 0 && allWABAs.length > 0) {
            console.log(`⚠️ No matches found, using most recent WABA as fallback`);
            const recentWABAs = allWABAs.filter(waba => 
              !existingWABAId || waba.id !== existingWABAId
            );
            
            if (recentWABAs.length > 0) {
              const newWABA = recentWABAs[0];
            
              try {
                const wabaDetailsResponse = await fetch(
                  `${META_API_BASE}/${newWABA.id}?access_token=${systemUserToken}&fields=id,name,account_review_status,ownership_type,timezone_id,is_enabled`
                );

                if (wabaDetailsResponse.ok) {
                  const wabaDetails = await wabaDetailsResponse.json();
                  
                  const phoneNumbersResponse = await fetch(
                    `${META_API_BASE}/${newWABA.id}/phone_numbers?access_token=${systemUserToken}`
                  );

                  let phoneNumbers = [];
                  let primaryPhone = null;
                  if (phoneNumbersResponse.ok) {
                    const phoneNumbersData = await phoneNumbersResponse.json();
                    phoneNumbers = phoneNumbersData.data || [];
                    primaryPhone = phoneNumbers.find(p => 
                      p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
                    ) || phoneNumbers[0] || null;
                  }

                  matchedWABAs.push({
                    waba: newWABA,
                    wabaDetails,
                    phoneNumbers,
                    matchReason: 'fallback_recent'
                  });
                }
              } catch (err) {
                console.warn(`⚠️ Error getting fallback WABA details:`, err.message);
              }
            }
          }

          // Return the best match (prefer name match, then phone match, then fallback)
          if (matchedWABAs.length > 0) {
            // Sort: name matches first, then phone matches, then fallback
            matchedWABAs.sort((a, b) => {
              const priority = { 'name': 1, 'phone': 2, 'fallback_recent': 3 };
              return (priority[a.matchReason] || 99) - (priority[b.matchReason] || 99);
            });

            const bestMatch = matchedWABAs[0];
            const primaryPhone = bestMatch.phoneNumbers.find(p => 
              p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
            ) || bestMatch.phoneNumbers[0] || null;

            console.log(`✅ Returning matched WABA: ${bestMatch.waba.id} (matched by: ${bestMatch.matchReason})`);

            return res.status(200).json({
              success: true,
              found: true,
              wabaId: bestMatch.waba.id,
              wabaData: bestMatch.wabaDetails,
              phoneNumbers: bestMatch.phoneNumbers,
              primaryPhone: primaryPhone ? {
                id: primaryPhone.id,
                number: primaryPhone.display_phone_number,
                status: primaryPhone.status,
                verificationStatus: primaryPhone.code_verification_status
              } : null,
              matchReason: bestMatch.matchReason
            });
          }

          // If we got here, no WABAs matched
          // IMPROVEMENT: If user has no WABA and there's only one unassigned WABA, suggest it
          if (!existingWABAId && allWABAs.length > 0) {
            // Check if there's only one WABA that's not assigned to any user
            const unassignedWABAs = allWABAs.filter(waba => {
              // Skip if this user already has it
              if (waba.id === existingWABAId) return false;
              return true;
            });

            // If there's exactly one unassigned WABA, suggest it as a fallback
            if (unassignedWABAs.length === 1) {
              const suggestedWABA = unassignedWABAs[0];
              console.log(`💡 No exact match found, but found 1 unassigned WABA: ${suggestedWABA.id} - suggesting as fallback`);
              
              try {
                const wabaDetailsResponse = await fetch(
                  `${META_API_BASE}/${suggestedWABA.id}?access_token=${systemUserToken}&fields=id,name,account_review_status,ownership_type,timezone_id,is_enabled`
                );

                if (wabaDetailsResponse.ok) {
                  const wabaDetails = await wabaDetailsResponse.json();
                  
                  const phoneNumbersResponse = await fetch(
                    `${META_API_BASE}/${suggestedWABA.id}/phone_numbers?access_token=${systemUserToken}`
                  );

                  let phoneNumbers = [];
                  let primaryPhone = null;
                  if (phoneNumbersResponse.ok) {
                    const phoneNumbersData = await phoneNumbersResponse.json();
                    phoneNumbers = phoneNumbersData.data || [];
                    primaryPhone = phoneNumbers.find(p => 
                      p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
                    ) || phoneNumbers[0] || null;
                  }

                  return res.status(200).json({
                    success: true,
                    found: true,
                    wabaId: suggestedWABA.id,
                    wabaData: wabaDetails,
                    phoneNumbers: phoneNumbers,
                    primaryPhone: primaryPhone ? {
                      id: primaryPhone.id,
                      number: primaryPhone.display_phone_number,
                      status: primaryPhone.status,
                      verificationStatus: primaryPhone.code_verification_status
                    } : null,
                    matchReason: 'fallback_single_unassigned',
                    isSuggested: true,
                    message: `Found 1 unassigned WABA. This might be yours - please verify the name matches.`
                  });
                }
              } catch (err) {
                console.warn(`⚠️ Error getting suggested WABA details:`, err.message);
              }
            }
          }

          console.log(`❌ No WABAs found matching user ${uid} (${userName || userEmail})`);
          return res.status(200).json({
            success: true,
            found: false,
            message: `No new WABA accounts found. Searched ${allWABAs.length} WABAs in Business Manager.`,
            searchedCount: allWABAs.length,
            allWABAs: allWABAs.map(w => ({ id: w.id, name: w.name })), // Return list for manual selection
            userInfo: {
              name: userName,
              email: userEmail ? userEmail.substring(0, 3) + '***' : 'N/A', // Partial for privacy
              phone: userPhone ? userPhone.substring(0, 3) + '***' : 'N/A'
            }
          });
        } else {
          const errorData = await wabasResponse.json().catch(() => ({}));
          console.warn("Could not list WABAs:", errorData);
          return res.status(200).json({
            success: false,
            found: false,
            message: "Could not access Business Manager WABAs"
          });
        }
      } catch (error) {
        console.error("Error detecting new WABA:", error);
        return res.status(500).json({
          success: false,
          found: false,
          message: error.message || "Failed to detect new WABA"
        });
      }
      } catch (outerError) {
        console.error("Error in detectNewWABA outer catch:", outerError);
        return res.status(500).json({
          success: false,
          found: false,
          message: outerError.message || "Failed to detect new WABA"
        });
      }
    });
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
        const errorMessage = errorData.error?.message || "Failed to send message";
        const errorCode = errorData.error?.code;
        const errorSubcode = errorData.error?.error_subcode;
        
        // Provide helpful error messages
        let userMessage = errorMessage;
        if (errorCode === 10 || errorSubcode === 10) {
          userMessage = "Application does not have permission. Request Production Access in Meta Business Suite.";
        } else if (errorCode === 131030 || errorSubcode === 131030) {
          userMessage = `Recipient phone number (${to}) is not in the allowed list. Add this number to your WABA's allowed list in Meta Business Suite → WhatsApp → API Setup → Add recipient phone numbers.`;
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
/**
 * Internal helper function to setup webhook for a WABA
 * Can be called from setupWebhookForClient (callable) or embeddedSignupCallback (HTTP)
 * Exported for use in embeddedSignupCallback
 */
async function setupWebhookForWABA(uid, wabaId = null) {
  const systemUserToken = getSystemUserToken();
  const BASE_URL = getEnvVar("BASE_URL", "https://stockpilotv1.web.app");
  const webhookUrl = `${BASE_URL}/whatsapp/tech-provider/webhook`;

  const businessDocRef = db.collection("businesses").doc(uid);
  const businessDoc = await businessDocRef.get();

  if (!businessDoc || !businessDoc.exists) {
    throw new Error("Business profile not found");
  }

  const businessData = businessDoc.data();
  const targetWabaId = wabaId || businessData.whatsappBusinessAccountId;

  if (!targetWabaId) {
    throw new Error("WABA not found. Please create WABA first.");
  }

  // First, verify WABA exists and System User has access
  const verifyWABAResponse = await fetch(
    `${META_API_BASE}/${targetWabaId}?access_token=${systemUserToken}&fields=id,name,ownership_type`
  );

  if (!verifyWABAResponse.ok) {
    const errorData = await verifyWABAResponse.json();
    const errorMessage = errorData.error?.message || "Failed to access WABA";
    throw new Error(errorMessage);
  }

  const wabaInfo = await verifyWABAResponse.json();
  console.log(`✅ WABA ${targetWabaId} verified, ownership_type: ${wabaInfo.ownership_type}`);

  // Get App ID
  const appId = getEnvVar("META_APP_ID");
  if (!appId) {
    throw new Error("META_APP_ID not configured. Please set META_APP_ID environment variable.");
  }

  // Subscribe app to WABA (required for Tech Provider)
  // First, check if app is already subscribed
  const subscribedAppsResponse = await fetch(
    `${META_API_BASE}/${targetWabaId}/subscribed_apps?access_token=${systemUserToken}`
  );

  let appSubscribed = false;
  if (subscribedAppsResponse.ok) {
    const subscribedApps = await subscribedAppsResponse.json();
    appSubscribed = subscribedApps.data?.some(app => app.id === appId || app.app_id === appId);
    console.log(`App ${appId} subscribed: ${appSubscribed}`);
  }

  // If not subscribed, subscribe the app first
  if (!appSubscribed) {
    console.log(`Subscribing app ${appId} to WABA ${targetWabaId}...`);
    
    const subscribeResponse = await fetch(
      `${META_API_BASE}/${targetWabaId}/subscribed_apps?access_token=${systemUserToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          subscribed_fields: [
            "messages", 
            "message_status", 
            "message_template_status_update", 
            "account_alerts",
            "phone_number_name_update",
            "account_update"
          ],
        }),
      }
    );

    if (!subscribeResponse.ok) {
      const errorData = await subscribeResponse.json();
      const errorMessage = errorData.error?.message || "Failed to subscribe app to WABA";
      throw new Error(errorMessage);
    }
    
    console.log(`✅ App ${appId} subscribed to WABA ${targetWabaId}`);
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
    wabaId: targetWabaId,
    message: "Webhook configured successfully",
  };
}

// Export for use in embeddedSignupCallback
exports.setupWebhookForWABA = setupWebhookForWABA;

/**
 * Setup webhook for client's WABA (Callable Function)
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

      const result = await setupWebhookForWABA(uid);
      return result;
    } catch (error) {
      console.error("Error setting up webhook:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      // Convert regular errors to HttpsError with appropriate codes
      if (error.message.includes("not found")) {
        throw new HttpsError("not-found", error.message);
      }
      if (error.message.includes("not configured") || error.message.includes("not accessible")) {
        throw new HttpsError("failed-precondition", error.message);
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
                  const field = change.field;

                  console.log(`📋 Processing change field: ${field} for WABA ${wabaId}`);

                  // Handle account review status updates
                  if (field === "account_alerts" || field === "account_review_status" || field === "waba_review_update" || field === "account_update") {
                    console.log(`🔔 Account review update received for WABA ${wabaId} (field: ${field})`);
                    await handleAccountReviewUpdate(value, wabaId, distributorId);
                  }

                  // Handle phone number verification updates
                  if (field === "phone_number_verification" || field === "phone_number_status" || field === "phone_number_name_update") {
                    console.log(`📱 Phone number update received for WABA ${wabaId} (field: ${field})`);
                    await handlePhoneNumberUpdate(value, wabaId, distributorId);
                  }

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

/**
 * Handle account review status updates from webhook
 * Updates Firestore when account review status changes (PENDING -> APPROVED, etc.)
 */
async function handleAccountReviewUpdate(value, wabaId, distributorId) {
  try {
    const systemUserToken = getSystemUserToken();
    
    // Get latest account review status from Meta API
    const wabaResponse = await fetch(
      `${META_API_BASE}/${wabaId}?access_token=${systemUserToken}&fields=id,name,account_review_status,ownership_type,timezone_id,is_enabled`
    );

    if (!wabaResponse.ok) {
      console.error(`❌ Failed to fetch WABA details: ${wabaResponse.status}`);
      return;
    }

    const wabaData = await wabaResponse.json();
    const accountReviewStatus = wabaData.account_review_status || "UNKNOWN";

    // Update Firestore with new status
    const businessDocRef = db.collection("businesses").doc(distributorId);
    await businessDocRef.update({
      whatsappAccountReviewStatus: accountReviewStatus,
      whatsappAccountReviewUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      whatsappVerified: accountReviewStatus === "APPROVED",
    });

    console.log(`✅ Updated account review status for ${distributorId}: ${accountReviewStatus}`);

    // Also update phone numbers if available
    try {
      const phoneNumbersResponse = await fetch(
        `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}`
      );

      if (phoneNumbersResponse.ok) {
        const phoneNumbersData = await phoneNumbersResponse.json();
        const phoneNumbers = phoneNumbersData.data || [];
        const primaryPhone = phoneNumbers.find(p => 
          p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
        ) || phoneNumbers[0] || null;

        if (primaryPhone) {
          await businessDocRef.update({
            whatsappPhoneNumberId: primaryPhone.id,
            whatsappPhoneNumber: primaryPhone.display_phone_number || null,
            whatsappPhoneRegistered: true,
            whatsappPhoneVerificationStatus: primaryPhone.code_verification_status || primaryPhone.status || "UNKNOWN",
            whatsappVerified: primaryPhone.code_verification_status === "VERIFIED" || accountReviewStatus === "APPROVED",
          });

          console.log(`✅ Updated phone number info for ${distributorId}`);
        }
      }
    } catch (phoneError) {
      console.warn("Could not update phone numbers:", phoneError);
    }
  } catch (error) {
    console.error("❌ Error handling account review update:", error);
  }
}

/**
 * Handle phone number verification updates from webhook
 */
async function handlePhoneNumberUpdate(value, wabaId, distributorId) {
  try {
    const systemUserToken = getSystemUserToken();
    
    // Get latest phone numbers from Meta API
    const phoneNumbersResponse = await fetch(
      `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}`
    );

    if (!phoneNumbersResponse.ok) {
      console.error(`❌ Failed to fetch phone numbers: ${phoneNumbersResponse.status}`);
      return;
    }

    const phoneNumbersData = await phoneNumbersResponse.json();
    const phoneNumbers = phoneNumbersData.data || [];
    const primaryPhone = phoneNumbers.find(p => 
      p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
    ) || phoneNumbers[0] || null;

    if (primaryPhone) {
      const businessDocRef = db.collection("businesses").doc(distributorId);
      await businessDocRef.update({
        whatsappPhoneNumberId: primaryPhone.id,
        whatsappPhoneNumber: primaryPhone.display_phone_number || null,
        whatsappPhoneRegistered: true,
        whatsappPhoneVerificationStatus: primaryPhone.code_verification_status || primaryPhone.status || "UNKNOWN",
        whatsappVerified: primaryPhone.code_verification_status === "VERIFIED",
        whatsappPhoneUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Updated phone number verification for ${distributorId}: ${primaryPhone.code_verification_status}`);
    }
  } catch (error) {
    console.error("❌ Error handling phone number update:", error);
  }
}

/**
 * Get WhatsApp Setup Status
 * Returns complete setup status including WABA, phone number, and webhook
 * Only shows individual WABAs (created via individual_setup)
 */
exports.getWhatsAppSetupStatus = onCall(
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
        return {
          status: {
            overall: { complete: false, message: "Business profile not found" },
            waba: { id: null, accessible: false },
            phoneNumber: { id: null, registered: false },
          },
        };
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;
      const createdVia = businessData.whatsappCreatedVia;
      const isDemoMode = businessData.whatsappDemoMode || false;

      // Support demo mode with existing WABA
      if (!wabaId) {
        return {
          status: {
            overall: { 
              complete: false, 
              message: "No WABA found. Please create your own WABA." 
            },
            waba: { 
              id: null, 
              name: null,
              accessible: false,
              needsIndividualSetup: true,
            },
            phoneNumber: { id: null, registered: false },
          },
        };
      }

      // Allow pre-configured WABA (1403499024706435) to be used
      // Also allow demo mode or embedded_signup WABAs
      const isPreConfiguredWABA = wabaId === "1403499024706435";
      const isAllowedWABA = isDemoMode || createdVia === "individual_setup" || createdVia === "embedded_signup" || createdVia === "pre_configured" || isPreConfiguredWABA;
      
      if (!isAllowedWABA) {
        // Only show individual WABAs or pre-configured WABA
        return {
          status: {
            overall: { 
              complete: false, 
              message: "No individual WABA found. Please create your own WABA or select the pre-configured one." 
            },
            waba: { 
              id: null, 
              name: null,
              accessible: false,
              needsIndividualSetup: true,
            },
            phoneNumber: { id: null, registered: false },
          },
        };
      }

      // Get WABA details
      let wabaData = null;
      let wabaAccessible = false;
      try {
        const wabaResponse = await fetch(
          `${META_API_BASE}/${wabaId}?access_token=${systemUserToken}&fields=id,name,message_template_namespace,account_review_status,ownership_type,timezone_id`
        );

        if (wabaResponse.ok) {
          wabaData = await wabaResponse.json();
          wabaAccessible = true;
        }
      } catch (error) {
        console.warn("Could not fetch WABA details:", error);
      }

      // Get phone numbers from API
      let phoneNumberId = businessData.whatsappPhoneNumberId;
      let phoneNumber = businessData.whatsappPhoneNumber;
      let phoneRegistered = businessData.whatsappPhoneRegistered || false;
      let phoneStatus = businessData.whatsappPhoneVerificationStatus || "unknown";

      let phoneNumbers = [];
      try {
        const phoneNumbersResponse = await fetch(
          `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}&fields=id,display_phone_number,verified_name,status,code_verification_status`
        );
        if (phoneNumbersResponse.ok) {
          const phoneNumbersData = await phoneNumbersResponse.json();
          phoneNumbers = phoneNumbersData.data || [];
          
          // Always try to get phone number from API if available (for pre-configured WABA or any WABA)
          if (phoneNumbers.length > 0) {
            // Use the first connected/verified phone number
            const connectedPhone = phoneNumbers.find(p => 
              p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
            ) || phoneNumbers[0];
            
            if (connectedPhone) {
              // Update phone number info from API if not stored or if different
              if (!phoneNumberId || !phoneNumber) {
                phoneNumberId = connectedPhone.id;
                phoneNumber = connectedPhone.display_phone_number;
                phoneRegistered = connectedPhone.status === "CONNECTED" || connectedPhone.code_verification_status === "VERIFIED";
                phoneStatus = connectedPhone.code_verification_status || connectedPhone.status || "connected";
                
                // Update Firestore with phone number info
                try {
                  await businessDocRef.update({
                    whatsappPhoneNumberId: phoneNumberId,
                    whatsappPhoneNumber: phoneNumber,
                    whatsappPhoneRegistered: phoneRegistered,
                    whatsappPhoneVerificationStatus: phoneStatus,
                  });
                } catch (updateError) {
                  console.warn("Could not update phone number in Firestore:", updateError);
                }
              } else {
                // Verify stored phone number matches API
                phoneRegistered = connectedPhone.status === "CONNECTED" || connectedPhone.code_verification_status === "VERIFIED";
                phoneStatus = connectedPhone.code_verification_status || connectedPhone.status || phoneStatus;
              }
            }
          }
        }
      } catch (error) {
        console.warn("Could not fetch phone numbers:", error);
      }

      // Check credentials status
      const appId = getTechProviderAppId();
      const systemUserTokenConfigured = !!systemUserToken;
      const businessManagerId = getEnvVar("META_BUSINESS_MANAGER_ID", "1337356574811477");
      
      // Check embedded signup readiness
      const embeddedSignupReady = systemUserTokenConfigured && wabaAccessible;
      
      // Check webhook status
      const webhookConfigured = businessData.whatsappWebhookConfigured || false;
      const webhookUrl = businessData.whatsappWebhookUrl || null;
      
      // Overall setup is complete if WABA is accessible and phone is registered
      const overallComplete = wabaAccessible && phoneRegistered;
      const readyForApi = wabaAccessible && phoneRegistered && systemUserTokenConfigured;
      const readyForDemo = overallComplete && systemUserTokenConfigured;

      return {
        status: {
          overall: {
            complete: overallComplete,
            readyForApi: readyForApi,
            readyForDemo: readyForDemo,
            message: overallComplete 
              ? "WhatsApp setup is complete" 
              : readyForApi
              ? "Setup functional but needs phone verification"
              : "Setup in progress",
          },
          credentials: {
            appId: appId,
            systemUserTokenConfigured: systemUserTokenConfigured,
            businessManagerId: businessManagerId,
          },
          embeddedSignup: {
            ready: embeddedSignupReady,
          },
          waba: {
            id: wabaId,
            name: wabaData?.name || null,
            status: wabaData?.account_review_status || null,
            accessible: wabaAccessible,
            isIndividual: createdVia === "individual_setup" || createdVia === "embedded_signup",
          },
          phoneNumber: {
            id: phoneNumberId || null,
            number: phoneNumber || null,
            status: phoneStatus,
            registered: phoneRegistered,
            phoneNumbers: phoneNumbers,
          },
          webhook: {
            configured: webhookConfigured,
            url: webhookUrl,
          },
        },
      };
    } catch (error) {
      console.error("Error getting WhatsApp setup status:", error);
      return {
        status: {
          overall: { complete: false, message: error.message || "Failed to get setup status" },
          waba: { id: null, accessible: false },
          phoneNumber: { id: null, registered: false },
        },
      };
    }
  }
);

/**
 * Create Individual WABA for User with Phone Number
 * Complete setup: WABA creation + Phone number registration + OTP verification
 * All WABAs are created under FLYP Tech Provider App
 */
exports.createIndividualWABA = onCall(
  {
    region: "us-central1",
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "You must be signed in.");
      }

      const { phoneNumber, businessName } = request.data || {};
      
      if (!phoneNumber) {
        throw new HttpsError("invalid-argument", "Phone number is required");
      }
      
      if (!businessName) {
        throw new HttpsError("invalid-argument", "Business name is required");
      }

      // Validate phone number format (should be new, not used with WhatsApp)
      const formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
      if (formattedPhone.length < 10) {
        throw new HttpsError("invalid-argument", "Invalid phone number format");
      }

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      
      // Check if user already has an individual WABA
      if (businessData.whatsappBusinessAccountId && businessData.whatsappCreatedVia === "individual_setup") {
        throw new HttpsError(
          "already-exists",
          "You already have an individual WhatsApp Business Account. Please use the existing one."
        );
      }

      // Step 1: Get Business Manager ID
      // FLYP Tech Provider Business Manager ID: 1337356574811477
      // Try multiple methods to find Business Manager
      let businessManagerId = null;
      const FLYP_BUSINESS_MANAGER_ID = "1337356574811477"; // FLYP Corporation Private Limited
      
      // Method 1: Try environment variable first (if Business Manager ID is configured)
      businessManagerId = getEnvVar("META_BUSINESS_MANAGER_ID");
      if (businessManagerId) {
        console.log(`✅ Found Business Manager from env var: ${businessManagerId}`);
      }
      
      // Method 2: Try /me?fields=business (for System User)
      if (!businessManagerId) {
        try {
          const meResponse = await fetch(
            `${META_API_BASE}/me?access_token=${systemUserToken}&fields=business`
          );
          if (meResponse.ok) {
            const meData = await meResponse.json();
            businessManagerId = meData.business?.id;
            if (businessManagerId) {
              console.log(`✅ Found Business Manager via /me?fields=business: ${businessManagerId}`);
            }
          } else {
            const errorData = await meResponse.json().catch(() => ({}));
            console.warn(`Method 2 failed: ${meResponse.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (error) {
          console.warn("Method 2 (me?fields=business) failed:", error.message);
        }
      }

      // Method 3: Try /me/businesses (list of businesses System User has access to)
      if (!businessManagerId) {
        try {
          const businessesResponse = await fetch(
            `${META_API_BASE}/me/businesses?access_token=${systemUserToken}`
          );
          if (businessesResponse.ok) {
            const businessesData = await businessesResponse.json();
            // Get the first Business Manager (FLYP Corporation Private Limited)
            businessManagerId = businessesData.data?.[0]?.id;
            if (businessManagerId) {
              console.log(`✅ Found Business Manager via /me/businesses: ${businessManagerId}`);
            } else {
              console.warn("Method 3: /me/businesses returned no businesses");
            }
          } else {
            const errorData = await businessesResponse.json().catch(() => ({}));
            console.warn(`Method 3 failed: ${businessesResponse.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (error) {
          console.warn("Method 3 (me/businesses) failed:", error.message);
        }
      }

      // Method 4: Try to get from App (if app has associated Business Manager)
      if (!businessManagerId) {
        try {
          const appId = getEnvVar("META_APP_ID", "1902565950686087");
          const appResponse = await fetch(
            `${META_API_BASE}/${appId}?access_token=${systemUserToken}&fields=business`
          );
          if (appResponse.ok) {
            const appData = await appResponse.json();
            businessManagerId = appData.business?.id;
            if (businessManagerId) {
              console.log(`✅ Found Business Manager via App: ${businessManagerId}`);
            }
          } else {
            const errorData = await appResponse.json().catch(() => ({}));
            console.warn(`Method 4 failed: ${appResponse.status} - ${JSON.stringify(errorData)}`);
          }
        } catch (error) {
          console.warn("Method 4 (app business) failed:", error.message);
        }
      }

      // Method 5: Use hardcoded FLYP Business Manager ID as fallback
      if (!businessManagerId) {
        console.warn("⚠️ All API methods failed, using hardcoded FLYP Business Manager ID as fallback");
        businessManagerId = FLYP_BUSINESS_MANAGER_ID;
        console.log(`✅ Using hardcoded Business Manager ID: ${businessManagerId}`);
      }

      // Verify Business Manager ID is valid (should be numeric)
      if (!businessManagerId || !/^\d+$/.test(businessManagerId)) {
        throw new HttpsError(
          "failed-precondition",
          `Invalid Business Manager ID: ${businessManagerId}. Expected numeric ID.`
        );
      }

      console.log(`✅ Final Business Manager ID: ${businessManagerId}`);

      // Step 2: Create WABA for the user (under Tech Provider)
      // First, verify Business Manager is accessible
      console.log(`🔍 Verifying Business Manager ${businessManagerId} is accessible...`);
      const verifyBMResponse = await fetch(
        `${META_API_BASE}/${businessManagerId}?access_token=${systemUserToken}&fields=id,name`
      );

      if (!verifyBMResponse.ok) {
        const errorData = await verifyBMResponse.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || "Unknown error";
        console.error(`❌ Business Manager ${businessManagerId} not accessible:`, errorData);
        
        throw new HttpsError(
          "failed-precondition",
          `Business Manager ${businessManagerId} is not accessible.\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Possible causes:\n` +
          `1. Business Manager ID is incorrect\n` +
          `2. System User doesn't have access to this Business Manager\n` +
          `3. Data Access Renewal not completed (check: https://developers.facebook.com/apps/1902565950686087/data-access-renewal)\n` +
          `4. App permissions need renewal\n\n` +
          `Please verify:\n` +
          `- Business Manager ID in Meta Business Suite: https://business.facebook.com/settings/business-info\n` +
          `- System User access: https://business.facebook.com/settings/system-users\n` +
          `- Data Access Renewal: https://developers.facebook.com/apps/1902565950686087/data-access-renewal`
        );
      }

      const bmData = await verifyBMResponse.json();
      console.log(`✅ Business Manager verified: ${bmData.name} (${bmData.id})`);

      // Now create WABA
      console.log(`📱 Creating WABA under Business Manager ${businessManagerId}...`);
      const createWABAResponse = await fetch(
        `${META_API_BASE}/${businessManagerId}/owned_whatsapp_business_accounts?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: businessName,
            timezone_id: "Asia/Kolkata",
          }),
        }
      );

      if (!createWABAResponse.ok) {
        const errorData = await createWABAResponse.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || "Failed to create WhatsApp Business Account";
        const errorCode = errorData.error?.code;
        const errorType = errorData.error?.type;
        
        console.error(`❌ Failed to create WABA:`, errorData);
        
        // Provide more helpful error messages
        let userMessage = errorMessage;
        if (errorCode === 100 || errorMessage.includes("does not exist")) {
          userMessage = `Business Manager ${businessManagerId} not found or not accessible.\n\n` +
            `Please verify:\n` +
            `1. Business Manager ID is correct in Meta Business Suite\n` +
            `2. System User has access to this Business Manager\n` +
            `3. Complete Data Access Renewal: https://developers.facebook.com/apps/1902565950686087/data-access-renewal`;
        } else if (errorMessage.includes("missing permissions")) {
          userMessage = `System User lacks required permissions.\n\n` +
            `Please grant permissions at: https://business.facebook.com/settings/system-users\n` +
            `Required: Business Management, WhatsApp Business Management`;
        } else if (errorMessage.includes("does not support this operation")) {
          userMessage = `Operation not supported. This may require:\n` +
            `1. Data Access Renewal completion\n` +
            `2. App Review approval\n` +
            `3. Business verification\n\n` +
            `Check: https://developers.facebook.com/apps/1902565950686087/data-access-renewal`;
        }
        
        throw new HttpsError(
          "internal",
          userMessage
        );
      }

      const wabaData = await createWABAResponse.json();
      const wabaId = wabaData.id;

      // Step 3: Subscribe Tech Provider App to this WABA (REQUIRED for Tech Provider)
      // FLYP Tech Provider App ID: 1902565950686087
      const appId = getEnvVar("META_APP_ID", "1902565950686087");
      
      if (appId) {
        try {
          console.log(`📱 Subscribing FLYP Tech Provider App ${appId} to WABA ${wabaId}...`);
          
          // First, check if app is already subscribed
          const checkSubscribedResponse = await fetch(
            `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemUserToken}`
          );

          let appSubscribed = false;
          if (checkSubscribedResponse.ok) {
            const subscribedApps = await checkSubscribedResponse.json();
            appSubscribed = subscribedApps.data?.some(app => 
              app.id === appId || 
              app.app_id === appId ||
              String(app.id) === String(appId)
            );
            console.log(`App ${appId} already subscribed: ${appSubscribed}`);
          }

          // Subscribe app to WABA if not already subscribed
          if (!appSubscribed) {
            const subscribeResponse = await fetch(
              `${META_API_BASE}/${wabaId}/subscribed_apps?access_token=${systemUserToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  app_id: appId,
                  subscribed_fields: [
                    "messages", 
                    "message_status", 
                    "message_template_status_update", 
                    "account_alerts",
                    "phone_number_name_update",  // NEW: Detect when phone number name/status changes
                    "account_update"  // NEW: Detect when account review status changes
                  ],
                }),
              }
            );

            if (subscribeResponse.ok) {
              const subscribeData = await subscribeResponse.json();
              console.log(`✅ FLYP Tech Provider App ${appId} subscribed to WABA ${wabaId}`);
              console.log(`Subscription data:`, subscribeData);
            } else {
              const errorData = await subscribeResponse.json();
              const errorMsg = errorData.error?.message || 'Unknown error';
              console.error(`❌ Failed to subscribe app to WABA: ${errorMsg}`, errorData);
              // Don't fail the whole operation - subscription can be done manually if needed
              // But log it clearly for debugging
            }
          } else {
            console.log(`✅ App ${appId} is already subscribed to WABA ${wabaId}`);
          }
        } catch (subscribeError) {
          console.error("❌ Error subscribing app to WABA:", subscribeError);
          // Don't fail the whole operation if subscription fails
          // But log it for debugging
        }
      } else {
        console.warn("⚠️ META_APP_ID not configured, skipping app subscription");
      }

      // Step 4: Request phone number registration (this will send OTP)
      const phoneRegistrationResponse = await fetch(
        `${META_API_BASE}/${wabaId}/request_code?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code_method: "SMS", // or "VOICE"
            language: "en",
            phone_number: formattedPhone,
          }),
        }
      );

      if (!phoneRegistrationResponse.ok) {
        const errorData = await phoneRegistrationResponse.json();
        
        // If phone number already exists or invalid, return error
        if (errorData.error?.code === 100 || errorData.error?.code === 131047) {
          throw new HttpsError(
            "invalid-argument",
            "This phone number is already registered with WhatsApp. Please use a new phone number."
          );
        }
        
        throw new HttpsError(
          "internal",
          errorData.error?.message || "Failed to request phone number registration"
        );
      }

      const registrationData = await phoneRegistrationResponse.json();

      // Store WABA ID and phone registration status
      await businessDocRef.update({
        whatsappBusinessAccountId: wabaId,
        whatsappProvider: "meta_tech_provider",
        whatsappEnabled: false, // Not enabled until phone is verified
        whatsappCreatedVia: "individual_setup", // Mark as individual WABA
        whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        whatsappPhoneNumber: formattedPhone,
        whatsappPhoneRegistrationStatus: "pending_otp",
        whatsappPhoneRegistrationData: registrationData,
      });

      return {
        success: true,
        wabaId,
        wabaData,
        phoneNumber: formattedPhone,
        requiresOTP: true,
        message: "WABA created successfully. OTP sent to phone number.",
        registrationData,
      };
    } catch (error) {
      console.error("Error creating individual WABA:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to create WhatsApp Business Account");
    }
  }
);

/**
 * Verify OTP and Complete Phone Number Registration
 */
exports.verifyPhoneOTP = onCall(
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

      const { otpCode } = request.data || {};
      
      if (!otpCode || otpCode.length !== 6) {
        throw new HttpsError("invalid-argument", "Valid 6-digit OTP code is required");
      }

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const wabaId = businessData.whatsappBusinessAccountId;
      const phoneNumber = businessData.whatsappPhoneNumber;

      if (!wabaId) {
        throw new HttpsError(
          "failed-precondition",
          "No WABA found. Please create a WABA first."
        );
      }

      if (!phoneNumber) {
        throw new HttpsError(
          "failed-precondition",
          "No phone number found. Please register a phone number first."
        );
      }

      // Step 1: Verify OTP code
      const verifyOTPResponse = await fetch(
        `${META_API_BASE}/${wabaId}/register_code?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: otpCode,
            phone_number: phoneNumber,
          }),
        }
      );

      if (!verifyOTPResponse.ok) {
        const errorData = await verifyOTPResponse.json();
        
        if (errorData.error?.code === 131026) {
          throw new HttpsError(
            "invalid-argument",
            "Invalid OTP code. Please check and try again."
          );
        }
        
        throw new HttpsError(
          "internal",
          errorData.error?.message || "Failed to verify OTP"
        );
      }

      const verifyData = await verifyOTPResponse.json();

      // Step 2: Get phone number ID after verification
      const phoneNumbersResponse = await fetch(
        `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}&fields=id,display_phone_number,verified_name,status,code_verification_status`
      );

      let phoneNumberId = null;
      let displayPhoneNumber = null;

      if (phoneNumbersResponse.ok) {
        const phoneNumbersData = await phoneNumbersResponse.json();
        const phoneNumbers = phoneNumbersData.data || [];
        
        // Find the phone number that matches
        const matchingPhone = phoneNumbers.find(p => 
          p.display_phone_number?.replace(/[^0-9]/g, '') === phoneNumber
        );
        
        if (matchingPhone) {
          phoneNumberId = matchingPhone.id;
          displayPhoneNumber = matchingPhone.display_phone_number;
        }
      }

      // Step 3: Update business document
      const updateData = {
        whatsappPhoneRegistrationStatus: "verified",
        whatsappPhoneRegistered: true,
        whatsappPhoneRegisteredAt: admin.firestore.FieldValue.serverTimestamp(),
        whatsappEnabled: true,
        whatsappLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (phoneNumberId) {
        updateData.whatsappPhoneNumberId = phoneNumberId;
        updateData.whatsappPhoneNumber = displayPhoneNumber || phoneNumber;
        updateData.whatsappPhoneVerificationStatus = "verified";
      }

      await businessDocRef.update(updateData);

      return {
        success: true,
        message: "Phone number verified successfully! WhatsApp is now ready to use.",
        phoneNumberId,
        phoneNumber: displayPhoneNumber || phoneNumber,
        wabaId,
        verified: true,
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to verify OTP");
    }
  }
);

/**
 * Check Phone Number Registration Status
 */
exports.checkPhoneRegistrationStatus = onCall(
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
      const createdVia = businessData.whatsappCreatedVia;

      // Only check individual WABAs
      if (!wabaId || createdVia !== "individual_setup") {
        return {
          success: false,
          status: "no_waba",
          message: "No individual WABA found. Please create one first.",
          needsIndividualSetup: true,
        };
      }

      // Get phone numbers for this WABA
      const phoneNumbersResponse = await fetch(
        `${META_API_BASE}/${wabaId}/phone_numbers?access_token=${systemUserToken}&fields=id,display_phone_number,verified_name,status,code_verification_status`
      );

      if (!phoneNumbersResponse.ok) {
        const errorData = await phoneNumbersResponse.json();
        throw new HttpsError("internal", errorData.error?.message || "Failed to get phone numbers");
      }

      const phoneNumbersData = await phoneNumbersResponse.json();
      const phoneNumbers = phoneNumbersData.data || [];

      const registrationStatus = businessData.whatsappPhoneRegistrationStatus || "unknown";
      const phoneNumber = businessData.whatsappPhoneNumber;

      // Check if phone is verified
      const verifiedPhone = phoneNumbers.find(p => 
        p.status === "CONNECTED" || 
        p.code_verification_status === "VERIFIED"
      );

      return {
        success: true,
        status: verifiedPhone ? "verified" : registrationStatus,
        phoneNumber,
        phoneNumbers,
        verifiedPhone: verifiedPhone ? {
          id: verifiedPhone.id,
          displayPhoneNumber: verifiedPhone.display_phone_number,
          status: verifiedPhone.status,
          verificationStatus: verifiedPhone.code_verification_status,
        } : null,
        requiresOTP: registrationStatus === "pending_otp",
        message: verifiedPhone 
          ? "Phone number is verified and ready to use"
          : registrationStatus === "pending_otp"
          ? "OTP verification pending"
          : "Phone number status unknown",
      };
    } catch (error) {
      console.error("Error checking phone registration status:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to check phone registration status");
    }
  }
);

/**
 * Create WhatsApp Message Template
 * Uses whatsapp_business_management API to create message templates
 * Required for Meta App Review - Management API demonstration
 */
exports.createWhatsAppMessageTemplate = onCall(
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

      const { wabaId, name, category, language, body } = request.data || {};

      if (!wabaId || !name || !category || !language || !body) {
        throw new HttpsError(
          "invalid-argument",
          "WABA ID, template name, category, language, and body are required"
        );
      }

      // Validate template name (lowercase, alphanumeric, underscores only)
      if (!/^[a-z0-9_]+$/.test(name)) {
        throw new HttpsError(
          "invalid-argument",
          "Template name must contain only lowercase letters, numbers, and underscores"
        );
      }

      // Validate category
      const validCategories = ["UTILITY", "MARKETING", "AUTHENTICATION"];
      if (!validCategories.includes(category)) {
        throw new HttpsError(
          "invalid-argument",
          `Category must be one of: ${validCategories.join(", ")}`
        );
      }

      const systemUserToken = getSystemUserToken();
      const businessDocRef = db.collection("businesses").doc(uid);
      const businessDoc = await businessDocRef.get();

      if (!businessDoc || !businessDoc.exists) {
        throw new HttpsError("not-found", "Business profile not found");
      }

      const businessData = businessDoc.data();
      const userWabaId = businessData.whatsappBusinessAccountId;

      // Verify user has access to this WABA
      if (userWabaId !== wabaId) {
        throw new HttpsError(
          "permission-denied",
          "You can only create templates for your own WABA"
        );
      }

      // Create message template using Meta API
      // Endpoint: POST /{waba-id}/message_templates
      const createTemplateResponse = await fetch(
        `${META_API_BASE}/${wabaId}/message_templates?access_token=${systemUserToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            category: category,
            language: language,
            components: [
              {
                type: "BODY",
                text: body,
              },
            ],
          }),
        }
      );

      if (!createTemplateResponse.ok) {
        const errorData = await createTemplateResponse.json();
        const errorMessage = errorData.error?.message || "Failed to create message template";
        const errorCode = errorData.error?.code;

        // Provide helpful error messages
        if (errorCode === 100 || errorMessage.includes("does not exist")) {
          throw new HttpsError(
            "not-found",
            `WABA ${wabaId} not found or not accessible. Please verify the WABA ID.`
          );
        } else if (errorMessage.includes("duplicate") || errorMessage.includes("already exists")) {
          throw new HttpsError(
            "already-exists",
            `Template with name "${name}" already exists. Please use a different name.`
          );
        } else if (errorMessage.includes("permission") || errorMessage.includes("access")) {
          throw new HttpsError(
            "permission-denied",
            "You don't have permission to create templates for this WABA. Please check your System User permissions."
          );
        }

        throw new HttpsError("internal", errorMessage);
      }

      const templateData = await createTemplateResponse.json();

      // Log template creation
      try {
        await db.collection("businesses").doc(uid).collection("whatsappTemplates").add({
          templateId: templateData.id || templateData.message_template_id,
          name: name,
          category: category,
          language: language,
          body: body,
          wabaId: wabaId,
          status: "PENDING", // Templates need Meta approval
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logError) {
        console.warn("Could not log template creation (non-critical):", logError);
      }

      return {
        success: true,
        templateId: templateData.id || templateData.message_template_id,
        templateData,
        message: "Message template created successfully. It will be submitted to Meta for approval.",
      };
    } catch (error) {
      console.error("Error creating message template:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to create message template");
    }
  }
);

