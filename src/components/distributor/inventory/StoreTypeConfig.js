/**
 * Universal Store Type Configuration
 * Supports FMCG, Pharma, Retail, and any store type
 */

export const STORE_TYPES = {
  FMCG: {
    name: 'FMCG (Fast Moving Consumer Goods)',
    icon: '🛒',
    defaultAisleWidth: 200,
    defaultAisleHeight: 800,
    defaultRackWidth: 50,
    defaultRackHeight: 600,
    categories: ['Grocery', 'Dairy', 'Beverages', 'Personal Care', 'Household', 'Snacks', 'Bakery', 'Frozen'],
    colorScheme: {
      primary: '#10b981',
      secondary: '#059669',
      accent: '#34d399'
    }
  },
  PHARMA: {
    name: 'Pharmacy',
    icon: '💊',
    defaultAisleWidth: 150,
    defaultAisleHeight: 600,
    defaultRackWidth: 40,
    defaultRackHeight: 500,
    categories: ['Prescription', 'OTC', 'Vitamins', 'First Aid', 'Personal Care', 'Baby Care'],
    colorScheme: {
      primary: '#3b82f6',
      secondary: '#2563eb',
      accent: '#60a5fa'
    }
  },
  RETAIL: {
    name: 'Retail Store',
    icon: '🏪',
    defaultAisleWidth: 180,
    defaultAisleHeight: 700,
    defaultRackWidth: 45,
    defaultRackHeight: 550,
    categories: ['Electronics', 'Clothing', 'Home & Garden', 'Stationery', 'Toys', 'Books', 'Sports'],
    colorScheme: {
      primary: '#8b5cf6',
      secondary: '#7c3aed',
      accent: '#a78bfa'
    }
  },
  WAREHOUSE: {
    name: 'Warehouse',
    icon: '📦',
    defaultAisleWidth: 300,
    defaultAisleHeight: 1000,
    defaultRackWidth: 80,
    defaultRackHeight: 800,
    categories: ['Bulk Items', 'Pallets', 'Raw Materials', 'Finished Goods'],
    colorScheme: {
      primary: '#f59e0b',
      secondary: '#d97706',
      accent: '#fbbf24'
    }
  },
  CUSTOM: {
    name: 'Custom Store',
    icon: '🏬',
    defaultAisleWidth: 200,
    defaultAisleHeight: 800,
    defaultRackWidth: 50,
    defaultRackHeight: 600,
    categories: [],
    colorScheme: {
      primary: '#6b7280',
      secondary: '#4b5563',
      accent: '#9ca3af'
    }
  }
};

export const getStoreTypeConfig = (storeType) => {
  return STORE_TYPES[storeType] || STORE_TYPES.CUSTOM;
};

export const getCategoryColor = (category, storeType = 'FMCG') => {
  const config = getStoreTypeConfig(storeType);
  const categoryIndex = config.categories.indexOf(category);
  const colors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];
  return colors[categoryIndex % colors.length] || config.colorScheme.primary;
};

