/**
 * MobileHeader - Native App-like Top Header
 * Compact header with logo, notifications, and profile
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FaBell, FaSearch, FaUser, FaCog, FaSignOutAlt,
  FaChevronLeft, FaEllipsisV, FaCheck, FaTrash, FaTimes
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
  onNotificationPress,
  notificationItems = [],
  onNotificationItemPress,
  onNotificationMarkAllRead,
  onNotificationClearAll,
  rightContent,
  transparent = false,
}) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

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
            : 'bg-[#0B0F14] border-b border-white/5'
        }`}
        style={{ 
          paddingTop: 'max(calc(env(safe-area-inset-top) - 12px), 2px)',
        }}
      >
        <div className="flex items-center justify-between px-3 py-1.5">
          {/* Left: logo only (enlarged) + "Retailer" or title — no "FLYP" text */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {showBack ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleBack}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
                >
                  <FaChevronLeft className="text-white text-base" />
                </motion.button>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-white truncate">{title}</h1>
                  {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
                </div>
              </>
            ) : (
              <>
                <img src="/assets/flyp_logo.png" alt="" className="h-14 w-14 flex-shrink-0 object-contain" aria-hidden />
                <span className="text-base font-bold text-white truncate">
                  {title === 'FLYP' ? (subtitle || 'Retailer') : title}
                </span>
                {title !== 'FLYP' && subtitle && (
                  <span className="text-[11px] text-gray-400 truncate hidden sm:inline"> · {subtitle}</span>
                )}
              </>
            )}
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
                className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
              >
                <FaSearch className="text-white text-lg" />
              </motion.button>
            )}
            
            {showNotifications && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  await triggerHaptic();
                  onNotificationPress?.();
                  setShowNotificationsPanel((v) => !v);
                }}
                className="relative w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
              >
                <FaBell className="text-white text-lg" />
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
              className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center"
            >
              <FaEllipsisV className="text-white text-lg" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Notification Activity Panel - Redesigned */}
      <AnimatePresence>
        {showNotificationsPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotificationsPanel(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-20 right-3 z-50 w-[min(92vw,400px)] max-h-[72vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0f1419] shadow-2xl"
              style={{ marginTop: 'env(safe-area-inset-top)' }}
            >
              {/* Header with close button */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">Notifications</span>
                  {notificationItems.length > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                      {notificationItems.filter((i) => !i.read).length} unread
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notificationItems.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => onNotificationMarkAllRead?.()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-white/10 text-white/90 hover:bg-white/15 active:scale-95"
                      >
                        <FaCheck /> Read all
                      </button>
                      <button
                        type="button"
                        onClick={() => onNotificationClearAll?.()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 active:scale-95"
                      >
                        <FaTrash /> Clear
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotificationsPanel(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 text-white/80"
                    aria-label="Close notifications"
                  >
                    <FaTimes className="text-sm" />
                  </button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                {notificationItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                      <FaBell className="text-2xl text-white/30" />
                    </div>
                    <p className="text-sm font-medium text-white/70">No notifications yet</p>
                    <p className="text-xs text-white/40 mt-1">Order updates and reminders will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notificationItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNotificationItemPress?.(item);
                          setShowNotificationsPanel(false);
                        }}
                        className={`w-full text-left px-4 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors ${item.read ? 'opacity-75' : 'bg-white/[0.02]'}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-2 flex-shrink-0 h-2 w-2 rounded-full ${item.read ? 'bg-white/30' : 'bg-emerald-400 shadow-sm shadow-emerald-400/40'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                            <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{item.body}</p>
                            <p className="text-[10px] text-white/40 mt-1.5">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
