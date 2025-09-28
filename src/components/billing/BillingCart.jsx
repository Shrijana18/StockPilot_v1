import React, { useState, useEffect } from "react";
import { normalizeUnit } from "./pricingUtils";

const BillingCart = ({ selectedProducts = [], cartItems: cartItemsProp, onUpdateCart, settings }) => {
  const [cartItems, setCartItems] = useState([]);
  const isControlled = Array.isArray(cartItemsProp);
  const items = isControlled ? cartItemsProp : cartItems;
  const [expanded, setExpanded] = useState({});
  const toggleRow = (i) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  // Compute line gross after discount using legal GST logic
  const computeLineGrossAfterDiscount = (it) => {
    const qty = Math.max(0, parseFloat(it.quantity) || 0);
    const discPct = Math.max(0, Math.min(100, parseFloat(it.discount) || 0));

    // Fallbacks
    const priceGross = Math.max(0, parseFloat(it.price) || 0);

    // If we have normalized snapshot, apply discount on base (net), then recompute GST
    if (it?.normalized && (it.pricingMode === "MRP_INCLUSIVE" || it.pricingMode === "BASE_PLUS_GST")) {
      const net = Math.max(0, parseFloat(it.normalized.unitPriceNet) || 0); // base per unit
      const taxPerUnit = Math.max(0, parseFloat(it.normalized.taxPerUnit) || 0);
      const r = net > 0 ? taxPerUnit / net : 0; // gstRate as ratio

      const netAfterDisc = net * (1 - discPct / 100);
      const grossAfterDisc = netAfterDisc * (1 + r);
      return (grossAfterDisc * qty);
    }

    // SELLING_SIMPLE / LEGACY path: price is NET; add inline GST on top
    if (it.pricingMode === "SELLING_SIMPLE" || it.pricingMode === "LEGACY") {
      const net = Math.max(0, parseFloat(it.price) || 0);
      const r = Math.max(0, parseFloat(it.inlineGstRate ?? it.gstRate ?? 0)) / 100;
      const netAfterDisc = net * (1 - discPct / 100);
      const grossAfterDisc = netAfterDisc * (1 + r);
      return grossAfterDisc * qty;
    }

    // SELLING_SIMPLE or no normalized snapshot (treated as gross)
    const discounted = priceGross - (priceGross * discPct) / 100;
    return discounted * qty;
  };

  // Extract all tax-related values including SGST
  const {
    includeGST,
    gstRate,
    enableCGST,
    enableSGST,
    enableIGST,
    includeCGST,
    includeSGST,
    includeIGST,
    cgstRate,
    sgstRate,
    igstRate,
  } = settings || {};

  // Compute Delivery/Packaging/Insurance/Other (backward compatible)
  const computeExtrasCharges = (subtotal, s = settings || {}) => {
    const ex = s.extras || {};

    // legacy fields kept for compatibility
    const legacyDelivery = parseFloat(s.deliveryCharge) || 0;
    const legacyPacking  = parseFloat(s.packingCharge)  || 0;
    const legacyOther    = parseFloat(s.otherCharge)    || 0;

    const deliveryFee   = parseFloat(ex.deliveryFee)   || 0;
    const packagingFee  = parseFloat(ex.packagingFee)  || 0;

    let insuranceAmt = 0;
    const type = ex.insuranceType || 'none';
    const val  = parseFloat(ex.insuranceValue) || 0;
    if (type === 'flat')    insuranceAmt = val;
    if (type === 'percent') insuranceAmt = subtotal * (val / 100);

    const delivery  = legacyDelivery + deliveryFee;
    const packaging = legacyPacking  + packagingFee;
    const other     = legacyOther;

    const total = delivery + packaging + insuranceAmt + other;
    return { delivery, packaging, insurance: insuranceAmt, other, total, insuranceMeta: { type, val } };
  };

  // Reusable totals calculator: computes subtotal, tax breakdown, extras, and final total
  const computeCartTotals = (list = items, s = settings) => {
    const sub = list.reduce((sum, it) => sum + computeLineGrossAfterDiscount(it), 0);
    const taxBreakdown = {
      gst:  (s?.includeGST  && s?.gstRate)  ? (sub * s.gstRate)  / 100 : 0,
      cgst: (s?.includeCGST && s?.cgstRate) ? (sub * s.cgstRate) / 100 : 0,
      sgst: (s?.includeSGST && s?.sgstRate) ? (sub * s.sgstRate) / 100 : 0,
      igst: (s?.includeIGST && s?.igstRate) ? (sub * s.igstRate) / 100 : 0,
    };
    const extrasTotals = computeExtrasCharges(sub, s);
    const finalTotalCalc = sub + taxBreakdown.gst + taxBreakdown.cgst + taxBreakdown.sgst + taxBreakdown.igst + extrasTotals.total;
    return { subtotal: sub, taxBreakdown, extras: extrasTotals, finalTotal: finalTotalCalc };
  };

  const pushUpdate = (next) => {
    if (onUpdateCart) {
      const totals = computeCartTotals(next, settings);
      onUpdateCart(next, totals);
    }
    if (!isControlled) setCartItems(next);
  };
  // Emit totals when settings (extras/taxes) change, even if items don't change
  useEffect(() => {
    if (!onUpdateCart) return;
    const totals = computeCartTotals(items, settings);
    onUpdateCart(items, totals);
  }, [
    // Extras (new settings)
    settings?.extras?.deliveryFee,
    settings?.extras?.packagingFee,
    settings?.extras?.insuranceType,
    settings?.extras?.insuranceValue,
    settings?.deliveryCharge,
    settings?.packingCharge,
    settings?.otherCharge,
    // Tax toggles and rates
    settings?.includeGST,
    settings?.includeCGST,
    settings?.includeSGST,
    settings?.includeIGST,
    settings?.gstRate,
    settings?.cgstRate,
    settings?.sgstRate,
    settings?.igstRate,
  ]);

  const handleAddItem = () => {
    const next = [
      ...items,
      { id: "manual", name: "", sku: "", brand: "", category: "", unit: "", quantity: 1, price: 0, discount: 0 },
    ];
    pushUpdate(next);
  };

  const handleChange = (index, field, value) => {
    const next = [...items];
    let v = value;
    if (field === "quantity" || field === "price" || field === "discount" || field === "inlineGstRate") {
      v = parseFloat(value);
      if (Number.isNaN(v)) v = 0;
      if (field === "discount") v = Math.max(0, Math.min(100, v));
      if (field === "inlineGstRate") v = Math.max(0, Math.min(100, v));
    }
    next[index] = { ...next[index], [field]: v };
    pushUpdate(next);
  };

  const handleRemove = (index) => {
    const next = items.filter((_, i) => i !== index);
    pushUpdate(next);
  };

  const calculateSubtotal = (item) => {
    const line = computeLineGrossAfterDiscount(item);
    return (Math.round(line * 100) / 100).toFixed(2);
  };

  const subtotal = items.reduce((sum, item) => sum + computeLineGrossAfterDiscount(item), 0);
  const extras = computeExtrasCharges(subtotal, settings);

  // GST, CGST, SGST, IGST calculation (Firestore-driven)
  const gstAmount =
    (includeGST && gstRate ? (subtotal * gstRate) / 100 : 0) +
    (includeCGST && cgstRate ? (subtotal * cgstRate) / 100 : 0) +
    (includeSGST && sgstRate ? (subtotal * sgstRate) / 100 : 0) +
    (includeIGST && igstRate ? (subtotal * igstRate) / 100 : 0);

  const finalTotal = subtotal + gstAmount + extras.total;

  useEffect(() => {
    if (!selectedProducts || selectedProducts.length === 0) return;
    // When using controlled mode, dedupe against the controlled list; otherwise use local state
    const base = items;
    const newItems = selectedProducts
      .filter((product) => !base.some((it) => (it.id && product.id && it.id === product.id) || (it.sku === (product.sku || ""))))
      .map((product) => {
        // Treat LEGACY as a Selling Price (net) flow unless MRP exists
        const mode = (!product.pricingMode || product.pricingMode === "LEGACY")
          ? (product.mrp ? "MRP_INCLUSIVE" : "SELLING_SIMPLE")
          : product.pricingMode;

        const unitNorm = normalizeUnit({
          pricingMode: mode,
          gstRate: (product.gstRate ?? product.taxRate ?? settings?.gstRate ?? 0),
          hsnCode: product.hsnCode,
          sellingPrice: product.sellingPrice ?? product.price ?? product.mrp ?? 0,
          // For Selling Price and Base+GST, price is net (exclusive). Only MRP is inclusive.
          sellingIncludesGst: (mode === "SELLING_SIMPLE" || mode === "BASE_PLUS_GST") ? false : true,
          mrp: product.mrp,
          basePrice: product.basePrice,
        });

        return {
          id: product.id,
          name: product.name || product.productName || "",
          sku: product.sku || "",
          brand: product.brand || "",
          category: product.category || "",
          unit: product.unit || "",
          quantity: 1,
          // Final selling price shown in cart (gross)
          price: Number(unitNorm.unitPriceGross) || 0,
          discount: 0,
          pricingMode: mode,
          gstRate: (product.gstRate ?? product.taxRate ?? settings?.gstRate ?? 0),
          inlineGstRate: (product.gstRate ?? product.taxRate ?? settings?.gstRate ?? 0),
          hsnCode: product.hsnCode || "",
          normalized: unitNorm,
          sourceFields: {
            sellingPrice: product.sellingPrice ?? null,
            sellingIncludesGst: product.sellingIncludesGst ?? true,
            mrp: product.mrp ?? null,
            basePrice: product.basePrice ?? null,
          },
        };
      });
    if (newItems.length > 0) {
      pushUpdate([...base, ...newItems]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducts]);

  useEffect(() => {
    // Keep console log for debugging current rendered items
    console.log("Rendered Items (source-of-truth):", items);
    // When controlled, updates are pushed synchronously through handlers; nothing to do here
  }, [items]);

  // Local CSS to hide number input spinners for fields we mark with .no-spin
  const NoSpinStyles = () => (
    <style>{`
      input[type=number].no-spin::-webkit-outer-spin-button,
      input[type=number].no-spin::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type=number].no-spin {
        -moz-appearance: textfield;
      }
    `}</style>
  );

  return (
    <div className="space-y-6 px-4 pt-4 md:px-6 text-white">
      <NoSpinStyles />
      <div className="space-y-4">
        <button
          onClick={handleAddItem}
          className="px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition"
        >
          + Add Item
        </button>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden">
            <thead className="text-left bg-white/10">
              <tr>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Product</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Qty</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Selling</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Discount (%)</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Subtotal</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <React.Fragment key={index}>
                  <tr key={index} className="border-t border-white/10 hover:bg-white/5">
                    {/* Product (name + expand) */}
                    <td className="p-2 align-top">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRow(index)}
                          className="mt-1 w-6 h-6 rounded-full bg-white/10 border border-white/20 text-white/80 flex items-center justify-center hover:bg-white/20"
                          aria-label={expanded[index] ? "Hide details" : "Show details"}
                          title={expanded[index] ? "Hide details" : "Show details"}
                        >
                          {expanded[index] ? "−" : "+"}
                        </button>
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={item.name || ""}
                            onChange={(e) => handleChange(index, "name", e.target.value)}
                            placeholder="Product name"
                            className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          />
                          {/* small hint line when collapsed */}
                          {!expanded[index] && (
                            <div className="text-[11px] text-white/50">
                              {item.sku ? `SKU: ${item.sku}` : ""}
                              {item.brand ? (item.sku ? " • " : "") + `Brand: ${item.brand}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="p-2 align-top">
                      <input
                        type="number"
                        value={item.quantity || 0}
                        onChange={(e) => handleChange(index, "quantity", e.target.value)}
                        className="w-16 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    </td>

                    {/* Selling (gross) */}
                    <td className="p-2 align-top">
                      <div className="text-sm font-semibold">
                        {(() => {
                          const normGross = items[index]?.normalized?.unitPriceGross;
                          if (typeof normGross === "number") return `₹${normGross.toFixed(2)}`;
                          const base = Math.max(0, parseFloat(items[index]?.normalized?.unitPriceNet ?? item.price ?? 0));
                          const ratePct = (item.pricingMode === "SELLING_SIMPLE" || item.pricingMode === "LEGACY")
                            ? Math.max(0, parseFloat(item.inlineGstRate ?? item.gstRate ?? 0))
                            : (items[index]?.normalized?.unitPriceNet ? ((items[index].normalized.taxPerUnit / Math.max(1e-9, items[index].normalized.unitPriceNet)) * 100) : 0);
                          const gross = base * (1 + ratePct / 100);
                          return `₹${gross.toFixed(2)}`;
                        })()}
                      </div>
                      <div className="text-[11px] text-white/50">
                        {item.pricingMode === "MRP_INCLUSIVE" ? "MRP (incl. GST)" : item.pricingMode === "BASE_PLUS_GST" ? "Base + GST" : "Selling + GST"}
                      </div>
                      {(!item.id || item.id === "manual") && (
                        <div className="pt-2">
                          <label className="text-[11px] text-white/60 block mb-1">Price (net)</label>
                          <input
                            type="number"
                            className="no-spin w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            value={item.price || 0}
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            onFocus={(e) => e.target.select()}
                            onWheel={(e) => e.currentTarget.blur()}
                            onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); } }}
                            onChange={(e) => handleChange(index, "price", e.target.value)}
                          />
                        </div>
                      )}
                    </td>

                    {/* Discount */}
                    <td className="p-2 align-top">
                      <input
                        type="number"
                        value={item.discount || 0}
                        onChange={(e) => handleChange(index, "discount", e.target.value)}
                        className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      />
                    </td>

                    {/* Subtotal */}
                    <td className="p-2 md:p-3 text-white/90 align-top">{calculateSubtotal(item)}</td>

                    {/* Action */}
                    <td className="p-2 align-top">
                      <button
                        onClick={() => handleRemove(index)}
                        className="text-rose-300 hover:text-rose-200 underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>

                  {/* Details row */}
                  {expanded[index] && (
                    <tr className="border-t border-white/10 bg-white/5">
                      <td colSpan={6} className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {/* Identity details */}
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={item.sku || ""}
                                onChange={(e) => handleChange(index, "sku", e.target.value)}
                                placeholder="SKU"
                                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                              <input
                                type="text"
                                value={item.brand || ""}
                                onChange={(e) => handleChange(index, "brand", e.target.value)}
                                placeholder="Brand"
                                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                              <input
                                type="text"
                                value={item.category || ""}
                                onChange={(e) => handleChange(index, "category", e.target.value)}
                                placeholder="Category"
                                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                              <input
                                type="text"
                                value={item.unit || ""}
                                onChange={(e) => handleChange(index, "unit", e.target.value)}
                                placeholder="Unit"
                                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          {/* Price breakdown */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-white/70">Base</span>
                              <span className="font-medium">
                                {(() => {
                                  const net = items[index]?.normalized?.unitPriceNet;
                                  if (typeof net === "number") return `₹${net.toFixed(2)}`;
                                  const base = Math.max(0, parseFloat(item.price) || 0);
                                  return `₹${base.toFixed(2)}`;
                                })()}
                              </span>
                            </div>

                            {/* GST % (editable for Selling/Legacy) */}
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-white/70">GST %</span>
                              {(item.pricingMode === "SELLING_SIMPLE" || item.pricingMode === "LEGACY") ? (
                                <input
                                  type="number"
                                  className="no-spin w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-right"
                                  value={item.inlineGstRate ?? item.gstRate ?? 0}
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  inputMode="decimal"
                                  onFocus={(e) => e.target.select()}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); } }}
                                  onChange={(e) => handleChange(index, "inlineGstRate", e.target.value)}
                                />
                              ) : (
                                <span className="font-medium">
                                  {(() => {
                                    const net = items[index]?.normalized?.unitPriceNet ?? 0;
                                    const tax = items[index]?.normalized?.taxPerUnit ?? 0;
                                    const r = net > 0 ? (tax / net) * 100 : 0;
                                    return `${r.toFixed(0)}%`;
                                  })()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="text-white/70">GST ₹</span>
                              <span className="font-medium">
                                {(() => {
                                  const net = items[index]?.normalized?.unitPriceNet;
                                  const tax = items[index]?.normalized?.taxPerUnit;
                                  if (typeof net === "number" && typeof tax === "number") return `₹${tax.toFixed(2)}`;
                                  const base = Math.max(0, parseFloat(item.price) || 0);
                                  const r = Math.max(0, parseFloat(item.inlineGstRate ?? item.gstRate ?? 0)) / 100;
                                  return `₹${(base * r).toFixed(2)}`;
                                })()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                              <span className="text-white/70">Selling</span>
                              <span className="font-semibold">
                                {(() => {
                                  const normGross = items[index]?.normalized?.unitPriceGross;
                                  if (typeof normGross === "number") return `₹${normGross.toFixed(2)}`;
                                  const base = Math.max(0, parseFloat(item.price) || 0);
                                  const r = Math.max(0, parseFloat(item.inlineGstRate ?? item.gstRate ?? 0)) / 100;
                                  return `₹${(base * (1 + r)).toFixed(2)}`;
                                })()}
                              </span>
                            </div>
                            <div className="text-[11px] text-white/50">
                              {item.pricingMode === "MRP_INCLUSIVE" ? "MRP (incl. GST)" : item.pricingMode === "BASE_PLUS_GST" ? "Base + GST" : "Selling + GST"}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Bill Summary */}
      <div className="mt-6 text-right space-y-2 text-sm md:text-base bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 md:p-6">
        <p>Total Items: {items.length}</p>
        <p>Total Quantity: {items.reduce((sum, item) => sum + item.quantity, 0)}</p>
        <p>
          Total Before Discount: ₹
          {items.reduce((sum, item) => {
            const q = Math.max(0, parseFloat(item.quantity) || 0);
            // base gross per-unit BEFORE discount
            const perUnitGross = (item?.normalized && (item.pricingMode === "MRP_INCLUSIVE" || item.pricingMode === "BASE_PLUS_GST"))
              ? (parseFloat(item.normalized.unitPriceGross) || 0)
              : (parseFloat(item.price) || 0);
            return sum + perUnitGross * q;
          }, 0).toFixed(2)}
        </p>
        <p>
          Total Discount: ₹
          {items.reduce((sum, item) => {
            const q = Math.max(0, parseFloat(item.quantity) || 0);
            const discPct = Math.max(0, Math.min(100, parseFloat(item.discount) || 0));
            if (item?.normalized && (item.pricingMode === "MRP_INCLUSIVE" || item.pricingMode === "BASE_PLUS_GST")) {
              // discount applies on base (net)
              const net = Math.max(0, parseFloat(item.normalized.unitPriceNet) || 0);
              const discountPerUnitOnNet = (net * discPct) / 100;
              return sum + discountPerUnitOnNet * q;
            }
            // SELLING_SIMPLE: discount on gross
            const gross = Math.max(0, parseFloat(item.price) || 0);
            const discountPerUnitOnGross = (gross * discPct) / 100;
            return sum + discountPerUnitOnGross * q;
          }, 0).toFixed(2)}
        </p>
        {includeGST && gstRate > 0 && (
          <p>GST ({gstRate}%): ₹{((subtotal * gstRate) / 100).toFixed(2)}</p>
        )}
        {includeCGST && cgstRate > 0 && (
          <p>CGST ({cgstRate}%): ₹{((subtotal * cgstRate) / 100).toFixed(2)}</p>
        )}
        {includeSGST && sgstRate > 0 && (
          <p>SGST ({sgstRate}%): ₹{((subtotal * sgstRate) / 100).toFixed(2)}</p>
        )}
        {includeIGST && igstRate > 0 && (
          <p>IGST ({igstRate}%): ₹{((subtotal * igstRate) / 100).toFixed(2)}</p>
        )}
        {/* Extras Breakdown */}
        {extras.delivery > 0 && (
          <p>Delivery Fee: ₹{extras.delivery.toFixed(2)}</p>
        )}
        {extras.packaging > 0 && (
          <p>Packaging Fee: ₹{extras.packaging.toFixed(2)}</p>
        )}
        {extras.insurance > 0 && (
          <p>
            Insurance{extras.insuranceMeta?.type === 'percent' ? ` (${extras.insuranceMeta.val}% of subtotal)` : ''}: ₹{extras.insurance.toFixed(2)}
          </p>
        )}
        {extras.other > 0 && (
          <p>Other Charges: ₹{extras.other.toFixed(2)}</p>
        )}
        <p className="font-semibold text-lg">
          Final Total: ₹{finalTotal.toFixed(2)}
        </p>
      </div>

      {/* Delivery Details block */}
      {(() => {
        const driver = settings?.driver || settings?.extras?.driver || {};
        const driverName = driver.name || "";
        const driverPhone = driver.phone || "";
        const driverVehicle = driver.vehicle || "";
        const driverTracking = driver.tracking || "";
        // Only render if at least one field is present
        if (
          driverName ||
          driverPhone ||
          driverVehicle ||
          driverTracking
        ) {
          return (
            <div className="mt-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 md:p-6 text-sm md:text-base text-left">
              <div className="font-semibold text-white/80 mb-2">Delivery Details</div>
              <div className="space-y-1">
                {driverName && (
                  <div>
                    <span className="text-white/60">Driver Name: </span>
                    <span className="text-white/90">{driverName}</span>
                  </div>
                )}
                {driverPhone && (
                  <div>
                    <span className="text-white/60">Phone: </span>
                    <span className="text-white/90">{driverPhone}</span>
                  </div>
                )}
                {driverVehicle && (
                  <div>
                    <span className="text-white/60">Vehicle: </span>
                    <span className="text-white/90">{driverVehicle}</span>
                  </div>
                )}
                {driverTracking && (
                  <div>
                    <span className="text-white/60">Tracking: </span>
                    <span className="text-white/90">{driverTracking}</span>
                  </div>
                )}
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
};

export default BillingCart;