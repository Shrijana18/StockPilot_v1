import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FaIndustry, FaCheckCircle, FaTruck, FaBox, FaChartLine, FaClock, FaExclamationTriangle } from "react-icons/fa";

const ProductOwnerHome = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    productsInMaking: 0,
    productsBuilt: 0,
    productsDispatched: 0,
    totalProducts: 0,
    totalDistributors: 0,
    activeOrders: 0,
    totalRevenue: 0,
    pendingDeliveries: 0,
  });

  const [productionStatus, setProductionStatus] = useState({
    inMaking: [],
    built: [],
    dispatched: [],
  });

  const [userInfo, setUserInfo] = useState({ ownerName: "", businessName: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, "businesses", uid));
        if (snap.exists()) {
          const d = snap.data();
          setUserInfo({
            ownerName: d.ownerName || d.name || d.userName || "",
            businessName: d.businessName || d.name || "",
          });
        }
      } catch (e) {
        console.error("Failed to load product owner profile", e);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;

      setLoading(true);
      try {
        // Fetch products with production status
        const productsRef = collection(db, `businesses/${productOwnerId}/products`);
        const productsSnap = await getDocs(productsRef);

        const inMaking = [];
        const built = [];
        const dispatched = [];

        let totalProducts = 0;
        let productsInMaking = 0;
        let productsBuilt = 0;
        let productsDispatched = 0;

        productsSnap.forEach((doc) => {
          const product = { id: doc.id, ...doc.data() };
          totalProducts++;
          
          const status = product.productionStatus || product.status || "inMaking";
          
          if (status === "inMaking" || status === "in_production") {
            productsInMaking++;
            inMaking.push(product);
          } else if (status === "built" || status === "completed" || status === "ready") {
            productsBuilt++;
            built.push(product);
          } else if (status === "dispatched" || status === "shipped") {
            productsDispatched++;
            dispatched.push(product);
          }
        });

        // Fetch connected distributors
        const distributorsRef = collection(db, `businesses/${productOwnerId}/connectedDistributors`);
        const distributorsSnap = await getDocs(distributorsRef);
        const totalDistributors = distributorsSnap.size;

        // Fetch orders
        const ordersRef = collection(db, `businesses/${productOwnerId}/orders`);
        const ordersSnap = await getDocs(ordersRef);
        
        let activeOrders = 0;
        let totalRevenue = 0;
        let pendingDeliveries = 0;

        ordersSnap.forEach((doc) => {
          const order = doc.data();
          if (order.status === "pending" || order.status === "processing" || order.status === "accepted") {
            activeOrders++;
          }
          if (order.status === "dispatched" || order.status === "in_transit") {
            pendingDeliveries++;
          }
          if (order.status === "delivered" && order.totalAmount) {
            totalRevenue += Number(order.totalAmount) || 0;
          }
        });

        setStats({
          productsInMaking,
          productsBuilt,
          productsDispatched,
          totalProducts,
          totalDistributors,
          activeOrders,
          totalRevenue,
          pendingDeliveries,
        });

        setProductionStatus({
          inMaking: inMaking.slice(0, 5),
          built: built.slice(0, 5),
          dispatched: dispatched.slice(0, 5),
        });
      } catch (err) {
        console.error("Error loading product owner dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const StatCard = ({ label, value, icon, tone = "default", subtitle }) => {
    const toneMap = {
      default: "text-white",
      yellow: "text-amber-300",
      green: "text-emerald-300",
      blue: "text-cyan-300",
      purple: "text-fuchsia-300",
      orange: "text-orange-300",
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4 hover:scale-[1.02] transition duration-300"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
          <div className="text-white/40">{icon}</div>
        </div>
        <div className={`text-2xl font-semibold ${toneMap[tone] || toneMap.default}`}>
          {loading ? "..." : value}
        </div>
        {subtitle && <p className="text-xs text-white/60 mt-1">{subtitle}</p>}
      </motion.div>
    );
  };

  const ProductionCard = ({ product, status }) => {
    const statusColors = {
      inMaking: "border-orange-400/30 bg-orange-400/10",
      built: "border-emerald-400/30 bg-emerald-400/10",
      dispatched: "border-blue-400/30 bg-blue-400/10",
    };

    const statusIcons = {
      inMaking: <FaClock className="text-orange-400" />,
      built: <FaCheckCircle className="text-emerald-400" />,
      dispatched: <FaTruck className="text-blue-400" />,
    };

    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`rounded-lg border ${statusColors[status]} p-3 mb-2`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-white text-sm">{product.name || "Unnamed Product"}</h4>
            <p className="text-xs text-white/70 mt-1">
              {product.sku && `SKU: ${product.sku}`}
              {product.quantity && ` • Qty: ${product.quantity}`}
            </p>
          </div>
          <div className="ml-2">{statusIcons[status]}</div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4"
    >
      {/* Welcome Header */}
      <div className="mb-6">
        <div className="text-sm text-white/60">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
          Welcome back, <span className="text-emerald-300">{userInfo.ownerName || "Product Owner"}</span> ✦
        </h2>
        <p className="mt-2 text-white/70">{userInfo.businessName || "Production Dashboard"}</p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Products in Making"
          value={stats.productsInMaking}
          icon={<FaIndustry />}
          tone="orange"
          subtitle={`Out of ${stats.totalProducts} total`}
        />
        <StatCard
          label="Products Built"
          value={stats.productsBuilt}
          icon={<FaCheckCircle />}
          tone="green"
          subtitle="Ready for dispatch"
        />
        <StatCard
          label="Products Dispatched"
          value={stats.productsDispatched}
          icon={<FaTruck />}
          tone="blue"
          subtitle={`${stats.pendingDeliveries} in transit`}
        />
        <StatCard
          label="Total Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          icon={<FaChartLine />}
          tone="purple"
          subtitle="From delivered orders"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Connected Distributors"
          value={stats.totalDistributors}
          icon={<FaBox />}
          tone="default"
        />
        <StatCard
          label="Active Orders"
          value={stats.activeOrders}
          icon={<FaClock />}
          tone="yellow"
        />
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          icon={<FaBox />}
          tone="default"
        />
      </div>

      {/* Production Status Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Products in Making */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <FaClock className="text-orange-400" />
            <h3 className="font-semibold text-lg">Products in Making</h3>
            <span className="ml-auto px-2 py-1 rounded-full bg-orange-400/20 text-orange-300 text-xs">
              {productionStatus.inMaking.length}
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {productionStatus.inMaking.length > 0 ? (
              productionStatus.inMaking.map((product) => (
                <ProductionCard key={product.id} product={product} status="inMaking" />
              ))
            ) : (
              <p className="text-white/50 text-sm text-center py-4">No products in production</p>
            )}
          </div>
        </motion.div>

        {/* Products Built */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <FaCheckCircle className="text-emerald-400" />
            <h3 className="font-semibold text-lg">Products Built</h3>
            <span className="ml-auto px-2 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-xs">
              {productionStatus.built.length}
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {productionStatus.built.length > 0 ? (
              productionStatus.built.map((product) => (
                <ProductionCard key={product.id} product={product} status="built" />
              ))
            ) : (
              <p className="text-white/50 text-sm text-center py-4">No products ready yet</p>
            )}
          </div>
        </motion.div>

        {/* Products Dispatched */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <FaTruck className="text-blue-400" />
            <h3 className="font-semibold text-lg">Products Dispatched</h3>
            <span className="ml-auto px-2 py-1 rounded-full bg-blue-400/20 text-blue-300 text-xs">
              {productionStatus.dispatched.length}
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {productionStatus.dispatched.length > 0 ? (
              productionStatus.dispatched.map((product) => (
                <ProductionCard key={product.id} product={product} status="dispatched" />
              ))
            ) : (
              <p className="text-white/50 text-sm text-center py-4">No products dispatched yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-5"
      >
        <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="px-4 py-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 transition">
            Create Product
          </button>
          <button className="px-4 py-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 transition">
            Assign Distributor
          </button>
          <button className="px-4 py-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-300 transition">
            Track Orders
          </button>
          <button className="px-4 py-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 text-orange-300 transition">
            View Reports
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProductOwnerHome;

