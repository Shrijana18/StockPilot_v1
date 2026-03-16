/**
 * POSApp - Standalone POS Shell
 * Route: /pos
 * Same pattern as /shop (CustomerApp) — fullscreen, no dashboard chrome.
 * Restaurant, Cafe, Hotel staff interact only with this clean POS interface.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "../../firebase/firebaseConfig";
import POSView from "./POSView";

export default function POSApp() {
  const [authReady, setAuthReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // Wait for Firebase auth to initialize
  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // While Firebase resolves auth state
  if (!authReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d1117 0%, #111827 45%, #0f1320 100%)" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full"
        />
      </div>
    );
  }

  // Not logged in — show a clean POS login prompt (not dashboard login)
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, #0d1117 0%, #111827 45%, #0f1320 100%)" }}>
        {/* Aurora */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 right-0 w-[55%] h-[55%] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(251,146,60,0.07) 0%, transparent 65%)" }} />
          <div className="absolute bottom-0 left-0 w-[50%] h-[50%] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 65%)" }} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="relative w-full max-w-sm rounded-3xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-2xl p-8 text-center shadow-2xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-400/10 border border-orange-400/20 flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg shadow-orange-900/20">🍽️</div>
          <h1 className="text-2xl font-black text-white/95 mb-2">FLYP POS</h1>
          <p className="text-white/45 text-sm mb-7 leading-relaxed">
            Sign in to your FLYP account to access the POS system.
          </p>
          <a
            href={`/auth?type=login&redirect=${encodeURIComponent("/pos")}`}
            className="block w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all"
          >
            Sign In to Continue
          </a>
        </motion.div>
      </div>
    );
  }

  // Authenticated — render fullscreen POS (overlays WebShell completely)
  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden flex flex-col"
      style={{ background: "linear-gradient(135deg, #0d1117 0%, #111827 45%, #0f1320 100%)" }}
    >
      <POSView />
    </div>
  );
}
