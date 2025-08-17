import React from 'react';

const KpiCards = ({ invoiceData }) => {
  const filteredInvoices = invoiceData.filter(inv => {
    const mode = inv.paymentMode?.toLowerCase();
    if (mode === 'credit') return inv.isPaid === true;
    return true; // include all other payment modes regardless of isPaid
  });
  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.total || 0), 0);
  const totalInvoices = filteredInvoices.length;
  const avgOrderValue = totalInvoices > 0 ? (totalRevenue / totalInvoices).toFixed(2) : 0;

  const paymentStats = invoiceData.reduce((acc, inv) => {
    const mode = (inv.paymentMode || '').toLowerCase();
    const amount = inv.totalAmount || inv.total || 0;

    // Only include credit if paid
    if (mode === 'credit' && inv.isPaid !== true) return acc;

    if (mode === 'split') {
      const split = inv.splitPayment || {};
      acc['cash'] = (acc['cash'] || 0) + (parseFloat(split.cash) || 0);
      acc['card'] = (acc['card'] || 0) + (parseFloat(split.card) || 0);
      acc['upi'] = (acc['upi'] || 0) + (parseFloat(split.upi) || 0);
    } else if (mode === 'credit') {
      const paidVia = (inv.paidVia || '').toLowerCase();
      acc[paidVia] = (acc[paidVia] || 0) + amount;
    } else {
      if (['cash', 'card', 'upi'].includes(mode)) {
        acc[mode] = (acc[mode] || 0) + amount;
      } else {
        acc['unknown'] = (acc['unknown'] || 0) + amount;
      }
    }

    return acc;
  }, {});

  // Count unique customers (by email or name)
  const uniqueCustomers = new Set(filteredInvoices.map(inv => inv.customer?.email || inv.customer?.name || '')).size;

  const kpis = [
    { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: '💰' },
    { label: 'Total Invoices', value: totalInvoices, icon: '🧾' },
    { label: 'Avg Order Value', value: `₹${avgOrderValue}`, icon: '📊' },
    { label: 'Total Customers', value: uniqueCustomers, icon: '👥' },
  ];

  if (paymentStats) {
    const paymentIcons = {
      cash: '💵',
      upi: '📱',
      card: '💳',
      unknown: '❓'
    };

    const labelMap = {
      cash: 'Cash',
      upi: 'UPI',
      card: 'Card',
      unknown: 'Unknown'
    };

    Object.entries(paymentStats).forEach(([method, amount]) => {
      kpis.push({
        label: `Revenue via ${labelMap[method] || method}`,
        value: `₹${parseFloat(amount).toLocaleString()}`,
        icon: paymentIcons[method] || '💳'
      });
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className="rounded-lg p-4 flex items-center space-x-4 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] hover:bg-white/15 transition"
        >
          <div className="text-3xl" title={kpi.label}>{kpi.icon}</div>
          <div>
            <div className="text-sm text-white/70">{kpi.label}</div>
            <div className="text-lg font-bold text-white">{kpi.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;