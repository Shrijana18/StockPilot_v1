/**
 * WhatsApp Business Platform - Meta SDK Configuration
 * 
 * FLYP Tech Provider Configuration
 * 
 * This file contains all configuration needed for:
 * 1. Facebook SDK initialization
 * 2. Embedded Signup flow
 * 3. WhatsApp Business API integration
 */

// Meta App Configuration
export const META_APP_ID = "1902565950686087";
export const META_CONFIG_ID = "844028501834041"; // Embedded Signup config ID
export const META_API_VERSION = "v24.0";

// Webhook Configuration
export const WHATSAPP_WEBHOOK_VERIFY_TOKEN = "flyp_tech_provider_webhook_token";

// Cloud Functions URLs
export const CLOUD_FUNCTIONS_BASE = "https://us-central1-stockpilotv1.cloudfunctions.net";
export const WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI = `${CLOUD_FUNCTIONS_BASE}/whatsappEmbeddedSignupCallback`;

/**
 * Facebook SDK Login Configuration for Embedded Signup
 * 
 * Per Meta Documentation:
 * - config_id: Links to your WhatsApp Embedded Signup configuration
 * - response_type: "code" returns auth code for server-side token exchange
 * - override_default_response_type: true ensures we get auth code
 * - extras: Contains session info version for proper WABA data return
 */
export const FB_LOGIN_CONFIG = {
  config_id: META_CONFIG_ID,
  response_type: "code",
  override_default_response_type: true,
  extras: {
    setup: {},
    featureType: "",
    sessionInfoVersion: "3",
  },
};

/**
 * Scopes required for WhatsApp Business Platform
 * 
 * These scopes allow:
 * - whatsapp_business_management: Manage WABA settings
 * - whatsapp_business_messaging: Send/receive messages
 * - business_management: Manage business settings
 */
export const FB_LOGIN_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management",
].join(",");

/**
 * Legacy URL-based Embedded Signup URL (fallback)
 * Only used if FB SDK login fails
 */
export const EMBEDDED_SIGNUP_URL = 
  `https://business.facebook.com/messaging/whatsapp/onboard/` +
  `?app_id=${META_APP_ID}` +
  `&config_id=${META_CONFIG_ID}` +
  `&extras=${encodeURIComponent(JSON.stringify({ sessionInfoVersion: "3", version: "v3" }))}`;

/**
 * Helper function to initialize Facebook SDK
 * Call this early in app lifecycle (e.g., in index.html or App.jsx)
 */
export const initFacebookSDK = () => {
  return new Promise((resolve) => {
    // Check if SDK is already loaded
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    // Wait for SDK to load
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: META_API_VERSION,
      });
      resolve(window.FB);
    };

    // Load SDK if not already loading
    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      js.crossOrigin = "anonymous";
      document.head.appendChild(js);
    }
  });
};

/**
 * Check if Facebook SDK is loaded and ready
 */
export const isFBSDKReady = () => {
  return typeof window.FB !== "undefined" && window.FB.login;
};

/**
 * Embedded Signup event types from Meta SDK
 */
export const EMBEDDED_SIGNUP_EVENTS = {
  FINISH: "FINISH",
  CANCEL: "CANCEL",
  ERROR: "ERROR",
};
