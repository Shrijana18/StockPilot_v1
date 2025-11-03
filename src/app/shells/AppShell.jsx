

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Optional: if your project exposes ModeProvider, we'll use its helpers when available
let useModeSafe = null;
try {
  // eslint-disable-next-line import/no-unresolved
  const mod = require("../../components/mode/ModeProvider");
  useModeSafe = mod?.useMode || null;
} catch (_) {}

/**
 * AppShell (Mobile shell)
 * - Handles safe areas, 100dvh, sticky compact header, and a single scroll container
 * - Provides an optional mobile FAB and Android hardware back handler (Capacitor)
 * - Wrap pages/components without changing their internals
 */
export default function AppShell({ children, headerContent = null, showFab = false }) {
  const navigate = useNavigate();
  const modeApi = useModeSafe ? useModeSafe() : null;

  // Handle Android hardware back → go to dashboard (non-destructive)
  useEffect(() => {
    let sub;
    try {
      // Dynamic import to avoid bundling when not in Capacitor
      // eslint-disable-next-line global-require
      const { App } = require("@capacitor/app");
      sub = App.addListener("backButton", () => {
        try {
          if (modeApi?.goDashboard) return modeApi.goDashboard();
        } catch (_) {}
        navigate("/dashboard", { replace: true });
      });
    } catch (_) {}
    return () => {
      try { sub && sub.remove(); } catch (_) {}
    };
  }, [navigate, modeApi]);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white">
      {/* Main scrollable container with safe-area padding */}
      <main className="flex-1 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {children}
      </main>
      {/* Optional floating action button for quick access to Dashboard */}
      {showFab && (
        <button
          type="button"
          onClick={() => {
            try { if (modeApi?.goDashboard) return modeApi.goDashboard(); } catch (_) {}
            navigate("/dashboard", { replace: true });
          }}
          aria-label="Go to Dashboard"
          className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl
                     bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900
                     font-extrabold flex items-center justify-center active:scale-[.95] min-h-[56px] min-w-[56px] touch-target
                     mb-[env(safe-area-inset-bottom)] mr-[env(safe-area-inset-right)]"
        >
          ⌂
        </button>
      )}
    </div>
  );
}