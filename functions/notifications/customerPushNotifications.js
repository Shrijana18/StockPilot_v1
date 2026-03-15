/**
 * Customer Push Notifications
 * Sends FCM push to customer when retailer updates order status
 * (confirmed, preparing, ready_for_pickup, shipped, delivered)
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const db = () => admin.firestore();

async function getCustomerFcmTokens(customerId) {
  const tokensSnap = await db()
    .collection("customers")
    .doc(customerId)
    .collection("fcmTokens")
    .get();
  const tokens = [];
  tokensSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.token && !data.removedAt) {
      tokens.push(data.token);
    }
  });
  return tokens;
}

function statusToMessage(status, orderNumber) {
  const s = (status || "").toLowerCase();
  const num = orderNumber || "";
  if (s === "confirmed") return { title: "Order Confirmed", body: `Your order ${num} has been accepted by the store.` };
  if (s === "preparing" || s === "preparing_order") return { title: "Order Preparing", body: `Your order ${num} is being prepared.` };
  if (s === "ready" || s === "ready_for_pickup") return { title: "Ready for Pickup", body: `Your order ${num} is ready for pickup/delivery.` };
  if (s === "out_for_delivery") return { title: "Out for Delivery", body: `Your order ${num} is on the way!` };
  if (s === "shipped") return { title: "Order Shipped", body: `Your order ${num} has been shipped.` };
  if (s === "delivered") return { title: "Order Delivered", body: `Your order ${num} has been delivered. Enjoy!` };
  return { title: "Order Update", body: `Your order ${num} status: ${(status || "updated").toUpperCase()}` };
}

function statusToDetailedMessage(status, orderNumber, details) {
  const s = (status || "").toLowerCase();
  const num = orderNumber || "";
  const storeName = details?.storeName || "the store";
  const etaMins = Number(details?.etaMins);
  const etaText = Number.isFinite(etaMins) && etaMins > 0 ? `${etaMins} min` : null;

  if (s === "confirmed") {
    return {
      title: "Order Confirmed",
      body: `${storeName} accepted #${num}${etaText ? ` • ETA ${etaText}` : ""}`,
    };
  }
  if (s === "preparing" || s === "preparing_order") {
    return {
      title: "Order Preparing",
      body: `${storeName} started preparing #${num}${etaText ? ` • ETA ${etaText}` : ""}`,
    };
  }
  if (s === "ready" || s === "ready_for_pickup") {
    return {
      title: "Order Ready",
      body: `#${num} is ready ${details?.orderType === "pickup" ? "for pickup" : "for delivery"}`,
    };
  }
  if (s === "out_for_delivery") {
    return {
      title: "Out for Delivery",
      body: `#${num} is on the way${etaText ? ` • Arriving in ${etaText}` : "!"}`,
    };
  }
  if (s === "delivered") {
    return { title: "Order Delivered", body: `#${num} has been delivered. Thank you for ordering!` };
  }
  return statusToMessage(status, orderNumber);
}

/**
 * Send FCM to customer when order status changes
 * Trigger: stores/{storeId}/customerOrders/{orderId} onUpdate
 */
exports.onCustomerOrderStatusUpdate = onDocumentUpdated(
  {
    document: "stores/{storeId}/customerOrders/{orderId}",
    region: "asia-south1",
  },
  async (event) => {
    const before = event.data?.before?.data?.() || {};
    const after = event.data?.after?.data?.() || {};
    const beforeStatus = before.status;
    const afterStatus = after.status;

    if (!afterStatus || beforeStatus === afterStatus) return;

    const customerId = after.customerId;
    if (!customerId) return;

    const tokens = await getCustomerFcmTokens(customerId);
    if (tokens.length === 0) return;

    const orderNumber = after.orderNumber || event.params.orderId;
    const storeId = event.params.storeId;
    const storeSnap = await db().collection("stores").doc(storeId).get().catch(() => null);
    const storeName =
      after.storeName ||
      after.businessName ||
      storeSnap?.data?.()?.businessName ||
      storeSnap?.data?.()?.name ||
      "Store";
    const etaMins = after.estimatedDeliveryMinutes || after.estimatedMins || 0;
    const { title, body } = statusToDetailedMessage(afterStatus, orderNumber, {
      storeName,
      etaMins,
      orderType: after.orderType || "delivery",
    });

    const message = {
      notification: { title, body },
      data: {
        type: "order_status_update",
        orderId: event.params.orderId,
        status: afterStatus,
        orderNumber: orderNumber || "",
        storeName: storeName || "",
        etaMins: String(etaMins || ""),
        orderType: after.orderType || "delivery",
      },
      tokens,
      android: { priority: "high" },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: "default",
            badge: 1,
            "mutable-content": 1,
          },
        },
      },
    };

    try {
      const res = await admin.messaging().sendEachForMulticast(message);
      if (res.failureCount > 0) {
        res.responses.forEach((r, i) => {
          if (!r.success) {
            console.warn("[CustomerPush] Token failed:", tokens[i], r.error?.message);
          }
        });
      }
    } catch (err) {
      console.error("[CustomerPush] FCM send failed:", err);
    }
  }
);
