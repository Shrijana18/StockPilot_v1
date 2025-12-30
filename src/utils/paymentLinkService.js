/**
 * Payment Link Service
 * 
 * Service to generate payment links using the backend Cloud Function.
 * This allows users to generate payment links without managing their own gateway accounts.
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseConfig";

/**
 * Generate a payment link for an invoice
 * @param {string} invoiceId - The invoice ID
 * @param {number} amount - The payment amount
 * @param {object} customerInfo - Customer information (optional)
 * @returns {Promise<{success: boolean, paymentLink?: string, error?: string}>}
 */
export const generatePaymentLink = async (invoiceId, amount, customerInfo = {}) => {
  try {
    const generatePaymentLinkFn = httpsCallable(functions, "generatePaymentLink");
    const result = await generatePaymentLinkFn({
      invoiceId,
      amount,
      customerInfo,
    });

    if (result.data.success) {
      return {
        success: true,
        paymentLink: result.data.paymentLink,
        paymentLinkId: result.data.paymentLinkId,
        expiresAt: result.data.expiresAt,
      };
    } else {
      return {
        success: false,
        error: result.data.error || "Failed to generate payment link",
      };
    }
  } catch (error) {
    console.error("Error generating payment link:", error);
    return {
      success: false,
      error: error.message || "Failed to generate payment link",
    };
  }
};

/**
 * Check if payment gateway is available for a user
 * @param {object} billingSettings - Billing settings from Firestore
 * @returns {boolean}
 */
export const isPaymentGatewayAvailable = (billingSettings) => {
  const cardConfig = billingSettings?.payment?.card;
  return (
    cardConfig?.enabled &&
    cardConfig?.merchantAccountId &&
    cardConfig?.merchantStatus === "active" &&
    cardConfig?.paymentLinkEnabled
  );
};

/**
 * Get payment gateway status message
 * @param {object} billingSettings - Billing settings from Firestore
 * @returns {string}
 */
export const getPaymentGatewayStatus = (billingSettings) => {
  const cardConfig = billingSettings?.payment?.card;
  
  if (!cardConfig?.enabled) {
    return "Payment gateway not enabled";
  }
  
  if (!cardConfig?.merchantAccountId) {
    return "Payment gateway not set up. Please complete onboarding.";
  }
  
  const status = cardConfig.merchantStatus || "unknown";
  const statusMessages = {
    active: "Payment gateway is active and ready",
    pending: "Payment gateway is being activated. Please wait 24-48 hours.",
    suspended: "Payment gateway is suspended. Please contact support.",
    rejected: "Payment gateway setup was rejected. Please contact support.",
  };
  
  return statusMessages[status] || `Payment gateway status: ${status}`;
};

