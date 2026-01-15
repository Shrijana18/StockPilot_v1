/**
 * WhatsApp Connection Component
 * Handles embedded signup flow with real-time Firestore updates
 */

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, functions, auth } from "../../../firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { toast } from "react-toastify";
import { 
  FaWhatsapp, FaFacebook, FaArrowRight, FaSpinner, 
  FaExclamationTriangle, FaCheckCircle, FaInfoCircle,
  FaShieldVirus, FaRocket, FaUsers, FaBullhorn, FaChartBar, FaLock
} from "react-icons/fa";
import WhatsAppStatus from "./WhatsAppStatus";
import { EMBEDDED_SIGNUP_URL, WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI } from "../../../config/whatsappConfig";

const WhatsAppConnection = ({ user, formData, setFormData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // 2FA PIN States
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pendingWabaData, setPendingWabaData] = useState(null);
  const [submittingPin, setSubmittingPin] = useState(false);
  
  // Manual entry states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualWabaId, setManualWabaId] = useState("");
  const [manualPhoneNumberId, setManualPhoneNumberId] = useState("");
  const [manualPhoneNumber, setManualPhoneNumber] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const popupRef = useRef(null);
  const postMessageReceivedRef = useRef(false);

  const isConnected = formData.whatsappEnabled && formData.whatsappBusinessAccountId;

  // Real-time Firestore listener for automatic updates
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'businesses', user.uid);
    
    const unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        
        // Check if WABA was just added or changed
        if (userData.whatsappBusinessAccountId && 
            userData.whatsappBusinessAccountId !== formData.whatsappBusinessAccountId) {
          console.log('🔄 Real-time update: WABA detected in Firestore');
          
          setFormData(prev => ({
            ...prev,
            whatsappBusinessAccountId: userData.whatsappBusinessAccountId,
            whatsappPhoneNumberId: userData.whatsappPhoneNumberId,
            whatsappPhoneNumber: userData.whatsappPhoneNumber,
            whatsappEnabled: userData.whatsappEnabled || false,
            whatsappProvider: userData.whatsappProvider,
            whatsappPhoneRegistered: userData.whatsappPhoneRegistered || false,
            whatsappPhoneVerificationStatus: userData.whatsappPhoneVerificationStatus || 'not_registered',
            whatsappVerified: userData.whatsappVerified || false,
            whatsappAccountReviewStatus: userData.whatsappAccountReviewStatus || 'PENDING',
          }));
          
          // Fetch detailed status
          setTimeout(() => fetchWABAStatus(), 1000);
          
          // Only show toast if we aren't already loading (to avoid duplicate toasts during active flow)
          if (!loading && !showPinModal) {
            toast.success('WhatsApp account connected! Fetching status...');
          }
        }
        
        // Update status if changed
        if (userData.whatsappAccountReviewStatus && 
            userData.whatsappAccountReviewStatus !== formData.whatsappAccountReviewStatus) {
          setFormData(prev => ({
            ...prev,
            whatsappAccountReviewStatus: userData.whatsappAccountReviewStatus,
            whatsappVerified: userData.whatsappVerified || false,
          }));
        }
      }
    }, (error) => {
      console.error('Error in Firestore listener:', error);
    });

    return () => unsubscribe();
  }, [user, formData.whatsappBusinessAccountId, formData.whatsappAccountReviewStatus, setFormData, loading, showPinModal]);

  // Fetch WABA status from Meta API
  const fetchWABAStatus = async () => {
    if (!user || !formData.whatsappBusinessAccountId) return;

    setCheckingStatus(true);
    try {
      const getWABAStatus = httpsCallable(functions, 'getWABAStatus');
      const result = await getWABAStatus();
      
      if (result.data?.success && result.data.status) {
        const status = result.data.status;
        setStatusData(status);
        
        // Update formData with latest status
        setFormData(prev => ({
          ...prev,
          whatsappPhoneNumber: status.phone?.phoneNumber || prev.whatsappPhoneNumber,
          whatsappPhoneNumberId: status.phone?.phoneNumberId || prev.whatsappPhoneNumberId,
          whatsappPhoneRegistered: status.phone?.registered || false,
          whatsappPhoneVerificationStatus: status.phone?.verificationStatus || 'not_registered',
          whatsappVerified: status.phone?.verified || false,
          whatsappAccountReviewStatus: status.accountReview?.status || 'PENDING',
        }));
      }
    } catch (err) {
      console.error('Error fetching WABA status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Auto-fetch status when WABA exists
  useEffect(() => {
    if (user && formData.whatsappBusinessAccountId && !statusData) {
      fetchWABAStatus();
    }
  }, [user?.uid, formData.whatsappBusinessAccountId]);

  // Listen for Meta postMessage responses
  useEffect(() => {
    const handleMessage = async (event) => {
      // Security check: only trust Meta domains or your own domain (if sending from same origin)
      const trustedOrigins = [
        "https://business.facebook.com",
        "https://www.facebook.com", 
        "https://facebook.com",
        window.location.origin
      ];
      
      const data = event.data;
      const isCustomEvent = data?.type === 'WHATSAPP_EMBEDDED_SIGNUP';

      if (!trustedOrigins.some(origin => event.origin.startsWith(origin)) && !isCustomEvent) {
        return;
      }

      let wabaId, phoneNumberId, phoneNumber;
      let isFinishEvent = false;

      // Log for debugging
      if (data?.type === 'WHATSAPP_EMBEDDED_SIGNUP' || data?.type === 'WA_EMBEDDED_SIGNUP') {
        console.log('📨 Received WhatsApp setup message:', data);
      }

      // 1. Handle Cloud Function Bridge Event (Our custom event)
      if (data?.type === 'WHATSAPP_EMBEDDED_SIGNUP' && data.status === 'SUCCESS') {
        wabaId = data.waba_id;
        phoneNumberId = data.phone_number_id;
        phoneNumber = data.phone_number;
      }
      // 2. Handle Meta SDK "FINISH" event (Fallback if SDK is used)
      else if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH' && data.data) {
        isFinishEvent = true;
        wabaId = data.data.waba_id;
        phoneNumberId = data.data.phone_number_id;
        phoneNumber = data.data.phone_number;
      }
      // 3. Handle raw data fallback
      else if (data?.waba_id || data?.wabaId) {
        wabaId = data.waba_id || data.wabaId;
        phoneNumberId = data.phone_number_id || data.phoneNumberId;
        phoneNumber = data.phone_number || data.phoneNumber;
      }

      // PROCESS SUCCESSFUL CONNECTION
      if (wabaId) {
        postMessageReceivedRef.current = true;
        
        if (isFinishEvent && !phoneNumberId) {
          console.warn('⚠️ FINISH event missing phoneNumberId - waiting for better data or detection');
        }

        try {
          const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
          
          const requestData = {
            wabaId,
            phoneNumberId: phoneNumberId || null,
            phoneNumber: phoneNumber || null,
            embeddedData: {
              ...data,
              pin: data.pin || data.registration_pin || data.data?.pin,
              isFinishEvent,
            }
          };

          const result = await saveWABADirect(requestData);

          // UPDATED: Check if 2FA PIN is required
          if (result.data?.requirePin) {
            console.log("🔐 2FA PIN Required from backend");
            setPendingWabaData(requestData);
            setShowPinModal(true);
            setLoading(false);
            toast.info("Two-step verification PIN required to complete setup.");
            return;
          }

          if (result.data?.success) {
            setFormData(prev => ({
              ...prev,
              whatsappBusinessAccountId: result.data.wabaId,
              whatsappPhoneNumberId: result.data.phoneNumberId,
              whatsappPhoneNumber: result.data.phoneNumber,
              whatsappEnabled: true,
              whatsappProvider: 'meta_tech_provider',
              whatsappCreatedVia: 'embedded_signup',
              whatsappPhoneRegistered: result.data.phoneNumber ? true : false,
              whatsappPhoneVerificationStatus: result.data.phoneNumber ? 'pending' : 'not_registered',
              whatsappVerified: false,
              whatsappAccountReviewStatus: 'PENDING',
            }));

            toast.success('WhatsApp Business Account connected successfully!');
            setLoading(false);
            
            setTimeout(() => fetchWABAStatus(), 1000);
            setTimeout(() => fetchWABAStatus(), 6000);
          }
        } catch (err) {
          console.error('Error saving WABA:', err);
          setLoading(false);
          toast.warning('Account connected, but final setup verification failed. Refreshing...');
          fetchWABAStatus();
        }
      } 
      // HANDLE ERRORS
      else if (data?.type === 'WHATSAPP_EMBEDDED_SIGNUP' && data.status === 'ERROR') {
        setLoading(false);
        setError(data.error || 'Signup failed');
        toast.error(data.error || 'WhatsApp signup failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setFormData]);

  // Handle Manual PIN Submission
  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length !== 6) {
      toast.error("Please enter a valid 6-digit PIN");
      return;
    }
    
    setSubmittingPin(true);
    try {
      const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
      
      const requestData = {
        ...pendingWabaData,
        pin: pinInput // Explicitly add the user-provided PIN
      };

      const result = await saveWABADirect(requestData);
      
      if (result.data?.requirePin) {
        toast.error("Incorrect PIN. Please try again.");
        setSubmittingPin(false);
        return;
      }

      if (result.data?.success) {
        setShowPinModal(false);
        setPendingWabaData(null);
        setPinInput("");
        
        setFormData(prev => ({
          ...prev,
          whatsappBusinessAccountId: result.data.wabaId,
          whatsappPhoneNumberId: result.data.phoneNumberId,
          whatsappPhoneNumber: result.data.phoneNumber,
          whatsappEnabled: true,
          whatsappPhoneRegistered: true, // Now we know it's registered
          whatsappPhoneVerificationStatus: 'valid'
        }));

        toast.success("Verification successful! Phone registered.");
        setTimeout(() => fetchWABAStatus(), 1000);
      }
    } catch (err) {
      console.error("PIN submission error:", err);
      toast.error("Failed to verify PIN. Please try again.");
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleManualSave = async () => {
    if (!user) {
      toast.error("Please log in to continue");
      return;
    }
    if (!manualWabaId.trim()) {
      toast.error("WABA ID is required");
      return;
    }

    setSavingManual(true);
    try {
      const saveWABADirect = httpsCallable(functions, "saveWABADirect");
      const requestData = {
        wabaId: manualWabaId.trim(),
        phoneNumberId: manualPhoneNumberId.trim() || null,
        phoneNumber: manualPhoneNumber.trim() || null,
        embeddedData: {
          manualEntry: true,
        },
      };

      const result = await saveWABADirect(requestData);

      if (result.data?.requirePin) {
        setPendingWabaData(requestData);
        setShowManualModal(false);
        setShowPinModal(true);
        toast.info("Two-step verification PIN required.");
        return;
      }

      if (result.data?.success) {
        setFormData(prev => ({
          ...prev,
          whatsappBusinessAccountId: result.data.wabaId,
          whatsappPhoneNumberId: result.data.phoneNumberId,
          whatsappPhoneNumber: result.data.phoneNumber,
          whatsappEnabled: true,
          whatsappProvider: "meta_tech_provider",
          whatsappCreatedVia: "manual_entry",
          whatsappPhoneRegistered: !!result.data.phoneNumberId,
          whatsappPhoneVerificationStatus: result.data.phoneNumberId ? "pending" : "not_registered",
          whatsappVerified: false,
          whatsappAccountReviewStatus: "PENDING",
        }));

        toast.success("WhatsApp details saved. Fetching status...");
        setShowManualModal(false);
        setManualWabaId("");
        setManualPhoneNumberId("");
        setManualPhoneNumber("");
        setTimeout(() => fetchWABAStatus(), 1000);
      }
    } catch (err) {
      console.error("Manual save failed:", err);
      toast.error("Failed to save WhatsApp details. Please try again.");
    } finally {
      setSavingManual(false);
    }
  };

  // Open Meta Embedded Signup
  const handleConnect = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionId = `embedded_${user.uid}_${Date.now()}`;
      await setDoc(doc(db, 'whatsappOAuthSessions', sessionId), {
        uid: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), 
        type: 'embedded_signup',
      });

      const signupUrl = `${EMBEDDED_SIGNUP_URL}&state=${sessionId}&redirect_uri=${encodeURIComponent(WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI)}`;
      
      console.log('🔗 Opening Signup URL with Redirect:', REDIRECT_URI);

      const width = 900;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const popup = window.open(
        signupUrl,
        'WhatsAppEmbeddedSignup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      popupRef.current = popup;

      if (!popup || popup.closed) {
        console.warn('Popup blocked, redirecting main window');
        window.location.href = signupUrl;
      } else {
        postMessageReceivedRef.current = false;
        
        const checkInterval = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkInterval);
            if (!postMessageReceivedRef.current && !showPinModal) {
              setLoading(true);
              setTimeout(async () => {
                try {
                  await handleCheckForAccount();
                } finally {
                  setLoading(false);
                }
              }, 1000);
            }
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Error starting signup:', err);
      setError('Failed to start signup. Please try again.');
      setLoading(false);
      toast.error('Failed to start WhatsApp signup');
    }
  };
  
  // Manual account detection
  const handleCheckForAccount = async () => {
    // ... (Keep existing implementation)
    // For brevity, using the same logic as previous file
    if (!user) {
        toast.error('Please log in to continue');
        return;
      }
  
      setLoading(true);
      setError(null);
      toast.info('Checking for your WhatsApp account...');
  
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Auth token missing');
        
        const response = await fetch(
          'https://us-central1-stockpilotv1.cloudfunctions.net/detectNewWABA',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({})
          }
        );
        
        const result = await response.json();
  
        if (result.found) {
          const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
          const saveResult = await saveWABADirect({
            wabaId: result.wabaId,
            phoneNumberId: result.primaryPhone?.id || null,
            phoneNumber: result.primaryPhone?.number || null,
            embeddedData: { detected: true }
          });
          
          // UPDATED: Check PIN requirement for manual detection too
          if (saveResult.data?.requirePin) {
             setPendingWabaData({
                wabaId: result.wabaId,
                phoneNumberId: result.primaryPhone?.id,
                phoneNumber: result.primaryPhone?.number,
                embeddedData: { detected: true }
             });
             setShowPinModal(true);
             setLoading(false);
             toast.info("Two-step verification PIN required.");
             return;
          }
  
          if (saveResult.data?.success) {
            toast.success('WhatsApp account found and connected!');
            setTimeout(() => fetchWABAStatus(), 2000);
          }
        } else {
          toast.info('No new account found.');
        }
      } catch (err) {
        console.error('Error checking for account:', err);
        setError('Failed to check for account.');
      } finally {
        setLoading(false);
      }
  };

  // If connected, show status
  if (isConnected && !showPinModal) {
    return (
      <WhatsAppStatus
        user={user}
        formData={formData}
        setFormData={setFormData}
        statusData={statusData}
        checkingStatus={checkingStatus}
        fetchWABAStatus={fetchWABAStatus}
      />
    );
  }

  return (
    <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-8 relative">
      
      {/* 2FA PIN MODAL */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 rounded-2xl p-6"
          >
            <div className="w-full max-w-sm text-center">
              <div className="mx-auto w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 border border-yellow-500/50">
                <FaLock className="text-yellow-400 text-xl" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Verification Required</h3>
              <p className="text-sm text-gray-400 mb-6">
                This phone number has Two-Step Verification enabled. Please enter your 6-digit WhatsApp PIN to register it.
              </p>
              
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="******"
                className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-white mb-6 focus:ring-2 focus:ring-green-500 outline-none"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition"
                  disabled={submittingPin}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinSubmit}
                  disabled={submittingPin || pinInput.length !== 6}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingPin ? <FaSpinner className="animate-spin" /> : "Verify PIN"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* MANUAL ENTRY MODAL */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 rounded-2xl p-6"
          >
            <div className="w-full max-w-md text-center">
              <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/50">
                <FaInfoCircle className="text-blue-400 text-xl" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Enter WhatsApp Details</h3>
              <p className="text-sm text-gray-400 mb-6">
                If you already created your WABA, paste the details from Meta Business Manager.
              </p>
              
              <div className="space-y-3 text-left">
                <input
                  type="text"
                  value={manualWabaId}
                  onChange={(e) => setManualWabaId(e.target.value)}
                  placeholder="WABA ID (required)"
                  className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={manualPhoneNumberId}
                  onChange={(e) => setManualPhoneNumberId(e.target.value)}
                  placeholder="Phone Number ID (optional)"
                  className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={manualPhoneNumber}
                  onChange={(e) => setManualPhoneNumber(e.target.value)}
                  placeholder="Phone Number (optional)"
                  className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition"
                  disabled={savingManual}
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualSave}
                  disabled={savingManual}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingManual ? <FaSpinner className="animate-spin" /> : "Save Details"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl"></div>
            <div className="relative p-5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full border-2 border-green-500/50">
              <FaWhatsapp className="w-16 h-16 text-green-400" />
            </div>
          </div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold text-white mb-2"
        >
          Connect WhatsApp Business
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400"
        >
          Unlock all WhatsApp Business Platform features with Meta Tech Provider integration
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-5 mb-6 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <FaShieldVirus className="text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Meta Tech Provider</span>
        </div>
        <p className="text-xs text-gray-400">
          As an official Meta Tech Provider, FLYP unlocks all WhatsApp and Meta features
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-8"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-5 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-green-500/30"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin text-xl" />
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
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-400" />
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={handleConnect}
              className="ml-auto px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              Retry
            </button>
          </div>
        </motion.div>
      )}

      {/* Benefits Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-4 mb-6"
      >
        <h3 className="text-sm font-semibold text-gray-400 text-center">What you'll unlock:</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 rounded-lg p-4 text-center">
            <FaBullhorn className="text-green-400 mx-auto mb-2 text-xl" />
            <p className="text-xs text-gray-300 font-medium">Marketing Messages</p>
            <p className="text-xs text-gray-500 mt-1">Send campaigns</p>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-4 text-center">
            <FaUsers className="text-green-400 mx-auto mb-2 text-xl" />
            <p className="text-xs text-gray-300 font-medium">Customer Engagement</p>
            <p className="text-xs text-gray-500 mt-1">Automated messaging</p>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-4 text-center">
            <FaChartBar className="text-green-400 mx-auto mb-2 text-xl" />
            <p className="text-xs text-gray-300 font-medium">Analytics & Insights</p>
            <p className="text-xs text-gray-500 mt-1">Track performance</p>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-4 text-center">
            <FaRocket className="text-green-400 mx-auto mb-2 text-xl" />
            <p className="text-xs text-gray-300 font-medium">Full API Access</p>
            <p className="text-xs text-gray-500 mt-1">Complete integration</p>
          </div>
        </div>
      </motion.div>

      {!loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6"
        >
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <FaInfoCircle className="text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-300">
                <p className="font-semibold text-white mb-1">Already completed the setup?</p>
                <p>If you've already created your WhatsApp Business Account but don't see it here, click below to detect it.</p>
              </div>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckForAccount}
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <FaCheckCircle />
                <span>Check for My Account</span>
              </>
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowManualModal(true)}
            disabled={loading}
            className="w-full mt-3 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3"
          >
            <FaInfoCircle />
            <span>Enter Details Manually</span>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default WhatsAppConnection;