

/**
 * Order status constants for FLYP/StockPilot.
 * Centralized to avoid string typos across modules.
 * These are additive and won’t break existing docs using the same values.
 */

export const ORDER_STATUSES = Object.freeze({
  REQUESTED: 'REQUESTED',   // Retailer placed request (pre-tax estimate)
  QUOTED: 'QUOTED',         // Distributor issued Proforma (taxes/charges applied)
  ACCEPTED: 'ACCEPTED',     // Retailer accepted Proforma (values locked)
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
 * Validate a status value.
 * @param {string} status
 * @returns {boolean}
 */
export function isValidOrderStatus(status) {
  return Object.values(ORDER_STATUSES).includes(status);
}