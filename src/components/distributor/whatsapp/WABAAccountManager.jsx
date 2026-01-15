/**
 * WABA Account Manager Component
 * Manages WhatsApp Business Account selection and creation
 * Allows users to choose existing WABA or create new via embedded signup
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
  FaKey,
  FaBuilding,
  FaInfoCircle,
  FaPlus,
  FaCheck,
  FaTimes,
  FaLink
} from 'react-icons/fa';
import EmbeddedSignup from './EmbeddedSignup';
import { META_APP_ID } from '../../../config/whatsappConfig';

const WABAAccountManager = ({ onWABAChange }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [distributorId, setDistributorId] = useState(auth.currentUser?.uid || null);
  const [setupStatus, setSetupStatus] = useState(null);
  const [wabaAccounts, setWabaAccounts] = useState([]);
  const [selectedWABA, setSelectedWABA] = useState(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [existingWABAId] = useState('1403499024706435'); // Pre-configured WABA ID

  // Check current setup status
  const checkStatus = useCallback(async () => {
    if (!distributorId) {
      setChecking(false);
      return;
    }
    
    setChecking(true);
    try {
      // Get setup status
      const getSetupStatus = httpsCallable(functions, 'getWhatsAppSetupStatus');
      const setupResult = await getSetupStatus();
      setSetupStatus(setupResult.data);
      
      // Get business document to check for existing WABA
      const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
      if (businessDoc.exists()) {
        const data = businessDoc.data();
        const currentWABAId = data.whatsappBusinessAccountId;
        
        // Build list of available WABA accounts
        const accounts = [];
        
        // Always add pre-configured WABA (1403499024706435) to the list
        // Try to get its details from API
        let preConfiguredWABA = null;
        try {
          const getClientWABA = httpsCallable(functions, 'getClientWABA');
          const preWABAResult = await getClientWABA({ wabaId: existingWABAId });
          if (preWABAResult.data?.success) {
            const wabaData = preWABAResult.data.wabaData;
            const phoneNumbers = preWABAResult.data.phoneNumbers || [];
            const connectedPhone = phoneNumbers.find(p => 
              p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
            ) || phoneNumbers[0];
            
            preConfiguredWABA = {
              id: existingWABAId,
              name: wabaData?.name || 'FLYP Corporation Private Limited',
              phoneNumber: connectedPhone?.display_phone_number || null,
              phoneNumberId: connectedPhone?.id || null,
              status: 'connected',
              verified: connectedPhone ? (connectedPhone.status === "CONNECTED" || connectedPhone.code_verification_status === "VERIFIED") : false,
              createdVia: 'pre_configured',
              isCurrent: currentWABAId === existingWABAId
            };
          }
        } catch (error) {
          console.warn('Could not fetch pre-configured WABA details:', error);
          // Still add it as available option
          preConfiguredWABA = {
            id: existingWABAId,
            name: 'FLYP Corporation Private Limited',
            phoneNumber: null,
            phoneNumberId: null,
            status: 'available',
            verified: false,
            createdVia: 'pre_configured',
            isCurrent: currentWABAId === existingWABAId
          };
        }
        
        // Add pre-configured WABA first
        if (preConfiguredWABA) {
          accounts.push(preConfiguredWABA);
        }
        
        // Add existing connected WABA if it exists and is different from pre-configured
        if (currentWABAId && currentWABAId !== existingWABAId) {
          // Get phone number from setup status or business data
          const phoneFromStatus = setupResult.data?.status?.phoneNumber;
          accounts.push({
            id: currentWABAId,
            name: setupResult.data?.status?.waba?.name || `WABA ${currentWABAId}`,
            phoneNumber: phoneFromStatus?.number || data.whatsappPhoneNumber || null,
            phoneNumberId: phoneFromStatus?.id || data.whatsappPhoneNumberId || null,
            status: setupResult.data?.status?.waba?.accessible ? 'connected' : 'pending',
            verified: phoneFromStatus?.registered || data.whatsappPhoneRegistered || false,
            createdVia: data.whatsappCreatedVia || 'unknown',
            isCurrent: true
          });
        }
        
        setWabaAccounts(accounts);
        setSelectedWABA(currentWABAId ? accounts.find(a => a.id === currentWABAId) : null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error(`Status check failed: ${error.message}`);
    } finally {
      setChecking(false);
    }
  }, [distributorId, existingWABAId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    setRefreshing(false);
    toast.success('Status refreshed');
  };

  // Select existing WABA
  const handleSelectWABA = async (wabaAccount) => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      // Update business document with selected WABA
      const businessDocRef = doc(db, 'businesses', distributorId);
      
      // Get WABA details including phone number
      const getClientWABA = httpsCallable(functions, 'getClientWABA');
      let phoneNumberId = wabaAccount.phoneNumberId;
      let phoneNumber = wabaAccount.phoneNumber;
      let phoneRegistered = wabaAccount.verified;
      
      try {
        const result = await getClientWABA({ wabaId: wabaAccount.id });
        if (result.data?.success) {
          const wabaData = result.data.wabaData;
          const phoneNumbers = result.data.phoneNumbers || [];
          const connectedPhone = phoneNumbers.find(p => 
            p.status === "CONNECTED" || p.code_verification_status === "VERIFIED"
          ) || phoneNumbers[0];
          
          if (connectedPhone) {
            phoneNumberId = connectedPhone.id;
            phoneNumber = connectedPhone.display_phone_number;
            phoneRegistered = connectedPhone.status === "CONNECTED" || connectedPhone.code_verification_status === "VERIFIED";
          }
        }
      } catch (error) {
        console.warn('Could not fetch WABA details, using stored values:', error);
      }
      
      // Update business document
      const updateData = {
        whatsappBusinessAccountId: wabaAccount.id,
        whatsappProvider: 'meta_tech_provider',
        whatsappCreatedVia: wabaAccount.createdVia || 'pre_configured',
        whatsappEnabled: true,
      };
      
      if (phoneNumberId) {
        updateData.whatsappPhoneNumberId = phoneNumberId;
      }
      if (phoneNumber) {
        updateData.whatsappPhoneNumber = phoneNumber;
      }
      if (phoneRegistered !== undefined) {
        updateData.whatsappPhoneRegistered = phoneRegistered;
      }
      
      await updateDoc(businessDocRef, updateData);
      
      // Update local state
      const updatedAccount = {
        ...wabaAccount,
        phoneNumberId,
        phoneNumber,
        verified: phoneRegistered,
        status: 'connected',
        isCurrent: true
      };
      
      setSelectedWABA(updatedAccount);
      setWabaAccounts(prev => prev.map(acc => 
        acc.id === wabaAccount.id ? updatedAccount : { ...acc, isCurrent: false }
      ));
      
      toast.success('WABA account connected successfully!');
      
      if (onWABAChange) {
        onWABAChange({ wabaId: wabaAccount.id, action: 'selected' });
      }
      
      await checkStatus();
    } catch (error) {
      console.error('Error selecting WABA:', error);
      toast.error(error.message || 'Failed to select WABA account');
    } finally {
      setLoading(false);
    }
  };

  // Handle new WABA creation via embedded signup
  const handleNewWABACreated = async (result) => {
    if (result?.success) {
      toast.success('WhatsApp Business Account created successfully!');
      setShowCreateNew(false);
      await checkStatus();
      
      if (onWABAChange) {
        onWABAChange({ wabaId: result.wabaId, action: 'created' });
      }
    }
  };

  // Status Card Component
  const StatusCard = ({ title, icon: Icon, status, details, children }) => {
    const getStatusColor = () => {
      if (status === 'complete' || status === 'ready' || status === 'connected') return 'border-emerald-500 bg-emerald-900/20';
      if (status === 'warning' || status === 'pending') return 'border-yellow-500 bg-yellow-900/20';
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
          {status === 'complete' || status === 'ready' || status === 'connected' ? (
            <FaCheckCircle className="text-emerald-400 text-xl" />
          ) : status === 'warning' || status === 'pending' ? (
            <FaExclamationTriangle className="text-yellow-400 text-xl" />
          ) : status === 'error' ? (
            <FaExclamationTriangle className="text-red-400 text-xl" />
          ) : null}
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

  if (checking) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30">
        <div className="flex items-center justify-center gap-3">
          <FaSpinner className="animate-spin text-emerald-400 text-xl" />
          <span className="text-gray-300">Checking WABA accounts...</span>
        </div>
      </div>
    );
  }

  const overallStatus = setupStatus?.status?.overall;
  const isConnected = overallStatus?.complete || (selectedWABA && (selectedWABA.status === 'connected' || selectedWABA.verified));
  const hasWABA = selectedWABA !== null;
  const hasPhone = setupStatus?.status?.phoneNumber?.registered || selectedWABA?.verified || false;
  const isFullyConnected = hasWABA && hasPhone && setupStatus?.status?.credentials?.systemUserTokenConfigured;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">WhatsApp Business Account</h2>
          <p className="text-gray-400">
            {isFullyConnected 
              ? '✅ Setup Complete - Ready to use'
              : isConnected
              ? '⚠️ Connected but needs verification'
              : hasWABA
              ? '⚠️ WABA selected - Setup in progress'
              : '❌ No account connected'}
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

      {/* Tech Provider Info */}
      <StatusCard
        title="Tech Provider Status"
        icon={FaBuilding}
        status={setupStatus?.status?.credentials?.systemUserTokenConfigured ? 'complete' : 'error'}
        details={{
          'App ID': setupStatus?.status?.credentials?.appId || META_APP_ID,
          'System User Token': setupStatus?.status?.credentials?.systemUserTokenConfigured ? '✅ Configured' : '❌ Missing',
          'Business Manager ID': setupStatus?.status?.credentials?.businessManagerId || '1337356574811477',
        }}
      />

      {/* Credentials */}
      {setupStatus && (
        <StatusCard
          title="Credentials"
          icon={FaKey}
          status={setupStatus?.status?.credentials?.systemUserTokenConfigured ? 'complete' : 'error'}
          details={{
            'System User Token': setupStatus?.status?.credentials?.systemUserTokenConfigured ? '✅ Configured' : '❌ Missing',
            'App ID': setupStatus?.status?.credentials?.appId || 'N/A',
            'Business Manager': setupStatus?.status?.credentials?.businessManagerId || 'N/A',
          }}
        />
      )}

      {/* Phone Number Status */}
      {setupStatus && selectedWABA && (
        <StatusCard
          title="Phone Number"
          icon={FaPhone}
          status={setupStatus?.status?.phoneNumber?.registered || selectedWABA.verified ? 'complete' : 'warning'}
          details={{
            'Phone Number ID': setupStatus?.status?.phoneNumber?.id || selectedWABA.phoneNumberId || 'Not Added',
            'Phone Number': setupStatus?.status?.phoneNumber?.number || selectedWABA.phoneNumber || 'N/A',
            'Status': setupStatus?.status?.phoneNumber?.status || (selectedWABA.verified ? 'Connected' : 'N/A'),
            'Registered': (setupStatus?.status?.phoneNumber?.registered || selectedWABA.verified) ? '✅ Yes' : '❌ No',
          }}
        />
      )}

      {/* WABA Account Selection */}
      <div className="bg-slate-900/80 border-2 border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <FaWhatsapp />
            Connected WABA Accounts
          </h3>
          {!showCreateNew && (
            <button
              onClick={() => setShowCreateNew(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <FaPlus />
              Create New Account
            </button>
          )}
        </div>

        {/* Show create new form */}
        {showCreateNew && (
          <div className="mb-6">
            <EmbeddedSignup onSetupComplete={handleNewWABACreated} />
            <button
              onClick={() => setShowCreateNew(false)}
              className="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* List of WABA Accounts */}
        {wabaAccounts.length === 0 ? (
          <div className="text-center py-8">
            <FaWhatsapp className="text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No WABA accounts found</p>
            <button
              onClick={() => setShowCreateNew(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <FaPlus />
              Create Your First WABA Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {wabaAccounts.map((account) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg border-2 ${
                  account.isCurrent && account.status === 'connected'
                    ? 'border-emerald-500 bg-emerald-900/20'
                    : account.isCurrent
                    ? 'border-yellow-500 bg-yellow-900/20'
                    : 'border-gray-500 bg-gray-900/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FaBuilding className="text-xl" />
                      <div>
                        <h4 className="font-bold text-white">{account.name}</h4>
                        <p className="text-xs text-gray-400 font-mono">ID: {account.id}</p>
                      </div>
                      {account.isCurrent && (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                      {account.phoneNumber && (
                        <div>
                          <span className="text-gray-400">Phone: </span>
                          <span className="text-white">{account.phoneNumber}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">Status: </span>
                        <span className={
                          account.status === 'connected' ? 'text-emerald-300' :
                          account.status === 'pending' ? 'text-yellow-300' :
                          'text-gray-300'
                        }>
                          {account.status === 'connected' ? '✅ Connected' :
                           account.status === 'pending' ? '⚠️ Pending' :
                           account.status === 'available' ? 'Available' : account.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Verified: </span>
                        <span className={account.verified ? 'text-emerald-300' : 'text-yellow-300'}>
                          {account.verified ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Created Via: </span>
                        <span className="text-white">
                          {account.createdVia === 'embedded_signup' ? '✅ Embedded Signup' :
                           account.createdVia === 'pre_configured' ? 'Pre-configured' :
                           account.createdVia}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    {account.isCurrent ? (
                      <div className="flex items-center gap-2 text-emerald-300">
                        <FaCheckCircle />
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectWABA(account)}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {loading ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                        Select
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Overall Status Summary */}
      {setupStatus && (
        <StatusCard
          title="Overall Status"
          icon={FaInfoCircle}
          status={isFullyConnected ? 'complete' : isConnected ? 'warning' : hasWABA ? 'warning' : 'error'}
          details={{
            'System User Token': setupStatus.status?.credentials?.systemUserTokenConfigured ? '✅ Configured' : '❌ Missing',
            'WABA Connected': hasWABA ? '✅ Yes' : '❌ No',
            'Phone Registered': hasPhone ? '✅ Yes' : '❌ No',
            'API Connection': setupStatus.status?.overall?.readyForApi ? '✅ Ready' : '❌ Not Ready',
            'Webhook Configured': setupStatus.status?.webhook?.configured ? '✅ Yes' : '❌ No',
          }}
        >
          {isFullyConnected && (
            <div className="mt-4 p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30">
              <p className="text-emerald-200 text-sm">
                ✅ <strong>Setup Complete:</strong> Your WhatsApp Business Account is connected and ready to use. All features are now available in WhatsApp Hub.
              </p>
            </div>
          )}
          {isConnected && !isFullyConnected && (
            <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg border border-yellow-500/30">
              <p className="text-yellow-200 text-sm">
                ⚠️ <strong>Almost There:</strong> WABA is connected but some components need verification. Please refresh to check latest status.
              </p>
            </div>
          )}
        </StatusCard>
      )}
    </div>
  );
};

export default WABAAccountManager;

