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
import RetailerAIForecast from "../components/retailer/aiForecast/RetailerAIForecast";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { 
  FaUser, FaSignOutAlt, FaHome, FaBoxes, FaFileInvoice, FaChartLine, FaUsers, FaUserPlus, FaBuilding, FaBrain,
  FaBell, FaCog, FaSearch, FaBolt, FaClock, FaKeyboard, FaTimes, FaRocket, FaBox, FaStore, FaIdCard, FaChevronDown, FaHistory
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const RetailerDashboardInner = () => {
  const { t } = useTranslation();
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileCompletion, setProfileCompletion] = useState(100);
  const [recentSearches, setRecentSearches] = useState([]);
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
            const data = docSnap.data();
            setUserData({
              ...data,
              userId: user.uid,
              flypId: data.flypId || user.uid
            });
            
            // Calculate profile completion
            const requiredFields = [
              data.ownerName,
              data.email,
              data.phone,
              data.businessName,
              data.address,
              data.city,
              data.state,
              data.pincode,
              data.gstNumber,
              data.flypId,
              data.logoUrl,
            ];
            const completed = requiredFields.filter(f => f && (typeof f === 'string' ? f.trim() !== "" : true)).length;
            const completionPercentage = Math.round((completed / requiredFields.length) * 100);
            setProfileCompletion(completionPercentage);
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

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Global search keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
        setSelectedResultIndex(-1);
      }
      if (showSearch && searchResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedResultIndex(prev => prev < searchResults.length - 1 ? prev + 1 : prev);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
        }
        if (e.key === 'Enter' && selectedResultIndex >= 0) {
          e.preventDefault();
          const selected = searchResults[selectedResultIndex];
          if (selected?.action) {
            selected.action();
            setShowSearch(false);
            setSearchQuery("");
            setSearchResults([]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, searchResults, selectedResultIndex]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('flypRecentSearchesRetailer');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
      if (!e.target.closest('.quick-actions-container')) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Search functionality
  useEffect(() => {
    if (!showSearch || !searchQuery.trim()) {
      setSearchResults([]);
      setSelectedResultIndex(-1);
      return;
    }

    const performSearch = async () => {
      const query = searchQuery.toLowerCase().trim();
      const results = [];

      // Navigation/search targets
      const navigationItems = [
        { 
          type: 'nav', 
          label: 'Home Dashboard', 
          icon: FaHome, 
          keywords: ['home', 'dashboard', 'main'],
          action: () => setActiveTab('home')
        },
        { 
          type: 'nav', 
          label: 'Billing', 
          icon: FaFileInvoice, 
          keywords: ['billing', 'invoice', 'bill', 'pos'],
          action: () => setActiveTab('billing')
        },
        { 
          type: 'nav', 
          label: 'Inventory', 
          icon: FaBoxes, 
          keywords: ['inventory', 'products', 'stock', 'items'],
          action: () => setActiveTab('inventory')
        },
        { 
          type: 'nav', 
          label: 'Order History', 
          icon: FaFileInvoice, 
          keywords: ['order', 'orders', 'history', 'past'],
          action: () => setActiveTab('orderHistory')
        },
        { 
          type: 'nav', 
          label: 'Analytics', 
          icon: FaChartLine, 
          keywords: ['analytics', 'stats', 'reports', 'insights'],
          action: () => setActiveTab('analytics')
        },
        { 
          type: 'nav', 
          label: 'Distributors', 
          icon: FaBuilding, 
          keywords: ['distributor', 'distributors', 'supplier', 'suppliers'],
          action: () => setActiveTab('distributors')
        },
        { 
          type: 'nav', 
          label: 'Customers', 
          icon: FaUsers, 
          keywords: ['customer', 'customers', 'clients'],
          action: () => setActiveTab('customers')
        },
        { 
          type: 'nav', 
          label: 'AI Forecast', 
          icon: FaBrain, 
          keywords: ['ai', 'forecast', 'prediction', 'ai forecast'],
          action: () => setActiveTab('aiForecast')
        },
        { 
          type: 'nav', 
          label: 'Profile Settings', 
          icon: FaUser, 
          keywords: ['profile', 'settings', 'preferences', 'account'],
          action: () => setActiveTab('profile')
        },
      ];

      // Check navigation matches
      navigationItems.forEach(item => {
        if (item.keywords.some(kw => query.includes(kw))) {
          results.push({
            ...item,
            matchScore: item.keywords.findIndex(kw => query.includes(kw)) + 1,
          });
        }
      });

      // Search products if user has access
      if (auth.currentUser && (query.length >= 2)) {
        try {
          const productsRef = collection(db, "businesses", auth.currentUser.uid, "products");
          const productsSnap = await getDocs(productsRef);
          const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          products.forEach(product => {
            const name = (product.productName || product.name || '').toLowerCase();
            const sku = (product.sku || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            
            if (name.includes(query) || sku.includes(query) || brand.includes(query)) {
              results.push({
                type: 'product',
                label: product.productName || product.name || 'Unnamed Product',
                subtitle: `SKU: ${product.sku || 'N/A'} | Stock: ${product.quantity || 0}`,
                icon: FaBoxes,
                action: () => {
                  setActiveTab('inventory');
                },
                matchScore: 10,
              });
            }
          });
        } catch (error) {
          console.error('Error searching products:', error);
        }
      }

      // Sort by relevance
      results.sort((a, b) => (a.matchScore || 0) - (b.matchScore || 0));
      setSearchResults(results.slice(0, 8)); // Limit to 8 results
      setSelectedResultIndex(-1);
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, showSearch, auth.currentUser, db]);

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
    { id: 'home', label: t('retailer.home'), icon: <FaHome /> },
    { id: 'billing', label: t('retailer.billing'), icon: <FaFileInvoice /> },
    { id: 'inventory', label: t('retailer.inventory'), icon: <FaBoxes /> },
    { id: 'aiForecast', label: 'AI Forecast', icon: <FaBrain />, badge: 'NEW' },
    { id: 'analytics', label: t('retailer.analytics'), icon: <FaChartLine /> },
    { id: 'distributors', label: t('retailer.distributors'), icon: <FaBuilding /> },
    { id: 'orderHistory', label: t('retailer.orderHistory'), icon: <FaFileInvoice /> },
    { id: 'customers', label: t('retailer.customers'), icon: <FaUsers /> },
    { id: 'employees', label: t('retailer.employees'), icon: <FaUserPlus /> },
    { id: 'profile', label: t('retailer.profile'), icon: <FaUser /> },
  ];

  // Scene transition variants (content swap)
  const scene = {
    initial: { opacity: 0, y: 14 },
    enter:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
    exit:    { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  return (
    <>
      <style>{`
        /* FLYP Menu Animation - Flight-inspired wing opening */
        .hamburger-line {
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          transform-origin: center;
        }

        .hamburger-open .hamburger-line:nth-child(1) {
          transform: translateY(8px) rotate(45deg);
        }

        .hamburger-open .hamburger-line:nth-child(2) {
          opacity: 0;
          transform: scaleX(0);
        }

        .hamburger-open .hamburger-line:nth-child(3) {
          transform: translateY(-8px) rotate(-45deg);
        }

        /* Glow effect on sidebar */
        .flyp-sidebar-glow {
          box-shadow: 
            -10px 0 40px rgba(16, 185, 129, 0.15),
            -20px 0 60px rgba(6, 182, 212, 0.1),
            inset 1px 0 0 rgba(16, 185, 129, 0.1);
        }

        /* Magnetic pull effect */
        .flyp-menu-trigger {
          position: relative;
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .flyp-menu-trigger:hover {
          transform: scale(1.1);
        }

        .flyp-menu-trigger::before {
          content: '';
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .flyp-menu-trigger:hover::before {
          opacity: 1;
        }

        /* Custom scrollbar for sidebar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
      <div className="flex min-h-[100dvh] h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white font-sans transition-all duration-300 ease-in-out">
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
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Sidebar – overlay, no layout shift */}
      {mode !== "pos" && (
        <>
          {/* Animated overlay for sidebar with FLYP gradient */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                className="fixed inset-0 bg-gradient-to-r from-black/70 via-black/60 to-transparent backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{ willChange: "opacity" }}
                onClick={() => setSidebarOpen(false)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent" />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {sidebarOpen && (
          <motion.aside
            initial="closed"
            animate="open"
            exit="closed"
            variants={{
              open: {
                x: 0,
                opacity: 1,
                transition: {
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  mass: 0.8,
                  staggerChildren: 0.05,
                  delayChildren: 0.1,
                },
              },
              closed: {
                x: "-100%",
                opacity: 0,
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 40,
                },
              },
            }}
            className="hidden md:block group fixed left-0 top-0 bottom-0 z-50 w-64 bg-gradient-to-br from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-2xl border-r border-emerald-500/20 flyp-sidebar-glow"
            style={{ 
              willChange: "transform, opacity",
              transformStyle: "preserve-3d"
            }}
            onClick={(e) => e.stopPropagation()}
          >
                <motion.div 
                  className="p-4 border-b border-emerald-500/20 relative overflow-hidden"
                  variants={{
                    open: { opacity: 1, y: 0 },
                    closed: { opacity: 0, y: -20 },
                  }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 mb-4 pl-1 relative z-10">
                    FLYP
                  </div>
                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-transparent"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                  />
                </motion.div>
                  <nav className="flex-1 flex flex-col gap-2 overflow-y-auto p-3 custom-scrollbar">
                    {sidebarItems.map((item, index) => (
                      <motion.button
                        key={item.id}
                        variants={{
                          open: {
                            x: 0,
                            opacity: 1,
                            transition: {
                              type: "spring",
                              stiffness: 500,
                              damping: 25,
                              delay: index * 0.05,
                            },
                          },
                          closed: {
                            x: -50,
                            opacity: 0,
                            transition: {
                              duration: 0.2,
                            },
                          },
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveTab(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-300 hover:scale-[1.02] hover:translate-x-1 hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-cyan-500/10 relative group cursor-pointer ${
                          activeTab === item.id
                            ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 shadow-lg shadow-emerald-500/20 border border-emerald-300/30'
                            : 'hover:bg-white/10 text-white hover:text-emerald-300'
                        }`}
                      >
                        <motion.span 
                          className="text-xl shrink-0"
                          whileHover={{ scale: 1.2, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          {item.icon}
                        </motion.span>
                        <span className="truncate relative z-10 flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                        {activeTab === item.id && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-r-full"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    ))}
                  </nav>
                  <motion.div 
                    className="p-3 border-t border-emerald-500/20"
                    variants={{
                      open: { opacity: 1, y: 0 },
                      closed: { opacity: 0, y: 20 },
                    }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="text-xs text-white/50 pl-1 pb-3">v1</div>
                  </motion.div>
              </motion.aside>
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
          className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col relative z-10"
        >
          {mode === "pos" ? (
            <POSView onLogout={handleSignOut} />
          ) : (
            <>
              {/* Premium Redesigned Header - Sticky, Full Width */}
              <header className="sticky top-0 z-10 w-full bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10 text-white shadow-2xl pt-[env(safe-area-inset-top)]">
                {/* Row 1: Main Navigation - Full Width Container */}
                <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 border-b border-white/5">
                  {/* Left: Logo & Menu - Fixed Width Container */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* FLYP Menu Button with Text - Professional Design */}
                    <motion.button
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          setShowMobileSidebar(true);
                        } else {
                          setSidebarOpen(!sidebarOpen);
                        }
                      }}
                      className="flyp-menu-trigger flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-all relative group"
                      aria-label="Toggle sidebar"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* FLYP Text - Shows when sidebar is closed */}
                      <AnimatePresence mode="wait">
                        {!sidebarOpen && (
                          <motion.span
                            key="flyp-text"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 tracking-wide"
                          >
                            FLYP
                          </motion.span>
                        )}
                      </AnimatePresence>
                      
                      {/* Hamburger Icon - Clean 3-line Design */}
                      <div className="relative w-5 h-5 flex flex-col justify-center gap-1">
                        <motion.span
                          className="hamburger-line w-5 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                          animate={{ rotate: sidebarOpen ? 45 : 0, y: sidebarOpen ? 6 : 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        />
                        <motion.span
                          className="hamburger-line w-5 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                          animate={{ opacity: sidebarOpen ? 0 : 1, scaleX: sidebarOpen ? 0 : 1 }}
                          transition={{ duration: 0.2 }}
                        />
                        <motion.span
                          className="hamburger-line w-5 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                          animate={{ rotate: sidebarOpen ? -45 : 0, y: sidebarOpen ? -6 : 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        />
                      </div>
                    </motion.button>

                    {/* Dashboard Title - Clean Typography */}
                    <div className="hidden sm:block">
                      <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300">
                        Retailer Dashboard
                      </h1>
                    </div>
                  </div>

                  {/* Center: Global Search - Responsive Design */}
                  <div className="hidden lg:flex items-center flex-1 max-w-lg mx-4">
                    <motion.button
                      onClick={() => setShowSearch(true)}
                      className="w-full flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-left"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FaSearch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-400 flex-1">Search anything...</span>
                      <kbd className="hidden xl:flex items-center gap-1 px-2 py-0.5 bg-slate-700/50 border border-white/10 rounded text-[10px] text-gray-400">
                        <FaKeyboard className="w-3 h-3" />
                        <span>⌘K</span>
                      </kbd>
                    </motion.button>
                  </div>

                  {/* Right: Actions - Premium Icons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Quick Actions */}
                    <motion.button
                      onClick={() => setShowQuickActions(!showQuickActions)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="hidden md:flex items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all relative quick-actions-container"
                    >
                      <FaBolt className="w-4 h-4 text-yellow-400" />
                    </motion.button>

                    {/* Search Button (Mobile) */}
                    <motion.button
                      onClick={() => setShowSearch(true)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="lg:hidden p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                    >
                      <FaSearch className="w-4 h-4 text-gray-300" />
                    </motion.button>

                    {/* Notifications */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                    >
                      <FaBell className="w-4 h-4 text-gray-300" />
                      <motion.div
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    </motion.button>

                    {/* User Profile Menu - Premium Design */}
                    <div className="relative user-menu-container">
                      <motion.button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 px-2.5 py-2 bg-gradient-to-r from-emerald-500/20 via-emerald-400/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl hover:border-emerald-500/50 transition-all backdrop-blur-sm"
                      >
                        <div className="relative">
                          {userData?.logoUrl ? (
                            <img
                              src={userData.logoUrl}
                              alt={userData.businessName || "Business"}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/50"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center ring-2 ring-emerald-500/50">
                              <FaUser className="w-4 h-4 text-white" />
                  </div>
                          )}
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>
                        </div>
                        <div className="hidden md:block text-left min-w-0">
                          <div className="text-xs font-semibold text-white truncate max-w-[120px]">
                            {userData?.businessName || userData?.ownerName || "Business"}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[120px]">
                            {auth.currentUser?.email?.split('@')[0] || "User"}
                          </div>
                        </div>
                        <FaChevronDown className={`w-3 h-3 text-gray-400 hidden md:block transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                      </motion.button>

                      <AnimatePresence>
                        {showUserMenu && (
                      <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-slate-800/95 backdrop-blur-xl border border-emerald-500/20 rounded-xl shadow-2xl overflow-hidden z-50"
                          >
                            <div className="p-3 border-b border-emerald-500/10">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  {userData?.logoUrl ? (
                                    <img
                                      src={userData.logoUrl}
                                      alt={userData.businessName || "Business"}
                                      className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/50"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center ring-2 ring-emerald-500/50">
                                      <FaUser className="w-6 h-6 text-white" />
                                    </div>
                                  )}
                                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-800"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-white truncate">
                                    {userData?.businessName || userData?.ownerName || "Business"}
                                  </div>
                                  <div className="text-xs text-gray-400 truncate">
                                    {auth.currentUser?.email || "No email"}
                                  </div>
                                  {userData?.flypId && (
                                    <div className="text-[10px] text-emerald-400 font-mono mt-1">
                                      {userData.flypId}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="p-2">
                              {[
                                { icon: FaUser, label: "Profile Settings", action: () => { setActiveTab('profile'); setShowUserMenu(false); } },
                                { icon: FaCog, label: "Preferences", action: () => { setActiveTab('profile'); setShowUserMenu(false); } },
                                { icon: FaChartLine, label: "View Analytics", action: () => { setActiveTab('analytics'); setShowUserMenu(false); } },
                                { icon: FaSignOutAlt, label: "Sign Out", action: handleSignOut, danger: true },
                              ].map((item, idx) => (
                                <motion.button
                                  key={idx}
                                  onClick={item.action}
                                  whileHover={{ x: 4 }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-500/10 transition-colors text-left ${item.danger ? 'text-red-400 hover:text-red-300' : ''}`}
                                >
                                  <item.icon className={`w-4 h-4 ${item.danger ? 'text-red-400' : 'text-emerald-400'}`} />
                                  <span className={`text-sm ${item.danger ? 'text-red-400' : 'text-white'}`}>{item.label}</span>
                    </motion.button>
                              ))}
                  </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Row 2: Premium Info Bar - Full Width */}
                <div className="w-full px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs bg-gradient-to-r from-emerald-900/5 via-transparent to-cyan-900/5">
                  {/* Left: Business Info - Premium Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {userData?.flypId && (
                        <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-500/15 to-emerald-400/10 border border-emerald-500/30 rounded-lg shadow-[0_2px_4px_rgba(16,185,129,0.1)]"
                      >
                        <FaIdCard className="w-3 h-3 text-emerald-300" />
                        <span className="text-emerald-200 font-mono text-[10px] font-semibold">{userData.flypId}</span>
                        </motion.div>
                    )}
                    {userData?.businessMode === "Online" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-green-500/15 to-emerald-500/10 border border-green-500/30 rounded-lg"
                      >
                        <motion.div
                          className="w-2 h-2 bg-green-400 rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        />
                        <span className="text-green-300 text-[10px] font-medium">Online</span>
                      </motion.div>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/50 border border-slate-700/50 rounded-lg backdrop-blur-sm">
                      <FaClock className="w-3 h-3 text-emerald-400/70" />
                      <span className="text-emerald-200/80 text-[10px] font-mono font-medium">
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                  </div>
                    {userData && profileCompletion < 100 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setActiveTab('profile')}
                        className="flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-yellow-500/20 via-orange-500/15 to-yellow-500/20 border border-yellow-500/30 rounded-lg cursor-pointer hover:border-yellow-500/50 transition-all shadow-[0_2px_4px_rgba(234,179,8,0.1)]"
                      >
                        <FaChartLine className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-300 font-semibold text-[10px]">{profileCompletion}%</span>
                        <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${profileCompletion}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 rounded-full"
                          />
                    </div>
                      </motion.div>
                      )}
                    </div>

                  {/* Right: Quick Stats - Premium Design */}
                  {userData && (
                    <div className="hidden md:flex items-center gap-2">
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 border border-emerald-500/30 rounded-lg shadow-[0_2px_4px_rgba(16,185,129,0.1)]"
                      >
                        <FaStore className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="text-emerald-200 text-[10px] font-semibold">Retailer</span>
                      </motion.div>
                    </div>
                  )}
                </div>

                {/* Quick Actions Dropdown */}
                <AnimatePresence>
                  {showQuickActions && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-slate-800/95 backdrop-blur-xl border border-emerald-500/20 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-2">
                        <div className="px-3 py-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">Quick Actions</div>
                        {[
                          { icon: FaFileInvoice, label: "New Billing", action: () => { setActiveTab('billing'); setShowQuickActions(false); } },
                          { icon: FaChartLine, label: "View Analytics", action: () => { setActiveTab('analytics'); setShowQuickActions(false); } },
                          { icon: FaBoxes, label: "Manage Inventory", action: () => { setActiveTab('inventory'); setShowQuickActions(false); } },
                        ].map((item, idx) => (
                          <motion.button
                            key={idx}
                            onClick={item.action}
                            whileHover={{ x: 4 }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-500/10 transition-colors text-left"
                          >
                            <item.icon className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-white">{item.label}</span>
                          </motion.button>
                        ))}
                      </div>
                      </motion.div>
                  )}
                    </AnimatePresence>
              </header>

              {/* Global Search Modal */}
              <AnimatePresence>
                {showSearch && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                      onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -20 }}
                      className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-slate-800/95 backdrop-blur-xl border border-emerald-500/20 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-4 border-b border-emerald-500/20">
                        <div className="flex items-center gap-3">
                          <FaSearch className="w-5 h-5 text-emerald-400" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search navigation, products..."
                            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-lg"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && selectedResultIndex >= 0 && searchResults[selectedResultIndex]) {
                                const selected = searchResults[selectedResultIndex];
                                if (selected?.action) {
                                  selected.action();
                                  setShowSearch(false);
                                  setSearchQuery("");
                                  setSearchResults([]);
                                }
                              }
                            }}
                          />
                    <button
                            onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                            <FaTimes className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
              </div>

                      {/* Search Results */}
                      <div className="max-h-96 overflow-y-auto">
                        {searchQuery.trim() ? (
                          searchResults.length > 0 ? (
                            <div className="p-2">
                              {searchResults.map((result, idx) => {
                                const Icon = result.icon || FaSearch;
                                return (
                                  <motion.button
                                    key={idx}
                                    onClick={() => {
                                      if (result.action) {
                                        result.action();
                                        const newRecent = [result.label, ...recentSearches.filter(s => s !== result.label)].slice(0, 5);
                                        setRecentSearches(newRecent);
                                        localStorage.setItem('flypRecentSearchesRetailer', JSON.stringify(newRecent));
                                        setShowSearch(false);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                      }
                                    }}
                                    onMouseEnter={() => setSelectedResultIndex(idx)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                                      selectedResultIndex === idx 
                                        ? 'bg-emerald-500/20 border border-emerald-500/30' 
                                        : 'hover:bg-emerald-500/10'
                                    }`}
                                    whileHover={{ x: 4 }}
                                  >
                                    <Icon className={`w-5 h-5 ${result.type === 'product' ? 'text-emerald-400' : 'text-emerald-400'}`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-white truncate">{result.label}</div>
                                      {result.subtitle && (
                                        <div className="text-xs text-gray-400 truncate mt-0.5">{result.subtitle}</div>
                      )}
                    </div>
                                    {selectedResultIndex === idx && (
                                      <kbd className="text-xs text-gray-400 bg-slate-700/50 px-2 py-1 rounded">Enter</kbd>
                                    )}
                                  </motion.button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-8 text-center">
                              <FaSearch className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                              <p className="text-gray-400">No results found</p>
                              <p className="text-xs text-gray-500 mt-2">Try searching for "inventory", "billing", "analytics", etc.</p>
                            </div>
                          )
                        ) : (
                          <div className="p-4">
                            {recentSearches.length > 0 && (
                              <div className="mb-4">
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Recent Searches</div>
                                <div className="flex flex-wrap gap-2">
                                  {recentSearches.map((search, idx) => (
                    <button
                                      key={idx}
                                      onClick={() => setSearchQuery(search)}
                                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-sm text-emerald-300 transition-colors"
                                    >
                                      <FaHistory className="w-3 h-3 inline mr-1.5" />
                                      {search}
                    </button>
                                  ))}
                  </div>
              </div>
                            )}
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Quick Navigation</div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { icon: FaHome, label: "Home", action: () => { setActiveTab('home'); setShowSearch(false); } },
                                { icon: FaFileInvoice, label: "Billing", action: () => { setActiveTab('billing'); setShowSearch(false); } },
                                { icon: FaBoxes, label: "Inventory", action: () => { setActiveTab('inventory'); setShowSearch(false); } },
                                { icon: FaChartLine, label: "Analytics", action: () => { setActiveTab('analytics'); setShowSearch(false); } },
                              ].map((item, idx) => (
                                <motion.button
                                  key={idx}
                                  onClick={item.action}
                                  whileHover={{ scale: 1.02 }}
                                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-left"
                                >
                                  <item.icon className="w-4 h-4 text-emerald-400" />
                                  <span className="text-sm text-white">{item.label}</span>
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        )}
            </div>

                      {/* Footer */}
                      <div className="p-3 border-t border-emerald-500/20 bg-slate-900/50 flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-4">
                          <span><kbd className="px-1.5 py-0.5 bg-slate-700/50 border border-white/10 rounded">↑↓</kbd> Navigate</span>
                          <span><kbd className="px-1.5 py-0.5 bg-slate-700/50 border border-white/10 rounded">Enter</kbd> Select</span>
                          <span><kbd className="px-1.5 py-0.5 bg-slate-700/50 border border-white/10 rounded">Esc</kbd> Close</span>
                        </div>
                        <div><kbd className="px-1.5 py-0.5 bg-slate-700/50 border border-white/10 rounded">⌘K</kbd> to open</div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Tab Content - Full Width Container */}
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16,1,0.3,1] }}
                className="flex-1 w-full px-4 sm:px-6 py-4 sm:py-6 text-white"
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

                {activeTab === 'aiForecast' && <RetailerAIForecast />}

                {activeTab === 'distributors' && (
                  <div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-3 sm:mb-4">
                      <button
                        onClick={() => setDistributorTab('search')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${distributorTab === 'search' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        🔍 {t('retailer.searchDistributor')}
                      </button>
                      <button
                        onClick={() => setDistributorTab('sent')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${distributorTab === 'sent' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        📤 {t('retailer.sentRequests')}
                      </button>
                      <button
                        onClick={() => setDistributorTab('connected')}
                        className={`px-3 sm:px-4 py-3 sm:py-2 rounded transition text-sm sm:text-base min-h-[48px] touch-target flex items-center justify-center ${distributorTab === 'connected' ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white hover:bg-white/15 active:bg-white/20'}`}
                      >
                        🤝 {t('retailer.connected')}
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
    </>
  );
};

const RetailerDashboard = () => (
  <ModeProvider>
    <RetailerDashboardInner />
  </ModeProvider>
);

export default RetailerDashboard;