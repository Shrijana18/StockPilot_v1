/**
 * Generate Payment Link
 * 
 * Creates a payment link for an invoice using the user's merchant account.
 * This allows users to accept card payments without managing their own gateway accounts.
 */

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

/**
 * Generate Razorpay payment link
 */
async function generateRazorpayPaymentLink(merchantAccountId, amount, invoiceId, customerInfo) {
  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials not configured");
  }

  // In production, use Razorpay's Payment Links API
  // For sub-merchants, you might need to use Route API or transfer funds
  
  /*
  const response = await axios.post(
    'https://api.razorpay.com/v1/payment_links',
    {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      description: `Payment for Invoice ${invoiceId}`,
      customer: {
        name: customerInfo.name || customerInfo.businessName,
        email: customerInfo.email,
        contact: customerInfo.phone,
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      callback_url: `${process.env.APP_URL}/payment/callback`,
      callback_method: 'get',
      notes: {
        invoice_id: invoiceId,
        merchant_account_id: merchantAccountId,
      },
    },
    {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    paymentLink: response.data.short_url,
    paymentLinkId: response.data.id,
    expiresAt: response.data.expire_by ? new Date(response.data.expire_by * 1000) : null,
  };
  */

  // For demo, return a simulated payment link
  // In production, use the actual Razorpay response
  const baseUrl = process.env.APP_URL || "https://your-app.com";
  return {
    paymentLink: `${baseUrl}/payment/${merchantAccountId}/${invoiceId}`,
    paymentLinkId: `plink_${Date.now()}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
}

/**
 * Generate Stripe payment link
 */
async function generateStripePaymentLink(merchantAccountId, amount, invoiceId, customerInfo) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe credentials not configured");
  }

  // In production, use Stripe's Payment Links API with connected account
  
  /*
  const stripe = require('stripe')(STRIPE_SECRET_KEY);
  
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{
      price_data: {
        currency: 'inr',
        product_data: {
          name: `Invoice ${invoiceId}`,
        },
        unit_amount: amount * 100, // Convert to paise
      },
      quantity: 1,
    }],
    after_completion: {
      type: 'redirect',
      redirect: {
        url: `${process.env.APP_URL}/payment/success?invoice=${invoiceId}`,
      },
    },
  }, {
    stripeAccount: merchantAccountId, // Connected account ID
  });

  return {
    paymentLink: paymentLink.url,
    paymentLinkId: paymentLink.id,
    expiresAt: null, // Stripe payment links don't expire by default
  };
  */

  // For demo, return simulated payment link
  const baseUrl = process.env.APP_URL || "https://your-app.com";
  return {
    paymentLink: `${baseUrl}/payment/${merchantAccountId}/${invoiceId}`,
    paymentLinkId: `plink_${Date.now()}`,
    expiresAt: null,
  };
}

module.exports = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      // Verify authentication
      if (!request.auth) {
        throw new Error("Unauthorized: User must be authenticated");
      }

      const uid = request.auth.uid;
      const { invoiceId, amount, customerInfo } = request.data || {};

      if (!invoiceId || !amount || amount <= 0) {
        throw new Error("Invalid invoice ID or amount");
      }

      // Get merchant account info
      const db = admin.firestore();
      const billingPrefsRef = db.doc(`businesses/${uid}/preferences/billing`);
      const billingPrefs = await billingPrefsRef.get();

      if (!billingPrefs.exists) {
        throw new Error("Payment gateway not configured");
      }

      const paymentConfig = billingPrefs.data().payment?.card;
      if (!paymentConfig?.enabled || !paymentConfig?.merchantAccountId) {
        throw new Error("Card payment gateway not enabled or merchant account not found");
      }

      if (paymentConfig.merchantStatus !== "active") {
        throw new Error(`Merchant account is ${paymentConfig.merchantStatus}. Please wait for activation.`);
      }

      // Generate payment link based on gateway
      let paymentLinkData;
      if (paymentConfig.gateway === "razorpay") {
        paymentLinkData = await generateRazorpayPaymentLink(
          paymentConfig.merchantAccountId,
          amount,
          invoiceId,
          customerInfo || {}
        );
      } else if (paymentConfig.gateway === "stripe") {
        paymentLinkData = await generateStripePaymentLink(
          paymentConfig.merchantAccountId,
          amount,
          invoiceId,
          customerInfo || {}
        );
      } else {
        throw new Error(`Unsupported payment gateway: ${paymentConfig.gateway}`);
      }

      // Store payment link in invoice document
      const invoiceRef = db.doc(`businesses/${uid}/invoices/${invoiceId}`);
      await invoiceRef.update({
        "payment.card.paymentLink": paymentLinkData.paymentLink,
        "payment.card.paymentLinkId": paymentLinkData.paymentLinkId,
        "payment.card.paymentLinkExpiresAt": paymentLinkData.expiresAt
          ? admin.firestore.Timestamp.fromDate(paymentLinkData.expiresAt)
          : null,
        "payment.card.paymentLinkGeneratedAt": admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        paymentLink: paymentLinkData.paymentLink,
        paymentLinkId: paymentLinkData.paymentLinkId,
        expiresAt: paymentLinkData.expiresAt,
      };
    } catch (error) {
      console.error("Error generating payment link:", error);
      return {
        success: false,
        error: error.message || "Failed to generate payment link",
      };
    }
  }
);

