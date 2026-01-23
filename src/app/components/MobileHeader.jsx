/**
 * MobileHeader - Native App-like Top Header
 * Compact header with logo, notifications, and profile
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FaBell, FaSearch, FaUser, FaCog, FaSignOutAlt,
  FaChevronLeft, FaEllipsisV
} from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/firebaseConfig';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

const MobileHeader = ({ 
  title = 'FLYP',
  subtitle,
  showBack = false,
  showSearch = false,
  showNotifications = true,
  notificationCount = 0,
  onBackPress,
  onSearchPress,
  rightContent,
  transparent = false,
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleBack = async () => {
    await triggerHaptic();
    if (onBackPress) {
      onBackPress();
    } else {
      navigate(-1);
    }
  };

  const handleLogout = async () => {
    await triggerHaptic();
    setShowMenu(false);
    try {
      await signOut(auth);
      navigate('/auth?type=login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-20 ${
          transparent 
            ? 'bg-transparent' 
            : 'bg-gradient-to-b from-[#0f172a] via-[#0f172a]/95 to-transparent'
        }`}
        style={{ 
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left Section */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleBack}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              >
                <FaChevronLeft className="text-white text-sm" />
              </motion.button>
            ) : (
              <div className="flex items-center gap-2">
                {/* FLYP Logo */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
              </div>
            )}
            
            {/* Title */}
            <div>
              <h1 className="text-lg font-bold text-white">{title}</h1>
              {subtitle && (
                <p className="text-xs text-gray-400">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {rightContent}
            
            {showSearch && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  await triggerHaptic();
                  onSearchPress?.();
                }}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              >
                <FaSearch className="text-white text-sm" />
              </motion.button>
            )}
            
            {showNotifications && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={triggerHaptic}
                className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              >
                <FaBell className="text-white text-sm" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </motion.button>
            )}
            
            {/* Menu Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={async () => {
                await triggerHaptic();
                setShowMenu(!showMenu);
              }}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            >
              <FaEllipsisV className="text-white text-sm" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="fixed top-20 right-4 z-50 w-48 bg-[#1e293b] rounded-xl shadow-xl border border-white/10 overflow-hidden"
              style={{ 
                marginTop: 'env(safe-area-inset-top)',
              }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  // Navigate to profile
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
              >
                <FaUser className="text-gray-400" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  // Navigate to settings
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 transition-colors"
              >
                <FaCog className="text-gray-400" />
                <span>Settings</span>
              </button>
              <div className="h-px bg-white/10" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <FaSignOutAlt />
                <span>Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileHeader;
