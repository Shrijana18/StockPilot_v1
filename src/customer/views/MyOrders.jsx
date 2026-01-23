/**
 * MyOrders - Premium dark theme order history with pickup/delivery support
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaStore, FaChevronRight, FaShoppingBag,
  FaRedo, FaTruck, FaClock, FaCalendarAlt, FaMapMarkerAlt,
  FaCheckCircle, FaBox, FaCreditCard, FaExclamationTriangle
} from 'react-icons/fa';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { getCustomerOrders, getOrderStatusInfo } from '../services/orderService';

// Helper to get date label from ISO string
const getDateLabelFromISO = (isoString) => {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch (e) {
    return null;
  }
};

// Helper to format due date
const formatDueDate = (dueDate) => {
  if (!dueDate) return null;
  const date = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
  const today = new Date();
  const diffTime = date - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)} days`, isOverdue: true };
  if (diffDays === 0) return { text: 'Due today', isOverdue: false, isToday: true };
  if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
  return { text: `Due in ${diffDays} days`, isOverdue: false };
};

// Order Card Component - Dark Theme with Pickup/Delivery Support
const OrderCard = ({ order, onClick }) => {
  const statusInfo = getOrderStatusInfo(order.status, order.orderType);
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  
  const isPickup = order.orderType === 'pickup';
  const isActive = !['delivered', 'cancelled'].includes(order.status);
  const isPayLater = order.paymentMethod === 'PAY_LATER' || order.paymentStatus === 'pay_later';
  const dueInfo = isPayLater && order.paymentDueDate ? formatDueDate(order.paymentDueDate) : null;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(order)}
      className={`w-full bg-[#111827] rounded-2xl border overflow-hidden text-left transition-all ${
        isPayLater && dueInfo?.isOverdue
          ? 'border-red-500/30 shadow-lg shadow-red-500/5'
          : isActive 
            ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' 
            : 'border-white/[0.06]'
      }`}
    >
      {/* Order Type Badge - Top Strip */}
      <div className={`px-4 py-2 flex items-center justify-between ${
        isPickup 
          ? 'bg-purple-500/10 border-b border-purple-500/20' 
          : 'bg-cyan-500/10 border-b border-cyan-500/20'
      }`}>
        <div className="flex items-center gap-2">
          {isPickup ? (
            <>
              <FaStore className="text-purple-400 text-xs" />
              <span className="text-purple-300 text-xs font-medium">Store Pickup</span>
            </>
          ) : (
            <>
              <FaTruck className="text-cyan-400 text-xs" />
              <span className="text-cyan-300 text-xs font-medium">Delivery</span>
            </>
          )}
          {/* Pay Later Badge */}
          {isPayLater && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ml-1 ${
              order.paymentStatus === 'paid'
                ? 'bg-green-500/20 text-green-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}>
              {order.paymentStatus === 'paid' ? <FaCheckCircle className="text-[8px]" /> : <FaCreditCard className="text-[8px]" />}
              {order.paymentStatus === 'paid' ? 'Paid' : 'Credit'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            order.status === 'delivered' ? 'bg-green-500' :
            order.status === 'cancelled' ? 'bg-red-500' :
            'bg-emerald-500 animate-pulse'
          }`} />
          <span className={`text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <FaStore className="text-white/40" />
            </div>
            <div>
              <h4 className="font-semibold text-white">{order.storeName}</h4>
              <p className="text-xs text-white/40">{orderDate} • #{order.orderNumber?.slice(-8)}</p>
            </div>
          </div>
          <FaChevronRight className="text-white/30 mt-1" />
        </div>

        {/* Pickup/Delivery Info */}
        {isPickup ? (
          <div className="flex items-center gap-3 mb-3 p-2 bg-purple-500/5 rounded-lg">
            <FaCalendarAlt className="text-purple-400 text-sm" />
            <div className="flex-1">
              <p className="text-xs text-white/60">Pickup scheduled</p>
              <p className="text-sm text-white font-medium">
                {order.pickupDateLabel || 'Today'} • {order.pickupSlot?.time || 'Anytime'}
              </p>
            </div>
          </div>
        ) : order.deliveryAddress ? (
          <div className="space-y-2 mb-3">
            {/* Scheduled Delivery Date & Time - Show when date exists or slot is a time range */}
            {(order.deliveryDateLabel || order.deliveryDate || (order.deliverySlot && order.deliverySlot.includes(' - '))) && (
              <div className="flex items-center gap-3 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                <FaCalendarAlt className="text-amber-400 text-sm" />
                <div className="flex-1">
                  <p className="text-xs text-white/60">Scheduled Delivery</p>
                  <p className="text-sm text-white font-medium">
                    {order.deliveryDateLabel || getDateLabelFromISO(order.deliveryDate) || 'Scheduled'} • {order.deliverySlot || 'Anytime'}
                  </p>
                </div>
              </div>
            )}
            {/* Delivery Address */}
            <div className="flex items-center gap-3 p-2 bg-cyan-500/5 rounded-lg">
              <FaMapMarkerAlt className="text-cyan-400 text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">Delivering to</p>
                <p className="text-sm text-white font-medium truncate">
                  {order.deliveryAddress?.label || order.deliveryAddress?.address}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        
        {/* Pay Later Status */}
        {isPayLater && (
          order.paymentStatus === 'paid' ? (
            <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <FaCheckCircle className="text-green-400 text-sm" />
              <div className="flex-1">
                <p className="text-xs text-green-400 font-medium">Payment Received</p>
                <p className="text-sm text-white font-medium">
                  ₹{order.amountPaid || order.total} paid
                </p>
              </div>
            </div>
          ) : dueInfo ? (
            <div className={`flex items-center gap-3 mb-3 p-2.5 rounded-lg ${
              dueInfo.isOverdue 
                ? 'bg-red-500/10 border border-red-500/20' 
                : dueInfo.isToday 
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-amber-500/5'
            }`}>
              {dueInfo.isOverdue ? (
                <FaExclamationTriangle className="text-red-400 text-sm" />
              ) : (
                <FaCreditCard className="text-amber-400 text-sm" />
              )}
              <div className="flex-1">
                <p className={`text-xs ${dueInfo.isOverdue ? 'text-red-400' : 'text-amber-400'} font-medium`}>
                  {dueInfo.text}
                </p>
                <p className="text-sm text-white font-medium">
                  ₹{order.amountDue || order.total} payment pending
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-amber-500/5">
              <FaCreditCard className="text-amber-400 text-sm" />
              <div className="flex-1">
                <p className="text-xs text-amber-400 font-medium">Payment Pending</p>
                <p className="text-sm text-white font-medium">
                  ₹{order.amountDue || order.total} due
                </p>
              </div>
            </div>
          )
        )}

        {/* Items Preview */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex -space-x-2">
            {(order.items || []).slice(0, 3).map((item, idx) => (
              <div key={idx} className="w-8 h-8 rounded-lg bg-white/[0.08] border-2 border-[#111827] flex items-center justify-center">
                <FaBox className="text-white/30 text-xs" />
              </div>
            ))}
            {(order.items || []).length > 3 && (
              <div className="w-8 h-8 rounded-lg bg-white/[0.08] border-2 border-[#111827] flex items-center justify-center">
                <span className="text-white/50 text-xs">+{order.items.length - 3}</span>
              </div>
            )}
          </div>
          <span className="text-sm text-white/50">{itemCount} items</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${statusInfo.bgColor} ${statusInfo.color}`}>
              <span>{statusInfo.icon}</span>
              {statusInfo.label}
            </span>
          </div>
          <p className="font-bold text-white text-lg">₹{order.total}</p>
        </div>
      </div>

      {/* Reorder button for delivered orders */}
      {order.status === 'delivered' && (
        <div className="px-4 pb-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Handle reorder
            }}
            className="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-colors"
          >
            <FaRedo className="text-xs" />
            Reorder
          </button>
        </div>
      )}
    </motion.button>
  );
};

const MyOrders = ({ onBack, onOrderClick }) => {
  const { customer } = useCustomerAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!customer?.uid) return;
      
      setLoading(true);
      try {
        const ordersData = await getCustomerOrders(customer.uid, 50);
        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [customer]);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (filter === 'active') {
      return !['delivered', 'cancelled'].includes(order.status);
    }
    if (filter === 'completed') {
      return order.status === 'delivered';
    }
    return true;
  });

  // Group orders by date
  const groupedOrders = filteredOrders.reduce((groups, order) => {
    const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(order);
    return groups;
  }, {});

  // Stats
  const activeCount = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const completedCount = orders.filter(o => o.status === 'delivered').length;

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <div className="bg-[#0a0f1a]/90 backdrop-blur-xl sticky top-0 z-10 border-b border-white/[0.06]">
        <div className="px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
          >
            <FaArrowLeft className="text-white/60" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-white text-lg">My Orders</h1>
            {orders.length > 0 && (
              <p className="text-xs text-white/40">{activeCount} active • {completedCount} completed</p>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-3 flex gap-2">
          {[
            { id: 'all', label: 'All', count: orders.length },
            { id: 'active', label: 'Active', count: activeCount },
            { id: 'completed', label: 'Completed', count: completedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                filter === tab.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-white/[0.06] text-white/50 border border-white/[0.08] hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                  filter === tab.id ? 'bg-white/20' : 'bg-white/[0.08]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-28">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
            <p className="text-white/40 text-sm">Loading orders...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([date, dateOrders]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-white/40 mb-3 flex items-center gap-2">
                  <FaCalendarAlt className="text-xs" />
                  {date}
                </h3>
                <div className="space-y-3">
                  {dateOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onClick={() => onOrderClick(order.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
              <FaShoppingBag className="text-white/20 text-4xl" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No orders yet</h3>
            <p className="text-sm text-white/40 text-center max-w-[250px]">
              {filter === 'active' 
                ? 'You have no active orders right now' 
                : filter === 'completed'
                ? 'You have no completed orders yet'
                : 'Start ordering from nearby stores and your orders will appear here'
              }
            </p>
            <button 
              onClick={onBack}
              className="mt-6 px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium"
            >
              Browse Stores
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
