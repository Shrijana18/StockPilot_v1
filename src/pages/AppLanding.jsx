import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Optional haptics (safe if missing)
let Haptics;
try { Haptics = require("@capacitor/haptics").Haptics; } catch (_) { Haptics = null; }

const LOGO = "/assets/flyp_logo.png";     // FLYP official logo
const LOGO_FALLBACK = "/assets/flyp_logo.png";
const WORDMARK = "FLYP";                   // wordmark text

// --- NEW: Custom hook for the typewriter effect ---
function useTypewriter(text, speed = 30) {
  const [displayedText, setDisplayedText] = useState("");
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setDisplayedText(""); // Reset on text change
    setIsDone(false);
    if (!text) return;

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => {
        if (prev.length < text.length) {
          return text.substring(0, prev.length + 1);
        } else {
          clearInterval(intervalId);
          setIsDone(true);
          return prev;
        }
      });
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed]);

  return { displayedText, isDone };
}


export default function AppLanding() {
  const navigate = useNavigate();
  const [logoSrc, setLogoSrc] = useState(LOGO);
  const [phase, setPhase] = useState("splash"); // splash -> brand -> ready
  const [leaving, setLeaving] = useState(false); // page transition overlay
  
  // NEW: Use the typewriter hook for the tagline
  const tagline = "From AI billing to smart inventory, seamless orders and real‑time analytics — your complete Supply Chain OS.";
  const { displayedText: animatedTagline, isDone: taglineIsDone } = useTypewriter(tagline, 30);


  // Timeline (cinematic)
  useEffect(() => {
    document.body.style.overscrollBehavior = "none";
    const t1 = setTimeout(() => setPhase("brand"), 1000);
    const t2 = setTimeout(() => setPhase("ready"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); document.body.style.overscrollBehavior = ""; };
  }, []);

  // Tilt parallax for aurora (fallback to soft drift)
  useEffect(() => {
    const onOrient = (e) => {
      const x = Math.max(-1, Math.min(1, (e.gamma || 0) / 30));
      const y = Math.max(-1, Math.min(1, (e.beta  || 0) / 30));
      document.documentElement.style.setProperty("--tilt-x", `${x * 6}px`);
      document.documentElement.style.setProperty("--tilt-y", `${y * 6}px`);
    };
    window.addEventListener("deviceorientation", onOrient, true);
    const drift = setInterval(() => {
      const t = Date.now() / 4000;
      document.documentElement.style.setProperty("--tilt-x", `${Math.sin(t) * 4}px`);
      document.documentElement.style.setProperty("--tilt-y", `${Math.cos(t) * 4}px`);
    }, 120);
    return () => { window.removeEventListener("deviceorientation", onOrient, true); clearInterval(drift); };
  }, []);

  // NEW: Mouse-aware spotlight effect
  useEffect(() => {
    const onMouseMove = (e) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);


  const transitionTo = (path) => async () => {
    if (leaving) return; // guard against double taps
    try { Haptics && (await Haptics.selectionStart(), await Haptics.selectionChanged(), await Haptics.selectionEnd()); } catch {}
    setLeaving(true);
    setTimeout(() => navigate(path), 260);
  };

  return (
    <div className="relative min-h-[100dvh] bg-black text-white flex flex-col overflow-hidden landing-container">
      <StyleTag />

      {/* Vignette + grain */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 140px rgba(0,0,0,.85)" }} />
        <div className="absolute inset-0 opacity-[.06] mix-blend-overlay grain" />
      </div>

      {/* Smooth page transition when leaving */}
      {leaving && <div className="fixed inset-0 z-[60] bg-black animate-fade-to-black" />}

      {/* FILMIC INTRO — logo zoom */}
      {phase === "splash" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_40%,rgba(16,185,129,.18),transparent_60%)] pointer-events-none" />
          <img
            src={logoSrc}
            onError={() => setLogoSrc(LOGO_FALLBACK)}
            alt="FLYP"
            className="h-28 w-28 object-contain animate-logo-zoom drop-shadow-[0_12px_60px_rgba(16,185,129,.55)]"
          />
        </div>
      )}

      {/* BRAND HOLD — morph + aperture open */}
      {phase !== "ready" && (
        <div className={`fixed inset-0 z-40 grid place-items-center bg-black ${phase === "brand" ? "animate-iris-open" : ""}`}>
          <Particles />
          <div className="relative flex flex-col items-center">
            <img
              src={logoSrc}
              onError={() => setLogoSrc(LOGO_FALLBACK)}
              alt="FLYP"
              className={`h-14 w-14 object-contain mb-3 opacity-0 animate-brand-fade ${phase === "brand" ? "animate-logo-to-lockup" : ""}`}
              style={{ animationDelay: "100ms" }}
            />
            <BrandWordmark />
          </div>
        </div>
      )}

      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
      </div>

      {/* Aurora wash with tilt parallax */}
      <div className="aurora-tilt pointer-events-none absolute -inset-20 -z-10" aria-hidden>
        <div className="animate-aurora absolute inset-0" />
      </div>
      
      {/* NEW: Boot-up Grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 boot-grid" />

      {/* Header - compact for mobile */}
      <header
        className="px-4 pt-1.5 pb-1 opacity-0 animate-fade-in"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)", animationDelay: "2400ms", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} onError={() => setLogoSrc(LOGO_FALLBACK)} alt="" className="h-10 w-10 object-contain drop-shadow-[0_0_24px_rgba(16,185,129,.45)]" aria-hidden />
            <span className="text-sm font-medium text-white/70 tracking-wider">Supply Chain OS</span>
          </div>
          <button onClick={transitionTo("/dashboard")} className="text-xs px-3 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[.98] transition-colors">
            Skip
          </button>
        </div>
      </header>

      {/* Center - reduced top space for mobile */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-2 sm:pt-4">
        {/* Brand lockup */}
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "2520ms", animationFillMode: "both" }}>
          <div className="relative">
            <BrandLockup logoSrc={logoSrc} />
            <span className="pointer-events-none absolute inset-0 block animate-wordmark-sheen bg-[linear-gradient(120deg,transparent,rgba(255,255,255,.25),transparent)] mix-blend-overlay" />
            <i className="pointer-events-none absolute left-0 right-0 -bottom-2 h-[3px] rounded-full animate-tricolor" />
            {/* One-time burst + pulse ring when ready */}
            {phase === "ready" && (
              <>
                <BurstParticles />
                <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-[56px] border border-emerald-400/0" />
              </>
            )}
          </div>
        </div>

        {/* MODIFIED: Premium tagline with typewriter effect */}
        <p
          className="mt-4 text-white/85 max-w-[28ch] min-h-[120px] mx-auto opacity-0 animate-fade-up-slow [text-wrap:balance]"
          style={{ animationDelay: "2900ms", animationFillMode: "both" }}
        >
          {animatedTagline}
          {!taglineIsDone && <span className="typing-caret">|</span>}
        </p>

        {/* Feature rail marquee */}
        <div className="mt-5 w-full overflow-hidden opacity-0 animate-fade-up-slow" style={{ animationDelay: "3000ms", animationFillMode: "both" }}>
          <div className="feature-rail">
            {[
              "AI Billing", "Inventory", "Orders", "Analytics", "Distributor Connect", "Purchase", "Returns", "GST", "Payments", "Insights"
            ].concat([
              "AI Billing", "Inventory", "Orders", "Analytics", "Distributor Connect", "Purchase", "Returns", "GST", "Payments", "Insights"
            ]).map((label, i) => (
              <span key={i} className="chip">{label}</span>
            ))}
          </div>
        </div>

        {/* India badge */}
        <div className="mt-5 opacity-0 animate-fade-up-slow" style={{ animationDelay: "3080ms", animationFillMode: "both" }}>
          <BadgeIN />
        </div>

        {/* CTAs */}
        <div className="mt-8 w-full max-w-xs space-y-3">
          <CTA onClick={transitionTo("/auth?type=register")} style={{ animationDelay: "3150ms" }} variant="primary">Create Account</CTA>
          <CTA onClick={transitionTo("/auth?type=login")} style={{ animationDelay: "3250ms" }} variant="ghost">Sign In</CTA>
          <CTA onClick={transitionTo("/dashboard")} style={{ animationDelay: "3350ms" }} variant="soft">Continue</CTA>
        </div>
      </main>

      <footer className="px-4 pb-4 text-center text-[11px] text-white/50 opacity-0 animate-fade-in" style={{ paddingBottom: "env(safe-area-inset-bottom)", animationDelay: "3400ms", animationFillMode: "both" }}>
        Made for mobile • Optimized for Android &amp; iOS • v1
      </footer>
    </div>
  );
}

/** --- Pieces --- **/

function Particles() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-60" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <circle key={i} cx="50%" cy="45%" r="2" fill={i % 2 ? "#86efac" : "#67e8f9"}>
          <animate attributeName="r" values="1.5;2.5;1.5" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
          <animate attributeName="cx" values="50%; 52%; 48%; 50%" dur={`${3 + i * 0.2}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values="45%; 43%; 47%; 45%" dur={`${3.2 + i * 0.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function BurstParticles() {
  return (
    <svg className="absolute inset-0 w-[220px] h-[80px] -translate-x-1/2 left-1/2 -top-8 pointer-events-none" viewBox="0 0 220 80" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => {
        const delay = 0.05 * i; const cx = 110, cy = 40; const angle = (i / 18) * Math.PI * 2; const dx = Math.cos(angle) * 40; const dy = Math.sin(angle) * 20; const color = i % 3 === 0 ? "#86efac" : i % 3 === 1 ? "#67e8f9" : "#a78bfa";
        return (
          <circle key={i} cx={cx} cy={cy} r="2" fill={color} opacity="0">
            <animate attributeName="opacity" values="0;1;0" dur="900ms" begin={`${delay}s`} fill="freeze" />
            <animate attributeName="cx" values={`${cx};${cx + dx}`} dur="900ms" begin={`${delay}s`} fill="freeze" />
            <animate attributeName="cy" values={`${cy};${cy + dy}`} dur="900ms" begin={`${delay}s`} fill="freeze" />
            <animate attributeName="r" values="2;0" dur="900ms" begin={`${delay}s`} fill="freeze" />
          </circle>
        );
      })}
    </svg>
  );
}

// MODIFIED: Wordmark with staggered letter animation
function BrandWordmark() {
  return (
    <div className="relative select-none">
      <div className="text-4xl font-extrabold tracking-[.18em] flex">
        {WORDMARK.split('').map((char, i) => (
          <span key={i} className="opacity-0 animate-letter-fade-up" style={{ animationDelay: `${240 + i * 80}ms` }}>
            {char}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 -bottom-1 h-[2px] bg-gradient-to-r from-emerald-400/0 via-emerald-400/80 to-cyan-300/0 rounded-full opacity-0 animate-brand-fade" style={{ animationDelay: "600ms" }} />
    </div>
  );
}

// Logo only — no FLYP wordmark; enlarged logo + tagline
function BrandLockup({ logoSrc }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <img src={logoSrc} alt="" className="h-20 w-20 sm:h-24 sm:w-24 object-contain drop-shadow-[0_8px_32px_rgba(16,185,129,.45)]" aria-hidden />
      <span className="text-sm font-medium text-white/70 tracking-wider">Supply Chain OS</span>
    </div>
  );
}

function CTA({ children, variant = "primary", ...rest }) {
  const base = "w-full rounded-xl py-3.5 text-base font-semibold transition will-change-transform opacity-0 animate-fade-up-slow active:scale-[.98]";
  const styles = {
    primary: "bg-emerald-500 text-neutral-900 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400",
    ghost: "border border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md",
    soft: "bg-white/8 text-white/85 hover:bg-white/12 border border-white/10",
  };
  return <button className={`${base} ${styles[variant]}`} {...rest}>{children}</button>;
}

function BadgeIN() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-white/12 bg-white/[.06] backdrop-blur-md">
      <span className="text-[12px] font-semibold bg-[linear-gradient(90deg,#ff9933,#ffffff,#128807)] bg-clip-text text-transparent animate-tricolor-text">
        Made in India — for the world
      </span>
      <span aria-hidden>🇮🇳</span>
    </div>
  );
}

function StyleTag() {
  return (
    <style>{`
      :root {
        --tilt-x: 0px;
        --tilt-y: 0px;
        --mouse-x: 50vw;
        --mouse-y: 50vh;
      }

      /* NEW: Interactive mouse light */
      .landing-container::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1; /* Position it above background but below content */
        background: radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(16, 185, 129, 0.1), transparent 80%);
        pointer-events: none;
        transition: background .2s ease-out;
      }
      
      .orb { position:absolute; border-radius:9999px; filter: blur(70px); opacity:.2; }
      .orb-a { width: 360px; height: 360px; background:#22d3ee; left: -80px; bottom: -80px; }
      .orb-b { width: 280px; height: 280px; background:#34d399; right: -60px; top: -60px; opacity:.16; }

      .aurora-tilt { transform: translate3d(var(--tilt-x), var(--tilt-y), 0); transition: transform .2s ease-out; }

      @media (prefers-reduced-motion: no-preference) {
        .animate-logo-zoom { animation: logoZoom 1s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes logoZoom { 0% { transform: scale(1.35); opacity: 0; filter: blur(6px) } 65% { transform: scale(1.02); opacity: 1; filter: blur(0) } 100% { transform: scale(1.00); opacity: 1 } }

        .animate-iris-open { animation: irisOpen 1s ease forwards; -webkit-mask-image: radial-gradient(circle at 50% 45%, #000 0%, #000 0%, transparent 0%); mask-image: radial-gradient(circle at 50% 45%, #000 0%, #000 0%, transparent 0%); -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }
        @keyframes irisOpen { 0% { -webkit-mask-size: 0% 0%; mask-size: 0% 0%; opacity:1 } 100% { -webkit-mask-size: 220% 220%; mask-size: 220% 220%; opacity:0 } }

        .animate-logo-to-lockup { animation: logoToLockup .9s cubic-bezier(.23,1,.32,1) .1s both; }
        @keyframes logoToLockup { from { transform: translateY(10px) scale(1.15); opacity:0 } to { transform: translateY(0) scale(1); opacity:1 } }

        .animate-brand-fade { animation: brandFade .7s ease both; }
        @keyframes brandFade { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        
        /* NEW: Letter animation */
        .animate-letter-fade-up { animation: letterFadeUp .6s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes letterFadeUp {
          from { transform: translateY(15px) rotate(5deg); opacity: 0; }
          to { transform: translateY(0) rotate(0deg); opacity: 1; }
        }

        .animate-fade-in { animation: fadeIn .8s ease both; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

        .animate-fade-up { animation: fadeUp .8s cubic-bezier(.23,1,.32,1) both; }
        .animate-fade-up-slow { animation: fadeUpSlow .9s cubic-bezier(.23,1,.32,1) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeUpSlow { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }

        .animate-aurora { background: radial-gradient(ellipse 50% 40% at 20% 10%, rgba(56,189,248,.12), transparent), radial-gradient(ellipse 50% 30% at 80% 0%, rgba(34,197,94,.12), transparent); animation: auroraShift 18s ease-in-out infinite alternate; }
        @keyframes auroraShift { 0% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(-2%,1%,0) scale(1.02) } 100% { transform: translate3d(2%,-1%,0) scale(1.03) } }

        .animate-wordmark-sheen { animation: wordSheen 2.2s ease-in-out 2.6s both; }
        @keyframes wordSheen { 0% { transform: translateX(-140%) rotate(10deg); opacity: 0 } 10% { opacity: .8 } 100% { transform: translateX(140%) rotate(10deg); opacity: 0 } }

        .animate-pulse-ring { animation: pulseRing 1.4s ease-out 0.2s both; }
        @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.0); opacity:0 } 30% { box-shadow: 0 0 0 10px rgba(16,185,129,0.25); opacity:1 } 100% { box-shadow: 0 0 0 32px rgba(16,185,129,0); opacity:0 } }

        .typing-caret { display:inline-block; width:1ch; animation: caretBlink 1s steps(1) infinite; }
        @keyframes caretBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }

        .grain { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="120" height="120" filter="url(%23n)" opacity="0.35"/></svg>'); background-size: 120px 120px; animation: grainShift 8s steps(6) infinite; }
        @keyframes grainShift { 0%{transform:translate(0,0)} 20%{transform:translate(-10px,6px)} 40%{transform:translate(8px,-12px)} 60%{transform:translate(-4px,8px)} 80%{transform:translate(12px,4px)} 100%{transform:translate(0,0)} }

        .animate-chip-pulse { animation: chipPulse 3s ease-in-out infinite; }
        @keyframes chipPulse { 0%,100%{ box-shadow: 0 0 0 rgba(16,185,129,0) } 50%{ box-shadow: 0 0 24px rgba(16,185,129,.18) } }

        .animate-tricolor { background: linear-gradient(90deg,#ff9933,#ffffff,#128807); filter: blur(.2px); }
        .animate-tricolor-text { background-size: 200% 100%; animation: triText 4s ease-in-out infinite; }
        @keyframes triText { 0%,100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }

        .animate-fade-to-black { animation: fadeToBlack .26s ease forwards; }
        @keyframes fadeToBlack { from { opacity: 0 } to { opacity: 1 } }

        .feature-rail { display:flex; gap:.5rem; padding:0 .5rem; width:max-content; animation: rail 22s linear infinite; }
        .chip { font-size:11px; letter-spacing:.02em; padding:.35rem .7rem; border-radius:9999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); backdrop-filter: blur(6px); white-space:nowrap; }
        @keyframes rail { from { transform: translateX(0) } to { transform: translateX(-50%) } }

        /* NEW: Power-on grid animation */
        .boot-grid {
          background-image:
            linear-gradient(to right, rgba(34, 197, 94, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 197, 94, 0.2) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 10%, transparent 60%);
          animation: gridBoot 3s ease-out both;
          animation-delay: 2s; /* Start it as the main UI appears */
        }
        @keyframes gridBoot {
          from {
            opacity: 0;
            transform: perspective(600px) rotateX(70deg) translateY(100px);
          }
          to {
            opacity: 1;
            transform: perspective(600px) rotateX(70deg) translateY(0);
          }
        }
      }

      .feature-rail { display:flex; gap:.5rem; padding:0 .5rem; width:max-content; }
      .chip { font-size:11px; letter-spacing:.02em; padding:.35rem .7rem; border-radius:9999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); backdrop-filter: blur(6px); white-space:nowrap; }
    `}</style>
  );
}