/**
 * Platform Fee Calculator
 * Implements tiered pricing structure for marketplace
 * 
 * Current: Fixed ₹10 per order
 * Recommended: Tiered structure based on order value
 */

/**
 * Calculate platform fee based on order total
 * 
 * @param {number} orderTotal - Total order value (subtotal + delivery fee)
 * @param {string} pricingModel - 'fixed' | 'tiered' | 'percentage' | 'hybrid'
 * @returns {number} Platform fee in rupees
 */
export const calculatePlatformFee = (orderTotal, pricingModel = 'tiered') => {
  if (!orderTotal || orderTotal <= 0) return 0;

  switch (pricingModel) {
    case 'fixed':
      // Current model: Fixed ₹10
      return 10;

    case 'tiered':
      // Recommended: Tiered structure
      // More equitable - small orders pay less, large orders pay more
      if (orderTotal < 200) {
        return 5; // Very small orders
      } else if (orderTotal < 500) {
        return 10; // Small orders (current default)
      } else if (orderTotal < 1000) {
        return 15; // Medium orders
      } else if (orderTotal < 2000) {
        return 20; // Large orders
      } else {
        return 25; // Very large orders
      }

    case 'percentage':
      // Percentage-based (like commission, but lower)
      // 1% of order value, minimum ₹5, maximum ₹50
      const percentage = orderTotal * 0.01;
      return Math.max(5, Math.min(50, Math.round(percentage)));

    case 'hybrid':
      // Best of both: Fixed base + small percentage
      // Base ₹5 + 0.5% of order value
      const base = 5;
      const percentageFee = orderTotal * 0.005;
      return Math.round(base + percentageFee);

    default:
      return 10; // Default to current fixed fee
  }
};

/**
 * Get platform fee breakdown for display
 */
export const getPlatformFeeBreakdown = (orderTotal, pricingModel = 'tiered') => {
  const fee = calculatePlatformFee(orderTotal, pricingModel);
  const percentage = orderTotal > 0 ? ((fee / orderTotal) * 100).toFixed(2) : 0;

  return {
    fee,
    percentage: parseFloat(percentage),
    model: pricingModel,
    explanation: getFeeExplanation(orderTotal, pricingModel)
  };
};

/**
 * Get human-readable explanation of fee
 */
const getFeeExplanation = (orderTotal, model) => {
  const fee = calculatePlatformFee(orderTotal, model);
  
  switch (model) {
    case 'fixed':
      return 'Fixed platform fee';
    case 'tiered':
      if (orderTotal < 200) return 'Small order fee';
      if (orderTotal < 500) return 'Standard platform fee';
      if (orderTotal < 1000) return 'Medium order fee';
      if (orderTotal < 2000) return 'Large order fee';
      return 'Premium order fee';
    case 'percentage':
      return '1% platform fee (min ₹5, max ₹50)';
    case 'hybrid':
      return 'Base fee + 0.5% of order value';
    default:
      return 'Platform fee';
  }
};

/**
 * Compare platform fee models
 */
export const compareFeeModels = (orderTotal) => {
  return {
    fixed: calculatePlatformFee(orderTotal, 'fixed'),
    tiered: calculatePlatformFee(orderTotal, 'tiered'),
    percentage: calculatePlatformFee(orderTotal, 'percentage'),
    hybrid: calculatePlatformFee(orderTotal, 'hybrid'),
    current: 10 // Current implementation
  };
};

/**
 * Calculate revenue projections
 */
export const calculateRevenueProjections = (monthlyOrders, avgOrderValue, pricingModel = 'tiered') => {
  const avgFee = calculatePlatformFee(avgOrderValue, pricingModel);
  const monthlyRevenue = monthlyOrders * avgFee;
  const yearlyRevenue = monthlyRevenue * 12;

  return {
    monthlyOrders,
    avgOrderValue,
    avgPlatformFee: avgFee,
    monthlyRevenue,
    yearlyRevenue,
    revenuePerOrder: avgFee
  };
};

export default {
  calculatePlatformFee,
  getPlatformFeeBreakdown,
  compareFeeModels,
  calculateRevenueProjections
};
