import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import dayjs from "dayjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const RevenueProfitAnalytics = ({ distributorId, dateRange, filters, onDateRangeChange }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });

  // Sync local state with props
  useEffect(() => {
    if (dateRange) setLocalDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (!distributorId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const ordersRef = collection(db, `businesses/${distributorId}/orderRequests`);
        const ordersSnap = await getDocs(ordersRef);
        const ordersData = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);
      } catch (err) {
        console.error("[RevenueProfitAnalytics] Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [distributorId]);

  // Helper function to calculate order total
  const calculateOrderTotal = (order) => {
    if (order?.chargesSnapshot?.breakdown?.grandTotal) {
      return Number(order.chargesSnapshot.breakdown.grandTotal);
    }
    if (order?.items) {
      return order.items.reduce((sum, item) => {
        const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const qty = Number(item.quantity || item.qty || 0);
        return sum + price * qty;
      }, 0);
    }
    return 0;
  };

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const range = localDateRange || dateRange;
    if (!range || !range.start || !range.end) return orders;
    const start = dayjs(range.start);
    const end = dayjs(range.end);
    return orders.filter((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );
      return orderDate.isAfter(start.subtract(1, "day")) && orderDate.isBefore(end.add(1, "day"));
    });
  }, [orders, localDateRange, dateRange]);

  // Calculate daily revenue and profit
  const dailyMetrics = useMemo(() => {
    const metrics = {};

    filteredOrders.forEach((order) => {
      if (order.status !== "Delivered" && order.statusCode !== "DELIVERED") return;

      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      ).format("YYYY-MM-DD");

      const revenue = order.chargesSnapshot?.breakdown?.grandTotal || calculateOrderTotal(order);
      const profit = revenue * 0.15; // Assuming 15% average profit margin

      if (!metrics[orderDate]) {
        metrics[orderDate] = {
          date: orderDate,
          revenue: 0,
          profit: 0,
          orders: 0,
        };
      }

      metrics[orderDate].revenue += revenue;
      metrics[orderDate].profit += profit;
      metrics[orderDate].orders += 1;
    });

    return Object.values(metrics).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  // Monthly aggregation
  const monthlyMetrics = useMemo(() => {
    const metrics = {};

    dailyMetrics.forEach((daily) => {
      const monthKey = dayjs(daily.date).format("YYYY-MM");
      if (!metrics[monthKey]) {
        metrics[monthKey] = {
          month: monthKey,
          revenue: 0,
          profit: 0,
          orders: 0,
        };
      }
      metrics[monthKey].revenue += daily.revenue;
      metrics[monthKey].profit += daily.profit;
      metrics[monthKey].orders += daily.orders;
    });

    return Object.values(metrics).sort((a, b) => a.month.localeCompare(b.month));
  }, [dailyMetrics]);

  // Revenue trend chart (last 30 days)
  const revenueTrendData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) =>
      dayjs().subtract(29 - i, "day").format("YYYY-MM-DD")
    );

    const dailyMap = {};
    dailyMetrics.forEach((m) => {
      dailyMap[m.date] = m;
    });

    return {
      labels: last30Days.map((d) => dayjs(d).format("MMM DD")),
      datasets: [
        {
          label: "Revenue (₹)",
          data: last30Days.map((d) => dailyMap[d]?.revenue || 0),
          borderColor: "rgb(16, 185, 129)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          yAxisID: "y",
        },
        {
          label: "Profit (₹)",
          data: last30Days.map((d) => dailyMap[d]?.profit || 0),
          borderColor: "rgb(139, 92, 246)",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          tension: 0.4,
          yAxisID: "y",
        },
      ],
    };
  }, [dailyMetrics]);

  // Monthly comparison chart
  const monthlyComparisonData = useMemo(() => {
    const last6Months = monthlyMetrics.slice(-6);
    return {
      labels: last6Months.map((m) => dayjs(m.month).format("MMM YYYY")),
      datasets: [
        {
          label: "Revenue (₹)",
          data: last6Months.map((m) => m.revenue),
          backgroundColor: "rgba(16, 185, 129, 0.8)",
        },
        {
          label: "Profit (₹)",
          data: last6Months.map((m) => m.profit),
          backgroundColor: "rgba(139, 92, 246, 0.8)",
        },
      ],
    };
  }, [monthlyMetrics]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalRevenue = dailyMetrics.reduce((sum, m) => sum + m.revenue, 0);
    const totalProfit = dailyMetrics.reduce((sum, m) => sum + m.profit, 0);
    const totalOrders = dailyMetrics.reduce((sum, m) => sum + m.orders, 0);
    const avgDailyRevenue = dailyMetrics.length > 0 ? totalRevenue / dailyMetrics.length : 0;
    const avgDailyProfit = dailyMetrics.length > 0 ? totalProfit / dailyMetrics.length : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Calculate growth (comparing last 7 days vs previous 7 days)
    const last7Days = dailyMetrics.slice(-7);
    const prev7Days = dailyMetrics.slice(-14, -7);
    const last7Revenue = last7Days.reduce((sum, m) => sum + m.revenue, 0);
    const prev7Revenue = prev7Days.reduce((sum, m) => sum + m.revenue, 0);
    const revenueGrowth = prev7Revenue > 0 ? ((last7Revenue - prev7Revenue) / prev7Revenue) * 100 : 0;

    return {
      totalRevenue,
      totalProfit,
      totalOrders,
      avgDailyRevenue,
      avgDailyProfit,
      profitMargin,
      revenueGrowth,
    };
  }, [dailyMetrics]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="text-center text-white/60">Loading revenue & profit analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            Revenue & Profit Analytics
          </h2>
          <p className="text-white/60 text-sm mt-1">Track revenue trends, profit margins, and financial performance</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Date Range Start</label>
            <input
              type="date"
              value={localDateRange.start}
              onChange={(e) => {
                const newRange = { ...localDateRange, start: e.target.value };
                setLocalDateRange(newRange);
                if (onDateRangeChange) onDateRangeChange(newRange);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Date Range End</label>
            <input
              type="date"
              value={localDateRange.end}
              onChange={(e) => {
                const newRange = { ...localDateRange, end: e.target.value };
                setLocalDateRange(newRange);
                if (onDateRangeChange) onDateRangeChange(newRange);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Quick Filters</label>
            <select
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                let newRange;
                if (value === "today") {
                  newRange = { start: dayjs().format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") };
                } else if (value === "week") {
                  newRange = { start: dayjs().subtract(7, "day").format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") };
                } else if (value === "month") {
                  newRange = { start: dayjs().subtract(30, "day").format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") };
                } else if (value === "quarter") {
                  newRange = { start: dayjs().subtract(90, "day").format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") };
                } else if (value === "year") {
                  newRange = { start: dayjs().subtract(365, "day").format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") };
                }
                if (newRange) {
                  setLocalDateRange(newRange);
                  if (onDateRangeChange) onDateRangeChange(newRange);
                }
                e.target.value = "";
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Custom Range</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const resetRange = {
                  start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
                  end: dayjs().format("YYYY-MM-DD"),
                };
                setLocalDateRange(resetRange);
                if (onDateRangeChange) onDateRangeChange(resetRange);
              }}
              className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition border border-white/20"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-4 border border-emerald-500/30">
          <p className="text-xs text-white/60 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(summaryMetrics.totalRevenue)}</p>
          <p className="text-xs text-emerald-300 mt-1">
            {summaryMetrics.revenueGrowth >= 0 ? "↑" : "↓"}{" "}
            {Math.abs(summaryMetrics.revenueGrowth).toFixed(1)}% vs last week
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
          <p className="text-xs text-white/60 mb-1">Total Profit</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(summaryMetrics.totalProfit)}</p>
          <p className="text-xs text-purple-300 mt-1">
            {summaryMetrics.profitMargin.toFixed(1)}% profit margin
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
          <p className="text-xs text-white/60 mb-1">Avg Daily Revenue</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(summaryMetrics.avgDailyRevenue)}</p>
          <p className="text-xs text-blue-300 mt-1">Per day average</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl p-4 border border-amber-500/30">
          <p className="text-xs text-white/60 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-white">{summaryMetrics.totalOrders}</p>
          <p className="text-xs text-amber-300 mt-1">
            {dailyMetrics.length > 0
              ? (summaryMetrics.totalOrders / dailyMetrics.length).toFixed(1)
              : 0}{" "}
            orders/day
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue & Profit Trend (Last 30 Days)</h3>
          <Line
            data={revenueTrendData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              interaction: {
                mode: "index",
                intersect: false,
              },
              plugins: {
                legend: {
                  position: "top",
                  labels: { color: "rgba(255,255,255,0.8)" },
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString("en-IN")}`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `₹${value.toLocaleString("en-IN")}`,
                    color: "rgba(255,255,255,0.7)",
                  },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
                x: {
                  ticks: { color: "rgba(255,255,255,0.7)" },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
              },
            }}
          />
        </div>

        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Monthly Comparison (Last 6 Months)</h3>
          <Bar
            data={monthlyComparisonData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: {
                  position: "top",
                  labels: { color: "rgba(255,255,255,0.8)" },
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString("en-IN")}`;
                    },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `₹${value.toLocaleString("en-IN")}`,
                    color: "rgba(255,255,255,0.7)",
                  },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
                x: {
                  ticks: { color: "rgba(255,255,255,0.7)" },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Revenue & Profit Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 px-3 text-white/80">Date</th>
                <th className="text-right py-2 px-3 text-white/80">Orders</th>
                <th className="text-right py-2 px-3 text-white/80">Revenue</th>
                <th className="text-right py-2 px-3 text-white/80">Profit</th>
                <th className="text-right py-2 px-3 text-white/80">Margin %</th>
                <th className="text-right py-2 px-3 text-white/80">Avg Order Value</th>
              </tr>
            </thead>
            <tbody>
              {dailyMetrics
                .slice()
                .reverse()
                .map((daily) => {
                  const margin = daily.revenue > 0 ? (daily.profit / daily.revenue) * 100 : 0;
                  const avgOrderValue = daily.orders > 0 ? daily.revenue / daily.orders : 0;
                  return (
                    <tr key={daily.date} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-2 px-3 text-white">
                        {dayjs(daily.date).format("DD MMM YYYY")}
                      </td>
                      <td className="py-2 px-3 text-right text-white">{daily.orders}</td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                        {formatCurrency(daily.revenue)}
                      </td>
                      <td className="py-2 px-3 text-right text-purple-400 font-semibold">
                        {formatCurrency(daily.profit)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            margin >= 20
                              ? "bg-emerald-500/20 text-emerald-300"
                              : margin >= 10
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-white/60">
                        {formatCurrency(avgOrderValue)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RevenueProfitAnalytics;

