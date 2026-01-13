// src/utils/pricing.js
// Universal pricing helpers for FLYP (backward-compatible)
//
// Design goals:
// - Keep sellingPrice as the final amount used by cart/invoices.
// - Add optional fields (mrp, basePrice, taxRate, pricingMode) without breaking legacy items.
// - One calculation path used across Manual / OCR / AI / Billing so math stays consistent.

/** @typedef {"MRP_INCLUSIVE" | "BASE_PLUS_TAX" | "LEGACY"} PricingMode */

export const PRICING_MODES = {
  LEGACY: "LEGACY",
  MRP_INCLUSIVE: "MRP_INCLUSIVE",
  BASE_PLUS_TAX: "BASE_PLUS_TAX",
};

/** Round to 2 decimals, safe for currency */
function round2(n) {
  const x = Number(n);
  if (!isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Split an inclusive MRP into base + tax at the given GST rate.
 * @param {number} mrp - Final price inclusive of GST.
 * @param {number} taxRate - GST % (e.g., 0, 5, 12, 18).
 * @returns {{ base: number, tax: number }}
 */
export function splitFromMrp(mrp, taxRate) {
  const M = Number(mrp) || 0;
  const r = Number(taxRate) || 0;
  if (M <= 0 || r <= 0) return { base: round2(M), tax: 0 };
  const base = M / (1 + r / 100);
  const tax = M - base;
  return { base: round2(base), tax: round2(tax) };
}

/**
 * Compute final from base + tax %.
 * @param {number} basePrice - Price excluding GST.
 * @param {number} taxRate - GST %.
 * @returns {{ base: number, tax: number, final: number }}
 */
export function calcBasePlusTax(basePrice, taxRate) {
  const B = Number(basePrice) || 0;
  const r = Number(taxRate) || 0;
  const tax = r > 0 ? (B * r) / 100 : 0;
  const final = B + tax;
  return { base: round2(B), tax: round2(tax), final: round2(final) };
}

/**
 * Build the pricing payload to save on a product document.
 * Always returns a sellingPrice field; adds optional fields per mode.
 * @param {PricingMode} mode
 * @param {{ mrp?: number, basePrice?: number, taxRate?: number, legacySellingPrice?: number }} args
 * @returns {{ pricingMode: PricingMode, sellingPrice: number, mrp?: number, basePrice?: number, taxRate?: number }}
 */
export function buildPricingSave(mode, args = {}) {
  const selected = mode || PRICING_MODES.LEGACY;
  const r = Number(args.taxRate ?? 0);

  if (selected === PRICING_MODES.MRP_INCLUSIVE) {
    const mrp = round2(args.mrp ?? 0);
    // compute and persist basePrice so reporting/billing can use it directly
    const { base } = splitFromMrp(mrp, r);
    return {
      pricingMode: PRICING_MODES.MRP_INCLUSIVE,
      mrp,
      taxRate: r,
      basePrice: base, // store derived base for convenience
      sellingPrice: mrp, // MRP is already final
    };
  }

  if (selected === PRICING_MODES.BASE_PLUS_TAX) {
    const base = round2(args.basePrice ?? 0);
    const { final } = calcBasePlusTax(base, r);
    return {
      pricingMode: PRICING_MODES.BASE_PLUS_TAX,
      basePrice: base,
      taxRate: r,
      sellingPrice: final,
    };
  }

  // LEGACY fallback – behave exactly like today
  const sellingPrice = round2(args.legacySellingPrice ?? 0);
  return {
    pricingMode: PRICING_MODES.LEGACY,
    sellingPrice,
  };
}

/**
 * Calculate a cart line (base, tax, final) for qty using product fields.
 * Works for mixed carts and legacy items.
 * @param {{ pricingMode?: PricingMode, mrp?: number, basePrice?: number, taxRate?: number, sellingPrice: number }} p
 * @param {number} qty
 * @returns {{ base: number, tax: number, final: number }}
 */
export function calcLineFromProduct(p, qty = 1) {
  const q = Number(qty) || 1;
  const mode = p?.pricingMode || PRICING_MODES.LEGACY;
  const r = Number(p?.taxRate ?? 0);

  if (mode === PRICING_MODES.MRP_INCLUSIVE) {
    const unitFinal = Number(p?.mrp ?? p?.sellingPrice ?? 0);
    if (unitFinal <= 0) return { base: 0, tax: 0, final: 0 };
    const { base, tax } = splitFromMrp(unitFinal, r);
    return { base: round2(base * q), tax: round2(tax * q), final: round2(unitFinal * q) };
  }

  if (mode === PRICING_MODES.BASE_PLUS_TAX) {
    const unitBase = Number(p?.basePrice ?? p?.sellingPrice ?? 0);
    if (unitBase <= 0) return { base: 0, tax: 0, final: 0 };
    const { base, tax, final } = calcBasePlusTax(unitBase, r);
    return { base: round2(base * q), tax: round2(tax * q), final: round2(final * q) };
  }

  // LEGACY: treat sellingPrice as final, no explicit tax
  const unitFinal = Number(p?.sellingPrice ?? 0);
  return { base: round2(unitFinal * q), tax: 0, final: round2(unitFinal * q) };
}