/**
 * Enhanced Product Matching System
 * Provides intelligent product search and matching with multiple algorithms
 * Features:
 * - Fuzzy string matching with multiple algorithms
 * - Phonetic matching for pronunciation variations
 * - Brand and category-based matching
 * - SKU and barcode matching
 * - Learning from user corrections
 * - Confidence scoring
 */

import { similarity } from '../components/billing/VoiceBilling/logic';

// Enhanced phonetic mapping for Indian accents (Hindi, English, Marathi, Hinglish)
const PHONETIC_MAP = {
  // Brand names with Indian accent variations
  'colgate': ['col get', 'col gate', 'colgat', 'kolkata', 'kolgate', 'kolget', 'kolkata'],
  'dabur': ['dabar', 'dab ur', 'daboor', 'daboor', 'dabur', 'daboor'],
  'parle': ['parley', 'parly', 'parli', 'parle', 'parley', 'parli'],
  'haldiram': ['haldirum', 'haldiran', 'haldi ram', 'haldiram', 'haldi ram', 'haldirum'],
  'parachute': ['parachut', 'parashut', 'parachoot', 'parachute', 'parashut', 'parachoot'],
  'whey': ['way', 'whey', 'wey', 'way', 'wey', 'whey'],
  'protein': ['proteen', 'protean', 'protiin', 'protein', 'proteen', 'protiin'],
  'chocolate': ['choclate', 'choklate', 'choclet', 'chocolate', 'choklate', 'choclet'],
  'biscuit': ['biskit', 'biscut', 'biskut', 'biscuit', 'biskit', 'biscut'],
  'toothpaste': ['tooth pest', 'toothpest', 'tooth paste', 'toothpaste', 'tooth pest', 'toothpest'],
  'shampoo': ['shampo', 'shampoo', 'shampou', 'shampoo', 'shampo', 'shampou'],
  'soap': ['soup', 'sop', 'soap', 'soap', 'soup', 'sop'],
  
  // Common products with Indian accent variations
  'milk': ['milk', 'milke', 'mylk', 'doodh', 'milk', 'milke'],
  'bread': ['bred', 'bread', 'brad', 'roti', 'double roti', 'bread'],
  'butter': ['buter', 'butter', 'butar', 'makhan', 'white butter', 'butter'],
  'cheese': ['chees', 'cheese', 'cheez', 'paneer', 'cottage cheese', 'cheese'],
  'yogurt': ['yogurt', 'yoghurt', 'yogart', 'dahi', 'curd', 'yogurt'],
  'juice': ['juis', 'juice', 'jus', 'ras', 'fresh juice', 'juice'],
  'water': ['watar', 'water', 'woter', 'pani', 'mineral water', 'water'],
  'sugar': ['suger', 'sugar', 'shugar', 'chini', 'white sugar', 'sugar'],
  'salt': ['salt', 'solt', 'sault', 'namak', 'rock salt', 'salt'],
  'oil': ['oyl', 'oil', 'oel', 'tel', 'cooking oil', 'oil'],
  'rice': ['rys', 'rice', 'raice', 'chawal', 'basmati rice', 'rice'],
  'wheat': ['wheet', 'wheat', 'wheat', 'gehun', 'atta', 'wheat'],
  'flour': ['flor', 'flour', 'flawer', 'atta', 'maida', 'flour'],
  'spices': ['spais', 'spices', 'spyces', 'masala', 'masale', 'spices'],
  'masala': ['masala', 'masaala', 'masaala', 'masala', 'spice mix', 'garam masala'],
  'garam': ['garam', 'garam', 'garam', 'garam', 'hot spices', 'mixed spices'],
  
  // Indian spices with multiple accent variations
  'haldi': ['haldi', 'haldee', 'haldi', 'haldi', 'turmeric', 'yellow powder'],
  'jeera': ['jeera', 'jeera', 'jeera', 'jeera', 'cumin', 'zeera'],
  'dhaniya': ['dhaniya', 'dhaniya', 'dhaniya', 'dhaniya', 'coriander', 'dhaniya powder'],
  'mirchi': ['mirchi', 'mirchi', 'mirchi', 'lal mirchi', 'red chili', 'red pepper'],
  'adrak': ['adrak', 'adrak', 'adrak', 'adrak', 'ginger', 'fresh ginger'],
  'lasun': ['lasun', 'lasun', 'lasun', 'lasun', 'garlic', 'fresh garlic'],
  'pyaaz': ['pyaaz', 'pyaaz', 'pyaaz', 'pyaaz', 'onion', 'red onion'],
  'tamatar': ['tamatar', 'tamatar', 'tamatar', 'tamatar', 'tomato', 'red tomato'],
  'aalu': ['aalu', 'aalu', 'aalu', 'aalu', 'potato', 'aloo'],
  'gobi': ['gobi', 'gobi', 'gobi', 'gobi', 'cauliflower', 'phool gobi'],
  'baingan': ['baingan', 'baingan', 'baingan', 'baingan', 'eggplant', 'brinjal'],
  'kaddu': ['kaddu', 'kaddu', 'kaddu', 'kaddu', 'pumpkin', 'kaddu'],
  'palak': ['palak', 'palak', 'palak', 'palak', 'spinach', 'palak leaves'],
  'methi': ['methi', 'methi', 'methi', 'methi', 'fenugreek', 'methi leaves'],
  'pudina': ['pudina', 'pudina', 'pudina', 'pudina', 'mint', 'pudina leaves'],
  'kothmir': ['kothmir', 'kothmir', 'kothmir', 'dhaniya patta', 'coriander leaves', 'dhaniya'],
  'ajwain': ['ajwain', 'ajwain', 'ajwain', 'ajwain', 'carom seeds', 'ajwain'],
  'saunf': ['saunf', 'saunf', 'saunf', 'saunf', 'fennel seeds', 'saunf'],
  'elaichi': ['elaichi', 'elaichi', 'elaichi', 'elaichi', 'cardamom', 'elaichi'],
  'dalchini': ['dalchini', 'dalchini', 'dalchini', 'dalchini', 'cinnamon', 'dalchini'],
  'tej patta': ['tej patta', 'tej patta', 'tej patta', 'tej patta', 'bay leaf', 'tej patta'],
  'badi elaichi': ['badi elaichi', 'badi elaichi', 'badi elaichi', 'badi elaichi', 'black cardamom', 'badi elaichi'],
  'star anise': ['star anise', 'star anise', 'star anise', 'star anise', 'star anise', 'star anise'],
  'bay leaf': ['bay leaf', 'bay leaf', 'bay leaf', 'bay leaf', 'bay leaf', 'bay leaf'],
  'cloves': ['cloves', 'cloves', 'cloves', 'cloves', 'cloves', 'cloves'],
  'cardamom': ['cardamom', 'cardamom', 'cardamom', 'cardamom', 'cardamom', 'cardamom'],
  'cinnamon': ['cinnamon', 'cinnamon', 'cinnamon', 'cinnamon', 'cinnamon', 'cinnamon'],
  'nutmeg': ['nutmeg', 'nutmeg', 'nutmeg', 'nutmeg', 'nutmeg', 'nutmeg'],
  'mace': ['mace', 'mace', 'mace', 'mace', 'mace', 'mace'],
  'pepper': ['pepper', 'pepper', 'pepper', 'pepper', 'pepper', 'pepper'],
  'cumin': ['cumin', 'cumin', 'cumin', 'cumin', 'cumin', 'cumin'],
  'coriander': ['coriander', 'coriander', 'coriander', 'coriander', 'coriander', 'coriander'],
  'turmeric': ['turmeric', 'turmeric', 'turmeric', 'turmeric', 'turmeric', 'turmeric'],
  'red chili': ['red chili', 'red chili', 'red chili', 'red chili', 'red chili', 'red chili'],
  'green chili': ['green chili', 'green chili', 'green chili', 'green chili', 'green chili', 'green chili'],
  'ginger': ['ginger', 'ginger', 'ginger', 'ginger', 'ginger', 'ginger'],
  'garlic': ['garlic', 'garlic', 'garlic', 'garlic', 'garlic', 'garlic'],
  'onion': ['onion', 'onion', 'onion', 'onion', 'onion', 'onion'],
  'tomato': ['tomato', 'tomato', 'tomato', 'tomato', 'tomato', 'tomato'],
  'potato': ['potato', 'potato', 'potato', 'potato', 'potato', 'potato'],
  'cauliflower': ['cauliflower', 'cauliflower', 'cauliflower', 'cauliflower', 'cauliflower', 'cauliflower'],
  'eggplant': ['eggplant', 'eggplant', 'eggplant', 'eggplant', 'eggplant', 'eggplant'],
  'pumpkin': ['pumpkin', 'pumpkin', 'pumpkin', 'pumpkin', 'pumpkin', 'pumpkin'],
  'spinach': ['spinach', 'spinach', 'spinach', 'spinach', 'spinach', 'spinach'],
  'fenugreek': ['fenugreek', 'fenugreek', 'fenugreek', 'fenugreek', 'fenugreek', 'fenugreek'],
  'mint': ['mint', 'mint', 'mint', 'mint', 'mint', 'mint'],
  'coriander leaves': ['coriander leaves', 'coriander leaves', 'coriander leaves', 'coriander leaves', 'coriander leaves', 'coriander leaves'],
  'curry leaves': ['curry leaves', 'curry leaves', 'curry leaves', 'curry leaves', 'curry leaves', 'curry leaves'],
};

// Common product variations and synonyms
const PRODUCT_SYNONYMS = {
  'milk': ['doodh', 'milk', 'dairy milk'],
  'bread': ['roti', 'bread', 'double roti'],
  'butter': ['makhan', 'butter', 'white butter'],
  'cheese': ['paneer', 'cheese', 'cottage cheese'],
  'yogurt': ['dahi', 'yogurt', 'curd'],
  'juice': ['ras', 'juice', 'fresh juice'],
  'water': ['pani', 'water', 'mineral water'],
  'sugar': ['chini', 'sugar', 'white sugar'],
  'salt': ['namak', 'salt', 'rock salt'],
  'oil': ['tel', 'oil', 'cooking oil'],
  'rice': ['chawal', 'rice', 'basmati rice'],
  'wheat': ['gehun', 'wheat', 'atta'],
  'flour': ['atta', 'flour', 'maida'],
  'spices': ['masala', 'spices', 'masale'],
  'masala': ['masala', 'spice mix', 'garam masala'],
  'garam masala': ['garam masala', 'hot spices', 'mixed spices'],
  'turmeric': ['haldi', 'turmeric', 'yellow powder'],
  'cumin': ['jeera', 'cumin', 'zeera'],
  'coriander': ['dhaniya', 'coriander', 'dhaniya powder'],
  'red chili': ['lal mirchi', 'red chili', 'red pepper'],
  'green chili': ['hari mirchi', 'green chili', 'green pepper'],
  'ginger': ['adrak', 'ginger', 'fresh ginger'],
  'garlic': ['lasun', 'garlic', 'fresh garlic'],
  'onion': ['pyaaz', 'onion', 'red onion'],
  'tomato': ['tamatar', 'tomato', 'red tomato'],
  'potato': ['aalu', 'potato', 'aloo'],
  'cauliflower': ['gobi', 'cauliflower', 'phool gobi'],
  'eggplant': ['baingan', 'eggplant', 'brinjal'],
  'pumpkin': ['kaddu', 'pumpkin', 'kaddu'],
  'spinach': ['palak', 'spinach', 'palak leaves'],
  'fenugreek': ['methi', 'fenugreek', 'methi leaves'],
  'mint': ['pudina', 'mint', 'pudina leaves'],
  'coriander leaves': ['dhaniya patta', 'coriander leaves', 'dhaniya'],
  'curry leaves': ['kadi patta', 'curry leaves', 'kari patta'],
};

// Weighted scoring system
const SCORE_WEIGHTS = {
  EXACT_MATCH: 1.0,
  FUZZY_MATCH: 0.8,
  PHONETIC_MATCH: 0.7,
  BRAND_MATCH: 0.6,
  CATEGORY_MATCH: 0.5,
  SKU_MATCH: 0.9,
  PARTIAL_MATCH: 0.4,
  SYNONYM_MATCH: 0.6,
};

/**
 * Normalize text for matching
 */
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if two strings are phonetically similar
 */
function isPhoneticallySimilar(str1, str2) {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  // Check direct phonetic mapping
  for (const [correct, variations] of Object.entries(PHONETIC_MAP)) {
    if (variations.includes(normalized1) && variations.includes(normalized2)) {
      return true;
    }
    if (normalized1 === correct && variations.includes(normalized2)) {
      return true;
    }
    if (normalized2 === correct && variations.includes(normalized1)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if two strings are synonyms
 */
function isSynonym(str1, str2) {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  for (const [key, synonyms] of Object.entries(PRODUCT_SYNONYMS)) {
    if (synonyms.includes(normalized1) && synonyms.includes(normalized2)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate fuzzy match score using multiple algorithms
 */
function calculateFuzzyScore(str1, str2) {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  if (normalized1 === normalized2) {
    return SCORE_WEIGHTS.EXACT_MATCH;
  }
  
  // Check phonetic similarity
  if (isPhoneticallySimilar(normalized1, normalized2)) {
    return SCORE_WEIGHTS.PHONETIC_MATCH;
  }
  
  // Check synonym similarity
  if (isSynonym(normalized1, normalized2)) {
    return SCORE_WEIGHTS.SYNONYM_MATCH;
  }
  
  // Use existing similarity function
  const similarityScore = similarity(normalized1, normalized2);
  
  // Boost score for partial matches
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return Math.max(similarityScore, SCORE_WEIGHTS.PARTIAL_MATCH);
  }
  
  return similarityScore;
}

/**
 * Extract product information from voice input
 */
export function extractProductInfo(voiceInput, inventory = []) {
  const normalizedInput = normalizeText(voiceInput);
  const words = normalizedInput.split(' ');
  
  // Extract quantity
  const quantityMatch = normalizedInput.match(/(\d+)\s*(?:pieces?|pcs?|units?|nos?|kg|gm|g|ml|l|liters?|litres?)/i);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
  
  // Extract unit
  const unitMatch = normalizedInput.match(/(\d+)\s*(kg|gm|g|ml|l|liters?|litres?|pieces?|pcs?|units?|nos?)/i);
  const unit = unitMatch ? unitMatch[2] : 'pieces';
  
  // Extract brand (look for common brand names)
  const brands = ['colgate', 'dabur', 'parle', 'haldiram', 'parachute', 'whey', 'protein', 'chocolate', 'biscuit'];
  const foundBrand = brands.find(brand => normalizedInput.includes(brand));
  
  // Extract category
  const categories = ['toothpaste', 'shampoo', 'soap', 'milk', 'bread', 'butter', 'cheese', 'yogurt', 'juice', 'water', 'sugar', 'salt', 'oil', 'rice', 'wheat', 'flour', 'spices', 'masala'];
  const foundCategory = categories.find(category => normalizedInput.includes(category));
  
  return {
    originalInput: voiceInput,
    normalizedInput,
    words,
    quantity,
    unit,
    brand: foundBrand,
    category: foundCategory,
  };
}

/**
 * Find best matching products from inventory with enhanced brand and multi-product support
 */
export function findMatchingProducts(voiceInput, inventory = [], options = {}) {
  const {
    maxResults = 10,
    minScore = 0.3,
    includeBrand = true,
    includeCategory = true,
    includeSKU = true,
  } = options;
  
  const productInfo = extractProductInfo(voiceInput, inventory);
  const matches = [];
  const normalizedInput = normalizeText(voiceInput);
  
  // Group products by brand for better brand-based matching
  const brandGroups = {};
  for (const product of inventory) {
    if (product.brand) {
      const brand = normalizeText(product.brand);
      if (!brandGroups[brand]) {
        brandGroups[brand] = [];
      }
      brandGroups[brand].push(product);
    }
  }
  
  for (const product of inventory) {
    let totalScore = 0;
    let matchCount = 0;
    const matchDetails = {
      name: 0,
      brand: 0,
      category: 0,
      sku: 0,
      description: 0,
    };
    
    // Match product name
    const nameScore = calculateFuzzyScore(voiceInput, product.name || product.productName || '');
    if (nameScore > 0) {
      totalScore += nameScore * 0.4; // 40% weight for name
      matchCount++;
      matchDetails.name = nameScore;
    }
    
    // Enhanced brand matching
    if (includeBrand && product.brand) {
      const brandScore = calculateFuzzyScore(voiceInput, product.brand);
      if (brandScore > 0) {
        totalScore += brandScore * 0.25; // 25% weight for brand (increased)
        matchCount++;
        matchDetails.brand = brandScore;
      }
    }
    
    // Match category
    if (includeCategory && product.category) {
      const categoryScore = calculateFuzzyScore(voiceInput, product.category);
      if (categoryScore > 0) {
        totalScore += categoryScore * 0.15; // 15% weight for category
        matchCount++;
        matchDetails.category = categoryScore;
      }
    }
    
    // Match SKU
    if (includeSKU && product.sku) {
      const skuScore = calculateFuzzyScore(voiceInput, product.sku);
      if (skuScore > 0) {
        totalScore += skuScore * 0.15; // 15% weight for SKU
        matchCount++;
        matchDetails.sku = skuScore;
      }
    }
    
    // Match description
    if (product.description) {
      const descScore = calculateFuzzyScore(voiceInput, product.description);
      if (descScore > 0) {
        totalScore += descScore * 0.05; // 5% weight for description (reduced)
        matchCount++;
        matchDetails.description = descScore;
      }
    }
    
    // Calculate final score
    const finalScore = matchCount > 0 ? totalScore / matchCount : 0;
    
    if (finalScore >= minScore) {
      matches.push({
        product,
        score: finalScore,
        matchDetails,
        confidence: Math.min(finalScore * 100, 100),
        matchedFields: Object.entries(matchDetails)
          .filter(([_, score]) => score > 0)
          .map(([field, _]) => field),
        isBrandMatch: matchDetails.brand > 0,
        brand: product.brand,
      });
    }
  }
  
  // Sort by score and return top matches
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Check if a brand has multiple products and should show selection
 */
export function shouldShowBrandSelection(voiceInput, inventory = [], options = {}) {
  const normalizedInput = normalizeText(voiceInput);
  const brandGroups = {};
  
  // Group products by brand
  for (const product of inventory) {
    if (product.brand) {
      const brand = normalizeText(product.brand);
      if (!brandGroups[brand]) {
        brandGroups[brand] = [];
      }
      brandGroups[brand].push(product);
    }
  }
  
  // Find matching brands
  const matchingBrands = [];
  for (const [brand, products] of Object.entries(brandGroups)) {
    const brandScore = calculateFuzzyScore(voiceInput, brand);
    if (brandScore > 0.6) { // High confidence brand match
      matchingBrands.push({ brand, products, score: brandScore });
    }
  }
  
  // Check if any brand has multiple products
  for (const { brand, products } of matchingBrands) {
    if (products.length > 1) {
      return {
        shouldShow: true,
        brand,
        products,
        message: `Found ${products.length} products for brand "${brand}". Please choose:`
      };
    }
  }
  
  return { shouldShow: false };
}

/**
 * Get product suggestions based on voice input
 */
export function getProductSuggestions(voiceInput, inventory = [], options = {}) {
  const matches = findMatchingProducts(voiceInput, inventory, options);
  
  return matches.map(match => ({
    key: match.product.id || match.product.sku,
    label: match.product.name || match.product.productName,
    sublabel: [
      match.product.brand,
      match.product.category,
      match.product.sku
    ].filter(Boolean).join(' • '),
    price: match.product.sellingPrice || match.product.price || match.product.mrp,
    unit: match.product.unit || match.product.packSize,
    confidence: match.confidence,
    matchDetails: match.matchDetails,
    matchedFields: match.matchedFields,
    product: match.product,
  }));
}

/**
 * Learn from user corrections
 */
export function learnFromCorrection(originalInput, selectedProduct, inventory = []) {
  // This could be enhanced to store learning data in localStorage or send to backend
  const learningData = {
    originalInput: normalizeText(originalInput),
    selectedProduct: {
      id: selectedProduct.id,
      name: selectedProduct.name || selectedProduct.productName,
      brand: selectedProduct.brand,
      category: selectedProduct.category,
      sku: selectedProduct.sku,
    },
    timestamp: new Date().toISOString(),
  };
  
  // Store in localStorage for now
  try {
    const existingData = JSON.parse(localStorage.getItem('voiceLearningData') || '[]');
    existingData.push(learningData);
    
    // Keep only last 100 corrections
    if (existingData.length > 100) {
      existingData.splice(0, existingData.length - 100);
    }
    
    localStorage.setItem('voiceLearningData', JSON.stringify(existingData));
  } catch (error) {
    console.warn('Failed to save learning data:', error);
  }
}

/**
 * Get learning-based suggestions
 */
export function getLearningSuggestions(voiceInput, inventory = []) {
  try {
    const learningData = JSON.parse(localStorage.getItem('voiceLearningData') || '[]');
    const normalizedInput = normalizeText(voiceInput);
    
    // Find similar past corrections
    const similarCorrections = learningData
      .filter(item => similarity(normalizedInput, item.originalInput) > 0.6)
      .sort((a, b) => similarity(normalizedInput, b.originalInput) - similarity(normalizedInput, a.originalInput))
      .slice(0, 3);
    
    // Convert to product suggestions
    return similarCorrections.map(correction => {
      const product = inventory.find(p => p.id === correction.selectedProduct.id);
      if (!product) return null;
      
      return {
        key: `learned-${correction.timestamp}`,
        label: product.name || product.productName,
        sublabel: `Learned from: "${correction.originalInput}"`,
        price: product.sellingPrice || product.price || product.mrp,
        unit: product.unit || product.packSize,
        confidence: 95, // High confidence for learned suggestions
        isLearned: true,
        product,
      };
    }).filter(Boolean);
  } catch (error) {
    console.warn('Failed to load learning data:', error);
    return [];
  }
}

/**
 * Enhanced product matcher with learning
 */
export function enhancedProductMatcher(voiceInput, inventory = [], options = {}) {
  const {
    includeLearning = true,
    ...matcherOptions
  } = options;
  
  // Get regular suggestions
  const regularSuggestions = getProductSuggestions(voiceInput, inventory, matcherOptions);
  
  // Get learning-based suggestions
  const learningSuggestions = includeLearning ? getLearningSuggestions(voiceInput, inventory) : [];
  
  // Combine and deduplicate
  const allSuggestions = [...learningSuggestions, ...regularSuggestions];
  const uniqueSuggestions = allSuggestions.reduce((acc, suggestion) => {
    const existing = acc.find(item => item.product.id === suggestion.product.id);
    if (!existing) {
      acc.push(suggestion);
    } else if (suggestion.confidence > existing.confidence) {
      // Replace with higher confidence suggestion
      const index = acc.indexOf(existing);
      acc[index] = suggestion;
    }
    return acc;
  }, []);
  
  return uniqueSuggestions;
}
