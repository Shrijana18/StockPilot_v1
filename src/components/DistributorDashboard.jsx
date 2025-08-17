import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

import RetailerRequests from "./distributor/RetailerRequests";
import DistributorInventory from "./distributor/DistributorInventory.jsx";
import DispatchTracker from "./distributor/DispatchTracker";
import DistributorAnalytics from "./distributor/analytics/DistributorAnalytics";
import ManageRetailers from "./distributor/ManageRetailers";
import DistributorHome from "./distributor/DistributorHome";

const DistributorDashboard = () => {
  const navigate = useNavigate();

  const [retailerRequestsCount, setRetailerRequestsCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [shipmentsCount, setShipmentsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");

  // --- Deep link support: sync sidebar with ?tab= in the hash ---
  const idToUrlTab = {
    dashboard: 'dashboard',
    retailerRequests: 'retailer-requests',
    inventory: 'inventory',
    dispatch: 'track-orders', // important: our DispatchTracker page is track-orders in URL
    analytics: 'analytics',
    manageRetailers: 'manage-retailers',
  };
  const urlTabToId = {
    'dashboard': 'dashboard',
    'retailer-requests': 'retailerRequests',
    'inventory': 'inventory',
    'track-orders': 'dispatch',
    'analytics': 'analytics',
    'manage-retailers': 'manageRetailers',
  };

  // Read ?tab= from the URL hash on mount and whenever the hash changes
  useEffect(() => {
    const applyFromHash = () => {
      const hash = window.location.hash || '';
      const qIndex = hash.indexOf('?');
      if (qIndex === -1) return;
      const params = new URLSearchParams(hash.substring(qIndex + 1));
      const tab = (params.get('tab') || '').toLowerCase();
      if (urlTabToId[tab]) {
        setActiveTab(urlTabToId[tab]);
      }
    };
    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  // When clicking sidebar buttons, update state and write ?tab= into the hash
  const setTabAndHash = (id) => {
    setActiveTab(id);
    try {
      const hash = window.location.hash || '#/distributor-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      const urlTab = idToUrlTab[id] || 'dashboard';
      params.set('tab', urlTab);
      // If leaving Dispatch (track-orders), drop any `sub` param to avoid stale sub-tabs
      if (urlTab !== 'track-orders') params.delete('sub');
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) window.history.replaceState(null, '', newHash);
    } catch {}
  };

  const [userData, setUserData] = useState(null);
  const db = getFirestore();

  useEffect(() => {
    const fetchDashboardData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const businessDocRef = doc(db, "businesses", user.uid);
      const businessDocSnap = await getDoc(businessDocRef);
      if (businessDocSnap.exists()) {
        setUserData(businessDocSnap.data());
      }

      const businessRef = collection(db, "businesses", user.uid, "retailerRequests");
      const inventoryRef = collection(db, "businesses", user.uid, "products");
      const shipmentsRef = collection(db, "businesses", user.uid, "dispatches");

      const [reqSnap, invSnap, shipSnap] = await Promise.all([
        getDocs(businessRef),
        getDocs(inventoryRef),
        getDocs(shipmentsRef),
      ]);

      setRetailerRequestsCount(reqSnap.size);
      setInventoryCount(invSnap.size);
      setShipmentsCount(shipSnap.size);
    };

    fetchDashboardData();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white shadow-lg p-5 flex flex-col justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-wide text-white mb-6">FLYP</h2>
          <nav className="space-y-4 mt-20">
            <button
              onClick={() => setTabAndHash("dashboard")}
              className={`w-full text-left px-3 py-2 rounded font-medium transition duration-200 ${
                activeTab === "dashboard"
                  ? "bg-white text-blue-900 shadow ring-2 ring-blue-400"
                  : "text-white hover:bg-blue-800 hover:shadow"
              }`}
            >
              🏠 Dashboard
            </button>
            <button
              onClick={() => setTabAndHash("retailerRequests")}
              className={`w-full text-left px-3 py-2 rounded font-medium transition duration-200 ${
                activeTab === "retailerRequests"
                  ? "bg-white text-blue-900 shadow ring-2 ring-blue-400"
                  : "text-white hover:bg-blue-800 hover:shadow"
              }`}
            >
              📥 Retailer Requests
            </button>
            <button
              onClick={() => setTabAndHash("inventory")}
              className={`w-full text-left px-3 py-2 rounded font-medium transition duration-200 ${
                activeTab === "inventory"
                  ? "bg-white text-blue-900 shadow ring-2 ring-blue-400"
                  : "text-white hover:bg-blue-800 hover:shadow"
              }`}
            >
              📦 Inventory
            </button>
            <button
              onClick={() => setTabAndHash("dispatch")}
              className={`w-full text-left px-3 py-2 rounded font-medium transition duration-200 ${
                activeTab === "dispatch"
                  ? "bg-white text-blue-900 shadow ring-2 ring-blue-400"
                  : "text-white hover:bg-blue-800 hover:shadow"
              }`}
            >
              🚚 Dispatch Tracker
            </button>
            <button
              onClick={() => setTabAndHash("analytics")}
              className={`w-full text-left px-3 py-2 rounded font-medium transition duration-200 ${
                activeTab === "analytics"
                  ? "bg-white text-blue-900 shadow ring-2 ring-blue-400"
                  : "text-white hover:bg-blue-800 hover:shadow"
              }`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setTabAndHash("manageRetailers")}
              className={`w-full text-left px-3 py-2 rounded font-medium transition duration-200 ${
                activeTab === "manageRetailers"
                  ? "bg-white text-blue-900 shadow ring-2 ring-blue-400"
                  : "text-white hover:bg-blue-800 hover:shadow"
              }`}
            >
              👥 Manage Retailers
            </button>
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-red-600 hover:bg-red-700 py-2 rounded text-sm mt-6"
        >
          Sign Out
        </button>
      </aside>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col">
        <header className="sticky top-0 z-10 bg-white px-6 py-3 shadow flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Distributor Dashboard</h1>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-700">{userData?.businessName || "Distributor"}</p>
            <p className="text-sm text-gray-500">{auth.currentUser?.email}</p>
            <p className="text-xs text-gray-400">ID: {auth.currentUser?.uid}</p>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 relative">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DistributorHome />
              </motion.div>
            )}
            {activeTab === "retailerRequests" && (
              <motion.div
                key="retailerRequests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <RetailerRequests db={db} auth={auth} />
              </motion.div>
            )}
            {activeTab === "inventory" && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DistributorInventory db={db} auth={auth} />
              </motion.div>
            )}
            {activeTab === "dispatch" && (
              <motion.div
                key="dispatch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DispatchTracker db={db} auth={auth} />
              </motion.div>
            )}
            {activeTab === "analytics" && auth?.currentUser && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DistributorAnalytics distributorId={auth.currentUser.uid} />
              </motion.div>
            )}
            {activeTab === "manageRetailers" && (
              <motion.div
                key="manageRetailers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ManageRetailers db={db} auth={auth} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default DistributorDashboard;