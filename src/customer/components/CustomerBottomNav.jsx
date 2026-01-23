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
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/90 to-transparent pointer-events-none" />
      
      {/* Navigation */}
      <div className="relative px-4 pb-3">
        <div className="bg-[#111827]/95 backdrop-blur-2xl rounded-2xl border border-emerald-500/10 px-2 py-2 shadow-xl shadow-black/20">
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
                  className="relative flex flex-col items-center justify-center py-2.5 px-4 rounded-xl transition-all duration-200"
                >
                  {/* Active Background */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/30"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  {/* Icon */}
                  <div className="relative z-10">
                    <Icon 
                      className={`text-xl transition-colors duration-200 ${
                        isActive ? 'text-emerald-400' : 'text-white/40'
                      }`} 
                    />

                    {/* Cart Badge */}
                    {isCart && cartCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2.5 min-w-[20px] h-[20px] px-1 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center border-2 border-[#111827] shadow-lg shadow-emerald-500/30"
                      >
                        <span className="text-white text-[10px] font-bold">
                          {cartCount > 99 ? '99+' : cartCount}
                        </span>
                      </motion.span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`relative z-10 text-[10px] font-semibold mt-1.5 transition-colors duration-200 ${
                      isActive ? 'text-emerald-400' : 'text-white/40'
                    }`}
                  >
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
