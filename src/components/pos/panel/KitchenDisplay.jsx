import React from "react";
import { motion } from "framer-motion";
import CreateMenu from "./CreateMenu";

/**
 * KitchenDisplay (Landing Hub)
 * ---------------------------------------------------------------
 * Entry screen for KDS with cinematic look. From here users can
 * enter different KDS functions. Currently wired:
 *  - Menu Builder (CreateMenu)
 */
export default function KitchenDisplay({ onBack }) {
  const [mode, setMode] = React.useState("home"); // 'home' | 'menu'

  if (mode === "menu") {
    return <CreateMenu onBack={() => setMode("home")} />;
  }

  return (
    <div className="relative w-full min-h-screen bg-transparent">
      {/* Aurora backdrop */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.9]">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-emerald-500/20" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-cyan-500/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(16,185,129,0.08),_transparent_50%),radial-gradient(ellipse_at_top,_rgba(6,182,212,0.05),_transparent_40%)]" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_45%,rgba(0,0,0,0.32))]" />

        {/* floating dust/particles */}
        <div className="absolute inset-0">
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/20"
              style={{
                top: `${(i * 37) % 100}%`,
                left: `${(i * 53) % 100}%`,
                opacity: 0.5,
                transform: `scale(${0.6 + (i % 5) * 0.1})`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-transparent backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-emerald-600/30 hover:shadow-lg transition"
            >
              ← Back to POS
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-white/90">Kitchen Display</h1>
            <p className="text-xs text-white/60">Manage menus, kitchen stations and orders from a single place.</p>
          </div>
          <div className="flex-1" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-[calc(100vh-128px)] flex items-start justify-center p-6">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Menu Builder Card */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setMode("menu")}
            className="group relative text-left rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-800/40 backdrop-blur-xl p-6 shadow-lg hover:shadow-emerald-500/30 transition min-h-[140px]"
          >
            {/* Glow accent */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/10 via-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">📜</span>
                <div className="text-white">
                  <div className="text-lg font-semibold">Menu Builder</div>
                  <div className="text-sm text-white/70">Create & manage categories and items, toggle availability, preview live menu.</div>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-emerald-300 font-medium">
                Open <span>→</span>
              </div>
            </div>
          </motion.button>

          {/* Orders Board (placeholder for future) */}
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-xl p-6 text-white/70 shadow-inner min-h-[140px]">
            <span className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">Coming Soon</span>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🧾</span>
              <div>
                <div className="text-lg font-semibold text-white/90">Orders Board</div>
                <div className="text-sm">Track tables and ticket status (Pending → Cooking → Ready → Served).</div>
              </div>
            </div>
          </div>

          {/* Stations (placeholder for future) */}
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-xl p-6 text-white/70 shadow-inner min-h-[140px]">
            <span className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">Coming Soon</span>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">👨‍🍳</span>
              <div>
                <div className="text-lg font-semibold text-white/90">Kitchen Stations</div>
                <div className="text-sm">Assign categories to stations (Tandoor, Fry, Grill) for ticket routing.</div>
              </div>
            </div>
          </div>

          {/* Settings (placeholder for future) */}
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-xl p-6 text-white/70 shadow-inner min-h-[140px]">
            <span className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">Coming Soon</span>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚙️</span>
              <div>
                <div className="text-lg font-semibold text-white/90">KDS Settings</div>
                <div className="text-sm">Theme, tax defaults, printers and shortcuts.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}