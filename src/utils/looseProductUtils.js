/**
 * Loose Product Utilities
 * Helper functions for managing loose products (Indian local business support)
 */

/**
 * Calculate stock in selling units
 * @param {number} baseQuantity - Stock in base units
 * @param {number} conversionFactor - How many selling units = 1 base unit
 * @returns {number} Stock in selling units
 */
export const calculateSellingUnitStock = (baseQuantity, conversionFactor = 1) => {
  if (!conversionFactor || conversionFactor <= 0) return baseQuantity;
  return baseQuantity * conversionFactor;
};

/**
 * Calculate base unit quantity from selling units
 * @param {number} sellingQuantity - Quantity in selling units
 * @param {number} conversionFactor - How many selling units = 1 base unit
 * @returns {number} Quantity in base units (can be fractional)
 */
export const convertToBaseUnit = (sellingQuantity, conversionFactor = 1) => {
  if (!conversionFactor || conversionFactor <= 0) return sellingQuantity;
  return sellingQuantity / conversionFactor;
};

/**
 * Calculate selling unit price from base unit price
 * @param {number} baseUnitPrice - Price per base unit
 * @param {number} conversionFactor - How many selling units = 1 base unit
 * @returns {number} Price per selling unit
 */
export const calculateSellingUnitPrice = (baseUnitPrice, conversionFactor = 1) => {
  if (!conversionFactor || conversionFactor <= 0) return baseUnitPrice;
  return baseUnitPrice / conversionFactor;
};

/**
 * Format stock display for loose products
 * @param {Object} product - Product object
 * @returns {string} Formatted stock display
 */
export const formatLooseProductStock = (product) => {
  if (!product.isLooseProduct) {
    return `${product.quantity || 0} ${product.unit || ''}`;
  }

  const baseQty = product.quantity || 0;
  const conversionFactor = product.conversionFactor || 1;
  const sellingQty = calculateSellingUnitStock(baseQty, conversionFactor);
  const baseUnit = product.baseUnit || product.unit || '';
  const sellingUnit = product.sellingUnit || '';

  if (baseQty === 0) {
    return `0 ${sellingUnit || baseUnit}`;
  }

  // Show both units: "10 Packets (1000 pieces available)"
  return `${baseQty} ${baseUnit} (${sellingQty} ${sellingUnit} available)`;
};

/**
 * Get stock display for inventory table
 * @param {Object} product - Product object
 * @returns {Object} { primary: string, secondary: string }
 */
export const getStockDisplay = (product) => {
  if (!product.isLooseProduct) {
    return {
      primary: `${product.quantity || 0}`,
      secondary: product.unit || '',
    };
  }

  const baseQty = product.quantity || 0;
  const conversionFactor = product.conversionFactor || 1;
  const sellingQty = calculateSellingUnitStock(baseQty, conversionFactor);
  const baseUnit = product.baseUnit || product.unit || '';
  const sellingUnit = product.sellingUnit || '';

  return {
    primary: `${sellingQty} ${sellingUnit}`,
    secondary: `${baseQty} ${baseUnit}`,
  };
};

/**
 * Validate loose product configuration
 * @param {Object} config - Loose product configuration
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateLooseProductConfig = (config) => {
  const errors = [];

  if (config.isLooseProduct) {
    if (!config.baseUnit || !config.baseUnit.trim()) {
      errors.push('Base Unit is required for loose products');
    }
    if (!config.sellingUnit || !config.sellingUnit.trim()) {
      errors.push('Selling Unit is required for loose products');
    }
    if (!config.conversionFactor || config.conversionFactor <= 0) {
      errors.push('Conversion Factor must be greater than 0');
    }
    if (config.baseUnit === config.sellingUnit) {
      errors.push('Base Unit and Selling Unit must be different');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Initialize loose product fields for new product
 * @param {Object} productData - Product data
 * @returns {Object} Product data with loose product fields initialized
 */
export const initializeLooseProductFields = (productData) => {
  return {
    ...productData,
    isLooseProduct: productData.isLooseProduct || false,
    baseUnit: productData.baseUnit || productData.unit || '',
    sellingUnit: productData.sellingUnit || '',
    conversionFactor: productData.conversionFactor || 1,
    stockInSellingUnit: productData.isLooseProduct
      ? calculateSellingUnitStock(productData.quantity || 0, productData.conversionFactor || 1)
      : productData.quantity || 0,
    baseUnitCost: productData.baseUnitCost || productData.costPrice || 0,
    baseUnitSellingPrice: productData.baseUnitSellingPrice || productData.sellingPrice || 0,
    sellingUnitPrice: productData.isLooseProduct
      ? calculateSellingUnitPrice(
          productData.baseUnitSellingPrice || productData.sellingPrice || 0,
          productData.conversionFactor || 1
        )
      : productData.sellingPrice || 0,
    minSellingQuantity: productData.minSellingQuantity || 1,
  };
};

/**
 * Calculate price for selling quantity (for POS/Billing)
 * @param {Object} product - Product object
 * @param {number} sellingQuantity - Quantity to sell in selling units
 * @returns {number} Total price
 */
export const calculateLooseProductPrice = (product, sellingQuantity) => {
  if (!product.isLooseProduct) {
    return (product.sellingPrice || 0) * sellingQuantity;
  }

  const sellingUnitPrice = product.sellingUnitPrice || 
    calculateSellingUnitPrice(
      product.baseUnitSellingPrice || product.sellingPrice || 0,
      product.conversionFactor || 1
    );

  return sellingUnitPrice * sellingQuantity;
};

/**
 * Deduct stock for loose product sale
 * @param {Object} product - Product object
 * @param {number} sellingQuantity - Quantity sold in selling units
 * @returns {number} New base unit quantity
 */
export const deductLooseProductStock = (product, sellingQuantity) => {
  if (!product.isLooseProduct) {
    return (product.quantity || 0) - sellingQuantity;
  }

  const baseQuantity = product.quantity || 0;
  const conversionFactor = product.conversionFactor || 1;
  const baseUnitsDeducted = convertToBaseUnit(sellingQuantity, conversionFactor);

  return Math.max(0, baseQuantity - baseUnitsDeducted);
};
