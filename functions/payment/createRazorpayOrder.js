/**
 * Create Razorpay Order for Customer Checkout
 *
 * Called after an order is placed in Firestore. Creates a Razorpay order and returns
 * the order ID and Key ID so the client can open Razorpay Checkout.
 *
 * Uses FLYP Corporation's Razorpay account (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET).
 */

const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");

// Use RZP_CUSTOMER_* to avoid overlap with .env RAZORPAY_KEY_* during deploy
const RZP_CUSTOMER_KEY_ID = defineSecret("RZP_CUSTOMER_KEY_ID");
const RZP_CUSTOMER_KEY_SECRET = defineSecret("RZP_CUSTOMER_KEY_SECRET");

function getRazorpayClient() {
  let keyId, keySecret;
  try {
    keyId = RZP_CUSTOMER_KEY_ID.value();
    keySecret = RZP_CUSTOMER_KEY_SECRET.value();
  } catch (e) {
    throw new Error("Razorpay credentials not configured. Set RZP_CUSTOMER_KEY_ID and RZP_CUSTOMER_KEY_SECRET secrets.");
  }
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured.");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Creates a Razorpay order for an existing customer order.
 * @param {Object} data - { orderId, amount, orderNumber, customerName, customerEmail, customerPhone, storeName }
 */
const createRazorpayOrder = onCall(
  {
    region: "asia-south1",
    secrets: [RZP_CUSTOMER_KEY_ID, RZP_CUSTOMER_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
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
      } = data;

      if (!orderId || !amount || amount <= 0) {
        throw new Error("Invalid orderId or amount");
      }

      const amountPaise = Math.round(amount * 100);
      if (amountPaise < 100) {
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

      // Allow small rounding difference
      if (Math.abs(amount - expectedPayNow) > 0.02) {
        throw new Error("Amount mismatch with order total");
      }

      // Ensure order is still pending payment (accept awaiting_payment or pending)
      if (order.paymentStatus === "paid") {
        throw new Error("Order is already paid");
      }
      if (!["pending", "awaiting_payment"].includes(order.status || "pending")) {
        throw new Error("Order cannot accept payment in current state");
      }

      const razorpay = getRazorpayClient();
      const keyId = RZP_CUSTOMER_KEY_ID.value();

      const options = {
        amount: amountPaise,
        currency: "INR",
        receipt: orderNumber || orderId,
        notes: {
          order_id: orderId,
          order_number: orderNumber || orderId,
          store_name: storeName || order.storeName || "FLYP Store",
        },
      };

      if (customerName || customerEmail || customerPhone) {
        options.notes.customer_name = customerName || "";
        options.notes.customer_phone = customerPhone || "";
        if (customerEmail) options.notes.customer_email = customerEmail;
      }

      const rzpOrder = await razorpay.orders.create(options);

      // Store razorpay order id on our order for reference
      await orderRef.update({
        razorpayOrderId: rzpOrder.id,
        razorpayOrderCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        razorpayOrderId: rzpOrder.id,
        keyId,
        amount: amountPaise,
        currency: "INR",
      };
    } catch (error) {
      console.error("createRazorpayOrder error:", error);
      throw new Error(error.message || "Failed to create payment session");
    }
  }
);

module.exports = createRazorpayOrder;
