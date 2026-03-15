import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";

const PIPELINE = [
  { key: "pending",   label: "Pending",   icon: "🕐", accent: "amber"   },
  { key: "accepted",  label: "Accepted",  icon: "✓",  accent: "green"   },
  { key: "preparing", label: "Preparing", icon: "🍳", accent: "blue"    },
  { key: "ready",     label: "Ready",     icon: "✅", accent: "emerald" },
  { key: "served",    label: "Served",    icon: "🍽️", accent: "purple"  },
];

const NEXT_STATUS = { pending: "accepted", accepted: "preparing", preparing: "ready", ready: "served", served: "completed" };
const NEXT_LABEL  = { pending: "✓ Accept Order", accepted: "🍳 Start Preparing", preparing: "✅ Mark Ready", ready: "🍽️ Mark Served", served: "🗑 Clear" };
const NEXT_CLS    = {
  pending:   "bg-green-500 hover:bg-green-400 text-white",
  accepted:  "bg-blue-500 hover:bg-blue-400 text-white",
  preparing: "bg-emerald-500 hover:bg-emerald-400 text-white",
  ready:     "bg-purple-500 hover:bg-purple-400 text-white",
  served:    "bg-slate-600 hover:bg-slate-500 text-white/80",
};

const STATUS_BG = {
  pending:   "bg-amber-500/[0.07] border-amber-500/25",
  accepted:  "bg-green-500/[0.07] border-green-500/25",
  preparing: "bg-blue-500/[0.07] border-blue-500/25",
  ready:     "bg-emerald-500/[0.09] border-emerald-500/30",
  served:    "bg-white/[0.03] border-white/10",
};

const STATUS_DOT = {
  pending:   "bg-amber-400",
  accepted:  "bg-green-400",
  preparing: "bg-blue-400",
  ready:     "bg-emerald-400",
  served:    "bg-purple-400",
};

const money = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BatchRow({ batch, batchNum, isLatest, now, updating, onAdvance, isNewAddition }) {
  const [collapsed, setCollapsed] = React.useState(
    !isNewAddition && (batch.status === "served" || (batch.status === "ready" && !isLatest))
  );

  const items = batch.items || batch.lines || [];
  const diffMs = now - (batch.createdAt || now);
  const mins   = diffMs / 60000;
  const isNew  = diffMs < 90000;
  const isLate = mins > 10 && mins <= 20;
  const isOver = mins > 20;

  const elapsed = () => {
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
    const m = Math.floor(diffMs / 60000), s = Math.floor((diffMs % 60000) / 1000);
    if (m < 60) return `${m}m ${s}s ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
  };

  const statusIdx = PIPELINE.findIndex(p => p.key === batch.status);
  const batchTotal = batch.totals?.grandTotal
    ?? items.reduce((s, it) => s + Number(it.product?.price || it.price || 0) * (it.qty || 1), 0);

  return (
    <div className={`rounded-xl border relative overflow-hidden ${
      isNewAddition
        ? "bg-orange-500/[0.08] border-orange-500/40 ring-1 ring-orange-500/25"
        : STATUS_BG[batch.status] || "bg-white/5 border-white/10"
    }`}>

      {/* New addition banner */}
      {isNewAddition && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 border-b border-orange-500/30">
          <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-[11px]">⚡</motion.span>
          <span className="text-[11px] font-black text-orange-300 tracking-wide uppercase">New Addition — Table still active</span>
        </div>
      )}

      {/* New-batch pulse */}
      {isNew && !isNewAddition && !collapsed && (
        <motion.div
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="absolute inset-0 rounded-xl bg-amber-400/10 pointer-events-none"
        />
      )}

      {/* ── Clickable header ── */}
      <div
        className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Round {batchNum}</span>
          {batch.isRush && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500 text-white animate-pulse">🚨 RUSH</span>
          )}
          {isNew && isLatest && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white tracking-wide animate-pulse">✦ NEW</span>
          )}
          {isLatest && !isNew && !batch.isRush && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/50">Latest</span>
          )}
          {collapsed && (
            <span className="text-[10px] text-white/30">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
            batch.status === "pending"   ? "bg-amber-500/20 text-amber-300" :
            batch.status === "accepted"  ? "bg-green-500/20 text-green-300" :
            batch.status === "preparing" ? "bg-blue-500/20 text-blue-300" :
            batch.status === "ready"     ? "bg-emerald-500/20 text-emerald-300" :
            "bg-purple-500/20 text-purple-300"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[batch.status]}`} />
            <span>{PIPELINE.find(p => p.key === batch.status)?.label || batch.status}</span>
          </div>
          <span
            className="text-white/25 text-[10px] transition-transform duration-200"
            style={{ display: "inline-block", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
          >▼</span>
        </div>
      </div>

      {/* ── Collapsed: compact time + quick action ── */}
      {collapsed && (
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <span className={`text-[10px] font-medium ${
            isOver ? "text-red-400" : isLate ? "text-amber-400" : "text-white/35"
          }`}>
            ⏱ {elapsed()}{isOver && <span className="ml-1 font-bold"> OVERDUE</span>}
          </span>
          {batch.status !== "completed" && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance(batch.id, batch.status); }}
              disabled={!!updating[batch.id]}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 ${
                NEXT_CLS[batch.status] || "bg-slate-600 text-white"
              }`}
            >
              {updating[batch.id] ? "⏳" : NEXT_LABEL[batch.status]}
            </button>
          )}
        </div>
      )}

      {/* ── Expanded: full content ── */}
      {!collapsed && (
        <div className="px-3 pb-3">
          {/* Pipeline stepper */}
          <div className="flex items-center gap-0.5 mb-3">
            {PIPELINE.map((p, i) => {
              const isDone    = i < statusIdx;
              const isCurrent = i === statusIdx;
              return (
                <React.Fragment key={p.key}>
                  <div className={`text-[9px] font-semibold px-1 py-0.5 rounded transition-all ${
                    isCurrent ? (
                      p.accent === "amber"   ? "bg-amber-500/25 text-amber-300" :
                      p.accent === "green"   ? "bg-green-500/25 text-green-300" :
                      p.accent === "blue"    ? "bg-blue-500/25 text-blue-300" :
                      p.accent === "emerald" ? "bg-emerald-500/25 text-emerald-300" :
                      "bg-purple-500/25 text-purple-300"
                    ) : isDone ? "text-white/50" : "text-white/15"
                  }`}>
                    {isDone ? "✓" : p.icon} {(isCurrent || isDone) ? p.label : ""}
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className={`flex-1 h-px ${isDone ? "bg-white/20" : "bg-white/[0.07]"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Items */}
          <div className="space-y-1 mb-3">
            {items.map((item, idx) => {
              const name  = item.product?.name || item.product?.productName || item.name || "Item";
              const qty   = item.qty || item.quantity || 1;
              const price = Number(item.product?.price || item.price || 0);
              return (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70 flex-none">{qty}</span>
                    <span className="text-white/85 truncate">{name}</span>
                    {item.note && <span className="text-orange-300/70 italic truncate text-[10px] ml-1">· {item.note}</span>}
                  </div>
                  {price > 0 && <span className="text-white/40 flex-none">₹{money(price * qty)}</span>}
                </div>
              );
            })}
          </div>

          {/* Time + total */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.07]">
            <div className={`text-[10px] font-medium ${isOver ? "text-red-400" : isLate ? "text-amber-400" : "text-white/35"}`}>
              ⏱ {elapsed()}
              {isOver && <span className="ml-1 font-bold">OVERDUE</span>}
              {isLate && !isOver && <span className="ml-1 font-bold">LATE</span>}
            </div>
            {batchTotal > 0 && <span className="text-xs font-bold text-white/50">₹{money(batchTotal)}</span>}
          </div>

          {/* Action button */}
          {batch.status !== "completed" && (
            <button
              onClick={() => onAdvance(batch.id, batch.status)}
              disabled={!!updating[batch.id]}
              className={`mt-2 w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                NEXT_CLS[batch.status] || "bg-slate-600 text-white"
              }`}
            >
              {updating[batch.id] ? "⏳ Updating..." : NEXT_LABEL[batch.status]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KitchenOrderBoard() {
  const [orders, setOrders]     = React.useState([]);
  const [filter, setFilter]     = React.useState("all");
  const [now, setNow]           = React.useState(Date.now());
  const [updating, setUpdating] = React.useState({});

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const getUid = () => auth.currentUser?.uid;

  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    const ref = collection(db, "businesses", uid, "kitchenOrders");
    const q   = query(ref, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== "completed") list.push({ id: d.id, ...data });
      });
      setOrders(list);
    }, () => {
      onSnapshot(query(ref, orderBy("createdAt", "desc")), (snap) => {
        const list = [];
        snap.forEach(d => { const data = d.data(); if (data.status !== "completed") list.push({ id: d.id, ...data }); });
        setOrders(list);
      });
    });
    return unsub;
  }, []);

  const advance = async (orderId, currentStatus) => {
    const uid = getUid();
    if (!uid) return;
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    setUpdating(u => ({ ...u, [orderId]: true }));
    try {
      await updateDoc(doc(db, "businesses", uid, "kitchenOrders", orderId), {
        status: next, updatedAt: Date.now(),
        ...(next === "ready"     && { readyAt:     Date.now() }),
        ...(next === "served"    && { servedAt:    Date.now() }),
        ...(next === "completed" && { completedAt: Date.now() }),
      });
    } catch (e) { console.error(e); }
    finally { setUpdating(u => ({ ...u, [orderId]: false })); }
  };

  // ── Group orders by table ──────────────────────────────────────────────────
  // Key: tableId (preferred) or tableName+zone
  const tableGroups = React.useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const key = order.tableId || `${order.tableName || "walkin"}::${order.tableZone || ""}`;
      if (!map[key]) {
        map[key] = {
          key,
          tableName: order.tableName || order.customerName || "Walk-in",
          tableZone: order.tableZone || "",
          batches: [],
        };
      }
      map[key].batches.push(order);
    });
    // Sort batches within each group by createdAt asc (oldest first)
    Object.values(map).forEach(g => {
      g.batches.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    });
    // Sort table groups: tables with pending new additions first, then by status priority
    const groups = Object.values(map);
    groups.sort((a, b) => {
      const statusPriority = { pending: 0, accepted: 1, preparing: 2, ready: 3, served: 4 };
      // Tables with new additions (pending while others are in-progress) bubble to top
      const aHasNewAddition = a.batches.some(x => x.status === "pending") && a.batches.some(x => x.status === "accepted" || x.status === "preparing" || x.status === "ready");
      const bHasNewAddition = b.batches.some(x => x.status === "pending") && b.batches.some(x => x.status === "accepted" || x.status === "preparing" || x.status === "ready");
      if (aHasNewAddition !== bHasNewAddition) return aHasNewAddition ? -1 : 1;
      const aMin = Math.min(...a.batches.map(x => statusPriority[x.status] ?? 5));
      const bMin = Math.min(...b.batches.map(x => statusPriority[x.status] ?? 5));
      if (aMin !== bMin) return aMin - bMin;
      return (a.batches[0]?.createdAt || 0) - (b.batches[0]?.createdAt || 0);
    });
    return groups;
  }, [orders]);

  // Apply filter: show table group if it has at least one batch matching
  const filteredGroups = React.useMemo(() => {
    if (filter === "all") {
      return tableGroups.map(g => ({
        ...g,
        batches: g.batches.filter(b => b.status !== "served"),
      })).filter(g => g.batches.length > 0);
    }
    // When filtering by a specific status, keep the full batches for context but only show groups that have a match
    return tableGroups.map(g => ({
      ...g,
      batches: g.batches.filter(b => b.status === filter),
    })).filter(g => g.batches.length > 0);
  }, [tableGroups, filter]);

  const statusCounts = React.useMemo(() => ({
    pending:   orders.filter(o => o.status === "pending").length,
    accepted:  orders.filter(o => o.status === "accepted").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    ready:     orders.filter(o => o.status === "ready").length,
    served:    orders.filter(o => o.status === "served").length,
  }), [orders]);
  const activeCount = statusCounts.pending + statusCounts.accepted + statusCounts.preparing + statusCounts.ready;

  // Does any table have multiple batches (multi-round orders)?
  const hasMultiBatch = tableGroups.some(g => g.batches.length > 1);

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 overflow-y-auto">
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-orange-500/10" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-blue-500/10" />
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              Kitchen Order Board
              {hasMultiBatch && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 uppercase tracking-wide">
                  Multi-round orders active
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {activeCount > 0 ? `${activeCount} active batch${activeCount !== 1 ? "es" : ""} across ${filteredGroups.length} table${filteredGroups.length !== 1 ? "s" : ""}` : "All clear"}
              {statusCounts.served > 0 && ` · ${statusCounts.served} awaiting clear`}
            </div>
          </div>

          {/* Pipeline strip */}
          <div className="hidden md:flex items-center gap-1 text-[11px]">
            {PIPELINE.map((p, i) => (
              <React.Fragment key={p.key}>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  statusCounts[p.key] > 0
                    ? p.accent === "amber"   ? "bg-amber-500/15 text-amber-300"
                    : p.accent === "green"   ? "bg-green-500/15 text-green-300"
                    : p.accent === "blue"    ? "bg-blue-500/15 text-blue-300"
                    : p.accent === "emerald" ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-purple-500/15 text-purple-300"
                    : "text-white/20"
                }`}>
                  <span>{p.icon}</span>
                  <span className="font-semibold">{statusCounts[p.key]}</span>
                </div>
                {i < PIPELINE.length - 1 && <span className="text-white/15">›</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "all",       label: "All Active",       cls: "bg-white/15 text-white" },
              { key: "pending",   label: `Pending${statusCounts.pending   > 0 ? ` (${statusCounts.pending})`   : ""}`, cls: "bg-amber-500/20 text-amber-300"   },
              { key: "accepted",  label: `Accepted${statusCounts.accepted  > 0 ? ` (${statusCounts.accepted})`  : ""}`, cls: "bg-green-500/20 text-green-300"    },
              { key: "preparing", label: `Preparing${statusCounts.preparing > 0 ? ` (${statusCounts.preparing})` : ""}`, cls: "bg-blue-500/20 text-blue-300"  },
              { key: "ready",     label: `Ready${statusCounts.ready       > 0 ? ` (${statusCounts.ready})`     : ""}`, cls: "bg-emerald-500/20 text-emerald-300" },
              { key: "served",    label: `Served${statusCounts.served     > 0 ? ` (${statusCounts.served})`    : ""}`, cls: "bg-purple-500/20 text-purple-300"  },
            ].map(({ key, label, cls }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  filter === key ? cls : "text-white/35 hover:text-white/60 hover:bg-white/5"
                }`}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="relative z-10 p-5">
        <div className="max-w-7xl mx-auto">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-white/40">
              <div className="text-7xl mb-4">👨‍🍳</div>
              <div className="text-lg font-semibold text-white/60 mb-1">
                {filter === "all" ? "Kitchen is clear!" : `No ${filter} orders`}
              </div>
              <div className="text-sm">Orders sent from POS will appear here instantly</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredGroups.map((group) => {
                  const hasPending = group.batches.some(b => b.status === "pending");
                  const hasNew     = group.batches.some(b => (now - (b.createdAt || now)) < 90000);
                  const statusPriorityMap = { pending: 0, accepted: 1, preparing: 2, ready: 3, served: 4 };
                  const tableStatusPriority = Math.min(...group.batches.map(b => statusPriorityMap[b.status] ?? 5));
                  const dominantAccent =
                    tableStatusPriority === 0 ? "amber"   :
                    tableStatusPriority === 1 ? "green"   :
                    tableStatusPriority === 2 ? "blue"    :
                    tableStatusPriority === 3 ? "emerald" : "purple";
                  // A batch is a "new addition" if it's pending AND the table has other batches at any active status
                  const hasActiveInProgress = group.batches.some(b => b.status === "accepted" || b.status === "preparing" || b.status === "ready");

                  return (
                    <motion.div
                      key={group.key}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.93, y: -8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className={`rounded-2xl border bg-slate-800/50 backdrop-blur-sm overflow-hidden ${
                        hasNew  ? "border-amber-500/40 ring-1 ring-amber-500/20" :
                        hasPending ? "border-amber-500/25" :
                        dominantAccent === "green"   ? "border-green-500/25" :
                        dominantAccent === "blue"    ? "border-blue-500/25" :
                        dominantAccent === "emerald" ? "border-emerald-500/30" :
                        "border-white/[0.08]"
                      }`}
                    >
                      {/* ── Table Header ── */}
                      <div className={`px-4 py-3 border-b border-white/[0.07] ${
                        hasNew ? "bg-amber-500/[0.06]" :
                        dominantAccent === "green"   ? "bg-green-500/[0.06]" :
                        dominantAccent === "blue"    ? "bg-blue-500/[0.06]" :
                        dominantAccent === "emerald" ? "bg-emerald-500/[0.06]" :
                        "bg-white/[0.03]"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-white truncate">
                              🪑 {group.tableName}
                            </span>
                            {group.tableZone && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/55 uppercase tracking-wide">
                                {group.tableZone}
                              </span>
                            )}
                            {hasNew && (
                              <motion.span
                                initial={{ scale: 0.8 }}
                                animate={{ scale: [0.8, 1.05, 1] }}
                                transition={{ duration: 0.4 }}
                                className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white"
                              >
                                ✦ NEW ORDER
                              </motion.span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-[10px] text-white/40 font-medium">
                            <span>{group.batches.length} batch{group.batches.length !== 1 ? "es" : ""}</span>
                          </div>
                        </div>
                      </div>

                      {/* ── Batch list ── */}
                      <div className="p-3 space-y-3">
                        {group.batches.map((batch, bIdx) => (
                          <BatchRow
                            key={batch.id}
                            batch={batch}
                            batchNum={bIdx + 1}
                            isLatest={bIdx === group.batches.length - 1}
                            now={now}
                            updating={updating}
                            onAdvance={advance}
                            isNewAddition={batch.status === "pending" && hasActiveInProgress}
                          />
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

