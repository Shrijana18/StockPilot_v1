import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";
import { generateInvoice, printThermalContent } from "../../../utils/thermalPrinter";
import { usePOSBusiness } from "../POSBusinessContext";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function parseDate(d) {
  if (!d) return null;
  if (d?.toDate) return d.toDate();
  if (typeof d === "string" || typeof d === "number") return new Date(d);
  if (d instanceof Date) return d;
  return null;
}

function fmtDate(d, opts = {}) {
  const dt = parseDate(d);
  if (!dt) return "—";
  const localeOpts = {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  };
  if (opts.year) localeOpts.year = "numeric";
  return dt.toLocaleString("en-IN", localeOpts);
}

function isSameDay(d, ref) {
  const dt = parseDate(d);
  if (!dt) return false;
  return dt.toDateString() === ref.toDateString();
}

function isInRange(d, days) {
  const dt = parseDate(d);
  if (!dt) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return dt >= cutoff;
}

const getTotal    = (inv) => Number(inv.totals?.grandTotal ?? inv.total ?? inv.totalAmount ?? 0);
const getSubtotal = (inv) => Number(inv.totals?.subTotal ?? inv.subtotal ?? 0);
const getTax      = (inv) => Number(inv.totals?.tax ?? inv.gst ?? 0);
const getItems    = (inv) => inv.cartItems || inv.lines || [];
const getTableName = (inv) => inv.meta?.tableName || "Walk-in";
const getTableZone = (inv) => inv.meta?.tableZone || "";
const getInvoiceId = (inv) => inv.invoiceId || inv.id || "—";
const getPayment   = (inv) => {
  if (inv.payments?.length) return inv.payments.map(p => p.method || p.type || "—").join(" + ");
  return inv.paymentMode || inv.settings?.paymentMode || "—";
};
// Item field normalizers — handles both {product:{name,price},qty} and flat {name,price,quantity}
const iName  = (it) => it.product?.name || it.product?.productName || it.name || it.itemName || "Item";
const iPrice = (it) => Number(it.product?.price ?? it.price ?? it.unitPrice ?? 0);
const iQty   = (it) => Number(it.qty ?? it.quantity ?? 1);
const iTotal = (it) => iPrice(it) * iQty(it);

// ── Thermal Print ────────────────────────────────────────────────────────────
function printInvoice(inv, businessName) {
  const items    = getItems(inv);
  const total    = getTotal(inv);
  const subtotal = getSubtotal(inv);
  const tax      = getTax(inv);
  const payment  = getPayment(inv);
  const table    = getTableName(inv);
  const zone     = getTableZone(inv);
  const id       = getInvoiceId(inv);

  const invoiceData = {
    invoiceId: id,
    items: items.map(it => ({
      name: iName(it),
      price: iPrice(it),
      qty: iQty(it),
      product: { name: iName(it), price: iPrice(it) }
    })),
    totals: {
      subTotal: subtotal,
      tax: tax,
      grandTotal: total,
      extraCharge: 0,
      discount: 0
    },
    customer: inv.customer || {},
    tableName: table,
    tableZone: zone,
    paymentMethod: payment,
    businessName: businessName,
    businessAddress: inv.meta?.businessAddress || "",
    gstNumber: inv.meta?.gstNumber || "",
    fssaiNumber: inv.meta?.fssaiNumber || "",
    timestamp: inv.createdAt
  };

  printThermalContent(generateInvoice(invoiceData), `Invoice ${id}`);
}

// ── Payment color map ─────────────────────────────────────────────────────────
const payColor = (inv) => {
  const p = getPayment(inv).toLowerCase();
  if (p.includes("cash"))   return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
  if (p.includes("upi"))    return "bg-violet-500/15 text-violet-300 border-violet-500/20";
  if (p.includes("card"))   return "bg-blue-500/15 text-blue-300 border-blue-500/20";
  if (p.includes("credit")) return "bg-amber-500/15 text-amber-300 border-amber-500/20";
  return "bg-white/8 text-white/40 border-white/10";
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function RestaurantInvoicesPanel() {
  const { tc } = usePOSTheme();
  const [invoices,    setInvoices]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const [selectedInv, setSelectedInv] = useState(null);
  const { uid, bizName } = usePOSBusiness();

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    // Load restaurant invoices
    getDocs(collection(db, `businesses/${uid}/finalizedInvoices`))
      .then(snap => {
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => inv.meta?.source === "restaurant-pos")
          .sort((a, b) => {
            const da = parseDate(a.createdAt), db2 = parseDate(b.createdAt);
            return (db2?.getTime() || 0) - (da?.getTime() || 0);
          });
        setInvoices(all);
      })
      .catch(err => console.error("Failed to load invoices:", err))
      .finally(() => setLoading(false));
  }, [uid]);

  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (dateFilter === "today"     && !isSameDay(inv.createdAt, today))     return false;
      if (dateFilter === "yesterday" && !isSameDay(inv.createdAt, yesterday)) return false;
      if (dateFilter === "week"      && !isInRange(inv.createdAt, 7))         return false;
      if (dateFilter === "month"     && !isInRange(inv.createdAt, 30))        return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const table  = (inv.meta?.tableName || "").toLowerCase();
      const id     = (inv.invoiceId || inv.id || "").toLowerCase();
      const itNames = getItems(inv).map(i => (i.name || i.itemName || "").toLowerCase()).join(" ");
      return table.includes(q) || id.includes(q) || itNames.includes(q);
    });
  }, [invoices, dateFilter, search]);

  const stats = useMemo(() => {
    const todayInvs  = invoices.filter(inv => isSameDay(inv.createdAt, today));
    const totalRevenue = invoices.reduce((s, i) => s + getTotal(i), 0);
    return {
      todayRev: todayInvs.reduce((s, i) => s + getTotal(i), 0),
      todayCount: todayInvs.length,
      totalRevenue,
      totalCount: invoices.length,
      avgOrder: invoices.length ? totalRevenue / invoices.length : 0,
    };
  }, [invoices]);

  const filteredRevenue = useMemo(() => filtered.reduce((s, i) => s + getTotal(i), 0), [filtered]);

  const FILTERS = [
    ["today", "Today"],
    ["yesterday", "Yesterday"],
    ["week", "7 Days"],
    ["month", "30 Days"],
    ["all", "All Time"],
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>

      {/* ── Top Header ── */}
      <div className={`px-6 pt-5 pb-4 shrink-0 border-b ${tc.borderSoft}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">🧾</span>
              <h1 className={`text-xl font-black tracking-tight ${tc.textPrimary}`}>Restaurant Invoices</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Restaurant &amp; Café only
              </span>
            </div>
            <p className={`text-[11px] ${tc.textMuted}`}>Complete billing history · Click any invoice to view &amp; print</p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              const uid = auth.currentUser?.uid;
              if (!uid) { setLoading(false); return; }
              getDocs(collection(db, `businesses/${uid}/finalizedInvoices`))
                .then(snap => {
                  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(inv => inv.meta?.source === "restaurant-pos")
                    .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));
                  setInvoices(all);
                })
                .finally(() => setLoading(false));
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition ${tc.editBtn}`}
            title="Refresh"
          >↻</button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: "⚡", label: "Today's Revenue", value: fmtShort(stats.todayRev), sub: `${stats.todayCount} orders`, grad: "from-emerald-500/15", border: "border-emerald-500/15", vc: "text-emerald-300" },
            { icon: "📈", label: "Total Revenue",   value: fmtShort(stats.totalRevenue), sub: `${stats.totalCount} invoices`, grad: "from-blue-500/15", border: "border-blue-500/15", vc: "text-blue-300" },
            { icon: "🎯", label: "Avg Order",       value: fmtShort(stats.avgOrder), sub: "per table", grad: "from-violet-500/15", border: "border-violet-500/15", vc: "text-violet-300" },
            { icon: "🔍", label: "Showing",         value: filtered.length, sub: fmt(filteredRevenue), grad: "from-amber-500/15", border: "border-amber-500/15", vc: "text-amber-300" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.grad} backdrop-blur-sm px-4 py-3 relative overflow-hidden shadow-sm`}>
              <div className="absolute top-2.5 right-2.5 text-base opacity-20">{s.icon}</div>
              <p className={`text-[9px] uppercase tracking-wider font-bold mb-1.5 ${tc.textMuted}`}>{s.label}</p>
              <p className={`text-lg font-black ${s.vc} leading-none`}>{s.value}</p>
              <p className={`text-[10px] mt-1 ${tc.textMuted}`}>{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className={`px-6 py-3 flex items-center gap-3 shrink-0 border-b ${tc.borderSoft}`}>
        {/* Search */}
        <div className="relative w-56">
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${tc.textMuted}`}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Table name, invoice ID…"
            className={`w-full pl-8 pr-7 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400/40 ${tc.inputBg}`}
          />
          {search && <button onClick={() => setSearch("")} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition text-xs ${tc.textMuted}`}>✕</button>}
        </div>

        {/* Date chips */}
        <div className="flex gap-1.5" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border whitespace-nowrap ${
                dateFilter === key
                  ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_14px_rgba(16,185,129,0.35)]"
                  : `${tc.borderSoft} ${tc.textSub} hover:text-white/75`
              }`}
            >{label}</button>
          ))}
        </div>

        {filtered.length > 0 && (
          <div className={`ml-auto text-xs ${tc.textMuted}`}>
            <span className={`font-bold ${tc.textSub}`}>{filtered.length}</span> invoice{filtered.length !== 1 ? "s" : ""} · <span className="font-bold text-emerald-300/70">{fmt(filteredRevenue)}</span>
          </div>
        )}
      </div>

      {/* ── Invoice Grid ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
            <p className={`text-sm ${tc.textMuted}`}>Loading invoices…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-5xl opacity-10">🧾</div>
            <p className={`text-sm font-medium ${tc.textMuted}`}>
              {invoices.length === 0 ? "No restaurant invoices yet" : "No invoices match your filters"}
            </p>
            {search || dateFilter !== "all" ? (
              <button onClick={() => { setSearch(""); setDateFilter("all"); }}
                className="text-xs text-emerald-400/60 hover:text-emerald-300 transition underline underline-offset-2">
                Clear filters
              </button>
            ) : (
              <p className={`text-xs ${tc.textMuted}`}>Invoices from table billing will appear here automatically</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((inv, idx) => (
              <InvoiceCard
                key={inv.id}
                inv={inv}
                idx={idx}
                bizName={bizName}
                onOpen={() => setSelectedInv(inv)}
                onPrint={e => { e.stopPropagation(); printInvoice(inv, bizName); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedInv && (
          <InvoiceDetailModal
            inv={selectedInv}
            bizName={bizName}
            onClose={() => setSelectedInv(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Invoice Card ──────────────────────────────────────────────────────────────
function InvoiceCard({ inv, idx, bizName, onOpen, onPrint }) {
  const { tc } = usePOSTheme();
  const items  = getItems(inv);
  const total  = getTotal(inv);
  const sub    = getSubtotal(inv);
  const tax    = getTax(inv);
  const pay    = getPayment(inv);
  const table  = getTableName(inv);
  const zone   = getTableZone(inv);
  const id     = getInvoiceId(inv);
  const dateStr = fmtDate(inv.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025, duration: 0.18 }}
      className={`group rounded-2xl border hover:border-emerald-500/25 hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-all cursor-pointer overflow-hidden ${tc.cardBg}`}
      onClick={onOpen}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/0 via-emerald-400/40 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">🍽️</div>
          <div className="min-w-0">
            <p className={`font-black text-sm truncate ${tc.textPrimary}`}>{table}</p>
            <p className={`text-[10px] ${tc.textMuted}`}>{zone || dateStr}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-emerald-300 text-base leading-tight">{fmt(total)}</p>
          {zone && <p className={`text-[10px] ${tc.textMuted}`}>{fmtDate(inv.createdAt)}</p>}
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 pb-2 space-y-0.5">
        {items.slice(0, 3).map((it, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className={`text-xs truncate flex-1 pr-2 ${tc.textSub}`}>
              {iName(it)}
              <span className={`ml-1 ${tc.textMuted}`}>×{iQty(it)}</span>
            </span>
            <span className={`text-xs shrink-0 ${tc.textMuted}`}>₹{iTotal(it).toFixed(0)}</span>
          </div>
        ))}
        {items.length > 3 && (
          <p className="text-[10px] text-emerald-300/40">+{items.length - 3} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 pb-3 pt-2 border-t flex items-center justify-between gap-2 ${tc.borderSoft}`}>
        <div className={`flex items-center gap-3 text-[10px] ${tc.textMuted}`}>
          {sub  > 0 && <span>Sub {fmtShort(sub)}</span>}
          {tax  > 0 && <span>GST {fmtShort(tax)}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${payColor(inv)}`}>{pay}</span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onPrint}
            className="w-6 h-6 rounded-lg bg-white/6 hover:bg-white/12 text-white/35 hover:text-white text-xs flex items-center justify-center transition opacity-0 group-hover:opacity-100"
            title="Print receipt"
          >🖨</motion.button>
        </div>
      </div>

      {/* Invoice ID strip */}
      <div className="px-4 pb-2 -mt-1">
        <p className={`text-[9px] font-mono ${tc.textMuted} opacity-60`}>#{id.slice(0, 24)}</p>
      </div>
    </motion.div>
  );
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────
function InvoiceDetailModal({ inv, bizName, onClose }) {
  const { tc } = usePOSTheme();
  const items  = getItems(inv);
  const total  = getTotal(inv);
  const sub    = getSubtotal(inv);
  const tax    = getTax(inv);
  const pay    = getPayment(inv);
  const table  = getTableName(inv);
  const zone   = getTableZone(inv);
  const id     = getInvoiceId(inv);

  return (
    <motion.div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${tc.overlayBg}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className={`relative w-full max-w-md rounded-3xl border overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl ${tc.modalBg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Green gradient top stripe */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/8 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl">🍽️</div>
              <div>
                <h2 className={`text-lg font-black ${tc.textPrimary}`}>{table}{zone ? ` · ${zone}` : ""}</h2>
                <p className={`text-xs font-mono mt-0.5 ${tc.textMuted}`}>#{id}</p>
              </div>
            </div>
            <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition shrink-0 ${tc.editBtn}`}>✕</button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className={`text-xs ${tc.textMuted}`}>🕐 {fmtDate(inv.createdAt, { year: true })}</div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${payColor(inv)}`}>{pay}</span>
          </div>
        </div>

        {/* Items list */}
        <div className={`mx-4 rounded-2xl border overflow-hidden mb-3 ${tc.cardBg}`}>
          <div className={`px-4 py-2 flex items-center text-[9px] font-black uppercase tracking-widest border-b ${tc.textMuted} ${tc.borderSoft}`}>
            <span className="flex-1">Item</span><span className="w-8 text-center">Qty</span><span className="w-20 text-right">Amount</span>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {items.map((it, i) => (
              <div key={i} className={`px-4 py-2 flex items-center border-b last:border-0 ${tc.borderSoft}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${tc.textSub}`}>{iName(it)}</p>
                  {iPrice(it) > 0 && <p className={`text-[10px] ${tc.textMuted}`}>₹{iPrice(it).toFixed(2)} each</p>}
                </div>
                <span className={`w-8 text-center text-sm shrink-0 ${tc.textMuted}`}>{iQty(it)}</span>
                <span className={`w-20 text-right text-sm font-black shrink-0 ${tc.textSub}`}>₹{iTotal(it).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className={`mx-4 rounded-2xl border px-4 py-3 mb-4 space-y-1.5 ${tc.cardBg}`}>
          {sub > 0 && (
            <div className={`flex justify-between text-sm ${tc.textSub}`}>
              <span>Subtotal</span><span>₹{sub.toFixed(2)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className={`flex justify-between text-sm ${tc.textSub}`}>
              <span>Tax / GST</span><span>₹{tax.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between items-center pt-1.5 border-t ${tc.borderSoft}`}>
            <span className={`text-base font-black ${tc.textPrimary}`}>Total</span>
            <span className="text-xl font-black text-emerald-300">{fmt(total)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-5 flex gap-2.5">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => printInvoice(inv, bizName)}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-sm shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_28px_rgba(16,185,129,0.5)] transition flex items-center justify-center gap-2"
          >
            🖨️ Print Receipt
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => printInvoice(inv, bizName)}
            className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition flex items-center justify-center gap-2 ${tc.outlineBtn}`}
          >
            📄 Save as PDF
          </motion.button>
        </div>

        {/* FLYP branding strip */}
        <div className="px-4 pb-4 flex items-center justify-center">
          <div className={`px-4 py-1.5 rounded-full border ${tc.borderSoft}`}>
            <p className={`text-[9px] tracking-widest uppercase font-bold ${tc.textMuted}`}>Powered by FLYP POS</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
