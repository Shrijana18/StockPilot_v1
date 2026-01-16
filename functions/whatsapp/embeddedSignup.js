/**
 * Meta Embedded Signup Handler
 * Handles redirect callback from Meta Embedded Signup
 */

const { onRequest } = require("firebase-functions/v2/https");
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
const META_SYSTEM_USER_TOKEN_SECRET = defineSecret("META_SYSTEM_USER_TOKEN");

function getSystemUserToken() {
  try {
    return META_SYSTEM_USER_TOKEN_SECRET.value() || process.env.META_SYSTEM_USER_TOKEN;
  } catch (e) {
    return process.env.META_SYSTEM_USER_TOKEN;
  }
}

async function fetchWabaFromBusiness(businessId) {
  const systemToken = getSystemUserToken();
  if (!systemToken || !businessId) return null;

  try {
    const wabaResponse = await fetch(
      `${META_API_BASE}/${businessId}/owned_whatsapp_business_accounts?fields=id,name,created_time&access_token=${systemToken}`
    );
    if (!wabaResponse.ok) {
      const error = await wabaResponse.json();
      console.warn("WABA lookup failed:", JSON.stringify(error));
      return null;
    }

    const wabaData = await wabaResponse.json();
    const wabas = wabaData.data || [];
    if (wabas.length === 0) return null;

    const latestWaba = [...wabas].sort((a, b) => {
      if (!a.created_time || !b.created_time) return 0;
      return new Date(b.created_time) - new Date(a.created_time);
    })[0];

    let phoneNumberId = null;
    let phoneNumber = null;

    try {
      const phoneResponse = await fetch(
        `${META_API_BASE}/${latestWaba.id}/phone_numbers?fields=id,display_phone_number,code_verification_status&access_token=${systemToken}`
      );
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json();
        const primaryPhone = phoneData.data?.[0] || null;
        phoneNumberId = primaryPhone?.id || null;
        phoneNumber = primaryPhone?.display_phone_number || null;
      }
    } catch (phoneErr) {
      console.warn("Phone number lookup failed:", phoneErr);
    }

    return {
      wabaId: latestWaba.id,
      phoneNumberId,
      phoneNumber,
    };
  } catch (err) {
    console.warn("Error resolving WABA from business:", err);
    return null;
  }
}

/**
 * Embedded Signup Callback
 * Receives WABA data from Meta and saves to Firestore
 * * UPDATED: Now returns an HTML bridge to communicate with the main window
 * instead of just redirecting.
 */
exports.whatsappEmbeddedSignupCallback = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    cors: true,
    secrets: [META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        console.log("📥 Embedded Signup Callback:", {
          method: req.method,
          query: req.query,
        });

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
          error_description,
        } = req.query;

        // --- ERROR HANDLING ---
        // If Meta returns an error, send an error script to close popup and notify frontend
        if (error) {
          console.error("Meta error:", error, error_reason, error_description);
          const errorMsg = error_reason || error_description || error;
          
          const errorHtml = `
            <!DOCTYPE html>
            <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'WHATSAPP_EMBEDDED_SIGNUP',
                    status: 'ERROR',
                    error: "${errorMsg}"
                  }, "*");
                  window.close();
                } else {
                  window.location.href = '/whatsapp/connect/error?reason=${encodeURIComponent(errorMsg)}';
                }
              </script>
            </body>
            </html>
          `;
          return res.status(400).send(errorHtml);
        }

        let resolvedWabaId = waba_id;
        let resolvedPhoneNumberId = phone_number_id;
        let resolvedPhoneNumber = phone_number;

        if (!resolvedWabaId && business_id) {
          console.warn("Missing waba_id, attempting lookup via business_id");
          const resolved = await fetchWabaFromBusiness(business_id);
          if (resolved?.wabaId) {
            resolvedWabaId = resolved.wabaId;
            resolvedPhoneNumberId = resolved.phoneNumberId || resolvedPhoneNumberId;
            resolvedPhoneNumber = resolved.phoneNumber || resolvedPhoneNumber;
          }
        }

        if (!resolvedWabaId) {
          console.error("Missing waba_id and lookup failed");
          return res.status(400).send("Missing WABA ID");
        }

        // --- SESSION VERIFICATION ---
        // Get user ID from state (session ID)
        let uid = null;
        if (state) {
          try {
            const sessionDoc = await db.collection("whatsappOAuthSessions").doc(state).get();
            if (sessionDoc.exists) {
              uid = sessionDoc.data().uid;
              await sessionDoc.ref.delete(); // Clean up session for security
            }
          } catch (err) {
            console.warn("Could not get user from state:", err);
          }
        }

        if (!uid) {
          console.error("No user ID found or session expired");
          const sessionErrorHtml = `
            <!DOCTYPE html>
            <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'WHATSAPP_EMBEDDED_SIGNUP',
                    status: 'ERROR',
                    error: "Session expired or invalid. Please try again."
                  }, "*");
                  window.close();
                } else {
                  document.body.innerText = "Session expired. Please close this window and try again.";
                }
              </script>
            </body>
            </html>
          `;
          return res.status(400).send(sessionErrorHtml);
        }

        // Verify user business doc exists
        const businessDoc = await db.collection("businesses").doc(uid).get();
        if (!businessDoc.exists) {
           return res.status(404).send("Business profile not found");
        }

        // --- DATA PREPARATION ---
        const wabaData = {
          whatsappBusinessAccountId: resolvedWabaId,
          whatsappPhoneNumberId: resolvedPhoneNumberId || null,
          whatsappPhoneNumber: resolvedPhoneNumber || null,
          whatsappProvider: "meta_tech_provider",
          whatsappEnabled: true,
          whatsappCreatedVia: "embedded_signup",
          whatsappCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          whatsappPhoneRegistered: resolvedPhoneNumberId ? true : false,
          whatsappPhoneVerificationStatus: resolvedPhoneNumberId ? "pending" : "not_registered",
          whatsappVerified: false,
          whatsappAccountReviewStatus: "PENDING",
          embeddedSignupData: {
            business_id: business_id || null,
            access_token: access_token || null,
            code: code || null,
            received_at: new Date().toISOString(),
          },
          whatsappStatusLastChecked: admin.firestore.FieldValue.serverTimestamp(),
          // Only update these if they exist to avoid overwriting with null
          ...(access_token && { whatsappAccessToken: access_token }),
          ...(business_id && { metaBusinessId: business_id }),
        };

        // --- SAVE TO FIRESTORE ---
        await db.collection("businesses").doc(uid).set(wabaData, { merge: true });

        console.log(`✅ WABA ${resolvedWabaId} saved for user ${uid}`);

        // --- SUCCESS RESPONSE (HTML BRIDGE) ---
        // This HTML page sends the data back to the main window and closes itself
        const successHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Connection Successful</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 20px; color: #333; }
              .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 15px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="loader"></div>
            <h3>Connection Successful!</h3>
            <p>Finalizing setup, please wait...</p>
            <script>
              const messageData = {
                type: 'WHATSAPP_EMBEDDED_SIGNUP',
                status: 'SUCCESS',
                waba_id: '${resolvedWabaId}',
                phone_number_id: '${resolvedPhoneNumberId || ""}',
                phone_number: '${resolvedPhoneNumber || ""}',
                access_token: '${access_token || ""}'
              };

              // Send message to the main FLYP Dashboard window
              if (window.opener) {
                console.log("Sending success message to opener...");
                window.opener.postMessage(messageData, "*"); 
                
                // Give a small delay to ensure message sends, then close
                setTimeout(() => {
                  window.close();
                }, 1000);
              } else {
                // Fallback for mobile or direct opens (no opener window)
                window.location.href = '/distributor-dashboard?tab=whatsapp&status=success';
              }
            </script>
          </body>
          </html>
        `;

        return res.status(200).send(successHtml);

      } catch (error) {
        console.error("Error in embedded signup callback:", error);
        
        const catchErrorHtml = `
          <!DOCTYPE html>
          <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'WHATSAPP_EMBEDDED_SIGNUP',
                  status: 'ERROR',
                  error: "Server Error: ${error.message}"
                }, "*");
                window.close();
              } else {
                document.body.innerText = "An internal error occurred. Please try again.";
              }
            </script>
          </body>
          </html>
        `;
        return res.status(500).send(catchErrorHtml);
      }
    });
  }
);