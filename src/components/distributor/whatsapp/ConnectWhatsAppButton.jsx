/**
 * Connect WhatsApp Business API Button
 * One-click OAuth flow to connect WhatsApp Business API
 * Redirects to Meta OAuth, then handles callback
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { WHATSAPP_PROVIDERS } from '../../../services/whatsappService';

const ConnectWhatsAppButton = ({ onConnectComplete, showManualOption = true }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const distributorId = auth.currentUser?.uid;

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!distributorId) {
        setChecking(false);
        return;
      }

      try {
        const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          // Check for both Tech Provider and regular Meta API
          const connected = data.whatsappEnabled && 
            (data.whatsappProvider === WHATSAPP_PROVIDERS.META_TECH_PROVIDER || 
             data.whatsappProvider === WHATSAPP_PROVIDERS.META);
          setIsConnected(connected);
          
          if (connected) {
            // Check token expiry
            const expiresAt = data.whatsappTokenExpiresAt?.toDate?.();
            if (expiresAt) {
              const daysUntilExpiry = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
              if (daysUntilExpiry < 7) {
                setConnectionStatus('expiring');
              } else {
                setConnectionStatus('active');
              }
            } else {
              setConnectionStatus('active');
            }
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      } finally {
        setChecking(false);
      }
    };

    checkConnection();
  }, [distributorId]);

  const handleConnect = async () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      // Call Firebase Function to start OAuth flow
      const startConnect = httpsCallable(functions, 'whatsappConnectStart');
      const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      
      const result = await startConnect({ 
        returnUrl,
        distributorId 
      });

      if (result.data.success && result.data.redirectUrl) {
        // Store session ID in localStorage for callback handling
        if (result.data.sessionId) {
          localStorage.setItem('whatsapp_oauth_session', result.data.sessionId);
        }
        
        // Redirect to Meta OAuth
        window.location.href = result.data.redirectUrl;
      } else {
        throw new Error(result.data.error || 'Failed to start connection');
      }
    } catch (error) {
      console.error('Error starting WhatsApp connection:', error);
      toast.error(error.message || 'Failed to connect WhatsApp. Please try again.');
      setLoading(false);
    }
  };

  const handleReconnect = () => {
    // Same as connect, but shows different message
    handleConnect();
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-emerald-900/20 border-2 border-emerald-500/50 rounded-xl p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">✅</div>
            <div>
              <h3 className="text-lg font-bold text-emerald-300">WhatsApp Business API Connected</h3>
              <p className="text-sm text-gray-400 mt-1">
                {connectionStatus === 'expiring' 
                  ? '⚠️ Token expiring soon - reconnect to refresh'
                  : 'All features unlocked and ready to use'
                }
              </p>
            </div>
          </div>
          {connectionStatus === 'expiring' && (
            <button
              onClick={handleReconnect}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Reconnecting...' : 'Refresh Connection'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OAuth Connect Button */}
      <motion.button
        onClick={handleConnect}
        disabled={loading}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-lg rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <span>🚀</span>
            <span>Connect WhatsApp Business API (One-Click)</span>
          </>
        )}
      </motion.button>

      {showManualOption && (
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-2">or</p>
          <button
            onClick={() => {
              if (onConnectComplete) {
                onConnectComplete({ showManual: true });
              }
            }}
            className="text-sm text-emerald-400 hover:text-emerald-300 underline"
          >
            Use manual setup instead
          </button>
        </div>
      )}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-200 font-medium mb-2">✨ What happens next:</p>
        <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside ml-2">
          <li>You'll be redirected to Meta (Facebook) to authorize</li>
          <li>We'll automatically fetch your WhatsApp Business credentials</li>
          <li>Your account will be connected in seconds</li>
          <li>All features will be unlocked automatically</li>
        </ol>
      </div>
    </div>
  );
};

export default ConnectWhatsAppButton;

