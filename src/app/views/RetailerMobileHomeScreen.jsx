/**
 * RetailerMobileHomeScreen - Premium App Home for Retailers
 * SaaS CRM/ERP-first design with glassmorphism, refined typography, and clean UX
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
import { HiLightningBolt, HiSparkles } from 'react-icons/hi';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const FeatureCard = ({ feature, onPress, index }) => {
  const Icon = feature.icon;
  return (
    <motion.button
      variants={item}
      whileTap={{ scale: 0.96 }}
      onClick={async () => {
        await triggerHaptic();
        onPress(feature.id);
      }}
      className="relative group flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden
        bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]
        hover:bg-white/[0.08] hover:border-emerald-500/20
        active:bg-white/[0.1] transition-all duration-300"
      style={{ aspectRatio: '1/1', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.2)' }}
    >
      {/* Subtle gradient overlay on hover */}
      <div className={`absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity ${feature.gradient} mix-blend-overlay`} />
      {/* Top-right glow */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
      {feature.badge && (
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[10px] font-bold bg-emerald-500/90 text-slate-900 rounded-full uppercase tracking-wider shadow-lg shadow-emerald-500/20">
          {feature.badge}
        </span>
      )}
      <div className={`relative z-10 w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-2 shadow-lg`}>
        <Icon className="text-xl text-white" />
      </div>
      <span className="relative z-10 text-xs font-semibold text-white/95 text-center leading-tight tracking-tight">
        {feature.label}
      </span>
    </motion.button>
  );
};

const StatCard = ({ label, value, icon: Icon, color, glow }) => (
  <motion.div
    variants={item}
    className="relative flex items-center gap-3 p-3.5 rounded-2xl overflow-hidden
      bg-white/[0.05] backdrop-blur-sm border border-white/[0.06]
      hover:bg-white/[0.07] hover:border-white/[0.1] transition-all duration-300"
    style={{ boxShadow: '0 2px 16px -4px rgba(0,0,0,0.15)' }}
  >
    <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0 shadow-lg ${glow || ''}`}>
      <Icon className="text-white text-lg" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-base font-bold text-white truncate tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-500 font-medium tracking-wide truncate">{label}</p>
    </div>
  </motion.div>
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
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      badge: 'NEW',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: FaBoxes,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: FaFileInvoice,
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: FaUsers,
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: FaUser,
      gradient: 'from-slate-500 to-slate-700',
      iconBg: 'bg-gradient-to-br from-slate-500 to-slate-600',
    },
  ];

  const webOnlyFeatures = [
    { icon: FaChartLine, label: 'Analytics' },
    { icon: FaBuilding, label: 'Distributors' },
    { icon: FaHistory, label: 'Order History' },
    { icon: FaKeyboard, label: 'POS Mode' },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="px-1 py-0 pb-4"
    >
      {/* Welcome - refined typography */}
      <motion.div variants={item} className="mb-5">
        <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{greeting}</p>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
          {userData?.ownerName?.split(' ')[0] || 'Welcome'}
        </h1>
        <p className="text-sm text-gray-400 font-medium mt-0.5 tracking-wide">
          {userData?.businessName || 'Your Store'}
        </p>
      </motion.div>

      {/* Quick Stats - glassmorphism cards */}
      <motion.div
        variants={container}
        className="grid grid-cols-2 gap-2.5 mb-5"
      >
        <StatCard
          label="Products"
          value={stats?.products ?? 0}
          icon={FaBoxes}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          label="Orders"
          value={stats?.orders ?? 0}
          icon={FaFileInvoice}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          label="Revenue"
          value={`₹${(stats?.revenue ?? 0).toLocaleString('en-IN')}`}
          icon={FaStore}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
        <StatCard
          label="Employees"
          value={stats?.employees ?? 0}
          icon={FaUsers}
          color="bg-gradient-to-br from-amber-500 to-orange-500"
        />
      </motion.div>

      {/* App features - premium grid */}
      <motion.div variants={item} className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <HiSparkles className="text-emerald-400/90 text-sm" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-widest">App Features</h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {features.map((f, i) => (
            <FeatureCard key={f.id} feature={f} onPress={onNavigate} index={i} />
          ))}
        </div>
      </motion.div>

      {/* Quick Billing CTA - standout card */}
      <motion.button
        variants={item}
        whileTap={{ scale: 0.99 }}
        onClick={async () => {
          await triggerHaptic();
          onNavigate('billing');
        }}
        className="w-full mb-4 p-4 rounded-2xl overflow-hidden text-left
          bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-emerald-500/15
          border border-emerald-500/25
          hover:border-emerald-400/40 hover:from-emerald-500/20 transition-all duration-300"
        style={{ boxShadow: '0 4px 24px -4px rgba(16, 185, 129, 0.25)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <HiLightningBolt className="text-white text-2xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight">Quick Billing</h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Create invoice in seconds</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <FaArrowRight className="text-emerald-400 text-sm" />
          </div>
        </div>
      </motion.button>

      {/* More on web - subtle card */}
      <motion.div
        variants={item}
        className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.06]"
      >
        <div className="flex items-center gap-2 mb-3">
          <FaGlobe className="text-emerald-400/80 text-sm" />
          <h3 className="text-xs font-semibold text-white/80 uppercase tracking-widest">More on Web</h3>
        </div>
        <p className="text-xs text-gray-500 font-medium mb-3 leading-relaxed">
          Use FLYP on desktop for the full experience
        </p>
        <div className="flex flex-wrap gap-2">
          {webOnlyFeatures.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.06] text-gray-400 text-xs font-medium"
            >
              <item.icon className="text-emerald-400/70 text-xs" />
              {item.label}
            </span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default RetailerMobileHomeScreen;
