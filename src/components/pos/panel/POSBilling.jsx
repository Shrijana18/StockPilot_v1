import React from "react";
import ScanModal from "../../billing/ScanModal";
import { motion, AnimatePresence } from "framer-motion";
import CustomerForm from "../../billing/CustomerForm";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { auth } from "../../../firebase/firebaseConfig";

/**
 * POSBilling — Premium clean build (V3 Layout - Enhanced)
 * - Implemented Order-Level Discounts (Fixed or Percentage)
 * - Implemented Additional Order-Level Charges/Fees (e.g., Service Charge)
 * - Added a dedicated Payment Modal for final checkout to calculate "Change Due"
 * - All original logic and features are preserved and enhanced
 */

// ——— Types (JSDoc for editor intellisense)
/** @typedef {{ id: string, name: string, productName?: string, sku?: string, price?: number, mrp?: number, sellingPrice?: number, basePrice?: number, taxRate?: number, gstRate?: number, img?: string, imageUrl?: string, categoryId?: string, categoryName?: string, category?: string, quantity?: number, brand?: string, hsnCode?: string, unit?: string }} Product */
/** @typedef {{ id: string, name: string }} Category */
/** @typedef {{ product: Product, qty: number, discount?: number }} CartLine */
/** @typedef {{ subTotal: number, tax: number, discount: number, grandTotal: number, orderDiscount: number, additionalCharges: number }} Totals */
/** @typedef {{ lines: CartLine[], totals: Totals, payments: {method: string, amount: number}[], meta?: any }} InvoiceDraft */
// --- NEW: Type for additional charges
/** @typedef {{ name: string, value: number, taxable?: boolean }} AdditionalCharge */


// --- Category helpers (supports multiple shapes)
const getCatId = (p) => p?.categoryId ?? p?.category ?? p?.category_id ?? p?.categoryName ?? undefined;
const getCatName = (p) => p?.categoryName ?? p?.category ?? p?.categoryId ?? p?.category_id ?? "Uncategorized";

// Money + small utils
const money = (n) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clamp = (n, min = 0) => (isNaN(n) ? 0 : Math.max(min, n));
const parseAmount = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
};

// Stock badge
const getStatus = (qty) => {
  const q = parseInt(qty);
  if (isNaN(q) || q < 0) return { text: "Unknown", color: "bg-slate-400" };
  if (q === 0) return { text: "Out of Stock", color: "bg-rose-500" };
  if (q <= 5) return { text: "Low Stock", color: "bg-amber-500" };
  return { text: "In Stock", color: "bg-emerald-500" };
};


// Local totals (fallback if billing.calcTotals not provided)
function localCalcTotals(lines /** @type {CartLine[]} */) {
  let sub = 0, tax = 0, lineDisc = 0;
  for (const l of lines) {
    const p = l.product || {};
    const qty = Math.max(1, l.qty || 1);
    const rate = Number(p.gstRate ?? p.taxRate ?? 0);
    const r = rate / 100;
    const mode = p.pricingMode || (p.mrp ? "MRP_INCLUSIVE" : (p.basePrice ? "BASE_PLUS_GST" : "SELLING_EXCLUSIVE"));

    let unitBase = 0, unitTax = 0, unitGross = 0;
    if (mode === "MRP_INCLUSIVE") {
      const mrp = Number(p.mrp ?? p.sellingPrice ?? p.price ?? 0);
      unitTax = rate ? +(mrp - mrp / (1 + r)).toFixed(2) : 0;
      unitBase = +(mrp - unitTax).toFixed(2);
      unitGross = mrp;
    } else if (mode === "BASE_PLUS_GST") {
      unitBase = Number(p.basePrice ?? 0);
      unitTax = +(unitBase * r).toFixed(2);
      unitGross = +(unitBase + unitTax).toFixed(2);
    } else { // SELLING_EXCLUSIVE (or legacy sellingPrice)
      const selling = Number(p.sellingPrice ?? p.price ?? 0);
      unitBase = selling;
      unitTax = +(selling * r).toFixed(2);
      unitGross = +(selling + unitTax).toFixed(2);
    }

    const lineDiscount = Math.max(0, Number(l.discount || 0));
    // Apply discount to gross, then back-out base/tax proportionally
    const grossTotal = unitGross * qty - lineDiscount;
    const taxRatio = unitTax && unitGross ? (unitTax / unitGross) : 0;
    const baseTotal = +(grossTotal * (1 - taxRatio)).toFixed(2);
    const taxTotal  = +(grossTotal * taxRatio).toFixed(2);

    sub  += baseTotal;
    tax  += taxTotal;
    lineDisc += lineDiscount;
  }
  // --- MODIFIED: Return lineDisc separately now
  return { subTotal: +sub.toFixed(2), tax: +tax.toFixed(2), lineDiscount: +lineDisc.toFixed(2) };
}

// --- Generic Modal Shell for popups ---
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// --- DiscountEditor component (for line items) ---
function DiscountEditor({ open, initial, max, onClose, onSave }) {
    return (
        <Modal open={open} onClose={onClose}>
            <div className="text-base font-semibold mb-2">Line Discount (₹)</div>
            <div className="text-xs text-slate-500 mb-3">Max allowed: ₹ {max.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
            <input
                type="number" step="0.01" min={0} max={max} defaultValue={initial ?? ""}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-emerald-300/50"
                id="discount-editor-input" autoFocus
            />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" type="button">Cancel</button>
                <button
                    onClick={() => {
                        const el = document.getElementById('discount-editor-input');
                        const val = parseFloat(el?.value || '0');
                        const safe = isNaN(val) ? 0 : Math.max(0, Math.min(val, max));
                        onSave(safe);
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                    type="button"
                >Save</button>
            </div>
        </Modal>
    );
}

// --- NEW: Order Discount Modal ---
function OrderDiscountModal({ open, subTotal, currentDiscount, onClose, onSave }) {
    const [type, setType] = React.useState(currentDiscount.type || 'fixed');
    const [value, setValue] = React.useState(currentDiscount.value || '');

    React.useEffect(() => {
        if (open) {
            setType(currentDiscount.type || 'fixed');
            setValue(currentDiscount.value || '');
        }
    }, [open, currentDiscount]);

    const handleSave = () => {
        onSave({ type, value: parseAmount(value) });
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose}>
            <div className="text-base font-semibold mb-3">Order Discount</div>
            <div className="flex gap-1 rounded-full p-1 bg-slate-100 dark:bg-slate-800 mb-3">
                <button onClick={() => setType('fixed')} className={`flex-1 rounded-full text-sm py-1 ${type === 'fixed' ? 'bg-emerald-500 text-white' : ''}`}>Fixed (₹)</button>
                <button onClick={() => setType('percentage')} className={`flex-1 rounded-full text-sm py-1 ${type === 'percentage' ? 'bg-emerald-500 text-white' : ''}`}>Percentage (%)</button>
            </div>
            <input
                type="number" step="0.01" min={0} value={value} onChange={e => setValue(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-emerald-300/50"
                autoFocus
            />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" type="button">Cancel</button>
                <button onClick={handleSave} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700" type="button">Save</button>
            </div>
        </Modal>
    );
}

// --- NEW: Add Charge/Fee Modal ---
function AddChargeModal({ open, onClose, onSave }) {
   const [name, setName] = React.useState('');
const [value, setValue] = React.useState('');
const [taxable, setTaxable] = React.useState(true);

    const handleSave = () => {
        if (!name.trim() || parseAmount(value) <= 0) return;
        onSave({ name, value: parseAmount(value), taxable });
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose}>
            <div className="text-base font-semibold mb-3">Add Fee / Charge</div>
            <input placeholder="Name (e.g., Service Charge)" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-emerald-300/50" />
           <input type="number" placeholder="Amount (₹)" value={value} onChange={e => setValue(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-emerald-300/50" autoFocus />
<label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mb-3">
  <input type="checkbox" checked={taxable} onChange={(e)=>setTaxable(e.target.checked)} />
  Charge is taxable (apply order’s effective GST)
</label>
<div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" type="button">Cancel</button>
                <button onClick={handleSave} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700" type="button">Add Charge</button>
            </div>
        </Modal>
    );
}

// --- REPLACED: Payment Modal with Multi‑Tender + UPI QR ---
function PaymentModal({
  open,
  total,
  initialPayments = [],
  upiConfig = {},
  onClose,
  onFinalize,
  onPollUPIStatus, // optional: async (txnRef) => "PENDING" | "SUCCESS" | "FAILED"
}) {
  const defaultPayee = {
    pa: upiConfig.pa || "merchant@upi",
    pn: upiConfig.pn || "FLYP Merchant",
    orgid: upiConfig.orgid || "",
    tr: upiConfig.tr || "", // txnRef (we'll generate if absent)
    tn: upiConfig.tn || "POS Payment",
    cu: "INR",
  };

  const [rows, setRows] = React.useState(() => {
    // normalize any incoming initial rows
    const seed = (initialPayments || []).map(p => ({
      id: crypto.randomUUID(),
      method: p.method,
      amount: Number(p.amount) || 0,
      status: p.status || "PENDING", // for UPI
      meta: p.meta || {},
    }));
    return seed.length ? seed : [{ id: crypto.randomUUID(), method: "Cash", amount: total, status: "PENDING", meta: {} }];
  });
  const [activeUPI, setActiveUPI] = React.useState(null); // row.id currently showing QR
  const [polling, setPolling] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    // ensure at least one row exists
    if (!rows.length) {
      setRows([{ id: crypto.randomUUID(), method: "Cash", amount: total, status: "PENDING", meta: {} }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const methods = ["Cash", "UPI", "Card", "Wallet"];

  const totalPaid = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const remaining = Math.max(0, Number((total - totalPaid).toFixed(2)));
  const changeOverall = Math.max(0, Number((totalPaid - total).toFixed(2)));

  function updateRow(id, patch) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows(prev => [...prev, { id: crypto.randomUUID(), method: "Cash", amount: remaining || 0, status: "PENDING", meta: {} }]);
  }
  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
    if (activeUPI === id) setActiveUPI(null);
  }

  function buildUPIIntent(amount, note = defaultPayee.tn) {
    const tr = defaultPayee.tr || `FLYP-${Date.now()}`;
    const params = new URLSearchParams({
      pa: defaultPayee.pa,
      pn: defaultPayee.pn,
      tn: note,
      am: String(Number(amount || 0).toFixed(2)),
      cu: defaultPayee.cu,
      tr,
      orgid: defaultPayee.orgid || "",
    });
    // remove empty params
    for (const [k, v] of [...params.entries()]) { if (!v) params.delete(k); }
    return { uri: `upi://pay?${params.toString()}`, tr };
  }

  // Lightweight QR via public QR server (no extra deps). If network blocked, we show the UPI URI as fallback.
  function qrURL(data) {
    const enc = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${enc}`;
  }

  async function pollUPI(tr, rowId) {
    if (!onPollUPIStatus) return;
    setPolling(true);
    try {
      let status = "PENDING";
      for (let i = 0; i < 30; i++) { // ~30 attempts
        // eslint-disable-next-line no-await-in-loop
        status = await onPollUPIStatus(tr);
        if (status === "SUCCESS" || status === "FAILED") break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise(res => setTimeout(res, 2000));
      }
      updateRow(rowId, { status });
    } finally {
      setPolling(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-lg font-bold mb-1 text-center">Payment</div>
      <div className="text-4xl font-mono font-bold text-center mb-4 text-emerald-600">₹ {money(total)}</div>

      {/* Tenders Table */}
      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {rows.map((r) => {
          const overpay = Math.max(0, Number((Number(r.amount || 0) - (remaining || 0)).toFixed(2)));
          const isUPI = r.method === "UPI";
          const upi = isUPI ? buildUPIIntent(r.amount) : null;
          return (
            <div key={r.id} className="rounded-lg border p-2 bg-slate-50/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <select
                  value={r.method}
                  onChange={(e) => updateRow(r.id, { method: e.target.value, status: "PENDING", meta: {} })}
                  className="rounded-md border px-2 py-1 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600"
                >
                  {methods.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={r.amount}
                  onChange={(e) => updateRow(r.id, { amount: Number(e.target.value || 0) })}
                  placeholder="Amount"
                  className="flex-1 rounded-md border px-2 py-1 text-sm text-right bg-white dark:bg-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 placeholder:text-slate-400"
                />
                <button onClick={() => removeRow(r.id)} className="rounded-md border w-8 h-8 text-rose-600">×</button>
              </div>

              {/* UPI QR + Poll */}
              {isUPI && (
                <div className="mt-2 rounded-md border bg-slate-50 dark:bg-slate-800 p-2">
                  <div className="text-xs mb-1">UPI to: <span className="font-semibold">{defaultPayee.pa}</span></div>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <img
                        src={qrURL(upi.uri)}
                        alt="UPI QR"
                        className="w-[110px] h-[110px] rounded"
                        onClick={() => setActiveUPI(r.id)}
                      />
                    </div>
                    <div className="text-xs break-all flex-1">{upi.uri}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <a href={upi.uri} className="text-xs rounded border px-2 py-1" target="_blank" rel="noreferrer">Open in UPI app</a>
                    {onPollUPIStatus && (
                      <button
                        onClick={() => pollUPI(upi.tr, r.id)}
                        disabled={polling || r.status === "SUCCESS"}
                        className="text-xs rounded border px-2 py-1"
                      >{r.status === "SUCCESS" ? "Paid" : polling ? "Checking…" : "Check Status"}</button>
                    )}
                    {r.status === "SUCCESS" && <span className="text-emerald-600 text-xs font-semibold">SUCCESS</span>}
                    {r.status === "FAILED" && <span className="text-rose-600 text-xs font-semibold">FAILED</span>}
                  </div>
                </div>
              )}

              {/* Per‑tender change (only for Cash) */}
              {r.method === "Cash" && Number(r.amount) > 0 && (
                <div className="mt-1 text-xs text-slate-500">
                  Change from this tender will be shown below once totals are met.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-3 text-sm">
        <button onClick={addRow} className="rounded-md border px-3 py-1.5">+ Add Tender</button>
        <div className="text-right">
  <div>Paid: <span className="font-semibold">₹ {money(totalPaid)}</span></div>
  <div>Remaining: <span className="font-semibold">₹ {money(remaining)}</span></div>
  {changeOverall > 0 && (
    <div className="text-emerald-700">
      Change Due: ₹ {money(changeOverall)}
      <div className="mt-1 text-[11px] text-slate-500 text-left">
        {(() => {
          const notes = [2000, 500, 200, 100, 50, 20, 10, 5];
          let amt = Math.round(changeOverall);
          const parts = [];
          for (const n of notes) {
            const c = Math.floor(amt / n);
            if (c > 0) { parts.push(`₹${n} ×${c}`); amt -= c * n; }
          }
          return parts.length ? `Suggest: ${parts.join('  ·  ')}` : '';
        })()}
      </div>
    </div>
  )}
</div>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <button
          onClick={() => onFinalize(rows)}
          disabled={total <= 0 || rows.length === 0}
          className="w-full rounded-lg px-4 py-3 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          Finalize & Save Invoice
        </button>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Cancel</button>
      </div>
    </Modal>
  );
}

// --- NEW: Receipt Preview Modal (Canvas + Print helpers) ---
function renderReceiptCanvas(canvas, invoice, { widthPx = 576 } = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // --- Layout constants ---
  const W = widthPx;                  // 80mm ~ 576px, 58mm ~ 384px @203dpi
  const P = 10;                       // padding
  const FONT = 18;                    // base font size (denser than before)
  const H = 24;                       // line height
  const COL_QTY = Math.floor(W * 0.60);    // qty column x
  const COL_AMT = W - P;                   // amount right edge
  const thin = 1, thick = 2;

  // estimated height (we trim later)
  const est = 30 + ((invoice?.lines?.length || 0) * 3 + 15) * H;
  canvas.width = W;
  canvas.height = Math.max(900, est);

  // helpers
  function setFont(b=false, size=FONT){ ctx.font = `${b?'bold ':''}${size}px monospace`; ctx.fillStyle='#000'; }
  function left(s,x,y,o={}){ setFont(o.bold,o.size); ctx.fillText(s,x,y); }
  function right(s,x,y,o={}){ setFont(o.bold,o.size); const w=ctx.measureText(s).width; ctx.fillText(s,x-w,y); }
  function hr(y,w=thin){ ctx.fillRect(P,y,W-2*P,w); }
  function wrap(s,maxW){
    setFont(false,FONT);
    const words=String(s||'').split(' ');
    const lines=[]; let cur='';
    for(const w of words){
      const t=cur?cur+' '+w:w;
      if(ctx.measureText(t).width<=maxW) cur=t;
      else { if(cur) lines.push(cur); cur=w; }
    }
    if(cur) lines.push(cur);
    return lines;
  }

  // white bg
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);

  let y = P + H;

  // header
  left(invoice?.meta?.businessName || 'FLYP POS', P, y, {bold:true,size:FONT+2}); y+=H;
  if (invoice?.meta?.businessAddress) { left(invoice.meta.businessAddress, P, y); y+=H; }
  if (invoice?.meta?.gstNumber) { left(`GSTIN: ${invoice.meta.gstNumber}`, P, y); y+=H; }

  hr(y,thick); y+=H;
  left(`Invoice: ${invoice?.meta?.invoiceId || '-'}`, P, y); y+=H;
  left(`Date: ${new Date().toLocaleString()}`, P, y); y+=H;
  hr(y,thick); y+=H;

  // column headers
  left('Item (HSN)', P, y, {bold:true});
  right('Qty', COL_QTY+20, y, {bold:true});
  right('Price', COL_AMT, y, {bold:true});
  y+=H; hr(y-10);

  // items
  (invoice?.lines || []).forEach(l=>{
    const p=l.product||{};
    const name=(p.productName||p.name||'Item').trim();
    const hsn=p.hsnCode?` (${p.hsnCode})`:'';
    const qty=l.qty||1;
    const unit=Number(p.sellingPrice ?? p.price ?? p.mrp ?? p.basePrice ?? 0);
    const disc=Number(l.discount||0);
    const gross=Math.max(0, unit*qty - disc);

    const lines=wrap(`${name}${hsn}`, COL_QTY - P - 8);

    left(lines[0], P, y);
    right(String(qty), COL_QTY+20, y);
    right(`₹ ${money(gross)}`, COL_AMT, y);
    y+=H;

    for(let i=1;i<lines.length;i++){ left(lines[i], P+12, y); y+=H; }
    if(disc>0){ left(`- Disc ₹${money(disc)}`, P+12, y, {size:FONT-1}); y+=H; }
  });

  hr(y-8,thick); y+=6;

  // totals
  const subTotal = Number(invoice?.totals?.subTotal || 0);
  const taxTotal = Number(invoice?.totals?.tax || 0);
  const discountAll = Number(invoice?.totals?.discount || 0);

  left('Subtotal', P, y); right(`₹ ${money(subTotal)}`, COL_AMT, y); y+=H;
  left('Tax', P, y); right(`₹ ${money(taxTotal)}`, COL_AMT, y); y+=H;

  // visual CGST/SGST split (50/50 unless you later pass igst)
  if (taxTotal>0){
    const half=taxTotal/2;
    left('  CGST', P, y); right(`₹ ${money(half)}`, COL_AMT, y); y+=H;
    left('  SGST', P, y); right(`₹ ${money(half)}`, COL_AMT, y); y+=H;
  }

  if (discountAll>0){ left('Discount', P, y); right(`- ₹ ${money(discountAll)}`, COL_AMT, y); y+=H; }

  const charges = Array.isArray(invoice?.totals?.additionalCharges)
    ? invoice.totals.additionalCharges
    : (invoice?.meta?.additionalCharges || []);
  if (charges.length){
    left('Charges', P, y, {bold:true}); y+=H;
    charges.forEach(c => {
  const tflag = c.taxable ? " (taxable)" : "";
  left(`  ${c.name}${tflag}`, P, y);
  right(`+ ₹ ${money(c.value)}`, COL_AMT, y);
  y+=H;
});
  }

  hr(y-8,thick); y+=6;

  const grand = Number(invoice?.totals?.grandTotal || 0);
  left('Grand Total', P, y, {bold:true,size:FONT+2});
  right(`₹ ${money(grand)}`, COL_AMT, y, {bold:true,size:FONT+2});
  y+=H+4; hr(y-8,thick); y+=2;

  // payments
  const pays = invoice?.payments || [];
  const paid = pays.reduce((a,p)=>a+(Number(p.amount)||0),0);
  const change = Math.max(0, +(paid - grand).toFixed(2));
  const balance= Math.max(0, +(grand - paid).toFixed(2));

  left('Payments', P, y, {bold:true}); y+=H;
  if (!pays.length){ left('—', P, y); y+=H; }
  else {
    pays.forEach(pm=>{
      left(`${pm.method}${pm.status?` (${pm.status})`:''}`, P, y);
      right(`₹ ${money(pm.amount)}`, COL_AMT, y);
      y+=H;
    });
  }
  if (change>0){ left('Change', P, y, {bold:true}); right(`₹ ${money(change)}`, COL_AMT, y, {bold:true}); y+=H; }
  if (balance>0){ left('Balance Due', P, y, {bold:true}); right(`₹ ${money(balance)}`, COL_AMT, y, {bold:true}); y+=H; }

  y+=H; hr(y-10);
  left('Thank you! Powered by FLYP', P, y); y+=H;

  // trim to content
  const finalH = y + P;
  const trimmed = document.createElement('canvas');
  trimmed.width=W; trimmed.height=finalH;
  trimmed.getContext('2d').drawImage(canvas,0,0,W,finalH,0,0,W,finalH);
  canvas.width=W; canvas.height=finalH;
  canvas.getContext('2d').drawImage(trimmed,0,0);
}

function ReceiptPreviewModal({ open, invoice, onClose }) {
  const canvasRef = React.useRef(null);
  const [paper, setPaper] = React.useState("80"); // "80" or "58"
  const boxRef = React.useRef(null);
  const [boxWidth, setBoxWidth] = React.useState(0);

  const widthFor = (p) => (p === "58" ? 384 : 576);
  const paperPx = widthFor(paper);
  const fitWidth = Math.max(240, Math.min(paperPx, (boxWidth || 0) - 24)); // 24px padding allowance

  React.useEffect(() => {
    function measure() {
      if (!boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      setBoxWidth(rect.width);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    try { renderReceiptCanvas(canvasRef.current, invoice, { widthPx: paperPx }); }
    catch (e) { console.error(e); }
  }, [open, invoice, paperPx]);

  function printSystem() {
    try {
      const url = canvasRef.current.toDataURL("image/png");
      const w = window.open("", "_blank", "width=640,height=900");
      w.document.write(`<html><body style="margin:0"><img src="${url}" style="width:100%"/></body></html>`);
      w.document.close(); w.focus(); w.print();
    } catch (e) { console.error(e); }
  }

  async function printESCPosUSB() {
    try {
      if (!navigator.usb) { alert("WebUSB not supported. Use Chrome desktop."); return; }
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);
      const enc = (s) => new TextEncoder().encode(s);
      const cmds = [
        Uint8Array.from([0x1b,0x40]),
        enc("**** FLYP POS ****\n"),
        enc(`Total: ₹ ${money(invoice?.totals?.grandTotal || 0)}\n`),
        enc("Thank you!\n\n\n"),
        Uint8Array.from([0x1d,0x56,0x41,0x10]),
      ];
      for (const b of cmds) await device.transferOut(1, b);
      alert("Sent to printer (USB). If nothing prints, adjust interface/endpoint/codepage.");
    } catch (e) {
      console.error(e);
      alert("USB print failed. Check permissions and printer compatibility.");
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div ref={boxRef}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-base font-semibold">Receipt Preview</div>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setPaper("58")}
              className={`px-2 py-1 rounded border ${paper==="58" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}`}>
              58mm
            </button>
            <button onClick={() => setPaper("80")}
              className={`px-2 py-1 rounded border ${paper==="80" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}`}>
              80mm
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="border rounded mb-3 block mx-auto"
          style={{ width: `${fitWidth || paperPx}px`, height: 'auto', maxWidth: '100%' }}
        />

        <div className="flex gap-2 justify-end">
          <button onClick={printSystem} className="rounded border px-3 py-1.5">Print (System)</button>
          <button onClick={printESCPosUSB} className="rounded border px-3 py-1.5">ESC/POS via USB</button>
          <button onClick={onClose} className="rounded border px-3 py-1.5">Close</button>
        </div>
      </div>
    </Modal>
  );
}


export default function POSBilling({ inventory = {}, billing = {}, mode = "retail", onBack, onInvoiceSaved }) {
  // Search / results
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState(/** @type {Product[]} */([]));
  const [loading, setLoading] = React.useState(false);

  // Cart & categories
  const [cart, setCart] = React.useState(/** @type {CartLine[]} */([]));
  const [categories, setCategories] = React.useState(/** @type {Category[]} */([]));
  const [activeCat, setActiveCat] = React.useState(/** @type {string|undefined} */(undefined));

  // UI + dialogs
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [scanOpen, setScanOpen] = React.useState(false);

  // POS additions
  const [showCustomer, setShowCustomer] = React.useState(false);
  const [customer, setCustomer] = React.useState({ name: "", phone: "", email: "", gstNumber: "" });

  // Hold/Resume (local drafts)
  const [drafts, setDrafts] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("posDrafts") || "[]"); } catch { return []; }
  });

  // Premium additions
  const [payments, setPayments] = React.useState([{ method: "Cash", amount: "" }]); // Split payments
  const [isReceiptOpen, setIsReceiptOpen] = React.useState(false);
  const [lastInvoicePreview, setLastInvoicePreview] = React.useState(null);
  // Adaptive layout state
  const [posMode, setPosMode] = React.useState("inventory"); // 'inventory' | 'scanner' | 'expandedCart'
  const [isCartExpanded, setIsCartExpanded] = React.useState(false);
  const searchRef = React.useRef(null);                                     // F2 focus search
  const cartScrollRef = React.useRef(null);                                  // auto-scroll cart to latest line
  const [editingDiscount, setEditingDiscount] = React.useState(null);       // { id, value }
  const [discountTarget, setDiscountTarget] = React.useState(null); // { id, max }
  const getLineById = React.useCallback((id) => cart.find(l => l.product.id === id), [cart]);

  // Cached default listing + derived categories
  const [allResults, setAllResults] = React.useState(/** @type {Product[]} */([]));
  const [derivedCats, setDerivedCats] = React.useState(/** @type {Category[]} */([]));

  // Mode: inventory vs menu (kept for compatibility; default inventory)
  const [useInventory, setUseInventory] = React.useState(mode !== "cafe");
  const [menuDraft, setMenuDraft] = React.useState({ name: "", price: "", taxRate: "", category: "" });
  const [menuLibrary, setMenuLibrary] = React.useState([]); // (kept; not core to this patch)
  const [menuItems, setMenuItems] = React.useState([]);

  // --- NEW: State for new modals and order-level data ---
  const [orderDiscount, setOrderDiscount] = React.useState({ type: 'fixed', value: 0 });
  const [additionalCharges, setAdditionalCharges] = React.useState(/** @type {AdditionalCharge[]} */([]));
  const [isDiscountModalOpen, setIsDiscountModalOpen] = React.useState(false);
  const [isChargeModalOpen, setIsChargeModalOpen] = React.useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);

  // --- MODIFIED: Upgraded totals calculation logic
  const totals = React.useMemo(() => {
    const calculator = billing.calcTotals || localCalcTotals;
    const { subTotal, tax, lineDiscount } = calculator(cart);

    // 1. Calculate order-level discount
    let orderDiscountValue = 0;
    if (orderDiscount.type === 'fixed') {
        orderDiscountValue = clamp(parseAmount(orderDiscount.value), 0);
    } else { // percentage
        orderDiscountValue = clamp((subTotal * parseAmount(orderDiscount.value)) / 100, 0);
    }
    orderDiscountValue = Math.min(orderDiscountValue, subTotal);

   // 2. Split additional charges into taxable / non-taxable
const taxableCharges = (additionalCharges || [])
  .filter(c => c && c.taxable)
  .reduce((acc, c) => acc + (Number(c.value) || 0), 0);

const nonTaxableCharges = (additionalCharges || [])
  .filter(c => !c || !c.taxable ? true : false)
  .reduce((acc, c) => acc + (Number(c.value) || 0), 0);

// Effective order tax rate derived from current lines (guarded)
const effectiveRate = subTotal > 0 ? (tax / subTotal) : 0;

// Add taxable charges to subTotal and compute tax on those charges using effective rate
const subWithCharges = subTotal + taxableCharges;
const taxOnCharges = +(taxableCharges * effectiveRate).toFixed(2);
const taxWithCharges = +(tax + taxOnCharges).toFixed(2);

// 3. Combine all totals
const totalDiscount = lineDiscount + orderDiscountValue;
const grandTotal = subWithCharges - orderDiscountValue + taxWithCharges + nonTaxableCharges;

return {
  subTotal: +subWithCharges.toFixed(2),
  tax: +taxWithCharges.toFixed(2),
  lineDiscount, // Only line-item discounts
  orderDiscount: +orderDiscountValue.toFixed(2),
  discount: +totalDiscount.toFixed(2), // All discounts combined
  additionalCharges: +(taxableCharges + nonTaxableCharges).toFixed(2),
  grandTotal: +grandTotal.toFixed(2),
};
  }, [cart, billing, orderDiscount, additionalCharges]);

  // Load default listing + categories once (reverted to simpler pre-paging version)
  async function loadDefaultListing() {
    if (!useInventory) return;
    setLoading(true);
    try {
      let base = [];
      if (inventory.listAll) {
        base = await inventory.listAll() || [];
      } else if (inventory.searchProducts) {
        base = await inventory.searchProducts("") || [];
      } else if (inventory.listPopular) {
        base = await inventory.listPopular(60) || [];
      } else {
        // Firestore fallback
        console.warn("POSBilling: No 'inventory.listAll' prop found. Using direct Firestore fetch fallback.");
        if (auth.currentUser) {
          const db = getFirestore();
          const userId = auth.currentUser.uid;
          const productsRef = collection(db, "businesses", userId, "products");
          const snapshot = await getDocs(productsRef);
          base = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
          console.error("POSBilling: Cannot fetch - user is not authenticated.");
        }
      }

      setAllResults(base);
      setResults(base);

      if (!inventory.listCategories) {
        const uniq = new Map();
        for (const p of base) {
          const id = getCatId(p);
          if (!id) continue;
          if (!uniq.has(id)) uniq.set(id, { id, name: getCatName(p) });
        }
        setDerivedCats(Array.from(uniq.values()));
      } else {
        try {
          const cats = await inventory.listCategories();
          setCategories(cats || []);
        } catch {}
      }
    } catch (err) {
      console.error("Error loading product list in POS:", err);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let alive = true;
    (async () => {
      await loadDefaultListing();
      if (!alive) return;
      if (!useInventory) {
        setMenuItems(menuLibrary);
        if ((!menuLibrary || menuLibrary.length === 0) && (inventory.menuLibrary || billing.menuLibrary)) {
          setMenuItems(inventory.menuLibrary || billing.menuLibrary || []);
        }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, useInventory]);

  // Category aggregation from cached list
  const catAgg = React.useMemo(() => {
    const map = new Map();
    for (const p of allResults || []) {
      const id = getCatId(p);
      const name = getCatName(p);
      if (!id && !name) continue;
      const key = id || name;
      const current = map.get(key) || { id: key, name, count: 0 };
      current.count += 1;
      map.set(key, current);
    }
    return Array.from(map.values());
  }, [allResults]);

  // Local multi-field filter (fallback/refine)
  function localFilter(text, base = allResults) {
    if (!text?.trim()) return base;
    const t = text.toLowerCase();
    return (base || []).filter(p => {
      const name = p.name || p.productName || "";
      return (
        name?.toLowerCase?.().includes(t) ||
        p?.sku?.toLowerCase?.().includes(t) ||
        p?.brand?.toLowerCase?.().includes(t) ||
        p?.categoryName?.toLowerCase?.().includes(t) ||
        p?.category?.toLowerCase?.().includes(t)
      );
    });
  }

  // Debounced search
  const searchTimer = React.useRef(null);
  async function doSearch(text) {
    setQ(text);
    if (!useInventory) return;
    if (!text || !text.trim()) {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setActiveCat(undefined);
      setResults(allResults);
      setLoading(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        let r = [];
        if (inventory.searchProducts) {
          try { r = await inventory.searchProducts(text); } catch { r = []; }
        }
        if (!r || r.length === 0) r = localFilter(text, allResults);
        else r = localFilter(text, r);
        setResults(r || []);
      } finally { setLoading(false); }
    }, 220);
  }
  React.useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);
  React.useEffect(() => {
    if (!useInventory) return;
    if (!q || !q.trim()) {
      setActiveCat(undefined);
      setResults(allResults);
    }
  }, [q, useInventory, allResults]);

  // Category pick
  async function pickCategory(cat) {
    if (!useInventory) return;
    const catId = cat.id || cat.name;
    setActiveCat(catId);
    setQ("");
    if (inventory.listByCategory && cat.id) {
        setLoading(true);
        try {
            const r = await inventory.listByCategory(cat.id);
            setResults(r || []);
        } finally {
            setLoading(false);
        }
    } else {
        setResults(allResults.filter(p => (getCatId(p) === catId) || (getCatName(p) === cat.name)));
    }
}

  // --- NEW: Function to clear the entire order state ---
  function clearOrderState() {
    setCart([]);
    setCustomer({ name: "", phone: "", email: "", gstNumber: "" });
    setPayments([{ method: "Cash", amount: "" }]);
    setOrderDiscount({ type: 'fixed', value: 0 });
    setAdditionalCharges([]);
  }

  // Auto-scroll cart panel to bottom whenever items change
  React.useEffect(() => {
    const el = cartScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); } catch {}
    });
  }, [cart, posMode]);

  // Cart ops
  const addToCart = React.useCallback((p /** @type {Product} */) => {
    if ((p.quantity ?? 1) <= 0) {
      setNotice("Item is out of stock");
      setTimeout(() => setNotice(""), 1500);
      return;
    }
    const price = Number(p.price ?? p.sellingPrice ?? p.mrp ?? p.basePrice ?? 0) || 0;
    const safePrice = isNaN(price) ? 0 : Math.max(0, price);
    const normalized = { ...p, price: safePrice };
    setCart(prev => {
      const i = prev.findIndex(l => l.product.id === normalized.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...prev, { product: normalized, qty: 1 }];
    });
    setNotice(`${normalized.name || normalized.productName || "Item"} added`);
    setTimeout(() => setNotice(""), 1200);
  }, []);
  const decQty = React.useCallback((pid) => {
  setCart(prev => prev.map(l => l.product.id === pid ? { ...l, qty: Math.max(1, l.qty - 1) } : l));
}, []);
const incQty = React.useCallback((pid) => {
  setCart(prev => prev.map(l => l.product.id === pid ? { ...l, qty: l.qty + 1 } : l));
}, []);
const removeLine = React.useCallback((pid) => {
  setCart(prev => prev.filter(l => l.product.id !== pid));
}, []);

  // Hold/Resume helpers
  function persistDrafts(next) {
    try { localStorage.setItem("posDrafts", JSON.stringify(next)); } catch {}
  }
  function holdCurrentOrder() {
    if (!cart.length) return;
    const draft = { id: `D${Date.now()}`, createdAt: Date.now(), cart, customer, orderDiscount, additionalCharges };
    const next = [draft, ...drafts].slice(0, 20);
    setDrafts(next);
    persistDrafts(next);
    clearOrderState();
    setNotice("Order held");
  }
  function resumeDraft(did) {
    const draft = drafts.find(d => d.id === did);
    if (!draft) return;
    setCart(draft.cart || []);
    setCustomer(draft.customer || { name: "", phone: "", email: "", gstNumber: "" });
    setOrderDiscount(draft.orderDiscount || { type: 'fixed', value: 0 });
    setAdditionalCharges(draft.additionalCharges || []);
    const next = drafts.filter(d => d.id !== did);
    setDrafts(next);
    persistDrafts(next);
  }
  function deleteDraft(did) {
    const next = drafts.filter(d => d.id !== did);
    setDrafts(next);
    persistDrafts(next);
  }

  // Scanner handlers
  const onDecoded = React.useCallback((text) => {
    if (!text) return;
    let found =
      results.find((p) => p.sku && p.sku === text) ||
      results.find((p) => p.id === text) ||
      allResults.find((p) => p.sku === text || p.id === text);
    if (found) { addToCart(found); setScanOpen(false); }
    else { setNotice("Product not found"); setTimeout(() => setNotice(""), 1200); }
  }, [results, allResults, addToCart]);

  const handleScanAddToCart = React.useCallback(async (payload) => {
    if (!payload) return;
    if (payload.product) {
      const qty = Math.max(1, payload.qty || 1);
      for (let i = 0; i < qty; i++) addToCart(payload.product);
      setScanOpen(false);
      return;
    }
    const code = typeof payload === 'string' ? payload : (payload.sku || payload.id || payload.code || '');
    if (!code) return;
    let found =
      results.find(p => (p.sku && p.sku === code) || p.id === code) ||
      allResults.find(p => (p.sku && p.sku === code) || p.id === code);
    if (!found && inventory.searchProducts) {
      try {
        const r = await inventory.searchProducts(code);
        found = (r || []).find(p => (p.sku && p.sku === code) || p.id === code) || (r && r[0]);
      } catch (_) {}
    }
    if (found) { addToCart(found); setScanOpen(false); }
    else { setNotice('Product not found'); setTimeout(() => setNotice(''), 1200); }
  }, [results, allResults, inventory, addToCart]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || isPaymentModalOpen || isDiscountModalOpen || isChargeModalOpen || editingDiscount) return;
      if (e.key === "F1") { e.preventDefault(); setScanOpen(true); }
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Enter") { if (cart.length) setIsPaymentModalOpen(true); }
      if (e.key === "F3") { // toggle scanner mode
        e.preventDefault();
        setPosMode(m => (m === "scanner" ? "inventory" : "scanner"));
      }
      if (e.key === "F4") { // expand/collapse cart
        e.preventDefault();
        setIsCartExpanded(v => !v);
        setPosMode(m => (m === "expandedCart" ? "inventory" : "expandedCart"));
      }
      if (e.key === "+") { const last = cart[cart.length - 1]; const id = last && last.product && last.product.id; if (id) incQty(id); }
      if (e.key === "-") { const last = cart[cart.length - 1]; const id = last && last.product && last.product.id; if (id) decQty(id); }
      if (e.key === "Delete") { const last = cart[cart.length - 1]; const id = last && last.product && last.product.id; if (id) removeLine(id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, isPaymentModalOpen, isDiscountModalOpen, isChargeModalOpen, editingDiscount]);

  // --- MODIFIED: finalize now accepts payments from modal and opens receipt preview ---
  async function finalizeAndSaveInvoice(chosenPayments) {
    if (!billing.createInvoice) { alert("createInvoice() not wired to dashboard yet"); return; }
    if (!cart.length) return;
    setSaving(true);
    try {
      // Normalize payments array
      const normalizedPayments = (chosenPayments || []).map(p => ({
        method: p.method,
        amount: Number(p.amount) || 0,
        status: p.status || (p.method === "UPI" ? "SUCCESS" : "PAID"),
        meta: p.meta || {},
      }));

      const payload = {
        lines: cart,
        totals: {
          ...totals,
          // pass charges for receipt renderer (array form)
          additionalCharges: additionalCharges,
        },
        payments: normalizedPayments,
        customer,
        mode: "POS",
        meta: { 
          source: "pos",
          tax: { mode: "derived-per-line" },
          orderDiscount,
          additionalCharges,
          businessName: billing?.businessInfo?.name || "",
          businessAddress: billing?.businessInfo?.address || "",
          gstNumber: billing?.businessInfo?.gstNumber || "",
        }
      };

      const { id } = await billing.createInvoice(payload);
      // For the preview, add invoiceId into meta
      const previewInvoice = { ...payload, meta: { ...payload.meta, invoiceId: id } };
      setLastInvoicePreview(previewInvoice);
      setIsReceiptOpen(true);

      clearOrderState();
      setIsPaymentModalOpen(false);
      setNotice("Invoice saved");
      if (onInvoiceSaved) onInvoiceSaved(id);
    } catch (e) {
      console.error(e);
      alert("Failed to save invoice");
    } finally { setSaving(false); }
  }

  // Animation variants
  const fadeVariants = {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -18 },
    transition: { duration: 0.22 }
  };

  const visibleResults = results;
  const menuFullList = React.useMemo(() => !menuItems || menuItems.length === 0 ? [] : menuItems, [menuItems]);
  const allCategories = React.useMemo(() => {
    return (categories && categories.length ? categories : (derivedCats && derivedCats.length ? derivedCats : catAgg))
  }, [categories, derivedCats, catAgg]);


  return (
    <div className="relative flex flex-col min-h-screen text-slate-100">
      {/* Base gradient (green–blue) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
        backgroundImage:
          'linear-gradient(180deg, #071a2b 0%, #0b2944 55%, #071a2b 100%)'
      }} />

      {/* Radial sky glow (top-right) */}
      <div aria-hidden className="pointer-events-none absolute -z-10 right-[-12vw] top-[-10vh] h-[55vh] w-[55vw] rounded-full blur-3xl opacity-60"
           style={{ background: 'radial-gradient(closest-side, rgba(56,189,248,0.25), rgba(56,189,248,0.08), rgba(7,26,43,0))' }} />

      {/* Radial emerald glow (left) */}
      <div aria-hidden className="pointer-events-none absolute -z-10 left-[-18vw] top-[5vh] h-[65vh] w-[60vw] rounded-full blur-3xl opacity-60"
           style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.24), rgba(16,185,129,0.08), rgba(7,26,43,0))' }} />

      {/* Starfield sprinkle */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60" style={{
        backgroundImage:
          'radial-gradient(2px 2px at 20% 15%, rgba(255,255,255,0.16) 0, rgba(255,255,255,0) 60%),\
           radial-gradient(1.5px 1.5px at 70% 35%, rgba(255,255,255,0.12) 0, rgba(255,255,255,0) 60%),\
           radial-gradient(1.5px 1.5px at 35% 75%, rgba(255,255,255,0.10) 0, rgba(255,255,255,0) 60%)',
        maskImage: 'linear-gradient(to bottom, black, black, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.6))'
      }} />
      {/* ... (Top Bar and other JSX remains the same) ... */}
      <div className="sticky top-0 z-30 bg-white/5 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="px-4 py-3 flex gap-2 items-center">
          <button
            onClick={onBack}
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10"
          >← Back</button>
          <button
            onClick={() => setScanOpen(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10"
            type="button"
            style={{ marginLeft: "0.5rem" }}
          >Scan</button>
          <h2 className="text-lg font-semibold">Billing POS</h2>
          <div className="ml-auto">
            <div className="inline-flex gap-1 rounded-full px-1 py-1 bg-white/5 border border-white/10">
              <button onClick={() => setPosMode('inventory')} className={`px-3 py-1 text-xs rounded-full ${posMode==='inventory' ? 'bg-emerald-500 text-white' : ''}`}>Inventory</button>
              <button onClick={() => setPosMode('scanner')} className={`px-3 py-1 text-xs rounded-full ${posMode==='scanner' ? 'bg-emerald-500 text-white' : ''}`}>Scanner</button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid overflow-hidden"
        style={{
          height: 'calc(100vh - 56px)',
          gridTemplateColumns: posMode === "expandedCart" ? "1fr" : (posMode === "scanner" ? "360px 1fr" : "1fr 420px")
        }}
      >
        {/* Product/Search/Scanner Column */}
        {posMode === 'expandedCart' ? null : (posMode === "scanner" ? (
          <div className="flex flex-col min-h-0 border-r border-white/10 overflow-y-auto">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Scanner Mode</div>
                <button onClick={() => setPosMode('inventory')} className="text-xs rounded-lg border px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800" type="button">← Inventory</button>
              </div>
              <div className="text-xs text-slate-500">Use a paired USB/Bluetooth scanner or the built-in camera.</div>

              {/* Built-in camera path reuses your existing ScanModal */}
              <div className="flex items-center gap-2">
                <button onClick={() => setScanOpen(true)} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Use Built-in Camera</button>
                <button onClick={() => searchRef.current?.focus()} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Focus Scanner Input</button>
              </div>

              {/* HID scanner text field (most scanners type into a focused input and end with Enter) */}
              <div className="mt-3">
                <div className="text-xs mb-1 text-slate-500">Scanner Input</div>
                <input
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value.trim();
                      if (val) { handleScanAddToCart(val); e.currentTarget.value=''; }
                    }
                  }}
                  placeholder="Scan barcode here and press Enter"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 outline-none"
                  autoFocus
                />
                <div className="text-[11px] text-slate-500 mt-1">Tip: Press <span className="font-semibold">F3</span> to toggle scanner mode.</div>
              </div>
              {/* Optional: quick list of recently added items could be shown here in future */}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 border-r border-white/10 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Adaptive Mode Switcher */}
              <div className="flex flex-wrap items-center gap-2 justify-between w-full">
                <div className="flex gap-1 rounded-full px-1.5 py-1 bg-white/5 border border-white/10 shadow-sm transition-all">
                  <button
                    onClick={() => setPosMode("inventory")}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-150 ${posMode === "inventory" ? "bg-emerald-500 text-white shadow-sm" : "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                    style={{ minWidth: 90 }} type="button">Inventory</button>
                  <button
                    onClick={() => setPosMode("scanner")}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-150 ${posMode === "scanner" ? "bg-emerald-500 text-white shadow-sm" : "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                    style={{ minWidth: 90 }} type="button">Scanner</button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsCartExpanded(true); setPosMode("expandedCart"); }}
                    className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    type="button"
                  >Expand Cart (F4)</button>
                  {posMode === "expandedCart" && (
                    <button
                      onClick={() => { setIsCartExpanded(false); setPosMode("inventory"); }}
                      className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                      type="button"
                    >Collapse Cart</button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                {/* REPLACED ABOVE WITH NEW SWITCHER; KEEP THIS EMPTY PLACEHOLDER TO PRESERVE SPACING */}
              </div>
              <div className="relative">
                <div className="h-10 overflow-x-auto whitespace-nowrap flex items-center gap-2 pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <button
                    onClick={async () => { setActiveCat(undefined); setQ(""); await loadDefaultListing(); }}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border ${!activeCat ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/10 hover:bg-white/20 border-white/10'}`}
                    type="button"
                  >All · {allResults?.length || 0}</button>
                  {allCategories.map((c) => {
                    const catId = c.id || c.name;
                    const count = (catAgg.find((x) => x.id === catId || x.name === c.name)?.count) ?? undefined;
                    return (
                      <button
                        key={`chip-${catId}`}
                        onClick={() => pickCategory(c)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border ${activeCat === catId ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/10 hover:bg-white/20 border-white/10'}`}
                        type="button"
                      >{c.name}{typeof count === 'number' ? ` · ${count}` : ''}</button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400 pointer-events-none select-none">🔍</span>
                  <input
                    ref={searchRef}
                    value={q}
                    onChange={(e) => doSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const first = (visibleResults && visibleResults[0]);
                        if (first) { addToCart(first); e.preventDefault(); }
                      }
                    }}
                    inputMode="search"
                    placeholder="Scan barcode or search products"
                    className="w-full rounded-xl border border-white/10 bg-white/10 backdrop-blur px-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300/40 transition-all" />
                </div>
                <button
                  onClick={() => { if (searchTimer.current) clearTimeout(searchTimer.current); setQ(""); setActiveCat(undefined); setResults(allResults); setLoading(false); } }
                  className="rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 px-3 py-2.5 text-sm">Clear</button>
              </div>
              {/* keep the rest of the inventory grid exactly as it was */}
              {/* START of original inventory grid */}
              <AnimatePresence mode="wait" initial={false}>
                {useInventory ? (
                  <motion.div key="inventory-section" {...fadeVariants}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-4 pb-6">
                      <AnimatePresence>
                        {visibleResults.map(p => {
                          const displayName = p.productName || p.name || "Unnamed";
                          const displayPrice = (p.pricingMode === "MRP_INCLUSIVE")
                            ? (p.mrp ?? p.sellingPrice ?? p.price ?? p.basePrice ?? 0)
                            : (p.sellingPrice ?? p.price ?? (p.basePrice ? (p.basePrice * (1 + (Number(p.gstRate ?? p.taxRate ?? 0) / 100))) : p.mrp) ?? 0);
                          const displayImg = p.imageUrl || p.img;
                          const stockStatus = getStatus(p.quantity);
                          const isOutOfStock = (p.quantity ?? 1) <= 0;
                          return (
                            <motion.div
                              key={p.id} layout initial={{ opacity: 0, scale: 0.96, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -24 }} transition={{ duration: 0.18 }}
                              onClick={() => addToCart(p)}
                              className={`group rounded-2xl border border-white/10 bg-white/5 p-3 text-left relative flex flex-col transition-all duration-200 cursor-pointer hover:translate-y-[-2px] hover:bg-white/10 hover:shadow-xl hover:border-emerald-400`}>
                              <div className="absolute top-2 left-2 z-20">
                                <span className={`px-2 py-0.5 text-xs font-semibold text-white rounded-full ${stockStatus.color}`}>{stockStatus.text}</span>
                              </div>
                              <div className="relative">
                                {displayImg ? (<img loading="lazy" src={displayImg} alt={displayName} className={`w-full h-32 object-cover rounded-xl mb-2 shadow-sm`} />) : (<div className={`w-full h-32 rounded-xl bg-white/10 mb-2`} />)}
                                {isOutOfStock && (<div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center text-white font-bold text-lg">Out of Stock</div>)}
                              </div>
                              <div className="mt-1 text-sm font-semibold line-clamp-2 h-10">{displayName}</div>
                              <div className="mt-1 text-[12px] text-white/70 grid grid-cols-2 gap-x-2 gap-y-0.5">
                                <div className="truncate" title={`Brand: ${p.brand || '-'}`}>Brand: {p.brand || '—'}</div>
                                <div className="truncate" title={`HSN: ${p.hsnCode || '-'}`}>HSN: {p.hsnCode || '—'}</div>
                                <div className="truncate" title={`GST: ${Number(p.gstRate ?? p.taxRate ?? 0)}%`}>GST: {Number(p.gstRate ?? p.taxRate ?? 0)}%</div>
                                <div className="truncate" title={`Stock: ${typeof p.quantity === 'number' ? p.quantity : '-'}`}>Stock: {typeof p.quantity === 'number' ? p.quantity : '—'}</div>
                                <div className="truncate col-span-2" title={`Unit: ${p.unit || '-'}`}>Unit: {p.unit || '—'}</div>
                              </div>
                              <div className="text-base font-bold text-slate-100 mt-auto pt-2">₹ {money(displayPrice)}</div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {loading && <div className="col-span-full text-sm text-slate-500">Loading inventory...</div>}
                      {!loading && !visibleResults.length && (<div className="col-span-full text-sm text-slate-500 p-8 text-center">No products found.</div>)}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="menu-section" {...fadeVariants}>
                    {/* Menu Section remains functionally the same, just fits into the new column layout */}
                  </motion.div>
                )}
              </AnimatePresence>
              {/* END of original inventory grid */}
            </div>
          </div>
        ))}

        {/* Col 2: Cart */}
        <div className={`${posMode === 'expandedCart' ? 'w-full' : 'w-[420px]'} bg-transparent sticky top-[56px] self-start h-[calc(100vh-56px)]`}>
          <div className="flex flex-col h-full min-h-0">
            <div className="p-4 flex items-center gap-2 border-b border-white/10">
              <div className="text-base font-semibold tracking-tight">Current Order</div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={holdCurrentOrder} className="text-xs rounded-lg border border-white/10 px-2 py-1 bg-white/5 hover:bg-white/10" type="button">Hold</button>
                <div className="relative group">
                  <button className="text-xs rounded-lg border border-white/10 px-2 py-1 bg-white/5 hover:bg-white/10" type="button">Drafts ({drafts.length})</button>
                  <div className="absolute right-0 mt-1 hidden group-hover:block z-30 w-64 rounded-xl border bg-white dark:bg-slate-900 shadow-lg max-h-64 overflow-auto">
                    {drafts.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">No drafts</div>
                    ) : (
                      drafts.map(d => (
                        <div key={d.id} className="flex items-center justify-between text-xs px-3 py-2 hover:bg-white/10">
                          <div className="truncate">
                            <div className="font-semibold">{d.id}</div>
                            <div className="text-slate-500">{new Date(d.createdAt).toLocaleTimeString()}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => resumeDraft(d.id)} className="rounded border border-white/10 bg-white/5 px-2 py-0.5">Resume</button>
                            <button onClick={() => deleteDraft(d.id)} className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-rose-600">×</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {posMode !== 'expandedCart' ? (
                  <button onClick={() => { setIsCartExpanded(true); setPosMode('expandedCart'); }} className="text-xs rounded-lg border border-white/10 px-2 py-1 bg-white/5 hover:bg-white/10" type="button">Expand</button>
                ) : (
                  <button onClick={() => { setIsCartExpanded(false); setPosMode('inventory'); }} className="text-xs rounded-lg border border-white/10 px-2 py-1 bg-white/5 hover:bg-white/10" type="button">Collapse</button>
                )}
              </div>
            </div>

            {/* Cart lines */}
            <div ref={cartScrollRef} className="space-y-2 flex-1 min-h-0 overflow-auto p-3">
              <AnimatePresence>
                {cart.map(line => {
                  const cartDisplayName = line.product.productName || line.product.name;
                  const cartDisplayPrice = line.product.sellingPrice ?? line.product.price ?? line.product.mrp ?? line.product.basePrice ?? 0;
                  return (
                    <motion.div
                      key={line.product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.97, y: 18 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.93, y: -18 }}
                      transition={{ duration: 0.18 }}
                      className={`flex items-start gap-3 rounded-xl border border-white/10 p-2.5 bg-white/5`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cartDisplayName}</div>
                        <div className="text-xs text-slate-500">₹ {money(cartDisplayPrice)}</div>
                        <button
                          onClick={() => {
                            const base = (line.product.sellingPrice ?? line.product.price ?? line.product.mrp ?? line.product.basePrice ?? 0) * line.qty;
                            const max = Math.max(0, base);
                            setDiscountTarget({ id: line.product.id, max });
                            setEditingDiscount({ id: line.product.id, value: line.discount ?? "" });
                          }}
                          className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline" type="button">
                          {typeof line.discount === "number" && line.discount > 0 ? `Discount: ₹${money(line.discount)}` : "Add discount"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => decQty(line.product.id)} className="rounded-md w-7 h-7 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/20 transition-all text-base font-bold" type="button">−</button>
                        <div className={`w-6 text-center text-sm font-semibold`}>{line.qty}</div>
                        <button onClick={() => incQty(line.product.id)} className="rounded-md w-7 h-7 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/20 transition-all text-base font-bold" type="button">＋</button>
                      </div>
                      <div className="w-20 text-right text-sm font-semibold pt-1">₹ {money(Math.max(0, (cartDisplayPrice * line.qty) - (line.discount ?? 0)))}</div>
                      <button onClick={() => removeLine(line.product.id)} className="rounded-md w-7 h-7 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all text-base font-bold text-rose-600" type="button">×</button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {!cart.length && <div className="text-sm text-white/60 text-center py-16">Your cart is empty</div>}
            </div>

            <DiscountEditor
              open={!!editingDiscount}
              initial={editingDiscount?.value}
              max={discountTarget?.max ?? 0}
              onClose={() => setEditingDiscount(null)}
              onSave={(val) => {
                if (!editingDiscount?.id) { setEditingDiscount(null); return; }
                setCart(prev => prev.map(l => l.product.id === editingDiscount.id ? { ...l, discount: val } : l));
                setEditingDiscount(null);
              }}
            />

            {/* Checkout Section - sticky at bottom */}
            <div className="mt-auto p-4 border-t border-white/10 bg-white/5 backdrop-blur space-y-3 sticky bottom-0">
              <div className="flex gap-2">
                <div className="flex-1 rounded-xl border border-white/10 p-2.5 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Customer</div>
                    <button onClick={() => setShowCustomer(s => !s)} className="text-xs rounded-lg border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10" type="button">{customer.name ? 'Edit' : "Add"}</button>
                  </div>
                  {customer.name && !showCustomer && <p className="text-xs text-slate-100 truncate mt-1">{customer.name}</p>}
                </div>
              </div>

              {showCustomer && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 mt-2">
                  <CustomerForm customer={customer} setCustomer={setCustomer} />
                </div>
              )}

              {/* --- MODIFIED: Updated Totals section with new buttons and displays --- */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>₹ {money(totals.subTotal)}</span></div>
                
                {/* Discount Display */}
                {totals.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount</span>
                    <span>- ₹ {money(totals.discount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between"><span>Tax</span><span>₹ {money(totals.tax)}</span></div>

                {/* Additional Charges Display */}
                {additionalCharges.map((charge, i) => (
                    <div key={i} className="flex justify-between items-center">
                        <span>{charge.name}{typeof charge.taxable === 'boolean' ? (charge.taxable ? ' (taxable)' : ' (non-taxable)') : ''}</span>
                        <div className="flex items-center gap-2">
                            <span>+ ₹ {money(charge.value)}</span>
                            <button onClick={() => setAdditionalCharges(c => c.filter((_, idx) => idx !== i))} className="text-rose-500 text-xs"> (remove) </button>
                        </div>
                    </div>
                ))}

                {/* Action buttons for discount/charges */}
                <div className="flex justify-end gap-3 pt-1">
                    <button onClick={() => setIsDiscountModalOpen(true)} className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline">
                        {totals.orderDiscount > 0 ? 'Edit Order Discount' : 'Add Order Discount'}
                    </button>
                    <button onClick={() => setIsChargeModalOpen(true)} className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline">
                        Add Fee/Charge
                    </button>
                </div>
                
                <div className="flex justify-between text-lg font-semibold pt-1 border-t border-white/10 mt-1"><span>Total</span><span>₹ {money(totals.grandTotal)}</span></div>
              </div>

              {/* --- MODIFIED: Checkout Button now opens the Payment Modal --- */}
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={!cart.length || saving}
                className="w-full mt-2 rounded-xl border px-4 py-4 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-400 transition-all text-lg"
              >{saving ? 'Saving…' : 'Proceed to Payment'}</button>
              <button
                onClick={() => {
                  const preview = {
                    lines: cart,
                    totals: { ...totals, additionalCharges },
                    payments: [{ method: "Cash", amount: totals.grandTotal }],
                    meta: { source: "pos", businessName: billing?.businessInfo?.name || "FLYP POS", invoiceId: "PREVIEW" }
                  };
                  setLastInvoicePreview(preview);
                  setIsReceiptOpen(true);
                }}
                disabled={!cart.length}
                className="w-full mt-2 rounded-xl border px-4 py-2 text-sm"
                type="button"
              >
                Preview Receipt
              </button>

              {cart.length > 0 && (
                <button onClick={clearOrderState} className="w-full text-xs text-slate-500 hover:text-rose-600 mt-1" type="button">Clear Cart</button>
              )}
            </div>
          </div>
        </div>
      </div>
        
        {/* ... (Notice and ScanModal remain the same) ... */}
        <AnimatePresence>
          {notice && (
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} className="fixed bottom-6 left-1/2 -translate-x-1/2" style={{ zIndex: 9999 }}>
              <div className="flex items-center gap-2 rounded-full border px-5 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur text-emerald-700 dark:text-emerald-300 text-base font-semibold shadow-lg pointer-events-none select-none">
                <span className="text-2xl">✅</span> <span>{notice}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onDecoded={onDecoded} onAddToCart={handleScanAddToCart} />
        
        {/* --- NEW: All new modals are mounted here --- */}
        <OrderDiscountModal
            open={isDiscountModalOpen}
            onClose={() => setIsDiscountModalOpen(false)}
            onSave={setOrderDiscount}
            subTotal={totals.subTotal}
            currentDiscount={orderDiscount}
        />
        <AddChargeModal
            open={isChargeModalOpen}
            onClose={() => setIsChargeModalOpen(false)}
            onSave={(charge) => setAdditionalCharges(prev => [...prev, charge])}
        />
        <PaymentModal
          open={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          total={totals.grandTotal}
          initialPayments={payments}
          upiConfig={billing?.upi || {}}
          onPollUPIStatus={billing?.checkUPIStatus}
          onFinalize={(rows) => {
            // persist last chosen payments for convenience
            setPayments(rows.map(r => ({ method: r.method, amount: r.amount, status: r.status, meta: r.meta })));
            finalizeAndSaveInvoice(rows);
          }}
        />
        <ReceiptPreviewModal
          open={isReceiptOpen}
          invoice={lastInvoicePreview}
          onClose={() => setIsReceiptOpen(false)}
        />
    </div>
  );
}