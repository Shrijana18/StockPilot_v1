import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import dayjs from "dayjs";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

// Import analytics components
import OverviewAnalytics from "./OverviewAnalytics";
import EnhancedProductAnalytics from "./EnhancedProductAnalytics";
import EnhancedRetailerAnalytics from "./EnhancedRetailerAnalytics";
import RevenueProfitAnalytics from "./RevenueProfitAnalytics";
import CategoryBrandAnalytics from "./CategoryBrandAnalytics";
import DispatchSpeedTracker from "./DispatchSpeedTracker";
import InventoryDrainForecast from "./InventoryDrainForecast";
import RetailerDependencyRisk from "./RetailerDependencyRisk";
import BrandPerformanceTracker from "./BrandPerformanceTracker";
import DailySmartSummary from "./DailySmartSummary";

const DistributorAnalytics = ({ distributorId }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [filters, setFilters] = useState({
    brand: "",
    category: "",
    retailerType: "",
    state: "",
    minRevenue: 0,
    minProfit: 0,
  });
  const [summaryStats, setSummaryStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProfit: 0,
    activeRetailers: 0,
    totalProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [products, setProducts] = useState([]);

  // Helper function to calculate order total (matches OrderRequests logic)
  const calculateOrderTotal = (order) => {
    // Try chargesSnapshot first (most accurate)
    if (order?.chargesSnapshot?.breakdown?.grandTotal) {
      return Number(order.chargesSnapshot.breakdown.grandTotal);
    }
    // Try proforma
    if (order?.proforma?.grandTotal) {
      return Number(order.proforma.grandTotal);
    }
    // Try items calculation
    if (order?.items && Array.isArray(order.items)) {
      return order.items.reduce((sum, item) => {
        const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const qty = Number(item.quantity || item.qty || 0);
        return sum + price * qty;
      }, 0);
    }
    return 0;
  };

  // Fetch all data with real-time updates
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
      },
      (err) => {
        console.error("[DistributorAnalytics] Error fetching orders:", err);
        setOrders([]);
      }
    );
    unsubscribers.push(ordersUnsub);

    // Subscribe to retailers
    const connectedUnsub = onSnapshot(
      collection(db, `businesses/${distributorId}/connectedRetailers`),
      (snapshot) => {
        const connected = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), type: "connected" }));
        
        // Also fetch provisional
        getDocs(collection(db, `businesses/${distributorId}/provisionalRetailers`))
          .then((provisionalSnap) => {
            const provisional = provisionalSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              type: "provisional",
            }));
            setRetailers([...connected, ...provisional]);
          })
          .catch((err) => {
            console.error("[DistributorAnalytics] Error fetching provisional retailers:", err);
            setRetailers(connected);
          });
      },
      (err) => {
        console.error("[DistributorAnalytics] Error fetching retailers:", err);
        setRetailers([]);
      }
    );
    unsubscribers.push(connectedUnsub);

    // Fetch products (one-time, not real-time for performance)
    getDocs(collection(db, `businesses/${distributorId}/products`))
      .then((snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProducts(productsData);
      })
      .catch((err) => {
        console.error("[DistributorAnalytics] Error fetching products:", err);
        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [distributorId]);

  // Calculate summary stats from orders
  useEffect(() => {
    if (orders.length === 0 && retailers.length === 0 && products.length === 0) {
      if (!loading) {
        setSummaryStats({
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
          activeRetailers: 0,
          totalProducts: 0,
        });
      }
      return;
    }

    // Calculate stats from all orders (not just delivered)
    const allOrders = orders;
    const deliveredOrders = allOrders.filter(
      (o) =>
        o.status === "Delivered" ||
        o.statusCode === "DELIVERED" ||
        o.status === "delivered" ||
        o.statusCode === "delivered"
    );

    // Calculate revenue from delivered orders
    const totalRevenue = deliveredOrders.reduce((sum, order) => {
      const total = calculateOrderTotal(order);
      return sum + total;
    }, 0);

    // Calculate profit (estimate 15% margin, but can be improved with actual cost data)
    const totalProfit = deliveredOrders.reduce((sum, order) => {
      const revenue = calculateOrderTotal(order);
      // Try to get actual profit from items if available
      if (order.items && Array.isArray(order.items)) {
        const profit = order.items.reduce((itemSum, item) => {
          const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
          const costPrice = Number(item.costPrice || item.distributorPrice || 0);
          const qty = Number(item.quantity || item.qty || 0);
          return itemSum + (sellingPrice - costPrice) * qty;
        }, 0);
        return sum + profit;
      }
      // Fallback to 15% margin
      return sum + revenue * 0.15;
    }, 0);

    // Active retailers (ordered in last 30 days)
    const activeRetailerIds = new Set();
    const thirtyDaysAgo = dayjs().subtract(30, "day");
    allOrders.forEach((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() ||
          order.timestamp ||
          order.createdAt?.toDate?.() ||
          order.createdAt ||
          new Date()
      );
      if (orderDate.isAfter(thirtyDaysAgo)) {
        const retailerId = order.retailerId || order.provisionalRetailerId;
        if (retailerId) activeRetailerIds.add(retailerId);
      }
    });

    setSummaryStats({
      totalOrders: deliveredOrders.length,
      totalRevenue,
      totalProfit,
      activeRetailers: activeRetailerIds.size,
      totalProducts: products.length,
    });
  }, [orders, retailers, products, loading]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const tabs = [
    { id: "overview", label: t("analytics.overview"), icon: "📊" },
    { id: "products", label: t("analytics.products"), icon: "📦" },
    { id: "retailers", label: t("analytics.retailers"), icon: "🏪" },
    { id: "revenue", label: t("analytics.revenueProfit"), icon: "💰" },
    { id: "categories", label: t("analytics.categoriesBrands"), icon: "🏷️" },
    { id: "insights", label: t("analytics.advancedInsights"), icon: "🔍" },
  ];

  const handleQuickFilter = (value) => {
    if (value === "today") {
      setDateRange({
        start: dayjs().format("YYYY-MM-DD"),
        end: dayjs().format("YYYY-MM-DD"),
      });
    } else if (value === "week") {
      setDateRange({
        start: dayjs().subtract(7, "day").format("YYYY-MM-DD"),
        end: dayjs().format("YYYY-MM-DD"),
      });
    } else if (value === "month") {
      setDateRange({
        start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
        end: dayjs().format("YYYY-MM-DD"),
      });
    } else if (value === "quarter") {
      setDateRange({
        start: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
        end: dayjs().format("YYYY-MM-DD"),
      });
    } else if (value === "year") {
      setDateRange({
        start: dayjs().subtract(365, "day").format("YYYY-MM-DD"),
        end: dayjs().format("YYYY-MM-DD"),
      });
    }
  };

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  };
  const stagger = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: { delayChildren: 0.1, staggerChildren: 0.08 },
    },
  };
  const cardVariant = {
    hidden: { opacity: 0, scale: 0.96, y: 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="w-full">
      <style>{`
        .vignette { position: relative; }
        .vignette:before { content: ""; position: absolute; inset: 0; border-radius: 0.75rem; pointer-events: none; box-shadow: inset 0 0 120px rgba(0,0,0,.18); }
        .vignette:after { content: ""; position: absolute; inset: 0; border-radius: 0.75rem; pointer-events: none; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          background-size: 1000px 100%;
          animation: shimmer 3s infinite;
        }
      `}</style>
      <div className="w-full space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200 mb-2 tracking-tight">
              {t("analytics.title")}
            </h1>
            <p className="text-white/60 text-sm md:text-base">{t("analytics.subtitle")}</p>
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="h-px w-32 origin-left bg-gradient-to-r from-emerald-300/60 to-transparent mt-2"
            />
          </div>
        </motion.div>

        {/* Tabs - Sticky positioned */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="sticky top-0 z-20 bg-[#0B1220]/90 backdrop-blur-xl border-b border-white/10 pb-2 -mx-4 md:-mx-6 px-4 md:px-6 pt-2 shadow-lg"
        >
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className={`relative px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/20"
                    : "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {loading && activeTab === "overview" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center text-white/60 vignette"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span>{t("analytics.loadingAnalytics")}</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === "overview" && (
                  <OverviewAnalytics distributorId={distributorId} dateRange={dateRange} />
                )}

              {activeTab === "products" && (
                <EnhancedProductAnalytics
                  distributorId={distributorId}
                  dateRange={dateRange}
                  filters={filters}
                  onDateRangeChange={setDateRange}
                  onFiltersChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
                />
              )}

              {activeTab === "retailers" && (
                <EnhancedRetailerAnalytics
                  distributorId={distributorId}
                  dateRange={dateRange}
                  filters={filters}
                  onDateRangeChange={setDateRange}
                  onFiltersChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
                />
              )}

              {activeTab === "revenue" && (
                <RevenueProfitAnalytics
                  distributorId={distributorId}
                  dateRange={dateRange}
                  filters={filters}
                  onDateRangeChange={setDateRange}
                />
              )}

              {activeTab === "categories" && (
                <CategoryBrandAnalytics
                  distributorId={distributorId}
                  dateRange={dateRange}
                  filters={filters}
                  onDateRangeChange={setDateRange}
                />
              )}

                {activeTab === "insights" && (
                  <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
                    <DispatchSpeedTracker distributorId={distributorId} />
                    <InventoryDrainForecast distributorId={distributorId} />
                    <RetailerDependencyRisk distributorId={distributorId} />
                    <BrandPerformanceTracker distributorId={distributorId} />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default DistributorAnalytics;
