import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { 
  FaBell, FaCog, FaBuilding, 
  FaIdCard, FaChevronDown, FaChartLine,
  FaSearch, FaSignOutAlt, FaUser, FaBolt,
  FaClock, FaKeyboard, FaTimes, FaRocket,
  FaBox, FaStore, FaFileInvoice, FaHistory
} from "react-icons/fa";

import DistributorInventory from "./distributor/DistributorInventory.jsx";
import DistributorInvoices from "./distributor/DistributorInvoices.jsx";
import DistributorManualBilling from "./distributor/DistributorManualBilling.jsx";
import DispatchTracker from "./distributor/DispatchTracker";
import DistributorAnalytics from "./distributor/analytics/DistributorAnalytics";
import DistributorHome from "./distributor/DistributorHome";
import RetailerPanel from "./distributor/RetailerPanel";
import DistributorViewEmployees from "./distributor/employees/DistributorViewEmployees";
import DistributorProfileSettings from "./distributor/DistributorProfileSettings";
import ProductOwnerConnection from "./distributor/ProductOwnerConnection";
import DistributorAIForecast from "./distributor/aiForecast/DistributorAIForecast";
import WhatsAppHub from "./distributor/whatsapp/WhatsAppHub";
import ProfileCompletionNotification from "./common/ProfileCompletionNotification";

const DistributorDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [retailerRequestsCount, setRetailerRequestsCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [shipmentsCount, setShipmentsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [profileCompletion, setProfileCompletion] = useState(100);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentSearches, setRecentSearches] = useState([]);

  // Utility: ignore global shortcuts while typing in inputs/fields
  const isTypingTarget = (e) => {
    const tag = (e?.target?.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e?.target?.isContentEditable === true);
  };

  // --- UI-only: small presentational components for polish ---
  const KPICard = ({ label, value, subtitle, loading }) => (
    <div className="flex-1 min-w-[140px] sm:min-w-[180px] rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-2 sm:p-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <div className="mt-1 flex items-baseline gap-1 sm:gap-2">
        <span className={`text-lg sm:text-xl lg:text-2xl font-semibold ${loading ? 'animate-pulse text-white/40' : 'text-white'}`}>{value}</span>
        {subtitle && <span className="text-xs text-emerald-300">{subtitle}</span>}
      </div>
    </div>
  );

  const SectionTitle = ({ title, desc, icon }) => (
    <div className="mb-3 sm:mb-4 flex items-start gap-2 sm:gap-3">
      <div className="text-xl sm:text-2xl">{icon}</div>
      <div>
        <h3 className="text-base sm:text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">{title}</h3>
        {desc && <p className="text-xs sm:text-sm text-white/70 mt-0.5">{desc}</p>}
      </div>
    </div>
  );

  // --- UI-only: GlassCard presentational component ---
  const GlassCard = ({ className = "", children }) => (
    <div className={`rounded-xl border border-white/10 bg-white/5 shadow-xl hover:shadow-emerald-400/10 hover:scale-[1.005] transition duration-300 vignette ${className}`}>
      {children}
    </div>
  );

  // --- UI-only: Command Palette state & items ---
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const PALETTE_ITEMS = [
    { id: 'dashboard', label: t('distributor.dashboard') },
    { id: 'retailerRequests', label: t('distributor.retailerPanel') },
    { id: 'inventory', label: t('distributor.inventory') },
    { id: 'aiForecast', label: 'AI Forecast', badge: 'NEW' },
    { id: 'dispatch', label: t('distributor.dispatch') },
    { id: 'manualBilling', label: 'Manual Billing' },
    { id: 'invoices', label: t('distributor.invoices') },
    { id: 'productOwners', label: 'Product Owners' },
    { id: 'analytics', label: t('distributor.analytics') },
    { id: 'profile', label: t('profile.title') },
  ];

  // --- UI-only: tab order for numeric shortcuts
  const TAB_KEYS = ['dashboard','retailerRequests','inventory','aiForecast','dispatch','analytics','profile'];

  const [showGreeting, setShowGreeting] = useState(true);
  useEffect(() => {
    const timeout = setTimeout(() => setShowGreeting(false), 4000);
    return () => clearTimeout(timeout);
  }, []);

  // --- Deep link support: sync sidebar with ?tab= in the hash ---
  const idToUrlTab = {
    dashboard: 'dashboard',
    retailerRequests: 'retailer-requests',
    inventory: 'inventory',
    aiForecast: 'ai-forecast',
    dispatch: 'track-orders', // important: our DispatchTracker page is track-orders in URL
    manualBilling: 'manual-billing',
    invoices: 'invoices',
    productOwners: 'product-owners',
    analytics: 'analytics',
    whatsapp: 'whatsapp',
    profile: 'profile',
  };
  const urlTabToId = {
    'dashboard': 'dashboard',
    'retailer-requests': 'retailerRequests',
    'inventory': 'inventory',
    'ai-forecast': 'aiForecast',
    'track-orders': 'dispatch',
    'manual-billing': 'manualBilling',
    'invoices': 'invoices',
    'product-owners': 'productOwners',
    'analytics': 'analytics',
    'whatsapp': 'whatsapp',
    'profile': 'profile',
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
        const data = businessDocSnap.data();
        setUserData(data);
        
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
          data.panNumber,
          data.flypId,
          data.logoUrl,
          data.bankName,
          data.bankAccountNumber,
          data.upiId,
          data.gstCertificateUrl,
          data.panCardUrl,
          data.businessLicenseUrl,
          data.tradeLicenseUrl,
        ];
        const completed = requiredFields.filter(f => f && (typeof f === 'string' ? f.trim() !== "" : true)).length;
        const completionPercentage = Math.round((completed / requiredFields.length) * 100);
        setProfileCompletion(completionPercentage);
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
    const saved = localStorage.getItem('flypRecentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
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
          label: 'Dashboard', 
          icon: FaChartLine, 
          keywords: ['dashboard', 'home', 'main'],
          action: () => setTabAndHash('dashboard')
        },
        { 
          type: 'nav', 
          label: 'Retailer Requests', 
          icon: FaStore, 
          keywords: ['retailer', 'retailers', 'requests', 'orders', 'new order'],
          action: () => setTabAndHash('retailerRequests')
        },
        { 
          type: 'nav', 
          label: 'Inventory', 
          icon: FaBox, 
          keywords: ['inventory', 'products', 'stock', 'items'],
          action: () => setTabAndHash('inventory')
        },
        { 
          type: 'nav', 
          label: 'Track Orders', 
          icon: FaFileInvoice, 
          keywords: ['track', 'orders', 'dispatch', 'shipments', 'delivery'],
          action: () => setTabAndHash('dispatch')
        },
        { 
          type: 'nav', 
          label: 'Analytics', 
          icon: FaChartLine, 
          keywords: ['analytics', 'stats', 'reports', 'insights'],
          action: () => setTabAndHash('analytics')
        },
        { 
          type: 'nav', 
          label: 'Invoices', 
          icon: FaFileInvoice, 
          keywords: ['invoices', 'billing', 'bills'],
          action: () => setTabAndHash('invoices')
        },
        { 
          type: 'nav', 
          label: 'Profile Settings', 
          icon: FaCog, 
          keywords: ['profile', 'settings', 'preferences', 'account'],
          action: () => setTabAndHash('profile')
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
                icon: FaBox,
                action: () => {
                  setTabAndHash('inventory');
                  // Could add a query param to highlight this product
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

  // Keyboard shortcuts: 1–5 to switch tabs; "g r"=Retailer Panel, "g i"=Inventory, "g d"=Dispatch, "g a"=Analytics
  const lastKeyRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (e) => {
      // ⛔️ Don't trigger shortcuts while the user is typing
      if (isTypingTarget(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if (/^[1-5]$/.test(key)) {
        const idx = parseInt(key, 10) - 1;
        const next = TAB_KEYS[idx];
        if (next) setTabAndHash(next);
        return;
      }
      const now = Date.now();
      if (lastKeyRef.current && now - lastKeyRef.current.time < 900) {
        const first = lastKeyRef.current.key; lastKeyRef.current = null;
        if (first === 'g') {
          if (key === 'r') setTabAndHash('retailerRequests');
          else if (key === 'i') setTabAndHash('inventory');
          else if (key === 'd') setTabAndHash('dispatch');
          else if (key === 'a') setTabAndHash('analytics');
        }
        return;
      }
      if (key === 'g') lastKeyRef.current = { key: 'g', time: now };
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const clearComboOnFocus = (e) => { if (isTypingTarget(e)) lastKeyRef.current = null; };
    window.addEventListener('focusin', clearComboOnFocus);
    return () => window.removeEventListener('focusin', clearComboOnFocus);
  }, []);

  // Ctrl/⌘+K toggles Command Palette; Esc closes
  useEffect(() => {
    const onKey = (e) => {
      // ⛔️ Ignore palette shortcuts while typing in fields
      if (isTypingTarget(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(v => !v); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  const sidebarItems = [
    { id: 'dashboard', label: t('distributor.dashboard'), icon: '🏠' },
    { id: 'retailerRequests', label: t('distributor.retailerPanel'), icon: '📋' },
    { id: 'inventory', label: t('distributor.inventory'), icon: '📦' },
    { id: 'aiForecast', label: 'AI Forecast', icon: '🧠', badge: 'NEW' },
    { id: 'whatsapp', label: 'WhatsApp Hub', icon: '💬', badge: 'NEW' },
    { id: 'dispatch', label: t('distributor.dispatch'), icon: '🚚' },
    { id: 'manualBilling', label: 'Manual Billing', icon: '💰' },
    { id: 'invoices', label: t('distributor.invoices'), icon: '🧾' },
    { id: 'productOwners', label: 'Product Owners', icon: '🏭' },
    { id: 'analytics', label: t('distributor.analytics'), icon: '📊' },
    { id: 'employees', label: t('distributor.employees'), icon: '👥' },
    { id: 'profile', label: t('profile.title'), icon: '⚙️' },
  ];

  return (
    <>
      {/* Profile Completion Notification */}
      <ProfileCompletionNotification />
      <style>{`
        @keyframes auroraShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fade-in-out {
          0% { opacity: 0; transform: translateY(-10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        .animate-fade-in-out {
          animation: fade-in-out 4s ease-in-out forwards;
        }
        /* UI-only: glass scrollbars */
        .glass-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .glass-scroll::-webkit-scrollbar-track { background: transparent; }
        .glass-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
        .glass-scroll:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); }
        /* UI-only: subtle vignette + inner highlight on cards */
        .vignette { position: relative; }
        .vignette:before { content: ""; position: absolute; inset: 0; border-radius: 0.75rem; pointer-events: none; box-shadow: inset 0 0 120px rgba(0,0,0,.18); }
        .vignette:after { content: ""; position: absolute; inset: 0; border-radius: 0.75rem; pointer-events: none; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
        /* Tiny noise film */
        .page-noise:before { content: ""; position: fixed; inset: 0; pointer-events: none; background-image: radial-gradient(rgba(255,255,255,.025) 1px, transparent 1px); background-size: 3px 3px; opacity: .25; }
        /* Reusable pill */
        .chip { padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; }

        /* FLYP Menu Animation - Flight-inspired wing opening */
        @keyframes flypMenuEnter {
          0% {
            transform: translateX(-100%) perspective(1000px) rotateY(-15deg) scale(0.95);
            opacity: 0;
            filter: blur(10px);
          }
          60% {
            transform: translateX(-5%) perspective(1000px) rotateY(-2deg) scale(1.02);
          }
          100% {
            transform: translateX(0) perspective(1000px) rotateY(0deg) scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }

        @keyframes flypMenuExit {
          0% {
            transform: translateX(0) perspective(1000px) rotateY(0deg) scale(1);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: translateX(-100%) perspective(1000px) rotateY(-15deg) scale(0.95);
            opacity: 0;
            filter: blur(10px);
          }
        }

        /* Hamburger to X transformation - Flight path inspired */
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

      {/* MAIN CONTAINER */}
      <div className="flex min-h-[100dvh] h-screen overflow-hidden bg-gradient-to-br from-[#0B1220] via-[#0F1A2A] to-[#0B1220] text-white font-sans transition-all duration-300 ease-in-out page-noise">
        {/* Sidebar with FLYP flight animation */}
        <AnimatePresence>
          {isSidebarOpen && (
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
              className="fixed left-0 top-0 bottom-0 w-64 sm:w-72 bg-gradient-to-br from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-2xl border-r border-emerald-500/20 flex flex-col h-screen z-30 flyp-sidebar-glow pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              style={{
                transformStyle: "preserve-3d",
              }}
            >
          <motion.div 
            className="p-4 border-b border-emerald-500/20 relative overflow-hidden"
            variants={{
              open: { opacity: 1, y: 0 },
              closed: { opacity: 0, y: -20 },
            }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 mb-4 sm:mb-6 relative z-10">
              FLYP
            </h2>
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-transparent"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
            />
          </motion.div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
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
                onClick={() => {
                  setTabAndHash(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-[1.02] hover:translate-x-1 hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-cyan-500/10 active:bg-white/10 text-sm flex items-center gap-3 relative group ${
                  activeTab === item.id
                    ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-l-4 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/20"
                    : "text-white/80 hover:text-emerald-300"
                }`}
              >
                <motion.span 
                  className="text-lg"
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  {item.icon}
                </motion.span>
                <span className="relative z-10 flex-1">{item.label}</span>
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
            className="p-4 border-t border-emerald-500/20"
            variants={{
              open: { opacity: 1, y: 0 },
              closed: { opacity: 0, y: 20 },
            }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              onClick={handleSignOut}
              className="w-full bg-gradient-to-r from-red-600/20 to-red-500/20 hover:from-red-600/30 hover:to-red-500/30 border border-red-500/30 py-2 px-4 rounded-lg text-red-300 text-sm transition-all relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative z-10">{t('common.signOut') || 'Sign Out'}</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </motion.button>
          </motion.div>
        </motion.aside>
          )}
        </AnimatePresence>
        {/* Sidebar backdrop with FLYP gradient */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed inset-0 z-20 bg-gradient-to-r from-black/70 via-black/60 to-transparent backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col glass-scroll motion-reduce:transform-none motion-reduce:transition-none">
          <header className="sticky top-0 z-10 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10 text-white shadow-2xl pt-[env(safe-area-inset-top)]">
            {/* Row 1: Main Navigation */}
            <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 border-b border-white/5">
              {/* Left: Logo & Menu */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <motion.button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="flyp-menu-trigger flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-all relative group"
                  aria-label="Toggle sidebar"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <AnimatePresence mode="wait">
                    {!isSidebarOpen && (
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
                  
                  <div className="relative w-5 h-5 flex flex-col justify-center gap-1">
                    <motion.span
                      className="hamburger-line w-5 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                      animate={{ rotate: isSidebarOpen ? 45 : 0, y: isSidebarOpen ? 6 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                    <motion.span
                      className="hamburger-line w-5 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                      animate={{ opacity: isSidebarOpen ? 0 : 1, scaleX: isSidebarOpen ? 0 : 1 }}
                      transition={{ duration: 0.2 }}
                    />
                    <motion.span
                      className="hamburger-line w-5 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                      animate={{ rotate: isSidebarOpen ? -45 : 0, y: isSidebarOpen ? -6 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  </div>
                </motion.button>

                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300">
                    {t('distributor.distributorDashboard')}
                  </h1>
                </div>
              </div>

              {/* Center: Global Search */}
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

              {/* Right: Actions */}
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
                  {retailerRequestsCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    >
                      {retailerRequestsCount > 9 ? '9+' : retailerRequestsCount}
                    </motion.span>
                  )}
                </motion.button>

                {/* User Profile */}
                <div className="relative user-menu-container">
                  <motion.button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-2.5 py-2 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 rounded-xl hover:border-indigo-500/50 transition-all backdrop-blur-sm"
                  >
                    <div className="relative">
                      {userData?.logoUrl ? (
                        <img
                          src={userData.logoUrl}
                          alt={userData.businessName || "Business"}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/50"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-indigo-500/50">
                          <FaBuilding className="w-4 h-4 text-white" />
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
                        className="absolute right-0 top-full mt-2 w-64 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                      >
                        <div className="p-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              {userData?.logoUrl ? (
                                <img
                                  src={userData.logoUrl}
                                  alt={userData.businessName || "Business"}
                                  className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/50"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center ring-2 ring-indigo-500/50">
                                  <FaBuilding className="w-6 h-6 text-white" />
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
                                <div className="text-[10px] text-indigo-400 font-mono mt-1">
                                  {userData.flypId}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="p-2">
                          {[
                            { icon: FaUser, label: "Profile Settings", action: () => { setTabAndHash("profile"); setShowUserMenu(false); } },
                            { icon: FaCog, label: "Preferences", action: () => { setTabAndHash("profile"); setShowUserMenu(false); } },
                            { icon: FaChartLine, label: "View Stats", action: () => { setTabAndHash("analytics"); setShowUserMenu(false); } },
                            { icon: FaSignOutAlt, label: "Sign Out", action: handleSignOut, danger: true },
                          ].map((item, idx) => (
                            <motion.button
                              key={idx}
                              onClick={item.action}
                              whileHover={{ x: 4 }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left ${item.danger ? 'text-red-400 hover:text-red-300' : ''}`}
                            >
                              <item.icon className={`w-4 h-4 ${item.danger ? 'text-red-400' : 'text-indigo-400'}`} />
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

            {/* Row 2: Info Bar */}
            <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
              {/* Left: Business Info */}
              <div className="flex items-center gap-3 flex-wrap">
                {userData?.flypId && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <FaIdCard className="w-3 h-3 text-indigo-400" />
                    <span className="text-indigo-300 font-mono text-[10px]">{userData.flypId}</span>
                  </div>
                )}
                {userData?.businessMode === "Online" && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-300 text-[10px]">Online</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/50 rounded-lg">
                  <FaClock className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-300 text-[10px] font-mono">
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {userData && profileCompletion < 100 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setTabAndHash("profile")}
                    className="flex items-center gap-2 px-2 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg cursor-pointer hover:border-yellow-500/50 transition-all"
                  >
                    <FaChartLine className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-300 font-semibold text-[10px]">{profileCompletion}%</span>
                    <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${profileCompletion}%` }}
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right: Quick Stats */}
              {userData && (
                <div className="hidden md:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <FaStore className="w-3 h-3 text-indigo-400" />
                    <span className="text-white text-[10px] font-semibold">{retailerRequestsCount}</span>
                    <span className="text-gray-400 text-[10px]">Retailers</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <FaBox className="w-3 h-3 text-purple-400" />
                    <span className="text-white text-[10px] font-semibold">{inventoryCount}</span>
                    <span className="text-gray-400 text-[10px]">Products</span>
                  </div>
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
                  className="absolute right-4 top-full mt-2 w-64 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Actions</div>
                    {[
                      { icon: FaRocket, label: "New Order", action: () => { setTabAndHash("retailerRequests"); setShowQuickActions(false); } },
                      { icon: FaChartLine, label: "View Analytics", action: () => { setTabAndHash("analytics"); setShowQuickActions(false); } },
                      { icon: FaBuilding, label: "Manage Inventory", action: () => { setTabAndHash("inventory"); setShowQuickActions(false); } },
                    ].map((item, idx) => (
                      <motion.button
                        key={idx}
                        onClick={item.action}
                        whileHover={{ x: 4 }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <item.icon className="w-4 h-4 text-indigo-400" />
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
                  className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <FaSearch className="w-5 h-5 text-indigo-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search navigation, products, retailers..."
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
                                    // Save to recent searches
                                    const newRecent = [result.label, ...recentSearches.filter(s => s !== result.label)].slice(0, 5);
                                    setRecentSearches(newRecent);
                                    localStorage.setItem('flypRecentSearches', JSON.stringify(newRecent));
                                    setShowSearch(false);
                                    setSearchQuery("");
                                    setSearchResults([]);
                                  }
                                }}
                                onMouseEnter={() => setSelectedResultIndex(idx)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                                  selectedResultIndex === idx 
                                    ? 'bg-indigo-500/20 border border-indigo-500/30' 
                                    : 'hover:bg-white/5'
                                }`}
                                whileHover={{ x: 4 }}
                              >
                                <Icon className={`w-5 h-5 ${result.type === 'product' ? 'text-emerald-400' : 'text-indigo-400'}`} />
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
                          <p className="text-xs text-gray-500 mt-2">Try searching for "inventory", "orders", "analytics", etc.</p>
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
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors"
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
                            { icon: FaChartLine, label: "Dashboard", action: () => { setTabAndHash("dashboard"); setShowSearch(false); } },
                            { icon: FaStore, label: "Retailers", action: () => { setTabAndHash("retailerRequests"); setShowSearch(false); } },
                            { icon: FaBox, label: "Inventory", action: () => { setTabAndHash("inventory"); setShowSearch(false); } },
                            { icon: FaFileInvoice, label: "Orders", action: () => { setTabAndHash("dispatch"); setShowSearch(false); } },
                          ].map((item, idx) => (
                            <motion.button
                              key={idx}
                              onClick={item.action}
                              whileHover={{ scale: 1.02 }}
                              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left"
                            >
                              <item.icon className="w-4 h-4 text-indigo-400" />
                              <span className="text-sm text-white">{item.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-3 border-t border-white/10 bg-slate-900/50 flex items-center justify-between text-xs text-gray-400">
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

          {/* Main Content */}
          <main className={`relative ${activeTab === "whatsapp" ? 'p-0 m-0 overflow-hidden' : 'pt-2 sm:pt-3 px-2 sm:px-3 md:px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] mx-2 sm:mx-3 mt-1 mb-2 sm:mb-3 overflow-y-auto'}`}>
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <DistributorHome />
                  </div>
                </motion.div>
              )}
              {activeTab === "retailerRequests" && (
                <motion.div
                  key="retailerHub"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <RetailerPanel />
                  </div>
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
                  <div className="w-full">
                    <DistributorInventory db={db} auth={auth} />
                  </div>
                </motion.div>
              )}
              {activeTab === "aiForecast" && auth?.currentUser && (
                <motion.div
                  key="aiForecast"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <DistributorAIForecast />
                  </div>
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
                  <div className="w-full">
                    <DispatchTracker db={db} auth={auth} />
                  </div>
                </motion.div>
              )}
              {activeTab === "manualBilling" && auth?.currentUser && (
                <motion.div
                  key="manualBilling"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <DistributorManualBilling />
                  </div>
                </motion.div>
              )}
              {activeTab === "invoices" && auth?.currentUser && (
                <motion.div
                  key="invoices"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <DistributorInvoices />
                  </div>
                </motion.div>
              )}
              {activeTab === "productOwners" && auth?.currentUser && (
                <motion.div
                  key="productOwners"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <ProductOwnerConnection />
                  </div>
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
                  <div className="w-full">
                    <DistributorAnalytics distributorId={auth.currentUser.uid} />
                  </div>
                </motion.div>
              )}
              {activeTab === "whatsapp" && auth?.currentUser && (
                <motion.div
                  key="whatsapp"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full overflow-hidden"
                  style={{ height: 'calc(100vh - 145px)' }}
                >
                  <WhatsAppHub />
                </motion.div>
              )}
              {activeTab === "employees" && auth?.currentUser && (
                <motion.div
                  key="employees"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <DistributorViewEmployees />
                  </div>
                </motion.div>
              )}
              {activeTab === "profile" && auth?.currentUser && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <DistributorProfileSettings />
                </motion.div>
              )}
            </AnimatePresence>

            {isPaletteOpen && (
              <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24">
                <div className="absolute inset-0 bg-black/50" onClick={() => setPaletteOpen(false)} />
                <div className="relative w-[90%] max-w-xl rounded-2xl border border-white/10 bg-[#0B0F14]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                  <div className="p-3 border-b border-white/10">
                    <input autoFocus placeholder="Jump to… (1–5, g+r/i/d/a, ⌘/Ctrl+K)" className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
                  </div>
                  <div className="max-h-72 overflow-y-auto glass-scroll">
                    {PALETTE_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setTabAndHash(item.id); setPaletteOpen(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-white/10 ${activeTab === item.id ? 'text-emerald-200' : 'text-white'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Floating FLYP badge to toggle sidebar */}
            <button
              onClick={() => setIsSidebarOpen(v => !v)}
              className="fixed bottom-6 left-6 z-40 rounded-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 active:scale-[0.95] text-white font-extrabold tracking-wide shadow-lg shadow-emerald-700/30 ring-1 ring-white/20 min-h-[48px] min-w-[48px] touch-target flex items-center justify-center mb-[env(safe-area-inset-bottom)] ml-[env(safe-area-inset-left)]"
              aria-label="Toggle FLYP Menu"
            >
              FLYP
            </button>
          </main>
        </div>
      </div>
    </>
  );
};

export default DistributorDashboard;