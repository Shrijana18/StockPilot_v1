import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";

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

// ── Branded Print ─────────────────────────────────────────────────────────────
function printInvoice(inv, businessName) {
  const items    = getItems(inv);
  const total    = getTotal(inv);
  const subtotal = getSubtotal(inv);
  const tax      = getTax(inv);
  const payment  = getPayment(inv);
  const table    = getTableName(inv);
  const zone     = getTableZone(inv);
  const id       = getInvoiceId(inv);
  const date     = fmtDate(inv.createdAt, { year: true });

  const itemRows = items.map(it => {
    const qty   = iQty(it);
    const price = iPrice(it);
    return `<tr>
      <td style="padding:3px 2px;border-bottom:1px dotted #e0e0e0;">${iName(it)}</td>
      <td style="padding:3px 2px;border-bottom:1px dotted #e0e0e0;text-align:center;">${qty}</td>
      <td style="padding:3px 2px;border-bottom:1px dotted #e0e0e0;text-align:right;">&#8377;${(qty * price).toFixed(2)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice #${id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:12px;color:#111;width:80mm;margin:0 auto;padding:6mm 4mm;background:#fff}
.center{text-align:center}
.brand{text-align:center;padding-bottom:8px;margin-bottom:8px;border-bottom:2px dashed #222}
.brand-name{font-size:22px;font-weight:900;letter-spacing:3px;text-transform:uppercase;font-family:sans-serif}
.brand-badge{display:inline-block;background:#111;color:#fff;font-size:9px;letter-spacing:2px;padding:2px 8px;border-radius:100px;margin-top:4px;text-transform:uppercase}
.inv-meta{text-align:center;margin-bottom:10px}
.table-chip{display:inline-block;background:#f0fdf4;border:1.5px solid #16a34a;color:#15803d;font-weight:900;font-size:13px;padding:3px 12px;border-radius:6px;font-family:sans-serif;margin-bottom:4px}
.inv-id{font-size:10px;color:#777;margin-top:2px}
.inv-date{font-size:10px;color:#555;margin-top:1px}
table{width:100%;border-collapse:collapse;margin-bottom:6px}
thead tr th{font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #111;padding:4px 2px;text-align:left}
thead tr th:nth-child(2){text-align:center}
thead tr th:nth-child(3){text-align:right}
.totals{border-top:1px solid #ccc;padding-top:6px;margin-top:2px}
.tot-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;color:#555}
.grand{font-weight:900;font-size:15px;color:#111;border-top:2px dashed #111;margin-top:4px;padding-top:5px}
.payment-row{text-align:center;margin:8px 0;font-size:11px}
.pay-chip{display:inline-block;background:#f8f8f8;border:1px solid #ccc;padding:2px 10px;border-radius:100px;font-weight:bold;font-size:11px}
.footer{text-align:center;margin-top:10px;padding-top:8px;border-top:2px dashed #222;font-size:10px;color:#888}
.footer strong{color:#333;font-size:11px;display:block;margin-bottom:2px}
.flyp-tag{font-size:8px;letter-spacing:2px;color:#bbb;margin-top:6px;text-transform:uppercase}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="brand">
  <div class="brand-name">${businessName}</div>
  <span class="brand-badge">Restaurant &amp; Caf&#233;</span>
</div>
<div class="inv-meta">
  <div class="table-chip">&#127869;&#65039; ${table}${zone ? " &middot; " + zone : ""}</div>
  <div class="inv-id">#${id}</div>
  <div class="inv-date">${date}</div>
</div>
<table>
  <thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="totals">
  ${subtotal > 0 ? `<div class="tot-row"><span>Subtotal</span><span>&#8377;${subtotal.toFixed(2)}</span></div>` : ""}
  ${tax > 0 ? `<div class="tot-row"><span>Tax / GST</span><span>&#8377;${tax.toFixed(2)}</span></div>` : ""}
  <div class="tot-row grand"><span>TOTAL</span><span>&#8377;${total.toFixed(2)}</span></div>
</div>
<div class="payment-row">Payment: <span class="pay-chip">${payment}</span></div>
<div class="footer">
  <strong>Thank you for dining with us! &#128591;</strong>
  We look forward to serving you again
  <div class="flyp-tag">Powered by FLYP POS</div>
</div>
</body></html>`;

  const win = window.open("", "_blank", "width=420,height=650,scrollbars=yes");
  if (!win) { alert("Pop-up blocked. Please allow pop-ups to print."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
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
  const [invoices,    setInvoices]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [dateFilter,  setDateFilter]  = useState("today");
  const [selectedInv, setSelectedInv] = useState(null);
  const [bizName,     setBizName]     = useState("Restaurant");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    // Load business name
    getDoc(doc(db, "businesses", uid))
      .then(snap => { if (snap.exists()) setBizName(snap.data()?.businessName || snap.data()?.name || "Restaurant"); })
      .catch(() => {});

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
  }, []);

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
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "linear-gradient(180deg,#070b12 0%,#060a10 100%)" }}>

      {/* ── Top Header ── */}
      <div className="px-6 pt-5 pb-4 shrink-0 border-b border-white/6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">🧾</span>
              <h1 className="text-xl font-black text-white tracking-tight">Restaurant Invoices</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Restaurant &amp; Café only
              </span>
            </div>
            <p className="text-[11px] text-white/35">Complete billing history · Click any invoice to view &amp; print</p>
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
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white flex items-center justify-center text-sm transition"
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
            <div key={s.label} className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.grad} bg-slate-900/80 px-4 py-3 relative overflow-hidden`}>
              <div className="absolute top-2.5 right-2.5 text-base opacity-20">{s.icon}</div>
              <p className="text-[9px] text-white/35 uppercase tracking-wider font-bold mb-1.5">{s.label}</p>
              <p className={`text-lg font-black ${s.vc} leading-none`}>{s.value}</p>
              <p className="text-[10px] text-white/25 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="px-6 py-3 flex items-center gap-3 shrink-0 border-b border-white/5">
        {/* Search */}
        <div className="relative w-56">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-xs">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Table name, invoice ID…"
            className="w-full pl-8 pr-7 py-2 rounded-xl border border-white/8 bg-white/4 text-white text-xs placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition text-xs">✕</button>}
        </div>

        {/* Date chips */}
        <div className="flex gap-1.5" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border whitespace-nowrap ${
                dateFilter === key
                  ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_14px_rgba(16,185,129,0.35)]"
                  : "border-white/8 bg-white/4 text-white/45 hover:bg-white/8 hover:text-white/75"
              }`}
            >{label}</button>
          ))}
        </div>

        {filtered.length > 0 && (
          <div className="ml-auto text-xs text-white/30">
            <span className="font-bold text-white/50">{filtered.length}</span> invoice{filtered.length !== 1 ? "s" : ""} · <span className="font-bold text-emerald-300/70">{fmt(filteredRevenue)}</span>
          </div>
        )}
      </div>

      {/* ── Invoice Grid ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
            <p className="text-white/30 text-sm">Loading invoices…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="text-5xl opacity-10">🧾</div>
            <p className="text-white/30 text-sm font-medium">
              {invoices.length === 0 ? "No restaurant invoices yet" : "No invoices match your filters"}
            </p>
            {search || dateFilter !== "all" ? (
              <button onClick={() => { setSearch(""); setDateFilter("all"); }}
                className="text-xs text-emerald-400/60 hover:text-emerald-300 transition underline underline-offset-2">
                Clear filters
              </button>
            ) : (
              <p className="text-xs text-white/20">Invoices from table billing will appear here automatically</p>
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
      className="group rounded-2xl border border-white/8 bg-white/3 hover:border-emerald-500/25 hover:bg-white/5 hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all cursor-pointer overflow-hidden"
      onClick={onOpen}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/0 via-emerald-400/40 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">🍽️</div>
          <div className="min-w-0">
            <p className="font-black text-white text-sm truncate">{table}</p>
            <p className="text-[10px] text-white/35">{zone || dateStr}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-emerald-300 text-base leading-tight">{fmt(total)}</p>
          {zone && <p className="text-[10px] text-white/30">{fmtDate(inv.createdAt)}</p>}
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 pb-2 space-y-0.5">
        {items.slice(0, 3).map((it, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs text-white/55 truncate flex-1 pr-2">
              {iName(it)}
              <span className="text-white/25 ml-1">×{iQty(it)}</span>
            </span>
            <span className="text-xs text-white/40 shrink-0">₹{iTotal(it).toFixed(0)}</span>
          </div>
        ))}
        {items.length > 3 && (
          <p className="text-[10px] text-emerald-300/40">+{items.length - 3} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] text-white/25">
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
        <p className="text-[9px] text-white/15 font-mono">#{id.slice(0, 24)}</p>
      </div>
    </motion.div>
  );
}

// ── Invoice Detail Modal ──────────────────────────────────────────────────────
function InvoiceDetailModal({ inv, bizName, onClose }) {
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
        style={{ background: "linear-gradient(170deg,#0d1a1a 0%,#070d0d 100%)" }}
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
                <h2 className="text-lg font-black text-white">{table}{zone ? ` · ${zone}` : ""}</h2>
                <p className="text-xs text-white/35 font-mono mt-0.5">#{id}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center text-sm transition shrink-0">✕</button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="text-xs text-white/40">🕐 {fmtDate(inv.createdAt, { year: true })}</div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${payColor(inv)}`}>{pay}</span>
          </div>
        </div>

        {/* Items list */}
        <div className="mx-4 rounded-2xl border border-white/6 bg-white/3 overflow-hidden mb-3">
          <div className="px-4 py-2 flex items-center text-[9px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
            <span className="flex-1">Item</span><span className="w-8 text-center">Qty</span><span className="w-20 text-right">Amount</span>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {items.map((it, i) => (
              <div key={i} className="px-4 py-2 flex items-center border-b border-white/4 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 font-medium truncate">{iName(it)}</p>
                  {iPrice(it) > 0 && <p className="text-[10px] text-white/25">₹{iPrice(it).toFixed(2)} each</p>}
                </div>
                <span className="w-8 text-center text-sm text-white/40 shrink-0">{iQty(it)}</span>
                <span className="w-20 text-right text-sm font-black text-white/70 shrink-0">₹{iTotal(it).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="mx-4 rounded-2xl border border-white/6 bg-white/2 px-4 py-3 mb-4 space-y-1.5">
          {sub > 0 && (
            <div className="flex justify-between text-sm text-white/45">
              <span>Subtotal</span><span>₹{sub.toFixed(2)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-sm text-white/45">
              <span>Tax / GST</span><span>₹{tax.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t border-white/8">
            <span className="text-base font-black text-white">Total</span>
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
            className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            📄 Save as PDF
          </motion.button>
        </div>

        {/* FLYP branding strip */}
        <div className="px-4 pb-4 flex items-center justify-center">
          <div className="px-4 py-1.5 rounded-full bg-white/3 border border-white/6">
            <p className="text-[9px] text-white/20 tracking-widest uppercase font-bold">Powered by FLYP POS</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
