

import React from "react";

function MoneyRow({ k, v, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-white" : ""}`}>
      <span>{k}</span>
      <span>₹{Number(v || 0).toFixed(2)}</span>
    </div>
  );
}

/**
 * ProformaSummary (Retailer-side)
 * Read-only view of the distributor's Proforma breakdown.
 *
 * Props:
 * - proforma: object (required)
 * - distributorState: string
 * - retailerState: string
 */
export default function ProformaSummary({ proforma, distributorState, retailerState }) {
  if (!proforma) return null;

  const taxTypeLabel = proforma?.taxType === "IGST"
    ? `IGST (Interstate: ${distributorState || "—"} → ${retailerState || "—"})`
    : `CGST + SGST (Intrastate: ${distributorState || "—"} → ${retailerState || "—"})`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold mb-3">Proforma</h3>
      <div className="text-sm text-white/80 space-y-1">
        <MoneyRow k="Sub‑Total (pre‑charges)" v={proforma?.subTotal} />
        <MoneyRow k="+ Delivery" v={proforma?.orderCharges?.delivery} />
        <MoneyRow k="+ Packing" v={proforma?.orderCharges?.packing} />
        <MoneyRow k="+ Insurance" v={proforma?.orderCharges?.insurance} />
        <MoneyRow k="+ Other" v={proforma?.orderCharges?.other} />
        <MoneyRow k="− Order Discount" v={proforma?.discountTotal} />
        <MoneyRow k="Taxable Base" v={proforma?.taxableBase} bold />
        <div className="flex justify-between">
          <span>Tax Type</span>
          <span>{taxTypeLabel}</span>
        </div>
        {proforma?.taxType === "IGST" ? (
          <MoneyRow k="IGST" v={proforma?.taxBreakup?.igst} />
        ) : (
          <>
            <MoneyRow k="CGST" v={proforma?.taxBreakup?.cgst} />
            <MoneyRow k="SGST" v={proforma?.taxBreakup?.sgst} />
          </>
        )}
        <MoneyRow k="Round Off" v={proforma?.roundOff} />
        <MoneyRow k="Grand Total" v={proforma?.grandTotal} bold />
      </div>
    </div>
  );
}