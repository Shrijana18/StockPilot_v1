import React, { useEffect, useRef, useState } from 'react';

// Local count-up for premium feel
const useCountUp = (value, duration = 800) => {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef();
  useEffect(() => {
    const start = performance.now();
    const from = 0; // start from 0 for a satisfying ramp
    const to = Number(value || 0);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);
  return display;
};

// Reveal-on-scroll (once)
const useInViewOnce = (threshold = 0.15) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shown, threshold]);
  return [ref, shown];
};

const KpiStyles = () => (
  <style>{`
    @keyframes slideUpFade { 
      from { opacity:0; transform: translateY(10px) scale(.98); filter: blur(2px); } 
      to   { opacity:1; transform: translateY(0) scale(1);   filter: blur(0); } 
    }
    @keyframes floaty { 0%{ transform: translateY(0)} 50%{ transform: translateY(-2px)} 100%{ transform: translateY(0)} }
    .animate-in-up { animation: slideUpFade .6s cubic-bezier(.22,.61,.36,1) both; }
    .pre-animate { opacity:0; transform: translateY(10px) scale(.98); filter: blur(2px); }
    @media (prefers-reduced-motion: reduce) {
      .animate-in-up { animation: none !important; }
      .pre-animate { opacity:1 !important; transform:none !important; filter:none !important; }
    }

    /* Polished KPI card */
    .kpi-card{
      position:relative;
      border-radius:14px;
      background: rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 40px rgba(0,0,0,.35);
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
      will-change: transform;
      overflow:hidden;
      text-align:left;
      align-items:flex-start;
      justify-content:space-between;
    }
    .kpi-card::before{
      content:"";
      position:absolute; inset:0;
      border-radius: inherit;
      padding:1px; /* gradient border thickness */
      background: linear-gradient(135deg, rgba(59,245,152,.35), rgba(0,204,255,.25));
      -webkit-mask:
        linear-gradient(#000 0 0) content-box, 
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
              mask-composite: exclude;
      opacity:.0;
      transition:opacity .2s ease;
      pointer-events:none;
    }
    .kpi-card:hover{
      transform: translateY(-2px);
      box-shadow: 0 0 20px rgba(0,255,255,.25), 0 8px 40px rgba(0,0,0,.35);
      background: rgba(255,255,255,.10);
      border-color: rgba(255,255,255,.18);
    }
    .kpi-card:hover::before{ opacity:1; }

    .kpi-icon{
      width:40px; height:40px; border-radius:12px;
      display:grid; place-items:center;
      font-size:22px;
      background:
        radial-gradient(120% 120% at 0% 0%, rgba(29,185,84,.22), transparent 70%),
        radial-gradient(120% 120% at 100% 0%, rgba(0,255,255,.22), transparent 70%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.15);
      animation: floaty 3s ease-in-out infinite;
    }

    .kpi-menu{ position:absolute; top:10px; right:10px; }
    .kpi-dotbtn{
      padding:2px 6px; border-radius:8px;
      color: rgba(255,255,255,.7);
      transition: background .15s ease, color .15s ease;
    }
    .kpi-dotbtn:hover{ background: rgba(255,255,255,.12); color: #fff; }
    .kpi-pop{
      position:absolute; top:36px; right:10px; z-index:10;
      width:180px; padding:6px;
      border-radius:12px;
      background: rgba(10,12,14,.9);
      border:1px solid rgba(255,255,255,.1);
      box-shadow: 0 12px 36px rgba(0,0,0,.45);
      backdrop-filter: blur(8px);
    }
    .kpi-pop button{
      width:100%; text-align:left;
      padding:8px 10px; border-radius:8px;
      color:#fff; font-size:13px;
    }
    .kpi-pop button:hover{ background: rgba(255,255,255,.08); }
  `}</style>
);

// --- Mini Sparkline (UI-only; no logic changes to KPIs) ---
const Sparkline = ({ data = [] }) => {
  if (!data || data.length < 2) return null;
  const w = 140, h = 40, pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) * (h - pad * 2)) / range;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block w-[140px] h-10">
      <defs>
        <linearGradient id="kpi-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(59,245,152,1)" />
          <stop offset="100%" stopColor="rgba(0,204,255,1)" />
        </linearGradient>
        <linearGradient id="kpi-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,245,152,0.24)" />
          <stop offset="100%" stopColor="rgba(0,204,255,0)" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="url(#kpi-stroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`${points} ${w-pad},${h-pad} ${pad},${h-pad}`} fill="url(#kpi-fill)" opacity="0.6" />
      {/* end dot */}
      <circle r="2.2" fill="#fff">
        <animate attributeName="cx" dur="0.0s" to={points.split(' ').slice(-1)[0].split(',')[0]} fill="freeze" />
        <animate attributeName="cy" dur="0.0s" to={points.split(' ').slice(-1)[0].split(',')[1]} fill="freeze" />
      </circle>
    </svg>
  );
};

// --- Build a small 14d series purely for the mini trend (read-only) ---
const buildTrendSeries = (invoices, days = 14) => {
  const start = new Date(); start.setHours(0,0,0,0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0,10);
    return { key, total: 0, count: 0, byMode: { cash:0, card:0, upi:0, unknown:0 } };
  });

  const dateKey = (ts) => {
    const d = ts instanceof Date ? ts : new Date(ts?.seconds ? ts.seconds*1000 : ts);
    if (isNaN(d)) return null;
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  };

  invoices.forEach((inv) => {
    const key = dateKey(inv?.issueDate || inv?.createdAt || inv?.timestamp);
    if (!key) return;
    const b = buckets.find(x => x.key === key);
    if (!b) return;

    // Follow same rule as cards: exclude unpaid credit from revenue/series
    const mode = (inv?.paymentMode || '').toLowerCase();
    const amt = Number(inv?.totalAmount ?? inv?.total ?? 0);

    b.count += 1;

    if (mode === 'credit' && inv?.isPaid !== true) {
      // count increases, but revenue trend excludes unpaid credit
      return;
    }
    if (mode === 'split') {
      const s = inv?.splitPayment || {};
      b.byMode.cash += parseFloat(s.cash || 0);
      b.byMode.card += parseFloat(s.card || 0);
      b.byMode.upi  += parseFloat(s.upi  || 0);
      b.total += (parseFloat(s.cash||0)+parseFloat(s.card||0)+parseFloat(s.upi||0));
    } else if (mode === 'cash' || mode === 'card' || mode === 'upi') {
      b.byMode[mode] += amt; b.total += amt;
    } else if (mode === 'credit' && inv?.isPaid === true) {
      const via = (inv?.paidVia || '').toLowerCase();
      if (via === 'cash' || via === 'card' || via === 'upi') { b.byMode[via] += amt; } else { b.byMode.unknown += amt; }
      b.total += amt;
    } else {
      b.byMode.unknown += 0;
    }
  });

  return buckets;
};

const KpiActions = ({ kpi, display }) => {
  const [open, setOpen] = useState(false);

  const copyValue = async () => {
    try { await navigator.clipboard.writeText(`${kpi.label}: ${display}`); } catch {}
    setOpen(false);
  };

  const exportCsv = () => {
    const rows = [
      ['Label','Value','Formatted'],
      [kpi.label, typeof kpi.value === 'number' ? kpi.value : '', kpi.formatted || display]
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(kpi.label||'kpi').replace(/\s+/g,'_').toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const downloadPng = () => {
    const W=560,H=300;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#0b1720'); g.addColorStop(1,'#132b33');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,.8)';
    ctx.font='600 18px Inter, system-ui, -apple-system, Segoe UI, Roboto';
    ctx.fillText(kpi.label, 24, 40);
    ctx.fillStyle='#fff';
    ctx.font='800 44px Inter, system-ui, -apple-system, Segoe UI, Roboto';
    ctx.fillText(display, 24, 100);
    const link=document.createElement('a'); link.href=c.toDataURL('image/png'); link.download=`${(kpi.label||'kpi').replace(/\s+/g,'_').toLowerCase()}.png`; link.click();
    setOpen(false);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: kpi.label, text: `${kpi.label}: ${display}` }); } catch {}
      setOpen(false);
    }
  };

  return (
    <div className="kpi-menu">
      <button className="kpi-dotbtn" aria-label="More actions" onClick={(e)=>{ e.stopPropagation(); setOpen(v=>!v); }}>⋮</button>
      {open && (
        <div className="kpi-pop" onMouseLeave={()=>setOpen(false)}>
          <button onClick={copyValue}>Copy value</button>
          <button onClick={exportCsv}>Export CSV</button>
          <button onClick={downloadPng}>Download PNG</button>
          {typeof navigator !== 'undefined' && navigator.share && (<button onClick={shareNative}>Share…</button>)}
        </div>
      )}
    </div>
  );
};

const KpiTile = ({ kpi, index }) => {
  const animated = useCountUp(kpi.value);
  const isCurrency = (kpi.key === 'aov' || kpi.key === 'rev' || (kpi.key || '').startsWith('pay-'));
  const display = typeof kpi.value === 'number'
    ? (isCurrency ? `₹${Math.round(animated).toLocaleString('en-IN')}` : Math.round(animated).toLocaleString('en-IN'))
    : (kpi.formatted || String(kpi.value));

  const [ref, shown] = useInViewOnce(0.12);

  return (
    <div
      ref={ref}
      className={`kpi-card ${shown ? 'animate-in-up' : 'pre-animate'} p-4 flex items-center justify-between gap-4 group`}
      style={{ animationDelay: shown ? `${index * 90}ms` : undefined }}
      title={kpi.formatted || kpi.label}
      role="figure"
      aria-label={`${kpi.label}: ${kpi.formatted || kpi.value}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="kpi-icon" aria-hidden>{kpi.icon}</div>
        <div className="min-w-0">
          <div className="flex flex-col justify-between h-full">
            <div className="text-xs text-white/70 whitespace-pre-line leading-snug">{kpi.label}</div>
            <div className="text-2xl font-extrabold text-white leading-tight">
              {display}
            </div>
            <div className="text-[10px] text-white/50 mt-1 italic tracking-wide">
              {kpi.key === 'rev' && '💹 Strong month-on-month growth'}
              {kpi.key === 'cnt' && '🧾 Steady billing frequency'}
              {kpi.key === 'aov' && '📈 Average order size stable'}
              {kpi.key === 'cust' && '👥 Loyal customer base'}
              {kpi.key?.startsWith('pay-') && '💰 Payment trend healthy'}
            </div>
          </div>
        </div>
      </div>
      {/* right mini trend */}
      {Array.isArray(kpi.trend) && kpi.trend.length > 1 && (
        <div className="hidden md:block ml-auto relative">
          <Sparkline data={kpi.trend} />
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-400/50 via-cyan-400/30 to-transparent animate-pulse" />
        </div>
      )}
      {/* If no trend, still render pulse at bottom of card */}
      {!Array.isArray(kpi.trend) || kpi.trend.length <= 1 ? (
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-400/50 via-cyan-400/30 to-transparent animate-pulse" />
      ) : null}
    </div>
  );
}

const KpiCards = ({ invoiceData = [] }) => {
  // Filter out unpaid credit from revenue calcs
  const filteredInvoices = invoiceData.filter(inv => {
    const mode = inv?.paymentMode?.toLowerCase?.();
    if (mode === 'credit') return inv?.isPaid === true;
    return true;
  });

  const totalRevenueNum = filteredInvoices.reduce((sum, inv) => sum + (Number(inv?.totalAmount ?? inv?.total ?? 0)), 0);
  const totalInvoicesNum = filteredInvoices.length;
  const avgOrderValueNum = totalInvoicesNum > 0 ? (totalRevenueNum / totalInvoicesNum) : 0;

  const paymentStats = invoiceData.reduce((acc, inv) => {
    const mode = (inv?.paymentMode || '').toLowerCase();
    const amount = Number(inv?.totalAmount ?? inv?.total ?? 0);

    // Only include credit if paid
    if (mode === 'credit' && inv?.isPaid !== true) return acc;

    if (mode === 'split') {
      const split = inv?.splitPayment || {};
      acc['cash'] = (acc['cash'] || 0) + (parseFloat(split.cash) || 0);
      acc['card'] = (acc['card'] || 0) + (parseFloat(split.card) || 0);
      acc['upi']  = (acc['upi']  || 0) + (parseFloat(split.upi)  || 0);
    } else if (mode === 'credit') {
      const paidVia = (inv?.paidVia || '').toLowerCase();
      acc[paidVia] = (acc[paidVia] || 0) + amount;
    } else {
      if (['cash','card','upi'].includes(mode)) {
        acc[mode] = (acc[mode] || 0) + amount;
      } else {
        acc['unknown'] = (acc['unknown'] || 0) + amount;
      }
    }
    return acc;
  }, {});

  // Count unique customers (by email or name)
  const uniqueCustomers = new Set(filteredInvoices.map(inv => inv?.customer?.email || inv?.customer?.name || '')).size;

  const kpis = [
    { key: 'rev',  label: 'Total Revenue',  value: totalRevenueNum,   formatted: `₹${Math.round(totalRevenueNum).toLocaleString('en-IN')}`, icon: '💰' },
    { key: 'cnt',  label: 'Total Invoices', value: totalInvoicesNum,  formatted: totalInvoicesNum.toLocaleString('en-IN'), icon: '🧾' },
    { key: 'aov',  label: 'Avg Order Value',value: avgOrderValueNum,  formatted: `₹${Math.round(avgOrderValueNum).toLocaleString('en-IN')}`, icon: '📊' },
    { key: 'cust', label: 'Total Customers',value: uniqueCustomers,   formatted: uniqueCustomers.toLocaleString('en-IN'), icon: '👥' },
  ];

  if (paymentStats && Object.keys(paymentStats).length) {
    const paymentIcons = { cash: '💵', upi: '📱', card: '💳', unknown: '❓' };
    const labelMap = { cash: 'Cash', upi: 'UPI', card: 'Card', unknown: 'Unknown' };

    Object.entries(paymentStats).forEach(([method, amount]) => {
      const val = Number(amount || 0);
      kpis.push({
        key: `pay-${method}`,
        label: `Revenue via ${labelMap[method] || method}`,
        value: val,
        formatted: `₹${Math.round(val).toLocaleString('en-IN')}`,
        icon: paymentIcons[method] || '💳'
      });
    });
  }

  // --- Attach mini trends (UI-only) ---
  const trendBuckets = buildTrendSeries(filteredInvoices, 14);
  const revTrend = trendBuckets.map(b => b.total);
  const cntTrend = trendBuckets.map(b => b.count);
  const aovTrend = trendBuckets.map(b => b.count ? b.total / b.count : 0);

  // map for payments
  const payTrends = {
    cash: trendBuckets.map(b => b.byMode.cash),
    card: trendBuckets.map(b => b.byMode.card),
    upi:  trendBuckets.map(b => b.byMode.upi),
    unknown: trendBuckets.map(b => b.byMode.unknown),
  };

  // attach trends to the corresponding KPI objects
  kpis.forEach(k => {
    if (k.key === 'rev') k.trend = revTrend;
    else if (k.key === 'cnt') k.trend = cntTrend;
    else if (k.key === 'aov') k.trend = aovTrend;
    else if (k.key?.startsWith('pay-')) {
      const m = k.key.split('pay-')[1];
      if (payTrends[m]) k.trend = payTrends[m];
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KpiStyles />
      {kpis.map((kpi, index) => (
        <KpiTile key={kpi.key || index} kpi={kpi} index={index} />
      ))}
    </div>
  );
};

export default KpiCards;