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

      // Step 1: Register phone number with Meta (if phoneNumberId provided)
      // This is crucial for Embedded Signup to "finish" the setup
      let registrationSuccess = false;
      
      if (phoneNumberId) {
        try {
          console.log(`📞 Registering phone ${phoneNumberId}...`);
          
          // UPDATED: Priority logic for PIN
          // 1. Explicit PIN passed from frontend (if user entered it in modal)
          // 2. PIN from embedded data (often missing, but we check anyway)
          const registrationPin = pin || embeddedData?.pin || embeddedData?.registration_pin || embeddedData?.data?.pin;

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
            
            // FIXED: Comprehensive 2FA PIN error detection
            // Meta API error codes for two-step verification:
            // - 136025: Two-step verification PIN is required or incorrect
            // - 100: Generic error that may contain PIN-related message
            // - Error message patterns: "two-step", "2fa", "pin", "verification"
            const errorCode = error.error?.code;
            const errorSubcode = error.error?.error_subcode;
            const errorMessage = (error.error?.message || "").toLowerCase();
            
            const isPinError = 
              errorCode === 136025 ||  // Specific 2FA PIN error code
              errorSubcode === 136025 ||
              errorCode === 100 && (
                errorMessage.includes("two-step") ||
                errorMessage.includes("two step") ||
                errorMessage.includes("2fa") ||
                errorMessage.includes("verification pin") ||
                errorMessage.includes("pin is required") ||
                errorMessage.includes("incorrect pin")
              ) ||
              errorMessage.includes("two-step verification") ||
              errorMessage.includes("two step verification");

            console.log(`📋 PIN Error Check: code=${errorCode}, subcode=${errorSubcode}, isPinError=${isPinError}`);

            if (isPinError) {
              console.log("⚠️ Registration failed due to missing/incorrect 2FA PIN. Asking frontend for PIN.");
              // Return a specific status so frontend can show the PIN modal
              return {
                success: false,
                requirePin: true,
                wabaId,
                phoneNumberId,
                phoneNumber,
                message: "Two-step verification PIN required",
                errorCode: errorCode,
                embeddedData // Pass back so frontend doesn't lose context
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
  
          // Get all WABAs from Meta Business Manager
          const businessesResponse = await fetch(
            `${META_API_BASE}/me/businesses?access_token=${systemToken}`
          );
  
          if (!businessesResponse.ok) {
            return res.status(500).json({ error: "Failed to fetch businesses" });
          }
  
          const businessesData = await businessesResponse.json();
          const allWABAs = [];
  
          // For each business, get WABAs
          for (const business of businessesData.data || []) {
            try {
              const wabasResponse = await fetch(
                `${META_API_BASE}/${business.id}/owned_whatsapp_business_accounts?access_token=${systemToken}`
              );
  
              if (wabasResponse.ok) {
                const wabasData = await wabasResponse.json();
                for (const waba of wabasData.data || []) {
                  allWABAs.push({
                    id: waba.id,
                    name: waba.name,
                    businessId: business.id,
                  });
                }
              }
            } catch (err) {
              console.warn("Error fetching WABAs for business:", err);
            }
          }
  
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
            try {
              const phonesResponse = await fetch(
                `${META_API_BASE}/${targetWABA.id}/phone_numbers?access_token=${systemToken}`
              );
  
              if (phonesResponse.ok) {
                const phonesData = await phonesResponse.json();
                // Get the first verified or pending phone number
                primaryPhone = phonesData.data?.[0] || null;
              }
            } catch (err) {
              console.warn("Error fetching phone numbers:", err);
            }
  
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