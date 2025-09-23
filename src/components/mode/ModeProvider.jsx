import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ModeCinematic from "./ModeCinematic";

// Only allow these two for now
const ALLOWED = new Set(["dashboard", "pos"]);
const sanitize = (v) => (ALLOWED.has(String(v)) ? String(v) : "dashboard");

const ModeContext = createContext({ mode: "dashboard", isPos: false, setMode: () => {}, flash: () => {} });

export const ModeProvider = ({ children }) => {
  // Resolve initial from URL (?mode=) → localStorage → default
  let initial = "dashboard";
  if (typeof window !== "undefined") {
    const urlMode = new URLSearchParams(window.location.search).get("mode");
    const lsMode = window.localStorage?.getItem("mode");
    initial = sanitize(urlMode || lsMode || "dashboard");
  }

  const [mode, _setMode] = useState(initial);

  // While a cinematic is playing, we keep the current mode and store the target here
  const [pendingNext, setPendingNext] = useState(null); // "dashboard" | "pos" | null

  // portal shimmer trigger
  const [flashKey, setFlashKey] = useState(0);
  const flash = () => setFlashKey((k) => k + 1);

  // Central setter that always sanitizes and persists
  const setMode = (next) => {
    const v = sanitize(next);
    _setMode((prev) => {
      if (prev === v) return prev; // no-op
      try { flash(); } catch {}
      setPendingNext(v); // play cinematic overlay first; commit after it finishes
      return prev; // keep current mode until cinematic says done
    });
  };

  // Persist to localStorage and reflect in URL (deep link)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("mode", mode);
      const url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [mode]);

  // Sync across tabs (storage) and with browser back/forward (popstate)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e) => {
      if (e.key === "mode") setMode(e.newValue);
    };
    const onPop = () => {
      const urlMode = new URLSearchParams(window.location.search).get("mode");
      if (urlMode) setMode(urlMode);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const value = useMemo(() => ({ mode, isPos: mode === "pos", setMode, flash }), [mode]);
  return (
    <ModeContext.Provider value={value}>
      <AnimatePresence mode="wait">
        {pendingNext && (
          <ModeCinematic
            key={`cin-${flashKey}`}
            triggerKey={flashKey}
            mode={pendingNext}
            onDone={() => {
              // Commit the mode after the cinematic finishes
              _setMode(pendingNext);
              setPendingNext(null);
            }}
          />
        )}
      </AnimatePresence>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
export default ModeProvider;
