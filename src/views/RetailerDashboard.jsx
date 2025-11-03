// /src/views/RetailerDashboard.jsx
import React, { useState, useEffect } from 'react';
import POSView from "../components/pos/POSView";
import ModeProvider, { useMode } from "../components/mode/ModeProvider";
import ModeToggle from "../components/mode/ModeToggle";
import Billing from "../pages/Billing";
import ProfileSettings from "../components/profile/ProfileSettings";
import RetailerOrderHistory from "../components/retailer/orders/RetailerOrderHistory";
import CustomerAnalysis from "../components/customeranalytics/CustomerAnalysis";
import ManualEntryForm from "../components/inventory/ManualEntryForm";
import OCRUploadForm from "../components/inventory/OCRUploadForm";
import AddInventoryAI from "../components/inventory/AddInventoryAI";
import ViewInventory from "../components/inventory/ViewInventory";
import HomeSnapshot from "../components/dashboard/HomeSnapshot";
import BusinessAnalytics from "../components/dashboard/businessAnalytics/BusinessAnalytics";
import RetailerConnectedDistributors from "../components/retailer/RetailerConnectedDistributors";
import ConnectedDistributorPanel from "../components/distributor/ConnectedDistributorPanel";
import SearchDistributor from "../components/distributor/SearchDistributor";
import ViewSentRequests from "../components/distributor/ViewSentRequests";
import ManageEmployee from "../components/employee/ManageEmployee";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { FaUser, FaSignOutAlt, FaHome, FaBoxes, FaFileInvoice, FaChartLine, FaUsers, FaUserPlus, FaBuilding } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const RetailerDashboardInner = () => {
  const [activeTab, setActiveTab] = useState('home');
  const { mode } = useMode();
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [userData, setUserData] = useState(null);
  const [inventoryTab, setInventoryTab] = useState('add');
  const [addMethod, setAddMethod] = useState('manual');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filterDates, setFilterDates] = useState({ start: null, end: null });
  const [distributorTab, setDistributorTab] = useState('search');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sp_sidebar_open');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });
  const closeTimerRef = React.useRef(null);
  useEffect(() => {
    try {
      localStorage.setItem('sp_sidebar_open', sidebarOpen ? '1' : '0');
    } catch {}
  }, [sidebarOpen]);

  const openSidebar = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setSidebarOpen(true);
  };
  const scheduleCloseSidebar = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setSidebarOpen(false), 220); // small grace period
  };
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') setShowMobileSidebar(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    const now = new Date();
    if (selectedFilter === 'month') {
      setFilterDates({ start: startOfMonth(now), end: endOfMonth(now) });
    } else if (selectedFilter === 'week') {
      setFilterDates({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) });
    } else {
      setFilterDates({ start: null, end: null });
    }
  }, [selectedFilter]);

  useEffect(() => {
    if (mode === "pos") setShowMobileSidebar(false);
  }, [mode]);

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

  // Scene transition variants (content swap)
  const scene = {
    initial: { opacity: 0, y: 14 },
    enter:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
    exit:    { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  return (
    <div className={`flex min-h-[100dvh] w-full relative overflow-x-hidden overflow-y-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white ${!sidebarOpen && mode !== "pos" ? "md:[&>*:last-child]:max-w-[1400px] md:[&>*:last-child]:mx-auto" : ""}`}>
      {/* Aurora backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-[60vmax] h-[60vmax] rounded-full blur-2xl will-change-transform bg-gradient-to-tr from-emerald-500/40 via-teal-400/30 to-cyan-400/30" />
        <div className="absolute -bottom-24 -right-24 w-[50vmax] h-[50vmax] rounded-full blur-2xl will-change-transform bg-gradient-to-tr from-cyan-500/30 via-sky-400/20 to-emerald-400/30" />
      </div>

      {showMobileSidebar && (
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "opacity, filter" }}
            onClick={() => setShowMobileSidebar(false)}
          >
            <motion.div
              className="w-[85vw] sm:w-[80vw] max-w-[320px] h-full p-3 sm:p-4 bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 210, damping: 26 }}
              style={{ willChange: "transform, opacity" }}
              onClick={(e) => e.stopPropagation()}
            >
                  <div className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">FLYP</div>
              <div className="mb-3 sm:mb-4"><ModeToggle /></div>
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setShowMobileSidebar(false);
                  }}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-2 rounded-lg w-full text-left transition text-sm sm:text-base min-h-[48px] touch-target ${
                    activeTab === item.id
                      ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                      : 'hover:bg-white/10 active:bg-white/15'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Sidebar – overlay, no layout shift */}
      {mode !== "pos" && (
        <>
          {/* Animated overlay for sidebar */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ willChange: "opacity" }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {sidebarOpen && (
          <motion.aside
            onMouseEnter={() => { if (!sidebarOpen) return; setSidebarOpen(true); }}
            onMouseLeave={scheduleCloseSidebar}
            className="hidden md:block group fixed left-0 top-0 bottom-0 z-50 w-64 will-change-transform
                        bg-white/10 backdrop-blur-2xl border-r border-white/10
                        shadow-[0_8px_40px_rgba(0,0,0,0.45)]
                        transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] duration-700
                        transform translate-z-0"
            initial={{ x: -48, opacity: 0, filter: "blur(5px)" }}
            animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ x: -64, opacity: 0, filter: "blur(6px)" }}
            transition={{
              type: "spring",
              stiffness: 140,
              damping: 26,
              mass: 0.9
            }}
            style={{ willChange: "transform, opacity" }}
          >
                <div className="p-3 flex flex-col h-full">
                  <div className="text-xl font-bold text-emerald-200 mb-4 pl-1">FLYP</div>
                  <nav className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                    {sidebarItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] duration-700 ${
                          activeTab === item.id
                            ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                            : 'hover:bg-white/10 text-white'
                        }`}
                        style={{ willChange: "transform, opacity" }}
                      >
                        <span className="text-xl shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                  <div className="mt-auto text-xs text-white/50 pl-1 pb-3">v1</div>
                </div>
              </motion.aside>
            )}
            {!sidebarOpen && (
              <motion.button
                onClick={openSidebar}
                className="hidden md:flex fixed left-0 top-1/3 -translate-x-0 w-[36px] h-[120px] rounded-r-xl bg-white/10 border border-white/10 backdrop-blur-xl items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.35)] z-50"
                title="Open menu"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{ willChange: "transform, opacity" }}
              >
                <span className="text-white/85 rotate-90 tracking-widest text-xs">FLYP</span>
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Main Panel: animated scene swap keyed by mode */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          variants={scene}
          initial="initial"
          animate="enter"
          exit="exit"
          className={`flex-1 flex flex-col ml-0 relative z-10 transition-all duration-300`}
        >
          {mode === "pos" ? (
            <POSView onLogout={handleSignOut} />
          ) : (
            <>
              {/* Redesigned Hero Bar */}
              <div className="sticky top-0 z-30 w-full">
                <div
                  className="relative flex items-center justify-between px-2 md:px-6 py-2 md:py-3 pt-[max(env(safe-area-inset-top),0.5rem)]
                  bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent
                  backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.25)]
                  "
                  style={{ minHeight: 'calc(64px + env(safe-area-inset-top))' }}
                >
                  {/* Glow animation behind FLYP */}
                  <motion.div
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                    initial={{ opacity: 0.6, scale: 0.88 }}
                    animate={{ opacity: [0.7, 1, 0.7], scale: [0.88, 1.08, 0.88] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      width: 56,
                      height: 44,
                      filter: "blur(16px)",
                      background: "linear-gradient(90deg,#34d399 0%,#22d3ee 60%,#a7f3d0 100%)",
                      borderRadius: "1.5rem",
                      zIndex: 0,
                      willChange: "opacity, transform"
                    }}
                  />
                  {/* Left: Brand capsule */}
                  <div className="flex items-center min-w-[90px] relative z-10">
                    <button
                      className="md:hidden text-xl sm:text-2xl text-gray-300 p-2 sm:p-1 rounded-lg hover:bg-white/10 active:bg-white/15 transition min-h-[44px] min-w-[44px] touch-target flex items-center justify-center"
                      onClick={() => setShowMobileSidebar(true)}
                      aria-label="Open menu"
                    >
                      ☰
                    </button>
                    <div className="ml-2 flex items-center">
                      <span
                        className="relative text-xl md:text-2xl font-extrabold bg-clip-text text-transparent
                        bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-200 drop-shadow animate-pulse"
                        style={{ letterSpacing: '0.03em', willChange: "opacity, transform" }}
                      >
                        FLYP
                      </span>
                    </div>
                  </div>
                  {/* Center: Animated active tab label with bounce */}
                  <div className="flex-1 flex justify-center items-center min-w-0 relative z-10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                        className="px-3 py-1 rounded-full bg-white/5 border border-white/10 shadow
                          text-base md:text-lg font-semibold tracking-tight text-white/90
                          backdrop-blur"
                        style={{ minWidth: 180, textAlign: 'center', willChange: "transform, opacity" }}
                      >
                        <motion.div
                          animate={{ y: [0, -2, 0] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          style={{ willChange: "transform" }}
                        >
                          {activeTab === 'home' && "Home Dashboard"}
                          {activeTab === 'billing' && "Billing Dashboard"}
                          {activeTab === 'analytics' && "Analytics Dashboard"}
                          {activeTab === 'inventory' && "Inventory Dashboard"}
                          {activeTab === 'orderHistory' && "Order History"}
                          {activeTab === 'distributors' && "Distributor Connection"}
                          {activeTab === 'customers' && "Customer Analysis"}
                          {activeTab === 'employees' && "Manage Employee"}
                          {activeTab === 'profile' && "Profile Settings"}
                          {![
                            'home','billing','analytics','inventory','orderHistory','distributors','customers','employees','profile'
                          ].includes(activeTab) && "Dashboard"}
                        </motion.div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  {/* Right: Business info and avatar */}
                  <div className="flex items-center gap-3 md:gap-4 min-w-0 relative z-10">
                    <div className="text-right mr-2 hidden sm:flex flex-col items-end max-w-[200px] md:max-w-[260px] lg:max-w-[320px]">
                      <p className="font-medium text-white truncate md:whitespace-normal md:break-words text-sm md:text-base leading-tight">
                        {userData?.businessName || 'Business Name'}
                      </p>
                      <p className="text-xs text-white/70 truncate md:whitespace-normal md:break-words leading-tight">
                        {userData?.ownerName || 'Owner'} | ID: {userData?.flypId || userData?.userId || 'UserID'}
                      </p>
                    </div>
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden ring-1 ring-white/20 bg-white/10 backdrop-blur flex items-center justify-center">
                      {userData?.logoUrl ? (
                        <img src={userData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/10" />
                      )}
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="text-rose-300 hover:text-rose-200 active:text-rose-100 text-xl ml-1 p-2 -mr-2 min-h-[44px] min-w-[44px] touch-target flex items-center justify-center"
                      title="Sign Out"
                    >
                      <FaSignOutAlt />
                    </button>
                  </div>
                  {/* Moving gradient bar below header */}
                  <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-200 animate-[gradient-move_6s_linear_infinite] bg-[length:200%_200%] pointer-events-none" style={{ willChange: "background-position" }} />
              </div>
              {/* Subtle glowing divider */}
              <div className="w-full h-[2.5px] bg-gradient-to-r from-emerald-400/40 via-cyan-300/25 to-transparent blur-[1.2px] shadow-[0_2px_12px_0_rgba(0,255,200,0.08)]" />
              {/* Custom keyframes for moving gradient */}
              <style>
                {`
                @keyframes gradient-move {
                  0% { background-position: 0% 50%; }
                  100% { background-position: 100% 50%; }
                }
                `}
              </style>
              <style>{`
                @media (prefers-reduced-motion: reduce) {
                  .animate-pulse { animation: none !important; }
                  .animate-[gradient-move_6s_linear_infinite] { animation: none !important; }
                }
              `}</style>
            </div>

              {/* Tab Content */}
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16,1,0.3,1] }}
                className="flex-1 px-2 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 overflow-y-auto text-white"
                style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
              >
                {activeTab === 'home' && (
                  <div>
                    <div className="space-y-4 md:space-y-6">
                      {(() => {
                        const filterControl = (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                            <label htmlFor="filter" className="font-medium text-xs sm:text-sm md:text-base">Filter:</label>
                            <select
                              id="filter"
                              value={selectedFilter}
                              onChange={(e) => setSelectedFilter(e.target.value)}
                              className="w-full sm:w-auto px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
                            >
                              <option value="today">Today</option>
                              <option value="all">All Time</option>
                              <option value="month">This Month</option>
                              <option value="week">This Week</option>
                              <option value="custom">Custom</option>
                            </select>
                            {selectedFilter === 'custom' && (
                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                                <input
                                  type="date"
                                  onChange={(e) =>
                                    setFilterDates((prev) => ({ ...prev, start: new Date(e.target.value) }))
                                  }
                                  className="w-full sm:w-auto px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
                                />
                                <input
                                  type="date"
                                  onChange={(e) =>
                                    setFilterDates((prev) => ({ ...prev, end: new Date(e.target.value) }))
                                  }
                                  className="w-full sm:w-auto px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
                                />
                              </div>
                            )}
                          </div>
                        );
                        return <HomeSnapshot filterDates={filterDates} headerRight={filterControl} />;
                      })()}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-8 flex justify-center"
                      >
                        <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.25)] hover:shadow-[0_0_25px_rgba(0,255,200,0.2)] hover:scale-105 transition-all">
                          <ModeToggle />
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )}

                {activeTab === 'billing' && <Billing />}
                {activeTab === 'orderHistory' && <RetailerOrderHistory />}

                {activeTab === 'inventory' && (
                  <div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6 border-b pb-2">
                      <button
                        onClick={() => setInventoryTab('add')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${inventoryTab === 'add' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        ➕ Add Inventory
                      </button>
                      <button
                        onClick={() => setInventoryTab('view')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${inventoryTab === 'view' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        📋 View Inventory
                      </button>
                      <button
                        onClick={() => setInventoryTab('group')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${inventoryTab === 'group' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        🧩 Group Items
                      </button>
                      <button
                        onClick={() => setInventoryTab('lowstock')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${inventoryTab === 'lowstock' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        🚨 Low Stock Alerts
                      </button>
                    </div>

                    {inventoryTab === 'add' && (
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Select Inventory Input Method</h3>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                          <button
                            onClick={() => setAddMethod('manual')}
                            className={`px-3 py-3 sm:py-2 rounded border transition min-h-[48px] touch-target flex items-center justify-center ${addMethod === 'manual' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/15 active:bg-white/20'}`}
                          >
                            📝 Manual Entry
                          </button>
                          <button
                            onClick={() => setAddMethod('ocr')}
                            className={`px-3 py-3 sm:py-2 rounded border transition min-h-[48px] touch-target flex items-center justify-center ${addMethod === 'ocr' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/15 active:bg-white/20'}`}
                          >
                            🖼️ OCR Upload
                          </button>
                          <button
                            onClick={() => setAddMethod('ai')}
                            className={`px-3 py-3 sm:py-2 rounded border transition min-h-[48px] touch-target flex items-center justify-center ${addMethod === 'ai' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/15 active:bg-white/20'}`}
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
                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4">
                      <button
                        onClick={() => setDistributorTab('search')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${distributorTab === 'search' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        🔍 Search Distributor
                      </button>
                      <button
                        onClick={() => setDistributorTab('sent')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${distributorTab === 'sent' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        📤 Sent Requests
                      </button>
                      <button
                        onClick={() => setDistributorTab('connected')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${distributorTab === 'connected' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
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
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const RetailerDashboard = () => (
  <ModeProvider>
    <RetailerDashboardInner />
  </ModeProvider>
);

export default RetailerDashboard;