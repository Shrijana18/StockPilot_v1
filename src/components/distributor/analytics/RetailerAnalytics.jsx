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
import { Bar, Doughnut, Line } from "react-chartjs-2";
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

const RetailerAnalytics = ({ distributorId, dateRange, filters, onDateRangeChange, onFiltersChange }) => {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState("overview"); // overview, revenue, profit, activity
  const [localDateRange, setLocalDateRange] = useState(dateRange || {
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [localFilters, setLocalFilters] = useState(filters || {
    retailerType: "",
    state: "",
    minRevenue: 0,
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
        // Fetch orders
        const ordersRef = collection(db, `businesses/${distributorId}/orderRequests`);
        const ordersSnap = await getDocs(ordersRef);
        const ordersData = ordersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);

        // Fetch connected retailers
        const connectedRef = collection(db, `businesses/${distributorId}/connectedRetailers`);
        const connectedSnap = await getDocs(connectedRef);
        const connectedData = connectedSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          type: "connected",
        }));

        // Fetch provisional retailers
        const provisionalRef = collection(db, `businesses/${distributorId}/provisionalRetailers`);
        const provisionalSnap = await getDocs(provisionalRef);
        const provisionalData = provisionalSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          type: "provisional",
        }));

        setRetailers([...connectedData, ...provisionalData]);
      } catch (err) {
        console.error("[RetailerAnalytics] Error fetching data:", err);
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

  // Calculate retailer metrics
  const retailerMetrics = useMemo(() => {
    const metrics = {};
    const retailerMap = {};

    // Build retailer map
    retailers.forEach((r) => {
      retailerMap[r.id] = r;
      if (r.provisionalId) retailerMap[r.provisionalId] = r;
    });

    // Process orders
    filteredOrders.forEach((order) => {
      const retailerId = order.retailerId || order.provisionalRetailerId;
      if (!retailerId) return;

      const retailer = retailerMap[retailerId] || {};
      const retailerName =
        order.retailerBusinessName ||
        order.retailerName ||
        retailer.businessName ||
        retailer.name ||
        "Unknown";
      const retailerEmail = order.retailerEmail || retailer.email || "";
      const retailerPhone = order.retailerPhone || retailer.phone || "";
      const retailerCity = order.retailerCity || order.city || retailer.city || "";
      const retailerState = order.retailerState || order.state || retailer.state || "";

      const orderTotal = order.chargesSnapshot?.breakdown?.grandTotal || calculateOrderTotal(order);
      const isPaid = order.isPaid === true || order.paymentStatus === "Paid";
      const isDelivered = order.status === "Delivered" || order.statusCode === "DELIVERED";

      if (!metrics[retailerId]) {
        metrics[retailerId] = {
          id: retailerId,
          name: retailerName,
          email: retailerEmail,
          phone: retailerPhone,
          city: retailerCity,
          state: retailerState,
          type: retailer.type || (order.provisionalRetailerId ? "provisional" : "connected"),
          totalOrders: 0,
          deliveredOrders: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          pendingRevenue: 0,
          totalProfit: 0,
          firstOrderDate: null,
          lastOrderDate: null,
          avgOrderValue: 0,
          orderFrequency: 0, // orders per month
          daysSinceLastOrder: null,
          orderHistory: [],
        };
      }

      metrics[retailerId].totalOrders += 1;
      if (isDelivered) {
        metrics[retailerId].deliveredOrders += 1;
        metrics[retailerId].totalRevenue += orderTotal;

        if (isPaid) {
          metrics[retailerId].paidRevenue += orderTotal;
        } else {
          metrics[retailerId].pendingRevenue += orderTotal;
        }

        // Calculate profit (simplified - can be enhanced with actual cost data)
        const profit = orderTotal * 0.15; // Assuming 15% average profit margin
        metrics[retailerId].totalProfit += profit;
      }

      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );

      if (!metrics[retailerId].firstOrderDate || orderDate.isBefore(metrics[retailerId].firstOrderDate)) {
        metrics[retailerId].firstOrderDate = orderDate;
      }
      if (!metrics[retailerId].lastOrderDate || orderDate.isAfter(metrics[retailerId].lastOrderDate)) {
        metrics[retailerId].lastOrderDate = orderDate;
      }

      metrics[retailerId].orderHistory.push({
        date: orderDate,
        total: orderTotal,
        status: order.status,
        isPaid,
      });
    });

    // Calculate derived metrics
    Object.keys(metrics).forEach((retailerId) => {
      const m = metrics[retailerId];
      m.avgOrderValue = m.deliveredOrders > 0 ? m.totalRevenue / m.deliveredOrders : 0;

      if (m.firstOrderDate && m.lastOrderDate) {
        const monthsActive = m.lastOrderDate.diff(m.firstOrderDate, "month", true) || 1;
        m.orderFrequency = m.totalOrders / monthsActive;
      }

      m.daysSinceLastOrder = m.lastOrderDate ? dayjs().diff(m.lastOrderDate, "day") : null;
    });

    return Object.values(metrics);
  }, [retailers, filteredOrders]);

  // Apply filters
  const filteredMetrics = useMemo(() => {
    let result = retailerMetrics;
    const activeFilters = localFilters || filters;

    if (activeFilters?.retailerType && activeFilters.retailerType.trim()) {
      result = result.filter((r) => r.type === activeFilters.retailerType);
    }
    if (activeFilters?.minRevenue && activeFilters.minRevenue > 0) {
      result = result.filter((r) => r.totalRevenue >= activeFilters.minRevenue);
    }
    if (activeFilters?.state && activeFilters.state.trim()) {
      result = result.filter((r) => r.state.toLowerCase().includes(activeFilters.state.toLowerCase()));
    }

    return result;
  }, [retailerMetrics, localFilters, filters]);

  // Top retailers by revenue
  const topRetailersByRevenue = useMemo(() => {
    return [...filteredMetrics]
      .filter((r) => r.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }, [filteredMetrics]);

  // Top retailers by profit
  const topRetailersByProfit = useMemo(() => {
    return [...filteredMetrics]
      .filter((r) => r.totalProfit > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 10);
  }, [filteredMetrics]);

  // Most frequent buyers
  const frequentBuyers = useMemo(() => {
    return [...filteredMetrics]
      .filter((r) => r.totalOrders > 0)
      .sort((a, b) => b.orderFrequency - a.orderFrequency)
      .slice(0, 10);
  }, [filteredMetrics]);

  // Low activity retailers
  const lowActivityRetailers = useMemo(() => {
    return [...filteredMetrics]
      .filter((r) => {
        const daysSince = r.daysSinceLastOrder;
        return daysSince !== null && daysSince > 30;
      })
      .sort((a, b) => (b.daysSinceLastOrder || 0) - (a.daysSinceLastOrder || 0))
      .slice(0, 10);
  }, [filteredMetrics]);

  // Active vs Passive retailers
  const activePassiveData = useMemo(() => {
    const active = filteredMetrics.filter((r) => {
      const daysSince = r.daysSinceLastOrder;
      return daysSince !== null && daysSince <= 30;
    }).length;
    const passive = filteredMetrics.filter((r) => {
      const daysSince = r.daysSinceLastOrder;
      return daysSince === null || daysSince > 30;
    }).length;

    return {
      labels: ["Active (Last 30 days)", "Inactive (>30 days)"],
      datasets: [
        {
          label: "Retailers",
          data: [active, passive],
          backgroundColor: ["rgba(16, 185, 129, 0.8)", "rgba(239, 68, 68, 0.8)"],
        },
      ],
    };
  }, [filteredMetrics]);

  // Revenue distribution chart
  const revenueDistributionData = useMemo(() => {
    const top10 = topRetailersByRevenue.slice(0, 10);
    return {
      labels: top10.map((r) => r.name.substring(0, 20)),
      datasets: [
        {
          label: "Revenue (₹)",
          data: top10.map((r) => r.totalRevenue),
          backgroundColor: "rgba(16, 185, 129, 0.8)",
        },
      ],
    };
  }, [topRetailersByRevenue]);

  // Ordering pattern (latest to oldest)
  const orderingPatternData = useMemo(() => {
    const sorted = [...filteredMetrics]
      .filter((r) => r.lastOrderDate)
      .sort((a, b) => b.lastOrderDate - a.lastOrderDate)
      .slice(0, 10);

    return {
      labels: sorted.map((r) => r.name.substring(0, 15)),
      datasets: [
        {
          label: "Days Since Last Order",
          data: sorted.map((r) => r.daysSinceLastOrder || 0),
          backgroundColor: sorted.map((r) => {
            const days = r.daysSinceLastOrder || 0;
            if (days <= 7) return "rgba(16, 185, 129, 0.8)";
            if (days <= 30) return "rgba(251, 146, 60, 0.8)";
            return "rgba(239, 68, 68, 0.8)";
          }),
        },
      ],
    };
  }, [filteredMetrics]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="text-center text-white/60">Loading retailer analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            Retailer Analytics
          </h2>
          <p className="text-white/60 text-sm mt-1">Comprehensive retailer performance, revenue, and activity insights</p>
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
            <label className="block text-xs text-white/60 mb-1">Retailer Type</label>
            <select
              value={localFilters.retailerType}
              onChange={(e) => {
                const newFilters = { ...localFilters, retailerType: e.target.value };
                setLocalFilters(newFilters);
                if (onFiltersChange) onFiltersChange(newFilters);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">All Types</option>
              <option value="connected">Connected</option>
              <option value="provisional">Provisional</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">State</label>
            <input
              type="text"
              placeholder="Enter state"
              value={localFilters.state}
              onChange={(e) => {
                const newFilters = { ...localFilters, state: e.target.value };
                setLocalFilters(newFilters);
                if (onFiltersChange) onFiltersChange(newFilters);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const cleared = { retailerType: "", state: "", minRevenue: 0 };
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
        {["overview", "revenue", "profit", "activity"].map((view) => (
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
          <p className="text-xs text-white/60 mb-1">Total Retailers</p>
          <p className="text-2xl font-bold text-white">{retailers.length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
          <p className="text-xs text-white/60 mb-1">Active Retailers</p>
          <p className="text-2xl font-bold text-white">
            {filteredMetrics.filter((r) => {
              const days = r.daysSinceLastOrder;
              return days !== null && days <= 30;
            }).length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-4 border border-purple-500/30">
          <p className="text-xs text-white/60 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(filteredMetrics.reduce((sum, r) => sum + r.totalRevenue, 0))}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl p-4 border border-amber-500/30">
          <p className="text-xs text-white/60 mb-1">Pending Payments</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(filteredMetrics.reduce((sum, r) => sum + r.pendingRevenue, 0))}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      {selectedView === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Active vs Inactive Retailers</h3>
            <Doughnut
              data={activePassiveData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { position: "bottom", labels: { color: "rgba(255,255,255,0.8)" } },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${context.parsed} retailers`,
                    },
                  },
                },
              }}
            />
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 Retailers by Revenue</h3>
            <Bar
              data={revenueDistributionData}
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
      )}

      {selectedView === "revenue" && (
        <div className="space-y-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Top Retailers by Revenue</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {topRetailersByRevenue.map((retailer, idx) => (
                <div
                  key={retailer.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{retailer.name}</p>
                      <p className="text-xs text-white/60">
                        {retailer.city && retailer.state
                          ? `${retailer.city}, ${retailer.state}`
                          : retailer.email || retailer.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(retailer.totalRevenue)}</p>
                    <p className="text-xs text-white/60">{retailer.deliveredOrders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedView === "profit" && (
        <div className="space-y-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Top Retailers by Profit</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {topRetailersByProfit.map((retailer, idx) => (
                <div
                  key={retailer.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{retailer.name}</p>
                      <p className="text-xs text-white/60">
                        Revenue: {formatCurrency(retailer.totalRevenue)} • {retailer.deliveredOrders} orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-400">{formatCurrency(retailer.totalProfit)}</p>
                    <p className="text-xs text-white/60">
                      {retailer.totalRevenue > 0
                        ? ((retailer.totalProfit / retailer.totalRevenue) * 100).toFixed(1)
                        : 0}
                      % margin
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedView === "activity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Most Frequent Buyers</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {frequentBuyers.map((retailer, idx) => (
                <div
                  key={retailer.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">{retailer.name}</p>
                    <p className="text-xs text-white/60">
                      {retailer.totalOrders} orders • {retailer.orderFrequency.toFixed(1)} orders/month
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-400">{retailer.orderFrequency.toFixed(1)}</p>
                    <p className="text-xs text-white/60">orders/month</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Low Activity Retailers</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lowActivityRetailers.length === 0 ? (
                <p className="text-white/60">All retailers are active! 🎉</p>
              ) : (
                lowActivityRetailers.map((retailer) => (
                  <div
                    key={retailer.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-white">{retailer.name}</p>
                      <p className="text-xs text-white/60">
                        Last order: {retailer.lastOrderDate ? retailer.lastOrderDate.format("DD MMM YYYY") : "Never"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-400">{retailer.daysSinceLastOrder || 0}</p>
                      <p className="text-xs text-white/60">days ago</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ordering Pattern Chart */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Ordering Pattern (Latest to Oldest)</h3>
        <Bar
          data={orderingPatternData}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: "y",
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => `${context.parsed.x} days since last order`,
                },
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                ticks: {
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

      {/* Detailed Retailer Table */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">All Retailers Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 px-3 text-white/80">Retailer</th>
                <th className="text-left py-2 px-3 text-white/80">Type</th>
                <th className="text-left py-2 px-3 text-white/80">Location</th>
                <th className="text-right py-2 px-3 text-white/80">Orders</th>
                <th className="text-right py-2 px-3 text-white/80">Revenue</th>
                <th className="text-right py-2 px-3 text-white/80">Paid</th>
                <th className="text-right py-2 px-3 text-white/80">Pending</th>
                <th className="text-right py-2 px-3 text-white/80">Profit</th>
                <th className="text-right py-2 px-3 text-white/80">Avg Order</th>
                <th className="text-right py-2 px-3 text-white/80">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .map((retailer) => (
                  <tr key={retailer.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 text-white font-medium">{retailer.name}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          retailer.type === "connected"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {retailer.type === "connected" ? "Connected" : "Provisional"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white/60">
                      {retailer.city && retailer.state ? `${retailer.city}, ${retailer.state}` : "N/A"}
                    </td>
                    <td className="py-2 px-3 text-right text-white">{retailer.totalOrders}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                      {formatCurrency(retailer.totalRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-green-400 font-semibold">
                      {formatCurrency(retailer.paidRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-400 font-semibold">
                      {formatCurrency(retailer.pendingRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-purple-400 font-semibold">
                      {formatCurrency(retailer.totalProfit)}
                    </td>
                    <td className="py-2 px-3 text-right text-white/60">
                      {formatCurrency(retailer.avgOrderValue)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {retailer.daysSinceLastOrder !== null ? (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            retailer.daysSinceLastOrder <= 7
                              ? "bg-emerald-500/20 text-emerald-300"
                              : retailer.daysSinceLastOrder <= 30
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {retailer.daysSinceLastOrder}d ago
                        </span>
                      ) : (
                        <span className="text-white/40">Never</span>
                      )}
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

export default RetailerAnalytics;

