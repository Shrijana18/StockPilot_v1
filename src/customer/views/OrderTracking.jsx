/**
 * OrderTracking - Premium dark theme order tracking with pickup/delivery support
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaPhone, FaStore, FaMapMarkerAlt, FaCheck,
  FaClock, FaMotorcycle, FaBox, FaComments, FaTruck, FaCalendarAlt,
  FaDirections, FaCheckCircle, FaCreditCard, FaExclamationTriangle,
  FaStar, FaUser, FaQuestionCircle, FaChevronRight
} from 'react-icons/fa';
import { subscribeToOrder, getOrderStatusInfo, rateOrder } from '../services/orderService';
import DeliveryChat from '../components/DeliveryChat';
import SupportFlow from '../components/SupportFlow';

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

// Status Step Component - Dark Theme
const StatusStep = ({ step, currentStep, label, time, isLast, icon: Icon }) => {
  const isCompleted = currentStep > step;
  const isCurrent = currentStep === step;

  return (
    <div className="flex gap-3">
      {/* Line and Dot */}
      <div className="flex flex-col items-center">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          isCompleted 
            ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' 
            : isCurrent 
              ? 'bg-emerald-500/20 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20' 
              : 'bg-white/[0.06] border border-white/[0.1]'
        }`}>
          {isCompleted ? (
            <FaCheck className="text-white text-sm" />
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full ${
              isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'
            }`} />
          )}
        </div>
        {!isLast && (
          <div className={`w-0.5 h-10 ${
            isCompleted ? 'bg-emerald-500' : 'bg-white/[0.08]'
          }`} />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-6">
        <p className={`font-medium ${
          isCurrent 
            ? 'text-emerald-400' 
            : isCompleted 
              ? 'text-white' 
              : 'text-white/30'
        }`}>
          {label}
        </p>
        {time && (
          <p className="text-xs text-white/40 mt-0.5">{time}</p>
        )}
      </div>
    </div>
  );
};

const OrderTracking = ({ orderId, onBack }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSupportFlow, setShowSupportFlow] = useState(false);

  // Subscribe to order updates
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = subscribeToOrder(orderId, (orderData) => {
      setOrder(orderData);
      setLoading(false);
      
      // Show rating modal if order is delivered and not yet rated
      if (orderData?.status === 'delivered' && !orderData?.storeRating && !showRatingModal) {
        // Small delay to let the UI settle
        setTimeout(() => {
          setShowRatingModal(true);
        }, 1000);
      }
    });

    return () => unsubscribe();
  }, [orderId, showRatingModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <p className="text-white/40">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
          <FaBox className="text-white/20 text-3xl" />
        </div>
        <p className="text-white/60 mb-4">Order not found</p>
        <button onClick={onBack} className="text-emerald-400 font-medium">
          Go Back
        </button>
      </div>
    );
  }

  const isPickup = order.orderType === 'pickup';
  const statusInfo = getOrderStatusInfo(order.status, order.orderType) || {
    label: 'Processing',
    description: 'Order is being processed',
    color: 'text-white/60',
    bgColor: 'bg-white/10',
    icon: '⏳',
    step: 1
  };

  // Different steps for pickup vs delivery
  const deliverySteps = [
    { step: 1, label: 'Order Placed', status: 'pending' },
    { step: 2, label: 'Confirmed', status: 'confirmed' },
    { step: 3, label: 'Preparing', status: 'preparing' },
    { step: 4, label: 'Ready', status: 'ready' },
    { step: 5, label: 'Out for Delivery', status: 'out_for_delivery' },
    { step: 6, label: 'Delivered', status: 'delivered' },
  ];

  const pickupSteps = [
    { step: 1, label: 'Order Placed', status: 'pending' },
    { step: 2, label: 'Confirmed', status: 'confirmed' },
    { step: 3, label: 'Preparing', status: 'preparing' },
    { step: 4, label: 'Ready for Pickup', status: 'ready' },
    { step: 5, label: 'Picked Up', status: 'delivered' },
  ];

  const statusSteps = isPickup ? pickupSteps : deliverySteps;

  const getStatusTime = (status) => {
    if (!Array.isArray(order.statusHistory)) {
      if (status === 'pending' && order.createdAt) {
        return new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return null;
    }
    const entry = order.statusHistory.find(h => h.status === status);
    if (entry) {
      return new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <div className="bg-[#0a0f1a]/90 backdrop-blur-xl sticky top-0 z-10 border-b border-white/[0.06]">
        <div className="px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <button
            onClick={() => {
              // Ensure we always have a valid navigation path
              if (onBack) {
                try {
                  onBack();
                } catch (error) {
                  console.error('Navigation error:', error);
                  // Fallback: use browser history
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = '/shop';
                  }
                }
              } else {
                // Fallback navigation
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/shop';
                }
              }
            }}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.1] transition"
          >
            <FaArrowLeft className="text-white/60" />
          </button>
          <div>
            <h1 className="font-bold text-white">Track Order</h1>
            <p className="text-xs text-white/40">#{order.orderNumber}</p>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`mx-4 mt-4 p-4 rounded-2xl border ${
        isPickup 
          ? 'bg-purple-500/10 border-purple-500/20' 
          : 'bg-cyan-500/10 border-cyan-500/20'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
            isPickup ? 'bg-purple-500/20' : 'bg-cyan-500/20'
          }`}>
            {statusInfo.icon}
          </div>
          <div className="flex-1">
            <p className={`font-semibold text-lg ${statusInfo.color || 'text-emerald-400'}`}>
              {statusInfo.label}
            </p>
            <p className="text-sm text-white/60">{statusInfo.description}</p>
          </div>
        </div>
        
        {/* Estimated Time / Pickup Time */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center gap-2">
            <FaClock className="text-white/40" />
            {isPickup ? (
              <span className="text-sm text-white/60">
                Pickup: <span className="text-white font-medium">{order.pickupDateLabel || 'Today'}</span> at <span className="text-white font-medium">{order.pickupSlot?.time || 'Store hours'}</span>
              </span>
            ) : order.estimatedDelivery ? (
              <span className="text-sm text-white/60">
                Estimated delivery by <span className="text-white font-medium">{new Date(order.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            ) : (
              <span className="text-sm text-white/60">Estimated time will be updated soon</span>
            )}
          </div>
        )}
      </div>

      {/* Order Progress */}
      {order.status !== 'cancelled' && (
        <div className="mx-4 mt-4 bg-slate-800 rounded-2xl border border-white/[0.06] p-4">
          <h3 className="font-semibold text-white mb-4">Order Progress</h3>
          <div>
            {statusSteps.map((s, index) => (
              <StatusStep
                key={s.step}
                step={s.step}
                currentStep={statusInfo.step}
                label={s.label}
                time={getStatusTime(s.status)}
                isLast={index === statusSteps.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delivery Agent Info - Only for delivery orders */}
      {!isPickup && (order.deliveryAgent || order.deliveryPartner) && order.status === 'out_for_delivery' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Delivery Partner</h3>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              On the way
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <FaMotorcycle className="text-2xl" />
              </div>
              <div>
                <p className="font-semibold text-lg">
                  {order.deliveryAgent?.name || order.deliveryPartner}
                </p>
                <p className="text-sm text-white/80">
                  {order.deliveryAgent?.vehicleNumber || 'Delivery Agent'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {(order.deliveryAgent?.phone || order.deliveryPartnerPhone) && (
                <a
                  href={`tel:${order.deliveryAgent?.phone || order.deliveryPartnerPhone}`}
                  className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
                >
                  <FaPhone />
                </a>
              )}
              <button
                onClick={() => setShowChat(true)}
                className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-emerald-600"
              >
                <FaComments />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pickup Info - For pickup orders when ready */}
      {isPickup && order.status === 'ready' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 text-white shadow-xl shadow-purple-500/20"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Ready for Pickup!</h3>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full flex items-center gap-1">
              <FaCheckCircle className="text-xs" />
              Waiting for you
            </span>
          </div>
          
          <p className="text-white/90 text-sm mb-4">
            Your order is packed and ready. Visit the store to collect it.
          </p>
          
          <div className="bg-white/10 rounded-xl p-3 mb-3">
            <p className="text-white/70 text-xs mb-1">Pickup Time</p>
            <p className="font-semibold">
              {order.pickupDateLabel || 'Today'} • {order.pickupSlot?.time || 'During store hours'}
            </p>
          </div>
          
          {order.pickupInstructions && (
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-white/70 text-xs mb-1">Pickup Instructions</p>
              <p className="text-sm">{order.pickupInstructions}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Store Info */}
      <div className="mx-4 mt-4 bg-slate-800 rounded-2xl border border-white/[0.06] p-4">
        <h3 className="font-semibold text-white mb-3">Store Details</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isPickup ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              <FaStore className={isPickup ? 'text-purple-400' : 'text-blue-400'} />
            </div>
            <div>
              <p className="font-medium text-white">{order.storeName}</p>
              <p className="text-sm text-white/40">{isPickup ? 'Pickup location' : 'Store'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {order.storePhone && (
              <a
                href={`tel:${order.storePhone}`}
                className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"
              >
                <FaPhone className="text-emerald-400 text-sm" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Need Help? - Status-aware: return/refund only after delivery */}
      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => setShowSupportFlow(true)}
          className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 hover:border-amber-500/30 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <FaQuestionCircle className="text-amber-400 text-lg" />
            </div>
            <div>
              <p className="font-semibold text-white">Need help with this order?</p>
              <p className="text-xs text-white/50">
                {order.status === 'delivered'
                  ? 'Query, return, refund, or other support'
                  : 'Query, cancel, delivery issue, or other support'}
              </p>
            </div>
          </div>
          <FaChevronRight className="text-white/40 flex-shrink-0" />
        </button>
      </div>

      {/* Delivery Address / Pickup Info */}
      {isPickup ? (
        <div className="mx-4 mt-4 bg-slate-800 rounded-2xl border border-white/[0.06] p-4">
          <h3 className="font-semibold text-white mb-3">Pickup Details</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-purple-500/5 rounded-xl">
              <FaCalendarAlt className="text-purple-400" />
              <div>
                <p className="text-xs text-white/40">Date</p>
                <p className="text-white font-medium">{order.pickupDateLabel || 'Today'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-500/5 rounded-xl">
              <FaClock className="text-purple-400" />
              <div>
                <p className="text-xs text-white/40">Time Slot</p>
                <p className="text-white font-medium">{order.pickupSlot?.time || 'During store hours'}</p>
              </div>
            </div>
            {order.pickupInstructions && (
              <div className="p-3 bg-white/[0.03] rounded-xl">
                <p className="text-xs text-white/40 mb-1">Store Instructions</p>
                <p className="text-white/80 text-sm">{order.pickupInstructions}</p>
              </div>
            )}
          </div>
        </div>
      ) : order.deliveryAddress && (
        <div className="mx-4 mt-4 bg-slate-800 rounded-2xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-white">
              {order.isScheduledDelivery ? 'Scheduled Delivery' : 'Delivery Address'}
            </h3>
            {order.isScheduledDelivery && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                Scheduled
              </span>
            )}
          </div>
          
          {/* Scheduled Delivery Date & Time - Show when date exists or slot contains time range */}
          {(order.deliveryDateLabel || order.deliveryDate || (order.deliverySlot && order.deliverySlot.includes(' - '))) && (
            <div className="mb-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <FaCalendarAlt className="text-amber-400" />
                  <div>
                    <p className="text-xs text-white/40">Delivery Date</p>
                    <p className="text-white font-medium">
                      {order.deliveryDateLabel || getDateLabelFromISO(order.deliveryDate) || 'Scheduled'}
                    </p>
                  </div>
                </div>
                {order.deliverySlot && (
                  <div className="flex items-center gap-2">
                    <FaClock className="text-amber-400" />
                    <div>
                      <p className="text-xs text-white/40">Time Slot</p>
                      <p className="text-white font-medium">{order.deliverySlot}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <FaMapMarkerAlt className="text-cyan-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{order.deliveryAddress?.label}</p>
              <p className="text-sm text-white/60 mt-0.5">{order.deliveryAddress?.address}</p>
              {order.deliveryAddress?.city && (
                <p className="text-sm text-white/40">{order.deliveryAddress?.city} - {order.deliveryAddress?.pincode}</p>
              )}
            </div>
          </div>
          {/* Quick delivery slot - only show if not a time range (scheduled) */}
          {order.deliverySlot && !order.deliverySlot.includes(' - ') && !order.deliveryDateLabel && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2">
              <FaClock className="text-white/40 text-sm" />
              <span className="text-sm text-white/60">Delivery: {order.deliverySlot === 'asap' ? 'ASAP (45-60 min)' : order.deliverySlot === '2hr' ? 'Within 2 Hours' : order.deliverySlot}</span>
            </div>
          )}
        </div>
      )}

      {/* Order Items */}
      <div className="mx-4 mt-4 bg-slate-800 rounded-2xl border border-white/[0.06] p-4">
        <h3 className="font-semibold text-white mb-3">Order Items ({order.items?.length || 0})</h3>
        <div className="space-y-3">
          {order.items?.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-10 h-10 object-contain" />
                ) : (
                  <FaBox className="text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.name}</p>
                <p className="text-xs text-white/40">Qty: {item.quantity} × ₹{item.price}</p>
              </div>
              <p className="font-medium text-white">₹{item.total || item.price * item.quantity}</p>
            </div>
          ))}
        </div>
        
        {/* Bill Summary */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2 text-sm">
          <div className="flex justify-between text-white/50">
            <span>Subtotal</span>
            <span>₹{order.subtotal || order.total}</span>
          </div>
          {!isPickup && order.deliveryFee > 0 && (
            <div className="flex justify-between text-white/50">
              <span>Delivery Fee</span>
              <span>₹{order.deliveryFee}</span>
            </div>
          )}
          {order.platformFee > 0 && (
            <div className="flex justify-between text-white/50">
              <span>Platform Fee</span>
              <span>₹{order.platformFee}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-white pt-2 border-t border-white/[0.06]">
            <span>Total</span>
            <span className="text-emerald-400">₹{order.total}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      {(() => {
        const isPayLater = order.paymentMethod === 'PAY_LATER' || order.paymentStatus === 'pay_later';
        const formatDueDate = (dueDate) => {
          if (!dueDate) return null;
          const date = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
          const today = new Date();
          const diffTime = date - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)} days`, isOverdue: true };
          if (diffDays === 0) return { text: 'Due today', isOverdue: false, isToday: true };
          if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
          return { 
            text: `Due ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, 
            isOverdue: false 
          };
        };
        const dueInfo = isPayLater && order.paymentDueDate ? formatDueDate(order.paymentDueDate) : null;
        
        return (
          <div className={`mx-4 mt-4 rounded-2xl border p-4 ${
            isPayLater 
              ? dueInfo?.isOverdue 
                ? 'bg-red-500/10 border-red-500/20' 
                : 'bg-amber-500/10 border-amber-500/20'
              : 'bg-slate-800 border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                {isPayLater && <FaCreditCard className="text-amber-400" />}
                Payment
              </h3>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                order.paymentStatus === 'paid' 
                  ? 'bg-green-500/20 text-green-400' 
                  : isPayLater
                    ? dueInfo?.isOverdue 
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                    : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {isPayLater && <FaCreditCard className="text-xs" />}
                {order.paymentStatus === 'paid' 
                  ? 'Paid' 
                  : isPayLater 
                    ? 'Pay Later' 
                    : 'Pay on ' + (isPickup ? 'Pickup' : 'Delivery')}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">
                {order.paymentMethod === 'COD' 
                  ? 'Cash on Delivery' 
                  : order.paymentMethod === 'PAY_LATER' 
                    ? 'Credit / Pay Later'
                    : order.paymentMethod || 'Cash'}
              </span>
            </div>
            
            {/* Pay Later Details */}
            {isPayLater && (
              <div className={`mt-3 pt-3 border-t ${dueInfo?.isOverdue ? 'border-red-500/20' : 'border-amber-500/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/60 text-sm">Amount Due</span>
                  <span className="text-white font-bold text-lg">₹{order.amountDue || order.total}</span>
                </div>
                {dueInfo && (
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                    dueInfo.isOverdue 
                      ? 'bg-red-500/20' 
                      : dueInfo.isToday 
                        ? 'bg-amber-500/20' 
                        : 'bg-white/5'
                  }`}>
                    {dueInfo.isOverdue ? (
                      <FaExclamationTriangle className="text-red-400" />
                    ) : (
                      <FaClock className="text-amber-400" />
                    )}
                    <span className={`text-sm font-medium ${
                      dueInfo.isOverdue ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {dueInfo.text}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Rating Section - Show if delivered and not yet rated */}
      {order.status === 'delivered' && !order.storeRating && !showRatingModal && (
        <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-2xl border border-yellow-500/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <FaStar className="text-yellow-400 text-xl" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Rate Your Experience</h3>
              <p className="text-sm text-white/60">Help us improve by rating your order</p>
            </div>
          </div>
          <button
            onClick={() => setShowRatingModal(true)}
            className="w-full py-3 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition flex items-center justify-center gap-2"
          >
            <FaStar />
            Rate Order
          </button>
        </div>
      )}

      {/* Show Ratings if Already Rated */}
      {(order.storeRating || order.deliveryPersonRating) && (
        <div className="mx-4 mt-4 space-y-3">
          {/* Store Rating */}
          {order.storeRating && (
            <div className="p-4 bg-slate-800 rounded-2xl border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-2">
                <FaStore className="text-blue-400" />
                <div className="flex-1">
                  <p className="font-semibold text-white">{order.storeName}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar
                        key={star}
                        className={`text-sm ${
                          star <= order.storeRating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-white/20'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-white/50 ml-2">{order.storeRating}/5</span>
                  </div>
                </div>
              </div>
              {order.storeReview && (
                <p className="text-sm text-white/70 mt-2">{order.storeReview}</p>
              )}
            </div>
          )}

          {/* Delivery Person Rating */}
          {order.deliveryPersonRating && (
            <div className="p-4 bg-slate-800 rounded-2xl border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-2">
                <FaMotorcycle className="text-emerald-400" />
                <div className="flex-1">
                  <p className="font-semibold text-white">
                    {order.deliveryPersonName || order.deliveryAgent?.name || 'Delivery Person'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FaStar
                        key={star}
                        className={`text-sm ${
                          star <= order.deliveryPersonRating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-white/20'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-white/50 ml-2">{order.deliveryPersonRating}/5</span>
                  </div>
                </div>
              </div>
              {order.deliveryPersonReview && (
                <p className="text-sm text-white/70 mt-2">{order.deliveryPersonReview}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-28" />

      {/* Delivery Chat Modal */}
      <AnimatePresence>
        {showChat && order && (
          <DeliveryChat 
            order={order} 
            onClose={() => setShowChat(false)} 
          />
        )}
      </AnimatePresence>

      {/* Rating Modal - Show when order is delivered and not yet rated */}
      <AnimatePresence>
        {showRatingModal && order && order.status === 'delivered' && (
          <RatingModal
            order={order}
            onClose={() => setShowRatingModal(false)}
            onSubmit={async (ratingData) => {
              const result = await rateOrder(order.id, ratingData);
              if (result.success) {
                setShowRatingModal(false);
                // Update local order state
                setOrder(prev => ({ ...prev, ...ratingData }));
              } else {
                alert('Failed to submit rating. Please try again.');
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Help / Support Flow */}
      <SupportFlow
        isOpen={showSupportFlow}
        onClose={() => setShowSupportFlow(false)}
        preSelectedOrder={order}
      />
    </div>
  );
};

// Rating Modal Component
const RatingModal = ({ order, onClose, onSubmit }) => {
  const [storeRating, setStoreRating] = useState(0);
  const [storeReview, setStoreReview] = useState('');
  const [deliveryPersonRating, setDeliveryPersonRating] = useState(0);
  const [deliveryPersonReview, setDeliveryPersonReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isDelivery = order.orderType === 'delivery';

  const handleSubmit = async () => {
    if (storeRating === 0) {
      alert('Please rate the store');
      return;
    }
    if (isDelivery && deliveryPersonRating === 0) {
      alert('Please rate the delivery person');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        storeRating,
        storeReview: storeReview.trim() || '',
        deliveryPersonRating: isDelivery ? deliveryPersonRating : undefined,
        deliveryPersonReview: isDelivery ? deliveryPersonReview.trim() || '' : '',
        deliveryPersonName: order.deliveryAgent?.name || order.deliveryPartner,
        deliveryPersonId: order.deliveryAgent?.id
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ rating, onRatingChange, label }) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white/80">{label}</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <FaStar
              className={`text-2xl ${
                star <= rating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-white/20'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-sm text-white/60 ml-2">{rating}/5</span>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Rate Your Experience</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
          >
            <FaArrowLeft className="text-white/60 text-sm" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Store Rating */}
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FaStore className="text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{order.storeName}</p>
                <p className="text-xs text-white/50">Store</p>
              </div>
            </div>
            <StarRating
              rating={storeRating}
              onRatingChange={setStoreRating}
              label="How was your experience with the store?"
            />
            <textarea
              value={storeReview}
              onChange={(e) => setStoreReview(e.target.value)}
              placeholder="Write a review (optional)..."
              className="mt-3 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm resize-none"
              rows="3"
            />
          </div>

          {/* Delivery Person Rating - Only for delivery orders */}
          {isDelivery && (order.deliveryAgent || order.deliveryPartner) && (
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <FaMotorcycle className="text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {order.deliveryAgent?.name || order.deliveryPartner || 'Delivery Person'}
                  </p>
                  <p className="text-xs text-white/50">Delivery Partner</p>
                </div>
              </div>
              <StarRating
                rating={deliveryPersonRating}
                onRatingChange={setDeliveryPersonRating}
                label="How was the delivery experience?"
              />
              <textarea
                value={deliveryPersonReview}
                onChange={(e) => setDeliveryPersonReview(e.target.value)}
                placeholder="Write a review (optional)..."
                className="mt-3 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm resize-none"
                rows="3"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-white/10 text-white/70 rounded-xl font-medium hover:bg-white/20 transition disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || storeRating === 0 || (isDelivery && deliveryPersonRating === 0)}
              className="flex-1 px-4 py-3 bg-emerald-500 text-slate-900 rounded-xl font-medium hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <FaCheck />
                  Submit Rating
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OrderTracking;
