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

const KpiStyles = () => (
  <style>{`
    @keyframes slideUpFade { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)} }
    .animate-in-up { animation: slideUpFade .5s ease-out both; }
  `}</style>
);

const KpiTile = ({ kpi, index }) => {
  const animated = useCountUp(kpi.value);
  const isCurrency = (kpi.key === 'aov' || kpi.key === 'rev' || (kpi.key || '').startsWith('pay-'));
  const display = typeof kpi.value === 'number'
    ? (isCurrency ? `₹${Math.round(animated).toLocaleString('en-IN')}` : Math.round(animated).toLocaleString('en-IN'))
    : (kpi.formatted || String(kpi.value));

  return (
    <div
      className="rounded-lg p-4 flex items-center space-x-4 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] hover:bg-white/15 transition animate-in-up hover:-translate-y-[2px]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="text-3xl" title={kpi.label}>{kpi.icon}</div>
      <div>
        <div className="text-sm text-white/70">{kpi.label}</div>
        <div className="text-lg font-bold text-white">{display}</div>
      </div>
    </div>
  );
};

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