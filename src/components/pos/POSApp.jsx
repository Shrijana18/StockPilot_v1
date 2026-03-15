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
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center">
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
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center shadow-2xl"
        >
          <div className="text-4xl mb-4">🍽️</div>
          <h1 className="text-2xl font-bold text-white mb-2">FLYP POS</h1>
          <p className="text-white/60 text-sm mb-6">
            Sign in to your FLYP account to access the POS system.
          </p>
          <a
            href={`/auth?type=login&redirect=${encodeURIComponent("/pos")}`}
            className="block w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-sm shadow-lg hover:from-orange-600 hover:to-red-600 transition"
          >
            Sign In
          </a>
        </motion.div>
      </div>
    );
  }

  // Authenticated — render fullscreen POS (overlays WebShell completely)
  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950 overflow-hidden flex flex-col"
    >
      <POSView />
    </div>
  );
}
