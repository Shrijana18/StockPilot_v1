import React from "react";
import { motion } from "framer-motion";
import { useMode } from "../mode/ModeProvider";
import { useNavigate } from "react-router-dom";
import POSBilling from "./panel/POSBilling";
import KitchenDisplay from "./panel/KitchenDisplay";
import RestaurantPOS from "./panel/RestaurantPOS";
import CreateMenu from "./panel/CreateMenu";
import RestaurantInvoicesPanel from "./panel/RestaurantInvoicesPanel";
import QROrderManager from "./panel/QROrderManager";
import { collection, query, where, getDocs, orderBy, limit, startAfter } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

// ─── Shared inventory helper (used by POSBilling) ───────────────────────────
function buildInventory() {
  return {
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
      if (!qText?.trim()) return buildInventory().listAll();
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
      } catch (_) {}
      const snapAll = await getDocs(productsRef);
      return snapAll.docs.slice(0, n).map(d => ({ id: d.id, ...d.data() }));
    },
  };
}

// ─── Shared nav item accent colours ─────────────────────────────────────────
const NAV_ACCENT = {
  orange:  { active: "bg-orange-500/15 border-l-2 border-orange-400 text-orange-300",  dot: "bg-orange-400" },
  emerald: { active: "bg-emerald-500/15 border-l-2 border-emerald-400 text-emerald-300", dot: "bg-emerald-400" },
  blue:    { active: "bg-blue-500/15 border-l-2 border-blue-400 text-blue-300",    dot: "bg-blue-400" },
  purple:  { active: "bg-purple-500/15 border-l-2 border-purple-400 text-purple-300",  dot: "bg-purple-400" },
};

// ─── Generic split-pane hub ───────────────────────────────────────────────────
function SplitHub({ title, subtitle, icon, navItems, renderContent, defaultKey, onBack }) {
  const [activeKey, setActiveKey] = React.useState(defaultKey || navItems.find(n => !n.disabled)?.key);

  return (
    <div className="w-full min-h-screen bg-slate-900 flex flex-col">
      {/* Header bar */}
      <div className="flex-none border-b border-white/10 bg-slate-900/90 backdrop-blur-xl z-20">
        <div className="px-4 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition"
          >
            ← POS Home
          </button>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-lg">{icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white leading-tight truncate">{title}</div>
            <div className="text-[11px] text-white/35 truncate">{subtitle}</div>
          </div>
        </div>
      </div>

      {/* Split body */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* ── Left sidebar ── */}
        <nav className="w-52 flex-none border-r border-white/10 bg-slate-800/40 flex flex-col overflow-y-auto">
          <div className="p-2 flex flex-col gap-0.5">
            {navItems.map(item => {
              const isActive = activeKey === item.key;
              const accent = NAV_ACCENT[item.accent] || NAV_ACCENT.emerald;
              return (
                <button
                  key={item.key}
                  onClick={() => !item.disabled && setActiveKey(item.key)}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150 ${
                    item.disabled
                      ? "opacity-35 cursor-not-allowed"
                      : isActive
                        ? accent.active
                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <span className="text-xl flex-none">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${isActive ? "" : "text-inherit"}`}>
                      {item.label}
                    </div>
                    {item.badge && (
                      <span className="text-[10px] text-white/30">{item.badge}</span>
                    )}
                  </div>
                  {isActive && !item.disabled && (
                    <div className={`w-1.5 h-1.5 rounded-full flex-none ${accent.dot}`} />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Right content panel ── */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          {activeKey
            ? renderContent(activeKey, setActiveKey)
            : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="text-5xl mb-4 opacity-20">👈</div>
                <div className="text-white/30 text-sm">Select a section from the sidebar</div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ─── Restaurant Hub ───────────────────────────────────────────────────────────
function RestaurantHub({ onBack, inventory }) {
  const routerNavigate = useNavigate();
  const navItems = [
    { key: "restaurant", icon: "🪑", label: "Tables & Orders",       accent: "orange" },
    { key: "kds",        icon: "👨‍🍳", label: "Kitchen Display (KDS)", accent: "blue"   },
    { key: "kds-menu",   icon: "📜", label: "Menu Builder",           accent: "purple" },
    { key: "invoices",   icon: "📄", label: "Invoices",               accent: "emerald" },
    { key: "qr",         icon: "📱", label: "QR Orders",              accent: "emerald" },
  ];

  const renderContent = (key, navigate) => {
    switch (key) {
      case "restaurant":
        return (
          <RestaurantPOS
            onBack={() => navigate(null)}
            onOpenMenuBuilder={() => navigate("kds-menu")}
          />
        );
      case "kds":
        return <KitchenDisplay />;
      case "kds-menu":
        return <CreateMenu />;
      case "invoices":
        return <RestaurantInvoicesPanel />;
      case "qr":
        return <QROrderManager />;
      default:
        return null;
    }
  };

  return (
    <SplitHub
      title="Restaurant POS"
      subtitle="Tables, kitchen display, menu builder & QR ordering"
      icon="🍽️"
      navItems={navItems}
      renderContent={renderContent}
      defaultKey="restaurant"
      onBack={onBack}
    />
  );
}

// ─── Billing Hub ──────────────────────────────────────────────────────────────
function BillingHub({ onBack, inventory, navigate }) {
  const navItems = [
    { key: "billing",  icon: "⚡", label: "Quick Billing",   accent: "emerald" },
    { key: "invoices", icon: "📄", label: "Invoice History", accent: "blue"    },
    { key: "split",    icon: "💳", label: "Split Payments",  accent: "purple", disabled: true, badge: "Coming soon" },
    { key: "reports",  icon: "📊", label: "Sales Reports",   accent: "emerald", disabled: true, badge: "Coming soon" },
  ];

  const renderContent = (key) => {
    switch (key) {
      case "billing":
        return <POSBilling mode="retail" onBack={null} inventory={inventory} />;
      case "invoices":
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="text-5xl">📄</div>
            <div className="text-white font-semibold text-lg">Invoice History</div>
            <div className="text-white/50 text-sm text-center max-w-xs">
              View all past invoices for your business in the Invoices page.
            </div>
            <button
              onClick={() => { try { navigate("/invoices"); } catch (_) { window.location.assign("/invoices"); } }}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition"
            >
              Open Invoices →
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SplitHub
      title="Billing POS"
      subtitle="Counter billing, invoices & payments"
      icon="🧾"
      navItems={navItems}
      renderContent={renderContent}
      defaultKey="billing"
      onBack={onBack}
    />
  );
}

// ─── Main POSView ────────────────────────────────────────────────────────────
export default function POSView({ onBack }) {
  const { setMode } = useMode();
  const navigate = useNavigate();

  // views: landing | billing-hub | restaurant-hub
  const [view, setView] = React.useState("landing");
  const inventory = React.useMemo(() => buildInventory(), []);

  const safeBack = () => {
    if (onBack) return onBack();
    try { navigate("/dashboard"); if (setMode) setMode("dashboard"); }
    catch (_) { window.location.assign("/dashboard"); }
  };

  if (view === "restaurant-hub") {
    return <RestaurantHub onBack={() => setView("landing")} inventory={inventory} />;
  }

  if (view === "billing-hub") {
    return <BillingHub onBack={() => setView("landing")} inventory={inventory} navigate={navigate} />;
  }

  // ── Landing ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Original aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-emerald-400/20 via-teal-300/20 to-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-cyan-400/15 via-sky-300/15 to-violet-400/15 blur-3xl" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-r from-purple-400/10 via-pink-400/10 to-red-400/10 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center px-6 py-4">
        <button
          onClick={safeBack}
          className="flex items-center gap-1.5 text-white/35 hover:text-white/65 text-xs font-medium transition"
        >
          ← Dashboard
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[11px] font-semibold text-white/25 tracking-widest uppercase">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          FLYP POS
        </div>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[10px] font-bold text-white/40 tracking-widest uppercase mb-5">
            Point of Sale System
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none mb-3">
            FLYP{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              POS
            </span>
          </h1>
          <p className="text-white/35 text-sm max-w-xs mx-auto leading-relaxed">
            Built on your FLYP data. Choose your workspace.
          </p>
        </motion.div>

        {/* 2 cards */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Billing POS */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView("billing-hub")}
            className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-left overflow-hidden hover:border-emerald-500/35 hover:bg-white/[0.04] transition-all duration-200"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl mb-4 mt-1">🧾</div>
            <div className="text-base font-bold text-white mb-1">Billing POS</div>
            <div className="text-xs text-white/40 leading-relaxed mb-5">
              Counter billing for shops & quick service. Fast checkout with GST.
            </div>
            <ul className="space-y-2 mb-5">
              {["Scan & search products", "GST-aware checkout", "Invoice history"].map(f => (
                <li key={f} className="flex items-center gap-2 text-[11px] text-white/45">
                  <div className="w-[5px] h-[5px] rounded-full bg-emerald-400 flex-none" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:gap-2.5 transition-all">
              Launch <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
            </div>
          </motion.button>

          {/* Restaurant POS */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView("restaurant-hub")}
            className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-left overflow-hidden hover:border-orange-500/35 hover:bg-white/[0.04] transition-all duration-200"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500 to-red-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl mb-4 mt-1">🍽️</div>
            <div className="text-base font-bold text-white mb-1">Restaurant POS</div>
            <div className="text-xs text-white/40 leading-relaxed mb-5">
              Full dine-in for restaurants & cafes. Tables, kitchen & menu.
            </div>
            <ul className="space-y-2 mb-5">
              {["Table & order management", "Kitchen Display (KDS)", "Menu builder & QR orders"].map(f => (
                <li key={f} className="flex items-center gap-2 text-[11px] text-white/45">
                  <div className="w-[5px] h-[5px] rounded-full bg-orange-400 flex-none" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 group-hover:gap-2.5 transition-all">
              Launch <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
