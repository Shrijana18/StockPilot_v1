/**
 * CustomerProfile - Enhanced Profile with Blinkit/Zomato-style features
 * Features: Email editing, Profile picture, Payment methods, Notifications, Referral, Security
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUser, FaMapMarkerAlt, FaPhone, FaEnvelope, FaSignOutAlt,
  FaChevronRight, FaPlus, FaEdit, FaTrash, FaShieldAlt,
  FaQuestionCircle, FaInfoCircle, FaCreditCard, FaBell,
  FaGift, FaLock, FaLanguage, FaUserEdit, FaCamera,
  FaCheck, FaTimes, FaCopy, FaStar, FaWallet, FaCoins, FaUserTimes, FaClock
} from 'react-icons/fa';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { getCustomerOrders } from '../services/orderService';
import SupportFlow from '../components/SupportFlow';

// FLYP Logo
const FlypLogo = () => (
  <img src="/assets/flyp_logo.png" alt="FLYP" className="w-12 h-12 object-contain" />
);

// Menu Item Component
const MenuItem = ({ icon: Icon, label, value, onClick, danger, badge }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3 ${danger ? 'text-red-400' : 'text-white'} hover:bg-white/5 transition-colors`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
      danger ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-700 border border-slate-600'
    }`}>
      <Icon className={danger ? 'text-red-400' : 'text-slate-400'} />
    </div>
    <div className="flex-1 text-left">
      <div className="flex items-center gap-2">
        <p className="font-medium">{label}</p>
        {badge && (
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
            {badge}
          </span>
        )}
      </div>
      {value && <p className="text-sm text-white/40">{value}</p>}
    </div>
    <FaChevronRight className="text-white/30" />
  </button>
);

// Address Card
const AddressCard = ({ address, onEdit, onDelete, onSetDefault }) => (
  <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-4">
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <FaMapMarkerAlt className="text-emerald-400 text-sm" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white">{address.label}</p>
            {address.isDefault && (
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full">
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">{address.address}</p>
        </div>
      </div>
    </div>
    <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
      {!address.isDefault && (
        <button
          onClick={() => onSetDefault(address.id)}
          className="flex-1 py-2 text-sm text-emerald-400 font-medium hover:bg-emerald-500/10 rounded-lg transition"
        >
          Set as Default
        </button>
      )}
      <button
        onClick={() => onEdit(address)}
        className="px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg transition"
      >
        <FaEdit />
      </button>
      <button
        onClick={() => onDelete(address.id)}
        className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition"
      >
        <FaTrash />
      </button>
    </div>
  </div>
);

// Edit Modal Component
const EditModal = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[60] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-t-[28px] border-t border-white/10 shadow-xl overflow-y-auto"
          style={{ 
            maxHeight: 'calc(90vh - env(safe-area-inset-bottom))',
            paddingBottom: 'calc(100px + env(safe-area-inset-bottom))'
          }}
        >
          <div className="flex justify-center py-4 sticky top-0 bg-gradient-to-b from-slate-800 to-transparent z-10">
            <div className="w-12 h-1 bg-white/20 rounded-full" />
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{title}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition"
              >
                <FaTimes />
              </button>
            </div>
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const CustomerProfile = ({ onBack }) => {
  const { customer, customerData, updateProfile, logout, deleteAccount, setDefaultAddress, addAddress } = useCustomerAuth();
  const fileInputRef = useRef(null);
  
  // State management
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(customerData?.name || '');
  const [showAddresses, setShowAddresses] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });
  const [showSupportFlow, setShowSupportFlow] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState(customerData?.email || '');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState(customer?.phoneNumber || '');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  
  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    pushNotifications: customerData?.settings?.pushNotifications ?? true,
    emailNotifications: customerData?.settings?.emailNotifications ?? false,
    smsNotifications: customerData?.settings?.smsNotifications ?? false,
    orderUpdates: customerData?.settings?.orderUpdates ?? true,
    offers: customerData?.settings?.offers ?? true,
  });
  
  // Pull to refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Payment methods (mock data - integrate with your payment system)
  const [paymentMethods, setPaymentMethods] = useState(customerData?.paymentMethods || []);
  
  // Actual order count and recent orders from database
  const [actualOrderCount, setActualOrderCount] = useState(customerData?.totalOrders || 0);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Fetch actual order count and recent orders on mount
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!customer?.uid) return;
      
      try {
        setLoadingOrders(true);
        const orders = await getCustomerOrders(customer.uid, 1000); // Get all orders
        const count = orders.length;
        setActualOrderCount(count);
        setRecentOrders(orders.slice(0, 3)); // Get 3 most recent
        
        // Update customerData if count differs
        const storedCount = customerData?.totalOrders || 0;
        if (Math.abs(count - storedCount) > 0) {
          await updateProfile({ totalOrders: count });
        }
      } catch (error) {
        console.error('Error fetching order data:', error);
        setActualOrderCount(customerData?.totalOrders || 0);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrderData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.uid]);

  // Handle name update
  const handleNameUpdate = async () => {
    if (isUpdating) return; // Prevent double updates
    
    if (newName.trim() && newName !== customerData?.name) {
      setIsUpdating(true);
      
      // Save current scroll position and layout state
      const scrollPosition = window.scrollY;
      const scrollContainer = document.querySelector('.customer-scroll');
      const containerScrollTop = scrollContainer?.scrollTop || 0;
      
      try {
        const result = await updateProfile({ name: newName.trim() });
        if (result.success) {
          setEditingName(false);
          
          // Restore scroll positions immediately after state update
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollPosition);
            if (scrollContainer) {
              scrollContainer.scrollTop = containerScrollTop;
            }
          });
        }
      } catch (error) {
        console.error('Error updating name:', error);
      } finally {
        setIsUpdating(false);
      }
    } else {
      setEditingName(false);
    }
  };

  // Handle email update
  const handleEmailUpdate = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail.trim()) {
      alert('Please enter a valid email address');
      return;
    }
    if (!emailRegex.test(newEmail.trim())) {
      alert('Please enter a valid email format');
      return;
    }
    const result = await updateProfile({ email: newEmail.trim() });
    if (result.success) {
      setShowEmailModal(false);
    } else {
      alert('Failed to update email. Please try again.');
    }
  };

  // Handle phone update
  const handlePhoneUpdate = async () => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(newPhone.replace(/\s/g, ''))) {
      alert('Please enter a valid phone number');
      return;
    }
    // Note: Phone number update might require OTP verification in production
    alert('Phone number update requires verification. This feature will be available soon.');
    setShowPhoneModal(false);
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }
    
    // Convert to base64 for now (in production, upload to Firebase Storage)
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      const result = await updateProfile({ profilePicture: base64String });
      if (result.success) {
        alert('Profile picture updated successfully!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle notification settings update
  const handleNotificationToggle = async (key) => {
    const updated = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(updated);
    await updateProfile({ 
      settings: {
        ...customerData?.settings,
        ...updated
      }
    });
  };

  // Handle add payment method
  const handleAddPaymentMethod = () => {
    // In production, integrate with payment gateway
    alert('Payment method integration coming soon!');
  };

  // Handle referral code
  const handleReferralCodeCopy = () => {
    const referralCode = customerData?.referralCode || `FLYP${customer?.uid?.slice(-6).toUpperCase()}`;
    navigator.clipboard.writeText(referralCode);
    alert('Referral code copied to clipboard!');
  };

  // Handle add address
  const handleAddAddress = async () => {
    if (newAddress.label && newAddress.address) {
      await addAddress(newAddress);
      setNewAddress({ label: '', address: '' });
      setAddingAddress(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  // Handle delete account (Apple Guideline 5.1.1(v))
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteAccountLoading(true);
    try {
      const result = await deleteAccount();
      if (result.success) {
        setShowDeleteAccountModal(false);
        setDeleteConfirmText('');
      } else {
        alert(result.error || 'Could not delete account. Please try again.');
      }
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // Handle pull to refresh
  const handleRefresh = async () => {
    if (refreshing || !customer?.uid) return;
    setRefreshing(true);
    try {
      const orders = await getCustomerOrders(customer.uid, 1000);
      const count = orders.length;
      setActualOrderCount(count);
      setRecentOrders(orders.slice(0, 3));
      await updateProfile({ totalOrders: count });
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setTimeout(() => setRefreshing(false), 500); // Smooth animation
    }
  };

  // Calculate additional stats
  const totalSavings = customerData?.totalSavings || 0;
  const loyaltyPoints = customerData?.loyaltyPoints || 0;
  const referralCode = customerData?.referralCode || `FLYP${customer?.uid?.slice(-6).toUpperCase()}`;
  
  // Calculate membership tier based on order count
  const getMembershipTier = (orderCount) => {
    if (orderCount >= 50) return { name: 'Diamond', color: 'from-cyan-400 to-blue-500', icon: '💎' };
    if (orderCount >= 25) return { name: 'Platinum', color: 'from-slate-300 to-slate-400', icon: '⭐' };
    if (orderCount >= 10) return { name: 'Gold', color: 'from-yellow-400 to-amber-500', icon: '🏆' };
    if (orderCount >= 5) return { name: 'Silver', color: 'from-slate-400 to-slate-500', icon: '🥈' };
    return { name: 'Bronze', color: 'from-amber-600 to-amber-700', icon: '🥉' };
  };
  
  const membershipTier = getMembershipTier(actualOrderCount);

  return (
    <div className="customer-screen bg-[#0B0F14]">
      {/* Compact Premium Header */}
      <div 
        className="relative px-4 pt-3 pb-4 overflow-hidden flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-transparent" />

        <div className="relative">
          {/* Compact Top Bar */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-white/90">Profile</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition disabled:opacity-50"
            >
              <svg 
                className={`w-4 h-4 text-white ${refreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Compact User Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-3 shadow-xl shadow-black/20"
          >
            <div className="flex items-center gap-3">
              {/* Compact Profile Picture */}
              <div className="relative flex-shrink-0">
                <div 
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-500/50 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {customerData?.profilePicture ? (
                    <img 
                      src={customerData.profilePicture} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FaUser className="text-emerald-400 text-xl" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900 hover:bg-emerald-400 transition"
                >
                  <FaCamera className="text-slate-900 text-[10px]" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                />
              </div>
              
              {/* Compact User Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 h-6">
                  {editingName ? (
                    <>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        disabled={isUpdating}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-base font-bold text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500 h-6 disabled:opacity-50"
                        autoFocus
                        onKeyPress={(e) => e.key === 'Enter' && !isUpdating && handleNameUpdate()}
                        onBlur={() => !isUpdating && handleNameUpdate()}
                      />
                      <button
                        onClick={handleNameUpdate}
                        disabled={isUpdating}
                        className="p-1 bg-emerald-500 rounded-lg text-slate-900 hover:bg-emerald-400 transition flex-shrink-0 disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <div className="w-3 h-3 border border-slate-900 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FaCheck className="text-xs" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (!isUpdating) {
                            setNewName(customerData?.name || '');
                            setEditingName(false);
                          }
                        }}
                        disabled={isUpdating}
                        className="p-1 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition flex-shrink-0 disabled:opacity-50"
                      >
                        <FaTimes className="text-xs" />
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="text-base font-bold text-white truncate">
                        {customerData?.name || 'Customer'}
                      </h2>
                      <button 
                        onClick={() => setEditingName(true)}
                        className="p-0.5 hover:bg-white/10 rounded transition flex-shrink-0"
                      >
                        <FaEdit className="text-white/40 text-xs" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-slate-400 text-xs truncate mt-0.5">{customer?.phoneNumber}</p>
                {/* Compact Membership Badge */}
                <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${membershipTier.color} text-white text-[10px] font-semibold`}>
                  <span className="text-xs">{membershipTier.icon}</span>
                  <span>{membershipTier.name}</span>
                </div>
              </div>

              {/* Quick Stats Badge */}
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold text-white leading-none">{actualOrderCount}</p>
                  <p className="text-[10px] text-white/40 leading-none">Orders</p>
                </div>
                {loyaltyPoints > 0 && (
                  <div className="px-2 py-0.5 bg-amber-500/20 rounded-full border border-amber-500/30">
                    <p className="text-[10px] text-amber-400 font-semibold">{loyaltyPoints} pts</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="customer-scroll">
        <div className="customer-bottom-spacer">

      {/* Compact Stats Grid */}
      <div className="px-4 mt-3">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-3 gap-2"
        >
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-3 text-center hover:bg-white/10 transition cursor-pointer"
          >
            <p className="text-xl font-bold text-white leading-none">{customerData?.addresses?.length || 0}</p>
            <p className="text-[10px] text-white/40 mt-1">Addresses</p>
          </motion.div>
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl rounded-xl border border-emerald-500/20 p-3 text-center hover:from-emerald-500/20 hover:to-teal-500/20 transition cursor-pointer"
          >
            <p className="text-xl font-bold text-emerald-400 leading-none">₹{totalSavings.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-400/60 mt-1">Saved</p>
          </motion.div>
          <motion.div 
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl rounded-xl border border-amber-500/20 p-3 text-center hover:from-amber-500/20 hover:to-orange-500/20 transition cursor-pointer"
          >
            <p className="text-xl font-bold text-amber-400 leading-none">{loyaltyPoints}</p>
            <p className="text-[10px] text-amber-400/60 mt-1">Points</p>
          </motion.div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddresses(!showAddresses)}
            className="flex flex-col items-center gap-2 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:bg-white/10 transition shadow-lg shadow-black/10"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <FaMapMarkerAlt className="text-emerald-400" />
            </div>
            <span className="text-xs text-white/70 font-medium">Addresses</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowPaymentModal(true)}
            className="flex flex-col items-center gap-2 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:bg-white/10 transition shadow-lg shadow-black/10"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FaWallet className="text-blue-400" />
            </div>
            <span className="text-xs text-white/70 font-medium">Wallet</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSupportFlow(true)}
            className="flex flex-col items-center gap-2 p-3 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 hover:bg-white/10 transition shadow-lg shadow-black/10"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FaQuestionCircle className="text-amber-400" />
            </div>
            <span className="text-xs text-white/70 font-medium">Help</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Recent Orders Preview */}
      {!loadingOrders && recentOrders.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <p className="text-sm font-medium text-white/70">Recent Orders</p>
              <button 
                onClick={onBack}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {recentOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={onBack}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    order.status === 'delivered' 
                      ? 'bg-emerald-500/20' 
                      : order.status === 'cancelled' 
                        ? 'bg-red-500/20' 
                        : 'bg-amber-500/20'
                  }`}>
                    {order.status === 'delivered' ? (
                      <FaCheck className="text-emerald-400" />
                    ) : order.status === 'cancelled' ? (
                      <FaTimes className="text-red-400" />
                    ) : (
                      <FaClock className="text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{order.storeName}</p>
                    <p className="text-white/40 text-xs">
                      {order.items?.length || 0} items • ₹{order.total}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-medium capitalize ${
                      order.status === 'delivered' 
                        ? 'text-emerald-400' 
                        : order.status === 'cancelled' 
                          ? 'text-red-400' 
                          : 'text-amber-400'
                    }`}>
                      {order.status}
                    </p>
                    <p className="text-white/30 text-xs">
                      {order.createdAt?.toLocaleDateString?.('en-IN', { month: 'short', day: 'numeric' }) || 'Recent'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Menu Sections */}
      <div className="mt-6 px-4 space-y-4">
        {/* Account Section */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Account
          </p>
          <MenuItem
            icon={FaPhone}
            label="Phone Number"
            value={customer?.phoneNumber}
            onClick={() => setShowPhoneModal(true)}
          />
          <MenuItem
            icon={FaEnvelope}
            label="Email"
            value={customerData?.email || 'Not added'}
            onClick={() => setShowEmailModal(true)}
            badge={!customerData?.email ? 'Add' : undefined}
          />
          <MenuItem
            icon={FaMapMarkerAlt}
            label="Saved Addresses"
            value={`${customerData?.addresses?.length || 0} addresses`}
            onClick={() => setShowAddresses(!showAddresses)}
          />
          <MenuItem
            icon={FaCreditCard}
            label="Payment Methods"
            value={paymentMethods.length > 0 ? `${paymentMethods.length} saved` : 'No payment methods'}
            onClick={() => setShowPaymentModal(true)}
          />
          <MenuItem
            icon={FaUserTimes}
            label="Delete my account"
            value="Permanently delete account and data"
            onClick={() => setShowDeleteAccountModal(true)}
            danger
          />
        </div>

        {/* Preferences Section */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Preferences
          </p>
          <MenuItem
            icon={FaBell}
            label="Notifications"
            value={notificationSettings.pushNotifications ? 'Enabled' : 'Disabled'}
            onClick={() => setShowNotificationsModal(true)}
          />
          <MenuItem
            icon={FaLanguage}
            label="Language"
            value="English"
            onClick={() => alert('Language selection coming soon!')}
          />
        </div>

        {/* Wallet & Rewards */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Wallet & Rewards
          </p>
          <MenuItem
            icon={FaWallet}
            label="FLYP Wallet"
            value={`₹${customerData?.walletBalance || 0} available`}
            onClick={() => alert('Wallet feature coming soon! Add money and get cashback.')}
            badge={customerData?.walletBalance > 0 ? undefined : 'New'}
          />
          <MenuItem
            icon={FaGift}
            label="Referral Code"
            value={referralCode}
            onClick={() => setShowReferralModal(true)}
            badge="Earn ₹50"
          />
          <MenuItem
            icon={FaCoins}
            label="Loyalty Points"
            value={`${loyaltyPoints} points available`}
            onClick={() => alert('Loyalty points redemption coming soon!')}
          />
        </div>

        {/* Security Section */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Security
          </p>
          <MenuItem
            icon={FaLock}
            label="Account Security"
            value="Manage your account security"
            onClick={() => setShowSecurityModal(true)}
          />
        </div>

        {/* Addresses (expanded) */}
        {showAddresses && (
          <div className="space-y-3">
            {customerData?.addresses?.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onSetDefault={setDefaultAddress}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ))}
            
            {addingAddress ? (
              <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Label (Home, Office, etc.)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <textarea
                  placeholder="Full address"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingAddress(false)}
                    className="flex-1 py-2 border border-slate-600 rounded-lg text-slate-400 hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAddress}
                    className="flex-1 py-2 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 transition font-medium"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingAddress(true)}
                className="w-full p-4 rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center gap-2 text-emerald-400 hover:bg-emerald-500/10 transition"
              >
                <FaPlus />
                <span>Add New Address</span>
              </button>
            )}
          </div>
        )}

        {/* Support Section */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Support
          </p>
          <MenuItem
            icon={FaQuestionCircle}
            label="Help & Support"
            onClick={() => setShowSupportFlow(true)}
          />
          <MenuItem
            icon={FaShieldAlt}
            label="Privacy Policy"
            onClick={() => window.open('/privacy.html', '_blank')}
          />
          <MenuItem
            icon={FaInfoCircle}
            label="About FLYP"
            onClick={() => alert('FLYP - Your trusted delivery partner')}
          />
        </div>

        {/* Logout */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <MenuItem
            icon={FaSignOutAlt}
            label="Logout"
            onClick={handleLogout}
            danger
          />
        </div>

        {/* App Info */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-4">
            <FlypLogo />
            <div className="flex-1">
              <p className="text-white font-semibold">FLYP</p>
              <p className="text-xs text-white/40">Version 1.0.10</p>
            </div>
            <button
              onClick={() => alert('You are on the latest version!')}
              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/30"
            >
              Latest
            </button>
          </div>
        </div>
      </div>

        </div>
      </div>

      {/* Email Edit Modal */}
      <EditModal
        isOpen={showEmailModal}
        onClose={() => {
          setNewEmail(customerData?.email || '');
          setShowEmailModal(false);
        }}
        title="Edit Email"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setNewEmail(customerData?.email || '');
                setShowEmailModal(false);
              }}
              className="flex-1 py-3 border border-slate-600 rounded-lg text-slate-400 hover:bg-slate-700 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleEmailUpdate}
              className="flex-1 py-3 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 transition font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </EditModal>

      {/* Phone Edit Modal */}
      <EditModal
        isOpen={showPhoneModal}
        onClose={() => {
          setNewPhone(customer?.phoneNumber || '');
          setShowPhoneModal(false);
        }}
        title="Edit Phone Number"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Enter your phone number"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-white/40 mt-2">
              Phone number update requires OTP verification
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setNewPhone(customer?.phoneNumber || '');
                setShowPhoneModal(false);
              }}
              className="flex-1 py-3 border border-slate-600 rounded-lg text-slate-400 hover:bg-slate-700 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePhoneUpdate}
              className="flex-1 py-3 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 transition font-medium"
            >
              Update
            </button>
          </div>
        </div>
      </EditModal>

      {/* Payment Methods Modal */}
      <EditModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Payment Methods"
      >
        <div className="space-y-4">
          {paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((method, index) => (
                <div key={index} className="bg-slate-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaCreditCard className="text-emerald-400" />
                    <div>
                      <p className="text-white font-medium">{method.type}</p>
                      <p className="text-white/40 text-sm">{method.maskedNumber}</p>
                    </div>
                  </div>
                  <button className="text-red-400 hover:text-red-300">
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FaCreditCard className="text-white/20 text-4xl mx-auto mb-3" />
              <p className="text-white/60">No payment methods added</p>
            </div>
          )}
          <button
            onClick={handleAddPaymentMethod}
            className="w-full py-3 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 transition font-medium flex items-center justify-center gap-2"
          >
            <FaPlus />
            Add Payment Method
          </button>
        </div>
      </EditModal>

      {/* Notifications Modal */}
      <EditModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        title="Notification Settings"
      >
        <div className="space-y-4">
          {Object.entries(notificationSettings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
              <div>
                <p className="text-white font-medium capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-white/40 text-sm">
                  {key === 'pushNotifications' && 'Receive push notifications on your device'}
                  {key === 'emailNotifications' && 'Receive order updates via email'}
                  {key === 'smsNotifications' && 'Receive SMS updates for orders'}
                  {key === 'orderUpdates' && 'Get notified about order status changes'}
                  {key === 'offers' && 'Receive special offers and discounts'}
                </p>
              </div>
              <button
                onClick={() => handleNotificationToggle(key)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  value ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  value ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          ))}
        </div>
      </EditModal>

      {/* Referral Modal */}
      <EditModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        title="Referral Code"
      >
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-lg p-6 text-center border border-emerald-500/30">
            <FaGift className="text-4xl text-emerald-400 mx-auto mb-3" />
            <p className="text-white/60 text-sm mb-2">Your Referral Code</p>
            <p className="text-2xl font-bold text-white mb-4 font-mono">{referralCode}</p>
            <button
              onClick={handleReferralCodeCopy}
              className="px-4 py-2 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 transition font-medium flex items-center gap-2 mx-auto"
            >
              <FaCopy />
              Copy Code
            </button>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-white font-medium mb-2">How it works:</p>
            <ul className="text-white/60 text-sm space-y-1">
              <li>• Share your code with friends</li>
              <li>• They get ₹50 off on first order</li>
              <li>• You get ₹50 when they place an order</li>
            </ul>
          </div>
        </div>
      </EditModal>

      {/* Security Modal */}
      <EditModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        title="Account Security"
      >
        <div className="space-y-3">
          <MenuItem
            icon={FaLock}
            label="Change Password"
            value="Update your account password"
            onClick={() => alert('Password change coming soon!')}
          />
          <MenuItem
            icon={FaShieldAlt}
            label="Two-Factor Authentication"
            value="Add an extra layer of security"
            onClick={() => alert('2FA coming soon!')}
          />
          <MenuItem
            icon={FaUserEdit}
            label="Account Activity"
            value="View recent login activity"
            onClick={() => alert('Account activity coming soon!')}
          />
        </div>
      </EditModal>

      {/* Delete Account Modal - Apple Guideline 5.1.1(v) */}
      <EditModal
        isOpen={showDeleteAccountModal}
        onClose={() => {
          setShowDeleteAccountModal(false);
          setDeleteConfirmText('');
        }}
        title="Delete Account"
      >
        <div className="space-y-4">
          <p className="text-white/80 text-sm">
            This will permanently delete your FLYP account and all associated data (profile, addresses, order history). This action cannot be undone.
          </p>
          <p className="text-white/60 text-sm">
            Type <strong className="text-red-400">DELETE</strong> below to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDeleteAccountModal(false);
                setDeleteConfirmText('');
              }}
              className="flex-1 py-3 border border-slate-600 rounded-lg text-slate-400 hover:bg-slate-700 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deleteAccountLoading}
              className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {deleteAccountLoading ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
        </div>
      </EditModal>

      <SupportFlow
        isOpen={showSupportFlow}
        onClose={() => setShowSupportFlow(false)}
        preSelectedOrder={null}
      />
    </div>
  );
};

export default CustomerProfile;
