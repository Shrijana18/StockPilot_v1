/**
 * Proforma Defaults Service (bulletproof, non-breaking)
 * -----------------------------------------------------
 * Centralized helpers to read/write/merge distributor proforma defaults,
 * resolve effective defaults for a retailer, and compute preview charges.
 *
 * Firestore layout (no breaking changes to existing order/proforma docs):
 *   /businesses/{distributorId}/defaultProformaSettings/global
 *   /businesses/{distributorId}/retailerDefaults/{retailerId}
 *
 * Usage priorities:
 *   Manual edits (per-proforma) > Retailer override > Global defaults
 *
 * Notes:
 * - All writes stamp updatedAt/updatedBy.
 * - All reads are tolerant to missing docs and return safe defaults.
 * - computeChargesFromDefaults() is pure and can be used for live previews.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit as fbLimit,
  startAfter as fbStartAfter,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

// ---------- Constants & helpers ----------

export const GLOBAL_DEFAULTS_PATH = (distributorId) =>
  doc(db, 'businesses', distributorId, 'defaultProformaSettings', 'global');

export const RETAILER_DEFAULTS_PATH = (distributorId, retailerId) =>
  doc(db, 'businesses', distributorId, 'retailerDefaults', retailerId);

export const RETAILER_DEFAULTS_COLLECTION = (distributorId) =>
  collection(db, 'businesses', distributorId, 'retailerDefaults');

// Safe base shape (kept minimal; do not remove fields without migration)
export const GLOBAL_DEFAULTS_SHAPE = Object.freeze({
  enabled: true,
  taxType: null, // "CGST_SGST" | "IGST" | null
  autodetectTaxType: true,

  // Percent rates (one of the below sets will apply based on taxType)
  gstRate: 18, // optional when using a single IGST rate path
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,

  // Flat fees
  deliveryFee: 0,
  packingFee: 0,
  insuranceFee: 0,
  otherFee: 0,

  // Discounts (choose either pct or amt at runtime)
  discountPct: 0,
  discountAmt: 0,

  // Rounding strategy for grand total
  roundRule: 'nearest', // 'nearest' | 'up' | 'down'

  updatedAt: null,
  updatedBy: null,
});

export const RETAILER_OVERRIDE_NULLABLES = Object.freeze({
  enabled: null, // null means: inherit global.enabled
  taxType: null,
  autodetectTaxType: null,

  gstRate: null,
  cgstRate: null,
  sgstRate: null,
  igstRate: null,

  deliveryFee: null,
  packingFee: null,
  insuranceFee: null,
  otherFee: null,

  discountPct: null,
  discountAmt: null,

  roundRule: null, // 'nearest' | 'up' | 'down' | null

  notes: null,
  updatedAt: null,
  updatedBy: null,
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isNonNull = (v) => v !== null && v !== undefined;

const pickNumber = (a, b) => {
  // prefer defined numeric a; else fallback to numeric b; else 0
  if (isNum(a)) return a;
  if (isNum(b)) return b;
  return 0;
};

const pickPref = (retailerVal, globalVal) =>
  isNonNull(retailerVal) ? retailerVal : globalVal;

const clampPct = (v) => {
  if (!isNum(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
};

// ---------- Public API ----------

/**
 * Read global defaults. Always returns a complete, safe object.
 */
export async function getGlobalDefaults(distributorId) {
  if (!distributorId) throw new Error('getGlobalDefaults: distributorId required');

  const ref = GLOBAL_DEFAULTS_PATH(distributorId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Initialize doc lazily with base shape (no-op for security rules until allowed)
    return { ...GLOBAL_DEFAULTS_SHAPE };
  }
  const data = snap.data() || {};
  return {
    ...GLOBAL_DEFAULTS_SHAPE,
    ...data,
  };
}

/**
 * Upsert global defaults with stamping.
 */
export async function setGlobalDefaults(distributorId, payload = {}, { actorUid } = {}) {
  if (!distributorId) throw new Error('setGlobalDefaults: distributorId required');

  // Validate minimally & coerce
  const clean = sanitizeGlobalPayload(payload);
  const ref = GLOBAL_DEFAULTS_PATH(distributorId);

  await setDoc(
    ref,
    {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid || null,
    },
    { merge: true }
  );

  return true;
}

/**
 * Read retailer override. Returns nullable fields merged into the override shape.
 */
export async function getRetailerDefaults(distributorId, retailerId) {
  if (!distributorId || !retailerId)
    throw new Error('getRetailerDefaults: distributorId & retailerId required');

  const ref = RETAILER_DEFAULTS_PATH(distributorId, retailerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { ...RETAILER_OVERRIDE_NULLABLES };
  }
  const data = snap.data() || {};
  return {
    ...RETAILER_OVERRIDE_NULLABLES,
    ...data,
  };
}

/**
 * Upsert retailer override with stamping.
 */
export async function setRetailerDefaults(distributorId, retailerId, payload = {}, { actorUid } = {}) {
  if (!distributorId || !retailerId)
    throw new Error('setRetailerDefaults: distributorId & retailerId required');

  const clean = sanitizeRetailerPayload(payload);
  const ref = RETAILER_DEFAULTS_PATH(distributorId, retailerId);

  await setDoc(
    ref,
    {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid || null,
    },
    { merge: true }
  );

  return true;
}

/**
 * Get effective defaults for a distributor → retailer pair.
 * Resolution: retailer override (non-null fields) → global → base.
 */
export async function getEffectiveDefaults(distributorId, retailerId) {
  const [globalDef, retailerDef] = await Promise.all([
    getGlobalDefaults(distributorId),
    retailerId ? getRetailerDefaults(distributorId, retailerId) : Promise.resolve(null),
  ]);

  const merged = mergeEffectiveDefaults(globalDef, retailerDef);
  return merged;
}

/**
 * List retailer overrides (for table pagination).
 */
export async function listRetailerDefaults(distributorId, { limit = 50, startAfter } = {}) {
  if (!distributorId) throw new Error('listRetailerDefaults: distributorId required');

  let q = query(RETAILER_DEFAULTS_COLLECTION(distributorId), orderBy('updatedAt', 'desc'), fbLimit(limit));
  if (startAfter) {
    q = query(RETAILER_DEFAULTS_COLLECTION(distributorId), orderBy('updatedAt', 'desc'), fbStartAfter(startAfter), fbLimit(limit));
  }
  const snap = await getDocs(q);
  const items = [];
  snap.forEach((docSnap) => {
    items.push({ retailerId: docSnap.id, ...(docSnap.data() || {}) });
  });
  const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

  return { items, lastDoc: last };
}

/**
 * Resolve tax type from defaults or geo info.
 * If autodetect is true and both state codes exist: intrastate -> CGST/SGST; interstate -> IGST.
 */
export function resolveTaxType({ defaults, distributorProfile, retailerProfile }) {
  const autodetect = defaults?.autodetectTaxType;
  if (autodetect) {
    const distState = getStateCode(distributorProfile);
    const retState = getStateCode(retailerProfile);
    if (distState && retState) {
      return distState === retState ? 'CGST_SGST' : 'IGST';
    }
  }
  return defaults?.taxType || 'CGST_SGST';
}

/**
 * Compute a full charges preview from effective defaults.
 * Returns a structure compatible with your orderCharges breakdown.
 */
export function computeChargesFromDefaults({
  itemsSubTotal = 0,
  defaults,
  distributorProfile,
  retailerProfile,
}) {
  const eff = { ...GLOBAL_DEFAULTS_SHAPE, ...defaults };
  const taxType = resolveTaxType({ defaults: eff, distributorProfile, retailerProfile });

  // Apply discounts
  const discountPct = clampPct(eff.discountPct);
  const discountFromPct = (itemsSubTotal * discountPct) / 100;
  const discountAmt = isNum(eff.discountAmt) ? eff.discountAmt : 0;
  const appliedDiscount = Math.max(discountFromPct, discountAmt); // choose the larger one, common business rule; adjust if needed

  // Fees
  const delivery = pickNumber(eff.deliveryFee, 0);
  const packing = pickNumber(eff.packingFee, 0);
  const insurance = pickNumber(eff.insuranceFee, 0);
  const other = pickNumber(eff.otherFee, 0);

  // Taxable base
  const preTaxBase = Math.max(0, itemsSubTotal - appliedDiscount) + delivery + packing + insurance + other;

  // Taxes
  let cgst = 0, sgst = 0, igst = 0;
  if (taxType === 'CGST_SGST') {
    const cgstRate = pickNumber(eff.cgstRate, 0);
    const sgstRate = pickNumber(eff.sgstRate, 0);
    cgst = (preTaxBase * cgstRate) / 100;
    sgst = (preTaxBase * sgstRate) / 100;
  } else {
    const igstRate = pickNumber(eff.igstRate, isNum(eff.gstRate) ? eff.gstRate : 0);
    igst = (preTaxBase * igstRate) / 100;
  }
  const taxTotal = cgst + sgst + igst;

  // Grand total & roundoff (round to nearest rupee or as per rule)
  const gross = preTaxBase + taxTotal;
  const { rounded, roundOff } = applyRoundRule(gross, eff.roundRule);

  return {
    version: 1,
    taxType,
    autodetectTaxType: !!eff.autodetectTaxType,

    // Inputs
    itemsSubTotal: toMoney(itemsSubTotal),
    discountPct,
    discountAmt: toMoney(appliedDiscount),

    // Fees
    delivery: toMoney(delivery),
    packing: toMoney(packing),
    insurance: toMoney(insurance),
    other: toMoney(other),

    // Base & taxes
    taxableBase: toMoney(preTaxBase),
    taxBreakup: {
      cgst: toMoney(cgst),
      sgst: toMoney(sgst),
      igst: toMoney(igst),
    },

    // Totals
    subTotal: toMoney(itemsSubTotal),
    taxes: toMoney(taxTotal),
    roundOff: toMoney(roundOff),
    grandTotal: toMoney(rounded),
  };
}

// ---------- Internal helpers ----------

function sanitizeGlobalPayload(p = {}) {
  const out = { ...GLOBAL_DEFAULTS_SHAPE };

  out.enabled = typeof p.enabled === 'boolean' ? p.enabled : out.enabled;

  out.taxType = typeof p.taxType === 'string' ? p.taxType : out.taxType;
  out.autodetectTaxType =
    typeof p.autodetectTaxType === 'boolean' ? p.autodetectTaxType : out.autodetectTaxType;

  out.gstRate = isNum(p.gstRate) ? p.gstRate : out.gstRate;
  out.cgstRate = isNum(p.cgstRate) ? p.cgstRate : out.cgstRate;
  out.sgstRate = isNum(p.sgstRate) ? p.sgstRate : out.sgstRate;
  out.igstRate = isNum(p.igstRate) ? p.igstRate : out.igstRate;

  out.deliveryFee = pickNumber(p.deliveryFee, out.deliveryFee);
  out.packingFee = pickNumber(p.packingFee, out.packingFee);
  out.insuranceFee = pickNumber(p.insuranceFee, out.insuranceFee);
  out.otherFee = pickNumber(p.otherFee, out.otherFee);

  out.discountPct = clampPct(p.discountPct ?? out.discountPct);
  out.discountAmt = pickNumber(p.discountAmt, out.discountAmt);

  out.roundRule = ['nearest', 'up', 'down'].includes(p.roundRule) ? p.roundRule : out.roundRule;

  return out;
}

function sanitizeRetailerPayload(p = {}) {
  const base = { ...RETAILER_OVERRIDE_NULLABLES };

  const setOrNull = (key, predicate, transform = (x) => x) => {
    if (p[key] === null) return null;
    if (p[key] === undefined) return base[key];
    return predicate(p[key]) ? transform(p[key]) : base[key];
  };

  return {
    enabled: (p.enabled === null) ? null : (typeof p.enabled === 'boolean' ? p.enabled : base.enabled),

    taxType: setOrNull('taxType', (v) => typeof v === 'string'),
    autodetectTaxType: setOrNull('autodetectTaxType', (v) => typeof v === 'boolean'),

    gstRate: setOrNull('gstRate', isNum),
    cgstRate: setOrNull('cgstRate', isNum),
    sgstRate: setOrNull('sgstRate', isNum),
    igstRate: setOrNull('igstRate', isNum),

    deliveryFee: setOrNull('deliveryFee', isNum),
    packingFee: setOrNull('packingFee', isNum),
    insuranceFee: setOrNull('insuranceFee', isNum),
    otherFee: setOrNull('otherFee', isNum),

    discountPct: setOrNull('discountPct', isNum, clampPct),
    discountAmt: setOrNull('discountAmt', isNum),

    roundRule: setOrNull('roundRule', (v) => ['nearest', 'up', 'down'].includes(v)),

    notes: setOrNull('notes', (v) => typeof v === 'string'),

    // updatedAt/updatedBy handled at write
  };
}

function mergeEffectiveDefaults(globalDef, retailerDef) {
  const g = { ...GLOBAL_DEFAULTS_SHAPE, ...(globalDef || {}) };
  const r = retailerDef || null;

  if (!r) return g;

  return {
    ...g,
    enabled: pickPref(r.enabled, g.enabled),
    // Where retailer has a non-null value, prefer it:
    taxType: pickPref(r.taxType, g.taxType),
    autodetectTaxType: pickPref(r.autodetectTaxType, g.autodetectTaxType),

    gstRate: pickPref(r.gstRate, g.gstRate),
    cgstRate: pickPref(r.cgstRate, g.cgstRate),
    sgstRate: pickPref(r.sgstRate, g.sgstRate),
    igstRate: pickPref(r.igstRate, g.igstRate),

    deliveryFee: pickPref(r.deliveryFee, g.deliveryFee),
    packingFee: pickPref(r.packingFee, g.packingFee),
    insuranceFee: pickPref(r.insuranceFee, g.insuranceFee),
    otherFee: pickPref(r.otherFee, g.otherFee),

    discountPct: pickPref(r.discountPct, g.discountPct),
    discountAmt: pickPref(r.discountAmt, g.discountAmt),

    roundRule: pickPref(r.roundRule, g.roundRule),

    // keep global stamps; retailer doc has its own
    updatedAt: g.updatedAt,
    updatedBy: g.updatedBy,
  };
}

function getStateCode(profile) {
  // Prefer explicit stateCode; else derive from GSTIN if present
  const stateCode =
    profile?.stateCode ||
    extractStateFromGSTIN(profile?.gstin) ||
    null;
  return stateCode || null;
}

function extractStateFromGSTIN(gstin) {
  if (typeof gstin !== 'string' || gstin.length < 2) return null;
  const two = gstin.slice(0, 2);
  // Return as string; numeric codes 01..37 etc. We don’t validate map here.
  return two;
}

function applyRoundRule(amount, rule = 'nearest') {
  // Round to nearest rupee by default; adjust to paisa if needed.
  const rounder = (x) => {
    switch (rule) {
      case 'up':
        return Math.ceil(x);
      case 'down':
        return Math.floor(x);
      case 'nearest':
      default:
        return Math.round(x);
    }
  };
  const rounded = rounder(amount);
  const roundOff = rounded - amount;
  return { rounded, roundOff };
}

function toMoney(n) {
  // Normalize to 2-decimals number
  const v = Number(n || 0);
  return Math.round(v * 100) / 100;
}
