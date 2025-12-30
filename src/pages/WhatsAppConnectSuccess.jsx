/**
 * WhatsApp OAuth Success Page
 * Shown after successful OAuth connection
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/firebaseConfig';
import { WHATSAPP_PROVIDERS } from '../services/whatsappService';

const WhatsAppConnectSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const distributorId = auth.currentUser?.uid;
  const returnUrl = searchParams.get('returnUrl') || '/distributor-dashboard?tab=profile&section=whatsapp';

  useEffect(() => {
    const verifyConnection = async () => {
      if (!distributorId) {
        setTimeout(() => navigate(returnUrl), 2000);
        return;
      }

      try {
        // Wait a bit for Firestore to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          if (data.whatsappEnabled && data.whatsappProvider === WHATSAPP_PROVIDERS.META) {
            setVerified(true);
          }
        }
      } catch (error) {
        console.error('Error verifying connection:', error);
      } finally {
        setLoading(false);
      }
    };

    verifyConnection();
  }, [distributorId, navigate, returnUrl]);

  const handleContinue = () => {
    navigate(returnUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg">Verifying connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-8 border border-emerald-500/30"
      >
        {verified ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="text-center mb-6"
            >
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-emerald-400 mb-2">Successfully Connected!</h2>
              <p className="text-gray-300">
                Your WhatsApp Business API is now connected and ready to use.
              </p>
            </motion.div>

            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-emerald-200 font-medium mb-2">🚀 Unlocked Features:</p>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>✅ Automated message sending</li>
                <li>✅ Real-time status tracking</li>
                <li>✅ Rich media support</li>
                <li>✅ Message templates</li>
                <li>✅ Two-way communication</li>
                <li>✅ Webhook integration</li>
              </ul>
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg transition-all"
            >
              Continue to Dashboard →
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-xl font-bold text-white mb-2">Processing Connection...</h2>
              <p className="text-gray-400 text-sm">
                Please wait while we verify your connection.
              </p>
            </div>
            <button
              onClick={handleContinue}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default WhatsAppConnectSuccess;

