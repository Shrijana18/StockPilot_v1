import React, { useEffect } from "react";
import { useMode } from "./ModeProvider";

/**
 * Magical Next-Gen Mode Toggle
 * - Morphing pill with glowing gradient
 * - Smooth slide animation (respects reduced motion)
 * - Keyboard shortcut: Shift+M
 */
export default function ModeToggle({ className = "" }) {
  const { isPos, setMode } = useMode();
  const activeIndex = isPos ? 1 : 0;

  // Keyboard shortcut: Shift+M
  useEffect(() => {
    const onKey = (e) => {
      if (e.key?.toLowerCase() === "m" && e.shiftKey) {
        e.preventDefault();
        setMode(isPos ? "dashboard" : "pos");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPos, setMode]);

  const options = [
    { key: "dashboard", label: "Dashboard" },
    { key: "pos", label: "POS" },
  ];

  const currentKey = isPos ? "pos" : "dashboard";

  return (
    <div
      className={`relative flex justify-center w-full select-none ${className}`}
      role="tablist"
      aria-label="Mode switcher"
    >
      <div
        className="relative inline-flex items-center rounded-full p-1 bg-gradient-to-r from-slate-800/60 via-slate-900/60 to-slate-800/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), 0 12px 40px rgba(16,185,129,0.25)",
        }}
      >
        {/* Animated glowing pill */}
        <span
          aria-hidden
          className="absolute top-1 bottom-1 w-1/2 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_20px_rgba(16,185,129,0.8)] transition-transform duration-500 ease-out will-change-transform motion-reduce:transition-none"
          style={{
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />

        {options.map((opt) => {
          const selected = opt.key === currentKey;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              aria-pressed={selected}
              role="tab"
              aria-selected={selected}
              className={`relative z-10 px-6 py-2 text-sm md:text-base font-semibold rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                selected ? "text-slate-900" : "text-white/70 hover:text-white"
              }`}
              data-testid={`mode-${opt.key}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}