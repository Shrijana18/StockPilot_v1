import React, { useEffect, useState, useRef } from 'react';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import KpiCards from './KpiCards';
import RecentInvoices from './RecentInvoices';
import LowStockAlertWidget from './LowStockAlertWidget';
import CreditDueList from './CreditDueList';
// Import motion from Framer Motion
import { motion } from 'framer-motion';

// --- Lightweight SplitText + Cursor (no external deps) ---
const SplitText = ({ text = '', className = '', splitBy = 'chars', delay = 0.02, animate }) => {
  const pieces = splitBy === 'words' ? text.split(' ') : Array.from(text);

  const Item = ({ children, i }) => (
    <motion.span
      className={className} // apply gradient + bg-clip to EACH piece
      style={{
        display: 'inline-block',
        willChange: 'transform,opacity',
        WebkitTextStroke: '0.4px rgba(255,255,255,0.22)',
        textShadow: '0 0 12px rgba(0,255,200,0.35)',
      }}
      initial={animate?.from ?? { opacity: 0, y: 26, rotateX: -20 }}
      animate={animate?.to ?? { opacity: 1, y: 0, rotateX: 0 }}
      transition={{
        ...(animate?.transition ?? { ease: [0.16, 1, 0.3, 1], duration: 0.55 }),
        delay: i * delay
      }}
    >
      {children}
    </motion.span>
  );

  return (
    <span aria-label={text}>
      {pieces.map((p, i) => {
        if (splitBy !== 'words' && p === ' ') {
          return <span key={i} style={{ display: 'inline-block', width: '0.5ch' }} />;
        }
        return (
          <Item key={i} i={i}>
            {splitBy === 'words' ? (i < pieces.length - 1 ? p + ' ' : p) : p}
          </Item>
        );
      })}
    </span>
  );
};

const TextCursor = ({ blinkMs = 800 }) => (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: '10px',
      height: '1.1em',
      transform: 'translateY(2px)',
      marginLeft: '2px',
      background: 'linear-gradient(180deg, rgba(0,255,200,.9), rgba(0,200,255,.8))',
      borderRadius: '2px',
      animation: `blink ${blinkMs}ms steps(1,end) infinite`
    }}
  />
);

// --- UI helpers (format + prefs) ---
const inr = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

const getPrefs = () => {
  try { return JSON.parse(localStorage.getItem('hs_prefs') || '{}'); } catch { return {}; }
};
const setPrefs = (obj) => {
  try { localStorage.setItem('hs_prefs', JSON.stringify(obj)); } catch {}
};

// --- ANIMATION VARIANTS ---

// This variant controls the container. It will be invisible at first
// and then orchestrate the animation of its children.
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      // The `staggerChildren` property creates the cinematic sequence effect.
      // Each child will animate in 0.1 seconds after the previous one.
      staggerChildren: 0.1,
    },
  },
};

// This variant controls each individual item.
// They will start slightly lower and invisible, then spring up into place.
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

// --- Local styles for banner + ticker ---
const LocalStyles = () => (
  <style>{`
    .welcome-wrap {
      position: relative;
      border-radius: 16px;
      background: radial-gradient(120% 120% at 0% 0%, rgba(59,245,152,.10), transparent 60%),
                  radial-gradient(120% 120% at 100% 0%, rgba(0,204,255,.10), transparent 60%),
                  rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.14);
      backdrop-filter: blur(10px);
      overflow: hidden;
    }
    .welcome-glow {
      position:absolute; inset:auto -20% -40% -20%;
      height: 120px;
      background: radial-gradient(60% 60% at 50% 0%, rgba(0,255,200,.25), transparent 70%);
      filter: blur(20px); opacity:.5; pointer-events:none;
    }
    .ticker {
      display:flex; gap:.5rem; align-items:center; white-space:nowrap;
      overflow:hidden; mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
    }
    .ticker-track {
      display:flex; gap:.5rem; animation: marquee 28s linear infinite;
    }
    .ticker:hover .ticker-track { animation-play-state: paused; }
    @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
    .chip {
      display:inline-flex; align-items:center; gap:.35rem;
      padding: .35rem .55rem; border-radius:999px; font-size:12px;
      background: rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12);
    }
    .gear-btn {
      padding:4px 8px; border-radius:8px; background:rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.12); color:#fff;
    }
    .btn {
      padding:.45rem .7rem; border-radius:10px; background:rgba(255,255,255,.10);
      border:1px solid rgba(255,255,255,.16); color:#fff;
    }
    @keyframes blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
    /* Aurora parallax behind welcome */
    .welcome-aurora{position:absolute;inset:-32px -24px 0 -24px;pointer-events:none;filter:blur(22px)}
    .welcome-aurora::after{content:"";position:absolute;inset:0;background:
      radial-gradient(32% 40% at calc(var(--mx,.45)*100%) calc(var(--my,.25)*100%),rgba(0,255,200,.18),transparent 60%),
      radial-gradient(30% 36% at calc((1 - var(--mx,.45))*100%) 0%,rgba(0,200,255,.15),transparent 65%);
      opacity:.9}
    /* Horizontal chip scroller with soft edges */
    .chip-scroller{position:relative;display:block;overflow-x:auto;white-space:nowrap;padding-bottom:2px;-ms-overflow-style:none;scrollbar-width:none;mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
    .chip-scroller::-webkit-scrollbar{display:none}
    .chip-scroller .chip{margin-right:.5rem}
    /* Micro divider under section titles */
    .subtle-divider{height:1.5px;background:linear-gradient(90deg,rgba(0,255,200,.28),rgba(0,200,255,.12),transparent);filter:blur(.4px)}
  `}</style>
);

const HomeSnapshot = ({ filterDates, filterType: selectedFilterType }) => {
  const [invoiceData, setInvoiceData] = useState([]);
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState(selectedFilterType || 'All');
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [businessInfo, setBusinessInfo] = useState({ name: '', address: '' });
  const creditsSectionRef = useRef(null);
  const bannerRef = useRef(null);
  const handleBannerMove = (e) => {
    const el = bannerRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', Math.max(0, Math.min(1, x)));
    el.style.setProperty('--my', Math.max(0, Math.min(1, y)));
  };

  const scrollToCredits = () => { if (creditsSectionRef.current) { creditsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };

  const [prefs, setUIPrefs] = useState(() => getPrefs());
  const togglePref = (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setUIPrefs(next);
    setPrefs(next);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        const fetchBusinessInfo = async () => {
          try {
            const docRef = doc(db, 'businesses', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setBusinessInfo({
                name: data.businessName || 'Your Business',
                address: data.businessAddress || ''
              });
            }
          } catch (err) {
            console.error('Error fetching business info:', err);
          }
        };
        fetchBusinessInfo();

        const q = collection(db, 'businesses', user.uid, 'finalizedInvoices');

        const unsubscribeSnapshot = onSnapshot(
          q,
          (querySnapshot) => {
            const data = [];
            querySnapshot.forEach((doc) => {
              data.push({ ...doc.data(), id: doc.id });
            });
            setInvoiceData(data);
            setFilteredInvoices(applyDateFilter(data, selectedFilterType || 'All', filterDates));
          },
          (error) => {
            console.error('Error in snapshot listener:', error);
          }
        );

        return () => unsubscribeSnapshot();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const applyDateFilter = (data, type, dateRange = {}) => {
    const now = new Date();
    const { start, end } = dateRange;

    return data.filter(inv => {
      const date = inv.issuedAt
        ? typeof inv.issuedAt.toDate === 'function'
          ? inv.issuedAt.toDate()
          : new Date(inv.issuedAt)
        : null;

      if (!date) return false;

      if (start && end) {
        return date >= start && date <= end;
      }

      if (type === 'Today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return date >= startOfDay && date <= endOfDay;
      } else if (type === 'ThisWeek') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return date >= startOfWeek && date <= endOfWeek;
      } else if (type === 'ThisMonth') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return date >= startOfMonth && date <= endOfMonth;
      } else if (type === 'ThisYear') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return date >= startOfYear && date <= endOfYear;
      }

      return true;
    });
  };

  useEffect(() => {
    setFilteredInvoices(applyDateFilter(invoiceData, filterType, filterDates));
  }, [filterType, filterDates, invoiceData]);

  useEffect(() => {
    setFilterType(selectedFilterType || 'All');
  }, [selectedFilterType]);

  const totalRevenue = filteredInvoices.reduce((acc, inv) => {
    const total = parseFloat(inv.totalAmount || inv.total || 0);
    if (!inv.isPaid) return acc;
    return acc + total;
  }, 0);

  const paymentStats = filteredInvoices.reduce((acc, inv) => {
    if (!inv.isPaid) return acc;
    const total = parseFloat(inv.totalAmount || inv.total || 0);
    const mode = (inv.paymentMode || '').toLowerCase();

    if (mode === 'split') {
      const split = inv.splitPayment || {};
      const cash = parseFloat(split.cash || 0);
      const card = parseFloat(split.card || 0);
      const upi = parseFloat(split.upi || 0);

      acc['Cash'] = (acc['Cash'] || 0) + cash;
      acc['Card'] = (acc['Card'] || 0) + card;
      acc['UPI'] = (acc['UPI'] || 0) + upi;
    } else if (mode === 'credit') {
      const paidVia = (inv.paidVia || '').toLowerCase();
      if (paidVia === 'cash') acc['Cash'] = (acc['Cash'] || 0) + total;
      else if (paidVia === 'card') acc['Card'] = (acc['Card'] || 0) + total;
      else if (paidVia === 'upi') acc['UPI'] = (acc['UPI'] || 0) + total;
      else acc['Other'] = (acc['Other'] || 0) + total;
    } else {
      const label = mode === 'cash' ? 'Cash' : mode === 'card' ? 'Card' : mode === 'upi' ? 'UPI' : 'Other';
      acc[label] = (acc[label] || 0) + total;
    }

    return acc;
  }, {});

  const creditInvoices = filteredInvoices.filter(
    inv =>
      inv.paymentMode?.toLowerCase() === 'credit' &&
      inv.isPaid === false &&
      (inv.settings?.creditDueDate || inv.creditDueDate)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dueTodayInvoices = creditInvoices.filter(inv => {
    const dueDateStr = inv.settings?.creditDueDate || inv.creditDueDate;
    const dueDate = new Date(`${dueDateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  });
  const dueTodayAmount = dueTodayInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0), 0);

  const dueTomorrowInvoices = creditInvoices.filter(inv => {
    const dueDateStr = inv.settings?.creditDueDate || inv.creditDueDate;
    const dueDate = new Date(`${dueDateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === tomorrow.getTime();
  });
  const dueTomorrowAmount = dueTomorrowInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0), 0);
  
  const totalDueAmount = creditInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0), 0);

  // --- Highlights (read-only; branding)
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' });
  const topMode = Object.entries(paymentStats || {}).sort((a,b) => (b[1]||0)-(a[1]||0))[0]?.[0] || '—';

  const highlights = [
    { icon: '💰', text: `Revenue: ${inr(totalRevenue)}` },
    { icon: '🧾', text: `Invoices: ${filteredInvoices.length}` },
    { icon: '💳', text: `Top Mode: ${topMode}` },
    { icon: '⏰', text: `Due Today: ${inr(dueTodayAmount)}` },
    { icon: '📌', text: `Total Credit Due: ${inr(totalDueAmount)}` },
  ];

  const shareSnapshot = () => {
    const W=880,H=480;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#0b1720'); g.addColorStop(1,'#132b33');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(255,255,255,.85)';
    ctx.font='700 28px Inter, system-ui'; ctx.fillText(`Snapshot — ${businessInfo.name || 'Your Business'}`, 32, 52);
    ctx.font='500 16px Inter, system-ui'; ctx.fillText(dateStr, 32, 78);

    ctx.font='600 20px Inter, system-ui'; ctx.fillText('KPIs', 32, 118);
    const lines = [
      `Revenue: ${inr(totalRevenue)}`,
      `Invoices: ${filteredInvoices.length}`,
      `Top Mode: ${topMode}`,
      `Due Today: ${inr(dueTodayAmount)}`,
      `Total Credit Due: ${inr(totalDueAmount)}`
    ];
    ctx.font='500 18px Inter, system-ui';
    lines.forEach((t,i)=> ctx.fillText(t, 32, 150 + i*28));

    const a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download=`snapshot_${Date.now()}.png`; a.click();
  };

  // We replace the main `div` with `motion.div` and apply our variants.
  return (
    <motion.div
      className="px-4 md:px-6 py-2 space-y-6 text-white max-w-[1400px] mx-auto w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <LocalStyles />
      <motion.div
        variants={itemVariants}
        className="relative pt-2 md:pt-3 pb-3 md:pb-4"
        ref={bannerRef}
        onMouseMove={handleBannerMove}
      >
        <div className="welcome-aurora" />
        <div className="flex items-center justify-between gap-3 relative">
          <div className="min-w-0">
            <div className="text-sm text-white/70">{dateStr}</div>
            <SplitText
              text={`Welcome back, ${businessInfo.name || 'Retailer'} ✦`}
              className="text-2xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300"
              splitBy="chars"
              delay={0.018}
              animate={{
                from: { opacity: 0, y: 26, rotateX: -20 },
                to:   { opacity: 1, y: 0,  rotateX: 0 },
                transition: { ease: [0.16, 1, 0.3, 1], duration: 0.55 }
              }}
            />
            <div className="text-white/70 text-sm mt-1">
              Quick look: {inr(totalRevenue)} today · {filteredInvoices.length} invoices · {inr(totalDueAmount)} credit due
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="btn" onClick={shareSnapshot}>Share snapshot</button>
            <button className="gear-btn" onClick={()=>togglePref('showTips')} title="Customize">⚙︎</button>
          </div>
        </div>
        {/* Highlights – smooth horizontal scroll with masked edges */}
        <div className="mt-3 chip-scroller">
          {highlights.map((h, i) => (
            <span key={i} className="chip"><span>{h.icon}</span>{h.text}</span>
          ))}
        </div>
        {/* Simple tips panel toggled by prefs */}
        {prefs.showTips && (
          <div className="mt-3 text-xs text-white/70 flex flex-wrap gap-2">
            <span className="chip">Tip: Click “Credit Dues” header to jump to reminders</span>
            <span className="chip">Tip: Filter by date from top bar to change KPIs</span>
          </div>
        )}
      </motion.div>
      {/* Each major element is now an animated item. */}
      <motion.h2
        variants={itemVariants}
        className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200"
      >
        📊 Home Snapshot: Today’s KPIs
      </motion.h2>
      <div className="subtle-divider mb-3" />

      <motion.div variants={itemVariants}>
        <KpiCards
          invoiceData={filteredInvoices}
          totalRevenue={totalRevenue}
          paymentStats={paymentStats}
          dueToday={dueTodayAmount}
          dueTomorrow={dueTomorrowAmount}
          totalDue={totalDueAmount}
          totalDueCount={creditInvoices?.filter(i => i.isPaid === false).length || 0}
        />
      </motion.div>

      <motion.section
        variants={itemVariants}
        className="mt-4 overflow-x-auto"
        ref={creditsSectionRef}
      >
        <div className="relative rounded-2xl min-w-0 w-full">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 pointer-events-none" />
          <div className="relative rounded-[14px] bg-white/10 backdrop-blur-xl border border-white/10 p-4 md:p-5 w-full min-w-0 overflow-visible">
            <CreditDueList
              creditInvoices={creditInvoices}
              dueToday={dueTodayInvoices}
              dueTomorrow={dueTomorrowInvoices}
              totalDue={totalDueAmount}
              businessName={businessInfo.name}
              businessAddress={businessInfo.address}
              layout="horizontal"
            />
          </div>
        </div>
      </motion.section>
      
      <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs text-white/70">
        <button className="gear-btn" onClick={()=>togglePref('showLowStock')}>{prefs.showLowStock !== false ? 'Hide' : 'Show'} Low Stock</button>
        <button className="gear-btn" onClick={()=>togglePref('showRecent')}>{prefs.showRecent !== false ? 'Hide' : 'Show'} Recent Invoices</button>
      </motion.div>

      {/* We wrap the grid itself so both cards can animate in together after the items above them. */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {(prefs.showLowStock !== false) && (
          <div className="relative rounded-2xl h-full">
            <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 pointer-events-none" />
            <div className="relative rounded-[14px] bg-white/10 backdrop-blur-xl border border-white/10 p-4 h-full">
              <LowStockAlertWidget userId={userId} />
            </div>
          </div>
        )}

        {(prefs.showRecent !== false) && (
          <div className="relative rounded-2xl h-full">
            <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 pointer-events-none" />
            <div className="relative rounded-[14px] bg-white/10 backdrop-blur-xl border border-white/10 p-4 h-full">
              <RecentInvoices invoiceData={[...filteredInvoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))} />
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default HomeSnapshot;