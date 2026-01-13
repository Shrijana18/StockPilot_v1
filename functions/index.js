// ============================
// FLYP Cloud Functions Entry
// Modular, Clean, and Production-Ready
// ============================

// Load .env only for local development (emulator)
// In production, use Firebase Secrets instead
// NOTE: .env file should NOT contain META_SYSTEM_USER_TOKEN or META_APP_SECRET
// These are loaded from Firebase Secrets in production
if (process.env.FUNCTIONS_EMULATOR) {
  require("dotenv").config();
}

const admin = require("firebase-admin");
const { setGlobalOptions } = require("firebase-functions/v2");

if (!admin.apps || admin.apps.length === 0) { try { admin.initializeApp(); } catch (_) {} }
setGlobalOptions({
  region: "us-central1",
  memory: "1GiB",
  timeoutSeconds: 60,
});

// ============================
// Function Exports
// ============================

// Billing / Inventory / AI Modules
exports.generateInventoryByBrand = require("./inventory/generateInventoryByBrand");
exports.identifyProductFromImage = require("./inventory/identifyProductFromImage");
exports.identifyProductsFromImage = require("./inventory/identifyProductsFromImage");
exports.lookupBarcode = require("./inventory/lookupBarcode");
exports.generateHSNAndGST = require("./billing/generateHSNAndGST");
exports.parseInvoiceFile = require("./billing/parseInvoiceFile");

// Employee Management
exports.createEmployee = require("./employees/createEmployee");
const { employeeLogin } = require("./employees/employeeLogin");
exports.employeeLogin = employeeLogin;
const { resetPin } = require("./employees/resetEmployeePin");
exports.resetPin = resetPin;
exports.resetDistributorEmployeePin = require("./employees/resetDistributorEmployeePin");
exports.distributorEmployeeLogin = require("./employees/distributorEmployeeLogin");
exports.restoreDistributorEmployeeAuth = require("./employees/restoreDistributorEmployeeAuth");
exports.migrateEmployeeIds = require("./employees/migrateEmployeeIds");
exports.createEmployeeSession = require("./employees/createEmployeeSession");
exports.logDistributorActivity = require("./employees/logDistributorActivity");

// Retailer Profile Sync
exports.resyncRetailerProfile = require("./profile/resyncRetailerProfile");
exports.syncRetailerProfileToDistributors = require("./profile/syncRetailerProfileToDistributors");

// OCR / Vision
exports.ocrFromImage = require("./ocr/ocrFromImage");

// Smart Assistant
exports.generateAssistantReply = require("./assistant/generateAssistantReply");

// AI Status and Configuration
exports.aiStatus = require("./ai/aiStatus");

// Retailer Provisioning (Distributor → Retailer)
const { createProvisionalRetailer } = require("./handlers/createProvisionalRetailer");
exports.createProvisionalRetailer = createProvisionalRetailer;
const { claimProvisionalRetailer } = require("./handlers/claimProvisionalRetailer");
exports.claimProvisionalRetailer = claimProvisionalRetailer;

// OTP (MSG91)
const { sendOtp, verifyOtp } = require("./otp/flypotp");
exports.sendOtp = sendOtp;
exports.verifyOtp = verifyOtp;
const { reservePhone } = require("./otp/reservePhone");
exports.reservePhone = reservePhone;
const { checkUniqueness } = require("./otp/checkUniqueness");
exports.checkUniqueness = checkUniqueness;

// Payment Gateway
exports.createMerchantAccount = require("./payment/createMerchantAccount");
exports.generatePaymentLink = require("./payment/generatePaymentLink");

// Location Data (India)
exports.fetchIndiaLocationData = require("./location/fetchIndiaLocationData");

// WhatsApp Business API
exports.whatsappWebhook = require("./whatsapp/webhook");
const whatsappConnect = require("./whatsapp/connect");
exports.whatsappConnectStart = whatsappConnect.whatsappConnectStart;
exports.whatsappConnectCallback = whatsappConnect.whatsappConnectCallback;

// WhatsApp Tech Provider (Embedded Signup Flow)
const whatsappTechProvider = require("./whatsapp/techProvider");
const whatsappEmbeddedSignupCallback = require("./whatsapp/embeddedSignupCallback");
// Embedded Signup Callback (for Meta Embedded Signup redirect)
exports.whatsappEmbeddedSignupCallback = whatsappEmbeddedSignupCallback.whatsappEmbeddedSignupCallback;
// Messaging
exports.sendMessageViaTechProvider = whatsappTechProvider.sendMessageViaTechProvider;
// Webhook & Status (Required for Embedded Signup)
exports.setupWebhookForClient = whatsappTechProvider.setupWebhookForClient;
exports.whatsappTechProviderWebhook = whatsappTechProvider.whatsappTechProviderWebhook;
exports.getWhatsAppSetupStatus = whatsappTechProvider.getWhatsAppSetupStatus;
// WABA Management (for WABA selection and status)
exports.getClientWABA = whatsappTechProvider.getClientWABA;
exports.getWABAStatus = whatsappTechProvider.getWABAStatus;
exports.saveWABADirect = whatsappTechProvider.saveWABADirect;
exports.detectNewWABA = whatsappTechProvider.detectNewWABA;
// Message Template Management (for Meta App Review)
exports.createWhatsAppMessageTemplate = whatsappTechProvider.createWhatsAppMessageTemplate;
// Phone Verification (2FA) for Embedded Signup
exports.verifyPhoneOTP = whatsappTechProvider.verifyPhoneOTP;
exports.checkPhoneRegistrationStatus = whatsappTechProvider.checkPhoneRegistrationStatus;
// Note: Other flow functions (createClientWABA, createIndividualWABA, requestPhoneNumber) 
// available but not exported - use Embedded Signup instead

// ============================
// Utility Modules (Internal use)
// ============================
exports.aiClient = require("./shared/aiClient");
exports.auth = require("./shared/auth");
exports.constants = require("./shared/constants");
exports.firestore = require("./shared/firestore");
exports.utils = require("./shared/utils");

// ============================
// AI Modules (New Hybrid System)
// ============================
exports.geminiClient = require("./shared/geminiClient");
exports.hybridAI = require("./shared/hybridAI");
exports.aiConfig = require("./shared/aiConfig");

// ============================
// Notes
// - All functions now load from modular files
// - index.js acts only as the unified export surface
// - Safe to remove all old inline logic
// ============================