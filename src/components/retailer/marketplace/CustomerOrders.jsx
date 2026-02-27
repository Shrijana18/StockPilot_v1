/**
 * CustomerOrders - Manage orders from customer marketplace
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaShoppingBag, FaCheck, FaTimes, FaClock, FaTruck, FaBoxOpen,
  FaPhone, FaMapMarkerAlt, FaRupeeSign, FaUser, FaBell,
  FaCheckCircle, FaTimesCircle, FaSpinner, FaMotorcycle, FaComments,
  FaStore, FaCalendarAlt
} from 'react-icons/fa';
import { auth } from '../../../firebase/firebaseConfig';
import {
  getMarketplaceStore,
  subscribeToCustomerOrders,
  acceptOrder,
  startPreparingOrder,
  markOrderReady,
  markOrderOutForDelivery,
  markOrderDelivered,
  cancelOrder,
  checkOrderItemsStock
} from '../../../services/retailerMarketplaceService';
import {
  assignOrderToEmployee,
  getRetailerEmployees
} from '../../../services/deliveryEmployeeService';
import OrderChat from './OrderChat';

const CustomerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  
  // Stock status for orders
  const [stockStatus, setStockStatus] = useState({});
  const [checkingStock, setCheckingStock] = useState({});
  
  // Delivery agent modal
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryOrderId, setDeliveryOrderId] = useState(null);
  const [deliveryAgent, setDeliveryAgent] = useState({
    name: '',
    phone: '',
    vehicleNumber: ''
  });
  
  // Employee assignment
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignToEmployee, setAssignToEmployee] = useState(false);
  
  // Chat modal
  const [chatOrder, setChatOrder] = useState(null);

  // Store settings for smart delivery suggestion (baseDeliveryTime, estimatedDeliveryPerKm)
  const [storeSettings, setStoreSettings] = useState(null);

  /** Smart delivery suggestion: base + (distance × perKm) mins. Returns null only for pickup orders. */
  const getSuggestedDeliveryMinutes = (order) => {
    if (order.orderType === 'pickup') return null;
    const base = Number(storeSettings?.baseDeliveryTime) || 30;
    const perKm = Number(storeSettings?.estimatedDeliveryPerKm) || 5;
    const dist = order.customerDistance;
    // If distance is available, calculate: base + (distance × perKm)
    // If distance is missing, show base time as fallback
    if (dist != null && dist >= 0) {
      return Math.round(base + dist * perKm);
    }
    // Fallback: show base time if distance is missing
    return base;
  };

  // Check stock for pending orders
  const checkStockForOrder = async (order) => {
    if (!order.items || order.items.length === 0) return;
    
    setCheckingStock(prev => ({ ...prev, [order.id]: true }));
    try {
      const userId = auth.currentUser?.uid;
      const status = await checkOrderItemsStock(userId, order.items);
      setStockStatus(prev => ({ ...prev, [order.id]: status }));
    } catch (error) {
      console.error('Error checking stock:', error);
    } finally {
      setCheckingStock(prev => ({ ...prev, [order.id]: false }));
    }
  };

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Subscribe to real-time order updates
    const unsubscribe = subscribeToCustomerOrders(userId, (orderData) => {
      setOrders(orderData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch store settings for smart delivery suggestion
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    getMarketplaceStore(userId).then((store) => {
      if (store) setStoreSettings(store);
    }).catch(() => {});
  }, []);

  // Fetch employees for assignment
  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    getRetailerEmployees(userId).then((emps) => {
      setEmployees(emps);
    }).catch((err) => {
      console.error('Error fetching employees:', err);
    });
  }, []);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'new') return order.status === 'pending';
    if (filter === 'active') return ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
    if (filter === 'completed') return order.status === 'delivered';
    if (filter === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  // Order counts
  const newOrdersCount = orders.filter(o => o.status === 'pending').length;
  const activeOrdersCount = orders.filter(o => ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length;

  // Get status info (with pickup-specific labels)
  const getStatusInfo = (status, orderType = 'delivery') => {
    const isPickup = orderType === 'pickup';
    
    const statusMap = {
      pending: { label: 'New Order', color: 'yellow', icon: FaBell },
      confirmed: { label: 'Confirmed', color: 'blue', icon: FaCheck },
      preparing: { label: 'Preparing', color: 'orange', icon: FaBoxOpen },
      ready: { 
        label: isPickup ? 'Ready for Pickup' : 'Ready', 
        color: 'purple', 
        icon: isPickup ? FaStore : FaCheckCircle 
      },
      out_for_delivery: { label: 'Out for Delivery', color: 'cyan', icon: FaMotorcycle },
      delivered: { 
        label: isPickup ? 'Picked Up' : 'Delivered', 
        color: 'green', 
        icon: FaCheckCircle 
      },
      cancelled: { label: 'Cancelled', color: 'red', icon: FaTimesCircle }
    };
    return statusMap[status] || { label: status, color: 'gray', icon: FaClock };
  };

  // Handle order actions
  const handleAcceptOrder = async (order) => {
    const orderId = order?.id;
    if (!orderId) return;
    setActionLoading(orderId);
    const suggested = getSuggestedDeliveryMinutes(order);
    const estimatedMins = suggested != null ? suggested : 30;
    await acceptOrder(auth.currentUser?.uid, orderId, estimatedMins);
    setActionLoading(null);
  };

  const handleStartPreparing = async (orderId) => {
    setActionLoading(orderId);
    await startPreparingOrder(auth.currentUser?.uid, orderId);
    setActionLoading(null);
  };

  const handleMarkReady = async (orderId) => {
    setActionLoading(orderId);
    await markOrderReady(auth.currentUser?.uid, orderId);
    setActionLoading(null);
  };

  // Open delivery agent modal
  const handleOpenDeliveryModal = (orderId) => {
    setDeliveryOrderId(orderId);
    setDeliveryAgent({ name: '', phone: '', vehicleNumber: '' });
    setSelectedEmployeeId('');
    setAssignToEmployee(false);
    setShowDeliveryModal(true);
  };

  // Submit delivery agent and mark out for delivery
  const handleSubmitDeliveryAgent = async () => {
    const userId = auth.currentUser?.uid;
    
    // If assigning to employee
    if (assignToEmployee && selectedEmployeeId) {
      try {
        setActionLoading(deliveryOrderId);
        await assignOrderToEmployee(userId, deliveryOrderId, selectedEmployeeId);
        setActionLoading(null);
        setShowDeliveryModal(false);
        setDeliveryOrderId(null);
        setSelectedEmployeeId('');
        setAssignToEmployee(false);
      } catch (error) {
        console.error('Error assigning to employee:', error);
        alert(error.message || 'Failed to assign order to employee');
        setActionLoading(null);
      }
      return;
    }
    
    // Manual delivery agent entry
    if (!deliveryAgent.name || !deliveryAgent.phone) {
      alert('Please enter delivery agent name and phone, or select an employee');
      return;
    }
    
    setActionLoading(deliveryOrderId);
    await markOrderOutForDelivery(userId, deliveryOrderId, {
      partnerName: deliveryAgent.name,
      partnerPhone: deliveryAgent.phone,
      vehicleNumber: deliveryAgent.vehicleNumber || ''
    });
    setActionLoading(null);
    setShowDeliveryModal(false);
    setDeliveryOrderId(null);
  };

  const handleMarkDelivered = async (orderId) => {
    setActionLoading(orderId);
    await markOrderDelivered(auth.currentUser?.uid, orderId);
    setActionLoading(null);
  };

  const handleCancelOrder = async (orderId, reason = 'Cancelled by store') => {
    setActionLoading(orderId);
    await cancelOrder(auth.currentUser?.uid, orderId, reason);
    setActionLoading(null);
  };

  // Get next action for order (different flow for pickup vs delivery)
  const getNextAction = (order) => {
    const isPickup = order.orderType === 'pickup';
    
    switch (order.status) {
      case 'pending':
        return { label: 'Accept Order', action: () => handleAcceptOrder(order), color: 'emerald' };
      case 'confirmed':
        return { label: 'Start Preparing', action: () => handleStartPreparing(order.id), color: 'orange' };
      case 'preparing':
        return { 
          label: isPickup ? 'Ready for Pickup' : 'Mark Ready', 
          action: () => handleMarkReady(order.id), 
          color: 'purple' 
        };
      case 'ready':
        if (isPickup) {
          // For pickup orders, customer picks up directly
          return { label: 'Customer Picked Up', action: () => handleMarkDelivered(order.id), color: 'green' };
        }
        return { label: 'Out for Delivery', action: () => handleOpenDeliveryModal(order.id), color: 'cyan' };
      case 'out_for_delivery':
        return { label: 'Mark Delivered', action: () => handleMarkDelivered(order.id), color: 'green' };
      default:
        return null;
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // Calculate time remaining for delivery (based on estimated delivery time)
  const getTimeRemaining = (order) => {
    if (order.orderType === 'pickup') return null;
    if (!order.estimatedDeliveryMinutes && !order.estimatedMins) return null;
    
    const estimatedMins = order.estimatedDeliveryMinutes || order.estimatedMins || 0;
    const createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const now = new Date();
    const elapsedMins = Math.floor((now - createdAt) / (1000 * 60));
    const remainingMins = Math.max(0, estimatedMins - elapsedMins);
    
    return remainingMins;
  };

  // Get color coding for time remaining
  const getTimeRemainingColor = (remainingMins) => {
    if (remainingMins === null) return 'gray';
    if (remainingMins <= 5) return 'red'; // Urgent - less than 5 mins
    if (remainingMins <= 15) return 'orange'; // Warning - less than 15 mins
    if (remainingMins <= 30) return 'yellow'; // Caution - less than 30 mins
    return 'green'; // Good - more than 30 mins
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find batch delivery suggestions (orders that can be combined)
  const getBatchDeliverySuggestions = () => {
    // Get all active delivery orders (not just filtered ones)
    const activeDeliveryOrders = orders.filter(order => 
      order.orderType === 'delivery' && 
      ['confirmed', 'preparing', 'ready'].includes(order.status)
    );

    if (activeDeliveryOrders.length < 2) return [];

    const batches = [];
    const processed = new Set();

    for (let i = 0; i < activeDeliveryOrders.length; i++) {
      if (processed.has(activeDeliveryOrders[i].id)) continue;
      
      const order1 = activeDeliveryOrders[i];
      const batch = [order1];
      processed.add(order1.id);

      // Get order1 location (prefer lat/lng, fallback to address matching)
      const order1Lat = order1.deliveryAddress?.lat;
      const order1Lng = order1.deliveryAddress?.lng;
      const order1Pincode = order1.deliveryAddress?.pincode;
      const order1City = order1.deliveryAddress?.city;

      for (let j = i + 1; j < activeDeliveryOrders.length; j++) {
        if (processed.has(activeDeliveryOrders[j].id)) continue;
        
        const order2 = activeDeliveryOrders[j];
        let canBatch = false;

        // Method 1: Use lat/lng if available
        if (order1Lat && order1Lng && order2.deliveryAddress?.lat && order2.deliveryAddress?.lng) {
          const distance = calculateDistance(
            order1Lat,
            order1Lng,
            order2.deliveryAddress.lat,
            order2.deliveryAddress.lng
          );
          // If orders are within 2km of each other, suggest batch delivery
          if (distance <= 2) {
            canBatch = true;
          }
        }
        // Method 2: If same pincode and city, likely nearby
        else if (order1Pincode && order2.deliveryAddress?.pincode && 
                 order1Pincode === order2.deliveryAddress.pincode &&
                 order1City && order2.deliveryAddress?.city &&
                 order1City === order2.deliveryAddress.city) {
          canBatch = true;
        }
        // Method 3: If customerDistance is similar (within 1km difference), likely same direction
        else if (order1.customerDistance != null && order2.customerDistance != null) {
          const distDiff = Math.abs(order1.customerDistance - order2.customerDistance);
          if (distDiff <= 1) {
            canBatch = true;
          }
        }

        if (canBatch) {
          batch.push(order2);
          processed.add(order2.id);
        }
      }

      // Only suggest batches with 2-3 orders
      if (batch.length >= 2 && batch.length <= 3) {
        batches.push(batch);
      }
    }

    return batches;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats Cards - clear section */}
      <div>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-3 border ${
              newOrdersCount > 0
                ? 'bg-yellow-500/20 border-yellow-500/30'
                : 'bg-white/5 border-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs">New</p>
                <p className="text-lg font-bold text-white">{newOrdersCount}</p>
              </div>
              {newOrdersCount > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-8 h-8 rounded-full bg-yellow-500/30 flex items-center justify-center"
                >
                  <FaBell className="text-yellow-400 text-sm" />
                </motion.div>
              )}
            </div>
          </motion.div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-white/60 text-xs">Active</p>
            <p className="text-lg font-bold text-blue-400">{activeOrdersCount}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-white/60 text-xs">Completed</p>
            <p className="text-lg font-bold text-emerald-400">
              {orders.filter(o => o.status === 'delivered').length}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-white/60 text-xs">Total</p>
            <p className="text-lg font-bold text-white">{orders.length}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs - separate row, app-friendly */}
      <div>
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Filter</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'new', label: 'New', count: newOrdersCount },
            { id: 'active', label: 'Active', count: activeOrdersCount },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                filter === tab.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-white/80'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === tab.id ? 'bg-white/25' : 'bg-white/20'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Delivery Suggestions - Show on Active or All filters */}
      {(() => {
        const batchSuggestions = getBatchDeliverySuggestions();
        if (batchSuggestions.length === 0 || (filter !== 'active' && filter !== 'all')) return null;
        
        return (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-cyan-500/20 border-2 border-emerald-500/40 rounded-xl p-5 shadow-lg shadow-emerald-500/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center">
                <FaTruck className="text-emerald-400 text-lg" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">🚚 Batch Delivery Suggestions</h3>
                <p className="text-white/60 text-xs">Deliver multiple orders together to save time & fuel</p>
              </div>
            </div>
            <div className="space-y-3">
              {batchSuggestions.map((batch, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white/10 rounded-lg p-4 border border-emerald-500/30 hover:border-emerald-500/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-semibold text-sm mb-1">
                        Combine {batch.length} orders for efficient delivery:
                      </p>
                      <p className="text-emerald-300 text-xs">
                        Customers are located nearby - can be delivered in one trip
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold">
                      {batch.length} orders
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {batch.map((order) => (
                      <div
                        key={order.id}
                        className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-mono font-semibold hover:bg-emerald-500/30 transition cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        #{order.id?.slice(-6).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/60">
                    {batch[0].deliveryAddress?.pincode && (
                      <span>📍 Pincode: {batch[0].deliveryAddress.pincode}</span>
                    )}
                    {batch[0].customerDistance != null && (
                      <span>📏 ~{batch[0].customerDistance.toFixed(1)}km from store</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );
      })()}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <FaShoppingBag className="text-4xl text-white/20 mx-auto mb-3" />
          <p className="text-white/60">No orders found</p>
          <p className="text-sm text-white/40 mt-1">
            {filter === 'new' ? 'Waiting for new customer orders...' : 'Orders will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusInfo = getStatusInfo(order.status, order.orderType);
            const StatusIcon = statusInfo.icon;
            const nextAction = getNextAction(order);
            const isLoading = actionLoading === order.id;
            const isPickup = order.orderType === 'pickup';

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white/5 rounded-xl border overflow-hidden ${
                  order.status === 'pending'
                    ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                    : 'border-white/10'
                }`}
              >
                {/* Order Header */}
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-mono text-sm">
                        #{order.id?.slice(-6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${statusInfo.color}-500/20 text-${statusInfo.color}-300 flex items-center gap-1`}>
                        <StatusIcon className="text-xs" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 text-sm">
                        {formatTimeAgo(order.createdAt)}
                      </span>
                      {/* Time Remaining with Color Coding */}
                      {(() => {
                        const remainingMins = getTimeRemaining(order);
                        if (remainingMins === null) return null;
                        const color = getTimeRemainingColor(remainingMins);
                        const colorClasses = {
                          red: 'bg-red-500/20 text-red-300 border-red-500/40',
                          orange: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
                          yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
                          green: 'bg-green-500/20 text-green-300 border-green-500/40',
                          gray: 'bg-gray-500/20 text-gray-300 border-gray-500/40'
                        };
                        return (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${colorClasses[color]}`}>
                            <FaClock className="text-xs" />
                            {remainingMins > 0 ? `${remainingMins}m left` : 'Overdue'}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center gap-4 text-sm text-white/70">
                    <span className="flex items-center gap-1">
                      <FaUser className="text-white/40" />
                      {order.customerName || 'Customer'}
                    </span>
                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <FaPhone className="text-xs" />
                        {order.customerPhone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4 border-b border-white/10">
                  <div className="space-y-2">
                    {(order.items || []).slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-white/80">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-white/60">₹{item.total || item.price * item.quantity}</span>
                      </div>
                    ))}
                    {(order.items || []).length > 3 && (
                      <p className="text-white/40 text-sm">
                        +{order.items.length - 3} more items
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex justify-between">
                    <span className="text-white/60">Total</span>
                    <span className="text-emerald-400 font-bold text-lg">₹{order.total || 0}</span>
                  </div>
                </div>

                {/* Order Type Badge & Info */}
                {order.orderType === 'pickup' ? (
                  <div className="px-4 py-3 bg-purple-500/10 border-b border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="px-2 py-1 bg-purple-500/20 rounded-full flex items-center gap-1.5">
                        <FaStore className="text-purple-400 text-xs" />
                        <span className="text-purple-300 text-xs font-medium">Store Pickup</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-purple-400" />
                        <span className="text-white/80">{order.pickupDateLabel || 'Today'}</span>
                      </div>
                      {order.pickupSlot?.time && (
                        <div className="flex items-center gap-2">
                          <FaClock className="text-purple-400" />
                          <span className="text-white/80">{order.pickupSlot.time}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : order.deliveryAddress ? (
                  <div className="px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="px-2 py-1 bg-cyan-500/20 rounded-full flex items-center gap-1.5">
                        <FaTruck className="text-cyan-400 text-xs" />
                        <span className="text-cyan-300 text-xs font-medium">Delivery</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <FaMapMarkerAlt className="text-cyan-400 mt-1" />
                      <div>
                        <p className="text-white/80">{order.deliveryAddress.label || 'Delivery Address'}</p>
                        <p className="text-white/50 text-xs">
                          {order.deliveryAddress.address}, {order.deliveryAddress.city} - {order.deliveryAddress.pincode}
                        </p>
                      </div>
                    </div>
                    {order.deliverySlot && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <FaClock className="text-cyan-400" />
                        <span className="text-white/60">Delivery: {order.deliverySlot}</span>
                      </div>
                    )}
                    {/* Smart Delivery Suggestion - Always show for delivery orders */}
                    {order.orderType !== 'pickup' && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <FaClock className="text-amber-400" />
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                          Suggested: ~{getSuggestedDeliveryMinutes(order)} min
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Actions */}
                {(order.status !== 'delivered' && order.status !== 'cancelled') && (
                  <div className="p-4 flex flex-wrap gap-2">
                    {nextAction && (
                      <button
                        onClick={nextAction.action}
                        disabled={isLoading}
                        className={`flex-1 min-w-[140px] px-4 py-2.5 bg-${nextAction.color}-500 text-white font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2`}
                      >
                        {isLoading ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <>
                            <FaCheck />
                            {nextAction.label}
                          </>
                        )}
                      </button>
                    )}

                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-red-500/20 text-red-300 font-medium rounded-lg hover:bg-red-500/30 transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <FaTimes />
                        Reject
                      </button>
                    )}

                    {/* Chat Button */}
                    <button
                      onClick={() => setChatOrder(order)}
                      className="px-4 py-2.5 bg-blue-500/20 text-blue-300 font-medium rounded-lg hover:bg-blue-500/30 transition flex items-center gap-2"
                    >
                      <FaComments />
                      Chat
                    </button>

                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-2.5 bg-white/10 text-white/70 font-medium rounded-lg hover:bg-white/20 transition"
                    >
                      View Details
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Order #{selectedOrder.id?.slice(-6).toUpperCase()}
                </h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <FaTimes className="text-white/60" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Status & Order Type */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const info = getStatusInfo(selectedOrder.status, selectedOrder.orderType);
                    const Icon = info.icon;
                    return (
                      <span className={`px-3 py-1.5 rounded-full text-sm font-medium bg-${info.color}-500/20 text-${info.color}-300 flex items-center gap-2`}>
                        <Icon />
                        {info.label}
                      </span>
                    );
                  })()}
                  {selectedOrder.orderType === 'pickup' && (
                    <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-purple-500/20 text-purple-300 flex items-center gap-2">
                      <FaStore className="text-xs" />
                      Pickup Order
                    </span>
                  )}
                </div>

                {/* Customer */}
                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-sm text-white/60 mb-2">Customer</h4>
                  <p className="text-white font-medium">{selectedOrder.customerName}</p>
                  <p className="text-white/60 text-sm">{selectedOrder.customerPhone}</p>
                </div>

                {/* Items */}
                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-sm text-white/60 mb-3">Items</h4>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-white">{item.quantity}x {item.name}</span>
                        <span className="text-white/60">₹{item.total || item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex justify-between text-sm text-white/60 mb-1">
                      <span>Subtotal</span>
                      <span>₹{selectedOrder.subtotal || selectedOrder.total}</span>
                    </div>
                    {selectedOrder.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm text-white/60 mb-1">
                        <span>Delivery</span>
                        <span>₹{selectedOrder.deliveryFee}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-white">Total</span>
                      <span className="text-emerald-400">₹{selectedOrder.total}</span>
                    </div>
                  </div>
                </div>

                {/* Order Type - Pickup or Delivery */}
                {selectedOrder.orderType === 'pickup' ? (
                  <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                    <h4 className="text-sm text-purple-400 mb-3 flex items-center gap-2">
                      <FaStore />
                      Store Pickup
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <FaCalendarAlt className="text-purple-400" />
                        <div>
                          <p className="text-white font-medium">{selectedOrder.pickupDateLabel || 'Today'}</p>
                          <p className="text-white/50 text-xs">Pickup Date</p>
                        </div>
                      </div>
                      {selectedOrder.pickupSlot?.time && (
                        <div className="flex items-center gap-3">
                          <FaClock className="text-purple-400" />
                          <div>
                            <p className="text-white font-medium">{selectedOrder.pickupSlot.time}</p>
                            <p className="text-white/50 text-xs">Pickup Time</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedOrder.pickupInstructions && (
                      <p className="text-white/60 text-sm mt-3 pt-3 border-t border-purple-500/20">
                        {selectedOrder.pickupInstructions}
                      </p>
                    )}
                  </div>
                ) : selectedOrder.deliveryAddress ? (
                  <div className="bg-white/5 rounded-xl p-4">
                    <h4 className="text-sm text-white/60 mb-2 flex items-center gap-2">
                      <FaTruck />
                      Delivery Address
                    </h4>
                    <p className="text-white">{selectedOrder.deliveryAddress.label}</p>
                    <p className="text-white/60 text-sm">
                      {selectedOrder.deliveryAddress.address}
                    </p>
                    <p className="text-white/60 text-sm">
                      {selectedOrder.deliveryAddress.city} - {selectedOrder.deliveryAddress.pincode}
                    </p>
                    {selectedOrder.deliverySlot && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                        <FaClock className="text-white/40" />
                        <span className="text-white/60 text-sm">Delivery: {selectedOrder.deliverySlot}</span>
                      </div>
                    )}
                    {/* Smart Delivery Suggestion - Always show for delivery orders */}
                    {selectedOrder.orderType !== 'pickup' && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                        <FaClock className="text-amber-400" />
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-sm font-semibold border border-amber-500/30">
                          Suggested delivery: ~{getSuggestedDeliveryMinutes(selectedOrder)} min
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Payment */}
                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-sm text-white/60 mb-2">Payment</h4>
                  <p className="text-white capitalize">{selectedOrder.paymentMethod || 'Cash on Delivery'}</p>
                  <p className="text-white/60 text-sm capitalize">{selectedOrder.paymentStatus || 'pending'}</p>
                </div>

                {/* Delivery Agent Info (if assigned) */}
                {selectedOrder.deliveryAgent && (
                  <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
                    <h4 className="text-sm text-cyan-400 mb-2 flex items-center gap-2">
                      <FaMotorcycle />
                      Delivery Agent
                    </h4>
                    <p className="text-white font-medium">{selectedOrder.deliveryAgent.name}</p>
                    <p className="text-white/60 text-sm">{selectedOrder.deliveryAgent.phone}</p>
                    {selectedOrder.deliveryAgent.vehicleNumber && (
                      <p className="text-white/40 text-xs mt-1">{selectedOrder.deliveryAgent.vehicleNumber}</p>
                    )}
                  </div>
                )}

                {/* Chat with Customer Button */}
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setChatOrder(selectedOrder);
                  }}
                  className="w-full py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2"
                >
                  <FaComments />
                  Chat with Customer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Agent Assignment Modal */}
      <AnimatePresence>
        {showDeliveryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeliveryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FaTruck className="text-cyan-400" />
                  Assign Delivery Agent
                </h3>
                <p className="text-white/60 text-sm mt-1">
                  Enter delivery person details before dispatching
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Assign to Employee Toggle */}
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <input
                    type="checkbox"
                    id="assignToEmployee"
                    checked={assignToEmployee}
                    onChange={(e) => {
                      setAssignToEmployee(e.target.checked);
                      if (e.target.checked) {
                        setDeliveryAgent({ name: '', phone: '', vehicleNumber: '' });
                      } else {
                        setSelectedEmployeeId('');
                      }
                    }}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <label htmlFor="assignToEmployee" className="text-white/80 text-sm cursor-pointer">
                    Assign to Employee
                  </label>
                </div>

                {/* Employee Selection */}
                {assignToEmployee && (
                  <div>
                    <label className="block text-white/70 text-sm mb-2">
                      Select Employee *
                    </label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => {
                        setSelectedEmployeeId(e.target.value);
                        const selected = employees.find(emp => emp.id === e.target.value);
                        if (selected) {
                          setDeliveryAgent({
                            name: selected.name || '',
                            phone: selected.phone || '',
                            vehicleNumber: ''
                          });
                        }
                      }}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Select Employee</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id} className="bg-slate-800">
                          {emp.name || emp.flypEmployeeId || emp.id} {emp.phone ? `- ${emp.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    {employees.length === 0 && (
                      <p className="text-yellow-400 text-xs mt-2">
                        No active employees found. Add employees from Employee Management.
                      </p>
                    )}
                  </div>
                )}

                {/* Manual Entry (if not assigning to employee) */}
                {!assignToEmployee && (
                  <>
                    {/* Delivery Agent Name */}
                    <div>
                      <label className="block text-white/70 text-sm mb-2">
                        Delivery Person Name *
                      </label>
                      <input
                        type="text"
                        value={deliveryAgent.name}
                        onChange={(e) => setDeliveryAgent(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter name"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-white/70 text-sm mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={deliveryAgent.phone}
                        onChange={(e) => setDeliveryAgent(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+91 XXXXXXXXXX"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </>
                )}

                {/* Vehicle Number (Optional) */}
                <div>
                  <label className="block text-white/70 text-sm mb-2">
                    Vehicle Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryAgent.vehicleNumber}
                    onChange={(e) => setDeliveryAgent(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                    placeholder="MH XX AB 1234"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex gap-3">
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 text-white/70 font-medium rounded-xl hover:bg-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitDeliveryAgent}
                  disabled={
                    actionLoading === deliveryOrderId || 
                    (assignToEmployee ? !selectedEmployeeId : (!deliveryAgent.name || !deliveryAgent.phone))
                  }
                  className="flex-1 px-4 py-3 bg-cyan-500 text-white font-medium rounded-xl hover:bg-cyan-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === deliveryOrderId ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <>
                      <FaTruck />
                      {assignToEmployee ? 'Assign to Employee' : 'Dispatch Order'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Chat Modal */}
      <AnimatePresence>
        {chatOrder && (
          <OrderChat 
            order={chatOrder} 
            onClose={() => setChatOrder(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerOrders;
