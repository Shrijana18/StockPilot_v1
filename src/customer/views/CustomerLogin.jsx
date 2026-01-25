/**
 * CustomerLogin - Premium dark theme login screen
 * Modern design matching FLYP branding
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPhone, FaUser, FaArrowRight, FaShoppingBag, FaArrowLeft } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';
import { useCustomerAuth } from '../context/CustomerAuthContext';

// FLYP Logo Component - Uses actual logo
const FlypLogo = () => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="flex flex-col items-center"
    >
      <img 
        src="/assets/flyp_logo.png" 
        alt="FLYP" 
        className="w-24 h-24 object-contain"
      />
    </motion.div>
  );
};

const CustomerLogin = () => {
  const { simpleLogin, loading, error } = useCustomerAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState(1);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (phone.length >= 10) {
      setStep(2);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (name.trim() && phone.length >= 10) {
      await simpleLogin(phone, name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] flex flex-col relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top gradient orb */}
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        {/* Bottom gradient orb */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
        {/* Center accent */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFmMjkzNyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-8 relative z-10 py-12" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
        {/* Logo & Welcome */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-6">
            <FlypLogo />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
              FLYP Shop
            </h1>
            <p className="text-white/60 text-lg">
              Groceries in minutes
            </p>
          </motion.div>
        </motion.div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handlePhoneSubmit}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-3">
                    Enter your phone number
                  </label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 border-r border-white/10 pr-3">
                      <span className="text-xl">🇮🇳</span>
                      <span className="text-white font-semibold">+91</span>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10 digit number"
                      className="w-full pl-28 pr-5 py-5 bg-white rounded-2xl text-slate-900 font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-emerald-500/30 placeholder-slate-500"
                      autoFocus
                    />
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={phone.length < 10}
                  className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                    phone.length >= 10
                      ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 transition'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  Continue
                  <FaArrowRight className={phone.length >= 10 ? '' : 'opacity-50'} />
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleLogin}
                className="space-y-6"
              >
                {/* Phone Display */}
                <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-2xl px-5 py-4 border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <FaPhone className="text-[#05E06C]400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 font-medium">Phone Number</p>
                      <p className="font-bold text-white">+91 {phone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center border border-slate-600"
                  >
                    <FaArrowLeft className="text-white/60 text-sm" />
                  </button>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-3">
                    What should we call you?
                  </label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2">
                      <FaUser className="text-white/40" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-14 pr-5 py-5 bg-white rounded-2xl text-slate-900 font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-emerald-500/30 placeholder-slate-500"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl"
                  >
                    <p className="text-red-400 text-sm font-medium">{error}</p>
                  </motion.div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={!name.trim() || loading}
                  className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                    name.trim()
                      ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 transition'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-6 h-6 border-3 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      Get Started
                      <HiSparkles className="text-xl" />
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 grid grid-cols-3 gap-4"
        >
          {[
            { icon: '⚡', label: 'Express Delivery' },
            { icon: '🏪', label: 'Local Stores' },
            { icon: '💰', label: 'Best Prices' }
          ].map((feature, i) => (
            <div key={i} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2 text-2xl">
                {feature.icon}
              </div>
              <p className="text-xs font-medium text-white/40">{feature.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Terms */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-white/40 text-center mt-10 px-4"
        >
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-[#05E06C]400 font-medium">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-[#05E06C]400 font-medium">Privacy Policy</a>
        </motion.p>
      </div>

      {/* Bottom Safe Area */}
      <div className="h-8" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </div>
  );
};

export default CustomerLogin;
