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
exports.retailerEmployeeLogin = require("./employees/retailerEmployeeLogin");
exports.restoreRetailerEmployeeAuth = require("./employees/restoreRetailerEmployeeAuth");
exports.restoreDistributorEmployeeAuth = require("./employees/restoreDistributorEmployeeAuth");
exports.migrateEmployeeIds = require("./employees/migrateEmployeeIds");
exports.createEmployeeSession = require("./employees/createEmployeeSession");
exports.logDistributorActivity = require("./employees/logDistributorActivity");

// Retailer Profile Sync
exports.resyncRetailerProfile = require("./profile/resyncRetailerProfile");
exports.syncRetailerProfileToDistributors = require("./profile/syncRetailerProfileToDistributors");

// OCR / Vision (image-only, callable)
exports.ocrFromImage = require("./ocr/ocrFromImage");
// OCR from image or PDF – returns text + parsed products (retailer/distributor inventory)
exports.ocrFromFile = require("./ocr/ocrFromFile");
// AI catalogue parser – Gemini-powered extraction for any catalogue/list (image or PDF)
exports.parseCatalogueWithAI = require("./ocr/parseCatalogueWithAI");

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

// Cashfree Partner (embedded merchant onboarding)
// Single HTTP impl: cashfreeCreateMerchantAndOnboardingLinkHttp. Others are aliases (same handler, no duplication).
const cashfreePartner = require("./cashfree/partnerOnboarding");
exports.cashfreeCreateMerchantAndOnboardingLink = cashfreePartner.cashfreeCreateMerchantAndOnboardingLink;
exports.cashfreeCreateMerchantAndOnboardingLinkHttp = cashfreePartner.cashfreeCreateMerchantAndOnboardingLinkHttp;
exports.cashfreeCreateMerchantAndOnboarding1 = cashfreePartner.cashfreeCreateMerchantAndOnboarding1;
exports.cashfreeCreateMerchantAndOnboarding = cashfreePartner.cashfreeCreateMerchantAndOnboarding;
exports.cashfreeMerchantOnboardingWebhook = cashfreePartner.cashfreeMerchantOnboardingWebhook;

// Location Data (India)
exports.fetchIndiaLocationData = require("./location/fetchIndiaLocationData");

// WhatsApp Business API - New Clean Structure
const whatsappWabaManager = require("./whatsapp/wabaManager");
const whatsappEmbeddedSignup = require("./whatsapp/embeddedSignup");
const whatsappWebhook = require("./whatsapp/webhook");
const whatsappMessaging = require("./whatsapp/messaging");
const whatsappOrderNotifications = require("./whatsapp/orderNotifications");

// WABA Management
exports.saveWABADirect = whatsappWabaManager.saveWABADirect;
exports.getWABAStatus = whatsappWabaManager.getWABAStatus;
exports.detectNewWABA = whatsappWabaManager.detectNewWABA;
exports.getClientWABA = whatsappWabaManager.getClientWABA;
exports.adminLinkWABA = whatsappWabaManager.adminLinkWABA;
exports.registerClientPhone = whatsappWabaManager.registerClientPhone;
exports.exchangeCodeForWABA = whatsappWabaManager.exchangeCodeForWABA;
exports.registerPhoneNumber = whatsappWabaManager.registerPhoneNumber;
exports.repairWebhookSubscription = whatsappWabaManager.repairWebhookSubscription;

// Embedded Signup
exports.whatsappEmbeddedSignupCallback = whatsappEmbeddedSignup.whatsappEmbeddedSignupCallback;

// Webhook
exports.whatsappWebhook = whatsappWebhook;

// Messaging
exports.sendMessageViaTechProvider = whatsappMessaging.sendMessageViaTechProvider;

// Order notifications
exports.whatsappOrderStatusNotifier = whatsappOrderNotifications.whatsappOrderStatusNotifier;
exports.sendOrderUpdateNotification = whatsappOrderNotifications.sendOrderUpdateNotification;

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