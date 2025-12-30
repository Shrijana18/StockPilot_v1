/**
 * Create Merchant Account
 * 
 * Creates a merchant account with payment gateway provider (Razorpay/Stripe)
 * on behalf of the user, so they don't need to create their own account.
 * 
 * This implements a white-label payment gateway solution.
 */

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");
const functions = require("firebase-functions");
const Razorpay = require("razorpay");

/**
 * Create merchant account with Razorpay
 * Razorpay supports sub-merchant accounts through their Connect API
 */
async function createRazorpayMerchantAccount(data) {
  // Get Razorpay credentials from environment variables or Firebase config
  // Priority: 1. process.env (from .env file or secrets) 2. functions.config() (legacy)
  
  let RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET;
  
  // Try environment variables first (from .env file or Firebase secrets)
  RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  
  // Fallback to Firebase config (legacy, but still works)
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    try {
      // Access Firebase config (works in both v1 and v2)
      const config = functions.config();
      if (config && config.razorpay) {
        RAZORPAY_KEY_ID = config.razorpay.key_id || RAZORPAY_KEY_ID;
        RAZORPAY_KEY_SECRET = config.razorpay.key_secret || RAZORPAY_KEY_SECRET;
        console.log("Loaded Razorpay keys from functions.config()");
      }
    } catch (e) {
      console.warn("Could not access functions.config():", e.message);
    }
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Razorpay credentials missing. Available env vars:", Object.keys(process.env).filter(k => k.includes('RAZORPAY')));
    throw new Error("Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file or use firebase functions:config:set");
  }
  
  console.log("Razorpay credentials loaded:", {
    keyId: RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 10)}...` : "missing",
    keySecret: RAZORPAY_KEY_SECRET ? "***" : "missing"
  });

  try {
    // Initialize Razorpay SDK
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });

    console.log("Attempting to create Razorpay account with:", {
      email: data.contactInfo.email,
      businessName: data.businessInfo.businessName,
      keyIdPrefix: RAZORPAY_KEY_ID.substring(0, 10)
    });

    // Use Razorpay SDK to create account (Connect API)
    // Note: Connect API might not be available in test mode
    // You may need to contact Razorpay support to enable it
    const accountData = {
      email: data.contactInfo.email,
      phone: data.contactInfo.phone,
      legal_business_name: data.businessInfo.businessName,
      business_type: data.businessInfo.businessType,
      customer_facing_business_name: data.businessInfo.businessName,
      business_model: data.businessInfo.businessCategory,
      profile: {
        category: data.businessInfo.businessCategory,
        subcategory: "general",
        addresses: {
          registered: {
            street1: data.contactInfo.address,
            city: data.contactInfo.city,
            state: data.contactInfo.state,
            postal_code: data.contactInfo.pincode,
            country: "IN"
          }
        },
        business_model: data.businessInfo.businessCategory
      },
      legal_info: {
        pan: data.businessInfo.pan,
        gst: data.businessInfo.gstin
      },
      bank_account: {
        ifsc: data.bankInfo.ifsc,
        name: data.bankInfo.accountHolderName,
        account_number: data.bankInfo.accountNumber
      }
    };

    const account = await razorpay.accounts.create(accountData);

    console.log("Razorpay account created successfully:", {
      accountId: account.id,
      status: account.status
    });

    // Return actual Razorpay response
    return {
      merchantId: account.id,
      status: account.status || "pending", // pending, active, suspended
      gateway: "razorpay",
      accountId: account.id,
      accountStatus: account.status,
      accountData: account, // Store full response for reference
    };
  } catch (error) {
    // Handle Razorpay SDK errors
    console.error("Razorpay SDK Error:", {
      message: error.message,
      statusCode: error.statusCode,
      error: error.error,
      description: error.error?.description,
      field: error.error?.field,
      source: error.error?.source,
      step: error.error?.step,
      reason: error.error?.reason
    });

    // Provide more specific error messages
    if (error.statusCode === 401) {
      throw new Error("Razorpay Authentication Failed: Invalid API keys. Please verify your Razorpay credentials.");
    } else if (error.statusCode === 403) {
      throw new Error("Razorpay Access Denied: Connect API is not enabled for your account. Please contact Razorpay support to enable Connect API.");
    } else if (error.statusCode === 400) {
      const errorDesc = error.error?.description || error.error?.message || error.message;
      throw new Error(`Razorpay Validation Error: ${errorDesc}`);
    } else if (error.error) {
      const errorDesc = error.error.description || error.error.message || error.message;
      throw new Error(`Razorpay API Error: ${errorDesc}`);
    } else {
      throw new Error(`Razorpay Error: ${error.message || "Failed to create merchant account"}`);
    }
  }
}

/**
 * Create merchant account with Stripe Connect
 */
async function createStripeMerchantAccount(data) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe credentials not configured");
  }

  // Stripe Connect allows creating connected accounts
  // For production, implement Stripe Connect onboarding
  
  /*
  const stripe = require('stripe')(STRIPE_SECRET_KEY);
  
  const account = await stripe.accounts.create({
    type: 'express', // or 'standard' or 'custom'
    country: 'IN',
    email: data.contactInfo.email,
    business_type: data.businessInfo.businessType === 'sole_proprietorship' ? 'individual' : 'company',
    company: {
      name: data.businessInfo.businessName,
      tax_id: data.businessInfo.pan,
    },
    business_profile: {
      mcc: '5734', // Default MCC, adjust based on business category
      name: data.businessInfo.businessName,
    },
    external_account: {
      object: 'bank_account',
      country: 'IN',
      currency: 'inr',
      account_number: data.bankInfo.accountNumber,
      routing_number: data.bankInfo.ifsc,
      account_holder_name: data.bankInfo.accountHolderName,
      account_holder_type: data.businessInfo.businessType === 'sole_proprietorship' ? 'individual' : 'company',
    },
  });
  
  return {
    merchantId: account.id,
    status: account.details_submitted ? 'active' : 'pending',
    gateway: 'stripe',
  };
  */

  // For demo, return simulated response
  const merchantId = `acct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    merchantId,
    status: "pending",
    gateway: "stripe",
  };
}

module.exports = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      // Verify authentication
      if (!request.auth) {
        throw new Error("Unauthorized: User must be authenticated");
      }

      const uid = request.auth.uid;
      const { businessInfo, contactInfo, bankInfo, userId } = request.data || {};

      // Validate input
      if (!businessInfo || !contactInfo || !bankInfo) {
        return {
          success: false,
          error: "Missing required information. Please fill all fields.",
        };
      }

      // Validate required fields
      if (!businessInfo.businessName || !businessInfo.gstin || !businessInfo.pan) {
        return {
          success: false,
          error: "Missing required business information (Name, GSTIN, PAN).",
        };
      }

      if (!contactInfo.email || !contactInfo.phone || !contactInfo.address) {
        return {
          success: false,
          error: "Missing required contact information (Email, Phone, Address).",
        };
      }

      if (!bankInfo.accountNumber || !bankInfo.ifsc || !bankInfo.bankName) {
        return {
          success: false,
          error: "Missing required bank account information.",
        };
      }

      if (userId !== uid) {
        return {
          success: false,
          error: "User ID mismatch. Please refresh and try again.",
        };
      }

      // Check if merchant account already exists
      const db = admin.firestore();
      const billingPrefsRef = db.doc(`businesses/${uid}/preferences/billing`);
      const billingPrefs = await billingPrefsRef.get();

      if (billingPrefs.exists) {
        const existing = billingPrefs.data();
        if (existing.payment?.card?.merchantAccountId) {
          return {
            success: true,
            merchantId: existing.payment.card.merchantAccountId,
            status: existing.payment.card.merchantStatus || "active",
            gateway: existing.payment.card.gateway || "razorpay",
            message: "Merchant account already exists",
          };
        }
      }

      // Determine which gateway to use (default to Razorpay for India)
      const gateway = process.env.DEFAULT_PAYMENT_GATEWAY || "razorpay";

      let merchantAccount;
      if (gateway === "razorpay") {
        merchantAccount = await createRazorpayMerchantAccount({
          businessInfo,
          contactInfo,
          bankInfo,
        });
      } else if (gateway === "stripe") {
        merchantAccount = await createStripeMerchantAccount({
          businessInfo,
          contactInfo,
          bankInfo,
        });
      } else {
        throw new Error(`Unsupported payment gateway: ${gateway}`);
      }

      // Store merchant account info in Firestore
      await billingPrefsRef.set(
        {
          payment: {
            card: {
              enabled: true,
              gateway: merchantAccount.gateway,
              merchantAccountId: merchantAccount.merchantId,
              merchantStatus: merchantAccount.status,
              paymentLinkEnabled: true,
              onboardedAt: admin.firestore.FieldValue.serverTimestamp(),
              businessInfo: {
                businessName: businessInfo.businessName,
                businessType: businessInfo.businessType,
                businessCategory: businessInfo.businessCategory,
                gstin: businessInfo.gstin,
                pan: businessInfo.pan,
              },
            },
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Store merchant account details in a separate collection for admin access
      await db.collection("merchantAccounts").doc(uid).set({
        userId: uid,
        merchantId: merchantAccount.merchantId,
        gateway: merchantAccount.gateway,
        status: merchantAccount.status,
        businessInfo,
        contactInfo,
        bankInfo: {
          // Don't store full account number for security
          bankName: bankInfo.bankName,
          ifsc: bankInfo.ifsc,
          accountHolderName: bankInfo.accountHolderName,
          accountNumberLast4: bankInfo.accountNumber.slice(-4),
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // In production, you might want to:
      // 1. Send email notification to user
      // 2. Set up webhook listeners for payment events
      // 3. Create admin dashboard entry for review

      return {
        success: true,
        merchantId: merchantAccount.merchantId,
        status: merchantAccount.status,
        gateway: merchantAccount.gateway,
        message: "Merchant account created successfully. It will be activated after verification.",
      };
    } catch (error) {
      console.error("Error creating merchant account:", error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to create merchant account";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        switch (error.code) {
          case "ENOTFOUND":
          case "ECONNREFUSED":
            errorMessage = "Payment gateway service is temporarily unavailable. Please try again later.";
            break;
          case "ETIMEDOUT":
            errorMessage = "Request timed out. Please try again.";
            break;
          default:
            errorMessage = `Payment gateway error: ${error.code}`;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
);

