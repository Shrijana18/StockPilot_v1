

/**
 * Order status constants for FLYP/StockPilot.
 * Centralized to avoid string typos across modules.
 * These are additive and won’t break existing docs using the same values.
 */

export const ORDER_STATUSES = Object.freeze({
  REQUESTED: 'REQUESTED',   // Retailer placed request (pre-tax estimate)
  QUOTED: 'QUOTED',         // Distributor issued Proforma (taxes/charges applied)
  ON_HOLD: 'ON_HOLD',       // Order on hold (waiting for stock/approval)
  ACCEPTED: 'ACCEPTED',     // Retailer accepted Proforma (values locked)
  MODIFIED: 'MODIFIED',     // Distributor modified the order before fulfillment
  REJECTED: 'REJECTED',     // Proforma rejected (terminal for the request)
  DIRECT: 'DIRECT',         // Defaults applied (proforma skipped)
  ASSIGNED: 'ASSIGNED',     // Order assigned by Product Owner to Distributor
  PACKED: 'PACKED',         // Order packed and ready
  SHIPPED: 'SHIPPED',       // Order shipped
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY', // Order out for delivery
  DELIVERED: 'DELIVERED',   // Order delivered
  INVOICED: 'INVOICED',
});

/**
 * Linear happy-path flow (for wizards/timelines). Not enforced; for UI hints.
 */
export const ORDER_FLOW = Object.freeze([
  ORDER_STATUSES.REQUESTED,
  ORDER_STATUSES.QUOTED,
  ORDER_STATUSES.ACCEPTED,
  ORDER_STATUSES.MODIFIED,
  ORDER_STATUSES.PACKED,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.INVOICED,
]);

/**
 * Direct flow variant (when defaults applied, proforma skipped).
 */
export const ORDER_FLOW_DIRECT = Object.freeze([
  ORDER_STATUSES.REQUESTED,
  ORDER_STATUSES.ACCEPTED,
  ORDER_STATUSES.MODIFIED,
  ORDER_STATUSES.PACKED,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.INVOICED,
]);

/**
 * Validate a status value.
 * @param {string} status
 * @returns {boolean}
 */
export function isValidOrderStatus(status) {
  return Object.values(ORDER_STATUSES).includes(status);
}

/**
 * Some older docs/screens use human labels in `status` while newer code uses `statusCode`.
 * These helpers keep both in sync without breaking existing data.
 */
export const STATUS_ALIASES = Object.freeze({
  PROFORMA_SENT: ORDER_STATUSES.QUOTED, // alias used in older commits / UI copy
  PLACED: ORDER_STATUSES.REQUESTED,     // sometimes shown as "Placed"
  REQUESTED: ORDER_STATUSES.REQUESTED,
  MODIFIED: ORDER_STATUSES.MODIFIED,
  PENDING: ORDER_STATUSES.PACKED,       // older UI called this Pending
});

/**
 * Normalize status code from a Firestore order/request doc.
 * @param {{statusCode?: string, status?: string}} doc
 * @returns {string|undefined}
 */
export function normalizeStatusCode(doc = {}) {
  const code = doc.statusCode || '';
  if (code && isValidOrderStatus(code)) return code;
  const s = (doc.status || '').toUpperCase();
  switch (s) {
    case 'QUOTED':
    case 'PROFORMA_SENT':
      return ORDER_STATUSES.QUOTED;
    case 'ON_HOLD':
    case 'ON HOLD':
    case 'HOLD':
      return ORDER_STATUSES.ON_HOLD;
    case 'ACCEPTED':
      return ORDER_STATUSES.ACCEPTED;
    case 'MODIFIED':
      return ORDER_STATUSES.MODIFIED;
    case 'REJECTED':
      return ORDER_STATUSES.REJECTED;
    case 'DIRECT':
      return ORDER_STATUSES.DIRECT;
    case 'PACKED':
    case 'PENDING':
      return ORDER_STATUSES.PACKED; // unify older "Pending" with PACKED step
    case 'SHIPPED':
      return ORDER_STATUSES.SHIPPED;
    case 'OUT_FOR_DELIVERY':
    case 'OUT FOR DELIVERY':
      return ORDER_STATUSES.OUT_FOR_DELIVERY;
    case 'DELIVERED':
      return ORDER_STATUSES.DELIVERED;
    case 'INVOICED':
      return ORDER_STATUSES.INVOICED;
    case 'ASSIGNED':
      return ORDER_STATUSES.ASSIGNED;
    case 'PLACED':
    case 'REQUESTED':
      return ORDER_STATUSES.REQUESTED;
    default:
      return undefined;
  }
}

/**
 * Is the order/request awaiting proforma acceptance by retailer?
 */
export function isProformaPending(doc = {}) {
  const code = normalizeStatusCode(doc);
  return code === ORDER_STATUSES.QUOTED; // aka PROFORMA_SENT
}

/**
 * Terminal states for requests (nothing actionable in request stage).
 */
export function isTerminalStatus(doc = {}) {
  const code = normalizeStatusCode(doc);
  return code === ORDER_STATUSES.REJECTED || code === ORDER_STATUSES.DELIVERED || code === ORDER_STATUSES.INVOICED;
}

/**
 * Canonical transition graph used by both Active & Passive flows.
 * We keep PACKED as the step name in code; older UI that says "Pending" maps to PACKED.
 */
export const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUSES.REQUESTED]: [ORDER_STATUSES.QUOTED, ORDER_STATUSES.ON_HOLD, ORDER_STATUSES.REJECTED, ORDER_STATUSES.DIRECT],
  [ORDER_STATUSES.QUOTED]: [ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.ON_HOLD, ORDER_STATUSES.REJECTED],
  [ORDER_STATUSES.ON_HOLD]: [ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.REJECTED, ORDER_STATUSES.REQUESTED],
  [ORDER_STATUSES.ACCEPTED]: [ORDER_STATUSES.MODIFIED, ORDER_STATUSES.PACKED],
  [ORDER_STATUSES.MODIFIED]: [ORDER_STATUSES.PACKED],
  [ORDER_STATUSES.ASSIGNED]: [ORDER_STATUSES.PACKED, ORDER_STATUSES.SHIPPED], // Product Owner can update
  [ORDER_STATUSES.PACKED]: [ORDER_STATUSES.SHIPPED],
  [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.OUT_FOR_DELIVERY, ORDER_STATUSES.DELIVERED],
  [ORDER_STATUSES.OUT_FOR_DELIVERY]: [ORDER_STATUSES.DELIVERED],
  [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.INVOICED],
  [ORDER_STATUSES.REJECTED]: [],
  [ORDER_STATUSES.DIRECT]: [ORDER_STATUSES.PACKED],
  [ORDER_STATUSES.INVOICED]: [],
});

/** Return the normalized status code for a given doc or code string. */
export function codeOf(input) {
  if (typeof input === 'string') return normalizeStatusCode({ status: input });
  return normalizeStatusCode(input);
}

/** Whether transition is allowed according to the canonical graph. */
export function canTransition(from, to) {
  const f = codeOf(from);
  const t = codeOf(to);
  return !!(f && t && ORDER_TRANSITIONS[f]?.includes(t));
}

/** Next allowed statuses for a given status */
export function nextStatuses(from) {
  const f = codeOf(from);
  return (ORDER_TRANSITIONS[f] || []).slice();
}

/** Create a timeline entry object */
export function timelineEntry(statusCode, actor = 'system') {
  return { status: statusCode, at: new Date(), by: actor };
}

/** Determine if an order is passive/provisional */
export function isPassiveOrder(doc = {}) {
  return (
    doc?.retailerMode === 'passive' ||
    doc?.mode === 'passive' ||
    doc?.isProvisional === true ||
    !!doc?.provisionalRetailerId
  );
}