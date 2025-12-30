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
import RetailerConnection from "./productowner/RetailerConnection";
import ProductOwnerInventory from "./productowner/ProductOwnerInventory";
import ProgressTracking from "./productowner/ProgressTracking";
import AutomationTracking from "./productowner/AutomationTracking";
import ProfileSettings from "./profile/ProfileSettings";

const ProductOwnerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Hidden by default on all screens
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
    retailers: 'retailers',
    inventory: 'inventory',
    progress: 'progress',
    automation: 'automation',
    profile: 'profile',
  };

  const urlTabToId = {
    'home': 'home',
    'distributors': 'distributors',
    'retailers': 'retailers',
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

      if (/^[1-7]$/.test(key)) {
        const tabs = ['home', 'distributors', 'retailers', 'inventory', 'progress', 'automation', 'profile'];
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
          else if (key === 'r') setTabAndHash('retailers');
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
    { id: 'retailers', label: 'Retailers', icon: '🏪' },
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
    <>
      <style>{`
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

        .flyp-menu-enter {
          animation: flypMenuEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .flyp-menu-exit {
          animation: flypMenuExit 0.4s cubic-bezier(0.55, 0.06, 0.68, 0.19) forwards;
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

        /* Menu item stagger animation */
        @keyframes menuItemFlyIn {
          0% {
            opacity: 0;
            transform: translateX(-20px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .menu-item-animate {
          animation: menuItemFlyIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
      `}</style>
      <div className="flex min-h-[100dvh] w-full relative overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white">
        {/* Sidebar - Fixed position with FLYP flight animation */}
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
            className="fixed left-0 top-0 bottom-0 z-30 w-64 bg-gradient-to-br from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-2xl border-r border-emerald-500/20 flex flex-col h-screen flyp-sidebar-glow"
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
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 relative z-10">
            Product Owner
          </h2>
          <p className="text-xs text-white/60 mt-1 relative z-10">Production Dashboard</p>
          {/* Decorative line */}
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
              <span className="relative z-10">{item.label}</span>
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
          <div className="mb-3 text-xs text-white/60">
            <p className="font-medium text-white/80">{userData?.businessName || "Business"}</p>
            <p className="text-white/50">{auth.currentUser?.email}</p>
          </div>
          <motion.button
            onClick={handleSignOut}
            className="w-full bg-gradient-to-r from-red-600/20 to-red-500/20 hover:from-red-600/30 hover:to-red-500/30 border border-red-500/30 py-2 px-4 rounded-lg text-red-300 text-sm transition-all relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="relative z-10">Sign Out</span>
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

      {/* Sidebar backdrop - shows on all screens when sidebar is open */}
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
            {/* Subtle gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Full width (sidebar is overlay) */}
      <div className="flex-1 overflow-y-auto transition-all duration-300 ease-in-out flex flex-col h-screen w-full">
        <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/50 text-white px-4 sm:px-6 py-3 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flyp-menu-trigger flex items-center gap-3 px-4 py-2 hover:bg-white/10 rounded-xl transition-all relative group"
              aria-label="Toggle sidebar"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* FLYP Text - Shows when closed */}
              <AnimatePresence mode="wait">
                {!isSidebarOpen && (
                  <motion.span
                    key="flyp-text"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 tracking-wide"
                  >
                    FLYP
                  </motion.span>
                )}
              </AnimatePresence>
              
              {/* Hamburger Icon - Always visible, transforms to X when open */}
              <div className="relative w-6 h-6 flex flex-col justify-center gap-1.5">
                <motion.span
                  className="hamburger-line w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                  animate={{
                    rotate: isSidebarOpen ? 45 : 0,
                    y: isSidebarOpen ? 8 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
                <motion.span
                  className="hamburger-line w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                  animate={{
                    opacity: isSidebarOpen ? 0 : 1,
                    scaleX: isSidebarOpen ? 0 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="hamburger-line w-6 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                  animate={{
                    rotate: isSidebarOpen ? -45 : 0,
                    y: isSidebarOpen ? -8 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </div>
              
              {/* Glow effect when open */}
              {isSidebarOpen && (
                <motion.div
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-xl -z-10"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1.2 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </motion.button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-cyan-300">
                Product Owner Dashboard
              </h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm text-white/80 font-medium">{userData?.businessName || "Business"}</p>
            <p className="text-xs text-white/50">{auth.currentUser?.email}</p>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
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
              {activeTab === "retailers" && <RetailerConnection />}
              {activeTab === "inventory" && <ProductOwnerInventory />}
              {activeTab === "progress" && <ProgressTracking />}
              {activeTab === "automation" && <AutomationTracking />}
              {activeTab === "profile" && <ProfileSettings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    </>
  );
};

export default ProductOwnerDashboard;
