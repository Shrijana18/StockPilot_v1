/**
 * WhatsApp Tech Provider Setup & Status Dashboard
 * Comprehensive status check for embedded signup and API connection
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { 
  FaWhatsapp, 
  FaCheckCircle, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaSync, 
  FaPhone, 
  FaCog,
  FaLink,
  FaKey,
  FaBuilding,
  FaInfoCircle,
  FaList,
  FaCheck
} from 'react-icons/fa';
import { onAuthStateChanged } from 'firebase/auth';
import IndividualWABASetup from './IndividualWABASetup';
import EmbeddedSignup from './EmbeddedSignup';

const WhatsAppTechProviderSetup = ({ onSetupComplete }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [distributorId, setDistributorId] = useState(auth.currentUser?.uid || null);
  const [pin, setPin] = useState('');
  const [setupStatus, setSetupStatus] = useState(null);
  const [embeddedSignupStatus, setEmbeddedSignupStatus] = useState(null);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [showIndividualSetup, setShowIndividualSetup] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDistributorId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Comprehensive status check
  const checkAllStatus = useCallback(async () => {
    if (!distributorId) {
      setChecking(false);
      return;
    }
    
    setChecking(true);
    try {
      // Get overall setup status (includes WABA, phone, and webhook info)
      const getSetupStatus = httpsCallable(functions, 'getWhatsAppSetupStatus');
      const setupResult = await getSetupStatus();
      setSetupStatus(setupResult.data);
      
      // Extract embedded signup and webhook status from setup status
      if (setupResult.data?.status) {
        setEmbeddedSignupStatus({
          status: setupResult.data.status.waba?.accessible ? 'complete' : 'pending',
          wabaId: setupResult.data.status.waba?.id,
          wabaName: setupResult.data.status.waba?.name,
        });
        setWebhookStatus({
          configured: setupResult.data.status.webhook?.configured || false,
          url: setupResult.data.status.webhook?.url,
        });
      }
    } catch (error) {
      console.error('Error checking status:', error);
      // Don't show error if it's just that no WABA exists yet
      if (!error.message?.includes('No individual WABA')) {
        toast.error(`Status check failed: ${error.message}`);
      }
    } finally {
      setChecking(false);
    }
  }, [distributorId]);

  useEffect(() => {
    checkAllStatus();
  }, [checkAllStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkAllStatus();
    setRefreshing(false);
    toast.success('Status refreshed');
  };

  // Removed handleSyncConfig and handleFindWABAWithPhone - functions don't exist
  // Use getWhatsAppSetupStatus instead which provides all needed info

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
        toast.success('✅ WhatsApp Business Account created successfully!');
        await checkAllStatus();
      } else {
        throw new Error(result.data?.message || 'Failed to create WABA');
      }
    } catch (error) {
      console.error('Error creating WABA:', error);
      toast.error(error?.message || 'Failed to create WhatsApp Business Account');
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
        toast.success('✅ Phone number verification requested!');
        toast.info('📱 Please complete OTP verification in Meta Business Suite');
        await checkAllStatus();
      } else {
        throw new Error(result.data?.message || 'Failed to request phone number');
      }
    } catch (error) {
      console.error('Error requesting phone number:', error);
      toast.error(error?.message || 'Failed to request phone number');
    } finally {
      setLoading(false);
    }
  };

  // Removed handleRegisterPhoneNumber - use IndividualWABASetup component instead
  // Phone registration is handled via createIndividualWABA and verifyPhoneOTP

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
        toast.success('✅ Webhook configured successfully!');
        await checkAllStatus();

        if (onSetupComplete) {
          onSetupComplete();
        }
      } else {
        throw new Error(result.data?.message || 'Failed to setup webhook');
      }
    } catch (error) {
      console.error('Error setting up webhook:', error);
      toast.error(error?.message || 'Failed to setup webhook');
    } finally {
      setLoading(false);
    }
  };

  // Removed handleSubscribeAppToWABA - app subscription is automatic when creating WABA via createIndividualWABA

  const handleSetupComplete = async (result) => {
    if (result?.success) {
      toast.success('WhatsApp Business Account created successfully!');
      setShowIndividualSetup(false);
      await checkAllStatus();
      if (onSetupComplete) {
        onSetupComplete(result);
      }
    }
  };

  // Status Card Component
  const StatusCard = ({ title, icon: Icon, status, details, children }) => {
    const getStatusColor = () => {
      if (status === 'complete' || status === 'ready') return 'border-emerald-500 bg-emerald-900/20';
      if (status === 'warning') return 'border-yellow-500 bg-yellow-900/20';
      if (status === 'error') return 'border-red-500 bg-red-900/20';
      return 'border-gray-500 bg-gray-900/20';
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl p-6 border-2 ${getStatusColor()}`}
      >
        <div className="flex items-center gap-3 mb-4">
          {Icon && <Icon className="text-2xl" />}
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {status === 'complete' && <FaCheckCircle className="text-emerald-400 text-xl" />}
          {status === 'warning' && <FaExclamationTriangle className="text-yellow-400 text-xl" />}
          {status === 'error' && <FaExclamationTriangle className="text-red-400 text-xl" />}
        </div>
        {details && (
          <div className="space-y-2 text-sm text-gray-300 mb-4">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-400">{key}:</span>
                <span className="font-mono text-white">{String(value || 'N/A')}</span>
              </div>
            ))}
          </div>
        )}
        {children}
      </motion.div>
    );
  };

  // Show loading state
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

  const overallStatus = setupStatus?.status?.overall;
  const isReadyForDemo = overallStatus?.readyForDemo || false;
  const isReadyForApi = overallStatus?.readyForApi || false;

    return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">WhatsApp Setup Status</h2>
          <p className="text-gray-400">
            {isReadyForDemo 
              ? '✅ Setup complete and ready for demo'
              : isReadyForApi
              ? '⚠️ Setup functional but needs attention'
              : '❌ Setup needs configuration'}
          </p>
              </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <FaSync className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
              </div>

      {/* Overall Status */}
      {setupStatus && (
        <StatusCard
          title="Overall Status"
          icon={FaWhatsapp}
          status={isReadyForDemo ? 'complete' : isReadyForApi ? 'warning' : 'error'}
          details={{
            'Embedded Signup': setupStatus.status?.embeddedSignup?.ready ? '✅ Ready' : '❌ Not Ready',
            'API Connection': isReadyForApi ? '✅ Ready' : '❌ Not Ready',
            'Demo Ready': isReadyForDemo ? '✅ Yes' : '❌ No',
          }}
        >
          {setupStatus.status?.errors?.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 rounded-lg">
              <p className="text-red-200 font-semibold mb-2">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                {setupStatus.status.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
              </div>
          )}
          {setupStatus.status?.warnings?.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg">
              <p className="text-yellow-200 font-semibold mb-2">Warnings:</p>
              <ul className="list-disc list-inside text-sm text-yellow-300 space-y-1">
                {setupStatus.status.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </StatusCard>
      )}

      {/* Credentials Status */}
      {setupStatus && (
        <StatusCard
          title="Credentials"
          icon={FaKey}
          status={setupStatus.status?.credentials?.systemUserTokenConfigured ? 'complete' : 'error'}
          details={{
            'App ID': setupStatus.status?.credentials?.appId || 'N/A',
            'System User Token': setupStatus.status?.credentials?.systemUserTokenConfigured ? '✅ Configured' : '❌ Missing',
            'Business Manager ID': setupStatus.status?.credentials?.businessManagerId || 'N/A',
          }}
        />
      )}

      {/* WABA Status */}
      {setupStatus && (
        <StatusCard
          title="WhatsApp Business Account (WABA)"
          icon={FaBuilding}
          status={setupStatus.status?.waba?.accessible ? 'complete' : 'error'}
          details={{
            'WABA ID': setupStatus.status?.waba?.id || 'Not Created',
            'WABA Name': setupStatus.status?.waba?.name || 'N/A',
            'Status': setupStatus.status?.waba?.status || 'N/A',
            'Accessible': setupStatus.status?.waba?.accessible ? '✅ Yes' : '❌ No',
          }}
        >
          <div className="mt-4 space-y-2">
            {(!setupStatus.status?.waba?.id || setupStatus.status?.waba?.needsIndividualSetup) && !showIndividualSetup && (
              <>
                {setupStatus.status?.waba?.needsIndividualSetup && (
                  <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-200">
                      ⚠️ You have an old shared WABA. Please create your own individual WABA to continue.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setShowIndividualSetup(true)}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FaWhatsapp />
                  Create Your WhatsApp Business Account
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Set up your own WhatsApp Business Account with your phone number
                </p>
              </>
            )}
            {showIndividualSetup && (
              <div className="mt-4">
                <EmbeddedSignup onSetupComplete={handleSetupComplete} />
                <button
                  onClick={() => setShowIndividualSetup(false)}
                  className="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            {setupStatus.status?.waba?.id && setupStatus.status?.waba?.isIndividual && !showIndividualSetup && (
              <div className="p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30">
                <p className="text-sm text-emerald-200">
                  ✅ Connected to: <span className="font-mono">{setupStatus.status?.waba?.name || setupStatus.status?.waba?.id}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Your individual WhatsApp Business Account is ready
                </p>
              </div>
            )}
          </div>
          
        </StatusCard>
      )}

      {/* Phone Number Status */}
      {setupStatus && (
        <StatusCard
          title="Phone Number"
          icon={FaPhone}
          status={setupStatus.status?.phoneNumber?.registered ? 'complete' : setupStatus.status?.phoneNumber?.id ? 'warning' : 'error'}
          details={{
            'Phone Number ID': setupStatus.status?.phoneNumber?.id || 'Not Added',
            'Phone Number': setupStatus.status?.phoneNumber?.number || 'N/A',
            'Status': setupStatus.status?.phoneNumber?.status || 'N/A',
            'Registered': setupStatus.status?.phoneNumber?.registered ? '✅ Yes' : '❌ No',
          }}
        >
          {!setupStatus.status?.phoneNumber?.id && setupStatus.status?.waba?.id && (
            <button
              onClick={handleAddPhoneNumber}
              disabled={loading}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaPhone />}
              Add Phone Number
            </button>
          )}
          {setupStatus.status?.phoneNumber?.id && !setupStatus.status?.phoneNumber?.registered && (
            <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                Phone number registration pending. Please use the Individual WABA Setup flow to complete OTP verification.
              </p>
            </div>
          )}
        </StatusCard>
      )}

      {/* Webhook Status */}
      {webhookStatus && (
        <StatusCard
          title="Webhook Configuration"
          icon={FaLink}
          status={webhookStatus.verification?.webhookConfigured ? 'complete' : 'error'}
          details={{
            'Webhook URL': webhookStatus.verification?.webhookUrl || 'Not Configured',
            'Verify Token': webhookStatus.verification?.verifyToken ? '✅ Set' : '❌ Missing',
            'Subscribed Fields': (() => {
              const fields = webhookStatus.verification?.subscribedFields;
              if (Array.isArray(fields) && fields.length > 0) {
                return fields.join(', ');
              } else if (fields && typeof fields === 'object') {
                return Object.keys(fields).join(', ');
              } else if (fields) {
                return String(fields);
              }
              return 'None';
            })(),
            'Status': webhookStatus.verification?.webhookConfigured ? '✅ Configured' : '❌ Not Configured',
          }}
        >
          {webhookStatus.verification?.errors?.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 rounded-lg">
              <p className="text-red-200 font-semibold mb-2">Issues:</p>
              <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                {webhookStatus.verification.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {webhookStatus.verification?.warnings?.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg">
              <p className="text-yellow-200 font-semibold mb-2">Warnings:</p>
              <ul className="list-disc list-inside text-sm text-yellow-300 space-y-1">
                {webhookStatus.verification.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {webhookStatus.verification?.info?.length > 0 && (
            <div className="mt-4 p-3 bg-blue-900/30 rounded-lg">
              <p className="text-blue-200 font-semibold mb-2">Info:</p>
              <ul className="list-disc list-inside text-sm text-blue-300 space-y-1">
                {webhookStatus.verification.info.map((info, idx) => (
                  <li key={idx}>{info}</li>
                ))}
              </ul>
            </div>
          )}
          {setupStatus?.status?.waba?.accessible && setupStatus?.status?.phoneNumber?.registered && !webhookStatus.verification?.webhookConfigured && (
            <button
              onClick={handleSetupWebhook}
              disabled={loading}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <FaSpinner className="animate-spin" /> : <FaCog />}
              Setup Webhook
        </button>
          )}
        </StatusCard>
      )}

      {/* Embedded Signup Status */}
      {embeddedSignupStatus && (
        <StatusCard
          title="Embedded Signup Status"
          icon={FaInfoCircle}
          status={embeddedSignupStatus.status?.embeddedSignupReady ? 'complete' : 'error'}
          details={{
            'App ID': embeddedSignupStatus.status?.appId || 'N/A',
            'System User Token': embeddedSignupStatus.status?.systemUserTokenConfigured ? '✅ Configured' : '❌ Missing',
            'Business Manager': embeddedSignupStatus.status?.businessManagerId || 'N/A',
            'WABA Accessible': embeddedSignupStatus.status?.wabaAccessible ? '✅ Yes' : '❌ No',
            'Phone Registered': embeddedSignupStatus.status?.phoneNumberRegistered ? '✅ Yes' : '❌ No',
            'Webhook Configured': embeddedSignupStatus.status?.webhookConfigured ? '✅ Yes' : '❌ No',
            'Ready': embeddedSignupStatus.status?.embeddedSignupReady ? '✅ Yes' : '❌ No',
          }}
        >
          {embeddedSignupStatus.status?.errors?.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 rounded-lg">
              <p className="text-red-200 font-semibold mb-2">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                {embeddedSignupStatus.status.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
              {embeddedSignupStatus.status.errors.some(e => e.includes('not subscribed to WABA')) && (
                <div className="mt-3 p-3 bg-blue-900/30 rounded-lg">
                  <p className="text-blue-200 text-sm">
                    App subscription is automatic when creating WABA via Individual Setup. Please create your WABA using the setup flow above.
                  </p>
                </div>
            )}
          </div>
        )}
        </StatusCard>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FaSync className={refreshing ? 'animate-spin' : ''} />
          Refresh Status
        </button>
      </div>

      {/* Success Message */}
      {isReadyForDemo && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-6 border-2 border-emerald-500/30 text-center"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-emerald-400 mb-2">Setup Complete!</h3>
          <p className="text-gray-300 mb-4">
            Your WhatsApp embedded signup is fully configured and ready for API connection.
          </p>
          <p className="text-sm text-gray-400">
            You can now proceed with WhatsApp API integration and record your demo video.
          </p>
        </motion.div>
      )}
      </div>
    );
};

export default WhatsAppTechProviderSetup;
