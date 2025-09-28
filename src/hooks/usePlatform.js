

import { useEffect, useMemo, useState } from "react";

function detectPlatform() {
  let platform = "web";
  try {
    if (typeof window !== "undefined") {
      // Capacitor v5 exposes Capacitor.getPlatform(); older versions set platform on Capacitor
      const C = window.Capacitor || null;
      if (C && typeof C.getPlatform === "function") {
        platform = C.getPlatform(); // "ios" | "android" | "web"
      } else if (C && typeof C.platform === "string") {
        platform = C.platform; // legacy
      } else if (window.androidBridge) {
        platform = "android";
      }
    }
  } catch (_) {}
  return platform || "web";
}

function uaHints() {
  if (typeof navigator === "undefined") return { isTouch: false, isWebView: false };
  const ua = navigator.userAgent || "";
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  // Android WebView often contains; "; wv)" or "Version/.. Chrome/... Mobile Safari/..."
  const isWebView = /; wv\)/i.test(ua) || (/Version\/\d+\.\d+\s+Chrome\//i.test(ua) && /Mobile\s+Safari\//i.test(ua) && !/Safari\//i.test(ua));
  return { isTouch, isWebView };
}

function mqSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { isMobileViewport: false, isTabletViewport: false, isDesktopViewport: true };
  }
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const tablet = window.matchMedia("(min-width: 769px) and (max-width: 1024px)").matches;
  const desktop = window.matchMedia("(min-width: 1025px)").matches;
  return { isMobileViewport: mobile, isTabletViewport: tablet, isDesktopViewport: desktop };
}

export function usePlatform() {
  const [vp, setVp] = useState(mqSnapshot());
  const [plat, setPlat] = useState(() => detectPlatform());
  const [hints, setHints] = useState(() => uaHints());

  useEffect(() => {
    function handleResize() { setVp(mqSnapshot()); }
    function handleOrientation() { setVp(mqSnapshot()); }

    let mqls = [];
    try {
      mqls = [
        window.matchMedia("(max-width: 768px)"),
        window.matchMedia("(min-width: 769px) and (max-width: 1024px)"),
        window.matchMedia("(min-width: 1025px)")
      ];
      mqls.forEach(m => m.addEventListener?.("change", handleResize));
    } catch (_) {}

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientation);

    const id = setInterval(() => {
      // Re-detect platform occasionally (in case Capacitor injects late)
      const p = detectPlatform();
      setPlat(prev => (p !== prev ? p : prev));

      const h = uaHints();
      setHints(prev => (
        h.isTouch !== prev.isTouch || h.isWebView !== prev.isWebView ? h : prev
      ));
    }, 5000);

    return () => {
      try { mqls.forEach(m => m.removeEventListener?.("change", handleResize)); } catch (_) {}
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientation);
      clearInterval(id);
    };
  }, []);

  const value = useMemo(() => {
    const platform = plat;
    const isNativeApp = platform === "ios" || platform === "android";
    return {
      platform,
      isNativeApp,
      ...vp,
      ...hints,
    };
  }, [plat, vp, hints]);

  return value;
}

export function isNativeApp() {
  const p = detectPlatform();
  return p === "ios" || p === "android";
}