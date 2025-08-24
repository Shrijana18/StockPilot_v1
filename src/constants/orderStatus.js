

/**
 * Order status constants for FLYP/StockPilot.
 * Centralized to avoid string typos across modules.
 * These are additive and won’t break existing docs using the same values.
 */

export const ORDER_STATUSES = Object.freeze({
  REQUESTED: 'REQUESTED',   // Retailer placed request (pre-tax estimate)
  QUOTED: 'QUOTED',         // Distributor issued Proforma (taxes/charges applied)
  ACCEPTED: 'ACCEPTED',     // Retailer accepted Proforma (values locked)
  REJECTED: 'REJECTED',     // Proforma rejected (terminal for the request)
  DIRECT: 'DIRECT',         // Defaults applied (proforma skipped)
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  INVOICED: 'INVOICED',
});

/**
 * Linear happy-path flow (for wizards/timelines). Not enforced; for UI hints.
 */
export const ORDER_FLOW = Object.freeze([
  ORDER_STATUSES.REQUESTED,
  ORDER_STATUSES.QUOTED,
  ORDER_STATUSES.ACCEPTED,
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
    case 'ACCEPTED':
      return ORDER_STATUSES.ACCEPTED;
    case 'REJECTED':
      return ORDER_STATUSES.REJECTED;
    case 'PLACED':
    case 'REQUESTED':
      return ORDER_STATUSES.REQUESTED;
    case 'SHIPPED':
      return ORDER_STATUSES.SHIPPED;
    case 'DELIVERED':
      return ORDER_STATUSES.DELIVERED;
    case 'INVOICED':
      return ORDER_STATUSES.INVOICED;
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