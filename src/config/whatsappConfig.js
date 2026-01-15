// Centralized WhatsApp/Meta configuration for frontend
export const META_APP_ID = "1902565950686087";
export const META_EMBEDDED_SIGNUP_CONFIG_ID = "844028501834041";
export const WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI =
  "https://us-central1-stockpilotv1.cloudfunctions.net/whatsappEmbeddedSignupCallback";
export const WHATSAPP_WEBHOOK_VERIFY_TOKEN = "flyp_tech_provider_webhook_token";

export const EMBEDDED_SIGNUP_URL = `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${META_APP_ID}&config_id=${META_EMBEDDED_SIGNUP_CONFIG_ID}&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D`;
