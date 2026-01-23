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
  subscribeToCustomerOrders,
  acceptOrder,
  startPreparingOrder,
  markOrderReady,
  markOrderOutForDelivery,
  markOrderDelivered,
  cancelOrder,
  checkOrderItemsStock
} from '../../../services/retailerMarketplaceService';
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
  
  // Chat modal
  const [chatOrder, setChatOrder] = useState(null);
  
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
  const handleAcceptOrder = async (orderId) => {
    setActionLoading(orderId);
    await acceptOrder(auth.currentUser?.uid, orderId, 30);
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
    setShowDeliveryModal(true);
  };

  // Submit delivery agent and mark out for delivery
  const handleSubmitDeliveryAgent = async () => {
    if (!deliveryAgent.name || !deliveryAgent.phone) {
      alert('Please enter delivery agent name and phone');
      return;
    }
    
    setActionLoading(deliveryOrderId);
    await markOrderOutForDelivery(auth.currentUser?.uid, deliveryOrderId, {
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
        return { label: 'Accept Order', action: () => handleAcceptOrder(order.id), color: 'emerald' };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 border ${
            newOrdersCount > 0
              ? 'bg-yellow-500/20 border-yellow-500/30'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">New Orders</p>
              <p className="text-2xl font-bold text-white">{newOrdersCount}</p>
            </div>
            {newOrdersCount > 0 && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-10 h-10 rounded-full bg-yellow-500/30 flex items-center justify-center"
              >
                <FaBell className="text-yellow-400" />
              </motion.div>
            )}
          </div>
        </motion.div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">Active Orders</p>
          <p className="text-2xl font-bold text-blue-400">{activeOrdersCount}</p>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">Completed Today</p>
          <p className="text-2xl font-bold text-emerald-400">
            {orders.filter(o => o.status === 'delivered').length}
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-white">{orders.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'All Orders' },
          { id: 'new', label: 'New', count: newOrdersCount },
          { id: 'active', label: 'Active', count: activeOrdersCount },
          { id: 'completed', label: 'Completed' },
          { id: 'cancelled', label: 'Cancelled' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
              filter === tab.id
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

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
                    <span className="text-white/50 text-sm">
                      {formatTimeAgo(order.createdAt)}
                    </span>
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
                  disabled={actionLoading === deliveryOrderId || !deliveryAgent.name || !deliveryAgent.phone}
                  className="flex-1 px-4 py-3 bg-cyan-500 text-white font-medium rounded-xl hover:bg-cyan-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === deliveryOrderId ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <>
                      <FaTruck />
                      Dispatch Order
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
