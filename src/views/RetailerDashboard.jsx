import React, { useState, useEffect, useContext } from 'react';
import ManualEntryForm from "../components/inventory/ManualEntryForm";
import OCRUploadForm from "../components/inventory/OCRUploadForm";
import { FaUser, FaSignOutAlt, FaHome, FaBoxes, FaFileInvoice, FaChartLine, FaUsers, FaUserPlus, FaBuilding } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";

const RetailerDashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [userData, setUserData] = useState(null);
  const [inventoryTab, setInventoryTab] = useState('add');
  const [addMethod, setAddMethod] = useState('manual');

  const navigate = useNavigate();
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userRef = doc(db, "businesses", user.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            setUserData({ ...docSnap.data(), userId: user.uid });
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };
    fetchUserProfile();
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
    { id: 'customers', label: 'Customer Analysis', icon: <FaUsers /> },
    { id: 'employees', label: 'Manage Employee', icon: <FaUserPlus /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md border-r border-gray-200">
        <div className="p-6 text-xl font-bold border-b border-gray-200">
          BusinessPilot
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
              <p className="text-sm text-gray-500">{userData?.ownerName || 'Owner'} | ID: {userData?.userId || 'UserID'}</p>
            </div>
            <div className="w-10 h-10 bg-gray-300 rounded-full overflow-hidden">
              {/* Placeholder for user image */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Revenue by Payment Mode</h3>
                <div className="h-64">
                  {/* Insert <BarChart> here using Recharts */}
                  <p>📊 Bar Chart Placeholder (Cash, UPI, Card)</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Top Selling Products</h3>
                <div className="h-64">
                  {/* Insert <PieChart> here using Recharts */}
                  <p>🥧 Pie Chart Placeholder (Product distribution)</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded shadow md:col-span-2">
                <h3 className="text-lg font-semibold mb-2">Sales Over Time</h3>
                <div className="h-64">
                  {/* Insert <LineChart> here using Recharts */}
                  <p>📈 Line Chart Placeholder (Daily Sales)</p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'billing' && <div>🧾 Billing Section: Generate/View/Add Invoices.</div>}
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
            {addMethod === 'manual' && <ManualEntryForm />}
            {addMethod === 'ocr' && <OCRUploadForm />}
            {addMethod === 'ai' && <div>🤖 AI Generation Component Placeholder</div>}
          </div>
        </div>
      )}
      {inventoryTab === 'view' && <div>📋 Current Inventory List Component Placeholder</div>}
      {inventoryTab === 'group' && <div>🧩 Group Items Component Placeholder</div>}
      {inventoryTab === 'lowstock' && <div>🚨 Low Stock Alert Component Placeholder</div>}
    </div>
  )}
          {activeTab === 'analytics' && <div>📈 Business Analytics: Insights & Reports.</div>}
          {activeTab === 'distributors' && <div>🤝 Distributor Connection: Send or receive requests.</div>}
          {activeTab === 'customers' && <div>👥 Customer Analysis: Engagement metrics.</div>}
          {activeTab === 'employees' && <div>👨‍💼 Manage Employees: Add or track staff.</div>}
        </motion.div>
      </div>
    </div>
  );
};

export default RetailerDashboard;