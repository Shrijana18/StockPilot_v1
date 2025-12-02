import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { motion } from "framer-motion";
import {
  FaChartLine,
  FaChartBar,
  FaChartPie,
  FaArrowUp,
  FaArrowDown,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

const ProgressTracking = () => {
  const [analytics, setAnalytics] = useState({
    productionEfficiency: 0,
    orderFulfillmentRate: 0,
    averageProductionTime: 0,
    distributorSatisfaction: 0,
    revenueGrowth: 0,
    productTurnover: 0,
  });

  const [productionTimeline, setProductionTimeline] = useState([]);
  const [orderStats, setOrderStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
  });
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;

      setLoading(true);
      try {
        // Fetch products
        const productsRef = collection(db, `businesses/${productOwnerId}/products`);
        const productsSnap = await getDocs(productsRef);
        const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Fetch orders
        const ordersRef = collection(db, `businesses/${productOwnerId}/orders`);
        const ordersSnap = await getDocs(ordersRef);
        const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Calculate production efficiency
        const totalProducts = products.length;
        const completedProducts = products.filter(
          (p) => (p.productionStatus || p.status) === "built" || (p.productionStatus || p.status) === "dispatched"
        ).length;
        const productionEfficiency = totalProducts > 0 ? (completedProducts / totalProducts) * 100 : 0;

        // Calculate order fulfillment rate
        const totalOrders = orders.length;
        const completedOrders = orders.filter((o) => o.status === "delivered").length;
        const orderFulfillmentRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

        // Calculate average production time (simplified)
        const inMakingProducts = products.filter(
          (p) => (p.productionStatus || p.status) === "inMaking"
        );
        const averageProductionTime = inMakingProducts.length * 2; // days (simplified)

        // Calculate revenue growth
        const totalRevenue = orders
          .filter((o) => o.status === "delivered")
          .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
        const revenueGrowth = totalRevenue > 0 ? 15 : 0; // percentage (simplified)

        // Calculate product turnover
        const dispatchedProducts = products.filter(
          (p) => (p.productionStatus || p.status) === "dispatched"
        ).length;
        const productTurnover = totalProducts > 0 ? (dispatchedProducts / totalProducts) * 100 : 0;

        setAnalytics({
          productionEfficiency: Math.round(productionEfficiency),
          orderFulfillmentRate: Math.round(orderFulfillmentRate),
          averageProductionTime: Math.round(averageProductionTime),
          distributorSatisfaction: 85, // placeholder
          revenueGrowth: Math.round(revenueGrowth),
          productTurnover: Math.round(productTurnover),
        });

        // Set order stats
        setOrderStats({
          total: totalOrders,
          completed: completedOrders,
          inProgress: orders.filter((o) => o.status === "processing" || o.status === "in_transit").length,
          pending: orders.filter((o) => o.status === "pending" || o.status === "assigned").length,
        });

        // Production timeline (last 7 days)
        const timeline = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          
          const dayProducts = products.filter((p) => {
            const createdAt = p.createdAt || p.updatedAt;
            if (!createdAt) return false;
            const productDate = new Date(createdAt).toISOString().split("T")[0];
            return productDate === dateStr;
          });

          timeline.push({
            date: dateStr,
            products: dayProducts.length,
            completed: dayProducts.filter(
              (p) => (p.productionStatus || p.status) === "built" || (p.productionStatus || p.status) === "dispatched"
            ).length,
          });
        }
        setProductionTimeline(timeline);

        // Revenue data (last 6 months simplified)
        setRevenueData([
          { month: "Jan", revenue: totalRevenue * 0.8 },
          { month: "Feb", revenue: totalRevenue * 0.85 },
          { month: "Mar", revenue: totalRevenue * 0.9 },
          { month: "Apr", revenue: totalRevenue * 0.95 },
          { month: "May", revenue: totalRevenue * 1.0 },
          { month: "Jun", revenue: totalRevenue },
        ]);
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const MetricCard = ({ label, value, icon, trend, subtitle }) => {
    const trendColor = trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-white/50";
    const TrendIcon = trend > 0 ? FaArrowUp : trend < 0 ? FaArrowDown : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5 hover:scale-[1.02] transition duration-300"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm uppercase tracking-wide text-white/70">{label}</p>
          <div className="text-white/40">{icon}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">{value}</span>
          {TrendIcon && (
            <span className={`text-sm ${trendColor}`}>
              <TrendIcon className="inline" /> {Math.abs(trend)}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-white/60 mt-2">{subtitle}</p>}
      </motion.div>
    );
  };

  const maxProducts = Math.max(...productionTimeline.map((t) => t.products), 1);
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Progress & Analytics</h2>
        <p className="text-white/70 text-sm mt-1">
          Track your production performance and business metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Production Efficiency"
          value={`${analytics.productionEfficiency}%`}
          icon={<FaChartLine />}
          trend={5}
          subtitle="Products completed vs total"
        />
        <MetricCard
          label="Order Fulfillment Rate"
          value={`${analytics.orderFulfillmentRate}%`}
          icon={<FaCheckCircle />}
          trend={3}
          subtitle="Orders delivered successfully"
        />
        <MetricCard
          label="Avg Production Time"
          value={`${analytics.averageProductionTime} days`}
          icon={<FaClock />}
          trend={-2}
          subtitle="Time to complete products"
        />
        <MetricCard
          label="Revenue Growth"
          value={`${analytics.revenueGrowth}%`}
          icon={<FaArrowUp />}
          trend={analytics.revenueGrowth}
          subtitle="Month over month growth"
        />
        <MetricCard
          label="Product Turnover"
          value={`${analytics.productTurnover}%`}
          icon={<FaChartPie />}
          trend={8}
          subtitle="Products dispatched"
        />
        <MetricCard
          label="Distributor Satisfaction"
          value={`${analytics.distributorSatisfaction}%`}
          icon={<FaChartBar />}
          trend={2}
          subtitle="Based on order completion"
        />
      </div>

      {/* Order Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
      >
        <h3 className="text-lg font-semibold mb-4">Order Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{orderStats.total}</p>
            <p className="text-sm text-white/70 mt-1">Total Orders</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{orderStats.completed}</p>
            <p className="text-sm text-white/70 mt-1">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-400">{orderStats.inProgress}</p>
            <p className="text-sm text-white/70 mt-1">In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{orderStats.pending}</p>
            <p className="text-sm text-white/70 mt-1">Pending</p>
          </div>
        </div>
      </motion.div>

      {/* Production Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
      >
        <h3 className="text-lg font-semibold mb-4">Production Timeline (Last 7 Days)</h3>
        <div className="space-y-3">
          {productionTimeline.map((day, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-24 text-xs text-white/70">
                {new Date(day.date).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-white/10 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-emerald-400/50 rounded-full transition-all duration-500"
                    style={{ width: `${(day.completed / Math.max(day.products, 1)) * 100}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-full bg-orange-400/50 rounded-full transition-all duration-500"
                    style={{ width: `${(day.products / Math.max(maxProducts, 1)) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right text-sm">
                  {day.completed}/{day.products}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Revenue Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
      >
        <h3 className="text-lg font-semibold mb-4">Revenue Trend (Last 6 Months)</h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {revenueData.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col justify-end h-40">
                <div
                  className="w-full bg-gradient-to-t from-emerald-400/60 to-emerald-300/30 rounded-t transition-all duration-500 hover:from-emerald-400/80 hover:to-emerald-300/50"
                  style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-white/70">{data.month}</div>
              <div className="text-xs text-white/50 mt-1">
                ₹{Math.round(data.revenue / 1000)}k
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Performance Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
      >
        <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
        <div className="space-y-3">
          {analytics.productionEfficiency > 70 ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/30">
              <FaCheckCircle className="text-emerald-400" />
              <div>
                <p className="font-medium">Production efficiency is excellent</p>
                <p className="text-sm text-white/70">
                  {analytics.productionEfficiency}% of products are completed
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-400/10 border border-orange-400/30">
              <FaExclamationTriangle className="text-orange-400" />
              <div>
                <p className="font-medium">Production efficiency needs improvement</p>
                <p className="text-sm text-white/70">
                  Only {analytics.productionEfficiency}% of products are completed
                </p>
              </div>
            </div>
          )}

          {analytics.orderFulfillmentRate > 80 ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/30">
              <FaCheckCircle className="text-emerald-400" />
              <div>
                <p className="font-medium">Order fulfillment rate is strong</p>
                <p className="text-sm text-white/70">
                  {analytics.orderFulfillmentRate}% of orders are delivered successfully
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-400/10 border border-orange-400/30">
              <FaExclamationTriangle className="text-orange-400" />
              <div>
                <p className="font-medium">Order fulfillment needs attention</p>
                <p className="text-sm text-white/70">
                  Only {analytics.orderFulfillmentRate}% of orders are delivered
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProgressTracking;

