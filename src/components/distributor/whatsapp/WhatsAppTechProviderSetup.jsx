/**
 * WhatsApp Tech Provider Setup
 * One-click setup using Meta Tech Provider infrastructure
 * No need for users to create their own Meta apps
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { FaWhatsapp, FaCheckCircle, FaSpinner, FaExclamationTriangle, FaSync, FaPhone, FaCog } from 'react-icons/fa';
import { onAuthStateChanged } from 'firebase/auth';

const WhatsAppTechProviderSetup = ({ onSetupComplete }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(1); // 1: Create WABA, 2: Add Phone, 3: Setup Webhook, 4: Complete
  const [distributorId, setDistributorId] = useState(auth.currentUser?.uid || null);
  const [status, setStatus] = useState({
    wabaCreated: false,
    phoneNumberAdded: false,
    webhookConfigured: false,
    wabaId: null,
    phoneNumberId: null,
    error: null,
  });

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDistributorId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  const checkCurrentStatus = useCallback(async () => {
    if (!distributorId) {
      setChecking(false);
      return;
    }
    
    setChecking(true);
    try {
      const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
      if (businessDoc.exists()) {
        const data = businessDoc.data();
        const isTechProvider = data.whatsappProvider === 'meta_tech_provider';
        const hasWABA = !!data.whatsappBusinessAccountId;
        const hasPhone = !!data.whatsappPhoneNumberId;
        const hasWebhook = data.whatsappWebhookConfigured || false;
        
        setStatus({
          wabaCreated: hasWABA,
          phoneNumberAdded: hasPhone,
          webhookConfigured: hasWebhook,
          wabaId: data.whatsappBusinessAccountId || null,
          phoneNumberId: data.whatsappPhoneNumberId || null,
          error: null,
        });

        // Determine current step
        if (hasWABA && hasPhone && hasWebhook) {
          setStep(4); // Complete
        } else if (hasWABA && hasPhone) {
          setStep(3); // Setup webhook
        } else if (hasWABA) {
          setStep(2); // Add phone
        } else {
          setStep(1); // Create WABA
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus(prev => ({ ...prev, error: 'Failed to check status' }));
    } finally {
      setChecking(false);
    }
  }, [distributorId]);

  useEffect(() => {
    checkCurrentStatus();
  }, [checkCurrentStatus]);

  const handleCreateWABA = async () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      const createWABA = httpsCallable(functions, 'createClientWABA');
      const result = await createWABA();

      if (result.data?.success) {
        setStatus(prev => ({
          ...prev,
          wabaCreated: true,
          wabaId: result.data.wabaId,
        }));
        setStep(2);
        toast.success('✅ WhatsApp Business Account created successfully!');
      } else {
        throw new Error(result.data?.message || 'Failed to create WABA');
      }
    } catch (error) {
      console.error('Error creating WABA:', error);
      const errorMessage = error?.message || error?.code || 'Failed to create WhatsApp Business Account. Please try again.';
      toast.error(errorMessage);
      setStatus(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoneNumber = async () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      // Get user's phone number from profile
      const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
      const businessData = businessDoc.exists() ? businessDoc.data() : {};
      const phoneNumber = businessData.phone;

      if (!phoneNumber) {
        toast.error('Please add a phone number to your profile first');
        setLoading(false);
        return;
      }

      const requestPhone = httpsCallable(functions, 'requestPhoneNumber');
      const result = await requestPhone({
        phoneNumber,
        displayName: businessData.businessName || businessData.ownerName || 'My Business',
      });

      if (result.data?.success) {
        setStatus(prev => ({
          ...prev,
          phoneNumberAdded: true,
          phoneNumberId: result.data.phoneNumberId,
        }));
        setStep(3);
        toast.success('✅ Phone number verification requested!');
        toast.info('📱 Please complete OTP verification in Meta Business Suite to activate your phone number.');
      } else {
        throw new Error(result.data?.message || 'Failed to request phone number');
      }
    } catch (error) {
      console.error('Error requesting phone number:', error);
      const errorMessage = error?.message || error?.code || 'Failed to request phone number. Please try again.';
      toast.error(errorMessage);
      setStatus(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  const handleSetupWebhook = async () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      const setupWebhook = httpsCallable(functions, 'setupWebhookForClient');
      const result = await setupWebhook();

      if (result.data?.success) {
        setStatus(prev => ({
          ...prev,
          webhookConfigured: true,
        }));
        setStep(4);
        toast.success('✅ Webhook configured successfully!');
        
        // Update status in Firestore
        await updateDoc(doc(db, 'businesses', distributorId), {
          whatsappVerified: true,
          whatsappLastVerifiedAt: serverTimestamp(),
        });

        if (onSetupComplete) {
          onSetupComplete();
        }
      } else {
        throw new Error(result.data?.message || 'Failed to setup webhook');
      }
    } catch (error) {
      console.error('Error setting up webhook:', error);
      const errorMessage = error?.message || error?.code || 'Failed to setup webhook. Please try again.';
      toast.error(errorMessage);
      setStatus(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking
  if (checking) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
        <div className="flex items-center justify-center gap-3">
          <FaSpinner className="animate-spin text-emerald-400 text-xl" />
          <span className="text-gray-300">Checking setup status...</span>
        </div>
      </div>
    );
  }

  // Setup complete
  if (step === 4 && status.wabaCreated && status.phoneNumberAdded && status.webhookConfigured) {
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
          <h3 className="text-2xl font-bold text-emerald-400 mb-2">WhatsApp API Ready!</h3>
          <p className="text-gray-300 mb-6">
            Your WhatsApp Business API is fully set up and ready to use via Tech Provider.
          </p>
          
          <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-500/30 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div>
                <p className="text-sm text-gray-400 mb-1">WABA Status</p>
                <p className="text-emerald-300 font-semibold">✓ Created</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Phone Number</p>
                <p className="text-emerald-300 font-semibold">✓ Configured</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Webhook</p>
                <p className="text-emerald-300 font-semibold">✓ Active</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={checkCurrentStatus}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
              Refresh Status
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Step 1: Create WABA
  if (step === 1) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-2xl font-bold text-white mb-2">Step 1: Create WhatsApp Business Account</h3>
          <p className="text-gray-400">
            We'll create a WhatsApp Business Account for you automatically.
          </p>
        </div>

        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-emerald-200 font-medium mb-3">✨ What happens:</p>
          <ul className="text-sm text-gray-300 space-y-2 text-left">
            <li>✅ A WhatsApp Business Account (WABA) will be created for you</li>
            <li>✅ No need to create a Meta app yourself</li>
            <li>✅ Everything is managed by our Tech Provider infrastructure</li>
            <li>✅ Takes just a few seconds</li>
          </ul>
        </div>

        <button
          onClick={handleCreateWABA}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Creating WABA...</span>
            </>
          ) : (
            <>
              <FaWhatsapp className="text-2xl" />
              <span>Create WhatsApp Business Account</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Step 2: Add Phone Number
  if (step === 2) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">📱</div>
          <h3 className="text-2xl font-bold text-white mb-2">Step 2: Add Phone Number</h3>
          <p className="text-gray-400">
            Add and verify your phone number to start sending messages.
          </p>
        </div>

        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-emerald-200 font-medium mb-3">📋 Next steps:</p>
          <ul className="text-sm text-gray-300 space-y-2 text-left">
            <li>1. We'll request phone number verification</li>
            <li>2. You'll receive an OTP via SMS</li>
            <li>3. Complete verification in Meta Business Suite</li>
            <li>4. Your phone number will be ready to use</li>
          </ul>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-200">
            <strong>Note:</strong> After clicking the button below, you'll need to complete OTP verification in Meta Business Suite. We'll guide you through it.
          </p>
        </div>

        <button
          onClick={handleAddPhoneNumber}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Requesting Phone Number...</span>
            </>
          ) : (
            <>
              <FaPhone className="text-xl" />
              <span>Add Phone Number</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Step 3: Setup Webhook
  if (step === 3) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🔗</div>
          <h3 className="text-2xl font-bold text-white mb-2">Step 3: Configure Webhook</h3>
          <p className="text-gray-400">
            Set up webhook to receive message status updates and incoming messages.
          </p>
        </div>

        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-emerald-200 font-medium mb-3">✨ What this does:</p>
          <ul className="text-sm text-gray-300 space-y-2 text-left">
            <li>✅ Enables real-time message status tracking</li>
            <li>✅ Allows you to receive incoming messages</li>
            <li>✅ Provides delivery and read receipts</li>
            <li>✅ Fully automated - no manual configuration needed</li>
          </ul>
        </div>

        <button
          onClick={handleSetupWebhook}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Configuring Webhook...</span>
            </>
          ) : (
            <>
              <FaCog className="text-xl" />
              <span>Setup Webhook</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return null;
};

export default WhatsAppTechProviderSetup;

