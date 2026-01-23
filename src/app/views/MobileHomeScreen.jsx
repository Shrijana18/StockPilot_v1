/**
 * MobileHomeScreen - Feature Grid for Mobile App
 * Shows all features as tappable icons like a native app home screen
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaHome, FaBox, FaStore, FaWhatsapp, FaUser,
  FaChartLine, FaFileInvoice, FaTruck, FaCog,
  FaBrain, FaMoneyBillWave, FaIndustry, FaUsers,
  FaArrowRight, FaBell, FaRocket, FaChartBar
} from 'react-icons/fa';
import { HiSparkles, HiLightningBolt } from 'react-icons/hi';
import { MdDashboard, MdInventory, MdLocalShipping, MdReceipt, MdAnalytics } from 'react-icons/md';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

// Feature card component
const FeatureCard = ({ feature, onPress, delay = 0 }) => {
  const Icon = feature.icon;
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.95 }}
      onClick={async () => {
        await triggerHaptic();
        onPress(feature.id);
      }}
      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl 
        ${feature.gradient} shadow-lg shadow-black/20 overflow-hidden
        active:shadow-inner transition-all duration-200`}
      style={{ aspectRatio: '1/1' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/20" />
      </div>
      
      {/* Badge */}
      {feature.badge && (
        <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-white/20 rounded-full text-white">
          {feature.badge}
        </span>
      )}
      
      {/* Notification count */}
      {feature.count > 0 && (
        <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 text-[11px] font-bold bg-red-500 rounded-full text-white flex items-center justify-center">
          {feature.count > 99 ? '99+' : feature.count}
        </span>
      )}
      
      {/* Icon */}
      <div className="relative z-10 mb-2">
        <Icon className="text-3xl text-white drop-shadow-lg" />
      </div>
      
      {/* Label */}
      <span className="relative z-10 text-xs font-semibold text-white text-center leading-tight">
        {feature.label}
      </span>
    </motion.button>
  );
};

// Quick stats card
const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10`}>
    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
      <Icon className="text-white text-lg" />
    </div>
    <div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  </div>
);

const MobileHomeScreen = ({ onNavigate, userData, stats }) => {
  const [greeting, setGreeting] = useState('');
  const [whatsappUnread, setWhatsappUnread] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  
  const distributorId = auth.currentUser?.uid;

  // Set greeting based on time
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // Listen for WhatsApp unread count
  useEffect(() => {
    if (!distributorId) return;
    
    const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
    const unsubscribe = onSnapshot(query(inboxRef), (snapshot) => {
      let unread = 0;
      snapshot.docs.forEach(doc => {
        if (!doc.data().read) unread++;
      });
      setWhatsappUnread(unread);
    });
    
    return () => unsubscribe();
  }, [distributorId]);

  // Listen for pending retailer requests
  useEffect(() => {
    if (!distributorId) return;
    
    const requestsRef = collection(db, 'businesses', distributorId, 'retailerRequests');
    const unsubscribe = onSnapshot(
      query(requestsRef, where('status', '==', 'pending')),
      (snapshot) => setPendingRequests(snapshot.size)
    );
    
    return () => unsubscribe();
  }, [distributorId]);

  // All features for the grid
  const features = [
    { 
      id: 'retailerRequests', 
      label: 'Retailers', 
      icon: FaStore, 
      gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
      count: pendingRequests
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: FaBox, 
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600'
    },
    { 
      id: 'whatsapp', 
      label: 'WhatsApp', 
      icon: FaWhatsapp, 
      gradient: 'bg-gradient-to-br from-green-500 to-green-600',
      count: whatsappUnread
    },
    { 
      id: 'aiForecast', 
      label: 'AI Forecast', 
      icon: FaBrain, 
      gradient: 'bg-gradient-to-br from-purple-500 to-purple-600',
      badge: 'NEW'
    },
    { 
      id: 'dispatch', 
      label: 'Dispatch', 
      icon: FaTruck, 
      gradient: 'bg-gradient-to-br from-cyan-500 to-cyan-600'
    },
    { 
      id: 'manualBilling', 
      label: 'Billing', 
      icon: FaMoneyBillWave, 
      gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600'
    },
    { 
      id: 'invoices', 
      label: 'Invoices', 
      icon: FaFileInvoice, 
      gradient: 'bg-gradient-to-br from-rose-500 to-rose-600'
    },
    { 
      id: 'productOwners', 
      label: 'Suppliers', 
      icon: FaIndustry, 
      gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-600'
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: FaChartLine, 
      gradient: 'bg-gradient-to-br from-pink-500 to-pink-600'
    },
    { 
      id: 'employees', 
      label: 'Employees', 
      icon: FaUsers, 
      gradient: 'bg-gradient-to-br from-teal-500 to-teal-600'
    },
    { 
      id: 'profile', 
      label: 'Settings', 
      icon: FaCog, 
      gradient: 'bg-gradient-to-br from-slate-500 to-slate-600'
    },
  ];

  return (
    <div className="px-4 py-2 pb-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-gray-400 text-sm">{greeting} 👋</p>
        <h1 className="text-2xl font-bold text-white">
          {userData?.ownerName?.split(' ')[0] || 'Welcome'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {userData?.businessName || 'Your Business'}
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <StatCard 
          label="Total Orders" 
          value={stats?.totalOrders || 0} 
          icon={MdReceipt}
          color="bg-blue-500"
        />
        <StatCard 
          label="Pending" 
          value={stats?.pendingOrders || 0} 
          icon={MdLocalShipping}
          color="bg-amber-500"
        />
        <StatCard 
          label="Revenue" 
          value={`₹${(stats?.revenue || 0).toLocaleString('en-IN')}`} 
          icon={FaMoneyBillWave}
          color="bg-emerald-500"
        />
        <StatCard 
          label="Products" 
          value={stats?.products || 0} 
          icon={MdInventory}
          color="bg-purple-500"
        />
      </motion.div>

      {/* Features Section Title */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between mb-4"
      >
        <h2 className="text-lg font-semibold text-white">Features</h2>
        <span className="text-xs text-gray-500">{features.length} modules</span>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-3 gap-3">
        {features.map((feature, index) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={onNavigate}
            delay={index}
          />
        ))}
      </div>

      {/* Quick Actions Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg">
            <HiLightningBolt className="text-white text-2xl" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Quick Invoice</h3>
            <p className="text-xs text-gray-400">Create invoice in seconds</p>
          </div>
          <button 
            onClick={() => {
              triggerHaptic();
              onNavigate('manualBilling');
            }}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <FaArrowRight className="text-emerald-400" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default MobileHomeScreen;
