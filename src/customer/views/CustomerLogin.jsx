/**
 * CustomerLogin - Premium dark theme login screen
 * Modern design matching FLYP branding
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPhone, FaUser, FaArrowRight, FaShoppingBag, FaArrowLeft, FaShoppingCart } from 'react-icons/fa';
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

const CustomerLogin = ({ onLoginSuccess, onContinueAsGuest, isCheckoutFlow }) => {
  const { simpleLogin, loginLoading, error, setError } = useCustomerAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState(1);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (phone.length >= 10) {
      setError?.(null);
      setStep(2);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!name.trim() || phone.length < 10) return;
    const result = await simpleLogin(phone, name.trim());
    if (result?.success && typeof onLoginSuccess === 'function') {
      requestAnimationFrame(() => {
        onLoginSuccess();
      });
    }
  };

  return (
    <div 
      className="h-full w-full flex flex-col bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] relative overflow-hidden"
      style={{ 
        minHeight: '100%',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'pan-y'
      }}
    >
      {/* Background - old theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl" />
        <div 
          className="absolute inset-0 opacity-30" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 0 10 L 40 10 M 10 0 L 10 40 M 0 20 L 40 20 M 20 0 L 20 40 M 0 30 L 40 30 M 30 0 L 30 40' fill='none' stroke='%231f2937' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")` 
          }} 
        />
      </div>

      {/* Content - scroll contained (no page bounce) */}
      <div 
        className="flex-1 flex flex-col justify-center px-6 relative z-10 min-h-0 overflow-y-auto"
        style={{ 
          paddingTop: 'max(env(safe-area-inset-top), 24px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Logo & Welcome */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-5">
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
            <p className="text-white/40 text-sm mt-2 max-w-xs mx-auto">
              Browse stores and add to cart without an account. Sign in when you’re ready to checkout.
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

                {/* Continue as guest — account only at checkout */}
                {typeof onContinueAsGuest === 'function' && (
                  <button
                    type="button"
                    onClick={onContinueAsGuest}
                    className="w-full py-4 mt-2 rounded-2xl font-semibold text-base text-white/70 hover:text-white hover:bg-white/10 border border-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isCheckoutFlow ? (
                      <>
                        <FaShoppingCart className="text-lg" />
                        Back to cart
                      </>
                    ) : (
                      <>
                        <FaShoppingBag className="text-lg" />
                        Continue as guest
                      </>
                    )}
                  </button>
                )}
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
                      <FaPhone className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 font-medium">Phone Number</p>
                      <p className="font-bold text-white">+91 {phone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setError?.(null); setStep(1); }}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
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
                  disabled={!name.trim() || loginLoading}
                  className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${
                    name.trim() && !loginLoading
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400 transition'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {loginLoading ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Getting started...</span>
                    </>
                  ) : (
                    <>
                      Get Started
                      <HiSparkles className="text-xl" />
                    </>
                  )}
                </motion.button>

                {/* Continue as guest (step 2) */}
                {typeof onContinueAsGuest === 'function' && (
                  <button
                    type="button"
                    onClick={onContinueAsGuest}
                    className="w-full py-4 mt-2 rounded-2xl font-semibold text-base text-white/70 hover:text-white hover:bg-white/10 border border-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isCheckoutFlow ? (
                      <>
                        <FaShoppingCart className="text-lg" />
                        Back to cart
                      </>
                    ) : (
                      <>
                        <FaShoppingBag className="text-lg" />
                        Continue as guest
                      </>
                    )}
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 grid grid-cols-3 gap-4"
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
          className="text-xs text-white/40 text-center mt-6 px-4"
        >
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-emerald-400 font-medium hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="text-emerald-400 font-medium hover:underline">Privacy Policy</a>
        </motion.p>
      </div>
    </div>
  );
};

export default CustomerLogin;
