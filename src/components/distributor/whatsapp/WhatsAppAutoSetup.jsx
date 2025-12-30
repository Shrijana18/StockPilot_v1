/**
 * WhatsApp Auto Setup - One-Click Automated Setup
 * User only needs to click "Connect" and authorize via Meta OAuth
 * All backend setup (WABA creation, phone number fetching, etc.) is automated
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { FaWhatsapp, FaCheckCircle, FaSpinner, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { verifyWhatsAppConnection } from '../../../services/whatsappService';
import { onAuthStateChanged } from 'firebase/auth';

const WhatsAppAutoSetup = ({ onSetupComplete }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [distributorId, setDistributorId] = useState(auth.currentUser?.uid || null);
  const [status, setStatus] = useState({
    connected: false,
    verified: false,
    phoneNumber: null,
    businessAccount: null,
    error: null,
  });

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDistributorId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  const checkConnectionStatus = useCallback(async () => {
    if (!distributorId) {
      setChecking(false);
      return;
    }
    
    setChecking(true);
    try {
      const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
      if (businessDoc.exists()) {
        const data = businessDoc.data();
        const isConnected = data.whatsappEnabled && data.whatsappProvider === 'meta';
        const isVerified = data.whatsappVerified || false;
        
        setStatus({
          connected: isConnected,
          verified: isVerified,
          phoneNumber: data.whatsappPhoneNumberId || null,
          businessAccount: data.whatsappBusinessAccountId || null,
          error: null,
        });
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to check connection status' }));
    } finally {
      setChecking(false);
    }
  }, [distributorId]);

  // Check current connection status when distributorId changes
  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const handleConnect = async () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      // Get user profile data for auto-filling business details
      const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
      const profileData = businessDoc.exists() ? businessDoc.data() : {};
      const currentUser = auth.currentUser;
      
      // Start OAuth flow
      const startConnect = httpsCallable(functions, 'whatsappConnectStart');
      const result = await startConnect({
        returnUrl: window.location.href,
        profileData: {
          businessName: profileData.businessName || profileData.ownerName || 'My Business',
          phone: profileData.phone || '',
          email: profileData.email || currentUser?.email || '',
          address: profileData.address || '',
          city: profileData.city || '',
          state: profileData.state || '',
        },
      });

      if (result.data?.redirectUrl) {
        // Redirect to Meta OAuth
        window.location.href = result.data.redirectUrl;
      } else {
        throw new Error('Failed to start WhatsApp connection');
      }
    } catch (error) {
      console.error('Error starting WhatsApp connection:', error);
      const errorMessage = error?.message || error?.code || 'Failed to start WhatsApp connection. Please try again.';
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    await handleConnect();
  };

  const handleVerify = async () => {
    if (!distributorId) return;
    
    setLoading(true);
    try {
      const verification = await verifyWhatsAppConnection(distributorId);
      
      if (verification.verified) {
        setStatus(prev => ({ ...prev, verified: true }));
        toast.success('✅ WhatsApp API verified successfully!');
        
        // Update status in Firestore
        await updateDoc(doc(db, 'businesses', distributorId), {
          whatsappVerified: true,
          whatsappLastVerifiedAt: serverTimestamp(),
        });
        
        if (onSetupComplete) {
          onSetupComplete();
        }
      } else {
        toast.warning(verification.error || 'Verification failed');
        setStatus(prev => ({ ...prev, error: verification.error }));
      }
    } catch (error) {
      console.error('Error verifying connection:', error);
      toast.error('Failed to verify connection');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking or if no user
  if (checking || !distributorId) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
        <div className="flex items-center justify-center gap-3">
          <FaSpinner className="animate-spin text-emerald-400 text-xl" />
          <span className="text-gray-300">
            {!distributorId ? 'Loading...' : 'Checking connection status...'}
          </span>
        </div>
      </div>
    );
  }

  // Already connected and verified
  if (status.connected && status.verified) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-6xl mb-4"
          >
            ✅
          </motion.div>
          <h3 className="text-2xl font-bold text-emerald-400 mb-2">WhatsApp API Connected!</h3>
          <p className="text-gray-300 mb-6">
            Your WhatsApp Business API is fully set up and ready to use.
          </p>
          
          <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-500/30 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-sm text-gray-400 mb-1">Status</p>
                <p className="text-emerald-300 font-semibold">✓ Connected & Verified</p>
              </div>
              {status.phoneNumber && (
                <div>
                  <p className="text-sm text-gray-400 mb-1">Phone Number ID</p>
                  <p className="text-gray-300 font-mono text-sm">{status.phoneNumber}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleVerify}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
              Re-verify Connection
            </button>
            <button
              onClick={handleReconnect}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Reconnect
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Connected but not verified
  if (status.connected && !status.verified) {
    return (
      <div className="bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-yellow-900/30 rounded-xl p-8 border-2 border-amber-500/30">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-2xl font-bold text-amber-400 mb-2">Connection Needs Verification</h3>
          <p className="text-gray-300 mb-6">
            Your WhatsApp API is connected but needs verification to start working.
          </p>
          
          {status.error && (
            <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-500/30 mb-6">
              <p className="text-sm text-amber-200">{status.error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleVerify}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  Verify Connection
                </>
              )}
            </button>
            <button
              onClick={handleReconnect}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Reconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not connected - show connect button
  return (
    <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">🚀</div>
        <h3 className="text-2xl font-bold text-white mb-2">Connect WhatsApp Business API</h3>
        <p className="text-gray-400">
          One-click setup. We'll handle everything automatically.
        </p>
      </div>

      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-emerald-200 font-medium mb-3">✨ What happens next:</p>
        <ul className="text-sm text-gray-300 space-y-2 text-left">
          <li>✅ You'll be redirected to Meta to authorize</li>
          <li>✅ We'll automatically create your WhatsApp Business Account</li>
          <li>✅ We'll fetch your phone number and credentials</li>
          <li>✅ Everything will be set up and ready to use</li>
        </ul>
      </div>

      <div className="bg-slate-800/60 rounded-lg p-4 border border-emerald-500/30 mb-6">
        <p className="text-sm text-white font-medium mb-2">📋 What you need:</p>
        <ul className="text-xs text-gray-300 space-y-1 text-left">
          <li>• A Facebook account (to authorize)</li>
          <li>• A phone number (we'll use the one from your profile)</li>
          <li>• 2 minutes of your time</li>
        </ul>
      </div>

      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <FaSpinner className="animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <FaWhatsapp className="text-2xl" />
            <span>Connect WhatsApp API</span>
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center mt-4">
        By connecting, you authorize us to set up your WhatsApp Business API automatically.
      </p>
    </div>
  );
};

export default WhatsAppAutoSetup;

