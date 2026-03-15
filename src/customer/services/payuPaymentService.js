/**
 * PayU Payment Service for Customer Checkout
 *
 * Creates PayU session via Cloud Function, then redirects to PayU hosted checkout
 * by submitting a form. PayU redirects user to success/failure URLs; webhook updates order.
 *
 * Supports enforce_paymethod for UPI-only (e.g. when user selects PhonePe, GPay):
 * - enforce_paymethod: "UPI" for UPI only
 * - PayU will show UPI app selection on their page
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase/firebaseConfig";

/**
 * Create PayU payment session and get post params
 */
async function createPayUSession(params) {
  const functions = getFunctions(app, "asia-south1");
  const createOrder = httpsCallable(functions, "createPayUOrder");
  const result = await createOrder(params);
  const res = result?.data;
  if (!res?.success || !res?.params || !res?.postUrl) {
    throw new Error(res?.message || "Failed to create payment session");
  }
  return res;
}

/**
 * Submit form to PayU - navigates user to PayU checkout
 */
function submitToPayU(postUrl, params) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = postUrl;
  form.style.display = "none";

  const keys = Object.keys(params);
  keys.forEach((k) => {
    const v = params[k];
    if (v == null || v === "") return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

/**
 * Open PayU checkout - redirects to PayU payment page
 *
 * @param {Object} options
 * @param {string} options.orderId - Firestore order ID
 * @param {number} options.amount - Amount in INR
 * @param {string} options.orderNumber - Order number for receipt
 * @param {string} options.customerName
 * @param {string} [options.customerEmail]
 * @param {string} options.customerPhone
 * @param {string} options.storeName
 * @param {string} [options.enforcePaymethod] - e.g. "UPI" for UPI only, "CC" for cards
 */
export async function openPayUCheckout({
  orderId,
  amount,
  orderNumber,
  customerName,
  customerEmail,
  customerPhone,
  storeName,
  enforcePaymethod,
}) {
  const callbackBase = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "";

  const session = await createPayUSession({
    orderId,
    amount,
    orderNumber,
    customerName: customerName || "Customer",
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    storeName: storeName || "FLYP Store",
    callbackBaseUrl: callbackBase,
    enforcePaymethod: enforcePaymethod || "",
  });

  submitToPayU(session.postUrl, session.params);
  return new Promise(() => {}); // Never resolves - page navigates away
}
