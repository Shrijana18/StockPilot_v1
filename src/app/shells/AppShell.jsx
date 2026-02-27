
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * AppShell (Mobile shell)
 * - Handles safe areas, 100dvh, sticky compact header, and a single scroll container
 * - Provides mobile-native navigation with bottom nav bar
 * - Android hardware back handler (Capacitor)
 */
export default function AppShell({ children, headerContent = null, showFab = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [statusBarHeight, setStatusBarHeight] = useState(0);

  // Get status bar height for proper spacing
  useEffect(() => {
    // Use CSS env() for safe area, but also detect programmatically if needed
    const updateStatusBar = () => {
      const safeArea = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10);
      setStatusBarHeight(safeArea || 44); // Default iOS status bar height
    };
    
    updateStatusBar();
    window.addEventListener('resize', updateStatusBar);
    return () => window.removeEventListener('resize', updateStatusBar);
  }, []);

  // Handle Android hardware back
  useEffect(() => {
    let sub;
    try {
      const { App } = require("@capacitor/app");
      sub = App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          // Show exit confirmation or navigate to main dashboard
          if (location.pathname.includes('dashboard')) {
            App.exitApp();
          } else {
            navigate("/distributor-dashboard", { replace: true });
          }
        }
      });
    } catch (_) {}
    return () => {
      try { sub && sub.remove(); } catch (_) {}
    };
  }, [navigate, location.pathname]);

  // Set CSS variables for safe areas
  useEffect(() => {
    document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--sal', 'env(safe-area-inset-left)');
    document.documentElement.style.setProperty('--sar', 'env(safe-area-inset-right)');
  }, []);

  return (
    <div 
      className="min-h-[100dvh] h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] text-white flex flex-col"
    >
      {/* Main content area - dashboards use fixed inset-0 and lock body scroll; other pages can scroll here */}
      <main 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {children}
      </main>
    </div>
  );
}