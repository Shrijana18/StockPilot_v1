import React, { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

import RetailerRequests from "./distributor/RetailerRequests";
import DistributorInventory from "./distributor/DistributorInventory.jsx";
import DispatchTracker from "./distributor/DispatchTracker";
import DistributorAnalytics from "./distributor/DistributorAnalytics";
import ManageRetailers from "./distributor/ManageRetailers";

const DistributorDashboard = () => {
  const navigate = useNavigate();

  const [retailerRequestsCount, setRetailerRequestsCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [shipmentsCount, setShipmentsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  const db = getFirestore();

  useEffect(() => {
    const fetchDashboardData = async () => {
      const user = auth.currentUser;
      if (!user) return;

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
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white shadow-lg p-5 flex flex-col justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-6">Distributor Panel</h2>
          <nav className="space-y-4">
            <button onClick={() => setActiveTab("dashboard")} className="w-full text-left hover:text-blue-300">Dashboard</button>
            <button onClick={() => setActiveTab("retailerRequests")} className="w-full text-left hover:text-blue-300">Retailer Requests</button>
            <button onClick={() => setActiveTab("inventory")} className="w-full text-left hover:text-blue-300">Inventory</button>
            <button onClick={() => setActiveTab("dispatch")} className="w-full text-left hover:text-blue-300">Dispatch Tracker</button>
            <button onClick={() => setActiveTab("analytics")} className="w-full text-left hover:text-blue-300">Analytics</button>
            <button onClick={() => setActiveTab("manageRetailers")} className="w-full text-left hover:text-blue-300">Manage Retailers</button>
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-red-600 hover:bg-red-700 py-2 rounded text-sm mt-6"
        >
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold">Welcome Distributor!</h1>
          <p className="text-sm text-gray-600">Here's your supply chain control center.</p>
        </header>

        {activeTab === "dashboard" && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded shadow">
                <h3 className="text-lg font-semibold">Pending Retailer Requests</h3>
                <p className="text-2xl text-blue-600 mt-2">{retailerRequestsCount}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <h3 className="text-lg font-semibold">Total Inventory Items</h3>
                <p className="text-2xl text-green-600 mt-2">{inventoryCount}</p>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <h3 className="text-lg font-semibold">Shipments in Progress</h3>
                <p className="text-2xl text-yellow-600 mt-2">{shipmentsCount}</p>
              </div>
            </section>

            <div className="mt-10">
              <h2 className="text-2xl font-semibold mb-4">Live Updates</h2>
              <div className="bg-white p-6 rounded shadow text-gray-700">
                Real-time analytics and updates will appear here.
              </div>
            </div>
          </>
        )}

        {activeTab === "retailerRequests" && <RetailerRequests db={db} auth={auth} />}
        {activeTab === "inventory" && <DistributorInventory db={db} auth={auth} />}
        {activeTab === "dispatch" && <DispatchTracker db={db} auth={auth} />}
        {activeTab === "analytics" && <DistributorAnalytics db={db} auth={auth} />}
        {activeTab === "manageRetailers" && <ManageRetailers db={db} auth={auth} />}
      </main>
    </div>
  );
};

export default DistributorDashboard;