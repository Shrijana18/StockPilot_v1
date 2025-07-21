import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { useAnalyticsFilter } from "../../../context/AnalyticsFilterContext";

const RevenueOverview = () => {
  const [allInvoices, setAllInvoices] = useState([]);
  const { selectedProduct, selectedDate } = useAnalyticsFilter();
  const [highlightedDate, setHighlightedDate] = useState(null);

  useEffect(() => {
    const fetchRevenueData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);
        const invoices = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.totalAmount) {
            invoices.push(data);
          }
        });

        setAllInvoices(invoices);
      } catch (error) {
        console.error('Error fetching revenue data:', error);
      }
    };

    fetchRevenueData();
  }, []);

  const filteredInvoices = allInvoices.filter(inv => {
    let issuedAt;
    if (inv.issuedAt?.toDate) issuedAt = inv.issuedAt.toDate();
    else if (typeof inv.issuedAt === 'string') issuedAt = new Date(inv.issuedAt);
    const dateMatch = selectedDate
      ? issuedAt && !isNaN(issuedAt) && format(issuedAt, 'yyyy-MM-dd') === selectedDate
      : true;

    const productMatch = selectedProduct
      ? Array.isArray(inv.cartItems) && inv.cartItems.some(item => item.sku === selectedProduct)
      : true;

    return dateMatch && productMatch;
  });

  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const invoiceCount = filteredInvoices.length;

  const paymentModes = { cash: 0, upi: 0, card: 0 };
  const dateMap = {};

  filteredInvoices.forEach(inv => {
    const amount = inv.totalAmount || 0;
    const mode = inv.paymentMode?.toLowerCase();
    if (mode && paymentModes[mode] !== undefined) {
      paymentModes[mode] += amount;
    }

    // Support both Firebase Timestamp and ISO string for issuedAt
    let issuedAt;
    if (inv.issuedAt?.toDate) {
      issuedAt = inv.issuedAt.toDate();
    } else if (typeof inv.issuedAt === 'string') {
      issuedAt = new Date(inv.issuedAt);
    }
    if (!issuedAt || isNaN(issuedAt)) return;

    const dateKey = format(issuedAt, 'yyyy-MM-dd');
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = 0;
    }
    dateMap[dateKey] += amount;
  });

  const revenueByDate = Object.entries(dateMap)
    .map(([date, value]) => ({ date, revenue: value }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Enhance revenueByDate with trend info
  for (let i = 1; i < revenueByDate.length; i++) {
    const prev = revenueByDate[i - 1].revenue;
    const curr = revenueByDate[i].revenue;
    const diff = curr - prev;
    const percent = prev === 0 ? 100 : ((diff / prev) * 100);
    revenueByDate[i].changeAmount = diff;
    revenueByDate[i].changePercent = percent.toFixed(1);
    revenueByDate[i].changeColor = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#9ca3af';
  }

  if (revenueByDate.length === 0) {
    revenueByDate.push({ date: format(new Date(), 'yyyy-MM-dd'), revenue: 0 });
  }

  const filteredForPie = selectedDate
    ? allInvoices.filter(inv => {
        let issuedAt;
        if (inv.issuedAt?.toDate) issuedAt = inv.issuedAt.toDate();
        else if (typeof inv.issuedAt === 'string') issuedAt = new Date(inv.issuedAt);
        if (!issuedAt || isNaN(issuedAt)) return false;
        return format(issuedAt, 'yyyy-MM-dd') === selectedDate;
      })
    : allInvoices;

  const pieModes = { cash: 0, upi: 0, card: 0 };
  filteredForPie.forEach(inv => {
    const amount = inv.totalAmount || 0;
    const mode = inv.paymentMode?.toLowerCase();
    if (mode && pieModes[mode] !== undefined) {
      pieModes[mode] += amount;
    }
  });

  const totalByMode = Object.values(pieModes).reduce((sum, v) => sum + v, 0);
  const pieData = Object.entries(pieModes).map(([mode, val]) => ({
    name: mode.charAt(0).toUpperCase() + mode.slice(1),
    value: val,
    percent: totalByMode > 0 ? ((val / totalByMode) * 100).toFixed(1) : 0,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = revenueByDate.find(d => d.date === label);
      if (!item) return null;
      const sign = item.changeAmount >= 0 ? '+' : '';
      return (
        <div className="bg-white shadow rounded px-3 py-2 border text-sm">
          <p className="font-semibold">{label}</p>
          <p>Revenue: ₹{item.revenue.toFixed(2)}</p>
          {item.changeAmount !== undefined && (
            <p style={{ color: item.changeColor }}>
              Growth: {`${sign}₹${item.changeAmount}`} ({`${sign}${item.changePercent}%`})
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Revenue Overview</h2>
      <p><strong>Total Revenue:</strong> ₹{totalRevenue.toFixed(2)}</p>
      <p><strong>Total Invoices:</strong> {invoiceCount}</p>
      <div className="mt-3 mb-6">
        <h3 className="font-medium">Revenue by Payment Mode:</h3>
        <ul className="list-disc list-inside">
          <li>Cash: ₹{paymentModes.cash.toFixed(2)}</li>
          <li>UPI: ₹{paymentModes.upi.toFixed(2)}</li>
          <li>Card: ₹{paymentModes.card.toFixed(2)}</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div style={{ overflowX: 'auto' }}>
          <div style={{ width: `${Math.max(700, revenueByDate.length * 80)}px`, height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={revenueByDate}
                onClick={({ activeLabel }) => {
                  if (activeLabel) {
                    setSelectedDate(activeLabel);
                    setHighlightedDate(activeLabel);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Revenue', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  label={({ index, x, y }) => {
                    const item = revenueByDate[index];
                    if (!item || item.date !== highlightedDate) return null;
                    const sign = item.changeAmount >= 0 ? '+' : '';
                    return (
                      <text
                        x={x}
                        y={y - 10}
                        fill={item.changeColor}
                        fontSize={12}
                        textAnchor="middle"
                      >
                        {`${sign}₹${item.changeAmount} (${sign}${item.changePercent}%)`}
                      </text>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg shadow h-full">
          <h3 className="font-semibold text-center mb-2">Revenue by Payment Mode</h3>
          <p className="text-center text-sm mb-2">
            Total Revenue: ₹{totalRevenue.toFixed(2)}
          </p>
          {selectedDate && (
            <div className="text-center mb-2">
              <button
                onClick={() => setSelectedDate(null)}
                className="text-blue-600 text-sm underline"
              >
                Reset to All Time View
              </button>
            </div>
          )}
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value, percent }) => `${name}: ₹${value} (${percent}%)`}
                labelLine={false}
                isAnimationActive={true}
              >
                <Cell fill="#fbbf24" />
                <Cell fill="#34d399" />
                <Cell fill="#818cf8" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default RevenueOverview;
