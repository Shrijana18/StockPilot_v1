import React, { useEffect, useMemo, useRef, useState } from "react";

const formatClock = (ts) => {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  } catch {
    return "";
  }
};

/**
 * VoiceHUD — polished "magic" UI (presentation-only)
 * --------------------------------------------------
 *  - Animated mic with radial pulse + conic progress ring
 *  - Smooth waveform bars (shimmer + amplitude)
 *  - Live partial transcript with caret and aria-live
 *  - Rotating "Try saying…" helper hints
 *  - Activity feed and actionable intent chips
 *  - Mini help popover with voice commands
 *  - Subtle keyboard shortcut: Space toggles mic
 *
 * Backward compatible: props & behavior unchanged.
 */
export default function VoiceHUD({
  listening = false,
  paused = false,
  autoStopped = false,
  wsState = "closed",
  vu = 0,
  lastPartial = "",
  onToggleMic = () => {},
  onClearTranscripts = () => {},
  activity = [], // [{ id, text, ts }]
  chips = [], // [{ key|id, label|text, onClick|action, type?:'ok'|'warn'|'info' }]
}) {
  // ---------- status pill ----------
  const isActive = listening && !paused;
  const status = useMemo(() => {
    if (paused) return { text: "Paused", tone: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
    if (isActive) return { text: "Listening", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    if (wsState === "opening") return { text: "Connecting", tone: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    if (autoStopped) return { text: "Auto‑stopped", tone: "bg-orange-500/15 text-orange-300 border-orange-500/30" };
    return { text: "Idle", tone: "bg-neutral-700/60 text-neutral-200 border-white/10" };
  }, [paused, isActive, autoStopped, wsState]);

  // ---------- rotating helper hints ----------
  const tips = useMemo(
    () => [
      "“add two whey protein 500g”",
      "“set payment to split”",
      "“customer phone 98… add seenu”",
      "“GST 12 percent”",
      "“discount 5% on milk”",
      "“remove milk”",
    ],
    []
  );
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 3500);
    return () => clearInterval(id);
  }, [tips.length]);

  // ---------- animated waveform ----------
  const bars = 28; // slightly denser
  const amp = Math.max(0, Math.min(1, vu));
  const [tick, setTick] = useState(0);
  const shouldAnimate = isActive || wsState === "open";
  useEffect(() => {
    if (!shouldAnimate) return;
    let raf;
    const loop = () => {
      setTick((t) => (t + 1) % 10000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [shouldAnimate]);

  // ---------- listening timer (mm:ss) ----------
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let iv;
    if (listening && !paused) {
      if (!startedAt) setStartedAt(Date.now());
      iv = setInterval(() => setElapsed(Date.now() - (startedAt || Date.now())), 250);
    } else {
      setStartedAt(null);
      setElapsed(0);
    }
    return () => iv && clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, paused]);
  const mm = String(Math.floor((elapsed / 1000) / 60)).padStart(2, "0");
  const ss = String(Math.floor((elapsed / 1000) % 60)).padStart(2, "0");

  // ---------- keyboard shortcut ----------
  useEffect(() => {
    const onKey = (e) => {
      // ignore when typing in inputs
      const tag = (e.target && e.target.tagName) || "";
      if (/(input|textarea|select)/i.test(tag)) return;
      if (e.code === "Space") {
        e.preventDefault();
        onToggleMic();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggleMic]);

  // ---------- mini help popover ----------
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (!helpRef.current) return;
      if (!helpRef.current.contains(e.target)) setShowHelp(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // ---------- render ----------
  // Magic border for main container
  const magicBorder =
    "before:absolute before:inset-0 before:rounded-[1.1rem] before:animate-[gradient-border_4s_linear_infinite] before:bg-[conic-gradient(from_180deg_at_50%_50%,#34d399_0%,#06b6d4_33%,#f43f5e_66%,#34d399_100%)] before:opacity-70 before:pointer-events-none before:z-0 after:absolute after:inset-0 after:rounded-[1.1rem] after:bg-neutral-900/30 after:-z-10";

  return (
    <div className={`relative rounded-2xl p-4 bg-gradient-to-br from-neutral-900/70 to-neutral-800/60 shadow-lg shadow-black/30 border border-white/10 overflow-hidden z-0 ${magicBorder}`}>
      <div className="relative z-10">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none absolute -inset-16 opacity-20 blur-3xl">
        <div className="w-full h-full animate-pulse" style={{background: "radial-gradient(60% 60% at 20% 20%, rgba(16,185,129,0.22) 0%, transparent 60%), radial-gradient(50% 50% at 80% 30%, rgba(59,130,246,0.18) 0%, transparent 60%), radial-gradient(40% 40% at 40% 80%, rgba(244,63,94,0.14) 0%, transparent 60%)"}} />
      </div>
      {/* subtle grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.045]">
        <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(transparent 23px, rgba(255,255,255,.08) 24px), linear-gradient(90deg, transparent 23px, rgba(255,255,255,.08) 24px)", backgroundSize:"24px 24px"}} />
      </div>
      {/* Header: status + controls */}
      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs border ${status.tone}`}>{status.text}</span>
          <span className="text-xs opacity-60">WS: {wsState}</span>
          {listening && !paused && (
            <span className="ml-1 text-xs text-emerald-300/90" title="Recording time">
              • {mm}:{ss}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Help */}
          <div className="relative z-10" ref={helpRef}>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="h-9 px-3 rounded-full border text-sm bg-neutral-900/70 hover:bg-neutral-900 border-white/10"
              title="Help & voice examples"
            >
              ?
            </button>
            {showHelp && (
              <div
                role="dialog"
                aria-label="Voice help"
                className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur p-3 shadow-xl z-20"
              >
                <div className="text-xs opacity-70 mb-1">Say things like:</div>
                <ul className="text-sm space-y-1">
                  <li>• add 2 colgate 100g</li>
                  <li>• set payment to split</li>
                  <li>• customer phone 98… add seenu</li>
                  <li>• GST 12 percent</li>
                  <li>• discount 5% on milk</li>
                  <li>• remove milk</li>
                </ul>
                <div className="mt-2 text-xs opacity-60">Shortcut: press <span className="px-1 rounded bg-white/10">Space</span> to toggle mic.</div>
              </div>
            )}
          </div>

          {/* Mic button with conic progress + pulse */}
          <button
            type="button"
            onClick={onToggleMic}
            aria-pressed={isActive}
            className={`relative z-10 h-9 pl-9 pr-4 rounded-full border text-sm font-medium transition-all focus:outline-none
              ${isActive
                ? "bg-emerald-600/90 border-emerald-400/60 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.25)]"
                : "bg-neutral-800/80 border-white/10 text-white/90 hover:bg-neutral-800"}
            `}
            title="Toggle microphone (Space)"
          >
            {/* conic ring */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-full"
              style={{
                background: isActive
                  ? `conic-gradient(rgba(34,197,94,0.45) ${(elapsed/1000)%60/60*360}deg, transparent 0deg)`
                  : "transparent",
                mask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                maskComposite: "exclude",
                WebkitMaskComposite: "xor",
                padding: "2px"
              }}
            />
            {/* pulsing halo */}
            {isActive && (
              <span
                className="pointer-events-none absolute inset-0 rounded-full animate-[pulse_1.8s_ease-in-out_infinite]"
                style={{ boxShadow: "0 0 0 0 rgba(16,185,129,0.45)" }}
                aria-hidden
              />
            )}
            {isActive && (
              <span aria-hidden className="pointer-events-none absolute -top-2 -right-1">
                <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-70">
                  <path fill="currentColor" d="M12 2l1.2 3.4L16 6l-2.8 1.1L12 10l-1.2-2.9L8 6l2.8-.6L12 2Zm7 8l.8 2.2L22 13l-2.2.8L19 16l-.8-2.2L16 13l2.2-.8L19 10ZM5 12l1 2.6L9 15l-2.6 1L5 19l-1-3l-3-1l3-1l1-2Z"/>
                </svg>
              </span>
            )}
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm7-3a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.08A7 7 0 0 0 19 11Z" />
              </svg>
            </span>
            {isActive ? "Stop" : "Start"}
          </button>

          <button
            type="button"
            onClick={onClearTranscripts}
            className="h-9 px-4 rounded-full border text-sm bg-neutral-900/70 hover:bg-neutral-900 border-white/10 relative z-10"
            title="Clear transcripts"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Waveform + transcript */}
      <div className="mt-3 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7">
      {/* waveform */}
      <div className="h-16 flex items-end gap-[6px] rounded-xl border border-white/10 bg-neutral-900/80 px-3 py-2 overflow-hidden relative">
        {/* magical glowing bg gradient */}
        <div className={`absolute inset-0 ${isActive ? "bg-gradient-to-r from-emerald-400/35 via-teal-400/30 to-cyan-400/35" : "bg-gradient-to-r from-cyan-400/30 via-sky-400/25 to-blue-400/30"} blur-xl pointer-events-none -z-10`} />
        {/* state badge */}
        <div className="absolute top-1 right-2 text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-black/30 backdrop-blur z-10">
          <span className={isActive ? "text-emerald-300" : autoStopped ? "text-orange-300" : paused ? "text-yellow-300" : "text-white/70"}>
            {isActive ? "ON AIR" : autoStopped ? "Auto‑stopped" : paused ? "Paused" : "Idle"}
          </span>
        </div>
        {Array.from({ length: bars }).map((_, i) => {
          const arch = Math.sin((i / bars) * Math.PI);
          const shimmer = shouldAnimate ? (Math.sin((i * 0.6 + tick * 0.12)) + 1) / 2 : 0;
          const height = 10 + arch * (28 + amp * 36) + shimmer * 14;
          const opacity = 0.7 + arch * 0.25 + amp * 0.25;
          const barClass = isActive
            ? "from-emerald-400/90 to-emerald-200"
            : "from-cyan-400/70 to-cyan-100";
          return (
            <div
              key={i}
              className={`w-[5px] rounded-[2px] bg-gradient-to-t ${barClass} shadow-[inset_0_-6px_12px_rgba(0,0,0,0.25)] transition-[height,opacity] duration-100`}
              style={{ height, opacity }}
              aria-hidden
            />
          );
        })}
      </div>

          {/* transcript */}
          <div
            className="mt-2 text-sm leading-6 rounded-xl border border-white/10 bg-neutral-900/60 p-3 min-h-[52px] relative overflow-hidden"
            aria-live="polite"
          >
            {/* Animated faint conic border */}
            <div className="pointer-events-none absolute inset-0 rounded-xl z-0 border-[2.5px] border-transparent" style={{
              background: "conic-gradient(from 90deg at 50% 50%, #34d39933 0%, #06b6d433 33%, #f43f5e33 66%, #34d39933 100%)",
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              maskComposite: "exclude",
              WebkitMaskComposite: "xor",
              opacity: 0.35,
              animation: "spin 3.5s linear infinite"
            }} />
            <span className="relative z-10 text-white/90">{lastPartial || "Say a product…"}</span>
            {isActive && (
              <span className="inline-block w-1.5 h-4 align-middle ml-1 bg-emerald-300 animate-pulse rounded relative z-10" />
            )}
            {!lastPartial && (
              <>
                <span className="block text-xs mt-1 opacity-50 relative z-10">
                  Try saying <em className="not-italic text-emerald-300/90">{tips[tipIdx]}</em>
                </span>
                <div className="mt-1 flex gap-1 items-center relative z-10">
                  {tips.map((_, i) => (
                    <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${i===tipIdx ? "bg-emerald-400" : "bg-white/35"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Activity + Chips */}
        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-xl border border-white/10 bg-neutral-900/85 backdrop-blur p-3 max-h-56 overflow-y-auto relative nice-scroll" aria-live="polite">
            {/* Magical shimmering overlay */}
            <div className="pointer-events-none absolute inset-0 z-0">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-cyan-300/10 to-emerald-400/5 blur-lg animate-[shimmerX_3.5s_linear_infinite] z-0" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-10 animate-[shimmerY_5s_linear_infinite] z-0" />
            </div>
            <div className="flex items-center justify-between sticky top-0 z-10 bg-neutral-900/80 backdrop-blur px-1 py-1 rounded-md">
              <div className="text-xs opacity-60 mb-1">Activity</div>
              {/* subtle net dot */}
              <div className="flex items-center gap-1 text-xs opacity-60">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${wsState === "open" ? "bg-emerald-400" : wsState === "opening" ? "bg-blue-400" : "bg-neutral-500"}`} />
                <span>{wsState}</span>
              </div>
            </div>
            <ul className="text-sm space-y-1 relative z-10 text-white/95 max-h-44 overflow-y-auto nice-scroll">
              {(activity ?? []).map((a, idx) => (
                <li key={a.id ?? a.ts ?? idx} className="flex items-center justify-between gap-2">
                  <span className="truncate text-white/95" title={a.text}>{a.text}</span>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 opacity-60">{formatClock(a.ts)}</span>
                </li>
              ))}
              {(!activity || activity.length === 0) && (
                <li className="text-xs opacity-50">No activity yet.</li>
              )}
            </ul>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {(chips ?? []).map((c, idx) => {
              const key = c.id ?? c.key ?? c.label ?? c.text ?? idx;
              const label = c.label ?? c.text ?? "—";
              const onClick = c.onClick ?? c.action;
              const tone =
                c.type === "ok"
                  ? "border-emerald-400/40 text-emerald-300 bg-emerald-600/10 hover:bg-emerald-600/20"
                  : c.type === "warn"
                  ? "border-amber-400/40 text-amber-300 bg-amber-600/10 hover:bg-amber-600/20"
                  : "border-white/10 text-white/80 bg-neutral-800/70 hover:bg-neutral-800";
              return (
                <button
                  key={key}
                  onClick={onClick}
                  type="button"
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 hover:translate-y-[-1px] ${tone} hover:shadow-lg hover:shadow-emerald-300/20 hover:scale-105 focus:scale-105 focus:shadow-lg focus:shadow-cyan-400/30`}
                  title={label}
                  style={{
                    transition: "transform 0.16s cubic-bezier(.4,2,.3,1), box-shadow 0.22s cubic-bezier(.4,2,.3,1)"
                  }}
                >
                  {label}
                </button>
              );
            })}
            {(!chips || chips.length === 0) && (
              <span className="text-xs text-white/70">No suggestions.</span>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Animations for magical effects (inject via <style> for demo)
if (typeof document !== "undefined" && !document.getElementById("voicehud-magic-animations")) {
  const style = document.createElement("style");
  style.id = "voicehud-magic-animations";
  style.innerHTML = `
    @keyframes gradient-border {
      0% { filter: hue-rotate(0deg);}
      100% { filter: hue-rotate(360deg);}
    }
    @keyframes spin {
      0% { transform: rotate(0deg);}
      100% { transform: rotate(360deg);}
    }
    @keyframes shimmerX {
      0% { opacity: 0.45; transform: translateX(-30%);}
      50% { opacity: 0.70; transform: translateX(30%);}
      100% { opacity: 0.45; transform: translateX(-30%);}
    }
    @keyframes shimmerY {
      0% { opacity: 0.15; transform: translateY(-30%);}
      50% { opacity: 0.35; transform: translateY(30%);}
      100% { opacity: 0.15; transform: translateY(-30%);}
    }
    .nice-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
    .nice-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,.4); border-radius: 8px; }
    .nice-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,.6); }
    .nice-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.5) transparent; }
  `;
  document.head.appendChild(style);
}
