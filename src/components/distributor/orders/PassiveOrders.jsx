import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp, getDocs } from "firebase/firestore";
import { db, empAuth } from "../../../firebase/firebaseConfig";
import { toast } from "react-toastify";

/**
 * PassiveOrders.jsx
 * Distributor → (Provisional/Connected) Retailer
 * Step-by-step flow (Retailer → Products → Review) in a single file.
 * Tailwind-only, clean dark UI. Works with your existing Firestore schema.
 */

// ---------- Helpers ----------
const money = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
const norm = (s) => (s || "").toLowerCase().trim();

const PAYMENT_MODES = [
  { label: "Cash", value: "Cash" },
  { label: "Credit", value: "Credit" },
  { label: "Cash on Delivery", value: "COD" },
  { label: "Advance", value: "Advance" },
];

// Quick picks placeholder (replace with your inventory feed)
const QUICK_PICKS = [
  { id: "SKU-001", name: "Parle-G 100g", sku: "PG100", brand: "Parle", unit: "pkt", price: 8 },
  { id: "SKU-002", name: "Amul Butter 100g", sku: "AB100", brand: "Amul", unit: "pkt", price: 55 },
  { id: "SKU-003", name: "Marie 250g", sku: "BM250", brand: "Britannia", unit: "pkt", price: 30 },
];

const DEBUG = false;

// ---------- Component ----------
export default function PassiveOrders() {
  const [step, setStep] = useState(1); // 1 Retailer, 2 Products, 3 Review
  const [distributorId, setDistributorId] = useState(null);

  // Step 1: Retailer
  const [retailerQuery, setRetailerQuery] = useState("");
  const [retailerOpen, setRetailerOpen] = useState(false); // harmless now; kept for future focus UX
  const [selectedRetailer, setSelectedRetailer] = useState(null); // {id, displayName, phone, email, type: "provisional"|"connected"}
  const [retailerResults, setRetailerResults] = useState([]);
  const [retailerLoading, setRetailerLoading] = useState(false);

  // Step 2: Products
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [cart, setCart] = useState([]); // {key,name,sku,brand,unit,qty,price}
  // Derived totals
  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.price || 0), 0),
    [cart]
  );

  // Step 3: Review & Meta
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0].value);
  const [creditDays, setCreditDays] = useState(15);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef(null);

  // Resolve distributorId from auth (handles delayed auth availability)
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setDistributorId(u?.uid || null));
    // also set immediately if already available
    setDistributorId(auth.currentUser?.uid || null);
    return () => unsub();
  }, []);

  // --- Firestore Retailer Search (Live) ---
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!distributorId) { setRetailerResults([]); return; }
      setRetailerLoading(true);

      let connected = [];
      let provisional = [];

      // Read connectedRetailers (allowed by rules for owner)
      try {
        const conRef = collection(db, "businesses", distributorId, "connectedRetailers");
        const conSnap = await getDocs(conRef);
        connected = conSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}), __src: "connected" }));
        if (DEBUG) console.log("[Retailers] connectedRetailers size:", conSnap.size);
      } catch (e) {
        if (DEBUG) console.warn("[Retailers] connectedRetailers read blocked by rules or missing path:", e);
      }

      // Read provisionalRetailers (may be blocked by global rule; do not fail overall)
      try {
        const provRef = collection(db, "businesses", distributorId, "provisionalRetailers");
        const provSnap = await getDocs(provRef);
        provisional = provSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}), __src: "provisional" }));
        if (DEBUG) console.log("[Retailers] provisionalRetailers size:", provSnap.size);
      } catch (e) {
        if (DEBUG) console.warn("[Retailers] provisionalRetailers read blocked by rules or missing path:", e);
      }

      const all = [...connected, ...provisional]
        .map((r) => ({
          id: r.retailerId || r.id,
          displayName: r.retailerName || r.name || r.displayName || r.shopName || "Retailer",
          phone: r.retailerPhone || r.phone || "",
          email: r.retailerEmail || r.email || "",
          type:
            r.__src === "provisional" || r.source === "provisioned" || r.provisionalId
              ? "provisional"
              : "connected",
          provisionalId: r.provisionalId || null,
          status: r.status || "",
        }))
        .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

      const qtxt = norm(retailerQuery);
      const filtered = qtxt
        ? all.filter(
            (r) =>
              norm(r.displayName).includes(qtxt) ||
              norm(r.email).includes(qtxt) ||
              norm(r.phone).includes(qtxt)
          )
        : all;

      if (alive) {
        setRetailerResults(filtered.slice(0, 50));
        setRetailerLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [retailerQuery, distributorId]);

  // --- Firestore Product/Inventory Search (Live) ---
  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!distributorId) return;

      let items = [];

      // 1) Try /inventory
      try {
        const invRef = collection(db, "businesses", distributorId, "inventory");
        const invSnap = await getDocs(invRef);
        if (invSnap.size > 0) {
          items = invSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
          if (DEBUG) console.log("[Inventory] Using /inventory:", invSnap.size);
        }
      } catch (e) {
        if (DEBUG) console.warn("[Inventory] /inventory blocked by rules or missing:", e);
      }

      // 2) Fallback to /products
      if (!items.length) {
        try {
          const prodRef = collection(db, "businesses", distributorId, "products");
          const prodSnap = await getDocs(prodRef);
          if (prodSnap.size > 0) {
            items = prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
            if (DEBUG) console.log("[Inventory] Using /products:", prodSnap.size);
          }
        } catch (e) {
          if (DEBUG) console.warn("[Inventory] /products blocked by rules or missing:", e);
        }
      }

      // 3) Fallback to /items (POS)
      if (!items.length) {
        try {
          const posRef = collection(db, "businesses", distributorId, "items");
          const posSnap = await getDocs(posRef);
          if (posSnap.size > 0) {
            items = posSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
            if (DEBUG) console.log("[Inventory] Using /items:", posSnap.size);
          }
        } catch (e) {
          if (DEBUG) console.warn("[Inventory] /items blocked by rules or missing:", e);
        }
      }

      const normalized = items.map((it) => ({
        id: it.id,
        name: it.name || it.productName || it.title || "Unnamed",
        sku: it.sku || it.SKU || it.code || "",
        brand: it.brand || it.Brand || "",
        unit: it.unit || it.Unit || it.measure || "",
        price: Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.mrp ?? 0),
      }));

      if (alive) setCatalog(normalized);
    };

    load();
    return () => {
      alive = false;
    };
  }, [distributorId]);

  // Suggestions from catalog (live filter)
  useEffect(() => {
    const q = norm(search);
    if (!q) return setSuggestions([]);
    const list = catalog.filter(
      (p) => norm(p.name).includes(q) || norm(p.sku).includes(q) || norm(p.brand).includes(q)
    );
    setSuggestions(list.slice(0, 20));
  }, [search, catalog]);

  // ---------- Product Handlers ----------
  const addItem = (p, qty = 1) => {
    setCart((prev) => {
      const key = p.id || `${p.sku}-${p.name}`;
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], qty: Number(clone[idx].qty) + Number(qty) };
        return clone;
      }
      return [
        ...prev,
        {
          key,
          name: p.name,
          sku: p.sku || null,
          brand: p.brand || null,
          unit: p.unit || null,
          qty: Number(qty),
          price: Number(p.price || 0),
        },
      ];
    });
  };

  const removeItem = (key) => setCart((prev) => prev.filter((i) => i.key !== key));
  const inc = (key) => setCart((prev) => prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (key) =>
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: Math.max(0, i.qty - 1) } : i))
        .filter((i) => i.qty > 0)
    );
  const setQty = (key, val) =>
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: Math.max(0, Number.isInteger(+val) ? +val : i.qty) } : i))
        .filter((i) => i.qty > 0)
    );

  const onPickSuggestion = (p) => {
    addItem(p, 1);
    setSearch("");
    setSuggestions([]);
    setActiveIndex(-1);
    searchInputRef.current?.focus();
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      const val = search.trim();
      if (activeIndex >= 0 && suggestions[activeIndex]) return onPickSuggestion(suggestions[activeIndex]);
      if (val) {
        const exact =
          catalog.find((p) => norm(p.sku) === norm(val)) || catalog.find((p) => norm(p.name) === norm(val));
        if (exact) return onPickSuggestion(exact);
      }
      if (suggestions.length) return onPickSuggestion(suggestions[0]);
    } else if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  // ---------- Review / Submit ----------
  const validate = () => {
    if (!selectedRetailer) return "Select a retailer";
    if (cart.length === 0) return "Add at least one product";
    if (!deliveryDate) return "Select a delivery date";
    if (paymentMode === "Credit" && (!creditDays || Number(creditDays) <= 0)) return "Credit days must be > 0";
    if (paymentMode === "Advance" && (!advanceAmount || Number(advanceAmount) <= 0)) return "Advance amount must be > 0";
    return "";
  };

  const resetForm = () => {
    setStep(1);
    setRetailerQuery("");
    setRetailerOpen(false);
    setSelectedRetailer(null);
    setSearch("");
    setSuggestions([]);
    setActiveIndex(-1);
    setCart([]);
    setDeliveryDate("");
    setPaymentMode(PAYMENT_MODES[0].value);
    setCreditDays(15);
    setAdvanceAmount(0);
    setNotes("");
  };

  const handleCreateOrder = async () => {
    const err = validate();
    if (err) return toast.error(err);
    try {
      const user = getAuth().currentUser;
      if (!user) return toast.error("Please login to create order.");
      const distributorId = user.uid;

      setSubmitting(true);
      const safeRetailerName = (selectedRetailer?.displayName || "").trim();

      await addDoc(collection(db, "businesses", distributorId, "orderRequests"), {
        createdBy: "distributor",
        creatorUid: user.uid,
        creatorEmail: user.email || null,
        // Rich createdBy for auditing (employee/distributor)
        ...(empAuth?.currentUser
          ? { createdBy: { type: 'employee', uid: empAuth.currentUser.uid, name: empAuth.currentUser.displayName || null, flypEmployeeId: null } }
          : { createdBy: { type: 'distributor', uid: user.uid, name: user.displayName || null } }
        ),
        distributorId,
        retailerMode: selectedRetailer.type === "provisional" ? "passive" : "active",
        isProvisional: selectedRetailer.type === "provisional",
        provisionalRetailerId: selectedRetailer.type === "provisional" ? selectedRetailer.id : null,
        status: "Requested",
        createdAt: serverTimestamp(),
        retailerId: selectedRetailer.type === "connected" ? selectedRetailer.id : null,
        retailerInfo: {
          name: safeRetailerName,
          phone: selectedRetailer.phone || "",
          email: selectedRetailer.email || "",
          type: selectedRetailer.type,
          provisionalId: selectedRetailer.type === "provisional" ? selectedRetailer.id : null,
        },
        items: cart.map((i) => ({
          name: i.name,
          sku: i.sku || null,
          brand: i.brand || null,
          unit: i.unit || null,
          qty: Number(i.qty),
          mrp: Number(i.price),
          lineTotal: Number(i.qty) * Number(i.price),
        })),
        itemsSubTotal: cartTotal,
        deliveryDate: new Date(`${deliveryDate}T00:00:00`),
        paymentMode,
        payment: {
          type: paymentMode,
          creditDays: paymentMode === "Credit" ? Number(creditDays) || 0 : null,
          advanceAmount: paymentMode === "Advance" ? Number(advanceAmount) || 0 : null,
        },
        notes: (notes || "").trim(),
      });

      toast.success("Order created");
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="w-full text-slate-200">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 mb-1">Create Order</h1>
        <p className="text-sm text-emerald-500 mb-6">Step flow — Retailer → Products → Review (Passive / Provisional Flow)</p>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-7 w-7 rounded-full grid place-items-center border transition-all duration-150 ${
                    step === s
                      ? "bg-emerald-500 text-slate-900 border-emerald-400"
                      : "bg-[#161b22] text-slate-400 border-slate-700/70"
                  }`}
                >
                  {s}
                </div>
                {i < 2 && <div className="w-10 h-[2px] bg-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Retailer */}
        <section className={`mb-8 ${step !== 1 ? "opacity-70 pointer-events-none" : ""}`}>
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <h2 className="text-base text-slate-100 font-semibold">1️⃣ Retailer Details</h2>
            </div>
            {selectedRetailer ? (
              <button className="text-emerald-400 text-sm hover:underline" onClick={() => setSelectedRetailer(null)}>Change</button>
            ) : null}
          </header>

          {!selectedRetailer ? (
            <div>
              <label className="block text-sm mb-2 text-slate-400">Search retailer by name / phone / email</label>
              <div className="relative">
                <input
                  value={retailerQuery}
                  onChange={(e) => setRetailerQuery(e.target.value)}
                  onFocus={() => setRetailerOpen(true)}
                  placeholder="e.g., Om Sai Kirana, 98xxxxxx10"
                  className="w-full px-4 py-3 rounded-xl border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {retailerQuery && (
                  <button
                    type="button"
                    onClick={() => { setRetailerQuery(""); setRetailerOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="mt-2 rounded-xl border border-slate-700/50 bg-[#1d2633] max-h-60 overflow-auto shadow">
                {retailerLoading ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Loading retailers…</div>
                ) : retailerResults.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No retailers found.</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {retailerResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRetailer(r);
                          setRetailerOpen(false);
                          setStep(2);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
                      >
                        <div className="text-sm font-medium flex items-center gap-2">
                          {r.displayName}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              r.type === "provisional"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {r.type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{r.phone} • {r.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-[#273244] p-3 shadow-sm">
              <div>
                <div className="font-semibold text-slate-100">{selectedRetailer.displayName}</div>
                <div className="text-xs text-slate-400">{selectedRetailer.phone} • {selectedRetailer.email} • {selectedRetailer.type}</div>
              </div>
              <button onClick={() => setStep(2)} className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:brightness-110 transform transition-transform duration-150 hover:-translate-y-0.5">Continue</button>
            </div>
          )}
        </section>

        {/* Step 2: Products */}
        <section className={`mb-8 ${step < 2 ? "opacity-40 pointer-events-none" : step > 2 ? "opacity-70 pointer-events-none" : ""}`}>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-base text-slate-100 font-semibold">2️⃣ Products</h2>
            {step === 2 && (
              <button className="text-sm bg-slate-700 text-slate-300 px-3 py-1 rounded-lg hover:bg-slate-600 border border-slate-600 shadow-sm transition" onClick={() => setStep(3)} disabled={cart.length === 0}>Review</button>
            )}
          </header>

          {/* Search */}
          <div className="mb-3">
            <label className="block text-sm mb-2 text-slate-400">Scan / Search</label>
            <div className="relative">
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Scan barcode or type: sku:ABC123, brand:amul, name:atta"
                className="w-full px-4 py-3 rounded-xl border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSuggestions([]);
                    setActiveIndex(-1);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  title="Clear"
                >
                  ×
                </button>
              )}
            </div>
            {!!suggestions.length && (
              <div className="mt-2 rounded-xl border border-slate-700/50 bg-[#1d2633] divide-y divide-slate-600/40 max-h-56 overflow-auto shadow">
                {suggestions.map((r, idx) => (
                  <button
                    key={r.id ?? r.sku ?? idx}
                    onClick={() => onPickSuggestion(r)}
                    className={`w-full text-left px-3 py-2 hover:bg-[#2f3a4d] ${idx === activeIndex ? "bg-[#2f3a4d]" : ""}`}
                  >
                    <div className="text-sm font-medium text-slate-200">{r.name}</div>
                    <div className="text-xs text-slate-400">SKU: {r.sku || "-"} • {r.brand || "-"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Picks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
            {(catalog.length ? catalog.slice(0, 8) : QUICK_PICKS).map((q) => (
              <button
                key={q.id}
                onClick={() => addItem(q)}
                className="rounded-xl border border-slate-700/40 bg-[#273244] p-3 text-left hover:bg-white/5 transition-all duration-150 ease-out shadow-sm hover:shadow-md"
              >
                <div className="font-medium text-sm truncate text-slate-100">{q.name}</div>
                <div className="text-xs text-slate-400 truncate">{q.brand} • {q.sku}</div>
                <div className="mt-2 text-sm text-emerald-400">₹{money(q.price)}</div>
              </button>
            ))}
          </div>

          {/* Cart */}
          {cart.length === 0 ? (
            <div className="text-sm text-slate-400 p-5 border border-dashed border-slate-700/50 rounded-xl bg-[#1d2633]/60">
              Start by <span className="text-emerald-400">scanning</span> or <span className="text-emerald-400">searching</span> items, or use <span className="text-emerald-400">Quick Picks</span>.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase text-slate-300 bg-white/5">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 pr-3">Item</th>
                    <th className="text-left py-2 pr-3">SKU</th>
                    <th className="text-right py-2 pr-3">Qty</th>
                    <th className="text-right py-2 pr-3">Price</th>
                    <th className="text-right py-2 pr-3">Subtotal</th>
                    <th className="py-2 pl-3 text-right w-16">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((r) => (
                    <tr key={r.key} className="border-b border-slate-700/50 hover:bg-[#2f3a4d]">
                      <td className="py-2 pr-3 min-w-[200px]">{r.name}</td>
                      <td className="py-2 pr-3">{r.sku || "-"}</td>
                      <td className="py-2 pr-3 text-right min-w-[100px]">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => dec(r.key)} className="h-7 w-7 rounded-lg border border-slate-600/50 bg-[#243041] hover:bg-[#2c3a4f] transition">-</button>
                          <input
                            type="number"
                            value={r.qty}
                            onChange={(e) => setQty(r.key, e.target.value)}
                            className="w-16 text-right rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100 px-2 py-1"
                          />
                          <button onClick={() => inc(r.key)} className="h-7 w-7 rounded-lg border border-slate-600/50 bg-[#243041] hover:bg-[#2c3a4f] transition">+</button>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right min-w-[120px]">₹{money(r.price)}</td>
                      <td className="py-2 pr-3 text-right">₹{money(Number(r.qty) * Number(r.price))}</td>
                      <td className="py-2 pl-3 text-right">
                        <button onClick={() => removeItem(r.key)} className="px-2 py-1 rounded-lg border border-red-500/30 text-xs hover:bg-red-500/20 text-red-500">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {step === 2 && (
            <div className="mt-3 flex items-center justify-end">
              <button
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold hover:brightness-110 disabled:opacity-60 transform transition-transform duration-150 hover:-translate-y-0.5"
                disabled={cart.length === 0}
                onClick={() => setStep(3)}
              >
                Review & Continue
              </button>
            </div>
          )}
        </section>

        {/* Step 3: Review & Create */}
        <section className={`${step < 3 ? "opacity-40 pointer-events-none" : ""}`}>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-base text-slate-100 font-semibold">3️⃣ Review & Create</h2>
            <div className="text-sm text-slate-400">
              Total: <span className="text-slate-100 font-semibold">₹{money(cartTotal)}</span> ({cart.length} item{cart.length !== 1 ? "s" : ""})
            </div>
          </header>

          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-700/50 bg-[#1d2633]/60 p-3">
              <div className="text-xs text-slate-400 mb-1">Retailer</div>
              {selectedRetailer ? (
                <div>
                  <div className="font-semibold text-slate-100">{selectedRetailer.displayName}</div>
                  <div className="text-xs text-slate-400">{selectedRetailer.phone} • {selectedRetailer.email} • {selectedRetailer.type}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">—</div>
              )}
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-[#1d2633]/60 p-3">
              <div className="text-xs text-slate-400 mb-1">Items</div>
              <div className="text-sm text-slate-100">{cart.length} line(s)</div>
              <div className="text-xs text-slate-400">Subtotal: ₹{money(cartTotal)}</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-[#1d2633]/60 p-3 space-y-2">
              <div className="text-xs text-slate-400">Delivery & Payment</div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                />
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value} className="bg-[#1d2633]">
                      {m.label}
                    </option>
                  ))}
                </select>
                {paymentMode === "Credit" && (
                  <input
                    type="number"
                    min="1"
                    value={creditDays}
                    onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                    className="w-24 text-right px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                    placeholder="Days"
                  />
                )}
                {paymentMode === "Advance" && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                    className="w-28 text-right px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                    placeholder="₹"
                  />
                )}
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-500"
                placeholder="Notes / instructions (optional)"
              />
            </div>
          </div>

          {/* Review table */}
          <div className="mt-4 overflow-auto rounded-xl border border-slate-700/50">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-300 bg-white/5">
                <tr>
                  <th className="text-left py-2 px-3">Item</th>
                  <th className="text-left py-2 px-3">SKU</th>
                  <th className="text-right py-2 px-3">Qty</th>
                  <th className="text-right py-2 px-3">Price</th>
                  <th className="text-right py-2 px-3">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((r) => (
                  <tr key={r.key} className="border-t border-slate-700/50">
                    <td className="py-2 px-3">{r.name}</td>
                    <td className="py-2 px-3">{r.sku || "-"}</td>
                    <td className="py-2 px-3 text-right">{r.qty}</td>
                    <td className="py-2 px-3 text-right">₹{money(r.price)}</td>
                    <td className="py-2 px-3 text-right">₹{money(r.qty * r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-[#243041] text-slate-300 hover:bg-[#2c3a4f] border border-slate-600/50 shadow-sm transition"
            >
              Cancel / Reset
            </button>
            <button
              onClick={handleCreateOrder}
              disabled={submitting}
              className={`px-6 py-3 rounded-xl font-semibold bg-emerald-500 text-slate-900 hover:brightness-110 transform transition-transform duration-150 hover:-translate-y-0.5 ${
                submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Creating…
                </span>
              ) : (
                "Create Order"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}