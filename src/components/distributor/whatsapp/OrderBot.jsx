/**
 * OrderBot - WhatsApp Order Automation Configuration
 * Configure how customers can browse products and place orders via WhatsApp
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, getDocs, doc, getDoc, setDoc, 
  onSnapshot, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { 
  FaShoppingCart, FaCog, FaSave, FaToggleOn, FaToggleOff,
  FaBoxes, FaClipboardList, FaTruck, FaCreditCard, FaComments,
  FaCheckCircle, FaEdit, FaEye, FaHistory, FaChartLine,
  FaWhatsapp, FaRupeeSign, FaPercent, FaCalendarAlt, FaBell
} from 'react-icons/fa';
import { HiSparkles, HiLightningBolt } from 'react-icons/hi';

const OrderBot = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    todayOrders: 0,
    pendingOrders: 0,
    revenue: 0,
  });

  // Bot Configuration
  const [config, setConfig] = useState({
    enabled: false,
    
    // Welcome Message
    welcomeMessage: "Welcome! 👋 I'm your order assistant. What would you like to do?",
    
    // Menu Options
    menuOptions: {
      browseProducts: { enabled: true, label: '🛒 Browse Products' },
      viewOrders: { enabled: true, label: '📦 My Orders' },
      trackOrder: { enabled: true, label: '🚚 Track Order' },
      support: { enabled: true, label: '💬 Contact Support' },
    },
    
    // Product Display Settings
    productDisplay: {
      showPrice: true,
      showStock: true,
      showImage: true,
      showDescription: true,
      maxProductsPerMessage: 5,
      groupByCategory: true,
    },
    
    // Order Settings
    orderSettings: {
      minOrderValue: 0,
      maxItemsPerOrder: 50,
      requireConfirmation: true,
      autoAssignOrderId: true,
      sendOrderConfirmation: true,
      sendStatusUpdates: true,
    },
    
    // Payment Settings
    paymentSettings: {
      acceptCOD: true,
      acceptOnline: false,
      acceptCredit: false,
      creditLimit: 0,
      creditDays: 7,
    },
    
    // Messages
    messages: {
      orderConfirmed: "✅ Order #{order_id} confirmed!\n\nTotal: ₹{total}\nItems: {items_count}\n\nWe'll notify you when it's ready for delivery.",
      orderShipped: "🚚 Great news! Your order #{order_id} has been shipped.\n\nTrack your order anytime by sending 'track {order_id}'",
      orderDelivered: "🎉 Your order #{order_id} has been delivered!\n\nThank you for shopping with us. Send 'Hi' to place a new order.",
      outOfStock: "Sorry, {product_name} is currently out of stock. Would you like to see similar products?",
      cartEmpty: "Your cart is empty. Send 'Browse' to see our products.",
      paymentReminder: "💰 Reminder: Payment of ₹{amount} is pending for order #{order_id}.",
    },
    
    // Business Hours
    businessHours: {
      enabled: false,
      start: '09:00',
      end: '21:00',
      timezone: 'Asia/Kolkata',
      offHoursMessage: "We're currently closed. Our business hours are 9 AM - 9 PM. We'll respond when we open!",
    },
  });

  const distributorId = auth.currentUser?.uid;

  // Load configuration
  useEffect(() => {
    if (!distributorId) return;

    const loadConfig = async () => {
      try {
        const configRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
          const data = configDoc.data() || {};
          // Deep-merge nested config to preserve new defaults (e.g., paymentSettings.creditDays)
          setConfig(prev => ({
            ...prev,
            ...data,
            menuOptions: { ...prev.menuOptions, ...(data.menuOptions || {}) },
            productDisplay: { ...prev.productDisplay, ...(data.productDisplay || {}) },
            orderSettings: { ...prev.orderSettings, ...(data.orderSettings || {}) },
            paymentSettings: { ...prev.paymentSettings, ...(data.paymentSettings || {}) },
            messages: { ...prev.messages, ...(data.messages || {}) },
            businessHours: { ...prev.businessHours, ...(data.businessHours || {}) },
          }));
        }
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [distributorId]);

  // Load recent WhatsApp orders
  useEffect(() => {
    if (!distributorId) return;

    const ordersRef = collection(db, 'businesses', distributorId, 'whatsappOrders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.slice(0, 10).map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentOrders(ordersList);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const allOrders = snapshot.docs.map(doc => doc.data());
      const todayOrders = allOrders.filter(o => {
        const orderDate = o.createdAt?.toDate?.() || new Date(0);
        return orderDate >= today;
      });

      setStats({
        totalOrders: allOrders.length,
        todayOrders: todayOrders.length,
        pendingOrders: allOrders.filter(o => o.status === 'pending').length,
        revenue: allOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      });
    });

    return () => unsubscribe();
  }, [distributorId]);

  // Save configuration
  const saveConfig = async () => {
    setSaving(true);
    try {
      const configRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
      await setDoc(configRef, {
        ...config,
        updatedAt: serverTimestamp(),
      });
      toast.success('Order bot configuration saved!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Toggle setting
  const setIn = (source, path, updaterOrValue) => {
    const parts = path.split('.').filter(Boolean);
    if (parts.length === 0) return source;

    const root = { ...(source || {}) };
    let cursor = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const next = cursor[key];
      cursor[key] = (next && typeof next === 'object' && !Array.isArray(next)) ? { ...next } : {};
      cursor = cursor[key];
    }

    const leafKey = parts[parts.length - 1];
    const prevVal = cursor[leafKey];
    cursor[leafKey] = (typeof updaterOrValue === 'function') ? updaterOrValue(prevVal) : updaterOrValue;
    return root;
  };

  const toggleSetting = (path) => {
    setConfig(prev => setIn(prev, path, (v) => !v));
  };

  // Update setting value
  const updateSetting = (path, value) => {
    setConfig(prev => setIn(prev, path, value));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#075e54] flex items-center justify-center">
              <FaShoppingCart className="text-white text-lg" />
            </div>
            Order Bot
          </h2>
          <p className="text-gray-400 mt-1">Configure WhatsApp ordering automation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <FaSave size={14} className={saving ? 'animate-spin' : ''} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: stats.totalOrders, icon: FaClipboardList, color: 'blue' },
          { label: 'Today', value: stats.todayOrders, icon: FaCalendarAlt, color: 'green' },
          { label: 'Pending', value: stats.pendingOrders, icon: FaBell, color: 'yellow' },
          { label: 'Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: FaRupeeSign, color: 'purple' },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`text-[${stat.color === 'blue' ? '#3b82f6' : stat.color === 'green' ? '#00a884' : stat.color === 'yellow' ? '#f59e0b' : '#a855f7'}]`} />
              <span className="text-2xl font-bold text-white">{stat.value}</span>
            </div>
            <p className="text-[#8696a0] text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Toggle - Prominent Quick Enable */}
      <div className={`rounded-2xl border-2 p-6 transition-all ${
        config.enabled 
          ? 'bg-gradient-to-br from-[#00a884]/20 to-[#075e54]/10 border-[#00a884]/50' 
          : 'bg-[#111b21] border-[#2a3942]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              config.enabled ? 'bg-[#00a884]/30' : 'bg-[#2a3942]'
            }`}>
              <FaShoppingCart className={`text-3xl ${config.enabled ? 'text-[#00a884]' : 'text-[#8696a0]'}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-white text-xl font-bold">Order Bot</h3>
                {config.enabled && (
                  <span className="px-3 py-1 bg-[#00a884]/20 text-[#00a884] text-sm font-medium rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#00a884] rounded-full animate-pulse" />
                    Active
                  </span>
                )}
              </div>
              <p className="text-[#8696a0] text-sm mt-1">
                {config.enabled 
                  ? 'Customers can now browse products and place orders via WhatsApp' 
                  : 'Enable to let customers order products via WhatsApp automatically'}
              </p>
              {config.enabled && (
                <div className="flex gap-4 mt-2 text-xs text-[#8696a0]">
                  <span>• Auto-responds to messages</span>
                  <span>• Shows product catalog</span>
                  <span>• Creates orders automatically</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Quick Enable/Disable Button */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={async () => {
                toggleSetting('enabled');
                // Auto-save when toggling
                setTimeout(() => saveConfig(), 100);
              }}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                config.enabled 
                  ? 'bg-[#2a3942] text-white hover:bg-[#374248]' 
                  : 'bg-gradient-to-r from-[#00a884] to-[#06cf9c] text-white hover:shadow-lg hover:shadow-[#00a884]/30'
              }`}
            >
              {config.enabled ? (
                <>
                  <FaToggleOn size={18} />
                  Enabled
                </>
              ) : (
                <>
                  <FaToggleOff size={18} />
                  Enable Now
                </>
              )}
            </button>
            <span className="text-[#8696a0] text-xs">
              {config.enabled ? 'Click to pause' : 'One-click activation'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Activity Indicator */}
      {config.enabled && recentOrders.length > 0 && (
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00a884]/20 flex items-center justify-center">
                <HiLightningBolt className="text-[#00a884] text-lg" />
              </div>
              <div>
                <h4 className="text-white font-medium">Recent Activity</h4>
                <p className="text-[#8696a0] text-xs">
                  {recentOrders.length} order{recentOrders.length !== 1 ? 's' : ''} received via WhatsApp
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {recentOrders.slice(0, 3).map((order, idx) => (
                <span key={idx} className="px-2 py-1 bg-[#2a3942] text-[#8696a0] rounded text-xs">
                  #{order.orderId || order.id?.slice(-6)}
                </span>
              ))}
              {recentOrders.length > 3 && (
                <span className="text-[#8696a0] text-xs">+{recentOrders.length - 3} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Settings Overview Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSetting('paymentSettings.acceptCOD')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleSetting('paymentSettings.acceptCOD');
          }}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
          config.paymentSettings.acceptCOD 
            ? 'bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/50' 
            : 'bg-[#111b21] border-[#2a3942]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <FaCreditCard className={config.paymentSettings.acceptCOD ? 'text-green-400' : 'text-[#8696a0]'} />
            <button
              onClick={(e) => { e.stopPropagation(); toggleSetting('paymentSettings.acceptCOD'); }}
              className={config.paymentSettings.acceptCOD ? 'text-green-400' : 'text-[#8696a0]'}
            >
              {config.paymentSettings.acceptCOD ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
            </button>
          </div>
          <h4 className="text-white font-medium text-sm">Cash on Delivery</h4>
          <p className="text-[#8696a0] text-xs mt-1">Enable COD payments</p>
        </div>
        
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSetting('paymentSettings.acceptOnline')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleSetting('paymentSettings.acceptOnline');
          }}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
          config.paymentSettings.acceptOnline 
            ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/50' 
            : 'bg-[#111b21] border-[#2a3942]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <FaCreditCard className={config.paymentSettings.acceptOnline ? 'text-blue-400' : 'text-[#8696a0]'} />
            <button
              onClick={(e) => { e.stopPropagation(); toggleSetting('paymentSettings.acceptOnline'); }}
              className={config.paymentSettings.acceptOnline ? 'text-blue-400' : 'text-[#8696a0]'}
            >
              {config.paymentSettings.acceptOnline ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
            </button>
          </div>
          <h4 className="text-white font-medium text-sm">Online Payment</h4>
          <p className="text-[#8696a0] text-xs mt-1">Enable UPI/Card payments</p>
        </div>
        
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleSetting('paymentSettings.acceptCredit')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleSetting('paymentSettings.acceptCredit');
          }}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
          config.paymentSettings.acceptCredit 
            ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/50' 
            : 'bg-[#111b21] border-[#2a3942]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <FaCreditCard className={config.paymentSettings.acceptCredit ? 'text-purple-400' : 'text-[#8696a0]'} />
            <button
              onClick={(e) => { e.stopPropagation(); toggleSetting('paymentSettings.acceptCredit'); }}
              className={config.paymentSettings.acceptCredit ? 'text-purple-400' : 'text-[#8696a0]'}
            >
              {config.paymentSettings.acceptCredit ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
            </button>
          </div>
          <h4 className="text-white font-medium text-sm">Credit (Khata)</h4>
          <p className="text-[#8696a0] text-xs mt-1">Enable credit sales</p>
          {config.paymentSettings.acceptCredit && (
            <p className="text-purple-300 text-[11px] mt-2">
              Credit days: <span className="font-semibold">{config.paymentSettings.creditDays || 0}</span>
            </p>
          )}
        </div>
        
        <div className={`p-4 rounded-xl border-2 transition-all ${
          config.orderSettings.requireConfirmation 
            ? 'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/50' 
            : 'bg-[#111b21] border-[#2a3942]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <FaCheckCircle className={config.orderSettings.requireConfirmation ? 'text-yellow-400' : 'text-[#8696a0]'} />
            <button
              onClick={() => toggleSetting('orderSettings.requireConfirmation')}
              className={config.orderSettings.requireConfirmation ? 'text-yellow-400' : 'text-[#8696a0]'}
            >
              {config.orderSettings.requireConfirmation ? <FaToggleOn size={20} /> : <FaToggleOff size={20} />}
            </button>
          </div>
          <h4 className="text-white font-medium text-sm">Order Confirmation</h4>
          <p className="text-[#8696a0] text-xs mt-1">Require customer confirmation</p>
        </div>
      </div>

      {/* Configuration Sections */}
      <div className="grid grid-cols-2 gap-6">
        {/* Menu Options */}
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FaClipboardList className="text-[#00a884]" />
            Menu Options
          </h3>
          <p className="text-[#8696a0] text-sm">Configure what options customers see</p>
          
          <div className="space-y-3 mt-4">
            {Object.entries(config.menuOptions).map(([key, option]) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => updateSetting(`menuOptions.${key}.label`, e.target.value)}
                    className="bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>
                <button
                  onClick={() => toggleSetting(`menuOptions.${key}.enabled`)}
                  className={`p-1 rounded-full ${option.enabled ? 'text-[#00a884]' : 'text-[#8696a0]'}`}
                >
                  {option.enabled ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Order Settings */}
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FaCog className="text-[#00a884]" />
            Order Settings
          </h3>
          <p className="text-[#8696a0] text-sm">Configure order processing rules</p>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Minimum Order Value</span>
              <div className="flex items-center gap-2">
                <span className="text-[#8696a0]">₹</span>
                <input
                  type="number"
                  value={config.orderSettings.minOrderValue}
                  onChange={(e) => updateSetting('orderSettings.minOrderValue', parseInt(e.target.value) || 0)}
                  className="bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Max Items Per Order</span>
              <input
                type="number"
                value={config.orderSettings.maxItemsPerOrder}
                onChange={(e) => updateSetting('orderSettings.maxItemsPerOrder', parseInt(e.target.value) || 50)}
                className="bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Require Order Confirmation</span>
              <button
                onClick={() => toggleSetting('orderSettings.requireConfirmation')}
                className={config.orderSettings.requireConfirmation ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.orderSettings.requireConfirmation ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Send Order Confirmation</span>
              <button
                onClick={() => toggleSetting('orderSettings.sendOrderConfirmation')}
                className={config.orderSettings.sendOrderConfirmation ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.orderSettings.sendOrderConfirmation ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Send Status Updates</span>
              <button
                onClick={() => toggleSetting('orderSettings.sendStatusUpdates')}
                className={config.orderSettings.sendStatusUpdates ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.orderSettings.sendStatusUpdates ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Payment Settings - Detailed */}
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FaCreditCard className="text-[#00a884]" />
            Payment Settings (Detailed)
          </h3>
          <p className="text-[#8696a0] text-sm">Advanced payment configuration</p>
          
          <div className="space-y-4 mt-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSetting('paymentSettings.acceptCOD')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggleSetting('paymentSettings.acceptCOD');
              }}
              className="p-4 bg-[#202c33] rounded-lg border border-[#2a3942] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-white text-sm font-medium">Cash on Delivery (COD)</span>
                  <p className="text-[#8696a0] text-xs mt-1">Customers pay when order is delivered</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSetting('paymentSettings.acceptCOD'); }}
                  className={config.paymentSettings.acceptCOD ? 'text-[#00a884]' : 'text-[#8696a0]'}
                >
                  {config.paymentSettings.acceptCOD ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                </button>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSetting('paymentSettings.acceptOnline')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggleSetting('paymentSettings.acceptOnline');
              }}
              className="p-4 bg-[#202c33] rounded-lg border border-[#2a3942] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-white text-sm font-medium">Online Payment</span>
                  <p className="text-[#8696a0] text-xs mt-1">UPI, Cards, Net Banking</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSetting('paymentSettings.acceptOnline'); }}
                  className={config.paymentSettings.acceptOnline ? 'text-[#00a884]' : 'text-[#8696a0]'}
                >
                  {config.paymentSettings.acceptOnline ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                </button>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSetting('paymentSettings.acceptCredit')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') toggleSetting('paymentSettings.acceptCredit');
              }}
              className="p-4 bg-[#202c33] rounded-lg border border-[#2a3942] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <span className="text-white text-sm font-medium">Credit (Khata)</span>
                  <p className="text-[#8696a0] text-xs mt-1">Allow customers to purchase on credit</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSetting('paymentSettings.acceptCredit'); }}
                  className={config.paymentSettings.acceptCredit ? 'text-[#00a884]' : 'text-[#8696a0]'}
                >
                  {config.paymentSettings.acceptCredit ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
                </button>
              </div>
              {config.paymentSettings.acceptCredit && (
                <div className="mt-3 pt-3 border-t border-[#2a3942] grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white text-sm">Credit Days</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={config.paymentSettings.creditDays ?? 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateSetting('paymentSettings.creditDays', parseInt(e.target.value) || 0)}
                      className="bg-[#111b21] text-white text-sm rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-[#2a3942]"
                      placeholder="e.g. 7"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white text-sm">Credit Limit per Customer</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#8696a0]">₹</span>
                      <input
                        type="number"
                        min={0}
                        value={config.paymentSettings.creditLimit ?? 0}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateSetting('paymentSettings.creditLimit', parseInt(e.target.value) || 0)}
                        className="bg-[#111b21] text-white text-sm rounded-lg px-3 py-2 w-32 focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-[#2a3942]"
                        placeholder="0 (unlimited)"
                      />
                    </div>
                  </div>
                  <p className="text-[#8696a0] text-xs">
                    Customers can pay within the selected credit days.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Display */}
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FaBoxes className="text-[#00a884]" />
            Product Display
          </h3>
          <p className="text-[#8696a0] text-sm">How products appear to customers</p>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Show Price</span>
              <button
                onClick={() => toggleSetting('productDisplay.showPrice')}
                className={config.productDisplay.showPrice ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.productDisplay.showPrice ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Show Stock Status</span>
              <button
                onClick={() => toggleSetting('productDisplay.showStock')}
                className={config.productDisplay.showStock ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.productDisplay.showStock ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Show Images</span>
              <button
                onClick={() => toggleSetting('productDisplay.showImage')}
                className={config.productDisplay.showImage ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.productDisplay.showImage ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Group by Category</span>
              <button
                onClick={() => toggleSetting('productDisplay.groupByCategory')}
                className={config.productDisplay.groupByCategory ? 'text-[#00a884]' : 'text-[#8696a0]'}
              >
                {config.productDisplay.groupByCategory ? <FaToggleOn size={24} /> : <FaToggleOff size={24} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Products per message</span>
              <input
                type="number"
                value={config.productDisplay.maxProductsPerMessage}
                onChange={(e) => updateSetting('productDisplay.maxProductsPerMessage', parseInt(e.target.value) || 5)}
                min={1}
                max={10}
                className="bg-[#202c33] text-white text-sm rounded-lg px-3 py-2 w-20 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <FaComments className="text-[#00a884]" />
          Welcome Message
        </h3>
        <textarea
          value={config.welcomeMessage}
          onChange={(e) => updateSetting('welcomeMessage', e.target.value)}
          placeholder="Enter welcome message shown when customer says 'Hi'..."
          className="w-full bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] min-h-[100px] resize-none placeholder-[#8696a0]"
        />
        <p className="text-[#8696a0] text-xs mt-2">
          This message is sent when a customer initiates a conversation
        </p>
      </div>

      {/* Custom Messages */}
      <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <FaBell className="text-[#00a884]" />
          Automated Messages
        </h3>
        <div className="grid gap-4">
          {[
            { key: 'orderConfirmed', label: 'Order Confirmed', placeholder: 'Message sent when order is confirmed' },
            { key: 'orderShipped', label: 'Order Shipped', placeholder: 'Message sent when order is shipped' },
            { key: 'orderDelivered', label: 'Order Delivered', placeholder: 'Message sent when order is delivered' },
          ].map((msg) => (
            <div key={msg.key}>
              <label className="text-white text-sm mb-2 block">{msg.label}</label>
              <textarea
                value={config.messages[msg.key]}
                onChange={(e) => updateSetting(`messages.${msg.key}`, e.target.value)}
                placeholder={msg.placeholder}
                className="w-full bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] min-h-[80px] resize-none placeholder-[#8696a0] text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-[#8696a0] text-xs mt-4">
          Variables: {'{order_id}'}, {'{total}'}, {'{items_count}'}, {'{customer_name}'}, {'{product_name}'}
        </p>
      </div>

      {/* Recent Orders */}
      <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <FaHistory className="text-[#00a884]" />
          Recent WhatsApp Orders
        </h3>
        
        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <FaClipboardList className="text-[#8696a0] text-4xl mx-auto mb-3" />
            <p className="text-[#8696a0]">No WhatsApp orders yet</p>
            <p className="text-[#8696a0] text-sm">Orders placed via WhatsApp will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 bg-[#202c33] rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                    <FaWhatsapp className="text-[#00a884]" />
                  </div>
                  <div>
                    <p className="text-white font-medium">#{order.orderId || order.id.slice(-6)}</p>
                    <p className="text-[#8696a0] text-sm">{order.customerPhone || 'Unknown'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">₹{(order.total || 0).toLocaleString('en-IN')}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    order.status === 'delivered' ? 'bg-[#00a884]/20 text-[#00a884]' :
                    order.status === 'shipped' ? 'bg-blue-500/20 text-blue-400' :
                    order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-[#2a3942] text-[#8696a0]'
                  }`}>
                    {order.status || 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderBot;
