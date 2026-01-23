/**
 * WhatsAppOrders - Complete Order Management
 * View and manage all orders received via WhatsApp
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, getDocs, onSnapshot, doc, updateDoc,
  orderBy, where, serverTimestamp, limit
} from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { 
  FaWhatsapp, FaSearch, FaFilter, FaCalendarAlt, FaCheckCircle,
  FaTruck, FaBox, FaClock, FaTimes, FaRupeeSign, FaEye,
  FaPhone, FaMapMarkerAlt, FaCreditCard, FaPrint, FaDownload
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  confirmed: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  processing: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  shipped: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  delivered: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

const WhatsAppOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    totalRevenue: 0,
    todayRevenue: 0,
  });

  const distributorId = auth.currentUser?.uid;

  // Load all orders in real-time
  useEffect(() => {
    if (!distributorId) return;

    const ordersRef = collection(db, 'businesses', distributorId, 'whatsappOrders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt,
        updatedAt: doc.data().updatedAt,
      }));

      setOrders(ordersList);
      
      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const totalRevenue = ordersList.reduce((sum, o) => sum + (o.total || 0), 0);
      const todayRevenue = ordersList
        .filter(o => {
          const orderDate = o.createdAt?.toDate?.() || new Date(0);
          return orderDate >= today;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);

      setStats({
        total: ordersList.length,
        pending: ordersList.filter(o => o.status === 'pending').length,
        confirmed: ordersList.filter(o => o.status === 'confirmed').length,
        shipped: ordersList.filter(o => o.status === 'shipped').length,
        delivered: ordersList.filter(o => o.status === 'delivered').length,
        totalRevenue,
        todayRevenue,
      });

      setLoading(false);
    }, (error) => {
      console.error('Error loading orders:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [distributorId]);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      !searchTerm || 
      order.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerPhone?.includes(searchTerm) ||
      order.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'businesses', distributorId, 'whatsappOrders', orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Order status updated to ${newStatus}`);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const notifyCustomer = async (order) => {
    try {
      if (!order?.id) return;
      const fn = httpsCallable(functions, 'sendOrderUpdateNotification');
      await fn({ orderId: order.id, status: order.status });
      toast.success('✅ Customer notified on WhatsApp');
    } catch (e) {
      console.error('Notify customer failed:', e);
      toast.error(`Failed to notify: ${e.message || 'Unknown error'}`);
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'N/A';
    }
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
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="text-xl font-semibold text-white">
              WhatsApp Orders
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Track and manage all orders received via WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4">
          <div className="flex items-center justify-between mb-2">
            <FaBox className="text-[#00a884] text-xl" />
            <span className="text-2xl font-bold text-white">{stats.total}</span>
          </div>
          <p className="text-[#8696a0] text-sm">Total Orders</p>
        </div>
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4">
          <div className="flex items-center justify-between mb-2">
            <FaClock className="text-yellow-400 text-xl" />
            <span className="text-2xl font-bold text-white">{stats.pending}</span>
          </div>
          <p className="text-[#8696a0] text-sm">Pending</p>
        </div>
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4">
          <div className="flex items-center justify-between mb-2">
            <FaTruck className="text-indigo-400 text-xl" />
            <span className="text-2xl font-bold text-white">{stats.shipped}</span>
          </div>
          <p className="text-[#8696a0] text-sm">Shipped</p>
        </div>
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4">
          <div className="flex items-center justify-between mb-2">
            <FaRupeeSign className="text-green-400 text-xl" />
            <span className="text-2xl font-bold text-white">₹{stats.totalRevenue.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-[#8696a0] text-sm">Total Revenue</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Order ID or Phone Number..."
              className="w-full bg-[#202c33] text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#202c33] text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-[#2a3942]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-12 text-center">
            <FaWhatsapp className="text-[#8696a0] text-5xl mx-auto mb-4" />
            <h3 className="text-white text-lg font-semibold mb-2">No Orders Found</h3>
            <p className="text-[#8696a0]">
              {searchTerm || statusFilter !== 'all' 
                ? 'No orders match your filters. Try adjusting your search.'
                : 'WhatsApp orders will appear here once customers place orders via your bot.'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111b21] rounded-xl border border-[#2a3942] p-5 hover:border-[#00a884]/50 transition-all cursor-pointer"
              onClick={() => {
                setSelectedOrder(order);
                setShowDetails(true);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center flex-shrink-0">
                    <FaWhatsapp className="text-[#00a884] text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-semibold text-lg">#{order.orderId || order.id}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[order.status]?.bg || STATUS_COLORS.pending.bg
                      } ${STATUS_COLORS[order.status]?.text || STATUS_COLORS.pending.text} ${
                        STATUS_COLORS[order.status]?.border || STATUS_COLORS.pending.border
                      } border`}>
                        {order.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-[#8696a0]">
                        <FaPhone className="text-[#00a884]" />
                        <span>{order.customerPhone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#8696a0]">
                        <FaBox className="text-[#00a884]" />
                        <span>{order.itemCount || 0} items</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#8696a0]">
                        <FaCalendarAlt className="text-[#00a884]" />
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#2a3942]">
                        <p className="text-[#8696a0] text-xs mb-1">Items:</p>
                        <div className="flex flex-wrap gap-2">
                          {order.items.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="text-xs bg-[#202c33] text-[#8696a0] px-2 py-1 rounded">
                              {item.name || 'Item'} (×{item.quantity})
                            </span>
                          ))}
                          {order.items.length > 3 && (
                            <span className="text-xs text-[#8696a0] px-2 py-1">
                              +{order.items.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="text-2xl font-bold text-white mb-1">
                    ₹{(order.total || 0).toLocaleString('en-IN')}
                  </div>
                  <div className="flex items-center gap-2 text-[#8696a0] text-xs">
                    <FaEye className="text-[#00a884]" />
                    <span>View Details</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {showDetails && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111b21] rounded-2xl border border-[#2a3942] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                    <FaWhatsapp className="text-[#00a884]" />
                    Order Details
                  </h3>
                  <p className="text-[#8696a0] text-sm mt-1">#{selectedOrder.orderId || selectedOrder.id}</p>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 rounded-lg hover:bg-[#2a3942] text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Order Status */}
                <div className="bg-[#202c33] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <h4 className="text-white font-semibold">Order Status</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => notifyCustomer(selectedOrder)}
                        className="px-3 py-2 rounded-lg bg-[#00a884]/15 border border-[#00a884]/30 text-[#00a884] text-sm hover:bg-[#00a884]/25 transition-colors"
                        title="Send an update message to customer on WhatsApp"
                      >
                        Notify Customer
                      </button>
                      <select
                        value={selectedOrder.status || 'pending'}
                        onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                        className="bg-[#111b21] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-[#2a3942]"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      STATUS_COLORS[selectedOrder.status]?.bg || STATUS_COLORS.pending.bg
                    } ${STATUS_COLORS[selectedOrder.status]?.text || STATUS_COLORS.pending.text} ${
                      STATUS_COLORS[selectedOrder.status]?.border || STATUS_COLORS.pending.border
                    } border`}>
                      {selectedOrder.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#202c33] rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <FaPhone className="text-[#00a884]" />
                      Customer Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[#8696a0]">Phone:</span>
                        <span className="text-white ml-2">{selectedOrder.customerPhone || 'N/A'}</span>
                      </div>
                      {selectedOrder.customerName && (
                        <div>
                          <span className="text-[#8696a0]">Name:</span>
                          <span className="text-white ml-2">{selectedOrder.customerName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#202c33] rounded-xl p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <FaCreditCard className="text-[#00a884]" />
                      Payment Info
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[#8696a0]">Method:</span>
                        <span className="text-white ml-2">{selectedOrder.paymentMethod || 'COD'}</span>
                      </div>
                      <div>
                        <span className="text-[#8696a0]">Status:</span>
                        <span className="text-white ml-2 capitalize">{selectedOrder.paymentStatus || 'pending'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="bg-[#202c33] rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <FaBox className="text-[#00a884]" />
                    Order Items ({selectedOrder.itemCount || selectedOrder.items?.length || 0})
                  </h4>
                  <div className="space-y-3">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-[#111b21] rounded-lg">
                          <div className="flex-1">
                            <p className="text-white font-medium">{item.name || 'Product'}</p>
                            <p className="text-[#8696a0] text-sm">
                              {item.quantity} × ₹{item.price?.toLocaleString('en-IN') || 0}
                            </p>
                          </div>
                          <div className="text-white font-semibold">
                            ₹{(item.total || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#8696a0] text-sm">No items found</p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-[#2a3942] flex items-center justify-between">
                    <span className="text-white font-semibold text-lg">Total Amount:</span>
                    <span className="text-white font-bold text-xl">₹{(selectedOrder.total || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Order Timeline */}
                <div className="bg-[#202c33] rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <FaCalendarAlt className="text-[#00a884]" />
                    Order Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-[#8696a0]">Order Created:</span>
                      <span className="text-white ml-2">{formatDate(selectedOrder.createdAt)}</span>
                    </div>
                    {selectedOrder.updatedAt && (
                      <div>
                        <span className="text-[#8696a0]">Last Updated:</span>
                        <span className="text-white ml-2">{formatDate(selectedOrder.updatedAt)}</span>
                      </div>
                    )}
                    {selectedOrder.source && (
                      <div>
                        <span className="text-[#8696a0]">Source:</span>
                        <span className="text-white ml-2 capitalize">{selectedOrder.source.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WhatsAppOrders;
