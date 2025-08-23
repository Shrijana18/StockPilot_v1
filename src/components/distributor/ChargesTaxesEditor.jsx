import React, { useMemo, useState } from "react";
import { getFirestore, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { calculateProforma } from "../../lib/calcProforma";
import { ORDER_STATUSES } from "../../constants/orderStatus";
import { toast } from "react-toastify";

// --- utils: sanitize before Firestore writes ---
function sanitizeForFirestore(value) {
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue; // strip undefined
      if (typeof v === "number" && Number.isNaN(v)) {
        out[k] = 0;
        continue;
      }
      out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  if (typeof value === "number" && Number.isNaN(value)) return 0;
  return value;
}

/**
 * ChargesTaxesEditor
 * Distributor-side editor to apply line-level discounts, GST rates,
 * order-level charges/discounts, choose rounding, and generate a Proforma.
 *
 * Props:
 * - orderId: string
 * - distributorId: string
 * - retailerId: string
 * - order: object (the order doc data)
 * - distributorState: string
 * - retailerState: string
 * - onSaved?: function
 */
export default function ChargesTaxesEditor({
  orderId,
  distributorId,
  retailerId,
  order,
  distributorState,
  retailerState,
  onSaved,
}) {
  const db = getFirestore();

  // Normalize initial lines from order.items
  const initialLines = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.map((it) => ({
      name: it.productName || it.name || "Item",
      sku: it.sku,
      hsn: it.hsn,
      uom: it.uom || it.unit,
      qty: Number(it.quantity ?? it.qty ?? 0),
      price: Number(it.unitPrice ?? it.price ?? 0),
      itemDiscountPct: Number(it.itemDiscountPct ?? 0),
      gstRate: Number(it.gstRate ?? 0), // editable per line
    }));
  }, [order]);

  const [lines, setLines] = useState(initialLines);
  const [orderCharges, setOrderCharges] = useState({
    delivery: 0,
    packing: 0,
    insurance: 0,
    other: 0,
    discountPct: 0,
    discountAmt: 0,
  });
  const [rounding, setRounding] = useState("NEAREST"); // NEAREST | UP | DOWN
  const [saving, setSaving] = useState(false);

  const preview = useMemo(
    () =>
      calculateProforma({
        lines,
        orderCharges,
        distributorState,
        retailerState,
        rounding,
      }),
    [lines, orderCharges, distributorState, retailerState, rounding]
  );

  const taxTypeLabel = useMemo(() => {
    const from = (distributorState || "—").toString();
    const to = (retailerState || "—").toString();
    return preview.taxType === "IGST"
      ? `IGST (Interstate: ${from} → ${to})`
      : `CGST + SGST (Intrastate: ${from} → ${to})`;
  }, [preview.taxType, distributorState, retailerState]);

  function updateLine(index, field, value) {
    setLines((prev) => {
      const next = [...prev];
      const n = { ...next[index] };
      if (["qty", "price", "itemDiscountPct", "gstRate"].includes(field)) {
        let num = Number(value || 0);
        if (!Number.isFinite(num)) num = 0;
        if (field === "qty" || field === "price") {
          num = Math.max(0, num);
        }
        if (field === "itemDiscountPct") {
          num = Math.min(100, Math.max(0, num));
        }
        if (field === "gstRate") {
          num = Math.min(28, Math.max(0, num));
        }
        n[field] = num;
      } else {
        n[field] = value;
      }
      next[index] = n;
      return next;
    });
  }

  function updateCharge(field, value) {
    let num = Number(value || 0);
    if (!Number.isFinite(num)) num = 0;
    num = Math.max(0, num);
    setOrderCharges((prev) => ({ ...prev, [field]: num }));
  }

  async function handleGenerateProforma() {
    // 0) Guard: empty or zero-qty cart
    const hasQty = Array.isArray(lines) && lines.some((l) => Number(l.qty) > 0);
    if (!hasQty) {
      toast.error("Add at least one item with quantity > 0 before generating a proforma.");
      return;
    }

    // 1) Soft warning if POS states are missing (affects IGST vs CGST/SGST)
    if (!distributorState || !retailerState) {
      toast.warn(
        "Missing state info for POS. Tax type may be incorrect (IGST vs CGST/SGST).",
        { autoClose: 3500 }
      );
    }

    // 2) Confirm overwrite if a proforma already exists
    if (order?.proforma) {
      const ok = window.confirm("A proforma already exists for this order. Overwrite it?");
      if (!ok) return;
    }

    setSaving(true);
    try {
      // sanitize preview to avoid undefined/NaN
      const cleanPreview = sanitizeForFirestore(preview);
      const proforma = {
        ...cleanPreview,
        date: serverTimestamp(),
        version: 1,
      };

      // Distributor copy
      const distDoc = doc(db, `businesses/${distributorId}/orderRequests/${orderId}`);
      await updateDoc(distDoc, {
        proforma,
        statusCode: ORDER_STATUSES.QUOTED,
        status: "Quoted", // legacy support if UI relies on this
        updatedAt: serverTimestamp(),
      });

      // Retailer mirror copy
      const retDoc = doc(db, `businesses/${retailerId}/sentOrders/${orderId}`);
      await updateDoc(retDoc, {
        proforma,
        statusCode: ORDER_STATUSES.QUOTED,
        status: "Quoted",
        updatedAt: serverTimestamp(),
      });

      toast.success("Proforma generated and shared with retailer.");
      onSaved && onSaved(proforma);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate proforma. Check console for details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold mb-3">Line Items (Distributor View)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-white/80">
                <th className="text-left p-2">Item</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Price</th>
                <th className="text-right p-2">Disc %</th>
                <th className="text-right p-2">GST %</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx} className="border-t border-white/10">
                  <td className="p-2 text-white/90">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-white/60">
                      {l.sku || ""} {l.hsn ? `• HSN ${l.hsn}` : ""}
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-24 rounded bg-white/10 text-white px-2 py-1"
                      value={l.qty}
                      onChange={(e) => updateLine(idx, "qty", e.target.value)}
                      min="0"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-28 rounded bg-white/10 text-white px-2 py-1"
                      value={l.price}
                      onChange={(e) => updateLine(idx, "price", e.target.value)}
                      min="0"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-24 rounded bg-white/10 text-white px-2 py-1"
                      value={l.itemDiscountPct}
                      onChange={(e) => updateLine(idx, "itemDiscountPct", e.target.value)}
                      min="0"
                      max="100"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      className="w-24 rounded bg-white/10 text-white px-2 py-1"
                      value={l.gstRate}
                      onChange={(e) => updateLine(idx, "gstRate", e.target.value)}
                      min="0"
                      max="28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-white font-semibold mb-3">Order-level Charges & Discount</h3>
          <div className="grid grid-cols-2 gap-3">
            <LabeledNumber label="Delivery" value={orderCharges.delivery} onChange={(v) => updateCharge("delivery", v)} />
            <LabeledNumber label="Packing" value={orderCharges.packing} onChange={(v) => updateCharge("packing", v)} />
            <LabeledNumber label="Insurance" value={orderCharges.insurance} onChange={(v) => updateCharge("insurance", v)} />
            <LabeledNumber label="Other" value={orderCharges.other} onChange={(v) => updateCharge("other", v)} />
            <LabeledNumber label="Discount %" value={orderCharges.discountPct} onChange={(v) => updateCharge("discountPct", v)} />
            <LabeledNumber label="Discount ₹" value={orderCharges.discountAmt} onChange={(v) => updateCharge("discountAmt", v)} />
          </div>

          <div className="mt-3">
            <label className="block text-white/90 text-sm mb-1">Rounding</label>
            <select
              value={rounding}
              onChange={(e) => setRounding(e.target.value)}
              className="rounded bg-white/10 text-white px-2 py-1"
            >
              <option value="NEAREST">Nearest</option>
              <option value="UP">Up</option>
              <option value="DOWN">Down</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-white font-semibold mb-3">Proforma Preview</h3>
          <div className="text-sm text-white/80 space-y-1">
            <Row k="Sub‑Total (pre‑charges)" v={preview.subTotal} />
            <Row k="+ Delivery" v={preview.orderCharges.delivery} />
            <Row k="+ Packing" v={preview.orderCharges.packing} />
            <Row k="+ Insurance" v={preview.orderCharges.insurance} />
            <Row k="+ Other" v={preview.orderCharges.other} />
            <Row k="− Order Discount" v={preview.discountTotal} />
            <Row k="Taxable Base" v={preview.taxableBase} bold />
            {/* Tax Type as TEXT, not money */}
            <div className="flex justify-between">
              <span>Tax Type</span>
              <span>{taxTypeLabel}</span>
            </div>
            {preview.taxType === "IGST" ? (
              <Row k={"IGST"} v={preview.taxBreakup.igst} />
            ) : (
              <>
                <Row k={"CGST"} v={preview.taxBreakup.cgst} />
                <Row k={"SGST"} v={preview.taxBreakup.sgst} />
              </>
            )}
            <Row k={"Round Off"} v={preview.roundOff} />
            <Row k={"Grand Total"} v={preview.grandTotal} bold />
          </div>

          <button
            onClick={handleGenerateProforma}
            disabled={saving}
            className={`mt-4 w-full md:w-auto rounded-lg px-4 py-2 font-semibold text-white ${
              saving ? "bg-emerald-500/60 cursor-not-allowed" : "bg-emerald-500/90 hover:bg-emerald-500"
            }`}
          >
            {saving ? "Saving..." : "Generate Proforma"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-white" : ""}`}>
      <span>{k}</span>
      <span>₹{Number(v || 0).toFixed(2)}</span>
    </div>
  );
}

function LabeledNumber({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-white/90 text-sm mb-1">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded bg-white/10 text-white px-2 py-1"
        min="0"
        step="0.01"
      />
    </label>
  );
}