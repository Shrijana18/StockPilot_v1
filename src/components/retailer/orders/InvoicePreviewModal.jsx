import React, { useEffect } from "react";
import ReactDOM from "react-dom";

/**
 * Premium Invoice Preview Modal
 * - Sticky header with order meta + actions (Print / Close)
 * - Wider layout, controlled body scroll
 * - dd/mm/yyyy + INR formatting
 * - Stable table with sticky thead
 * - Clear charges & tax breakdown, matches FLYP theme
 */
const InvoicePreviewModal = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const proforma = invoice.proforma || {};
  const charges = proforma.orderCharges || {};
  const tax = proforma?.taxBreakup || charges?.taxBreakup || {};

  const formatINR = (amt = 0) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amt || 0));

  const toJSDate = (ts) => {
    if (!ts) return null;
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    return isNaN(d) ? null : d;
  };

  const formatDate = (ts) => {
    const d = toJSDate(ts);
    return d
      ? new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(d)
      : "-";
  };

  const dateStr = formatDate(proforma?.date);
  const orderId = invoice.id || "-";
  const distributorName = invoice.distributorName || "-";
  const invoiceType = proforma?.invoiceType || invoice?.invoiceType || "Invoice";

  const lines = Array.isArray(proforma?.lines) ? proforma.lines : [];
  const isZero = (v) => Number(v || 0) === 0;

  // --- SOLD TO resolver: collects buyer info from multiple shapes ---
  const pick = (...vals) => vals.find((v) => typeof v === "string" && v.trim().length) || null;
  const obj = (...objs) => objs.find((o) => o && typeof o === "object") || {};

  const retailerObj = obj(
    invoice.retailer,
    proforma.retailer,
    proforma.customer,
    proforma.buyer
  );

  const buyerName = pick(
    invoice.retailerBusinessName,
    invoice.retailerName,
    invoice.customerName,
    invoice.buyerName,
    retailerObj.businessName,
    retailerObj.name
  );
  const buyerEmail = pick(
    invoice.retailerEmail,
    invoice.customerEmail,
    invoice.buyerEmail,
    retailerObj.email
  );
  const buyerPhone = pick(
    invoice.retailerPhone,
    invoice.customerPhone,
    invoice.buyerPhone,
    retailerObj.phone,
    retailerObj.mobile
  );
  const addr1 = pick(
    invoice.retailerAddress,
    invoice.customerAddress,
    retailerObj.address,
    retailerObj.addressLine1
  );
  const addr2 = pick(retailerObj.addressLine2);
  const city = pick(invoice.retailerCity, retailerObj.city);
  const state = pick(invoice.retailerState, retailerObj.state);
  const pin = pick(invoice.retailerPincode, retailerObj.pincode, retailerObj.pinCode);
  const addressParts = [addr1, addr2, city && state ? `${city}, ${state}` : city || state, pin];
  const buyerAddress = addressParts.filter(Boolean).join(", ") || null;
  const buyerGST = pick(invoice.retailerGST, invoice.retailerGSTIN, retailerObj.gst, retailerObj.gstin);

  const buyer = {
    name: buyerName || "- ",
    email: buyerEmail || "- ",
    phone: buyerPhone || "- ",
    address: buyerAddress || "- ",
    gst: buyerGST || null,
  };

  // Tax %: prefer saved rates from Firestore; fallback to deriving from amounts
  const base = Number(
    (tax && (tax.taxableBase ?? tax.base)) ?? // common shapes
    (proforma?.taxBreakup && proforma.taxBreakup.taxableBase) ??
    charges?.subTotal ?? 0
  );
  const derivePct = (amt) => {
    const a = Number(amt || 0);
    if (!base || base <= 0) return null;
    return Math.round((a / base) * 10000) / 100; // 2 decimals
  };
  const pickNum = (...vals) => {
    for (const v of vals) {
      if (v === 0 || (v && !Number.isNaN(Number(v)))) return Number(v);
    }
    return null;
  };
  const cgstPct = pickNum(tax?.cgstPct, tax?.cgstRate, proforma?.cgstPct, proforma?.cgstRate) ?? derivePct(tax?.cgst);
  const sgstPct = pickNum(tax?.sgstPct, tax?.sgstRate, proforma?.sgstPct, proforma?.sgstRate) ?? derivePct(tax?.sgst);
  const igstPct = pickNum(tax?.igstPct, tax?.igstRate, proforma?.igstPct, proforma?.igstRate) ?? derivePct(tax?.igst);
  const fmtPct = (v) => (v === null || v === undefined ? null : (Number.isInteger(v) ? String(v) : (Number(v).toFixed(2))));

  // Per-line GST rate: prefer saved gstRate; fallback to derive from taxable & gross
  const lineGstRate = (item) => {
    if (!item) return null;
    const saved = item.gstRate;
    if (saved === 0 || (saved && !Number.isNaN(Number(saved)))) return Number(saved);
    const taxable = Number(item.taxable || 0);
    const gross = Number(item.gross || 0);
    if (taxable > 0 && gross >= taxable) {
      const taxAmt = gross - taxable;
      return Math.round((taxAmt / taxable) * 10000) / 100; // 2 decimals
    }
    return null;
  };

  // Per-line GST amount: prefer (gross - taxable); fallback to taxable * gstRate
  const lineGstAmount = (item) => {
    if (!item) return 0;
    const taxable = Number(item.taxable || 0);
    const gross = Number(item.gross || 0);
    if (taxable > 0 && gross >= taxable) return gross - taxable;
    const rate = Number(item.gstRate || 0);
    if (taxable > 0 && rate > 0) return (taxable * rate) / 100;
    return 0;
  };

  // Body scroll lock + hotkeys
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      // Cmd/Ctrl+P → print
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "p")) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="invoice-modal-wrap fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Card */}
      <div
        className="invoice-modal relative w-[94vw] max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0F1216] text-white shadow-[0_10px_50px_rgba(0,0,0,0.65)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="invoice-modal__header sticky top-0 z-10 border-b border-white/10 bg-[#0F1216]/95 backdrop-blur px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-white/60">{invoiceType}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                <span className="truncate"><span className="text-white/60">Order ID:</span> <span className="font-mono">{orderId}</span></span>
                <span>•</span>
                <span><span className="text-white/60">Date:</span> {dateStr}</span>
                <span>•</span>
                <span><span className="text-white/60">Distributor:</span> {distributorName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Print / Save PDF
              </button>
              <button
                onClick={onClose}
                className="rounded-md border border-white/10 bg-[#1a1f25] px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="invoice-modal__content grid gap-5 overflow-y-auto px-5 py-5 pb-8 md:px-6 md:py-6 md:pb-10">
          {/* SOLD BY / SOLD TO / ORDER */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* SOLD BY (Distributor) */}
            <div className="invoice-panel rounded-lg border border-white/10 bg-[#0f151a] p-4 text-sm">
              <div className="mb-2 text-xs uppercase tracking-wide text-white/60">Sold By</div>
              <div className="space-y-1 text-white/90">
                <div><span className="text-white/70">Name:</span> {invoice.distributorName || "-"}</div>
                <div><span className="text-white/70">Email:</span> {invoice.distributorEmail || "-"}</div>
                <div><span className="text-white/70">Phone:</span> {invoice.distributorPhone || "-"}</div>
                <div><span className="text-white/70">City/State:</span> {invoice.distributorCity || "-"}{invoice.distributorState ? `, ${invoice.distributorState}` : ""}</div>
                {invoice.distributorGST && (
                  <div><span className="text-white/70">GSTIN:</span> {invoice.distributorGST}</div>
                )}
              </div>
            </div>

            {/* SOLD TO (Buyer/Retailer) */}
            <div className="invoice-panel rounded-lg border border-white/10 bg-[#0f151a] p-4 text-sm">
              <div className="mb-2 text-xs uppercase tracking-wide text-white/60">Sold To</div>
              <div className="space-y-1 text-white/90">
                <div><span className="text-white/70">Name:</span> {buyer.name}</div>
                <div><span className="text-white/70">Email:</span> {buyer.email}</div>
                <div><span className="text-white/70">Phone:</span> {buyer.phone}</div>
                <div><span className="text-white/70">Address:</span> {buyer.address}</div>
                {buyer.gst && (
                  <div><span className="text-white/70">GSTIN:</span> {buyer.gst}</div>
                )}
              </div>
            </div>

            {/* ORDER */}
            <div className="invoice-panel rounded-lg border border-white/10 bg-[#0f151a] p-4 text-sm">
              <div className="mb-2 text-xs uppercase tracking-wide text-white/60">Order</div>
              <div className="space-y-1 text-white/90">
                <div><span className="text-white/70">Order ID:</span> {orderId}</div>
                <div><span className="text-white/70">Date:</span> {dateStr}</div>
                <div><span className="text-white/70">Payment Mode:</span> {invoice.paymentMode || "-"}</div>
                {invoice.soldByUser && (
                  <div><span className="text-white/70">Sold By (User):</span> {invoice.soldByUser}</div>
                )}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="invoice-modal__tablewrap overflow-hidden rounded-xl border border-white/10">
            <div className="max-h-[34vh] overflow-auto">
              <table className="invoice-table w-full text-left text-sm text-white/90">
                <thead className="sticky top-0 bg-[#131a20] text-xs uppercase tracking-wide text-emerald-300">
                  <tr>
                    <th className="border-b border-white/10 px-3 py-2">Product</th>
                    <th className="border-b border-white/10 px-3 py-2 text-right">Qty</th>
                    <th className="border-b border-white/10 px-3 py-2 text-right">Price</th>
                    <th className="border-b border-white/10 px-3 py-2 text-right">GST %</th>
                    <th className="border-b border-white/10 px-3 py-2 text-right">GST Amt</th>
                    <th className="border-b border-white/10 px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((item, idx) => (
                    <tr key={idx} className={idx % 2 ? "bg-white/5" : "bg-white/[0.02]"}>
                      <td className="px-3 py-2 align-top">{item?.name || "-"}</td>
                      <td className="px-3 py-2 text-right align-top">{item?.qty ?? "-"}</td>
                      <td className="px-3 py-2 text-right align-top">{formatINR(item?.price)}</td>
                      <td className="px-3 py-2 text-right align-top">{fmtPct(lineGstRate(item)) ? `${fmtPct(lineGstRate(item))}%` : "-"}</td>
                      <td className="px-3 py-2 text-right align-top">{formatINR(lineGstAmount(item))}</td>
                      <td className="px-3 py-2 text-right align-top">{formatINR(item?.gross)}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-white/60" colSpan={6}>No items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="invoice-panel rounded-lg border border-white/10 bg-[#0f151a] p-4 text-sm text-white/90 mb-1">
            <div className="space-y-2">
              <Row label="Subtotal" value={formatINR(charges?.subTotal)} dim={isZero(charges?.subTotal)} />
              <Row label="Delivery" value={formatINR(charges?.delivery)} dim={isZero(charges?.delivery)} />
              <Row label="Packing" value={formatINR(charges?.packing)} dim={isZero(charges?.packing)} />
              <Row label="Insurance" value={formatINR(charges?.insurance)} dim={isZero(charges?.insurance)} />
              {typeof charges?.other !== "undefined" && (
                <Row label="Other" value={formatINR(charges?.other)} dim={isZero(charges?.other)} />
              )}
              {typeof charges?.roundOff !== "undefined" && (
                <Row label="Round Off" value={formatINR(charges?.roundOff)} dim={isZero(charges?.roundOff)} />
              )}

              {/* Taxes */}
              <div className="mt-3 border-t border-white/10 pt-3" />
              {typeof tax?.cgst !== "undefined" && (
                <Row label={`CGST${fmtPct(cgstPct) ? ` (${fmtPct(cgstPct)}%)` : ''}`} value={formatINR(tax?.cgst)} dim={isZero(tax?.cgst)} />
              )}
              {typeof tax?.sgst !== "undefined" && (
                <Row label={`SGST${fmtPct(sgstPct) ? ` (${fmtPct(sgstPct)}%)` : ''}`} value={formatINR(tax?.sgst)} dim={isZero(tax?.sgst)} />
              )}
              {typeof tax?.igst !== "undefined" && (
                <Row label={`IGST${fmtPct(igstPct) ? ` (${fmtPct(igstPct)}%)` : ''}`} value={formatINR(tax?.igst)} dim={isZero(tax?.igst)} />
              )}

              {/* Grand total */}
              <div className="mt-3 border-t border-white/10 pt-3" />
              <div className="flex items-center justify-between text-lg font-bold text-emerald-400">
                <span>Grand Total</span>
                <span>{formatINR(proforma?.grandTotal)}</span>
              </div>
            </div>
          </div>
        <style>{`
  /* Maintain crisp colors when printing */
  @media print {
    html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Hide backdrop */
    .invoice-modal-wrap > div:first-child { display: none !important; }
    /* Expand modal to full page */
    .invoice-modal { position: static !important; inset: auto !important; width: auto !important; max-width: 100% !important; max-height: none !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; color: #111 !important; border-color: #e5e7eb !important; }
    .invoice-modal__header { background: #fff !important; border-color: #e5e7eb !important; color: #111 !important; }
    .invoice-modal__content { overflow: visible !important; padding: 24px !important; }
    /* Hide interactive controls */
    .invoice-modal__header button { display: none !important; }
    /* Table styling for print */
    .invoice-modal__tablewrap { border-color: #e5e7eb !important; }
    .invoice-modal__tablewrap table { color: #111 !important; }
    .invoice-modal__tablewrap thead { background: #f8fafc !important; color: #111 !important; }
    .invoice-modal__tablewrap th, .invoice-modal__tablewrap td { border-color: #e5e7eb !important; }
    /* Avoid content cut on page breaks */
    .invoice-modal__tablewrap, .invoice-modal__content, .invoice-modal { page-break-inside: avoid; }
    .invoice-modal__tablewrap table tr { page-break-inside: avoid; }

    /* Light theme panels on print */
    .invoice-panel { background: #fff !important; border-color: #e5e7eb !important; }
    /* Force all text dark for readability */
    .invoice-modal * { color: #111 !important; }
    /* Keep emphasis colors for totals */
    .invoice-modal .text-emerald-400, .invoice-modal [class*="text-emerald"] { color: #047857 !important; }
    /* Table readability on print */
    .invoice-table { color: #111 !important; border-collapse: collapse; width: 100%; }
    .invoice-table thead { background: #f3f4f6 !important; color: #111 !important; }
    .invoice-table th, .invoice-table td { border-bottom: 1px solid #e5e7eb !important; }
    .invoice-table tbody tr:nth-child(even) { background: #fafafa !important; }
    .invoice-table tbody tr:nth-child(odd) { background: #ffffff !important; }
  }

  /* Desktop fit: ensure no horizontal cut and better inner scrolling */
  .invoice-modal { width: min(100vw - 32px, 1120px); }
  .invoice-modal__content { scrollbar-gutter: stable; }
`}</style>
      </div>
      </div>
    </div>,
    document.body
  );
};

const Row = ({ label, value, dim }) => (
  <div className="flex items-center justify-between">
    <span className={"text-white/70 " + (dim ? "opacity-60" : "")}>{label}</span>
    <span className={"font-medium " + (dim ? "opacity-60" : "")}>{value}</span>
  </div>
);

export default InvoicePreviewModal;