import React, { useEffect } from "react";
import voiceBillingAnim from '../../public/assets/voice-billing.json';
import aiInventory from "../../public/assets/AI_Inventory.json";
import posMode from "../../public/assets/POS.json";
import distributorConnect from "../../public/assets/Distributor.json";
import aiHSNSupport from "../../public/assets/AI_Support.json";
import secureCloud from "../../public/assets/Secure_Cloud.json";
import customerAnalysis from "../../public/assets/Customer_Analysis.json";
import fastOnboard from "../../public/assets/Fast_Onboard.json";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AOS from 'aos';
import 'aos/dist/aos.css';
import Lottie from "lottie-react";
import { motion } from "framer-motion";

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
  const [metrics, setMetrics] = useState({ hours: 0, accuracy: 0, growth: 0 });
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

  // === Voice Billing: dynamic transcript + totals ===
  const [voiceItems] = useState([
    { sku: 'CHIPS-200G', qty: 3, price: 60 },
    { sku: 'JUICE-1L',   qty: 2, price: 120 },
    { sku: 'BISCUIT',    qty: 1, price: 40 },
  ]);
  const [voiceDiscount] = useState(20);
  const voiceSubtotal = voiceItems.reduce((s, it) => s + it.qty * it.price, 0);
  const voiceTotal = voiceSubtotal - voiceDiscount;
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const root = document.getElementById('voice-demo');
    if (!root) return;
    const transcript = 'add three chips, two juice, one biscuit — apply twenty rupees discount';
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      let i = 0; const id = setInterval(() => {
        setTyped(transcript.slice(0, ++i));
        if (i >= transcript.length) clearInterval(id);
      }, 30);
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(root);
    return () => io.disconnect();
  }, []);

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

  // Supply Chain "Living Network" state
  const [activeSupplyChainRole, setActiveSupplyChainRole] = useState(0);
  const routePathRef = React.useRef(null);
  const posSectionRef = React.useRef(null);
  const invoiceRef = React.useRef(null);
  const storyRef = React.useRef(null);
  const [voiceDisplayTotal, setVoiceDisplayTotal] = useState(0);
  const [truck, setTruck] = useState({ x: 0, y: 0, angle: 0 });
  const pathPercents = [0.10, 0.52, 0.92]; // Product Owner, Distributor, Retailer

  // Analytics section refs/state
  const analyticsRef = React.useRef(null);
  const [kpis, setKpis] = useState({ revenue: 0, orders: 0, aov: 0 });
  const [donutPercent, setDonutPercent] = useState(0);

  // Truck position is now set based on the active role
  useEffect(() => {
    const path = routePathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const t = pathPercents[activeSupplyChainRole] ?? 0.1;
    const len = total * t;
    const p = path.getPointAtLength(len);
    const p2 = path.getPointAtLength(Math.min(total, len + 1));
    const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
    setTruck({ x: p.x, y: p.y, angle });
  }, [activeSupplyChainRole]);

  // initialize truck position once on mount
  useEffect(() => {
    const path = routePathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const len = total * pathPercents[0];
    const p = path.getPointAtLength(len);
    const p2 = path.getPointAtLength(Math.min(total, len + 1));
    const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
    setTruck({ x: p.x, y: p.y, angle });
  }, []);

  // Smooth scroll‑scrub for truck along the story path
  useEffect(() => {
    const sec = storyRef.current;
    const path = routePathRef.current;
    if (!sec || !path) return;

    const onScroll = () => {
      const rect = sec.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const start = vh * 0.15; // start easing into motion
      const end = vh * 0.85;   // end easing out
      const span = Math.max(end - start, 1);
      const raw = clamp((vh - rect.top - start) / (rect.height + span), 0, 1);

      // Gentle snap near anchor roles: 0.10, 0.52, 0.92 of the curve
      const anchors = [0.0, (0.52 - 0.10) / 0.82, (0.92 - 0.10) / 0.82];
      let p = raw;
      const nearest = anchors.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a), anchors[0]);
      if (Math.abs(nearest - raw) < 0.08) p = raw + (nearest - raw) * 0.6;

      const t = 0.10 + 0.82 * p;
      const total = path.getTotalLength();
      const len = total * t;
      const pt = path.getPointAtLength(len);
      const next = path.getPointAtLength(Math.min(total, len + 1));
      const angle = (Math.atan2(next.y - pt.y, next.x - pt.x) * 180) / Math.PI;
      setTruck({ x: pt.x, y: pt.y, angle });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // POS flip is now triggered by IntersectionObserver
  useEffect(() => {
    const el = posSectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      el.classList.toggle('is-flipped', entry.isIntersecting);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  
  // Odometer for Voice Billing Total
  useEffect(() => {
    const card = invoiceRef.current;
    if (!card) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const start = 0; const end = voiceTotal; const dur = 900; const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        setVoiceDisplayTotal(Math.round(start + (end - start) * ease));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(card);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [voiceTotal]);

  // Animate Analytics KPIs + Donut percent when section enters view
  useEffect(() => {
    const el = analyticsRef.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const targets = { revenue: 1250000, orders: 842, aov: 1485 }; // demo values
      const t0 = performance.now();
      const dur = 1200;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const ease = 1 - Math.pow(1 - p, 3);
        setKpis({
          revenue: Math.round(targets.revenue * ease),
          orders: Math.round(targets.orders * ease),
          aov: Math.round(targets.aov * ease),
        });
        setDonutPercent(Math.round(100 * ease));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      io.disconnect();
    }, { threshold: 0.55 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
    
  // --- FIX: Removed '#whyflyp' from array as section does not exist ---
  const sections = [
    { id: 'hero', label: 'Intro' },
    { id: 'story', label: 'Story' },
    { id: 'features', label: 'Features' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'mission', label: 'Mission' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'faq', label: 'FAQ' },
    { id: 'contact', label: 'Contact' },
  ];
  const [currentSection, setCurrentSection] = useState('hero');

  const features = [
    {
      key: 'voice-billing',
      title: 'Voice Billing',
      desc: 'Generate invoices in seconds with the fastest voice-powered billing. Speak, confirm, done.',
      icon: '/assets/voice_billing.png',
      href: '/feature/voice-billing',
      badge: 'New',
      lottie: voiceBillingAnim,
    },
    {
      key: 'ai-inventory',
      title: 'AI Inventory',
      desc: 'AI-powered inventory creation and optimization—smarter, faster, always up-to-date.',
      icon: '/assets/ai_inventory.png',
      href: '/feature/ai-inventory',
      badge: 'New',
      lottie: aiInventory,
    },
    {
      key: 'ai-hsn',
      title: 'AI HSN Code Support',
      desc: 'Bill faster with instant, accurate HSN code suggestions powered by AI.',
      icon: '/assets/ai_hsn.png',
      href: '/feature/ai-hsn',
      badge: 'New',
      lottie: aiHSNSupport,
    },
    {
      key: 'pos-mode',
      title: 'POS Mode',
      desc: 'Switch your dashboard to a full point-of-sale experience for seamless counter billing.',
      icon: '/assets/pos_mode.png',
      href: '/feature/pos-mode',
      badge: 'New',
      lottie: posMode,
    },
    {
      key: 'cloud-security',
      title: 'Secure Cloud',
      desc: 'Your data is encrypted, cloud-backed, and always available—privacy and peace of mind.',
      icon: '/assets/secure_cloud.png',
      href: '/feature/cloud-security',
      badge: 'New',
      lottie: secureCloud,
    },
    {
      key: 'distributor-connect',
      title: 'Distributor Connect',
      desc: 'Connect and sync with distributors instantly—collaborate and share in real time.',
      icon: '/assets/distributor_connect.png',
      href: '/feature/distributor',
      badge: 'New',
      lottie: distributorConnect,
    },
    {
      key: 'customer-analysis',
      title: 'Customer Analysis',
      desc: 'Advanced analytics to understand, segment, and grow your customer base.',
      icon: '/assets/customer_analytics.png',
      href: '/feature/analytics',
      badge: 'New',
      lottie: customerAnalysis,
    },
    {
      key: 'fast-onboarding',
      title: 'Fast Onboarding',
      desc: 'Go from invoice to insight in minutes with our guided, AI-assisted setup process.',
      icon: '/assets/onboarding.png',
      href: '/feature/onboarding',
      badge: 'New',
      lottie: fastOnboard,
    }
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
    if (prefersReducedMotion || !auraRef.current) return;
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
  }, [prefersReducedMotion]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const sp = total > 0 ? (window.scrollY / total) * 100 : 0;
      setScrollProgress(sp);
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
  }, [words.length]);

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
          const easeOut = 1 - Math.pow(1 - p, 3);
          setMetrics({
            hours: Math.floor(easeOut * 12),
            accuracy: Math.floor(80 + easeOut * 18),
            growth: Math.floor(5 + easeOut * 25),
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

  // Observe top-level sections to highlight nav dots
  useEffect(() => {
    const opts = { root: null, rootMargin: '-40% 0px -55% 0px', threshold: 0.1 };
    const io = new window.IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setCurrentSection(e.target.id); });
    }, opts);
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [sections]);
  
  // Intersection observer for the supply chain roles
  useEffect(() => {
    const roles = document.querySelectorAll('[data-supply-chain-role]');
    if(!roles.length) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const roleIndex = parseInt(entry.target.getAttribute('data-supply-chain-role'), 10);
                setActiveSupplyChainRole(roleIndex);
            }
        });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0.5 });
    roles.forEach(role => io.observe(role));
    return () => io.disconnect();
  }, []);


  useEffect(() => {
    AOS.init({ duration: 1000, once: true, easing: 'cubic-bezier(.2,.7,.3,1)' });

    // Lazy-load Lottie JSON
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
  }, [prefersReducedMotion]);

  const handleTilt = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y / rect.height) - 0.5) * -10; // rotateX
    const ry = ((x / rect.width) - 0.5) * 10;   // rotateY
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    if (e.currentTarget) {
      e.currentTarget.style.setProperty('--x', `${e.nativeEvent.offsetX}px`);
      e.currentTarget.style.setProperty('--y', `${e.nativeEvent.offsetY}px`);
    }
  };
  const resetTilt = (e) => { e.currentTarget.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'; };

  // Intro overlay state and effect (staged cinematic)
  const [showIntro, setShowIntro] = React.useState(true);
  const [introStage, setIntroStage] = React.useState('logo'); // 'logo' | 'tagline' | 'curtain'
  React.useEffect(() => {
    // Progress through stages: logo -> tagline -> curtain -> unmount
    const t1 = setTimeout(() => setIntroStage('tagline'), 900);
    const t2 = setTimeout(() => setIntroStage('curtain'), 1800);
    const t3 = setTimeout(() => setShowIntro(false), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className={`text-white min-h-screen aurora-bg anim-gradient grain bg-gradient-to-b ${THEME.bg} ${themeMode==='dusk' ? 'theme-dusk' : 'theme-dark'}`}>
      {showIntro && (
        <div className={`intro-overlay fixed inset-0 z-50 flex items-center justify-center ${introStage==='curtain' ? 'curtain' : ''}`}>
          {/* Kite logo + trail */}
          <div className="intro-stack relative text-center">
            <div className={`kite-wrapper ${introStage!=='logo' ? 'fly' : ''}`}>
              <img src="/assets/flyp-logo.png" alt="FLYP" className="kite-logo" />
              <span aria-hidden className="kite-trail" />
            </div>
            <div className={`tagline ${introStage!=='logo' ? 'show' : ''}`}>
              {['FLYP', '—', 'Built', 'to', 'Fly'].map((w,i)=> (
                <span key={i} className="tag-word" style={{ '--i': i }}>
                  {w}{i<4?' ':''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#0B0F14]" />
      <div ref={auraRef} aria-hidden className="fixed top-0 left-0 z-0 pointer-events-none w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(150px 150px at center, rgba(16,185,129,0.25), rgba(16,185,129,0.0) 70%)', filter: 'blur(20px)' }} />
      <header className={`sticky top-0 z-50 glass supports-[backdrop-filter]:bg-white/5 bg-white/10 flex justify-between items-center border-b border-white/10 transition-all duration-300 ${shrinkHeader ? 'py-1 px-3 md:py-2 md:px-4' : 'py-4 px-6 md:py-6 md:px-8'}`}>
        <div className="flex items-center">
            <div className="logo-shine">
                <img src="/assets/flyp-logo.png" alt="FLYP Logo" loading="eager" className={`${shrinkHeader ? 'h-8 md:h-10' : 'h-16 md:h-20'} w-auto drop-shadow-md transition-all duration-300`} />
            </div>
        </div>
        <nav className={`hidden md:flex ${shrinkHeader ? 'gap-5 text-sm' : 'gap-6 text-base'} transition-all duration-300`}>
          <a href="#story" className="hover:text-emerald-300">How It Works</a>
          <a href="#features" className="hover:text-emerald-300">Features</a>
          <a href="#analytics" className="hover:text-emerald-300">Analytics</a>
          <a href="#pricing" className="hover:text-emerald-300">Pricing</a>
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

      <div className="fixed top-0 left-0 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-blue-500 z-50 transition-[width]" style={{ width: `${scrollProgress}%` }} />
      {/* Section Navigator (floating dots) */}
      <nav aria-label="Section navigator" className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col gap-3">
        {[
          { id: 'features', label: 'Features' },
          { id: 'mission', label: 'Mission' },
          { id: 'pricing', label: 'Pricing' },
          { id: 'testimonials', label: 'Testimonials' },
          { id: 'faq', label: 'FAQ' },
        ].map((s) => (
          <a key={s.id} href={`#${s.id}`} className={`section-dot ${currentSection===s.id ? 'active' : ''}`} data-label={s.label} />
        ))}
      </nav>

      <section id="hero" className="relative flex flex-col-reverse md:flex-row items-center px-6 md:px-10 py-24 overflow-hidden min-h-[80vh]">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(800px 300px at 10% 10%, rgba(16,185,129,0.06), transparent 60%), radial-gradient(600px 240px at 90% 20%, rgba(34,197,94,0.06), transparent 60%)'
        }} />
        <span aria-hidden className="brand-comet" />
        <div aria-hidden className="absolute inset-0 grid-overlay pointer-events-none" />
        <div aria-hidden className="hero-particles absolute inset-0 pointer-events-none">
          {Array.from({length:12}).map((_,i)=> (<span key={i} className={`p p-${i+1}`} />))}
        </div>
        <div className="w-full md:w-1/2 text-center md:text-left z-10 space-y-6" style={{ transform: `translateY(${heroOffset.title}px)`, transition: 'transform .2s ease-out' }}>
          <h1 data-aos="fade-up" className="text-5xl md:text-6xl font-extrabold leading-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]">
            <span className="block kinetic-text">FLYP</span>
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
          <p data-aos="fade-up" data-aos-delay="100" className="text-lg text-white/80 max-w-xl force-text">
            Onboard in under 30 minutes. Automate inventory, billing, and distributor collaboration — with experiences crafted like a flagship product launch.
          </p>
          <div className="flex gap-6 justify-center md:justify-start text-sm">
            <div data-aos="fade-up" data-aos-delay="200" className={`px-4 py-2 rounded ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><div className="text-2xl font-bold">{metrics.hours}h/wk</div><div className="text-white/60">Saved Ops</div></div>
            <div data-aos="fade-up" data-aos-delay="300" className={`px-4 py-2 rounded ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><div className="text-2xl font-bold">{metrics.accuracy}%</div><div className="text-white/60">OCR Accuracy</div></div>
            <div data-aos="fade-up" data-aos-delay="400" className={`px-4 py-2 rounded ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><div className="text-2xl font-bold">{metrics.growth}%</div><div className="text-white/60">Faster Billing</div></div>
          </div>
          <div data-aos="fade-up" data-aos-delay="500" className="mt-4 flex gap-3">
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
        </div>
        <div className="w-full md:w-1/2 flex justify-center z-10 md:-mt-10 -mt-4" style={{ transform: `translateY(${heroOffset.art - 20}px)`, transition: 'transform .2s ease-out' }}>
          <div ref={heroAnimRef} onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`w-[30rem] h-[30rem] rounded-2xl ${THEME.card} will-change-transform flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
            {animationData && (<Lottie animationData={animationData} loop className="w-[26rem] h-[26rem]" />)}
          </div>
        </div>
        <div aria-hidden className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1440 96" preserveAspectRatio="none">
            <path d="M0,64 C240,32 480,96 720,64 C960,32 1200,0 1440,32 L1440,96 L0,96 Z" fill="rgba(255,255,255,0.03)" />
          </svg>
        </div>
      </section>

      <section id="story" ref={storyRef} className="relative px-6 md:px-10 py-24 section-divider">
        <div className="max-w-6xl mx-auto">
          <div className="text-center md:text-left mb-10">
            <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]">How It Works</div>
            <h2 data-aos="fade-up" className="text-4xl md:text-5xl font-extrabold mt-1">A Living Network for Your Supply Chain</h2>
            <p data-aos="fade-up" data-aos-delay="100" className="text-white/70 mt-2 max-w-2xl">
              FLYP connects Product Owners, Distributors, and Retailers on a single, intelligent data layer. Catalogs and bills flow downstream, while sales insights and analytics flow back up — all in real time.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div className="relative md:sticky md:top-24 h-[340px] md:h-[520px] flex items-center justify-center">
              <svg viewBox="0 0 900 300" className="w-full h-full">
                <defs>
                  <linearGradient id="route" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399"/>
                    <stop offset="100%" stopColor="#22d3ee"/>
                  </linearGradient>
                  <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="14" result="blur"/>
                  </filter>
                </defs>
                <path ref={routePathRef} d="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" fill="none" stroke="transparent" strokeWidth="1" />
                <path d="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" fill="none" stroke="url(#route)" strokeWidth="16" strokeLinecap="round" opacity="0.22" filter="url(#routeGlow)" />
                <path className="dash-route" d="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" fill="none" stroke="url(#route)" strokeWidth="8" strokeLinecap="round" />
                <circle r="5" fill="#6ee7b7"><animateMotion dur="4s" repeatCount="indefinite" rotate="auto" path="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" /></circle>
                <circle r="5" fill="#67e8f9" opacity="0.9"><animateMotion dur="5.2s" repeatCount="indefinite" rotate="auto" path="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" /></circle>
                <circle r="4" fill="#a7f3d0" opacity="0.8"><animateMotion dur="3.4s" repeatCount="indefinite" rotate="auto" path="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" /></circle>
                <circle r="4" fill="#99f6e4" opacity="0.8"><animateMotion dur="6.1s" repeatCount="indefinite" rotate="auto" path="M60 160 C 220 40, 420 40, 520 160 S 760 280, 840 160" /></circle>
                <g transform={`translate(${truck.x} ${truck.y}) rotate(${truck.angle})`} className="truck">
                  <text fontSize="18" textAnchor="middle" dominantBaseline="central">🚚</text>
                </g>
                <g>
                    <g className="stop">
                        <circle cx="240" cy="160" r="9" fill="#2dd4bf" />
                        <circle cx="240" cy="160" r="18" className="stop-pulse" fill="none" stroke="#2dd4bf" />
                        <text x="240" y="132" fill="#fff" fontSize="12" textAnchor="middle">Product Owner</text>
                        <text x="240" y="165" fontSize="24" textAnchor="middle">📦</text>
                    </g>
                    <g className="stop">
                        <circle cx="520" cy="160" r="9" fill="#34d399" />
                        <circle cx="520" cy="160" r="18" className="stop-pulse" fill="none" stroke="#34d399" />
                        <text x="520" y="132" fill="#fff" fontSize="12" textAnchor="middle">Distributor</text>
                        <text x="520" y="165" fontSize="24" textAnchor="middle">🏭</text>
                    </g>
                    <g className="stop">
                        <circle cx="820" cy="160" r="9" fill="#22d3ee" />
                        <circle cx="820" cy="160" r="18" className="stop-pulse" fill="none" stroke="#22d3ee" />
                        <text x="820" y="132" fill="#fff" fontSize="12" textAnchor="middle">Retailer</text>
                        <text x="820" y="165" fontSize="24" textAnchor="middle">🛒</text>
                    </g>
                </g>
                {/* Packet bursts when role becomes active */}
                {activeSupplyChainRole===0 && (
                  <g className="burst">
                    <circle cx="240" cy="160" r="4" />
                    <circle cx="228" cy="152" r="3" />
                    <circle cx="252" cy="170" r="2" />
                  </g>
                )}
                {activeSupplyChainRole===1 && (
                  <g className="burst">
                    <circle cx="520" cy="160" r="4" />
                    <circle cx="508" cy="152" r="3" />
                    <circle cx="534" cy="170" r="2" />
                  </g>
                )}
                {activeSupplyChainRole===2 && (
                  <g className="burst">
                    <circle cx="820" cy="160" r="4" />
                    <circle cx="808" cy="152" r="3" />
                    <circle cx="832" cy="170" r="2" />
                  </g>
                )}
              </svg>
            </div>
            <div className="space-y-8">
              <div data-aos="fade-left" data-supply-chain-role="0" className={`p-6 rounded-xl ${THEME.card} transition-all duration-500 ${activeSupplyChainRole===0?'ring-2 ring-emerald-400/80 scale-[1.02] shadow-2xl':''}`}>
                <div className="text-sm uppercase tracking-widest text-emerald-300">Product Owner</div>
                <h4 className="text-2xl font-bold mt-1">Orchestrate Your Network</h4>
                <ul className="mt-3 text-white/80 text-sm space-y-2 list-disc list-inside">
                  <li>Push catalogs & price lists downstream instantly.</li>
                  <li>Get realtime sell-through visibility from retailers.</li>
                  <li>Use AI Inventory Generator for new product lines.</li>
                </ul>
              </div>
              <div data-aos="fade-left" data-aos-delay="100" data-supply-chain-role="1" className={`p-6 rounded-xl ${THEME.card} transition-all duration-500 ${activeSupplyChainRole===1?'ring-2 ring-teal-300/80 scale-[1.02] shadow-2xl':''}`}>
                <div className="text-sm uppercase tracking-widest text-teal-300">Distributor</div>
                <h4 className="text-2xl font-bold mt-1">Manage with Precision</h4>
                <ul className="mt-3 text-white/80 text-sm space-y-2 list-disc list-inside">
                  <li>Smart cart with AI-powered quantity suggestions.</li>
                  <li>Automated billing, credit control, and reminders.</li>
                  <li>Live inventory sync across all your branches.</li>
                </ul>
              </div>
              <div data-aos="fade-left" data-aos-delay="200" data-supply-chain-role="2" className={`p-6 rounded-xl ${THEME.card} transition-all duration-500 ${activeSupplyChainRole===2?'ring-2 ring-cyan-300/80 scale-[1.02] shadow-2xl':''}`}>
                <div className="text-sm uppercase tracking-widest text-cyan-300">Retailer</div>
                <h4 className="text-2xl font-bold mt-1">Grow and Delight</h4>
                <ul className="mt-3 text-white/80 text-sm space-y-2 list-disc list-inside">
                  <li>One-click OCR billing to import paper invoices.</li>
                  <li>Customer analytics to drive repeat purchases.</li>
                  <li>Instant invoice sharing via WhatsApp & Email.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pos-demo" ref={posSectionRef} className="py-20 px-6 md:px-10 section-divider">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
            <div className="mb-5 text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]">Demo</div>
            <h3 data-aos="fade-up" className="text-3xl md:text-4xl font-extrabold mb-2 text-center md:text-left">Dashboard Flips to POS</h3>
            <p data-aos="fade-up" data-aos-delay="100" className="text-white/70 mb-6 max-w-md text-center md:text-left">Switch from analytics to a full-screen POS mode with a single tap. The perfect blend of insight and action.</p>
          </div>
          <div className="w-full md:w-1/2 flex justify-center">
            <div className="pos-frame relative w-[360px] h-[260px]">
              <div className="pos-segment absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="pos-tabs">
                  <span className="pos-tab">Dashboard</span>
                  <span className="pos-tab">POS Mode</span>
                  <span className="pos-tab-indicator" />
                </div>
              </div>
              <div className="pos-flip-card w-full h-full">
                <div className="pos-flip-inner">
                  <div className="pos-flip-front absolute w-full h-full flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow p-4">
                    <div className="w-full text-left font-bold text-sm">Dashboard</div>
                    <div className="w-full h-4 bg-gradient-to-r from-emerald-300/50 to-cyan-300/30 rounded my-4 shimmer" />
                    <div className="w-full grid grid-cols-3 gap-2">
                      <div className="h-10 rounded bg-emerald-400/20 tile-shine" />
                      <div className="h-10 rounded bg-cyan-400/20 tile-shine" />
                      <div className="h-10 rounded bg-yellow-300/20 tile-shine" />
                    </div>
                  </div>
                  <div className="pos-flip-back absolute w-full h-full flex flex-col rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 shadow p-4">
                    <div className="w-full text-left font-bold text-sm text-emerald-100">POS Mode</div>
                    <div className="flex-grow w-full grid grid-cols-3 gap-2 mt-2">
                      <div className="pos-tile rounded bg-white/20" />
                      <div className="pos-tile rounded bg-white/20 selected" />
                      <div className="pos-tile rounded bg-white/20" />
                      <div className="pos-tile rounded bg-white/20" />
                      <div className="pos-tile rounded bg-white/20" />
                      <div className="pos-tile rounded bg-white/20" />
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-sm">Total: ₹120</span>
                      <button className="pos-checkout-btn px-4 py-1 rounded bg-emerald-400 text-gray-900 font-bold text-sm">Checkout</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pos-hint absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-white/60 select-none">
                <span>Flips automatically on scroll</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="voice-demo" className="py-20 px-6 md:px-10 section-divider">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-1/2 flex flex-col items-center">
            <div className="mb-5 text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]">Demo</div>
            <h3 data-aos="fade-up" className="text-3xl md:text-4xl font-extrabold mb-2 text-center md:text-left">Voice Billing in Action</h3>
            <p data-aos="fade-up" data-aos-delay="100" className="text-white/70 mb-6 max-w-md text-center md:text-left">This isn't sped up—it's just that fast. Watch the magic happen as voice commands build an invoice live.</p>
            <div className="w-44 h-44 flex items-center justify-center relative mb-4 voice-mic-container">
              <span className="mic-ring" style={{ inset: '-20px', animationDelay: '.4s' }} aria-hidden></span>
              <span className="mic-ring" style={{ inset: '-28px', animationDelay: '.8s' }} aria-hidden></span>
              <span className="mic-ring" aria-hidden></span>
              <div className="voice-pulse"></div>
              <div className="flex gap-1 absolute inset-0 items-center justify-center">
                {[0,1,2,3,4,5,6,7,8].map(i => (
                  <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="22" fill="url(#micg)" opacity="0.17"/><rect x="16" y="10" width="12" height="20" rx="6" fill="url(#micg)"/><defs><linearGradient id="micg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient></defs></svg>
              </div>
            </div>
            <div className="mt-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs text-white/80 max-w-xs text-center">
              <span className="type-cursor">{typed || 'Listening…'}</span>
            </div>
          </div>
          <div className={`w-full md:w-1/2 flex justify-center`}>
            <div ref={invoiceRef} data-aos="fade-left" className={`voice-invoice-card relative rounded-2xl p-7 w-[320px] shadow-[0_8px_32px_rgba(34,197,94,0.12)] border border-emerald-300/10 ${THEME.card}`}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-emerald-400/90 text-gray-900 text-xs font-bold shadow">Invoice</div>
              <div className="mb-2 text-white/80 text-sm">To: <b>Acme Retail</b></div>
              <div className="bg-white/10 rounded mb-3 p-2 text-xs text-white/70">
                <div className="flex justify-between font-bold"><span>Item</span><span>Qty</span><span>Price</span></div>
                {voiceItems.map((it, i) => (
                  <div key={i} className={`invoice-row ${i===0?'mt-1':''} flex justify-between font-mono`}>
                    <span>{it.sku}</span><span>{it.qty}</span><span>₹{it.price}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-white/80 text-sm mb-2"><span className="invoice-line">Subtotal</span><span className="invoice-total">₹{voiceSubtotal}</span></div>
              <div className="flex justify-between text-white/60 text-xs mb-2"><span className="invoice-line discount-line">Discount</span><span className="invoice-total">−₹{voiceDiscount}</span></div>
              <div className="flex justify-between text-white font-bold text-lg mt-1"><span className="invoice-line total-line">Total</span><span className="invoice-total final-total">₹{voiceDisplayTotal.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="ai-inventory-demo" className="py-20 px-6 md:px-10 section-divider">
        <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
                <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]">Demo</div>
                <h3 data-aos="fade-up" className="text-3xl md:text-4xl font-extrabold mb-2">From Invoice to Smart Inventory</h3>
                <p data-aos="fade-up" data-aos-delay="100" className="text-white/70 max-w-2xl mx-auto">See how a messy invoice is instantly transformed into a clean, smart, and actionable view of your stock.</p>
            </div>
            <div data-aos="zoom-in-up" className="ai-inventory-container relative h-96 grid grid-cols-2 gap-4 items-center">
                <div className="h-full p-4 rounded-xl bg-white/5 border border-white/10"><div className="text-sm font-bold mb-2">BEFORE: <span className="text-white/60">raw_invoice.jpg</span></div><div className="space-y-1 font-mono text-xs text-white/50"><div>chips 200g (lays) - 3 units @ rs 20</div><div>1L Apple Juice.. 2pc, 60 EACH</div><div>biscuit pack / parle-g, 1 @ 40/-</div><div className="text-red-400/60">hsn?? tax?</div></div></div>
                <div className="h-full p-4 rounded-xl bg-emerald-400/10 border border-emerald-300/30 overflow-hidden">
                    <div className="text-sm font-bold mb-2">AFTER: <span className="text-emerald-200/80">Smart Stock View</span></div>
                    <div className="ai-inventory-rows space-y-2">
                        <div className="row grid grid-cols-4 gap-2 text-xs font-mono p-2 rounded bg-white/10 items-center"><span>CHIPS-200G</span><span>3</span><span>21041010</span><span className="text-right">₹60</span></div>
                        <div className="row grid grid-cols-4 gap-2 text-xs font-mono p-2 rounded bg-white/10 items-center"><span>JUICE-1L</span><span>2</span><span>22029920</span><span className="text-right">₹120</span></div>
                        <div className="row grid grid-cols-4 gap-2 text-xs font-mono p-2 rounded bg-white/10 items-center"><span>BISCUIT-PARLEG</span><span>1</span><span>19053100</span><span className="text-right">₹40</span></div>
                    </div>
                    <div className="smart-cards-container mt-4 grid grid-cols-3 gap-2">
                        <div className="smart-card p-2 rounded bg-white/10"> <div className="font-bold text-[10px]">Chips</div> <div className="text-xs text-white/60">3 in stock</div></div>
                        <div className="smart-card p-2 rounded bg-white/10"> <div className="font-bold text-[10px]">Juice</div> <div className="text-xs text-white/60">2 in stock</div></div>
                        <div className="smart-card low-stock p-2 rounded bg-white/10"> <div className="font-bold text-[10px]">Biscuit</div> <div className="text-xs text-red-400/80">1 in stock</div><span className="text-[9px] text-red-300">Low!</span></div>
                    </div>
                </div>
                <div className="ai-scan-line absolute top-0 h-full w-1.5 bg-gradient-to-b from-emerald-300 via-teal-200 to-cyan-300 rounded-full shadow-[0_0_20px_theme(colors.emerald.400)]" />
            </div>
        </div>
      </section>

      <section className="py-10 px-6 overflow-hidden">
        <div className={`relative rounded-xl ${THEME.card} p-3 ticker-mask`}>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/10 via-teal-300/10 to-cyan-400/10 pointer-events-none" />
          <div className={`ticker flex gap-12 whitespace-nowrap text-sm ${prefersReducedMotion ? 'pause-anim' : ''}`}>
            <div className="item">🧾 <b>12h/wk</b> saved on ops</div><div className="item">⚡ <b>98%</b> OCR accuracy</div><div className="item">🤖 <b>30%</b> faster billing</div><div className="item">💳 <b>−22%</b> stockouts</div><div className="item">📊 <b>+18%</b> margin lift</div><div className="item">🔒 <b>99.9%</b> sync reliability</div>
            <div className="item">🧾 <b>12h/wk</b> saved on ops</div><div className="item">⚡ <b>98%</b> OCR accuracy</div><div className="item">🤖 <b>30%</b> faster billing</div><div className="item">💳 <b>−22%</b> stockouts</div><div className="item">📊 <b>+18%</b> margin lift</div><div className="item">🔒 <b>99.9%</b> sync reliability</div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 px-10 bg-transparent text-center section-divider">
        <h3 data-aos="fade-up" className="text-3xl font-bold mb-12" aria-label="Core Features and actions">Everything You Need to Scale</h3>
        <div className="grid md:grid-cols-4 gap-10">
          {features.map((f) => (
            <motion.div
              key={f.key}
              whileHover={{ scale: 1.08, rotate: 1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="group outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-xl block"
              onClick={(e)=>{ e.preventDefault(); setSpotlightFeature(f); setSpotlightOpen(true); setSpotlightSlide(0); }}
            >
              <div
                data-aos="zoom-in"
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
                onClick={ripple}
                className={`cursor-pointer relative transition-transform duration-300 will-change-transform p-5 rounded-xl ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_60px_rgba(0,0,0,0.55)] feature-card feature-float`}
              >
                {f.badge && (<span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200">{f.badge}</span>)}
                {f.title === "AI Inventory" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10 mb-4">
                    <Lottie animationData={aiInventory} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.key === 'voice-billing' ? (
                  <div className="w-[120px] h-[120px] md:w-[150px] md:h-[150px] mx-auto mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-lg ring-1 ring-white/10">
                    <Lottie animationData={f.lottie} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.title === "POS Mode" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10">
                    <Lottie animationData={posMode} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.title === "Distributor Connect" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10">
                    <Lottie animationData={distributorConnect} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.title === "AI HSN Code Support" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10 mb-4">
                    <Lottie animationData={aiHSNSupport} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.title === "Secure Cloud" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10 mb-4">
                    <Lottie animationData={secureCloud} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.title === "Customer Analysis" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10 mb-4">
                    <Lottie animationData={customerAnalysis} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : f.title === "Fast Onboarding" ? (
                  <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-md ring-1 ring-white/10 mb-4">
                    <Lottie animationData={fastOnboard} loop autoplay style={{ width: '100%', height: '100%' }} />
                  </div>
                ) : (
                  <div className="mx-auto mb-4 w-20 h-20 rounded flex items-center justify-center bg-white/5 border border-white/10 overflow-hidden">
                    {f.lottie ? (
                      <Lottie animationData={f.lottie} loop autoplay className="w-10 h-10" />
                    ) : (
                      <img src={f.icon} alt="" loading="lazy" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                )}
                <h4 className="font-semibold text-lg text-white">{f.title}</h4>
                <p className="text-sm text-white/70">{f.desc}</p>
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><div className="absolute -inset-px rounded-xl bg-gradient-to-r from-emerald-400/20 via-teal-300/20 to-cyan-400/20 blur-sm"></div></div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="analytics" className="py-20 px-6 md:px-10 text-center section-divider">
        <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]">Preview</div>
        <h3 data-aos="fade-up" className="text-3xl md:text-4xl font-extrabold mt-1">Analytics that Act</h3>
        <p data-aos="fade-up" data-aos-delay="100" className="text-white/70 mt-2 max-w-2xl mx-auto">Go beyond simple reports. FLYP gives you actionable insights that help you grow.</p>
        {/* KPI row */}
        <div ref={analyticsRef} className="mt-10 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl ${THEME.card}`}>
            <div className="text-xs uppercase tracking-widest text-white/60">Revenue</div>
            <div className="text-2xl font-extrabold">₹{kpis.revenue.toLocaleString()}</div>
          </div>
          <div className={`p-4 rounded-xl ${THEME.card}`}>
            <div className="text-xs uppercase tracking-widest text-white/60">Orders</div>
            <div className="text-2xl font-extrabold">{kpis.orders.toLocaleString()}</div>
          </div>
          <div className={`p-4 rounded-xl ${THEME.card}`}>
            <div className="text-xs uppercase tracking-widest text-white/60">AOV</div>
            <div className="text-2xl font-extrabold">₹{kpis.aov.toLocaleString()}</div>
          </div>
        </div>

        {/* Charts card */}
        <div data-aos="zoom-in-up" data-aos-delay="200" className={`mt-4 max-w-5xl mx-auto p-6 rounded-2xl grid md:grid-cols-3 gap-6 ${THEME.card} shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}>
          <div className="analytics-card">
            <h4 className="text-sm font-bold text-white/80 mb-4">Weekly Sales</h4>
            <div className="animated-bar-chart flex gap-2 items-end justify-around h-32">
              <div className="bar" style={{'--h': '60%'}}></div>
              <div className="bar" style={{'--h': '80%'}}></div>
              <div className="bar" style={{'--h': '50%'}}></div>
              <div className="bar" style={{'--h': '75%'}}></div>
              <div className="bar" style={{'--h': '95%'}}></div>
            </div>
          </div>
          <div className="analytics-card">
            <h4 className="text-sm font-bold text-white/80 mb-4">Customer Growth</h4>
            <svg viewBox="0 0 100 50" className="animated-line-chart w-full h-32">
              <defs>
                <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 45 Q 25 10, 50 25 T 100 5" fill="none" stroke="url(#route)" strokeWidth="2" id="growthPath" />
              <path d="M 0 45 Q 25 10, 50 25 T 100 5" fill="url(#growthGrad)" opacity="0.15" />
              <circle r="1.6" fill="#a7f3d0">
                <animateMotion dur="4.5s" repeatCount="indefinite" rotate="auto" path="M 0 45 Q 25 10, 50 25 T 100 5" />
              </circle>
            </svg>
          </div>
          <div className="analytics-card relative">
            <h4 className="text-sm font-bold text-white/80 mb-4">Top Categories</h4>
            <div className="relative w-32 h-32 mx-auto">
              <svg viewBox="0 0 36 36" className="animated-donut-chart w-32 h-32 mx-auto">
                <circle className="donut-segment" stroke="#34d399" cx="18" cy="18" r="15.915" strokeDasharray="60, 100"></circle>
                <circle className="donut-segment" stroke="#2dd4bf" cx="18" cy="18" r="15.915" strokeDasharray="30, 100" strokeDashoffset="-60"></circle>
                <circle className="donut-segment" stroke="#22d3ee" cx="18" cy="18" r="15.915" strokeDasharray="10, 100" strokeDashoffset="-90"></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center select-none">
                <div className="text-lg font-extrabold">{donutPercent}%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing section remains unchanged above */}

      {/* Mission Section (upgraded) */}
      <section id="mission" className="relative py-28 text-center overflow-hidden">
        {/* animated background orbs */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-12 w-[420px] h-[420px] rounded-full mission-orb" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 w-[360px] h-[360px] rounded-full mission-orb-2" />

        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-emerald-300/80 text-[11px] uppercase tracking-[0.22em]" data-aos="fade-up">
            Our Purpose
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold mt-2 leading-tight" data-aos="fade-up" data-aos-delay="60">
            Build the <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">Operating System</span> for India's Commerce
          </h2>

          {/* underline accent */}
          <div className="mx-auto mt-4 w-40 h-[3px] mission-underline" data-aos="zoom-in" data-aos-delay="140" />

          <p className="max-w-3xl mx-auto text-lg md:text-xl text-gray-300 leading-relaxed mt-6" data-aos="fade-up" data-aos-delay="160">
            Empower every <b>Retailer</b>, <b>Distributor</b> and <b>Product Owner</b> with world‑class tools that feel magical,
            stay compliant, and drive real growth — without complexity.
          </p>

          {/* Pillars */}
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 mt-10">
            <div
              className={`pillar-card p-5 rounded-xl ${THEME.card}`}
              data-aos="fade-up" data-aos-delay="0"
              onMouseMove={handleTilt} onMouseLeave={resetTilt}
            >
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="text-lg font-bold">Speed as a Feature</h3>
              <p className="text-sm text-white/70 mt-1">Voice billing, OCR, and AI flows that cut work from minutes to seconds.</p>
            </div>
            <div
              className={`pillar-card p-5 rounded-xl ${THEME.card}`}
              data-aos="fade-up" data-aos-delay="80"
              onMouseMove={handleTilt} onMouseLeave={resetTilt}
            >
              <div className="text-2xl mb-2">🧠</div>
              <h3 className="text-lg font-bold">Intelligence Built‑in</h3>
              <p className="text-sm text-white/70 mt-1">Inventory that thinks, HSN suggestions, and analytics that act.</p>
            </div>
            <div
              className={`pillar-card p-5 rounded-xl ${THEME.card}`}
              data-aos="fade-up" data-aos-delay="160"
              onMouseMove={handleTilt} onMouseLeave={resetTilt}
            >
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="text-lg font-bold">Trust by Design</h3>
              <p className="text-sm text-white/70 mt-1">Secure cloud, privacy first, and rock‑solid reliability at scale.</p>
            </div>
          </div>

          {/* Impact line */}
          <p
            className="mt-8 text-xl md:text-2xl font-semibold kinetic-text"
            data-aos="fade-up" data-aos-delay="220"
          >
            From India to the world — <span className="opacity-90">scaling dreams, not just businesses.</span>
          </p>

          {/* CTA bridge to Pricing for better flow */}
          <div className="mt-10 flex justify-center gap-3" data-aos="zoom-in" data-aos-delay="260">
            <a href="#pricing"
               className="px-6 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover-raise">
               See Plans
            </a>
            <a href="#features" className="px-6 py-2 rounded border border-white/20 hover:border-emerald-300/60">
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={`py-20 px-10 bg-transparent text-center section-divider ${isYearly ? 'yearly-on' : ''}`}>
        <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
          <div className="pricing-glow" />
        </div>
        <div aria-hidden className="-mt-10 mb-10 h-6 -rotate-1 bg-white/5" /><h3 data-aos="fade-up" className="text-3xl font-bold mb-6">Pricing Plans</h3><div className="mb-8 flex items-center justify-center gap-3 text-sm"><span className={`${!isYearly ? 'text-emerald-300' : 'text-white/60'}`}>Monthly</span><button onClick={()=>setIsYearly(v=>!v)} className="relative h-7 w-14 rounded-full bg-white/10 border border-white/15 transition-colors hover:bg-white/15" aria-label="Toggle yearly pricing"><span className={`absolute top-0.5 ${isYearly ? 'left-7' : 'left-0.5'} h-6 w-6 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all`} /></button><span className={`${isYearly ? 'text-emerald-300' : 'text-white/60'}`}>Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] border border-emerald-300/40 bg-emerald-400/10">Save 20%</span></span></div>
        <div className="grid md:grid-cols-4 gap-8">
            {/* --- FIX: Replaced all '&amp;' with '&' --- */}
            <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`price-card p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><h4 className="text-xl font-bold mb-4">Check-In</h4><p className="text-emerald-300 font-semibold text-2xl mb-6">Free</p><div className="text-left text-sm text-white/70 space-y-3 mb-6"><p><strong>Retailer:</strong> Basic inventory tracking & billing.</p><p><strong>Distributor:</strong> Limited product sync.</p><p><strong>Product Owner:</strong> Basic analytics dashboard.</p></div><button className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-gray-900 px-4 py-2 rounded hover:bg-emerald-400 w-full font-semibold hover-raise">Choose Plan</button></div>
            <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`price-card p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><h4 className="text-xl font-bold mb-4">Onboard</h4><p className="text-yellow-300 font-semibold text-2xl mb-6">{priceLabel(299)}</p><div className="text-left text-sm text-white/70 space-y-3 mb-6"><p><strong>Retailer:</strong> Smart cart & OCR billing import.</p><p><strong>Distributor:</strong> Inventory sync & order management.</p><p><strong>Product Owner:</strong> Advanced analytics & AI inventory generator.</p></div><button className="bg-yellow-400/90 text-gray-900 px-4 py-2 rounded hover:bg-yellow-300 w-full font-semibold hover-raise">Choose Plan</button></div>
            <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`price-card p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><h4 className="text-xl font-bold mb-4">Takeoff</h4><p className="text-cyan-300 font-semibold text-2xl mb-6">{priceLabel(499)}</p><div className="text-left text-sm text-white/70 space-y-3 mb-6"><p><strong>Retailer:</strong> Customer analytics & realtime inventory sync.</p><p><strong>Distributor:</strong> Distributor connect & automated billing.</p><p><strong>Product Owner:</strong> Dashboards & KPIs with Gemini AI assistant.</p></div><button className="bg-cyan-400/90 text-gray-900 px-4 py-2 rounded hover:bg-cyan-300 w-full font-semibold hover-raise">Choose Plan</button></div>
            <div data-aos="flip-left" onMouseMove={handleTilt} onMouseLeave={resetTilt} className={`price-card p-6 rounded-xl ${THEME.card} will-change-transform shadow-[0_10px_40px_rgba(0,0,0,0.35)]`}><h4 className="text-xl font-bold mb-4">Fly</h4><p className="text-white font-semibold text-2xl mb-6">Custom</p><div className="text-left text-sm text-white/70 space-y-3 mb-6"><p><strong>Retailer:</strong> Full feature access & priority support.</p><p><strong>Distributor:</strong> Custom integrations & multi-branch management.</p><p><strong>Product Owner:</strong> Dedicated AI support & enterprise analytics.</p></div><button className="bg-white/10 text-white px-4 py-2 rounded hover:bg-white/20 w-full font-semibold border border-white/20 hover-raise">Contact Us</button></div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 px-6 md:px-10 text-center section-divider relative">
        <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
          <div className="testimonials-glow" />
        </div>
        <h3 data-aos="fade-up" className="text-3xl md:text-4xl font-extrabold">Loved by modern businesses</h3>
        <p data-aos="fade-up" data-aos-delay="100" className="text-white/70 mt-2 max-w-2xl mx-auto">What retailers, distributors, and product owners say after switching to FLYP.</p>

        {/* Ratings cards */}
        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {[{
            quote: 'FLYP cut our billing time by half and gave us insights we never had before.',
            name: 'Rajesh', role: 'Retailer'
          },{
            quote: 'We onboarded in minutes. The experience is smooth and powerful.',
            name: 'Anita', role: 'Distributor'
          },{
            quote: 'Finally, a tool built for us — simple, compliant, and fast.',
            name: 'Imran', role: 'Product Owner'
          }].map((t, i) => (
            <div key={i} className={`p-6 rounded-xl ${THEME.card} text-left shadow-[0_10px_40px_rgba(0,0,0,0.35)]`} data-aos="zoom-in" data-aos-delay={i*100}>
              <div className="text-yellow-300" aria-label="5 star rating">★★★★★</div>
              <p className="mt-2 text-white/80">“{t.quote}”</p>
              <p className="mt-4 font-semibold text-emerald-300">{t.name}, {t.role}</p>
            </div>
          ))}
        </div>

        {/* Marquee quotes */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 mt-12">
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
            ]).map((q, i)=> (
              <div key={i} className="flex-none w-[320px] md:w-[420px]" data-aos="fade-up" data-aos-delay={(i%6)*60}>
                <div className={`min-h-[72px] p-5 rounded-xl ${THEME.card} text-left flex items-center`}>
                  <p className="m-0 text-white/80 leading-snug whitespace-normal break-words">{q}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* FAQ Section (moved after Testimonials) */}
      <section id="faq" className="relative py-24 bg-gradient-to-b from-[#0d0f12] to-[#080a0c]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {q:'Is FLYP GST-compliant?', a:'Yes, FLYP is fully compliant with Indian GST, CGST, SGST, and IGST.'},
              {q:'Do I need training?', a:'No, FLYP is designed to be simple and intuitive for everyone.'},
              {q:'Can I use it offline?', a:'Yes, with PWA support you can continue working even without internet.'},
              {q:'Is my data safe?', a:'100% encrypted and securely backed on the cloud with privacy controls.'},
            ].map((item, i)=> (
              <details key={i} className="bg-[#101214] rounded-lg p-5" data-aos="fade-up" data-aos-delay={i*80}>
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-2 text-gray-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      {spotlightOpen && spotlightFeature && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSpotlightOpen(false)}
        >
          <div
            className={`w-full max-w-4xl rounded-2xl ${THEME.card} shadow-[0_20px_70px_rgba(0,0,0,0.6)] overflow-hidden relative`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSpotlightOpen(false)}
              className="absolute top-3 right-3 z-10 px-2 py-1 rounded bg-white/10 hover:bg-white/20"
            >
              ✕
            </button>
            <div className="grid md:grid-cols-2">
              <div className="relative bg-[#0C1117] p-4 md:p-6">
                <div className="relative h-[340px] overflow-hidden rounded-xl border border-white/10 flex items-center justify-center">
                  {/* Show the Voice Billing lottie if this is the feature, else fallback to demo or image */}
                  {spotlightFeature.title === "AI Inventory" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10 flex items-center justify-center">
                      <Lottie animationData={aiInventory} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "Voice Billing" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10 flex items-center justify-center">
                      <Lottie animationData={voiceBillingAnim} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "POS Mode" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10">
                      <Lottie animationData={posMode} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "Distributor Connect" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10">
                      <Lottie animationData={distributorConnect} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "AI HSN Code Support" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10 flex items-center justify-center">
                      <Lottie animationData={aiHSNSupport} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "Secure Cloud" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10 flex items-center justify-center">
                      <Lottie animationData={secureCloud} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "Customer Analysis" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10 flex items-center justify-center">
                      <Lottie animationData={customerAnalysis} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : spotlightFeature.title === "Fast Onboarding" ? (
                    <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-[#1c1f24] to-[#101214] shadow-xl ring-1 ring-white/10 flex items-center justify-center">
                      <Lottie animationData={fastOnboard} loop autoplay style={{ width: '100%', height: '100%' }} />
                    </div>
                  ) : (
                    <div
                      className={`absolute inset-0 p-4 flex items-center justify-center transition-opacity duration-500 ${
                        spotlightSlide === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                    >
                      {animationData ? (
                        <Lottie animationData={animationData} loop className="w-72 h-72" />
                      ) : (
                        <div className="text-white/60">Demo loading…</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 flex flex-col gap-3">
                <div className="text-sm uppercase tracking-wider text-white/60">Feature</div>
                <h4 className="text-2xl font-extrabold">{spotlightFeature.title}</h4>
                <p className="text-white/70">{spotlightFeature.desc}</p>
                <div className="mt-auto flex gap-3">
                  <Link
                    to={spotlightFeature.href}
                    className="px-4 py-2 rounded font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
                  >
                    Go to Feature
                  </Link>
                  <button
                    onClick={() => {
                      setSpotlightOpen(false);
                    }}
                    className="px-4 py-2 rounded border border-white/20"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <footer id="contact" className="relative bg-gray-900 text-white p-6 mt-10 text-center text-sm overflow-hidden border-t border-white/10"><div aria-hidden className="absolute inset-x-0 -top-16 h-32 bg-gradient-to-r from-green-500/10 via-yellow-500/10 to-blue-500/10 blur-2xl" /><p>© {new Date().getFullYear()} FLYP — All Rights Reserved.</p><p className="mt-1">Contact: support@flypnow.com</p></footer>
      {showStickyCta && (<div className="fixed md:hidden bottom-4 right-4 z-50"><a href="#pricing" className="px-5 py-3 rounded-full font-semibold text-gray-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">Start Free</a></div>)}
      
      <style>{`
        ${styles}
        /* Intro overlay animation */
        .animate-pulse{
          animation: pulseLogo 1.5s ease-in-out infinite;
        }
        @keyframes pulseLogo{
          0%, 100%{ opacity:.6; transform: scale(1); }
          50%{ opacity:1; transform: scale(1.1); }
        }
        /* ——— Intro Cinematic (kite flies + curtain reveal) ——— */
        .intro-overlay{ background:#000; overflow:hidden; }
        .intro-overlay.curtain{ animation: curtainUp .8s ease-in forwards; }
        .intro-stack{ transform: translateY(0); }
        .kite-wrapper{ display:inline-block; position:relative; will-change:transform; }
        .kite-logo{ height:72px; width:auto; filter: drop-shadow(0 10px 30px rgba(0,0,0,.6)); }
        .kite-trail{ position:absolute; left:50%; top:60%; width:2px; height:120px; transform: translateX(-50%);
          background: linear-gradient(180deg, rgba(52,211,153,.9), rgba(34,211,238,0)); opacity:.7; filter: blur(0.3px);
        }
        .kite-wrapper.fly{ animation: flyUp 1.2s cubic-bezier(.2,.7,.3,1) forwards; }

        .tagline{ margin-top:14px; font-weight:800; letter-spacing:.02em; }
        .tagline .tag-word{ opacity:0; display:inline-block; background:linear-gradient(90deg,#fff,#e7fff5,#a7f3d0); -webkit-background-clip:text; background-clip:text; color:transparent; filter: blur(6px); }
        .tagline.show .tag-word{ animation: wordIn .6s cubic-bezier(.2,.7,.3,1) forwards; animation-delay: calc(var(--i) * 90ms); }

        @keyframes flyUp{ 0%{ transform: translateY(0) } 70%{ transform: translateY(-160px) } 100%{ transform: translateY(-200px) } }
        @keyframes wordIn{ to { opacity:1; filter: blur(0); } }
        @keyframes curtainUp{ to { transform: translateY(-100%); } }
        /* ——— Section Navigator ——— */
        .section-dot{ width:10px; height:10px; border-radius:9999px; border:1px solid rgba(255,255,255,.35); background:rgba(255,255,255,.06); position:relative; transition:transform .2s ease, background .2s ease, border-color .2s ease; }
        .section-dot:hover{ transform: scale(1.15); border-color: rgba(16,185,129,.8); }
        .section-dot.active{ background: linear-gradient(180deg,#34d399,#22d3ee); border-color: transparent; box-shadow: 0 0 0 6px rgba(34,211,238,.12); }
        .section-dot::after{ content: attr(data-label); position:absolute; right:130%; top:50%; transform: translateY(-50%); white-space:nowrap; font-size:10px; letter-spacing:.08em; padding:.25rem .45rem; border-radius:6px; background: rgba(17,24,39,.8); color:#e5e7eb; border:1px solid rgba(255,255,255,.1); opacity:0; pointer-events:none; transition:opacity .15s ease; }
        .section-dot:hover::after{ opacity:1 }

        /* ——— Yearly Pricing Pulse ——— */
        @keyframes pulseGlow{ 0%{ box-shadow: 0 10px 40px rgba(34,211,238,0.10) } 100%{ box-shadow: 0 16px 64px rgba(34,211,238,0.28) } }
        .yearly-on .price-card{ animation: pulseGlow 1.4s ease-in-out infinite alternate; outline: 1px solid rgba(34,211,238,.25); }
        .yearly-on .price-card:nth-child(2){ animation-delay:.08s }
        .yearly-on .price-card:nth-child(3){ animation-delay:.16s }
        .yearly-on .price-card:nth-child(4){ animation-delay:.24s }

        /* ——— Ambient Glows ——— */
        .pricing-glow{ position:absolute; inset:0; background: radial-gradient(600px 200px at 20% 10%, rgba(34,197,94,.08), transparent 60%), radial-gradient(700px 240px at 80% 90%, rgba(34,211,238,.08), transparent 60%); filter: blur(0.5px); }
        .testimonials-glow{ position:absolute; inset:0; background: radial-gradient(520px 220px at 15% 40%, rgba(34,197,94,.06), transparent 60%), radial-gradient(520px 220px at 85% 60%, rgba(34,211,238,.06), transparent 60%); }
        /* Mission cosmetics */
        .mission-underline{
          background: linear-gradient(90deg,var(--c1,#34d399),var(--c2,#2dd4bf),var(--c3,#22d3ee));
          filter: drop-shadow(0 6px 24px rgba(34,197,94,.25));
          border-radius: 9999px;
        }
        .mission-orb{
          background: radial-gradient(50% 50% at 50% 50%, rgba(34,197,94,.18), rgba(34,197,94,0) 70%);
          filter: blur(12px);
          animation: orbFloat 16s ease-in-out infinite;
        }
        .mission-orb-2{
          background: radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,.16), rgba(34,211,238,0) 70%);
          filter: blur(12px);
          animation: orbFloat2 18s ease-in-out infinite;
        }
        @keyframes orbFloat { 0%,100%{ transform: translate3d(0,0,0)} 50%{ transform: translate3d(20px,18px,0)} }
        @keyframes orbFloat2 { 0%,100%{ transform: translate3d(0,0,0)} 50%{ transform: translate3d(-22px,-14px,0)} }

        /* Mission pillar cards subtle float and glow */
        .pillar-card{
          position: relative;
          overflow: hidden;
          transform-style: preserve-3d;
          transition: box-shadow .25s ease, transform .2s ease;
          animation: floatCard 9s ease-in-out infinite;
        }
        .pillar-card::after{
          content:"";
          position:absolute; inset:-40%;
          background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(34,211,238,0.14), transparent 55%);
          opacity:0; transition: opacity .3s ease;
        }
        .pillar-card:hover::after{ opacity:1 }
        /* star shimmer for ratings */
        #testimonials .text-yellow-300 { background: linear-gradient(90deg,#fde047,#facc15,#fde047); -webkit-background-clip:text; background-clip:text; color: transparent; background-size: 200% 100%; animation: shimmer 3.2s linear infinite; }
        /* Enhanced feature animations */
        .feature-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(145deg, rgba(255,255,255,0.02), rgba(255,255,255,0.04));
          backdrop-filter: blur(8px);
        }
        .feature-card::before {
          content: "";
          position: absolute;
          top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(34,211,238,0.18), transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .feature-card:hover::before { opacity: 1; }

        /* Gentle stagger float */
        @keyframes floatCard { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .feature-float { animation: floatCard 8s ease-in-out infinite; }

        /* Stagger delays by grid position */
        #features .grid > *:nth-child(1)  .feature-card { animation-delay: 0s; }
        #features .grid > *:nth-child(2)  .feature-card { animation-delay: .6s; }
        #features .grid > *:nth-child(3)  .feature-card { animation-delay: 1.2s; }
        #features .grid > *:nth-child(4)  .feature-card { animation-delay: 1.8s; }
        #features .grid > *:nth-child(5)  .feature-card { animation-delay: .9s; }
        #features .grid > *:nth-child(6)  .feature-card { animation-delay: 1.5s; }
        #features .grid > *:nth-child(7)  .feature-card { animation-delay: 2.1s; }
        #features .grid > *:nth-child(8)  .feature-card { animation-delay: 2.7s; }

        .logo-shine { position: relative; overflow: hidden; border-radius: 4px; }
        .logo-shine::after { content: ''; position: absolute; top: -50%; left: -60%; width: 20%; height: 200%; background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0) 100%); transform: skewX(-25deg); transition: left 0.75s; }
        .logo-shine:hover::after { left: 140%; }
        
        .brand-comet{ position:absolute; top:-60px; left:-15%; width:220px; height:220px; pointer-events:none; background:
          radial-gradient(30px 30px at 20% 40%, rgba(255,255,255,.9), rgba(255,255,255,0)),
          radial-gradient(220px 80px at 40% 55%, rgba(52,211,153,.25), rgba(34,211,238,.12), rgba(0,0,0,0));
          filter: blur(10px); opacity:.0; transform: rotate(15deg); animation: comet 11s linear infinite; }
        @keyframes comet{ 0%{ transform: translate(-20%, -10%) rotate(15deg); opacity:0 } 8%{ opacity:.35 } 50%{ transform: translate(110%, 60%) rotate(15deg); opacity:.35 } 62%{ opacity:.15 } 100%{ transform: translate(140%, 90%) rotate(15deg); opacity:0 } }
        
        .hero-particles .p{ position:absolute; width:6px; height:6px; border-radius:9999px; background:radial-gradient(circle,#fff,rgba(255,255,255,0)); opacity:.35; animation: float 12s linear infinite; }
        @keyframes float { 0%{ transform: translate3d(0,0,0);} 100%{ transform: translate3d(0,-120px,0);} }
        .hero-particles .p-1{ left:8%;  top:70%; animation-duration: 12s; } .hero-particles .p-2{ left:18%; top:64%; animation-duration: 10s; } .hero-particles .p-3{ left:28%; top:76%; animation-duration: 14s; } .hero-particles .p-4{ left:42%; top:68%; animation-duration: 9s; } .hero-particles .p-5{ left:56%; top:75%; animation-duration: 13s; } .hero-particles .p-6{ left:66%; top:62%; animation-duration: 11s; } .hero-particles .p-7{ left:74%; top:70%; animation-duration: 15s; } .hero-particles .p-8{ left:82%; top:66%; animation-duration: 9.5s; } .hero-particles .p-9{ left:26%; top:58%; animation-duration: 8s; } .hero-particles .p-10{ left:48%; top:60%; animation-duration: 12.5s; } .hero-particles .p-11{ left:64%; top:56%; animation-duration: 10.5s; } .hero-particles .p-12{ left:86%; top:58%; animation-duration: 13.5s; }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .type-cursor::after{ content:'▍'; margin-left:2px; animation: blink 1s step-end infinite }
        .mic-ring{ position:absolute; inset:-12px; border-radius:9999px; box-shadow:0 0 0 0 rgba(52,211,153,.35); animation: micPulse 2s ease-out infinite }
        @keyframes micPulse{ 0%{ box-shadow:0 0 0 0 rgba(52,211,153,.35)} 70%{ box-shadow:0 0 0 18px rgba(52,211,153,0)} 100%{ box-shadow:0 0 0 0 rgba(52,211,153,0)} }
        
        .dash-route{ stroke-dasharray:14 10; animation: dash 3.8s linear infinite }
        @keyframes dash { to { stroke-dashoffset: -340 } }
        /* Improve label readability over glow */
        #story svg text{ paint-order: stroke; stroke: rgba(0,0,0,.35); stroke-width: 2px; }
        .truck { transition: transform 0.8s cubic-bezier(.6,.2,.3,1); }
        .stop-pulse { stroke-width: 2; opacity: 0.6; transform-origin: center; animation: stopPulse 2.4s ease-out infinite; }
        @keyframes stopPulse { 0% { transform: scale(0.6); opacity: 0.6; } 60% { transform: scale(1.3); opacity: 0; } 100% { transform: scale(1.3); opacity: 0; } }
        /* Packet burst around active stop */
        .burst circle{ fill: url(#route); opacity:.9; transform-origin: center; animation: burst 700ms ease-out forwards; }
        .burst circle:nth-child(2){ animation-delay: 60ms; opacity:.7 }
        .burst circle:nth-child(3){ animation-delay: 120ms; opacity:.5 }
        @keyframes burst { 0%{ transform: scale(0.6); opacity:1 } 70%{ transform: scale(1.5); opacity:.3 } 100%{ transform: scale(2); opacity:0 } }

        .voice-mic-container::before{ content:""; position:absolute; inset:-24px; border-radius:9999px; background: radial-gradient(circle, rgba(52,211,153,0.18), rgba(34,211,238,0.12) 60%, rgba(0,0,0,0) 70%); filter: blur(8px); z-index: -1; }
        .wave-bar { animation: wavePulse 1.8s cubic-bezier(.57,.21,.69,.99) infinite; transform-origin: bottom; width: 4px; background: #6ee7b7; border-radius: 2px;}
        @keyframes wavePulse { 0%{transform: scaleY(0.4)} 15%{transform: scaleY(1.0)} 30%{transform: scaleY(0.3)} 45%{transform: scaleY(0.8)} 60%{transform: scaleY(0.2)} 75%{transform: scaleY(0.7)} 100%{transform: scaleY(0.4)} }
        
        .invoice-row, .invoice-line { opacity: 0; animation: typeIn 0.6s forwards; }
        .aos-animate .invoice-row:nth-child(2) { animation-delay: 0.5s; } .aos-animate .invoice-row:nth-child(3) { animation-delay: 1.0s; } .aos-animate .invoice-row:nth-child(4) { animation-delay: 1.5s; }
        .aos-animate .invoice-line:nth-of-type(1) { animation-delay: 1.8s; } .aos-animate .discount-line { animation-delay: 2.1s; } .aos-animate .total-line { animation-delay: 2.4s; }
        @keyframes typeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .aos-animate .final-total { animation: num-scramble 1s 2.6s forwards ease-out; }
        @keyframes num-scramble { 0% { content: "₹82"; } 10% { content: "₹157"; } 20% { content: "₹99"; } 30% { content: "₹240"; } 40% { content: "₹180"; } 50% { content: "₹310"; } 60% { content: "₹290"; } 100% { content: "₹320"; } }

        .aos-animate .ai-scan-line { animation: scan 2s cubic-bezier(.6,.2,.3,1) 0.5s forwards; }
        @keyframes scan { from { left: 0; opacity: 1; } to { left: 100%; opacity: 0; } }
        .ai-inventory-rows .row { position: relative; opacity: 0; transform: scale(0.95) translateY(20px); animation: row-in 0.6s cubic-bezier(.2,.7,.3,1) forwards; }
        .ai-inventory-rows .row::after { content: '✨'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0); opacity: 0; animation: sparkle 0.6s 0.2s cubic-bezier(.2,.7,.3,1) forwards; }
        @keyframes sparkle { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 100% { transform: translate(-50%, -80%) scale(1.5); opacity: 0; } }
        .aos-animate .ai-inventory-rows .row:nth-child(1) { animation-delay: 1.5s; } .aos-animate .ai-inventory-rows .row:nth-child(2) { animation-delay: 1.7s; } .aos-animate .ai-inventory-rows .row:nth-child(3) { animation-delay: 1.9s; }
        @keyframes row-in { to { opacity: 1; transform: scale(1) translateY(0); } }
        .smart-card { opacity: 0; transform: translateY(20px); animation: card-in 0.5s cubic-bezier(.2,.7,.3,1) forwards; }
        .aos-animate .smart-card:nth-child(1) { animation-delay: 2.5s; } .aos-animate .smart-card:nth-child(2) { animation-delay: 2.6s; } .aos-animate .smart-card:nth-child(3) { animation-delay: 2.7s; }
        @keyframes card-in { to { opacity: 1; transform: translateY(0); } }
        .aos-animate .low-stock { animation: card-in 0.5s cubic-bezier(.2,.7,.3,1) 2.7s forwards, shake 0.82s cubic-bezier(.36,.07,.19,.97) 3.5s both; }
        @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-2px, 0, 0); } 40%, 60% { transform: translate3d(2px, 0, 0); } }
        
        .pos-frame { perspective: 1400px; border-radius: 20px; }
        .pos-frame::after{ content:""; position:absolute; inset:-2px; border-radius:22px; background:linear-gradient(120deg, rgba(34,197,94,.18), rgba(20,184,166,.12), rgba(6,182,212,.18)); filter:blur(18px); opacity:.35; z-index:-1; }
        .pos-flip-card { perspective: 1400px; height:100%; }
        .pos-flip-inner { position:relative; width:100%; height:100%; transform-style:preserve-3d; will-change: transform; transition: transform 0.8s cubic-bezier(.6,.2,.3,1); }
        #pos-demo.is-flipped .pos-flip-inner { transform: rotateY(180deg); }
        .pos-flip-front, .pos-flip-back { backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius: 16px; }
        .pos-flip-back { transform: rotateY(180deg); }
        .shimmer { position:relative; overflow:hidden; }
        .shimmer::after{ content:""; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent); transform:translateX(-100%); animation: shimmer 2.8s infinite; }
        .pos-segment .pos-tabs{ display:flex; align-items:center; gap:2px; padding:2px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:9999px; }
        .pos-segment .pos-tab{ font-size:11px; padding:4px 10px; border-radius:9999px; color:rgba(255,255,255,.8); position:relative; z-index:2; }
        .pos-segment .pos-tab-indicator{ position:absolute; left:2px; top:2px; width:calc(50% - 2px); height:calc(100% - 4px); border-radius:9999px; background:linear-gradient(90deg, rgba(52,211,153,.25), rgba(34,211,238,.25)); box-shadow:0 4px 18px rgba(34,211,238,.25); transform: translateX(0); transition: transform 0.6s cubic-bezier(.6,.2,.3,1); }
        #pos-demo.is-flipped .pos-tab-indicator { transform: translateX(100%); }
        .pos-tile { opacity:0; transform: scale(0.9); animation: tile-in 0.5s 2.2s cubic-bezier(.2,.7,.3,1) forwards; } .pos-tile:nth-child(2){ animation-delay: 2.35s; } .pos-tile:nth-child(3){ animation-delay: 2.5s; } .pos-tile:nth-child(4){ animation-delay: 2.65s; } .pos-tile:nth-child(5){ animation-delay: 2.8s; } .pos-tile:nth-child(6){ animation-delay: 2.95s; }
        @keyframes tile-in { to { opacity: 1; transform: scale(1); } }
        .pos-tile.selected { animation: select-tile 1.6s 3.2s infinite alternate ease-in-out; }
        @keyframes select-tile { from { background: rgba(255,255,255,0.2); transform: scale(1); } to { background: rgba(52, 211, 153, 0.75); transform: scale(1.06); } }
        .pos-checkout-btn { animation: pulse-checkout 1.5s 3.2s infinite alternate ease-in-out; }
        @keyframes pulse-checkout { to { transform: scale(1.05); box-shadow: 0 0 20px rgba(52, 211, 153, 0.5); } }

        .animated-bar-chart .bar { width: 15%; background: linear-gradient(to top, #34d399, #2dd4bf); border-radius: 4px 4px 0 0; transform: scaleY(0); transform-origin: bottom; transition: transform 0.8s cubic-bezier(.2,.7,.3,1); }
        .aos-animate .animated-bar-chart .bar { transform: scaleY(var(--h, 0)); }
        .aos-animate .animated-bar-chart .bar:nth-child(2) { transition-delay: 0.1s; } .aos-animate .animated-bar-chart .bar:nth-child(3) { transition-delay: 0.2s; } .aos-animate .animated-bar-chart .bar:nth-child(4) { transition-delay: 0.3s; } .aos-animate .animated-bar-chart .bar:nth-child(5) { transition-delay: 0.4s; }
        .animated-line-chart path { stroke-dasharray: 200; stroke-dashoffset: 200; transition: stroke-dashoffset 1.5s cubic-bezier(.6,.2,.3,1); }
        .aos-animate .animated-line-chart path { stroke-dashoffset: 0; }
        .animated-donut-chart { transform: rotate(-90deg); }
        .animated-donut-chart .donut-segment { fill: none; stroke-width: 3.8; transform-origin: 50% 50%; stroke-linecap: round; transition: stroke-dasharray 1.2s cubic-bezier(.6,.2,.3,1); }
        .aos-animate .animated-donut-chart { animation: spin-in 1.2s cubic-bezier(.6,.2,.3,1); }
        @keyframes spin-in { from { transform: rotate(-360deg) scale(0.8); } to { transform: rotate(-90deg) scale(1); } }

        .section-divider { position: relative; }
        .section-divider::before { content: ''; position: absolute; top: -4rem; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(52,211,153,.25) 50%, transparent 100%); opacity: 0; transform: scaleX(0.5); transition: opacity .8s ease, transform .8s ease; }
        section:has(> .aos-animate) + .section-divider::before { opacity: 1; transform: scaleX(1); }
        
        .ticker { animation: ticker 22s linear infinite; }
        .ticker .item { display:inline-block; padding: 6px 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 9999px; }
        @keyframes ticker { 0%{ transform: translateX(0); } 100%{ transform: translateX(-50%); } }
        .ticker-mask::before, .ticker-mask::after { content: ""; position: absolute; top: 0; bottom: 0; width: 80px; pointer-events: none; z-index: 1; background: linear-gradient(to right, rgba(11,15,20,1), rgba(11,15,20,0)); }
        .ticker-mask::before { left: 0; } .ticker-mask::after { right: 0; transform: scaleX(-1); }
        .testimonial-track { animation: tslide 38s linear infinite; will-change: transform; }
        @keyframes tslide { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-50%,0,0); } }
        #testimonials .testimonial-track > div { flex: 0 0 auto; }
        
        .force-text { color: rgba(255,255,255,0.92); }
        .animate-word { animation: wordIn .7s ease both; }
        @keyframes wordIn { from { opacity: 0; filter: blur(8px); transform: translateY(8px); } to { opacity:1; filter: blur(0); transform: translateY(0); } }
        .grid-overlay { background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 40px 40px; }
        .feature-card { position: relative; overflow: hidden; }
        .feature-card .ripple { position:absolute; width:12px; height:12px; transform: translate(-50%, -50%); border-radius:9999px; background: radial-gradient(circle, rgba(34,211,238,0.65) 0%, rgba(34,211,238,0.0) 60%); animation: ripple .6s ease-out both; }
        @keyframes ripple { from { opacity:.9; width:12px; height:12px; } to { opacity:0; width:260px; height:260px; } }
        html { scroll-behavior: smooth; }
        .hover-raise { transition: transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .18s ease; will-change: transform; }
        .hover-raise:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(0,0,0,.32); }
        @media (prefers-reduced-motion: reduce) { .anim-gradient, .wave-bar, .path-connector, .data-flow, .ai-scan-line, .animated-bar-chart, .animated-donut-chart, .pos-flip-inner, .ticker, .testimonial-track { animation: none !important; } }
      `}</style>
    </div>
  );
};

export default LandingPage;
      