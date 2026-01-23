/**
 * ProductSearch - Premium dark theme search
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  FaSearch, FaTimes, FaArrowLeft, FaStore, FaMapMarkerAlt,
  FaMinus, FaPlus, FaHistory
} from 'react-icons/fa';
import { searchProducts, getAllCategories } from '../services/storeService';
import { useCart } from '../context/CartContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

// Search Result Card - Dark Theme
const SearchResultCard = ({ product, cartQuantity, onAdd, onUpdate, onStoreClick }) => {
  const price = product.sellingPrice || product.price || 0;
  const mrp = product.mrp || price;
  
  return (
    <div className="bg-[#141c2e]/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-3 flex gap-3">
      {/* Product Image */}
      <div className="w-20 h-20 bg-[#141c2e] rounded-lg flex-shrink-0 overflow-hidden border border-white/10/50">
        {product.imageUrl || product.image ? (
          <img src={product.imageUrl || product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
        )}
      </div>
      
      {/* Product Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h4 className="font-medium text-white text-sm line-clamp-2">{product.name}</h4>
          <button 
            onClick={() => onStoreClick(product.storeId)}
            className="flex items-center gap-1 text-xs text-[#05E06C]400 mt-1"
          >
            <FaStore className="text-[10px]" />
            {product.storeName}
            <FaMapMarkerAlt className="text-[10px] ml-1" />
            {product.storeDistance}km
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="font-bold text-white">₹{price}</span>
            {mrp > price && (
              <span className="text-xs text-slate-500 line-through ml-1">₹{mrp}</span>
            )}
          </div>
        
        {cartQuantity > 0 ? (
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg overflow-hidden shadow-lg shadow-emerald-500/20">
            <button
              onClick={() => {
                triggerHaptic();
                onUpdate(product.id, cartQuantity - 1);
              }}
              className="w-7 h-7 flex items-center justify-center text-white"
            >
              <FaMinus className="text-xs" />
            </button>
            <span className="text-white font-semibold min-w-[16px] text-center text-sm">
              {cartQuantity}
            </span>
            <button
              onClick={() => {
                triggerHaptic();
                onUpdate(product.id, cartQuantity + 1);
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
              onAdd(product);
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-500/20"
          >
            ADD
          </button>
        )}
      </div>
    </div>
  </div>
  );
};

// Category Chip - Dark Theme
const CategoryChip = ({ category, onClick }) => (
  <button
    onClick={() => onClick(category.name)}
    className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br ${category.color} text-white text-sm font-medium whitespace-nowrap border border-white/10 shadow-lg`}
  >
    <span>{category.icon}</span>
    {category.name}
  </button>
);

const ProductSearch = ({ location, onBack, onStoreSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const { addToCart, updateQuantity, getItemQuantity, cartStore } = useCart();

  // Load categories and recent searches
  useEffect(() => {
    const loadInitialData = async () => {
      if (location?.lat && location?.lng) {
        const cats = await getAllCategories(location.lat, location.lng, 5);
        setCategories(cats);
      }
      
      // Load recent searches from localStorage
      const saved = localStorage.getItem('flyp_recent_searches');
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved).slice(0, 5));
        } catch (e) {}
      }
    };
    
    loadInitialData();
  }, [location]);

  // Debounced search
  const performSearch = useCallback(async (searchTerm) => {
    if (!searchTerm.trim() || !location?.lat) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const searchResults = await searchProducts(
        searchTerm, 
        location.lat, 
        location.lng, 
        5
      );
      setResults(searchResults);
      
      // Save to recent searches
      const newRecent = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('flyp_recent_searches', JSON.stringify(newRecent));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [location, recentSearches]);

  // Handle search submit
  const handleSearch = () => {
    if (query.trim()) {
      performSearch(query);
    }
  };

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
    <div className="min-h-screen bg-[#060D2D]">
      {/* Search Header */}
      <div className="bg-[#060D2D]/80 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#141c2e] border border-white/10 flex items-center justify-center"
          >
            <FaArrowLeft className="text-white/60" />
          </button>
          
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 bg-[#141c2e] border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <FaTimes className="text-slate-500" />
              </button>
            )}
          </div>
          
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-500/20"
          >
            Search
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Before Search - Show categories and recent */}
        {!searched && (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">Recent Searches</h3>
                <div className="space-y-2">
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(search);
                        performSearch(search);
                      }}
                      className="flex items-center gap-3 w-full text-left py-2"
                    >
                      <FaHistory className="text-slate-500" />
                      <span className="text-white/70">{search}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Browse by Category</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category, index) => (
                    <CategoryChip
                      key={index}
                      category={category}
                      onClick={(name) => {
                        setQuery(name);
                        performSearch(name);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Search Results */}
        {searched && !loading && (
          <>
            <p className="text-sm text-white/60 mb-4">
              {results.length} results for "{query}"
            </p>
            
            {results.length > 0 ? (
              <div className="space-y-3">
                {results.map((product) => (
                  <SearchResultCard
                    key={`${product.storeId}-${product.id}`}
                    product={product}
                    cartQuantity={getItemQuantity(product.id)}
                    onAdd={handleAddToCart}
                    onUpdate={updateQuantity}
                    onStoreClick={onStoreSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-[#141c2e] border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <FaSearch className="text-white/30 text-2xl" />
                </div>
                <p className="text-white/60 mb-2">No products found</p>
                <p className="text-sm text-slate-500">Try a different search term</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-24" />
    </div>
  );
};

export default ProductSearch;
