/**
 * CustomerBottomNav - Premium Dark Theme with Green Branding
 * Enhanced animations and visual appeal
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  HiHome, HiSearch, HiShoppingCart, HiClipboardList, HiUser
} from 'react-icons/hi';
import { useCart } from '../context/CartContext';

const CustomerBottomNav = ({ activeTab, onTabChange }) => {
  const { cartItems } = useCart();
  const cartCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const tabs = [
    { id: 'home', icon: HiHome, label: 'Home' },
    { id: 'search', icon: HiSearch, label: 'Search' },
    { id: 'cart', icon: HiShoppingCart, label: 'Cart', badge: cartCount },
    { id: 'orders', icon: HiClipboardList, label: 'Orders' },
    { id: 'profile', icon: HiUser, label: 'Profile' },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Gradient fade */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent pointer-events-none" />
      
      {/* Navigation - Retailer Dashboard pill style */}
      <div className="relative px-4 pb-3">
        <div className="bg-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/10 px-2 py-2 shadow-xl">
          <div className="flex items-center justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isCart = tab.id === 'cart';

              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative flex flex-col items-center justify-center py-2.5 px-4 rounded-lg transition-all duration-200 ${
                    isActive ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'
                  }`}
                >
                  {/* Icon */}
                  <div className="relative">
                    <Icon className="text-xl" />

                    {/* Cart Badge */}
                    {isCart && cartCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2.5 min-w-[20px] h-5 px-1 bg-amber-500 text-slate-900 rounded-full flex items-center justify-center border-2 border-slate-800 text-[10px] font-bold"
                      >
                        {cartCount > 99 ? '99+' : cartCount}
                      </motion.span>
                    )}
                  </div>

                  {/* Label */}
                  <span className="text-[10px] font-semibold mt-1.5">
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerBottomNav;
