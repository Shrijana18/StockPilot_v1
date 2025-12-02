import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useTranslation } from "react-i18next";

// Import Product Owner components
import ProductOwnerHome from "./productowner/ProductOwnerHome";
import DistributorConnection from "./productowner/DistributorConnection";
import ProductOwnerInventory from "./productowner/ProductOwnerInventory";
import ProgressTracking from "./productowner/ProgressTracking";
import AutomationTracking from "./productowner/AutomationTracking";
import ProfileSettings from "./profile/ProfileSettings";

const ProductOwnerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const db = getFirestore();

  // Utility: ignore global shortcuts while typing in inputs/fields
  const isTypingTarget = (e) => {
    const tag = (e?.target?.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e?.target?.isContentEditable === true);
  };

  // Deep link support: sync sidebar with ?tab= in the hash
  const idToUrlTab = {
    home: 'home',
    distributors: 'distributors',
    inventory: 'inventory',
    progress: 'progress',
    automation: 'automation',
    profile: 'profile',
  };

  const urlTabToId = {
    'home': 'home',
    'distributors': 'distributors',
    'inventory': 'inventory',
    'progress': 'progress',
    'automation': 'automation',
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
      const hash = window.location.hash || '#/product-owner-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      const urlTab = idToUrlTab[id] || 'home';
      params.set('tab', urlTab);
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) window.history.replaceState(null, '', newHash);
    } catch {}
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const businessDocRef = doc(db, "businesses", user.uid);
      const businessDocSnap = await getDoc(businessDocRef);
      if (businessDocSnap.exists()) {
        setUserData(businessDocSnap.data());
      }
    };

    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Keyboard shortcuts
  const lastKeyRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();

      if (/^[1-6]$/.test(key)) {
        const tabs = ['home', 'distributors', 'inventory', 'progress', 'automation', 'profile'];
        const idx = parseInt(key, 10) - 1;
        if (tabs[idx]) setTabAndHash(tabs[idx]);
        return;
      }

      // Command palette: "g" + key
      const now = Date.now();
      if (lastKeyRef.current && now - lastKeyRef.current.time < 900) {
        const first = lastKeyRef.current.key;
        lastKeyRef.current = null;
        if (first === 'g') {
          if (key === 'h') setTabAndHash('home');
          else if (key === 'd') setTabAndHash('distributors');
          else if (key === 'i') setTabAndHash('inventory');
          else if (key === 'p') setTabAndHash('progress');
          else if (key === 'a') setTabAndHash('automation');
        }
        return;
      }
      if (key === 'g') lastKeyRef.current = { key: 'g', time: now };
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const sidebarItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'distributors', label: 'Distributors', icon: '👥' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'progress', label: 'Progress', icon: '📊' },
    { id: 'automation', label: 'Automation', icon: '🤖' },
    { id: 'profile', label: 'Profile', icon: '⚙️' },
  ];

  const scene = {
    initial: { opacity: 0, y: 14 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  return (
    <div className="flex min-h-[100dvh] w-full relative overflow-x-hidden overflow-y-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:static z-30 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 flex flex-col h-screen transition-transform duration-300 ease-in-out`}
      >
        <div className="p-4 border-b border-white/10">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-cyan-300">
            Product Owner
          </h2>
          <p className="text-xs text-white/60 mt-1">Production Dashboard</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTabAndHash(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-[1.02] hover:bg-white/5 active:bg-white/10 text-sm flex items-center gap-3 ${
                activeTab === item.id
                  ? "bg-emerald-500/20 border-l-4 border-emerald-400 text-emerald-300 shadow-lg"
                  : "text-white/80"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3 text-xs text-white/60">
            <p className="font-medium text-white/80">{userData?.businessName || "Business"}</p>
            <p className="text-white/50">{auth.currentUser?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 py-2 px-4 rounded-lg text-red-300 text-sm transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sidebar backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/45 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col glass-scroll">
        <header className="sticky top-0 z-10 bg-slate-900/70 backdrop-blur-md border-b border-slate-800 text-white px-4 sm:px-6 py-3 shadow-sm flex items-center justify-between pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
            >
              <span className="text-xl">☰</span>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Product Owner Dashboard</h1>
              <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/70">{userData?.businessName || "Business"}</p>
            <p className="text-xs text-white/50">{auth.currentUser?.email}</p>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-2 sm:p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={scene}
              initial="initial"
              animate="enter"
              exit="exit"
            >
              {activeTab === "home" && <ProductOwnerHome />}
              {activeTab === "distributors" && <DistributorConnection />}
              {activeTab === "inventory" && <ProductOwnerInventory />}
              {activeTab === "progress" && <ProgressTracking />}
              {activeTab === "automation" && <AutomationTracking />}
              {activeTab === "profile" && <ProfileSettings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProductOwnerDashboard;
