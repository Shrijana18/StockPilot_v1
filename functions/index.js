// ============================
// FLYP Cloud Functions Entry
// Modular, Clean, and Production-Ready
// ============================

require("dotenv").config();

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

// Retailer Profile Sync
exports.resyncRetailerProfile = require("./profile/resyncRetailerProfile");
exports.syncRetailerProfileToDistributors = require("./profile/syncRetailerProfileToDistributors");

// OCR / Vision
exports.ocrFromImage = require("./ocr/ocrFromImage");

// Smart Assistant
exports.generateAssistantReply = require("./assistant/generateAssistantReply");

// ============================
// Utility Modules (Internal use)
// ============================
exports.aiClient = require("./shared/aiClient");
exports.auth = require("./shared/auth");
exports.constants = require("./shared/constants");
exports.firestore = require("./shared/firestore");
exports.utils = require("./shared/utils");

// ============================
// Notes
// - All functions now load from modular files
// - index.js acts only as the unified export surface
// - Safe to remove all old inline logic
// ============================