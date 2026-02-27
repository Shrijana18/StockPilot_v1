/**
 * StoreDetail - Hero Section that shrinks on scroll
 * Banner/Wallpaper + Logo + Details → Compact header on scroll
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaStar, FaClock, FaSearch, 
  FaMinus, FaPlus, FaShoppingCart, FaHeart, FaTimes, FaShare,
  FaChevronRight, FaPhone, FaMapMarkerAlt, FaMotorcycle,
  FaStore, FaInfoCircle, FaTruck, FaGift, FaRupeeSign, FaRoute,
  FaUndo, FaTag, FaCheckCircle, FaExclamationTriangle
} from 'react-icons/fa';
import { HiBadgeCheck } from 'react-icons/hi';
import { getStoreById, getStoreProducts, getStoreCategories } from '../services/storeService';
import { useCart } from '../context/CartContext';
import { getEffectiveReturnPolicy, getReturnPolicyLabel } from '../../constants/marketplaceOffers';

// ============================================
// CATEGORY ICONS
// ============================================
const getCategoryIcon = (category) => {
  const icons = {
    'All': '🏪', 'Offers': '🏷️', 'Food': '🍕', 'Grocery': '🛒', 'Vegetables': '🥬', 'Fruits': '🍎',
    'Dairy': '🥛', 'Beverages': '🥤', 'Beverage': '🥤', 'Drink': '🍹', 'Snacks': '🍿',
    'Personal Care': '🧴', 'Hair Care': '💇', 'Health': '💊', 'Household': '🏠',
    'Electronics': '📱', 'Clothing': '👕', 'Liquor': '🍺', 'General': '📦'
  };
  return icons[category] || icons[category?.split(' ')[0]] || '📦';
};

/** Product has discount: MRP > price or retailer set offerLabel */
const isDiscounted = (p) => {
  const price = p.sellingPrice ?? p.price ?? 0;
  const mrp = p.mrp ?? price;
  return (mrp > price) || !!(p.offerLabel);
};

// ============================================
// PRODUCT CARD - Compact & Premium Design
// ============================================
const ProductCard = ({ product, cartQuantity, onAdd, onUpdate, onClick, storeReturnPolicy }) => {
  const price = product.sellingPrice || product.price || 0;
  const mrp = product.mrp || price;
  const hasDiscount = mrp > price;
  const discountPercent = hasDiscount ? Math.round((1 - price / mrp) * 100) : 0;
  const offerLabel = product.offerLabel || (discountPercent > 0 ? `${discountPercent}% OFF` : null);
  const isOutOfStock = (product.stock !== undefined && product.stock <= 0) || (product.quantity !== undefined && product.quantity <= 0) || !product.inStock;
  const effectiveReturnPolicy = getEffectiveReturnPolicy(product, storeReturnPolicy);
  const returnPolicyLabel = getReturnPolicyLabel(effectiveReturnPolicy);

  return (
    <div 
      onClick={() => onClick && onClick(product)}
      className={`group bg-white/5 hover:bg-white/10 rounded-xl overflow-hidden border border-white/10 hover:border-emerald-500/30 transition-all duration-200 cursor-pointer ${isOutOfStock ? 'opacity-60' : ''}`}
    >
      {/* Image Container - Fixed small height */}
      <div className="relative h-24 sm:h-28 bg-white rounded-t-xl overflow-hidden">
        {product.imageUrl || product.image ? (
          <img 
            src={product.imageUrl || product.image} 
            alt={product.name} 
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 text-2xl">📦</div>
        )}
        
        {/* Discount Badge */}
        {offerLabel && !isOutOfStock && (
          <span className="absolute top-1 left-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
            <FaTag className="text-[7px]" />
            {offerLabel}
          </span>
        )}
        
        {/* Return Policy Badge */}
        {effectiveReturnPolicy === 'non_returnable' && (
          <span className="absolute top-1 right-1 bg-red-500/80 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
            <FaUndo className="text-[7px]" />
            No Return
          </span>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-white text-[9px] font-semibold bg-red-500/80 px-2 py-0.5 rounded">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {/* Product Name */}
        <p className="text-[10px] sm:text-[11px] text-white/90 font-medium line-clamp-2 leading-tight min-h-[28px]">
          {product.name}
        </p>
        
        {/* Unit & Return Policy */}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[9px] text-white/40 truncate">{product.unit || '1 unit'}</p>
          {effectiveReturnPolicy !== 'non_returnable' && effectiveReturnPolicy !== 'replacement_available' && (
            <span className="text-[8px] text-emerald-400/70 flex items-center gap-0.5">
              <FaUndo className="text-[7px]" />
              {returnPolicyLabel}
            </span>
          )}
        </div>
        
        {/* Price & Add Button Row */}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          {/* Price */}
          <div className="flex flex-col">
            <span className="text-white font-bold text-xs sm:text-sm">₹{price}</span>
            {hasDiscount && (
              <span className="text-white/40 text-[9px] line-through">₹{mrp}</span>
            )}
          </div>
          
          {/* Add/Quantity Button */}
          {cartQuantity > 0 && !isOutOfStock ? (
            <div className="flex items-center bg-emerald-500 rounded-md h-6">
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdate(product.id, cartQuantity - 1); }} 
                className="w-6 h-6 flex items-center justify-center text-white hover:bg-emerald-600 rounded-l-md transition-colors"
              >
                <FaMinus size={7} />
              </button>
              <span className="text-white font-bold text-[10px] min-w-[16px] text-center">{cartQuantity}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onUpdate(product.id, cartQuantity + 1); }} 
                className="w-6 h-6 flex items-center justify-center text-white hover:bg-emerald-600 rounded-r-md transition-colors"
              >
                <FaPlus size={7} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); !isOutOfStock && onAdd(product); }}
              disabled={isOutOfStock}
              className={`h-6 px-2.5 rounded-md text-[9px] font-bold transition-all ${
                isOutOfStock 
                  ? 'bg-white/10 text-white/30' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 active:scale-95'
              }`}
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// PRODUCT DETAIL MODAL - Premium UI/UX (Mobile-First Bottom Sheet)
// ============================================
const ProductDetailModal = ({ product, store, isOpen, onClose, cartQuantity, onAdd, onUpdate, storeReturnPolicy }) => {
  const price = product?.sellingPrice || product?.price || 0;
  const mrp = product?.mrp || price;
  const hasDiscount = mrp > price;
  const offerLabel = product?.offerLabel || (hasDiscount ? `${Math.round((1 - price / mrp) * 100)}% OFF` : null);
  const isOutOfStock = (product?.stock !== undefined && product?.stock <= 0) || (product?.quantity !== undefined && product?.quantity <= 0) || !product?.inStock;
  const effectiveReturnPolicy = getEffectiveReturnPolicy(product, storeReturnPolicy);
  const returnPolicyLabel = getReturnPolicyLabel(effectiveReturnPolicy);
  const savings = mrp > price ? mrp - price : 0;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Prevent backdrop scroll on mobile
  const handleBackdropTouch = (e) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
    }
  };

  if (!isOpen || !product) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            onTouchMove={handleBackdropTouch}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md touch-none"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          />
          
          {/* Modal - Centered on all screens */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, x: "-50%", y: "calc(-50% + 20px)" }}
            animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
            exit={{ scale: 0.95, opacity: 0, x: "-50%", y: "calc(-50% + 20px)" }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 300,
              mass: 0.8
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed top-1/2 left-1/2 z-[101] bg-slate-900 rounded-2xl border border-white/10 shadow-2xl w-[calc(100%-2rem)] sm:w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ 
              WebkitOverflowScrolling: 'touch'
            }}
          >

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-all z-10 touch-manipulation"
              aria-label="Close"
            >
              <FaTimes className="text-white/70 text-sm" />
            </button>

            {/* Product Image - Hero Section */}
            <div className="relative h-56 sm:h-64 md:h-80 bg-gradient-to-br from-white to-gray-50 rounded-t-2xl overflow-hidden">
              {product.imageUrl || product.image ? (
                <img
                  src={product.imageUrl || product.image}
                  alt={product.name}
                  className="w-full h-full object-contain p-8"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50 text-6xl">
                  📦
                </div>
              )}
              
              {/* Offer Badge */}
              {offerLabel && !isOutOfStock && (
                <div className="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <FaTag className="text-xs" />
                  <span className="font-bold text-sm">{offerLabel}</span>
                </div>
              )}

              {/* Out of Stock Overlay */}
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <FaExclamationTriangle className="text-red-400 text-4xl mx-auto mb-2" />
                    <span className="text-white font-bold text-lg">Out of Stock</span>
                  </div>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-5 md:p-6 space-y-4">
              {/* Name & Category */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-white flex-1 leading-tight pr-2">{product.name}</h2>
                  {product.category && (
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] md:text-xs font-medium flex-shrink-0">
                      {product.category}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {product.brand && (
                    <p className="text-white/60 text-sm">Brand: <span className="text-white/80 font-medium">{product.brand}</span></p>
                  )}
                  {product.sku && (
                    <p className="text-white/40 text-xs">SKU: {product.sku}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-white/70 text-sm font-medium mb-2 flex items-center gap-2">
                    <FaInfoCircle className="text-emerald-400" />
                    Description
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Pricing */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-cyan-500/10 rounded-xl p-4 md:p-5 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <div className="flex flex-wrap items-baseline gap-2 md:gap-3 mb-3">
                  <span className="text-2xl md:text-3xl font-bold text-white">₹{price}</span>
                  {hasDiscount && (
                    <>
                      <span className="text-lg md:text-xl text-white/40 line-through">₹{mrp}</span>
                      {savings > 0 && (
                        <span className="text-xs md:text-sm text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Save ₹{savings}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
                  <div className="flex items-center gap-1.5 text-white/70">
                    <FaRupeeSign className="text-[10px]" />
                    <span>{product.unit || '1 unit'}</span>
                  </div>
                  {/* Stock Status - Hide quantity from customers */}
                  {product.quantity !== undefined && (
                    <div className="flex items-center gap-1.5 text-white/70">
                      <FaCheckCircle className="text-[10px] text-emerald-400" />
                      <span className={product.quantity > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {product.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Return Policy */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white/80 text-sm font-semibold mb-3 flex items-center gap-2">
                  <FaUndo className="text-emerald-400 text-sm" />
                  Return &amp; Replacement Policy
                </h3>
                <div className="space-y-2">
                  {effectiveReturnPolicy === 'non_returnable' ? (
                    <div className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                      <FaExclamationTriangle className="text-red-400 text-base flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-300 font-semibold text-sm mb-1">Non-returnable</p>
                        <p className="text-red-300/70 text-xs leading-relaxed">This item cannot be returned or replaced once purchased.</p>
                      </div>
                    </div>
                  ) : effectiveReturnPolicy === 'replacement_available' ? (
                    <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <FaCheckCircle className="text-amber-400 text-base flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-amber-300 font-semibold text-sm mb-1">Replacement Available</p>
                        <p className="text-amber-300/70 text-xs leading-relaxed">Replace if defective, damaged, or wrong item received.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <FaCheckCircle className="text-emerald-400 text-base flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-emerald-300 font-semibold text-sm mb-1">{returnPolicyLabel}</p>
                        <p className="text-emerald-300/70 text-xs leading-relaxed">
                          {effectiveReturnPolicy.includes('1h') 
                            ? 'Return or replace within 1 hour of delivery.'
                            : effectiveReturnPolicy.includes('24h')
                              ? 'Return or replace within 24 hours of delivery.'
                              : effectiveReturnPolicy.includes('3d')
                                ? 'Return or replace within 3 days of delivery.'
                                : 'Return or replace as per store policy.'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {(product.barcode || product.packSize) && (
                <div className="grid grid-cols-2 gap-3">
                  {product.barcode && (
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-white/40 text-xs mb-1">Barcode</p>
                      <p className="text-white text-sm font-medium">{product.barcode}</p>
                    </div>
                  )}
                  {product.packSize && (
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-white/40 text-xs mb-1">Pack Size</p>
                      <p className="text-white text-sm font-medium">{product.packSize}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Add to Cart Section */}
              <div className="pt-4 border-t border-white/10">
                {isOutOfStock ? (
                  <button
                    disabled
                    className="w-full py-4 bg-white/10 text-white/40 rounded-xl font-semibold cursor-not-allowed touch-manipulation"
                  >
                    Out of Stock
                  </button>
                ) : cartQuantity > 0 ? (
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex-1 flex items-center justify-between bg-emerald-500/20 rounded-xl p-2 border border-emerald-500/30">
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdate(product.id, cartQuantity - 1); }}
                        className="w-10 h-10 rounded-lg bg-emerald-500 text-slate-900 flex items-center justify-center active:bg-emerald-400 active:scale-95 transition-all touch-manipulation"
                        aria-label="Decrease quantity"
                      >
                        <FaMinus className="text-sm" />
                      </button>
                      <span className="text-white font-bold text-lg min-w-[2rem] text-center">{cartQuantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onUpdate(product.id, cartQuantity + 1); }}
                        className="w-10 h-10 rounded-lg bg-emerald-500 text-slate-900 flex items-center justify-center active:bg-emerald-400 active:scale-95 transition-all touch-manipulation"
                        aria-label="Increase quantity"
                      >
                        <FaPlus className="text-sm" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="px-5 md:px-6 py-4 bg-emerald-500 text-slate-900 rounded-xl font-semibold active:bg-emerald-400 active:scale-95 transition-all flex items-center gap-2 touch-manipulation"
                    >
                      <FaShoppingCart />
                      <span className="hidden sm:inline">View Cart</span>
                      <span className="sm:hidden">Cart</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAdd(product); }}
                    className="w-full py-4 bg-emerald-500 text-slate-900 rounded-xl font-semibold active:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <FaShoppingCart />
                    <span>Add to Cart</span>
                    <span className="font-bold">• ₹{price}</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ============================================
// STORE INFO SHEET
// ============================================
const StoreInfoSheet = ({ store, isOpen, onClose, customerDistance, isWithinDeliveryRange }) => {
  const storeName = store?.businessName || store?.name || 'Store';
  
  if (!isOpen || !store) return null;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60"
      />
      
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-800 rounded-t-2xl overflow-y-auto"
        style={{ 
          maxHeight: 'calc(70vh - env(safe-area-inset-bottom))',
          paddingBottom: 'calc(100px + env(safe-area-inset-bottom))'
        }}
      >
        <div className="p-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center overflow-hidden">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <FaStore className="text-emerald-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{storeName}</h3>
              <p className="text-white/50 text-sm">{store.category || 'General Store'}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <FaTimes className="text-white/60 text-sm" />
            </button>
          </div>
          
          {store.description && (
            <p className="text-white/60 text-sm mb-4">{store.description}</p>
          )}
          
          <div className="space-y-2">
            {/* Out of Delivery Range Warning */}
            {store.deliveryEnabled !== false && !isWithinDeliveryRange && customerDistance !== null && (
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <FaMapMarkerAlt className="text-red-400 text-sm" />
                  <span className="text-red-400 text-xs font-bold">Out of Delivery Range</span>
                </div>
                <p className="text-red-400/80 text-xs">
                  You are <span className="font-bold">{customerDistance} km</span> away from this store. 
                  They only deliver within <span className="font-bold">{store.deliveryRadius || 10} km</span>.
                </p>
                {store.pickupEnabled && (
                  <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                    <FaStore className="text-xs" />
                    Store pickup is still available!
                  </p>
                )}
              </div>
            )}
            
            {/* Delivery Info Section */}
            {store.deliveryEnabled !== false && (
              <div className={`p-3 rounded-xl border ${
                isWithinDeliveryRange 
                  ? 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/20' 
                  : 'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FaTruck className={isWithinDeliveryRange ? 'text-emerald-400 text-sm' : 'text-white/40 text-sm'} />
                    <span className={isWithinDeliveryRange ? 'text-emerald-400 text-xs font-medium' : 'text-white/50 text-xs font-medium'}>
                      Delivery Info
                    </span>
                  </div>
                  {!isWithinDeliveryRange && (
                    <span className="text-[9px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Not Available</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {parseFloat(store.minOrderValue) > 0 && (
                    <div className="p-2 bg-white/5 rounded-lg">
                      <p className="text-white/40 text-[9px]">Min. Order</p>
                      <p className="text-white text-sm font-bold">₹{store.minOrderValue}</p>
                    </div>
                  )}
                  {parseFloat(store.freeDeliveryAbove) > 0 && (
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <p className="text-emerald-400 text-[9px]">Free Delivery</p>
                      <p className="text-emerald-400 text-sm font-bold">Above ₹{store.freeDeliveryAbove}</p>
                    </div>
                  )}
                  <div className="p-2 bg-white/5 rounded-lg">
                    <p className="text-white/40 text-[9px]">Delivery Fee</p>
                    <p className="text-white text-sm font-bold">
                      {store.distanceBasedFee 
                        ? `₹${store.baseFee || 20}+` 
                        : `₹${store.deliveryFee || 20}`}
                    </p>
                  </div>
                  <div className="p-2 bg-white/5 rounded-lg">
                    <p className="text-white/40 text-[9px]">Delivers within</p>
                    <p className="text-white text-sm font-bold">{store.deliveryRadius || 5} km</p>
                  </div>
                </div>
                {store.distanceBasedFee && (
                  <p className="text-white/40 text-[10px] mt-2">
                    * Delivery fee: ₹{store.baseFee || 20} base + ₹{store.perKmFee || 5}/km after {store.baseDistance || 2}km
                  </p>
                )}
              </div>
            )}
            
            {/* Pickup Available */}
            {store.pickupEnabled && (
              <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <FaStore className="text-purple-400" />
                <div className="flex-1">
                  <p className="text-purple-400 text-[10px]">Store Pickup Available</p>
                  <p className="text-white text-sm">Skip delivery fee - pick up at store</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
              <FaMapMarkerAlt className="text-emerald-400" />
              <div className="flex-1">
                <p className="text-white/40 text-[10px]">Address</p>
                <p className="text-white text-sm">{store.address || 'Not available'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
              <FaClock className="text-blue-400" />
              <div className="flex-1">
                <p className="text-white/40 text-[10px]">Hours</p>
                <p className="text-white text-sm">{store.openTime || '9 AM'} - {store.closeTime || '9 PM'}</p>
              </div>
            </div>
            
            {store.phone && (
              <a href={`tel:${store.phone}`} className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <FaPhone className="text-emerald-400" />
                <div className="flex-1">
                  <p className="text-emerald-400 text-[10px]">Call Store</p>
                  <p className="text-white text-sm font-medium">{store.phone}</p>
                </div>
                <FaChevronRight className="text-emerald-400 text-sm" />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Haversine formula to calculate distance
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

// ============================================
// MAIN COMPONENT
// ============================================
const StoreDetail = ({ storeId, onBack, onCartClick }) => {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showStoreInfo, setShowStoreInfo] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Customer location state
  const [customerLocation, setCustomerLocation] = useState(null);
  const [customerDistance, setCustomerDistance] = useState(null);
  const [isWithinDeliveryRange, setIsWithinDeliveryRange] = useState(true);

  const { addToCart, updateQuantity, getItemQuantity, getCartTotals, cartStore } = useCart();
  const { itemCount, total } = getCartTotals();

  const storeName = store?.businessName || store?.name || 'Store';
  
  // Get customer's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCustomerLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location not available:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);
  
  // Calculate distance and check delivery range when store and customer location are available
  useEffect(() => {
    if (store && customerLocation) {
      // Get store location
      let storeLat, storeLng;
      if (store.location) {
        storeLat = store.location.latitude || store.location._lat;
        storeLng = store.location.longitude || store.location._long;
      }
      
      if (storeLat && storeLng) {
        const distance = calculateDistance(
          customerLocation.lat, 
          customerLocation.lng, 
          storeLat, 
          storeLng
        );
        const roundedDistance = Math.round(distance * 10) / 10;
        setCustomerDistance(roundedDistance);
        
        // Check if within delivery radius
        const deliveryRadius = store.deliveryRadius || 10; // Default 10km
        setIsWithinDeliveryRange(roundedDistance <= deliveryRadius);
      }
    }
  }, [store, customerLocation]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return;
      setLoading(true);
      try {
        const [storeData, productsData, categoriesData] = await Promise.all([
          getStoreById(storeId),
          getStoreProducts(storeId),
          getStoreCategories(storeId)
        ]);
        setStore(storeData);
        setProducts(productsData || []);
        const discountedCount = (productsData || []).filter(isDiscounted).length;
        setCategories(['All', ...(discountedCount > 0 ? ['Offers'] : []), ...(categoriesData || [])]);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [storeId]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCategory = selectedCategory === 'All'
        ? true
        : selectedCategory === 'Offers'
          ? isDiscounted(p)
          : p.category === selectedCategory;
      const matchSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const getCategoryCount = (cat) => {
    if (cat === 'All') return products.length;
    if (cat === 'Offers') return products.filter(isDiscounted).length;
    return products.filter(p => p.category === cat).length;
  };

  const handleAddToCart = (product) => {
    addToCart(product, store);
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!store) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <FaStore className="text-white/20 text-4xl mb-3" />
        <p className="text-white/50 mb-4">Store not found</p>
        <button onClick={onBack} className="px-6 py-2 bg-emerald-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-emerald-400 transition">
          Go Back
        </button>
      </div>
    );
  }
  
  // Check if store is completely unavailable (out of delivery range AND no pickup)
  const isDeliveryEnabled = store.deliveryEnabled !== false;
  const isPickupEnabled = store.pickupEnabled === true;
  const isStoreUnavailable = !isWithinDeliveryRange && customerDistance !== null && !isPickupEnabled && isDeliveryEnabled;
  
  // Store Unavailable State - Out of range with no pickup option
  if (isStoreUnavailable) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm text-center">
          {/* Store Logo */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 mx-auto mb-4">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={storeName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
                <FaStore className="text-red-400 text-2xl" />
              </div>
            )}
          </div>
          
          {/* Store Name */}
          <h2 className="text-white font-bold text-xl mb-2">{storeName}</h2>
          <p className="text-white/50 text-sm mb-6">{store.category || 'General Store'}</p>
          
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaMapMarkerAlt className="text-red-400 text-2xl" />
          </div>
          
          {/* Message */}
          <h3 className="text-red-400 font-semibold text-lg mb-2">Store Not Available</h3>
          <p className="text-white/60 text-sm mb-2">
            You are <span className="text-red-400 font-semibold">{customerDistance} km</span> away from this store.
          </p>
          <p className="text-white/50 text-sm mb-6">
            This store only delivers within <span className="text-white font-medium">{store.deliveryRadius || 10} km</span> and does not offer store pickup.
          </p>
          
          {/* Info Box */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-white/40 text-xs">Delivery Range</p>
                <p className="text-white font-semibold">{store.deliveryRadius || 10} km</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-white/40 text-xs">Your Distance</p>
                <p className="text-red-400 font-semibold">{customerDistance} km</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-white/40 text-xs">Store Pickup</p>
                <p className="text-red-400 font-semibold">Not Available</p>
              </div>
            </div>
          </div>
          
          {/* Back Button */}
          <button 
            onClick={onBack} 
            className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl font-semibold hover:bg-emerald-400 transition-colors"
          >
            Browse Other Stores
          </button>
          
          <p className="text-white/30 text-xs mt-4">
            Try stores closer to your location
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent w-full h-full flex flex-col">
      
      {/* ===== FIXED HEADER ===== */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10 flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-3 px-3 lg:px-4 py-3">
            {/* Back Button */}
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors">
              <FaArrowLeft className="text-white text-sm" />
            </button>
            
            {/* Store Logo */}
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={storeName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                  <FaStore className="text-emerald-400" />
                </div>
              )}
            </div>
            
            {/* Store Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-white font-bold text-sm sm:text-base truncate">{storeName}</h1>
                {store.isVerified && <HiBadgeCheck className="text-emerald-400 flex-shrink-0 text-sm" />}
              </div>
              <p className="text-white/50 text-xs truncate">{store.category || 'General Store'}</p>
            </div>
            
            {/* Stats - Desktop */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <FaStar className="text-amber-400 text-xs" />
                <span className="text-white text-sm font-medium">{store.rating?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <FaClock className="text-emerald-400 text-xs" />
                <span className="text-white text-sm">{store.baseDeliveryTime || store.avgDeliveryTime || 30} min</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <FaMotorcycle className="text-blue-400 text-xs" />
                <span className="text-white text-sm">₹{store.deliveryFee || 20}</span>
              </div>
              {parseFloat(store.freeDeliveryAbove) > 0 && (
                <>
                  <div className="w-px h-4 bg-white/10" />
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full text-emerald-400 text-xs font-medium">
                    <FaGift className="text-xs" />
                    Free delivery above ₹{store.freeDeliveryAbove}
                  </span>
                </>
              )}
              {store.isActive && (
                <>
                  <div className="w-px h-4 bg-white/10" />
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 rounded-full text-emerald-400 text-xs font-medium border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Open Now
                  </span>
                </>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowStoreInfo(true)}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
              >
                <FaInfoCircle className="text-white/60 text-sm" />
              </button>
              <button 
                onClick={() => setIsFavorite(!isFavorite)} 
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
              >
                <FaHeart className={isFavorite ? 'text-red-500 text-sm' : 'text-white/40 text-sm'} />
              </button>
              <button className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 items-center justify-center hover:bg-white/15 transition-colors">
                <FaShare className="text-white/60 text-sm" />
              </button>
            </div>
          </div>
          
          {/* Mobile Stats Row */}
          <div className="md:hidden flex items-center gap-3 px-3 pb-3 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FaStar className="text-amber-400 text-[10px]" />
              <span className="text-white text-xs font-medium">{store.rating?.toFixed(1) || '0.0'}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FaClock className="text-emerald-400 text-[10px]" />
              <span className="text-white text-xs">{store.baseDeliveryTime || store.avgDeliveryTime || 30} min</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <FaMotorcycle className="text-blue-400 text-[10px]" />
              <span className="text-white text-xs">₹{store.deliveryFee || 20}</span>
            </div>
            {parseFloat(store.freeDeliveryAbove) > 0 && (
              <>
                <div className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-emerald-400 text-[10px] font-medium flex-shrink-0">
                  <FaGift className="text-[8px]" />
                  Free &gt;₹{store.freeDeliveryAbove}
                </span>
              </>
            )}
            {store.isActive && (
              <>
                <div className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 rounded-full text-emerald-400 text-[10px] font-medium border border-emerald-500/30 flex-shrink-0">
                  <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                  Open Now
                </span>
              </>
            )}
            {/* Show distance if available */}
            {customerDistance !== null && (
              <>
                <div className="w-px h-3 bg-white/10" />
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 rounded-full text-blue-400 text-[10px] font-medium flex-shrink-0">
                  <FaMapMarkerAlt className="text-[8px]" />
                  {customerDistance} km away
                </span>
              </>
            )}
          </div>
          
          {/* Out of Delivery Range Warning Banner */}
          {store.deliveryEnabled !== false && !isWithinDeliveryRange && customerDistance !== null && (
            <div className="mx-3 mb-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaMapMarkerAlt className="text-red-400 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-red-400 text-xs font-semibold">Out of Delivery Range</p>
                <p className="text-red-400/70 text-[10px]">
                  You are {customerDistance} km away. Store delivers within {store.deliveryRadius || 10} km.
                  {store.pickupEnabled && ' Store pickup is still available.'}
                </p>
              </div>
            </div>
          )}
          
          {/* Search Bar - Integrated in Header */}
          <div className="px-3 lg:px-4 pb-3 lg:ml-52 xl:ml-56">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm" />
              <input
                type="text"
                placeholder={`Search in ${storeName}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-9 bg-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:bg-white/10 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <FaTimes className="text-white/40 text-sm hover:text-white/60" />
                </button>
              )}
            </div>
          </div>
      </header>

      {/* ===== MAIN CONTENT - Scrollable ===== */}
      <div className="flex-1 overflow-y-auto">
        {/* ===== MOBILE: Horizontal Categories (visible on mobile/tablet) ===== */}
        <div className="lg:hidden sticky top-0 z-20 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-md border-b border-white/10">
          <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/30'
                    : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20 border border-white/10'
                }`}
                style={{ minHeight: '36px' }}
              >
                <span>{getCategoryIcon(cat)}</span>
                {cat}
                <span className="opacity-60">({getCategoryCount(cat)})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== DESKTOP: Sidebar + Products Layout ===== */}
        <div className="flex-1 relative">
          
          {/* === LEFT SIDEBAR - FIXED Categories (Desktop Only) === */}
          <aside className="hidden lg:flex flex-col fixed left-0 top-[110px] bottom-0 w-52 xl:w-56 border-r border-white/10 bg-gradient-to-br from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-2xl z-30 overflow-y-auto">
            <div className="p-3 flex-1">
              <h3 className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-3 px-2">Categories</h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                      selectedCategory === cat
                        ? 'bg-emerald-500 text-slate-900'
                        : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'
                    }`}
                  >
                    <span className="text-base">{getCategoryIcon(cat)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedCategory === cat ? 'text-emerald-400' : ''}`}>
                        {cat}
                      </p>
                      <p className="text-[10px] text-white/40">{getCategoryCount(cat)} items</p>
                    </div>
                    {selectedCategory === cat && (
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            {/* Sidebar bottom padding for cart bar */}
            <div className="h-20 flex-shrink-0" />
          </aside>

          {/* === RIGHT CONTENT - Products Grid (with left margin on desktop) === */}
          <div className="lg:ml-52 xl:ml-56">
            {/* Products Header - Sticky */}
            <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-md px-3 lg:px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div>
                <h2 className="text-white font-semibold text-sm">
                  {selectedCategory === 'All' ? 'All Products' : selectedCategory}
                </h2>
                <p className="text-white/40 text-xs">{filteredProducts.length} products</p>
              </div>
            </div>

            {/* Products Grid */}
            <div className="p-3 lg:p-4">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      cartQuantity={getItemQuantity(product.id)}
                      onAdd={handleAddToCart}
                      onUpdate={updateQuantity}
                      onClick={(product) => setSelectedProduct(product)}
                      storeReturnPolicy={store?.returnPolicyDefault}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <FaSearch className="text-white/20 text-2xl mb-3" />
                  <p className="text-white/50 text-sm">No products found</p>
                </div>
              )}
              
              {/* Bottom Padding */}
              <div className="h-24" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== CART BAR - Full Width ===== */}
      <AnimatePresence>
        {itemCount > 0 && cartStore?.id === storeId && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-md border-t border-white/10"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="p-3 lg:pl-56 xl:pl-60">
              <button
                onClick={onCartClick}
                className="w-full bg-emerald-500 text-slate-900 rounded-xl p-3 flex items-center justify-between hover:bg-emerald-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-900/20 rounded-lg flex items-center justify-center">
                    <FaShoppingCart className="text-slate-900" />
                  </div>
                  <div className="text-left">
                    <p className="text-slate-900 font-semibold">{itemCount} item{itemCount > 1 ? 's' : ''}</p>
                    <p className="text-slate-900/70 text-xs">{storeName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-900 font-bold text-lg">₹{total}</span>
                  <div className="w-8 h-8 bg-slate-900/20 rounded-lg flex items-center justify-center">
                    <FaChevronRight className="text-slate-900" />
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Store Info Sheet */}
      <AnimatePresence>
        {showStoreInfo && (
          <StoreInfoSheet 
            store={store} 
            isOpen={showStoreInfo} 
            onClose={() => setShowStoreInfo(false)}
            customerDistance={customerDistance}
            isWithinDeliveryRange={isWithinDeliveryRange}
          />
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        store={store}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        cartQuantity={selectedProduct ? getItemQuantity(selectedProduct.id) : 0}
        onAdd={handleAddToCart}
        onUpdate={updateQuantity}
        storeReturnPolicy={store?.returnPolicyDefault}
      />
    </div>
  );
};

export default StoreDetail;
