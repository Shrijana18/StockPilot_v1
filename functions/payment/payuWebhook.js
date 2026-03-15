/**
 * PayU Webhook + Redirect Callback Handler
 *
 * 1. Webhook: PayU sends server-to-server webhooks for Successful, Failed, Refund, Dispute
 * 2. Redirect: PayU POSTs to surl/furl after payment - we verify hash, update order, redirect user
 *
 * Hash verification (response): sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * Ref: https://docs.payu.in/docs/generate-hash-payu-hosted
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

const PAYU_SALT = defineSecret("PAYU_SALT");

function getSalt() {
  try {
    const s = PAYU_SALT.value();
    return s ? String(s).trim() : null;
  } catch (e) {
    return null;
  }
}

/**
 * Verify PayU response hash (reverse hash)
 * sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * Ref: https://docs.payu.in/docs/generate-hash-payu-hosted
 */
function verifyResponseHash(payload, salt) {
  if (!payload || !salt) return false;
  const status = (payload.status || "").trim();
  const udf5 = payload.udf5 || "";
  const udf4 = payload.udf4 || "";
  const udf3 = payload.udf3 || "";
  const udf2 = payload.udf2 || "";
  const udf1 = payload.udf1 || "";
  const email = payload.email || "";
  const firstname = payload.firstname || "";
  const productinfo = payload.productinfo || "";
  const amount = String(payload.amount ?? "").trim();
  const txnid = payload.txnid || "";
  const key = payload.key || "";
  const receivedHash = (payload.hash || "").trim().toLowerCase();

  const hashString = [salt, status, "", "", "", "", "", udf5, udf4, udf3, udf2, udf1, email, firstname, productinfo, amount, txnid, key].join("|");
  const expectedHash = crypto.createHash("sha512").update(hashString, "utf8").digest("hex").toLowerCase();
  return expectedHash === receivedHash;
}

/**
 * Extract order ID from PayU payload.
 * We use udf1 when sent, or parse from txnid (format: FLYP_orderId_timestamp).
 */
function getOrderId(payload) {
  if (payload?.udf1) return payload.udf1;
  const txnid = payload?.txnid || "";
  const match = txnid.match(/^FLYP_(.+)_\d+$/);
  return match ? match[1] : null;
}

/**
 * Mark order as paid
 */
async function markOrderPaid(orderId, payload) {
  const db = admin.firestore();
  const orderRef = db.doc(`customerOrders/${orderId}`);
  const snap = await orderRef.get();
  if (!snap.exists) return;
  const order = snap.data();
  const amountPaid = parseFloat(payload.amount || 0) || 0;

  const updates = {
    paymentStatus: "paid",
    amountPaid,
    payuPaymentId: payload.mihpayid || payload.payuid || payload.txnid || null,
    payuTxnId: payload.txnid || null,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    "statusHistory.payment_captured": admin.firestore.FieldValue.serverTimestamp(),
  };
  if (order.status === "awaiting_payment") {
    updates.status = "pending";
    updates["statusHistory.pending"] = admin.firestore.FieldValue.serverTimestamp();
  }
  await orderRef.update(updates);
  console.log(`PayU: Order ${orderId} marked as paid. mihpayid: ${payload.mihpayid || payload.txnid}`);
}

/**
 * Mark order payment failed
 */
async function markOrderPaymentFailed(orderId, payload) {
  const db = admin.firestore();
  const orderRef = db.doc(`customerOrders/${orderId}`);
  const snap = await orderRef.get();
  if (!snap.exists) return;
  await orderRef.update({
    payuPaymentId: payload.mihpayid || payload.txnid || null,
    payuPaymentError: payload.error_Message || payload.error || "Payment failed",
    paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    "statusHistory.payment_failed": admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`PayU: Order ${orderId} payment failed.`, payload.error_Message || payload.error);
}

/**
 * Redirect user to app success/failure page
 */
function redirectToApp(res, success, orderId) {
  const baseUrl = process.env.PAYU_REDIRECT_BASE || process.env.VITE_CUSTOMER_APP_URL || process.env.APP_URL || "https://flypnow.com";
  const path = success ? "/#/payment/success" : "/#/payment/failure";
  const url = `${baseUrl.replace(/\/$/, "")}${path}${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`;
  res.redirect(302, url);
}

/**
 * Parse body - PayU sends application/x-www-form-urlencoded
 */
function parseBody(req) {
  if (req.method === "GET" && Object.keys(req.query || {}).length > 0) {
    return req.query;
  }
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  return {};
}

const payuWebhook = onRequest(
  {
    region: "asia-south1",
    secrets: [PAYU_SALT],
    timeoutSeconds: 30,
    cors: false,
  },
  async (req, res) => {
    const payload = parseBody(req);
    const orderId = getOrderId(payload);
    const status = (payload.status || "").toLowerCase();
    const salt = getSalt();

    if (!salt) {
      console.error("PayU webhook: PAYU_SALT not configured");
      res.status(500).send("Webhook not configured");
      return;
    }

    const isValid = verifyResponseHash(payload, salt);
    if (!isValid && Object.keys(payload).length > 0) {
      console.warn("PayU webhook: invalid hash", { orderId, status });
    }

    const isBrowserRedirect = (req.get("sec-fetch-dest") === "document" || /text\/html/.test(req.get("accept") || ""));

    try {
      if (orderId) {
        if (status === "success" || status === "credited") {
          if (isValid) {
            await markOrderPaid(orderId, payload);
          } else {
            console.warn("PayU: Hash invalid but status=success for order", orderId);
          }
          if (isBrowserRedirect) {
            redirectToApp(res, true, orderId);
          } else {
            res.status(200).send("OK");
          }
          return;
        }
        if (status === "failure" || status === "failed") {
          await markOrderPaymentFailed(orderId, payload);
          if (isBrowserRedirect) {
            redirectToApp(res, false, orderId);
          } else {
            res.status(200).send("OK");
          }
          return;
        }
      }

      if (isBrowserRedirect) {
        redirectToApp(res, false, orderId);
      } else {
        res.status(200).send("OK");
      }
    } catch (error) {
      console.error("PayU webhook error:", error);
      if (isBrowserRedirect) {
        redirectToApp(res, false, orderId);
      } else {
        res.status(500).send("Error");
      }
    }
  }
);

module.exports = payuWebhook;
