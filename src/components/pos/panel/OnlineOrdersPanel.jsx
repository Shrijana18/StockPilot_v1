/**
 * OnlineOrdersPanel — Swiggy & Zomato live orders
 * Two modes:
 *   1. Manual Entry  — works immediately, staff types order from Swiggy/Zomato tablet
 *   2. Auto-Connect  — guided 4-step UrbanPiper wizard for full automation
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePOSTheme } from "../POSThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, onSnapshot, query, where, orderBy,
  doc, getDoc, setDoc, addDoc, updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "../../../firebase/firebaseConfig";

const getUid = () => auth.currentUser?.uid;

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORM = {
  swiggy:   { label: "Swiggy",   bg: "bg-orange-500/15", border: "border-orange-500/25", text: "text-orange-300",  badge: "bg-orange-500", emoji: "🧡", color: "#f97316" },
  zomato:   { label: "Zomato",   bg: "bg-red-500/15",    border: "border-red-500/25",    text: "text-red-300",    badge: "bg-red-500",    emoji: "❤️", color: "#ef4444" },
  magicpin: { label: "Magicpin", bg: "bg-pink-500/15",   border: "border-pink-500/25",   text: "text-pink-300",   badge: "bg-pink-500",   emoji: "💗", color: "#ec4899" },
  dunzo:    { label: "Dunzo",    bg: "bg-blue-500/15",   border: "border-blue-500/25",   text: "text-blue-300",   badge: "bg-blue-500",   emoji: "💙", color: "#3b82f6" },
  online:   { label: "Online",   bg: "bg-violet-500/15", border: "border-violet-500/25", text: "text-violet-300", badge: "bg-violet-500", emoji: "🌐", color: "#8b5cf6" },
};
const getPlatform = (src) => PLATFORM[src] || PLATFORM.online;

const STATUS = {
  new:       { label: "New Order",  color: "text-amber-300",   icon: "🔔" },
  accepted:  { label: "Accepted",   color: "text-emerald-300", icon: "✅" },
  rejected:  { label: "Rejected",   color: "text-red-300",     icon: "❌" },
  cancelled: { label: "Cancelled",  color: "text-white/30",    icon: "🚫" },
  preparing: { label: "Preparing",  color: "text-blue-300",    icon: "👨‍🍳" },
  ready:     { label: "Ready",      color: "text-teal-300",    icon: "🔔" },
};

const REJECT_REASONS = [
  { value: "item_unavailable", label: "Item unavailable" },
  { value: "store_closed",     label: "Store closed"     },
  { value: "too_busy",         label: "Too busy right now" },
  { value: "duplicate_order",  label: "Duplicate order"  },
];

const fmt    = ts => ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
const fmtAge = ts => { if (!ts) return ""; const m = Math.floor((Date.now() - ts) / 60000); return m < 60 ? `${m}m ago` : `${Math.floor(m/60)}h ${m%60}m ago`; };

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spin = () => (
  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full inline-block" />
);

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onAction, expanded, onToggle }) {
  const [acting,       setActing]       = useState(null);
  const [prepTime,     setPrepTime]     = useState(25);
  const [rejectReason, setRejectReason] = useState("item_unavailable");
  const [showReject,   setShowReject]   = useState(false);

  const pl    = getPlatform(order.source);
  const st    = STATUS[order.status] || STATUS.new;
  const isNew = order.status === "new";

  const act = async (action) => {
    setActing(action);
    try { await onAction(order.id, action, prepTime, rejectReason); if (action === "reject") setShowReject(false); }
    finally { setActing(null); }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${pl.border} ${pl.bg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={onToggle}>
        <span className={`shrink-0 px-2.5 py-1 rounded-lg ${pl.badge} text-white text-[10px] font-black flex items-center gap-1`}>
          {pl.emoji} {pl.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">#{order.channelOrderId || order.id?.slice(-6)}</span>
            {order.paymentType === "prepaid"
              ? <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 px-1.5 py-0.5 rounded font-bold">PAID</span>
              : <span className="text-[9px] bg-amber-500/20  border border-amber-500/25  text-amber-300  px-1.5 py-0.5 rounded font-bold">COD</span>}
          </div>
          <p className="text-[10px] text-white/35">{order.customerName} · {fmt(order.createdAt)}</p>
        </div>
        <div className="text-right shrink-0 mr-1">
          <p className="text-sm font-black text-white">₹{(order.totals?.grandTotal || 0).toFixed(0)}</p>
          <p className={`text-[10px] font-bold ${st.color}`}>{st.icon} {st.label}</p>
        </div>
        <span className="text-white/20 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-3 border-t border-white/6 space-y-3">
              {/* Items */}
              <div className="space-y-1">
                {(order.items || []).map((it, i) => (
                  <div key={i} className="flex justify-between text-xs text-white/60">
                    <span>{it.product?.name || it.name} × {it.qty}{it.note ? <span className="text-white/30 ml-1">({it.note})</span> : null}</span>
                    <span>₹{((it.product?.price || 0) * it.qty).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="bg-white/4 rounded-xl p-2.5 space-y-1 text-xs">
                {order.totals?.discount > 0 && <div className="flex justify-between text-emerald-400/70"><span>Discount</span><span>-₹{order.totals.discount.toFixed(2)}</span></div>}
                {order.totals?.tax > 0 && <div className="flex justify-between text-white/35"><span>Tax</span><span>₹{order.totals.tax.toFixed(2)}</span></div>}
                <div className="flex justify-between text-white font-black border-t border-white/8 pt-1"><span>Total</span><span>₹{(order.totals?.grandTotal || 0).toFixed(2)}</span></div>
              </div>
              {order.deliveryAddress && <p className="text-[11px] text-white/35">📍 {order.deliveryAddress}</p>}

              {/* Actions */}
              {isNew && !showReject && (
                <div className="flex gap-2 pt-0.5">
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-2 shrink-0">
                    <span className="text-[10px] text-white/30">⏱</span>
                    <select value={prepTime} onChange={e => setPrepTime(+e.target.value)}
                      className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer">
                      {[10,15,20,25,30,40,45,60].map(m => <option key={m} value={m} className="bg-slate-900">{m}m</option>)}
                    </select>
                  </div>
                  <button onClick={() => act("accept")} disabled={!!acting}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black hover:bg-emerald-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {acting === "accept" ? <Spin /> : "✅"} Accept
                  </button>
                  <button onClick={() => setShowReject(true)} disabled={!!acting}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-black hover:bg-red-500/25 transition disabled:opacity-50">
                    ❌ Reject
                  </button>
                </div>
              )}
              {isNew && showReject && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <p className="text-xs font-bold text-red-300">Why are you rejecting?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REJECT_REASONS.map(r => (
                      <button key={r.value} onClick={() => setRejectReason(r.value)}
                        className={`px-2.5 py-2 rounded-xl text-[11px] border text-left transition font-medium ${
                          rejectReason === r.value ? "bg-red-500/20 border-red-500/40 text-red-200 font-bold" : "bg-white/4 border-white/8 text-white/45 hover:bg-white/8"
                        }`}>{r.label}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowReject(false)} className="flex-1 py-2 rounded-xl bg-white/6 border border-white/10 text-white/40 text-xs font-bold hover:bg-white/10 transition">Cancel</button>
                    <button onClick={() => act("reject")} disabled={!!acting}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-black hover:bg-red-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {acting === "reject" ? <Spin /> : null} Confirm Reject
                    </button>
                  </div>
                </motion.div>
              )}
              {order.status === "accepted" && (
                <p className="text-[11px] text-emerald-300/60">⏱ Prep time: {order.prepTime || 25} min · {fmtAge(order.acceptedAt)}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Manual Order Entry Modal ──────────────────────────────────────────────────
function ManualEntryModal({ onClose, onSaved }) {
  const uid = getUid();
  const [platform,  setPlatform]  = useState("swiggy");
  const [orderId,   setOrderId]   = useState("");
  const [customer,  setCustomer]  = useState("");
  const [payment,   setPayment]   = useState("prepaid");
  const [items,     setItems]     = useState([{ name: "", qty: 1, price: "" }]);
  const [saving,    setSaving]    = useState(false);

  const total = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

  const addItem    = () => setItems(p => [...p, { name: "", qty: 1, price: "" }]);
  const removeItem = i  => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const save = async () => {
    if (!uid || !items.some(it => it.name.trim())) return;
    setSaving(true);
    try {
      const pl = getPlatform(platform);
      const order = {
        source:        platform,
        sourceLabel:   pl.label,
        channelOrderId: orderId.trim() || `MANUAL-${Date.now()}`,
        customerName:  customer.trim() || "Customer",
        paymentType:   payment,
        paymentStatus: payment === "prepaid" ? "paid" : "pending",
        items: items.filter(it => it.name.trim()).map(it => ({
          product: { name: it.name.trim(), price: Number(it.price) || 0, id: "" },
          qty: Number(it.qty) || 1,
          note: "",
        })),
        totals: { grandTotal: total, subTotal: total, tax: 0, discount: 0 },
        orderType: "delivery",
        status: "new",
        enteredManually: true,
        createdAt: Date.now(),
        bizId: uid,
      };
      await addDoc(collection(db, "businesses", uid, "kitchenOrders"), order);
      onSaved();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0d1520 0%,#060a10 100%)" }}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-white/6 flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-base">Add Order Manually</h2>
            <p className="text-white/35 text-xs mt-0.5">Read order from Swiggy/Zomato device and enter here</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/6 text-white/35 hover:bg-white/12 flex items-center justify-center text-sm transition">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Platform picker */}
          <div>
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-2">Platform</p>
            <div className="grid grid-cols-3 gap-2">
              {["swiggy","zomato","magicpin"].map(p => {
                const pl = getPlatform(p);
                return (
                  <button key={p} onClick={() => setPlatform(p)}
                    className={`py-2.5 rounded-2xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      platform === p
                        ? `${pl.bg} ${pl.border} ${pl.text}`
                        : "bg-white/4 border-white/8 text-white/35 hover:bg-white/8"
                    }`}>
                    <span className="text-lg leading-none">{pl.emoji}</span>{pl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order ID + Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1.5">Order # (optional)</p>
              <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="From app"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1.5">Payment</p>
              <div className="flex gap-2 h-[42px]">
                {[["prepaid","Paid online"],["cod","Cash/COD"]].map(([v,l]) => (
                  <button key={v} onClick={() => setPayment(v)}
                    className={`flex-1 rounded-xl text-xs font-bold border transition ${
                      payment === v ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-white/4 border-white/8 text-white/35 hover:bg-white/8"
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Customer name */}
          <div>
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1.5">Customer Name (optional)</p>
            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider">Items</p>
              <button onClick={addItem} className="text-[11px] text-blue-300 font-bold hover:text-blue-200 transition">+ Add item</button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={it.name} onChange={e => updateItem(i,"name",e.target.value)} placeholder="Item name"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-xs placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 min-w-0" />
                  <input value={it.qty} onChange={e => updateItem(i,"qty",e.target.value)} type="number" min="1" placeholder="Qty"
                    className="w-12 px-2 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-white/20" />
                  <div className="relative w-20 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">₹</span>
                    <input value={it.price} onChange={e => updateItem(i,"price",e.target.value)} type="number" placeholder="Price"
                      className="w-full pl-6 pr-2 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/20" />
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-white/20 hover:text-red-400 transition text-sm shrink-0">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total preview */}
          {total > 0 && (
            <div className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
              <span className="text-xs text-white/40 font-medium">Order Total</span>
              <span className="text-base font-black text-white">₹{total.toFixed(0)}</span>
            </div>
          )}

          <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving || !items.some(it => it.name.trim())}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-black disabled:opacity-40 transition hover:opacity-90 flex items-center justify-center gap-2">
            {saving ? <Spin /> : "🛵"} Send to Kitchen
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Auto-Connect Wizard ───────────────────────────────────────────────────────
function AutoConnectWizard({ onClose, onConnected }) {
  const uid        = getUid();
  const [step,     setStep]     = useState(1);
  const [creds,    setCreds]    = useState({ apiUsername: "", apiKey: "" });
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [copied,   setCopied]   = useState(false);

  const webhookUrl = uid
    ? `https://us-central1-stockpilotv1.cloudfunctions.net/urbanPiperWebhook?bizId=${uid}`
    : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const save = async () => {
    if (!uid || !creds.apiUsername || !creds.apiKey) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "businesses", uid, "onlineIntegrations", "urbanpiper"),
        { ...creds, connectedAt: Date.now(), mode: "auto" }, { merge: true });
      setSaved(true);
      setTimeout(() => { onConnected(); onClose(); }, 1200);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const STEPS = [
    {
      num: 1, title: "Request access from UrbanPiper",
      desc: "UrbanPiper connects your Swiggy & Zomato to any POS. They don't have a self-serve signup — click below to request a free demo. Their team will set you up (usually 1–2 days).",
      action: (
        <div className="space-y-2">
          <a href="https://www.urbanpiper.com/get-a-free-demo" target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 text-white text-sm font-black hover:opacity-90 transition">
            🌐 Request Free Demo on UrbanPiper
          </a>
          <p className="text-[10px] text-white/25 text-center">They'll email you login credentials within 1–2 business days</p>
        </div>
      ),
    },
    {
      num: 2, title: "Connect Swiggy & Zomato in UrbanPiper",
      desc: "Inside UrbanPiper, go to Platforms → click Add Platform → select Swiggy and/or Zomato → follow their steps.",
      action: (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 text-center">
            <p className="text-2xl">🧡</p><p className="text-xs font-black text-orange-300 mt-1">Swiggy</p>
            <p className="text-[10px] text-white/30 mt-0.5">Add as platform</p>
          </div>
          <div className="p-3 rounded-2xl border border-red-500/25 bg-red-500/8 text-center">
            <p className="text-2xl">❤️</p><p className="text-xs font-black text-red-300 mt-1">Zomato</p>
            <p className="text-[10px] text-white/30 mt-0.5">Add as platform</p>
          </div>
        </div>
      ),
    },
    {
      num: 3, title: "Add this webhook URL in UrbanPiper",
      desc: "In UrbanPiper: Settings → Integrations → Webhooks → Add New → paste the URL below.",
      action: (
        <div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-black/30 border border-white/10 mb-2">
            <code className="text-[10px] text-emerald-300 font-mono flex-1 break-all leading-relaxed">{webhookUrl}</code>
            <button onClick={copyUrl} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${copied ? "bg-emerald-500 text-white" : "bg-white/10 text-white/50 hover:bg-white/15"}`}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[10px] text-white/25 text-center">This is your personal order receiving address</p>
        </div>
      ),
    },
    {
      num: 4, title: "Enter your UrbanPiper credentials",
      desc: "In UrbanPiper: Settings → API → copy your Username and API Key, then paste them below.",
      action: (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1.5">API Username</p>
            <input value={creds.apiUsername} onChange={e => setCreds(c => ({ ...c, apiUsername: e.target.value }))}
              placeholder="your-username"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-400/40" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/35 uppercase tracking-wider mb-1.5">API Key</p>
            <input type="password" value={creds.apiKey} onChange={e => setCreds(c => ({ ...c, apiKey: e.target.value }))}
              placeholder="Paste from UrbanPiper settings"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-400/40" />
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={save}
            disabled={saving || saved || !creds.apiUsername || !creds.apiKey}
            className={`w-full py-3.5 rounded-2xl text-sm font-black transition flex items-center justify-center gap-2 ${
              saved ? "bg-emerald-500 text-white" : "bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-40"
            }`}>
            {saved ? "✅ Connected!" : saving ? <><Spin /> Connecting…</> : "🔗 Connect & Finish"}
          </motion.button>
        </div>
      ),
    },
  ];

  const currentStep = STEPS[step - 1];

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0d1520 0%,#060a10 100%)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-violet-300/60 uppercase tracking-wider">Auto-Connect Setup</p>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/6 text-white/30 hover:bg-white/12 flex items-center justify-center text-xs transition">✕</button>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.num}>
                <button onClick={() => i < step - 1 && setStep(s.num)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition ${
                    s.num === step ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                    : s.num < step ? "bg-emerald-500 text-white"
                    : "bg-white/8 text-white/25"
                  }`}>
                  {s.num < step ? "✓" : s.num}
                </button>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${s.num < step ? "bg-emerald-500/40" : "bg-white/8"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }} className="px-5 py-5 space-y-4">
            <div>
              <h3 className="text-white font-black text-base mb-1">{currentStep.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{currentStep.desc}</p>
            </div>
            {currentStep.action}
          </motion.div>
        </AnimatePresence>

        {/* Nav buttons */}
        <div className="px-5 pb-5 flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 rounded-xl bg-white/6 border border-white/10 text-white/40 text-sm font-bold hover:bg-white/10 transition">← Back</button>
          )}
          {step < 4 && (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-black hover:bg-white/15 transition">
              Next step →
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Landing Screen (not connected) ───────────────────────────────────────────
function LandingScreen({ onManual, onAutoConnect }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      {/* Platform icons */}
      <div className="flex items-center gap-4 mb-6">
        {["🧡","❤️","💗"].map((e, i) => (
          <motion.div key={i} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2, delay: i * 0.4, ease: "easeInOut" }}
            className="w-14 h-14 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center text-2xl shadow-lg">
            {e}
          </motion.div>
        ))}
      </div>

      <h2 className="text-white font-black text-xl mb-2">Swiggy & Zomato Orders</h2>
      <p className="text-white/35 text-sm max-w-xs mb-8 leading-relaxed">
        Get all your delivery app orders flowing directly into your kitchen — no switching between tablets.
      </p>

      {/* Option 1: Manual (works now) */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={onManual}
        className="w-full max-w-sm py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-base mb-3 hover:opacity-90 transition shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2.5">
        <span className="text-xl">🛵</span>
        <div className="text-left">
          <p className="text-sm font-black">Enter Orders Manually</p>
          <p className="text-[11px] font-normal opacity-70">Works right now — no setup needed</p>
        </div>
      </motion.button>

      {/* Option 2: Auto-connect */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={onAutoConnect}
        className="w-full max-w-sm py-4 rounded-2xl border border-white/12 bg-white/5 text-white font-black text-base hover:bg-white/10 transition flex items-center justify-center gap-2.5 mb-6">
        <span className="text-xl">⚡</span>
        <div className="text-left">
          <p className="text-sm font-black">Auto-Connect via UrbanPiper</p>
          <p className="text-[11px] font-normal text-white/40">Free service · Orders arrive automatically</p>
        </div>
      </motion.button>

      <p className="text-white/20 text-[11px] max-w-xs">UrbanPiper is a free middleware used by 5000+ Indian restaurants to connect Swiggy, Zomato &amp; Magicpin to their kitchen.</p>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function OnlineOrdersPanel() {
  const { tc } = usePOSTheme();
  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Reactive uid — covers auth race when component mounts before IndexedDB restores
  const [uid, setUid] = useState(() => getUid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);
  const [filter,      setFilter]      = useState("new");
  const [expanded,    setExpanded]    = useState(null);
  const [toast,       setToast]       = useState(null);
  const [connected,   setConnected]   = useState(false);
  const [showManual,  setShowManual]  = useState(false);
  const [showWizard,  setShowWizard]  = useState(false);
  const [syncing,     setSyncing]     = useState(false);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "businesses", uid, "onlineIntegrations", "urbanpiper"))
      .then(snap => setConnected(snap.exists() && !!snap.data()?.apiUsername));
  }, [uid]);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ONLINE = ["swiggy","zomato","dunzo","magicpin","online"];
    const ref    = collection(db, "businesses", uid, "kitchenOrders");
    const q      = query(ref, where("source","in", ONLINE), orderBy("createdAt","desc"));
    let fallbackUnsub = null;
    const unsub  = onSnapshot(q,
      snap => { setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      ()   => {
        fallbackUnsub = onSnapshot(query(ref, orderBy("createdAt","desc")), snap => {
          const S = new Set(ONLINE);
          setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => S.has(o.source)));
          setLoading(false);
        }, () => setLoading(false));
      }
    );
    return () => { unsub(); fallbackUnsub?.(); };
  }, [uid]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }, []);

  const handleAction = useCallback(async (firestoreOrderId, action, prepTime, rejectReason) => {
    if (!uid) return;
    try {
      await httpsCallable(functions, "onlineOrderAction")({ bizId: uid, firestoreOrderId, action, prepTime, rejectReason });
      showToast(action === "accept" ? `Accepted · ${prepTime}m prep` : "Order rejected");
      if (action === "accept") setExpanded(null);
    } catch (err) { showToast(err.message || "Action failed", "error"); }
  }, [uid, showToast]);

  const handleSync = async () => {
    if (!uid || syncing) return;
    setSyncing(true);
    try {
      const r = await httpsCallable(functions, "syncUrbanPiperOrders")({ bizId: uid });
      showToast(`Synced ${r.data.synced} new orders`);
    } catch { showToast("Sync failed", "error"); } finally { setSyncing(false); }
  };

  const filtered   = useMemo(() => {
    if (filter === "new")    return orders.filter(o => o.status === "new");
    if (filter === "active") return orders.filter(o => ["new","accepted","preparing","ready"].includes(o.status));
    return orders;
  }, [orders, filter]);

  const newCount    = orders.filter(o => o.status === "new").length;
  const activeCount = orders.filter(o => ["new","accepted","preparing","ready"].includes(o.status)).length;
  const todayRev    = useMemo(() => {
    const midnight = new Date(); midnight.setHours(0,0,0,0);
    return orders.filter(o => o.createdAt >= midnight.getTime() && !["rejected","cancelled"].includes(o.status))
                 .reduce((s, o) => s + (o.totals?.grandTotal || 0), 0);
  }, [orders]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>

      {/* Landing — show only if no orders yet and not connected */}
      {!loading && orders.length === 0 && !connected ? (
        <LandingScreen onManual={() => setShowManual(true)} onAutoConnect={() => setShowWizard(true)} />
      ) : (
        <>
          {/* Header */}
          <div className={`px-5 pt-5 pb-4 shrink-0 border-b ${tc.borderSoft}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">�</span>
                <h1 className={`text-lg font-black ${tc.textPrimary}`}>Online Orders</h1>
                {newCount > 0 && (
                  <motion.span animate={{ scale:[1,1.2,1] }} transition={{ repeat:Infinity, duration:1.2 }}
                    className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white">{newCount} NEW</motion.span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowManual(true)}
                  className="px-3 py-1.5 rounded-xl bg-orange-500/12 border border-orange-500/20 text-orange-300 text-[11px] font-bold hover:bg-orange-500/20 transition">
                  + Add Order
                </button>
                {connected && (
                  <button onClick={handleSync} disabled={syncing}
                    className="px-3 py-1.5 rounded-xl bg-white/6 border border-white/10 text-white/40 text-[11px] font-bold hover:bg-white/10 transition disabled:opacity-40 flex items-center gap-1">
                    <motion.span animate={syncing ? {rotate:360} : {}} transition={{repeat:Infinity,duration:1,ease:"linear"}}>🔄</motion.span> Sync
                  </button>
                )}
                <button onClick={() => setShowWizard(true)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition ${connected ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-white/6 border-white/10 text-white/40 hover:bg-white/10"}`}>
                  {connected ? "🔗 Connected" : "⚙️ Setup"}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { l:"New",          v: newCount,             c:"text-amber-300",   b:"bg-amber-500/8",   bo:"border-amber-500/12" },
                { l:"Active",       v: activeCount,          c:"text-blue-300",    b:"bg-blue-500/8",    bo:"border-blue-500/12"  },
                { l:"Today's Rev",  v:`₹${todayRev.toFixed(0)}`, c:"text-emerald-300", b:"bg-emerald-500/8", bo:"border-emerald-500/12" },
              ].map(s => (
                <div key={s.l} className={`${s.b} border ${s.bo} rounded-xl px-2 py-2 text-center`}>
                  <p className={`text-base font-black ${s.c}`}>{s.v}</p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wide">{s.l}</p>
                </div>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2">
              {[["new",`🔔 New (${newCount})`],["active",`⚡ Active (${activeCount})`],["all","🗂 All"]].map(([f,l]) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${filter===f ? "bg-white/15 border-white/20 text-white" : "bg-white/4 border-white/8 text-white/35 hover:bg-white/8"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Orders list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1, ease:"linear" }}
                  className="w-7 h-7 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
                <p className="text-white/25 text-sm">Loading orders…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                <div className="text-4xl opacity-10">🛵</div>
                <p className="text-white/25 text-sm">No orders in this view</p>
                <button onClick={() => setShowManual(true)}
                  className="mt-1 px-4 py-2 rounded-xl bg-orange-500/12 border border-orange-500/20 text-orange-300 text-xs font-bold hover:bg-orange-500/20 transition">
                  + Add order manually
                </button>
              </div>
            ) : filtered.map(order => (
              <OrderCard key={order.id} order={order} onAction={handleAction}
                expanded={expanded === order.id}
                onToggle={() => setExpanded(expanded === order.id ? null : order.id)} />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showManual && (
          <ManualEntryModal onClose={() => setShowManual(false)}
            onSaved={() => { setShowManual(false); showToast("Order sent to kitchen! 🍳"); }} />
        )}
        {showWizard && (
          <AutoConnectWizard onClose={() => setShowWizard(false)}
            onConnected={() => { setConnected(true); showToast("UrbanPiper connected! 🔗"); }} />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl ${
              toast.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
            }`}>{toast.msg}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

