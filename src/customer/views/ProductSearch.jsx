/**
 * ProductSearch - Premium Real-time Search like Blinkit/Zepto/Amazon
 * Features: Autocomplete, Multi-store comparison, Instant suggestions
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaSearch, FaTimes, FaArrowLeft, FaStore, FaMapMarkerAlt,
  FaMinus, FaPlus, FaHistory, FaFire, FaClock, FaTag, FaGift, FaRedo
} from 'react-icons/fa';
import { advancedSearch, getAllCategories, getFeaturedProducts, getNearbyStores } from '../services/storeService';
import { getCustomerOrders } from '../services/orderService';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

// Suggestion row - compact, clean, one line with optional price
const SuggestionRow = ({ suggestion, query, onClick }) => {
  const name = suggestion.name || '';
  const q = (query || '').toLowerCase();
  const idx = name.toLowerCase().indexOf(q);
  const highlight = q && idx >= 0;
  const prefix = highlight ? name.slice(0, idx) : name;
  const match = highlight ? name.slice(idx, idx + q.length) : '';
  const suffix = highlight ? name.slice(idx + q.length) : '';

  const icon =
    suggestion.type === 'product' ? '📦' :
    suggestion.type === 'brand' ? '🏷️' :
    suggestion.type === 'store' ? <FaStore className="text-emerald-400 text-sm" /> :
    suggestion.type === 'recent' ? <FaClock className="text-white/40 text-xs" /> :
    <FaSearch className="text-white/40 text-sm" />;

  const sub =
    suggestion.type === 'product'
      ? (suggestion.storeCount > 1 ? `${suggestion.storeCount} stores` : '')
      : suggestion.type === 'recent' ? 'Recent' : suggestion.type === 'store' ? 'Store' : null;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-3 text-left rounded-lg hover:bg-white/5 active:bg-white/8 transition-colors"
    >
      <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-base">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium text-sm truncate">
          {highlight ? (
            <>
              {prefix}<span className="text-emerald-400">{match}</span>{suffix}
            </>
          ) : (
            name
          )}
        </p>
        {sub && <p className="text-white/40 text-[11px] truncate">{sub}</p>}
      </div>
      {suggestion.price && suggestion.type === 'product' && (
        <span className="text-emerald-400 font-semibold text-sm flex-shrink-0">₹{suggestion.price}</span>
      )}
    </motion.button>
  );
};

// Multi-Store Product Card - Shows same product from different stores
const MultiStoreProductCard = ({ product, stores, cartQuantity, onAdd, onUpdate, onStoreClick }) => {
  const [expanded, setExpanded] = useState(false);
  const lowestPrice = Math.min(...stores.map(s => s.price));
  
  return (
    <motion.div 
      layout
      className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl shadow-black/20"
    >
      {/* Main Product Info */}
      <div className="p-4">
        <div className="flex gap-3">
          {/* Product Image */}
          <div className="w-24 h-24 bg-white/10 rounded-xl flex-shrink-0 overflow-hidden border border-white/10">
            {product.imageUrl || product.image ? (
              <img src={product.imageUrl || product.image} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
            )}
          </div>
          
          {/* Product Details */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white text-sm line-clamp-2 mb-1">{product.name}</h4>
            {product.brand && (
              <p className="text-xs text-white/40 mb-1">Brand: {product.brand}</p>
            )}
            {product.unit && (
              <p className="text-xs text-white/40 mb-2">{product.unit}</p>
            )}
            
            {/* Best Price Badge */}
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                <p className="text-emerald-400 font-bold text-sm">₹{lowestPrice}</p>
              </div>
              <p className="text-xs text-white/40">Best price</p>
            </div>
          </div>
        </div>
        
        {/* Available at multiple stores */}
        {stores.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 py-2 bg-white/5 rounded-lg text-xs text-emerald-400 font-medium hover:bg-white/10 transition"
          >
            Available at {stores.length} stores {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>
      
      {/* Expanded Store List */}
      <AnimatePresence>
        {(expanded || stores.length === 1) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10"
          >
            <div className="p-3 space-y-2 bg-black/20">
              {stores.map((store, idx) => {
                const qty = cartQuantity && store.storeId === cartQuantity.storeId ? cartQuantity.quantity : 0;
                const isLowest = store.price === lowestPrice;
                
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <button
                      onClick={() => onStoreClick(store.storeId)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FaStore className="text-emerald-400 text-xs flex-shrink-0" />
                        <p className="text-white text-sm font-medium truncate">{store.storeName}</p>
                        {isLowest && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded">BEST</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <FaMapMarkerAlt className="text-[10px]" />
                        <span>{store.distance || '0'} km</span>
                        {store.deliveryTime && (
                          <>
                            <FaClock className="text-[10px] ml-1" />
                            <span>{store.deliveryTime} min</span>
                          </>
                        )}
                      </div>
                    </button>
                    
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className={`font-bold text-sm ${isLowest ? 'text-emerald-400' : 'text-white'}`}>
                          ₹{store.price}
                        </p>
                        {store.mrp && store.mrp > store.price && (
                          <p className="text-xs text-white/30 line-through">₹{store.mrp}</p>
                        )}
                      </div>
                      
                      {qty > 0 ? (
                        <div className="flex items-center gap-1 bg-emerald-500 rounded-lg">
                          <button
                            onClick={() => {
                              triggerHaptic();
                              onUpdate(product.id, qty - 1);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-white"
                          >
                            <FaMinus className="text-xs" />
                          </button>
                          <span className="text-white font-semibold min-w-[16px] text-center text-sm">{qty}</span>
                          <button
                            onClick={() => {
                              triggerHaptic();
                              onUpdate(product.id, qty + 1);
                            }}
                            className="w-7 h-7 flex items-center justify-center text-white"
                          >
                            <FaPlus className="text-xs" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            triggerHaptic();
                            onAdd({ ...product, ...store, storeId: store.storeId, storeName: store.storeName });
                          }}
                          className="px-3 py-1.5 bg-emerald-500 text-slate-900 rounded-lg text-xs font-bold hover:bg-emerald-400 transition"
                        >
                          ADD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Trending Searches
const TrendingChip = ({ text, icon, onClick }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-full text-sm text-white font-medium whitespace-nowrap"
  >
    {icon}
    <span>{text}</span>
  </motion.button>
);

const ProductSearch = ({ location, onBack, onStoreSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [productResults, setProductResults] = useState([]);
  const [storeResults, setStoreResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const searchTimeout = useRef(null);
  const suggestionRequestRef = useRef(0);
  const inputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const savedScrollTopRef = useRef(0);
  const searchCacheRef = useRef(new Map());
  const CACHE_TTL_MS = 120000; // 2 min

  const { addToCart, updateQuantity, getItemQuantity, cartStore } = useCart();
  const { customer } = useCustomerAuth();

  // Content sections (pre-search)
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // Prevent keyboard from affecting global layout and restore scroll
  useEffect(() => {
    const scrollContainer = document.querySelector('.customer-scroll');
    if (scrollContainer) {
      scrollContainerRef.current = scrollContainer;
    }

    const handleScroll = () => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        if (searchTimeout.current) {
          clearTimeout(searchTimeout.current);
        }
      };
    }
  }, []);

  const groupedSuggestions = useMemo(() => {
    return {
      product: suggestions.filter((s) => s.type === 'product'),
      store: suggestions.filter((s) => s.type === 'store'),
      brand: suggestions.filter((s) => s.type === 'brand'),
      recent: suggestions.filter((s) => s.type === 'recent'),
    };
  }, [suggestions]);

  // Trending / popular searches (used for instant 1-char suggestions)
  const trendingSearches = [
    { text: 'Milk', icon: '🥛' },
    { text: 'Bread', icon: '🍞' },
    { text: 'Eggs', icon: '🥚' },
    { text: 'Rice', icon: '🍚' },
    { text: 'Juice', icon: '🧃' },
    { text: 'Jam', icon: '🍓' },
    { text: 'Jelly', icon: '🍮' },
    { text: 'Oil', icon: '🫒' },
    { text: 'Sugar', icon: '🧂' },
    { text: 'Tea', icon: '🍵' },
  ];

  // Load initial data: categories, featured products, nearby stores, recent orders
  useEffect(() => {
    const loadInitialData = async () => {
      const lat = location?.lat ?? 19.076;
      const lng = location?.lng ?? 72.8777;

      const saved = localStorage.getItem('flyp_recent_searches');
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved).slice(0, 5));
        } catch (e) {}
      }

      // Parallel fetch for speed
      const [cats, stores, featured] = await Promise.all([
        getAllCategories(lat, lng, 5).catch(() => []),
        getNearbyStores(lat, lng, 50, 12).catch(() => []),
        getFeaturedProducts(lat, lng, 50, 12).catch(() => []),
      ]);
      setCategories(cats);
      setNearbyStores(stores);
      setFeaturedProducts(featured);

      if (customer?.uid) {
        getCustomerOrders(customer.uid, 5)
          .then((orders) => setRecentOrders(orders.slice(0, 3)))
          .catch(() => {});
      }
    };

    loadInitialData();
  }, [location, customer?.uid]);

  const buildSuggestions = (searchTerm, products = [], stores = []) => {
    const q = searchTerm.toLowerCase();
    const out = [];
    const seen = new Set();
    const productStoreCount = new Map();

    products.forEach((p) => {
      const productName = (p.name || '').trim();
      if (!productName) return;
      const key = productName.toLowerCase();
      const bucket = productStoreCount.get(key) || { name: productName, stores: new Set(), lowestPrice: Infinity };
      if (p.storeId) bucket.stores.add(p.storeId);
      const price = p.sellingPrice || p.price || 0;
      if (price > 0 && price < bucket.lowestPrice) bucket.lowestPrice = price;
      productStoreCount.set(key, bucket);
    });

    recentSearches
      .filter((s) => s.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((s) => {
        const key = `recent:${s.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ name: s, type: 'recent' });
      });

    Array.from(productStoreCount.values())
      .sort((a, b) => {
        const aExact = a.name.toLowerCase().startsWith(q);
        const bExact = b.name.toLowerCase().startsWith(q);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 5)
      .forEach((item) => {
        const productKey = `product:${item.name.toLowerCase()}`;
        seen.add(productKey);
        out.push({
          name: item.name,
          type: 'product',
          price: Number.isFinite(item.lowestPrice) ? item.lowestPrice : 0,
          storeCount: item.stores.size || 1,
        });
      });

    products.slice(0, 12).forEach((p) => {
      const brandName = (p.brand || '').trim();
      const brandKey = `brand:${brandName.toLowerCase()}`;
      if (brandName && brandName.toLowerCase().includes(q) && !seen.has(brandKey)) {
        seen.add(brandKey);
        out.push({ name: brandName, type: 'brand' });
      }
    });

    stores.slice(0, 5).forEach((s) => {
      const storeName = s.businessName || s.name;
      const key = `store:${(storeName || '').toLowerCase()}`;
      if (storeName && !seen.has(key)) {
        seen.add(key);
        out.push({ name: storeName, type: 'store' });
      }
    });

    return out.slice(0, 8);
  };

  // Build instant local suggestions (no API) for 1-char or quick feedback
  const buildInstantSuggestions = useCallback((q) => {
    const lower = q.toLowerCase().trim();
    if (!lower) return [];
    const out = [];
    const seen = new Set();
    // Recent searches that start with or contain the query
    recentSearches.forEach((s) => {
      const sl = s.toLowerCase();
      if (sl.startsWith(lower) || sl.includes(lower)) {
        const key = `recent:${sl}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ name: s, type: 'recent' });
        }
      }
    });
    // Trending that start with the query
    trendingSearches.forEach(({ text }) => {
      if (text.toLowerCase().startsWith(lower)) {
        const key = `trending:${text.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ name: text, type: 'product' });
        }
      }
    });
    return out.slice(0, 6);
  }, [recentSearches]);

  // Real-time autocomplete: instant for 1 char, API for 2+ chars
  const handleQueryChange = useCallback((value) => {
    setQuery(value);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setIsSuggesting(false);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // 1 character: instant local suggestions (recent + trending) - no API, no delay
    if (trimmed.length === 1) {
      const instant = buildInstantSuggestions(trimmed);
      setSuggestions(instant);
      setShowSuggestions(instant.length > 0);
      setIsSuggesting(false);
      return;
    }

    // 2+ characters: debounced API call (60ms) with cache + lighter params
    searchTimeout.current = setTimeout(async () => {
      const requestId = ++suggestionRequestRef.current;
      const lat = location?.lat ?? 19.076;
      const lng = location?.lng ?? 72.8777;
      const cacheKey = `${value.toLowerCase()}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
      const cached = searchCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        const next = buildSuggestions(value, cached.products, cached.stores);
        if (requestId === suggestionRequestRef.current) {
          setSuggestions(next);
          setShowSuggestions(next.length > 0);
          setIsSuggesting(false);
        }
        return;
      }
      setIsSuggesting(true);
      try {
        const { products, stores } = await advancedSearch(value, lat, lng, {
          radiusKm: 50,
          maxStores: 4,
          maxProducts: 16,
          maxStoresInResult: 4,
          productsPerStoreLimit: 60,
        });
        if (requestId !== suggestionRequestRef.current) return;
        searchCacheRef.current.set(cacheKey, { products: products || [], stores: stores || [], ts: Date.now() });
        const next = buildSuggestions(value, products || [], stores || []);
        setSuggestions(next);
        setShowSuggestions(next.length > 0);
      } catch (_) {
        if (requestId !== suggestionRequestRef.current) return;
        const fallback = buildInstantSuggestions(value);
        setSuggestions(fallback);
        setShowSuggestions(fallback.length > 0);
      } finally {
        if (requestId === suggestionRequestRef.current) {
          setIsSuggesting(false);
        }
      }
    }, 60);
  }, [recentSearches, location, buildInstantSuggestions]);

  // Perform search
  const performSearch = useCallback(async (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    setShowSuggestions(false);
    setLoading(true);
    setSearched(true);

    const lat = location?.lat ?? 19.076;
    const lng = location?.lng ?? 72.8777;

    try {
      const { products, stores } = await advancedSearch(searchTerm, lat, lng, {
        radiusKm: 50,
        maxStores: 30,
        maxProducts: 100,
        maxStoresInResult: 20,
      });
      
      // Group products by name to show multi-store comparison
      const productMap = {};
      (products || []).forEach(p => {
        const key = p.name.toLowerCase();
        if (!productMap[key]) {
          productMap[key] = {
            product: p,
            stores: []
          };
        }
        productMap[key].stores.push({
          storeId: p.storeId,
          storeName: p.storeName,
          price: p.sellingPrice || p.price,
          mrp: p.mrp,
          distance: p.storeDistance,
          deliveryTime: p.avgDeliveryTime || 30
        });
      });
      
      setProductResults(Object.values(productMap));
      setStoreResults(stores || []);

      const newRecent = [searchTerm, ...recentSearches.filter((s) => s !== searchTerm)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('flyp_recent_searches', JSON.stringify(newRecent));
    } catch (error) {
      console.error('Search error:', error);
      setProductResults([]);
      setStoreResults([]);
    } finally {
      setLoading(false);
    }
  }, [location, recentSearches]);

  // Handle add to cart
  const handleAddToCart = (product) => {
    const store = {
      id: product.storeId,
      businessName: product.storeName,
      deliveryFee: 20,
      minOrderValue: 100
    };
    
    const result = addToCart(product, store);
    if (!result.success && result.error === 'DIFFERENT_STORE') {
      alert(result.message);
    }
  };

  return (
    <div className="customer-screen bg-[#0B0F14]">
      {/* Compact Search Header */}
      <div 
        className="bg-gradient-to-b from-slate-900/95 to-transparent backdrop-blur-xl z-20 border-b border-white/10 flex-shrink-0" 
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => {
              inputRef.current?.blur();
              onBack();
            }}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"
          >
            <FaArrowLeft className="text-white/60 text-sm" />
          </button>
          
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search products, brands, stores..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  performSearch(query);
                  inputRef.current?.blur();
                }
              }}
              onFocus={() => {
                savedScrollTopRef.current = scrollContainerRef.current?.scrollTop || 0;
                if (query.trim().length >= 1) {
                  if (query.trim().length === 1) {
                    const instant = buildInstantSuggestions(query);
                    setSuggestions(instant);
                    setShowSuggestions(instant.length > 0);
                  } else {
                    setShowSuggestions(suggestions.length > 0);
                  }
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowSuggestions(false);
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = savedScrollTopRef.current;
                  }
                }, 120);
              }}
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setProductResults([]);
                  setStoreResults([]);
                  setSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <FaTimes className="text-slate-500 text-sm" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => performSearch(query)}
            disabled={!query.trim() || loading}
            className="px-4 py-2.5 bg-emerald-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-emerald-400 transition disabled:opacity-50 flex-shrink-0"
          >
            {loading ? '...' : 'Go'}
          </button>
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+68px)] z-30 bg-slate-900/98 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl overflow-hidden max-h-[280px] overflow-y-auto"
          >
            {isSuggesting && (
              <div className="py-2 px-3 flex items-center gap-2 border-b border-white/5">
                <div className="w-4 h-4 rounded-full border-2 border-emerald-500/50 border-t-emerald-400 animate-spin" />
                <span className="text-white/50 text-xs">Searching products & stores...</span>
              </div>
            )}
            <div className="py-2">
              {[
                ...groupedSuggestions.product,
                ...groupedSuggestions.store,
                ...groupedSuggestions.brand,
                ...groupedSuggestions.recent,
              ].map((suggestion, idx) => (
                <SuggestionRow
                  key={`${suggestion.type}-${idx}`}
                  suggestion={suggestion}
                  query={query}
                  onClick={() => {
                    setQuery(suggestion.name);
                    performSearch(suggestion.name);
                    inputRef.current?.blur();
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Content */}
      <div className="customer-scroll">
        <div className="px-4 py-4 customer-bottom-spacer">
          
          {/* Before Search - Rich content sections */}
          {!searched && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Promo Banner */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border border-emerald-500/30 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center">
                    <FaGift className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">Free delivery on orders above ₹299</p>
                    <p className="text-white/60 text-xs">Order from your favourite local stores</p>
                  </div>
                </div>
              </motion.div>

              {/* Featured / Offered Products */}
              {featuredProducts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FaTag className="text-orange-500" />
                    <h3 className="text-sm font-semibold text-white">Popular Near You</h3>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                    {featuredProducts.slice(0, 10).map((p, idx) => (
                      <motion.button
                        key={p.id || idx}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setQuery(p.name);
                          performSearch(p.name);
                        }}
                        className="flex-shrink-0 w-28 rounded-xl bg-white/5 border border-white/10 p-3 text-left"
                      >
                        <div className="w-14 h-14 mx-auto rounded-lg bg-white/10 flex items-center justify-center overflow-hidden mb-2">
                          {p.imageUrl || p.image ? (
                            <img src={p.imageUrl || p.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">📦</span>
                          )}
                        </div>
                        <p className="text-white text-xs font-medium truncate">{p.name}</p>
                        <p className="text-emerald-400 text-xs font-semibold">₹{p.sellingPrice || p.price || 0}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby Stores */}
              {nearbyStores.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FaStore className="text-cyan-500" />
                    <h3 className="text-sm font-semibold text-white">Stores Near You</h3>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                    {nearbyStores.slice(0, 8).map((store) => (
                      <motion.button
                        key={store.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onStoreSelect?.(store.id)}
                        className="flex-shrink-0 w-36 rounded-xl bg-white/5 border border-white/10 p-3 text-left flex items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                          <FaStore className="text-white/50" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{store.businessName || store.name}</p>
                          <p className="text-white/50 text-xs flex items-center gap-1">
                            <FaMapMarkerAlt className="flex-shrink-0" />
                            {store.distance != null ? `${store.distance} km` : 'Nearby'}
                          </p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders - Quick Reorder */}
              {recentOrders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FaRedo className="text-emerald-500" />
                    <h3 className="text-sm font-semibold text-white">Reorder</h3>
                  </div>
                  <div className="space-y-2">
                    {recentOrders.map((order) => (
                      <motion.button
                        key={order.id}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onStoreSelect?.(order.storeId)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-left"
                      >
                        <div>
                          <p className="text-white font-medium text-sm">{order.storeName}</p>
                          <p className="text-white/40 text-xs">
                            {order.items?.length || 0} items · ₹{order.total ?? order.subtotal ?? 0}
                          </p>
                        </div>
                        <span className="text-emerald-400 text-xs font-semibold">Reorder</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Searches */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FaFire className="text-orange-500" />
                  <h3 className="text-sm font-semibold text-white">Trending Now</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map((item, idx) => (
                    <TrendingChip
                      key={idx}
                      text={item.text}
                      icon={item.icon}
                      onClick={() => {
                        setQuery(item.text);
                        performSearch(item.text);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FaHistory className="text-white/40" />
                    <h3 className="text-sm font-semibold text-white">Recent Searches</h3>
                  </div>
                  <div className="space-y-2">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setQuery(search);
                          performSearch(search);
                        }}
                        className="flex items-center gap-3 w-full text-left py-2 px-3 rounded-xl hover:bg-white/5 transition"
                      >
                        <FaClock className="text-slate-500 text-sm" />
                        <span className="text-white/70 text-sm">{search}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Categories */}
              {categories.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Browse Categories</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.slice(0, 6).map((cat, idx) => (
                      <motion.button
                        key={idx}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setQuery(cat.name);
                          performSearch(cat.name);
                        }}
                        className={`p-3 rounded-xl bg-gradient-to-br ${cat.color || 'from-white/5 to-white/10'} border border-white/10 text-left`}
                      >
                        <div className="text-2xl mb-1">{cat.icon || '🛒'}</div>
                        <p className="text-white font-medium text-sm">{cat.name}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Loading State */}
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-white/60 text-sm">Searching across stores...</p>
            </motion.div>
          )}

          {/* Search Results */}
          {searched && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">
                  {productResults.length + storeResults.length} results for <span className="text-white font-medium">"{query}"</span>
                </p>
              </div>

              {productResults.length > 0 || storeResults.length > 0 ? (
                <>
                  {/* Products with Multi-Store Comparison */}
                  {productResults.length > 0 && (
                    <div>
                      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        📦 Products ({productResults.length})
                      </h3>
                      <div className="space-y-4">
                        {productResults.map((item, idx) => (
                          <MultiStoreProductCard
                            key={idx}
                            product={item.product}
                            stores={item.stores}
                            cartQuantity={getItemQuantity(item.product.id)}
                            onAdd={handleAddToCart}
                            onUpdate={updateQuantity}
                            onStoreClick={onStoreSelect}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stores */}
                  {storeResults.length > 0 && (
                    <div>
                      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <FaStore className="text-emerald-400" />
                        Stores ({storeResults.length})
                      </h3>
                      <div className="space-y-2">
                        {storeResults.map((store) => (
                          <motion.button
                            key={store.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onStoreSelect && onStoreSelect(store.id)}
                            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-white/10 transition-all text-left"
                          >
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {store.logoUrl ? (
                                <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <FaStore className="text-emerald-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white truncate">{store.businessName || store.name}</p>
                              <p className="text-xs text-white/40">{store.category || 'Store'}</p>
                              {store.matchedProductCount > 0 && (
                                <p className="text-xs text-emerald-400 mt-1">
                                  {store.matchedProductCount} product{store.matchedProductCount !== 1 ? 's' : ''} match
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {store.distance != null && (
                                <span className="flex items-center gap-1 text-xs text-white/50">
                                  <FaMapMarkerAlt className="text-[10px]" />
                                  {store.distance} km
                                </span>
                              )}
                              <span className="text-emerald-400 text-xs font-medium">View →</span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <FaSearch className="text-white/30 text-3xl" />
                  </div>
                  <p className="text-white font-medium mb-2">No results found</p>
                  <p className="text-sm text-white/40 mb-4">Try searching for:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Milk', 'Bread', 'Rice', 'Eggs'].map((term, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setQuery(term);
                          performSearch(term);
                        }}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 hover:bg-white/10 transition"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductSearch;
