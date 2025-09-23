import React, { useEffect } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AOS from 'aos';
import 'aos/dist/aos.css';
import Lottie from "lottie-react";
// --- Magical UI helpers ---
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// --- THEME TOKENS & STYLES ---
const THEME = {
  bg: 'from-[#0B0F14] via-[#0D1117] to-[#0B0F14]',
  card: 'bg-white/5 backdrop-blur border border-white/10',
  accent: 'from-emerald-400 via-teal-300 to-cyan-400',
  textGrad: 'bg-gradient-to-r from-white via-white to-emerald-200 bg-clip-text text-transparent',
};
const styles = `
  @keyframes auroraShift { 0%{ background-position: 0% 50% } 50%{ background-position: 100% 50% } 100%{ background-position: 0% 50% } }
  @keyframes shimmer { 0%{ background-position:-200% 0 } 100%{ background-position:200% 0 } }
  .aurora-bg { background: radial-gradient(1200px 600px at 10% 10%, rgba(16,185,129,0.20), transparent 60%), radial-gradient(1000px 500px at 90% 20%, rgba(20,184,166,0.18), transparent 60%), radial-gradient(900px 500px at 50% 100%, rgba(34,197,94,0.18), transparent 60%); }
  .anim-gradient { background-size: 200% 200%; animation: auroraShift 18s ease-in-out infinite; }
  .kinetic-text { background: linear-gradient(90deg, rgba(255,255,255,.9), rgba(255,255,255,.6), rgba(16,185,129,.9)); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: shimmer 6s linear infinite; }
  .grain::before { content:''; position:fixed; inset:-10%; pointer-events:none; background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN0dPz8fwAJ8gPZpjGZ8QAAAABJRU5ErkJggg=='); opacity:.06; mix-blend-mode: overlay; }
  .glass { backdrop-filter: blur(10px); }
`;

const LandingPage = () => {
  const navigate = useNavigate();

  const [scrollProgress, setScrollProgress] = useState(0);
  const [heroOffset, setHeroOffset] = useState({ title: 0, art: 0 });
  const [shrinkHeader, setShrinkHeader] = useState(false);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroAnimRef = React.useRef(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const confettiRef = React.useRef(null);
  const auraRef = React.useRef(null);
  const [animationData, setAnimationData] = useState(null);
  const [themeMode, setThemeMode] = useState('dark'); // 'dark' | 'dusk'
  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('flyp_theme');
      if (saved === 'dark' || saved === 'dusk') {
        setThemeMode(saved);
        return;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setThemeMode('dusk');
      } else {
        setThemeMode('dark');
      }
    } catch {}
  }, []);
  // Persist theme
  useEffect(() => {
    try { localStorage.setItem('flyp_theme', themeMode); } catch {}
  }, [themeMode]);

  // --- Headline kinetic words, scrollytelling state, metrics counters ---
  const words = ['Built to Fly', 'Automate Everything', 'Inventory that Thinks', 'Billing in Seconds', 'Analytics that Act'];
  const [wordIndex, setWordIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [metrics, setMetrics] = useState({ hours: 0, accuracy: 0, growth: 0 });
  const [showRoi, setShowRoi] = useState(false);
  const [roi, setRoi] = useState({ ordersPerDay: 50, timePerOrderMin: 3, staffCostPerHour: 200 });
  const [screenIndex, setScreenIndex] = useState(0);
  const [isYearly, setIsYearly] = useState(false); // pricing toggle
  // restore saved pricing mode
  useEffect(() => {
    try {
      const saved = localStorage.getItem('flyp_pricing_yearly');
      if (saved === '1') setIsYearly(true);
    } catch {}
  }, []);
  // persist pricing mode
  useEffect(() => {
    try { localStorage.setItem('flyp_pricing_yearly', isYearly ? '1' : '0'); } catch {}
  }, [isYearly]);
  const [mag, setMag] = useState({x: 0, y: 0});    // magnetic CTA offset
  // --- 15-sec Micro Demo (inline cart sandbox) ---
  const [demo, setDemo] = useState({ sku: '', qty: 1, price: 99, discount: 0 });
  const [demoTotal, setDemoTotal] = useState(99);
  const [demoActive, setDemoActive] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0); // 0..100 over ~15s
  const demoRef = React.useRef(null);

  const recalcDemo = (d) => {
    const qty = Math.max(1, Number(d.qty) || 1);
    const price = Math.max(0, Number(d.price) || 0);
    const disc = Math.max(0, Math.min(90, Number(d.discount) || 0));
    const sub = qty * price;
    const total = sub - (sub * disc) / 100;
    setDemoTotal(Math.round(total));
  };

  useEffect(() => { recalcDemo(demo); }, []);

  // Start/stop the 15s progress only when the demo card is on screen
  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setDemoActive(entry.isIntersecting);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!demoActive) { setDemoProgress((p) => (p > 99 ? 0 : p)); return; }
    let t0 = performance.now();
    let id = requestAnimationFrame(function tick(now){
      const elapsed = now - t0; // ms
      const p = Math.min(100, (elapsed / 15000) * 100);
      setDemoProgress(p);
      if (p < 100 && demoActive) id = requestAnimationFrame(tick); else cancelAnimationFrame(id);
    });
    return () => cancelAnimationFrame(id);
  }, [demoActive]);
  // --- Magnetic hover and INR price helpers ---
  const onMagnetMove = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - (r.left + r.width/2)) / r.width) * 8;
    const dy = ((e.clientY - (r.top + r.height/2)) / r.height) * 8;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onMagnetLeave = (e) => { e.currentTarget.style.transform = 'translate(0,0)'; };

  const fmtINR = (n) => `₹${Math.round(n).toLocaleString()}`;
  const priceLabel = (m) => isYearly ? `${fmtINR(m*12*0.8)}/yr` : `${fmtINR(m)}/mo`;
  // Spotlight modal state
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightFeature, setSpotlightFeature] = useState(null); // stores feature object
  const [spotlightSlide, setSpotlightSlide] = useState(0);
  const touch = React.useRef({ startX: 0, dx: 0 });
  const [ocrSlider, setOcrSlider] = useState(50); // before/after slider percent
  const [ocrDetected, setOcrDetected] = useState(0);
  // Supply path scrollytelling (PO → Distributor → Retailer)
  const [roleStep, setRoleStep] = useState(0); // 0=PO, 1=Distributor, 2=Retailer
  const [truckT, setTruckT] = useState(0); // 0..1 progress along path
  const pathRef = React.useRef(null);
  const svgBoxRef = React.useRef(null);
  const [truckPos, setTruckPos] = useState({ x: 0, y: 0, r: 0 });

  const tween = (from, to, dur = 800) => {
    const t0 = performance.now();
    const animate = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      // easeInOutCubic
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const v = from + (to - from) * e;
      setTruckT(v);
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };
  // Section nav dots state
  const sections = [
    { id: 'hero', label: 'Intro' },
    { id: 'story', label: 'Story' },
    { id: 'features', label: 'Features' },
    { id: 'whyflyp', label: 'Why' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'contact', label: 'Contact' },
  ];
  const [currentSection, setCurrentSection] = useState('hero');
  const screens = {
    0: [
      { title: 'OCR Scan', caption: 'Upload & detect fields' },
      { title: 'Clean Mapping', caption: 'AI fixes labels & values' },
      { title: 'Ready to Save', caption: 'Instant inventory rows' },
    ],
    1: [
      { title: 'Predictive Qty', caption: 'We estimate quantities' },
      { title: 'Discount Guard', caption: 'Flags suspicious pricing' },
      { title: 'Low Stock Alert', caption: 'Warns before checkout' },
    ],
    2: [
      { title: 'One-Click Bill', caption: 'Confirm & generate' },
      { title: 'Auto Deduct', caption: 'Inventory updates live' },
      { title: 'Share Instantly', caption: 'WhatsApp / Email / PDF' },
    ],
  };

  // Clickable features config (title, description, icon, route)
  const features = [
    { key: 'ai-inventory', title: 'AI Inventory Generator', desc: 'Automatically generate and optimize your inventory with AI-driven insights.', icon: '/assets/ai_inventory.png', href: '/feature/ai-inventory', badge: 'New' },
    { key: 'ocr-import', title: 'OCR Billing Import', desc: 'Scan and import paper invoices instantly with smart OCR technology.', icon: '/assets/ocr_billing.png', href: '/feature/ocr-import' },
    { key: 'smart-cart', title: 'Smart Cart', desc: 'Create and manage orders quickly with intelligent cart suggestions.', icon: '/assets/smart_cart.png', href: '/feature/smart-cart' },
    { key: 'analytics', title: 'Customer Analytics', desc: 'Gain insights into customer behavior and sales trends.', icon: '/assets/customer_analytics.png', href: '/feature/analytics' },
    { key: 'distributor', title: 'Distributor Connect', desc: 'Seamlessly collaborate and sync inventory with your distributors.', icon: '/assets/distributor_connect.png', href: '/feature/distributor' },
    { key: 'dashboards', title: 'Dashboards & KPIs', desc: 'Track key performance indicators with customizable dashboards.', icon: '/assets/dashboards_kpis.png', href: '/feature/dashboards' },
    { key: 'realtime-sync', title: 'Realtime Inventory Sync', desc: 'Keep your stock levels updated across all platforms instantly.', icon: '/assets/realtime_inventory.png', href: '/feature/realtime-sync' },
    { key: 'ai-assistant', title: 'Gemini AI Assistant', desc: 'Your AI assistant for smarter decision-making and automation.', icon: '/assets/gemini_ai.png', href: '/feature/ai-assistant' },
  ];

  // click ripple helper
  const ripple = (e) => {
    const card = e.currentTarget;
    const s = document.createElement('span');
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    s.className = 'ripple';
    s.style.left = x + 'px'; s.style.top = y + 'px';
    card.appendChild(s);
    setTimeout(() => s.remove(), 600);
  };
  // Ambient cursor aura effect
  useEffect(() => {
    if (!auraRef.current) return;
    let af = 0;
    const onMove = (e) => {
      if (af) return;
      af = requestAnimationFrame(() => {
        auraRef.current.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
        af = 0;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const sp = total > 0 ? (window.scrollY / total) * 100 : 0;
      setScrollProgress(sp);
      // Parallax for hero elements
      const y = window.scrollY;
      setHeroOffset({ title: clamp(y * 0.12, 0, 40), art: clamp(y * 0.08, 0, 30) });
      setShrinkHeader(y > 20);
      setShowStickyCta(sp > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Rotate kinetic headline words
  useEffect(() => {
    const id = setInterval(() => setWordIndex((i) => (i + 1) % words.length), 2800);
    return () => clearInterval(id);
  }, []);

  // Animate counters on hero enter
  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    const io = new window.IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const t0 = performance.now();
        const dur = 1600;
        const tick = () => {
          const p = Math.min(1, (performance.now() - t0) / dur);
          setMetrics({
            hours: Math.floor(p * 12),
            accuracy: Math.floor(80 + p * 18),
            growth: Math.floor(5 + p * 25),
          });
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // Sticky scrollytelling step observer
  useEffect(() => {
    const steps = document.querySelectorAll('[data-step]');
    const io = new window.IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveStep(Number(e.target.getAttribute('data-step'))); });
    }, { rootMargin: '-30% 0px -50% 0px', threshold: 0.3 });
    steps.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Observe top-level sections to highlight nav dots
  useEffect(() => {
    const opts = { root: null, rootMargin: '-40% 0px -55% 0px', threshold: 0.1 };
    const io = new window.IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setCurrentSection(e.target.id); });
    }, opts);
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  // Auto-cycle screenIndex for MacBook mockup
  useEffect(() => {
    setScreenIndex(0);
    const id = setInterval(() => setScreenIndex((i) => (i + 1) % screens[activeStep].length), 2500);
    return () => clearInterval(id);
  }, [activeStep]);

  useEffect(() => {
    AOS.init({ duration: 1000 });

    // Lazy-load Lottie JSON when hero card is visible (and user doesn't prefer reduced motion)
    const target = heroAnimRef.current;
    if (target && !prefersReducedMotion) {
      const ioAnim = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          fetch("/assets/supplyFlow.json")
            .then((res) => res.json())
            .then(setAnimationData)
            .catch(console.error);
          ioAnim.disconnect();
        }
      }, { threshold: 0.2 });
      ioAnim.observe(target);
    }
    // ensure confetti container exists
    if (!confettiRef.current) {
      confettiRef.current = document.createElement('div');
      confettiRef.current.id = 'confetti-layer';
      confettiRef.current.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:60;';
      document.body.appendChild(confettiRef.current);
    }
  }, []);

  // Compute truck position on the SVG path
  useEffect(() => {
    const path = pathRef.current;
    const svg = svgBoxRef.current;
    if (!path || !svg) return;
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(truckT * len);
    // derive angle by sampling a bit ahead
    const ahead = path.getPointAtLength(Math.min(len, truckT * len + 1));
    const r = Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
    // map viewBox coords to actual pixels
    const vb = { w: 320, h: 800 };
    const rect = svg.getBoundingClientRect();
    const x = (pt.x / vb.w) * rect.width;
    const y = (pt.y / vb.h) * rect.height;
    setTruckPos({ x, y, r });
  }, [truckT]);

  // Observe role panels and tween truck between stops
  useEffect(() => {
    const panels = document.querySelectorAll('[data-role-step]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const idx = Number(e.target.getAttribute('data-role-step'));
          setRoleStep(idx);
          const stops = [0, 0.5, 1];
          tween(truckT, stops[idx], 900);
        }
      });
    }, { rootMargin: '-30% 0px -50% 0px', threshold: 0.4 });
    panels.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleTilt = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y / rect.height) - 0.5) * -10; // rotateX
    const ry = ((x / rect.width) - 0.5) * 10;   // rotateY
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  };
  const resetTilt = (e) => { e.currentTarget.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'; };

  const burstConfetti = () => {
    if (!confettiRef.current) return;
    const container = confettiRef.current;
    const n = 50;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      const size = Math.random() * 8 + 4;
      const left = Math.random() * 100;
      const hue = Math.floor(Math.random() * 360);
      p.style.cssText = `position:absolute;top:0;left:${left}%;width:${size}px;height:${size}px;background:hsl(${hue} 90% 60%);opacity:0.9;border-radius:${Math.random()>0.5?50:4}%;transform:translateY(-10px);`;
      container.appendChild(p);
      const duration = 800 + Math.random()*700;
      const translateY = 80 + Math.random()*120;
      const translateX = (Math.random()-0.5) * 120;
      p.animate([
        { transform: 'translateY(-10px) translateX(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(${translateY}vh) translateX(${translateX}px) rotate(${Math.random()*720-360}deg)`, opacity: 0 }
      ], { duration, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      setTimeout(() => p.remove(), duration + 50);
    }
  };

  return (
    <div className={`text-white min-h-screen aurora-bg anim-gradient grain bg-gradient-to-b ${THEME.bg} ${themeMode==='dusk' ? 'theme-dusk' : 'theme-dark'}`}>
      {/* Hard dark base to ensure contrast regardless of gradient rendering */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#0B0F14]" />
      {/* Ambient cursor aura */}
      <div ref={auraRef} aria-hidden className="fixed top-0 left-0 z-0 pointer-events-none w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(150px 150px at center, rgba(16,185,129,0.25), rgba(16,185,129,0.0) 70%)', filter: 'blur(20px)' }} />
      {/* Navbar */}
      <header className={`sticky top-0 z-50 glass supports-[backdrop-filter]:bg-white/5 bg-white/10 flex justify-between items-center border-b border-white/10 transition-all duration-300 ${shrinkHeader ? 'py-1 px-3 md:py-2 md:px-4' : 'py-4 px-6 md:py-6 md:px-8'}`}>
        <div className="flex items-center">
          <img src="/assets/flyp-logo.png" alt="FLYP Logo" loading="eager" className={`${shrinkHeader ? 'h-8 md:h-10' : 'h-16 md:h-20'} w-auto drop-shadow-md transition-all duration-300`} />
        </div>
        <nav className={`hidden md:flex ${shrinkHeader ? 'gap-5 text-sm' : 'gap-6 text-base'} transition-all duration-300`}>
          <Link to="#features" className="hover:text-emerald-300">Features</Link>
          <Link to="#pricing" className="hover:text-emerald-300">Pricing</Link>
          <Link to="#contact" className="hover:text-emerald-300">Contact</Link>
        </nav>
        <div className="flex items-center gap-3">
          <button
            className={`hidden md:inline-flex rounded-full border border-white/20 hover:border-emerald-400/60 ${shrinkHeader ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'} transition-all duration-300`}
            onClick={() => setThemeMode(m => m==='dark' ? 'dusk' : 'dark')}
            title="Toggle theme"
          >
            {themeMode==='dark' ? 'Dusk Mode' : 'Dark Mode'}
          </button>
          <button
            className={`rounded border border-white/20 hover:border-emerald-400/60 ${shrinkHeader ? 'px-3 py-0.5 text-sm' : 'px-4 py-1'} transition-all duration-300`}
            onClick={() => navigate("/auth?type=login")}
          >
            Sign In
          </button>
          <button
            className={`rounded bg-emerald-400 hover:bg-emerald-300 text-gray-900 font-semibold shadow-[0_8px_30px_rgba(16,185,129,0.25)] ${shrinkHeader ? 'px-3 py-1 text-sm' : 'px-4 py-1'} transition-all duration-300`}
            onClick={() => navigate("/auth?type=register")}
          >
            Register
          </button>
        </div>
      </header>

      {/* Scroll progress bar */}
      <div className="fixed top-0 left-0 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-blue-500 z-50 transition-[width]" style={{ width: `${scrollProgress}%` }} />

      {/* Hero Section */}
      <section id="hero" className="relative flex flex-col-reverse md:flex-row items-center px-6 md:px-10 py-24 overflow-hidden min-h-[80vh]">
        {/* Subtle radial glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(800px 300px at 10% 10%, rgba(16,185,129,0.06), transparent 60%), radial-gradient(600px 240px at 90% 20%, rgba(34,197,94,0.06), transparent 60%)'
        }} />
        <div aria-hidden className="absolute inset-0 grid-overlay pointer-events-none" />
        {/* LEFT: kinetic headline + metrics */}
        <div className="w-full md:w-1/2 text-center md:text-left z-10 space-y-6" style={{ transform: `translateY(${heroOffset.title}px)`, transition: 'transform .2s ease-out' }}>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]">
            <span className="block kinetic-text">FLYP</span>
            {/* Morphing flight glyph */}
            <svg className="inline-block align-middle ml-3 w-10 h-10" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path id="morph" fill="url(#g1)" d="M50 10 C65 20,75 35,80 50 C75 65,65 80,50 90 C35 80,25 65,20 50 C25 35,35 20,50 10 Z"/>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34d399"/>
                  <stop offset="50%" stopColor="#2dd4bf"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <animate xlinkHref="#morph" attributeName="d" dur="6s" repeatCount="indefinite"
                values="
                M50 10 C65 20,75 35,80 50 C75 65,65 80,50 90 C35 80,25 65,20 50 C25 35,35 20,50 10 Z;
                M10 60 L50 50 L90 40 L50 70 Z;
                M50 15 C70 30,85 45,90 50 C85 55,70 70,50 85 C30 70,15 55,10 50 C15 45,30 30,50 15 Z;
                M50 10 C65 20,75 35,80 50 C75 65,65 80,50 90 C35 80,25 65,20 50 C25 35,35 20,50 10 Z
                "/>
            </svg>
            <span key={wordIndex} className="block mt-2 bg-gradient-to-r from-white via-white to-emerald-200 bg-clip-text text-transparent drop-shadow-[0_1px_10px_rgba(0,0,0,0.35)] animate-word">{words[wordIndex]}</span>
            <span className="block mt-3 text-xl md:text-2xl font-semibold bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              Stop running your business — start flying it.
            </span>
            <svg className="mt-4 w-56 h-6 opacity-80" viewBox="0 0 224 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 12 C 60 2, 120 22, 222 10" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#34d399"/>
                  <stop offset="50%" stopColor="#2dd4bf"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <circle>
                <animateMotion dur="4s" repeatCount="indefinite" path="M2 12 C 60 2, 120 22, 222 10" />
              </circle>
            </svg>
          </h1>
          <p className="text-lg text-white/80 max-w-xl force-text">
            Onboard in under 30 minutes. Automate inventory, billing, and distributor collaboration — with experiences crafted like a flagship product launch.
          </p>
          <div className="flex gap-6 justify-center md:justify-start text-sm">
            <div className={`px-4 py-2 rounded ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><div className="text-2xl font-bold">{metrics.hours}h/wk</div><div className="text-white/60">Saved Ops</div></div>
            <div className={`px-4 py-2 rounded ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><div className="text-2xl font-bold">{metrics.accuracy}%</div><div className="text-white/60">OCR Accuracy</div></div>
            <div className={`px-4 py-2 rounded ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><div className="text-2xl font-bold">{metrics.growth}%</div><div className="text-white/60">Faster Billing</div></div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link to="/auth?type=register">
              <button
                className="relative group px-6 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover-raise magnetic"
                onMouseMove={onMagnetMove}
                onMouseLeave={onMagnetLeave}
              >
                <span className="relative z-10">Get Started Free</span>
              </button>
            </Link>
            <a href="#story" className="px-6 py-2 rounded border border-white/20 hover:border-emerald-300/60">See How It Works</a>
          </div>
          {/* Quick ROI chip */}
          <button onClick={() => setShowRoi(true)} className="mt-3 inline-flex items-center gap-2 text-sm px-4 py-1.5 rounded-full border border-emerald-300/40 bg-white/5 hover:bg-white/10">
            <span>Estimate ROI</span>
          </button>
          {/* 15‑sec Micro‑Demo: tiny cart sandbox */}
          <div ref={demoRef} className={`mt-5 p-4 rounded-xl ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}
               aria-label="15 second interactive demo">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-white/70">Try it now — edit any field</div>
              <div className="text-xs text-white/50">~15s</div>
            </div>
            {/* progress bar */}
            <div className="h-1.5 w-full rounded bg-white/10 overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
                   style={{ width: `${demoProgress}%`, transition: 'width .2s linear' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-white/70">
                <span className="mb-1 block">SKU</span>
                <input
                  value={demo.sku}
                  onChange={(e)=> setDemo((d)=>{ const nd={...d, sku: e.target.value}; return nd; }) }
                  onBlur={()=> recalcDemo(demo)}
                  placeholder="e.g. CHIPS-200G"
                  className="w-full rounded bg-white/10 border border-white/10 px-3 py-2 text-sm placeholder-white/40"
                />
              </label>
              <label className="block text-xs text-white/70">
                <span className="mb-1 block">Qty</span>
                <input type="number"
                  value={demo.qty}
                  onChange={(e)=> { const nd={...demo, qty: e.target.value}; setDemo(nd); recalcDemo(nd); }}
                  className="w-full rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                  min={1}
                />
              </label>
              <label className="block text-xs text-white/70">
                <span className="mb-1 block">Unit Price (₹)</span>
                <input type="number"
                  value={demo.price}
                  onChange={(e)=> { const nd={...demo, price: e.target.value}; setDemo(nd); recalcDemo(nd); }}
                  className="w-full rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                  min={0}
                />
              </label>
              <label className="block text-xs text-white/70">
                <span className="mb-1 block">Discount (%)</span>
                <input type="number"
                  value={demo.discount}
                  onChange={(e)=> { const nd={...demo, discount: e.target.value}; setDemo(nd); recalcDemo(nd); }}
                  className="w-full rounded bg-white/10 border border-white/10 px-3 py-2 text-sm"
                  min={0} max={90}
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-white/80 text-sm">Total</div>
              <div className="text-2xl font-extrabold">₹{demoTotal.toLocaleString('en-IN')}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={()=>{ burstConfetti(); }} className="px-3 py-1.5 rounded bg-emerald-400/90 text-gray-900 text-sm font-semibold hover-raise">Looks this fast</button>
              <a href="#story" className="px-3 py-1.5 rounded border border-white/20 text-sm">See full flow</a>
            </div>
          </div>
        </div>
        {/* RIGHT: glass card + animation */}
        <div className="w-full md:w-1/2 flex justify-center z-10 md:-mt-10 -mt-4" style={{ transform: `translateY(${heroOffset.art - 20}px)`, transition: 'transform .2s ease-out' }}>
          <div ref={heroAnimRef} onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`w-[30rem] h-[30rem] rounded-2xl ${THEME.card} will-change-transform flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
            {animationData && (<Lottie animationData={animationData} loop className="w-[26rem] h-[26rem]" />)}
          </div>
        </div>
        {/* Curved divider at hero bottom */}
        <div aria-hidden className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1440 96" preserveAspectRatio="none">
            <path d="M0,64 C240,32 480,96 720,64 C960,32 1200,0 1440,32 L1440,96 L0,96 Z" fill="rgba(255,255,255,0.03)" />
          </svg>
        </div>
      </section>


      {/* Supply Path: Product Owner → Distributor → Retailer */}
      <section id="story" className="relative px-6 md:px-10 py-24">
        {/* Newly added story headline + subcopy */}
        <div className="mb-8 text-center md:text-left">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]">Story</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mt-1">The journey: Product Owner → Distributor → Retailer</h2>
          <p className="text-white/70 mt-2 max-w-2xl">
            FLYP is the only platform that connects product owners to distributors to retailers. Each role gets powerful
            tools to manage inventory, billing, and analytics — so data flows downstream while insights flow back up.
          </p>
        </div>

        <h3 className="text-3xl font-bold mb-6 text-center md:text-left">One network. Three roles. Zero friction.</h3>
        <p className="text-white/70 mb-10 max-w-2xl md:max-w-none text-center md:text-left">
          FLYP connects Product Owners → Distributors → Retailers on a single data layer so catalogs, bills, and analytics flow downstream — and insights flow back up.
        </p>
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* LEFT: vertical path with moving truck */}
          <div className="relative" ref={svgBoxRef}>
            <svg viewBox="0 0 320 800" className="w-full h-[700px] md:h-[820px]">
              <defs>
                <linearGradient id="route" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399"/>
                  <stop offset="50%" stopColor="#2dd4bf"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
                <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Invisible measure path for JS (truck position) */}
              <path
                id="routePathMeasure"
                ref={pathRef}
                d="M160 30 C 40 120, 280 180, 160 270 S 40 420, 160 520 S 280 650, 160 770"
                fill="none"
                stroke="transparent"
                strokeWidth="6"
              />

              {/* Glowing base */}
              <path
                d="M160 30 C 40 120, 280 180, 160 270 S 40 420, 160 520 S 280 650, 160 770"
                fill="none"
                stroke="url(#route)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.25"
                filter="url(#routeGlow)"
              />

              {/* Animated dashed route */}
              <path
                className="dash-route"
                d="M160 30 C 40 120, 280 180, 160 270 S 40 420, 160 520 S 280 650, 160 770"
                fill="none"
                stroke="url(#route)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Flowing data dots */}
              <g aria-hidden>
                <circle r="3" fill="#a7f3d0">
                  <animateMotion dur="8s" repeatCount="indefinite" begin="0s" rotate="auto" path="M160 30 C 40 120, 280 180, 160 270 S 40 420, 160 520 S 280 650, 160 770" />
                </circle>
                <circle r="3" fill="#99f6e4" opacity="0.85">
                  <animateMotion dur="10s" repeatCount="indefinite" begin="1.2s" rotate="auto" path="M160 30 C 40 120, 280 180, 160 270 S 40 420, 160 520 S 280 650, 160 770" />
                </circle>
                <circle r="2.6" fill="#86efac" opacity="0.9">
                  <animateMotion dur="7s" repeatCount="indefinite" begin="2.4s" rotate="auto" path="M160 30 C 40 120, 280 180, 160 270 S 40 420, 160 520 S 280 650, 160 770" />
                </circle>
              </g>

              {/* Stops */}
              <circle cx="160" cy="270" r="7" fill="#34d399"/>
              <circle cx="160" cy="520" r="7" fill="#2dd4bf"/>
              <circle cx="160" cy="770" r="7" fill="#22d3ee"/>
            </svg>

            {/* Truck icon overlayed and positioned in CSS pixels mapped to SVG viewBox */}
            <div
              className="pointer-events-none absolute w-12 h-8 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: truckPos.x + 'px',
                top: truckPos.y + 'px',
                transform: `translate(-50%, -50%) rotate(${truckPos.r}rad)`,
              }}
            >
              <svg viewBox="0 0 64 32" className="w-full h-full drop-shadow-[0_6px_16px_rgba(34,211,238,.35)]">
                <defs>
                  <linearGradient id="truckGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399"/>
                    <stop offset="100%" stopColor="#22d3ee"/>
                  </linearGradient>
                </defs>
                {/* Body */}
                <rect x="6" y="10" width="34" height="14" rx="3" fill="url(#truckGrad)"/>
                {/* Cabin */}
                <path d="M40 10 h12 l4 6 v8 H40Z" fill="url(#truckGrad)"/>
                {/* Window */}
                <rect x="44" y="12" width="6" height="5" rx="1" fill="rgba(255,255,255,0.85)"/>
                {/* Wheels */}
                <circle cx="16" cy="26" r="3.3" fill="#0b0f14"/>
                <circle cx="48" cy="26" r="3.3" fill="#0b0f14"/>
                <circle cx="16" cy="26" r="1.4" fill="#a7f3d0"/>
                <circle cx="48" cy="26" r="1.4" fill="#a7f3d0"/>
                {/* Light */}
                <circle cx="56" cy="22" r="1.4" fill="#fff"/>
              </svg>
            </div>
          </div>

          {/* RIGHT: role panels */}
          <div className="space-y-10">
            <div data-role-step="0" className={`p-5 rounded-xl ${THEME.card} ${roleStep===0?'ring-1 ring-emerald-400/60 scale-[1.01]':''} transition-all`}>
              <div className="text-sm uppercase tracking-widest text-white/60">Product Owner</div>
              <h4 className="text-2xl font-bold mt-1">Orchestrate your distributors</h4>
              <ul className="mt-3 text-white/80 text-sm space-y-2 list-disc list-inside">
                <li>Push catalogs & price lists downstream</li>
                <li>Realtime sell-through visibility from retailers</li>
                <li>AI Inventory Generator + demand forecasts</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <Link to="/feature/distributor" className="px-3 py-1.5 rounded bg-emerald-400/90 text-gray-900 font-semibold">View Features</Link>
                <button className="px-3 py-1.5 rounded border border-white/20">See Demos</button>
              </div>
            </div>
            <div data-role-step="1" className={`p-5 rounded-xl ${THEME.card} ${roleStep===1?'ring-1 ring-teal-300/60 scale-[1.01]':''} transition-all`}>
              <div className="text-sm uppercase tracking-widest text-white/60">Distributor</div>
              <h4 className="text-2xl font-bold mt-1">Manage retailers with precision</h4>
              <ul className="mt-3 text-white/80 text-sm space-y-2 list-disc list-inside">
                <li>Smart cart with quantity suggestions</li>
                <li>Automated billing & credit control</li>
                <li>Inventory sync across branches</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <Link to="/feature/smart-cart" className="px-3 py-1.5 rounded bg-teal-300/90 text-gray-900 font-semibold">View Features</Link>
                <button className="px-3 py-1.5 rounded border border-white/20">See Demos</button>
              </div>
            </div>
            <div data-role-step="2" className={`p-5 rounded-xl ${THEME.card} ${roleStep===2?'ring-1 ring-cyan-300/60 scale-[1.01]':''} transition-all`}>
              <div className="text-sm uppercase tracking-widest text-white/60">Retailer</div>
              <h4 className="text-2xl font-bold mt-1">Delight customers & grow</h4>
              <ul className="mt-3 text-white/80 text-sm space-y-2 list-disc list-inside">
                <li>OCR billing import → instant bills</li>
                <li>Customer analytics & repeat purchase nudges</li>
                <li>WhatsApp share & one-tap approvals</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <Link to="/feature/analytics" className="px-3 py-1.5 rounded bg-cyan-300/90 text-gray-900 font-semibold">View Features</Link>
                <button className="px-3 py-1.5 rounded border border-white/20">See Demos</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-10 bg-transparent text-center">
        <div aria-hidden className="-mt-10 mb-10 h-6 rotate-1 bg-white/5" />
        {/* Decorative supply-line banner (no dots) */}
        <div className="relative h-14 mb-6 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 56" aria-hidden>
            <g opacity="0.9">
              <rect x={`${10 + scrollProgress*1.2}`} y="18" width="28" height="20" rx="3" fill="rgba(255,255,255,0.15)" />
              <rect x={`${100 + scrollProgress*0.9}`} y="12" width="38" height="26" rx="4" fill="rgba(16,185,129,0.25)" />
              <rect x={`${220 + scrollProgress*0.7}`} y="16" width="34" height="22" rx="4" fill="rgba(34,211,238,0.25)" />
              <path d="M580,38 h140" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />
              <path d="M540,30 C560,10 600,10 620,30" stroke="rgba(34,197,94,0.3)" strokeWidth="3" fill="none" />
              <rect x={`${360 + scrollProgress*0.5}`} y="14" width="58" height="28" rx="6" fill="rgba(255,255,255,0.12)" />
              <rect x={`${440 + scrollProgress*0.4}`} y="18" width="42" height="20" rx="4" fill="rgba(255,255,255,0.12)" />
            </g>
          </svg>
        </div>
        <h3 className="text-3xl font-bold mb-12" aria-label="Core Features and actions">Core Features</h3>
        <div className="grid md:grid-cols-4 gap-10">
          {features.map((f) => (
            <Link key={f.key} to={f.href} className="group outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl block" onClick={(e)=>{ e.preventDefault(); setSpotlightFeature(f); setSpotlightOpen(true); setSpotlightSlide(0); if(f.key==='ocr-import'){ setOcrSlider(50); setOcrDetected(0); setTimeout(()=>{ let t0=performance.now(); const dur=1200; const tick=()=>{ const p=Math.min(1,(performance.now()-t0)/dur); setOcrDetected(Math.floor(5 + p*32)); if(p<1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, 150);} }}>
              <div
                data-aos="zoom-in"
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
                onClick={ripple}
                className={`relative transition-transform duration-200 will-change-transform p-5 rounded-xl ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)] hover:shadow-[0_14px_60px_rgba(0,0,0,0.45)] feature-card`}
              >
                {f.badge && (
                  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200">{f.badge}</span>
                )}
                <div className="mx-auto mb-4 w-20 h-20 rounded flex items-center justify-center bg-white/5 border border-white/10 overflow-hidden">
                  <img src={f.icon} alt="" loading="lazy" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" />
                </div>
                <h4 className="font-semibold text-lg text-white">{f.title}</h4>
                <p className="text-sm text-white/70">{f.desc}</p>
                {/* subtle gradient border on hover */}
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-emerald-400/20 via-teal-300/20 to-cyan-400/20 blur-sm"></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Why FLYP */}
      <section id="whyflyp" className="py-20 px-10 bg-white/5 border-y border-white/10 text-center">
        <div aria-hidden className="-mt-10 mb-10 h-10 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0,80 C360,40 720,0 1440,40 L1440,0 L0,0 Z" fill="rgba(0,0,0,0.25)" />
          </svg>
        </div>
        <h3 className="text-3xl font-bold mb-10">Why FLYP?</h3>
        <p className="text-lg text-white max-w-4xl mx-auto mb-6 force-text">
          FLYP is the only platform connecting Retailers, Distributors, and Product Owners with AI-powered inventory management, automated billing, performance analytics, and real-time collaboration.
        </p>
        <p className="text-lg text-white/70 max-w-3xl mx-auto force-text">
          Whether you’re tracking SKUs, scanning paper invoices, generating smart bills, or managing your full supply chain — FLYP adapts to your workflow and unlocks scale.
        </p>
      </section>

      {/* Case Study highlight */}
      <section id="case" className="py-14 px-6 md:px-10">
        <div className={`grid md:grid-cols-1 gap-8 items-center rounded-2xl ${THEME.card} p-6`}>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-300/80">Case Study</div>
            <h3 className="text-3xl font-extrabold mt-1">How Acme Retail cut billing time by 48%</h3>
            <p className="text-white/70 mt-2">With FLYP’s OCR import and smart cart, Acme processed 3,200+ invoices in the first month, saving <b>140+ hours</b> and reducing stockouts by <b>22%</b>.</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className={`p-3 rounded ${THEME.card}`}><div className="text-xl font-bold">48%</div><div className="text-white/60 text-xs">Faster billing</div></div>
              <div className={`p-3 rounded ${THEME.card}`}><div className="text-xl font-bold">−22%</div><div className="text-white/60 text-xs">Stockouts</div></div>
              <div className={`p-3 rounded ${THEME.card}`}><div className="text-xl font-bold">140h</div><div className="text-white/60 text-xs">Hours saved</div></div>
            </div>
            <div className="mt-5 flex gap-2">
              <a href="#pricing" className="px-4 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover-raise">Start Free</a>
              <a href="#contact" className="px-4 py-2 rounded border border-white/20">Talk to us</a>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Reel */}
      <section className="py-10 px-6 overflow-hidden">
        <div className={`relative rounded-xl ${THEME.card} p-3 ticker-mask`}>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/10 via-teal-300/10 to-cyan-400/10 pointer-events-none" />
          <div className={`ticker flex gap-12 whitespace-nowrap text-sm ${prefersReducedMotion ? 'pause-anim' : ''}`}>
            <div className="item">⏱️ <b>12h/wk</b> saved on ops</div>
            <div className="item">🧾 <b>98%</b> OCR accuracy</div>
            <div className="item">🚚 <b>30%</b> faster billing</div>
            <div className="item">📦 <b>−22%</b> stockouts</div>
            <div className="item">💸 <b>+18%</b> margin lift</div>
            <div className="item">🔁 <b>99.9%</b> sync reliability</div>
            <div className="item">⏱️ <b>12h/wk</b> saved on ops</div>
            <div className="item">🧾 <b>98%</b> OCR accuracy</div>
            <div className="item">🚚 <b>30%</b> faster billing</div>
            <div className="item">📦 <b>−22%</b> stockouts</div>
            <div className="item">💸 <b>+18%</b> margin lift</div>
            <div className="item">🔁 <b>99.9%</b> sync reliability</div>
          </div>
        </div>
      </section>

      {/* Testimonials (expanded) */}
      <section id="testimonials" className="py-20 px-6 md:px-10 text-center">
        <h3 className="text-3xl md:text-4xl font-extrabold">Loved by modern businesses</h3>
        <p className="text-white/70 mt-2 max-w-2xl mx-auto">What retailers, distributors, and product owners say after switching to FLYP.</p>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            {name:'Riya', role:'Retailer', quote:'“OCR import cut billing time by half.”', avatar:'/assets/avatars/retailer_1.png', stars:5},
            {name:'Aman', role:'Distributor', quote:'“We finally see real-time stock across branches.”', avatar:'/assets/avatars/distributor_1.png', stars:5},
            {name:'Tejas', role:'Retailer', quote:'“12+ hours saved every week, reliably.”', avatar:'/assets/avatars/retailer_2.png', stars:5},
          ].map((t,i)=>(
            <div key={i} className={`p-6 text-left rounded-2xl ${THEME.card} hover:shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/10 bg-white/10 flex items-center justify-center text-sm font-semibold">
                  <img src={t.avatar || ''} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={(e)=>{ e.currentTarget.style.display='none'; }} />
                  <span className="text-white/90">{t.name?.[0] || 'U'}</span>
                </div>
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-white/60">{t.role}</div>
                </div>
                <div className="ml-auto text-amber-300 text-sm">{'★★★★★'.slice(0,t.stars)}</div>
              </div>
              <p className="text-white/80">{t.quote}</p>
            </div>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/10 mt-10">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-teal-300/5 to-cyan-400/5 pointer-events-none" />
          <div className={`flex gap-6 whitespace-nowrap items-stretch testimonial-track p-4 hover:[animation-play-state:paused] will-change-transform ${prefersReducedMotion ? 'pause-anim' : ''}`}>
            {[
              '“Credit control is finally under control.” — Vikram • Distributor',
              '“WhatsApp invoices boosted repeat orders.” — Sana • Retailer',
              '“Downstream catalogs just… work.” — Karthik • Product Owner',
              '“Training the team took minutes, not weeks.” — Priya • Retailer',
              '“Inventory sync killed our stockout fights.” — Rahul • Distributor',
              '“Delightful billing. Our cashflow thanks you.” — Isha • Retailer',
            ].concat([
              '“Credit control is finally under control.” — Vikram • Distributor',
              '“WhatsApp invoices boosted repeat orders.” — Sana • Retailer',
              '“Downstream catalogs just… work.” — Karthik • Product Owner',
              '“Training the team took minutes, not weeks.” — Priya • Retailer',
              '“Inventory sync killed our stockout fights.” — Rahul • Distributor',
              '“Delightful billing. Our cashflow thanks you.” — Isha • Retailer',
            ]).map((q, i)=>(
              <div key={i} className="flex-none w-[320px] md:w-[420px]">
                <div className={`min-h-[72px] p-5 rounded-xl ${THEME.card} text-left flex items-center`}>
                  <p className="m-0 text-white/80 leading-snug whitespace-normal break-words">
                    {q}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & reliability */}
      <section id="security" className="px-6 md:px-10 py-10 text-center">
        <div className="inline-flex flex-wrap items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
          <span className="text-white/70 text-sm">Security &amp; Reliability:</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/5">Data encrypted in transit</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/5">Role-based permissions</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/5">Audit-friendly exports</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 bg-white/5">GST-ready billing</span>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-10 bg-transparent text-center">
        <div aria-hidden className="-mt-10 mb-10 h-6 -rotate-1 bg-white/5" />
        <h3 className="text-3xl font-bold mb-6">Pricing Plans</h3>
        <div className="mb-8 flex items-center justify-center gap-3 text-sm">
          <span className={`${!isYearly ? 'text-emerald-300' : 'text-white/60'}`}>Monthly</span>
          <button
            onClick={()=>setIsYearly(v=>!v)}
            className="relative h-7 w-14 rounded-full bg-white/10 border border-white/15 transition-colors hover:bg-white/15"
            aria-label="Toggle yearly pricing"
          >
            <span
              className={`absolute top-0.5 ${isYearly ? 'left-7' : 'left-0.5'} h-6 w-6 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all`}
            />
          </button>
          <span className={`${isYearly ? 'text-emerald-300' : 'text-white/60'}`}>Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] border border-emerald-300/40 bg-emerald-400/10">Save 20%</span></span>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
        </div>
        {/* Comparison table */}
        <div className="mt-12 overflow-x-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-white/70">
                <th className="px-4 py-2">Feature</th>
                <th className="px-4 py-2">Check-In</th>
                <th className="px-4 py-2">Onboard</th>
                <th className="px-4 py-2">Takeoff</th>
                <th className="px-4 py-2">Fly</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['OCR Billing Import','—','✓','✓','✓'],
                ['Smart Cart Suggestions','—','✓','✓','✓'],
                ['Realtime Inventory Sync','—','—','✓','✓'],
                ['Dashboards & KPIs','—','—','✓','✓'],
                ['Distributor Connect','—','—','✓','✓'],
                ['Priority Support','—','—','—','✓'],
              ].map((row, i)=>(
                <tr key={i} className="align-top">
                  <td className="px-4 py-2"><span className="inline-block px-3 py-2 rounded-lg bg-white/5 border border-white/10">{row[0]}</span></td>
                  {row.slice(1).map((v,j)=>(
                    <td key={j} className="px-4 py-2">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${v==='✓' ? 'bg-emerald-400/15 border border-emerald-300/40 text-emerald-200' : 'bg-white/5 border border-white/10 text-white/40'}`}>{v}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* FAQ */}
        <div id="faq" className="mt-14 text-left max-w-4xl mx-auto">
          <h4 className="text-2xl font-bold mb-4 text-center">FAQs</h4>
          {[
            {q:'How long does onboarding take?', a:'Most teams go live in under 30 minutes using OCR import and defaults.'},
            {q:'Do you support GST-compliant invoices?', a:'Yes. Templates are GST-ready and exports are audit-friendly.'},
            {q:'Can I switch plans anytime?', a:'Absolutely. Upgrade or downgrade with one click; billing prorates automatically.'},
            {q:'Is my data secure?', a:'Data is encrypted in transit, and role-based permissions keep access tight.'},
            {q:'Do you offer support for distributors?', a:'Yes—Distributor Connect, branch sync, and credit control are included on Takeoff and Fly.'},
          ].map((item, i)=>(
            <details key={i} className={`group mb-3 rounded-lg ${THEME.card} p-4`}>
              <summary className="list-none flex items-center justify-between cursor-pointer">
                <span className="font-semibold">{item.q}</span>
                <span className="ml-4 transition-transform group-open:rotate-45 text-white/60">＋</span>
              </summary>
              <p className="mt-2 text-white/70">{item.a}</p>
            </details>
          ))}
          <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
            <h4 className="text-xl font-bold mb-4">Check-In</h4>
            <p className="text-emerald-300 font-semibold text-2xl mb-6">Free</p>
            <div className="text-left text-sm text-white/70 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Basic inventory tracking & billing.</p>
              <p><strong>Distributor:</strong> Limited product sync.</p>
              <p><strong>Product Owner:</strong> Basic analytics dashboard.</p>
            </div>
            <button className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-gray-900 px-4 py-2 rounded hover:bg-emerald-400 w-full font-semibold hover-raise">Choose Plan</button>
          </div>

          <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
            <h4 className="text-xl font-bold mb-4">Onboard</h4>
            <p className="text-yellow-300 font-semibold text-2xl mb-6">{priceLabel(299)}</p>
            <div className="text-left text-sm text-white/70 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Smart cart & OCR billing import.</p>
              <p><strong>Distributor:</strong> Inventory sync & order management.</p>
              <p><strong>Product Owner:</strong> Advanced analytics & AI inventory generator.</p>
            </div>
            <button className="bg-yellow-400/90 text-gray-900 px-4 py-2 rounded hover:bg-yellow-300 w-full font-semibold hover-raise">Choose Plan</button>
          </div>

          <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
            <h4 className="text-xl font-bold mb-4">Takeoff</h4>
            <p className="text-cyan-300 font-semibold text-2xl mb-6">{priceLabel(499)}</p>
            <div className="text-left text-sm text-white/70 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Customer analytics & realtime inventory sync.</p>
              <p><strong>Distributor:</strong> Distributor connect & automated billing.</p>
              <p><strong>Product Owner:</strong> Dashboards & KPIs with Gemini AI assistant.</p>
            </div>
            <button className="bg-cyan-400/90 text-gray-900 px-4 py-2 rounded hover:bg-cyan-300 w-full font-semibold hover-raise">Choose Plan</button>
          </div>

          <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
            <h4 className="text-xl font-bold mb-4">Fly</h4>
            <p className="text-white font-semibold text-2xl mb-6">Custom</p>
            <div className="text-left text-sm text-white/70 space-y-3 mb-6">
              <p><strong>Retailer:</strong> Full feature access & priority support.</p>
              <p><strong>Distributor:</strong> Custom integrations & multi-branch management.</p>
              <p><strong>Product Owner:</strong> Dedicated AI support & enterprise analytics.</p>
            </div>
            <button className="bg-white/10 text-white px-4 py-2 rounded hover:bg-white/20 w-full font-semibold border border-white/20 hover-raise">Contact Us</button>
          </div>
        </div>
      </section>

      {/* Feature Spotlight Modal */}
      {spotlightOpen && spotlightFeature && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={()=>setSpotlightOpen(false)}>
          <div className={`w-full max-w-4xl rounded-2xl ${THEME.card} shadow-[0_20px_70px_rgba(0,0,0,0.6)] overflow-hidden relative`} onClick={(e)=>e.stopPropagation()}>
            <button onClick={()=>setSpotlightOpen(false)} className="absolute top-3 right-3 z-10 px-2 py-1 rounded bg-white/10 hover:bg-white/20">✕</button>
            <div className="grid md:grid-cols-2">
              {/* Visual / Demo side */}
              <div className="relative bg-[#0C1117] p-4 md:p-6" onTouchStart={(e)=>{touch.current.startX=e.touches[0].clientX;}} onTouchMove={(e)=>{touch.current.dx=e.touches[0].clientX-touch.current.startX;}} onTouchEnd={()=>{ if(Math.abs(touch.current.dx)>40){ setSpotlightSlide((i)=> (i+ (touch.current.dx<0?1:-1) + 3)%3); } touch.current.dx=0; }}>
                {/* Slides */}
                <div className="relative h-[340px] overflow-hidden rounded-xl border border-white/10">
                  {/* Slide 1: Lottie/video demo */}
                  <div className={`absolute inset-0 p-4 flex items-center justify-center transition-opacity duration-500 ${spotlightSlide===0?'opacity-100':'opacity-0 pointer-events-none'}`}>
                    {animationData ? (
                      <Lottie animationData={animationData} loop className="w-72 h-72" />
                    ) : (
                      <div className="text-white/60">Demo loading…</div>
                    )}
                  </div>
                  {/* Slide 2: OCR Before/After if OCR feature; else image blocks */}
                  <div className={`absolute inset-0 transition-opacity duration-500 ${spotlightSlide===1?'opacity-100':'opacity-0 pointer-events-none'}`}>
                    {spotlightFeature.key==='ocr-import' ? (
                      <div className="h-full w-full relative">
                        {/* Raw image */}
                        <img src="/assets/ocr_raw_invoice.jpg" alt="Raw invoice" loading="lazy" className="absolute inset-0 h-full w-full object-cover rounded-xl" />
                        {/* Structured overlay clipped by slider */}
                        <div className="absolute inset-0 rounded-xl overflow-hidden" style={{clipPath:`inset(0 ${100-ocrSlider}% 0 0)`}}>
                          <img src="/assets/ocr_structured_invoice.jpg" alt="Structured fields" loading="lazy" className="h-full w-full object-cover" />
                          <div className="absolute bottom-3 right-3 px-3 py-1 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm">Detected: {ocrDetected} fields</div>
                        </div>
                        {/* Slider */}
                        <input type="range" min="0" max="100" value={ocrSlider} onChange={(e)=>setOcrSlider(Number(e.target.value))} className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[80%]" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 p-4 h-full">
                        <div className="rounded-lg bg-white/5 border border-white/10" />
                        <div className="rounded-lg bg-white/5 border border-white/10" />
                        <div className="rounded-lg bg-white/5 border border-white/10" />
                        <div className="rounded-lg bg-white/5 border border-white/10" />
                      </div>
                    )}
                  </div>
                  {/* Slide 3: Try in Sandbox */}
                  <div className={`absolute inset-0 transition-opacity duration-500 ${spotlightSlide===2?'opacity-100':'opacity-0 pointer-events-none'}`}>
                    <div className="p-6 h-full w-full flex flex-col">
                      <div className="text-sm text-white/70 mb-2">Type SKU to preview AI suggestion</div>
                      <input id="skuInput" placeholder="e.g. FLYP-BOX-12" className="rounded bg-white/10 border border-white/10 px-3 py-2 mb-3" onKeyDown={(e)=>{ if(e.key==='Enter'){ burstConfetti(); } }} />
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className={`p-3 rounded ${THEME.card}`}><div className="text-2xl font-bold">12</div><div className="text-white/60 text-xs">Suggested Qty</div></div>
                        <div className={`p-3 rounded ${THEME.card}`}><div className="text-2xl font-bold">18%</div><div className="text-white/60 text-xs">Margin</div></div>
                        <div className={`p-3 rounded ${THEME.card}`}><div className="text-2xl font-bold">₹1,240</div><div className="text-white/60 text-xs">Profit</div></div>
                      </div>
                      <div className="mt-auto flex justify-end">
                        <Link to={spotlightFeature.href} className="px-4 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Open Full Feature</Link>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Progress dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {[0,1,2].map(i=> (
                    <button key={i} onClick={()=>setSpotlightSlide(i)} className={`w-2.5 h-2.5 rounded-full ${spotlightSlide===i? 'bg-emerald-400' : 'bg-white/30'}`}/>
                  ))}
                </div>
              </div>
              {/* Text / Actions side */}
              <div className="p-6 flex flex-col gap-3">
                <div className="text-sm uppercase tracking-wider text-white/60">Feature</div>
                <h4 className="text-2xl font-extrabold">{spotlightFeature.title}</h4>
                <p className="text-white/70">{spotlightFeature.desc}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={()=>setSpotlightSlide((s)=> (s+2)%3)} className="px-3 py-1 rounded border border-white/20">Prev</button>
                  <button onClick={()=>setSpotlightSlide((s)=> (s+1)%3)} className="px-3 py-1 rounded bg-emerald-400/90 text-gray-900 font-semibold">Next</button>
                </div>
                <div className="mt-auto flex gap-3">
                  <Link to={spotlightFeature.href} className="px-4 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Go to Feature</Link>
                  <button onClick={()=>{ setSpotlightSlide(2); }} className="px-4 py-2 rounded border border-white/20">Try in Sandbox</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ROI Modal */}
      {showRoi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-xl rounded-2xl ${THEME.card} shadow-[0_10px_50px_rgba(0,0,0,0.5)] p-6 relative`}>
            <button onClick={() => setShowRoi(false)} className="absolute top-3 right-3 px-2 py-1 rounded bg-white/10 hover:bg-white/20">✕</button>
            <h4 className="text-2xl font-bold mb-4">Your ROI with FLYP</h4>
            <div className="grid md:grid-cols-3 gap-4 mb-4 text-sm">
              <label className="block">
                <div className="mb-1 text-white/70">Orders / day</div>
                <input type="number" value={roi.ordersPerDay} onChange={e=>setRoi({...roi, ordersPerDay: Number(e.target.value)})} className="w-full rounded bg-white/10 border border-white/10 px-3 py-2" />
              </label>
              <label className="block">
                <div className="mb-1 text-white/70">Minutes saved / order</div>
                <input type="number" value={roi.timePerOrderMin} onChange={e=>setRoi({...roi, timePerOrderMin: Number(e.target.value)})} className="w-full rounded bg-white/10 border border-white/10 px-3 py-2" />
              </label>
              <label className="block">
                <div className="mb-1 text-white/70">Staff ₹/hour</div>
                <input type="number" value={roi.staffCostPerHour} onChange={e=>setRoi({...roi, staffCostPerHour: Number(e.target.value)})} className="w-full rounded bg-white/10 border border-white/10 px-3 py-2" />
              </label>
            </div>
            {(() => {
              const hoursSavedPerDay = (roi.ordersPerDay * roi.timePerOrderMin) / 60;
              const monthlyHours = Math.round(hoursSavedPerDay * 26);
              const monthlySavings = Math.round(monthlyHours * roi.staffCostPerHour);
              return (
                <div className="grid md:grid-cols-3 gap-4 text-center">
                  <div className={`p-4 rounded ${THEME.card}`}>
                    <div className="text-3xl font-extrabold">{monthlyHours}h</div>
                    <div className="text-white/60 text-sm">Hours saved / month</div>
                  </div>
                  <div className={`p-4 rounded ${THEME.card}`}>
                    <div className="text-3xl font-extrabold">₹{monthlySavings.toLocaleString()}</div>
                    <div className="text-white/60 text-sm">Estimated savings</div>
                  </div>
                  <div className={`p-4 rounded ${THEME.card}`}>
                    <div className="text-3xl font-extrabold">{Math.max(1, Math.round(monthlySavings / 299))}x</div>
                    <div className="text-white/60 text-sm">Plan value multiple</div>
                  </div>
                </div>
              );
            })()}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>setShowRoi(false)} className="px-4 py-2 rounded border border-white/20">Close</button>
              <Link to="/auth?type=register" onClick={()=>setShowRoi(false)} className="px-4 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover-raise">Start Free</Link>
            </div>
          </div>
        </div>
      )}
      {/* Footer */}
      <footer id="contact" className="relative bg-gray-900 text-white p-6 mt-10 text-center text-sm overflow-hidden border-t border-white/10">
        <div aria-hidden className="absolute inset-x-0 -top-16 h-32 bg-gradient-to-r from-green-500/10 via-yellow-500/10 to-blue-500/10 blur-2xl" />
        <p>© {new Date().getFullYear()} FLYP — All Rights Reserved.</p>
        <p className="mt-1">Contact: support@flypnow.com</p>
      </footer>
      {/* Sticky mobile CTA */}
      {showStickyCta && (
        <div className="fixed md:hidden bottom-4 right-4 z-50">
          <a href="#pricing" className="px-5 py-3 rounded-full font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">Start Free</a>
        </div>
      )}
      <style>{`
        ${styles}
        .will-change-transform { transition: transform .18s ease-out; }
        .force-text { color: rgba(255,255,255,0.92); }
        .animate-word { animation: wordIn .7s ease both; }
        @keyframes wordIn { from { opacity: 0; filter: blur(8px); transform: translateY(8px); } to { opacity:1; filter: blur(0); transform: translateY(0); } }
        .grid-overlay { background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 40px 40px; }
        /* Theme variants */
        .theme-dark { --bg-overlay: rgba(0,0,0,0.35); }
        .theme-dusk { --bg-overlay: rgba(255,255,255,0.02); filter: saturate(1.05) brightness(1.05); }
        /* Tiny dot for the flight path motion */
        svg circle { r: 2.2; fill: #a7f3d0; filter: drop-shadow(0 0 6px rgba(52,211,153,.8)); }
        .animate-fade-in { animation: fadeIn .5s ease both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .feature-card { position: relative; overflow: hidden; }
        .feature-card .ripple { position:absolute; width:12px; height:12px; transform: translate(-50%, -50%); border-radius:9999px; background: radial-gradient(circle, rgba(34,211,238,0.65) 0%, rgba(34,211,238,0.0) 60%); animation: ripple .6s ease-out both; }
        @keyframes ripple { from { opacity:.9; width:12px; height:12px; } to { opacity:0; width:260px; height:260px; } }
        .feature-card:focus-within { animation: wiggle .18s ease-in-out; }
        @keyframes wiggle { 0%{ transform: rotate(0deg); } 50%{ transform: rotate(0.6deg); } 100%{ transform: rotate(0deg); } }
        /* KPI Ticker */
        .ticker { animation: ticker 22s linear infinite; }
        .ticker .item { display:inline-block; padding: 6px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 9999px; }
        @keyframes ticker { 0%{ transform: translateX(0); } 100%{ transform: translateX(-50%); } }
        html { scroll-behavior: smooth; }
        [role='tab'] { cursor: pointer; }
        /* Truck smoothing on GPU */
        [data-role-step] { will-change: transform; }

        /* --- Micro-interaction helpers --- */
        .hover-raise { transition: transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .18s ease; will-change: transform; }
        .hover-raise:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(0,0,0,.32); }
        .hover-raise:active { transform: translateY(-1px); }

        /* --- Ticker edge fade mask --- */
        .ticker-mask { position: relative; overflow: hidden; }
        .ticker-mask::before,
        .ticker-mask::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; width: 80px; pointer-events: none; z-index: 1;
          background: linear-gradient(to right, rgba(11,15,20,1), rgba(11,15,20,0));
        }
        .ticker-mask::before { left: 0; }
        .ticker-mask::after { right: 0; transform: scaleX(-1); }

        /* --- Animated dashed route --- */
        .dash-route { stroke-dasharray: 12 12; animation: dash 6s linear infinite; }
        @keyframes dash { to { stroke-dashoffset: -240; } }

        /* Testimonials loop — fixed-width items for perfect looping */
        .testimonial-track { animation: tslide 38s linear infinite; will-change: transform; }
        @keyframes tslide {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-50%,0,0); }
        }
        /* Ensure consistent card sizing */
        #testimonials .testimonial-track > div { flex: 0 0 auto; }

        /* Magnetic button subtle motion */
        .magnetic { will-change: transform; transition: transform .08s ease-out; }

        /* Header shrink smoothing */
        header nav { transition: gap .2s ease; }
        /* Logo row grayscale -> color */
        #trust img { transition: filter .2s ease, opacity .2s ease; opacity: .9; }
        #trust:hover img { opacity: 1; }
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .ticker, .testimonial-track { animation-duration: 0.001s !important; animation-iteration-count: 1 !important; }
          .hover-raise { transition: none !important; }
          .anim-gradient { animation: none !important; }
        }
        .pause-anim { animation-play-state: paused !important; }
        /* Micro‑demo helpers */
        #hero input::-webkit-outer-spin-button,
        #hero input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        #hero input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
};

export default LandingPage;