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
import { format, isToday, isThisWeek, isThisMonth, isThisYear, isWithinInterval, subMonths } from 'date-fns';
import { useAnalyticsFilter } from "../../../context/AnalyticsFilterContext";

const RevenueOverview = () => {
  const [allInvoices, setAllInvoices] = useState([]);
  const { selectedProduct, selectedDate, setSelectedDate, setSelectedProduct } = useAnalyticsFilter();
  const [highlightedDate, setHighlightedDate] = useState(null);
  const [selectedRange, setSelectedRange] = useState('all');
  const [animationIndex, setAnimationIndex] = useState(null);
  const [animatedData, setAnimatedData] = useState([]);

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

  useEffect(() => {
    setAnimationIndex(null);
    setAnimatedData([]);
  }, [selectedProduct, selectedDate]);

  const filteredInvoices = allInvoices.filter(inv => {
    let issuedAt;
    if (inv.issuedAt?.toDate) issuedAt = inv.issuedAt.toDate();
    else if (typeof inv.issuedAt === 'string') issuedAt = new Date(inv.issuedAt);

    let dateMatch = true;
    if (selectedDate) {
      dateMatch = issuedAt && !isNaN(issuedAt) && format(issuedAt, 'yyyy-MM-dd') === selectedDate;
    }

    if (selectedRange === "today") {
      dateMatch = isToday(issuedAt);
    } else if (selectedRange === "week") {
      dateMatch = isThisWeek(issuedAt, { weekStartsOn: 1 });
    } else if (selectedRange === "month") {
      dateMatch = isThisMonth(issuedAt);
    } else if (selectedRange === "quarter") {
      const start = subMonths(new Date(), 3);
      dateMatch = isWithinInterval(issuedAt, { start, end: new Date() });
    } else if (selectedRange === "year") {
      dateMatch = isThisYear(issuedAt);
    }

    const productMatch = selectedProduct
      ? Array.isArray(inv.cartItems) && inv.cartItems.some(item => item.sku === selectedProduct)
      : true;

    return dateMatch && productMatch;
  });

  const totalRevenue = filteredInvoices.reduce((sum, inv) => {
    if (inv.paymentMode === "credit" && !inv.isPaid) return sum;
    return sum + parseFloat(inv.totalAmount || 0);
  }, 0);
  const invoiceCount = filteredInvoices.filter(inv =>
    inv.paymentMode !== "credit" || (inv.paymentMode === "credit" && inv.isPaid)
  ).length;

  const paymentModes = { cash: 0, upi: 0, card: 0 };
  const dateMap = {};

  filteredInvoices.forEach(inv => {
    if (inv.paymentMode === "credit" && !inv.isPaid) return;

    const amt = parseFloat(inv.totalAmount || 0);
    const mode = inv.paymentMode?.toLowerCase();

    if (mode === "split") {
      const split = inv.splitPayment || {};
      paymentModes.cash += parseFloat(split.cash || 0);
      paymentModes.upi += parseFloat(split.upi || 0);
      paymentModes.card += parseFloat(split.card || 0);
    } else if (mode === "credit" && inv.isPaid) {
      const via = inv.paidVia?.toLowerCase();
      if (via === "cash") paymentModes.cash += amt;
      else if (via === "upi") paymentModes.upi += amt;
      else if (via === "card") paymentModes.card += amt;
    } else if (["cash", "upi", "card"].includes(mode)) {
      paymentModes[mode] += amt;
    }

    let issuedAt;
    if (inv.issuedAt?.toDate) {
      issuedAt = inv.issuedAt.toDate();
    } else if (typeof inv.issuedAt === "string") {
      issuedAt = new Date(inv.issuedAt);
    }
    if (!issuedAt || isNaN(issuedAt)) return;

    const dateKey = format(issuedAt, "yyyy-MM-dd");
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = 0;
    }
    dateMap[dateKey] += amt;
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

  useEffect(() => {
    if (animationIndex === null) return;
    if (animationIndex < revenueByDate.length) {
      const timer = setTimeout(() => {
        setAnimatedData(revenueByDate.slice(0, animationIndex + 1));
        setAnimationIndex(prev => prev + 1);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAnimationIndex(null);
    }
  }, [animationIndex, revenueByDate]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = revenueByDate.find(d => d.date === label);
      if (!item) return null;
      const sign = item.changeAmount >= 0 ? '+' : '';
      return (
        <div className="rounded px-3 py-2 text-sm border border-white/10 bg-[#0B0F14]/80 backdrop-blur-xl text-white">
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
    <div className="p-5 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Revenue Overview</h2>
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div>
          <p><strong>Total Revenue:</strong> ₹{totalRevenue.toFixed(2)}</p>
          <p><strong>Total Invoices:</strong> {invoiceCount}</p>
          <p><strong>Today's Revenue:</strong> ₹{revenueByDate[revenueByDate.length - 1]?.revenue.toFixed(2)}</p>
          <p><strong>Yesterday's Revenue:</strong> ₹{revenueByDate[revenueByDate.length - 2]?.revenue.toFixed(2)}</p>
          <p>
            <strong>Growth:</strong>{' '}
            {(() => {
              const today = revenueByDate[revenueByDate.length - 1]?.revenue || 0;
              const yesterday = revenueByDate[revenueByDate.length - 2]?.revenue || 0;
              const diff = today - yesterday;
              const percent = yesterday === 0 ? 100 : ((diff / yesterday) * 100);
              const sign = diff >= 0 ? '+' : '';
              return `${sign}₹${diff.toFixed(2)} (${sign}${percent.toFixed(1)}%)`;
            })()}
          </p>
        </div>

        <div className="md:w-1/2">
          <h3 className="font-medium">Revenue by Payment Mode:</h3>
          <ul className="list-disc list-inside">
            <li>
              Cash: ₹{paymentModes.cash.toFixed(2)} (
              {((paymentModes.cash / totalRevenue) * 100).toFixed(1)}%)
            </li>
            <li>
              UPI: ₹{paymentModes.upi.toFixed(2)} (
              {((paymentModes.upi / totalRevenue) * 100).toFixed(1)}%)
            </li>
            <li>
              Card: ₹{paymentModes.card.toFixed(2)} (
              {((paymentModes.card / totalRevenue) * 100).toFixed(1)}%)
            </li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-4">
        <button
          onClick={() => {
            setAnimatedData([]);
            setAnimationIndex(0);
          }}
          className="px-3 py-1 rounded font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition"
        >
          ▶️ Play Animation
        </button>

        <div className="flex items-center gap-2">
          <label className="font-medium text-white/80">Sort by Time Period:</label>
          <select
            className="px-2 py-1 rounded text-sm bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={selectedRange}
            onChange={(e) => {
              setSelectedRange(e.target.value);
              setAnimationIndex(null);
              setAnimatedData([]);
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={animatedData.length > 0 ? animatedData : revenueByDate}
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
    </div>
  );
};

export default RevenueOverview;
