/**
 * WhatsApp Order Notifications
 * - Auto notify customer when order status changes (Firestore trigger)
 * - Manual notify action (callable) from dashboard
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const whatsappMessaging = require("./messaging");

function fillTemplate(text, vars) {
  let out = text || "";
  Object.entries(vars || {}).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v ?? ""));
  });
  return out;
}

function statusToMessageKey(status) {
  const s = (status || "").toLowerCase();
  if (s === "shipped") return "orderShipped";
  if (s === "delivered") return "orderDelivered";
  if (s === "confirmed") return "orderConfirmed";
  return null;
}

function defaultStatusMessage(status, orderId) {
  const s = (status || "pending").toUpperCase();
  return `📦 Order Update\n\nOrder #${orderId}\nStatus: ${s}\n\nReply *orders* to view your orders.`;
}

async function getOrderBotConfig(distributorId) {
  const ref = db.collection("businesses").doc(distributorId).collection("whatsappBot").doc("orderConfig");
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function shouldAutoNotify(distributorId) {
  const cfg = await getOrderBotConfig(distributorId);
  if (!cfg?.enabled) return { ok: false, cfg };
  if (cfg?.orderSettings?.sendStatusUpdates !== true) return { ok: false, cfg };
  return { ok: true, cfg };
}

async function sendStatusNotification({ distributorId, orderId, orderData, newStatus, customMessage }) {
  const cfg = await getOrderBotConfig(distributorId);
  const key = statusToMessageKey(newStatus);
  const templateText = key ? cfg?.messages?.[key] : null;

  const phone = orderData?.customerPhone;
  if (!phone) throw new Error("Order has no customerPhone");

  const vars = {
    order_id: orderId,
    total: orderData?.total ?? "",
    items_count: orderData?.itemCount ?? (orderData?.items?.length ?? ""),
    customer_name: orderData?.customerName ?? "",
  };

  const message =
    customMessage?.trim()
      ? fillTemplate(customMessage.trim(), vars)
      : (templateText ? fillTemplate(templateText, vars) : defaultStatusMessage(newStatus, orderId));

  const res = await whatsappMessaging._sendViaTechProvider({
    distributorId,
    to: phone,
    message,
    options: {
      metadata: {
        messageType: "order_status_update",
        orderId,
        status: newStatus,
        automated: customMessage ? false : true,
      },
    },
  });

  // Store quick audit record
  try {
    await db
      .collection("businesses")
      .doc(distributorId)
      .collection("whatsappOrders")
      .doc(orderId)
      .collection("notifications")
      .add({
        type: "status_update",
        status: newStatus,
        message,
        messageId: res.messageId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        mode: customMessage ? "manual" : "auto",
      });
  } catch (e) {
    console.warn("Could not write notifications audit (non-critical):", e);
  }

  return res;
}

/**
 * Auto notify when order status changes.
 */
exports.whatsappOrderStatusNotifier = onDocumentUpdated(
  {
    document: "businesses/{distributorId}/whatsappOrders/{orderId}",
    region: "us-central1",
    // Needed for sending WhatsApp messages in non-test mode
    secrets: [whatsappMessaging._META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (event) => {
    const distributorId = event.params.distributorId;
    const orderId = event.params.orderId;
    const before = event.data?.before?.data?.() || {};
    const after = event.data?.after?.data?.() || {};

    const beforeStatus = before.status;
    const afterStatus = after.status;

    // Only notify on status changes
    if (!afterStatus || beforeStatus === afterStatus) return;

    // Only notify for WhatsApp bot orders (optional safety)
    if (after.source && after.source !== "whatsapp_bot") return;

    const { ok } = await shouldAutoNotify(distributorId);
    if (!ok) return;

    try {
      await sendStatusNotification({
        distributorId,
        orderId,
        orderData: after,
        newStatus: afterStatus,
      });
    } catch (e) {
      console.error("❌ Auto status notification failed:", e?.message || e);
    }
  }
);

/**
 * Manual notify action from dashboard.
 */
exports.sendOrderUpdateNotification = onCall(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60,
    // Needed for sending WhatsApp messages in non-test mode
    secrets: [whatsappMessaging._META_SYSTEM_USER_TOKEN_SECRET],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

    const { orderId, status, message } = request.data || {};
    if (!orderId) throw new HttpsError("invalid-argument", "orderId is required");

    const orderRef = db.collection("businesses").doc(uid).collection("whatsappOrders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Order not found");

    const orderData = snap.data() || {};
    const newStatus = status || orderData.status || "pending";

    try {
      const res = await sendStatusNotification({
        distributorId: uid,
        orderId,
        orderData,
        newStatus,
        customMessage: message || null,
      });
      return { success: true, messageId: res.messageId || null };
    } catch (e) {
      throw new HttpsError("internal", e?.message || "Failed to notify customer");
    }
  }
);

