/**
 * CustomerHeader - Dark theme header for Customer App
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaMapMarkerAlt, FaChevronDown, FaBell, FaSearch 
} from 'react-icons/fa';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

const CustomerHeader = ({ 
  location,
  onLocationClick,
  onSearchClick,
  showSearch = true,
  title,
  subtitle,
  transparent = false
}) => {
  const [notificationCount] = useState(0);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-20 ${
        transparent 
          ? 'bg-transparent' 
          : 'bg-slate-900/95 backdrop-blur-xl border-b border-white/5'
      }`}
      style={{ 
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left - Location */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={async () => {
            await triggerHaptic();
            onLocationClick?.();
          }}
          className="flex items-center gap-2 flex-1 max-w-[60%]"
        >
          <div className="w-8 h-8 rounded-full bg-[#05E06C]/10 border border-[#05E06C]/20 flex items-center justify-center flex-shrink-0">
            <FaMapMarkerAlt className="text-[#05E06C]400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            {title ? (
              <>
                <p className="text-sm font-semibold text-white truncate">{title}</p>
                {subtitle && (
                  <p className="text-xs text-white/40 truncate">{subtitle}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-white/40">Deliver to</p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {location?.label || 'Select Location'}
                  </p>
                  <FaChevronDown className="text-white/40 text-xs flex-shrink-0" />
                </div>
              </>
            )}
          </div>
        </motion.button>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={async () => {
                await triggerHaptic();
                onSearchClick?.();
              }}
              className="w-10 h-10 rounded-full bg-[#101B4A] border border-white/5 flex items-center justify-center"
            >
              <FaSearch className="text-white/60 text-sm" />
            </motion.button>
          )}
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={triggerHaptic}
            className="relative w-10 h-10 rounded-full bg-[#101B4A] border border-white/5 flex items-center justify-center"
          >
            <FaBell className="text-white/60 text-sm" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  );
};

export default CustomerHeader;
