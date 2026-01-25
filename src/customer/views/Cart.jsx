/**
 * Cart - Optimized for large orders (100+ items)
 * Fixed header with summary, scrollable items, fixed checkout bar
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaMinus, FaPlus, FaTrash, FaStore,
  FaShoppingBag, FaTag, FaChevronRight, FaChevronDown, FaChevronUp, FaTruck, FaGift
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';
import { useCart } from '../context/CartContext';

// Compact Cart Item - Optimized for performance
const CartItem = ({ item, onUpdate, onRemove }) => (
  <div className="flex items-center gap-3 py-3 border-b border-white/[0.06] last:border-0">
    {/* Product Image - Smaller */}
    <div className="w-14 h-14 bg-white rounded-lg flex-shrink-0 overflow-hidden">
      {item.image ? (
        <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xl bg-gray-100">📦</div>
      )}
    </div>

    {/* Item Details */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <h3 className="font-medium text-white text-sm leading-tight line-clamp-1">
          {item.name}
        </h3>
        {item.offerLabel && (
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded flex-shrink-0">
            {item.offerLabel}
          </span>
        )}
      </div>
      <p className="text-xs text-white/40 mt-0.5">{item.unit || '1 unit'}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-white font-bold text-sm">₹{item.price * item.quantity}</span>
        {(item.mrp != null && item.mrp > item.price) && (
          <span className="text-[10px] text-white/40 line-through">₹{(item.mrp || item.price) * item.quantity}</span>
        )}
        {item.quantity > 1 && (
          <span className="text-[10px] text-white/40">₹{item.price} × {item.quantity}</span>
        )}
      </div>
    </div>

    {/* Quantity Controls - Compact */}
    <div className="flex items-center gap-1">
      <button
        onClick={() => item.quantity === 1 ? onRemove(item.productId) : onUpdate(item.productId, item.quantity - 1)}
        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
          item.quantity === 1 
            ? 'bg-red-500/20 text-red-400' 
            : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1]'
        }`}
      >
        {item.quantity === 1 ? <FaTrash className="text-[10px]" /> : <FaMinus className="text-[10px]" />}
      </button>
      <span className="font-bold text-white text-sm w-6 text-center">{item.quantity}</span>
      <button
        onClick={() => onUpdate(item.productId, item.quantity + 1)}
        className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-colors"
      >
        <FaPlus className="text-[10px]" />
      </button>
    </div>
  </div>
);

// Main Cart Component
const Cart = ({ onBack, onCheckout }) => {
  const { cartItems, cartStore, updateQuantity, removeFromCart, clearCart, getCartTotals } = useCart();
  const { 
    subtotal, deliveryFee, baseDeliveryFee, platformFee, total, itemCount, savings, 
    meetsMinOrder, freeDeliveryAbove, qualifiesForFreeDelivery, amountForFreeDelivery 
  } = getCartTotals();
  const [showAllItems, setShowAllItems] = useState(false);
  const [expandBill, setExpandBill] = useState(true);
  
  // Minimum order requirements
  const minOrderValue = cartStore?.minOrder || 0;
  const amountToAdd = minOrderValue > 0 ? Math.max(0, minOrderValue - subtotal) : 0;
  const canCheckout = minOrderValue === 0 || subtotal >= minOrderValue;

  // Group items by category for large orders
  const itemsToShow = useMemo(() => {
    if (showAllItems || cartItems.length <= 5) {
      return cartItems;
    }
    return cartItems.slice(0, 5);
  }, [cartItems, showAllItems]);

  const hiddenCount = cartItems.length - 5;

  // Empty Cart State
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center">
              <FaArrowLeft className="text-white text-sm" />
            </button>
            <h1 className="font-bold text-white text-lg">My Cart</h1>
          </div>
        </header>

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20">
          <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/[0.08] flex items-center justify-center mb-4">
            <FaShoppingBag className="text-emerald-400 text-4xl" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Your cart is empty</h2>
          <p className="text-white/50 text-center mb-6 text-sm">
            Explore nearby stores and add items to your cart
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-emerald-500 text-slate-900 font-semibold rounded-xl hover:bg-emerald-400 transition"
          >
            Start Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Fixed Header with Summary */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center">
              <FaArrowLeft className="text-white text-sm" />
            </button>
            <div>
              <h1 className="font-bold text-white text-base">My Cart</h1>
              <p className="text-xs text-white/50">{itemCount} items • ₹{subtotal}</p>
            </div>
          </div>
          
          {/* Clear Cart */}
          <button
            onClick={() => {
              if (window.confirm('Clear all items from cart?')) {
                clearCart();
              }
            }}
            className="text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Store Info - Compact */}
        {cartStore && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                <FaStore className="text-emerald-400 text-xs" />
              </div>
              <span className="text-white font-medium truncate">{cartStore.name || cartStore.businessName}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/50 text-xs">{cartStore.avgDeliveryTime || 30} min</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Scrollable (padding for header + checkout bar + bottom nav) */}
      <main className="pt-[110px] pb-[220px]">
        {/* Cart Items - Compact List */}
        <div className="px-4">
          <div className="bg-white/5 rounded-xl border border-white/[0.06] overflow-hidden">
            {/* Items Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
              <span className="text-white font-medium text-sm">{cartItems.length} Items</span>
              {cartItems.length > 5 && (
                <button
                  onClick={() => setShowAllItems(!showAllItems)}
                  className="text-emerald-400 text-xs font-medium flex items-center gap-1"
                >
                  {showAllItems ? 'Show Less' : `+${hiddenCount} more`}
                  {showAllItems ? <FaChevronUp className="text-[10px]" /> : <FaChevronDown className="text-[10px]" />}
                </button>
              )}
            </div>

            {/* Items List */}
            <div className="px-4 divide-y divide-white/[0.04]">
              {itemsToShow.map((item) => (
                <CartItem
                  key={item.productId}
                  item={item}
                  onUpdate={updateQuantity}
                  onRemove={removeFromCart}
                />
              ))}
            </div>

            {/* Show More Button */}
            {!showAllItems && cartItems.length > 5 && (
              <button
                onClick={() => setShowAllItems(true)}
                className="w-full py-3 text-center text-emerald-400 text-sm font-medium border-t border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                View all {cartItems.length} items
              </button>
            )}
          </div>
        </div>

        {/* Coupon Section */}
        <div className="px-4 mt-4">
          <button className="w-full bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-dashed border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <FaTag className="text-emerald-400 text-sm" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-white text-sm">Apply Coupon</p>
              <p className="text-xs text-white/40">Save more on your order</p>
            </div>
            <FaChevronRight className="text-white/30 text-sm" />
          </button>
        </div>

        {/* Bill Details - Collapsible */}
        <div className="px-4 mt-4">
          <div className="bg-white/5 rounded-xl border border-white/[0.06] overflow-hidden">
            <button
              onClick={() => setExpandBill(!expandBill)}
              className="w-full px-4 py-3 flex items-center justify-between bg-white/[0.02]"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-amber-500/20 flex items-center justify-center">
                  <HiSparkles className="text-amber-400 text-sm" />
                </div>
                <span className="font-medium text-white text-sm">Bill Details</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">₹{total}</span>
                {expandBill ? <FaChevronUp className="text-white/40 text-xs" /> : <FaChevronDown className="text-white/40 text-xs" />}
              </div>
            </button>
            
            <AnimatePresence>
              {expandBill && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-2 space-y-2 text-sm">
                    <div className="flex justify-between text-white/60">
                      <span>Item Total</span>
                      <span className="text-white">₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Delivery Fee</span>
                      {qualifiesForFreeDelivery ? (
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 line-through text-xs">₹{baseDeliveryFee}</span>
                          <span className="text-emerald-400 font-medium">FREE</span>
                        </div>
                      ) : (
                        <span className="text-white">₹{deliveryFee}</span>
                      )}
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Platform Fee</span>
                      <span className="text-white">₹{platformFee}</span>
                    </div>
                    {/* Delivery savings from free delivery */}
                    {qualifiesForFreeDelivery && baseDeliveryFee > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Free Delivery Savings</span>
                        <span>-₹{baseDeliveryFee}</span>
                      </div>
                    )}
                    {savings > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Product Savings</span>
                        <span>-₹{savings}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-white/[0.06] font-bold">
                      <span className="text-white">To Pay</span>
                      <span className="text-white text-base">₹{total}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Minimum Order Warning */}
        {!canCheckout && minOrderValue > 0 && (
          <div className="px-4 mt-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <FaShoppingBag className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-400 text-sm">Add ₹{amountToAdd} more</p>
                <p className="text-xs text-amber-400/70">Minimum order is ₹{minOrderValue}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40">Current</p>
                <p className="text-sm font-bold text-white">₹{subtotal}</p>
              </div>
            </div>
          </div>
        )}

        {/* Free Delivery Progress/Banner */}
        {freeDeliveryAbove > 0 && (
          <div className="px-4 mt-4">
            {qualifiesForFreeDelivery ? (
              // Free Delivery Unlocked
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <FaGift className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-400 text-sm">Free Delivery Unlocked!</p>
                  <p className="text-xs text-emerald-400/70">You saved ₹{baseDeliveryFee} on delivery</p>
                </div>
                <div className="px-2 py-1 bg-emerald-500/20 rounded-lg">
                  <span className="text-emerald-400 text-xs font-bold">FREE</span>
                </div>
              </div>
            ) : (
              // Progress towards free delivery
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <FaTruck className="text-blue-400 text-sm" />
                  </div>
                  <div className="flex-1">
                    <p className="text-blue-400 text-sm font-medium">
                      Add ₹{amountForFreeDelivery} more for free delivery
                    </p>
                  </div>
                  <span className="text-white/40 text-xs">₹{freeDeliveryAbove}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((subtotal / freeDeliveryAbove) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Savings Banner */}
        {savings > 0 && (
          <div className="px-4 mt-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <HiSparkles className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-emerald-400 text-sm">You're saving ₹{savings}</p>
                <p className="text-xs text-emerald-400/70">on this order</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Checkout Bar - positioned above bottom nav (80px nav + safe area) */}
      <div className="fixed left-0 right-0 z-40 px-4 pb-3"
           style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {/* Show minimum order progress if not met */}
        {!canCheckout && minOrderValue > 0 && (
          <div className="mb-2 bg-white/5 rounded-xl p-2 border border-amber-500/30">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-amber-400">₹{subtotal} / ₹{minOrderValue}</span>
              <span className="text-white/50">Add ₹{amountToAdd} more</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((subtotal / minOrderValue) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
        
        <button
          onClick={canCheckout ? onCheckout : undefined}
          disabled={!canCheckout}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors ${
            canCheckout 
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900' 
              : 'bg-slate-700 text-white/40 cursor-not-allowed'
          }`}
        >
          <span>{canCheckout ? 'Proceed to Checkout' : `Add ₹${amountToAdd} more`}</span>
          <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${canCheckout ? 'bg-white/20' : 'bg-white/10'}`}>
            ₹{subtotal}
          </span>
        </button>
      </div>
    </div>
  );
};

export default Cart;
