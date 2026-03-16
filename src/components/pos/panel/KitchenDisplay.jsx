import React from "react";
import { motion } from "framer-motion";
import CreateMenu from "./CreateMenu";
import KitchenOrderBoard from "./KitchenOrderBoard";
import { usePOSTheme } from "../POSThemeContext";

/**
 * KitchenDisplay (Landing Hub)
 * ---------------------------------------------------------------
 * Main hub for Kitchen Display System
 * - Menu Builder
 * - Order Board (KDS)
 * - Settings (coming soon)
 */
export default function KitchenDisplay({ onBack }) {
  const { tc } = usePOSTheme();
  const [mode, setMode] = React.useState("orders"); // 'home' | 'menu' | 'orders'

  if (mode === "menu") {
    return <CreateMenu onBack={() => setMode("home")} />;
  }

  if (mode === "orders") {
    return <KitchenOrderBoard onBack={() => setMode("home")} />;
  }

  return (
    <div className="relative w-full h-full min-h-screen overflow-y-auto" style={tc.bg}>
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -right-16 w-[55%] h-[55%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
      </div>

      {/* Top Bar */}
      <div className={`sticky top-0 z-20 ${tc.headerBg}`}>
        <div className="px-5 py-3.5 flex items-center gap-3">
          <div>
            <h1 className={`text-sm font-bold ${tc.textPrimary}`}>Kitchen Display System</h1>
            <p className={`text-[11px] ${tc.textMuted}`}>Manage menus and kitchen orders</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="relative z-10 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          {/* Order Board */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
          >
            <motion.button
              whileHover={{ y: -6, scale: 1.02, boxShadow: "0 20px 40px -12px rgba(16,185,129,0.3)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode("orders")}
              className={`group relative text-left rounded-2xl border p-5 transition-all duration-300 ${tc.cardBg} hover:border-emerald-500/60 overflow-hidden`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <motion.div 
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="text-4xl mb-3"
              >🧑‍🍳</motion.div>
              <div className={`text-base font-semibold mb-1 ${tc.textPrimary}`}>Kitchen Order Board</div>
              <div className={`text-xs leading-relaxed mb-4 ${tc.textSub}`}>View and manage live orders. Track Pending → Preparing → Ready → Served.</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 group-hover:gap-2.5 transition-all">
                Open <motion.span className="inline-block" animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 1 }}>→</motion.span>
              </div>
            </motion.button>
          </motion.div>

          {/* Menu Builder */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.2 }}
          >
            <motion.button
              whileHover={{ y: -6, scale: 1.02, boxShadow: "0 20px 40px -12px rgba(20,184,166,0.3)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode("menu")}
              className={`group relative text-left rounded-2xl border p-5 transition-all duration-300 ${tc.cardBg} hover:border-teal-500/60 overflow-hidden`}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-teal-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <motion.div 
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="text-4xl mb-3"
              >📋</motion.div>
              <div className={`text-base font-semibold mb-1 ${tc.textPrimary}`}>Menu Builder</div>
              <div className={`text-xs leading-relaxed mb-4 ${tc.textSub}`}>Create &amp; manage categories, items and availability. Preview live menu.</div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-500 group-hover:gap-2.5 transition-all">
                Open <motion.span className="inline-block" animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5, repeatDelay: 1.2 }}>→</motion.span>
              </div>
            </motion.button>
          </motion.div>

          {/* Coming soon: Stations */}
          <div className={`relative rounded-2xl border p-5 opacity-50 ${tc.cardBg}`}>
            <span className={`absolute top-3.5 right-3.5 text-[10px] px-2 py-0.5 rounded-full ${tc.tagBg}`}>Soon</span>
            <div className="text-2xl mb-3">🏭</div>
            <div className={`text-sm font-semibold ${tc.textSub}`}>Kitchen Stations</div>
            <div className={`text-xs mt-1 ${tc.textMuted}`}>Assign categories to stations for ticket routing.</div>
          </div>

          {/* Coming soon: Settings */}
          <div className={`relative rounded-2xl border p-5 opacity-50 ${tc.cardBg}`}>
            <span className={`absolute top-3.5 right-3.5 text-[10px] px-2 py-0.5 rounded-full ${tc.tagBg}`}>Soon</span>
            <div className="text-2xl mb-3">⚙️</div>
            <div className={`text-sm font-semibold ${tc.textSub}`}>KDS Settings</div>
            <div className={`text-xs mt-1 ${tc.textMuted}`}>Tax defaults, display theme, printers.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
