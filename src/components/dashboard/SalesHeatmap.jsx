import React, { useMemo } from 'react';
import moment from 'moment';
import { Bar } from 'react-chartjs-2';

const SalesHeatmap = ({ invoiceData }) => {
  const dateCounts = useMemo(() => {
    const counts = {};
    invoiceData.forEach((inv) => {
      const date = moment(inv.timestamp?.seconds * 1000).format('YYYY-MM-DD');
      counts[date] = (counts[date] || 0) + 1;
    });
    return counts;
  }, [invoiceData]);

  const productCounts = useMemo(() => {
    const counts = {};
    invoiceData.forEach((inv) => {
      inv.cart?.forEach((item) => {
        const name = item.name || 'Unnamed';
        counts[name] = (counts[name] || 0) + item.quantity;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [invoiceData]);

  const dayCounts = useMemo(() => {
    const counts = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    invoiceData.forEach((inv) => {
      const date = moment(inv.timestamp?.seconds * 1000);
      const day = date.format('ddd');
      counts[day] = (counts[day] || 0) + 1;
    });
    return counts;
  }, [invoiceData]);

  const today = moment();
  const past30Days = Array.from({ length: 30 }, (_, i) =>
    today.clone().subtract(i, 'days').format('YYYY-MM-DD')
  ).reverse();

  const getColor = (count) => {
    if (!count) return 'bg-gray-100';
    if (count < 3) return 'bg-green-200';
    if (count < 6) return 'bg-yellow-300';
    return 'bg-red-400';
  };

  return (
    <div className="bg-white rounded shadow p-4 border">
      <h3 className="text-md font-semibold mb-2">📅 Sales Activity (Last 30 Days)</h3>
      <div className="grid grid-cols-10 gap-1 text-xs">
        {past30Days.map((date) => (
          <div
            key={date}
            className={`h-10 flex items-center justify-center rounded text-gray-700 ${getColor(dateCounts[date])}`}
            title={`${dateCounts[date] || 0} invoices on ${date}`}
          >
            {moment(date).format('D')}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-md font-semibold mb-2">🔥 Top 5 Selling Products</h3>
        <ul className="text-sm pl-4 list-decimal text-gray-700">
          {productCounts.map(([product, qty]) => (
            <li key={product}>{product} — {qty} units</li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-md font-semibold mb-2">📊 Sales by Day of Week</h3>
        <Bar
          data={{
            labels: Object.keys(dayCounts),
            datasets: [
              {
                label: 'Invoices',
                data: Object.values(dayCounts),
                backgroundColor: 'rgba(59,130,246,0.6)',
              },
            ],
          }}
          options={{
            responsive: true,
            scales: {
              y: { beginAtZero: true },
            },
          }}
        />
      </div>
    </div>
  );
};

export default SalesHeatmap;