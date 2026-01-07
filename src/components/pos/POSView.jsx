import React from "react";
import { motion } from "framer-motion";
import { useMode } from "../mode/ModeProvider";
import { useNavigate } from "react-router-dom";
import POSBilling from "./panel/POSBilling";
import KitchenDisplay from "./panel/KitchenDisplay";
import RestaurantPOS from "./panel/RestaurantPOS";
import { collection, query, where, getDocs, orderBy, limit, startAfter } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

/**
 * POSView (Landing)
 * Cinematic, branded landing for POS. No side panel. Each button opens its own module via props.
 *
 * Props (all optional):
 *  - onBack: () => void
 *  - onOpenBilling: () => void        // Start Billing POS workspace
 *  - onOpenKDS: () => void            // Kitchen Display System
 *  - onOpenTables: () => void         // Table/Section manager
 *  - onOpenQR: () => void             // QR order flow
 */
export default function POSView({ onBack, onOpenBilling, onOpenKDS, onOpenTables, onOpenQR }) {
  const { setMode } = useMode();
  const navigate = useNavigate();

  const [view, setView] = React.useState("landing");

  const openKDS = () => {
    if (onOpenKDS) return onOpenKDS();
    setView("kds");
  };

  const openRestaurant = () => {
    setView("restaurant");
  };

  const inventory = {
    listAll: async () => {
      if (!auth.currentUser) return [];
      const uid = auth.currentUser.uid;
      const baseRef = collection(db, "businesses", uid, "products");
      const pageSize = 500;
      let q = query(baseRef, orderBy("createdAt", "desc"), limit(pageSize));
      const all = [];
      let lastDoc = null;
      let guard = 0;
      while (guard++ < 50) {
        const snap = await getDocs(q);
        if (!snap.size) break;
        all.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
        const ld = snap.docs[snap.docs.length - 1];
        if (!ld || (lastDoc && ld.id === lastDoc.id)) break;
        lastDoc = ld;
        q = query(baseRef, orderBy("createdAt", "desc"), startAfter(ld), limit(pageSize));
      }
      return all;
    },
    searchProducts: async (qText) => {
      if (!auth.currentUser) return [];
      const uid = auth.currentUser.uid;
      const productsRef = collection(db, "businesses", uid, "products");

      // If empty query, return the full list (paged)
      if (!qText || !qText.trim()) {
        return await inventory.listAll();
      }

      // Try search by productName, then by name (fallback)
      const q1 = query(productsRef, where("productName", ">=", qText), where("productName", "<=", qText + "\uf8ff"));
      let snap = await getDocs(q1);
      if (!snap.size) {
        try {
          const q2 = query(productsRef, where("name", ">=", qText), where("name", "<=", qText + "\uf8ff"));
          snap = await getDocs(q2);
        } catch (_) {}
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    listPopular: async (n = 24) => {
      if (!auth.currentUser) return [];
      const uid = auth.currentUser.uid;
      const productsRef = collection(db, "businesses", uid, "products");
      try {
        const snap = await getDocs(query(productsRef, orderBy("createdAt", "desc"), limit(n)));
        if (snap.size) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) { /* field or index might not exist */ }
      // Fallback: return first N without ordering
      const snapAll = await getDocs(productsRef);
      return snapAll.docs.slice(0, n).map(d => ({ id: d.id, ...d.data() }));
    }
  };

  const openBilling = () => {
    if (onOpenBilling) return onOpenBilling();
    setView("billing");
  };

  const safeBack = () => {
    if (onBack) return onBack();
    try {
      if (navigate) {
        navigate("/dashboard");
      }
      if (setMode) setMode("dashboard");
    } catch (_) {
      if (window.history.length > 1) return window.history.back();
      window.location.assign("/dashboard");
    }
  };

  if (view === "billing") {
    return (
      <POSBilling
        mode="retail"
        onBack={() => setView("landing")}
        inventory={inventory}
      />
    );
  }

  if (view === "kds") {
    return (
      <KitchenDisplay
        onBack={() => setView("landing")}
      />
    );
  }

  if (view === "restaurant") {
    return (
      <RestaurantPOS
        onBack={() => setView("landing")}
      />
    );
  }

  // Variants
  const heroTextVariants = {
    animate: {
      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      transition: { duration: 6, repeat: Infinity, ease: "linear" },
    },
  };
  const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
  };
  const staggerItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };
  const featureVariants = {
    hidden: { opacity: 0, y: 10 },
    show: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
  };
  const dockVariants = { initial: { scale: 1 }, hover: { scale: 1.08 } };
  const orbitVariants = {
    initial: { opacity: 0, scale: 0 },
    hover: i => ({
      opacity: 1,
      scale: 1,
      x: 68 * Math.cos((i / 4) * 2 * Math.PI - Math.PI / 2),
      y: 68 * Math.sin((i / 4) * 2 * Math.PI - Math.PI / 2),
      transition: { type: "spring", stiffness: 300, damping: 20, delay: i * 0.08 },
    }),
  };

  return (
    <div className="relative min-h-[calc(100vh-140px)] grid grid-rows-[auto_1fr] gap-4 overflow-hidden">
      {/* Decorative background blobs */}
      <motion.div aria-hidden initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} transition={{duration:0.6}} className="pointer-events-none absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-300/20 to-cyan-400/20 blur-3xl" />
      <motion.div aria-hidden initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} transition={{duration:0.8, delay:0.1}} className="pointer-events-none absolute -bottom-24 -right-24 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-cyan-400/15 via-sky-300/15 to-violet-400/15 blur-3xl" />
      {/* Extra aurora layers */}
      <motion.div aria-hidden initial={{opacity:0}} animate={{opacity:0.15}} transition={{duration:3, repeat:Infinity, repeatType:"reverse"}} className="pointer-events-none absolute top-0 left-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 blur-2xl -translate-x-1/2" />
      <motion.div aria-hidden initial={{opacity:0}} animate={{opacity:0.12}} transition={{duration:4, repeat:Infinity, repeatType:"reverse", delay:1}} className="pointer-events-none absolute bottom-0 right-1/3 w-[700px] h-[350px] rounded-full bg-gradient-to-tr from-blue-400 via-cyan-400 to-green-400 blur-3xl" />

      {/* Gentle starfield sparkles */}
      {[...Array(14)].map((_, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="pointer-events-none absolute w-1 h-1 rounded-full bg-white/70"
          style={{ left: `${(i*7)%100}%`, top: `${(i*13)%90}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 3 + (i%5), delay: i * 0.2, repeat: Infinity }}
        />
      ))}

      {/* Header / Topbar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={safeBack} className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-lg transition">← Back to Dashboard</button>
          <h1 className="text-xl font-semibold flex-1">POS Home</h1>
        </div>
      </div>

      {/* Hero / Welcome */}
      <motion.section className="max-w-7xl mx-auto w-full px-4" initial="hidden" animate="show" variants={staggerContainer}>
        <motion.h2 variants={heroTextVariants} animate="animate" className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-[length:200%_200%] bg-clip-text text-transparent select-none">
          Welcome to FLYP POS
        </motion.h2>
        <motion.p variants={staggerItem} className="mt-2 text-slate-600 dark:text-slate-300 max-w-2xl">
          Fast, flexible, and beautiful point‑of‑sale built on your existing FLYP data. Choose a workspace below to begin.
        </motion.p>
        {/* Primary Actions */}
        <motion.div variants={staggerItem} className="mt-5 flex flex-wrap gap-3">
          <motion.button whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} onClick={openBilling} className="rounded-xl px-4 py-2 font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]">Start Billing</motion.button>
          <motion.button whileTap={{ scale: 0.98 }} whileHover={{ y: -2 }} onClick={openRestaurant} className="rounded-xl px-4 py-2 font-semibold text-white bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:shadow-[0_10px_30px_rgba(249,115,22,0.35)]">Restaurant POS</motion.button>
        </motion.div>
      </motion.section>

      {/* Feature Tiles */}
      <motion.section className="max-w-7xl mx-auto w-full px-4" initial="hidden" animate="show" variants={staggerContainer}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Billing POS */}
          <motion.button custom={0} variants={featureVariants} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={openBilling} className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 text-left transition">
            <div className="text-2xl">🧾</div>
            <div className="mt-2 text-lg font-semibold">Billing POS</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Scan, search, add-to-cart, split payments, GST-aware totals.</div>
            <div className="mt-3 text-sm text-emerald-300 group-hover:translate-x-0.5 transition">Open →</div>
          </motion.button>

          {/* Restaurant POS */}
          <motion.button custom={1} variants={featureVariants} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={openRestaurant} className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 text-left transition">
            <div className="text-2xl">🍽️</div>
            <div className="mt-2 text-lg font-semibold">Restaurant POS</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Table/customer selection, menu ordering, send to kitchen.</div>
            <div className="mt-3 text-sm text-orange-300 group-hover:translate-x-0.5 transition">Open →</div>
          </motion.button>

          {/* KDS */}
          <motion.button custom={2} variants={featureVariants} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={openKDS} className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 text-left transition">
            <div className="text-2xl">👨‍🍳</div>
            <div className="mt-2 text-lg font-semibold">Kitchen Display (KDS)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Live queue by course & station, bump tickets, prep timers.</div>
            <div className="mt-3 text-sm text-emerald-300 group-hover:translate-x-0.5 transition">Open →</div>
          </motion.button>

          {/* QR Orders */}
          <motion.button custom={3} variants={featureVariants} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => onOpenQR && onOpenQR()} className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-5 text-left transition">
            <div className="text-2xl">📱</div>
            <div className="mt-2 text-lg font-semibold">QR Orders</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Self‑serve menus, table QR, live order inbox and confirmations.</div>
            <div className="mt-3 text-sm text-emerald-300 group-hover:translate-x-0.5 transition">Open →</div>
          </motion.button>

          {/* Quick Actions (placeholder now that panel is removed) */}
          <motion.div custom={4} variants={featureVariants} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl">⚡</div>
            <div className="mt-2 text-lg font-semibold">Quick Actions</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Hold/Resume, Fast Checkout, Shortcuts — coming soon.</div>
          </motion.div>

          {/* Settings (placeholder) */}
          <motion.div custom={5} variants={featureVariants} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-2xl">⚙️</div>
            <div className="mt-2 text-lg font-semibold">Settings</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Theme, shortcuts, printers — coming soon.</div>
          </motion.div>
        </div>
      </motion.section>

      {/* Floating action dock (no panel) */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center justify-center">
        <motion.div
          className="relative w-16 h-16 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-xl cursor-pointer flex items-center justify-center text-white font-bold text-lg select-none"
          initial="initial"
          whileHover="hover"
          variants={dockVariants}
          title="FLYP POS"
          aria-label="FLYP POS central button"
        >
          FLYP
          {[0, 1, 2, 3].map(i => (
            <motion.button
              key={i}
              custom={i}
              variants={orbitVariants}
              initial="initial"
              whileHover="hover"
              onClick={e => {
                e.stopPropagation();
                if (i === 0) openBilling();
                else if (i === 1) openRestaurant();
                else if (i === 2) openKDS();
                else if (i === 3) onOpenQR && onOpenQR();
              }}
              className="absolute w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex items-center justify-center text-sm"
              title={ i === 0 ? "Start Billing" : i === 1 ? "Restaurant POS" : i === 2 ? "Kitchen Display System" : "QR Orders" }
              style={{ top: "50%", left: "50%", transformOrigin: "center" }}
            >
              {i === 0 && "🧾"}
              {i === 1 && "🍽️"}
              {i === 2 && "👨‍🍳"}
              {i === 3 && "📱"}
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
