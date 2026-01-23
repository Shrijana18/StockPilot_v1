/**
 * CustomerHome - Premium Dark Theme with Green Branding
 * Enhanced animations, better UX, more visual appeal
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaMapMarkerAlt, FaStore, FaStar, FaClock, FaChevronRight,
  FaSearch, FaHeart, FaBell, FaChevronDown, FaTimes, FaGift,
  FaArrowRight, FaShippingFast
} from 'react-icons/fa';
import { HiBadgeCheck, HiLocationMarker, HiSparkles } from 'react-icons/hi';
import { 
  getNearbyStores, 
  getFeaturedProducts 
} from '../services/storeService';

// ============================================
// PROMO BANNER - Green Branding
// ============================================
const PromoBanner = () => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-5"
  >
    {/* Decorative circles */}
    <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
    <div className="absolute -right-4 bottom-0 w-20 h-20 bg-white/10 rounded-full" />
    
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-2">
        <HiSparkles className="text-yellow-300" />
        <span className="text-white/90 text-xs font-semibold tracking-wider uppercase">Special Offer</span>
      </div>
      <h3 className="text-white font-bold text-xl mb-1">Free Delivery Today!</h3>
      <p className="text-white/80 text-sm mb-4">On your first order from any store</p>
      <button className="inline-flex items-center gap-2 bg-white text-emerald-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors">
        Shop Now <FaArrowRight className="text-xs" />
      </button>
    </div>
  </motion.div>
);

// ============================================
// QUICK FEATURE CARDS
// ============================================
const QuickFeatures = () => (
  <div className="grid grid-cols-3 gap-3">
    {[
      { icon: FaShippingFast, label: 'Fast Delivery', color: 'emerald' },
      { icon: FaGift, label: 'Daily Offers', color: 'amber' },
      { icon: HiBadgeCheck, label: 'Verified Stores', color: 'blue' },
    ].map((item, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 + i * 0.1 }}
        className={`bg-${item.color}-500/10 border border-${item.color}-500/20 rounded-xl p-3 text-center`}
        style={{
          background: item.color === 'emerald' ? 'rgba(16, 185, 129, 0.1)' : 
                      item.color === 'amber' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          borderColor: item.color === 'emerald' ? 'rgba(16, 185, 129, 0.2)' : 
                       item.color === 'amber' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)'
        }}
      >
        <item.icon className={`text-lg mx-auto mb-1.5 ${
          item.color === 'emerald' ? 'text-emerald-400' : 
          item.color === 'amber' ? 'text-amber-400' : 'text-blue-400'
        }`} />
        <p className="text-white/70 text-[10px] font-medium">{item.label}</p>
      </motion.div>
    ))}
  </div>
);

// ============================================
// STORE CARD - Enhanced with Pop Effect
// ============================================
const StoreCard = ({ store, onClick, isFavorite, onFavoriteToggle, index }) => {
  const storeName = store.businessName || store.name || 'Store';
  const [isPressed, setIsPressed] = useState(false);
  
  // Check if store is available (within range or has pickup)
  const isStoreAvailable = store.isWithinDeliveryRange || store.pickupEnabled || store.distance === null;
  
  const handleClick = () => {
    if (!isStoreAvailable) {
      // Don't navigate, maybe show a toast
      return;
    }
    onClick(store);
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, type: 'spring', stiffness: 200 }}
      whileHover={isStoreAvailable ? { scale: 1.02, y: -4 } : {}}
      whileTap={isStoreAvailable ? { scale: 0.98 } : {}}
      onTapStart={() => isStoreAvailable && setIsPressed(true)}
      onTap={() => { setIsPressed(false); handleClick(); }}
      onTapCancel={() => setIsPressed(false)}
      className={`bg-white/[0.06] backdrop-blur-xl rounded-2xl overflow-hidden border transition-all duration-300 ${
        !isStoreAvailable 
          ? 'cursor-not-allowed opacity-70 border-white/[0.06]' 
          : isPressed 
            ? 'cursor-pointer border-emerald-500/50 shadow-lg shadow-emerald-500/20' 
            : 'cursor-pointer border-white/[0.08] hover:border-emerald-500/30'
      }`}
    >
      {/* Image */}
      <div className="h-40 relative bg-gradient-to-br from-slate-800 to-slate-900">
        {store.bannerUrl || store.logoUrl ? (
          <img src={store.bannerUrl || store.logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-500/30 to-blue-500/20 flex items-center justify-center">
            <FaStore className="text-white/20 text-5xl" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/30 to-transparent" />
        
        {/* Status Badge */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 + index * 0.1, type: 'spring' }}
          className="absolute top-3 left-3"
        >
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 ${
            store.isActive 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
              : 'bg-white/10 text-white/50 border border-white/10'
          }`}>
            <span className={`w-2 h-2 rounded-full ${store.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
            {store.isActive ? 'Open Now' : 'Closed'}
          </span>
        </motion.div>

        {/* Favorite Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(store.id); }}
          className={`absolute top-3 right-3 w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center border transition-all ${
            isFavorite ? 'bg-red-500/20 border-red-500/40' : 'bg-black/30 border-white/10 hover:border-white/30'
          }`}
        >
          <FaHeart className={`text-sm ${isFavorite ? 'text-red-500' : 'text-white/50'}`} />
        </motion.button>

        {/* Store Info Overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-lg drop-shadow-lg">{storeName}</h3>
            {store.isVerified && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <HiBadgeCheck className="text-emerald-400 text-lg" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Delivery Badge */}
        <div className="absolute bottom-3 right-4">
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/90 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg shadow-emerald-500/30">
            <FaClock className="text-[10px]" />
            {store.avgDeliveryTime || store.baseDeliveryTime || 30} min
          </span>
        </div>
        
        {/* Out of Delivery Range Badge */}
        {store.deliveryEnabled !== false && !store.isWithinDeliveryRange && store.distance !== null && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 + index * 0.1, type: 'spring' }}
            className="absolute top-12 left-3"
          >
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
              store.pickupEnabled 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}>
              <FaMapMarkerAlt className="text-[8px]" />
              {store.pickupEnabled ? 'Pickup only' : 'Out of range'}
            </span>
          </motion.div>
        )}
        
        {/* Overlay for stores that are completely unavailable */}
        {!store.isWithinDeliveryRange && !store.pickupEnabled && store.distance !== null && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center rounded-t-2xl">
            <div className="text-center px-4">
              <FaMapMarkerAlt className="text-red-400 text-2xl mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">Not Available</p>
              <p className="text-white/60 text-xs">Outside delivery area</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-white/50 text-sm">{store.category || 'General Store'}</p>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 rounded-lg border border-amber-500/25">
            <FaStar className="text-amber-400 text-xs" />
            <span className="text-sm font-semibold text-amber-400">{store.rating?.toFixed(1) || '0.0'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
          {store.distance !== null && (
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <FaMapMarkerAlt className="text-emerald-400" />
              {store.distance} km away
            </span>
          )}
          {(store.deliveryFee === 0 || !store.deliveryFee) && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <FaGift className="text-[10px]" /> Free Delivery
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// PRODUCT CARD - Enhanced
// ============================================
const ProductCard = ({ product, onAdd, index }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + index * 0.05 }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className="bg-white/[0.06] backdrop-blur-xl rounded-2xl overflow-hidden w-44 flex-shrink-0 border border-white/[0.08] hover:border-emerald-500/30 transition-all"
    >
      <div className="h-32 bg-gradient-to-br from-white/[0.04] to-transparent relative p-4">
        {product.image || product.imageUrl ? (
          <img src={product.image || product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">📦</div>
        )}
      </div>
      <div className="p-3.5">
        <p className="text-[10px] text-emerald-400 font-medium truncate mb-0.5">{product.storeName}</p>
        <h4 className="text-sm font-medium text-white truncate">{product.name}</h4>
        <div className="flex items-center justify-between mt-3">
          <span className="font-bold text-white text-lg">₹{product.sellingPrice || product.price}</span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAdd?.(product)}
            className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-lg font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/30 transition-colors"
          >
            +
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// CATEGORY PILL - Enhanced
// ============================================
const CategoryPill = ({ name, emoji, isActive, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all duration-200 ${
      isActive 
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400' 
        : 'bg-white/[0.06] text-white/70 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-white/[0.08]'
    }`}
  >
    <span className="text-base">{emoji}</span>
    <span className="font-medium text-sm">{name}</span>
  </motion.button>
);

// ============================================
// LOCATION SHEET - Fixed & Enhanced
// ============================================
const LocationSheet = ({ isOpen, onClose, location, onSelect }) => {
  const [detecting, setDetecting] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const detectLocation = () => {
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelect({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current Location' });
        setDetecting(false);
        onClose();
      },
      () => setDetecting(false),
      { enableHighAccuracy: true }
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-[#111827] to-[#0f172a] rounded-t-[28px] border-t border-emerald-500/20 shadow-xl max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center py-4 sticky top-0 bg-gradient-to-b from-[#111827] to-transparent z-10">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>
            
            <div className="px-6 pb-[120px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Delivery Location</h3>
                  <p className="text-white/50 text-sm mt-1">Choose where you want your order delivered</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center"
                >
                  <FaTimes className="text-white/60" />
                </motion.button>
              </div>
              
              {/* Search */}
              <div className="relative mb-5">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search for area, street name..."
                  className="w-full h-14 pl-12 pr-4 bg-white/[0.06] rounded-2xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 border border-white/[0.08] focus:border-emerald-500/40 transition-all text-sm"
                />
              </div>
              
              {/* Detect Location Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={detectLocation}
                disabled={detecting}
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/40 rounded-2xl mb-5 hover:from-emerald-500/30 hover:to-emerald-600/20 transition-all"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <HiLocationMarker className="text-white text-2xl" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-white text-base">Use Current Location</p>
                  <p className="text-emerald-400 text-sm">{detecting ? 'Detecting your location...' : 'GPS • Fast & Accurate'}</p>
                </div>
                {detecting ? (
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FaChevronRight className="text-emerald-400" />
                )}
              </motion.button>
              
              {/* Saved Locations */}
              <div className="space-y-3">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">Recent Locations</p>
                
                {location && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 bg-white/[0.04] rounded-2xl border border-white/[0.08] hover:border-emerald-500/20 transition-all cursor-pointer"
                    onClick={() => {
                      onSelect(location);
                      onClose();
                    }}
                  >
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <FaMapMarkerAlt className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{location.label || 'Current Location'}</p>
                      <p className="text-white/40 text-sm">Currently selected</p>
                    </div>
                    <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50" />
                  </motion.div>
                )}
                
                {/* Add more placeholder for saved addresses */}
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="w-full flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-dashed border-white/10 hover:border-emerald-500/30 transition-all"
                >
                  <div className="w-12 h-12 bg-white/[0.04] rounded-xl flex items-center justify-center">
                    <FaMapMarkerAlt className="text-white/30" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white/50 font-medium">Add New Address</p>
                    <p className="text-white/30 text-sm">Save for faster checkout</p>
                  </div>
                  <FaChevronRight className="text-white/30" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const CustomerHome = ({ onNavigate, onStoreSelect, onProductAdd }) => {
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [stores, setStores] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteStores, setFavoriteStores] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = [
    { name: 'All', emoji: '🏪' },
    { name: 'Grocery', emoji: '🛒' },
    { name: 'Fresh', emoji: '🥬' },
    { name: 'Dairy', emoji: '🥛' },
    { name: 'Snacks', emoji: '🍿' },
    { name: 'Drinks', emoji: '🥤' },
  ];

  // Get greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good Morning', emoji: '☀️' };
    if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', emoji: '🌤️' };
    if (hour >= 17 && hour < 21) return { text: 'Good Evening', emoji: '🌅' };
    return { text: 'Good Night', emoji: '🌙' };
  };

  const greeting = getGreeting();

  // Toggle favorite
  const toggleFavorite = (storeId) => {
    setFavoriteStores(prev => 
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  // Get location
  useEffect(() => {
    setLocationLoading(true);
    
    if (!navigator.geolocation) {
      setLocation({ lat: 19.0760, lng: 72.8777, label: 'Select Location' });
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude, label: 'Current Location' });
        setLocationLoading(false);
      },
      () => {
        setLocation({ lat: 19.0760, lng: 72.8777, label: 'Select Location' });
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Fetch data
  useEffect(() => {
    if (!location) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [storesData, productsData] = await Promise.all([
          getNearbyStores(location.lat, location.lng, 50, 10),
          getFeaturedProducts(location.lat, location.lng, 50, 10)
        ]);
        setStores(storesData);
        setFeaturedProducts(productsData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location]);

  // Loading
  if (locationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1c] to-[#0f172a] flex flex-col items-center justify-center px-6">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/30"
        >
          <span className="text-white font-bold text-3xl">F</span>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mb-4"
        />
        <p className="text-white/50">Finding stores near you...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1c] to-[#0f172a]">
      {/* Header with Green Accent */}
      <header 
        className="sticky top-0 z-40 bg-[#0a0f1c]/90 backdrop-blur-xl border-b border-emerald-500/10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-5 py-4 flex items-center gap-4">
          {/* Logo with Green Gradient */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30"
          >
            <span className="text-white font-bold text-xl">F</span>
          </motion.div>
          
          {/* Location Selector */}
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowLocationPicker(true)}
            className="flex-1 flex items-center gap-2 min-w-0 bg-white/[0.04] hover:bg-white/[0.06] rounded-xl px-3 py-2.5 border border-white/[0.06] hover:border-emerald-500/20 transition-all"
          >
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <FaMapMarkerAlt className="text-emerald-400 text-sm" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Deliver to</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-white truncate">{location?.label}</p>
                <FaChevronDown className="text-white/40 text-[10px] flex-shrink-0" />
              </div>
            </div>
          </motion.button>

          {/* Actions */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('search')}
            className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center hover:border-emerald-500/30 hover:bg-white/[0.08] transition-all"
          >
            <FaSearch className="text-white/60" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center relative hover:border-emerald-500/30 hover:bg-white/[0.08] transition-all"
          >
            <FaBell className="text-white/60" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a0f1c] animate-pulse" />
          </motion.button>
        </div>
      </header>

      {/* Content */}
      <main className="px-5 py-6 space-y-7">
        
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {greeting.text} <span className="text-2xl">{greeting.emoji}</span>
          </h1>
          <p className="text-white/50 mt-1">What would you like to order today?</p>
        </motion.div>

        {/* Search Bar */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onNavigate('search')}
          className="w-full flex items-center gap-3 px-4 py-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl hover:border-emerald-500/20 hover:bg-white/[0.06] transition-all"
        >
          <FaSearch className="text-white/30" />
          <span className="flex-1 text-left text-white/30">Search products, stores...</span>
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <FaSearch className="text-white text-xs" />
          </div>
        </motion.button>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
          {categories.map((cat, i) => (
            <CategoryPill 
              key={cat.name}
              name={cat.name}
              emoji={cat.emoji}
              isActive={activeCategory === cat.name}
              onClick={() => setActiveCategory(cat.name)}
            />
          ))}
        </div>

        {/* Stores Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Stores Near You</h2>
            <span className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {stores.length} stores
            </span>
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-56 bg-white/[0.04] rounded-2xl animate-pulse border border-white/[0.06]" />
              ))}
            </div>
          ) : stores.length > 0 ? (
            <div className="space-y-4">
              {stores.map((store, index) => (
                <StoreCard 
                  key={store.id} 
                  store={store}
                  index={index}
                  onClick={() => onStoreSelect?.(store)}
                  isFavorite={favoriteStores.includes(store.id)}
                  onFavoriteToggle={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-white/[0.04] rounded-2xl border border-white/[0.08]"
            >
              <div className="w-16 h-16 bg-white/[0.06] rounded-full flex items-center justify-center mx-auto mb-4">
                <FaStore className="text-white/20 text-2xl" />
              </div>
              <p className="text-white/50">No stores nearby</p>
              <p className="text-white/30 text-sm mt-1">Try changing your location</p>
            </motion.div>
          )}
        </section>

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Trending Now <span className="text-orange-400">🔥</span>
              </h2>
              <motion.button 
                whileHover={{ x: 4 }}
                className="text-sm text-emerald-400 font-medium flex items-center gap-1"
              >
                See all <FaChevronRight className="text-xs" />
              </motion.button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
              {featuredProducts.map((product, i) => (
                <ProductCard key={i} product={product} onAdd={onProductAdd} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Bottom spacing */}
      <div className="h-28" />

      {/* Location Sheet */}
      <LocationSheet
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        location={location}
        onSelect={(loc) => {
          setLocation(loc);
          setShowLocationPicker(false);
        }}
      />
    </div>
  );
};

export default CustomerHome;
