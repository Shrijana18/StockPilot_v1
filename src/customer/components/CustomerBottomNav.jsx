/**
 * CustomerBottomNav - Professional tab bar for native app
 */

import React from 'react';
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
    { id: 'cart', icon: HiShoppingCart, label: 'Cart' },
    { id: 'orders', icon: HiClipboardList, label: 'Orders' },
    { id: 'profile', icon: HiUser, label: 'Profile' },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ 
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingLeft: 'max(env(safe-area-inset-left), 16px)',
        paddingRight: 'max(env(safe-area-inset-right), 16px)',
        paddingTop: 8,
        background: 'rgba(11, 15, 20, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isCart = tab.id === 'cart';

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all duration-200 min-w-[56px] ${
                isActive 
                  ? 'text-emerald-400' 
                  : 'text-white/45 hover:text-white/70 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon className={`text-[22px] ${isActive ? 'opacity-100' : 'opacity-80'}`} />
                {isCart && cartCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-semibold">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-medium mt-1.5 ${isActive ? 'text-emerald-400' : 'text-white/50'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerBottomNav;
