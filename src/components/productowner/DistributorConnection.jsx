import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus,
  FaSearch,
  FaUserPlus,
  FaBox,
  FaTruck,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaEye,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

const DistributorConnection = () => {
  const [activeTab, setActiveTab] = useState("connected");
  const [distributors, setDistributors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignOrderModal, setShowAssignOrderModal] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newDistributor, setNewDistributor] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    gstin: "",
    territory: "",
  });

  const [newOrder, setNewOrder] = useState({
    productId: "",
    productName: "",
    quantity: "",
    priority: "normal",
    notes: "",
  });

  useEffect(() => {
    const fetchDistributors = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;

      setLoading(true);
      try {
        // Fetch connected distributors
        const distributorsRef = collection(
          db,
          `businesses/${productOwnerId}/connectedDistributors`
        );
        const distributorsSnap = await getDocs(distributorsRef);
        const distributorsList = [];

        for (const distributorDoc of distributorsSnap.docs) {
          const distributorData = distributorDoc.data();
          const distributorId = distributorData.distributorId || distributorDoc.id;

          // Fetch distributor details from businesses collection
          try {
            const distributorBusinessRef = doc(db, "businesses", distributorId);
            const distributorBusinessSnap = await getDoc(distributorBusinessRef);
            if (distributorBusinessSnap.exists()) {
              distributorsList.push({
                id: distributorDoc.id,
                distributorId,
                ...distributorBusinessSnap.data(),
                ...distributorData,
                connectionStatus: distributorData.status || "connected",
                connectedAt: distributorData.connectedAt,
              });
            } else {
              distributorsList.push({
                id: distributorDoc.id,
                distributorId,
                ...distributorData,
                connectionStatus: distributorData.status || "connected",
              });
            }
          } catch (err) {
            console.error("Error fetching distributor details:", err);
            distributorsList.push({
              id: distributorDoc.id,
              distributorId,
              ...distributorData,
            });
          }
        }

        setDistributors(distributorsList);

        // Fetch orders
        const ordersRef = collection(db, `businesses/${productOwnerId}/orders`);
        const ordersSnap = await getDocs(ordersRef);
        setOrders(ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching distributors:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDistributors();
  }, []);

  const handleCreateDistributor = async (e) => {
    e.preventDefault();
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      // First, create a business document for the distributor
      // In a real scenario, you might want to create a user account first
      // For now, we'll just create a connection record

      const distributorData = {
        ...newDistributor,
        role: "distributor",
        createdAt: new Date().toISOString(),
        createdBy: productOwnerId,
      };

      // Add to connected distributors
      await addDoc(
        collection(db, `businesses/${productOwnerId}/connectedDistributors`),
        {
          ...distributorData,
          status: "connected",
          connectedAt: new Date().toISOString(),
        }
      );

      alert("Distributor created and connected successfully!");
      setShowCreateModal(false);
      setNewDistributor({
        businessName: "",
        ownerName: "",
        email: "",
        phone: "",
        address: "",
        gstin: "",
        territory: "",
      });
      // Refresh list
      window.location.reload();
    } catch (err) {
      console.error("Error creating distributor:", err);
      alert("Failed to create distributor. Please try again.");
    }
  };

  const handleAssignOrder = async (e) => {
    e.preventDefault();
    if (!selectedDistributor) return;

    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      const orderData = {
        ...newOrder,
        distributorId: selectedDistributor.distributorId || selectedDistributor.id,
        distributorName: selectedDistributor.businessName || selectedDistributor.distributorName,
        status: "assigned",
        assignedAt: new Date().toISOString(),
        assignedBy: productOwnerId,
        quantity: Number(newOrder.quantity),
      };

      await addDoc(collection(db, `businesses/${productOwnerId}/orders`), orderData);

      // Also add to distributor's orders collection
      if (selectedDistributor.distributorId) {
        await addDoc(
          collection(
            db,
            `businesses/${selectedDistributor.distributorId}/assignedOrders`
          ),
          {
            ...orderData,
            productOwnerId,
            productOwnerName: auth.currentUser?.displayName || "Product Owner",
          }
        );
      }

      alert("Order assigned successfully!");
      setShowAssignOrderModal(false);
      setNewOrder({
        productId: "",
        productName: "",
        quantity: "",
        priority: "normal",
        notes: "",
      });
      setSelectedDistributor(null);
    } catch (err) {
      console.error("Error assigning order:", err);
      alert("Failed to assign order. Please try again.");
    }
  };

  const filteredDistributors = distributors.filter((dist) => {
    const query = searchQuery.toLowerCase();
    return (
      dist.businessName?.toLowerCase().includes(query) ||
      dist.ownerName?.toLowerCase().includes(query) ||
      dist.email?.toLowerCase().includes(query) ||
      dist.territory?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "connected":
        return "bg-emerald-400/20 text-emerald-300 border-emerald-400/30";
      case "pending":
        return "bg-yellow-400/20 text-yellow-300 border-yellow-400/30";
      case "inactive":
        return "bg-gray-400/20 text-gray-300 border-gray-400/30";
      default:
        return "bg-blue-400/20 text-blue-300 border-blue-400/30";
    }
  };

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Distributor Connections</h2>
          <p className="text-white/70 text-sm mt-1">
            Manage your distributor network and assign orders
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center gap-2 transition"
        >
          <FaPlus /> Create Distributor
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "connected", label: "Connected Distributors", icon: <FaUserPlus /> },
          { id: "orders", label: "Assigned Orders", icon: <FaBox /> },
          { id: "tracking", label: "Track Orders", icon: <FaTruck /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 flex items-center gap-2 transition ${
              activeTab === tab.id
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Connected Distributors Tab */}
      {activeTab === "connected" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search distributors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>

          {/* Distributors Grid */}
          {loading ? (
            <div className="text-center py-12 text-white/50">Loading distributors...</div>
          ) : filteredDistributors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDistributors.map((distributor) => (
                <motion.div
                  key={distributor.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{distributor.businessName || "Unnamed"}</h3>
                      <p className="text-sm text-white/70">{distributor.ownerName}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(
                        distributor.connectionStatus
                      )}`}
                    >
                      {distributor.connectionStatus}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-white/70 mb-4">
                    {distributor.email && (
                      <p>
                        <span className="text-white/50">Email:</span> {distributor.email}
                      </p>
                    )}
                    {distributor.phone && (
                      <p>
                        <span className="text-white/50">Phone:</span> {distributor.phone}
                      </p>
                    )}
                    {distributor.territory && (
                      <p>
                        <span className="text-white/50">Territory:</span> {distributor.territory}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedDistributor(distributor);
                        setShowAssignOrderModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm transition"
                    >
                      Assign Order
                    </button>
                    <button
                      onClick={() => {
                        // Navigate to distributor details/inventory
                        window.location.hash = `#/product-owner-dashboard?tab=distributors&distributor=${distributor.id}`;
                      }}
                      className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm transition"
                    >
                      <FaEye />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No distributors found. Create your first distributor to get started.
            </div>
          )}
        </motion.div>
      )}

      {/* Assigned Orders Tab */}
      {activeTab === "orders" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Order ID</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Product</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Distributor</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Quantity</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Status</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Assigned Date</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="p-3 text-sm">#{order.id.slice(0, 8)}</td>
                      <td className="p-3 text-sm">{order.productName || "N/A"}</td>
                      <td className="p-3 text-sm">{order.distributorName || "N/A"}</td>
                      <td className="p-3 text-sm">{order.quantity || 0}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getOrderStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status || "assigned"}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-white/70">
                        {order.assignedAt
                          ? new Date(order.assignedAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="p-3">
                        <button className="text-emerald-300 hover:text-emerald-200 text-sm">
                          Track
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/50">
                      No orders assigned yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Track Orders Tab */}
      {activeTab === "tracking" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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

      {/* Create Distributor Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold mb-4">Create New Distributor</h3>
              <form onSubmit={handleCreateDistributor} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={newDistributor.businessName}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, businessName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    value={newDistributor.ownerName}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, ownerName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={newDistributor.email}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={newDistributor.phone}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Address</label>
                  <textarea
                    value={newDistributor.address}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, address: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={newDistributor.gstin}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, gstin: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Territory</label>
                  <input
                    type="text"
                    value={newDistributor.territory}
                    onChange={(e) =>
                      setNewDistributor({ ...newDistributor, territory: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Order Modal */}
      <AnimatePresence>
        {showAssignOrderModal && selectedDistributor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAssignOrderModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold mb-2">
                Assign Order to {selectedDistributor.businessName}
              </h3>
              <form onSubmit={handleAssignOrder} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newOrder.productName}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, productName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Product ID</label>
                  <input
                    type="text"
                    value={newOrder.productId}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, productId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newOrder.quantity}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, quantity: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Priority</label>
                  <select
                    value={newOrder.priority}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Notes</label>
                  <textarea
                    value={newOrder.notes}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAssignOrderModal(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition"
                  >
                    Assign Order
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DistributorConnection;

