import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePOSTheme } from "../POSThemeContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import {
  collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc,
  where, getDocs, updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import DailySalesExpenses from "./DailySalesExpenses";

const uid = () => auth.currentUser?.uid;
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtK = (n) => n >= 1000 ? `₹${(n/1000).toFixed(1)}k` : fmt(n);
const PCT_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

// ── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-xl px-3 py-2 shadow-2xl text-xs">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.name?.includes("₹") || p.dataKey === "revenue" ? fmt(p.value) : p.value}</p>
      ))}
    </div>
  );
};

// ── Stat Card ──────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, sub, color = "emerald", trend }) => {
  const colors = {
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-300",
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-300",
    violet: "from-violet-500/10 to-violet-500/5 border-violet-500/20 text-violet-300",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-300",
    red: "from-red-500/10 to-red-500/5 border-red-500/20 text-red-300",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-300",
  };
  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={`rounded-2xl border bg-gradient-to-br p-4 backdrop-blur-sm shadow-sm ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        {trend != null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black mt-2">{value}</p>
      <p className="text-xs font-semibold opacity-80 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SALES TAB
// ─────────────────────────────────────────────────────────────────────────────
function SalesTab() {
  const { tc } = usePOSTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("sales"); // sales | expenses // 7d | 30d | 90d | all

  // Reactive uid — covers auth race when component mounts before IndexedDB restores
  const [uidVal, setUidVal] = useState(() => uid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUidVal(u?.uid || null)), []);

  useEffect(() => {
    if (!uidVal) { setLoading(false); return; }
    const ref = collection(db, "businesses", uidVal, "kitchenOrders");
    const unsubscribe = onSnapshot(ref, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(docs);
      setLoading(false);
    }, (err) => { console.warn("[Analytics] kitchenOrders error:", err?.message); setLoading(false); });
    return unsubscribe;
  }, [uidVal]);

  const cutoff = useMemo(() => {
    if (range === "all") return 0;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return Date.now() - days * 86400000;
  }, [range]);

  const filtered = useMemo(
    () => orders.filter(o => (o.createdAt || 0) >= cutoff),
    [orders, cutoff]
  );

  // ── Revenue by day ──────────────────────────────────────────────────────
  const dailyRevenue = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const d = new Date(o.createdAt || Date.now());
      const key = `${d.getDate()}/${d.getMonth()+1}`;
      const rev = o.totals?.grandTotal || o.totals?.subTotal || 0;
      map[key] = (map[key] || 0) + rev;
    });
    return Object.entries(map).map(([date, revenue]) => ({ date, revenue: +revenue.toFixed(2) })).slice(-14);
  }, [filtered]);

  // ── Top items ───────────────────────────────────────────────────────────
  const topItems = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      (o.items || o.lines || []).forEach(line => {
        const name = line.product?.name || line.name || "Unknown";
        const price = Number(line.product?.price || 0);
        const qty = line.qty || 1;
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
        map[name].qty += qty;
        map[name].revenue += price * qty;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filtered]);

  // ── Low sellers ─────────────────────────────────────────────────────────
  const lowItems = useMemo(
    () => [...topItems].sort((a, b) => a.qty - b.qty).slice(0, 5),
    [topItems]
  );

  // ── Sales by hour bucket ─────────────────────────────────────────────────
  const salesByTime = useMemo(() => {
    const buckets = [
      { label: "Morning\n6–11", key: "morning", range: [6,11], orders: 0, revenue: 0 },
      { label: "Lunch\n12–15", key: "lunch",   range: [12,15], orders: 0, revenue: 0 },
      { label: "Evening\n16–19", key: "evening", range: [16,19], orders: 0, revenue: 0 },
      { label: "Dinner\n20–23", key: "dinner",  range: [20,23], orders: 0, revenue: 0 },
      { label: "Late Night\n0–5", key: "late",  range: [0,5],  orders: 0, revenue: 0 },
    ];
    filtered.forEach(o => {
      const hr = new Date(o.createdAt || Date.now()).getHours();
      const b = buckets.find(b => hr >= b.range[0] && hr <= b.range[1]);
      if (b) { b.orders++; b.revenue += o.totals?.grandTotal || 0; }
    });
    return buckets.map(b => ({ label: b.label, orders: b.orders, revenue: +b.revenue.toFixed(0) }));
  }, [filtered]);

  // ── Customer stats ───────────────────────────────────────────────────────
  const customerStats = useMemo(() => {
    const custMap = {};
    filtered.forEach(o => {
      const cid = o.customerId || o.tableName || `table-${o.tableId}` || "walk-in";
      if (!custMap[cid]) custMap[cid] = { id: cid, visits: 0, revenue: 0 };
      custMap[cid].visits++;
      custMap[cid].revenue += o.totals?.grandTotal || 0;
    });
    const list = Object.values(custMap).sort((a, b) => b.revenue - a.revenue);
    const returning = list.filter(c => c.visits > 1).length;
    const retentionRate = list.length ? Math.round((returning / list.length) * 100) : 0;
    return { top: list.slice(0, 5), retentionRate, total: list.length, returning };
  }, [filtered]);

  // ── Summary stats ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const revenue = filtered.reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
    const ordersCount = filtered.length;
    const avgOrder = ordersCount ? revenue / ordersCount : 0;
    const itemsSold = filtered.reduce((s, o) => s + (o.items || o.lines || []).reduce((a, l) => a + (l.qty || 1), 0), 0);
    return { revenue, ordersCount, avgOrder, itemsSold };
  }, [filtered]);

  // ── Payment mode breakdown ──────────────────────────────────────────────
  const paymentBreakdown = useMemo(() => {
    const modes = {};
    filtered.forEach(o => {
      const payments = o.payments || [];
      if (payments.length > 0) {
        payments.forEach(p => {
          const method = (p.method || p.type || "Other").toLowerCase();
          const normalizedMethod = 
            method.includes("cash") ? "Cash" :
            method.includes("upi") ? "UPI" :
            method.includes("card") || method.includes("pos") ? "Card/POS" :
            "Other";
          const amount = Number(p.amount || 0);
          modes[normalizedMethod] = (modes[normalizedMethod] || 0) + amount;
        });
      } else {
        const method = o.meta?.paymentMethod || o.paymentMode || "Other";
        const normalizedMethod = 
          method.toLowerCase().includes("cash") ? "Cash" :
          method.toLowerCase().includes("upi") ? "UPI" :
          method.toLowerCase().includes("card") || method.toLowerCase().includes("pos") ? "Card/POS" :
          "Other";
        const amount = o.totals?.grandTotal || 0;
        modes[normalizedMethod] = (modes[normalizedMethod] || 0) + amount;
      }
    });
    return Object.entries(modes).map(([method, amount]) => ({
      method,
      amount: +amount.toFixed(2),
      color: 
        method === "Cash" ? "#10b981" :
        method === "UPI" ? "#8b5cf6" :
        method === "Card/POS" ? "#3b82f6" :
        "#f59e0b"
    })).sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="text-4xl">📊</motion.div>
    </div>
  );

  // If Daily Sales & Expenses tab is active, render it with the nav bar so user can switch back
  if (activeTab === "expenses") {
    return (
      <div className="space-y-6">
        <div className={`flex gap-1 p-1 rounded-xl border backdrop-blur-sm ${tc.themeBtn}`}>
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tc.textMuted} hover:bg-white/[0.06]`}
          >📊 Sales Analytics</button>
          <button
            onClick={() => setActiveTab("expenses")}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
          >📝 Daily Sales & Expenses</button>
        </div>
        <DailySalesExpenses />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className={`flex gap-1 p-1 rounded-xl border backdrop-blur-sm ${tc.themeBtn}`}>
        <button
          onClick={() => setActiveTab("sales")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "sales"
              ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25"
              : `${tc.textMuted} hover:bg-white/[0.06]`
          }`}
        >
          📊 Sales Analytics
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "expenses"
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
              : `${tc.textMuted} hover:bg-white/[0.06]`
          }`}
        >
          📝 Daily Sales & Expenses
        </button>
      </div>

      {/* Range selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className={`text-xl font-black ${tc.textPrimary}`}>Sales Analytics</h2>
          <p className={`text-xs mt-0.5 ${tc.textMuted}`}>{filtered.length} orders in selected period</p>
        </div>
        <div className={`flex gap-1 p-1 rounded-xl border backdrop-blur-sm ${tc.themeBtn}`}>
          {[["7d","7 Days"],["30d","30 Days"],["90d","90 Days"],["all","All Time"]].map(([k,l]) => (
            <motion.button key={k} whileTap={{ scale: 0.96 }} onClick={() => setRange(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === k
                  ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-violet-500/25"
                  : `${tc.textMuted} hover:bg-white/[0.06]`
              }`}
            >{l}</motion.button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="💰" label="Total Revenue"  value={fmtK(summary.revenue)}     color="emerald" />
        <StatCard icon="📦" label="Total Orders"    value={summary.ordersCount}        color="blue" />
        <StatCard icon="🧾" label="Avg Order Value" value={fmt(summary.avgOrder)}      color="violet" />
        <StatCard icon="🍽️" label="Items Sold"       value={summary.itemsSold}          color="amber" />
      </div>

      {/* Revenue chart */}
      <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
        <h3 className={`text-sm font-bold mb-4 ${tc.textSub}`}>Revenue Over Time</h3>
        {dailyRevenue.length === 0 ? (
          <p className={`text-xs text-center py-8 ${tc.textMuted}`}>No data yet — orders will appear here after checkout</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <YAxis tickFormatter={fmtK} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top items + Low sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top items by quantity */}
        <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
          <h3 className={`text-sm font-bold mb-4 ${tc.textSub}`}>🏆 Top Selling Items</h3>
          {topItems.length === 0 ? (
            <p className={`text-xs text-center py-6 ${tc.textMuted}`}>No orders yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topItems.slice(0,6)} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="qty" fill="#6366f1" radius={[0, 6, 6, 0]} name="Qty Sold">
                  {topItems.slice(0,6).map((_, i) => <Cell key={i} fill={PCT_COLORS[i % PCT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales by time of day */}
        <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
          <h3 className={`text-sm font-bold mb-4 ${tc.textSub}`}>⏰ Sales by Time of Day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesByTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" fill="#f59e0b" radius={[6,6,0,0]} name="Orders">
                {salesByTime.map((_, i) => <Cell key={i} fill={`hsl(${220 + i*20},70%,60%)`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Mode Breakdown */}
      <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-bold ${tc.textSub}`}>💳 Payment Mode Breakdown</h3>
          <span className={`text-[10px] ${tc.textMuted}`}>cash collected by method</span>
        </div>
        {paymentBreakdown.length === 0 ? (
          <p className={`text-xs text-center py-8 ${tc.textMuted}`}>No payment data yet</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {paymentBreakdown.map((pm, i) => (
              <motion.div
                key={pm.method}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border p-4 text-center"
                style={{ 
                  backgroundColor: `${pm.color}15`,
                  borderColor: `${pm.color}40`
                }}
              >
                <div className="text-2xl mb-2">
                  {pm.method === "Cash" ? "💵" : pm.method === "UPI" ? "📲" : pm.method === "Card/POS" ? "💳" : "🔄"}
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: pm.color }}>{pm.method}</p>
                <p className="text-lg font-black" style={{ color: pm.color }}>{fmt(pm.amount)}</p>
                <p className={`text-[9px] mt-1 ${tc.textMuted}`}>
                  {((pm.amount / summary.revenue) * 100).toFixed(1)}% of total
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Top items ranked list + customer retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top items revenue list */}
        <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold ${tc.textSub}`}>📈 Item Performance</h3>
            <span className={`text-[10px] ${tc.textMuted}`}>by revenue</span>
          </div>
          <div className="space-y-2">
            {topItems.slice(0,7).map((item, i) => {
              const maxRev = topItems[0]?.revenue || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : `${tc.mutedBg} ${tc.textMuted}`}`}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-xs font-semibold truncate pr-2 ${tc.textSub}`}>{item.name}</p>
                      <p className="text-xs text-emerald-300 font-bold shrink-0">{fmt(item.revenue)}</p>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${tc.mutedBg}`}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(item.revenue / maxRev) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.05 }}
                        style={{ background: PCT_COLORS[i % PCT_COLORS.length] }} className="h-full rounded-full"
                      />
                    </div>
                    <p className={`text-[9px] mt-0.5 ${tc.textMuted}`}>{item.qty} orders</p>
                  </div>
                </div>
              );
            })}
            {topItems.length === 0 && <p className={`text-xs text-center py-4 ${tc.textMuted}`}>No sales data yet</p>}
          </div>
        </div>

        {/* Customer & retention */}
        <div className={`rounded-2xl border p-5 shadow-sm flex flex-col gap-4 ${tc.cardBg}`}>
          <h3 className={`text-sm font-bold ${tc.textSub}`}>👥 Customer Insights</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-violet-500/8 border border-violet-500/20 p-3 text-center">
              <p className="text-2xl font-black text-violet-300">{customerStats.total}</p>
              <p className="text-[10px] text-violet-300/60 mt-0.5">Unique Customers</p>
            </div>
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3 text-center">
              <p className="text-2xl font-black text-emerald-300">{customerStats.retentionRate}%</p>
              <p className="text-[10px] text-emerald-300/60 mt-0.5">Retention Rate</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${tc.textMuted}`}>Top Customers</p>
            {customerStats.top.length === 0 ? (
              <p className={`text-xs italic ${tc.textMuted}`}>Add customer info during checkout to track</p>
            ) : (
              customerStats.top.map((c, i) => (
                <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-xl transition hover:${tc.mutedBg}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-blue-400 flex items-center justify-center text-[10px] font-black text-white">{i+1}</span>
                    <p className={`text-xs font-medium truncate max-w-[100px] ${tc.textSub}`}>{c.id}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${tc.textPrimary}`}>{fmt(c.revenue)}</p>
                    <p className={`text-[9px] ${tc.textMuted}`}>{c.visits} visit{c.visits > 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Low sellers alert */}
          {lowItems.length > 0 && (
            <div className="rounded-xl bg-red-500/6 border border-red-500/15 p-3">
              <p className="text-[10px] text-red-300/70 font-bold uppercase tracking-wider mb-2">⚠️ Low Sellers — consider promotion</p>
              <div className="flex flex-wrap gap-1">
                {lowItems.map((item, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-300/70">{item.name} ({item.qty})</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSES TAB
// ─────────────────────────────────────────────────────────────────────────────
const EXPENSE_CATS = [
  { key: "ingredients",  label: "Ingredients",       icon: "🥬", color: "emerald" },
  { key: "staff",        label: "Staff / Salary",     icon: "👨‍🍳", color: "blue"    },
  { key: "rent",         label: "Rent / Utility",     icon: "🏠", color: "violet"  },
  { key: "equipment",    label: "Equipment",          icon: "🔧", color: "amber"   },
  { key: "marketing",    label: "Marketing",          icon: "📣", color: "pink"    },
  { key: "delivery",     label: "Delivery / Packing", icon: "📦", color: "orange"  },
  { key: "maintenance",  label: "Maintenance",        icon: "🛠️", color: "red"     },
  { key: "other",        label: "Other",              icon: "💼", color: "slate"   },
];

const CAT_COLORS_MAP = {
  emerald:"#10b981", blue:"#3b82f6", violet:"#8b5cf6", amber:"#f59e0b",
  pink:"#ec4899", orange:"#f97316", red:"#ef4444", slate:"#64748b",
};

const today = () => new Date().toISOString().slice(0,10);

function ExpensesTab() {
  const { tc } = usePOSTheme();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0,7));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "ingredients", amount: "", description: "", date: today(), note: "", recurring: false,
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Reactive uid — covers auth race when component mounts before IndexedDB restores
  const [uidVal, setUidVal] = useState(() => uid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUidVal(u?.uid || null)), []);

  useEffect(() => {
    if (!uidVal) { setLoading(false); return; }
    const ref = collection(db, "businesses", uidVal, "expenses");
    const unsubscribe = onSnapshot(
      query(ref, orderBy("date", "desc")),
      (snap) => { setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      (err) => { console.warn("[Expenses]", err?.message); setLoading(false); }
    );
    return unsubscribe;
  }, [uidVal]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = filterCat === "all" || e.category === filterCat;
      const matchMonth = !filterMonth || e.date?.startsWith(filterMonth);
      return matchCat && matchMonth;
    });
  }, [expenses, filterCat, filterMonth]);

  const summary = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const byCategory = {};
    filtered.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0);
    });
    const catData = EXPENSE_CATS.map(c => ({
      name: c.label, value: +(byCategory[c.key] || 0).toFixed(2), icon: c.icon, key: c.key, color: CAT_COLORS_MAP[c.color],
    })).filter(c => c.value > 0);
    return { total, catData };
  }, [filtered]);

  const resetForm = () => {
    setForm({ category: "ingredients", amount: "", description: "", date: today(), note: "", recurring: false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return;
    const u = uid();
    if (!u) return;
    setSaving(true);
    try {
      const data = { ...form, amount: Number(form.amount), createdAt: Date.now() };
      if (editingId) {
        await updateDoc(doc(db, "businesses", u, "expenses", editingId), data);
      } else {
        await addDoc(collection(db, "businesses", u, "expenses"), data);
      }
      resetForm();
    } finally { setSaving(false); }
  };

  const handleEdit = (exp) => {
    setForm({ category: exp.category, amount: String(exp.amount), description: exp.description || "", date: exp.date || today(), note: exp.note || "", recurring: exp.recurring || false });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const u = uid();
    if (!u) return;
    await deleteDoc(doc(db, "businesses", u, "expenses", id));
    setDeleteConfirm(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="text-4xl">💸</motion.div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-xl font-black ${tc.textPrimary}`}>Expense Tracker</h2>
          <p className={`text-xs mt-0.5 ${tc.textMuted}`}>{filtered.length} entries · {fmt(summary.total)} this period</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-bold shadow-lg shadow-rose-500/25 hover:from-rose-400 hover:to-pink-500 transition-all"
        >+ Add Expense</motion.button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="💸" label="Total Expenses"   value={fmtK(summary.total)}                      color="red" />
        <StatCard icon="📋" label="Entries"            value={filtered.length}                           color="blue" />
        <StatCard icon="📅" label="Avg per Entry"      value={filtered.length ? fmt(summary.total/filtered.length) : "—"} color="violet" />
        <StatCard icon="🔄" label="Recurring"          value={filtered.filter(e=>e.recurring).length}   color="amber" />
      </div>

      {/* Pie + Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie chart */}
        <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
          <h3 className={`text-sm font-bold mb-3 ${tc.textSub}`}>Category Breakdown</h3>
          {summary.catData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <span className="text-4xl opacity-20">💼</span>
              <p className={`text-sm ${tc.textMuted}`}>No expenses for this period</p>
              <button onClick={() => setShowForm(true)} className="mt-1 px-4 py-2 rounded-xl bg-rose-500/15 text-rose-300 text-xs font-bold border border-rose-500/25 hover:bg-rose-500/25 transition">Add First Expense</button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={summary.catData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {summary.catData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val) => fmt(val)} contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category bars */}
        <div className={`rounded-2xl border p-5 shadow-sm ${tc.cardBg}`}>
          <h3 className={`text-sm font-bold mb-3 ${tc.textSub}`}>By Category</h3>
          <div className="space-y-2.5">
            {summary.catData.length === 0 ? (
              <p className={`text-xs text-center py-6 ${tc.textMuted}`}>No data for this period</p>
            ) : (
              summary.catData.sort((a,b)=>b.value-a.value).map((cat, i) => {
                const pct = summary.total > 0 ? (cat.value / summary.total) * 100 : 0;
                const catMeta = EXPENSE_CATS.find(c => c.label === cat.name);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs flex items-center gap-1.5 ${tc.textSub}`}><span>{catMeta?.icon}</span>{cat.name}</span>
                      <span className={`text-xs font-bold ${tc.textPrimary}`}>{fmt(cat.value)}</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${tc.mutedBg}`}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.05 }}
                        style={{ background: cat.color }} className="h-full rounded-full"
                      />
                    </div>
                    <p className={`text-[9px] mt-0.5 ${tc.textMuted}`}>{pct.toFixed(1)}%</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`flex gap-1 p-1 rounded-xl border overflow-x-auto backdrop-blur-sm ${tc.themeBtn}`} style={{scrollbarWidth:"none"}}>
          <button onClick={() => setFilterCat("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
            filterCat==="all" ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm" : `${tc.textMuted} hover:bg-white/[0.06]`
          }`}>All</button>
          {EXPENSE_CATS.map(c => (
            <button key={c.key} onClick={() => setFilterCat(c.key)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 ${
              filterCat===c.key ? `${tc.themeBtnActive} ${tc.textPrimary}` : `${tc.textMuted} hover:bg-white/[0.06]`
            }`}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className={`px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-400/30 ${tc.inputBg}`}
        />
      </div>

      {/* Expense list */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${tc.cardBg}`}>
        <div className={`px-5 py-3 border-b flex items-center justify-between ${tc.borderSoft}`}>
          <h3 className={`text-sm font-bold ${tc.textSub}`}>Expense Entries</h3>
          <span className={`text-[10px] ${tc.textMuted}`}>{filtered.length} entries</span>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <span className="text-4xl opacity-20">📋</span>
            <p className={`text-sm ${tc.textMuted}`}>No expenses found</p>
          </div>
        ) : (
          <div className={`divide-y ${tc.borderSoft}`}>
            {filtered.map(exp => {
              const catMeta = EXPENSE_CATS.find(c => c.key === exp.category) || EXPENSE_CATS[EXPENSE_CATS.length-1];
              return (
                <motion.div key={exp.id} layout className={`flex items-center gap-3 px-5 py-3 transition group hover:${tc.mutedBg}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0`} style={{ background: `${CAT_COLORS_MAP[catMeta.color]}18`, border: `1px solid ${CAT_COLORS_MAP[catMeta.color]}30` }}>
                    {catMeta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${tc.textPrimary}`}>{exp.description || catMeta.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${tc.textMuted}`}>{exp.date}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${CAT_COLORS_MAP[catMeta.color]}18`, color: CAT_COLORS_MAP[catMeta.color] }}>{catMeta.label}</span>
                      {exp.recurring && <span className="text-[10px] text-amber-300/60 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">🔄 Recurring</span>}
                    </div>
                    {exp.note && <p className={`text-[10px] mt-0.5 truncate ${tc.textMuted}`}>{exp.note}</p>}
                  </div>
                  <p className="text-sm font-black text-rose-300 shrink-0">{fmt(exp.amount)}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => handleEdit(exp)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition ${tc.editBtn}`}>✏️</button>
                    {deleteConfirm === exp.id ? (
                      <button onClick={() => handleDelete(exp.id)} className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-bold hover:bg-red-500/30 transition">Confirm</button>
                    ) : (
                      <button onClick={() => setDeleteConfirm(exp.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition hover:bg-red-500/15 hover:text-red-400 ${tc.editBtn}`}>🗑️</button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${tc.overlayBg}`}
            onClick={e => { if (e.target === e.currentTarget) resetForm(); }}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl ${tc.modalBg}`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${tc.borderSoft}`}>
                <h3 className={`text-base font-black ${tc.textPrimary}`}>{editingId ? "Edit Expense" : "Add Expense"}</h3>
                <button onClick={resetForm} className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${tc.editBtn}`}>✕</button>
              </div>
              <div className="p-6 space-y-4">
                {/* Category selector */}
                <div>
                  <label className={`text-xs font-medium mb-2 block ${tc.textSub}`}>Category</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {EXPENSE_CATS.map(c => (
                      <button key={c.key} type="button" onClick={() => setForm(f => ({ ...f, category: c.key }))}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold transition ${form.category === c.key ? `border-2` : "border-white/8 bg-white/3 text-white/35 hover:bg-white/8"}`}
                        style={form.category === c.key ? { borderColor: CAT_COLORS_MAP[c.color], background: `${CAT_COLORS_MAP[c.color]}12`, color: CAT_COLORS_MAP[c.color] } : {}}
                      >
                        <span className="text-base">{c.icon}</span>
                        <span className="leading-tight text-center">{c.label.split("/")[0].trim()}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Amount */}
                <div>
                  <label className={`text-xs font-medium mb-1.5 block ${tc.textSub}`}>Amount (₹) *</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.textMuted}`}>₹</span>
                    <input type="number" min="0" step="1" autoFocus
                      value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0" className={`w-full pl-7 pr-3 py-3 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-rose-400/40 ${tc.inputBg}`}
                    />
                  </div>
                </div>
                {/* Description + Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs font-medium mb-1.5 block ${tc.textSub}`}>Description</label>
                    <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="e.g. Weekly veggies" className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30 ${tc.inputBg}`}
                    />
                  </div>
                  <div>
                    <label className={`text-xs font-medium mb-1.5 block ${tc.textSub}`}>Date</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30 ${tc.inputBg}`}
                    />
                  </div>
                </div>
                {/* Note */}
                <div>
                  <label className={`text-xs font-medium mb-1.5 block ${tc.textSub}`}>Note <span className={tc.textMuted}>(optional)</span></label>
                  <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Any extra details..." className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30 ${tc.inputBg}`}
                  />
                </div>
                {/* Recurring */}
                <button type="button" onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
                  className={`flex items-center gap-2 text-xs font-semibold transition px-3 py-2 rounded-xl w-full ${form.recurring ? "bg-amber-500/10 border border-amber-500/25 text-amber-300" : "bg-white/4 border border-white/10 text-white/40 hover:text-white/70"}`}
                >
                  <span className={`w-8 h-4 rounded-full relative transition-colors ${form.recurring ? "bg-amber-500" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${form.recurring ? "left-4" : "left-0.5"}`} />
                  </span>
                  🔄 This is a recurring expense
                </button>
                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={resetForm} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${tc.outlineBtn}`}>Cancel</button>
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving || !form.amount}
                    className="flex-2 flex-grow py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold shadow-lg shadow-rose-500/20 hover:opacity-90 transition disabled:opacity-50"
                  >{saving ? "Saving…" : editingId ? "Save Changes" : "Add Expense"}</motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ANALYTICS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPanel() {
  const { tc } = usePOSTheme();
  const [tab, setTab] = useState("sales");

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={tc.bg}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 w-[50%] h-[50%] rounded-full blur-[100px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 70%)` }} />
        <div className="absolute bottom-0 left-0 w-[45%] h-[45%] rounded-full blur-[100px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 70%)` }} />
      </div>

      {/* Header */}
      <div className={`px-6 pt-5 pb-0 shrink-0 border-b relative z-10 ${tc.headerBg}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/80 to-indigo-500/80 flex items-center justify-center text-xl shadow-lg shadow-violet-500/25 border border-violet-400/20">📊</div>
          <div>
            <h1 className={`text-lg font-black ${tc.textPrimary}`}>Analytics</h1>
            <p className={`text-xs ${tc.textMuted}`}>Real-time insights for your restaurant</p>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex gap-0.5 mb-[-1px]">
          <button onClick={() => setTab("sales")}
            className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all border-b-2 ${
              tab === "sales"
                ? "text-violet-300 border-violet-400 bg-violet-500/10"
                : `border-transparent hover:bg-white/[0.04] ${tc.textMuted}`
            }`}
          >📈 Sales</button>
          <button onClick={() => setTab("expenses")}
            className={`px-5 py-2.5 rounded-t-xl text-sm font-bold transition-all border-b-2 ${
              tab === "expenses"
                ? "text-rose-300 border-rose-400 bg-rose-500/10"
                : `border-transparent hover:bg-white/[0.04] ${tc.textMuted}`
            }`}
          >💸 Expenses</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 relative z-10" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {tab === "sales" ? <SalesTab /> : <ExpensesTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
