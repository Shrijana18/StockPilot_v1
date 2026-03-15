/**
 * Payment Callback - Shown after PayU redirect (success/failure)
 * User lands here from PayU webhook redirect: /#/payment/success?orderId=xxx or /#/payment/failure?orderId=xxx
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTimesCircle, FaShoppingBag } from 'react-icons/fa';
import { useCart } from '../context/CartContext';

const PaymentCallback = ({ success, orderId, onTrackOrder, onRetry, onHome }) => {
  const { clearCart } = useCart();
  useEffect(() => {
    if (success) clearCart?.();
  }, [success, clearCart]);
  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-center px-6 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
            success ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}
        >
          {success ? (
            <FaCheckCircle className="text-5xl text-emerald-400" />
          ) : (
            <FaTimesCircle className="text-5xl text-red-400" />
          )}
        </motion.div>

        <h1 className="text-2xl font-bold text-white mb-2">
          {success ? 'Payment Successful!' : 'Payment Failed'}
        </h1>
        <p className="text-white/60 mb-6">
          {success
            ? 'Your order has been placed. Thank you for your purchase!'
            : 'Something went wrong. Please try again or choose another payment method.'}
        </p>

        <div className="space-y-3">
          {orderId && success && (
            <button
              onClick={() => onTrackOrder(orderId)}
              className="w-full py-3.5 bg-emerald-500 text-slate-900 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all"
            >
              <FaShoppingBag />
              Track Order
            </button>
          )}
          {orderId && !success && onRetry && (
            <button
              onClick={() => onRetry(orderId)}
              className="w-full py-3.5 bg-amber-500 text-slate-900 rounded-xl font-semibold hover:bg-amber-400 transition-all"
            >
              Try Again
            </button>
          )}
          <button
            onClick={onHome}
            className="w-full py-3.5 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/15 border border-white/10 transition-all"
          >
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentCallback;
