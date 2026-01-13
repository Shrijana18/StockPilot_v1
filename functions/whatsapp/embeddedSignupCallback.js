/**
 * Meta Embedded Signup Callback Handler
 * Handles redirect from Meta Embedded Signup after account creation
 * 
 * Meta redirects here with query params:
 * - waba_id: WhatsApp Business Account ID
 * - phone_number_id: Phone Number ID
 * - phone_number: Display phone number
 * - business_id: Meta Business Manager ID
 * - access_token: Short-lived access token (optional)
 * - code: OAuth code (optional)
 * - state: Session state (for user identification)
 */

const { onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper to get env vars
function getEnvVar(name, defaultValue = null) {
  return process.env[name] || defaultValue;
}

/**
 * Embedded Signup Callback Handler
 * Receives WABA data from Meta and saves to Firestore
 */
exports.whatsappEmbeddedSignupCallback = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        // Log ALL incoming requests for debugging
        console.log('📥 Embedded Signup Callback called:', {
          method: req.method,
          query: req.query,
          url: req.url,
          headers: {
            origin: req.headers.origin,
            referer: req.headers.referer,
          }
        });

        // Extract query parameters from Meta's redirect
        const {
          waba_id,
          phone_number_id,
          phone_number,
          business_id,
          access_token,
          code,
          state,
          error,
          error_reason,
          error_description
        } = req.query;

        // Handle errors from Meta
        if (error) {
          console.error("Meta Embedded Signup error:", error, error_reason, error_description);
          const errorUrl = `/whatsapp/connect/error?reason=${encodeURIComponent(error_reason || error)}`;
          return res.redirect(errorUrl);
        }

        // Validate required parameters
        if (!waba_id) {
          console.error("Missing waba_id in callback");
          return res.redirect("/whatsapp/connect/error?reason=missing_waba_id");
        }

        // Get user ID from state (if provided) or try to get from session
        let uid = null;
        if (state) {
          try {
            // State might contain user ID or session ID
            // Try to get from session if state is a session ID
            const sessionDoc = await db.collection("whatsappOAuthSessions").doc(state).get();
            if (sessionDoc.exists) {
              uid = sessionDoc.data().uid;
              // Clean up session after use
              await sessionDoc.ref.delete();
            } else {
              // State might be the user ID directly (for embedded signup)
              // Validate it's a valid Firebase UID format
              if (state.length >= 20 && /^[a-zA-Z0-9]+$/.test(state)) {
                uid = state;
              }
            }
          } catch (err) {
            console.warn("Could not get user from state:", err);
          }
        }

        // If no user ID, try to find user by matching business name or email from WABA
        // This is a fallback for when state is not provided
        if (!uid && waba_id) {
          try {
            console.log("No user ID in state, attempting to match WABA to user...");
            // Get WABA name from Meta API (requires system user token)
            // For now, we'll store the WABA and let the frontend detectNewWABA function handle it
            // Store in a temporary collection for later matching
            await db.collection("pendingWABAs").doc(waba_id).set({
              waba_id,
              phone_number_id: phone_number_id || null,
              phone_number: phone_number || null,
              business_id: business_id || null,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              callback_data: req.query,
            });
            console.log(`Stored pending WABA ${waba_id} for later matching`);
            
            // Redirect to a page that will prompt user to verify their account
            return res.redirect(`/whatsapp/connect/success?waba_id=${waba_id}&pending=true&message=Account created! Please verify your account.`);
          } catch (err) {
            console.error("Error storing pending WABA:", err);
          }
        }

        // If still no user ID, redirect to error with instructions
        if (!uid) {
          console.error("No user ID found. User must be logged in.");
          return res.redirect("/whatsapp/connect/error?reason=user_not_logged_in&message=Please log in and try connecting again.");
        }

        // Verify user exists
        const businessDoc = await db.collection("businesses").doc(uid).get();
        if (!businessDoc.exists) {
          console.error("Business document not found for user:", uid);
          return res.redirect("/whatsapp/connect/error?reason=business_not_found");
        }

        // Prepare WABA data
        const wabaData = {
          whatsappBusinessAccountId: waba_id,
          whatsappPhoneNumberId: phone_number_id || null,
          whatsappPhoneNumber: phone_number || null,
          whatsappProvider: "meta_tech_provider",
          whatsappEnabled: true,
          whatsappCreatedVia: "embedded_signup",
          whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          whatsappPhoneRegistered: phone_number_id ? true : false,
          whatsappPhoneVerificationStatus: phone_number_id ? "pending" : "not_registered",
          whatsappVerified: false,
          whatsappAccountReviewStatus: "PENDING", // Will be updated by webhook
          embeddedSignupData: {
            business_id: business_id || null,
            access_token: access_token || null,
            code: code || null,
            received_at: new Date().toISOString(),
          },
          ...(access_token && { whatsappAccessToken: access_token }),
          ...(business_id && { metaBusinessId: business_id }),
        };

        // Save to Firestore
        await db.collection("businesses").doc(uid).update(wabaData);

        console.log(`✅ WABA ${waba_id} saved for user ${uid} via embedded signup callback`);

        // Automatically setup webhook after embedded signup
        // This ensures webhook is configured immediately after WABA creation
        try {
          const { setupWebhookForWABA } = require("./techProvider");
          await setupWebhookForWABA(uid, waba_id);
          console.log(`✅ Webhook automatically configured for WABA ${waba_id}`);
        } catch (webhookError) {
          // Log error but don't fail the callback - webhook can be set up manually later
          console.warn(`⚠️ Failed to automatically setup webhook: ${webhookError.message}`);
          console.warn("User can manually setup webhook via setupWebhookForClient function");
        }

        // Redirect to success page
        const returnUrl = `/distributor-dashboard?tab=profile&section=whatsapp`;
        const successUrl = `/whatsapp/connect/success?waba_id=${waba_id}&returnUrl=${encodeURIComponent(returnUrl)}`;
        
        return res.redirect(successUrl);
      } catch (error) {
        console.error("Error in embedded signup callback:", error);
        return res.redirect(`/whatsapp/connect/error?reason=${encodeURIComponent(error.message || "server_error")}`);
      }
    });
  }
);
