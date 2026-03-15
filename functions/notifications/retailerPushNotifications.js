/**
 * Retailer Push Notifications
 * Sends FCM push when a customer places a marketplace order
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const db = () => admin.firestore();

const toDistanceText = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toFixed(1)} km`;
};

/**
 * Get FCM tokens for a retailer (from businesses/{retailerId}/fcmTokens)
 * Only returns valid tokens (not removed)
 */
async function getRetailerFcmTokens(retailerId) {
  const tokensSnap = await db().collection("businesses").doc(retailerId).collection("fcmTokens").get();
  const tokens = [];
  tokensSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.token && !data.removedAt) {
      tokens.push(data.token);
    }
  });
  return tokens;
}

/**
 * Send FCM to retailer when a new customer order is placed
 * Trigger: stores/{storeId}/customerOrders/{orderId} onCreate
 * storeId = retailerId for marketplace
 */
exports.onNewMarketplaceOrder = onDocumentCreated(
  {
    document: "stores/{storeId}/customerOrders/{orderId}",
    region: "asia-south1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap || !snap.exists) return;

    const storeId = event.params.storeId;
    const orderId = event.params.orderId;
    const order = snap.data();

    // Check if retailer has push notifications enabled
    const bizSnap = await db().collection("businesses").doc(storeId).get();
    const biz = bizSnap?.data?.() || {};
    if (!biz.pushNotifications) return;

    const tokens = await getRetailerFcmTokens(storeId);
    if (tokens.length === 0) return;

    const orderNumber = order.orderNumber || orderId;
    const total = order.total ?? order.totalAmount ?? 0;
    const totalStr = typeof total === "number" ? `₹${total.toLocaleString("en-IN")}` : String(total);
    const customerName = order.customerName || "Customer";
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const itemText = itemCount > 0 ? `${itemCount} item${itemCount > 1 ? "s" : ""}` : "items";
    const distanceText = toDistanceText(order.customerDistance);
    const orderType = (order.orderType || "delivery").toLowerCase();
    const typeLabel = orderType === "pickup" ? "Pickup" : "Delivery";
    const title = `New ${typeLabel} Order`;
    const bodyParts = [
      `#${orderNumber}`,
      customerName,
      itemText,
      totalStr,
      distanceText ? `${distanceText} away` : "",
    ].filter(Boolean);
    const body = bodyParts.join(" • ");

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        type: "new_order",
        orderId,
        orderNumber: orderNumber || "",
        total: String(total),
        customerName: customerName || "",
        itemCount: String(itemCount || 0),
        customerDistance: distanceText || "",
        orderType: orderType || "delivery",
      },
      tokens,
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
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
            console.warn("[RetailerPush] Token failed:", tokens[i], r.error?.message);
          }
        });
      }
    } catch (err) {
      console.error("[RetailerPush] FCM send failed:", err);
    }
  }
);
