/**
 * Razorpay Payment Service for Customer Checkout
 *
 * Loads Razorpay Checkout script, creates order via Cloud Function,
 * and opens the Razorpay payment modal. Web checkout only (works on iOS/Android/browser).
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase/firebaseConfig";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Load Razorpay checkout script dynamically
 */
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window.Razorpay !== "undefined") {
      resolve(window.Razorpay);
      return;
    }
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      const check = () => {
        if (typeof window.Razorpay !== "undefined") resolve(window.Razorpay);
        else setTimeout(check, 50);
      };
      check();
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (typeof window.Razorpay !== "undefined") {
        resolve(window.Razorpay);
      } else {
        reject(new Error("Razorpay script loaded but Razorpay not found"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.body.appendChild(script);
  });
}

/**
 * Create Razorpay order via Cloud Function
 */
async function createRazorpayOrder(data) {
  const functions = getFunctions(app, "asia-south1");
  const createOrder = httpsCallable(functions, "createRazorpayOrder");
  const result = await createOrder(data);
  const res = result?.data;
  if (!res?.success || !res?.razorpayOrderId || !res?.keyId) {
    throw new Error(res?.message || "Failed to create payment session");
  }
  return res;
}

/**
 * Open Razorpay checkout (web) and return a promise that resolves on success, rejects on failure/close
 *
 * @param {Object} params
 * @param {string} params.orderId - Firestore order ID
 * @param {number} params.amount - Amount in INR (rupees)
 * @param {string} params.orderNumber - Order number for receipt
 * @param {string} params.customerName - Customer name
 * @param {string} [params.customerEmail] - Customer email
 * @param {string} params.customerPhone - Customer phone
 * @param {string} params.storeName - Store name
 * @returns {Promise<{paymentId: string, orderId: string}>}
 */
export async function openRazorpayCheckout({
  orderId,
  amount,
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  storeName,
  preferredUpiApp,
  upiId,
}) {
  const orderData = await createRazorpayOrder({
    orderId,
    amount,
    orderNumber,
    customerName: customerName || "Customer",
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    storeName: storeName || "FLYP Store",
  });

  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency || "INR",
      order_id: orderData.razorpayOrderId,
      name: storeName || "FLYP Store",
      description: `Order #${orderNumber}`,
      handler: (response) => {
        resolve({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          reject(new Error("Payment cancelled"));
        },
      },
      prefill: {
        name: customerName || "",
        contact: customerPhone || "",
        email: customerEmail || "",
        ...(upiId ? { vpa: upiId } : {}),
      },
      theme: {
        color: "#10B981",
      },
    };

    // When a specific UPI app shortcut was tapped:
    // - flows: ["intent"] tells Razorpay to construct a UPI Intent URL (e.g. phonepe://pay?...)
    //   rather than UPI Collect (generic push-notification flow)
    // - Capacitor's WKNavigationDelegate intercepts the custom scheme URL and calls
    //   UIApplication.shared.open() which opens the UPI app directly on the device
    if (preferredUpiApp && preferredUpiApp !== 'manual') {
      const UPI_APP_MAP = {
        phonepe: 'phonepe',
        gpay: 'google_pay',
        paytm: 'paytm',
        bhim: 'bhim',
      };
      const targetApp = UPI_APP_MAP[preferredUpiApp];
      options.config = {
        display: {
          blocks: {
            upi: {
              name: "Pay via UPI",
              instruments: [{
                method: "upi",
                flows: ["intent", "collect", "qr"],
                ...(targetApp ? { apps: [targetApp] } : {}),
              }],
            },
          },
          sequence: ["block.upi"],
          preferences: { show_default_blocks: false },
        },
      };
    }

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", (response) => {
      reject(new Error(response.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}
