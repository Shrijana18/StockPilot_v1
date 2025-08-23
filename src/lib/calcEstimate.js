

/**
 * calcEstimate.js
 * Pure pre-tax/pre-charges estimate math for order items.
 *
 * Input item shape (minimum):
 * { qty, price, itemDiscountPct }
 * Optional passthrough fields (kept as-is): inventoryId, name, sku, hsn, uom, imageUrl
 *
 * Output:
 * {
 *   items: [
 *     { qty, price, itemDiscountPct, gross, discountAmount, taxable }
 *   ],
 *   subtotal
 * }
 *
 * Notes:
 * - No GST or order-level charges applied here.
 * - No Firestore writes here; caller decides persistence.
 * - Deterministic rounding to 2 decimals for financial fields.
 */

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  // Avoid floating point drift; keep as number not string
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate pre-tax estimate for a list of items.
 * @param {Array<Object>} items
 * @returns {{ items: Array<Object>, subtotal: number }}
 */
export function calculateEstimate(items = []) {
  let subtotal = 0;

  const normalized = items.map((it = {}) => {
    const qty = round2(toNum(it.qty));
    const price = round2(toNum(it.price));
    const itemDiscountPct = round2(toNum(it.itemDiscountPct)); // 0-100

    const gross = round2(qty * price); // qty * price
    const discountAmount = round2((gross * itemDiscountPct) / 100);
    const taxable = round2(gross - discountAmount); // still pre-tax

    subtotal = round2(subtotal + taxable);

    return {
      // passthrough identifiers for convenience in UI/DB writes
      inventoryId: it.inventoryId,
      name: it.name,
      sku: it.sku,
      hsn: it.hsn,
      uom: it.uom,
      imageUrl: it.imageUrl,

      // normalized numerics
      qty,
      price,
      itemDiscountPct,

      // computed
      gross,
      discountAmount,
      taxable,
    };
  });

  return {
    items: normalized,
    subtotal,
  };
}

export default calculateEstimate;