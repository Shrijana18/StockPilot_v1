/**
 * Meta Embedded Signup Component
 * Uses Meta's official Embedded Signup flow for Tech Providers
 * User connects via Facebook popup, Meta handles WABA creation
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { 
  FaWhatsapp, 
  FaCheckCircle, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaFacebook,
  FaArrowRight,
  FaInfoCircle,
  FaTimes
} from 'react-icons/fa';

const EmbeddedSignup = ({ onSetupComplete }) => {
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, error
  const [error, setError] = useState(null);
  const [wabaData, setWabaData] = useState(null);
  const distributorId = auth.currentUser?.uid;
  const popupRef = useRef(null);

  // Meta Embedded Signup Configuration
  const EMBEDDED_SIGNUP_URL = 'https://business.facebook.com/messaging/whatsapp/onboard/?app_id=1902565950686087&config_id=777298265371694&extras=%7B%22featureType%22%3A%22whatsapp_business_app_onboarding%22%2C%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D';

  // Listen for postMessage from Meta Embedded Signup
  useEffect(() => {
    const handleMessage = async (event) => {
      // Verify origin is from Meta
      if (!event.origin.includes('facebook.com') && !event.origin.includes('meta.com')) {
        return;
      }

      console.log('📨 Received message from Meta:', event.data);

      // Handle Embedded Signup response
      if (event.data && event.data.type === 'WHATSAPP_EMBEDDED_SIGNUP') {
        const data = event.data;
        
        if (data.status === 'SUCCESS') {
          setStatus('connected');
          setLoading(false);
          
          // Extract WABA and phone number data
          const wabaId = data.waba_id;
          const phoneNumberId = data.phone_number_id;
          const phoneNumber = data.phone_number;
          
          console.log('✅ Embedded Signup successful:', {
            wabaId,
            phoneNumberId,
            phoneNumber
          });

          // Store in Firestore
          try {
            await saveWABAData({
              wabaId,
              phoneNumberId,
              phoneNumber,
              embeddedSignupData: data
            });

            setWabaData({ wabaId, phoneNumberId, phoneNumber });
            toast.success('WhatsApp Business Account connected successfully!');
            
            if (onSetupComplete) {
              onSetupComplete({ success: true, wabaId, phoneNumberId, phoneNumber });
            }
          } catch (error) {
            console.error('Error saving WABA data:', error);
            setError('Failed to save WhatsApp account. Please try again.');
            setStatus('error');
            toast.error('Failed to save WhatsApp account');
          }
        } else if (data.status === 'ERROR' || data.status === 'CANCELLED') {
          setStatus('error');
          setLoading(false);
          setError(data.error_message || 'Signup was cancelled or failed');
          toast.error(data.error_message || 'WhatsApp signup was cancelled');
        }
      }

      // Handle other Meta postMessage formats
      if (event.data && (event.data.waba_id || event.data.wabaId)) {
        const wabaId = event.data.waba_id || event.data.wabaId;
        const phoneNumberId = event.data.phone_number_id || event.data.phoneNumberId;
        const phoneNumber = event.data.phone_number || event.data.phoneNumber;

        if (wabaId) {
          setStatus('connected');
          setLoading(false);
          
          try {
            await saveWABAData({
              wabaId,
              phoneNumberId,
              phoneNumber,
              embeddedSignupData: event.data
            });

            setWabaData({ wabaId, phoneNumberId, phoneNumber });
            toast.success('WhatsApp Business Account connected successfully!');
            
            if (onSetupComplete) {
              onSetupComplete({ success: true, wabaId, phoneNumberId, phoneNumber });
            }
          } catch (error) {
            console.error('Error saving WABA data:', error);
            setError('Failed to save WhatsApp account. Please try again.');
            setStatus('error');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSetupComplete]);

  // Save WABA data to Firestore
  const saveWABAData = async (data) => {
    if (!distributorId) {
      throw new Error('User not authenticated');
    }

    const businessDocRef = doc(db, 'businesses', distributorId);
    
    await updateDoc(businessDocRef, {
      whatsappBusinessAccountId: data.wabaId,
      whatsappPhoneNumberId: data.phoneNumberId,
      whatsappPhoneNumber: data.phoneNumber,
      whatsappProvider: 'meta_tech_provider',
      whatsappEnabled: true,
      whatsappCreatedVia: 'embedded_signup',
      whatsappCreatedAt: new Date(),
      whatsappPhoneRegistered: true,
      whatsappPhoneVerificationStatus: 'verified',
      embeddedSignupData: data.embeddedSignupData
    });
  };

  // Open Meta Embedded Signup popup
  const handleConnectWhatsApp = () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setStatus('connecting');
    setError(null);
    setShowPopup(true);

    // Open Meta Embedded Signup in popup
    const width = 800;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      EMBEDDED_SIGNUP_URL,
      'WhatsAppEmbeddedSignup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    popupRef.current = popup;

    // Check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      setError('Popup was blocked. Please allow popups for this site.');
      setStatus('error');
      setLoading(false);
      setShowPopup(false);
      toast.error('Please allow popups to connect WhatsApp');
      return;
    }

    // Monitor popup
    const checkPopup = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkPopup);
        if (status === 'connecting') {
          setStatus('idle');
          setLoading(false);
          setShowPopup(false);
          toast.info('WhatsApp signup was closed');
        }
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(checkPopup);
      if (popup && !popup.closed) {
        popup.close();
      }
    };
  };

  // Check existing WABA
  useEffect(() => {
    const checkExistingWABA = async () => {
      if (!distributorId) return;

      try {
        const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          if (data.whatsappBusinessAccountId && data.whatsappCreatedVia === 'embedded_signup') {
            setStatus('connected');
            setWabaData({
              wabaId: data.whatsappBusinessAccountId,
              phoneNumberId: data.whatsappPhoneNumberId,
              phoneNumber: data.whatsappPhoneNumber
            });
          }
        }
      } catch (error) {
        console.error('Error checking existing WABA:', error);
      }
    };

    checkExistingWABA();
  }, [distributorId]);

  return (
    <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
      <div className="text-center mb-6">
        <FaWhatsapp className="text-6xl text-emerald-400 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-white mb-2">
          Connect WhatsApp Business Account
        </h2>
        <p className="text-gray-300">
          Connect your WhatsApp Business Account using Meta's official signup flow
        </p>
      </div>

      {/* Status Messages */}
      {status === 'connected' && wabaData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-900/50 border-2 border-emerald-500 rounded-lg p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <FaCheckCircle className="text-3xl text-emerald-400" />
            <div>
              <h3 className="text-xl font-bold text-white">WhatsApp Connected!</h3>
              <p className="text-gray-300">Your WhatsApp Business Account is ready to use</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">WABA ID:</span>
              <span className="text-white font-mono">{wabaData.wabaId}</span>
            </div>
            {wabaData.phoneNumber && (
              <div className="flex justify-between">
                <span className="text-gray-400">Phone Number:</span>
                <span className="text-white font-mono">{wabaData.phoneNumber}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {status === 'error' && error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/50 border-2 border-red-500 rounded-lg p-6 mb-6"
        >
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-2xl text-red-400" />
            <div>
              <h3 className="text-lg font-bold text-white">Connection Failed</h3>
              <p className="text-gray-300">{error}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/30 border-2 border-blue-500/50 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-400 text-xl mt-1" />
          <div className="text-sm text-gray-300 space-y-2">
            <p className="font-semibold text-white">How it works:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Click "Connect with Facebook" to open Meta's signup flow</li>
              <li>Log in with your Facebook account</li>
              <li>Follow Meta's guided setup to create your WABA</li>
              <li>Add and verify your phone number</li>
              <li>Your account will be automatically connected to FLYP</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Connect Button */}
      {status !== 'connected' && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConnectWhatsApp}
          disabled={loading || status === 'connecting'}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-3 text-lg"
        >
          {loading || status === 'connecting' ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <FaFacebook className="text-2xl" />
              <span>Connect with Facebook</span>
              <FaArrowRight />
            </>
          )}
        </motion.button>
      )}

      {/* Retry Button */}
      {status === 'error' && (
        <button
          onClick={handleConnectWhatsApp}
          className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default EmbeddedSignup;

