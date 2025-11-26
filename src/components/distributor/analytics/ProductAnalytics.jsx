import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
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
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import dayjs from "dayjs";

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

const ProductAnalytics = ({ distributorId, dateRange, filters, onDateRangeChange, onFiltersChange }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState("trends"); // trends, profit, stock, patterns
  const [localDateRange, setLocalDateRange] = useState(dateRange || {
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [localFilters, setLocalFilters] = useState(filters || {
    brand: "",
    category: "",
    minProfit: 0,
  });

  // Sync local state with props
  useEffect(() => {
    if (dateRange) setLocalDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (filters) setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!distributorId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch products
        const productsRef = collection(db, `businesses/${distributorId}/products`);
        const productsSnap = await getDocs(productsRef);
        const productsData = productsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);

        // Fetch orders
        const ordersRef = collection(db, `businesses/${distributorId}/orderRequests`);
        const ordersSnap = await getDocs(ordersRef);
        const ordersData = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);
      } catch (err) {
        console.error("[ProductAnalytics] Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [distributorId]);

  // Helper function to calculate order total
  const orderGrandTotal = (order) => {
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

  // Calculate product performance metrics
  const productMetrics = useMemo(() => {
    const metrics = {};
    const productMap = {};

    // Build product map
    products.forEach((p) => {
      productMap[p.id] = p;
    });

    // Process orders
    filteredOrders.forEach((order) => {
      if (!order.items || !Array.isArray(order.items)) return;
      if (order.status !== "Delivered" && order.statusCode !== "DELIVERED") return;

      order.items.forEach((item) => {
        const productId = item.distributorProductId || item.productId;
        if (!productId) return;

        const product = productMap[productId] || {};
        const qty = Number(item.quantity || item.qty || 0);
        const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const costPrice = Number(product.costPrice || product.price || 0);
        const revenue = sellingPrice * qty;
        const cost = costPrice * qty;
        const profit = revenue - cost;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

        if (!metrics[productId]) {
          metrics[productId] = {
            id: productId,
            name: item.productName || item.name || product.name || "Unknown",
            sku: item.sku || product.sku || "N/A",
            brand: item.brand || product.brand || "N/A",
            category: item.category || product.category || "N/A",
            totalSold: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            avgProfitMargin: 0,
            currentStock: Number(product.quantity || 0),
            ordersCount: 0,
            lastOrderDate: null,
            trend: [],
          };
        }

        metrics[productId].totalSold += qty;
        metrics[productId].totalRevenue += revenue;
        metrics[productId].totalCost += cost;
        metrics[productId].totalProfit += profit;
        metrics[productId].ordersCount += 1;

        const orderDate = dayjs(
          order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
        );
        if (!metrics[productId].lastOrderDate || orderDate.isAfter(metrics[productId].lastOrderDate)) {
          metrics[productId].lastOrderDate = orderDate;
        }

        // Build trend data (last 30 days)
        const daysAgo = dayjs().diff(orderDate, "day");
        if (daysAgo <= 30) {
          metrics[productId].trend.push({
            date: orderDate.format("YYYY-MM-DD"),
            sold: qty,
            revenue,
            profit,
          });
        }
      });
    });

    // Calculate averages and process trends
    Object.keys(metrics).forEach((productId) => {
      const m = metrics[productId];
      m.avgProfitMargin = m.totalRevenue > 0 ? (m.totalProfit / m.totalRevenue) * 100 : 0;

      // Aggregate trend by date
      const trendMap = {};
      m.trend.forEach((t) => {
        if (!trendMap[t.date]) {
          trendMap[t.date] = { sold: 0, revenue: 0, profit: 0 };
        }
        trendMap[t.date].sold += t.sold;
        trendMap[t.date].revenue += t.revenue;
        trendMap[t.date].profit += t.profit;
      });

      m.trend = Object.entries(trendMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });

    return Object.values(metrics);
  }, [products, filteredOrders]);

  // Apply filters
  const filteredMetrics = useMemo(() => {
    let result = productMetrics;
    const activeFilters = localFilters || filters;

    if (activeFilters?.brand && activeFilters.brand.trim()) {
      result = result.filter((p) => p.brand.toLowerCase().includes(activeFilters.brand.toLowerCase()));
    }
    if (activeFilters?.category && activeFilters.category.trim()) {
      result = result.filter((p) => p.category.toLowerCase().includes(activeFilters.category.toLowerCase()));
    }
    if (activeFilters?.minProfit && activeFilters.minProfit > 0) {
      result = result.filter((p) => p.totalProfit >= activeFilters.minProfit);
    }

    return result;
  }, [productMetrics, localFilters, filters]);

  // Top products by revenue
  const topProductsByRevenue = useMemo(() => {
    return [...filteredMetrics]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }, [filteredMetrics]);

  // Top products by profit
  const topProductsByProfit = useMemo(() => {
    return [...filteredMetrics]
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10);
  }, [filteredMetrics]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => {
        const qty = Number(p.quantity || 0);
        const minQty = Number(p.minQuantity || 10);
        return qty > 0 && qty <= minQty;
      })
      .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
      .slice(0, 10);
  }, [products]);

  // Revenue trend chart data
  const revenueTrendData = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) =>
      dayjs().subtract(29 - i, "day").format("YYYY-MM-DD")
    );

    const dailyRevenue = {};
    filteredOrders.forEach((order) => {
      if (order.status !== "Delivered" && order.statusCode !== "DELIVERED") return;
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      ).format("YYYY-MM-DD");

      if (last30Days.includes(orderDate)) {
        const total = order.chargesSnapshot?.breakdown?.grandTotal || orderGrandTotal(order);
        dailyRevenue[orderDate] = (dailyRevenue[orderDate] || 0) + total;
      }
    });

    return {
      labels: last30Days.map((d) => dayjs(d).format("MMM DD")),
      datasets: [
        {
          label: "Revenue (₹)",
          data: last30Days.map((d) => dailyRevenue[d] || 0),
          borderColor: "rgb(16, 185, 129)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
        },
      ],
    };
  }, [filteredOrders]);

  // Product sales distribution
  const salesDistributionData = useMemo(() => {
    const top10 = topProductsByRevenue.slice(0, 10);
    return {
      labels: top10.map((p) => p.name.substring(0, 20)),
      datasets: [
        {
          label: "Revenue (₹)",
          data: top10.map((p) => p.totalRevenue),
          backgroundColor: [
            "rgba(16, 185, 129, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
            "rgba(251, 146, 60, 0.8)",
            "rgba(34, 197, 94, 0.8)",
            "rgba(168, 85, 247, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(14, 165, 233, 0.8)",
            "rgba(245, 158, 11, 0.8)",
          ],
        },
      ],
    };
  }, [topProductsByRevenue]);

  // Profit margin distribution
  const profitMarginData = useMemo(() => {
    const margins = filteredMetrics.map((p) => p.avgProfitMargin).filter((m) => m > 0);
    const ranges = {
      "0-10%": 0,
      "10-20%": 0,
      "20-30%": 0,
      "30-40%": 0,
      "40%+": 0,
    };

    margins.forEach((m) => {
      if (m < 10) ranges["0-10%"]++;
      else if (m < 20) ranges["10-20%"]++;
      else if (m < 30) ranges["20-30%"]++;
      else if (m < 40) ranges["30-40%"]++;
      else ranges["40%+"]++;
    });

    return {
      labels: Object.keys(ranges),
      datasets: [
        {
          label: "Products",
          data: Object.values(ranges),
          backgroundColor: [
            "rgba(239, 68, 68, 0.8)",
            "rgba(251, 146, 60, 0.8)",
            "rgba(251, 191, 36, 0.8)",
            "rgba(34, 197, 94, 0.8)",
            "rgba(16, 185, 129, 0.8)",
          ],
        },
      ],
    };
  }, [filteredOrders]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="text-center text-white/60">Loading product analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            Product Analytics
          </h2>
          <p className="text-white/60 text-sm mt-1">Deep insights into product performance, trends, and profitability</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
            <label className="block text-xs text-white/60 mb-1">Filter by Brand</label>
            <input
              type="text"
              placeholder="Enter brand name"
              value={localFilters.brand}
              onChange={(e) => {
                const newFilters = { ...localFilters, brand: e.target.value };
                setLocalFilters(newFilters);
                if (onFiltersChange) onFiltersChange(newFilters);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Filter by Category</label>
            <input
              type="text"
              placeholder="Enter category"
              value={localFilters.category}
              onChange={(e) => {
                const newFilters = { ...localFilters, category: e.target.value };
                setLocalFilters(newFilters);
                if (onFiltersChange) onFiltersChange(newFilters);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const cleared = { brand: "", category: "", minProfit: 0 };
                setLocalFilters(cleared);
                if (onFiltersChange) onFiltersChange(cleared);
              }}
              className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition border border-white/20"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["trends", "profit", "stock", "patterns"].map((view) => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedView === view
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-4 border border-emerald-500/30">
          <p className="text-xs text-white/60 mb-1">Total Products</p>
          <p className="text-2xl font-bold text-white">{products.length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
          <p className="text-xs text-white/60 mb-1">Active Products</p>
          <p className="text-2xl font-bold text-white">{filteredMetrics.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
          <p className="text-xs text-white/60 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalRevenue, 0))}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl p-4 border border-amber-500/30">
          <p className="text-xs text-white/60 mb-1">Total Profit</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalProfit, 0))}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      {selectedView === "trends" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (Last 30 Days)</h3>
            <Line
              data={revenueTrendData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    mode: "index",
                    intersect: false,
                    callbacks: {
                      label: (context) => `₹${context.parsed.y.toLocaleString("en-IN")}`,
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
            <h3 className="text-lg font-semibold text-white mb-4">Top Products by Revenue</h3>
            <Bar
              data={salesDistributionData}
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
                      callback: (value) => `₹${value.toLocaleString("en-IN")}`,
                      color: "rgba(255,255,255,0.7)",
                    },
                    grid: { color: "rgba(255,255,255,0.1)" },
                  },
                  x: {
                    ticks: { color: "rgba(255,255,255,0.7)", maxRotation: 45, minRotation: 45 },
                    grid: { color: "rgba(255,255,255,0.1)" },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {selectedView === "profit" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Profit Margin Distribution</h3>
            <Doughnut
              data={profitMarginData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { position: "bottom", labels: { color: "rgba(255,255,255,0.8)" } },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${context.parsed} products`,
                    },
                  },
                },
              }}
            />
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Top Products by Profit</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {topProductsByProfit.map((product, idx) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-white/60">
                      {product.brand} • {product.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(product.totalProfit)}</p>
                    <p className="text-xs text-white/60">{product.avgProfitMargin.toFixed(1)}% margin</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedView === "stock" && (
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Low Stock Alert</h3>
          {lowStockProducts.length === 0 ? (
            <p className="text-white/60">All products are well-stocked! 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-2 px-3 text-white/80">Product</th>
                    <th className="text-left py-2 px-3 text-white/80">SKU</th>
                    <th className="text-left py-2 px-3 text-white/80">Brand</th>
                    <th className="text-right py-2 px-3 text-white/80">Current Stock</th>
                    <th className="text-right py-2 px-3 text-white/80">Min Required</th>
                    <th className="text-right py-2 px-3 text-white/80">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product) => {
                    const qty = Number(product.quantity || 0);
                    const minQty = Number(product.minQuantity || 10);
                    const percent = (qty / minQty) * 100;
                    return (
                      <tr key={product.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="py-2 px-3 text-white">{product.name}</td>
                        <td className="py-2 px-3 text-white/60">{product.sku || "N/A"}</td>
                        <td className="py-2 px-3 text-white/60">{product.brand || "N/A"}</td>
                        <td className="py-2 px-3 text-right text-white">{qty}</td>
                        <td className="py-2 px-3 text-right text-white/60">{minQty}</td>
                        <td className="py-2 px-3 text-right">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              percent < 50
                                ? "bg-red-500/20 text-red-300"
                                : percent < 80
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {percent < 50 ? "Critical" : percent < 80 ? "Low" : "Warning"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedView === "patterns" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Top Products by Revenue</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {topProductsByRevenue.map((product, idx) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{product.name}</p>
                      <p className="text-xs text-white/60">
                        {product.totalSold} sold • {product.ordersCount} orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(product.totalRevenue)}</p>
                    <p className="text-xs text-white/60">{formatCurrency(product.totalProfit)} profit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Product Performance Summary</h3>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Average Profit Margin</p>
                <p className="text-2xl font-bold text-white">
                  {filteredMetrics.length > 0
                    ? (
                        filteredMetrics.reduce((sum, p) => sum + p.avgProfitMargin, 0) /
                        filteredMetrics.length
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Total Units Sold</p>
                <p className="text-2xl font-bold text-white">
                  {filteredMetrics.reduce((sum, p) => sum + p.totalSold, 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Average Orders per Product</p>
                <p className="text-2xl font-bold text-white">
                  {filteredMetrics.length > 0
                    ? (filteredMetrics.reduce((sum, p) => sum + p.ordersCount, 0) / filteredMetrics.length).toFixed(1)
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Product Table */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">All Products Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 px-3 text-white/80">Product</th>
                <th className="text-left py-2 px-3 text-white/80">Brand</th>
                <th className="text-left py-2 px-3 text-white/80">Category</th>
                <th className="text-right py-2 px-3 text-white/80">Stock</th>
                <th className="text-right py-2 px-3 text-white/80">Sold</th>
                <th className="text-right py-2 px-3 text-white/80">Revenue</th>
                <th className="text-right py-2 px-3 text-white/80">Profit</th>
                <th className="text-right py-2 px-3 text-white/80">Margin %</th>
                <th className="text-right py-2 px-3 text-white/80">Orders</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .map((product) => (
                  <tr key={product.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 text-white font-medium">{product.name}</td>
                    <td className="py-2 px-3 text-white/60">{product.brand}</td>
                    <td className="py-2 px-3 text-white/60">{product.category}</td>
                    <td className="py-2 px-3 text-right text-white">{product.currentStock}</td>
                    <td className="py-2 px-3 text-right text-white">{product.totalSold}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                      {formatCurrency(product.totalRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-300 font-semibold">
                      {formatCurrency(product.totalProfit)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.avgProfitMargin >= 30
                            ? "bg-emerald-500/20 text-emerald-300"
                            : product.avgProfitMargin >= 20
                            ? "bg-blue-500/20 text-blue-300"
                            : product.avgProfitMargin >= 10
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {product.avgProfitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-white/60">{product.ordersCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductAnalytics;

