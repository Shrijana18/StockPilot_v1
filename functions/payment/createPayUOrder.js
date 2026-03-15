/**
 * Create PayU Payment Session for Customer Checkout
 *
 * Generates PayU hosted checkout params + hash. Client submits a form to PayU
 * to redirect user to PayU payment page. Webhook handles success/failure.
 *
 * Uses: PayU API Key, Salt (from Firebase secrets)
 * Hash: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
 * Ref: https://docs.payu.in/docs/generate-hash-payu-hosted
 */

const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

const PAYU_KEY = defineSecret("PAYU_MERCHANT_KEY");
const PAYU_SALT = defineSecret("PAYU_SALT");

function getPayUCredentials() {
  let key, salt;
  try {
    key = (PAYU_KEY.value() || "").trim();
    salt = (PAYU_SALT.value() || "").trim();
  } catch (e) {
    throw new Error("PayU credentials not configured. Set PAYU_MERCHANT_KEY and PAYU_SALT secrets.");
  }
  if (!key || !salt) {
    throw new Error("PayU credentials not configured.");
  }
  return { key, salt };
}

/**
 * Sanitize user-provided string for PayU hash - remove pipe and control chars that corrupt hash
 */
function sanitizeForHash(s) {
  if (s == null || typeof s !== "string") return "";
  return String(s).replace(/\|/g, "").replace(/[\x00-\x1f\x7f]/g, "").trim();
}

/**
 * Generate PayU payment hash (Hosted API)
 * Uses exact formula from PayU sample: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
 * With no UDFs: 5 empty + 6 pipes = 11 pipes between email and SALT.
 * Ref: https://docs.payu.in/docs/generate-hash-payu-hosted
 */
function generateHash(params, salt) {
  const key = (params.key || "").trim();
  const txnid = (params.txnid || "").trim();
  const amount = String(params.amount || "").trim();
  const productinfo = sanitizeForHash(params.productinfo);
  const firstname = sanitizeForHash(params.firstname);
  const email = sanitizeForHash(params.email);
  const udf1 = "";
  const udf2 = "";
  const udf3 = "";
  const udf4 = "";
  const udf5 = "";
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash("sha512").update(hashString, "utf8").digest("hex").toLowerCase();
}

/**
 * @param {Object} data - { orderId, amount, orderNumber, customerName, customerEmail, customerPhone, storeName, callbackBaseUrl, enforcePaymethod? }
 */
const createPayUOrder = onCall(
  {
    region: "asia-south1",
    secrets: [PAYU_KEY, PAYU_SALT],
    timeoutSeconds: 30,
  },
  async (request) => {
    console.log("createPayUOrder invoked");
    try {
      const data = request.data || {};
      const {
        orderId,
        amount,
        orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        storeName,
        callbackBaseUrl,
        enforcePaymethod,
      } = data;

      if (!orderId || !amount || amount <= 0) {
        throw new Error("Invalid orderId or amount");
      }

      const amountStr = (Math.round(amount * 100) / 100).toFixed(2);
      if (parseFloat(amountStr) < 1) {
        throw new Error("Minimum amount is ₹1");
      }

      const db = admin.firestore();
      const orderRef = db.doc(`customerOrders/${orderId}`);
      const orderSnap = await orderRef.get();

      if (!orderSnap.exists) {
        throw new Error("Order not found");
      }

      const order = orderSnap.data();
      const expectedPayNow = order.payNow ?? order.total ?? 0;
      if (Math.abs(amount - expectedPayNow) > 0.02) {
        throw new Error("Amount mismatch with order total");
      }
      if (order.paymentStatus === "paid") {
        throw new Error("Order is already paid");
      }
      if (!["pending", "awaiting_payment"].includes(order.status || "pending")) {
        throw new Error("Order cannot accept payment in current state");
      }

      const { key, salt } = getPayUCredentials();
      const projectId = process.env.GCLOUD_PROJECT || "stockpilotv1";
      const region = "asia-south1";
      const webhookBase = process.env.PAYU_WEBHOOK_BASE || `https://${region}-${projectId}.cloudfunctions.net`;
      const callbackUrl = `${webhookBase}/payuWebhook`;

      const txnId = `FLYP_${orderId}_${Date.now()}`;
      const productinfo = `Order ${orderNumber || orderId}`.replace(/[#|]/g, "").trim();
      const firstname = ((customerName || order.customerName || "Customer").trim().split(/\s+/)[0] || "Customer").replace(/\|/g, "");
      const email = (customerEmail || order.customerEmail || "customer@flypnow.com").trim().replace(/\|/g, "");
      const phone = (customerPhone || order.customerPhone || "").trim();

      const params = {
        key,
        txnid: txnId,
        amount: amountStr,
        productinfo,
        firstname,
        email,
        phone: phone || undefined,
        surl: callbackUrl,
        furl: callbackUrl,
      };

      if (enforcePaymethod) {
        params.enforce_paymethod = enforcePaymethod;
      }

      const hash = generateHash(params, salt);
      params.hash = hash;
      console.log("createPayUOrder success", { orderId, txnid: txnId, amount: amountStr });

      await orderRef.update({
        payuTxnId: txnId,
        payuTxnCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        postUrl: process.env.PAYU_TEST_MODE === "true" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment",
        params: {
          key: params.key,
          txnid: params.txnid,
          amount: params.amount,
          productinfo: params.productinfo,
          firstname: params.firstname,
          email: params.email,
          phone: params.phone || "",
          surl: params.surl,
          furl: params.furl,
          hash: params.hash,
          enforce_paymethod: params.enforce_paymethod || "",
        },
      };
    } catch (error) {
      console.error("createPayUOrder error:", error);
      throw new Error(error.message || "Failed to create PayU payment session");
    }
  }
);

module.exports = createPayUOrder;
