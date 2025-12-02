import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import dayjs from "dayjs";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const CategoryBrandAnalytics = ({ distributorId, dateRange, filters, onDateRangeChange }) => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState("category"); // category, brand
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
        // Fetch orders
        const ordersRef = collection(db, `businesses/${distributorId}/orderRequests`);
        const ordersSnap = await getDocs(ordersRef);
        const ordersData = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);

        // Fetch products
        const productsRef = collection(db, `businesses/${distributorId}/products`);
        const productsSnap = await getDocs(productsRef);
        const productsData = productsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);
      } catch (err) {
        console.error("[CategoryBrandAnalytics] Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [distributorId]);

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

  // Category performance metrics
  const categoryMetrics = useMemo(() => {
    const metrics = {};
    const productMap = {};

    // Build product map
    products.forEach((p) => {
      productMap[p.id] = p;
    });

    // Create lookup maps for fallback matching
    const productByNameBrand = {};
    const productBySku = {};
    products.forEach((p) => {
      const name = (p.name || p.productName || "").toLowerCase().trim();
      const brand = (p.brand || "").toLowerCase().trim();
      const sku = (p.sku || "").toLowerCase().trim();
      if (name && brand) {
        productByNameBrand[`${name}::${brand}`] = p;
      }
      if (sku) {
        productBySku[sku] = p;
      }
    });

    // Process orders
    filteredOrders.forEach((order) => {
      // Check if order is delivered (handle multiple status formats)
      const status = String(order.status || "").toUpperCase();
      const statusCode = String(order.statusCode || "").toUpperCase();
      const isDelivered = 
        status === "DELIVERED" || 
        statusCode === "DELIVERED" ||
        status === "INVOICED" ||
        statusCode === "INVOICED" ||
        String(order.status || "").toLowerCase() === "delivered" ||
        String(order.statusCode || "").toLowerCase() === "delivered";
      
      if (!isDelivered) return;
      if (!order.items || !Array.isArray(order.items)) return;

      order.items.forEach((item) => {
        let productId = item.distributorProductId || item.productId || item.inventoryId || item.id;
        let matchedProduct = null;
        
        // If we have a product ID, try to find it in inventory
        if (productId) {
          matchedProduct = productMap[productId];
        }
        
        // If no product ID or product not found, try to match by name and brand
        if (!matchedProduct) {
          const itemName = (item.productName || item.name || "").toLowerCase().trim();
          const itemBrand = (item.brand || "").toLowerCase().trim();
          const itemSku = (item.sku || "").toLowerCase().trim();
          
          // Try SKU first (most reliable)
          if (itemSku && productBySku[itemSku]) {
            matchedProduct = productBySku[itemSku];
            productId = matchedProduct.id;
          }
          // Then try name+brand
          else if (itemName && itemBrand) {
            const key = `${itemName}::${itemBrand}`;
            if (productByNameBrand[key]) {
              matchedProduct = productByNameBrand[key];
              productId = matchedProduct.id;
            }
          }
          
          // If still no match, try fuzzy matching
          if (!matchedProduct && itemName) {
            matchedProduct = products.find((p) => {
              const pName = (p.name || p.productName || "").toLowerCase().trim();
              return pName && itemName && (pName.includes(itemName) || itemName.includes(pName));
            });
            if (matchedProduct) {
              productId = matchedProduct.id;
            }
          }
        }
        
        const product = matchedProduct || productMap[productId] || {};
        const category = item.category || product.category || "Uncategorized";
        const qty = Number(item.quantity || item.qty || 0);
        const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const costPrice = Number(product.costPrice || product.price || product.distributorPrice || 0);
        const revenue = sellingPrice * qty;
        const cost = costPrice * qty;
        const profit = revenue - cost;

        if (!metrics[category]) {
          metrics[category] = {
            name: category,
            totalSold: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            ordersCount: 0,
            productsCount: new Set(),
          };
        }

        metrics[category].totalSold += qty;
        metrics[category].totalRevenue += revenue;
        metrics[category].totalCost += cost;
        metrics[category].totalProfit += profit;
        metrics[category].ordersCount += 1;
        metrics[category].productsCount.add(productId);
      });
    });

    // Calculate averages
    Object.keys(metrics).forEach((category) => {
      const m = metrics[category];
      m.avgProfitMargin = m.totalRevenue > 0 ? (m.totalProfit / m.totalRevenue) * 100 : 0;
      m.productsCount = m.productsCount.size;
      m.avgOrderValue = m.ordersCount > 0 ? m.totalRevenue / m.ordersCount : 0;
    });

    return Object.values(metrics);
  }, [products, filteredOrders]);

  // Brand performance metrics
  const brandMetrics = useMemo(() => {
    const metrics = {};
    const productMap = {};

    // Build product map
    products.forEach((p) => {
      productMap[p.id] = p;
    });

    // Create lookup maps for fallback matching
    const productByNameBrand = {};
    const productBySku = {};
    products.forEach((p) => {
      const name = (p.name || p.productName || "").toLowerCase().trim();
      const brand = (p.brand || "").toLowerCase().trim();
      const sku = (p.sku || "").toLowerCase().trim();
      if (name && brand) {
        productByNameBrand[`${name}::${brand}`] = p;
      }
      if (sku) {
        productBySku[sku] = p;
      }
    });

    // Process orders
    filteredOrders.forEach((order) => {
      // Check if order is delivered (handle multiple status formats)
      const status = String(order.status || "").toUpperCase();
      const statusCode = String(order.statusCode || "").toUpperCase();
      const isDelivered = 
        status === "DELIVERED" || 
        statusCode === "DELIVERED" ||
        status === "INVOICED" ||
        statusCode === "INVOICED" ||
        String(order.status || "").toLowerCase() === "delivered" ||
        String(order.statusCode || "").toLowerCase() === "delivered";
      
      if (!isDelivered) return;
      if (!order.items || !Array.isArray(order.items)) return;

      order.items.forEach((item) => {
        let productId = item.distributorProductId || item.productId || item.inventoryId || item.id;
        let matchedProduct = null;
        
        // If we have a product ID, try to find it in inventory
        if (productId) {
          matchedProduct = productMap[productId];
        }
        
        // If no product ID or product not found, try to match by name and brand
        if (!matchedProduct) {
          const itemName = (item.productName || item.name || "").toLowerCase().trim();
          const itemBrand = (item.brand || "").toLowerCase().trim();
          const itemSku = (item.sku || "").toLowerCase().trim();
          
          // Try SKU first (most reliable)
          if (itemSku && productBySku[itemSku]) {
            matchedProduct = productBySku[itemSku];
            productId = matchedProduct.id;
          }
          // Then try name+brand
          else if (itemName && itemBrand) {
            const key = `${itemName}::${itemBrand}`;
            if (productByNameBrand[key]) {
              matchedProduct = productByNameBrand[key];
              productId = matchedProduct.id;
            }
          }
          
          // If still no match, try fuzzy matching
          if (!matchedProduct && itemName) {
            matchedProduct = products.find((p) => {
              const pName = (p.name || p.productName || "").toLowerCase().trim();
              return pName && itemName && (pName.includes(itemName) || itemName.includes(pName));
            });
            if (matchedProduct) {
              productId = matchedProduct.id;
            }
          }
        }
        
        const product = matchedProduct || productMap[productId] || {};
        const brand = item.brand || product.brand || "Unbranded";
        const qty = Number(item.quantity || item.qty || 0);
        const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const costPrice = Number(product.costPrice || product.price || product.distributorPrice || 0);
        const revenue = sellingPrice * qty;
        const cost = costPrice * qty;
        const profit = revenue - cost;

        if (!metrics[brand]) {
          metrics[brand] = {
            name: brand,
            totalSold: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            ordersCount: 0,
            productsCount: new Set(),
          };
        }

        metrics[brand].totalSold += qty;
        metrics[brand].totalRevenue += revenue;
        metrics[brand].totalCost += cost;
        metrics[brand].totalProfit += profit;
        metrics[brand].ordersCount += 1;
        metrics[brand].productsCount.add(productId);
      });
    });

    // Calculate averages
    Object.keys(metrics).forEach((brand) => {
      const m = metrics[brand];
      m.avgProfitMargin = m.totalRevenue > 0 ? (m.totalProfit / m.totalRevenue) * 100 : 0;
      m.productsCount = m.productsCount.size;
      m.avgOrderValue = m.ordersCount > 0 ? m.totalRevenue / m.ordersCount : 0;
    });

    return Object.values(metrics);
  }, [products, filteredOrders]);

  // Category distribution chart
  const categoryDistributionData = useMemo(() => {
    const sorted = [...categoryMetrics].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    return {
      labels: sorted.map((c) => c.name),
      datasets: [
        {
          label: "Revenue (₹)",
          data: sorted.map((c) => c.totalRevenue),
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
  }, [categoryMetrics]);

  // Brand distribution chart
  const brandDistributionData = useMemo(() => {
    const sorted = [...brandMetrics].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    return {
      labels: sorted.map((b) => b.name),
      datasets: [
        {
          label: "Revenue (₹)",
          data: sorted.map((b) => b.totalRevenue),
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
  }, [brandMetrics]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="text-center text-white/60">Loading category & brand analytics...</div>
      </div>
    );
  }

  const currentMetrics = selectedView === "category" ? categoryMetrics : brandMetrics;
  const currentDistributionData = selectedView === "category" ? categoryDistributionData : brandDistributionData;
  const sortedMetrics = [...currentMetrics].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            Category & Brand Analytics
          </h2>
          <p className="text-white/60 text-sm mt-1">Compare performance across categories and brands</p>
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

      {/* View Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["category", "brand"].map((view) => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedView === view
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)} Performance
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-4 border border-emerald-500/30">
          <p className="text-xs text-white/60 mb-1">Total {selectedView === "category" ? "Categories" : "Brands"}</p>
          <p className="text-2xl font-bold text-white">{currentMetrics.length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
          <p className="text-xs text-white/60 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(currentMetrics.reduce((sum, m) => sum + m.totalRevenue, 0))}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
          <p className="text-xs text-white/60 mb-1">Total Profit</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(currentMetrics.reduce((sum, m) => sum + m.totalProfit, 0))}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl p-4 border border-amber-500/30">
          <p className="text-xs text-white/60 mb-1">Total Units Sold</p>
          <p className="text-2xl font-bold text-white">
            {currentMetrics.reduce((sum, m) => sum + m.totalSold, 0).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">
            Top 10 {selectedView === "category" ? "Categories" : "Brands"} by Revenue
          </h3>
          <Doughnut
            data={currentDistributionData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { position: "bottom", labels: { color: "rgba(255,255,255,0.8)" } },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const label = context.label || "";
                      const value = context.parsed || 0;
                      const total = context.dataset.data.reduce((a, b) => a + b, 0);
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                      return `${label}: ₹${value.toLocaleString("en-IN")} (${percentage}%)`;
                    },
                  },
                },
              },
            }}
          />
        </div>

        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">
            Top {selectedView === "category" ? "Categories" : "Brands"} by Revenue
          </h3>
          <Bar
            data={currentDistributionData}
            options={{
              responsive: true,
              maintainAspectRatio: true,
              indexAxis: "y",
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => `₹${context.parsed.x.toLocaleString("en-IN")}`,
                  },
                },
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `₹${value.toLocaleString("en-IN")}`,
                    color: "rgba(255,255,255,0.7)",
                  },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
                y: {
                  ticks: { color: "rgba(255,255,255,0.7)", maxRotation: 0 },
                  grid: { color: "rgba(255,255,255,0.1)" },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">
          All {selectedView === "category" ? "Categories" : "Brands"} Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 px-3 text-white/80">
                  {selectedView === "category" ? "Category" : "Brand"}
                </th>
                <th className="text-right py-2 px-3 text-white/80">Products</th>
                <th className="text-right py-2 px-3 text-white/80">Units Sold</th>
                <th className="text-right py-2 px-3 text-white/80">Orders</th>
                <th className="text-right py-2 px-3 text-white/80">Revenue</th>
                <th className="text-right py-2 px-3 text-white/80">Profit</th>
                <th className="text-right py-2 px-3 text-white/80">Margin %</th>
                <th className="text-right py-2 px-3 text-white/80">Avg Order Value</th>
              </tr>
            </thead>
            <tbody>
              {sortedMetrics.map((metric) => (
                <tr key={metric.name} className="border-b border-white/10 hover:bg-white/5">
                  <td className="py-2 px-3 text-white font-medium">{metric.name}</td>
                  <td className="py-2 px-3 text-right text-white/60">{metric.productsCount}</td>
                  <td className="py-2 px-3 text-right text-white">{metric.totalSold.toLocaleString("en-IN")}</td>
                  <td className="py-2 px-3 text-right text-white/60">{metric.ordersCount}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                    {formatCurrency(metric.totalRevenue)}
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400 font-semibold">
                    {formatCurrency(metric.totalProfit)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        metric.avgProfitMargin >= 30
                          ? "bg-emerald-500/20 text-emerald-300"
                          : metric.avgProfitMargin >= 20
                          ? "bg-blue-500/20 text-blue-300"
                          : metric.avgProfitMargin >= 10
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {metric.avgProfitMargin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-white/60">
                    {formatCurrency(metric.avgOrderValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CategoryBrandAnalytics;

