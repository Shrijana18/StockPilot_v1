

/**
 * calcProforma.js
 * Pure calculator for distributor Proforma (taxes + order-level charges/discounts).
 *
 * This module performs NO I/O and writes NOTHING to Firestore. It just
 * transforms inputs to a stable financial breakdown so the caller/UI can persist it.
 *
 * Input lines can include: { qty, price, itemDiscountPct, gstRate, ... }.
 * Order-level charges: { delivery, packing, insurance, other, discountPct, discountAmt }.
 *
 * Output structure:
 * {
 *   lines: [ { qty, price, itemDiscountPct, gross, discountAmount, taxable, gstRate } ],
 *   orderCharges: { delivery, packing, insurance, other, discountPct, discountAmt },
 *   subTotal,                // sum of line.taxable (pre order-level charges/discount)
 *   discountTotal,           // order-level discount applied (₹)
 *   taxableBase,             // subTotal + charges - discountTotal
 *   taxType,                 // 'CGST_SGST' | 'IGST'
 *   taxBreakup: { cgst, sgst, igst },
 *   roundOff,                // rounding delta applied to reach grandTotal
 *   grandTotal               // final rounded payable
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
 * @param {Array<Object>} params.lines - items with qty, price, itemDiscountPct, gstRate
 * @param {Object} params.orderCharges - { delivery, packing, insurance, other, discountPct, discountAmt }
 * @param {string} params.distributorState
 * @param {string} params.retailerState
 * @param {'NEAREST'|'DOWN'|'UP'} [params.rounding='NEAREST']
 * @returns {Object}
 */
export function calculateProforma({
  lines = [],
  orderCharges = {},
  distributorState,
  retailerState,
  rounding = 'NEAREST',
} = {}) {
  // 1) Normalize lines & compute per-line taxable
  let subTotal = 0;
  const norm = lines.map((l = {}) => {
    const qty = r2(toNum(l.qty));
    const price = r2(toNum(l.price));
    const discPct = r2(toNum(l.itemDiscountPct));
    const gstRate = r2(toNum(l.gstRate)); // may be 0

    const gross = r2(qty * price);
    const discountAmount = r2((gross * discPct) / 100);
    const taxable = r2(gross - discountAmount);

    subTotal = r2(subTotal + taxable);

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

  // 2) Order-level charges & discounts
  const delivery = r2(toNum(orderCharges.delivery));
  const packing = r2(toNum(orderCharges.packing));
  const insurance = r2(toNum(orderCharges.insurance));
  const other = r2(toNum(orderCharges.other));

  const preDiscount = r2(subTotal + delivery + packing + insurance + other);

  const orderDiscPct = r2(toNum(orderCharges.discountPct));
  const orderDiscAmtFixed = r2(toNum(orderCharges.discountAmt));
  const orderDiscFromPct = r2((preDiscount * orderDiscPct) / 100);
  const discountTotal = r2(orderDiscAmtFixed || orderDiscFromPct);

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

  // 4) Rounding
  let roundOff = 0; let grandTotal = unroundedTotal;
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

  return {
    lines: norm,
    orderCharges: { delivery, packing, insurance, other, discountPct: orderDiscPct, discountAmt: orderDiscAmtFixed },
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