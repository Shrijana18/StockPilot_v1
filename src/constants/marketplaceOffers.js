/**
 * Marketplace Offers & Return Policy – shared constants
 * Used by retailer dashboard (MarketplaceSetup, MarketplaceProducts) and customer app
 */

/** Return policy options – simple labels for non‑tech retailers */
export const RETURN_POLICY_OPTIONS = [
  { value: 'inherit', label: 'Use store default', description: 'Follow your store’s default policy' },
  { value: 'non_returnable', label: 'Non-returnable', description: 'No returns or replacements' },
  { value: 'replacement_available', label: 'Replacement available', description: 'Replace if defective/wrong' },
  { value: 'return_within_1h', label: 'Return within 1 hour', description: 'Return or replace within 1 hour' },
  { value: 'return_within_24h', label: 'Return within 24 hours', description: 'Return or replace within 24 hours' },
  { value: 'return_within_3d', label: 'Return within 3 days', description: 'Return or replace within 3 days' },
];

/** Store-wide offer types */
export const STORE_OFFER_TYPES = {
  PERCENT_ALL: 'percent_all',       // e.g. 20% off on all orders
  PERCENT_ABOVE: 'percent_above',   // e.g. 30% off on orders above ₹500
};

/** Get human-readable return policy label */
export function getReturnPolicyLabel(value) {
  const opt = RETURN_POLICY_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

/** Resolve effective return policy for a product (product override or store default) */
export function getEffectiveReturnPolicy(product, storeDefault) {
  const p = product?.returnPolicy;
  if (p && p !== 'inherit') return p;
  return storeDefault || 'replacement_available';
}

/**
 * Compute best store-wide discount for customer from storeOffers.
 * Returns { discountAmount, appliedOffer }.
 */
export function computeStoreOfferDiscount(subtotal, storeOffers) {
  if (!Array.isArray(storeOffers) || storeOffers.length === 0 || subtotal <= 0) {
    return { discountAmount: 0, appliedOffer: null };
  }

  let bestDiscount = 0;
  let appliedOffer = null;

  for (const offer of storeOffers) {
    if (!offer.enabled) continue;

    let discount = 0;
    if (offer.type === 'percent_all') {
      discount = (subtotal * (offer.value || 0)) / 100;
    } else if (offer.type === 'percent_above') {
      const min = parseFloat(offer.minOrderValue) || 0;
      if (subtotal >= min) {
        discount = (subtotal * (offer.value || 0)) / 100;
      }
    }

    if (discount > bestDiscount) {
      bestDiscount = discount;
      appliedOffer = offer;
    }
  }

  return {
    discountAmount: Math.round(bestDiscount * 100) / 100,
    appliedOffer
  };
}
