/**
 * calcProforma.js
 * Pure calculator for distributor Proforma (taxes + order-level charges/discounts).
 *
 * This module performs NO I/O and writes NOTHING to Firestore. It just
 * transforms inputs to a stable financial breakdown so the caller/UI can persist it.
 *
 * Input lines can include: { qty, price, itemDiscountPct, itemDiscountAmt, gstRate, itemDiscountChangedBy }.
 * Order-level charges: { delivery, packing, insurance, other, discountPct, discountAmt, discountChangedBy }.
 *
 * Additional inputs:
 *   - distributorState, retailerState -> decide CGST/SGST vs IGST
 *   - roundingEnabled: boolean (default false)
 *   - rounding: 'NEAREST' | 'DOWN' | 'UP' (used only if roundingEnabled=true)
 *
 * Output structure:
 * {
 *   lines: [ { qty, price, itemDiscountPct, gross, discountAmount, taxable, gstRate } ],
 *   orderCharges: { delivery, packing, insurance, other, discountPct, discountAmt },
 *   // NEW summary fields for clearer UI:
 *   grossItems,             // sum of qty*price before any inline discounts
 *   lineDiscountTotal,      // sum of all line-level discounts (₹)
 *   itemsSubTotal,          // grossItems - lineDiscountTotal (aka subTotal after inline discounts)
 *
 *   subTotal,               // kept for backward-compatibility == itemsSubTotal
 *   discountTotal,          // order-level discount applied (₹)
 *   taxableBase,            // itemsSubTotal + charges - discountTotal
 *   taxType,                // 'CGST_SGST' | 'IGST'
 *   taxBreakup: { cgst, sgst, igst },
 *   roundOff,               // rounding delta applied to reach grandTotal (0 if rounding disabled)
 *   grandTotal              // final payable (rounded only if roundingEnabled)
 * }
 */

function r2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function toNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function taxTypeForPOS(distributorState, retailerState) {
  if (!distributorState || !retailerState) return 'CGST_SGST'; // safe default
  return distributorState.trim().toLowerCase() === retailerState.trim().toLowerCase()
    ? 'CGST_SGST'
    : 'IGST';
}

/**
 * Calculate a full Proforma (taxes + charges) from inputs.
 * @param {Object} params
 * @param {Array<Object>} params.lines - items with qty, price, itemDiscountPct|itemDiscountAmt, gstRate
 * @param {Object} params.orderCharges - { delivery, packing, insurance, other, discountPct, discountAmt, discountChangedBy }
 * @param {string} params.distributorState
 * @param {string} params.retailerState
 * @param {boolean} [params.roundingEnabled=false] - apply rounding or not
 * @param {'NEAREST'|'DOWN'|'UP'} [params.rounding='NEAREST'] - rounding mode if enabled
 * @returns {Object}
 */
export function calculateProforma({
  lines = [],
  orderCharges = {},
  distributorState,
  retailerState,
  roundingEnabled = false,
  rounding = 'NEAREST',
} = {}) {
  // 1) Normalize lines & compute per-line taxable
  let grossItems = 0;
  let lineDiscountTotal = 0;
  let itemsSubTotal = 0;

  const norm = lines.map((l = {}) => {
    const qty = r2(toNum(l.qty));
    const price = r2(toNum(l.price));
    const gstRate = r2(toNum(l.gstRate)); // may be 0

    const gross = r2(qty * price);
    grossItems = r2(grossItems + gross);

    // Inline discount: prefer the field last edited if provided
    const discPct = r2(toNum(l.itemDiscountPct));
    const discAmtFixed = r2(toNum(l.itemDiscountAmt));
    const discChangedBy = String(l.itemDiscountChangedBy || '').toLowerCase();
    let discountAmount;
    if (discChangedBy === 'amt') {
      discountAmount = Math.max(0, Math.min(gross, discAmtFixed));
    } else if (discChangedBy === 'pct') {
      discountAmount = r2((gross * Math.max(0, Math.min(100, discPct)) ) / 100);
    } else {
      // fallback: use amount if truthy, else percent
      discountAmount = discAmtFixed ? Math.max(0, Math.min(gross, discAmtFixed)) : r2((gross * Math.max(0, Math.min(100, discPct)) ) / 100);
    }
    discountAmount = r2(discountAmount);

    lineDiscountTotal = r2(lineDiscountTotal + discountAmount);

    const taxable = r2(gross - discountAmount);
    itemsSubTotal = r2(itemsSubTotal + taxable);

    return {
      ...l,
      qty,
      price,
      itemDiscountPct: discPct,
      gstRate,
      gross,
      discountAmount,
      taxable,
    };
  });

  // Back-compat: subTotal used to represent items after inline discount
  const subTotal = itemsSubTotal;

  // 2) Order-level charges & discounts
  const delivery = r2(toNum(orderCharges.delivery));
  const packing = r2(toNum(orderCharges.packing));
  const insurance = r2(toNum(orderCharges.insurance));
  const other = r2(toNum(orderCharges.other));

  const preDiscount = r2(subTotal + delivery + packing + insurance + other);

  const orderDiscPct = r2(toNum(orderCharges.discountPct));
  const orderDiscAmtFixed = r2(toNum(orderCharges.discountAmt));
  const orderDiscFromPct = r2((preDiscount * Math.max(0, Math.min(100, orderDiscPct))) / 100);
  const changedBy = String(orderCharges.discountChangedBy || '').toLowerCase();

  let discountTotal;
  if (changedBy === 'amt') {
    discountTotal = orderDiscAmtFixed;
  } else if (changedBy === 'pct') {
    discountTotal = orderDiscFromPct;
  } else {
    // fallback: prefer fixed amount if set, else percent
    discountTotal = orderDiscAmtFixed || orderDiscFromPct;
  }
  // clamp to [0, preDiscount]
  discountTotal = r2(Math.max(0, Math.min(preDiscount, discountTotal)));

  const taxableBase = r2(preDiscount - discountTotal);

  // 3) Tax engine (IGST vs CGST/SGST)
  const tt = taxTypeForPOS(distributorState, retailerState);
  let cgst = 0, sgst = 0, igst = 0;

  if (taxableBase > 0) {
    // Proportional apportionment by each line's taxable share
    const totalTaxableLines = norm.reduce((s, l) => r2(s + l.taxable), 0) || 1;
    norm.forEach(l => {
      const share = r2(l.taxable / totalTaxableLines);
      const allocatedBase = r2(taxableBase * share);
      const rate = r2(toNum(l.gstRate));
      const taxAmt = r2((allocatedBase * rate) / 100);

      if (tt === 'IGST') {
        igst = r2(igst + taxAmt);
      } else {
        const half = r2(taxAmt / 2);
        cgst = r2(cgst + half);
        sgst = r2(sgst + half);
      }
    });
  }

  const unroundedTotal = r2(taxableBase + cgst + sgst + igst);

  // 4) Rounding (opt-in)
  let roundOff = 0; 
  let grandTotal = r2(unroundedTotal);
  if (roundingEnabled) {
    if (rounding === 'UP') {
      const up = Math.ceil(unroundedTotal);
      roundOff = r2(up - unroundedTotal);
      grandTotal = up;
    } else if (rounding === 'DOWN') {
      const down = Math.floor(unroundedTotal);
      roundOff = r2(down - unroundedTotal);
      grandTotal = down;
    } else { // NEAREST
      const nearest = Math.round(unroundedTotal);
      roundOff = r2(nearest - unroundedTotal);
      grandTotal = nearest;
    }
  }

  return {
    lines: norm,
    orderCharges: { delivery, packing, insurance, other, discountPct: orderDiscPct, discountAmt: orderDiscAmtFixed },
    // NEW: explicit summary fields for UI
    grossItems,
    lineDiscountTotal,
    itemsSubTotal,
    // Back-compat alias:
    subTotal,
    discountTotal,
    taxableBase,
    taxType: tt,
    taxBreakup: { cgst: r2(cgst), sgst: r2(sgst), igst: r2(igst) },
    roundOff,
    grandTotal,
  };
}

export default calculateProforma;