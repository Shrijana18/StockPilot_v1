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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

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
    <div className="flex min-h-screen relative overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white">
      {/* Aurora backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-[60vmax] h-[60vmax] rounded-full blur-3xl bg-gradient-to-tr from-emerald-500/40 via-teal-400/30 to-cyan-400/30" />
        <div className="absolute -bottom-24 -right-24 w-[50vmax] h-[50vmax] rounded-full blur-3xl bg-gradient-to-tr from-cyan-500/30 via-sky-400/20 to-emerald-400/30" />
      </div>
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 md:hidden" onClick={() => setShowMobileSidebar(false)}>
          <div
            className="w-64 h-full p-4 bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">FLYP</div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setShowMobileSidebar(false);
                }}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left transition ${
                  activeTab === item.id
                    ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                    : 'hover:bg-white/10'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="hidden md:block w-64 fixed top-0 bottom-0 left-0 z-40 bg-white/10 backdrop-blur-2xl border-r border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
        <div className="p-5 text-xl font-bold border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent bg-clip-padding">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">FLYP</span>
        </div>
        <nav className="flex flex-col p-4 gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-left transition ${
                activeTab === item.id
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                  : 'hover:bg-white/10'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col ml-64 relative z-10">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 px-6 py-3 flex items-center justify-between bg-white/10 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <button
            className="md:hidden text-2xl text-gray-600"
            onClick={() => setShowMobileSidebar(true)}
          >
            ☰
          </button>
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-white">Retailer Dashboard</h2>
            <p className="text-sm text-white/70">Logged in as: Retailer</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium text-white">{userData?.businessName || 'Business Name'}</p>
              <p className="text-sm text-white/70">
                {userData?.ownerName || 'Owner'} | ID: {userData?.flypId || userData?.userId || 'UserID'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/20 bg-white/10 backdrop-blur">
              {userData?.logoUrl ? (
                <img src={userData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10" />
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="text-rose-300 hover:text-rose-200 text-xl"
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
          className="flex-1 px-4 py-6 md:px-6 overflow-y-auto pt-4 text-white"
        >
          {activeTab === 'home' && (
            <div>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <label htmlFor="filter" className="font-medium">Filter by:</label>
                <select
                  id="filter"
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="px-3 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
                      className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                    <input
                      type="date"
                      onChange={(e) =>
                        setFilterDates((prev) => ({ ...prev, end: new Date(e.target.value) }))
                      }
                      className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </>
                )}
              </div>
              <div className="space-y-4 md:space-y-6">
                <HomeSnapshot filterDates={filterDates} />
              </div>
            </div>
          )}
          {activeTab === 'billing' && <Billing />}
          {activeTab === 'orderHistory' && <RetailerOrderHistory />}
          {activeTab === 'inventory' && (
            <div>
              <div className="flex gap-4 mb-6 border-b pb-2">
                <button
                  onClick={() => setInventoryTab('add')}
                  className={`px-4 py-2 rounded transition ${inventoryTab === 'add' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  ➕ Add Inventory
                </button>
                <button
                  onClick={() => setInventoryTab('view')}
                  className={`px-4 py-2 rounded transition ${inventoryTab === 'view' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  📋 View Inventory
                </button>
                <button
                  onClick={() => setInventoryTab('group')}
                  className={`px-4 py-2 rounded transition ${inventoryTab === 'group' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  🧩 Group Items
                </button>
                <button
                  onClick={() => setInventoryTab('lowstock')}
                  className={`px-4 py-2 rounded transition ${inventoryTab === 'lowstock' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  🚨 Low Stock Alerts
                </button>
              </div>

              {inventoryTab === 'add' && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Inventory Input Method</h3>
                  <div className="flex flex-col md:flex-row gap-4">
                    <button
                      onClick={() => setAddMethod('manual')}
                      className={`px-3 py-2 rounded border transition ${addMethod === 'manual' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/15'}`}
                    >
                      📝 Manual Entry
                    </button>
                    <button
                      onClick={() => setAddMethod('ocr')}
                      className={`px-3 py-2 rounded border transition ${addMethod === 'ocr' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/15'}`}
                    >
                      🖼️ OCR Upload
                    </button>
                    <button
                      onClick={() => setAddMethod('ai')}
                      className={`px-3 py-2 rounded border transition ${addMethod === 'ai' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/15'}`}
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
                  className={`px-4 py-2 rounded transition ${distributorTab === 'search' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  🔍 Search Distributor
                </button>
                <button
                  onClick={() => setDistributorTab('sent')}
                  className={`px-4 py-2 rounded transition ${distributorTab === 'sent' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                >
                  📤 Sent Requests
                </button>
                <button
                  onClick={() => setDistributorTab('connected')}
                  className={`px-4 py-2 rounded transition ${distributorTab === 'connected' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
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