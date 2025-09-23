

// src/components/billing/pricingUtils.js
// Single source of truth for unit pricing math across BillingCart, FastBilling, and InvoicePreview.
// Handles three pricing modes: SELLING_SIMPLE, MRP_INCLUSIVE, BASE_PLUS_GST

/**
 * Normalize a product's pricing to a unit snapshot used for all cart math.
 * @param {Object} p
 * @param {('SELLING_SIMPLE'|'MRP_INCLUSIVE'|'BASE_PLUS_GST')} p.pricingMode
 * @param {number} [p.gstRate] - GST percentage like 0,5,12,18,28
 * @param {string} [p.hsnCode]
 * @param {number} [p.sellingPrice]
 * @param {boolean} [p.sellingIncludesGst=true]
 * @param {number} [p.mrp]
 * @param {number} [p.basePrice]
 * @returns {{
 *   unitPriceNet:number,
 *   unitPriceGross:number,
 *   taxPerUnit:number,
 *   taxIncludedAtSource:boolean,
 *   pricingExplainer:string
 * }}
 */
export function normalizeUnit(p = {}) {
  const r = (p.gstRate ?? 0) / 100;
  const pct = `${p.gstRate ?? 0}%`;
  const to2 = (n) => {
    const num = Number(n ?? 0);
    if (Number.isNaN(num)) return 0;
    return Number(num.toFixed(2));
  };

  if (p.pricingMode === "MRP_INCLUSIVE") {
    const gross = p.mrp ?? 0;
    const net = r > 0 ? gross / (1 + r) : gross;
    const tax = gross - net;
    return {
      unitPriceNet: to2(net),
      unitPriceGross: to2(gross),
      taxPerUnit: to2(tax),
      taxIncludedAtSource: true,
      pricingExplainer: `MRP ₹${to2(gross)} incl ${pct} → base ₹${to2(net)} + GST ₹${to2(tax)}`,
    };
  }

  if (p.pricingMode === "BASE_PLUS_GST") {
    const net = p.basePrice ?? 0;
    const gross = net * (1 + r);
    const tax = gross - net;
    return {
      unitPriceNet: to2(net),
      unitPriceGross: to2(gross),
      taxPerUnit: to2(tax),
      taxIncludedAtSource: false,
      pricingExplainer: `Base ₹${to2(net)} + ${pct} GST = ₹${to2(gross)}`,
    };
  }

  // Default/SELLING_SIMPLE
  const includes = p.sellingIncludesGst ?? true;
  const price = p.sellingPrice ?? 0;

  if (includes) {
    const gross = price;
    const net = r > 0 ? gross / (1 + r) : gross;
    const tax = gross - net;
    return {
      unitPriceNet: to2(net),
      unitPriceGross: to2(gross),
      taxPerUnit: to2(tax),
      taxIncludedAtSource: true,
      pricingExplainer: `Selling ₹${to2(gross)} incl ${pct} → base ₹${to2(net)} + GST ₹${to2(tax)}`,
    };
  } else {
    const net = price;
    const gross = net * (1 + r);
    const tax = gross - net;
    return {
      unitPriceNet: to2(net),
      unitPriceGross: to2(gross),
      taxPerUnit: to2(tax),
      taxIncludedAtSource: false,
      pricingExplainer: `Selling ₹${to2(net)} + ${pct} GST = ₹${to2(gross)}`,
    };
  }
}

/**
 * Compute line totals given the normalized unit, quantity and discounts.
 * Keeps GST proportionally correct after discount.
 * @param {{unitPriceNet:number, unitPriceGross:number, taxPerUnit:number}} unit
 * @param {number} qty
 * @param {number} [discountPct]
 * @param {number} [discountAmt]
 */
export function computeLineTotals(unit, qty, discountPct, discountAmt) {
  const q = qty ?? 1;
  const gross = (unit?.unitPriceGross ?? 0) * q;

  let discount = 0;
  if (discountAmt && discountAmt > 0) discount = discountAmt;
  else if (discountPct && discountPct > 0) discount = (gross * discountPct) / 100;

  const grossAfterDisc = Math.max(0, gross - discount);

  // r equals gstRate/100, derived from unit numbers to avoid passing gstRate around
  const r = unit?.unitPriceNet > 0 ? unit.taxPerUnit / unit.unitPriceNet : 0;
  const netAfterDisc = r > 0 ? grossAfterDisc / (1 + r) : grossAfterDisc;
  const tax = grossAfterDisc - netAfterDisc;

  return {
    lineGross: round2(gross),
    discount: round2(discount),
    lineGrossAfterDisc: round2(grossAfterDisc),
    lineNetAfterDisc: round2(netAfterDisc),
    lineTax: round2(tax),
  };
}

function round2(n) {
  const num = Number(n ?? 0);
  if (Number.isNaN(num)) return 0;
  return Number(num.toFixed(2));
}