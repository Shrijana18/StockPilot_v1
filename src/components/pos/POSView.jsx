import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMode } from "../mode/ModeProvider";
import { useNavigate } from "react-router-dom";
import POSBilling from "./panel/POSBilling";
import KitchenDisplay from "./panel/KitchenDisplay";
import RestaurantPOS from "./panel/RestaurantPOS";
import CreateMenu from "./panel/CreateMenu";
import RestaurantInvoicesPanel from "./panel/RestaurantInvoicesPanel";
import QROrderManager from "./panel/QROrderManager";
import OnlineOrdersPanel from "./panel/OnlineOrdersPanel";
import AnalyticsPanel from "./panel/AnalyticsPanel";
import StaffManagement from "./panel/StaffManagement";
import RestaurantSettings from "./panel/RestaurantSettings";
import { collection, query, where, getDocs, orderBy, limit, startAfter, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import { POSThemeProvider, usePOSTheme, THEMES } from "./POSThemeContext";

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

// ─── Theme Toggle component ───────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme, tc } = usePOSTheme();
  return (
    <div className={`flex items-center gap-0.5 p-0.5 rounded-xl border ${tc.themeBtn}`}>
      {Object.values(THEMES).map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.label}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[9px] text-[10px] font-bold transition-all duration-150 ${
            theme === t.id
              ? `${tc.themeBtnActive} ${tc.textPrimary}`
              : `${tc.themeBtnText} hover:scale-105`
          }`}
        >
          <span>{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Generic split-pane hub ───────────────────────────────────────────────────
function SplitHub({ title, subtitle, icon, navItems, renderContent, defaultKey, onBack }) {
  const [activeKey, setActiveKey] = React.useState(defaultKey || navItems.find(n => !n.disabled)?.key);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const { tc } = usePOSTheme();
  const [bizProfile, setBizProfile] = React.useState(null);

  React.useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "businesses", uid)).then(snap => {
      if (snap.exists()) setBizProfile(snap.data());
    }).catch(() => {});
  }, []);

  const bizName = bizProfile?.businessInfo?.name || bizProfile?.businessName || bizProfile?.name || null;
  const bizType = bizProfile?.businessType || bizProfile?.role || null;
  const bizInitial = bizName ? bizName.charAt(0).toUpperCase() : null;

  return (
    <div className="w-full min-h-screen flex flex-col relative overflow-hidden" style={tc.bg}>
      {/* Aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 w-[55%] h-[55%] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 70%)` }} />
        <div className="absolute bottom-0 -left-24 w-[45%] h-[45%] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 70%)` }} />
      </div>

      {/* ── Header ── */}
      <div className={`flex-none z-20 ${tc.headerBg}`}>
        <div className="px-4 h-14 flex items-center gap-3">
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.04, x: -1 }}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex-none ${tc.backBtn}`}
          >
            <span className="text-[10px]">←</span> POS Home
          </motion.button>
          <div className={`w-px h-5 flex-none ${tc.divider}`} />

          {/* Business branding area */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {bizName ? (
              <>
                {/* Business avatar */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-none shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white select-none">
                  {bizInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold leading-tight truncate ${tc.textPrimary}`}>{bizName}</div>
                  <div className={`text-[10px] leading-tight truncate ${tc.textMuted}`}>{title} · {bizType || "POS"}</div>
                </div>
                {/* Section badge */}
                <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex-none ${tc.mutedBg} border ${tc.borderSoft} ${tc.textSub}`}>
                  <span>{icon}</span>
                  <span>{title}</span>
                </div>
              </>
            ) : (
              <>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-sm flex-none ${tc.iconBoxBg}`}>{icon}</div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold leading-tight truncate ${tc.textPrimary}`}>{title}</div>
                  <div className={`text-[10px] leading-tight truncate ${tc.textMuted}`}>{subtitle}</div>
                </div>
              </>
            )}
          </div>

          <ThemeToggle />
        </div>
      </div>

      {/* Split body */}
      <div className="flex-1 flex overflow-hidden relative z-10" style={{ minHeight: 0 }}>
        {/* ── Left sidebar — collapsible ── */}
        <motion.nav
          animate={{ width: sidebarCollapsed ? 64 : 220 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className={`flex-none flex flex-col overflow-y-auto overflow-x-hidden ${tc.sidebarBg}`}
          style={{ scrollbarWidth: "none", minWidth: 0 }}
        >
          {/* Collapse toggle */}
          <div className={`px-2 pt-3 pb-2.5 flex ${sidebarCollapsed ? "justify-center" : "justify-end pr-3"} border-b ${tc.borderSoft}`}>
            <motion.button
              onClick={() => setSidebarCollapsed(c => !c)}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] transition-all ${tc.editBtn}`}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <motion.span
                animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className="inline-block"
              >◀</motion.span>
            </motion.button>
          </div>

          {/* Nav section label */}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-4 pt-3 pb-1.5"
              >
                <span className={`text-[9px] font-black tracking-[0.18em] uppercase ${tc.textMuted}`}>Navigation</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nav items */}
          <div className={`${sidebarCollapsed ? "px-1.5" : "px-2.5"} pb-3 flex flex-col gap-0.5 flex-1 pt-1.5`}>
            {navItems.map((item, index) => {
              const isActive = activeKey === item.key;
              return (
                <motion.button
                  key={item.key}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.045, type: "spring", stiffness: 420, damping: 26 }}
                  onClick={() => !item.disabled && setActiveKey(item.key)}
                  disabled={item.disabled}
                  title={sidebarCollapsed ? item.label : ""}
                  className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "px-0 justify-center" : "px-3"} py-2.5 rounded-xl text-left transition-all duration-150 relative ${
                    item.disabled
                      ? `opacity-25 cursor-not-allowed ${tc.textMuted}`
                      : isActive
                        ? tc.navActive(item.accent)
                        : `${tc.navInactive} ${tc.navHover(item.accent)}`
                  }`}
                >
                  {/* Icon box */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[17px] flex-none transition-all duration-150 ${
                    isActive ? "bg-white/20 shadow-sm" : "bg-white/[0.06]"
                  }`}>
                    {item.icon}
                  </div>

                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="min-w-0 flex-1 overflow-hidden"
                      >
                        <div className="text-[13px] font-semibold truncate leading-tight whitespace-nowrap">{item.label}</div>
                        {item.badge && (
                          <span className={`text-[10px] font-medium leading-none ${tc.textMuted}`}>{item.badge}</span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isActive && !item.disabled && !sidebarCollapsed && (
                    <motion.div
                      layoutId="posNavActiveDot"
                      className={`w-2 h-2 rounded-full flex-none ${tc.navActiveDot(item.accent)}`}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Sidebar footer — FLYP branding */}
          <div className={`${sidebarCollapsed ? "px-1.5 py-3" : "px-4 py-3.5"} border-t ${tc.borderSoft}`}>
            {sidebarCollapsed ? (
              <div className="flex justify-center">
                <img src="/assets/flyp_logo.png" alt="FLYP"
                  className="h-7 w-7 object-contain opacity-50"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <img src="/assets/flyp_logo.png" alt="FLYP"
                  className="h-8 w-8 object-contain flex-none"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="min-w-0">
                  <div className={`text-[10px] font-black tracking-[0.12em] uppercase ${tc.footerBrand}`}>Powered by FLYP</div>
                  <div className={`text-[9px] mt-0.5 ${tc.textMuted} opacity-55`}>Restaurant POS Suite</div>
                </div>
              </div>
            )}
          </div>
        </motion.nav>

        {/* ── Right content panel ── */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="flex-1 overflow-hidden flex flex-col h-full"
            >
              {activeKey
                ? renderContent(activeKey, setActiveKey)
                : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="text-5xl mb-4 opacity-20">👈</div>
                    <div className={`text-sm ${tc.textMuted}`}>Select a section from the sidebar</div>
                  </div>
                )
              }
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Restaurant Hub ───────────────────────────────────────────────────────────
function RestaurantHub({ onBack, inventory }) {
  const routerNavigate = useNavigate();
  const navItems = [
    { key: "restaurant", icon: "🪑", label: "Tables & Orders",       accent: "orange"  },
    { key: "kds",        icon: "👨‍🍳", label: "Kitchen Display",       accent: "blue"    },
    { key: "kds-menu",   icon: "📜", label: "Menu Builder",           accent: "purple"  },
    { key: "invoices",   icon: "📄", label: "Invoices",               accent: "emerald" },
    { key: "qr",         icon: "📱", label: "QR Orders",              accent: "emerald" },
    { key: "online",     icon: "🛵", label: "Online Orders",           accent: "orange"  },
    { key: "analytics",  icon: "📊", label: "Analytics",               accent: "violet"  },
    { key: "staff",      icon: "👥", label: "Staff",                   accent: "blue"    },
    { key: "settings",   icon: "⚙️", label: "Settings",               accent: "emerald" },
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
      case "online":
        return <OnlineOrdersPanel />;
      case "analytics":
        return <AnalyticsPanel />;
      case "staff":
        return <StaffManagement />;
      case "settings":
        return <RestaurantSettings />;
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
function POSViewInner({ onBack }) {
  const { setMode } = useMode();
  const navigate = useNavigate();
  const { tc } = usePOSTheme();

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

  // ── Landing ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative" style={tc.bg}>
      {/* Aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-16 w-[55%] h-[55%] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -right-16 w-[50%] h-[50%] rounded-full blur-[120px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
      </div>

      {/* Top bar */}
      <div className={`relative z-10 flex items-center px-5 py-3.5 border-b ${tc.borderSoft} ${tc.headerBg}`}>
        <motion.button
          onClick={safeBack}
          whileHover={{ scale: 1.04, x: -1 }}
          whileTap={{ scale: 0.97 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${tc.backBtn}`}
        >
          ← Dashboard
        </motion.button>
        <div className="flex-1" />
        <ThemeToggle />
        <div className="flex items-center gap-2 ml-4">
          <img src="/assets/flyp_logo.png" alt="FLYP" className="h-7 w-7 object-contain"
            onError={e => { e.target.style.display = 'none'; }} />
          <div className={`text-[11px] font-black tracking-widest uppercase ${tc.footerBrand}`}>FLYP POS</div>
        </div>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="text-center mb-12"
        >
          {/* FLYP Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.05 }}
            className="flex justify-center mb-5"
          >
            <img
              src="/assets/flyp_logo.png"
              alt="FLYP"
              className="w-20 h-20 object-contain drop-shadow-[0_0_28px_rgba(16,185,129,0.45)]"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </motion.div>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-400/20 bg-orange-500/[0.08] text-[10px] font-bold text-orange-400 tracking-widest uppercase mb-5`}>
            🍽️ Point of Sale System
          </div>
          <h1 className={`text-5xl md:text-6xl font-black tracking-tight leading-none mb-3 ${tc.textPrimary}`}>
            FLYP{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">
              POS
            </span>
          </h1>
          <p className={`text-sm max-w-xs mx-auto leading-relaxed mt-3 ${tc.textSub}`}>
            Built on your FLYP data. Choose your workspace below.
          </p>
        </motion.div>

        {/* 2 cards */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Billing POS */}
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12, type: "spring", stiffness: 260, damping: 22 }}
            whileHover={{ y: -5, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView("billing-hub")}
            className={`group relative rounded-2xl border p-6 text-left overflow-hidden transition-all duration-200 shadow-sm ${tc.cardBg} ${tc.landingCardHover}`}
          >
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-emerald-500 to-teal-400 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/20 flex items-center justify-center text-2xl mb-5 shadow-sm">🧾</div>
            <div className={`text-base font-bold mb-1.5 ${tc.textPrimary}`}>Billing POS</div>
            <div className={`text-xs leading-relaxed mb-5 ${tc.textSub}`}>
              Counter billing for shops & quick service. Fast checkout with GST.
            </div>
            <ul className="space-y-2 mb-5">
              {["Scan & search products", "GST-aware checkout", "Invoice history"].map(f => (
                <li key={f} className={`flex items-center gap-2.5 text-[11px] ${tc.textSub}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-none" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 group-hover:gap-3 transition-all">
              Launch <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </div>
          </motion.button>

          {/* Restaurant POS */}
          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.22, type: "spring", stiffness: 260, damping: 22 }}
            whileHover={{ y: -5, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView("restaurant-hub")}
            className={`group relative rounded-2xl border p-6 text-left overflow-hidden transition-all duration-200 shadow-sm ${tc.cardBg} ${tc.landingCardHoverRest}`}
          >
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-orange-500 to-amber-400 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-400/20 flex items-center justify-center text-2xl mb-5 shadow-sm">🍽️</div>
            <div className={`text-base font-bold mb-1.5 ${tc.textPrimary}`}>Restaurant POS</div>
            <div className={`text-xs leading-relaxed mb-5 ${tc.textSub}`}>
              Full dine-in for restaurants & cafes. Tables, kitchen & menu.
            </div>
            <ul className="space-y-2 mb-5">
              {["Table & order management", "Kitchen Display (KDS)", "Menu builder & QR orders"].map(f => (
                <li key={f} className={`flex items-center gap-2.5 text-[11px] ${tc.textSub}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-none" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-500 group-hover:gap-3 transition-all">
              Launch <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default function POSView({ onBack }) {
  return (
    <POSThemeProvider>
      <POSViewInner onBack={onBack} />
    </POSThemeProvider>
  );
}
