import React from "react";
import { motion } from "framer-motion";
import CreateMenu from "./CreateMenu";
import KitchenOrderBoard from "./KitchenOrderBoard";

/**
 * KitchenDisplay (Landing Hub)
 * ---------------------------------------------------------------
 * Main hub for Kitchen Display System
 * - Menu Builder
 * - Order Board (KDS)
 * - Settings (coming soon)
 */
export default function KitchenDisplay({ onBack }) {
  const [mode, setMode] = React.useState("orders"); // 'home' | 'menu' | 'orders'

  if (mode === "menu") {
    return <CreateMenu onBack={() => setMode("home")} />;
  }

  if (mode === "orders") {
    return <KitchenOrderBoard onBack={() => setMode("home")} />;
  }

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 overflow-y-auto">
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-emerald-500/15" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-cyan-500/15" />
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-slate-900/85 backdrop-blur-sm border-b border-white/10">
        <div className="px-5 py-3.5 flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold text-white">Kitchen Display System</h1>
            <p className="text-[11px] text-white/50">Manage menus and kitchen orders</p>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="relative z-10 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          {/* Order Board */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode("orders")}
            className="group relative text-left rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur-xl p-5 hover:border-emerald-500/40 hover:bg-slate-800/70 transition-all duration-200"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl mb-3">�‍🍳</div>
            <div className="text-base font-semibold text-white mb-1">Kitchen Order Board</div>
            <div className="text-xs text-white/55 leading-relaxed mb-4">View and manage live orders. Track Pending → Preparing → Ready → Served.</div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:gap-2.5 transition-all">
              Open <span>→</span>
            </div>
          </motion.button>

          {/* Menu Builder */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode("menu")}
            className="group relative text-left rounded-2xl border border-white/10 bg-slate-800/50 backdrop-blur-xl p-5 hover:border-teal-500/40 hover:bg-slate-800/70 transition-all duration-200"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-teal-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="text-3xl mb-3">�</div>
            <div className="text-base font-semibold text-white mb-1">Menu Builder</div>
            <div className="text-xs text-white/55 leading-relaxed mb-4">Create & manage categories, items and availability. Preview live menu.</div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 group-hover:gap-2.5 transition-all">
              Open <span>→</span>
            </div>
          </motion.button>

          {/* Coming soon: Stations */}
          <div className="relative rounded-2xl border border-white/[0.07] bg-slate-800/30 p-5 opacity-50">
            <span className="absolute top-3.5 right-3.5 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">Soon</span>
            <div className="text-2xl mb-3">🏭</div>
            <div className="text-sm font-semibold text-white/80">Kitchen Stations</div>
            <div className="text-xs text-white/40 mt-1">Assign categories to stations for ticket routing.</div>
          </div>

          {/* Coming soon: Settings */}
          <div className="relative rounded-2xl border border-white/[0.07] bg-slate-800/30 p-5 opacity-50">
            <span className="absolute top-3.5 right-3.5 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">Soon</span>
            <div className="text-2xl mb-3">⚙️</div>
            <div className="text-sm font-semibold text-white/80">KDS Settings</div>
            <div className="text-xs text-white/40 mt-1">Tax defaults, display theme, printers.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
