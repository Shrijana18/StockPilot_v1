import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { motion } from "framer-motion";

// UI helpers (presentational only)
const GlassCard = ({ className = "", children }) => (
  <div
    className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl hover:shadow-emerald-400/10 hover:scale-[1.005] transition duration-300 vignette ${className}`}
  >
    {children}
  </div>
);

const Pill = ({ children, tone = "neutral" }) => {
  const map = {
    neutral: "bg-white/10 text-white/90",
    orange: "bg-orange-400/15 text-orange-300",
    indigo: "bg-indigo-400/15 text-indigo-300",
    cyan: "bg-cyan-400/15 text-cyan-300",
    emerald: "bg-emerald-400/15 text-emerald-300",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[tone] || map.neutral}`}>{children}</span>
  );
};

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const pickFirst = (...vals) => vals.find((v) => v != null && v !== "");

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return null;
};

const getOrderTotal = (order) => {
  if (!order || typeof order !== "object") return 0;

  // 1) Prefer latest charges snapshot breakdown
  const breakdown = order?.chargesSnapshot?.breakdown;
  if (breakdown && breakdown.grandTotal != null) {
    return Number(breakdown.grandTotal) || 0;
  }

  // Also check a flat grandTotal on chargesSnapshot just in case
  if (order?.chargesSnapshot?.grandTotal != null) {
    return Number(order.chargesSnapshot.grandTotal) || 0;
  }

  // 2) Fallback to proforma grandTotal (for credit cycle orders that use proforma)
  if (order?.proforma?.grandTotal != null) {
    return Number(order.proforma.grandTotal) || 0;
  }

  // 3) If nothing above, fall back to summing items
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items.reduce((sum, item) => {
      if (!item) return sum;
      const qty = Number(item.quantity ?? item.qty ?? 0) || 0;
      const price = Number(
        item.unitPrice ??
          item.price ??
          item.sellingPrice ??
          item.rate ??
          item.mrp ??
          0
      ) || 0;
      return sum + qty * price;
    }, 0);
  }

  // 4) Final fallbacks: itemsSubTotal / totalAmount style fields
  if (order?.chargesSnapshot?.breakdown?.itemsSubTotal != null) {
    return Number(order.chargesSnapshot.breakdown.itemsSubTotal) || 0;
  }
  if (order?.itemsSubTotal != null) {
    return Number(order.itemsSubTotal) || 0;
  }
  if (order?.totalAmount != null) {
    return Number(order.totalAmount) || 0;
  }

  return 0;
};

// Detect if an order is a credit-cycle order (handles Active, Passive, legacy)
const isCreditOrder = (order) => {
  try {
    // Explicit flag in paymentSummary.mode (your current schema)
    if (order?.paymentSummary?.mode?.isCredit === true) return true;

    // Legacy / other flows
    if (order?.paymentFlags?.isCredit === true) return true;

    const code =
      order?.paymentNormalized?.code ||
      order?.paymentMode ||
      order?.paymentMethod ||
      "";

    if (typeof code === "string" && /credit[_\s-]*cycle|credit/i.test(code)) {
      return true;
    }

    const label =
      order?.paymentNormalized?.label ||
      order?.paymentModeLabel ||
      "";

    if (typeof label === "string" && /credit/i.test(label)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const getDeliveredAt = (order) => {
  // common variants across active/passive/legacy flows
  const raw =
    pickFirst(
      order?.deliveredAt,
      order?.deliveredAtMs,
      order?.delivered_on,
      order?.delivered_on_ms,
      order?.statusTimestamps?.deliveredAt,
      order?.statusTimestamps?.delivered,
      order?.statusTimeline?.deliveredAt,
      order?.timestamps?.deliveredAt,
      order?.completedAt,
      order?.updatedAt // last fallback if nothing else
    );
  return toDate(raw);
};

// Compute credit due date from canonical fields; prefer explicit creditDueDate if present
const computeCreditDueDate = (order) => {
  // 1) explicit due
  const explicitDue = toDate(order?.creditDueDate);
  if (explicitDue) {
    explicitDue.setHours(0,0,0,0);
    return explicitDue;
  }
  // 2) deliveredAt + creditDays
  const deliveredAt = getDeliveredAt(order);
  if (!deliveredAt) return null;

  const creditDays =
    Number(
      order?.paymentNormalized?.creditDays ??
      order?.paymentSummary?.creditDueDays ??
      order?.creditDays ??
      order?.payment?.creditDays ??
      order?.payment?.creditDueDays ??
      0
    ) || 0;

  if (creditDays <= 0) return null;
  const due = new Date(deliveredAt);
  due.setHours(0,0,0,0);
  due.setDate(due.getDate() + creditDays);
  return due;
};

const DistributorCreditDue = () => {
  const [snapshot, setSnapshot] = useState({
    totalDueOrders: 0,
    dueToday: { amount: 0, retailers: [] },
    dueTomorrow: { amount: 0, retailers: [] },
  });

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const distributorId = user.uid;
      const reqRef = collection(db, "businesses", distributorId, "orderRequests");
      const ordersRef = collection(db, "businesses", distributorId, "orders");
      const [reqSnap, ordersSnap] = await Promise.all([getDocs(reqRef), getDocs(ordersRef)]);
      const allDocs = [...reqSnap.docs, ...ordersSnap.docs];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      let totalDueOrders = 0;
      let dueTodayAmount = 0;
      let dueTomorrowAmount = 0;
      let dueTodayRetailers = new Set();
      let dueTomorrowRetailers = new Set();
      allDocs.forEach((doc) => {
        const order = doc.data();
        const statusCode = (order.statusCode || order.status || "").toString().toUpperCase();
        const isDelivered = statusCode === "DELIVERED" || order.status === "Delivered";
        const isPaid = order.isPaid === true || order.paymentStatus === "Paid";

        if (!isPaid && isDelivered && isCreditOrder(order)) {
          const dueDate = computeCreditDueDate(order);
          if (dueDate) {
            totalDueOrders += 1;
            const totalAmount = getOrderTotal(order);
            const retailerName = order.retailerName || order.retailer || "Unknown";
            if (isSameDay(dueDate, today)) {
              dueTodayAmount += totalAmount;
              dueTodayRetailers.add(retailerName);
            } else if (isSameDay(dueDate, tomorrow)) {
              dueTomorrowAmount += totalAmount;
              dueTomorrowRetailers.add(retailerName);
            }
          }
        }
      });
      setSnapshot({
        totalDueOrders,
        dueToday: {
          amount: dueTodayAmount,
          retailers: Array.from(dueTodayRetailers),
        },
        dueTomorrow: {
          amount: dueTomorrowAmount,
          retailers: Array.from(dueTomorrowRetailers),
        },
      });
    };
    fetchData();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="max-w-md text-white"
    >
      <GlassCard className="p-5">
        <div className="relative mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            <span>🧾</span> Credit Due Snapshot
          </h3>
          <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
        </div>

        <div className="flex flex-wrap gap-2 mb-3 text-xs">
          <Pill tone="cyan">Due Today {inr.format(snapshot.dueToday.amount)}</Pill>
          <Pill tone="indigo">Due Tomorrow {inr.format(snapshot.dueTomorrow.amount)}</Pill>
          <Pill tone="emerald">Total Due Orders {snapshot.totalDueOrders}</Pill>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white/70">Total Due Orders</span>
            <span className="font-semibold">{snapshot.totalDueOrders}</span>
          </div>

          <div aria-label="Due today amount">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Due Today</span>
              <span className="font-semibold text-orange-300">{inr.format(snapshot.dueToday.amount)}</span>
            </div>
            {snapshot.dueToday.retailers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {snapshot.dueToday.retailers.slice(0,3).map((r) => (
                  <span key={r} className="px-2 py-0.5 text-xs rounded-full bg-orange-400/15 text-orange-300 border border-orange-300/20">{r}</span>
                ))}
                {snapshot.dueToday.retailers.length > 3 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/80 border border-white/15">+{snapshot.dueToday.retailers.length - 3} more</span>
                )}
              </div>
            )}
          </div>

          <div aria-label="Due tomorrow amount">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Due Tomorrow</span>
              <span className="font-semibold text-indigo-300">{inr.format(snapshot.dueTomorrow.amount)}</span>
            </div>
            {snapshot.dueTomorrow.retailers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {snapshot.dueTomorrow.retailers.slice(0,3).map((r) => (
                  <span key={r} className="px-2 py-0.5 text-xs rounded-full bg-indigo-400/15 text-indigo-300 border border-indigo-300/20">{r}</span>
                ))}
                {snapshot.dueTomorrow.retailers.length > 3 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/80 border border-white/15">+{snapshot.dueTomorrow.retailers.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default DistributorCreditDue;