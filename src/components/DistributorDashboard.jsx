import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

import DistributorInventory from "./distributor/DistributorInventory.jsx";
import DispatchTracker from "./distributor/DispatchTracker";
import DistributorAnalytics from "./distributor/analytics/DistributorAnalytics";
import DistributorHome from "./distributor/DistributorHome";
import RetailerPanel from "./distributor/RetailerPanel";
import DistributorViewEmployees from "./distributor/employees/DistributorViewEmployees";

const DistributorDashboard = () => {
  const navigate = useNavigate();

  const [retailerRequestsCount, setRetailerRequestsCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [shipmentsCount, setShipmentsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Sidebar visibility state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'retailerRequests', label: 'Retailer Panel' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'dispatch', label: 'Dispatch Tracker' },
    { id: 'analytics', label: 'Analytics' },
  ];

  // --- UI-only: tab order for numeric shortcuts
  const TAB_KEYS = ['dashboard','retailerRequests','inventory','dispatch','analytics'];

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
    dispatch: 'track-orders', // important: our DispatchTracker page is track-orders in URL
    analytics: 'analytics',
  };
  const urlTabToId = {
    'dashboard': 'dashboard',
    'retailer-requests': 'retailerRequests',
    'inventory': 'inventory',
    'track-orders': 'dispatch',
    'analytics': 'analytics',
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

  return (
    <>
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
      `}</style>

      {/* MAIN CONTAINER */}
      <div className="flex min-h-[100dvh] h-screen overflow-hidden bg-gradient-to-br from-[#0B1220] via-[#0F1A2A] to-[#0B1220] text-white font-sans transition-all duration-300 ease-in-out page-noise">
        {/* Sidebar as hidden drawer */}
        <aside className={`fixed left-0 top-0 h-full w-64 sm:w-72 bg-gradient-to-b from-[#0D1524] via-[#0B1220] to-[#0B1220] backdrop-blur-md text-white shadow-2xl p-4 sm:p-5 flex flex-col justify-between transform transition-transform duration-300 z-30 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide text-white mb-4 sm:mb-6">FLYP</h2>
            <nav className="space-y-3 sm:space-y-4 mt-16 sm:mt-20">
              <button
                onClick={() => { setTabAndHash("dashboard"); setIsSidebarOpen(false); }}
                className={`w-full text-left px-2 sm:px-3 py-3 sm:py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm sm:text-base min-h-[48px] touch-target flex items-center ${
                  activeTab === "dashboard"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                🏠 Dashboard
              </button>
              <button
                onClick={() => { setTabAndHash("retailerRequests"); setIsSidebarOpen(false); }}
                className={`w-full text-left px-2 sm:px-3 py-3 sm:py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm sm:text-base min-h-[48px] touch-target flex items-center ${
                  activeTab === "retailerRequests"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                📋 Retailer Panel
              </button>
              <button
                onClick={() => { setTabAndHash("inventory"); setIsSidebarOpen(false); }}
                className={`w-full text-left px-2 sm:px-3 py-3 sm:py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm sm:text-base min-h-[48px] touch-target flex items-center ${
                  activeTab === "inventory"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                📦 Inventory
              </button>
              <button
                onClick={() => { setTabAndHash("dispatch"); setIsSidebarOpen(false); }}
                className={`w-full text-left px-2 sm:px-3 py-3 sm:py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm sm:text-base min-h-[48px] touch-target flex items-center ${
                  activeTab === "dispatch"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                🚚 Dispatch Tracker
              </button>
              <button
                onClick={() => { setTabAndHash("analytics"); setIsSidebarOpen(false); }}
                className={`w-full text-left px-2 sm:px-3 py-3 sm:py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm sm:text-base min-h-[48px] touch-target flex items-center ${
                  activeTab === "analytics"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                📊 Analytics
              </button>
              <button
                onClick={() => { setTabAndHash("employees"); setIsSidebarOpen(false); }}
                className={`w-full text-left px-2 sm:px-3 py-3 sm:py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm sm:text-base min-h-[48px] touch-target flex items-center ${
                  activeTab === "employees"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                👥 Employee Management
              </button>
            </nav>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 hover:bg-red-700 active:bg-red-800 py-3 sm:py-2 rounded text-sm mt-6 min-h-[48px] touch-target w-full flex items-center justify-center"
          >
            Sign Out
          </button>
        </aside>
        {/* Sidebar backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/45"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col glass-scroll motion-reduce:transform-none motion-reduce:transition-none">
          <header className="sticky top-0 z-10 bg-slate-900/70 backdrop-blur-md border-b border-slate-800 text-white px-3 sm:px-5 py-2 shadow-sm flex items-center justify-between pt-[env(safe-area-inset-top)]">
            <div>
              <div className="relative">
                <h1 className="text-white font-semibold text-xl">Distributor Dashboard</h1>
                <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/70">{userData?.businessName}</p>
              <p className="text-xs text-white/50">{auth.currentUser?.email}</p>
              <p className="text-xs text-white/40">ID: {auth.currentUser?.uid}</p>
            </div>
          </header>

          {/* Main Content */}
          <main className="relative pt-2 sm:pt-3 px-2 sm:px-3 md:px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] mx-2 sm:mx-3 mt-1 mb-2 sm:mb-3 overflow-y-auto">
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