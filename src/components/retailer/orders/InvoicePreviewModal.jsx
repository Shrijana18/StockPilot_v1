import React, { useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * InvoicePreviewModal (polished)
 *\n * Pulls data STRICTLY from Firestore `sentOrders` → `proforma` block to avoid discrepancies.
 *
 * Sources used:
 * - proforma.lines[]                   → product table (qty, price, inline disc %, disc ₹, gstRate, line total)
 * - proforma.grossItems                → Gross Items Total
 * - proforma.lineDiscountTotal         → − Line Discounts
 * - proforma.itemsSubTotal             → Items Sub‑Total (after inline discounts)
 * - proforma.orderCharges.*            → Delivery, Packing, Insurance, Other, Round Off, SubTotal, discountPct
 * - proforma.discountTotal             → Order Discount ₹ (amount)
 * - proforma.taxBreakup{cgst,sgst,igst,taxType} → tax amounts & type label
 * - proforma.grandTotal                → Grand Total
 */

const formatINR = (amt = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amt || 0));

const fmtPct = (v, digits = 0) =>
  v === null || v === undefined || isNaN(Number(v))
    ? ""
    : `${Number(v).toFixed(digits)}%`;

const isZero = (v) => Math.abs(Number(v || 0)) < 1e-9;

export default function InvoicePreviewModal({ invoice, onClose }) {
  // Guard
  const pf = invoice?.proforma || {};
  const orderCharges = pf?.orderCharges || {};
  const tax = pf?.taxBreakup || {};
  const lines = Array.isArray(pf?.lines) ? pf.lines : [];

  // Derived
  const gstRateLabel = useMemo(() => {
    const rates = Array.from(
      new Set(lines.map((l) => Number(l?.gstRate ?? 0)).filter((n) => Number.isFinite(n)))
    );
    if (rates.length === 0) return "—";
    if (rates.length === 1) return `${rates[0]}%`;
    return "Mixed";
  }, [lines]);

  const seller = {
    name: invoice?.distributorName || "-",
    email: invoice?.distributorEmail || "-",
    phone: invoice?.distributorPhone || "-",
    city: invoice?.distributorCity || "-",
    state: invoice?.distributorState || "-",
  };

  const buyer = {
    name: invoice?.retailerBusinessName || invoice?.retailerName || "-",
    email: invoice?.retailerEmail || "-",
    phone: invoice?.retailerPhone || "-",
    address: invoice?.retailerAddress || "-",
  };

  const meta = {
    orderId: invoice?.id || invoice?.orderId || "-",
    date: (() => {
      const d = pf?.date;
      try {
        if (d?.toDate) return d.toDate().toLocaleString("en-GB");
        const dd = new Date(d);
        if (!isNaN(dd.getTime())) return dd.toLocaleString("en-GB");
      } catch {}
      return new Date().toLocaleString("en-GB");
    })(),
    paymentMode: invoice?.paymentMode || "-",
    paymentStatus: invoice?.paymentStatus || "-",
  };

  const totals = {
    grossItems: Number(pf?.grossItems || 0),
    lineDiscountTotal: Number(pf?.lineDiscountTotal || 0),
    itemsSubTotal: Number(pf?.itemsSubTotal ?? pf?.orderCharges?.subTotal ?? 0),
    delivery: Number(orderCharges?.delivery || 0),
    packing: Number(orderCharges?.packing || 0),
    insurance: Number(orderCharges?.insurance || 0),
    other: Number(orderCharges?.other || 0),
    discountPct: Number(orderCharges?.discountPct || 0),
    discountAmt: Number(pf?.discountTotal || 0), // ← amount comes from proforma.discountTotal
    taxableBase: Number(pf?.taxBreakup?.taxableBase ?? pf?.taxableBase ?? 0),
    roundOff: Number(orderCharges?.roundOff || 0),
    cgst: Number(tax?.cgst || 0),
    sgst: Number(tax?.sgst || 0),
    igst: Number(tax?.igst || 0),
    grandTotal: Number(pf?.grandTotal || 0),
    taxType: tax?.taxType || (invoice?.distributorState && invoice?.retailerState && invoice?.distributorState !== invoice?.retailerState ? "IGST" : "CGST_SGST"),
  };

  // UI helpers
  const Row = ({ label, value, dim, bold }) => (
    <div className={`flex items-center justify-between ${bold ? "font-semibold text-white" : ""}`}>
      <span className={dim ? "text-white/60" : "text-white/80"}>{label}</span>
      <span className={bold ? "text-white" : "text-white/90"}>{formatINR(value)}</span>
    </div>
  );

  // Lock background scroll while modal is open
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60">
      <div className="invoice-modal relative w-[96vw] max-w-6xl max-h-[92vh] rounded-2xl border border-white/10 bg-[#0F1216] text-white shadow-[0_10px_50px_rgba(0,0,0,0.65)] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0F1216]/95 backdrop-blur px-4 py-3 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">INVOICE</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
              >
                Print / Save PDF
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
              >
                Close
              </button>
            </div>
          </div>
          <div className="mt-1 text-xs text-white/60 flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="text-white/70">Order ID:</span> {meta.orderId}</span>
            <span>•</span>
            <span><span className="text-white/70">Date:</span> {meta.date}</span>
            <span>•</span>
            <span><span className="text-white/70">Distributor:</span> {seller.name}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="invoice-modal__content flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Sold By</div>
              <div className="font-medium">{seller.name}</div>
              <div className="text-white/70 text-sm">Email: {seller.email}</div>
              <div className="text-white/70 text-sm">Phone: {seller.phone}</div>
              <div className="text-white/70 text-sm">City/State: {seller.city}, {seller.state}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Sold To</div>
              <div className="font-medium">{buyer.name}</div>
              <div className="text-white/70 text-sm">Email: {buyer.email}</div>
              <div className="text-white/70 text-sm">Phone: {buyer.phone}</div>
              <div className="text-white/70 text-sm">Address: {buyer.address}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Order</div>
              <div className="text-white/70 text-sm">Payment Mode: {meta.paymentMode}</div>
              <div className="text-white/70 text-sm">Payment Status: {meta.paymentStatus}</div>
              <div className="text-white/70 text-sm">GST Rate: {gstRateLabel}</div>
            </div>
          </div>

          {/* Main grid: Items + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT: Items table + items math recap */}
            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="max-h-[40vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#131a20] text-xs uppercase tracking-wide text-emerald-300">
                      <tr>
                        <th className="border-b border-white/10 px-3 py-2 text-left">Product</th>
                        <th className="border-b border-white/10 px-3 py-2 text-center">Qty</th>
                        <th className="border-b border-white/10 px-3 py-2 text-right">Price</th>
                        <th className="border-b border-white/10 px-3 py-2 text-right">Disc %</th>
                        <th className="border-b border-white/10 px-3 py-2 text-right">Disc ₹</th>
                        <th className="border-b border-white/10 px-3 py-2 text-right">GST %</th>
                        <th className="border-b border-white/10 px-3 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => {
                        const qty = Number(l?.qty || 0);
                        const price = Number(l?.price || 0);
                        const discPct = Number(l?.itemDiscountPct || 0);
                        const discAmt = Number(l?.discountAmount || 0);
                        const lineTotal = Number(l?.taxable ?? qty * price - discAmt);
                        const gstRate = Number(l?.gstRate || 0);
                        return (
                          <tr key={idx} className={idx % 2 ? "bg-white/5" : "bg-white/[0.02]"}>
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium">{l?.name || "-"}</div>
                              <div className="text-xs text-white/60">{l?.sku || ""} {l?.uom ? `• ${l.uom}` : ""}</div>
                            </td>
                            <td className="px-3 py-2 text-center align-top">{qty}</td>
                            <td className="px-3 py-2 text-right align-top">{formatINR(price)}</td>
                            <td className="px-3 py-2 text-right align-top">{fmtPct(discPct)}</td>
                            <td className="px-3 py-2 text-right align-top">{formatINR(discAmt)}</td>
                            <td className="px-3 py-2 text-right align-top">{fmtPct(gstRate)}</td>
                            <td className="px-3 py-2 text-right align-top">{formatINR(lineTotal)}</td>
                          </tr>
                        );
                      })}
                      {lines.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-center text-white/60" colSpan={7}>No items</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Items recap */}
              <div className="rounded-lg border border-white/10 bg-[#0f151a] mt-3 p-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-white/70">Gross Items Total</span><span className="font-medium">{formatINR(totals.grossItems)}</span></div>
                <div className="flex items-center justify-between"><span className="text-white/70">− Line Discounts</span><span className="font-medium">{formatINR(totals.lineDiscountTotal)}</span></div>
                <div className="flex items-center justify-between font-semibold text-white">
                  <span>Items Sub‑Total</span><span>{formatINR(totals.itemsSubTotal)}</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Summary */}
            <aside className="lg:col-span-1">
              <div className="sticky top-[88px] space-y-3">
                {/* Grand Total highlight */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-emerald-300">Grand Total</div>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-300">{formatINR(totals.grandTotal)}</div>
                </div>

                {/* Charges & Tax breakdown */}
                <div className="rounded-lg border border-white/10 bg-[#0f151a] p-4 text-sm text-white/90">
                  <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Charges & Discount</div>
                  <Row label="Delivery" value={totals.delivery} dim={isZero(totals.delivery)} />
                  <Row label="Packing" value={totals.packing} dim={isZero(totals.packing)} />
                  <Row label="Insurance" value={totals.insurance} dim={isZero(totals.insurance)} />
                  <Row label="Other" value={totals.other} dim={isZero(totals.other)} />
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">− Order Discount {fmtPct(totals.discountPct) && `(${fmtPct(totals.discountPct)})`}</span>
                    <span className="text-white/90">{formatINR(totals.discountAmt)}</span>
                  </div>

                  <div className="mt-3 text-xs uppercase tracking-wide text-white/60">Taxable</div>
                  <Row label="Taxable Base" value={totals.taxableBase} bold />

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-white/70">Tax Type</span>
                    <span className="font-medium">{totals.taxType === 'IGST' ? 'IGST (Interstate)' : 'CGST + SGST (Intrastate)'}</span>
                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2" />
                  {!!totals.cgst && <Row label={`CGST`} value={totals.cgst} />}
                  {!!totals.sgst && <Row label={`SGST`} value={totals.sgst} />}
                  {!!totals.igst && <Row label={`IGST`} value={totals.igst} />}
                  {!totals.cgst && !totals.sgst && !totals.igst && (
                    <div className="text-white/60">No taxes</div>
                  )}

                  {!isZero(totals.roundOff) && (
                    <>
                      <div className="mt-2 border-t border-white/10 pt-2" />
                      <Row label="Round Off" value={totals.roundOff} />
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>

          {/* Footer */}
          <div className="text-xs text-white/60 mt-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>Thank you for your business.</div>
              <div className="italic">This is a computer‑generated invoice.</div>
            </div>
          </div>
        </div>

        {/* Print styles */}
        <style>{`
          @media print {
            .invoice-modal { width: 100% !important; max-height: none !important; box-shadow: none !important; border: none !important; }
            .invoice-modal__content { overflow: visible !important; padding: 24px !important; }
            .sticky { position: static !important; }
            button { display: none !important; }
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
}
