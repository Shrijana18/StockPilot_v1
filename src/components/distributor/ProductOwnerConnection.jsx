import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  setDoc,
  serverTimestamp,
  updateDoc,
  getDocs as firestoreGetDocs,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  FaBuilding,
  FaBox,
  FaTruck,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaEye,
  FaIdCard,
  FaMapMarkerAlt,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import OrderDetailModal from "../productowner/OrderDetailModal";
import DistributorOrderRequestForm from "./DistributorOrderRequestForm";
import { ORDER_STATUSES } from "../../constants/orderStatus";

const ProductOwnerConnection = () => {
  const [activeTab, setActiveTab] = useState("connected");
  const [productOwners, setProductOwners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedProductOwner, setSelectedProductOwner] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderRequestForm, setShowOrderRequestForm] = useState(false);
  const [orderRequests, setOrderRequests] = useState([]);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryOrder, setInventoryOrder] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [addingToInventory, setAddingToInventory] = useState(false);

  useEffect(() => {
    const distributorId = auth.currentUser?.uid;
    if (!distributorId) return;

    setLoading(true);

    // Fetch connected product owners
    const productOwnersRef = collection(
      db,
      `businesses/${distributorId}/connectedProductOwners`
    );
    const unsubscribeProductOwners = onSnapshot(
      query(productOwnersRef, orderBy("connectedAt", "desc")),
      async (snapshot) => {
        const ownersList = [];
        
        console.log(`[ProductOwnerConnection] Found ${snapshot.docs.length} product owner connections`);
        
        for (const ownerDoc of snapshot.docs) {
          const ownerData = ownerDoc.data();
          const ownerId = ownerData.productOwnerId || ownerDoc.id;
          
          console.log(`[ProductOwnerConnection] Processing connection: ${ownerId}`, ownerData);

          // Fetch product owner details from businesses collection
          try {
            const ownerBusinessRef = doc(db, "businesses", ownerId);
            const ownerBusinessSnap = await getDoc(ownerBusinessRef);
            if (ownerBusinessSnap.exists()) {
              const businessData = ownerBusinessSnap.data();
              console.log(`[ProductOwnerConnection] Fetched business data for ${ownerId}:`, businessData);
              ownersList.push({
                id: ownerDoc.id,
                productOwnerId: ownerId,
                ...businessData,
                ...ownerData,
                connectionStatus: ownerData.status || "connected",
                connectedAt: ownerData.connectedAt,
              });
            } else {
              console.warn(`[ProductOwnerConnection] Business document not found for ${ownerId}, using connection data only`);
              ownersList.push({
                id: ownerDoc.id,
                productOwnerId: ownerId,
                ...ownerData,
                connectionStatus: ownerData.status || "connected",
              });
            }
          } catch (err) {
            console.error(`[ProductOwnerConnection] Error fetching product owner details for ${ownerId}:`, err);
            // Still add the connection even if we can't fetch business details
            ownersList.push({
              id: ownerDoc.id,
              productOwnerId: ownerId,
              ...ownerData,
              connectionStatus: ownerData.status || "connected",
            });
          }
        }
        
        console.log(`[ProductOwnerConnection] Final owners list:`, ownersList);
        setProductOwners(ownersList);
        setLoading(false);
      },
      (err) => {
        console.error("[ProductOwnerConnection] Error fetching product owners:", err);
        console.error("[ProductOwnerConnection] Error code:", err.code);
        console.error("[ProductOwnerConnection] Error message:", err.message);
        toast.error("Failed to load product owners. Please check console for details.");
        setLoading(false);
      }
    );

    // Fetch assigned orders from product owners (new Product Owner -> Distributor flow)
    const productOwnerOrdersRef = collection(
      db,
      `businesses/${distributorId}/productOwnerOrders`
    );
    const unsubscribeOrders = onSnapshot(
      query(productOwnerOrdersRef, orderBy("createdAt", "desc")),
      (snapshot) => {
        setOrders(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      },
      (err) => {
        console.error("Error fetching product owner orders:", err);
      }
    );

    // Fetch order requests sent to product owners (Distributor -> Product Owner flow)
    const sentOrdersRef = collection(
      db,
      `businesses/${distributorId}/sentOrdersToProductOwners`
    );
    const unsubscribeSentOrders = onSnapshot(
      query(sentOrdersRef, orderBy("createdAt", "desc")),
      (snapshot) => {
        setOrderRequests(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      },
      (err) => {
        console.error("Error fetching sent order requests:", err);
      }
    );

    return () => {
      unsubscribeProductOwners();
      unsubscribeOrders();
      unsubscribeSentOrders();
    };
  }, []);

  const filteredProductOwners = productOwners.filter((owner) => {
    const query = searchQuery.toLowerCase();
    return (
      owner.businessName?.toLowerCase().includes(query) ||
      owner.productOwnerName?.toLowerCase().includes(query) ||
      owner.productOwnerEmail?.toLowerCase().includes(query) ||
      owner.productOwnerId?.toLowerCase().includes(query)
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

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
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
          <h2 className="text-2xl font-bold">Product Owner Connections</h2>
          <p className="text-white/70 text-sm mt-1">
            Manage your product owner network and view assigned orders
          </p>
        </div>
        <button
          onClick={async () => {
            const distributorId = auth.currentUser?.uid;
            if (!distributorId) return;
            
            toast.info("Refreshing connections...");
            try {
              // Simply refresh by re-reading our connections and updating with latest product owner data
              const currentConnectionsRef = collection(
                db,
                `businesses/${distributorId}/connectedProductOwners`
              );
              const currentConnectionsSnap = await getDocs(currentConnectionsRef);
              
              if (currentConnectionsSnap.empty) {
                toast.info(`No product owner connections found. Your FLYP ID: ${distributorId}. Share this with product owners to connect.`);
                return;
              }
              
              // Verify and update each existing connection with latest product owner data
              let updatedCount = 0;
              for (const connDoc of currentConnectionsSnap.docs) {
                const connData = connDoc.data();
                const productOwnerId = connData.productOwnerId || connDoc.id;
                
                // Try to fetch latest product owner data
                try {
                  const productOwnerRef = doc(db, "businesses", productOwnerId);
                  const productOwnerSnap = await getDoc(productOwnerRef);
                  
                  if (productOwnerSnap.exists()) {
                    const productOwnerData = productOwnerSnap.data();
                    // Update our connection with latest data
                    await setDoc(
                      doc(db, `businesses/${distributorId}/connectedProductOwners/${productOwnerId}`),
                      {
                        productOwnerId: productOwnerId,
                        productOwnerName: productOwnerData.businessName || connData.productOwnerName || "Product Owner",
                        productOwnerEmail: productOwnerData.email || connData.productOwnerEmail || "",
                        productOwnerPhone: productOwnerData.phone || connData.productOwnerPhone || "",
                        productOwnerAddress: productOwnerData.address || connData.productOwnerAddress || "",
                        productOwnerCity: productOwnerData.city || connData.productOwnerCity || "",
                        productOwnerState: productOwnerData.state || connData.productOwnerState || "",
                        status: "connected",
                        updatedAt: serverTimestamp(),
                      },
                      { merge: true }
                    );
                    updatedCount++;
                  }
                } catch (err) {
                  console.warn(`Error updating product owner ${productOwnerId}:`, err);
                  // Continue with other connections even if one fails
                }
              }
              
              if (updatedCount > 0) {
                toast.success(`Refreshed ${updatedCount} connection(s)!`);
              } else {
                toast.info("All connections are up to date.");
              }
            } catch (err) {
              console.error("Error refreshing connections:", err);
              toast.error("Failed to refresh connections: " + (err.message || "Unknown error"));
            }
          }}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm font-medium transition flex items-center gap-2"
        >
          🔄 Refresh Connections
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "connected", label: "Connected Product Owners", icon: <FaBuilding /> },
          { id: "orders", label: "Assigned Orders", icon: <FaBox /> },
          { id: "sentRequests", label: "Sent Order Requests", icon: <FaBox /> },
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

      {/* Connected Product Owners Tab */}
      {activeTab === "connected" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <FaIdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search product owners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>

          {/* Product Owners Grid */}
          {loading ? (
            <div className="text-center py-12 text-white/50">Loading product owners...</div>
          ) : filteredProductOwners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProductOwners.map((owner) => (
                <motion.div
                  key={owner.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {owner.businessName || owner.productOwnerName || "Unnamed"}
                      </h3>
                      <p className="text-sm text-white/70">
                        {owner.ownerName || owner.productOwnerName}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(
                        owner.connectionStatus
                      )}`}
                    >
                      {owner.connectionStatus}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-white/70 mb-4">
                    {owner.productOwnerEmail && (
                      <p>
                        <span className="text-white/50">Email:</span> {owner.productOwnerEmail}
                      </p>
                    )}
                    {owner.connectedAt && (
                      <p>
                        <span className="text-white/50">Connected:</span> {formatDate(owner.connectedAt)}
                      </p>
                    )}
                    <p className="text-xs text-emerald-400 font-mono">
                      <span className="text-white/50">FLYP ID:</span> {owner.productOwnerId || owner.id}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setSelectedProductOwner(owner);
                        setShowOrderRequestForm(true);
                      }}
                      className="w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium transition"
                    >
                      Send Order Request
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedProductOwner(owner);
                          setActiveTab("orders");
                        }}
                        className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm transition"
                      >
                        View Orders
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProductOwner(owner);
                          setShowOrderDetails(true);
                        }}
                        className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm transition"
                      >
                        <FaEye />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No product owners found. Product owners can connect with you using your FLYP ID.
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
          {selectedProductOwner && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-400/20">
              <p className="text-sm text-white/80">
                Showing orders from: <span className="font-semibold">{selectedProductOwner.businessName || selectedProductOwner.productOwnerName}</span>
                <button
                  onClick={() => setSelectedProductOwner(null)}
                  className="ml-2 text-xs text-blue-300 hover:text-blue-200"
                >
                  Clear filter
                </button>
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Order ID</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Product</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Product Owner</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Quantity</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Priority</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Status</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Assigned Date</th>
                  <th className="text-left p-3 text-sm font-semibold text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .filter((order) =>
                    selectedProductOwner
                      ? order.productOwnerId === selectedProductOwner.productOwnerId
                      : true
                  )
                  .length > 0 ? (
                  orders
                    .filter((order) =>
                      selectedProductOwner
                        ? order.productOwnerId === selectedProductOwner.productOwnerId
                        : true
                    )
                    .map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-white/5 hover:bg-white/5 transition"
                      >
                        <td className="p-3 text-sm font-mono">#{order.id.slice(0, 8)}</td>
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
                        <td className="p-3 text-sm">{order.productOwnerName || order.productOwnerName || "N/A"}</td>
                        <td className="p-3 text-sm">
                          {order.items && order.items.length > 0
                            ? order.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)
                            : (order.quantity || 0)}
                        </td>
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
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${getOrderStatusColor(
                              order.status
                            )}`}
                          >
                            {order.status || "assigned"}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-white/70">
                          {order.assignedAt ? formatDate(order.assignedAt) : "N/A"}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowOrderDetails(true);
                              }}
                              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105"
                            >
                              View
                            </button>
                            {/* Add to Inventory button for delivered orders */}
                            {(order.status === 'DELIVERED' || order.status === 'Delivered' || order.statusCode === 'DELIVERED') && !order.inventorySynced && (
                              <button
                                onClick={() => handleAddToInventoryClick(order)}
                                disabled={addingToInventory}
                                className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-medium transition-all hover:scale-105 flex items-center gap-1 disabled:opacity-50"
                                title="Add to Inventory"
                              >
                                <FaPlus className="text-xs" /> Inventory
                              </button>
                            )}
                            {/* Show synced indicator if already added */}
                            {(order.status === 'DELIVERED' || order.status === 'Delivered' || order.statusCode === 'DELIVERED') && order.inventorySynced && (
                              <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium flex items-center gap-1">
                                <FaCheckCircle className="text-xs" /> Added
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-white/50">
                      No orders assigned yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Sent Order Requests Tab */}
      {activeTab === "sentRequests" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Order ID</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Product Owner</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Items</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Total</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Payment</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Status</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Requested</th>
                  <th className="p-3 text-left text-sm font-semibold text-white/70">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderRequests.length > 0 ? (
                  orderRequests.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="p-3 text-sm font-mono">#{order.id.slice(0, 8)}</td>
                      <td className="p-3 text-sm">
                        {order.productOwnerName || "N/A"}
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
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getOrderStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status || "requested"}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-white/70">
                        {order.createdAt ? formatDate(order.createdAt) : "N/A"}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderDetails(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105"
                          >
                            View
                          </button>
                          {/* Add to Inventory button for delivered orders */}
                          {(order.status === 'DELIVERED' || order.status === 'Delivered' || order.statusCode === 'DELIVERED') && !order.inventorySynced && (
                            <button
                              onClick={() => handleAddToInventoryClick(order)}
                              disabled={addingToInventory}
                              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-medium transition-all hover:scale-105 flex items-center gap-1 disabled:opacity-50"
                              title="Add to Inventory"
                            >
                              <FaPlus className="text-xs" /> Inventory
                            </button>
                          )}
                          {/* Show synced indicator if already added */}
                          {(order.status === 'DELIVERED' || order.status === 'Delivered' || order.statusCode === 'DELIVERED') && order.inventorySynced && (
                            <span className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium flex items-center gap-1">
                              <FaCheckCircle className="text-xs" /> Added
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-white/50">
                      No order requests sent yet
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
                  <div>
                    <span className="text-white/50">Items:</span>
                    {order.items && order.items.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {order.items.slice(0, 2).map((it, idx) => (
                          <div key={idx} className="text-sm">
                            {it.productName || 'Unnamed Product'} (×{it.quantity || 1})
                          </div>
                        ))}
                        {order.items.length > 2 && <div className="text-xs text-white/50">+{order.items.length - 2} more...</div>}
                      </div>
                    ) : (
                      <span className="text-white ml-2">No items</span>
                    )}
                  </div>
                  <p>
                    <span className="text-white/50">Product Owner:</span> {order.productOwnerName || 'N/A'}
                  </p>
                  <p>
                    <span className="text-white/50">Total Quantity:</span> {
                      order.items && order.items.length > 0
                        ? order.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)
                        : (order.quantity || 0)
                    }
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <FaClock /> {order.assignedAt ? formatDate(order.assignedAt) : "N/A"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Order Request Form Modal */}
      <AnimatePresence>
        {showOrderRequestForm && selectedProductOwner && (
          <DistributorOrderRequestForm
            productOwner={selectedProductOwner}
            onClose={() => {
              setShowOrderRequestForm(false);
              setSelectedProductOwner(null);
            }}
            onSuccess={() => {
              setShowOrderRequestForm(false);
              setSelectedProductOwner(null);
              setActiveTab("sentRequests");
            }}
          />
        )}
      </AnimatePresence>

      {/* Order Detail Modal - View Only for Distributors */}
      <AnimatePresence>
        {showOrderDetails && selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => {
              setShowOrderDetails(false);
              setSelectedOrder(null);
            }}
            readOnly={true}
            isDistributorOrderRequest={activeTab === "sentRequests"}
            onUpdate={() => {
              // Refresh orders when status is updated
              // The useEffect hooks will automatically refresh the data
            }}
          />
        )}
      </AnimatePresence>

      {/* Add to Inventory Modal */}
      <AnimatePresence>
        {showInventoryModal && inventoryOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => !addingToInventory && setShowInventoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-2xl font-bold text-white">Add Items to Inventory</h2>
                  <p className="text-white/60 text-sm mt-1">Order ID: #{inventoryOrder.id?.slice(0, 8)}</p>
                  <p className="text-white/60 text-sm">Review and edit items before adding to inventory</p>
                </div>
                <button
                  onClick={() => setShowInventoryModal(false)}
                  disabled={addingToInventory}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all disabled:opacity-50"
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {inventoryItems.map((item, index) => {
                  const isExisting = item.existingProduct;
                  const currentQty = isExisting ? item.existingProduct.quantity : 0;
                  const newQty = Number(item.finalQuantity || item.quantity || 0);
                  const totalQty = item.action === 'update' ? currentQty + newQty : newQty;

                  return (
                    <div
                      key={index}
                      className={`bg-white/5 border rounded-xl p-5 ${
                        isExisting && item.action === 'update'
                          ? 'border-emerald-400/30 bg-emerald-500/5'
                          : 'border-white/10'
                      }`}
                    >
                      {/* Item Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {item.productName}
                          </h3>
                          {isExisting && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded border border-emerald-400/30">
                                Exists in Inventory
                              </span>
                              <span className="text-white/50 text-xs">
                                Current Qty: {currentQty} {item.unit}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {isExisting && (
                            <button
                              onClick={() => handleInventoryItemChange(index, 'action', item.action === 'update' ? 'new' : 'update')}
                              disabled={addingToInventory}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                item.action === 'update'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                              } disabled:opacity-50`}
                            >
                              {item.action === 'update' ? 'Update Existing' : 'Add as New'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Fields Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Quantity {item.action === 'update' && `(Will add to ${currentQty})`}</label>
                          <input
                            type="number"
                            value={item.finalQuantity || item.quantity || 0}
                            onChange={(e) => handleInventoryItemChange(index, 'finalQuantity', e.target.value)}
                            disabled={addingToInventory}
                            min="0"
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                          />
                          {item.action === 'update' && (
                            <p className="text-xs text-emerald-400 mt-1">Total: {totalQty} {item.unit}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs text-white/50 mb-1">Cost Price (₹)</label>
                          <input
                            type="number"
                            value={item.finalCostPrice || item.costPrice || 0}
                            onChange={(e) => handleInventoryItemChange(index, 'finalCostPrice', e.target.value)}
                            disabled={addingToInventory}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-white/50 mb-1">Selling Price (₹)</label>
                          <input
                            type="number"
                            value={item.finalSellingPrice || item.sellingPrice || 0}
                            onChange={(e) => handleInventoryItemChange(index, 'finalSellingPrice', e.target.value)}
                            disabled={addingToInventory}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-white/50 mb-1">SKU</label>
                          <input
                            type="text"
                            value={item.finalSku || item.sku || ''}
                            onChange={(e) => handleInventoryItemChange(index, 'finalSku', e.target.value)}
                            disabled={addingToInventory || item.action === 'update'}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            placeholder="Auto-generated"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-white/50 mb-1">Brand</label>
                          <input
                            type="text"
                            value={item.finalBrand || item.brand || ''}
                            onChange={(e) => handleInventoryItemChange(index, 'finalBrand', e.target.value)}
                            disabled={addingToInventory}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-white/50 mb-1">Category</label>
                          <input
                            type="text"
                            value={item.finalCategory || item.category || ''}
                            onChange={(e) => handleInventoryItemChange(index, 'finalCategory', e.target.value)}
                            disabled={addingToInventory}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-white/50 mb-1">Unit</label>
                          <input
                            type="text"
                            value={item.finalUnit || item.unit || ''}
                            onChange={(e) => handleInventoryItemChange(index, 'finalUnit', e.target.value)}
                            disabled={addingToInventory}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gradient-to-r from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-xl border-t border-white/10 p-6 flex items-center justify-between">
                <button
                  onClick={() => setShowInventoryModal(false)}
                  disabled={addingToInventory}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToInventory}
                  disabled={addingToInventory || !inventoryItems || inventoryItems.length === 0}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition flex items-center gap-2"
                >
                  <FaPlus /> {addingToInventory ? 'Adding...' : 'Add to Inventory'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>
    </motion.div>
  );
};

export default ProductOwnerConnection;

