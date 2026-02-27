/**
 * RetailerMobileHomeScreen - App home for retailers
 * Shows greeting, quick stats, and cards for: Marketplace, Inventory, Billing, Manage Employee, Profile.
 * Includes "More on web" banner for Analytics, Distributors, Order History, POS, etc.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FaShoppingCart,
  FaBoxes,
  FaFileInvoice,
  FaUsers,
  FaUser,
  FaGlobe,
  FaChartLine,
  FaBuilding,
  FaHistory,
  FaKeyboard,
  FaArrowRight,
  FaStore,
} from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

const FeatureCard = ({ feature, onPress, delay = 0 }) => {
  const Icon = feature.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.96 }}
      onClick={async () => {
        await triggerHaptic();
        onPress(feature.id);
      }}
      className={`relative flex flex-col items-center justify-center p-3 rounded-xl 
        ${feature.gradient} shadow-lg shadow-black/20 overflow-hidden
        active:shadow-inner transition-all duration-200`}
      style={{ aspectRatio: '1/1' }}
    >
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/20" />
      </div>
      {feature.badge && (
        <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold bg-white/25 rounded-full text-white">
          {feature.badge}
        </span>
      )}
      <div className="relative z-10 mb-1">
        <Icon className="text-2xl text-white drop-shadow-lg" />
      </div>
      <span className="relative z-10 text-[11px] font-semibold text-white text-center leading-tight">
        {feature.label}
      </span>
    </motion.button>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
    <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
      <Icon className="text-white text-base" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-base font-bold text-white truncate">{value}</p>
      <p className="text-[11px] text-gray-400 truncate">{label}</p>
    </div>
  </div>
);

const RetailerMobileHomeScreen = ({ onNavigate, userData, stats }) => {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const features = [
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: FaShoppingCart,
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      badge: 'NEW',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: FaBoxes,
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: FaFileInvoice,
      gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
    {
      id: 'employees',
      label: 'Manage Employee',
      icon: FaUsers,
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: FaUser,
      gradient: 'bg-gradient-to-br from-slate-500 to-slate-600',
    },
  ];

  const webOnlyFeatures = [
    { icon: FaChartLine, label: 'Analytics' },
    { icon: FaBuilding, label: 'Distributors' },
    { icon: FaHistory, label: 'Order History' },
    { icon: FaKeyboard, label: 'POS Mode' },
  ];

  return (
    <div className="px-1 py-0 pb-2">
      {/* Welcome - compact */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2"
      >
        <p className="text-gray-400 text-xs">{greeting} 👋</p>
        <h1 className="text-lg font-bold text-white">
          {userData?.ownerName?.split(' ')[0] || 'Welcome'}
        </h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {userData?.businessName || 'Your Store'}
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-1.5 mb-2"
      >
        <StatCard
          label="Products"
          value={stats?.products ?? 0}
          icon={FaBoxes}
          color="bg-purple-500"
        />
        <StatCard
          label="Orders"
          value={stats?.orders ?? 0}
          icon={FaFileInvoice}
          color="bg-blue-500"
        />
        <StatCard
          label="Revenue"
          value={`₹${(stats?.revenue ?? 0).toLocaleString('en-IN')}`}
          icon={FaStore}
          color="bg-emerald-500"
        />
        <StatCard
          label="Employees"
          value={stats?.employees ?? 0}
          icon={FaUsers}
          color="bg-amber-500"
        />
      </motion.div>

      {/* App features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between mb-2"
      >
        <h2 className="text-sm font-semibold text-white">App features</h2>
      </motion.div>
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {features.map((feature, index) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            onPress={onNavigate}
            delay={index}
          />
        ))}
      </div>

      {/* Quick Billing CTA */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <HiLightningBolt className="text-white text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Quick Billing</h3>
            <p className="text-[11px] text-gray-400">Create invoice in seconds</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await triggerHaptic();
              onNavigate('billing');
            }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <FaArrowRight className="text-emerald-400 text-sm" />
          </button>
        </div>
      </motion.div>

      {/* More on web - compact */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-2.5 rounded-xl bg-white/5 border border-white/10"
      >
        <div className="flex items-center gap-2 mb-2">
          <FaGlobe className="text-emerald-400 text-base" />
          <h3 className="text-sm font-semibold text-white">More on web</h3>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">
          Use FLYP on desktop for full experience:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {webOnlyFeatures.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300 text-[11px]"
            >
              <item.icon className="text-emerald-400/80 text-xs" />
              {item.label}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default RetailerMobileHomeScreen;
