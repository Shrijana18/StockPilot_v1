/**
 * QROrderPage — Public customer-facing ordering page
 * URL: /qr-order?biz={uid}&table={tableId}
 * No auth required. Customers scan QR → browse menu → place order → KDS.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, doc, getDoc, addDoc, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

// ── Helpers ───────────────────────────────────────────────────────────────────
const useQp = (key) => new URLSearchParams(window.location.search).get(key);

const normalizeType = (t = "") =>
  String(t).toLowerCase().replace(/[\s-]/g, "") === "nonveg" ? "nonveg" : "veg";

const STATUS_META = {
  pending:   { label: "Order Received",   icon: "⏳", color: "text-amber-300",  bar: "bg-amber-400",   step: 1 },
  preparing: { label: "Kitchen Cooking",  icon: "👨‍🍳", color: "text-blue-300",   bar: "bg-blue-400",    step: 2 },
  ready:     { label: "Ready to Serve",   icon: "🔔", color: "text-emerald-300", bar: "bg-emerald-400", step: 3 },
  served:    { label: "Served — Enjoy!",  icon: "🍽️", color: "text-violet-300",  bar: "bg-violet-400",  step: 4 },
  completed: { label: "Completed",        icon: "✅", color: "text-white/50",    bar: "bg-white/30",    step: 5 },
};

// ── Item Card ───────────────────────────────────────────────────────────────
function ItemCard({ item, qty, onAdd, onRemove }) {
  const isVeg = normalizeType(item.type) === "veg";
  const available = item.available !== false;

  return (
    <motion.div
      layout
      whileHover={available ? { y: -2, scale: 1.01 } : {}}
      className={`rounded-2xl border transition-all overflow-hidden ${
        available
          ? "border-white/[0.09] bg-white/[0.04] hover:border-white/[0.16] hover:bg-white/[0.07]"
          : "border-white/[0.04] bg-white/[0.02] opacity-45"
      }`}
    >
      {/* Image */}
      {item.image ? (
        <div className="relative w-full h-36 overflow-hidden">
          <img src={item.image} alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={e => { e.currentTarget.parentElement.style.display = "none"; }}
          />
          {/* Veg dot on image */}
          <div className="absolute top-2.5 left-2.5">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center bg-black/50 backdrop-blur-sm ${
              isVeg ? "border-emerald-400" : "border-red-400"
            }`}>
              <span className={`w-2 h-2 rounded-full ${ isVeg ? "bg-emerald-400" : "bg-red-400" }`} />
            </div>
          </div>
          {!available && (
            <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
              <span className="text-xs font-black text-white/70 bg-black/50 px-3 py-1.5 rounded-xl backdrop-blur-sm">Unavailable</span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-24 flex items-center justify-center bg-white/[0.03] relative">
          <span className="text-4xl opacity-25">🍽️</span>
          <div className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
            isVeg ? "border-emerald-500 bg-emerald-900/30" : "border-red-500 bg-red-900/30"
          }`}>
            <span className={`w-2 h-2 rounded-full ${ isVeg ? "bg-emerald-400" : "bg-red-400" }`} />
          </div>
        </div>
      )}

      <div className="px-3.5 pt-3 pb-3.5">
        <p className="text-sm font-bold text-white/90 leading-tight mb-1">{item.name}</p>
        {item.description && (
          <p className="text-[10px] text-white/35 leading-relaxed mb-2.5 line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex flex-col">
            <span className="text-base font-black text-white">₹{item.price}</span>
            {item.tax > 0 && <span className="text-[9px] text-white/25">+{item.tax}% GST incl.</span>}
          </div>
          {available ? (
            qty > 0 ? (
              <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-2 py-1.5">
                <motion.button whileTap={{ scale: 0.85 }} onClick={onRemove}
                  className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-base font-black transition">−</motion.button>
                <span className="text-sm font-black text-emerald-300 min-w-[18px] text-center">{qty}</span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={onAdd}
                  className="w-7 h-7 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center text-base font-black transition shadow-md shadow-emerald-500/30">+</motion.button>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.9 }} onClick={onAdd}
                className="flex items-center gap-1 px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black hover:bg-emerald-500/25 hover:border-emerald-400/50 transition shadow-sm">
                <span className="text-base leading-none">+</span> ADD
              </motion.button>
            )
          ) : (
            <span className="text-[10px] text-white/25 font-medium">Unavailable</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Addon Bottom Sheet ───────────────────────────────────────────────────────────
function AddonBottomSheet({ item, onConfirm, onClose }) {
  const [selections, setSelections] = useState({});
  const groups = item?.addonGroups || [];

  const toggle = (groupId, optionId, isMulti) => {
    setSelections(prev => {
      if (isMulti) {
        const curr = prev[groupId] || [];
        const exists = curr.includes(optionId);
        return { ...prev, [groupId]: exists ? curr.filter(id => id !== optionId) : [...curr, optionId] };
      }
      return { ...prev, [groupId]: [optionId] };
    });
  };

  const canConfirm = groups.every(g => !g.required || (selections[g.id] || []).length > 0);

  const handleConfirm = () => {
    const addons = [];
    let addonTotal = 0;
    groups.forEach(g => {
      (selections[g.id] || []).forEach(optId => {
        const opt = (g.options || []).find(o => o.id === optId);
        if (opt) { addons.push({ groupId: g.id, groupName: g.name, optionId: opt.id, name: opt.name, price: Number(opt.price) || 0 }); addonTotal += Number(opt.price) || 0; }
      });
    });
    const optionIds = addons.map(a => a.optionId).sort().join(",");
    const cartKey = optionIds ? `${item.id}::${optionIds}` : item.id;
    onConfirm({ addons, addonTotal, cartKey });
  };

  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="relative rounded-t-3xl border-t border-white/10 overflow-y-auto"
        style={{ background: "linear-gradient(170deg,#0d1a1a 0%,#070d0d 100%)", maxHeight: "82vh" }}
      >
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/15" /></div>
        <div className="px-5 pb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-white font-black text-base">{item.name}</h3>
            <p className="text-white/40 text-xs mt-0.5">Customize your order</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 text-white/50 text-xs flex items-center justify-center shrink-0">✕</button>
        </div>
        <div className="px-5 pb-4 space-y-4">
          {groups.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-white/60">{group.name}</p>
                {group.required && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/30">Required</span>}
                {!group.required && <span className="text-[10px] text-white/30">Optional</span>}
              </div>
              <div className="space-y-1.5">
                {(group.options || []).map(opt => {
                  const isSelected = (selections[group.id] || []).includes(opt.id);
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => toggle(group.id, opt.id, group.multiSelect !== false)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border text-left transition ${
                        isSelected ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-white/[0.04] border-white/8 text-white/70 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-emerald-400 bg-emerald-400" : "border-white/25"
                        }`}>{isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}</span>
                        <span className="text-sm font-medium">{opt.name}</span>
                      </div>
                      {Number(opt.price) > 0 && <span className={`text-xs font-bold ${isSelected ? "text-emerald-300" : "text-white/40"}`}>+₹{Number(opt.price).toFixed(0)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 px-5 pb-8 pt-3 border-t border-white/6" style={{ background: "rgba(7,13,13,0.97)" }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleConfirm} disabled={!canConfirm}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] disabled:opacity-50 transition"
          >Add to Order</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Order Tracker ──────────────────────────────────────────────────────────────
function OrderTracker({ orderId, bizUid, tableName, bizName, bizLogo, onNewOrder }) {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!orderId || !bizUid) return;
    const unsub = onSnapshot(
      doc(db, "businesses", bizUid, "kitchenOrders", orderId),
      snap => { if (snap.exists()) setOrder({ id: snap.id, ...snap.data() }); }
    );
    return unsub;
  }, [orderId, bizUid]);

  const meta = STATUS_META[order?.status] || STATUS_META.pending;
  const steps = ["pending", "preparing", "ready", "served"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-16 px-4 pb-8">
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mb-6 overflow-hidden relative"
      >
        {bizLogo ? (
          <img src={bizLogo} alt={bizName} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }} />
        ) : null}
        <div className={`${bizLogo ? 'hidden' : 'flex'} w-full h-full items-center justify-center`}>
          <img src="/assets/flyp_logo.png" alt="FLYP" className="w-10 h-10 object-contain" onError={e => { e.currentTarget.parentElement.innerHTML = '\u2705'; }} />
        </div>
        <motion.div className="absolute inset-0 rounded-full border-2 border-emerald-400"
          initial={{ scale: 0, opacity: 1 }} animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </motion.div>

      <h2 className="text-2xl font-black text-white mb-1">Order Placed!</h2>
      <p className="text-white/40 text-sm mb-8 text-center">Your order has been sent to the kitchen · <strong className="text-white/60">{tableName}</strong></p>

      {/* Status card */}
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-white/10 bg-white/4 p-5 mb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className={`text-3xl`}>{meta.icon}</div>
            <div>
              <p className={`text-lg font-black ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-white/35">Live status updates</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-1 mb-5">
            {steps.map((s, i) => {
              const sm = STATUS_META[s];
              const done = sm.step <= meta.step;
              const active = s === order?.status;
              return (
                <React.Fragment key={s}>
                  <div className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                    done ? sm.bar : "bg-white/10"
                  } ${active ? "ring-2 ring-white/20" : ""}`} />
                  {i < steps.length - 1 && <div className="w-0.5 h-2 bg-white/10" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Items summary */}
          {order && (
            <div className="space-y-1">
              {(order.items || []).slice(0, 4).map((it, i) => (
                <div key={i} className="flex justify-between text-xs text-white/50">
                  <span>{it.product?.name || it.name || "Item"} ×{it.qty || 1}</span>
                  <span>₹{((it.qty || 1) * (it.product?.price || 0)).toFixed(0)}</span>
                </div>
              ))}
              {(order.items || []).length > 4 && (
                <p className="text-[10px] text-emerald-300/40">+{order.items.length - 4} more items</p>
              )}
            </div>
          )}
        </div>

        {/* New order button */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={onNewOrder}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-sm shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_28px_rgba(16,185,129,0.45)] transition"
        >+ Order More Items</motion.button>

        <p className="text-center text-[10px] text-white/20 mt-4">Powered by FLYP POS</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
// ── Splash Screen ────────────────────────────────────────────────────────────
function SplashScreen({ bizName, bizTagline, bizLogo, bizAddress, tableName, tableZone, onEnter }) {
  const [step, setStep] = useState(0); // 0=logo, 1=name, 2=table

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700);
    const t2 = setTimeout(() => setStep(2), 1500);
    const t3 = setTimeout(() => onEnter(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onEnter]);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(160deg,#071a2b 0%,#0b2944 55%,#060c17 100%)" }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35 }}
      onClick={onEnter}
    >
      {/* Aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-16 w-[70%] h-[70%] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 65%)" }} />
        <div className="absolute -bottom-32 -right-16 w-[65%] h-[65%] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.16) 0%, transparent 65%)" }} />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Business Logo or FLYP Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.1 }}
          className="mb-5"
        >
          {bizLogo ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              <img src={bizLogo} alt={bizName} className="w-full h-full object-cover"
                onError={e => { e.currentTarget.parentElement.style.display='none'; }}
              />
            </div>
          ) : (
            <img src="/assets/flyp_logo.png" alt="FLYP"
              className="w-20 h-20 object-contain drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]"
              onError={e => { e.target.style.display = "none"; }}
            />
          )}
        </motion.div>

        {/* FLYP POS label */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: step >= 0 ? 1 : 0, y: step >= 0 ? 0 : 6 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-[10px] font-black tracking-[0.3em] text-emerald-400/70 uppercase mb-6"
        >FLYP POS</motion.div>

        {/* Business Name */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="text-center mb-2"
            >
              <h1 className="text-3xl font-black text-white leading-tight">
                Welcome to
              </h1>
              <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent leading-tight mt-0.5">
                {bizName || "Our Restaurant"}
              </h2>
              {bizTagline && (
                <p className="text-white/40 text-sm mt-2">{bizTagline}</p>
              )}
              {bizAddress && (
                <p className="text-white/25 text-[10px] mt-1">{bizAddress}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table info */}
        <AnimatePresence>
          {step >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="mt-5 px-5 py-3 rounded-2xl border border-white/[0.12] bg-white/[0.07] backdrop-blur-sm flex items-center gap-3"
            >
              <span className="text-2xl">🪑</span>
              <div className="text-left">
                <div className="text-white font-bold text-sm">{tableName}</div>
                {tableZone && <div className="text-white/40 text-[11px] capitalize">{tableZone} zone</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap to view menu */}
        {step >= 2 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white/25 text-xs mt-8 animate-pulse"
          >Tap anywhere to view menu</motion.p>
        )}
      </div>

      {/* Powered by FLYP */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: step >= 1 ? 1 : 0 }}
          className="flex items-center gap-2"
        >
          <img src="/assets/flyp_logo.png" alt="FLYP" className="w-5 h-5 object-contain opacity-30"
            onError={e => e.target.style.display="none"} />
          <span className="text-[10px] text-white/25 font-semibold tracking-widest uppercase">Powered by FLYP</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function QROrderPage() {
  const bizUid  = useQp("biz");
  const tableId = useQp("table");

  const [phase, setPhase]           = useState("loading"); // loading | splash | menu | tracking | error
  const [bizName, setBizName]       = useState("");
  const [bizTagline, setBizTagline] = useState("");
  const [bizLogo, setBizLogo]       = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [table,   setTable]         = useState(null);
  const [categories, setCats]   = useState([]);
  const [items,   setItems]     = useState([]);
  const [selCat,  setSelCat]    = useState("");
  const [cart,    setCart]      = useState([]); // [{ cartKey, itemId, item, qty, addons, addonTotal }]
  const [showAddonSheet, setShowAddonSheet] = useState(false);
  const [addonSheetItem, setAddonSheetItem] = useState(null);
  const [search,  setSearch]    = useState("");
  const [showCart, setShowCart] = useState(false);
  const [custName, setCustName] = useState("");
  const [custNote, setCustNote] = useState("");
  const [itemNotes, setItemNotes] = useState({}); // { [cartKey]: string }
  const [showNoteFor, setShowNoteFor] = useState(null); // cartKey
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId]   = useState(null);
  const [errMsg, setErrMsg]     = useState("");
  const catBarRef = useRef(null);

  // Load business + table info (one-time)
  useEffect(() => {
    if (!bizUid || !tableId) { setErrMsg("Invalid QR code — missing restaurant or table info."); setPhase("error"); return; }
    (async () => {
      try {
        const [bizSnap, settingsSnap, tableSnap] = await Promise.all([
          getDoc(doc(db, "businesses", bizUid)),
          getDoc(doc(db, "businesses", bizUid, "posConfig", "restaurantSettings")),
          getDoc(doc(db, "businesses", bizUid, "tables", tableId)),
        ]);
        if (!bizSnap.exists()) { setErrMsg("Restaurant not found."); setPhase("error"); return; }
        const bd = bizSnap.data();
        const rs = settingsSnap.data()?.business || {};
        setBizName(rs.name || bd?.businessInfo?.name || bd?.businessName || bd?.name || "Restaurant");
        setBizTagline(rs.tagline || bd?.tagline || bd?.businessInfo?.tagline || "");
        setBizLogo(rs.logoUrl || bd?.businessInfo?.logoUrl || bd?.logoUrl || "");
        setBizAddress([rs.address, rs.city].filter(Boolean).join(", ") || bd?.address || "");
        if (!tableSnap.exists()) { setErrMsg("Table not found."); setPhase("error"); return; }
        setTable({ id: tableSnap.id, ...tableSnap.data() });
      } catch (e) {
        console.error(e);
        setErrMsg("Failed to load menu. Please try again.");
        setPhase("error");
      }
    })();
  }, [bizUid, tableId]);

  // Real-time categories listener
  useEffect(() => {
    if (!bizUid) return;
    const unsub = onSnapshot(
      collection(db, "businesses", bizUid, "categories"),
      snap => {
        const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCats(cats);
        setSelCat(prev => prev || cats[0]?.id || "");
      },
      err => console.warn("[QROrder] categories:", err?.message)
    );
    return unsub;
  }, [bizUid]);

  // Real-time items listener — triggers splash when data is ready
  useEffect(() => {
    if (!bizUid) return;
    const unsub = onSnapshot(
      collection(db, "businesses", bizUid, "items"),
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(it => it.available !== false));
        setPhase(prev => prev === "loading" ? "splash" : prev);
      },
      err => console.warn("[QROrder] items:", err?.message)
    );
    return unsub;
  }, [bizUid]);

  const addItemToCart = useCallback((item, qty = 1, addons = [], addonTotal = 0, cartKey = null) => {
    const key = cartKey || item.id;
    setCart(prev => {
      const existing = prev.findIndex(l => l.cartKey === key);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, qty: l.qty + qty } : l);
      }
      return [...prev, { cartKey: key, itemId: item.id, item, qty, addons, addonTotal }];
    });
  }, []);

  const removeItemFromCart = useCallback((cartKey) => {
    setCart(prev => {
      const line = prev.find(l => l.cartKey === cartKey);
      if (!line) return prev;
      if (line.qty > 1) return prev.map(l => l.cartKey === cartKey ? { ...l, qty: l.qty - 1 } : l);
      return prev.filter(l => l.cartKey !== cartKey);
    });
  }, []);

  const addItem = useCallback((item) => {
    if ((item.addonGroups || []).length > 0) {
      setAddonSheetItem(item);
      setShowAddonSheet(true);
    } else {
      addItemToCart(item);
    }
  }, [addItemToCart]);

  const removeItem = useCallback((itemId) => {
    setCart(prev => {
      const entries = prev.filter(l => l.itemId === itemId);
      if (entries.length === 0) return prev;
      const last = entries[entries.length - 1];
      if (last.qty > 1) return prev.map(l => l.cartKey === last.cartKey ? { ...l, qty: l.qty - 1 } : l);
      return prev.filter(l => l.cartKey !== last.cartKey);
    });
  }, []);

  const getItemQty = useCallback((itemId) => cart.filter(l => l.itemId === itemId).reduce((s, l) => s + l.qty, 0), [cart]);

  const cartItems = cart;
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const cartTotal = useMemo(() =>
    cart.reduce((s, l) => s + (Number(l.item.price || 0) + Number(l.addonTotal || 0)) * l.qty, 0), [cart]
  );

  const filteredItems = useMemo(() => {
    let list = selCat ? items.filter(it => it.categoryId === selCat) : items;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(it => (it.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [items, selCat, search]);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const orderData = {
        items: cart.map(line => ({
          product: { id: line.item.id, name: line.item.name, price: line.item.price, tax: line.item.tax || 0 },
          qty: line.qty,
          addons: line.addons || [],
          addonTotal: line.addonTotal || 0,
          cartKey: line.cartKey,
          note: itemNotes[line.cartKey] || "",
        })),
        totals: {
          subTotal: +cartTotal.toFixed(2),
          tax: 0,
          grandTotal: +cartTotal.toFixed(2),
        },
        tableId,
        tableName: table?.name || `Table ${table?.number}`,
        tableZone: table?.zone || "",
        customerName: custName.trim() || "Guest",
        customerNote: custNote.trim(),
        status: "pending",
        source: "qr-order",
        createdAt: Date.now(),
        sentAt: Date.now(),
      };
      const ref = await addDoc(
        collection(db, "businesses", bizUid, "kitchenOrders"),
        orderData
      );
      setOrderId(ref.id);
      setCart([]);
      setItemNotes({});
      setShowCart(false);
      setPhase("tracking");
    } catch (e) {
      console.error(e);
      alert("Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const tableName  = table?.name || `Table ${table?.number || ""}`;
  const tableZone  = table?.zone || "";

  // ── Render: Error ──
  if (phase === "error") return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(180deg,#080e18 0%,#050a10 100%)" }}>
      <div className="text-5xl mb-4 opacity-30">🚫</div>
      <p className="text-white font-bold text-lg mb-2">Oops!</p>
      <p className="text-white/40 text-sm max-w-xs">{errMsg}</p>
    </div>
  );

  // ── Render: Loading ──
  if (phase === "loading") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: "linear-gradient(160deg,#071a2b 0%,#0b2944 55%,#060c17 100%)" }}>
      <img src="/assets/flyp_logo.png" alt="FLYP" className="w-14 h-14 object-contain opacity-60 animate-pulse" onError={e => e.target.style.display="none"} />
      <div className="flex flex-col items-center gap-2">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
        <p className="text-white/30 text-xs tracking-widest uppercase">Loading menu…</p>
      </div>
    </div>
  );

  // ── Render: Splash ──
  if (phase === "splash") return (
    <AnimatePresence>
      <SplashScreen
        bizName={bizName}
        bizTagline={bizTagline}
        bizLogo={bizLogo}
        bizAddress={bizAddress}
        tableName={tableName}
        tableZone={tableZone}
        onEnter={() => setPhase("menu")}
      />
    </AnimatePresence>
  );

  // ── Render: Order tracking ──
  if (phase === "tracking") return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#080e18 0%,#050a10 100%)" }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/6"
        style={{ background: "rgba(8,14,24,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-base shrink-0">
          {bizLogo
            ? <img src={bizLogo} alt={bizName} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display='none'; }}/>
            : <span>🍽️</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm truncate">{bizName}</p>
          <p className="text-white/35 text-[10px]">{tableName}{bizAddress ? ` · ${bizAddress}` : ""}</p>
        </div>
      </div>
      <OrderTracker
        orderId={orderId}
        bizUid={bizUid}
        tableName={tableName}
        bizName={bizName}
        bizLogo={bizLogo}
        onNewOrder={() => setPhase("menu")}
      />
    </div>
  );

  // ── Render: Menu ──
  return (
    <div className="min-h-screen pb-28 relative" style={{ background: "linear-gradient(180deg,#080e18 0%,#050a10 100%)" }}>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/6"
        style={{ background: "rgba(8,14,24,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-xl shrink-0">
            {bizLogo
              ? <img src={bizLogo} alt={bizName} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display='none'; }}/>
              : <span>🍽️</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm truncate">{bizName}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-white/35">{tableName}</span>
              {table?.zone && <><span className="text-white/15">·</span><span className="text-[10px] text-white/25 capitalize">{table.zone}</span></>}
              {bizAddress && <><span className="text-white/10">·</span><span className="text-[10px] text-white/20 truncate">{bizAddress}</span></>}
            </div>
          </div>
          {cartCount > 0 && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowCart(true)}
              className="relative px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-[0_2px_12px_rgba(16,185,129,0.4)]">
              🛒 {cartCount} · ₹{cartTotal.toFixed(0)}
            </motion.button>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search dishes…"
              autoComplete="off" autoCorrect="off" spellCheck="false"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50 placeholder:text-white/25"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'white', WebkitTextFillColor: 'white' }}
            />
          </div>
        </div>

        {/* Category pills */}
        {!search && (
          <div ref={catBarRef} className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelCat(cat.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition border whitespace-nowrap ${
                  selCat === cat.id
                    ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                    : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >{cat.icon ? `${cat.icon} ` : ""}{cat.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Items grid */}
      <div className="px-4 pt-4">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <div className="text-5xl opacity-15">🍽️</div>
            <p className="text-white/30 text-sm font-semibold">No items found</p>
            <p className="text-white/15 text-xs">Try a different category or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item, i) => (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.22 }}
              >
                <ItemCard item={item}
                  qty={getItemQty(item.id)}
                  onAdd={() => addItem(item)}
                  onRemove={() => removeItem(item.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky cart button */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-30"
          >
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCart(true)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-sm flex items-center justify-between px-5 shadow-[0_8px_32px_rgba(16,185,129,0.4)]"
            >
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-xs">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
              <span>View Cart</span>
              <span className="font-black">₹{cartTotal.toFixed(2)}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart bottom sheet */}
      <AnimatePresence>
        {showCart && (
          <motion.div className="fixed inset-0 z-50 flex flex-col justify-end"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="relative rounded-t-3xl border-t border-white/10 overflow-hidden"
              style={{ background: "linear-gradient(170deg,#0d1a1a 0%,#070d0d 100%)", maxHeight: "85vh" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              <div className="px-5 pb-2 flex items-center justify-between">
                <h3 className="text-white font-black text-base">Your Order</h3>
                <button onClick={() => setShowCart(false)} className="w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 text-white/50 text-xs flex items-center justify-center">✕</button>
              </div>

              <div className="overflow-y-auto px-5 pb-2" style={{ maxHeight: "40vh" }}>
                {cart.map(line => {
                  const linePrice = Number(line.item.price || 0) + Number(line.addonTotal || 0);
                  const hasNote = showNoteFor === line.cartKey;
                  return (
                  <div key={line.cartKey} className="py-2.5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/85 font-semibold truncate">{line.item.name}</p>
                        {(line.addons || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {line.addons.map((a, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[9px] font-medium">
                                +{a.name}{Number(a.price) > 0 ? ` ₹${Number(a.price).toFixed(0)}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {itemNotes[line.cartKey] && !hasNote && (
                          <p className="text-[10px] italic text-amber-300/60 mt-0.5 truncate">📝 {itemNotes[line.cartKey]}</p>
                        )}
                        <p className="text-xs text-white/35 mt-0.5">₹{linePrice.toFixed(0)} × {line.qty}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setShowNoteFor(hasNote ? null : line.cartKey)}
                          className={`w-7 h-7 rounded-xl border flex items-center justify-center text-sm transition ${hasNote || itemNotes[line.cartKey] ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10'}`}
                          title="Add note"
                        >📝</button>
                        <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-1.5 py-1">
                          <button onClick={() => removeItemFromCart(line.cartKey)} className="w-5 h-5 rounded-full bg-white/10 text-white text-sm flex items-center justify-center font-black">−</button>
                          <span className="text-sm font-black text-white min-w-[16px] text-center">{line.qty}</span>
                          <button onClick={() => { if ((line.item.addonGroups || []).length > 0) { setAddonSheetItem(line.item); setShowAddonSheet(true); } else { addItemToCart(line.item); } }} className="w-5 h-5 rounded-full bg-emerald-500 text-white text-sm flex items-center justify-center font-black">+</button>
                        </div>
                        <span className="text-sm font-black text-white/70 w-14 text-right">₹{(linePrice * line.qty).toFixed(0)}</span>
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      {hasNote && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 pb-0.5">
                            <input
                              autoFocus
                              value={itemNotes[line.cartKey] || ""}
                              onChange={e => setItemNotes(p => ({ ...p, [line.cartKey]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') setShowNoteFor(null); }}
                              placeholder="e.g. Extra spicy, no onion, less salt…"
                              className="w-full px-3 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 text-amber-100 text-xs placeholder:text-white/25 focus:outline-none focus:border-amber-400/40"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  );
                })}
              </div>

              {/* Customer name + note */}
              <div className="px-5 pt-3 pb-2 space-y-2">
                <input value={custName} onChange={e => setCustName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                />
                <textarea value={custNote} onChange={e => setCustNote(e.target.value)}
                  placeholder="Any special instructions? (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-400/40 resize-none"
                />
              </div>

              {/* Total + Place Order */}
              <div className="px-5 pb-8 space-y-3 border-t border-white/6 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">Total</span>
                  <span className="text-white font-black text-lg">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Pay at the counter after your meal
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={placeOrder} disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] disabled:opacity-60 flex items-center justify-center gap-2 transition"
                >
                  {submitting
                    ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />Placing Order…</>
                    : "🍳 Place Order"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Addon Bottom Sheet */}
      <AnimatePresence>
        {showAddonSheet && addonSheetItem && (
          <AddonBottomSheet
            item={addonSheetItem}
            onClose={() => { setShowAddonSheet(false); setAddonSheetItem(null); }}
            onConfirm={({ addons, addonTotal, cartKey }) => {
              addItemToCart(addonSheetItem, 1, addons, addonTotal, cartKey);
              setShowAddonSheet(false);
              setAddonSheetItem(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
