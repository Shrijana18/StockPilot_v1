

/**
 * Shared constants used across FLYP Cloud Functions
 */

module.exports = {
  // Standardized GST rates (India)
  GST_RATES: [0, 5, 12, 18, 28],

  // Common product categories used for AI prompts / inventory tagging
  COMMON_CATEGORIES: [
    "Grocery",
    "Dairy",
    "Beverages",
    "Personal Care",
    "Household",
    "Snacks",
    "Pharma",
    "Electronics",
    "Stationery",
    "Bakery",
    "Frozen",
  ],

  // Pricing modes used in billing
  PRICING_MODES: {
    MRP_INCLUSIVE: "MRP_INCLUSIVE",
    BASE_PLUS_GST: "BASE_PLUS_GST",
  },

  // Regular expressions
  REGEX: {
    GSTIN: /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/i,
    HSN: /\b\d{4,8}\b/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^[6-9]\d{9}$/,
  },

  // Default OpenAI model (safe fallback)
  OPENAI_DEFAULT_MODEL: "gpt-4o-mini",

  // OpenAI temperature settings
  OPENAI_TEMPERATURE: {
    LOW: 0.1,
    MEDIUM: 0.3,
    HIGH: 0.6,
  },

  // AI retry logic
  AI_RETRY: {
    MAX_ATTEMPTS: 2,
    BACKOFF_BASE_MS: 800,
  },

  // Region for deployed functions
  DEFAULT_REGION: "asia-south1",

  // Firestore collection paths
  COLLECTIONS: {
    BUSINESSES: "businesses",
    EMPLOYEES: "employees",
    CONNECTED_RETAILERS: "connectedRetailers",
    CONNECTED_DISTRIBUTORS: "connectedDistributors",
    ASSISTANT_QUERIES: "assistantQueries",
  },
};