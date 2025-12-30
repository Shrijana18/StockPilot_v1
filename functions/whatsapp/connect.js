/**
 * WhatsApp Business API OAuth Connection
 * Handles OAuth flow: Start → Callback → Store Credentials
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

/**
 * Start OAuth Flow
 * Generates Meta OAuth URL and redirects user
 */
exports.whatsappConnectStart = onCall(
  {
    region: "us-central1",
    cors: true,
    memory: "128MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const uid = request.auth?.uid;
      if (!uid) {
        throw new HttpsError("unauthenticated", "You must be signed in to connect WhatsApp Business API.");
      }

      // Get environment variables (from process.env or Firebase config)
      const META_APP_ID = getEnvVar("META_APP_ID");
      const META_APP_SECRET = getEnvVar("META_APP_SECRET");
      const BASE_URL = getEnvVar("BASE_URL", "https://stockpilotv1.web.app");

      if (!META_APP_ID || !META_APP_SECRET) {
        throw new HttpsError("failed-precondition", "Meta App credentials not configured. Please set META_APP_ID and META_APP_SECRET environment variables.");
      }

      // Generate session ID for state validation
      const sessionId = db.collection("_temp").doc().id;
      const returnUrl = request.data?.returnUrl || `${BASE_URL}/distributor-dashboard?tab=profile&section=whatsapp`;

      // Store session in Firestore (expires in 10 minutes)
      await db.collection("whatsappOAuthSessions").doc(sessionId).set({
        uid,
        distributorId: request.data?.distributorId || uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        returnUrl,
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        ),
      });

      // Build OAuth URL
      const redirectUri = `${BASE_URL}/whatsapp/connect/callback`;
      const oauthUrl =
        `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${META_APP_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=whatsapp_business_management,whatsapp_business_messaging,business_management&` +
        `state=${sessionId}&` +
        `response_type=code`;

      return {
        success: true,
        redirectUrl: oauthUrl,
        sessionId,
      };
    } catch (error) {
      console.error("Error starting WhatsApp OAuth:", error);
      // If it's already an HttpsError, re-throw it
      if (error instanceof HttpsError) {
        throw error;
      }
      // Otherwise, wrap it in an HttpsError
      throw new HttpsError("internal", error.message || "Failed to start WhatsApp connection");
    }
  }
);

/**
 * OAuth Callback Handler
 * Exchanges code for token, fetches WABA and Phone Number ID
 */
exports.whatsappConnectCallback = onRequest(
  {
    region: "us-central1",
    memory: "128MiB",
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 1,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).send("");
    }

    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");

    cors(req, res, async () => {
      try {
        const { code, state, error, error_reason } = req.query;

        // Handle OAuth errors
        if (error) {
          console.error("OAuth error:", error, error_reason);
          return res.redirect(
            `/whatsapp/connect/error?reason=${encodeURIComponent(error_reason || error)}`
          );
        }

        if (!code || !state) {
          return res.redirect(
            `/whatsapp/connect/error?reason=missing_params`
          );
        }

        // Get and validate session
        const sessionDoc = await db
          .collection("whatsappOAuthSessions")
          .doc(state)
          .get();

        if (!sessionDoc.exists) {
          return res.redirect(
            `/whatsapp/connect/error?reason=invalid_session`
          );
        }

        const session = sessionDoc.data();
        const uid = session.uid || session.distributorId;

        // Check session expiry
        const expiresAt = session.expiresAt?.toDate();
        if (expiresAt && expiresAt < new Date()) {
          await sessionDoc.ref.delete();
          return res.redirect(
            `/whatsapp/connect/error?reason=session_expired`
          );
        }

        // Get environment variables (from process.env or Firebase config)
        const META_APP_ID = getEnvVar("META_APP_ID");
        const META_APP_SECRET = getEnvVar("META_APP_SECRET");
        const BASE_URL = getEnvVar("BASE_URL", "https://stockpilotv1.web.app");
        const redirectUri = `${BASE_URL}/whatsapp/connect/callback`;

        // Step 1: Exchange code for short-lived access token
        const tokenResponse = await fetch(
          "https://graph.facebook.com/v18.0/oauth/access_token",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: META_APP_ID,
              client_secret: META_APP_SECRET,
              redirect_uri: redirectUri,
              code,
            }),
          }
        );

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error?.message || "Failed to exchange code for token");
        }

        const tokenData = await tokenResponse.json();
        const shortLivedToken = tokenData.access_token;

        // Step 2: Exchange for long-lived token (60 days)
        const longLivedResponse = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${META_APP_ID}&` +
            `client_secret=${META_APP_SECRET}&` +
            `fb_exchange_token=${shortLivedToken}`
        );

        if (!longLivedResponse.ok) {
          const errorData = await longLivedResponse.json();
          throw new Error(errorData.error?.message || "Failed to get long-lived token");
        }

        const longLivedData = await longLivedResponse.json();
        const longLivedToken = longLivedData.access_token;
        const expiresIn = longLivedData.expires_in || 5184000; // 60 days default

        // Step 3: Get user's businesses (WABA) - Auto-create if needed
        let businessAccountId;
        
        // First, try to get existing businesses
        const businessesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/businesses?access_token=${longLivedToken}`
        );

        if (!businessesResponse.ok) {
          const errorData = await businessesResponse.json();
          throw new Error(errorData.error?.message || "Failed to fetch businesses");
        }

        const businessesData = await businessesResponse.json();
        businessAccountId = businessesData.data?.[0]?.id;

        // If no WABA exists, try to create one automatically
        if (!businessAccountId) {
          console.log("No WABA found, attempting to create one...");
          
          // Get user's business info from profile
          const businessDoc = await db.collection("businesses").doc(uid).get();
          const profileData = businessDoc.exists() ? businessDoc.data() : {};
          
          // Get Meta Business Manager ID (required for WABA creation)
          const businessManagerResponse = await fetch(
            `https://graph.facebook.com/v18.0/me?fields=business&access_token=${longLivedToken}`
          );
          
          let businessManagerId = null;
          if (businessManagerResponse.ok) {
            const businessManagerData = await businessManagerResponse.json();
            businessManagerId = businessManagerData.business?.id;
          }
          
          // If we have a business manager, try to create WABA
          if (businessManagerId) {
            try {
              const createWABAResponse = await fetch(
                `https://graph.facebook.com/v18.0/${businessManagerId}/owned_whatsapp_business_accounts?access_token=${longLivedToken}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: profileData.businessName || profileData.ownerName || "My Business",
                  }),
                }
              );
              
              if (createWABAResponse.ok) {
                const createWABAData = await createWABAResponse.json();
                businessAccountId = createWABAData.id;
                console.log("Successfully created WABA:", businessAccountId);
              } else {
                const errorData = await createWABAResponse.json();
                console.warn("Could not auto-create WABA:", errorData);
                // Continue with manual creation message
              }
            } catch (createError) {
              console.warn("Error creating WABA:", createError);
              // Continue with manual creation message
            }
          }
          
          // If still no WABA, provide helpful error
          if (!businessAccountId) {
            throw new Error(
              "No WhatsApp Business Account found. " +
              "Please create one in Meta Business Suite: https://business.facebook.com/latest/whatsapp_manager " +
              "or contact support for assistance."
            );
          }
        }

        // Step 4: Get phone numbers for this WABA - Auto-setup if needed
        let phoneNumberId;
        
        const phoneNumbersResponse = await fetch(
          `https://graph.facebook.com/v18.0/${businessAccountId}/phone_numbers?access_token=${longLivedToken}`
        );

        if (!phoneNumbersResponse.ok) {
          const errorData = await phoneNumbersResponse.json();
          throw new Error(errorData.error?.message || "Failed to fetch phone numbers");
        }

        const phoneNumbersData = await phoneNumbersResponse.json();
        phoneNumberId = phoneNumbersData.data?.[0]?.id;

        // If no phone number, try to get user's phone from profile and request verification
        if (!phoneNumberId) {
          console.log("No phone number found, attempting to add one...");
          
          const businessDoc = await db.collection("businesses").doc(uid).get();
          const profileData = businessDoc.exists() ? businessDoc.data() : {};
          const userPhone = profileData.phone;
          
          if (userPhone) {
            // Format phone number (remove + and spaces)
            const formattedPhone = userPhone.replace(/[^0-9]/g, '');
            
            // Try to request phone number verification
            // Note: This requires the phone number to be verified via SMS/OTP by Meta
            try {
              const requestPhoneResponse = await fetch(
                `https://graph.facebook.com/v18.0/${businessAccountId}/phone_numbers?access_token=${longLivedToken}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    verified_name: profileData.businessName || profileData.ownerName || "My Business",
                    code_verification_status: "UNVERIFIED",
                    display_phone_number: formattedPhone,
                  }),
                }
              );
              
              if (requestPhoneResponse.ok) {
                const requestPhoneData = await requestPhoneResponse.json();
                phoneNumberId = requestPhoneData.id;
                console.log("Phone number verification requested:", phoneNumberId);
                
                // Note: User will need to complete OTP verification via Meta
                // We'll store the phone number ID but mark as unverified
              } else {
                const errorData = await requestPhoneResponse.json();
                console.warn("Could not request phone verification:", errorData);
              }
            } catch (phoneError) {
              console.warn("Error requesting phone verification:", phoneError);
            }
          }
          
          // If still no phone number, provide helpful error
          if (!phoneNumberId) {
            throw new Error(
              "No phone number found in your WhatsApp Business Account. " +
              "Please add a phone number in Meta Business Suite: https://business.facebook.com/latest/whatsapp_manager/phone_numbers " +
              "or contact support for assistance."
            );
          }
        }

        // Step 5: Store credentials securely in Firestore
        const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        
        await db.collection("businesses").doc(uid).update({
          whatsappEnabled: true,
          whatsappProvider: "meta",
          whatsappBusinessAccountId: businessAccountId,
          whatsappPhoneNumberId: phoneNumberId,
          whatsappAccessToken: longLivedToken, // TODO: Consider encryption for production
          whatsappTokenExpiresAt: admin.firestore.Timestamp.fromDate(tokenExpiresAt),
          whatsappVerified: true,
          whatsappLastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          whatsappConnectedVia: "oauth",
          whatsappConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Clean up session
        await sessionDoc.ref.delete();

        // Redirect to success page
        const returnUrl = session.returnUrl || `/distributor-dashboard?tab=profile&section=whatsapp`;
        return res.redirect(
          `/whatsapp/connect/success?session=${state}&returnUrl=${encodeURIComponent(returnUrl)}`
        );
      } catch (error) {
        console.error("OAuth callback error:", error);
        return res.redirect(
          `/whatsapp/connect/error?reason=${encodeURIComponent(error.message || "server_error")}`
        );
      }
    });
  }
);

/**
 * Helper: Get or refresh WhatsApp access token
 * Checks expiry and refreshes if needed
 */
async function getOrRefreshToken(uid) {
  try {
    const businessDoc = await db.collection("businesses").doc(uid).get();
    if (!businessDoc.exists) {
      throw new Error("Business not found");
    }

    const config = businessDoc.data();
    if (!config.whatsappEnabled || config.whatsappProvider !== "meta") {
      throw new Error("WhatsApp API not configured");
    }

    const expiresAt = config.whatsappTokenExpiresAt?.toDate();
    const now = new Date();
    const daysUntilExpiry = expiresAt
      ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
      : 0;

    // If token expires in less than 7 days, refresh it
    if (expiresAt && daysUntilExpiry < 7) {
      const META_APP_ID = getEnvVar("META_APP_ID");
      const META_APP_SECRET = getEnvVar("META_APP_SECRET");

      const refreshResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
          `grant_type=fb_exchange_token&` +
          `client_id=${META_APP_ID}&` +
          `client_secret=${META_APP_SECRET}&` +
          `fb_exchange_token=${config.whatsappAccessToken}`
      );

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newToken = refreshData.access_token;
        const expiresIn = refreshData.expires_in || 5184000;

        const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

        await businessDoc.ref.update({
          whatsappAccessToken: newToken,
          whatsappTokenExpiresAt: admin.firestore.Timestamp.fromDate(newExpiresAt),
        });

        return newToken;
      }
    }

    return config.whatsappAccessToken;
  } catch (error) {
    console.error("Error getting/refreshing token:", error);
    throw error;
  }
}

exports.getOrRefreshToken = getOrRefreshToken;

