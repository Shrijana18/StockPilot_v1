import React, { useState, useEffect, useContext } from 'react';
import Billing from "../pages/Billing";
import ProfileSettings from "../components/profile/ProfileSettings";
import RetailerOrderHistory from "../components/retailer/orders/RetailerOrderHistory";
import CustomerAnalysis from "../components/customeranalytics/CustomerAnalysis";
import ManualEntryForm from "../components/inventory/ManualEntryForm";
import OCRUploadForm from "../components/inventory/OCRUploadForm";
import AddInventoryAI from "../components/inventory/AddInventoryAI";
import ViewInventory from "../components/inventory/ViewInventory";
import BarChartRevenue from "../components/charts/BarChartRevenue";
import PieChartTopProducts from "../components/charts/PieChartTopProducts";
import LineChartSales from "../components/charts/LineChartSales";
import HomeSnapshot from "../components/dashboard/HomeSnapshot";
import BusinessAnalytics from "../components/dashboard/businessAnalytics/BusinessAnalytics";
import Distributor from "../components/distributor/Distributor";
import RetailerConnectedDistributors from "../components/retailer/RetailerConnectedDistributors";
import ManageEmployee from "../components/employee/ManageEmployee";
import ConnectedDistributorPanel from "../components/distributor/ConnectedDistributorPanel";
import SearchDistributor from "../components/distributor/SearchDistributor";
import ViewSentRequests from "../components/distributor/ViewSentRequests";
import DistributorPanel from "../components/retailer/DistributorPanel";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { FaUser, FaSignOutAlt, FaHome, FaBoxes, FaFileInvoice, FaChartLine, FaUsers, FaUserPlus, FaBuilding } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const RetailerDashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [userData, setUserData] = useState(null);
  const [inventoryTab, setInventoryTab] = useState('add');
  const [addMethod, setAddMethod] = useState('manual');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filterDates, setFilterDates] = useState({ start: null, end: null });
  const [distributorTab, setDistributorTab] = useState('search');

  useEffect(() => {
    const now = new Date();
    if (selectedFilter === 'month') {
      setFilterDates({
        start: startOfMonth(now),
        end: endOfMonth(now)
      });
    } else if (selectedFilter === 'week') {
      setFilterDates({
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      });
    } else {
      setFilterDates({ start: null, end: null });
    }
  }, [selectedFilter]);

  const navigate = useNavigate();
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userRef = doc(db, "businesses", user.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            setUserData({
              ...docSnap.data(),
              userId: user.uid,
              flypId: docSnap.data().flypId || user.uid
            });
          }
        } else {
          console.warn("User not authenticated yet.");
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    });
    return () => unsubscribe();
  }, []);


  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        navigate("/auth?type=login");
      })
      .catch((error) => {
        console.error("Sign out error:", error);
      });
  };

  const sidebarItems = [
    { id: 'home', label: 'Home', icon: <FaHome /> },
    { id: 'billing', label: 'Billing', icon: <FaFileInvoice /> },
    { id: 'inventory', label: 'Inventory', icon: <FaBoxes /> },
    { id: 'analytics', label: 'Business Analytics', icon: <FaChartLine /> },
    { id: 'distributors', label: 'Distributor Connection', icon: <FaBuilding /> },
    { id: 'orderHistory', label: 'Order History', icon: <FaFileInvoice /> },
    { id: 'customers', label: 'Customer Analysis', icon: <FaUsers /> },
    { id: 'employees', label: 'Manage Employee', icon: <FaUserPlus /> },
    { id: 'profile', label: 'Profile Settings', icon: <FaUser /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md border-r border-gray-200">
        <div className="p-5 text-xl font-bold border-b border-gray-200">
          FLYP
        </div>
        <nav className="flex flex-col p-4 gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-left ${
                activeTab === item.id
                  ? 'bg-blue-100 text-blue-600 font-semibold'
                  : 'hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="flex justify-between items-center bg-white px-6 py-4 border-b border-gray-200 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold">Retailer Dashboard</h2>
            <p className="text-sm text-gray-500">Logged in as: Retailer</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{userData?.businessName || 'Business Name'}</p>
              <p className="text-sm text-gray-500">
                {userData?.ownerName || 'Owner'} | ID: {userData?.flypId || userData?.userId || 'UserID'}
              </p>
            </div>
            <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
              {userData?.logoUrl ? (
                <img src={userData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-300" />
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="text-red-500 hover:text-red-700 text-xl"
              title="Sign Out"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex-1 p-6 overflow-y-auto"
        >
          {activeTab === 'home' && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <label htmlFor="filter" className="font-medium">Filter by:</label>
                <select
                  id="filter"
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="border px-3 py-1 rounded"
                >
                  <option value="today">Today</option>
                  <option value="all">All Time</option>
                  <option value="month">This Month</option>
                  <option value="week">This Week</option>
                  <option value="custom">Custom Range</option>
                </select>

                {(selectedFilter === 'custom') && (
                  <>
                    <input
                      type="date"
                      onChange={(e) =>
                        setFilterDates((prev) => ({ ...prev, start: new Date(e.target.value) }))
                      }
                      className="border px-2 py-1 rounded"
                    />
                    <input
                      type="date"
                      onChange={(e) =>
                        setFilterDates((prev) => ({ ...prev, end: new Date(e.target.value) }))
                      }
                      className="border px-2 py-1 rounded"
                    />
                  </>
                )}
              </div>
              <HomeSnapshot filterDates={filterDates} />
            </div>
          )}
          {activeTab === 'billing' && <Billing />}
          {activeTab === 'orderHistory' && <RetailerOrderHistory />}
          {activeTab === 'inventory' && (
    <div>
      <div className="flex gap-4 mb-6 border-b pb-2">
        <button
          onClick={() => setInventoryTab('add')}
          className={`px-4 py-2 rounded ${
            inventoryTab === 'add' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          ➕ Add Inventory
        </button>
        <button
          onClick={() => setInventoryTab('view')}
          className={`px-4 py-2 rounded ${
            inventoryTab === 'view' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          📋 View Inventory
        </button>
        <button
          onClick={() => setInventoryTab('group')}
          className={`px-4 py-2 rounded ${
            inventoryTab === 'group' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          🧩 Group Items
        </button>
        <button
          onClick={() => setInventoryTab('lowstock')}
          className={`px-4 py-2 rounded ${
            inventoryTab === 'lowstock' ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          🚨 Low Stock Alerts
        </button>
      </div>

      {inventoryTab === 'add' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Select Inventory Input Method</h3>
          <div className="flex gap-4">
            <button
              onClick={() => setAddMethod('manual')}
              className={`px-3 py-2 border rounded ${
                addMethod === 'manual' ? 'bg-green-100 border-green-500' : ''
              }`}
            >
              📝 Manual Entry
            </button>
            <button
              onClick={() => setAddMethod('ocr')}
              className={`px-3 py-2 border rounded ${
                addMethod === 'ocr' ? 'bg-green-100 border-green-500' : ''
              }`}
            >
              🖼️ OCR Upload
            </button>
            <button
              onClick={() => setAddMethod('ai')}
              className={`px-3 py-2 border rounded ${
                addMethod === 'ai' ? 'bg-green-100 border-green-500' : ''
              }`}
            >
              🤖 AI-Based
            </button>
          </div>
          <div className="mt-4">
            {addMethod === 'manual' && userData?.userId && (
              <ManualEntryForm userId={userData.userId} />
            )}
            {addMethod === 'ocr' && userData?.userId && (
              <OCRUploadForm userId={userData.userId} />
            )}
            {addMethod === 'ai' && userData?.userId && (
              <AddInventoryAI userId={userData.userId} />
            )}
          </div>
        </div>
      )}
      {inventoryTab === 'view' && userData?.userId && (
        <ViewInventory userId={userData.userId} />
      )}
      {inventoryTab === 'group' && <div>🧩 Group Items Component Placeholder</div>}
      {inventoryTab === 'lowstock' && <div>🚨 Low Stock Alert Component Placeholder</div>}
    </div>
  )}
          {activeTab === 'analytics' && <BusinessAnalytics />}
          {activeTab === 'distributors' && (
            <div>
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setDistributorTab('search')}
                  className={`px-4 py-2 rounded ${
                    distributorTab === 'search' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                  }`}
                >
                  🔍 Search Distributor
                </button>
                <button
                  onClick={() => setDistributorTab('sent')}
                  className={`px-4 py-2 rounded ${
                    distributorTab === 'sent' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                  }`}
                >
                  📤 Sent Requests
                </button>
                <button
                  onClick={() => setDistributorTab('connected')}
                  className={`px-4 py-2 rounded ${
                    distributorTab === 'connected' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                  }`}
                >
                  🤝 View Distributors
                </button>
              </div>

              {distributorTab === 'search' && <SearchDistributor />}
              {distributorTab === 'sent' && <ViewSentRequests />}
              {distributorTab === 'connected' && (
                selectedDistributor ? (
                  <ConnectedDistributorPanel
                    distributor={selectedDistributor}
                    onBack={() => setSelectedDistributor(null)}
                  />
                ) : (
                  <RetailerConnectedDistributors onSelectDistributor={setSelectedDistributor} />
                )
              )}
            </div>
          )}
          {activeTab === 'customers' && <CustomerAnalysis />}
          {activeTab === 'employees' && <ManageEmployee />}
          {activeTab === 'profile' && <ProfileSettings />}
        </motion.div>
      </div>
    </div>
  );
};

export default RetailerDashboard;