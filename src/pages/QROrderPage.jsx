/**
 * QROrderPage — Public customer-facing ordering page
 * URL: /qr-order?biz={uid}&table={tableId}
 * No auth required. Customers scan QR → browse menu → place order → KDS.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, doc, getDoc, getDocs, addDoc, onSnapshot,
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

// ── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, qty, onAdd, onRemove }) {
  const isVeg = normalizeType(item.type) === "veg";
  const available = item.available !== false;

  return (
    <motion.div
      layout
      className={`rounded-2xl border transition-all overflow-hidden ${
        available
          ? "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
          : "border-white/4 bg-white/1 opacity-50"
      }`}
    >
      {item.image && (
        <div className="relative w-full h-32 overflow-hidden">
          <img src={item.image} alt={item.name}
            className="w-full h-full object-cover"
            onError={e => { e.currentTarget.style.display = "none"; }}
          />
          {!available && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-xs font-black text-white/60 bg-black/40 px-3 py-1 rounded-full">Unavailable</span>
            </div>
          )}
        </div>
      )}
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-start gap-2 mb-1.5">
          {/* Veg/nonveg dot */}
          <div className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border-[1.5px] flex items-center justify-center ${
            isVeg ? "border-emerald-500" : "border-red-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-400" : "bg-red-400"}`} />
          </div>
          <p className="text-sm font-bold text-white/90 leading-tight flex-1">{item.name}</p>
        </div>
        {item.description && (
          <p className="text-[10px] text-white/35 leading-relaxed mb-2 line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-base font-black text-white">₹{item.price}</span>
            {item.tax > 0 && <span className="text-[9px] text-white/25 ml-1">+{item.tax}% GST</span>}
          </div>
          {available ? (
            qty > 0 ? (
              <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-1.5 py-1">
                <button onClick={onRemove}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-black transition">−</button>
                <span className="text-sm font-black text-emerald-300 min-w-[16px] text-center">{qty}</span>
                <button onClick={onAdd}
                  className="w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center text-sm font-black transition">+</button>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.92 }} onClick={onAdd}
                className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-black hover:bg-emerald-500/25 transition">
                ADD +
              </motion.button>
            )
          ) : (
            <span className="text-[10px] text-white/30 font-medium">Unavailable</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Order Tracker ─────────────────────────────────────────────────────────────
function OrderTracker({ orderId, bizUid, tableName, onNewOrder }) {
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
        className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center text-4xl mb-6"
      >✅</motion.div>

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
export default function QROrderPage() {
  const bizUid  = useQp("biz");
  const tableId = useQp("table");

  const [phase, setPhase]       = useState("loading"); // loading | menu | placing | tracking | error
  const [bizName, setBizName]   = useState("");
  const [table,   setTable]     = useState(null);
  const [categories, setCats]   = useState([]);
  const [items,   setItems]     = useState([]);
  const [selCat,  setSelCat]    = useState("");
  const [cart,    setCart]      = useState({}); // { itemId: qty }
  const [search,  setSearch]    = useState("");
  const [showCart, setShowCart] = useState(false);
  const [custName, setCustName] = useState("");
  const [custNote, setCustNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId]   = useState(null);
  const [errMsg, setErrMsg]     = useState("");
  const catBarRef = useRef(null);

  // Load data
  useEffect(() => {
    if (!bizUid || !tableId) { setErrMsg("Invalid QR code — missing restaurant or table info."); setPhase("error"); return; }

    (async () => {
      try {
        // Business info
        const bizSnap = await getDoc(doc(db, "businesses", bizUid));
        if (!bizSnap.exists()) { setErrMsg("Restaurant not found."); setPhase("error"); return; }
        setBizName(bizSnap.data()?.businessName || bizSnap.data()?.name || "Restaurant");

        // Table info
        const tableSnap = await getDoc(doc(db, "businesses", bizUid, "tables", tableId));
        if (!tableSnap.exists()) { setErrMsg("Table not found."); setPhase("error"); return; }
        setTable({ id: tableSnap.id, ...tableSnap.data() });

        // Categories
        const catSnap = await getDocs(collection(db, "businesses", bizUid, "categories"));
        const cats = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCats(cats);
        if (cats.length) setSelCat(cats[0].id);

        // Items (available only)
        const itemSnap = await getDocs(collection(db, "businesses", bizUid, "items"));
        setItems(itemSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(it => it.available !== false));

        setPhase("menu");
      } catch (e) {
        console.error(e);
        setErrMsg("Failed to load menu. Please try again.");
        setPhase("error");
      }
    })();
  }, [bizUid, tableId]);

  const addItem    = useCallback((id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 })), []);
  const removeItem = useCallback((id) => setCart(c => { const n = { ...c }; if ((n[id] || 0) > 1) n[id]--; else delete n[id]; return n; }), []);

  const cartItems = useMemo(() =>
    items.filter(it => cart[it.id] > 0).map(it => ({ ...it, qty: cart[it.id] })),
    [items, cart]
  );
  const cartCount = useMemo(() => Object.values(cart).reduce((s, v) => s + v, 0), [cart]);
  const cartTotal = useMemo(() =>
    cartItems.reduce((s, it) => s + it.price * it.qty, 0), [cartItems]
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
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const orderData = {
        items: cartItems.map(it => ({
          product: { id: it.id, name: it.name, price: it.price, tax: it.tax || 0 },
          qty: it.qty,
          note: "",
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
      setCart({});
      setShowCart(false);
      setPhase("tracking");
    } catch (e) {
      console.error(e);
      alert("Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const tableName = table?.name || `Table ${table?.number || ""}`;

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
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "linear-gradient(180deg,#080e18 0%,#050a10 100%)" }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
      <p className="text-white/30 text-sm">Loading menu…</p>
    </div>
  );

  // ── Render: Order tracking ──
  if (phase === "tracking") return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#080e18 0%,#050a10 100%)" }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/6"
        style={{ background: "rgba(8,14,24,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-base">🍽️</div>
        <div>
          <p className="text-white font-black text-sm">{bizName}</p>
          <p className="text-white/35 text-[10px]">{tableName}</p>
        </div>
      </div>
      <OrderTracker
        orderId={orderId}
        bizUid={bizUid}
        tableName={tableName}
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
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">🍽️</div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm truncate">{bizName}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/35">{tableName}</span>
              {table?.zone && <><span className="text-white/15">·</span><span className="text-[10px] text-white/25 capitalize">{table.zone}</span></>}
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search dishes…"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white/6 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
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
          <div className="flex flex-col items-center py-16 gap-2 text-center">
            <div className="text-4xl opacity-15">🍽️</div>
            <p className="text-white/30 text-sm">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredItems.map(item => (
              <ItemCard key={item.id} item={item}
                qty={cart[item.id] || 0}
                onAdd={() => addItem(item.id)}
                onRemove={() => removeItem(item.id)}
              />
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
                {cartItems.map(it => (
                  <div key={it.id} className="flex items-center gap-3 py-2.5 border-b border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85 font-semibold truncate">{it.name}</p>
                      <p className="text-xs text-white/35">₹{it.price} × {it.qty}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-full px-1.5 py-1 shrink-0">
                      <button onClick={() => removeItem(it.id)} className="w-5 h-5 rounded-full bg-white/10 text-white text-sm flex items-center justify-center font-black">−</button>
                      <span className="text-sm font-black text-white min-w-[16px] text-center">{it.qty}</span>
                      <button onClick={() => addItem(it.id)} className="w-5 h-5 rounded-full bg-emerald-500 text-white text-sm flex items-center justify-center font-black">+</button>
                    </div>
                    <span className="text-sm font-black text-white/70 w-14 text-right shrink-0">₹{(it.price * it.qty).toFixed(0)}</span>
                  </div>
                ))}
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
    </div>
  );
}
