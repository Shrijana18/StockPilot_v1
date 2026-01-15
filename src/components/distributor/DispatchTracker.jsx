import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFirestore, collection, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import OrderRequests from "./orders/OrderRequests";
import PendingOrders from "./orders/PendingOrders";
import TrackOrders from "./orders/TrackOrders";
import PassiveOrders from "./orders/PassiveOrders";
import DeliveryRoutes from "./orders/DeliveryRoutes";
import { 
  FiPackage, FiTruck, FiCheckCircle, FiClock, FiTrendingUp,
  FiAlertCircle, FiBarChart2, FiZap, FiSearch, FiFilter,
  FiArrowRight, FiRefreshCw, FiDownload, FiEye, FiActivity,
  FiDollarSign, FiUsers, FiShoppingCart, FiMapPin, FiCalendar,
  FiSettings, FiMap, FiBell, FiShield, FiLink, FiSave
} from "react-icons/fi";
import { ORDER_STATUSES, codeOf } from "../../constants/orderStatus";

const DispatchTracker = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTimeRange, setSelectedTimeRange] = useState("today");

  const db = getFirestore();
  const auth = getAuth();

  // Load all orders for dashboard insights
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');
      const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
        const orderData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(orderData);
        setLoading(false);
      });

      return () => unsubscribe();
    });

    return () => unsubscribeAuth();
  }, []);

  // Map between our internal ids and URL tab names
  const idToUrlTab = {
    overview: 'overview',
    requests: 'order-requests',
    create: 'create-order',
    pending: 'pending-orders',
    completed: 'track-orders',
    routes: 'delivery-routes',
    settings: 'settings',
  };
  const urlTabToId = {
    'overview': 'overview',
    'order-requests': 'requests',
    'create-order': 'create',
    'pending-orders': 'pending',
    'track-orders': 'completed',
    'delivery-routes': 'routes',
    'settings': 'settings',
  };

  // Read tab from location hash on mount and whenever the hash changes
  useEffect(() => {
    const applyFromHash = () => {
      const hash = window.location.hash || '';
      const qIndex = hash.indexOf('?');
      if (qIndex === -1) {
        setActiveTab('overview');
        return;
      }
      const params = new URLSearchParams(hash.substring(qIndex + 1));
      const tab = (params.get('tab') || '').toLowerCase();
      if (urlTabToId[tab]) {
        setActiveTab(urlTabToId[tab]);
      } else {
        setActiveTab('overview');
      }
    };
    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  // When user clicks a tab, update state and URL hash
  const setTabAndHash = (id) => {
    setActiveTab(id);
    try {
      const hash = window.location.hash || '#/distributor-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      const urlTab = idToUrlTab[id] || 'overview';
      params.set('tab', urlTab);
      if (urlTab !== 'track-orders') {
        params.delete('sub');
      }
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) window.history.replaceState(null, '', newHash);
    } catch {}
  };

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(today.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(today.getMonth() - 1);

    const filterByTime = (order) => {
      const orderDate = order.createdAt?.toDate?.() || order.timestamp?.toDate?.() || new Date(order.createdAt || order.timestamp);
      switch (selectedTimeRange) {
        case 'today':
          return orderDate >= today;
        case 'week':
          return orderDate >= thisWeek;
        case 'month':
          return orderDate >= thisMonth;
        default:
          return true;
      }
    };

    const filteredOrders = orders.filter(filterByTime);

    const requested = filteredOrders.filter(o => {
      const code = codeOf(o.statusCode || o.status);
      return code === ORDER_STATUSES.REQUESTED || code === ORDER_STATUSES.QUOTED;
    });
    const pending = filteredOrders.filter(o => {
      const code = codeOf(o.statusCode || o.status);
      return code === ORDER_STATUSES.ACCEPTED || code === ORDER_STATUSES.MODIFIED || code === ORDER_STATUSES.PACKED;
    });
    const inTransit = filteredOrders.filter(o => {
      const code = codeOf(o.statusCode || o.status);
      return code === ORDER_STATUSES.SHIPPED || code === ORDER_STATUSES.OUT_FOR_DELIVERY;
    });
    const delivered = filteredOrders.filter(o => {
      const code = codeOf(o.statusCode || o.status);
      return code === ORDER_STATUSES.DELIVERED;
    });

    const totalValue = filteredOrders.reduce((sum, o) => {
      const total = o.proforma?.grandTotal || o.chargesSnapshot?.breakdown?.grandTotal || 0;
      return sum + Number(total);
    }, 0);

    const deliveredValue = delivered.reduce((sum, o) => {
      const total = o.proforma?.grandTotal || o.chargesSnapshot?.breakdown?.grandTotal || 0;
      return sum + Number(total);
    }, 0);

    const avgOrderValue = filteredOrders.length > 0 ? totalValue / filteredOrders.length : 0;
    const deliveryRate = filteredOrders.length > 0 ? (delivered.length / filteredOrders.length) * 100 : 0;
    const avgDeliveryTime = delivered.length > 0 
      ? delivered.reduce((sum, o) => {
          const shipped = o.statusTimestamps?.shippedAt?.seconds || o.statusTimestamps?.shippedAt;
          const delivered = o.statusTimestamps?.deliveredAt?.seconds || o.statusTimestamps?.deliveredAt;
          if (shipped && delivered) {
            return sum + ((delivered - shipped) / 86400); // days
          }
          return sum;
        }, 0) / delivered.length
      : 0;

    return {
      requested: requested.length,
      pending: pending.length,
      inTransit: inTransit.length,
      delivered: delivered.length,
      totalOrders: filteredOrders.length,
      totalValue,
      deliveredValue,
      avgOrderValue,
      deliveryRate: Math.round(deliveryRate),
      avgDeliveryTime: Math.round(avgDeliveryTime * 10) / 10,
    };
  }, [orders, selectedTimeRange]);

  // Order flow visualization data
  const orderFlowData = useMemo(() => {
    const flow = [
      { status: ORDER_STATUSES.REQUESTED, label: 'Requested', count: 0, color: 'blue', icon: FiPackage },
      { status: ORDER_STATUSES.QUOTED, label: 'Quoted', count: 0, color: 'cyan', icon: FiDollarSign },
      { status: ORDER_STATUSES.ACCEPTED, label: 'Accepted', count: 0, color: 'emerald', icon: FiCheckCircle },
      { status: ORDER_STATUSES.PACKED, label: 'Packed', count: 0, color: 'amber', icon: FiShoppingCart },
      { status: ORDER_STATUSES.SHIPPED, label: 'Shipped', count: 0, color: 'purple', icon: FiTruck },
      { status: ORDER_STATUSES.OUT_FOR_DELIVERY, label: 'Out for Delivery', count: 0, color: 'pink', icon: FiMapPin },
      { status: ORDER_STATUSES.DELIVERED, label: 'Delivered', count: 0, color: 'green', icon: FiCheckCircle },
    ];

    orders.forEach(order => {
      const code = codeOf(order.statusCode || order.status);
      const flowItem = flow.find(f => f.status === code);
      if (flowItem) {
        flowItem.count++;
      }
    });

    return flow;
  }, [orders]);

  const StatCard = ({ icon: Icon, label, value, subtitle, color, onClick, trend }) => (
    <motion.div
      whileHover={{ scale: 1.01, y: -4 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm ${
        color === 'blue' ? 'from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 hover:border-blue-500/50 hover:shadow-blue-500/20' :
        color === 'amber' ? 'from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 hover:border-amber-500/50 hover:shadow-amber-500/20' :
        color === 'purple' ? 'from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/20' :
        'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-emerald-500/20'
      }`}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className={`p-3.5 rounded-xl shadow-md ${
            color === 'blue' ? 'bg-blue-500/25' :
            color === 'amber' ? 'bg-amber-500/25' :
            color === 'purple' ? 'bg-purple-500/25' :
            'bg-emerald-500/25'
          }`}>
            {Icon && <Icon className={`w-6 h-6 ${
              color === 'blue' ? 'text-blue-300' :
              color === 'amber' ? 'text-amber-300' :
              color === 'purple' ? 'text-purple-300' :
              'text-emerald-300'
            }`} />}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold ${
              trend > 0 ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/25 text-rose-300 border border-rose-500/30'
            }`}>
              <FiTrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-white/70 text-sm font-semibold mb-2 tracking-wide uppercase">{label}</p>
        <p className="text-4xl font-bold text-white mb-2 tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {subtitle && <p className="text-xs text-white/60 font-medium">{subtitle}</p>}
      </div>
      <div className={`absolute inset-0 opacity-[0.03] ${
        color === 'blue' ? 'bg-blue-500' :
        color === 'amber' ? 'bg-amber-500' :
        color === 'purple' ? 'bg-purple-500' :
        'bg-emerald-500'
      }`} style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, currentColor 0%, transparent 50%)' }} />
    </motion.div>
  );

  const TabButton = ({ id, active, onClick, children, badge, icon: Icon }) => (
    <button
      onClick={() => onClick(id)}
      className={`relative flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/30"
          : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white"
      }`}
      aria-selected={active}
      role="tab"
    >
      {Icon && <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/60'}`} />}
      <span>{children}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold min-w-[22px] text-center ${
          active ? 'bg-white/30 text-white border border-white/20' : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-200 to-cyan-300 tracking-tight">
              Dispatch Tracker
            </h1>
            <p className="text-white/60 text-sm mt-1.5 font-medium">Enterprise Order Management System</p>
          </div>
          
          {/* Global Search & Filters */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-1 max-w-md min-w-[200px]">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, retailers, IDs..."
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
              />
            </div>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K')] bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pr-10 backdrop-blur-sm"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 shadow-lg">
          <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="Dispatch sections">
            <TabButton 
              id="overview" 
              active={activeTab === "overview"} 
              onClick={setTabAndHash}
              icon={FiBarChart2}
            >
              Overview
            </TabButton>
            <TabButton 
              id="requests" 
              active={activeTab === "requests"} 
              onClick={setTabAndHash}
              badge={dashboardMetrics.requested}
              icon={FiPackage}
            >
              Order Requests
            </TabButton>
            <TabButton 
              id="create" 
              active={activeTab === "create"} 
              onClick={setTabAndHash}
              icon={FiZap}
            >
              Create Order
            </TabButton>
            <TabButton 
              id="pending" 
              active={activeTab === "pending"} 
              onClick={setTabAndHash}
              badge={dashboardMetrics.pending}
              icon={FiClock}
            >
              Pending Orders
            </TabButton>
            <TabButton 
              id="completed" 
              active={activeTab === "completed"} 
              onClick={setTabAndHash}
              badge={dashboardMetrics.inTransit + dashboardMetrics.delivered}
              icon={FiTruck}
            >
              Track Orders
            </TabButton>
            <TabButton 
              id="routes" 
              active={activeTab === "routes"} 
              onClick={setTabAndHash}
              icon={FiTruck}
            >
              Delivery Routes
            </TabButton>
            <TabButton 
              id="settings" 
              active={activeTab === "settings"} 
              onClick={setTabAndHash}
              icon={FiSettings}
            >
              Settings
            </TabButton>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        {/* Overview Dashboard */}
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                  <FiRefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
                  <p className="text-white/70 text-sm font-medium">Loading dashboard analytics...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <StatCard
                    icon={FiPackage}
                    label="New Requests"
                    value={dashboardMetrics.requested}
                    subtitle="Awaiting action"
                    color="blue"
                    onClick={() => setTabAndHash('requests')}
                  />
                  <StatCard
                    icon={FiClock}
                    label="Pending Orders"
                    value={dashboardMetrics.pending}
                    subtitle="Ready to ship"
                    color="amber"
                    onClick={() => setTabAndHash('pending')}
                  />
                  <StatCard
                    icon={FiTruck}
                    label="In Transit"
                    value={dashboardMetrics.inTransit}
                    subtitle="On the way"
                    color="purple"
                    onClick={() => setTabAndHash('completed')}
                  />
                  <StatCard
                    icon={FiCheckCircle}
                    label="Delivered"
                    value={dashboardMetrics.delivered}
                    subtitle={`${dashboardMetrics.deliveryRate}% success rate`}
                    color="emerald"
                    onClick={() => setTabAndHash('completed')}
                  />
                </div>

                {/* Financial & Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Order Flow Pipeline */}
                  <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 shadow-md">
                          <FiActivity className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Order Flow Pipeline</h3>
                          <p className="text-xs text-white/60 font-medium">Real-time status distribution</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setTabAndHash('completed')}
                        className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-500/10"
                      >
                        View All <FiArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {orderFlowData.map((stage, index) => {
                        const totalOrders = orders.length || 1;
                        const percentage = (stage.count / totalOrders) * 100;
                        const isActive = stage.count > 0;
                        const Icon = stage.icon;
                        
                        const colorMap = {
                          blue: { bg: 'bg-blue-500/25', text: 'text-blue-300', gradient: 'from-blue-500 to-blue-400', icon: 'text-blue-300', border: 'border-blue-500/30' },
                          cyan: { bg: 'bg-cyan-500/25', text: 'text-cyan-300', gradient: 'from-cyan-500 to-cyan-400', icon: 'text-cyan-300', border: 'border-cyan-500/30' },
                          emerald: { bg: 'bg-emerald-500/25', text: 'text-emerald-300', gradient: 'from-emerald-500 to-emerald-400', icon: 'text-emerald-300', border: 'border-emerald-500/30' },
                          amber: { bg: 'bg-amber-500/25', text: 'text-amber-300', gradient: 'from-amber-500 to-amber-400', icon: 'text-amber-300', border: 'border-amber-500/30' },
                          purple: { bg: 'bg-purple-500/25', text: 'text-purple-300', gradient: 'from-purple-500 to-purple-400', icon: 'text-purple-300', border: 'border-purple-500/30' },
                          pink: { bg: 'bg-pink-500/25', text: 'text-pink-300', gradient: 'from-pink-500 to-pink-400', icon: 'text-pink-300', border: 'border-pink-500/30' },
                          green: { bg: 'bg-green-500/25', text: 'text-green-300', gradient: 'from-green-500 to-green-400', icon: 'text-green-300', border: 'border-green-500/30' },
                        };
                        
                        const colors = colorMap[stage.color] || colorMap.blue;
                        
                        return (
                          <div key={stage.status} className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm border ${isActive ? `${colors.bg} ${colors.border}` : 'bg-white/5 border-white/10'}`}>
                                  {Icon && <Icon className={`w-5 h-5 ${isActive ? colors.icon : 'text-white/30'}`} />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-white/50'}`}>
                                      {stage.label}
                                    </span>
                                    <span className={`text-sm font-bold ${isActive ? colors.text : 'text-white/40'}`}>
                                      {stage.count}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-white/60 ml-3 w-14 text-right font-semibold">{Math.round(percentage)}%</span>
                            </div>
                            <div className="h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                                className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} shadow-sm`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-emerald-500/25 shadow-md">
                          <FiDollarSign className="w-5 h-5 text-emerald-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Total Value</p>
                          <p className="text-2xl font-bold text-white tracking-tight">₹{dashboardMetrics.totalValue.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                        <FiTrendingUp className="w-3.5 h-3.5" />
                        <span>{dashboardMetrics.totalOrders} orders</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-blue-500/25 shadow-md">
                          <FiCheckCircle className="w-5 h-5 text-blue-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Delivered Value</p>
                          <p className="text-2xl font-bold text-white tracking-tight">₹{dashboardMetrics.deliveredValue.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-300 font-semibold">Completed orders</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-purple-500/25 shadow-md">
                          <FiBarChart2 className="w-5 h-5 text-purple-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Avg Order Value</p>
                          <p className="text-2xl font-bold text-white tracking-tight">₹{Math.round(dashboardMetrics.avgOrderValue).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <p className="text-xs text-purple-300 font-semibold">Per order average</p>
                    </div>

                    {dashboardMetrics.avgDeliveryTime > 0 && (
                      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="p-2.5 rounded-xl bg-amber-500/25 shadow-md">
                            <FiClock className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Avg Delivery Time</p>
                            <p className="text-2xl font-bold text-white tracking-tight">{dashboardMetrics.avgDeliveryTime} days</p>
                          </div>
                        </div>
                        <p className="text-xs text-amber-300 font-semibold">From shipped to delivered</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setTabAndHash('create')}
                    className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-6 text-left hover:shadow-2xl hover:shadow-emerald-500/30 transition-all border border-emerald-400/20"
                  >
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <FiZap className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-1.5">Create Order</h4>
                        <p className="text-white/90 text-sm font-medium">Create a new order for a retailer</p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setTabAndHash('routes')}
                    className="group relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 text-left hover:shadow-2xl hover:shadow-purple-500/30 transition-all border border-purple-400/20"
                  >
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <FiTruck className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-1.5">Route Optimization</h4>
                        <p className="text-white/90 text-sm font-medium">Optimize delivery routes intelligently</p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setTabAndHash('requests')}
                    className="group relative overflow-hidden bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl p-6 text-left hover:shadow-2xl hover:shadow-blue-500/30 transition-all border border-blue-400/20"
                  >
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <FiEye className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-1.5">View Requests</h4>
                        <p className="text-white/90 text-sm font-medium">Review and process new orders</p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "requests" && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <OrderRequests />
            </motion.div>
          )}
          {activeTab === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PassiveOrders />
            </motion.div>
          )}
          {activeTab === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PendingOrders />
            </motion.div>
          )}
          {activeTab === "completed" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TrackOrders />
            </motion.div>
          )}
          {activeTab === "routes" && (
            <motion.div
              key="routes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DeliveryRoutes />
            </motion.div>
          )}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DispatchSettings />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ==================== Dispatch Settings Component ====================
const DispatchSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('delivery');
  const [settings, setSettings] = useState({
    // Delivery API Settings
    delivery: {
      googleMapsApiKey: '',
      courierEnabled: false,
      courierProvider: 'manual', // manual, shiprocket, delhivery, bluedart, fedex
      shiprocket: {
        email: '',
        password: '',
        token: '',
      },
      delhivery: {
        apiKey: '',
        clientId: '',
      },
      bluedart: {
        apiKey: '',
        accountNumber: '',
      },
      fedex: {
        apiKey: '',
        accountNumber: '',
      },
    },
    // Process Settings
    process: {
      autoAcceptEnabled: false,
      autoAcceptThreshold: 0, // Minimum order value for auto-accept
      autoNotifyOnStatusChange: true,
      autoNotifyOnShipped: true,
      autoNotifyOnDelivered: true,
      defaultDeliveryDays: 3,
      requireConfirmationForLargeOrders: true,
      largeOrderThreshold: 50000,
    },
    // Notification Settings
    notifications: {
      whatsappEnabled: true,
      emailEnabled: false,
      smsEnabled: false,
      notifyOnNewRequest: true,
      notifyOnOrderAccepted: true,
      notifyOnOrderShipped: true,
      notifyOnOrderDelivered: true,
      notifyOnPaymentReceived: true,
    },
    // General Preferences
    preferences: {
      defaultTimeRange: 'today',
      itemsPerPage: 20,
      showOrderFlowChart: true,
      showFinancialMetrics: true,
      enableRouteOptimization: true,
      defaultMapCenter: { lat: 19.0760, lng: 72.8777 }, // Mumbai
    },
  });

  const db = getFirestore();
  const auth = getAuth();

  // Load settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const settingsRef = doc(db, 'businesses', user.uid);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setSettings(prev => ({
            ...prev,
            delivery: {
              ...prev.delivery,
              googleMapsApiKey: data.googleMapsApiKey || '',
              courierEnabled: data.courierEnabled || false,
              courierProvider: data.courierProvider || 'manual',
              shiprocket: {
                email: data.shiprocketEmail || '',
                password: data.shiprocketPassword || '',
                token: data.shiprocketToken || '',
              },
              delhivery: {
                apiKey: data.delhiveryApiKey || '',
                clientId: data.delhiveryClientId || '',
              },
              bluedart: {
                apiKey: data.bluedartApiKey || '',
                accountNumber: data.bluedartAccountNumber || '',
              },
              fedex: {
                apiKey: data.fedexApiKey || '',
                accountNumber: data.fedexAccountNumber || '',
              },
            },
            process: data.dispatchProcessSettings || prev.process,
            notifications: data.dispatchNotificationSettings || prev.notifications,
            preferences: data.dispatchPreferences || prev.preferences,
          }));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadSettings();
      }
    });

    return () => unsubscribe();
  }, []);

  // Save settings to Firestore
  const saveSettings = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please sign in to save settings');
        return;
      }

      setSaving(true);
      const settingsRef = doc(db, 'businesses', user.uid);
      
      await updateDoc(settingsRef, {
        googleMapsApiKey: settings.delivery.googleMapsApiKey,
        courierEnabled: settings.delivery.courierEnabled,
        courierProvider: settings.delivery.courierProvider,
        shiprocketEmail: settings.delivery.shiprocket.email,
        shiprocketPassword: settings.delivery.shiprocket.password,
        shiprocketToken: settings.delivery.shiprocket.token,
        delhiveryApiKey: settings.delivery.delhivery.apiKey,
        delhiveryClientId: settings.delivery.delhivery.clientId,
        bluedartApiKey: settings.delivery.bluedart.apiKey,
        bluedartAccountNumber: settings.delivery.bluedart.accountNumber,
        fedexApiKey: settings.delivery.fedex.apiKey,
        fedexAccountNumber: settings.delivery.fedex.accountNumber,
        dispatchProcessSettings: settings.process,
        dispatchNotificationSettings: settings.notifications,
        dispatchPreferences: settings.preferences,
        settingsUpdatedAt: new Date(),
      });

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const updateNestedSetting = (section, subsection, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [key]: value,
        },
      },
    }));
  };

  const sections = [
    { id: 'delivery', label: 'Delivery APIs', icon: FiMap },
    { id: 'process', label: 'Process Settings', icon: FiZap },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'preferences', label: 'Preferences', icon: FiSettings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <FiRefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-white/70 text-sm font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-200 to-cyan-300">
            Dispatch Settings
          </h2>
          <p className="text-white/60 text-sm mt-1.5 font-medium">Configure delivery APIs, processes, and preferences</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiSave className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Settings'}
        </motion.button>
      </div>

      {/* Section Navigation */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 shadow-lg">
        <div className="flex flex-wrap gap-2.5">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeSection === section.id
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/30"
                    : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Delivery API Settings */}
          {activeSection === 'delivery' && (
            <div className="space-y-6">
              {/* Google Maps API */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-blue-500/20 shadow-md">
                    <FiMap className="w-6 h-6 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Google Maps API</h3>
                    <p className="text-sm text-white/60">Required for route optimization and geocoding</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">API Key</label>
                    <input
                      type="password"
                      value={settings.delivery.googleMapsApiKey}
                      onChange={(e) => updateSetting('delivery', 'googleMapsApiKey', e.target.value)}
                      placeholder="Enter Google Maps API key"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                    />
                    <p className="text-xs text-white/50 mt-2">Get your API key from Google Cloud Console</p>
                  </div>
                </div>
              </div>

              {/* Courier Service Integration */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-500/20 shadow-md">
                      <FiTruck className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Courier Service Integration</h3>
                      <p className="text-sm text-white/60">Connect with shipping partners for automated tracking</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.delivery.courierEnabled}
                      onChange={(e) => updateSetting('delivery', 'courierEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {settings.delivery.courierEnabled && (
                  <div className="space-y-6 mt-6">
                    {/* Provider Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">Courier Provider</label>
                      <select
                        value={settings.delivery.courierProvider}
                        onChange={(e) => updateSetting('delivery', 'courierProvider', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                      >
                        <option value="manual">Manual Entry</option>
                        <option value="shiprocket">Shiprocket</option>
                        <option value="delhivery">Delhivery</option>
                        <option value="bluedart">BlueDart</option>
                        <option value="fedex">FedEx</option>
                      </select>
                    </div>

                    {/* Shiprocket Settings */}
                    {settings.delivery.courierProvider === 'shiprocket' && (
                      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-4">Shiprocket Credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">Email</label>
                            <input
                              type="email"
                              value={settings.delivery.shiprocket.email}
                              onChange={(e) => updateNestedSetting('delivery', 'shiprocket', 'email', e.target.value)}
                              placeholder="your@email.com"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">Password</label>
                            <input
                              type="password"
                              value={settings.delivery.shiprocket.password}
                              onChange={(e) => updateNestedSetting('delivery', 'shiprocket', 'password', e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delhivery Settings */}
                    {settings.delivery.courierProvider === 'delhivery' && (
                      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-4">Delhivery Credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">API Key</label>
                            <input
                              type="password"
                              value={settings.delivery.delhivery.apiKey}
                              onChange={(e) => updateNestedSetting('delivery', 'delhivery', 'apiKey', e.target.value)}
                              placeholder="Enter API key"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">Client ID</label>
                            <input
                              type="text"
                              value={settings.delivery.delhivery.clientId}
                              onChange={(e) => updateNestedSetting('delivery', 'delhivery', 'clientId', e.target.value)}
                              placeholder="Enter client ID"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BlueDart Settings */}
                    {settings.delivery.courierProvider === 'bluedart' && (
                      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-4">BlueDart Credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">API Key</label>
                            <input
                              type="password"
                              value={settings.delivery.bluedart.apiKey}
                              onChange={(e) => updateNestedSetting('delivery', 'bluedart', 'apiKey', e.target.value)}
                              placeholder="Enter API key"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">Account Number</label>
                            <input
                              type="text"
                              value={settings.delivery.bluedart.accountNumber}
                              onChange={(e) => updateNestedSetting('delivery', 'bluedart', 'accountNumber', e.target.value)}
                              placeholder="Enter account number"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FedEx Settings */}
                    {settings.delivery.courierProvider === 'fedex' && (
                      <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                        <h4 className="text-sm font-semibold text-white mb-4">FedEx Credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">API Key</label>
                            <input
                              type="password"
                              value={settings.delivery.fedex.apiKey}
                              onChange={(e) => updateNestedSetting('delivery', 'fedex', 'apiKey', e.target.value)}
                              placeholder="Enter API key"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-white/80 mb-2">Account Number</label>
                            <input
                              type="text"
                              value={settings.delivery.fedex.accountNumber}
                              onChange={(e) => updateNestedSetting('delivery', 'fedex', 'accountNumber', e.target.value)}
                              placeholder="Enter account number"
                              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Process Settings */}
          {activeSection === 'process' && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-amber-500/20 shadow-md">
                    <FiZap className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Order Processing</h3>
                    <p className="text-sm text-white/60">Automate order acceptance and processing workflows</p>
                  </div>
                </div>
                <div className="space-y-6">
                  {/* Auto-Accept Orders */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">Auto-Accept Orders</h4>
                      <p className="text-xs text-white/60">Automatically accept orders below threshold</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.process.autoAcceptEnabled}
                        onChange={(e) => updateSetting('process', 'autoAcceptEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {settings.process.autoAcceptEnabled && (
                    <div className="ml-4 pl-4 border-l-2 border-white/10">
                      <label className="block text-sm font-semibold text-white mb-2">Auto-Accept Threshold (₹)</label>
                      <input
                        type="number"
                        value={settings.process.autoAcceptThreshold}
                        onChange={(e) => updateSetting('process', 'autoAcceptThreshold', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                      />
                      <p className="text-xs text-white/50 mt-2">Orders below this value will be auto-accepted</p>
                    </div>
                  )}

                  {/* Require Confirmation for Large Orders */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-1">Require Confirmation for Large Orders</h4>
                      <p className="text-xs text-white/60">Always require manual approval for high-value orders</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.process.requireConfirmationForLargeOrders}
                        onChange={(e) => updateSetting('process', 'requireConfirmationForLargeOrders', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {settings.process.requireConfirmationForLargeOrders && (
                    <div className="ml-4 pl-4 border-l-2 border-white/10">
                      <label className="block text-sm font-semibold text-white mb-2">Large Order Threshold (₹)</label>
                      <input
                        type="number"
                        value={settings.process.largeOrderThreshold}
                        onChange={(e) => updateSetting('process', 'largeOrderThreshold', parseFloat(e.target.value) || 0)}
                        placeholder="50000"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                      />
                    </div>
                  )}

                  {/* Default Delivery Days */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Default Delivery Days</label>
                    <input
                      type="number"
                      value={settings.process.defaultDeliveryDays}
                      onChange={(e) => updateSetting('process', 'defaultDeliveryDays', parseInt(e.target.value) || 3)}
                      min="1"
                      max="30"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                    />
                    <p className="text-xs text-white/50 mt-2">Default number of days for delivery estimation</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-pink-500/20 shadow-md">
                    <FiBell className="w-6 h-6 text-pink-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Notification Preferences</h3>
                    <p className="text-sm text-white/60">Configure how and when you receive notifications</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Notification Channels */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white">Notification Channels</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-sm font-medium text-white">WhatsApp</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications.whatsappEnabled}
                            onChange={(e) => updateSetting('notifications', 'whatsappEnabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-sm font-medium text-white">Email</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications.emailEnabled}
                            onChange={(e) => updateSetting('notifications', 'emailEnabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-sm font-medium text-white">SMS</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications.smsEnabled}
                            onChange={(e) => updateSetting('notifications', 'smsEnabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Notification Events */}
                  <div className="space-y-3 mt-6">
                    <h4 className="text-sm font-semibold text-white">Notification Events</h4>
                    <div className="space-y-2">
                      {[
                        { key: 'notifyOnNewRequest', label: 'New Order Request' },
                        { key: 'notifyOnOrderAccepted', label: 'Order Accepted' },
                        { key: 'notifyOnOrderShipped', label: 'Order Shipped' },
                        { key: 'notifyOnOrderDelivered', label: 'Order Delivered' },
                        { key: 'notifyOnPaymentReceived', label: 'Payment Received' },
                      ].map((event) => (
                        <div key={event.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                          <span className="text-sm text-white/90">{event.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.notifications[event.key]}
                              onChange={(e) => updateSetting('notifications', event.key, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preferences */}
          {activeSection === 'preferences' && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-cyan-500/20 shadow-md">
                    <FiSettings className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">General Preferences</h3>
                    <p className="text-sm text-white/60">Customize your dashboard and display options</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Default Time Range</label>
                    <select
                      value={settings.preferences.defaultTimeRange}
                      onChange={(e) => updateSetting('preferences', 'defaultTimeRange', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                    >
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Items Per Page</label>
                    <input
                      type="number"
                      value={settings.preferences.itemsPerPage}
                      onChange={(e) => updateSetting('preferences', 'itemsPerPage', parseInt(e.target.value) || 20)}
                      min="10"
                      max="100"
                      step="10"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all backdrop-blur-sm"
                    />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white">Dashboard Features</h4>
                    <div className="space-y-2">
                      {[
                        { key: 'showOrderFlowChart', label: 'Show Order Flow Chart' },
                        { key: 'showFinancialMetrics', label: 'Show Financial Metrics' },
                        { key: 'enableRouteOptimization', label: 'Enable Route Optimization' },
                      ].map((feature) => (
                        <div key={feature.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                          <span className="text-sm text-white/90">{feature.label}</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.preferences[feature.key]}
                              onChange={(e) => updateSetting('preferences', feature.key, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-white/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DispatchTracker;
