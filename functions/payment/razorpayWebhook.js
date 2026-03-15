/**
 * Razorpay Webhook Handler
 *
 * Receives payment events from Razorpay (payment.captured, payment.failed, payment.authorized).
 * Verifies webhook signature, then updates the customer order in Firestore.
 *
 * Webhook URL: https://asia-south1-stockpilotv1.cloudfunctions.net/razorpayWebhook
 * Secret: Set via Firebase secret RAZORPAY_WEBHOOK_SECRET (must match Razorpay dashboard)
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto");

const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");

/**
 * Verify Razorpay webhook signature
 * @see https://razorpay.com/docs/webhooks/payload-validation/
 */
function verifyWebhookSignature(body, signature, secret) {
  if (!body || !signature || !secret) return false;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

/**
 * Extract order ID from Razorpay payment notes (we store orderId in notes when creating order)
 */
function getOrderIdFromPayment(payment) {
  const notes = payment?.notes || {};
  return notes.order_id || notes.orderId || null;
}

/**
 * Handle payment.captured - mark order as paid
 */
async function handlePaymentCaptured(payment) {
  const orderId = getOrderIdFromPayment(payment);
  if (!orderId) {
    console.warn("Razorpay webhook: payment.captured but no order_id in notes", payment?.id);
    return;
  }

  const db = admin.firestore();
  const orderRef = db.doc(`customerOrders/${orderId}`);

  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    console.warn("Razorpay webhook: order not found", orderId);
    return;
  }

  const order = orderSnap.data();
  const amountPaidPaise = payment.amount || 0;
  const amountPaidRupees = amountPaidPaise / 100;
  const expectedPayNow = (order.payNow || order.total || 0);

  // Sanity check: paid amount should be at least expected
  if (Math.abs(amountPaidRupees - expectedPayNow) > 0.01) {
    console.warn(
      "Razorpay webhook: amount mismatch",
      { orderId, expected: expectedPayNow, received: amountPaidRupees }
    );
  }

  const updates = {
    paymentStatus: "paid",
    amountPaid: amountPaidRupees,
    razorpayPaymentId: payment.id || null,
    razorpayOrderId: payment.order_id || null,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    "statusHistory.payment_captured": admin.firestore.FieldValue.serverTimestamp(),
  };
  // Move awaiting_payment → pending when payment is confirmed
  if (order.status === "awaiting_payment") {
    updates.status = "pending";
    updates["statusHistory.pending"] = admin.firestore.FieldValue.serverTimestamp();
  }
  await orderRef.update(updates);

  console.log(`Razorpay: Order ${orderId} marked as paid. Payment ID: ${payment.id}`);
}

/**
 * Handle payment.failed - optionally update order or log
 */
async function handlePaymentFailed(payment) {
  const orderId = getOrderIdFromPayment(payment);
  if (!orderId) {
    console.warn("Razorpay webhook: payment.failed but no order_id in notes", payment?.id);
    return;
  }

  const db = admin.firestore();
  const orderRef = db.doc(`customerOrders/${orderId}`);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) return;

  await orderRef.update({
    razorpayPaymentId: payment.id || null,
    razorpayPaymentError: payment.error?.description || "Payment failed",
    paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    "statusHistory.payment_failed": admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Razorpay: Order ${orderId} payment failed.`, payment.error?.description || "");
}

/**
 * Handle payment.authorized - for card payments before capture
 * We use auto-capture, so this may not be critical. Log for analytics.
 */
async function handlePaymentAuthorized(payment) {
  const orderId = getOrderIdFromPayment(payment);
  if (orderId) {
    console.log(`Razorpay: Order ${orderId} payment authorized.`, payment.id);
  }
}

const razorpayWebhook = onRequest(
  {
    region: "asia-south1",
    secrets: [RAZORPAY_WEBHOOK_SECRET],
    timeoutSeconds: 30,
  },
  async (req, res) => {
    // Razorpay sends POST with JSON body
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = (() => {
      if (req.rawBody) {
        return Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody);
      }
      return JSON.stringify(req.body || {});
    })();
    const signature = req.headers["x-razorpay-signature"] || "";

    let webhookSecret;
    try {
      webhookSecret = RAZORPAY_WEBHOOK_SECRET.value();
    } catch (e) {
      console.error("RAZORPAY_WEBHOOK_SECRET not set");
      res.status(500).send("Webhook secret not configured");
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn("Razorpay webhook: invalid signature");
      res.status(400).send("Invalid signature");
      return;
    }

    let event;
    try {
      event = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    } catch (e) {
      res.status(400).send("Invalid JSON");
      return;
    }

    const eventType = event.event;
    const payment = event.payload?.payment?.entity || event.payload?.payment;

    if (!payment) {
      console.warn("Razorpay webhook: no payment in payload", eventType);
      res.status(200).send("OK");
      return;
    }

    try {
      switch (eventType) {
        case "payment.captured":
          await handlePaymentCaptured(payment);
          break;
        case "payment.failed":
          await handlePaymentFailed(payment);
          break;
        case "payment.authorized":
          await handlePaymentAuthorized(payment);
          break;
        default:
          console.log("Razorpay webhook: unhandled event", eventType);
      }
    } catch (error) {
      console.error("Razorpay webhook error:", error);
      res.status(500).send("Webhook processing failed");
      return;
    }

    res.status(200).send("OK");
  }
);

module.exports = razorpayWebhook;
