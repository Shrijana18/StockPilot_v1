import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductHeader from "../components/common/ProductHeader";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  fire:  "#FF4D00",
  amber: "#FFAA00",
  cream: "#FFF5E4",
  d1:    "#0A0705",
  d2:    "#120E0A",
  d3:    "#1E1710",
  muted: "#8A7A6A",
  dim:   "#3A2E24",
  green: "#00C864",
};

// ── Product Switcher ──────────────────────────────────────────────────────────
export function ProductSwitcher({ active = "pos", className = "", scTo = "/", posTo = "/pos-landing" }) {
  const navigate = useNavigate();
  const tabs = [
    { id: "supplychain", label: "Supply Chain",  shortLabel: "SC",  icon: "🔗", to: scTo,  activeColor: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/40" },
    { id: "pos",         label: "Restaurant POS", shortLabel: "POS", icon: "🍽️", to: posTo, activeColor: "from-orange-500 to-amber-500", glow: "shadow-orange-500/40" },
  ];
  return (
    <div className={`relative flex items-center p-1 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-xl ${className}`}>
      {tabs.map(tab => tab.id === active ? (
        <motion.div key="active-pill" layoutId="product-switcher-pill"
          className={`absolute inset-1 rounded-xl bg-gradient-to-r ${tab.activeColor} shadow-lg ${tab.glow}`}
          style={{ width: "calc(50% - 2px)", left: tab.id === "pos" ? "calc(50% + 2px)" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      ) : null)}
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => navigate(tab.to)}
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

// ── Scroll-triggered reveal ───────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Section eyebrow label ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2.5 mb-4"
      style={{ fontSize: 10, color: C.fire, letterSpacing: "4px", textTransform: "uppercase" }}>
      <span style={{ width: 24, height: 1, background: C.fire, flexShrink: 0, display: "block" }} />
      {children}
    </div>
  );
}


// ── Phone mockup with floating animation ────────────────────────────────────
function PhoneMockup() {
  const bars = [30, 40, 35, 48, 50];
  return (
    <motion.div
      animate={{ y: [0, -12, 0] }}
      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      style={{ width: 280, height: 560, background: "#151210", borderRadius: 38, border: "2px solid #2A2018", padding: "18px 14px", boxShadow: `0 60px 120px rgba(0,0,0,0.8), 0 0 0 1px ${C.fire}12`, margin: "0 auto", position: "relative" }}
    >
      {/* Glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/20 to-transparent blur-2xl rounded-full" />
      
      {/* Notch */}
      <div style={{ width: 48, height: 6, background: C.d1, borderRadius: 3, margin: "0 auto 14px", position: "relative", zIndex: 1 }} />
      {/* Screen */}
      <div style={{ background: "#0D0A07", borderRadius: 20, height: 488, overflow: "hidden", padding: "14px 12px", position: "relative", zIndex: 1 }}>
        {/* Topbar */}
        <motion.div
          initial={{ scaleX: 0.8, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{ background: C.fire, borderRadius: 7, height: 28, display: "flex", alignItems: "center", padding: "0 10px", marginBottom: 10, gap: 6 }}
        >
          <div style={{ width: 8, height: 8, background: "rgba(255,255,255,.4)", borderRadius: "50%" }} />
          <div style={{ fontSize: 9, color: "#fff", fontWeight: 600, letterSpacing: "1.5px", flex: 1, textAlign: "center" }}>FLYP POS</div>
          <div style={{ width: 8, height: 8, background: "rgba(255,255,255,.4)", borderRadius: "50%" }} />
        </motion.div>
        {/* Orders */}
        {[["Cappuccino ×2", "₹360"], ["Veg Pasta", "₹220"], ["Garlic Bread", "₹120"]].map(([name, price], idx) => (
          <motion.div
            key={name}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 + idx * 0.1, duration: 0.4 }}
            style={{ background: "rgba(255,255,255,.04)", borderRadius: 6, padding: "7px 10px", marginBottom: 5, display: "flex", justifyContent: "space-between" }}
          >
            <span style={{ fontSize: 9, color: "#C4A882" }}>{name}</span>
            <span style={{ fontSize: 9, color: C.amber, fontWeight: 500 }}>{price}</span>
          </motion.div>
        ))}
        {/* Total */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          style={{ background: `${C.fire}1F`, border: `1px solid ${C.fire}40`, borderRadius: 6, padding: "7px 10px", display: "flex", justifyContent: "space-between", margin: "7px 0" }}
        >
          <span style={{ fontSize: 8, color: C.fire, letterSpacing: "1px", textTransform: "uppercase" }}>Total</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: C.cream }}>₹700</span>
        </motion.div>
        {/* Button */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          style={{ background: `linear-gradient(90deg, ${C.fire}, #FF8C00)`, borderRadius: 6, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 600, letterSpacing: "2px", cursor: "pointer" }}
        >
          PLACE ORDER →
        </motion.div>
        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,.04)", margin: "10px 0" }} />
        {/* Stats label */}
        <div style={{ fontSize: 8, color: C.dim, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 7 }}>Today's Performance</div>
        {/* Mini stats */}
        <div style={{ display: "flex", gap: 5 }}>
          {[["34", "Orders"], ["₹14K", "Revenue"], ["0%", "Commission"]].map(([num, lbl], idx) => (
            <motion.div
              key={lbl}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1 + idx * 0.1, duration: 0.3 }}
              style={{ flex: 1, background: "rgba(255,255,255,.03)", borderRadius: 5, padding: "7px 6px", textAlign: "center" }}
            >
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: C.amber }}>{num}</div>
              <div style={{ fontSize: 7, color: C.dim, letterSpacing: ".5px" }}>{lbl}</div>
            </motion.div>
          ))}
        </div>
        {/* Chart bars */}
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", marginTop: 10, height: 50 }}>
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ delay: 1.4 + i * 0.08, duration: 0.5, ease: "easeOut" }}
              style={{ flex: 1, borderRadius: "2px 2px 0 0",
                background: i === 4
                  ? `linear-gradient(180deg, ${C.amber}, rgba(255,170,0,0.3))`
                  : `linear-gradient(180deg, ${C.fire}, rgba(255,77,0,0.3))` }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Commission calculator ─────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000)   return "₹" + Math.round(n / 1000) + "K";
  return "₹" + n;
}
function CommissionCalc() {
  const [rev, setRev] = useState(100000);
  const zLoss = Math.round(rev * 0.28);
  const sLoss = Math.round(rev * 0.30);
  return (
    <div style={{ background: C.d3, border: "1px solid #2A2018", borderRadius: 6, padding: 40, marginTop: 32 }}>
      {/* Slider row */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: C.muted, letterSpacing: "1px", width: 200, flexShrink: 0 }}>Monthly Revenue (₹)</span>
        <input type="range" min={10000} max={500000} step={5000} value={rev}
          onChange={e => setRev(parseInt(e.target.value))}
          style={{ flex: 1, appearance: "none", WebkitAppearance: "none", height: 3, background: "#2A2018", borderRadius: 2, outline: "none", cursor: "pointer" }}
        />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: C.cream, width: 80, textAlign: "right", letterSpacing: "1px" }}>
          {fmt(rev)}
        </span>
      </div>
      {/* Result cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[
          { name: "Zomato", loss: fmt(zLoss) + " lost", sub: "Lost per month @ 28%", bg: "rgba(255,77,0,.06)",  border: "rgba(255,77,0,.15)",  col: C.fire  },
          { name: "Swiggy", loss: fmt(sLoss) + " lost", sub: "Lost per month @ 30%", bg: "rgba(255,100,0,.06)", border: "rgba(255,100,0,.12)", col: "#FF6A00" },
          { name: "FLYP",   loss: "₹0",                 sub: "Commission saved",      bg: "rgba(0,200,100,.06)", border: "rgba(0,200,100,.2)",  col: C.green  },
        ].map(({ name, loss, sub, bg, border, col }) => (
          <div key={name} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: col, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>{name}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: col, lineHeight: 1 }}>{loss}</div>
            <div style={{ fontSize: 10, color: col === C.green ? C.green : C.muted, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatCard({ icon, title, desc, delay = 0 }) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="group relative h-full overflow-hidden transition-colors duration-200"
        style={{ background: "rgba(255,255,255,.025)", padding: "28px 26px", border: "1px solid rgba(255,255,255,.04)" }}
        onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.04)"}
        onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,.025)"}
      >
        {/* Orange top-bar on hover */}
        <div className="absolute top-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"
          style={{ background: `linear-gradient(90deg, ${C.fire}, ${C.amber})` }} />
        <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, fontWeight: 300 }}>{desc}</div>
      </div>
    </Reveal>
  );
}

// ── Showcase block (alternating text + image slot) ────────────────────────────
function ShowcaseBlock({ tag, title, titleEm, desc, bullets, children, reverse = false }) {
  return (
    <Reveal className="mb-28 last:mb-0">
      <div className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-16`}>
        {/* Text */}
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 mb-5"
            style={{ fontSize: 10, color: C.fire, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 600,
              background: `${C.fire}1A`, border: `1px solid ${C.fire}33`, padding: "4px 12px", borderRadius: 100 }}>
            {tag}
          </div>
          <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px,3vw,48px)", lineHeight: 1, letterSpacing: "1px", marginBottom: 16, color: C.cream }}>
            {title}<br /><span style={{ color: C.fire }}>{titleEm}</span>
          </h3>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 20 }}>{desc}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: C.muted }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${C.green}26`, border: `1px solid ${C.green}4D`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, color: C.green, fontWeight: 700 }}>✓</span>
                </div>
                {b}
              </div>
            ))}
          </div>
        </div>
        {/* Image slot */}
        <div className="flex-1 w-full relative">{children}</div>
      </div>
    </Reveal>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ step, title, desc, delay = 0 }) {
  return (
    <Reveal delay={delay} className="text-center relative z-10">
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.d1, border: `2px solid ${C.fire}`,
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 24, color: C.fire, margin: "0 auto 16px" }}>
        {step}
      </div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: C.cream, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, padding: "0 12px" }}>{desc}</div>
    </Reveal>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function POSLandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY       = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const [scrollProg,  setScrollProg]  = useState(0);
  const [shrinkHeader, setShrinkHeader] = useState(false);

  // Load Bebas Neue + Syne fonts
  useEffect(() => {
    const id = "flyp-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id   = id;
      link.rel  = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setScrollProg(total > 0 ? (el.scrollTop / total) * 100 : 0);
      setShrinkHeader(el.scrollTop > 60);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const FEATURES = [
    { icon: "🛍️", title: "Digital Storefront",      desc: "Your own branded online store with shareable menu link. No tech skills needed. Live in 5 minutes." },
    { icon: "📋", title: "Menu Builder",              desc: "Add items, photos, prices, variants and combos in under 1 minute. Update anytime from your phone." },
    { icon: "🖥️", title: "Kitchen Display System",   desc: "Orders route directly to your kitchen screen in real-time. No paper slips. No missed tickets." },
    { icon: "👥", title: "Multi-Staff Access",        desc: "Role-based logins for cashier, chef, and manager. Everyone works from their own screen." },
    { icon: "💳", title: "All Payment Modes",         desc: "UPI, card, cash, credit — unified in one dashboard. Auto reconciliation, no manual work." },
    { icon: "🛵", title: "Your Own Delivery",         desc: "Take delivery orders directly. Keep 100% of your revenue. No Zomato, no Swiggy cuts." },
    { icon: "📊", title: "Live Analytics",            desc: "Real-time revenue, top dishes, peak hours, and customer trends — all on your dashboard." },
    { icon: "🧾", title: "Smart Billing",             desc: "Auto-calculate GST, generate invoices, and share receipts via WhatsApp in one tap." },
    { icon: "🔔", title: "Order Notifications",       desc: "Instant alerts for new orders, kitchen delays, and delivery status — for your whole team." },
  ];

  const STEPS = [
    { step: 1, title: "Register Your Store", desc: "Add your business name, category, location. Your storefront is created instantly." },
    { step: 2, title: "Add Your Menu",        desc: "Type or scan your menu. Add photos, prices, variants. Go live in 1 minute." },
    { step: 3, title: "Take Orders",          desc: "Share your store link. Orders flow in, kitchen gets notified, you get paid." },
    { step: 4, title: "Grow Revenue",         desc: "Use analytics, run offers, expand delivery zones — all from FLYP dashboard." },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.d1, color: C.cream, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>

      {/* ── Scroll progress bar ── */}
      <div className="fixed top-0 left-0 h-[2px] z-50 transition-[width] duration-100"
        style={{ width: `${scrollProg}%`, background: `linear-gradient(90deg, ${C.fire}, ${C.amber})` }} />

      {/* ── BG radial glow ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2"
          style={{ width: 900, height: 600, background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,77,0,.2) 0%, transparent 60%)` }} />
      </div>

      {/* ── BG grid ── */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

      {/* ══════════════ HEADER ══════════════ */}
      <ProductHeader
        active="pos"
        shrink={shrinkHeader}
        scTo="/"
        posTo="/pos-landing"
        navLinks={[
          { label: "Features",    href: "#features"    },
          { label: "How it Works", href: "#how-it-works" },
          { label: "Pricing",     href: "#cta"         },
        ]}
        cta={
          <>
            <button onClick={() => navigate("/auth?type=login&product=pos")}
              style={{ padding: "9px 18px", borderRadius: 2, border: "1px solid rgba(255,255,255,.15)", background: "transparent",
                color: C.muted, fontSize: 12, letterSpacing: "1px", cursor: "pointer" }}
              onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.35)"; e.currentTarget.style.color = C.cream; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.15)"; e.currentTarget.style.color = C.muted; }}
            >
              SIGN IN
            </button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "#FF6A00" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/auth?type=register&product=pos")}
              style={{ padding: "9px 22px", borderRadius: 2, background: C.fire, color: "#fff", fontSize: 12, fontWeight: 500, letterSpacing: "2px", border: "none", cursor: "pointer", textTransform: "uppercase" }}
            >
              Get Started Free
            </motion.button>
          </>
        }
      />

      {/* ══════════════ HERO ══════════════ */}
      <section ref={heroRef} className="relative overflow-hidden"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 60 }}>

        <motion.div style={{ y: heroY, opacity: heroOpacity, maxWidth: 1200 }}
          className="relative z-10 flex items-center gap-16 w-full mx-auto px-16"
        >
          {/* ── Left: text ── */}
          <div style={{ flex: 1 }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-2.5 mb-5"
              style={{ fontSize: 11, color: C.fire, letterSpacing: "4px", textTransform: "uppercase" }}
            >
              <span style={{ width: 28, height: 1, background: C.fire, display: "block" }} />
              For Restaurants &amp; Cafes in India
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(70px,8vw,110px)", lineHeight: 0.88, marginBottom: 20 }}
            >
              GET YOUR<br />
              <span style={{ color: C.fire }}>CAFÉ</span><br />
              ONLINE<br />
              <span style={{ color: C.dim }}>IN 5 MIN</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, maxWidth: 480, marginBottom: 32, fontWeight: 300 }}
            >
              The complete operating system for your food business. From{" "}
              <strong style={{ color: C.cream, fontWeight: 400 }}>kitchen display to delivery</strong> — with{" "}
              <strong style={{ color: C.cream, fontWeight: 400 }}>zero commission, always.</strong>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.3 }}
              style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 40 }}
            >
              <motion.button
                whileHover={{ backgroundColor: "#FF6A00", y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/auth?type=register&product=pos")}
                style={{ background: C.fire, color: "#fff", fontSize: 13, fontWeight: 500, letterSpacing: "2px", padding: "14px 32px", borderRadius: 2, border: "none", cursor: "pointer", textTransform: "uppercase" }}
              >
                Start Free Today →
              </motion.button>
              <button
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                style={{ border: "1px solid rgba(255,255,255,.15)", color: C.muted, fontSize: 13, letterSpacing: "1px", padding: "14px 28px", borderRadius: 2, background: "transparent", cursor: "pointer" }}
                onMouseOver={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.35)"; e.currentTarget.style.color = C.cream; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.15)"; e.currentTarget.style.color = C.muted; }}
              >
                See How It Works
              </button>
            </motion.div>

            {/* Hero stats */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ display: "flex", gap: 32 }}
            >
              {[["5min", "Go Live"], ["0%", "Commission"], ["1min", "Add Menu"]].map(([num, lbl]) => (
                <div key={lbl}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: C.fire, lineHeight: 1 }}>{num}</div>
                  <div style={{ fontSize: 10, color: C.dim, letterSpacing: "2px", textTransform: "uppercase" }}>{lbl}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: phone mockup ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            style={{ width: 320, flexShrink: 0 }}
          >
            <PhoneMockup />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.2)", letterSpacing: "3px", textTransform: "uppercase" }}>Scroll</span>
          <div style={{ width: 1, height: 20, background: "linear-gradient(to bottom, rgba(255,255,255,.15), transparent)" }} />
        </motion.div>
      </section>

      {/* ══════════════ HERO DASHBOARD SCREENSHOT ══════════════ */}
      <div style={{ padding: "0 80px 120px", background: C.d1 }}>
        <Reveal delay={0.1}>
          <div className="relative group">
            {/* Animated glow */}
            <motion.div
              className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-32 pointer-events-none"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              style={{ background: `radial-gradient(ellipse, ${C.fire}60 0%, transparent 70%)`, filter: "blur(40px)" }}
            />
            
            {/* Main image container */}
            <motion.div
              whileHover={{ y: -8, scale: 1.01 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)",
                boxShadow: `0 40px 120px rgba(0,0,0,.8), 0 0 0 1px ${C.fire}12` }}
            >
              <img src="/assets/Hero_dashboard.png" alt="FLYP POS Dashboard"
                style={{ width: "100%", height: "auto", display: "block", transition: "transform 0.4s ease" }}
                className="group-hover:scale-105" />
            </motion.div>
            
            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-6 left-8"
              style={{ background: C.d1, border: `2px solid ${C.fire}`, borderRadius: 12, padding: "12px 20px",
                boxShadow: "0 12px 40px rgba(0,0,0,.6)" }}
            >
              <div style={{ fontSize: 10, color: C.fire, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 4 }}>Live Dashboard</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: C.cream }}>Real-Time Updates</div>
            </motion.div>
          </div>
        </Reveal>
      </div>

      {/* ══════════════ COMMISSION LOSS CALCULATOR ══════════════ */}
      <section style={{ background: C.d2, borderTop: `1px solid ${C.d3}`, borderBottom: `1px solid ${C.d3}`, padding: "80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Reveal>
            <SectionLabel>See what you're losing</SectionLabel>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(40px,5vw,56px)", lineHeight: 1, color: C.cream }}>
              COMMISSION<br /><span style={{ color: C.fire }}>LOSS CALCULATOR</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <CommissionCalc />
          </Reveal>
        </div>
      </section>

      {/* ══════════════ FEATURES GRID ══════════════ */}
      <section id="features" style={{ padding: "100px 80px", background: C.d1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <SectionLabel>Everything in one place</SectionLabel>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(44px,5vw,64px)", lineHeight: 1, color: C.cream, marginBottom: 32 }}>
              COMPLETE OPERATION.<br /><span style={{ color: C.fire }}>ZERO COMPLEXITY.</span>
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
            {FEATURES.map((f, i) => <FeatCard key={f.title} {...f} delay={i * 0.06} />)}
          </div>
        </div>
      </section>

      {/* ══════════════ SHOWCASE BLOCKS (text + image slots) ══════════════
          ▼▼▼ Replace each ImgSlot with your actual screenshot ▼▼▼ */}
      <section style={{ background: C.d2, padding: "100px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Block 1: Table Management */}
          <ShowcaseBlock
            tag="Table Management"
            title="EVERY TABLE, EVERY ZONE"
            titleEm="ALL IN ONE VIEW"
            desc="See your entire floor plan at a glance. Main Dining, Outdoor, Walk-in — tap any table to start an order. Real-time occupancy as your team works."
            bullets={[
              "Multi-zone floor plan with live occupancy status",
              "Walk-in orders without table assignment",
              "Table capacity and round tracking",
            ]}
          >
            <motion.div
              className="relative group"
              style={{ paddingBottom: 16 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <img src="/assets/Table.png" alt="FLYP POS — Table Management"
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 16,
                  filter: "drop-shadow(0 32px 64px rgba(0,0,0,0.6))" }} />
              
              <motion.div
                className="absolute"
                style={{ bottom: -4, left: 8 }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="rounded-lg px-4 py-3 backdrop-blur-xl"
                  style={{ background: "rgba(10,7,5,0.95)", border: `1px solid ${C.fire}40`, boxShadow: "0 8px 24px rgba(0,0,0,.6)" }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>Live Status</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.cream }}>
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      style={{ color: C.green }}
                    >●</motion.span> <span style={{ color: C.green }}>3</span> Available
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </ShowcaseBlock>

          {/* Block 2: Smart Billing (reversed) */}
          <ShowcaseBlock
            tag="Smart Billing"
            title="TAP, ADD, SEND"
            titleEm="DONE IN SECONDS"
            desc="The fastest billing experience for your team. Browse the full menu grid, add items with one tap, send to kitchen or checkout instantly. GST auto-calculated."
            bullets={[
              "Full menu grid with category filters",
              "One-tap add to order with quantity control",
              "Auto GST calculation and instant digital receipt",
            ]}
            reverse
          >
            <motion.div
              className="relative group"
              style={{ paddingTop: 16 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Animated gradient border */}
              <motion.div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(135deg, ${C.fire}20, ${C.amber}20)`, filter: "blur(20px)" }}
              />
              
              <img src="/assets/Checkout.png" alt="FLYP POS — Smart Billing"
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 16,
                  filter: "drop-shadow(0 32px 64px rgba(0,0,0,0.6))" }} />
              
              <motion.div
                className="absolute"
                style={{ top: -4, right: 8 }}
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="rounded-lg px-4 py-3 backdrop-blur-xl"
                  style={{ background: "rgba(10,7,5,0.95)", border: `1px solid ${C.fire}40`, boxShadow: "0 8px 24px rgba(0,0,0,.6)" }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>Checkout Total</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.cream }}>
                    ₹<motion.span
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      style={{ color: C.fire }}
                    >708</motion.span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </ShowcaseBlock>

          {/* Block 3: Kitchen Display */}
          <ShowcaseBlock
            tag="Kitchen Display"
            title="ZERO TICKETS,"
            titleEm="ZERO MISSED ORDERS"
            desc="Your kitchen team sees every order the moment it's placed. Status flows from New → Preparing → Ready in real-time with sound alerts and visual highlights."
            bullets={[
              "Instant order routing to the kitchen screen",
              "Status tracking: New, Preparing, Ready",
              "Sound alerts and visual highlights for new tickets",
            ]}
          >
            <motion.div
              className="relative group"
              style={{ paddingBottom: 16 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Pulsing glow */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{ opacity: [0, 0.15, 0] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                style={{ background: `radial-gradient(circle at center, ${C.amber}60, transparent 70%)`, filter: "blur(30px)" }}
              />
              
              <img src="/assets/KDS.png" alt="FLYP POS — Kitchen Display"
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 16,
                  filter: "drop-shadow(0 32px 64px rgba(0,0,0,0.6))" }} />
              
              <motion.div
                className="absolute"
                style={{ bottom: -4, left: 8 }}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="rounded-lg px-4 py-3 backdrop-blur-xl"
                  style={{ background: "rgba(10,7,5,0.95)", border: `1px solid ${C.amber}40`, boxShadow: "0 8px 24px rgba(0,0,0,.6)" }}>
                  <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>Kitchen</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.cream }}>
                    <motion.span
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      style={{ color: C.amber }}
                    >2</motion.span> Active
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </ShowcaseBlock>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section id="how-it-works" style={{ background: C.d2, padding: "80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <Reveal>
            <SectionLabel>Simple as 1-2-3</SectionLabel>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(44px,5vw,64px)", lineHeight: 1, color: C.cream, marginBottom: 0 }}>
              HOW IT WORKS
            </h2>
          </Reveal>
          <div style={{ display: "flex", gap: 0, marginTop: 40, position: "relative" }}>
            {/* Connector line */}
            <div style={{ position: "absolute", top: 28, left: 28, right: 28, height: 1, background: `linear-gradient(90deg, ${C.fire}, ${C.amber}, rgba(255,77,0,.1))`, zIndex: 0 }} />
            {STEPS.map((s, i) => <StepCard key={s.step} {...s} delay={i * 0.1} />)}
          </div>
        </div>
      </section>

      {/* ══════════════ LIVE PREVIEW ══════════════ */}
      <section id="preview" style={{ background: C.d1, padding: "100px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Animated background elements */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          style={{ background: `radial-gradient(circle, ${C.fire}40, transparent)`, filter: "blur(60px)" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.05, 0.1] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
          style={{ background: `radial-gradient(circle, ${C.amber}40, transparent)`, filter: "blur(60px)" }}
        />
        
        <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <Reveal style={{ marginBottom: 48 }}>
            <SectionLabel>See it in action</SectionLabel>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(44px,5vw,64px)", lineHeight: 1, color: C.cream, marginBottom: 8 }}>
              EVERYTHING YOUR TEAM NEEDS<br /><span style={{ color: C.fire }}>ON A SINGLE SCREEN</span>
            </h2>
            <p style={{ fontSize: 15, color: C.muted, maxWidth: 500, margin: "0 auto" }}>
              No training required — intuitive for cashiers, chefs, and managers alike.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <motion.div
              className="group"
              whileHover={{ y: -10 }}
              transition={{ duration: 0.4 }}
              style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,.1)",
                boxShadow: "0 40px 100px rgba(0,0,0,.8)", position: "relative" }}
            >
              {/* Animated overlay */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ opacity: [0.1, 0.2, 0.1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                style={{ background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${C.fire}20 0%, transparent 70%)`, zIndex: 10 }}
              />
              
              <img src="/assets/KDS.png" alt="FLYP POS — Live View"
                style={{ width: "100%", height: "auto", display: "block", transition: "transform 0.4s ease" }}
                className="group-hover:scale-105" />
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════ TESTIMONIAL ══════════════ */}
      <section style={{ background: C.d2, padding: "80px" }}>
        <Reveal>
          <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 20, letterSpacing: "2px", marginBottom: 20 }}>⭐⭐⭐⭐⭐</div>
            <blockquote style={{ fontSize: "clamp(17px,2.5vw,22px)", color: C.cream, lineHeight: 1.65, fontStyle: "italic", marginBottom: 28, fontWeight: 400 }}>
              <span style={{ color: C.fire, fontSize: 40, lineHeight: 0, verticalAlign: "-14px", marginRight: 6 }}>"</span>
              We switched from a legacy POS to FLYP in one evening. The kitchen display alone saved us 20 minutes per shift — orders stopped getting missed.
            </blockquote>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${C.fire}, ${C.amber})`,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff" }}>
                R
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.cream }}>Rahul Sharma</div>
                <div style={{ fontSize: 12, color: C.muted }}>Owner, Café Roots · Mumbai</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══════════════ CTA FOOTER ══════════════ */}
      <section id="cta" className="relative overflow-hidden text-center"
        style={{ background: `linear-gradient(135deg, ${C.fire} 0%, #FF8C00 60%, ${C.amber} 100%)`, padding: "80px" }}>
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <Reveal className="relative z-10">
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(56px,7vw,80px)", lineHeight: 0.9, color: "#fff", marginBottom: 16 }}>
            START TODAY.<br />IT'S FREE.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.75)", marginBottom: 32, fontWeight: 300 }}>
            No setup fee. No contracts. No commission. Ever.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 28 }}>
            <motion.button
              whileHover={{ backgroundColor: C.cream }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/auth?type=register&product=pos")}
              style={{ background: "#fff", color: C.fire, fontSize: 13, fontWeight: 600, letterSpacing: "2px", padding: "14px 36px", borderRadius: 2, border: "none", cursor: "pointer", textTransform: "uppercase" }}
            >
              Create Free Account
            </motion.button>
            <button
              onClick={() => navigate("/")}
              style={{ border: "2px solid rgba(255,255,255,.5)", color: "#fff", fontSize: 13, letterSpacing: "2px", padding: "14px 32px", borderRadius: 2, background: "transparent", cursor: "pointer", textTransform: "uppercase" }}
              onMouseOver={e => e.currentTarget.style.borderColor = "#fff"}
              onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,.5)"}
            >
              See Supply Chain ↗
            </button>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: "2px", textTransform: "uppercase" }}>
            Free Setup · India's Smartest POS · Trusted by Retailers Nationwide
          </div>
        </Reveal>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ background: C.d2, borderTop: `1px solid ${C.d3}`, padding: "32px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/assets/flyp_logo.png" alt="FLYP" className="h-6 w-6 object-contain"
            onError={e => { e.target.style.display = "none"; }} />
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "3px", color: C.cream }}>
            <span style={{ color: C.fire }}>F</span>LYP POS
          </span>
        </div>
        <ProductSwitcher active="pos" />
        <div style={{ fontSize: 12, color: C.muted }}>
          © {new Date().getFullYear()} FLYP Technologies. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
