import React, { useEffect, useState, useRef } from "react";
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

  // Utility: ignore global shortcuts while typing in inputs/fields
  const isTypingTarget = (e) => {
    const tag = (e?.target?.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e?.target?.isContentEditable === true);
  };

  // --- UI-only: small presentational components for polish ---
  const KPICard = ({ label, value, subtitle, loading }) => (
    <div className="flex-1 min-w-[180px] rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-semibold ${loading ? 'animate-pulse text-white/40' : 'text-white'}`}>{value}</span>
        {subtitle && <span className="text-xs text-emerald-300">{subtitle}</span>}
      </div>
    </div>
  );

  const SectionTitle = ({ title, desc, icon }) => (
    <div className="mb-4 flex items-start gap-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">{title}</h3>
        {desc && <p className="text-sm text-white/70 mt-0.5">{desc}</p>}
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
    { id: 'retailerRequests', label: 'Retailer Requests' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'dispatch', label: 'Dispatch Tracker' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'manageRetailers', label: 'Manage Retailers' },
  ];

  // --- UI-only: tab order for numeric shortcuts
  const TAB_KEYS = ['dashboard','retailerRequests','inventory','dispatch','analytics','manageRetailers'];

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

  // Keyboard shortcuts: 1–6 to switch tabs; "g r"=Retailer Requests, "g i"=Inventory, "g d"=Dispatch, "g a"=Analytics, "g m"=Manage
  const lastKeyRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (e) => {
      // ⛔️ Don't trigger shortcuts while the user is typing
      if (isTypingTarget(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if (/^[1-6]$/.test(key)) {
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
          else if (key === 'm') setTabAndHash('manageRetailers');
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
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#0B1220] via-[#0F1A2A] to-[#0B1220] text-white font-sans transition-all duration-300 ease-in-out page-noise">
        {/* Sidebar */}
        <aside className="w-64 bg-gradient-to-b from-[#0D1524] via-[#0B1220] to-[#0B1220] backdrop-blur-md text-white shadow-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-wide text-white mb-6">FLYP</h2>
            <nav className="space-y-4 mt-20">
              <button
                onClick={() => setTabAndHash("dashboard")}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 ${
                  activeTab === "dashboard"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                🏠 Dashboard
              </button>
              <button
                onClick={() => setTabAndHash("retailerRequests")}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 ${
                  activeTab === "retailerRequests"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                📥 Retailer Requests
              </button>
              <button
                onClick={() => setTabAndHash("inventory")}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 ${
                  activeTab === "inventory"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                📦 Inventory
              </button>
              <button
                onClick={() => setTabAndHash("dispatch")}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 ${
                  activeTab === "dispatch"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                🚚 Dispatch Tracker
              </button>
              <button
                onClick={() => setTabAndHash("analytics")}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 ${
                  activeTab === "analytics"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
                }`}
              >
                📊 Analytics
              </button>
              <button
                onClick={() => setTabAndHash("manageRetailers")}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-transform duration-200 hover:scale-[1.02] hover:bg-white/5 ${
                  activeTab === "manageRetailers"
                    ? "border-l-4 border-emerald-300 bg-white/10 shadow-inner text-white"
                    : "text-white"
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
        <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col glass-scroll motion-reduce:transform-none motion-reduce:transition-none">
          <header className="sticky top-0 z-10 bg-slate-900/70 backdrop-blur-md border-b border-slate-800 text-white px-5 py-3 shadow-sm flex items-center justify-between">
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
          <main className="relative p-4 md:p-6 m-4">
            {showGreeting && (
              <div className="absolute top-3 right-6 bg-white/10 text-white px-4 py-2 rounded-lg shadow backdrop-blur-md z-20 animate-fade-in-out">
                👋 Welcome back, {userData?.ownerName || "Partner"}
              </div>
            )}
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="grid grid-cols-1 gap-4">
                    <GlassCard className="p-6">
                      <DistributorHome />
                    </GlassCard>
                  </div>
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

            {isPaletteOpen && (
              <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24">
                <div className="absolute inset-0 bg-black/50" onClick={() => setPaletteOpen(false)} />
                <div className="relative w-[90%] max-w-xl rounded-2xl border border-white/10 bg-[#0B0F14]/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                  <div className="p-3 border-b border-white/10">
                    <input autoFocus placeholder="Jump to… (1–6, g+r/i/d/a/m, ⌘/Ctrl+K)" className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
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
          </main>
        </div>
      </div>
    </>
  );
};

export default DistributorDashboard;