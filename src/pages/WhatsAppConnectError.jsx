/**
 * WhatsApp OAuth Error Page
 * Shown when OAuth connection fails
 */

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

const WhatsAppConnectError = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason') || 'unknown';
  const returnUrl = '/distributor-dashboard?tab=profile&section=whatsapp';

  const errorMessages = {
    missing_params: 'Missing required parameters. Please try again.',
    invalid_session: 'Session expired or invalid. Please try connecting again.',
    session_expired: 'Connection session expired. Please try again.',
    server_error: 'Server error occurred. Please try again later.',
    access_denied: 'You denied access. Please authorize to connect WhatsApp.',
    unknown: 'An unknown error occurred. Please try again.',
  };

  const errorMessage = errorMessages[reason] || errorMessages.unknown;

  const handleRetry = () => {
    navigate(returnUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-8 border border-red-500/30"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-6xl mb-4"
          >
            ❌
          </motion.div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">Connection Failed</h2>
          <p className="text-gray-300 mb-4">{errorMessage}</p>
        </div>

        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-200 font-medium mb-2">💡 Troubleshooting:</p>
          <ul className="text-xs text-gray-300 space-y-1 text-left">
            <li>• Make sure you're logged into the correct Facebook account</li>
            <li>• Ensure you have a WhatsApp Business Account</li>
            <li>• Check that you granted all required permissions</li>
            <li>• Try using manual setup as an alternative</li>
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate(returnUrl)}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            Go Back to Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default WhatsAppConnectError;

