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
  FaCheck, FaTimes, FaCopy, FaStar, FaWallet, FaCoins, FaUserTimes
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

  // Payment methods (mock data - integrate with your payment system)
  const [paymentMethods, setPaymentMethods] = useState(customerData?.paymentMethods || []);
  
  // Actual order count from database
  const [actualOrderCount, setActualOrderCount] = useState(customerData?.totalOrders || 0);

  // Fetch actual order count on mount and when customer changes
  useEffect(() => {
    const fetchOrderCount = async () => {
      if (!customer?.uid) return;
      
      try {
        const orders = await getCustomerOrders(customer.uid, 1000); // Get all orders
        const count = orders.length;
        setActualOrderCount(count);
        
        // Update customerData if count differs (only update if significantly different to avoid loops)
        const storedCount = customerData?.totalOrders || 0;
        if (Math.abs(count - storedCount) > 0) {
          await updateProfile({ totalOrders: count });
        }
      } catch (error) {
        console.error('Error fetching order count:', error);
        // Fallback to stored count on error
        setActualOrderCount(customerData?.totalOrders || 0);
      }
    };

    fetchOrderCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.uid]);

  // Handle name update
  const handleNameUpdate = async () => {
    if (newName.trim() && newName !== customerData?.name) {
      const result = await updateProfile({ name: newName.trim() });
      if (result.success) {
        setEditingName(false);
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

  // Calculate additional stats
  const totalSavings = customerData?.totalSavings || 0;
  const loyaltyPoints = customerData?.loyaltyPoints || 0;
  const referralCode = customerData?.referralCode || `FLYP${customer?.uid?.slice(-6).toUpperCase()}`;

  return (
    <div className="bg-transparent w-full h-full flex flex-col overflow-y-auto">
      {/* Profile Header */}
      <div 
        className="relative px-4 pt-6 pb-12 overflow-hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900" />
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative flex items-center gap-4">
          {/* Profile Picture */}
          <div className="relative">
            <div 
              className="w-20 h-20 rounded-full bg-white/5 border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-500/50 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              {customerData?.profilePicture ? (
                <img 
                  src={customerData.profilePicture} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <FaUser className="text-emerald-400 text-3xl" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900 hover:bg-emerald-400 transition"
            >
              <FaCamera className="text-slate-900 text-xs" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureUpload}
              className="hidden"
            />
          </div>
          
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                  onKeyPress={(e) => e.key === 'Enter' && handleNameUpdate()}
                />
                <button
                  onClick={handleNameUpdate}
                  className="px-3 py-2 bg-emerald-500 rounded-lg text-slate-900 font-medium hover:bg-emerald-400 transition"
                >
                  <FaCheck />
                </button>
                <button
                  onClick={() => {
                    setNewName(customerData?.name || '');
                    setEditingName(false);
                  }}
                  className="px-3 py-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600 transition"
                >
                  <FaTimes />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {customerData?.name || 'Customer'}
                </h2>
                <button 
                  onClick={() => setEditingName(true)}
                  className="p-1 hover:bg-white/10 rounded transition"
                >
                  <FaEdit className="text-white/40 text-sm" />
                </button>
              </div>
            )}
            <p className="text-slate-400 text-sm">{customer?.phoneNumber}</p>
            {customerData?.email && (
              <p className="text-slate-500 text-xs">{customerData.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Stats */}
      <div className="px-4 -mt-6">
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {actualOrderCount}
              </p>
              <p className="text-xs text-white/40 mt-1">Total Orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">
                {customerData?.addresses?.length || 0}
              </p>
              <p className="text-xs text-white/40 mt-1">Saved Addresses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">
                ₹{totalSavings.toLocaleString()}
              </p>
              <p className="text-xs text-white/40 mt-1">Total Savings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">
                {loyaltyPoints}
              </p>
              <p className="text-xs text-white/40 mt-1">Loyalty Points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu - Scrollable content with proper bottom padding */}
      <div 
        className="mt-6 px-4 space-y-4 flex-1"
        style={{ 
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' 
        }}
      >
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

        {/* Rewards & Referral */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Rewards
          </p>
          <MenuItem
            icon={FaGift}
            label="Referral Code"
            value={referralCode}
            onClick={() => setShowReferralModal(true)}
            badge="Earn"
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
          <MenuItem
            icon={FaUserTimes}
            label="Delete Account"
            value="Permanently delete your account and data"
            onClick={() => setShowDeleteAccountModal(true)}
            danger
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

        {/* Version with Logo */}
        <div className="flex flex-col items-center py-6">
          <FlypLogo />
          <p className="text-xs text-white/40 mt-3">
            FLYP Customer App v1.0.9
          </p>
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
