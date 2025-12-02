import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import dayjs from "dayjs";
import { motion } from "framer-motion";
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
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const OverviewAnalytics = ({ distributorId, dateRange }) => {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!distributorId) return;

    setLoading(true);
    const unsubscribers = [];

    // Subscribe to orders
    const ordersUnsub = onSnapshot(
      collection(db, `businesses/${distributorId}/orderRequests`),
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
      }
    );
    unsubscribers.push(ordersUnsub);

    // Subscribe to retailers
    const connectedUnsub = onSnapshot(
      collection(db, `businesses/${distributorId}/connectedRetailers`),
      (snapshot) => {
        const connected = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), type: "connected" }));
        getDocs(collection(db, `businesses/${distributorId}/provisionalRetailers`))
          .then((provisionalSnap) => {
            const provisional = provisionalSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              type: "provisional",
            }));
            setRetailers([...connected, ...provisional]);
          })
          .catch(() => setRetailers(connected));
      }
    );
    unsubscribers.push(connectedUnsub);

    // Fetch products
    getDocs(collection(db, `businesses/${distributorId}/products`))
      .then((snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProducts(productsData);
      })
      .finally(() => setLoading(false));

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [distributorId]);

  const calculateOrderTotal = (order) => {
    if (order?.chargesSnapshot?.breakdown?.grandTotal) {
      return Number(order.chargesSnapshot.breakdown.grandTotal);
    }
    if (order?.proforma?.grandTotal) {
      return Number(order.proforma.grandTotal);
    }
    if (order?.items && Array.isArray(order.items)) {
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
    if (!dateRange?.start || !dateRange?.end) return orders;
    const start = dayjs(dateRange.start);
    const end = dayjs(dateRange.end);
    return orders.filter((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );
      return orderDate.isAfter(start.subtract(1, "day")) && orderDate.isBefore(end.add(1, "day"));
    });
  }, [orders, dateRange]);

  // Calculate comprehensive metrics
  const metrics = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(
      (o) => o.status === "Delivered" || o.statusCode === "DELIVERED"
    );

    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
    
    const totalProfit = deliveredOrders.reduce((sum, order) => {
      const revenue = calculateOrderTotal(order);
      if (order.items && Array.isArray(order.items)) {
        const profit = order.items.reduce((itemSum, item) => {
          const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
          const costPrice = Number(item.costPrice || item.distributorPrice || 0);
          const qty = Number(item.quantity || item.qty || 0);
          return itemSum + (sellingPrice - costPrice) * qty;
        }, 0);
        return sum + profit;
      }
      return sum + revenue * 0.15;
    }, 0);

    // Active retailers (ordered in last 30 days)
    const activeRetailerIds = new Set();
    const thirtyDaysAgo = dayjs().subtract(30, "day");
    filteredOrders.forEach((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );
      if (orderDate.isAfter(thirtyDaysAgo)) {
        const retailerId = order.retailerId || order.provisionalRetailerId;
        if (retailerId) activeRetailerIds.add(retailerId);
      }
    });

    // Growth calculations
    const last7Days = filteredOrders.filter((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );
      return orderDate.isAfter(dayjs().subtract(7, "day"));
    });
    const prev7Days = filteredOrders.filter((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );
      return orderDate.isAfter(dayjs().subtract(14, "day")) && orderDate.isBefore(dayjs().subtract(7, "day"));
    });

    const last7Revenue = last7Days
      .filter((o) => o.status === "Delivered" || o.statusCode === "DELIVERED")
      .reduce((sum, order) => sum + calculateOrderTotal(order), 0);
    const prev7Revenue = prev7Days
      .filter((o) => o.status === "Delivered" || o.statusCode === "DELIVERED")
      .reduce((sum, order) => sum + calculateOrderTotal(order), 0);
    const revenueGrowth = prev7Revenue > 0 ? ((last7Revenue - prev7Revenue) / prev7Revenue) * 100 : 0;

    // Top products
    const productSales = {};
    deliveredOrders.forEach((order) => {
      if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const productId = item.distributorProductId || item.productId;
        if (!productId) return;
        const productName = String(item.productName || item.name || "Unknown");
        if (!productSales[productId]) {
          productSales[productId] = { name: productName, revenue: 0, qty: 0 };
        }
          const qty = Number(item.quantity || item.qty || 0);
          const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
          productSales[productId].revenue += price * qty;
          productSales[productId].qty += qty;
        });
      }
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top retailers
    const retailerSales = {};
    deliveredOrders.forEach((order) => {
      const retailerId = order.retailerId || order.provisionalRetailerId;
      if (!retailerId) return;
      const retailerName = String(order.retailerBusinessName || order.retailerName || "Unknown");
      if (!retailerSales[retailerId]) {
        retailerSales[retailerId] = { name: retailerName, revenue: 0, orders: 0 };
      }
      retailerSales[retailerId].revenue += calculateOrderTotal(order);
      retailerSales[retailerId].orders += 1;
    });
    const topRetailers = Object.values(retailerSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Daily revenue trend (last 30 days)
    const dailyRevenue = {};
    const last30Days = Array.from({ length: 30 }, (_, i) =>
      dayjs().subtract(29 - i, "day").format("YYYY-MM-DD")
    );
    deliveredOrders.forEach((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      ).format("YYYY-MM-DD");
      if (last30Days.includes(orderDate)) {
        dailyRevenue[orderDate] = (dailyRevenue[orderDate] || 0) + calculateOrderTotal(order);
      }
    });

    return {
      totalOrders: deliveredOrders.length,
      totalRevenue,
      totalProfit,
      activeRetailers: activeRetailerIds.size,
      totalProducts: products.length,
      revenueGrowth,
      topProducts,
      topRetailers,
      dailyRevenue: last30Days.map((d) => dailyRevenue[d] || 0),
      dailyLabels: last30Days.map((d) => dayjs(d).format("MMM DD")),
    };
  }, [filteredOrders, products]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getColorClasses = (color) => {
    const colorMap = {
      emerald: {
        border: "border-emerald-500/30",
        bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20",
        glow: "bg-emerald-500/10",
        text: "text-emerald-300",
        badge: "bg-emerald-500/20 text-emerald-300",
      },
      purple: {
        border: "border-purple-500/30",
        bg: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
        glow: "bg-purple-500/10",
        text: "text-purple-300",
        badge: "bg-purple-500/20 text-purple-300",
      },
      blue: {
        border: "border-blue-500/30",
        bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
        glow: "bg-blue-500/10",
        text: "text-blue-300",
        badge: "bg-blue-500/20 text-blue-300",
      },
      amber: {
        border: "border-amber-500/30",
        bg: "bg-gradient-to-br from-amber-500/20 to-amber-600/20",
        glow: "bg-amber-500/10",
        text: "text-amber-300",
        badge: "bg-amber-500/20 text-amber-300",
      },
    };
    return colorMap[color] || colorMap.emerald;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading analytics...</div>
      </div>
    );
  }

  const revenueTrendData = {
    labels: metrics.dailyLabels,
    datasets: [
      {
        label: "Revenue (₹)",
        data: metrics.dailyRevenue,
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Hero Story Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-blue-500/10 to-purple-500/10 backdrop-blur-xl p-8 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Your Business at a Glance
              </h2>
              <p className="text-white/80 text-lg mb-4">
                {dayjs(dateRange?.start).format("MMM DD")} - {dayjs(dateRange?.end).format("MMM DD, YYYY")}
              </p>
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-white/60 text-sm">Revenue Growth</p>
                  <p className={`text-2xl font-bold ${metrics.revenueGrowth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {metrics.revenueGrowth >= 0 ? "↑" : "↓"} {Math.abs(metrics.revenueGrowth).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Profit Margin</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {metrics.totalRevenue > 0 ? ((metrics.totalProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20">
                <p className="text-white/60 text-xs mb-1">Orders</p>
                <p className="text-2xl font-bold text-white">{metrics.totalOrders}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20">
                <p className="text-white/60 text-xs mb-1">Active Retailers</p>
                <p className="text-2xl font-bold text-white">{metrics.activeRetailers}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value: formatCurrency(metrics.totalRevenue),
            subtitle: "All delivered orders",
            color: "emerald",
            icon: "💰",
          },
          {
            label: "Total Profit",
            value: formatCurrency(metrics.totalProfit),
            subtitle: `${metrics.totalRevenue > 0 ? ((metrics.totalProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}% margin`,
            color: "purple",
            icon: "📈",
          },
          {
            label: "Active Retailers",
            value: metrics.activeRetailers,
            subtitle: "Last 30 days",
            color: "blue",
            icon: "🏪",
          },
          {
            label: "Total Products",
            value: metrics.totalProducts,
            subtitle: "In inventory",
            color: "amber",
            icon: "📦",
          },
        ].map((stat, idx) => {
          const colorClasses = getColorClasses(stat.color);
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.05, y: -4 }}
              className={`relative rounded-xl border ${colorClasses.border} ${colorClasses.bg} backdrop-blur-xl p-6 overflow-hidden group`}
            >
              <div className={`absolute top-0 right-0 w-24 h-24 ${colorClasses.glow} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${colorClasses.badge}`}>
                    {stat.label.split(" ")[0]}
                  </span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-xs text-white/60">{stat.subtitle}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Revenue Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4">Revenue Trend (Last 30 Days)</h3>
        <Line
          data={revenueTrendData}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => `₹${context.parsed.y.toLocaleString("en-IN")}`,
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value) => `₹${(value / 1000).toFixed(0)}k`,
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
      </motion.div>

      {/* Top Performers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>🏆</span> Top 5 Products
          </h3>
          <div className="space-y-3">
            {metrics.topProducts.length === 0 ? (
              <p className="text-white/60">No product data available</p>
            ) : (
              metrics.topProducts.map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{product.name}</p>
                      <p className="text-xs text-white/60">{product.qty} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Top Retailers */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⭐</span> Top 5 Retailers
          </h3>
          <div className="space-y-3">
            {metrics.topRetailers.length === 0 ? (
              <p className="text-white/60">No retailer data available</p>
            ) : (
              metrics.topRetailers.map((retailer, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{retailer.name}</p>
                      <p className="text-xs text-white/60">{retailer.orders} orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-400">{formatCurrency(retailer.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>💡</span> Quick Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-sm text-white/60 mb-2">Average Order Value</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(metrics.totalOrders > 0 ? metrics.totalRevenue / metrics.totalOrders : 0)}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-sm text-white/60 mb-2">Orders per Retailer</p>
            <p className="text-2xl font-bold text-white">
              {metrics.activeRetailers > 0 ? (metrics.totalOrders / metrics.activeRetailers).toFixed(1) : 0}
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-sm text-white/60 mb-2">Daily Average Revenue</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(metrics.dailyRevenue.filter((r) => r > 0).length > 0 
                ? metrics.dailyRevenue.reduce((a, b) => a + b, 0) / metrics.dailyRevenue.filter((r) => r > 0).length 
                : 0)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OverviewAnalytics;

