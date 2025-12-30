import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaBox, FaTruck, FaClock } from "react-icons/fa";
import OrderDetailModal from "./OrderDetailModal";

const OrderFlow = ({ 
  distributorOrderRequests, 
  orders, 
  onOrderUpdate,
  fetchDistributors 
}) => {
  const [activeSubTab, setActiveSubTab] = useState("incomingRequests");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);

  const getOrderStatusColor = (status) => {
    switch (status) {
      case "assigned":
        return "bg-blue-400/20 text-blue-300";
      case "accepted":
        return "bg-emerald-400/20 text-emerald-300";
      case "in_transit":
        return "bg-orange-400/20 text-orange-300";
      case "delivered":
        return "bg-green-400/20 text-green-300";
      case "cancelled":
        return "bg-red-400/20 text-red-300";
      default:
        return "bg-gray-400/20 text-gray-300";
    }
  };

  const tabs = [
    { 
      id: "incomingRequests", 
      label: "Incoming Order Requests", 
      icon: <FaBox />,
      badge: distributorOrderRequests.length > 0 ? distributorOrderRequests.filter(o => o.status === 'REQUESTED' || o.statusCode === 'REQUESTED').length : 0
    },
    { id: "orders", label: "Assigned Orders", icon: <FaBox /> },
    { id: "tracking", label: "Track Orders", icon: <FaTruck /> },
  ];

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowOrderDetailModal(true);
  };

  const handleModalUpdate = () => {
    if (onOrderUpdate) onOrderUpdate();
    if (fetchDistributors) fetchDistributors();
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 transition ${
              activeSubTab === tab.id
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.icon} {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Incoming Order Requests Sub-tab */}
        {activeSubTab === "incomingRequests" && (
          <motion.div
            key="incomingRequests"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Order ID</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Distributor</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Items</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Total</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Payment</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Priority</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Status</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Requested</th>
                    <th className="p-3 text-left text-sm font-semibold text-white/70">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {distributorOrderRequests.length > 0 ? (
                    distributorOrderRequests.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="p-3 text-sm font-mono">#{order.id.slice(0, 8)}</td>
                        <td className="p-3 text-sm">
                          {order.distributorName || "N/A"}
                        </td>
                        <td className="p-3 text-sm">
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-1">
                              <span className="font-medium">{order.items.length} item(s)</span>
                              <div className="text-xs text-white/60">
                                {order.items.slice(0, 2).map((it, idx) => (
                                  <div key={idx}>{it.productName || 'Unnamed Product'} (×{it.quantity || 1})</div>
                                ))}
                                {order.items.length > 2 && <div>+{order.items.length - 2} more...</div>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-white/50">No items</span>
                          )}
                        </td>
                        <td className="p-3 text-sm font-semibold text-emerald-400">
                          ₹{((order.grandTotal || order.itemsSubTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-sm">{order.paymentModeLabel || order.paymentMode || "N/A"}</td>
                        <td className="p-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.priority === "urgent" ? "bg-red-500/20 text-red-300" :
                            order.priority === "high" ? "bg-orange-500/20 text-orange-300" :
                            order.priority === "low" ? "bg-gray-500/20 text-gray-300" :
                            "bg-blue-500/20 text-blue-300"
                          }`}>
                            {order.priority || "normal"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            order.status === 'REQUESTED' || order.status === 'requested' ? 'bg-yellow-400/20 text-yellow-300' :
                            order.status === 'ACCEPTED' || order.status === 'accepted' ? 'bg-emerald-400/20 text-emerald-300' :
                            order.status === 'REJECTED' || order.status === 'rejected' ? 'bg-red-400/20 text-red-300' :
                            'bg-blue-400/20 text-blue-300'
                          }`}>
                            {order.status || order.statusCode || "REQUESTED"}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-white/70">
                          {order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()) : "N/A"}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-white/50">
                        No incoming order requests yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Assigned Orders Sub-tab */}
        {activeSubTab === "orders" && (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Order ID</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Items</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Distributor</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Total Amount</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Payment</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Priority</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Status</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Assigned Date</th>
                    <th className="text-left p-3 text-sm font-semibold text-white/80">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? (
                    orders.map((order) => {
                      const items = order.items || [];
                      const itemsCount = items.length;
                      const totalAmount = order.grandTotal || order.itemsSubTotal || 0;
                      const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));
                      const statusDisplay = order.statusCode || order.status || 'ASSIGNED';
                      
                      return (
                        <tr
                          key={order.id}
                          className="border-b border-white/5 hover:bg-white/5 transition"
                        >
                          <td className="p-3 text-sm font-mono">#{order.id.slice(0, 8)}</td>
                          <td className="p-3 text-sm">
                            {itemsCount > 0 ? (
                              <div className="space-y-1">
                                <span className="font-medium">{itemsCount} item(s)</span>
                                <div className="text-xs text-white/60">
                                  {items.slice(0, 2).map((it, idx) => (
                                    <div key={idx}>{it.productName} (×{it.quantity})</div>
                                  ))}
                                  {itemsCount > 2 && <div>+{itemsCount - 2} more...</div>}
                                </div>
                              </div>
                            ) : (
                              <span className="text-white/50">No items</span>
                            )}
                          </td>
                          <td className="p-3 text-sm">{order.distributorName || "N/A"}</td>
                          <td className="p-3 text-sm font-semibold">{formatINR(totalAmount)}</td>
                          <td className="p-3 text-sm">
                            <span className="text-white/70">{order.paymentModeLabel || order.paymentMode || 'COD'}</span>
                            {order.creditDays && (
                              <div className="text-xs text-white/50">{order.creditDays} days</div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              order.priority === 'urgent' ? 'bg-red-500/20 text-red-300' :
                              order.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                              order.priority === 'low' ? 'bg-gray-500/20 text-gray-300' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {order.priority || 'normal'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getOrderStatusColor(
                                statusDisplay
                              )}`}
                            >
                              {statusDisplay}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-white/70">
                            {order.createdAt?.toDate
                              ? order.createdAt.toDate().toLocaleDateString()
                              : order.timestamp?.toDate
                              ? order.timestamp.toDate().toLocaleDateString()
                              : order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="p-3">
                            <button 
                              onClick={() => handleViewOrder(order)}
                              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-white/50">
                        No orders assigned yet. Assign an order to a distributor to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Track Orders Sub-tab */}
        {activeSubTab === "tracking" && (
          <motion.div
            key="tracking"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Order #{order.id.slice(0, 8)}</h4>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${getOrderStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-white/70">
                    <p>
                      <span className="text-white/50">Product:</span> {order.productName}
                    </p>
                    <p>
                      <span className="text-white/50">Distributor:</span> {order.distributorName}
                    </p>
                    <p>
                      <span className="text-white/50">Quantity:</span> {order.quantity}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <FaClock /> {order.assignedAt ? new Date(order.assignedAt).toLocaleString() : "N/A"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {showOrderDetailModal && selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            isDistributorOrderRequest={activeSubTab === 'incomingRequests'}
            onClose={() => {
              setShowOrderDetailModal(false);
              setSelectedOrder(null);
            }}
            onUpdate={handleModalUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderFlow;
