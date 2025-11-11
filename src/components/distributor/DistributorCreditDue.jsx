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

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
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
  const breakdown = order?.chargesSnapshot?.breakdown;
  if (breakdown && breakdown.grandTotal != null) return Number(breakdown.grandTotal) || 0;
  if (order?.proforma?.grandTotal != null) return Number(order.proforma.grandTotal) || 0;
  if (Array.isArray(order?.items)) {
    return order.items.reduce((sum, item) => {
      const qty = Number(item.quantity ?? item.qty ?? 0);
      const price = Number(item.price ?? item.unitPrice ?? item.sellingPrice ?? 0);
      return sum + qty * price;
    }, 0);
  }
  if (order?.itemsSubTotal != null) return Number(order.itemsSubTotal) || 0;
  if (order?.totalAmount != null) return Number(order.totalAmount) || 0;
  return 0;
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
      const orderRef = collection(db, "businesses", distributorId, "orderRequests");
      const querySnap = await getDocs(orderRef);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      let totalDueOrders = 0;
      let dueTodayAmount = 0;
      let dueTomorrowAmount = 0;
      let dueTodayRetailers = new Set();
      let dueTomorrowRetailers = new Set();
      querySnap.forEach((doc) => {
        const order = doc.data();
        const statusCode = (order.statusCode || order.status || "").toString().toUpperCase();
        const isDelivered = statusCode === "DELIVERED" || order.status === "Delivered";
        const isPaid = order.isPaid === true || order.paymentStatus === "Paid";
        const creditDays =
          Number(
            order.creditDays ??
            order.payment?.creditDays ??
            order.paymentSummary?.creditDueDays ??
            order.payment?.creditDueDays ??
            0
          ) || 0;

        if (!isPaid && isDelivered && creditDays > 0) {
          totalDueOrders += 1;
          // Parse deliveredAt and creditDays
          const deliveredAt =
            toDate(order.deliveredAt) ||
            toDate(order.statusTimestamps?.deliveredAt);
          if (deliveredAt && !isNaN(deliveredAt.getTime())) {
            const dueDate = addDays(deliveredAt, creditDays);
            dueDate.setHours(0, 0, 0, 0);
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