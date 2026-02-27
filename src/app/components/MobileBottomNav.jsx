/**
 * MobileBottomNav - Native App-like Bottom Navigation
 * Provides quick access to main app sections with smooth animations
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaHome, FaBox, FaStore, FaWhatsapp, FaUser, FaUsers,
  FaChartLine, FaFileInvoice, FaTruck, FaCog,
  FaPlus, FaTimes, FaBell, FaQrcode
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Haptic feedback helper
const triggerHaptic = async (style = 'light') => {
  try {
    if (style === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (style === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  } catch (e) {
    // Haptics not available
  }
};

const MobileBottomNav = ({ 
  activeTab, 
  onTabChange, 
  userRole = 'distributor',
  unreadCount = 0 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showQuickActions, setShowQuickActions] = useState(false);
  
  // Navigation items based on user role
  const getNavItems = () => {
    if (userRole === 'distributor') {
      return [
        { id: 'home', icon: FaHome, label: 'Home' },
        { id: 'inventory', icon: FaBox, label: 'Inventory' },
        { id: 'whatsapp', icon: FaWhatsapp, label: 'WhatsApp', badge: unreadCount },
        { id: 'retailerRequests', icon: FaStore, label: 'Retailers' },
        { id: 'profile', icon: FaUser, label: 'Profile' },
      ];
    } else if (userRole === 'retailer') {
      return [
        { id: 'home', icon: FaHome, label: 'Home' },
        { id: 'marketplace', icon: FaStore, label: 'Marketplace' },
        { id: 'inventory', icon: FaBox, label: 'Inventory' },
        { id: 'billing', icon: FaFileInvoice, label: 'Billing' },
        { id: 'employees', icon: FaUsers, label: 'Employees' },
        { id: 'profile', icon: FaUser, label: 'Profile' },
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  const handleTabPress = async (item) => {
    await triggerHaptic('light');
    onTabChange?.(item.id);
  };

  const handleQuickActionPress = async (action) => {
    await triggerHaptic('medium');
    setShowQuickActions(false);
    
    switch (action) {
      case 'newInvoice':
        onTabChange?.('manualBilling');
        break;
      case 'scanQR':
        // TODO: Implement QR scanner
        break;
      case 'newOrder':
        onTabChange?.('whatsapp');
        break;
      default:
        break;
    }
  };

  return (
    <>
      {/* Quick Actions Overlay */}
      <AnimatePresence>
        {showQuickActions && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickActions(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            {/* Quick Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3"
            >
              {[
                { id: 'newInvoice', icon: FaFileInvoice, label: 'New Invoice', color: 'from-blue-500 to-blue-600' },
                { id: 'scanQR', icon: FaQrcode, label: 'Scan QR', color: 'from-purple-500 to-purple-600' },
                { id: 'newOrder', icon: FaWhatsapp, label: 'WhatsApp Order', color: 'from-green-500 to-green-600' },
              ].map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    transition: { delay: index * 0.05 }
                  }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  onClick={() => handleQuickActionPress(action.id)}
                  className={`flex items-center gap-3 px-5 py-3 rounded-full bg-gradient-to-r ${action.color} text-white shadow-lg shadow-black/30`}
                >
                  <action.icon className="text-lg" />
                  <span className="font-medium">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar - sits lower to use space; minimal bottom cushion */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/5 relative"
        style={{ 
          background: '#0B0F14',
          paddingBottom: 'max(6px, calc(env(safe-area-inset-bottom) * 0.6))',
        }}
      >
        <div className="flex items-center justify-around px-1 py-1.5 relative">
          {navItems.map((item, index) => {
            const isActive = activeTab === item.id;
            const isCenter = userRole === 'distributor' && index === Math.floor(navItems.length / 2);
            
            // Center FAB button (distributor only)
            if (isCenter) {
              return (
                <React.Fragment key={item.id}>
                  {/* Regular nav item */}
                  <NavItem 
                    item={item} 
                    isActive={isActive} 
                    onPress={() => handleTabPress(item)} 
                  />
                  
                  {/* Center FAB */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={async () => {
                      await triggerHaptic('medium');
                      setShowQuickActions(!showQuickActions);
                    }}
                    className={`relative -mt-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 ${
                      showQuickActions 
                        ? 'bg-red-500' 
                        : 'bg-gradient-to-br from-emerald-400 to-cyan-500'
                    }`}
                  >
                    <motion.div
                      animate={{ rotate: showQuickActions ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {showQuickActions ? (
                        <FaTimes className="text-white text-xl" />
                      ) : (
                        <FaPlus className="text-white text-xl" />
                      )}
                    </motion.div>
                    
                    {/* Pulse animation */}
                    {!showQuickActions && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-emerald-400"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.button>
                </React.Fragment>
              );
            }
            
            return (
              <NavItem 
                key={item.id}
                item={item} 
                isActive={isActive} 
                onPress={() => handleTabPress(item)} 
              />
            );
          })}
        </div>
        {/* Fill to screen bottom so no visible strip; matches reduced padding */}
        <div 
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ 
            height: 'max(6px, calc(env(safe-area-inset-bottom) * 0.6))', 
            background: '#0B0F14',
          }}
          aria-hidden
        />
      </nav>
    </>
  );
};

// Individual Nav Item Component
const NavItem = ({ item, isActive, onPress }) => {
  const Icon = item.icon;
  
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onPress}
      className="relative flex flex-col items-center justify-center min-w-0 flex-1 py-1"
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute -top-0.5 w-9 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
      
      {/* Icon - enlarged for better visibility */}
      <div className={`relative ${isActive ? 'text-emerald-400' : 'text-gray-400'}`}>
        <Icon className={`text-2xl transition-all ${isActive ? 'scale-105' : ''}`} />
        
        {/* Badge */}
        {item.badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </div>
      
      {/* Label */}
      <span className={`text-[11px] mt-1 font-medium transition-all ${
        isActive ? 'text-emerald-400' : 'text-gray-500'
      }`}>
        {item.label}
      </span>
    </motion.button>
  );
};

export default MobileBottomNav;
