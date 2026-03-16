/**
 * Online Orders Integration — UrbanPiper middleware for Swiggy & Zomato
 *
 * Functions exported:
 *   urbanPiperWebhook  — HTTPS endpoint UrbanPiper POSTs new orders to
 *   onlineOrderAction  — Callable: accept / reject an online order
 *
 * Webhook URL to configure in UrbanPiper dashboard:
 *   https://us-central1-stockpilotv1.cloudfunctions.net/urbanPiperWebhook?bizId=<firebase_uid>
 */

const { onRequest }   = require("firebase-functions/v2/https");
const { onCall }      = require("firebase-functions/v2/https");
const admin           = require("firebase-admin");
const axios           = require("axios");

const db = () => admin.firestore();

const URBANPIPER_BASE = "https://api.urbanpiper.com";

// ── Platform colour labels (used as metadata only) ───────────────────────────
const PLATFORM = {
  swiggy:  { label: "Swiggy",  color: "orange" },
  zomato:  { label: "Zomato",  color: "red"    },
  dunzo:   { label: "Dunzo",   color: "blue"   },
  magicpin:{ label: "Magicpin",color: "pink"   },
};
const normPlatform = (ch = "") => (ch || "").toLowerCase().replace(/\s/g, "");

// ── Normalise UrbanPiper order → our kitchenOrder schema ────────────────────
function normaliseOrder(up, bizId) {
  const platform = normPlatform(up.channel || up.ext_platforms?.[0]?.name || "online");
  const meta     = PLATFORM[platform] || { label: platform, color: "gray" };

  return {
    // Source / tracking
    source:          platform,              // "swiggy" | "zomato" | …
    sourceLabel:     meta.label,
    sourceColor:     meta.color,
    urbanPiperOrderId: String(up.id || ""),
    channelOrderId:  up.channel_order_id || up.ext_platforms?.[0]?.id || "",
    bizId,

    // Customer (Swiggy/Zomato mask the number — show what's available)
    customerName:  up.customer?.name  || "Online Customer",
    customerPhone: up.customer?.phone || "",
    deliveryAddress: [
      up.customer?.address?.line1,
      up.customer?.address?.line2,
      up.customer?.address?.city,
    ].filter(Boolean).join(", "),

    // Items — normalise to our { product:{name,price}, qty, note } shape
    items: (up.items || []).map(it => ({
      product: {
        id:    String(it.id || it.option_id || ""),
        name:  it.name || it.title || "Item",
        price: Number(it.price || 0),
      },
      qty:  Number(it.quantity || 1),
      note: it.instructions || it.note || "",
      // Extras / modifiers
      addons: (it.options_to_add || it.modifiers || []).map(a => ({
        name: a.name || a.title,
        price: Number(a.price || 0),
      })),
    })),

    // Totals
    totals: {
      subTotal:   Number(up.order_subtotal || 0),
      tax:        (up.taxes || []).reduce((s, t) => s + Number(t.value || 0), 0),
      discount:   Number(up.discount || 0),
      grandTotal: Number(up.order_total || up.total || 0),
    },

    // Payment
    paymentType: up.payment_option === "prepaid" ? "prepaid" : "cod",
    paymentStatus: up.payment_option === "prepaid" ? "paid" : "pending",

    // Order type: delivery | pickup
    orderType: up.order_type || up.fulfillment_mode || "delivery",

    // Status lifecycle — starts at "new" (waiting for restaurant accept/reject)
    status:      "new",
    tableId:     null,
    tableName:   null,

    // Timestamps
    createdAt:     Date.now(),
    channelCreatedAt: up.created_at ? new Date(up.created_at).getTime() : Date.now(),
  };
}

// ── Helper: get UrbanPiper creds for a business ──────────────────────────────
async function getUPCreds(bizId) {
  const snap = await db()
    .collection("businesses").doc(bizId)
    .collection("onlineIntegrations").doc("urbanpiper")
    .get();
  if (!snap.exists) throw new Error("UrbanPiper not configured for this business");
  const d = snap.data();
  if (!d.apiUsername || !d.apiKey) throw new Error("UrbanPiper API credentials missing");
  return d;
}

// ── FUNCTION 1: urbanPiperWebhook ────────────────────────────────────────────
exports.urbanPiperWebhook = onRequest(
  { region: "us-central1", cors: false },
  async (req, res) => {
    // UrbanPiper uses POST
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const bizId = req.query.bizId;
    if (!bizId) return res.status(400).json({ error: "Missing bizId query param" });

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
    }

    try {
      // Optional: validate shared secret header if configured
      const snap = await db()
        .collection("businesses").doc(bizId)
        .collection("onlineIntegrations").doc("urbanpiper")
        .get();

      if (snap.exists && snap.data()?.webhookSecret) {
        const secret = snap.data().webhookSecret;
        const incoming = req.headers["x-urbanpiper-secret"] || req.headers["x-hub-signature"] || "";
        if (incoming && incoming !== secret) {
          return res.status(401).json({ error: "Invalid webhook secret" });
        }
      }

      // Handle event types
      const eventType = body.event_type || body.state || "new_order";

      if (["new_order", "order_placed", "placed"].includes(eventType)) {
        const order = normaliseOrder(body, bizId);
        const ref = await db()
          .collection("businesses").doc(bizId)
          .collection("kitchenOrders")
          .add(order);

        console.log(`[UrbanPiper] New ${order.sourceLabel} order ${order.channelOrderId} → ${ref.id}`);
        return res.status(200).json({ success: true, firestoreId: ref.id });
      }

      if (["order_cancelled", "cancelled"].includes(eventType)) {
        const channelOrderId = body.channel_order_id || String(body.id || "");
        if (channelOrderId) {
          const q = await db()
            .collection("businesses").doc(bizId)
            .collection("kitchenOrders")
            .where("channelOrderId", "==", channelOrderId)
            .limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.update({ status: "cancelled", cancelledAt: Date.now(), updatedAt: Date.now() });
          }
        }
        return res.status(200).json({ success: true });
      }

      // Unknown event — still ACK so UrbanPiper doesn't retry
      return res.status(200).json({ success: true, note: `Event ${eventType} not handled` });

    } catch (err) {
      console.error("[UrbanPiper Webhook Error]", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ── FUNCTION 2: onlineOrderAction (callable) ─────────────────────────────────
// action: "accept" | "reject"
// prepTime: number (minutes, for accept)
// rejectReason: string (for reject)
exports.onlineOrderAction = onCall(
  { region: "us-central1" },
  async (request) => {
    const { bizId, firestoreOrderId, action, prepTime = 20, rejectReason = "item_unavailable" } = request.data;
    const uid = request.auth?.uid;

    if (!uid || uid !== bizId) throw new Error("Unauthorized");
    if (!["accept", "reject"].includes(action)) throw new Error("Invalid action");

    // Get the kitchenOrder
    const orderRef = db()
      .collection("businesses").doc(bizId)
      .collection("kitchenOrders").doc(firestoreOrderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error("Order not found");
    const order = orderSnap.data();

    if (!order.urbanPiperOrderId) throw new Error("No UrbanPiper order ID on this order");

    let creds;
    try { creds = await getUPCreds(bizId); } catch (e) {
      // No UrbanPiper creds — just update local Firestore status
      const newStatus = action === "accept" ? "accepted" : "rejected";
      await orderRef.update({ status: newStatus, updatedAt: Date.now() });
      return { success: true, local: true };
    }

    const authHeader = `apikey ${creds.apiUsername}:${creds.apiKey}`;
    const upOrderId  = order.urbanPiperOrderId;

    try {
      if (action === "accept") {
        await axios.post(
          `${URBANPIPER_BASE}/api/v2/orders/${upOrderId}/accept/`,
          { prep_time: Number(prepTime) },
          { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
        );
        await orderRef.update({
          status: "accepted",
          prepTime: Number(prepTime),
          acceptedAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        await axios.post(
          `${URBANPIPER_BASE}/api/v2/orders/${upOrderId}/cancel/`,
          { cancellation_reason: rejectReason },
          { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
        );
        await orderRef.update({
          status: "rejected",
          rejectReason,
          rejectedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      return { success: true };
    } catch (axiosErr) {
      const msg = axiosErr.response?.data?.message || axiosErr.message;
      throw new Error(`UrbanPiper API error: ${msg}`);
    }
  }
);

// ── FUNCTION 3: syncUrbanPiperOrders (callable) ──────────────────────────────
// Manually poll UrbanPiper for pending orders — useful for initial setup / catch-up
exports.syncUrbanPiperOrders = onCall(
  { region: "us-central1" },
  async (request) => {
    const { bizId } = request.data;
    const uid = request.auth?.uid;
    if (!uid || uid !== bizId) throw new Error("Unauthorized");

    const creds = await getUPCreds(bizId);
    const authHeader = `apikey ${creds.apiUsername}:${creds.apiKey}`;

    const resp = await axios.get(
      `${URBANPIPER_BASE}/api/v2/hub/orders/?order_state=new&ordering=-created_at&limit=20`,
      { headers: { Authorization: authHeader } }
    );

    const orders = resp.data?.objects || resp.data?.results || [];
    let added = 0;

    for (const up of orders) {
      const channelOrderId = up.channel_order_id || String(up.id);
      // Check if already exists
      const existing = await db()
        .collection("businesses").doc(bizId)
        .collection("kitchenOrders")
        .where("channelOrderId", "==", channelOrderId)
        .limit(1).get();
      if (!existing.empty) continue;

      const order = normaliseOrder(up, bizId);
      await db().collection("businesses").doc(bizId).collection("kitchenOrders").add(order);
      added++;
    }

    return { success: true, synced: added, total: orders.length };
  }
);
