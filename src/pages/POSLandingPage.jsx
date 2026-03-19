import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductHeader from "../components/common/ProductHeader";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";

// ─── Product Switcher (Swiggy-style sliding pill) ────────────────────────────
export function ProductSwitcher({ active = "pos", className = "", scTo = "/", posTo = "/pos-landing" }) {
  const navigate = useNavigate();
  const tabs = [
    { id: "supplychain", label: "Supply Chain", shortLabel: "SC", icon: "🔗", to: scTo,  activeColor: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/40" },
    { id: "pos",         label: "Restaurant POS", shortLabel: "POS", icon: "🍽️", to: posTo, activeColor: "from-orange-500 to-amber-500", glow: "shadow-orange-500/40" },
  ];

  return (
    <div className={`relative flex items-center p-1 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-xl ${className}`}>
      {/* Sliding background pill */}
      {tabs.map(tab =>
        tab.id === active ? (
          <motion.div
            key="active-pill"
            layoutId="product-switcher-pill"
            className={`absolute inset-1 rounded-xl bg-gradient-to-r ${tab.activeColor} shadow-lg ${tab.glow}`}
            style={{ width: "calc(50% - 2px)", left: tab.id === "pos" ? "calc(50% + 2px)" : "4px" }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
          />
        ) : null
      )}

      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => navigate(tab.to)}
          className={`relative z-10 flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors duration-200 select-none flex-1 ${
            active === tab.id ? "text-white" : "text-white/40 hover:text-white/70"
          }`}
        >
          <span className="text-sm leading-none">{tab.icon}</span>
          <span className="hidden sm:inline whitespace-nowrap">{tab.label}</span>
          <span className="sm:hidden">{tab.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Floating particles ───────────────────────────────────────────────────────
const FOOD_EMOJIS = ["🍕","🍔","🍜","🍣","🥗","🍰","☕","🍷","🥩","🌮","🍝","🧆"];
function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FOOD_EMOJIS.map((emoji, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl select-none"
          style={{ left: `${(i * 8.3) % 100}%`, top: `${(i * 13 + 10) % 90}%` }}
          animate={{ y: [0, -18, 0], rotate: [0, 8, -8, 0], opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 4 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
}

// ─── Animated section wrapper ─────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent, delay }) {
  const colors = {
    orange: "from-orange-500/20 to-amber-500/20 border-orange-500/20 shadow-orange-500/10",
    blue:   "from-blue-500/20 to-cyan-500/20 border-blue-500/20 shadow-blue-500/10",
    purple: "from-purple-500/20 to-violet-500/20 border-purple-500/20 shadow-purple-500/10",
    emerald:"from-emerald-500/20 to-teal-500/20 border-emerald-500/20 shadow-emerald-500/10",
    pink:   "from-pink-500/20 to-rose-500/20 border-pink-500/20 shadow-pink-500/10",
    amber:  "from-amber-500/20 to-yellow-500/20 border-amber-500/20 shadow-amber-500/10",
  };
  return (
    <FadeUp delay={delay}>
      <div className={`group h-full rounded-2xl border bg-gradient-to-br ${colors[accent]} p-6 backdrop-blur-sm hover:scale-[1.03] hover:shadow-xl transition-all duration-300`}>
        <div className="text-3xl mb-4">{icon}</div>
        <h3 className="text-base font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
      </div>
    </FadeUp>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────
function StepCard({ step, icon, title, desc, delay }) {
  return (
    <FadeUp delay={delay} className="text-center">
      <div className="relative inline-flex items-center justify-center mb-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center text-3xl shadow-xl shadow-orange-500/10">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg">
          {step}
        </div>
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/50 leading-relaxed max-w-[200px] mx-auto">{desc}</p>
    </FadeUp>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function POSLandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [shrinkHeader, setShrinkHeader] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setScrollProgress(total > 0 ? (el.scrollTop / total) * 100 : 0);
      setShrinkHeader(el.scrollTop > 60);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const STATS = [
    { value: "500+", label: "Restaurants" },
    { value: "2M+",  label: "Orders Processed" },
    { value: "< 0.3s", label: "Load Time" },
    { value: "99.9%", label: "Uptime" },
  ];

  const FEATURES = [
    { icon: "🪑", title: "Table & Zone Management",   desc: "Assign orders to tables, track occupancy and floor zones in real-time. Multi-floor support built in.", accent: "orange" },
    { icon: "📺", title: "Kitchen Display (KDS)",     desc: "Orders appear on the kitchen screen instantly. No tickets, no delays — chefs see everything live.", accent: "blue"   },
    { icon: "📜", title: "Digital Menu Builder",      desc: "Build your menu with photos, prices and categories. Update items in seconds without reprinting.", accent: "purple" },
    { icon: "📱", title: "QR Self-Ordering",          desc: "Guests scan a QR code and order from their phone. Zero wait time, bigger average order value.", accent: "emerald"},
    { icon: "📊", title: "Sales Analytics",           desc: "Real-time charts for revenue, top items, peak hours, and staff performance. Data that drives decisions.", accent: "pink"  },
    { icon: "👥", title: "Staff Management",          desc: "PIN-based logins for staff, role permissions, attendance tracking and shift reports.", accent: "amber" },
  ];

  const STEPS = [
    { step: 1, icon: "📜", title: "Build Your Menu",   desc: "Add categories, items, prices and photos in minutes." },
    { step: 2, icon: "🪑", title: "Set Up Tables",     desc: "Map your floor plan. Assign zones, table numbers and capacity." },
    { step: 3, icon: "⚡", title: "Go Live",           desc: "Start taking orders, sending to kitchen and settling bills instantly." },
  ];

  return (
    <div className="text-white min-h-screen bg-[#020617] overflow-x-hidden">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 h-[2px] bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400 z-50 transition-[width] duration-100"
        style={{ width: `${scrollProgress}%` }} />

      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute -top-40 right-0 w-[60vw] h-[60vh] rounded-full blur-[120px] opacity-20"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.6) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 -left-24 w-[50vw] h-[50vh] rounded-full blur-[120px] opacity-15"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.5) 0%, transparent 70%)" }} />
      </div>

      {/* ── Header ── */}
      <ProductHeader
        active="pos"
        shrink={shrinkHeader}
        scTo="/"
        posTo="/pos-landing"
        navLinks={[
          { label: "Features",     href: "#features"    },
          { label: "How it works", href: "#how-it-works" },
          { label: "Pricing",      href: "#cta"         },
        ]}
        cta={
          <>
            <button
              onClick={() => navigate("/auth?type=login&product=pos")}
              className="px-4 py-1.5 rounded-xl text-sm border border-white/20 hover:border-orange-400/60 text-white/80 hover:text-white transition-all"
            >
              Sign In
            </button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/auth?type=register&product=pos")}
              className="px-4 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all"
            >
              Get Started Free
            </motion.button>
          </>
        }
      />

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative min-h-[92vh] flex flex-col items-center justify-center px-5 py-20 overflow-hidden">
        <FloatingParticles />
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-[11px] font-bold text-orange-400 tracking-widest uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            India's First Restaurant OS
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Your Restaurant's
            <br />
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
              Operating System
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/55 leading-relaxed max-w-2xl mx-auto mb-10"
          >
            Tables, kitchen display, digital menu, QR ordering and analytics —
            all in one beautiful, blazing-fast POS built for restaurants and cafés.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 20px 60px rgba(249,115,22,0.4)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/auth?type=register&product=pos")}
              className="px-8 py-3.5 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_10px_40px_rgba(249,115,22,0.3)] transition-all"
            >
              Start Free — No Card Needed →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/auth?type=login&product=pos")}
              className="px-8 py-3.5 rounded-2xl font-semibold text-sm border border-white/20 text-white/80 hover:border-orange-400/40 hover:text-white transition-all"
            >
              Sign In to POS
            </motion.button>
          </motion.div>

          {/* Trust pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-10 text-xs text-white/35"
          >
            {["✓ Free setup", "✓ No hardware lock-in", "✓ Works on any tablet or PC", "✓ Indian GST billing"].map(t => (
              <span key={t} className="px-3 py-1 rounded-full border border-white/10 bg-white/5">{t}</span>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <span className="text-[10px] text-white/25 tracking-widest uppercase">Scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </section>

      {/* ── Stats Bar ── */}
      <FadeUp>
        <section className="relative z-10 py-10 border-y border-white/8">
          <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{s.value}</div>
                <div className="text-xs text-white/40 mt-1 font-medium">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </section>
      </FadeUp>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/8 text-[11px] font-bold text-orange-400 tracking-widest uppercase mb-5">
              Everything you need
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
              Built for every corner
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">of your restaurant</span>
            </h2>
            <p className="text-white/45 text-base mt-4 max-w-xl mx-auto">From the front-of-house to the kitchen — every team member has exactly what they need.</p>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative z-10 py-24 px-5 bg-white/[0.02] border-y border-white/8">
        <div className="max-w-4xl mx-auto">
          <FadeUp className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 text-[11px] font-bold text-amber-400 tracking-widest uppercase mb-5">
              Get running in minutes
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white">3 steps to live</h2>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            {/* Connector lines */}
            <div className="hidden md:block absolute top-8 left-[33%] right-[33%] h-px bg-gradient-to-r from-orange-500/30 via-amber-500/30 to-orange-500/30" />
            {STEPS.map((s, i) => <StepCard key={s.step} {...s} delay={i * 0.12} />)}
          </div>
        </div>
      </section>

      {/* ── Live Demo Preview ── */}
      <section className="relative z-10 py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              See it in action
            </h2>
            <p className="text-white/45 text-base max-w-lg mx-auto">Everything your team needs, on a single screen — no training required.</p>
          </FadeUp>

          {/* Mock POS UI card */}
          <FadeUp delay={0.1}>
            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-orange-500/5 to-amber-500/5 backdrop-blur-xl p-8 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] bg-orange-500/10" />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] bg-amber-500/8" />
              </div>

              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: "🪑", label: "Tables",    value: "12 / 15", sub: "3 available",    color: "orange" },
                  { icon: "📺", label: "Kitchen",   value: "8 Orders", sub: "2 ready",        color: "blue"   },
                  { icon: "💰", label: "Today",     value: "₹42,800",  sub: "+18% vs yesterday", color: "emerald"},
                  { icon: "⏱️", label: "Avg. Time", value: "14 min",   sub: "table to bill",  color: "amber"  },
                ].map((c) => (
                  <motion.div
                    key={c.label}
                    whileHover={{ scale: 1.04, y: -2 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center cursor-default"
                  >
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <div className="text-lg font-black text-white">{c.value}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{c.sub}</div>
                  </motion.div>
                ))}
              </div>

              <div className="relative z-10 mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                {[1,2,3,4,5,6].map(n => (
                  <motion.div
                    key={n}
                    whileHover={{ scale: 1.06 }}
                    className={`rounded-xl border p-3 text-center text-xs font-bold cursor-pointer transition-all ${
                      n === 2 || n === 5
                        ? "bg-gradient-to-br from-orange-500/30 to-amber-500/20 border-orange-500/40 text-orange-300"
                        : n === 4
                        ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border-white/10 text-white/50"
                    }`}
                  >
                    <div className="text-base mb-0.5">🪑</div>
                    Table {n}
                    <div className={`text-[9px] mt-0.5 ${n === 2 || n === 5 ? "text-orange-400" : n === 4 ? "text-emerald-400" : "text-white/30"}`}>
                      {n === 2 ? "Ordering" : n === 4 ? "Ready" : n === 5 ? "Occupied" : "Free"}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="relative z-10 py-16 px-5">
        <FadeUp>
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-5xl mb-6">⭐⭐⭐⭐⭐</div>
            <blockquote className="text-xl md:text-2xl font-semibold text-white/85 leading-relaxed italic mb-6">
              "We switched from a legacy POS to FLYP in one evening. The kitchen display alone saved us 20 minutes per shift — orders stopped getting missed."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-black text-sm">R</div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">Rahul Sharma</div>
                <div className="text-xs text-white/40">Owner, Café Roots · Mumbai</div>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── CTA ── */}
      <section id="cta" className="relative z-10 py-24 px-5">
        <FadeUp>
          <div className="max-w-4xl mx-auto text-center relative rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-12 md:p-16 overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-[80px] bg-orange-500/20" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-[60px] bg-amber-500/15" />
            </div>
            <div className="relative z-10">
              <div className="text-5xl mb-6">🚀</div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Ready to modernize<br />your restaurant?</h2>
              <p className="text-white/50 text-base mb-10 max-w-lg mx-auto">Free forever for up to 1 location. No credit card. No lock-in. Just a better restaurant.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 20px 60px rgba(249,115,22,0.4)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate("/auth?type=register&product=pos")}
                  className="px-10 py-4 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_10px_40px_rgba(249,115,22,0.3)]"
                >
                  Create Free Account →
                </motion.button>
                <button
                  onClick={() => navigate("/")}
                  className="px-8 py-4 rounded-2xl font-semibold text-sm text-white/60 hover:text-white border border-white/15 hover:border-white/30 transition-all"
                >
                  See Supply Chain product ↗
                </button>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/8 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/assets/flyp_logo.png" alt="FLYP" className="h-6 w-6 object-contain"
              onError={e => { e.target.style.display = "none"; }} />
            <span className="text-sm font-black tracking-widest uppercase text-white/60">FLYP POS</span>
          </div>
          <ProductSwitcher active="pos" />
          <div className="text-xs text-white/25">© {new Date().getFullYear()} FLYP Technologies. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
