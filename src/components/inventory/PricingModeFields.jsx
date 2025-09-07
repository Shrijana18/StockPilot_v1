// src/components/inventory/PricingModeFields.jsx
import { useMemo } from "react";
import { PRICING_MODES, splitFromMrp } from "../../utils/pricing";
import { suggestGst } from "../../utils/gstMaster";

/**
 * Tiny pricing mode UI used by Manual/OCR/AI forms.
 *
 * Props:
 *  - mode: "LEGACY" | "MRP_INCLUSIVE" | "BASE_PLUS_TAX"
 *  - setMode: (m) => void
 *  - values: { mrp, basePrice, taxRate, legacySellingPrice }
 *  - onChange: (patch) => void
 */
export default function PricingModeFields({ mode, setMode, values, onChange, productName, category }) {
  // local safe number coercion
  const num = (v) => (Number(v) || 0);

  const mrp = num(values?.mrp);
  const basePrice = num(values?.basePrice);
  const taxRate = num(values?.taxRate);
  const legacySellingPrice = values?.legacySellingPrice === "" ? "" : num(values?.legacySellingPrice);

  const mrpSplit = useMemo(() => {
    if (mode !== PRICING_MODES.MRP_INCLUSIVE || !mrp) return null;
    return splitFromMrp(mrp, taxRate || 0);
  }, [mode, mrp, taxRate]);

  const modes = [
    { key: PRICING_MODES.LEGACY, label: "Simple" },
    { key: PRICING_MODES.MRP_INCLUSIVE, label: "MRP (incl. GST)" },
    { key: PRICING_MODES.BASE_PLUS_TAX, label: "Base + GST" },
  ];

  return (
    <div className="space-y-3">
      {/* Mode Switch */}
      <div className="flex flex-wrap gap-2">
        {modes.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMode(opt.key)}
            className={`px-3 py-1 rounded-md border text-sm transition
              ${mode === opt.key ? "bg-emerald-600/20 border-emerald-500" : "border-zinc-600 hover:border-zinc-500"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Fields per mode */}
      {mode === PRICING_MODES.LEGACY && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-zinc-400">Selling Price (Final)</label>
            <input
              type="number"
              inputMode="decimal"
              value={legacySellingPrice ?? ""}
              onChange={(e) =>
                onChange({
                  legacySellingPrice: e.target.value === "" ? "" : +e.target.value,
                })
              }
              className="w-full mt-1 rounded-md bg-zinc-800 border border-zinc-600 px-3 py-2"
              placeholder="e.g., 118.00"
            />
          </div>
        </div>
      )}

      {mode === PRICING_MODES.MRP_INCLUSIVE && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400">MRP (incl. GST)</label>
              <input
                type="number"
                inputMode="decimal"
                value={values?.mrp ?? ""}
                onChange={(e) => onChange({ mrp: e.target.value === "" ? "" : +e.target.value })}
                className="w-full mt-1 rounded-md bg-zinc-800 border border-zinc-600 px-3 py-2"
                placeholder="e.g., 118.00"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400">GST % <span className="text-zinc-500">(optional)</span></label>
                <button
                  type="button"
                  onClick={() => {
                    const s = suggestGst({ name: productName, category });
                    if (s) {
                      onChange({ taxRate: s.rate, hsnCode: s.hsn, taxSource: s.source, taxConfidence: s.confidence });
                    }
                  }}
                  className="text-xs px-2 py-1 rounded border border-zinc-600 hover:border-zinc-500"
                  title="Try to guess GST % from product/category"
                >
                  Suggest GST
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={values?.taxRate ?? ""}
                onChange={(e) => onChange({ taxRate: e.target.value === "" ? "" : +e.target.value })}
                className="w-full mt-1 rounded-md bg-zinc-800 border border-zinc-600 px-3 py-2"
                placeholder="e.g., 5, 12, 18"
              />
              {(values?.hsnCode || values?.taxSource) && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  {values?.taxSource === "keyword_suggested" ? "Suggested" : "Provided"} HSN: {values?.hsnCode || "—"}
                </div>
              )}
            </div>
          </div>

          {mrpSplit && (
            <div className="text-xs text-zinc-400">
              Split preview: Base ₹{mrpSplit.base.toFixed(2)} + GST ₹{mrpSplit.tax.toFixed(2)} = ₹{mrp.toFixed(2)}
            </div>
          )}
        </>
      )}

      {mode === PRICING_MODES.BASE_PLUS_TAX && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Unit/Base Price (excl. GST)</label>
              <input
                type="number"
                inputMode="decimal"
                value={values?.basePrice ?? ""}
                onChange={(e) => onChange({ basePrice: e.target.value === "" ? "" : +e.target.value })}
                className="w-full mt-1 rounded-md bg-zinc-800 border border-zinc-600 px-3 py-2"
                placeholder="e.g., 100.00"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400">GST % <span className="text-zinc-500">(optional)</span></label>
                <button
                  type="button"
                  onClick={() => {
                    const s = suggestGst({ name: productName, category });
                    if (s) {
                      onChange({ taxRate: s.rate, hsnCode: s.hsn, taxSource: s.source, taxConfidence: s.confidence });
                    }
                  }}
                  className="text-xs px-2 py-1 rounded border border-zinc-600 hover:border-zinc-500"
                  title="Try to guess GST % from product/category"
                >
                  Suggest GST
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={values?.taxRate ?? ""}
                onChange={(e) => onChange({ taxRate: e.target.value === "" ? "" : +e.target.value })}
                className="w-full mt-1 rounded-md bg-zinc-800 border border-zinc-600 px-3 py-2"
                placeholder="e.g., 5, 12, 18"
              />
              {(values?.hsnCode || values?.taxSource) && (
                <div className="mt-1 text-[11px] text-zinc-500">
                  {values?.taxSource === "keyword_suggested" ? "Suggested" : "Provided"} HSN: {values?.hsnCode || "—"}
                </div>
              )}
            </div>
          </div>

          {basePrice > 0 && (
            <div className="text-xs text-zinc-400">
              Final preview: ₹{(basePrice + (basePrice * (taxRate || 0)) / 100).toFixed(2)}{" "}
              (Base ₹{basePrice.toFixed(2)} + GST ₹{((basePrice * (taxRate || 0)) / 100).toFixed(2)})
            </div>
          )}
        </>
      )}
    </div>
  );
}