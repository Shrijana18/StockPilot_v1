import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";

/**
 * KitchenOrderBoard - Kitchen Display System (KDS)
 * Shows real-time orders from POS, organized by status
 */
export default function KitchenOrderBoard({ onBack }) {
  const [orders, setOrders] = React.useState([]);
  const [filter, setFilter] = React.useState("all"); // all | pending | preparing | ready

  const getUid = () => auth.currentUser?.uid;

  // Subscribe to kitchen orders
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;

    const ordersRef = collection(db, "businesses", uid, "kitchenOrders");
    // Try with status filter first, fallback to simple query
    let q;
    try {
      q = query(ordersRef, where("status", "!=", "completed"), orderBy("status"), orderBy("createdAt", "asc"));
    } catch (e) {
      // If index doesn't exist, use simpler query
      q = query(ordersRef, orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const orderList = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "completed") {
          orderList.push({ id: docSnap.id, ...data });
        }
      });
      // Sort by status priority and then by createdAt
      orderList.sort((a, b) => {
        const statusOrder = { pending: 0, preparing: 1, ready: 2, served: 3 };
        const aOrder = statusOrder[a.status] ?? 4;
        const bOrder = statusOrder[b.status] ?? 4;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      setOrders(orderList);
    }, (error) => {
      console.error("Error fetching orders:", error);
      // Fallback query without status filter
      const fallbackQ = query(ordersRef, orderBy("createdAt", "desc"));
      onSnapshot(fallbackQ, (snap) => {
        const orderList = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== "completed") {
            orderList.push({ id: docSnap.id, ...data });
          }
        });
        setOrders(orderList);
      });
    });

    return () => unsubscribe();
  }, []);

  const updateOrderStatus = async (orderId, newStatus) => {
    const uid = getUid();
    if (!uid) return;

    try {
      const orderRef = doc(db, "businesses", uid, "kitchenOrders", orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Date.now(),
        ...(newStatus === "ready" && { readyAt: Date.now() }),
        ...(newStatus === "served" && { servedAt: Date.now() }),
      });
    } catch (e) {
      console.error("Error updating order status:", e);
      alert("Failed to update order status");
    }
  };

  const filteredOrders = filter === "all" 
    ? orders 
    : orders.filter(o => o.status === filter);

  const statusCounts = {
    pending: orders.filter(o => o.status === "pending").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    ready: orders.filter(o => o.status === "ready").length,
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "border-amber-500/50 bg-amber-500/10";
      case "preparing": return "border-blue-500/50 bg-blue-500/10";
      case "ready": return "border-emerald-500/50 bg-emerald-500/10";
      case "served": return "border-slate-500/50 bg-slate-500/10";
      default: return "border-white/10 bg-white/5";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "pending": return "Pending";
      case "preparing": return "Preparing";
      case "ready": return "Ready";
      case "served": return "Served";
      default: return status;
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-transparent">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.9]">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-orange-500/20" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-red-500/20" />
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg bg-gradient-to-r from-orange-400 via-red-300 to-pink-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-lg transition"
            >
              ← Back
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-white/90">Kitchen Display System</h1>
            <p className="text-xs text-white/60">Manage orders in real-time</p>
          </div>
          <div className="flex-1" />
          
          {/* Status Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "all"
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setFilter("pending")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "pending"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Pending ({statusCounts.pending})
            </button>
            <button
              onClick={() => setFilter("preparing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "preparing"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Preparing ({statusCounts.preparing})
            </button>
            <button
              onClick={() => setFilter("ready")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "ready"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Ready ({statusCounts.ready})
            </button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-20 text-white/60">
              <div className="text-6xl mb-4">👨‍🍳</div>
              <div className="text-xl font-semibold mb-2">No orders</div>
              <div className="text-sm">Orders from POS will appear here</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`rounded-xl border p-4 ${getStatusColor(order.status)}`}
                  >
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold text-white text-lg">
                          {order.customerName || order.tableId || "Order"}
                        </div>
                        {order.tableId && (
                          <div className="text-xs text-white/60 mt-1">
                            Table: {order.tableId}
                          </div>
                        )}
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-semibold ${
                        order.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                        order.status === "preparing" ? "bg-blue-500/20 text-blue-300" :
                        order.status === "ready" ? "bg-emerald-500/20 text-emerald-300" :
                        "bg-slate-500/20 text-slate-300"
                      }`}>
                        {getStatusLabel(order.status)}
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2 mb-4">
                      {(order.items || order.lines || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-white/60">×{item.qty || item.quantity || 1}</span>
                            <span className="text-white">
                              {item.product?.name || item.product?.productName || item.name || "Item"}
                            </span>
                          </div>
                          {item.note && (
                            <span className="text-xs text-white/40 italic">({item.note})</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-white/40 mb-3">
                      {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : "Just now"}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {order.status === "pending" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "preparing")}
                          className="flex-1 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-semibold transition"
                        >
                          Start Preparing
                        </button>
                      )}
                      {order.status === "preparing" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "ready")}
                          className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-sm font-semibold transition"
                        >
                          Mark Ready
                        </button>
                      )}
                      {order.status === "ready" && (
                        <button
                          onClick={() => updateOrderStatus(order.id, "served")}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 text-sm font-semibold transition"
                        >
                          Mark Served
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

