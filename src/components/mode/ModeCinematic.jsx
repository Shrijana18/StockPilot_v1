import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * ModeCinematic — magical, self-contained overlay
 * Props (unchanged):
 *  - triggerKey: number (change to replay)
 *  - mode: "dashboard" | "pos"
 *  - onDone?: () => void (called at the end)
 *
 * Notes:
 *  - Duration ~1.1s to match existing Provider timeout
 *  - No external debouncing; fully self-contained
 *  - Respects prefers-reduced-motion
 */


const DURATION_MS = 1100;

// Optional SFX — tiny WebAudio swoosh (no assets)
function playSwoosh({ duration = 0.5, volume = 0.08 } = {}) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 1600;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + duration);
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(lpf);
    lpf.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close?.();
  } catch (e) {
    // ignore
  }
}

const SFX_PREF_KEY = "mode_sfx"; // set to 'off' to mute

export default function ModeCinematic({ triggerKey, mode, onDone }) {
  const [show, setShow] = useState(false);

  const reduceMotion = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (triggerKey == null) return;
    setShow(true);
    // Fire a subtle swoosh unless user muted or prefers reduced motion
    try {
      const pref = window.localStorage?.getItem(SFX_PREF_KEY);
      if (!reduceMotion && pref !== "off") {
        playSwoosh({ duration: 0.55, volume: 0.09 });
      }
    } catch {}
    const t = setTimeout(() => {
      setShow(false);
      onDone?.();
    }, reduceMotion ? 400 : DURATION_MS);
    return () => clearTimeout(t);
  }, [triggerKey]);

  // Mode colors (kept simple & reliable)
  const isPOS = mode === "pos";
  const c1 = isPOS ? "rgba(16,185,129,0.55)" : "rgba(124,58,237,0.55)"; // emerald | violet
  const c2 = isPOS ? "rgba(34,211,238,0.55)" : "rgba(236,72,153,0.55)"; // cyan | pink

  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          key={`cin-${triggerKey}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 pointer-events-none z-[130]"
          style={{ willChange: "opacity, transform", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
        >
          {/* Backdrop fade */}
          <div className="absolute inset-0 bg-black/45" />

          {/* Vignette focus */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Parallax energy fields (GPU-only transforms) */}
          <motion.div
            initial={{ scale: 0.78, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 1.16, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.3 : 0.95, ease: "easeOut" }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(1200px 480px at 50% -5%, ${c2}, transparent 70%),
                           radial-gradient(900px 380px at 50% 105%, ${c1}, transparent 70%)`,
              mixBlendMode: "screen",
              willChange: "transform, opacity",
              transform: "translateZ(0)",
            }}
          />

          {/* Centerpiece glyph */}
          <div className="absolute inset-0 flex items-center justify-center">
            <MorphingGlyph mode={mode} reduceMotion={reduceMotion} />
          </div>

          {/* Subtle grid + aurora curtains */}
          <HexGridTint colorA={c1} colorB={c2} />
          {!reduceMotion && <AuroraCurtains colorA={c1} colorB={c2} />}
          {/* Magical vortex */}
          {!reduceMotion && <Vortex colorA={c1} colorB={c2} />}

          {/* Gate curtains */}
          {!reduceMotion && <GateCurtains />}

          {/* Effects — lightweight, non-blocking */}
          {!reduceMotion && (
            <>
              <RippleExpansion colorA={c1} colorB={c2} />
              <SparkParticles mode={mode} />
              <OrbitIcons mode={mode} />
              <ScanSweep />
              <TitleOverlay mode={mode} />
              <FinalFlash />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Morphing glyph with simple orbiters */
function MorphingGlyph({ mode, reduceMotion }) {
  const isPOS = mode === "pos";
  const primary = isPOS ? "#34d399" : "#a78bfa"; // emerald-400 | violet-400
  const secondary = isPOS ? "#22d3ee" : "#f472b6"; // cyan-400 | pink-400

  return (
    <div className="relative" style={{ width: 260, height: 260 }}>
      {/* Chromatic ring */}
      <motion.div
        initial={{ scale: 0.82, rotate: 0, opacity: 0.9 }}
        animate={{ scale: 1.06, rotate: reduceMotion ? 0 : 220, opacity: 1 }}
        exit={{ scale: 1.12, opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.3 : 0.95, ease: "easeOut" }}
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 0 2px ${primary} inset, 0 0 80px ${secondary}`,
          filter: "blur(0.2px)",
          willChange: "transform, opacity",
          transform: "translateZ(0)",
        }}
      />

      {!reduceMotion && (
        <>
          <Orbiter radius={95} size={10} color={primary} delay={0} />
          <Orbiter radius={95} size={8} color={secondary} delay={0.08} />
          <Orbiter radius={70} size={7} color={secondary} reverse delay={0.12} />
        </>
      )}

      {/* Center morph */}
      <motion.div
        initial={{ scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.05, opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.25 : 0.6, ease: "easeOut", delay: reduceMotion ? 0 : 0.1 }}
        className="absolute inset-0 flex items-center justify-center"
        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
      >
        <motion.div
          key={isPOS ? "pos" : "dash"}
          initial={{ scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 1.08, rotate: 6 }}
          transition={{ duration: reduceMotion ? 0.2 : 0.5, ease: "easeOut" }}
        >
          {isPOS ? <POSMark /> : <DashboardMark />}
        </motion.div>
      </motion.div>
    </div>
  );
}

function Orbiter({ radius = 80, size = 8, color = "#22d3ee", reverse = false, delay = 0 }) {
  return (
    <motion.div
      initial={{ rotate: 0 }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ repeat: 0, duration: 1.05, ease: "linear", delay }}
      className="absolute inset-0"
      style={{ borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", willChange: "transform, opacity", transform: "translateZ(0)" }}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: `0 0 16px ${color}`,
          left: "50%",
          top: "50%",
          transform: `rotate(0deg) translate(${radius}px)`,
        }}
      />
    </motion.div>
  );
}

function DashboardMark() {
  // High-contrast dashboard grid icon
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="16" width="40" height="32" rx="8" fill="#a78bfa" stroke="white" strokeOpacity="0.35" strokeWidth="2"/>
      <rect x="66" y="16" width="40" height="20" rx="8" fill="#f472b6" stroke="white" strokeOpacity="0.35" strokeWidth="2"/>
      <rect x="14" y="56" width="40" height="48" rx="10" fill="#f472b6" stroke="white" strokeOpacity="0.35" strokeWidth="2"/>
      <rect x="66" y="40" width="40" height="64" rx="10" fill="#a78bfa" stroke="white" strokeOpacity="0.35" strokeWidth="2"/>
    </svg>
  );
}

function POSMark() {
  // POS/cart hybrid icon with outlines for clarity
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="26" y="26" width="68" height="16" rx="8" fill="#22d3ee" stroke="white" strokeOpacity="0.35" strokeWidth="2"/>
      <rect x="18" y="46" width="84" height="30" rx="10" fill="#34d399" stroke="white" strokeOpacity="0.35" strokeWidth="2"/>
      <path d="M34 78h52l-6 10a10 10 0 0 1-8 4H48a10 10 0 0 1-8-4l-6-10z" fill="#22d3ee" stroke="white" strokeOpacity="0.25"/>
      <circle cx="48" cy="94" r="6.5" fill="#34d399" stroke="white" strokeOpacity="0.35"/>
      <circle cx="72" cy="94" r="6.5" fill="#34d399" stroke="white" strokeOpacity="0.35"/>
    </svg>
  );
}

function HexGridTint({ colorA = "rgba(255,255,255,0.2)", colorB = "rgba(255,255,255,0.2)" }) {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="hex" width="22" height="19" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
          <path d="M11 0l11 6.5v6.5L11 19 0 13V6.5L11 0z" fill="none" stroke="white" strokeOpacity="0.35" />
        </pattern>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={colorA} />
          <stop offset="100%" stopColor={colorB} />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
      <rect width="100%" height="100%" fill="url(#lg)" />
    </svg>
  );
}

function AuroraCurtains({ colorA, colorB }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.35 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9 }}
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          `radial-gradient(800px 300px at 10% 20%, ${colorA}, transparent 60%),
           radial-gradient(700px 260px at 90% 30%, ${colorB}, transparent 60%),
           radial-gradient(700px 260px at 50% 110%, ${colorA}, transparent 60%)`,
        mixBlendMode: "screen",
        filter: "blur(6px)",
        willChange: "transform, opacity",
        transform: "translateZ(0)",
      }}
    />
  );
}

function RippleExpansion({ colorA = "rgba(255,255,255,0.4)", colorB = "rgba(255,255,255,0.2)" }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0.7 }}
      animate={{ scale: 6, opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ mixBlendMode: "screen", willChange: "transform, opacity", transform: "translateZ(0)" }}
    >
      <div
        className="w-64 h-64 rounded-full"
        style={{
          boxShadow: `0 0 0 3px ${colorA} inset, 0 0 64px ${colorB}, 0 0 120px ${colorA}`,
          background: `radial-gradient(circle, ${colorA} 0%, transparent 60%)`,
        }}
      />
    </motion.div>
  );
}

function SparkParticles({ mode }) {
  const isPOS = mode === "pos";
  const base = isPOS ? "#34d399" : "#a78bfa";
  const alt = isPOS ? "#22d3ee" : "#f472b6";
  const sparks = Array.from({ length: 18 });
  return (
    <>
      {sparks.map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos((i / sparks.length) * 2 * Math.PI) * (160 + (i % 5) * 22),
            y: Math.sin((i / sparks.length) * 2 * Math.PI) * (160 + (i % 5) * 22),
            opacity: 0,
            scale: 0.2,
          }}
          transition={{ duration: 1, ease: "easeOut", delay: i * 0.015 }}
          className="absolute left-1/2 top-1/2"
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: i % 2 === 0 ? base : alt,
            boxShadow: `0 0 10px ${i % 2 === 0 ? base : alt}, 0 0 20px ${i % 2 === 0 ? base : alt}`,
          }}
        />
      ))}
    </>
  );
}

function MiniIcon({ type = "cart", color = "#fff", size = 20 }) {
  const s = size;
  if (type === "receipt") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 3h10a1 1 0 0 1 1 1v16l-2-1-2 1-2-1-2 1-2-1-2 1V4a1 1 0 0 1 1-1z" fill={color} opacity="0.9"/>
        <path d="M9 7h6M9 11h6M9 15h4" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (type === "box") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 7l9-4 9 4-9 4-9-4z" fill={color} opacity="0.9"/>
        <path d="M3 7v10l9 4 9-4V7" stroke="white" strokeOpacity="0.65"/>
      </svg>
    );
  }
  if (type === "bar") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="10" width="4" height="8" rx="1" fill={color} />
        <rect x="10" y="6" width="4" height="12" rx="1" fill={color} />
        <rect x="16" y="3" width="4" height="15" rx="1" fill={color} />
      </svg>
    );
  }
  if (type === "line") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 16l5-5 3 3 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  // cart default
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 5h2l2.2 9.5a2 2 0 0 0 2 1.5h6.6a2 2 0 0 0 2-1.5L20 8H7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="20" r="1.8" fill={color} />
      <circle cx="17" cy="20" r="1.8" fill={color} />
    </svg>
  );
}

function OrbitIcons({ mode }) {
  const isPOS = mode === "pos";
  const base = isPOS ? "#34d399" : "#a78bfa";
  const alt  = isPOS ? "#22d3ee" : "#f472b6";
  const rings = isPOS
    ? [
        { icon: "cart", radius: 120, color: base, delay: 0 },
        { icon: "receipt", radius: 95, color: alt, delay: 0.05 },
        { icon: "box", radius: 145, color: base, delay: 0.1 },
      ]
    : [
        { icon: "bar", radius: 120, color: base, delay: 0 },
        { icon: "line", radius: 95, color: alt, delay: 0.05 },
        { icon: "receipt", radius: 145, color: base, delay: 0.1 },
      ];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {rings.map((r, i) => (
        <motion.div
          key={i}
          initial={{ rotate: 0, opacity: 0 }}
          animate={{ rotate: 360, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: "linear", delay: r.delay }}
          className="absolute"
          style={{ width: r.radius * 2, height: r.radius * 2, borderRadius: "50%", willChange: "transform, opacity", transform: "translateZ(0)" }}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(${r.radius}px, -50%)` }}>
            <div style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.45))" }}>
              <MiniIcon type={r.icon} color={r.color} size={24} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ScanSweep() {
  return (
    <motion.div
      initial={{ x: "-120%", opacity: 0 }}
      animate={{ x: "120%", opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: "easeInOut" }}
      className="pointer-events-none fixed top-0 bottom-0 w-[35%] z-[131]"
      style={{
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        background:
          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0) 100%)",
        filter: "blur(8px)",
        mixBlendMode: "screen",
      }}
    />
  );
}

function TitleOverlay({ mode }) {
  const text = mode === "pos" ? "Switching to POS Mode…" : "Returning to Dashboard…";
  return (
    <div className="fixed inset-0 flex items-start justify-center mt-24 z-[132] pointer-events-none">
      <motion.div
        key={text}
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="px-4 py-2 rounded-full text-sm font-medium"
        style={{
          willChange: "transform, opacity",
          transform: "translateZ(0)",
          color: "white",
          background: "linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          backdropFilter: "blur(10px)",
        }}
      >
        {text}
      </motion.div>
    </div>
  );
}

function Vortex({ colorA, colorB }) {
  return (
    <motion.div
      initial={{ scale: 0.5, rotate: 0, opacity: 0 }}
      animate={{ scale: 1.4, rotate: 360, opacity: 0.35 }}
      exit={{ scale: 1.6, opacity: 0 }}
      transition={{ duration: 1.1, ease: "easeInOut" }}
      className="absolute inset-0"
      style={{
        background: `conic-gradient(from 180deg at 50% 50%, ${colorA}, ${colorB}, ${colorA})`,
        borderRadius: "50%",
        mixBlendMode: "screen",
        filter: "blur(60px)",
        willChange: "transform, opacity",
      }}
    />
  );
}

function FinalFlash() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.6, ease: "easeInOut", delay: 0.5 }}
      className="absolute inset-0 bg-white"
      style={{ mixBlendMode: "overlay", willChange: "opacity" }}
    />
  );
}

function GateCurtains() {
  return (
    <>
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: "-110%" }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
        className="fixed top-0 bottom-0 left-0 w-1/2"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.5), rgba(0,0,0,0.15))",
          backdropFilter: "blur(4px)",
        }}
      />
      <motion.div
        initial={{ x: 0 }}
        animate={{ x: "110%" }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
        className="fixed top-0 bottom-0 right-0 w-1/2"
        style={{
          background:
            "linear-gradient(270deg, rgba(0,0,0,0.5), rgba(0,0,0,0.15))",
          backdropFilter: "blur(4px)",
        }}
      />
    </>
  );
}