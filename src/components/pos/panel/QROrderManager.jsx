import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";
import { usePOSBusiness } from "../POSBusinessContext";
import { generateQRPrint, printThermalContent } from "../../../utils/thermalPrinter";

const STATUS_CFG = {
  pending:   { label: "Received",   dot: "bg-amber-400",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/25",   icon: "⏳" },
  preparing: { label: "Cooking",    dot: "bg-blue-400",    badge: "bg-blue-500/15 text-blue-300 border-blue-500/25",      icon: "👨‍🍳" },
  ready:     { label: "Ready",      dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", icon: "🔔" },
  served:    { label: "Served",     dot: "bg-violet-400",  badge: "bg-violet-500/15 text-violet-300 border-violet-500/25", icon: "🍽️" },
  completed: { label: "Completed",  dot: "bg-white/25",    badge: "bg-white/8 text-white/40 border-white/10",             icon: "✅" },
  cancelled: { label: "Cancelled",  dot: "bg-red-400",     badge: "bg-red-500/15 text-red-300 border-red-500/25",         icon: "✕" },
};

function timeAgo(ts) {
  const diff = Date.now() - (ts || Date.now());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

const getUid = () => auth.currentUser?.uid;

// ── QR Order Card ─────────────────────────────────────────────────────────────
function QROrderCard({ order, uid, idx }) {
  const cfg = STATUS_CFG[order.status] || STATUS_CFG.pending;
  const [updating, setUpdating] = useState(false);

  const NEXT = { pending: "preparing", preparing: "ready", ready: "served", served: "completed" };

  const advance = useCallback(async () => {
    const next = NEXT[order.status];
    if (!next || !uid) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "businesses", uid, "kitchenOrders", order.id), {
        status: next, updatedAt: Date.now(),
      });
    } catch (e) { console.error(e); }
    finally { setUpdating(false); }
  }, [order.status, order.id, uid]);

  const isActive = ["pending", "preparing", "ready"].includes(order.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: idx * 0.03 }}
      className={`rounded-2xl border overflow-hidden transition-all ${
        isActive
          ? "border-white/10 bg-white/[0.04] hover:border-emerald-500/20 hover:bg-white/[0.06]"
          : "border-white/[0.05] bg-white/[0.02] opacity-60"
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${isActive ? "animate-pulse" : ""}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white/90 truncate">
            {order.tableName || `Table ${order.tableId}`}
          </p>
          {order.customerName && order.customerName !== "Guest" && (
            <p className="text-[10px] text-white/40 truncate">{order.customerName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${cfg.badge}`}>
            {cfg.icon} {cfg.label}
          </span>
          <span className="text-[9px] text-white/25">{timeAgo(order.createdAt)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pb-2 space-y-0.5">
        {(order.items || []).slice(0, 4).map((it, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-[11px] text-white/55 truncate">{it.product?.name || it.name || "Item"}</span>
            <span className="text-[11px] text-white/35 shrink-0 ml-2">×{it.qty || 1}</span>
          </div>
        ))}
        {(order.items || []).length > 4 && (
          <p className="text-[9px] text-emerald-300/40">+{order.items.length - 4} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3.5 pt-2 flex items-center justify-between border-t border-white/[0.05]">
        <span className="text-xs font-black text-white/70">₹{Number(order.totals?.grandTotal || 0).toFixed(0)}</span>
        {NEXT[order.status] && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={advance} disabled={updating}
            className={`px-3 py-1 rounded-xl text-[10px] font-black border transition disabled:opacity-50 ${
              order.status === "pending"
                ? "bg-blue-500/15 border-blue-500/25 text-blue-300 hover:bg-blue-500/25"
                : order.status === "preparing"
                ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25"
                : "bg-violet-500/15 border-violet-500/25 text-violet-300 hover:bg-violet-500/25"
            }`}
          >
            {updating ? "…" : `Mark ${STATUS_CFG[NEXT[order.status]]?.label}`}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Per-table QR Card ─────────────────────────────────────────────────────────
function TableQRCard({ table, bizUid, bizName, idx }) {
  const wrapperRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const qrUrl = `${window.location.origin}/qr-order?biz=${bizUid}&table=${table.id}`;

  const getCanvas = () => wrapperRef.current?.querySelector("canvas");

  const downloadQR = useCallback(() => {
    const src = getCanvas();
    if (!src) return;

    const pad = 28;
    const labelH = 70;
    const off = document.createElement("canvas");
    off.width  = src.width  + pad * 2;
    off.height = src.height + pad * 2 + labelH;
    const ctx = off.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, off.width, off.height);

    // thin green top bar
    ctx.fillStyle = "#10b981";
    ctx.fillRect(0, 0, off.width, 5);

    ctx.drawImage(src, pad, pad + 5);

    ctx.textAlign = "center";
    const cx = off.width / 2;
    const qrB = src.height + pad + 5;

    ctx.font = "bold 15px -apple-system,sans-serif";
    ctx.fillStyle = "#111827";
    ctx.fillText(bizName, cx, qrB + 22);

    ctx.font = "bold 20px -apple-system,sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(table.name || `Table ${table.number}`, cx, qrB + 48);

    ctx.font = "10px -apple-system,sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Scan to order · Powered by FLYP", cx, qrB + 65);

    const a = document.createElement("a");
    a.download = `QR-${(table.name || `Table-${table.number}`).replace(/\s+/g, "-")}.png`;
    a.href = off.toDataURL("image/png");
    a.click();
  }, [table, bizName]);

  const printTent = useCallback(() => {
    const src = getCanvas();
    if (!src) return;
    const dataUrl = src.toDataURL("image/png");
    const tName = table.name || `Table ${table.number}`;

    const qrData = {
      tableName: tName,
      tableZone: table.zone || "",
      qrCodeDataUrl: dataUrl,
      businessName: bizName,
    };

    printThermalContent(generateQRPrint(qrData), `QR Code — ${tName}`);
  }, [table, bizName]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [qrUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.2 }}
      className="rounded-2xl border border-white/8 bg-white/3 hover:border-emerald-500/20 hover:bg-white/5 transition-all overflow-hidden"
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="font-black text-white text-sm">{table.name || `Table ${table.number}`}</p>
          {table.zone && <p className="text-[10px] text-white/40 capitalize mt-0.5">{table.zone}</p>}
          {table.capacity && <p className="text-[10px] text-white/25 mt-0.5">👥 {table.capacity} seats</p>}
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center text-lg">🪑</div>
      </div>

      {/* QR Code */}
      <div className="flex items-center justify-center mx-4 mb-3 py-4 rounded-2xl bg-white" ref={wrapperRef}>
        <QRCodeCanvas
          value={qrUrl}
          size={152}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#111827"
        />
      </div>

      {/* URL strip */}
      <div className="mx-4 mb-3 px-2.5 py-1.5 rounded-xl bg-white/4 border border-white/6">
        <p className="text-[9px] text-white/25 font-mono truncate">{qrUrl}</p>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <motion.button whileTap={{ scale: 0.94 }} onClick={downloadQR}
          className="py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/18 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/22 transition flex flex-col items-center gap-1"
        ><span className="text-sm">⬇️</span>Download</motion.button>

        <motion.button whileTap={{ scale: 0.94 }} onClick={printTent}
          className="py-2.5 rounded-xl bg-blue-500/12 border border-blue-500/18 text-blue-300 text-[10px] font-black hover:bg-blue-500/22 transition flex flex-col items-center gap-1"
        ><span className="text-sm">🖨️</span>Print</motion.button>

        <motion.button whileTap={{ scale: 0.94 }} onClick={copyLink}
          className={`py-2.5 rounded-xl border text-[10px] font-black transition flex flex-col items-center gap-1 ${
            copied ? "bg-violet-500/20 border-violet-400/25 text-violet-200"
                   : "bg-white/5 border-white/8 text-white/45 hover:bg-white/10"
          }`}
        ><span className="text-sm">{copied ? "✅" : "🔗"}</span>{copied ? "Copied!" : "Copy"}</motion.button>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QROrderManager() {
  const { tc } = usePOSTheme();
  const { uid: bizUid, bizName, bizAddress, bizCity, bizPhone, bizGST } = usePOSBusiness();

  const [tab,     setTab]     = useState("qr");   // "qr" | "orders"
  const [tables,  setTables]  = useState([]);
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("active"); // "active" | "all"

  const [uid, setUid] = useState(() => getUid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);

  // Real-time tables
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "businesses", uid, "tables"),
      snap => {
        setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.number || 0) - (b.number || 0)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid]);

  // Real-time QR orders (source = qr-order)
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, "businesses", uid, "kitchenOrders"), orderBy("createdAt", "desc")),
      snap => {
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(o => o.source === "qr-order");
        setOrders(all);
      },
      err => console.warn("[QROrders]", err?.code)
    );
    return unsub;
  }, [uid]);

  const activeOrders = useMemo(() =>
    orders.filter(o => ["pending","preparing","ready","served"].includes(o.status)),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const base = filter === "active" ? activeOrders : orders;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(o =>
      (o.tableName || "").toLowerCase().includes(q) ||
      (o.customerName || "").toLowerCase().includes(q)
    );
  }, [orders, activeOrders, filter, search]);

  const qrSearch = search.trim().toLowerCase();
  const filteredTables = useMemo(() =>
    tab === "qr" && qrSearch
      ? tables.filter(t => (t.name || `Table ${t.number}`).toLowerCase().includes(qrSearch))
      : tables,
    [tables, tab, qrSearch]
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>

      {/* ── Header ── */}
      <div className={`px-5 pt-5 pb-0 shrink-0 border-b ${tc.borderSoft}`}>

        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-lg">📱</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-black ${tc.textPrimary}`}>QR Ordering</h1>
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />Live
                </span>
              </div>
              <p className={`text-[10px] ${tc.textMuted}`}>{bizName || "Restaurant"} · {tables.length} tables</p>
            </div>
          </div>
          {/* Stats badges */}
          <div className="flex items-center gap-2">
            {activeOrders.length > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[10px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {activeOrders.length} active
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-0">
          {[["qr","📱 QR Codes"],["orders",`📋 Orders${activeOrders.length > 0 ? ` (${activeOrders.length})` : ""}`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
                tab === k
                  ? "border-emerald-400 text-emerald-300"
                  : `border-transparent ${tc.textMuted} hover:text-white/60`
              }`}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === "qr" ? "Search tables…" : "Search orders by table or customer…"}
            autoComplete="off" autoCorrect="off" spellCheck="false"
            className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm border outline-none focus:ring-1 focus:ring-emerald-400/40 placeholder:text-[11px] ${tc.borderSoft}`}
            style={{ background: 'rgba(255,255,255,0.05)', color: 'white', WebkitTextFillColor: 'white' }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/15 text-white/50 text-[9px] flex items-center justify-center hover:bg-white/25"
            >✕</button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── QR Codes tab ── */}
          {tab === "qr" && (
            <motion.div key="qr"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-5 py-4"
            >
              {/* How it works banner */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/6 border border-emerald-500/12 mb-4">
                <span className="text-base shrink-0">💡</span>
                <div className="flex items-center gap-3 text-[10px] text-emerald-300/60 flex-wrap">
                  <span>1️⃣ Download / print QR</span>
                  <span className="text-emerald-500/30">→</span>
                  <span>2️⃣ Place on table</span>
                  <span className="text-emerald-500/30">→</span>
                  <span>3️⃣ Customers scan &amp; order</span>
                  <span className="text-emerald-500/30">→</span>
                  <span>4️⃣ Order goes to KDS instantly</span>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-7 h-7 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
                  <p className={`text-xs ${tc.textMuted}`}>Loading tables…</p>
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                  <div className="text-4xl opacity-15">🪑</div>
                  <p className={`text-sm font-semibold ${tc.textSub}`}>{search ? "No matching tables" : "No tables found"}</p>
                  <p className={`text-xs ${tc.textMuted}`}>{search ? "Try a different search" : "Add tables in Tables & Orders first"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredTables.map((table, idx) => (
                    <TableQRCard key={table.id} table={table} bizUid={uid} bizName={bizName} idx={idx} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Orders tab ── */}
          {tab === "orders" && (
            <motion.div key="orders"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-5 pt-4 pb-6"
            >
              {/* Filter pills */}
              <div className="flex items-center gap-2 mb-4">
                {[["active",`Active (${activeOrders.length})`],["all",`All (${orders.length})`]].map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition border ${
                      filter === k
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : `border-white/10 bg-white/4 ${tc.textMuted} hover:bg-white/8`
                    }`}
                  >{l}</button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <div className="text-5xl opacity-15">📋</div>
                  <p className={`text-sm font-semibold ${tc.textSub}`}>
                    {search ? "No matching orders" : filter === "active" ? "No active QR orders" : "No QR orders yet"}
                  </p>
                  <p className={`text-xs max-w-xs ${tc.textMuted}`}>
                    {!search && (filter === "active"
                      ? "When customers scan and order via QR, their orders appear here in real-time"
                      : "No QR orders have been placed yet")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence>
                    {filteredOrders.map((order, idx) => (
                      <QROrderCard key={order.id} order={order} uid={uid} idx={idx} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
