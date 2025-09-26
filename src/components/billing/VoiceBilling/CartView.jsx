import React, { useMemo } from "react";

/**
 * CartView — polished
 * Presentational cart table used by FastBillingMode/VoiceBilling with parity.
 */
export default function CartView({
  cart = [],
  shadowQtys = {},
  setShadowQtys = () => {},
  discountModes = {},
  setDiscountModes = () => {},
  discountDrafts = {},
  setDiscountDrafts = () => {},
  onQtyChange = () => {},
  onSetDiscount,
  onRemoveLine,
  inventory = [],
}) {
  const lineKeyForRow = (row, idx) =>
    String(
      row?.cartLineId ??
      row?.id ??
      row?.lineId ??
      `${row?.sku || row?.name || "row"}-${idx}`
    );

  const setShadow = (key, val) => setShadowQtys((prev) => ({ ...prev, [key]: val }));
  const setDiscMode = (key, mode) => setDiscountModes((prev) => ({ ...prev, [key]: mode }));
  const setDiscDraft = (key, val) => setDiscountDrafts((prev) => ({ ...prev, [key]: val }));

  const resolveMeta = (row) => {
    if (!row) return {};
    if (row.product && typeof row.product === "object") return row.product;
    const sku = String(row.sku || "").toLowerCase();
    if (sku && Array.isArray(inventory) && inventory.length) {
      const found = inventory.find(p => String(p.sku || "").toLowerCase() === sku);
      if (found) return found;
    }
    const nm = String(row.productName || row.name || "").toLowerCase();
    if (nm && Array.isArray(inventory) && inventory.length) {
      const found = inventory.find(p => String(p.productName || p.name || "").toLowerCase() === nm);
      if (found) return found;
    }
    return {};
  };

  const rows = Array.isArray(cart) ? cart : [];

  const enriched = useMemo(() => {
    return rows.map((row, idx) => {
      const lineKey = lineKeyForRow(row, idx);
      const unitPrice = toNumber(
        (row && row.normalized && row.normalized.unitPriceNet) ??
        row.unitPrice ??
        row.price ??
        row.sellingPrice ??
        row.mrp,
        0
      );
      const qtyBase = toNumber(row.qty ?? row.quantity, 1);
      const qty = toNumber(shadowQtys[lineKey] ?? qtyBase, qtyBase);
      const mode = (discountModes[lineKey] === "amt" || discountModes[lineKey] === "pct")
        ? discountModes[lineKey]
        : inferMode(row);
      const draftStr = discountDrafts[lineKey] ?? draftFromRow(row, mode);
      const draftNum = toNumber(draftStr, 0);
      const discAmt = mode === "amt"
        ? clamp(draftNum, 0, unitPrice * qty)
        : round2((unitPrice * qty) * (clamp(draftNum, 0, 100) / 100));
      const subtotal = round2((unitPrice * qty) - discAmt);

      const meta = resolveMeta(row);
      const displayName =
        row.displayName || row.productName || row.name || meta.productName || meta.name || "—";
      const brand = row.brand || meta.brand || "";
      const unit = row.unit || row.packSize || meta.unit || "";
      const category = row.category || meta.category || "";

      // Pricing mode label (parity with Manual Billing)
      const pMode = (row.pricingMode || "").toUpperCase();
      const modeLabel =
        pMode === "MRP_INCLUSIVE" ? "MRP (incl.)" :
        pMode === "BASE_PLUS_GST"  ? "Base+GST"   :
        pMode === "SELLING_SIMPLE" ? "Selling (net)" : (pMode || "");
      const gstRate = toNumber(row.inlineGstRate ?? row.gstRate ?? (row.normalized && row.normalized.effectiveRate), NaN);

      // --- tax calculations (parity with Manual Billing) ---
      const effectiveGst = Number.isFinite(gstRate) && gstRate > 0 ? gstRate : 0;
      const taxAmount = round2(subtotal * (effectiveGst / 100));
      const useIGST = !!(row.useIGST || row.igst); // heuristic from item if present
      const cgst = useIGST ? 0 : round2(taxAmount / 2);
      const sgst = useIGST ? 0 : round2(taxAmount / 2);
      const igst = useIGST ? taxAmount : 0;
      const grossTotal = round2(subtotal + taxAmount);

      return {
        row, idx, lineKey, unitPrice, qty, mode, draftStr, draftNum, discAmt, subtotal,
        displayName, brand, unit, category, modeLabel, gstRate,
        effectiveGst, taxAmount, cgst, sgst, igst, grossTotal
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, shadowQtys, discountModes, discountDrafts, inventory]);

  const tableSubtotal = useMemo(
    () => round2(enriched.reduce((acc, r) => acc + (r.subtotal || 0), 0)),
    [enriched]
  );

  const tableTaxTotals = useMemo(() => {
    return enriched.reduce(
      (acc, r) => {
        acc.tax += r.taxAmount || 0;
        acc.cgst += r.cgst || 0;
        acc.sgst += r.sgst || 0;
        acc.igst += r.igst || 0;
        acc.gross += r.grossTotal || (r.subtotal || 0);
        return acc;
      },
      { tax: 0, cgst: 0, sgst: 0, igst: 0, gross: 0 }
    );
  }, [enriched]);

  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-neutral-900/70 to-neutral-800/60 shadow-lg shadow-black/30 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="text-sm opacity-70">
          Cart
          <span className="ml-2 inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-[11px] opacity-80">
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="text-xs opacity-70">
          Subtotal: <span className="font-semibold opacity-90">₹{tableSubtotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          {/* Stabilize column widths to avoid layout shifts */}
          <colgroup>
            <col style={{ width: "46%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
            {onRemoveLine ? <col style={{ width: "8%" }} /> : null}
          </colgroup>

          <thead className="sticky top-0 bg-neutral-900/80 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wider opacity-70">
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              {onRemoveLine && <th className="px-3 py-2 text-center">Action</th>}
            </tr>
          </thead>

          <tbody>
            {enriched.map(({ row, lineKey, unitPrice, qty, mode, draftStr, draftNum, subtotal, displayName, brand, unit, category, modeLabel, gstRate, effectiveGst, taxAmount, cgst, sgst, igst, grossTotal }, mapIdx) => {
              const handleQty = (next) => {
                const safeQty = next < 1 ? 1 : next;
                setShadow(lineKey, safeQty);
                onQtyChange({
                  lineKey,
                  cartLineId: row.cartLineId,
                  id: row.id,
                  sku: row.sku,
                  name: row.name,
                  qty: safeQty,
                });
              };

              const handleDiscountModeChange = (e) => {
                const newMode = e.target.value;
                setDiscMode(lineKey, newMode);
                if (!onSetDiscount) return;
                const total = unitPrice * qty;
                const pctFromDraft = clamp(draftNum, 0, 100);
                const amtFromDraft = clamp(draftNum, 0, total);
                const normalizedPct = newMode === "pct"
                  ? pctFromDraft
                  : (total > 0 ? round2((amtFromDraft / total) * 100) : 0);

                if (newMode === "pct") {
                  onSetDiscount({
                    lineKey,
                    cartLineId: row.cartLineId,
                    id: row.id,
                    sku: row.sku,
                    name: row.name,
                    discountPct: pctFromDraft,
                    discountAmt: undefined,
                    discount: normalizedPct,
                  });
                } else {
                  onSetDiscount({
                    lineKey,
                    cartLineId: row.cartLineId,
                    id: row.id,
                    sku: row.sku,
                    name: row.name,
                    discountAmt: amtFromDraft,
                    discountPct: undefined,
                    discount: normalizedPct,
                  });
                }
              };

              const handleDiscountDraftChange = (e) => {
                const val = e.target.value.replace(/[^\d.]/g, "");
                setDiscDraft(lineKey, val);
                const n = Number(val);
                if (!onSetDiscount || !Number.isFinite(n)) return;
                const total = unitPrice * qty;
                if (mode === "pct") {
                  const pct = clamp(n, 0, 100);
                  onSetDiscount({
                    lineKey,
                    cartLineId: row.cartLineId,
                    id: row.id,
                    sku: row.sku,
                    name: row.name,
                    discountPct: pct,
                    discountAmt: undefined,
                    discount: pct,
                  });
                } else {
                  const amt = clamp(n, 0, total);
                  const pct = total > 0 ? round2((amt / total) * 100) : 0;
                  onSetDiscount({
                    lineKey,
                    cartLineId: row.cartLineId,
                    id: row.id,
                    sku: row.sku,
                    name: row.name,
                    discountAmt: amt,
                    discountPct: undefined,
                    discount: pct,
                  });
                }
              };

              const canDec = qty > 1;

              return (
                <tr key={lineKey} className={"border-t border-white/5 transition-colors hover:bg-white/5 " + (mapIdx % 2 ? "bg-white/[0.01]" : "") }>
                  {/* Item */}
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium opacity-90 truncate" title={displayName}>{displayName}</div>

                    {/* meta chips + SKU in one line for compact clarity */}
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {brand ? <span className="text-[11px] opacity-80">{brand}</span> : null}
                      {unit ? <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/10 bg-white/5 opacity-80">{unit}</span> : null}
                      {category ? <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/10 bg-white/5 opacity-70">{category}</span> : null}
                      {modeLabel ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/10 bg-white/5 opacity-70" title="Pricing mode">
                          {modeLabel}
                        </span>
                      ) : null}
                      {Number.isFinite(gstRate) && gstRate > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/10 bg-white/5 opacity-70" title="GST rate applied">
                          GST {gstRate}%
                        </span>
                      ) : null}
                      <span className="text-[11px] opacity-50">•</span>
                      <span className="text-[11px] font-mono opacity-60">{row.sku || row.code || lineKey}</span>
                    </div>
                    {Number.isFinite(gstRate) && gstRate > 0 ? (
                      <div className="w-full text-[10px] opacity-60">
                        {row.useIGST || row.igst ? (
                          <span title="IGST breakdown">IGST {gstRate}% = ₹{(subtotal * (gstRate/100)).toFixed(2)}</span>
                        ) : (
                          <span title="CGST/SGST breakdown">CGST {(gstRate/2).toFixed(1)}% = ₹{(subtotal * (gstRate/200)).toFixed(2)} • SGST {(gstRate/2).toFixed(1)}% = ₹{(subtotal * (gstRate/200)).toFixed(2)}</span>
                        )}
                      </div>
                    ) : null}
                  </td>

                  {/* Price */}
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    ₹{unitPrice.toFixed(2)}
                    {row && row.normalized && typeof row.normalized.unitPriceNet !== "undefined" ? (
                      <span className="ml-1 text-[10px] opacity-60" title="Net unit price (pre-GST)">net</span>
                    ) : null}
                  </td>

                  {/* Qty controls */}
                  <td className="px-3 py-2 align-top">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className={`w-7 h-7 rounded-md border border-white/10 bg-neutral-800/70 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white/20 ${!canDec ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() => canDec && handleQty(qty - 1)}
                        aria-label="Decrease quantity"
                        aria-disabled={!canDec}
                        title="Decrease"
                      >
                        −
                      </button>
                      <input
                        className="w-14 text-center px-2 py-1 rounded-md bg-neutral-800/70 border border-white/10 outline-none focus:ring-2 focus:ring-white/20"
                        value={String(qty)}
                        onChange={(e) => {
                          const val = e.target.value;
                          const n = Number(val);
                          if (Number.isFinite(n)) handleQty(n);
                          else setShadow(lineKey, val);
                        }}
                        inputMode="numeric"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        className="w-7 h-7 rounded-md border border-white/10 bg-neutral-800/70 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white/20"
                        onClick={() => handleQty(qty + 1)}
                        aria-label="Increase quantity"
                        title="Increase"
                      >
                        +
                      </button>
                    </div>
                  </td>

                  {/* Discount */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1 rounded-md bg-neutral-800/70 border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-white/20"
                        value={mode}
                        onChange={handleDiscountModeChange}
                        aria-label="Discount type"
                        title="Choose discount type"
                      >
                        <option value="pct">% off</option>
                        <option value="amt">₹ off</option>
                      </select>
                      <div className="relative">
                        <input
                          className="w-24 pr-7 px-2 py-1 rounded-md bg-neutral-800/70 border border-white/10 text-right focus:outline-none focus:ring-2 focus:ring-white/20"
                          inputMode="decimal"
                          value={draftStr}
                          onChange={handleDiscountDraftChange}
                          placeholder={mode === "pct" ? "0–100" : "₹"}
                          aria-label="Discount value"
                          title="Enter discount"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs opacity-60">
                          {mode === "pct" ? "%" : "₹"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Subtotal */}
                  <td className="px-3 py-2 align-top text-right whitespace-nowrap font-medium">₹{subtotal.toFixed(2)}</td>

                  {/* Remove button */}
                  {onRemoveLine && (
                    <td className="px-3 py-2 align-top text-center">
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-400 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded-md px-2 py-1"
                        onClick={() => onRemoveLine(row)}
                        aria-label="Remove line"
                        title="Remove this item"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-xs opacity-60" colSpan={onRemoveLine ? 6 : 5}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-sm">Cart is empty</div>
                    <div className="text-[11px] opacity-70">
                      Try saying: <span className="font-mono">“add 2 dairy milk 56g”</span>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-neutral-900/80 backdrop-blur">
              <tr>
                <td className="px-3 py-2 text-xs opacity-70" colSpan={3}>Live cart subtotal</td>
                <td className="px-3 py-2 text-right text-xs opacity-70">
                  {rows.length} line{rows.length === 1 ? "" : "s"}
                </td>
                <td className="px-3 py-2 text-right font-semibold">₹{tableSubtotal.toFixed(2)}</td>
                {onRemoveLine && <td />}
              </tr>
              <tr>
                <td className="px-3 py-2 text-xs opacity-70" colSpan={3}>Est. tax (items)</td>
                <td className="px-3 py-2 text-right text-xs opacity-70">CGST: ₹{round2(tableTaxTotals.cgst).toFixed(2)} • SGST: ₹{round2(tableTaxTotals.sgst).toFixed(2)}{tableTaxTotals.igst > 0 ? ` • IGST: ₹${round2(tableTaxTotals.igst).toFixed(2)}` : ""}</td>
                <td className="px-3 py-2 text-right font-semibold">₹{round2(tableTaxTotals.tax).toFixed(2)}</td>
                {onRemoveLine && <td />}
              </tr>
              <tr>
                <td className="px-3 py-2 text-xs opacity-70" colSpan={4}>Grand total</td>
                <td className="px-3 py-2 text-right font-semibold">₹{round2(tableTaxTotals.gross).toFixed(2)}</td>
                {onRemoveLine && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// -------- helpers (pure, local to this file) --------
export function toNumber(v, d = 0) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : d;
}
export function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }
export function inferMode(row) {
  const hasPct = toNumber(row.discountPct, NaN);
  const hasAmt = toNumber(row.discountAmt, NaN);
  const unified = toNumber(row.discount, NaN);
  if (Number.isFinite(hasPct) && hasPct > 0) return "pct";
  if (Number.isFinite(unified) && unified > 0) return "pct";
  if (Number.isFinite(hasAmt) && hasAmt > 0) return "amt";
  return "pct";
}
export function draftFromRow(row, mode) {
  if (mode === "amt") return String(row.discountAmt ?? "");
  return String((row.discountPct ?? row.discount) ?? "");
}