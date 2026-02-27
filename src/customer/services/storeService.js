/**
 * Store Service - Firebase operations for stores and products
 */

import { db } from '../../firebase/firebaseConfig';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  GeoPoint
} from 'firebase/firestore';

// Haversine formula to calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Get nearby stores based on user location
 * Note: For production, use GeoFirestore or Firebase GeoHash for efficient geo queries
 */
export const getNearbyStores = async (userLat, userLng, radiusKm = 50, maxStores = 20) => {
  try {
    console.log('[StoreService] Fetching nearby stores...', { userLat, userLng, radiusKm });
    
    // Check if db is initialized
    if (!db) {
      console.error('[StoreService] Database not initialized!');
      throw new Error('Database not initialized. Please check your connection.');
    }
    
    console.log('[StoreService] Database initialized, querying stores collection...');
    
    // Query all active stores from the stores collection
    const storesRef = collection(db, 'stores');
    const snapshot = await getDocs(storesRef);
    
    console.log('[StoreService] Fetched stores:', snapshot.size);
    const stores = [];

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      
      // Skip if explicitly inactive
      if (data.isActive === false) return;
      
      // Get location coordinates
      let storeLat, storeLng;
      
      if (data.location) {
        storeLat = data.location.latitude || data.location._lat;
        storeLng = data.location.longitude || data.location._long;
      }
      
      // Calculate distance if both locations exist
      let distance = null;
      if (storeLat && storeLng && userLat && userLng) {
        distance = calculateDistance(userLat, userLng, storeLat, storeLng);
      }
      
      // Check if customer is within delivery radius
      const deliveryRadius = data.deliveryRadius || 10; // Default 10km if not set
      const isWithinDeliveryRange = distance !== null ? distance <= deliveryRadius : true;
      
      // Add store with distance and delivery range info
      stores.push({
        id: docSnap.id,
        ...data,
        distance: distance !== null ? Math.round(distance * 10) / 10 : null,
        deliveryRadius: deliveryRadius,
        isWithinDeliveryRange: isWithinDeliveryRange,
        deliveryAvailable: data.deliveryEnabled !== false && isWithinDeliveryRange
      });
    });

    // Sort by distance (nulls at end)
    stores.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
    
    // DEV MODE: Return all stores regardless of distance
    // In production, filter by radiusKm:
    // return stores.filter(s => s.distance === null || s.distance <= radiusKm).slice(0, maxStores);
    return stores.slice(0, maxStores);
  } catch (error) {
    console.error('Error fetching nearby stores:', error);
    // Return empty array instead of throwing to prevent blank page
    // The component will handle the empty state gracefully
    if (error.code === 'permission-denied' || error.code === 'unavailable') {
      console.warn('Firebase permission or availability issue. Returning empty stores list.');
      return [];
    }
    throw error;
  }
};

/**
 * Get store details by ID
 */
export const getStoreById = async (storeId) => {
  try {
    const storeDoc = await getDoc(doc(db, 'stores', storeId));
    if (storeDoc.exists()) {
      return { id: storeDoc.id, ...storeDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching store:', error);
    throw error;
  }
};

/**
 * Get products from a store
 * Fetches all products synced to marketplace
 */
export const getStoreProducts = async (storeId, category = null, limitCount = 100) => {
  try {
    const productsRef = collection(db, 'stores', storeId, 'products');
    const snapshot = await getDocs(productsRef);
    
    let products = snapshot.docs.map(doc => ({
      id: doc.id,
      storeId,
      ...doc.data()
    }));

    // Filter products - be permissive, show all synced products
    products = products.filter(p => {
      // Check if synced to marketplace (multiple possible field names)
      const isOnMarketplace = p.onMarketplace === true || 
                              p.isAvailable === true || 
                              p.syncedToMarketplace === true ||
                              p.marketplaceEnabled === true ||
                              // If none of these exist, include the product (legacy data)
                              (p.onMarketplace === undefined && p.isAvailable === undefined);
      
      // Category filter (if specified)
      const matchesCategory = !category || p.category === category;
      
      return isOnMarketplace && matchesCategory;
    });

    // Sort: in-stock first, then by category, then by name
    products.sort((a, b) => {
      // Out of stock items go to end
      const aOutOfStock = a.stock !== undefined && a.stock <= 0;
      const bOutOfStock = b.stock !== undefined && b.stock <= 0;
      if (aOutOfStock !== bOutOfStock) return aOutOfStock ? 1 : -1;
      
      // Then by category
      if (a.category !== b.category) {
        return (a.category || '').localeCompare(b.category || '');
      }
      // Then by name
      return (a.name || '').localeCompare(b.name || '');
    });

    return products.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching store products:', error);
    throw error;
  }
};

/**
 * Get store categories - extracts from products
 */
export const getStoreCategories = async (storeId) => {
  try {
    // First check if store has categories array
    const storeDoc = await getDoc(doc(db, 'stores', storeId));
    if (storeDoc.exists() && storeDoc.data().categories?.length > 0) {
      return storeDoc.data().categories;
    }

    // Otherwise, extract unique categories from ALL products
    const productsRef = collection(db, 'stores', storeId, 'products');
    const snapshot = await getDocs(productsRef);
    
    const categoriesSet = new Set();
    
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      // Include category if product has one
      if (data.category) {
        categoriesSet.add(data.category);
      }
    });

    // Convert to array and sort alphabetically
    const categories = Array.from(categoriesSet).sort();
    
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

/**
 * Normalize text for search (lowercase, trim)
 */
const toSearch = (s) => (s || '').toLowerCase().trim();

/**
 * Check if product matches search (word-level + full-string, name/brand/category/sku/description/keywords)
 */
const productMatchesSearch = (product, searchLower, searchWords) => {
  const name = toSearch(product.name);
  const brand = toSearch(product.brand);
  const category = toSearch(product.category);
  const sku = toSearch(product.sku);
  const desc = toSearch(product.description);
  const keywords = (product.searchKeywords || []).map((k) => toSearch(k));

  const fields = [name, brand, category, sku, desc, ...keywords].filter(Boolean);
  const fullMatch = fields.some((f) => f.includes(searchLower));
  const wordMatch = searchWords.length > 0 && searchWords.some((w) => fields.some((f) => f.includes(w)));
  return fullMatch || wordMatch;
};

/**
 * Check if store matches search (name, category, description)
 */
const storeMatchesSearch = (store, searchLower, searchWords) => {
  const name = toSearch(store.businessName || store.name);
  const category = toSearch(store.category);
  const desc = toSearch(store.description);
  const fields = [name, category, desc].filter(Boolean);
  const fullMatch = fields.some((f) => f.includes(searchLower));
  const wordMatch = searchWords.length > 0 && searchWords.some((w) => fields.some((f) => f.includes(w)));
  return fullMatch || wordMatch;
};

/**
 * Advanced search: products + stores, brand/sku/word-level, wider radius
 * Returns { products, stores } – products with store info, stores with matchedProductCount & sample products
 */
export const advancedSearch = async (searchTerm, userLat, userLng, options = {}) => {
  const { radiusKm = 50, maxStores = 30, maxProductsPerStore = 150, maxProducts = 80, maxStoresInResult = 15 } = options;

  try {
    const nearbyStores = await getNearbyStores(userLat, userLng, radiusKm, maxStores);
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).filter(Boolean);

    const productResults = [];
    const storeMatches = new Map(); // storeId -> { store, matchedProducts[], matchedByName }

    for (const store of nearbyStores) {
      const productsRef = collection(db, 'stores', store.id, 'products');
      const snapshot = await getDocs(productsRef);
      const marketplaceProducts = [];
      snapshot.docs.forEach((d) => {
        const p = d.data();
        const onMarketplace = p.onMarketplace === true || p.isAvailable === true || p.syncedToMarketplace === true ||
          p.marketplaceEnabled === true || (p.onMarketplace === undefined && p.isAvailable === undefined);
        if (!onMarketplace) return;
        marketplaceProducts.push({ id: d.id, ...p });
      });

      const matched = marketplaceProducts.filter((p) => productMatchesSearch(p, searchLower, searchWords));
      const matchedByName = storeMatchesSearch(store, searchLower, searchWords);

      if (matched.length > 0 || matchedByName) {
        const sample = matched.slice(0, 3).map((p) => ({ id: p.id, name: p.name, price: p.sellingPrice || p.price }));
        storeMatches.set(store.id, {
          ...store,
          matchedProductCount: matched.length,
          matchedByName,
          sampleProducts: sample,
        });
      }

      matched.slice(0, maxProductsPerStore).forEach((p) => {
        productResults.push({
          id: p.id,
          storeId: store.id,
          storeName: store.businessName || store.name,
          storeDistance: store.distance,
          ...p,
        });
      });
    }

    // Build stores list: stores that matched by name OR have matching products
    const storesList = Array.from(storeMatches.values())
      .sort((a, b) => {
        if (a.matchedByName && !b.matchedByName) return -1;
        if (!a.matchedByName && b.matchedByName) return 1;
        return (b.matchedProductCount || 0) - (a.matchedProductCount || 0);
      })
      .slice(0, maxStoresInResult);

    // Sort products: exact name/brand match first, then word match, then distance
    productResults.sort((a, b) => {
      const aName = toSearch(a.name);
      const bName = toSearch(b.name);
      const aBrand = toSearch(a.brand);
      const bBrand = toSearch(b.brand);
      const aExact = aName === searchLower || aBrand === searchLower || aName.startsWith(searchLower) || aBrand.startsWith(searchLower);
      const bExact = bName === searchLower || bBrand === searchLower || bName.startsWith(searchLower) || bBrand.startsWith(searchLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      const aDist = a.storeDistance ?? 9999;
      const bDist = b.storeDistance ?? 9999;
      return aDist - bDist;
    });

    return {
      products: productResults.slice(0, maxProducts),
      stores: storesList,
    };
  } catch (error) {
    console.error('Advanced search error:', error);
    throw error;
  }
};

/**
 * Search products across multiple stores (legacy – prefers advancedSearch)
 */
export const searchProducts = async (searchTerm, userLat, userLng, radiusKm = 5) => {
  const { products } = await advancedSearch(searchTerm, userLat, userLng, { radiusKm: radiusKm || 50, maxProducts: 100 });
  return products;
};

/**
 * Get featured/popular products from nearby stores
 */
export const getFeaturedProducts = async (userLat, userLng, radiusKm = 3, limitCount = 20) => {
  try {
    const nearbyStores = await getNearbyStores(userLat, userLng, radiusKm, 10);
    const products = [];

    for (const store of nearbyStores.slice(0, 5)) {
      const productsRef = collection(db, 'stores', store.id, 'products');
      const q = query(
        productsRef,
        where('isAvailable', '==', true),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        products.push({
          id: doc.id,
          storeId: store.id,
          storeName: store.businessName,
          storeDistance: store.distance,
          ...doc.data()
        });
      });
    }

    // Shuffle and return limited
    return products.sort(() => Math.random() - 0.5).slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    // Return empty array instead of throwing to prevent blank page
    if (error.code === 'permission-denied' || error.code === 'unavailable') {
      console.warn('Firebase permission or availability issue. Returning empty products list.');
      return [];
    }
    throw error;
  }
};

/**
 * Get all categories from nearby stores
 */
export const getAllCategories = async (userLat, userLng, radiusKm = 5) => {
  try {
    const nearbyStores = await getNearbyStores(userLat, userLng, radiusKm, 20);
    const categoriesSet = new Set();

    nearbyStores.forEach(store => {
      (store.categories || []).forEach(cat => categoriesSet.add(cat));
    });

    const categories = Array.from(categoriesSet);
    
    // Return with icons/colors
    const categoryMeta = {
      'grocery': { icon: '🛒', color: 'from-green-500 to-green-600' },
      'dairy': { icon: '🥛', color: 'from-blue-400 to-blue-500' },
      'fruits': { icon: '🍎', color: 'from-red-400 to-red-500' },
      'vegetables': { icon: '🥬', color: 'from-green-400 to-green-500' },
      'snacks': { icon: '🍿', color: 'from-yellow-400 to-yellow-500' },
      'beverages': { icon: '🥤', color: 'from-purple-400 to-purple-500' },
      'personal care': { icon: '🧴', color: 'from-pink-400 to-pink-500' },
      'household': { icon: '🏠', color: 'from-indigo-400 to-indigo-500' },
      'medicines': { icon: '💊', color: 'from-teal-400 to-teal-500' },
      'baby care': { icon: '👶', color: 'from-rose-400 to-rose-500' },
      'pet supplies': { icon: '🐕', color: 'from-amber-400 to-amber-500' },
      'stationery': { icon: '📝', color: 'from-cyan-400 to-cyan-500' },
    };

    return categories.map(cat => ({
      name: cat,
      ...(categoryMeta[cat.toLowerCase()] || { icon: '📦', color: 'from-gray-400 to-gray-500' })
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};
