/**
 * CustomerHome - Professional marketplace home
 * Clean layout, refined spacing, premium app feel
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaMapMarkerAlt, FaStore, FaStar, FaClock, FaChevronRight,
  FaSearch, FaHeart, FaBell, FaChevronDown, FaTimes, FaGift
} from 'react-icons/fa';
import { HiBadgeCheck, HiLocationMarker } from 'react-icons/hi';
import { 
  getNearbyStores, 
  getFeaturedProducts 
} from '../services/storeService';
import { usePlatform } from '../../hooks/usePlatform';

// ============================================
// STORE CARD - Clean, Clear, and Informative
// ============================================
const StoreCard = ({ store, onClick, isFavorite, onFavoriteToggle, index, isMobile = false }) => {
  const storeName = store.businessName || store.name || 'Store';
  const [isPressed, setIsPressed] = useState(false);
  
  // Check if store is available (within range or has pickup)
  const isStoreAvailable = store.isWithinDeliveryRange || store.pickupEnabled || store.distance === null;
  
  const handleClick = () => {
    if (!isStoreAvailable) {
      return;
    }
    onClick(store);
  };

  // Calculate delivery fee display
  const deliveryFee = store.deliveryFee || 0;
  const freeDeliveryAbove = store.freeDeliveryAbove || 0;
  const hasFreeDelivery = freeDeliveryAbove > 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onTapStart={() => isStoreAvailable && setIsPressed(true)}
      onTap={() => { setIsPressed(false); handleClick(); }}
      onTapCancel={() => setIsPressed(false)}
      className={`rounded-2xl overflow-hidden border transition-all duration-200 relative ${
        !isStoreAvailable 
          ? 'cursor-not-allowed opacity-60 border-white/[0.08] bg-white/[0.02]' 
          : isPressed 
            ? 'cursor-pointer border-emerald-500/50 bg-white/[0.04] scale-[0.99]' 
            : 'cursor-pointer border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] active:scale-[0.995]'
      }`}
    >
      {/* Store Banner/Wallpaper - Prominent Visual Space */}
      <div className="relative h-36 w-full overflow-hidden">
        {store.bannerUrl ? (
          <>
            <img 
              src={store.bannerUrl} 
              alt={`${storeName} banner`} 
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/50" />
          </>
        ) : (
          /* Fallback gradient when no banner - still shows the space */
          <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 via-blue-500/15 to-purple-500/20 relative">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)'
            }} />
            {/* Store logo in center if available */}
            {store.logoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src={store.logoUrl} 
                  alt={storeName} 
                  className="w-20 h-20 rounded-xl object-cover border-2 border-white/20 shadow-lg"
                />
              </div>
            )}
          </div>
        )}
        
        {/* Status and Favorite on Banner - Always visible */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
          {/* Status Badge on Banner */}
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-md flex items-center gap-1.5 ${
            store.isActive 
              ? 'bg-emerald-500 text-slate-900 border border-emerald-400/50' 
              : 'bg-black/60 text-white/70 border border-white/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${store.isActive ? 'bg-white animate-pulse' : 'bg-white/60'}`} />
            {store.isActive ? 'Open Now' : 'Closed'}
          </span>

          {/* Favorite Button on Banner */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(store.id); }}
            className={`w-8 h-8 rounded-lg backdrop-blur-md flex items-center justify-center border transition-all shadow-lg ${
              isFavorite 
                ? 'bg-red-500/90 border-red-400/50' 
                : 'bg-black/60 border-white/20 hover:border-white/40'
            }`}
          >
            <FaHeart className={`text-xs ${isFavorite ? 'text-white' : 'text-white/70'}`} />
          </motion.button>
        </div>

        {/* Store Name Overlay on Banner */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-lg drop-shadow-lg">{storeName}</h3>
            {store.isVerified && (
              <HiBadgeCheck className="text-emerald-400 text-lg flex-shrink-0 drop-shadow-lg" />
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Clean Layout */}
      <div className={`relative z-10 ${store.bannerUrl ? 'p-4' : 'p-4'}`}>
        {/* Header Row - Store Name, Logo, Status (only if no banner) */}
        {!store.bannerUrl && (
          <div className="flex items-start justify-between gap-3 mb-3">
            {/* Store Logo/Icon - Small and Clean */}
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={storeName} className="w-full h-full object-cover" />
              ) : (
                <FaStore className="text-emerald-400 text-xl" />
              )}
            </div>

            {/* Store Info - Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-white text-lg leading-tight truncate">{storeName}</h3>
                {store.isVerified && (
                  <HiBadgeCheck className="text-emerald-400 text-lg flex-shrink-0" />
                )}
              </div>
              <p className="text-white/60 text-sm mb-2">{store.category || 'General Store'}</p>
              
              {/* Status Badge - Inline */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 ${
                  store.isActive 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-white/10 text-white/50 border border-white/10'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${store.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                  {store.isActive ? 'Open Now' : 'Closed'}
                </span>
                
                {/* Rating */}
                {store.rating > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/15 rounded-lg border border-amber-500/25">
                    <FaStar className="text-amber-400 text-[10px]" />
                    <span className="text-xs font-semibold text-amber-400">{store.rating?.toFixed(1)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Favorite Button - Top Right */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(store.id); }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 ${
                isFavorite 
                  ? 'bg-red-500/20 border-red-500/40' 
                  : 'bg-white/10 border-white/10 hover:border-white/30'
              }`}
            >
              <FaHeart className={`text-sm ${isFavorite ? 'text-red-400' : 'text-white/40'}`} />
            </motion.button>
          </div>
        )}

        {/* Store Info Row (simplified when banner exists) */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-sm">{store.category || 'General Store'}</p>
          </div>
          {/* Rating */}
          {store.rating > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 rounded-lg border border-amber-500/25">
              <FaStar className="text-amber-400 text-[10px]" />
              <span className="text-xs font-semibold text-amber-400">{store.rating?.toFixed(1)}</span>
            </span>
          )}
        </div>

        {/* Key Info Row - Distance, Delivery Time, Delivery Type */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/20">
          {/* Distance */}
          {store.distance !== null && (
            <div className="flex items-center gap-1.5">
              <FaMapMarkerAlt className="text-emerald-400 text-xs" />
              <span className="text-xs text-white/70 font-medium">{store.distance} km</span>
            </div>
          )}

          {/* Delivery Time */}
          <div className="flex items-center gap-1.5">
            <FaClock className="text-blue-400 text-xs" />
            <span className="text-xs text-white/70 font-medium">{store.avgDeliveryTime || store.baseDeliveryTime || 30} min</span>
          </div>

          {/* Delivery Type Badge */}
          {store.deliveryEnabled !== false && !store.isWithinDeliveryRange && store.distance !== null && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              store.pickupEnabled 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {store.pickupEnabled ? 'Pickup Only' : 'Out of Range'}
            </span>
          )}
        </div>

        {/* Bottom Row - Delivery Fee, Min Order, Offers */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Delivery Fee Info */}
            {deliveryFee > 0 ? (
              <span className="text-xs text-white/60">
                Delivery: ₹{deliveryFee}
                {hasFreeDelivery && (
                  <span className="text-emerald-400 ml-1">• Free above ₹{freeDeliveryAbove}</span>
                )}
              </span>
            ) : (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <FaGift className="text-[10px]" />
                Free Delivery
              </span>
            )}

            {/* Min Order */}
            {store.minOrderValue > 0 && (
              <span className="text-xs text-white/50">
                Min: ₹{store.minOrderValue}
              </span>
            )}
          </div>

          {/* View Store Arrow - Enhanced */}
          {isStoreAvailable && (
            <motion.div
              whileHover={{ x: 4, scale: 1.05 }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 hover:border-emerald-500/60 transition-all"
            >
              <span className="text-xs font-semibold text-emerald-400">View Store</span>
              <FaChevronRight className="text-[10px] text-emerald-400" />
            </motion.div>
          )}
        </div>

        {/* Unavailable Overlay */}
        {!store.isWithinDeliveryRange && !store.pickupEnabled && store.distance !== null && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <div className="text-center px-4">
              <FaMapMarkerAlt className="text-red-400 text-2xl mx-auto mb-2" />
              <p className="text-white font-semibold text-sm">Not Available</p>
              <p className="text-white/60 text-xs">Outside delivery area</p>
            </div>
          </div>
        )}
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="rounded-xl overflow-hidden w-40 flex-shrink-0 border border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1] active:scale-[0.98] transition-all duration-200"
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
            className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-900 text-lg font-bold hover:bg-emerald-400 transition-colors"
          >
            +
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// CATEGORY PILL - Mobile Optimized
// ============================================
const CategoryPill = ({ name, emoji, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
      isActive 
        ? 'bg-emerald-500 text-white font-semibold' 
        : 'bg-white/[0.06] text-white/80 border border-white/[0.06] hover:bg-white/[0.08] active:scale-[0.98]'
    }`}
  >
    <span className="text-sm">{emoji}</span>
    <span className="text-[13px] font-medium">{name}</span>
  </button>
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
      (error) => {
        console.error('Location detection error:', error);
        setDetecting(false);
        // Show user-friendly error message
        if (error.code === error.PERMISSION_DENIED) {
          alert('Location permission denied. Please enable location access in Settings to use your current location.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          alert('Location unavailable. Please try again or select a location manually.');
        } else if (error.code === error.TIMEOUT) {
          alert('Location request timed out. Please try again or select a location manually.');
        } else {
          alert('Unable to detect location. Please select a location manually.');
        }
      },
      { 
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Don't use cached location
      }
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
            className="fixed bottom-0 left-0 right-0 z-[60] bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-t-[28px] border-t border-white/10 shadow-xl overflow-y-auto"
            style={{ 
              maxHeight: 'calc(85vh - env(safe-area-inset-bottom))',
              paddingBottom: 'calc(100px + env(safe-area-inset-bottom))'
            }}
          >
            {/* Handle */}
            <div className="flex justify-center py-4 sticky top-0 bg-gradient-to-b from-slate-800 to-transparent z-10">
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
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center"
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
                  className="w-full h-14 pl-12 pr-4 bg-white/10 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 border border-white/10 focus:border-emerald-500/40 transition-all text-sm"
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
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-emerald-500/20 transition-all cursor-pointer"
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
                  className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-dashed border-white/10 hover:border-emerald-500/30 transition-all"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
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
const CustomerHome = ({ location: propLocation, onNavigate, onStoreSelect, onProductAdd }) => {
  const { isNativeApp, isMobileViewport } = usePlatform();
  const isMobile = isNativeApp || isMobileViewport;
  
  const [location, setLocation] = useState(propLocation || null);
  const [locationLoading, setLocationLoading] = useState(!propLocation);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [stores, setStores] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(!propLocation);
  const [error, setError] = useState(null);
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

  // Get location - Use prop if provided, otherwise fetch
  useEffect(() => {
    if (propLocation) {
      setLocation(propLocation);
      setLocationLoading(false);
      return;
    }
    
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
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
    );
  }, [propLocation]);

  // Fetch data
  useEffect(() => {
    // Use default location if propLocation is not provided
    const currentLocation = location || propLocation || { lat: 19.0760, lng: 72.8777, label: 'Mumbai' };
    
    if (!currentLocation || !currentLocation.lat || !currentLocation.lng) {
      console.warn('Location not available, using default Mumbai location');
      setLocation({ lat: 19.0760, lng: 72.8777, label: 'Mumbai' });
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [storesData, productsData] = await Promise.all([
          getNearbyStores(currentLocation.lat, currentLocation.lng, 50, 10),
          getFeaturedProducts(currentLocation.lat, currentLocation.lng, 50, 10)
        ]);
        setStores(storesData || []);
        setFeaturedProducts(productsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError({
          message: error.message || 'Failed to load stores. Please check your connection and try again.',
          type: 'fetch_error'
        });
        // Set empty arrays as fallback
        setStores([]);
        setFeaturedProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location, propLocation]);

  // Loading
  if (locationLoading) {
    return (
      <div className="bg-transparent flex flex-col items-center justify-center px-6 py-20">
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

  // Error state
  if (error && !loading) {
    return (
      <div className="bg-transparent w-full">
        {/* Header */}
        <header 
          className="sticky top-0 z-40 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className={`px-5 ${isMobile ? 'py-2.5' : 'py-4'} flex items-center ${isMobile ? 'gap-2.5' : 'gap-4'}`}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl flex items-center justify-center overflow-hidden bg-white/10 border border-white/10 flex-shrink-0`}
            >
              <img src="/assets/flyp_logo.png" alt="FLYP" className="w-full h-full object-contain p-1" />
            </motion.div>
            <div className="flex-1">
              <h1 className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-white`}>FLYP</h1>
            </div>
          </div>
        </header>

        {/* Error Content */}
        <main className="px-5 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Unable to Load Stores</h2>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              {error.message}
            </p>
            <div className="space-y-3 max-w-sm mx-auto">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  // Retry fetch
                  if (location) {
                    const fetchData = async () => {
                      try {
                        const [storesData, productsData] = await Promise.all([
                          getNearbyStores(location.lat, location.lng, 50, 10),
                          getFeaturedProducts(location.lat, location.lng, 50, 10)
                        ]);
                        setStores(storesData || []);
                        setFeaturedProducts(productsData || []);
                        setError(null);
                      } catch (err) {
                        setError({
                          message: err.message || 'Failed to load stores. Please check your connection and try again.',
                          type: 'fetch_error'
                        });
                      } finally {
                        setLoading(false);
                      }
                    };
                    fetchData();
                  }
                }}
                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold rounded-xl transition-colors"
              >
                Try Again
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowLocationPicker(true)}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/10 transition-colors"
              >
                Change Location
              </motion.button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-transparent w-full h-full flex flex-col min-h-0">
      {/* Header - Refined for native app */}
      <header 
        className="sticky top-0 z-40 flex-shrink-0 border-b border-white/[0.06]"
        style={{ 
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingBottom: 12,
          paddingLeft: 'max(env(safe-area-inset-left), 20px)',
          paddingRight: 'max(env(safe-area-inset-right), 20px)',
          background: 'rgba(11, 15, 20, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-white/[0.06] flex-shrink-0">
            <img src="/assets/flyp_logo.png" alt="FLYP" className="w-full h-full object-contain p-1.5" />
          </div>
          
          <button 
            onClick={() => setShowLocationPicker(true)}
            className="flex-1 flex items-center gap-2.5 min-w-0 py-2 pl-3 pr-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.99] transition-all duration-200"
          >
            <FaMapMarkerAlt className="text-emerald-400 text-sm flex-shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[11px] text-white/40 font-medium uppercase tracking-widest">Deliver to</p>
              <p className="text-sm font-semibold text-white truncate">{location?.label || 'Current Location'}</p>
            </div>
            <FaChevronDown className="text-white/30 text-[10px] flex-shrink-0" />
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={() => onNavigate('search')}
              className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] active:scale-95 transition-all duration-200"
            >
              <FaSearch className="text-white/50 text-sm" />
            </button>
            <button className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center relative hover:bg-white/[0.08] active:scale-95 transition-all duration-200">
              <FaBell className="text-white/50 text-sm" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            </button>
          </div>
        </div>
      </header>

      {/* Content - Consistent spacing, professional rhythm */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-behavior-y-contain">
        <div 
          className="w-full"
          style={{ 
            paddingLeft: 'max(env(safe-area-inset-left), 20px)',
            paddingRight: 'max(env(safe-area-inset-right), 20px)',
            paddingTop: 20,
            paddingBottom: 24
          }}
        >
          {/* Greeting */}
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              {greeting.text}
              <span className="text-lg opacity-80">{greeting.emoji}</span>
            </h1>
            <p className="text-white/45 text-sm mt-0.5">What would you like to order today?</p>
          </div>

          {/* Search */}
          <button
            onClick={() => onNavigate('search')}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] active:scale-[0.995] transition-all duration-200 mb-5"
          >
            <FaSearch className="text-white/35 text-base flex-shrink-0" />
            <span className="flex-1 text-left text-white/40 text-[15px]">Search products, stores...</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <FaSearch className="text-white text-xs" />
            </div>
          </button>

          {/* Categories */}
          <div 
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mb-6"
            style={{
              marginLeft: -20,
              marginRight: -20,
              paddingLeft: 'max(env(safe-area-inset-left), 20px)',
              paddingRight: 20,
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {categories.map((cat) => (
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
            <div>
              <h2 className="text-[17px] font-semibold text-white tracking-tight">
                Stores Near You
              </h2>
              <p className="text-xs text-white/40 mt-0.5">Browse and order from nearby stores</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              {stores.length}
            </span>
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-48 rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02]"
                >
                  <div className="h-36 bg-white/[0.04] animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-white/[0.06] rounded w-3/4 animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-3 bg-white/[0.04] rounded w-14 animate-pulse" />
                      <div className="h-3 bg-white/[0.04] rounded w-16 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : stores.length > 0 ? (
            <div className="space-y-4">
              {stores.map((store, index) => (
                <StoreCard 
                  key={store.id} 
                  store={store}
                  index={index}
                  isMobile={isMobile}
                  onClick={() => onStoreSelect?.(store)}
                  isFavorite={favoriteStores.includes(store.id)}
                  onFavoriteToggle={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="py-14 px-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex flex-col items-center text-center max-w-sm mx-auto">
                <div className="w-14 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <FaStore className="text-white/25 text-xl" />
                </div>
                <h3 className="font-semibold text-white text-base mb-1">No stores nearby</h3>
                <p className="text-white/45 text-sm mb-6 leading-relaxed">Stores are being added in your area. Try a different location or explore products.</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => onNavigate?.('search')}
                    className="px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl text-sm hover:bg-emerald-400 active:scale-[0.98] transition-all duration-200"
                  >
                    Explore Products
                  </button>
                  <button
                    onClick={() => setShowLocationPicker(true)}
                    className="px-5 py-2.5 bg-white/[0.06] text-white font-medium rounded-xl text-sm border border-white/[0.08] hover:bg-white/[0.08] active:scale-[0.98] transition-all duration-200"
                  >
                    Change Location
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Featured Products */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[17px] font-semibold text-white tracking-tight">
              Trending Now
            </h2>
            <button 
              onClick={() => onNavigate?.('search')}
              className="text-sm text-emerald-400 font-medium flex items-center gap-1 hover:text-emerald-300 active:opacity-80 transition-opacity"
            >
              See all <FaChevronRight className="text-[10px]" />
            </button>
          </div>
          {featuredProducts.length > 0 ? (
            <div 
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
              style={{
                marginLeft: -20,
                marginRight: -20,
                paddingLeft: 'max(env(safe-area-inset-left), 20px)',
                paddingRight: 20,
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {featuredProducts.map((product, i) => (
                <ProductCard key={i} product={product} onAdd={onProductAdd} index={i} />
              ))}
            </div>
          ) : (
            <div 
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
              style={{
                marginLeft: -20,
                marginRight: -20,
                paddingLeft: 'max(env(safe-area-inset-left), 20px)',
                paddingRight: 20,
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="flex-shrink-0 w-40 h-44 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
                >
                  <div className="h-28 bg-white/[0.04] animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-white/[0.06] rounded w-2/3 animate-pulse" />
                    <div className="h-4 bg-white/[0.06] rounded w-1/2 animate-pulse" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => onNavigate?.('search')}
                className="flex-shrink-0 w-40 h-44 rounded-xl border border-dashed border-white/[0.12] flex flex-col items-center justify-center gap-2 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] active:scale-[0.98] transition-all duration-200"
              >
                <FaSearch className="text-white/25 text-xl" />
                <span className="text-white/40 text-sm font-medium">Explore</span>
              </button>
            </div>
          )}
        </section>
        </div>
      </div>

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
