import React from 'react';

const KpiCards = ({ invoiceData }) => {
  const totalInvoices = invoiceData.length;
  const totalRevenue = invoiceData.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const avgOrderValue = totalInvoices > 0 ? (totalRevenue / totalInvoices).toFixed(2) : 0;

  const paymentStats = invoiceData.reduce((acc, inv) => {
    const method = inv.paymentMode || 'Unknown';
    const amount = inv.total || 0;
    acc[method] = (acc[method] || 0) + amount;
    return acc;
  }, {});

  // Count unique customers (by email or name)
  const uniqueCustomers = new Set(invoiceData.map(inv => inv.customer?.email || inv.customer?.name || '')).size;

  const kpis = [
    { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: '💰' },
    { label: 'Total Invoices', value: totalInvoices, icon: '🧾' },
    { label: 'Avg Order Value', value: `₹${avgOrderValue}`, icon: '📊' },
    { label: 'Total Customers', value: uniqueCustomers, icon: '👥' },
  ];

  if (paymentStats) {
    const paymentIcons = {
      Cash: '💵',
      UPI: '📱',
      Card: '💳',
      Unknown: '❓'
    };

    Object.entries(paymentStats).forEach(([method, amount]) => {
      kpis.push({
        label: `Revenue via ${method}`,
        value: `₹${parseFloat(amount).toLocaleString()}`,
        icon: paymentIcons[method] || '💳'
      });
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <div key={index} className="bg-white rounded shadow p-4 flex items-center space-x-4 border">
          <div className="text-3xl">{kpi.icon}</div>
          <div>
            <div className="text-sm text-gray-500">{kpi.label}</div>
            <div className="text-lg font-bold">{kpi.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KpiCards;