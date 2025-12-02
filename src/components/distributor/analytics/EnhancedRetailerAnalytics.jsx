import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
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
import { motion } from "framer-motion";

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

const EnhancedRetailerAnalytics = ({ distributorId, dateRange, filters, onDateRangeChange, onFiltersChange }) => {
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [orderFilterDate, setOrderFilterDate] = useState("");
  const [localDateRange, setLocalDateRange] = useState(dateRange || {
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [localFilters, setLocalFilters] = useState(filters || {
    retailerType: "",
    state: "",
    minRevenue: 0,
  });

  useEffect(() => {
    if (dateRange) setLocalDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (filters) setLocalFilters(filters);
  }, [filters]);

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
            setLoading(false);
          })
          .catch(() => {
            setRetailers(connected);
            setLoading(false);
          });
      }
    );
    unsubscribers.push(connectedUnsub);

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [distributorId]);

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

  // Calculate retailer metrics with detailed order history
  const retailerMetrics = useMemo(() => {
    const metrics = {};
    const retailerMap = {};

    retailers.forEach((r) => {
      retailerMap[r.id] = r;
      if (r.provisionalId) retailerMap[r.provisionalId] = r;
    });

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

      const orderTotal = calculateOrderTotal(order);
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
          orderFrequency: 0,
          daysSinceLastOrder: null,
          orderHistory: [], // Detailed order history
          productPreferences: {}, // What products they order frequently
        };
      }

      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );

      metrics[retailerId].totalOrders += 1;
      if (isDelivered) {
        metrics[retailerId].deliveredOrders += 1;
        metrics[retailerId].totalRevenue += orderTotal;

        if (isPaid) {
          metrics[retailerId].paidRevenue += orderTotal;
        } else {
          metrics[retailerId].pendingRevenue += orderTotal;
        }

        const profit = orderTotal * 0.15; // Assuming 15% average profit margin
        metrics[retailerId].totalProfit += profit;
      }

      if (!metrics[retailerId].firstOrderDate || orderDate.isBefore(metrics[retailerId].firstOrderDate)) {
        metrics[retailerId].firstOrderDate = orderDate;
      }
      if (!metrics[retailerId].lastOrderDate || orderDate.isAfter(metrics[retailerId].lastOrderDate)) {
        metrics[retailerId].lastOrderDate = orderDate;
      }

      // Extract payment mode as string (handle both string and object cases)
      let paymentModeStr = "Unknown";
      if (order.paymentModeLabel) {
        paymentModeStr = order.paymentModeLabel;
      } else if (order.paymentMode) {
        if (typeof order.paymentMode === "string") {
          paymentModeStr = order.paymentMode;
        } else if (typeof order.paymentMode === "object" && order.paymentMode.label) {
          paymentModeStr = order.paymentMode.label;
        } else if (typeof order.paymentMode === "object" && order.paymentMode.code) {
          paymentModeStr = order.paymentMode.code;
        }
      } else if (order.paymentNormalized) {
        if (typeof order.paymentNormalized === "object" && order.paymentNormalized.label) {
          paymentModeStr = order.paymentNormalized.label;
        } else if (typeof order.paymentNormalized === "object" && order.paymentNormalized.code) {
          paymentModeStr = order.paymentNormalized.code;
        }
      }

      // Extract status as string (ensure it's always a string)
      let statusStr = "Unknown";
      if (order.status) {
        statusStr = typeof order.status === "string" ? order.status : String(order.status);
      } else if (order.statusCode) {
        statusStr = typeof order.statusCode === "string" ? order.statusCode : String(order.statusCode);
      }

      // Add to order history
      metrics[retailerId].orderHistory.push({
        orderId: order.id,
        date: orderDate,
        total: orderTotal,
        status: statusStr,
        isPaid,
        isDelivered,
        items: order.items || [],
        paymentMode: paymentModeStr,
      });

      // Track product preferences
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const productName = item.productName || item.name || "Unknown";
          if (!metrics[retailerId].productPreferences[productName]) {
            metrics[retailerId].productPreferences[productName] = {
              name: productName,
              count: 0,
              totalQty: 0,
              totalRevenue: 0,
            };
          }
          metrics[retailerId].productPreferences[productName].count += 1;
          metrics[retailerId].productPreferences[productName].totalQty += Number(item.quantity || item.qty || 0);
          metrics[retailerId].productPreferences[productName].totalRevenue +=
            Number(item.sellingPrice || item.price || item.unitPrice || 0) * Number(item.quantity || item.qty || 0);
        });
      }
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

      // Sort order history by date (newest first)
      m.orderHistory.sort((a, b) => b.date - a.date);

      // Sort product preferences by count
      m.topProducts = Object.values(m.productPreferences)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    });

    return Object.values(metrics);
  }, [retailers, filteredOrders]);

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

  // Filtered order history for selected retailer
  const filteredOrderHistory = useMemo(() => {
    if (!selectedRetailer) return [];
    const retailer = filteredMetrics.find((r) => r.id === selectedRetailer);
    if (!retailer) return [];

    let history = retailer.orderHistory;

    // Filter by date if provided
    if (orderFilterDate) {
      const filterDate = dayjs(orderFilterDate);
      history = history.filter((order) => {
        return order.date.format("YYYY-MM-DD") === filterDate.format("YYYY-MM-DD");
      });
    }

    return history;
  }, [selectedRetailer, filteredMetrics, orderFilterDate]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getColorClasses = (color) => {
    const colorMap = {
      emerald: {
        border: "border-emerald-500/30",
        bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20",
      },
      purple: {
        border: "border-purple-500/30",
        bg: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
      },
      blue: {
        border: "border-blue-500/30",
        bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
      },
      amber: {
        border: "border-amber-500/30",
        bg: "bg-gradient-to-br from-amber-500/20 to-amber-600/20",
      },
    };
    return colorMap[color] || colorMap.emerald;
  };

  const topRetailersByRevenue = useMemo(() => {
    return [...filteredMetrics]
      .filter((r) => r.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);
  }, [filteredMetrics]);

  const activeRetailers = useMemo(() => {
    return filteredMetrics.filter((r) => {
      const days = r.daysSinceLastOrder;
      return days !== null && days <= 30;
    });
  }, [filteredMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading retailer analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            Retailer Analytics
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Comprehensive retailer performance, order history, revenue, and activity insights
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
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

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Retailers",
            value: retailers.length,
            color: "emerald",
            icon: "🏪",
          },
          {
            label: "Active Retailers",
            value: activeRetailers.length,
            color: "blue",
            icon: "✨",
          },
          {
            label: "Total Revenue",
            value: formatCurrency(filteredMetrics.reduce((sum, r) => sum + r.totalRevenue, 0)),
            color: "purple",
            icon: "💰",
          },
          {
            label: "Pending Payments",
            value: formatCurrency(filteredMetrics.reduce((sum, r) => sum + r.pendingRevenue, 0)),
            color: "amber",
            icon: "⏳",
          },
        ].map((stat, idx) => {
          const colorClasses = getColorClasses(stat.color);
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-xl border ${colorClasses.border} ${colorClasses.bg} p-4`}
            >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{stat.icon}</span>
            </div>
              <p className="text-xs text-white/60 mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Two Column Layout: Retailer List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retailer List */}
        <div className="lg:col-span-1 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">All Retailers</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredMetrics
              .sort((a, b) => b.totalRevenue - a.totalRevenue)
              .map((retailer) => (
                <div
                  key={retailer.id}
                  onClick={() => setSelectedRetailer(retailer.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedRetailer === retailer.id
                      ? "bg-emerald-500/20 border-emerald-500/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <p className="font-semibold text-white">{retailer.name}</p>
                  <p className="text-xs text-white/60">
                    {retailer.city && retailer.state ? `${retailer.city}, ${retailer.state}` : retailer.email || retailer.phone}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-white/60">{retailer.totalOrders} orders</span>
                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(retailer.totalRevenue)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Retailer Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedRetailer ? (
            (() => {
              const retailer = filteredMetrics.find((r) => r.id === selectedRetailer);
              if (!retailer) return null;

              return (
                <>
                  {/* Retailer Summary */}
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-4">{retailer.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-white/60 mb-1">Total Orders</p>
                        <p className="text-xl font-bold text-white">{retailer.totalOrders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/60 mb-1">Total Revenue</p>
                        <p className="text-xl font-bold text-emerald-400">{formatCurrency(retailer.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/60 mb-1">Total Profit</p>
                        <p className="text-xl font-bold text-purple-400">{formatCurrency(retailer.totalProfit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/60 mb-1">Avg Order Value</p>
                        <p className="text-xl font-bold text-white">{formatCurrency(retailer.avgOrderValue)}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-white/60 mb-1">Location</p>
                        <p className="text-sm text-white">
                          {retailer.city && retailer.state ? `${retailer.city}, ${retailer.state}` : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/60 mb-1">Last Order</p>
                        <p className="text-sm text-white">
                          {retailer.lastOrderDate ? retailer.lastOrderDate.format("MMM DD, YYYY") : "Never"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/60 mb-1">Order Frequency</p>
                        <p className="text-sm text-white">{retailer.orderFrequency.toFixed(1)} orders/month</p>
                      </div>
                    </div>
                  </div>

                  {/* Product Preferences */}
                  {retailer.topProducts && retailer.topProducts.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Frequently Ordered Products</h3>
                      <div className="space-y-2">
                        {retailer.topProducts.map((product, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                          >
                            <div>
                              <p className="font-semibold text-white">{product.name}</p>
                              <p className="text-xs text-white/60">
                                Ordered {product.count} times • {product.totalQty} units
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-400">{formatCurrency(product.totalRevenue)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order History Filter */}
                  <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-white/80">Filter Orders by Date:</label>
                      <input
                        type="date"
                        value={orderFilterDate}
                        onChange={(e) => setOrderFilterDate(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      {orderFilterDate && (
                        <button
                          onClick={() => setOrderFilterDate("")}
                          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order History */}
                  <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Order History {orderFilterDate ? `(${dayjs(orderFilterDate).format("MMM DD, YYYY")})` : ""}
                    </h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {filteredOrderHistory.length === 0 ? (
                        <p className="text-white/60">No orders found for the selected date range.</p>
                      ) : (
                        filteredOrderHistory.map((order) => (
                          <div
                            key={order.orderId}
                            className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-semibold text-white">
                                  Order #{order.orderId.substring(0, 8)}...
                                </p>
                                <p className="text-xs text-white/60">
                                  {order.date.format("MMM DD, YYYY hh:mm A")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-400">{formatCurrency(order.total)}</p>
                                <p className="text-xs text-white/60">
                                  {order.isPaid ? (
                                    <span className="text-green-400">Paid</span>
                                  ) : (
                                    <span className="text-amber-400">Pending</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <p className="text-xs text-white/60 mb-1">Payment: {order.paymentMode}</p>
                              <p className="text-xs text-white/60 mb-2">Status: {order.status}</p>
                              {order.items && order.items.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-white/60 mb-1">Items ({order.items.length}):</p>
                                  <div className="space-y-1">
                                    {order.items.slice(0, 3).map((item, idx) => {
                                      const productName = item.productName || item.name || "Unknown Product";
                                      const qty = item.quantity || item.qty || 0;
                                      return (
                                        <p key={idx} className="text-xs text-white/80">
                                          • {String(productName)} (Qty: {Number(qty)})
                                        </p>
                                      );
                                    })}
                                    {order.items.length > 3 && (
                                      <p className="text-xs text-white/60">+ {order.items.length - 3} more items</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-12 text-center">
              <p className="text-white/60 text-lg">Select a retailer to view detailed analytics</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Retailers Summary */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Top 10 Retailers by Revenue</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 px-3 text-white/80">Retailer</th>
                <th className="text-left py-2 px-3 text-white/80">Type</th>
                <th className="text-left py-2 px-3 text-white/80">Location</th>
                <th className="text-right py-2 px-3 text-white/80">Orders</th>
                <th className="text-right py-2 px-3 text-white/80">Revenue</th>
                <th className="text-right py-2 px-3 text-white/80">Profit</th>
                <th className="text-right py-2 px-3 text-white/80">Avg Order</th>
                <th className="text-right py-2 px-3 text-white/80">Last Order</th>
              </tr>
            </thead>
            <tbody>
              {topRetailersByRevenue.map((retailer) => (
                <tr
                  key={retailer.id}
                  onClick={() => setSelectedRetailer(retailer.id)}
                  className="border-b border-white/10 hover:bg-white/5 cursor-pointer"
                >
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

export default EnhancedRetailerAnalytics;

