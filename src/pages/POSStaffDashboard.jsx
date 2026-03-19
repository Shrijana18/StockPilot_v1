import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, onSnapshot, query, where, updateDoc, doc, getDocs, orderBy
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { empDB as db, empAuth as auth } from "../firebase/firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";

// ─── helpers ─────────────────────────────────────────────────────────────────
const money = (n) => Number(n || 0).toFixed(2);
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";

const NEXT_STATUS = { pending: "accepted", accepted: "preparing", preparing: "ready", ready: "served" };
const NEXT_LABEL  = { pending: "Accept", accepted: "Start Preparing", preparing: "Mark Ready", ready: "Mark Served" };
const STATUS_COLOR = {
  pending:   "bg-amber-500/20 border-amber-500/40 text-amber-300",
  accepted:  "bg-green-500/20 border-green-500/40 text-green-300",
  preparing: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  ready:     "bg-emerald-500/20 border-emerald-500/50 text-emerald-200",
  served:    "bg-purple-500/20 border-purple-500/40 text-purple-300",
  completed: "bg-white/5 border-white/10 text-white/30",
};
const STATUS_BTN = {
  pending:   "bg-green-500 hover:bg-green-400",
  accepted:  "bg-blue-500 hover:bg-blue-400",
  preparing: "bg-emerald-500 hover:bg-emerald-400",
  ready:     "bg-purple-500 hover:bg-purple-400",
};
const ROLES_ICON = { owner:"👑", manager:"🎯", cashier:"💳", server:"🍽️", chef:"👨‍🍳", host:"🤝", bartender:"🍹", staff:"👤" };
const ACCESS_TABS = {
  full:    ["kds", "orders", "analytics"],
  billing: ["orders", "analytics"],
  orders:  ["orders"],
  view:    ["analytics"],
};

// ─── component ───────────────────────────────────────────────────────────────
export default function POSStaffDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("kds");
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [updating, setUpdating] = useState({});
  const [now, setNow] = useState(Date.now());
  const [greeting, setGreeting] = useState("");

  // session load
  useEffect(() => {
    const raw = sessionStorage.getItem("pos_staff_session");
    if (!raw) { navigate("/pos-staff?biz=", { replace: true }); return; }
    try {
      const s = JSON.parse(raw);
      if (!s?.bizId) throw new Error();
      setSession(s);
      const allowed = ACCESS_TABS[s.accessLevel] || ACCESS_TABS.view;
      setActiveTab(allowed[0]);
      const h = new Date().getHours();
      setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    } catch (_) { navigate("/pos-staff", { replace: true }); }
  }, [navigate]);

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // real-time kitchen orders
  useEffect(() => {
    if (!session?.bizId) return;
    const ref = collection(db, "businesses", session.bizId, "kitchenOrders");
    const q = query(ref, where("status", "in", ["pending", "accepted", "preparing", "ready", "served"]));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setOrders(docs);
    }, err => console.warn("[StaffDash] orders:", err.message));
    return unsub;
  }, [session?.bizId]);

  // tables
  useEffect(() => {
    if (!session?.bizId) return;
    const unsub = onSnapshot(collection(db, "businesses", session.bizId, "tables"), snap => {
      setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [session?.bizId]);

  const advanceOrder = useCallback(async (orderId, status) => {
    const next = NEXT_STATUS[status];
    if (!next || !session?.bizId) return;
    setUpdating(u => ({ ...u, [orderId]: true }));
    try {
      await updateDoc(doc(db, "businesses", session.bizId, "kitchenOrders", orderId), {
        status: next,
        updatedAt: Date.now(),
        ...(next === "ready"  && { readyAt: Date.now() }),
        ...(next === "served" && { servedAt: Date.now() }),
      });
    } catch (e) { console.error(e); }
    finally { setUpdating(u => ({ ...u, [orderId]: false })); }
  }, [session?.bizId]);

  const logout = async () => {
    sessionStorage.removeItem("pos_staff_session");
    try { if (auth.currentUser) await signOut(auth); } catch (_) {}
    navigate("/pos-staff?biz=" + (session?.bizId || ""), { replace: true });
  };

  const urgentOrders = orders.filter(o => o.status === "pending").length;
  const readyOrders  = orders.filter(o => o.status === "ready").length;
  const allowedTabs  = session ? (ACCESS_TABS[session.accessLevel] || ACCESS_TABS.view) : [];
  const occupiedTables = tables.filter(t => t.status === "occupied").length;

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #060c17 0%, #0b1f35 50%, #060c17 100%)" }}>
      {/* aurora */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -right-20 w-[55%] h-[55%] rounded-full blur-[130px]" style={{ background: "radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 65%)" }} />
        <div className="absolute -bottom-40 -left-20 w-[50%] h-[50%] rounded-full blur-[130px]" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)" }} />
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 border-b border-white/[0.07] bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-none">
            <span className="text-base font-black text-white">F</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate">{greeting}, {session.name}!</div>
            <div className="text-white/40 text-[10px] flex items-center gap-1.5">
              <span>{ROLES_ICON[session.role] || "👤"} {session.role}</span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-white/30">{session.staffId}</span>
              <span className="text-white/20">·</span>
              <span>{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          {/* Quick stats */}
          {urgentOrders > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1.5">
              <span className="animate-pulse text-sm">🔔</span>
              <span className="text-amber-300 text-xs font-bold">{urgentOrders} New</span>
            </div>
          )}
          {readyOrders > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-2.5 py-1.5">
              <span className="text-sm">✅</span>
              <span className="text-emerald-300 text-xs font-bold">{readyOrders} Ready</span>
            </div>
          )}
          <button onClick={logout}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-white/40 hover:text-red-300 hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 transition">
            Logout
          </button>
        </div>

        {/* Tab bar */}
        {allowedTabs.length > 1 && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-1">
            {allowedTabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                }`}>
                {{ kds: "🍳 Kitchen", orders: "📋 Orders", analytics: "📊 Overview" }[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-auto max-w-6xl mx-auto w-full px-4 py-5">
        <AnimatePresence mode="wait">
          {activeTab === "kds" && (
            <motion.div key="kds" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <KDSView orders={orders} updating={updating} onAdvance={advanceOrder} />
            </motion.div>
          )}
          {activeTab === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <OrdersView orders={orders} tables={tables} />
            </motion.div>
          )}
          {activeTab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <OverviewView orders={orders} tables={tables} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── KDS View ────────────────────────────────────────────────────────────────
function KDSView({ orders, updating, onAdvance }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  if (orders.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">🍽️</div>
      <div className="text-white/60 text-sm font-semibold">No active orders</div>
      <div className="text-white/30 text-xs mt-1">New orders will appear here automatically</div>
    </div>
  );

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["all","pending","accepted","preparing","ready"].map(s => {
          const count = s === "all" ? orders.length : orders.filter(o => o.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filter === s ? "bg-white/15 border-white/20 text-white" : "border-white/[0.07] text-white/40 hover:text-white/70"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {count > 0 && <span className="ml-1.5 bg-white/15 px-1.5 rounded-full">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map(order => {
            const items = order.items || order.lines || [];
            const activeItems = items.filter(it => !it.cancelled);
            const elapsed = Math.floor((Date.now() - (order.createdAt || Date.now())) / 60000);
            const isUrgent = elapsed > 15 && order.status !== "ready";
            return (
              <motion.div key={order.id}
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }} layout
                className={`rounded-2xl border p-4 ${STATUS_COLOR[order.status] || "bg-white/5 border-white/10 text-white/40"} ${isUrgent ? "ring-2 ring-red-500/50" : ""}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-black">{order.tableName || order.customerName || "Walk-in"}</div>
                    <div className="text-[10px] opacity-60">{fmtTime(order.createdAt)} · {elapsed}m ago{order.isRush ? " 🚨" : ""}</div>
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${STATUS_COLOR[order.status] || ""}`}>
                    {order.status?.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-1 mb-3 max-h-36 overflow-y-auto">
                  {activeItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded bg-white/10 text-center font-bold flex-none flex items-center justify-center text-[10px]">{it.qty || 1}</span>
                      <span className="flex-1 truncate opacity-90">{it.product?.name || it.name}</span>
                      {it.note && <span className="text-orange-300/70 italic text-[9px] truncate max-w-[60px]">{it.note}</span>}
                    </div>
                  ))}
                  {items.filter(it => it.cancelled).map((it, i) => (
                    <div key={`c${i}`} className="flex items-center gap-2 text-xs opacity-30">
                      <span className="w-5 h-5 rounded bg-red-500/20 text-center font-bold flex-none flex items-center justify-center text-[10px] text-red-400">{it.qty || 1}</span>
                      <span className="flex-1 truncate line-through">{it.product?.name || it.name}</span>
                      <span className="text-red-400/60 text-[8px] font-bold">VOID</span>
                    </div>
                  ))}
                </div>
                {NEXT_STATUS[order.status] && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    disabled={!!updating[order.id]}
                    onClick={() => onAdvance(order.id, order.status)}
                    className={`w-full py-2 rounded-xl text-xs font-bold text-white transition disabled:opacity-50 ${STATUS_BTN[order.status] || "bg-white/20 hover:bg-white/30"}`}
                  >
                    {updating[order.id] ? "⏳ Updating..." : `${NEXT_LABEL[order.status]} →`}
                  </motion.button>
                )}
                {order.status === "served" && (
                  <div className="text-center text-[10px] text-white/30 mt-2">✓ Served · awaiting checkout</div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Orders Summary View ──────────────────────────────────────────────────────
function OrdersView({ orders, tables }) {
  const byTable = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const key = o.tableId || o.tableName || "walk-in";
      if (!map[key]) map[key] = { key, name: o.tableName || o.customerName || "Walk-in", orders: [] };
      map[key].orders.push(o);
    });
    return Object.values(map);
  }, [orders]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-white font-bold">Live Orders by Table</h2>
        <span className="text-xs text-white/40">{orders.length} active</span>
      </div>
      {byTable.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-white/50 text-sm">No active orders right now</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {byTable.map(group => (
            <div key={group.key} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-bold text-sm">{group.name}</div>
                <div className="text-white/40 text-xs">{group.orders.length} round{group.orders.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="space-y-2">
                {group.orders.map((o, ri) => (
                  <div key={o.id} className={`rounded-xl border p-2.5 ${STATUS_COLOR[o.status] || "border-white/10"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase">Round {ri + 1}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_COLOR[o.status]}`}>{o.status?.toUpperCase()}</span>
                    </div>
                    {(o.items || o.lines || []).filter(it => !it.cancelled).map((it, i) => (
                      <div key={i} className="flex gap-1.5 text-[11px] opacity-70">
                        <span className="font-bold">×{it.qty || 1}</span>
                        <span className="truncate">{it.product?.name || it.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Overview/Analytics View ──────────────────────────────────────────────────
function OverviewView({ orders, tables }) {
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const todayOrders = orders.filter(o => (o.createdAt || 0) >= todayStart);
  const occupiedTables = tables.filter(t => t.status === "occupied").length;
  const totalTables = tables.length;
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const readyCount = orders.filter(o => o.status === "ready").length;

  const stats = [
    { icon: "🍽️", label: "Active Orders", value: orders.length, color: "text-orange-400" },
    { icon: "🔔", label: "Need Action",   value: pendingCount,   color: "text-amber-400" },
    { icon: "✅", label: "Ready to Serve", value: readyCount,    color: "text-emerald-400" },
    { icon: "🪑", label: "Tables Occupied", value: `${occupiedTables}/${totalTables}`, color: "text-sky-400" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-white/40 text-[10px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
        <div className="text-white font-bold text-sm mb-3">Order Pipeline</div>
        <div className="space-y-2">
          {["pending","accepted","preparing","ready","served"].map(s => {
            const count = orders.filter(o => o.status === s).length;
            const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-3">
                <div className="w-20 text-[10px] text-white/50 capitalize">{s}</div>
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  {count > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full rounded-full ${
                    s === "pending" ? "bg-amber-500" : s === "accepted" ? "bg-green-500" : s === "preparing" ? "bg-blue-500" : s === "ready" ? "bg-emerald-500" : "bg-purple-500"
                  }`} />}
                </div>
                <div className="text-white/60 text-[10px] w-6 text-right">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tables */}
      {tables.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
          <div className="text-white font-bold text-sm mb-3">Tables</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {tables.map(t => (
              <div key={t.id}
                className={`rounded-xl border p-2 text-center ${
                  t.status === "occupied"
                    ? "bg-orange-500/15 border-orange-500/30 text-orange-200"
                    : t.status === "reserved"
                    ? "bg-purple-500/15 border-purple-500/30 text-purple-200"
                    : "bg-white/[0.04] border-white/[0.07] text-white/40"
                }`}
              >
                <div className="text-[10px] font-bold truncate">{t.name || `T${t.number}`}</div>
                <div className="text-[8px] opacity-60 mt-0.5 capitalize">{t.status || "free"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
