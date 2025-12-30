import React, { useEffect, useState, useMemo } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import ProductOwnerAssignOrderToRetailerForm from "./ProductOwnerAssignOrderToRetailerForm";
import { fetchStates, fetchDistricts } from "../../services/indiaLocationAPI";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
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
  FaMapMarkerAlt,
  FaIdCard,
  FaLink,
  FaSave,
  FaFileAlt,
  FaBuilding,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapPin,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaShoppingCart,
  FaList,
} from "react-icons/fa";
import AddRetailerModal from "../distributor/AddRetailerModal";

const RetailerConnection = () => {
  const [activeTab, setActiveTab] = useState("connected"); // Main tabs: connected, orders
  const [retailers, setRetailers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignOrderModal, setShowAssignOrderModal] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  // Fetch product owner user data
  useEffect(() => {
    const fetchUserData = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;
      
      try {
        const userDocRef = doc(db, "businesses", productOwnerId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data());
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchUserData();
  }, []);

  // Fetch retailers
  const fetchRetailers = async () => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    setLoading(true);
    try {
      // Fetch connected retailers
      const retailersRef = collection(
        db,
        `businesses/${productOwnerId}/connectedRetailers`
      );
      const retailersSnap = await getDocs(retailersRef);
      const retailersList = [];

      // Parallel fetch all retailer business docs
      const retailerPromises = retailersSnap.docs.map(async (retailerDoc) => {
        const retailerData = retailerDoc.data();
        const retailerId = retailerData.retailerId || retailerDoc.id;

        // Fetch retailer details from businesses collection
        try {
          const retailerBusinessRef = doc(db, "businesses", retailerId);
          const retailerBusinessSnap = await getDoc(retailerBusinessRef);
          if (retailerBusinessSnap.exists()) {
            return {
              id: retailerDoc.id,
              retailerId,
              ...retailerBusinessSnap.data(),
              ...retailerData,
              connectionStatus: retailerData.status || "connected",
              connectedAt: retailerData.connectedAt,
            };
          } else {
            return {
              id: retailerDoc.id,
              retailerId,
              ...retailerData,
              connectionStatus: retailerData.status || "connected",
            };
          }
        } catch (err) {
          console.error("Error fetching retailer details:", err);
          return {
            id: retailerDoc.id,
            retailerId,
            ...retailerData,
          };
        }
      });

      retailersList.push(...(await Promise.all(retailerPromises)));
      setRetailers(retailersList);

      // Fetch assigned orders to retailers
      const assignedOrdersRef = collection(db, `businesses/${productOwnerId}/assignedOrdersToRetailers`);
      const assignedOrdersSnap = await getDocs(assignedOrdersRef);
      const ordersList = assignedOrdersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Sort by most recent first
      ordersList.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0);
        return bTime - aTime;
      });
      setOrders(ordersList);
    } catch (err) {
      console.error("Error fetching retailers:", err);
      toast.error("Failed to refresh retailers list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRetailers();
  }, []);

  // Real-time listener for orders
  useEffect(() => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    const assignedOrdersRef = collection(db, `businesses/${productOwnerId}/assignedOrdersToRetailers`);
    
    const unsubscribe = onSnapshot(
      assignedOrdersRef,
      (snapshot) => {
        const ordersList = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        ordersList.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0);
          return bTime - aTime;
        });
        
        setOrders(ordersList);
      },
      (err) => {
        console.error("Error listening to orders:", err);
        toast.error("Failed to load orders. Please refresh.");
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time sync: Listen for retailer profile updates
  useEffect(() => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId || retailers.length === 0) return;

    const unsubscribes = [];
    const retailerIds = retailers
      .map((r) => r.retailerId || r.id)
      .filter(Boolean);

    retailerIds.forEach((retailerId) => {
      const retailerProfileRef = doc(db, "businesses", retailerId);
      const unsubscribe = onSnapshot(
        retailerProfileRef,
        async (snapshot) => {
          if (!snapshot.exists()) return;

          const retailerData = snapshot.data();
          
          try {
            const connectionRef = doc(
              db,
              `businesses/${productOwnerId}/connectedRetailers/${retailerId}`
            );

            const connectionSnap = await getDoc(connectionRef);
            const currentConnectionData = connectionSnap.exists() ? connectionSnap.data() : {};

            // Build update data, only including fields that have values (no undefined)
            const updateData = {
              profileSyncedAt: serverTimestamp(),
            };
            
            // Only add fields that have actual values
            if (retailerData.businessName || currentConnectionData.retailerName) {
              updateData.retailerName = retailerData.businessName || currentConnectionData.retailerName;
            }
            if (retailerData.email || currentConnectionData.retailerEmail) {
              updateData.retailerEmail = retailerData.email || currentConnectionData.retailerEmail;
            }
            if (retailerData.phone || currentConnectionData.retailerPhone) {
              updateData.retailerPhone = retailerData.phone || currentConnectionData.retailerPhone;
            }
            if (retailerData.address || currentConnectionData.retailerAddress) {
              updateData.retailerAddress = retailerData.address || currentConnectionData.retailerAddress;
            }
            if (retailerData.city || currentConnectionData.retailerCity) {
              updateData.retailerCity = retailerData.city || currentConnectionData.retailerCity;
            }
            if (retailerData.state || currentConnectionData.retailerState) {
              updateData.retailerState = retailerData.state || currentConnectionData.retailerState;
            }

            const needsUpdate = 
              updateData.retailerName !== currentConnectionData.retailerName ||
              updateData.retailerEmail !== currentConnectionData.retailerEmail ||
              updateData.retailerPhone !== currentConnectionData.retailerPhone ||
              updateData.retailerAddress !== currentConnectionData.retailerAddress ||
              updateData.retailerCity !== currentConnectionData.retailerCity ||
              updateData.retailerState !== currentConnectionData.retailerState;

            if (needsUpdate) {
              await updateDoc(connectionRef, updateData);
              await fetchRetailers();
            }
          } catch (err) {
            console.error(`Error syncing retailer ${retailerId} profile:`, err);
          }
        },
        (err) => {
          console.error(`Error listening to retailer ${retailerId} profile:`, err);
        }
      );

      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [retailers.map((r) => r.retailerId || r.id).filter(Boolean).join(",")]);

  // Filter retailers based on search
  const filteredRetailers = useMemo(() => {
    if (!searchQuery.trim()) return retailers;
    const query = searchQuery.toLowerCase();
    return retailers.filter(
      (retailer) =>
        (retailer.businessName || retailer.retailerName || "").toLowerCase().includes(query) ||
        (retailer.ownerName || "").toLowerCase().includes(query) ||
        (retailer.email || retailer.retailerEmail || "").toLowerCase().includes(query) ||
        (retailer.phone || retailer.retailerPhone || "").toLowerCase().includes(query) ||
        (retailer.city || retailer.retailerCity || "").toLowerCase().includes(query) ||
        (retailer.state || retailer.retailerState || "").toLowerCase().includes(query)
    );
  }, [retailers, searchQuery]);

  // Filter orders based on search
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter(
      (order) =>
        (order.orderId || order.id || "").toLowerCase().includes(query) ||
        (order.retailerName || "").toLowerCase().includes(query) ||
        (order.retailerEmail || "").toLowerCase().includes(query) ||
        (order.status || "").toLowerCase().includes(query)
    );
  }, [orders, searchQuery]);

  const handleCreateRetailer = async (result) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      // The AddRetailerModal creates the retailer in connectedRetailers
      // The result contains retailerId from the connection document
      if (result?.retailerId) {
        // Update the connection to mark it as product owner created
        const connectionRef = doc(db, `businesses/${productOwnerId}/connectedRetailers/${result.retailerId}`);
        const updateData = {
          createdBy: 'productowner',
          productOwnerId: productOwnerId,
          updatedAt: serverTimestamp(),
        };
        await setDoc(connectionRef, updateData, { merge: true });
      } else if (result?.payload) {
        // If retailerId is not in result, it might be in the payload
        // The connection was already created by AddRetailerModal
        console.log("Retailer created with payload:", result.payload);
      }
      
      // Refresh the list
      await fetchRetailers();
      toast.success("Retailer created successfully!");
    } catch (err) {
      console.error("Error creating retailer:", err);
      const errorMessage = err.message || "Failed to create retailer";
      toast.error(errorMessage);
    }
  };

  const handleAssignOrder = (retailer) => {
    setSelectedRetailer(retailer);
    setShowAssignOrderModal(true);
  };

  const handleOrderAssigned = () => {
    fetchRetailers();
    setShowAssignOrderModal(false);
    setSelectedRetailer(null);
  };

  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    if (statusLower.includes("assigned") || statusLower.includes("pending")) return "text-yellow-400 bg-yellow-400/20 border-yellow-400/30";
    if (statusLower.includes("accepted") || statusLower.includes("processing")) return "text-blue-400 bg-blue-400/20 border-blue-400/30";
    if (statusLower.includes("dispatched") || statusLower.includes("shipped")) return "text-purple-400 bg-purple-400/20 border-purple-400/30";
    if (statusLower.includes("delivered") || statusLower.includes("completed")) return "text-emerald-400 bg-emerald-400/20 border-emerald-400/30";
    if (statusLower.includes("cancelled") || statusLower.includes("rejected")) return "text-red-400 bg-red-400/20 border-red-400/30";
    return "text-white/60 bg-white/5 border-white/10";
  };

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-cyan-300">
            Retailer Management
          </h2>
          <p className="text-white/60 mt-1">Manage retailers and assign orders directly</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
          >
            <FaUserPlus /> Add Retailer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab("connected")}
          className={`px-6 py-3 font-medium transition-all relative ${
            activeTab === "connected"
              ? "text-emerald-300 border-b-2 border-emerald-400"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          <FaBuilding className="inline mr-2" />
          Connected Retailers ({retailers.length})
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-6 py-3 font-medium transition-all relative ${
            activeTab === "orders"
              ? "text-emerald-300 border-b-2 border-emerald-400"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          <FaShoppingCart className="inline mr-2" />
          Orders ({orders.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
        <input
          type="text"
          placeholder={`Search ${activeTab === "connected" ? "retailers" : "orders"}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="text-4xl text-emerald-400 animate-spin" />
        </div>
      ) : activeTab === "connected" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRetailers.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <FaBuilding className="text-6xl text-white/20 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No retailers found</p>
              <p className="text-white/40 text-sm mt-2">
                {searchQuery ? "Try a different search term" : "Create your first retailer to get started"}
              </p>
            </div>
          ) : (
            filteredRetailers.map((retailer) => (
              <motion.div
                key={retailer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-emerald-400/30 transition-all duration-300 shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {retailer.businessName || retailer.retailerName || "Unnamed Retailer"}
                    </h3>
                    {retailer.ownerName && (
                      <p className="text-sm text-white/60">{retailer.ownerName}</p>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    retailer.connectionStatus === "connected" || retailer.connectionStatus === "active"
                      ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-yellow-400/20 text-yellow-300 border border-yellow-400/30"
                  }`}>
                    {retailer.connectionStatus || "connected"}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {retailer.retailerEmail && (
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <FaEnvelope className="text-xs" />
                      <span className="truncate">{retailer.retailerEmail}</span>
                    </div>
                  )}
                  {retailer.retailerPhone && (
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <FaPhone className="text-xs" />
                      <span>{retailer.retailerPhone}</span>
                    </div>
                  )}
                  {(retailer.retailerCity || retailer.retailerState) && (
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <FaMapPin className="text-xs" />
                      <span>
                        {[retailer.retailerCity, retailer.retailerState].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleAssignOrder(retailer)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105"
                  >
                    <FaShoppingCart className="inline mr-2" />
                    Assign Order
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-20">
              <FaShoppingCart className="text-6xl text-white/20 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No orders found</p>
              <p className="text-white/40 text-sm mt-2">
                {searchQuery ? "Try a different search term" : "Assign your first order to a retailer"}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-emerald-400/30 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        Order #{order.orderId || order.id?.slice(0, 8) || "N/A"}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {order.status || "ASSIGNED"}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 mb-1">
                      <FaBuilding className="inline mr-2" />
                      {order.retailerName || "Unknown Retailer"}
                    </p>
                    {order.retailerEmail && (
                      <p className="text-xs text-white/50">
                        <FaEnvelope className="inline mr-2" />
                        {order.retailerEmail}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-300">
                      {formatINR(order.grandTotal || order.itemsSubTotal || 0)}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-xs text-white/60 mb-2 font-medium">Order Items:</p>
                    <div className="space-y-1">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-white/80">
                            {item.productName} × {item.quantity}
                          </span>
                          <span className="text-white/60">
                            {formatINR(item.subtotal || item.quantity * item.unitPrice)}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-xs text-white/50 mt-1">
                          +{order.items.length - 3} more item{(order.items.length - 3) !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="text-xs text-white/50">
                    {order.createdAt?.toDate ? (
                      <>
                        <FaClock className="inline mr-1" />
                        {order.createdAt.toDate().toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    ) : (
                      "Date not available"
                    )}
                  </div>
                  <div className="text-xs text-white/60">
                    Payment: {order.paymentModeLabel || order.paymentMode || "N/A"}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Create Retailer Modal */}
      <AddRetailerModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        distributorId={auth.currentUser?.uid}
        createdBy={{
          type: "productowner",
          id: auth.currentUser?.uid,
          name: userData?.businessName || userData?.ownerName || "Product Owner",
        }}
        onCreated={handleCreateRetailer}
        toast={({ type, message }) => {
          if (type === "success") toast.success(message);
          else if (type === "error") toast.error(message);
          else toast.info(message);
        }}
        uiVariant="centered"
      />

      {/* Assign Order Modal */}
      <AnimatePresence>
        {showAssignOrderModal && selectedRetailer && (
          <ProductOwnerAssignOrderToRetailerForm
            retailer={selectedRetailer}
            onClose={() => {
              setShowAssignOrderModal(false);
              setSelectedRetailer(null);
            }}
            onSuccess={handleOrderAssigned}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetailerConnection;

