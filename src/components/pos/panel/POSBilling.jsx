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
// --- NEW: Type for cart state (multi-cart system)
/** @typedef {{ cart: CartLine[], customer: any, orderDiscount: any, additionalCharges: AdditionalCharge[], tip: any, payments: any[] }} CartState */
// --- NEW: Type for order template
/** @typedef {{ id: string, name: string, items: CartLine[], customer?: any, orderDiscount?: any, additionalCharges?: AdditionalCharge[], tip?: any, createdAt: number }} OrderTemplate */


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

// --- ENHANCED: Cleaner Stock Badge Design ---
const getStatus = (qty) => {
  const q = parseInt(qty);
  if (isNaN(q) || q < 0) return { 
    text: "N/A", 
    color: "bg-slate-600/80 text-slate-200",
    icon: "❓",
    dot: "bg-slate-400"
  };
  if (q === 0) return { 
    text: "Out", 
    color: "bg-rose-500/90 text-white",
    icon: "⛔",
    dot: "bg-rose-400"
  };
  if (q <= 5) return { 
    text: "Low", 
    color: "bg-amber-500/90 text-white",
    icon: "⚠️",
    dot: "bg-amber-400"
  };
  return { 
    text: "In Stock", 
    color: "bg-emerald-500/90 text-white",
    icon: "✓",
    dot: "bg-emerald-400"
  };
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

// --- ENHANCED: Generic Modal Shell with Dark Theme ---
function Modal({ open, onClose, children, size = "md" }) {
  if (!open) return null;
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl"
  };
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl p-6 shadow-2xl ring-1 ring-white/5`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

// --- ENHANCED: DiscountEditor with Dark Theme ---
function DiscountEditor({ open, initial, max, onClose, onSave }) {
    return (
        <Modal open={open} onClose={onClose} size="sm">
            <div className="text-lg font-bold text-white mb-1">Line Item Discount</div>
            <div className="text-xs text-slate-400 mb-4">Maximum allowed: ₹{max.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
            <input
                type="number" step="0.01" min={0} max={max} defaultValue={initial ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm text-white placeholder:text-slate-500 px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                id="discount-editor-input" autoFocus placeholder="Enter discount amount"
            />
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 text-sm font-medium transition-all" type="button">Cancel</button>
                <button
                    onClick={() => {
                        const el = document.getElementById('discount-editor-input');
                        const val = parseFloat(el?.value || '0');
                        const safe = isNaN(val) ? 0 : Math.max(0, Math.min(val, max));
                        onSave(safe);
                    }}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all"
                    type="button"
                >Save Discount</button>
            </div>
        </Modal>
    );
}

// --- ENHANCED: Order Discount Modal with Dark Theme ---
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
        <Modal open={open} onClose={onClose} size="sm">
            <div className="text-lg font-bold text-white mb-4">Order Discount</div>
            <div className="flex gap-2 rounded-xl p-1 bg-white/5 border border-white/10 mb-4">
                <button 
                    onClick={() => setType('fixed')} 
                    className={`flex-1 rounded-lg text-sm py-2.5 font-medium transition-all ${type === 'fixed' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                >Fixed (₹)</button>
                <button 
                    onClick={() => setType('percentage')} 
                    className={`flex-1 rounded-lg text-sm py-2.5 font-medium transition-all ${type === 'percentage' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                >Percentage (%)</button>
            </div>
            <input
                type="number" step="0.01" min={0} value={value} onChange={e => setValue(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm text-white placeholder:text-slate-500 px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                autoFocus
                placeholder={type === 'fixed' ? 'Enter amount (₹)' : 'Enter percentage (%)'}
            />
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 text-sm font-medium transition-all" type="button">Cancel</button>
                <button onClick={handleSave} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all" type="button">Save Discount</button>
            </div>
        </Modal>
    );
}

// --- ENHANCED: Add Charge/Fee Modal with Dark Theme ---
function AddChargeModal({ open, onClose, onSave }) {
   const [name, setName] = React.useState('');
const [value, setValue] = React.useState('');
const [taxable, setTaxable] = React.useState(true);

    const handleSave = () => {
        if (!name.trim() || parseAmount(value) <= 0) return;
        onSave({ name, value: parseAmount(value), taxable });
        setName('');
        setValue('');
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} size="sm">
            <div className="text-lg font-bold text-white mb-4">Add Fee / Charge</div>
            <input 
                placeholder="Name (e.g., Service Charge, Delivery Fee)" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm text-white placeholder:text-slate-500 px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" 
            />
           <input 
               type="number" 
               placeholder="Amount (₹)" 
               value={value} 
               onChange={e => setValue(e.target.value)} 
               className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm text-white placeholder:text-slate-500 px-4 py-3 mb-3 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" 
               autoFocus 
           />
<label className="flex items-center gap-3 text-sm text-slate-300 mb-4 cursor-pointer">
  <input 
      type="checkbox" 
      checked={taxable} 
      onChange={(e)=>setTaxable(e.target.checked)}
      className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-2"
  />
  <span>Apply GST to this charge</span>
</label>
<div className="flex justify-end gap-3">
                <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 text-sm font-medium transition-all" type="button">Cancel</button>
                <button onClick={handleSave} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all" type="button">Add Charge</button>
            </div>
        </Modal>
    );
}

// --- ENHANCED: Tip/Gratuity Modal with Dark Theme ---
function TipModal({ open, subTotal, currentTip, onClose, onSave }) {
    const [type, setType] = React.useState(currentTip.type || 'fixed');
    const [value, setValue] = React.useState(currentTip.value || '');
    const [quickAmounts] = React.useState([50, 100, 200, 500]);

    React.useEffect(() => {
        if (open) {
            setType(currentTip.type || 'fixed');
            setValue(currentTip.value || '');
        }
    }, [open, currentTip]);

    const handleSave = () => {
        onSave({ type, value: parseAmount(value) });
        onClose();
    };

    const applyQuickTip = (amt) => {
        setType('fixed');
        setValue(amt);
    };

    return (
        <Modal open={open} onClose={onClose} size="sm">
            <div className="text-lg font-bold text-white mb-4">Add Tip / Gratuity</div>
            <div className="flex gap-2 rounded-xl p-1 bg-white/5 border border-white/10 mb-4">
                <button 
                    onClick={() => setType('fixed')} 
                    className={`flex-1 rounded-lg text-sm py-2.5 font-medium transition-all ${type === 'fixed' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                >Fixed (₹)</button>
                <button 
                    onClick={() => setType('percentage')} 
                    className={`flex-1 rounded-lg text-sm py-2.5 font-medium transition-all ${type === 'percentage' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                >Percentage (%)</button>
            </div>
            {type === 'fixed' && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {quickAmounts.map(amt => (
                        <button 
                            key={amt} 
                            onClick={() => applyQuickTip(amt)} 
                            className="rounded-xl border border-white/10 bg-white/5 hover:bg-amber-500/20 hover:border-amber-500/50 text-white px-3 py-2.5 text-sm font-medium transition-all"
                        >₹{amt}</button>
                    ))}
                </div>
            )}
            <input
                type="number" step="0.01" min={0} value={value} onChange={e => setValue(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm text-white placeholder:text-slate-500 px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                autoFocus
                placeholder={type === 'fixed' ? 'Enter amount (₹)' : 'Enter percentage (%)'}
            />
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 text-sm font-medium transition-all" type="button">Cancel</button>
                <button onClick={handleSave} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-500/25 transition-all" type="button">Save Tip</button>
            </div>
        </Modal>
    );
}

// --- ENHANCED: Keyboard Shortcuts Display Modal with Dark Theme ---
function ShortcutsModal({ open, onClose }) {
    const shortcuts = [
        { key: 'F1', desc: 'Open Scanner' },
        { key: 'F2', desc: 'Focus Search' },
        { key: 'F3', desc: 'Toggle Scanner Mode' },
        { key: 'F4', desc: 'Expand/Collapse Cart' },
        { key: 'Enter', desc: 'Open Payment Modal (if cart has items)' },
        { key: 'Ctrl/Cmd + 1/2/3', desc: 'Switch between Cart 1, 2, or 3' },
        { key: '+', desc: 'Increase quantity of last item' },
        { key: '-', desc: 'Decrease quantity of last item' },
        { key: 'Delete', desc: 'Remove last item from cart' },
        { key: 'Ctrl/Cmd + ?', desc: 'Show Keyboard Shortcuts' },
    ];

    return (
        <Modal open={open} onClose={onClose} size="md">
            <div className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>⌨️</span>
                <span>Keyboard Shortcuts</span>
            </div>
            <div className="space-y-3">
                {shortcuts.map(s => (
                    <div key={s.key} className="flex items-center justify-between py-3 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                        <span className="text-sm text-slate-300">{s.desc}</span>
                        <kbd className="px-3 py-1.5 text-xs font-bold rounded-lg border border-white/20 bg-white/10 text-emerald-400 font-mono">{s.key}</kbd>
                    </div>
                ))}
            </div>
            <div className="flex justify-end mt-6">
                <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all" type="button">Got it!</button>
            </div>
        </Modal>
    );
}

// --- ENHANCED: Template Modal Component ---
function TemplateModal({ open, onClose, templates, onLoad, onDelete }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-base font-semibold mb-3">Order Templates</div>
      <div className="max-h-96 overflow-y-auto mb-4">
        {templates.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">No templates saved yet</div>
        ) : (
          <div className="space-y-2">
            {templates.map(template => (
              <div key={template.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{template.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {template.items?.length || 0} items • {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => onLoad(template.id)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium transition-all"
                    type="button"
                  >Load</button>
                  <button
                    onClick={() => onDelete(template.id)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-white/10 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-all"
                    type="button"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" type="button">Close</button>
      </div>
    </Modal>
  );
}

// --- ENHANCED: Save Template Modal Component ---
function SaveTemplateModal({ open, onClose, onSave, initialName = "" }) {
  const [name, setName] = React.useState(initialName);
  
  React.useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);
  
  const handleSave = () => {
    if (name && name.trim()) {
      onSave(name.trim());
    }
  };
  
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-base font-semibold mb-3">Save Order Template</div>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Template name (e.g., Breakfast Combo)"
        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-emerald-300/50"
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" type="button">Cancel</button>
        <button onClick={handleSave} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700" type="button">Save</button>
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
    <Modal open={open} onClose={onClose} size="lg">
      <div className="text-xl font-bold mb-2 text-center text-white">Payment</div>
      <div className="text-5xl font-mono font-bold text-center mb-6 bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">₹ {money(total)}</div>

      {/* Tenders Table */}
      <div className="space-y-2 max-h-72 overflow-auto pr-1">
        {rows.map((r) => {
          const overpay = Math.max(0, Number((Number(r.amount || 0) - (remaining || 0)).toFixed(2)));
          const isUPI = r.method === "UPI";
          const upi = isUPI ? buildUPIIntent(r.amount) : null;
          return (
            <div key={r.id} className="rounded-xl border border-white/10 p-3 bg-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <select
                  value={r.method}
                  onChange={(e) => updateRow(r.id, { method: e.target.value, status: "PENDING", meta: {} })}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm bg-white/5 text-white border-white/10 focus:ring-2 focus:ring-emerald-500/50"
                >
                  {methods.map(m => (<option key={m} value={m} className="bg-slate-800">{m}</option>))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={r.amount}
                  onChange={(e) => updateRow(r.id, { amount: Number(e.target.value || 0) })}
                  placeholder="Amount"
                  className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-right bg-white/5 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/50"
                />
                <button onClick={() => removeRow(r.id)} className="rounded-lg border border-white/10 bg-white/5 hover:bg-rose-500/20 w-9 h-9 text-rose-400 hover:text-rose-300 transition-all">×</button>
              </div>

              {/* UPI QR + Poll */}
              {isUPI && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs mb-2 text-slate-300">UPI to: <span className="font-semibold text-white">{defaultPayee.pa}</span></div>
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <img
                        src={qrURL(upi.uri)}
                        alt="UPI QR"
                        className="w-[110px] h-[110px] rounded-lg border border-white/10"
                        onClick={() => setActiveUPI(r.id)}
                      />
                    </div>
                    <div className="text-xs break-all flex-1 text-slate-400 font-mono">{upi.uri}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <a href={upi.uri} className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-white transition-all" target="_blank" rel="noreferrer">Open in UPI app</a>
                    {onPollUPIStatus && (
                      <button
                        onClick={() => pollUPI(upi.tr, r.id)}
                        disabled={polling || r.status === "SUCCESS"}
                        className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-white disabled:opacity-50 transition-all"
                      >{r.status === "SUCCESS" ? "Paid" : polling ? "Checking…" : "Check Status"}</button>
                    )}
                    {r.status === "SUCCESS" && <span className="text-emerald-400 text-xs font-bold px-2 py-1 rounded bg-emerald-500/20">SUCCESS</span>}
                    {r.status === "FAILED" && <span className="text-rose-400 text-xs font-bold px-2 py-1 rounded bg-rose-500/20">FAILED</span>}
                  </div>
                </div>
              )}

              {/* Per‑tender change (only for Cash) */}
              {r.method === "Cash" && Number(r.amount) > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  Change from this tender will be shown below once totals are met.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-4 text-sm">
        <button onClick={addRow} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 text-sm font-medium transition-all">+ Add Tender</button>
        <div className="text-right">
  <div className="text-slate-300">Paid: <span className="font-bold text-white">₹ {money(totalPaid)}</span></div>
  <div className="text-slate-300">Remaining: <span className="font-bold text-white">₹ {money(remaining)}</span></div>
  {changeOverall > 0 && (
    <div className="text-emerald-400 mt-2">
      <div className="font-bold">Change Due: ₹ {money(changeOverall)}</div>
      <div className="mt-1 text-[11px] text-slate-400 text-left">
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

      <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-white/10">
        <button
          onClick={() => onFinalize(rows)}
          disabled={total <= 0 || rows.length === 0}
          className="w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 transition-all"
        >
          Finalize & Save Invoice
        </button>
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
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

  const tipAmount = Number(invoice?.totals?.tip || invoice?.meta?.tip?.value || 0);
  if (tipAmount > 0) {
    left('Tip / Gratuity', P, y);
    right(`+ ₹ ${money(tipAmount)}`, COL_AMT, y);
    y+=H;
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

  // --- ENHANCED: Multi-Cart System (3 carts) ---
  const [activeCartIndex, setActiveCartIndex] = React.useState(0); // 0, 1, or 2
  const [multiCarts, setMultiCarts] = React.useState(() => {
    // Initialize 3 carts, each with its own state
    const defaultCartState = {
      cart: [],
      customer: { name: "", phone: "", email: "", gstNumber: "" },
      orderDiscount: { type: 'fixed', value: 0 },
      additionalCharges: [],
      tip: { type: 'fixed', value: 0 },
      payments: [{ method: "Cash", amount: "" }]
    };
    try {
      const saved = localStorage.getItem("posMultiCarts");
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length === 3 ? parsed : [defaultCartState, defaultCartState, defaultCartState];
      }
    } catch {}
    return [defaultCartState, defaultCartState, defaultCartState];
  });

  // Current active cart state (derived from multiCarts)
  const currentCartState = multiCarts[activeCartIndex];
  const cart = currentCartState.cart;
  const customer = currentCartState.customer;
  const orderDiscount = currentCartState.orderDiscount;
  const additionalCharges = currentCartState.additionalCharges;
  const tip = currentCartState.tip;
  const payments = currentCartState.payments;

  // Helper to update active cart state - uses functional update to always get current index
  const updateActiveCart = React.useCallback((updater) => {
    setMultiCarts(prev => {
      const updated = [...prev];
      // Use the current activeCartIndex from state, not closure
      const currentIndex = activeCartIndex;
      updated[currentIndex] = typeof updater === 'function' ? updater(prev[currentIndex]) : updater;
      try { localStorage.setItem("posMultiCarts", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [activeCartIndex]);
  
  // Also create a ref-based version that always uses the latest index
  const activeCartIndexRef = React.useRef(activeCartIndex);
  React.useEffect(() => {
    activeCartIndexRef.current = activeCartIndex;
  }, [activeCartIndex]);
  
  const updateActiveCartRef = React.useCallback((updater) => {
    setMultiCarts(prev => {
      const updated = [...prev];
      const currentIndex = activeCartIndexRef.current;
      updated[currentIndex] = typeof updater === 'function' ? updater(prev[currentIndex]) : updater;
      try { localStorage.setItem("posMultiCarts", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Wrapper functions for cart operations (backward compatibility)
  const setCart = React.useCallback((updater) => {
    updateActiveCartRef(state => ({ ...state, cart: typeof updater === 'function' ? updater(state.cart) : updater }));
  }, [updateActiveCartRef]);
  const setCustomer = React.useCallback((updater) => {
    updateActiveCartRef(state => ({ ...state, customer: typeof updater === 'function' ? updater(state.customer) : updater }));
  }, [updateActiveCartRef]);
  const setOrderDiscount = React.useCallback((updater) => {
    updateActiveCartRef(state => ({ ...state, orderDiscount: typeof updater === 'function' ? updater(state.orderDiscount) : updater }));
  }, [updateActiveCartRef]);
  const setAdditionalCharges = React.useCallback((updater) => {
    updateActiveCartRef(state => ({ ...state, additionalCharges: typeof updater === 'function' ? updater(state.additionalCharges) : updater }));
  }, [updateActiveCartRef]);
  const setTip = React.useCallback((updater) => {
    updateActiveCartRef(state => ({ ...state, tip: typeof updater === 'function' ? updater(state.tip) : updater }));
  }, [updateActiveCartRef]);
  const setPayments = React.useCallback((updater) => {
    updateActiveCartRef(state => ({ ...state, payments: typeof updater === 'function' ? updater(state.payments) : updater }));
  }, [updateActiveCartRef]);

  // Cart & categories
  const [categories, setCategories] = React.useState(/** @type {Category[]} */([]));
  const [activeCat, setActiveCat] = React.useState(/** @type {string|undefined} */(undefined));

  // UI + dialogs
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [scanOpen, setScanOpen] = React.useState(false);

  // POS additions
  const [showCustomer, setShowCustomer] = React.useState(false);
  
  // --- ENHANCED: Collapsible panels for better space management ---
  const [isCustomerCollapsed, setIsCustomerCollapsed] = React.useState(true);
  const [isCheckoutCollapsed, setIsCheckoutCollapsed] = React.useState(false);
  const [isPaymentSectionMinimized, setIsPaymentSectionMinimized] = React.useState(false);

  // Hold/Resume (local drafts)
  const [drafts, setDrafts] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("posDrafts") || "[]"); } catch { return []; }
  });

  // Premium additions
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
  
  // --- ENHANCED: Toggle favorite ---
  const toggleFavorite = React.useCallback((productId) => {
    setFavorites(prev => {
      const exists = prev.includes(productId);
      const updated = exists ? prev.filter(id => id !== productId) : [...prev, productId];
      try { localStorage.setItem("posFavorites", JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Cached default listing + derived categories
  const [allResults, setAllResults] = React.useState(/** @type {Product[]} */([]));
  const [derivedCats, setDerivedCats] = React.useState(/** @type {Category[]} */([]));

  // Mode: inventory vs menu (kept for compatibility; default inventory)
  // Restaurant mode uses inventory (menu items from CreateMenu)
  const [useInventory, setUseInventory] = React.useState(mode !== "cafe");
  const [menuDraft, setMenuDraft] = React.useState({ name: "", price: "", taxRate: "", category: "" });
  const [menuLibrary, setMenuLibrary] = React.useState([]); // (kept; not core to this patch)
  const [menuItems, setMenuItems] = React.useState([]);

  // --- NEW: State for new modals and order-level data ---
  const [isDiscountModalOpen, setIsDiscountModalOpen] = React.useState(false);
  const [isChargeModalOpen, setIsChargeModalOpen] = React.useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = React.useState(false);
  
  // --- ENHANCED: Favorites and Recent Items ---
  const [favorites, setFavorites] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("posFavorites") || "[]"); } catch { return []; }
  });
  const [recentItems, setRecentItems] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("posRecentItems") || "[]"); } catch { return []; }
  });
  
  // --- ENHANCED: Keyboard shortcuts display ---
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  
  // --- ENHANCED: Templates System ---
  const [templates, setTemplates] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("posTemplates") || "[]"); } catch { return []; }
  });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");

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

// 3. Calculate tips/gratuity
let tipValue = 0;
if (tip.type === 'fixed') {
  tipValue = clamp(parseAmount(tip.value), 0);
} else { // percentage
  const preTipTotal = subWithCharges - orderDiscountValue + taxWithCharges + nonTaxableCharges;
  tipValue = clamp((preTipTotal * parseAmount(tip.value)) / 100, 0);
}

// 4. Combine all totals
const totalDiscount = lineDiscount + orderDiscountValue;
const grandTotal = subWithCharges - orderDiscountValue + taxWithCharges + nonTaxableCharges + tipValue;

return {
  subTotal: +subWithCharges.toFixed(2),
  tax: +taxWithCharges.toFixed(2),
  lineDiscount, // Only line-item discounts
  orderDiscount: +orderDiscountValue.toFixed(2),
  discount: +totalDiscount.toFixed(2), // All discounts combined
  additionalCharges: +(taxableCharges + nonTaxableCharges).toFixed(2),
  tip: +tipValue.toFixed(2),
  grandTotal: +grandTotal.toFixed(2),
};
  }, [cart, billing, orderDiscount, additionalCharges, tip]);

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

  // --- ENHANCED: Function to clear the entire order state (active cart) ---
  function clearOrderState() {
    updateActiveCartRef({
      cart: [],
      customer: { name: "", phone: "", email: "", gstNumber: "" },
      payments: [{ method: "Cash", amount: "" }],
      orderDiscount: { type: 'fixed', value: 0 },
      additionalCharges: [],
      tip: { type: 'fixed', value: 0 }
    });
  }

  // Auto-scroll cart panel to bottom whenever items change
  React.useEffect(() => {
    const el = cartScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); } catch {}
    });
  }, [cart, posMode]);

  // Cart ops - Fixed to use ref-based update for correct cart switching
  const addToCart = React.useCallback((p /** @type {Product} */, qty = 1) => {
    if ((p.quantity ?? 1) <= 0) {
      setNotice("Item is out of stock");
      setTimeout(() => setNotice(""), 1500);
      return;
    }
    const price = Number(p.price ?? p.sellingPrice ?? p.mrp ?? p.basePrice ?? 0) || 0;
    const safePrice = isNaN(price) ? 0 : Math.max(0, price);
    const normalized = { ...p, price: safePrice };
    
    // Use ref-based update to ensure we're adding to the current active cart
    setMultiCarts(prev => {
      const updated = [...prev];
      const currentIndex = activeCartIndexRef.current;
      const currentCart = prev[currentIndex].cart || [];
      const i = currentCart.findIndex(l => l.product.id === normalized.id);
      
      if (i >= 0) {
        const newCart = [...currentCart];
        newCart[i] = { ...newCart[i], qty: newCart[i].qty + qty };
        updated[currentIndex] = { ...prev[currentIndex], cart: newCart };
      } else {
        updated[currentIndex] = { ...prev[currentIndex], cart: [...currentCart, { product: normalized, qty }] };
      }
      
      try { localStorage.setItem("posMultiCarts", JSON.stringify(updated)); } catch {}
      return updated;
    });
    
    // --- ENHANCED: Track recent items ---
    setRecentItems(prev => {
      const filtered = prev.filter(item => item.id !== normalized.id);
      const updated = [{ id: normalized.id, name: normalized.name || normalized.productName, timestamp: Date.now() }, ...filtered].slice(0, 20);
      try { localStorage.setItem("posRecentItems", JSON.stringify(updated)); } catch {}
      return updated;
    });
    
    setNotice(`${normalized.name || normalized.productName || "Item"} added${qty > 1 ? ` (×${qty})` : ''}`);
    setTimeout(() => setNotice(""), 1200);
  }, []);
  const decQty = React.useCallback((pid) => {
    setCart(prev => prev.map(l => l.product.id === pid ? { ...l, qty: Math.max(1, l.qty - 1) } : l));
  }, [setCart]);
  const incQty = React.useCallback((pid) => {
    setCart(prev => prev.map(l => l.product.id === pid ? { ...l, qty: l.qty + 1 } : l));
  }, [setCart]);
  const removeLine = React.useCallback((pid) => {
    setCart(prev => prev.filter(l => l.product.id !== pid));
  }, [setCart]);

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
    updateActiveCart({
      ...multiCarts[activeCartIndex],
      cart: draft.cart || [],
      customer: draft.customer || { name: "", phone: "", email: "", gstNumber: "" },
      orderDiscount: draft.orderDiscount || { type: 'fixed', value: 0 },
      additionalCharges: draft.additionalCharges || [],
      tip: draft.tip || { type: 'fixed', value: 0 }
    });
    const next = drafts.filter(d => d.id !== did);
    setDrafts(next);
    persistDrafts(next);
  }
  
  // --- ENHANCED: Template Functions ---
  function saveTemplate(name) {
    if (!name || !name.trim()) return;
    const template = {
      id: `T${Date.now()}`,
      name: name.trim(),
      items: cart,
      customer,
      orderDiscount,
      additionalCharges,
      tip,
      createdAt: Date.now()
    };
    const updated = [template, ...templates].slice(0, 50);
    setTemplates(updated);
    try { localStorage.setItem("posTemplates", JSON.stringify(updated)); } catch {}
    setIsSaveTemplateModalOpen(false);
    setTemplateName("");
    setNotice(`Template "${name}" saved`);
    setTimeout(() => setNotice(""), 2000);
  }
  
  function loadTemplate(templateId) {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    setMultiCarts(prev => {
      const updated = [...prev];
      const currentIndex = activeCartIndexRef.current;
      updated[currentIndex] = {
        ...prev[currentIndex],
        cart: template.items || [],
        customer: template.customer || { name: "", phone: "", email: "", gstNumber: "" },
        orderDiscount: template.orderDiscount || { type: 'fixed', value: 0 },
        additionalCharges: template.additionalCharges || [],
        tip: template.tip || { type: 'fixed', value: 0 }
      };
      try { localStorage.setItem("posMultiCarts", JSON.stringify(updated)); } catch {}
      return updated;
    });
    setIsTemplateModalOpen(false);
    setNotice(`Template "${template.name}" loaded`);
    setTimeout(() => setNotice(""), 2000);
  }
  
  function deleteTemplate(templateId) {
    const updated = templates.filter(t => t.id !== templateId);
    setTemplates(updated);
    try { localStorage.setItem("posTemplates", JSON.stringify(updated)); } catch {}
    setNotice("Template deleted");
    setTimeout(() => setNotice(""), 1500);
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
      if (e.key === "?" && (e.ctrlKey || e.metaKey)) { // Ctrl/Cmd + ? for shortcuts
        e.preventDefault();
        setShowShortcuts(true);
      }
      // --- ENHANCED: Multi-Cart Switching (Ctrl+1, Ctrl+2, Ctrl+3) ---
      if ((e.ctrlKey || e.metaKey) && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        const cartIndex = parseInt(e.key) - 1;
        if (cartIndex >= 0 && cartIndex <= 2) {
          setActiveCartIndex(cartIndex);
          setNotice(`Switched to Cart ${cartIndex + 1}`);
          setTimeout(() => setNotice(""), 1500);
        }
      }
      if (e.key === "+" || e.key === "=") { const last = cart[cart.length - 1]; const id = last && last.product && last.product.id; if (id) incQty(id); }
      if (e.key === "-" || e.key === "_") { const last = cart[cart.length - 1]; const id = last && last.product && last.product.id; if (id) decQty(id); }
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
          tip,
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

  // --- ENHANCED: Better Animation Variants for Cleaner Transitions ---
  const fadeVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15, ease: "easeOut" }
  };
  
  const productVariants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.12, ease: "easeOut" }
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
          >Scan (F1)</button>
          <h2 className="text-lg font-semibold">Billing POS</h2>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts(true)}
              className="rounded-lg px-3 py-1.5 text-xs border border-white/10 bg-white/5 hover:bg-white/10"
              type="button"
              title="Keyboard Shortcuts (Ctrl/Cmd + ?)"
            >⌨️</button>
            <div className="inline-flex gap-1 rounded-full px-1 py-1 bg-white/5 border border-white/10">
              <button onClick={() => setPosMode('inventory')} className={`px-3 py-1 text-xs rounded-full ${posMode==='inventory' ? 'bg-emerald-500 text-white' : ''}`}>Inventory</button>
              <button onClick={() => setPosMode('scanner')} className={`px-3 py-1 text-xs rounded-full ${posMode==='scanner' ? 'bg-emerald-500 text-white' : ''}`}>Scanner</button>
            </div>
          </div>
        </div>
      </div>

      {posMode === 'expandedCart' ? (
        <div key="expanded-cart" className="w-full bg-transparent sticky top-[56px] self-start h-[calc(100vh-56px)]">
          <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-xl border-l border-white/10">
            <div className="p-4 flex items-center gap-2 border-b border-white/10 bg-white/5">
              {/* --- ENHANCED: Multi-Cart Tabs (Expanded View) --- */}
              <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1 border border-white/10">
                {[0, 1, 2].map(idx => {
                  const cartState = multiCarts[idx];
                  const itemCount = cartState.cart?.length || 0;
                  const isActive = activeCartIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveCartIndex(idx)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      type="button"
                      title={`Cart ${idx + 1} (Ctrl+${idx + 1})`}
                    >
                      Cart {idx + 1}
                      {itemCount > 0 && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                          {itemCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setIsTemplateModalOpen(true)} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all" type="button" title="Load Template">📋 Templates</button>
                <button onClick={() => cart.length > 0 && setIsSaveTemplateModalOpen(true)} disabled={!cart.length} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all disabled:opacity-50" type="button" title="Save Template">💾 Save</button>
                <button onClick={holdCurrentOrder} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all" type="button">Hold Order</button>
                <div className="relative group">
                  <button className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all" type="button">Drafts ({drafts.length})</button>
                  <div className="absolute right-0 mt-1 hidden group-hover:block z-30 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl max-h-64 overflow-auto">
                    {drafts.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400">No drafts</div>
                    ) : (
                      drafts.map(d => (
                        <div key={d.id} className="flex items-center justify-between text-xs px-3 py-2 hover:bg-white/10 border-b border-white/10 last:border-0">
                          <div className="truncate">
                            <div className="font-semibold text-white">{d.id}</div>
                            <div className="text-slate-400">{new Date(d.createdAt).toLocaleTimeString()}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => resumeDraft(d.id)} className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-emerald-400 hover:bg-emerald-500/20">Resume</button>
                            <button onClick={() => deleteDraft(d.id)} className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-rose-400 hover:bg-rose-500/20">×</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <button onClick={() => { setIsCartExpanded(false); setPosMode('inventory'); }} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all" type="button">← Collapse</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-2">
              <div ref={cartScrollRef} className="border-r border-white/10 overflow-y-auto p-4">
                <div className="text-sm font-semibold text-slate-400 mb-3">Cart Items ({cart.length})</div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {cart.map(line => {
                      const cartDisplayName = line.product.productName || line.product.name;
                      const cartDisplayPrice = line.product.sellingPrice ?? line.product.price ?? line.product.mrp ?? line.product.basePrice ?? 0;
                      return (
                        <motion.div
                          key={line.product.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.15 }}
                          className="rounded-xl border border-white/10 p-3 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{cartDisplayName}</div>
                              <div className="text-xs text-slate-400 mt-1">₹ {money(cartDisplayPrice)} each</div>
                              <button
                                onClick={() => {
                                  const base = (line.product.sellingPrice ?? line.product.price ?? line.product.mrp ?? line.product.basePrice ?? 0) * line.qty;
                                  const max = Math.max(0, base);
                                  setDiscountTarget({ id: line.product.id, max });
                                  setEditingDiscount({ id: line.product.id, value: line.discount ?? "" });
                                }}
                                className="mt-2 text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline transition-colors" type="button">
                                {typeof line.discount === "number" && line.discount > 0 ? `Discount: ₹${money(line.discount)}` : "Add discount"}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => decQty(line.product.id)} className="rounded-lg w-8 h-8 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/20 text-white transition-all font-bold" type="button">−</button>
                              <div className="w-8 text-center text-sm font-bold text-white">{line.qty}</div>
                              <button onClick={() => incQty(line.product.id)} className="rounded-lg w-8 h-8 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/20 text-white transition-all font-bold" type="button">＋</button>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-white">₹ {money(Math.max(0, (cartDisplayPrice * line.qty) - (line.discount ?? 0)))}</div>
                            </div>
                            <button onClick={() => removeLine(line.product.id)} className="rounded-lg w-8 h-8 flex items-center justify-center border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/50 text-rose-400 transition-all font-bold" type="button">×</button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {!cart.length && <div className="text-sm text-white/40 text-center py-16">Your cart is empty</div>}
                </div>
              </div>
              <div className="overflow-y-auto p-4">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-400 mb-3">Order Summary</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-300">
                        <span>Subtotal</span>
                        <span className="font-semibold text-white">₹ {money(totals.subTotal)}</span>
                      </div>
                      {totals.tax > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Tax</span>
                          <span className="font-semibold text-white">₹ {money(totals.tax)}</span>
                        </div>
                      )}
                      {totals.discount > 0 && (
                        <div className="flex justify-between text-rose-400">
                          <span>Discount</span>
                          <span className="font-semibold">- ₹ {money(totals.discount)}</span>
                        </div>
                      )}
                      {totals.tip > 0 && (
                        <div className="flex justify-between text-amber-400">
                          <span>Tip</span>
                          <span className="font-semibold">+ ₹ {money(totals.tip)}</span>
                        </div>
                      )}
                      {additionalCharges.map((charge, i) => (
                        <div key={i} className="flex justify-between text-blue-400">
                          <span>{charge.name}</span>
                          <span className="font-semibold">+ ₹ {money(charge.value)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/10 mt-2">
                        <div className="flex justify-between">
                          <span className="text-base font-semibold text-white">Total</span>
                          <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                            ₹ {money(totals.grandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-sm font-semibold text-slate-400 mb-3">Customer</div>
                    {customer.name ? (
                      <div className="text-sm text-white">{customer.name}</div>
                    ) : (
                      <button
                        onClick={() => setShowCustomer(true)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm text-white transition-all"
                        type="button"
                      >+ Add Customer</button>
                    )}
                  </div>
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      disabled={!cart.length || saving}
                      className="w-full rounded-xl px-4 py-3.5 font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 transition-all text-base"
                    >{saving ? 'Saving…' : 'Proceed to Payment'}</button>
                    <div className="flex gap-2">
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
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
                        type="button"
                      >Preview</button>
                      {cart.length > 0 && (
                        <button onClick={clearOrderState} className="rounded-xl border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/50 text-rose-400 px-3 py-2 text-sm font-medium transition-all" type="button">Clear</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div
        className="grid overflow-hidden"
        style={{
          height: 'calc(100vh - 56px)',
          gridTemplateColumns: posMode === "scanner" ? "360px 1fr" : "1fr 420px"
        }}
      >
        {/* Product/Search/Scanner Column */}
        {posMode === "scanner" ? (
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
              {/* --- ENHANCED: Clean Category Section with Better Spacing --- */}
              <div className="relative">
                <div className="flex flex-wrap gap-2 pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <button
                    onClick={async () => { setActiveCat(undefined); setQ(""); await loadDefaultListing(); }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${!activeCat ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'}`}
                    type="button"
                  >All <span className="opacity-70">({allResults?.length || 0})</span></button>
                  {favorites.length > 0 && (
                    <button
                      onClick={() => {
                        setActiveCat('_favorites');
                        setQ("");
                        setResults(allResults.filter(p => favorites.includes(p.id)));
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${activeCat === '_favorites' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/25' : 'bg-white/5 hover:bg-amber-500/20 border-white/10 text-slate-300 hover:text-white'}`}
                      type="button"
                    >⭐ Favorites <span className="opacity-70">({favorites.length})</span></button>
                  )}
                  {recentItems.length > 0 && (
                    <button
                      onClick={() => {
                        setActiveCat('_recent');
                        setQ("");
                        const recentIds = recentItems.map(item => item.id);
                        setResults(allResults.filter(p => recentIds.includes(p.id)));
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${activeCat === '_recent' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/25' : 'bg-white/5 hover:bg-blue-500/20 border-white/10 text-slate-300 hover:text-white'}`}
                      type="button"
                    >🕐 Recent <span className="opacity-70">({recentItems.length})</span></button>
                  )}
                  {allCategories.slice(0, 12).map((c) => {
                    const catId = c.id || c.name;
                    const count = (catAgg.find((x) => x.id === catId || x.name === c.name)?.count) ?? undefined;
                    return (
                      <button
                        key={`chip-${catId}`}
                        onClick={() => pickCategory(c)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${activeCat === catId ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'}`}
                        type="button"
                      >{c.name} <span className="opacity-70">({count || 0})</span></button>
                    );
                  })}
                  {allCategories.length > 12 && (
                    <button
                      className="px-4 py-2 rounded-xl text-xs font-semibold border bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white transition-all"
                      type="button"
                      title={`${allCategories.length - 12} more categories`}
                    >+{allCategories.length - 12} more</button>
                  )}
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
                  <motion.div key={`inventory-${activeCat || 'all'}`} {...fadeVariants}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-4 pb-6">
                      <AnimatePresence mode="popLayout">
                        {visibleResults.map(p => {
                          const displayName = p.productName || p.name || "Unnamed";
                          const displayPrice = (p.pricingMode === "MRP_INCLUSIVE")
                            ? (p.mrp ?? p.sellingPrice ?? p.price ?? p.basePrice ?? 0)
                            : (p.sellingPrice ?? p.price ?? (p.basePrice ? (p.basePrice * (1 + (Number(p.gstRate ?? p.taxRate ?? 0) / 100))) : p.mrp) ?? 0);
                          const displayImg = p.imageUrl || p.img;
                          const stockStatus = getStatus(p.quantity);
                          const isOutOfStock = (p.quantity ?? 1) <= 0;
                          const isFavorite = favorites.includes(p.id);
                          return (
                            <motion.div
                              key={p.id} layout {...productVariants}
                              className={`group rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-3 text-left relative flex flex-col transition-all duration-200 hover:translate-y-[-4px] hover:bg-white/10 hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/50`}>
                              <div className="absolute top-2 left-2 z-20 flex gap-1.5">
                                <span className={`px-2.5 py-1 text-[10px] font-bold text-white rounded-lg ${stockStatus.color} flex items-center gap-1.5 shadow-lg`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stockStatus.dot}`}></span>
                                  {stockStatus.text}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isFavorite ? 'bg-amber-500/90 text-white shadow-lg shadow-amber-500/50' : 'bg-white/10 text-white/40 hover:bg-amber-500/30 hover:text-amber-300 backdrop-blur-sm'}`}
                                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                  type="button"
                                >⭐</button>
                              </div>
                              <div className="relative" onClick={() => !isOutOfStock && addToCart(p)}>
                                {displayImg ? (<img loading="lazy" src={displayImg} alt={displayName} className={`w-full h-32 object-cover rounded-xl mb-2 shadow-sm cursor-pointer`} />) : (<div className={`w-full h-32 rounded-xl bg-white/10 mb-2 cursor-pointer`} />)}
                                {isOutOfStock && (<div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center text-white font-bold text-lg">Out of Stock</div>)}
                              </div>
                              <div className="mt-1 text-sm font-semibold line-clamp-2 h-10 cursor-pointer" onClick={() => !isOutOfStock && addToCart(p)}>{displayName}</div>
                              <div className="mt-1 text-[12px] text-white/70 grid grid-cols-2 gap-x-2 gap-y-0.5">
                                <div className="truncate" title={`Brand: ${p.brand || '-'}`}>Brand: {p.brand || '—'}</div>
                                <div className="truncate" title={`HSN: ${p.hsnCode || '-'}`}>HSN: {p.hsnCode || '—'}</div>
                                <div className="truncate" title={`GST: ${Number(p.gstRate ?? p.taxRate ?? 0)}%`}>GST: {Number(p.gstRate ?? p.taxRate ?? 0)}%</div>
                                <div className="truncate" title={`Stock: ${typeof p.quantity === 'number' ? p.quantity : '-'}`}>Stock: {typeof p.quantity === 'number' ? p.quantity : '—'}</div>
                                <div className="truncate col-span-2" title={`Unit: ${p.unit || '-'}`}>Unit: {p.unit || '—'}</div>
                              </div>
                              <div className="flex items-center justify-between mt-auto pt-2">
                                <div className="text-base font-bold text-slate-100">₹ {money(displayPrice)}</div>
                                {!isOutOfStock && (
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    {[1, 2, 5].map(qty => (
                                      <button
                                        key={qty}
                                        onClick={() => addToCart(p, qty)}
                                        className="px-2 py-1 text-xs rounded border border-white/20 bg-white/10 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-colors"
                                        type="button"
                                        title={`Add ${qty}`}
                                      >+{qty}</button>
                                    ))}
                                  </div>
                                )}
                              </div>
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
        )}

        {/* Col 2: Cart */}
        <div className="w-[420px] bg-transparent sticky top-[56px] self-start h-[calc(100vh-56px)]">
          <div className="flex flex-col h-full min-h-0">
            <div className="p-3 flex items-center gap-2 border-b border-white/10 bg-white/5 flex-wrap">
              {/* --- ENHANCED: Multi-Cart Tabs --- */}
              <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1 border border-white/10 shrink-0">
                {[0, 1, 2].map(idx => {
                  const cartState = multiCarts[idx];
                  const itemCount = cartState.cart?.length || 0;
                  const isActive = activeCartIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveCartIndex(idx)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      type="button"
                      title={`Cart ${idx + 1} (Ctrl+${idx + 1})`}
                    >
                      {idx + 1}
                      {itemCount > 0 && (
                        <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                          {itemCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setIsTemplateModalOpen(true)} className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-white transition-all shrink-0" type="button" title="Load Template">📋</button>
                <button onClick={() => cart.length > 0 && setIsSaveTemplateModalOpen(true)} disabled={!cart.length} className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-white transition-all disabled:opacity-50 shrink-0" type="button" title="Save Template">💾</button>
                <button onClick={holdCurrentOrder} className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-white transition-all shrink-0" type="button">Hold</button>
                <div className="relative group shrink-0">
                  <button className="text-xs rounded-lg border border-white/10 px-2 py-1 bg-white/5 hover:bg-white/10 text-white transition-all" type="button">Drafts ({drafts.length})</button>
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
                <button onClick={() => { setIsCartExpanded(true); setPosMode('expandedCart'); }} className="text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-white transition-all shrink-0" type="button">Expand</button>
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
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="flex items-start gap-3 rounded-xl border border-white/10 p-2.5 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 transition-all">
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

            {/* --- ENHANCED: Checkout Section - Fully Minimizable --- */}
            {isPaymentSectionMinimized ? (
              <div className="mt-auto border-t border-white/10 bg-gradient-to-t from-slate-900/95 to-slate-800/95 backdrop-blur-xl sticky bottom-0">
                <button
                  onClick={() => setIsPaymentSectionMinimized(false)}
                  className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors group"
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">Payment & Checkout</div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      ₹ {money(totals.grandTotal)}
                    </span>
                  </div>
                  <svg
                    className="w-4 h-4 text-slate-400 transition-transform duration-200 rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                </div>
            ) : (
              <div className="mt-auto border-t border-white/10 bg-gradient-to-t from-slate-900/95 to-slate-800/95 backdrop-blur-xl sticky bottom-0">
                {/* Minimize Header */}
                <button
                  onClick={() => setIsPaymentSectionMinimized(true)}
                  className="w-full p-2 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/10"
                  type="button"
                >
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment & Checkout</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                      ₹ {money(totals.grandTotal)}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-400 transition-transform duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
              </div>
                </button>
                
              {/* Customer Panel - Collapsible */}
              <div className="border-b border-white/10">
                <button
                  onClick={() => setIsCustomerCollapsed(!isCustomerCollapsed)}
                  className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors group"
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">Customer</div>
                    {customer.name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        {customer.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!customer.name && !showCustomer && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowCustomer(true); setIsCustomerCollapsed(false); }}
                        className="text-xs rounded-lg border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 text-white transition-all"
                        type="button"
                      >Add</button>
                    )}
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCustomerCollapsed ? '' : 'rotate-180'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                <AnimatePresence>
                  {!isCustomerCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3">
                        {showCustomer ? (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <CustomerForm customer={customer} setCustomer={setCustomer} />
                </div>
                        ) : customer.name ? (
                          <div className="text-sm text-slate-300 py-2">{customer.name}</div>
                        ) : (
                          <button
                            onClick={() => setShowCustomer(true)}
                            className="w-full text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 text-white transition-all"
                            type="button"
                          >+ Add Customer Info</button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Totals Summary - Always Visible Compact */}
              <div className="p-3 border-b border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-400">Total</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                    ₹ {money(totals.grandTotal)}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Subtotal</span>
                  <span>₹ {money(totals.subTotal)}</span>
                </div>
                {totals.tax > 0 && (
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Tax</span>
                    <span>₹ {money(totals.tax)}</span>
                  </div>
                )}
                {(totals.discount > 0 || totals.tip > 0 || additionalCharges.length > 0) && (
                  <button
                    onClick={() => setIsCheckoutCollapsed(!isCheckoutCollapsed)}
                    className="w-full mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    type="button"
                  >
                    {isCheckoutCollapsed ? 'Show Details' : 'Hide Details'}
                  </button>
                )}
              </div>

              {/* Expanded Checkout Details - Collapsible */}
              <AnimatePresence>
                {!isCheckoutCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden border-b border-white/10"
                  >
                    <div className="p-3 space-y-2 text-sm">
                {totals.discount > 0 && (
                        <div className="flex justify-between text-rose-400">
                    <span>Discount</span>
                    <span>- ₹ {money(totals.discount)}</span>
                  </div>
                )}
                
                {additionalCharges.map((charge, i) => (
                        <div key={i} className="flex justify-between items-center text-blue-400">
                          <span>{charge.name}</span>
                        <div className="flex items-center gap-2">
                            <span>+ ₹ {money(charge.value)}</span>
                            <button onClick={() => setAdditionalCharges(c => c.filter((_, idx) => idx !== i))} className="text-rose-400 text-xs hover:text-rose-300">×</button>
                        </div>
                    </div>
                ))}

                      {totals.tip > 0 && (
                        <div className="flex justify-between items-center text-amber-400">
                          <span>Tip / Gratuity</span>
                          <div className="flex items-center gap-2">
                            <span>+ ₹ {money(totals.tip)}</span>
                            <button onClick={() => setTip({ type: 'fixed', value: 0 })} className="text-rose-400 text-xs hover:text-rose-300">×</button>
                          </div>
                        </div>
                      )}

                      {/* Action buttons for discount/charges/tips */}
                      <div className="flex justify-end gap-2 pt-2 flex-wrap border-t border-white/10 mt-2">
                        <button onClick={() => setIsDiscountModalOpen(true)} className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline transition-colors">
                          {totals.orderDiscount > 0 ? 'Edit Discount' : 'Add Discount'}
                    </button>
                        <button onClick={() => setIsChargeModalOpen(true)} className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                        Add Fee/Charge
                    </button>
                        <button onClick={() => setIsTipModalOpen(true)} className="text-xs text-amber-400 hover:text-amber-300 hover:underline transition-colors">
                          {totals.tip > 0 ? 'Edit Tip' : 'Add Tip'}
                    </button>
                </div>
              </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons - Collapsible */}
              <div className="p-3 space-y-2">
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={!cart.length || saving}
                  className="w-full rounded-xl px-4 py-3.5 font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 transition-all text-base"
              >{saving ? 'Saving…' : 'Proceed to Payment'}</button>
                <div className="flex gap-2">
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
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
                type="button"
              >
                Preview Receipt
              </button>
              {cart.length > 0 && (
                    <button onClick={clearOrderState} className="rounded-xl border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/50 text-rose-400 px-3 py-2 text-sm font-medium transition-all" type="button">Clear</button>
              )}
            </div>
          </div>
        </div>
            )}
      </div>
        </div>
      </div>
      )}
        
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
        <TipModal
            open={isTipModalOpen}
            onClose={() => setIsTipModalOpen(false)}
            onSave={setTip}
            subTotal={totals.subTotal}
            currentTip={tip}
        />
        <ShortcutsModal
            open={showShortcuts}
            onClose={() => setShowShortcuts(false)}
        />
        <TemplateModal
          open={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          templates={templates}
          onLoad={loadTemplate}
          onDelete={deleteTemplate}
        />
        <SaveTemplateModal
          open={isSaveTemplateModalOpen}
          onClose={() => { setIsSaveTemplateModalOpen(false); setTemplateName(""); }}
          onSave={saveTemplate}
          initialName={templateName}
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