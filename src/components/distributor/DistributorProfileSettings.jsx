import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db, storage, functions, auth } from "../../firebase/firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "react-toastify";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { WHATSAPP_PROVIDERS } from "../../services/whatsappService";
import WhatsAppAutoSetup from "./whatsapp/WhatsAppAutoSetup";
import WhatsAppSimpleSetup from "./whatsapp/WhatsAppSimpleSetup";
import WhatsAppTechProviderSetup from "./whatsapp/WhatsAppTechProviderSetup";
import WABAAccountManager from "./whatsapp/WABAAccountManager";

// Meta Embedded Signup URL - Tech Provider Configuration
// App ID: 1902565950686087
// Config ID: 844028501834041
// 
// IMPORTANT: Meta Embedded Signup works in TWO ways:
// 1. Popup/iframe → sends postMessage (works on localhost)
// 2. Redirect callback → redirects to URL configured in Meta App Dashboard (production only)
//
// For localhost: Use popup method (postMessage) - no redirect needed
// For production: Configure redirect_uri in Meta App Dashboard to: https://stockpilotv1.web.app/whatsapp/embedded-signup/callback
//
// DO NOT put redirect_uri in URL parameter - Meta ignores it. It must be configured in App Dashboard.
const EMBEDDED_SIGNUP_URL = `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=1902565950686087&config_id=844028501834041&extras=%7B%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D`;

// WhatsApp Onboarding Section - Built for first-time users
const WhatsAppOnboardingSection = ({ formData, setFormData, user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const popupRef = useRef(null);
  const postMessageReceivedRef = useRef(false);

  const isConnected = formData.whatsappEnabled && formData.whatsappBusinessAccountId;

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
        
        // Update formData with latest status info
        setFormData(prev => ({
          ...prev,
          whatsappPhoneNumber: status.phone?.phoneNumber || prev.whatsappPhoneNumber,
          whatsappPhoneNumberId: status.phone?.phoneNumberId || prev.whatsappPhoneNumberId,
          whatsappPhoneRegistered: status.phone?.registered || false,
          whatsappPhoneVerificationStatus: status.phone?.verificationStatus || 'not_registered',
          whatsappVerified: status.phone?.verified || false,
          whatsappAccountReviewStatus: status.accountReview?.status || 'PENDING',
        }));
        
        // Also update Firestore with latest status
        try {
          const userRef = doc(db, 'businesses', user.uid);
          await updateDoc(userRef, {
            whatsappPhoneNumber: status.phone?.phoneNumber || null,
            whatsappPhoneNumberId: status.phone?.phoneNumberId || null,
            whatsappPhoneRegistered: status.phone?.registered || false,
            whatsappPhoneVerificationStatus: status.phone?.verificationStatus || 'not_registered',
            whatsappVerified: status.phone?.verified || false,
            whatsappAccountReviewStatus: status.accountReview?.status || 'PENDING',
            whatsappStatusLastChecked: serverTimestamp(),
          });
        } catch (updateErr) {
          console.warn('Failed to update Firestore with status:', updateErr);
          // Non-critical, continue
        }
      }
    } catch (err) {
      console.error('Error fetching WABA status:', err);
      // Don't show error to user if it's just a transient issue
      if (err.code !== 'unauthenticated') {
        console.error('Status fetch error details:', err);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  // Real-time Firestore listener - Gemini's suggestion
  // This automatically updates UI when backend saves WABA data
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'businesses', user.uid);
    
    // Listen for real-time updates to user's WhatsApp data
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        
        // If WABA data exists and we don't have it in local state, update immediately
        if (userData.whatsappBusinessAccountId && !formData.whatsappBusinessAccountId) {
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
          
          // Fetch detailed status immediately
          setTimeout(() => fetchWABAStatus(), 1000);
        }
        
        // Update status if account review status changed
        if (userData.whatsappAccountReviewStatus && 
            userData.whatsappAccountReviewStatus !== formData.whatsappAccountReviewStatus) {
          console.log('🔄 Real-time update: Account review status changed');
          setFormData(prev => ({
            ...prev,
            whatsappAccountReviewStatus: userData.whatsappAccountReviewStatus,
            whatsappVerified: userData.whatsappVerified || false,
          }));
        }
        
        // Update phone verification status
        if (userData.whatsappPhoneVerificationStatus && 
            userData.whatsappPhoneVerificationStatus !== formData.whatsappPhoneVerificationStatus) {
          console.log('🔄 Real-time update: Phone verification status changed');
          setFormData(prev => ({
            ...prev,
            whatsappPhoneVerificationStatus: userData.whatsappPhoneVerificationStatus,
            whatsappPhoneRegistered: userData.whatsappPhoneRegistered || false,
          }));
        }
      }
    }, (error) => {
      console.error('Error in Firestore real-time listener:', error);
    });

    return () => unsubscribe();
  }, [user, formData.whatsappBusinessAccountId, formData.whatsappAccountReviewStatus, formData.whatsappPhoneVerificationStatus]);

  // Auto-fetch status when component loads if WABA exists but status is not loaded
  useEffect(() => {
    if (user && formData.whatsappBusinessAccountId) {
      // Only fetch if we don't have status data yet and we're not already checking
      const shouldFetch = !statusData && !checkingStatus;
      if (shouldFetch) {
        console.log('🔄 Auto-fetching WABA status on component load');
        fetchWABAStatus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, formData.whatsappBusinessAccountId]); // Only run when WABA ID changes or user changes

  // Poll for status updates when connected
  useEffect(() => {
    if (isConnected && formData.whatsappBusinessAccountId) {
      // Initial fetch
      if (!statusData) {
        fetchWABAStatus();
      }
      // Poll every 30 seconds for status updates
      const interval = setInterval(() => {
        fetchWABAStatus();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, formData.whatsappBusinessAccountId, user]);

  // Save WABA data to Firestore
  const saveWABAData = async (wabaId, phoneNumberId, phoneNumber, embeddedData) => {
    if (!user) throw new Error('User not authenticated');

    const userRef = doc(db, 'businesses', user.uid);
    
    // Save all data from embedded signup, including any access tokens or codes
    const updateData = {
      whatsappBusinessAccountId: wabaId,
      whatsappPhoneNumberId: phoneNumberId || null,
      whatsappPhoneNumber: phoneNumber || null,
      whatsappProvider: WHATSAPP_PROVIDERS.META_TECH_PROVIDER,
      whatsappEnabled: true,
      whatsappCreatedVia: 'embedded_signup',
      whatsappCreatedAt: new Date(),
      whatsappPhoneRegistered: phoneNumber ? true : false,
      whatsappPhoneVerificationStatus: phoneNumber ? 'pending' : 'not_registered', // Will be updated by webhook
      whatsappVerified: false, // Will be updated when account is approved
      whatsappAccountReviewStatus: 'PENDING', // Initial status, will be updated by webhook
      embeddedSignupData: embeddedData || {},
      // Save any additional fields from embedded signup
      ...(embeddedData?.access_token && { whatsappAccessToken: embeddedData.access_token }),
      ...(embeddedData?.code && { whatsappOAuthCode: embeddedData.code }),
      ...(embeddedData?.business_id && { metaBusinessId: embeddedData.business_id }),
    };

    await updateDoc(userRef, updateData);

    // Automatically setup webhook after account creation
    try {
      const setupWebhook = httpsCallable(functions, 'setupWebhookForClient');
      await setupWebhook();
      console.log('✅ Webhook setup initiated');
    } catch (webhookError) {
      console.warn('⚠️ Could not setup webhook automatically:', webhookError);
      // Non-critical, webhook can be set up later
    }
  };

  // Check if WABA was created by querying Meta API (fallback method)
  const checkForNewWABA = async () => {
    if (!user) return null;

    try {
      // Try to get WABAs associated with this user's Business Manager
      // We'll check if there's a new WABA that wasn't in our database
      const getClientWABA = httpsCallable(functions, 'getClientWABA');
      
      // First, check if user already has a WABA in Firestore
      const userRef = doc(db, 'businesses', user.uid);
      const userDoc = await getDoc(userRef);
      const existingWABAId = userDoc.data()?.whatsappBusinessAccountId;

      // If no WABA in Firestore, we need to find the newly created one
      // Note: This is a fallback - ideally postMessage should work
      // For now, we'll rely on the user to refresh or we'll detect it on next status check
      
      return null; // Return null for now - will be handled by status polling
    } catch (err) {
      console.error('Error checking for new WABA:', err);
      return null;
    }
  };

  // Listen for Meta postMessage responses
  // Gemini's suggestion: Add security check and handle FINISH event
  useEffect(() => {
    const handleMessage = async (event) => {
      // 1. Security check: only trust Meta (Gemini's suggestion)
      if (!event.origin.endsWith('facebook.com') && !event.origin.endsWith('meta.com')) {
        return;
      }

      // Log ALL messages from Meta domains for debugging
      if (event.origin.includes('facebook.com') || event.origin.includes('meta.com')) {
        console.log('📨 Received message from Meta:', {
          origin: event.origin,
          data: event.data,
          type: typeof event.data,
        });
      }

      const data = event.data;
      let wabaId, phoneNumberId, phoneNumber;
      let isFinishEvent = false;

      // Handle different response formats - log everything for debugging
      console.log('🔍 Processing Meta message:', data);

      // CRITICAL: Prioritize FINISH event - this is when user completes OTP and all data is available
      // Format 1b: WA_EMBEDDED_SIGNUP with FINISH event (HIGHEST PRIORITY)
      if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH' && data.data) {
        isFinishEvent = true;
        wabaId = data.data.waba_id;
        phoneNumberId = data.data.phone_number_id;
        phoneNumber = data.data.phone_number;
        console.log(`🎯 FINISH EVENT - WA_EMBEDDED_SIGNUP (OTP completed, all data available):`, { wabaId, phoneNumberId, phoneNumber });
      }
      // Format 1: Standard Embedded Signup response (WHATSAPP_EMBEDDED_SIGNUP)
      else if (data?.type === 'WHATSAPP_EMBEDDED_SIGNUP' && data.status === 'SUCCESS') {
        console.log('✅ Received WHATSAPP_EMBEDDED_SIGNUP SUCCESS:', data);
        wabaId = data.waba_id;
        phoneNumberId = data.phone_number_id;
        phoneNumber = data.phone_number;
      }
      // Format 1b fallback: WA_EMBEDDED_SIGNUP with 'success' event (if FINISH didn't fire)
      else if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'success' && data.data) {
        wabaId = data.data.waba_id;
        phoneNumberId = data.data.phone_number_id;
        phoneNumber = data.data.phone_number;
        console.log(`✅ Format 1b - WA_EMBEDDED_SIGNUP success (fallback):`, { wabaId, phoneNumberId, phoneNumber });
      } 
      // Format 2: Direct WABA ID in data
      else if (data?.waba_id || data?.wabaId) {
        console.log('✅ Received WABA data in message:', data);
        wabaId = data.waba_id || data.wabaId;
        phoneNumberId = data.phone_number_id || data.phoneNumberId;
        phoneNumber = data.phone_number || data.phoneNumber;
      }
      // Format 3: Check for nested data structures
      else if (data?.data?.waba_id || data?.result?.waba_id) {
        const nestedData = data.data || data.result;
        wabaId = nestedData.waba_id;
        phoneNumberId = nestedData.phone_number_id;
        phoneNumber = nestedData.phone_number;
        console.log('✅ Format 3 - Nested data:', { wabaId, phoneNumberId, phoneNumber });
      }
      // Format 4: String JSON (sometimes Meta sends stringified JSON)
      else if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.waba_id || parsed.wabaId) {
            wabaId = parsed.waba_id || parsed.wabaId;
            phoneNumberId = parsed.phone_number_id || parsed.phoneNumberId;
            phoneNumber = parsed.phone_number || parsed.phoneNumber;
            console.log('✅ Format 4 - Parsed JSON string:', { wabaId, phoneNumberId, phoneNumber });
          }
        } catch (e) {
          console.log('⚠️ Could not parse as JSON:', e);
        }
      } else {
        // Log other message types for debugging
        console.log('ℹ️ Received other message from Meta:', data);
      }

      if (wabaId) {
        // Mark that postMessage was received
        postMessageReceivedRef.current = true;
        
        // CRITICAL: If this is FINISH event, we MUST have phoneNumberId
        // If phoneNumberId is missing on FINISH, something is wrong
        if (isFinishEvent && !phoneNumberId) {
          console.error('❌ FINISH event received but phoneNumberId is missing! This should not happen.');
          toast.error('Account created but phone number data is incomplete. Please contact support.');
          setLoading(false);
          return;
        }
        
        // If phoneNumberId is missing (non-FINISH event), warn user but still save WABA
        if (!phoneNumberId && !isFinishEvent) {
          console.warn('⚠️ WABA ID received but phoneNumberId is missing. Waiting for FINISH event...');
          toast.info('Account created! Please complete phone verification in the Meta popup. Waiting for completion...');
          // Don't save yet - wait for FINISH event
          return;
        }
        
        setLoading(false);
        try {
          // CRITICAL: Use direct save function IMMEDIATELY when FINISH event is received
          // This triggers the complete "Post-Signup Orchestration" flow:
          // 1. Register phone number with Meta
          // 2. Subscribe app to WABA
          // 3. Update Firestore with enabled status
          const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
          
          console.log('🚀 Triggering saveWABADirect with complete data:', {
            wabaId,
            phoneNumberId,
            phoneNumber,
            isFinishEvent
          });
          
          const result = await saveWABADirect({
            wabaId,
            phoneNumberId: phoneNumberId || null, // Should always be present in FINISH event
            phoneNumber: phoneNumber || null,
            embeddedData: {
              ...data,
              pin: data.pin || data.registration_pin || data.data?.pin, // Include PIN if provided
              isFinishEvent, // Flag to indicate this is from FINISH event
            }
          });

          if (result.data?.success) {
            // Update local state
            setFormData(prev => ({
              ...prev,
              whatsappBusinessAccountId: result.data.wabaId,
              whatsappPhoneNumberId: result.data.phoneNumberId,
              whatsappPhoneNumber: result.data.phoneNumber,
              whatsappEnabled: true,
              whatsappProvider: WHATSAPP_PROVIDERS.META_TECH_PROVIDER,
              whatsappCreatedVia: 'embedded_signup',
              whatsappPhoneRegistered: result.data.phoneNumber ? true : false,
              whatsappPhoneVerificationStatus: result.data.phoneNumber ? 'pending' : 'not_registered',
              whatsappVerified: false, // Will be updated when account is approved
              whatsappAccountReviewStatus: 'PENDING', // Initial status
            }));
            toast.success('WhatsApp Business Account connected successfully! Fetching status...');
            
            // Fetch status immediately after connection (with retries)
            // Meta API sometimes needs a few seconds to process the new account
            setTimeout(() => {
              fetchWABAStatus();
            }, 1000);
            // Retry after 5 seconds
            setTimeout(() => {
              fetchWABAStatus();
            }, 6000);
            // Final retry after 15 seconds
            setTimeout(() => {
              fetchWABAStatus();
            }, 16000);
          } else {
            throw new Error(result.data?.message || 'Failed to save WABA');
          }
        } catch (err) {
          console.error('Error saving WABA:', err);
          setError('Failed to save account. Please try again.');
          toast.error('Failed to save WhatsApp account');
        }
      } else if (data?.status === 'ERROR' || data?.status === 'CANCELLED') {
        setLoading(false);
        setError(data.error_message || 'Signup was cancelled');
        toast.error(data.error_message || 'WhatsApp signup cancelled');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setFormData, user]);

  // Open Meta Embedded Signup
  const handleConnect = () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    // Create a session to identify the user (for both postMessage and redirect callback)
    const createSession = async () => {
      try {
        const sessionId = `embedded_${user.uid}_${Date.now()}`;
        await setDoc(doc(db, 'whatsappOAuthSessions', sessionId), {
          uid: user.uid,
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          type: 'embedded_signup',
        });

        // Add state parameter to URL for user identification
        const signupUrl = `${EMBEDDED_SIGNUP_URL}&state=${sessionId}`;
        
        // CRITICAL: Meta Embedded Signup works in TWO ways:
        // 1. If opened in popup/iframe → sends postMessage (we're listening for this)
        // 2. If redirect_uri configured in Meta Dashboard → redirects to callback URL
        
        // Try popup first (postMessage method - works immediately)
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
          // Popup blocked - fallback to redirect method
          console.warn('Popup blocked, using redirect method');
          // Redirect to callback will be handled by Meta if redirect_uri is configured
          window.location.href = signupUrl;
        } else {
          // Reset postMessage flag when opening new popup
          postMessageReceivedRef.current = false;
          
          // Monitor popup for postMessage or closure
          const checkInterval = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkInterval);
              
              // If popup closed without postMessage, try detecting WABA
              if (!postMessageReceivedRef.current) {
                console.log('🔄 Popup closed without postMessage. Triggering WABA detection...');
                toast.info('Detecting your WhatsApp account...');
                
                // Trigger auto-detection after a short delay
                setTimeout(async () => {
                  try {
                    // Ensure user is authenticated before calling function
                    if (!user || !user.uid) {
                      console.error('❌ User not authenticated');
                      setLoading(false);
                      toast.error('Please log in to continue');
                      return;
                    }
                    
                    console.log('🔍 Calling detectNewWABA for user:', user.uid);
                    
                    // Get auth token for authenticated request
                    const idToken = await auth.currentUser?.getIdToken();
                    if (!idToken) {
                      throw new Error('Failed to get authentication token');
                    }
                    
                    // Call function via HTTP with auth token (onRequest function with CORS)
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
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
                    }
                    
                    const result = { data: await response.json() };
                    
                    if (result.data?.found) {
                      console.log('✅ Found WABA via detection:', result.data);
                      
                      // Check if this is a suggested WABA (fallback match)
                      if (result.data.isSuggested) {
                        const wabaName = result.data.wabaData?.name || result.data.wabaId;
                        const confirmMessage = `Found 1 unassigned WABA: "${wabaName}". Is this your account?`;
                        const confirmed = window.confirm(confirmMessage);
                        
                        if (!confirmed) {
                          console.log('User rejected suggested WABA');
                          toast.info('WABA not assigned. You can manually assign it later.');
                          setLoading(false);
                          return;
                        }
                        
                        toast.info('Assigning suggested WABA...');
                      } else {
                        toast.success('Found your WhatsApp account! Saving...');
                      }
                      
                      const wabaId = result.data.wabaId;
                      const primaryPhone = result.data.primaryPhone;
                      
                      const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
                      const saveResult = await saveWABADirect({
                        wabaId,
                        phoneNumberId: primaryPhone?.id || null,
                        phoneNumber: primaryPhone?.number || null,
                        embeddedData: { 
                          detected: true, 
                          detectionMethod: result.data.matchReason || 'popup_close_fallback',
                          isSuggested: result.data.isSuggested || false
                        }
                      });
                      
                      if (saveResult.data?.success) {
                        // Refresh form data from Firestore
                        const userRef = doc(db, 'businesses', user.uid);
                        const snapshot = await getDoc(userRef);
                        if (snapshot.exists()) {
                          const updatedData = snapshot.data();
                          setFormData(prev => ({
                            ...prev,
                            whatsappBusinessAccountId: updatedData.whatsappBusinessAccountId,
                            whatsappPhoneNumberId: updatedData.whatsappPhoneNumberId,
                            whatsappPhoneNumber: updatedData.whatsappPhoneNumber,
                            whatsappEnabled: updatedData.whatsappEnabled || false,
                            whatsappProvider: WHATSAPP_PROVIDERS.META_TECH_PROVIDER,
                            whatsappCreatedVia: 'embedded_signup',
                            whatsappPhoneRegistered: updatedData.whatsappPhoneRegistered || false,
                            whatsappPhoneVerificationStatus: updatedData.whatsappPhoneVerificationStatus || 'pending',
                            whatsappVerified: updatedData.whatsappVerified || false,
                            whatsappAccountReviewStatus: updatedData.whatsappAccountReviewStatus || 'PENDING',
                          }));
                        }
                        
                        toast.success('WhatsApp Business Account connected successfully!');
                        
                        // Fetch status after a delay
                        setTimeout(() => {
                          fetchWABAStatus();
                        }, 2000);
                      } else {
                        throw new Error(saveResult.data?.message || 'Failed to save WABA');
                      }
                    } else {
                      console.log('⚠️ No WABA found via detection');
                      toast.warning('Account created but not detected yet. Please refresh the page or click "Check for Account" button.');
                    }
                  } catch (err) {
                    console.error("❌ WABA detection failed:", err);
                    
                    // Check if it's a CORS error
                    if (err.message?.includes('CORS') || err.code === 'functions/cors-error') {
                      console.error('❌ CORS error detected. This might be a Firebase Functions configuration issue.');
                      toast.error('Connection error. Please refresh the page and try again, or click "Check for Account" button.');
                    } else {
                      toast.error('Failed to detect account. Please click "Check for Account" to try again.');
                    }
                  } finally {
                    // Always set loading to false after detection completes
                    setLoading(false);
                  }
                }, 3000); // Increased delay to 3 seconds to give Meta time to process
              } else {
                // PostMessage was received, loading will be handled by handleMessage
                console.log('✅ PostMessage was received, skipping detection');
                setLoading(false);
              }
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Error creating session:', err);
        setError('Failed to start signup. Please try again.');
        setLoading(false);
        toast.error('Failed to start WhatsApp signup');
      }
    };

    createSession();
  };

  // If already connected, show status and WABAAccountManager
  if (isConnected) {
    return (
      <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FaWhatsapp className="w-6 h-6 text-green-400" />
            </div>
            WhatsApp Business
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchWABAStatus}
              disabled={checkingStatus}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <FaSpinner className={checkingStatus ? 'animate-spin' : ''} />
              Refresh Status
            </button>
            <button
              onClick={() => {
                window.location.href = '/distributor-dashboard#/distributor-dashboard?tab=whatsapp&review=true';
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaVideo className="text-xs" />
              Meta App Review
            </button>
          </div>
        </div>

        {/* Real-Time Status Display */}
        <div className="space-y-4">
          {/* Loading State */}
          {checkingStatus && !statusData && (
            <div className="rounded-xl p-4 border-2 border-blue-500 bg-blue-900/20">
              <div className="flex items-center gap-3">
                <FaSpinner className="text-blue-400 animate-spin text-xl" />
                <div>
                  <h3 className="font-bold text-white">Checking Account Status...</h3>
                  <p className="text-sm text-blue-300">Fetching latest information from Meta</p>
                </div>
              </div>
            </div>
          )}

          {/* Account Info Card */}
          {formData.whatsappBusinessAccountId && (
            <div className="rounded-xl p-4 border-2 border-white/10 bg-slate-800/40">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <FaBuilding />
                  Your WhatsApp Business Account
                </h3>
                <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">Connected</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">WABA ID:</span>
                  <span className="text-white font-mono">{formData.whatsappBusinessAccountId}</span>
                </div>
                {formData.whatsappPhoneNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone Number:</span>
                    <span className="text-white">{formData.whatsappPhoneNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Account Review Status */}
          {statusData ? (
            <>
              <div className={`rounded-xl p-4 border-2 ${
                statusData.accountReview.isApproved 
                  ? 'border-emerald-500 bg-emerald-900/20' 
                  : statusData.accountReview.isPending
                  ? 'border-yellow-500 bg-yellow-900/20'
                  : 'border-red-500 bg-red-900/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <FaShieldVirus />
                    Account Review Status
                  </h3>
                  {statusData.accountReview.isApproved ? (
                    <FaCheckCircle className="text-emerald-400 text-xl" />
                  ) : statusData.accountReview.isPending ? (
                    <FaSpinner className="text-yellow-400 animate-spin text-xl" />
                  ) : (
                    <FaExclamationTriangle className="text-red-400 text-xl" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className={`text-sm font-medium ${
                    statusData.accountReview.isApproved ? 'text-emerald-300' :
                    statusData.accountReview.isPending ? 'text-yellow-300' :
                    'text-red-300'
                  }`}>
                    {statusData.accountReview.status}
                  </p>
                  <p className="text-xs text-gray-400">
                    {statusData.accountReview.message}
                  </p>
                  {statusData.accountReview.isPending && (
                    <p className="text-xs text-yellow-300 mt-2">
                      ⏳ Meta is reviewing your account. This usually takes 24-48 hours. You'll be notified when the review is complete.
                    </p>
                  )}
                </div>
              </div>

              {/* Phone Status */}
              <div className={`rounded-xl p-4 border-2 ${
                statusData.phone.verified 
                  ? 'border-emerald-500 bg-emerald-900/20' 
                  : statusData.phone.registered
                  ? 'border-yellow-500 bg-yellow-900/20'
                  : 'border-gray-500 bg-gray-900/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <FaPhone />
                    Phone Number Status
                  </h3>
                  {statusData.phone.verified ? (
                    <FaCheckCircle className="text-emerald-400 text-xl" />
                  ) : statusData.phone.registered ? (
                    <FaExclamationCircle className="text-yellow-400 text-xl" />
                  ) : (
                    <FaTimes className="text-gray-400 text-xl" />
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  {statusData.phone.phoneNumber ? (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Phone Number:</span>
                      <span className="text-white font-medium">{statusData.phone.phoneNumber}</span>
                    </div>
                  ) : (
                    <p className="text-gray-400">No phone number added yet</p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      statusData.phone.verified ? 'text-emerald-300' :
                      statusData.phone.registered ? 'text-yellow-300' :
                      'text-gray-400'
                    }`}>
                      {statusData.phone.verified 
                        ? '✓ Verified and Connected' 
                        : statusData.phone.registered
                        ? `⚠ ${statusData.phone.verificationStatus} - Needs Verification`
                        : '❌ Not Registered'}
                    </span>
                  </div>
                  {statusData.phone.needsVerification && (
                    <div className="mt-2 p-2 bg-yellow-900/30 rounded text-xs text-yellow-300">
                      💡 Complete phone verification in Meta Business Suite to start sending messages
                    </div>
                  )}
                </div>
              </div>

              {/* WABA Details */}
              {statusData.waba && (
                <div className="rounded-xl p-4 border-2 border-white/10 bg-slate-800/40">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <FaInfoCircle />
                    Account Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Account Name:</span>
                      <span className="text-white">{statusData.waba.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <span className={statusData.waba.isEnabled ? 'text-emerald-300' : 'text-red-300'}>
                        {statusData.waba.isEnabled ? '✓ Enabled' : '❌ Disabled'}
                      </span>
                    </div>
                    {statusData.waba.timezone && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Time Zone:</span>
                        <span className="text-white">{statusData.waba.timezone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pending Actions */}
              {statusData.overall.needsAction && statusData.overall.pendingActions.length > 0 && (
                <div className="rounded-xl p-4 border-2 border-yellow-500 bg-yellow-900/20">
                  <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                    <FaInfoCircle />
                    Action Required
                  </h3>
                  <p className="text-sm text-yellow-300 mb-2">Complete these steps to fully activate your account:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-200">
                    {statusData.overall.pendingActions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* All Ready Status */}
              {statusData.overall.ready && (
                <div className="rounded-xl p-4 border-2 border-emerald-500 bg-emerald-900/20">
                  <div className="flex items-center gap-3 mb-2">
                    <FaCheckCircle className="text-emerald-400 text-2xl" />
                    <h3 className="font-bold text-white text-lg">All Set! Account is Ready</h3>
                  </div>
                  <p className="text-sm text-emerald-300">
                    Your WhatsApp Business Account is fully configured and ready to use. You can now send messages, create campaigns, and use all WhatsApp Business features.
                  </p>
                </div>
              )}
            </>
          ) : !checkingStatus && formData.whatsappBusinessAccountId && (
            <div className="rounded-xl p-4 border-2 border-gray-500 bg-gray-900/20">
              <div className="flex items-center gap-3">
                <FaInfoCircle className="text-gray-400" />
                <div>
                  <h3 className="font-bold text-white">Status Information</h3>
                  <p className="text-sm text-gray-400">Click "Refresh Status" to see your account review and phone verification status</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <WABAAccountManager 
          onWABAChange={async (result) => {
            if (!user) return;
            const userRef = doc(db, "businesses", user.uid);
            const snapshot = await getDoc(userRef);
            if (snapshot.exists()) {
              const data = snapshot.data();
              setFormData(prev => ({
                ...prev,
                ...data,
                whatsappEnabled: data.whatsappEnabled || false,
                whatsappProvider: data.whatsappProvider || WHATSAPP_PROVIDERS.META_TECH_PROVIDER,
                whatsappVerified: data.whatsappVerified || false,
                whatsappBusinessAccountId: data.whatsappBusinessAccountId || '',
                whatsappPhoneNumberId: data.whatsappPhoneNumberId || '',
              }));
              // Refresh status after WABA change
              setTimeout(() => fetchWABAStatus(), 1000);
            }
          }}
        />
      </div>
    );
  }

  // Check for newly created account (manual detection)
  const handleCheckForAccount = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);
    toast.info('Checking for your WhatsApp account...');

    try {
      // Get auth token for authenticated request
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Failed to get authentication token');
      }
      
      // Call function via HTTP with auth token (onRequest function with CORS)
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }
      
      const result = { data: await response.json() };

      if (result.data?.success && result.data.found) {
        // Found a new WABA! Save it using saveWABADirect (includes orchestration)
        const wabaId = result.data.wabaId;
        const primaryPhone = result.data.primaryPhone;

        console.log('✅ Found WABA via manual check:', { wabaId, primaryPhone });
        
        // Check if this is a suggested WABA (fallback match)
        if (result.data.isSuggested) {
          const wabaName = result.data.wabaData?.name || wabaId;
          const confirmMessage = `Found 1 unassigned WABA: "${wabaName}".\n\nIs this your WhatsApp Business Account?`;
          const confirmed = window.confirm(confirmMessage);
          
          if (!confirmed) {
            console.log('User rejected suggested WABA');
            toast.info('WABA not assigned. You can manually assign it using the WABA ID.');
            setLoading(false);
            return;
          }
          
          toast.info('Assigning suggested WABA...');
        } else {
          toast.success('Found your account! Saving...');
        }

        const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
        const saveResult = await saveWABADirect({
          wabaId,
          phoneNumberId: primaryPhone?.id || null,
          phoneNumber: primaryPhone?.number || null,
          embeddedData: { 
            detected: true, 
            detectionMethod: result.data.matchReason || 'manual_check',
            isSuggested: result.data.isSuggested || false
          }
        });

        if (saveResult.data?.success) {
          // Refresh form data from Firestore
          const userRef = doc(db, 'businesses', user.uid);
          const snapshot = await getDoc(userRef);
          if (snapshot.exists()) {
            const updatedData = snapshot.data();
            setFormData(prev => ({
              ...prev,
              whatsappBusinessAccountId: updatedData.whatsappBusinessAccountId,
              whatsappPhoneNumberId: updatedData.whatsappPhoneNumberId,
              whatsappPhoneNumber: updatedData.whatsappPhoneNumber,
              whatsappEnabled: updatedData.whatsappEnabled || false,
              whatsappProvider: WHATSAPP_PROVIDERS.META_TECH_PROVIDER,
              whatsappCreatedVia: 'embedded_signup',
              whatsappPhoneRegistered: updatedData.whatsappPhoneRegistered || false,
              whatsappPhoneVerificationStatus: updatedData.whatsappPhoneVerificationStatus || 'pending',
              whatsappVerified: updatedData.whatsappVerified || false,
              whatsappAccountReviewStatus: updatedData.whatsappAccountReviewStatus || 'PENDING',
            }));
          }

          // Fetch full status after a delay
          setTimeout(() => fetchWABAStatus(), 2000);
          toast.success('WhatsApp Business Account found and connected!');
        } else {
          throw new Error(saveResult.data?.message || 'Failed to save WABA');
        }
      } else {
        // Check if there are unassigned WABAs that could be manually assigned
        if (result.data?.allWABAs && result.data.allWABAs.length > 0) {
          const wabaList = result.data.allWABAs.map(w => `"${w.name || w.id}"`).join(', ');
          const message = `Found ${result.data.allWABAs.length} unassigned WABA(s): ${wabaList}.\n\nWould you like to manually assign one?`;
          const shouldAssign = window.confirm(message);
          
          if (shouldAssign) {
            const wabaId = prompt(`Enter the WABA ID to assign:\n\nAvailable WABAs:\n${result.data.allWABAs.map(w => `- ${w.id} (${w.name || 'No name'})`).join('\n')}`);
            if (wabaId && wabaId.trim()) {
              try {
                const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
                const saveResult = await saveWABADirect({
                  wabaId: wabaId.trim(),
                  embeddedData: { 
                    detected: false, 
                    detectionMethod: 'manual_assignment',
                    assignedBy: user.uid
                  }
                });
                
                if (saveResult.data?.success) {
                  toast.success('WABA assigned successfully!');
                  // Refresh form data
                  const userRef = doc(db, 'businesses', user.uid);
                  const snapshot = await getDoc(userRef);
                  if (snapshot.exists()) {
                    const updatedData = snapshot.data();
                    setFormData(prev => ({
                      ...prev,
                      whatsappBusinessAccountId: updatedData.whatsappBusinessAccountId,
                      whatsappPhoneNumberId: updatedData.whatsappPhoneNumberId,
                      whatsappPhoneNumber: updatedData.whatsappPhoneNumber,
                      whatsappEnabled: updatedData.whatsappEnabled || false,
                    }));
                  }
                  setTimeout(() => fetchWABAStatus(), 2000);
                } else {
                  throw new Error(saveResult.data?.message || 'Failed to assign WABA');
                }
              } catch (assignErr) {
                console.error('Error assigning WABA:', assignErr);
                toast.error('Failed to assign WABA: ' + assignErr.message);
              }
            }
          }
        } else {
          toast.info('No new account found. If you just completed setup, please wait a moment and try again.');
        }
      }
    } catch (err) {
      console.error('❌ Error checking for account:', err);
      
      // Check if it's a CORS error
      if (err.message?.includes('CORS') || err.code === 'functions/cors-error' || err.message?.includes('Access-Control-Allow-Origin')) {
        console.error('❌ CORS error detected. This might be a Firebase Functions configuration issue.');
        setError('Connection error. Please refresh the page and try again.');
        toast.error('Connection error. Please refresh the page and try again.');
      } else {
        setError('Failed to check for account. Please try again.');
        toast.error('Failed to check for account: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // FIRST-TIME USER ONBOARDING DESIGN
  return (
    <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-8">
      {/* Header */}
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

      {/* Tech Provider Badge */}
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
          As an official Meta Tech Provider, FLYP unlocks all WhatsApp and Meta features to enable unstoppable opportunities
        </p>
      </motion.div>

      {/* Main Action Button */}
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

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-400" />
            <div className="flex-1">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
            <button
              onClick={handleConnect}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
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

      {/* Business Portfolio Guidance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5 mb-6"
      >
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">Complete Your Business Portfolio</h4>
            <p className="text-xs text-blue-200/80 mb-3">
              To ensure your WhatsApp Business Account is approved quickly, complete your Business Portfolio in Meta Business Suite:
            </p>
            <ul className="text-xs text-blue-200/70 space-y-1.5 list-disc list-inside">
              <li>Add a <strong>Website URL</strong> (helps Meta verify your business)</li>
              <li>Link a <strong>Primary Facebook Page</strong> (required for faster approval)</li>
              <li>Add a <strong>Business Phone Number</strong> (if not already added)</li>
              <li>Complete your <strong>Business Information</strong> (address, category, etc.)</li>
            </ul>
            <p className="text-xs text-blue-200/60 mt-3 italic">
              💡 Tip: Accounts with complete Business Portfolios are typically approved within 24-48 hours.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Simple Instructions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4"
      >
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-white mb-1">How it works:</p>
            <p>Click the button above → Log in with Facebook → Follow Meta's guided setup → Your WhatsApp Business Account connects automatically to FLYP</p>
          </div>
        </div>
      </motion.div>

      {/* Check for Account Button - For users who completed setup but account wasn't detected */}
      {!loading && !isConnected && (
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
                <p>If you've already created your WhatsApp Business Account but don't see it here, click the button below to detect it.</p>
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
        </motion.div>
      )}
    </div>
  );
};

import { 
  FaUser, FaBuilding, FaPalette, FaWhatsapp, FaCog, 
  FaCheckCircle, FaExclamationCircle, FaEnvelope, 
  FaPhone, FaIdCard, FaMapMarkerAlt, FaCity, FaGlobe,
  FaSave, FaUpload, FaInfoCircle, FaShieldAlt, FaChartLine,
  FaAward, FaClock, FaEdit, FaCheck, FaTimes, FaUniversity,
  FaCreditCard, FaBell, FaLock, FaCalendarAlt, FaFileInvoiceDollar,
  FaPlug, FaChartBar, FaKey, FaFilePdf, FaCertificate, FaHistory,
  FaDesktop, FaMobile, FaTrash, FaEye, FaEyeSlash, FaVideo,
  FaFacebook, FaArrowRight, FaSpinner, FaExclamationTriangle,
  FaRocket, FaUsers, FaBullhorn, FaShieldVirus
} from "react-icons/fa";

const DistributorProfileSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    ownerName: "",
    email: "",
    phone: "",
    businessName: "",
    distributorName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    logoUrl: "",
    gstNumber: "",
    panNumber: "",
    businessType: "Distributor",
    invoicePreference: "Minimal",
    whatsappAlerts: false,
    emailNotifications: true,
    smsNotifications: false,
    profileVersion: 0,
    lastUpdated: "",
    businessMode: "Online",
    flypId: "",
    // Banking & Payment
    bankName: "",
    bankBranch: "",
    bankAccountNumber: "",
    bankIfsc: "",
    bankAccountName: "",
    upiId: "",
    // Business Hours
    businessHours: {
      monday: { open: "09:00", close: "18:00", closed: false },
      tuesday: { open: "09:00", close: "18:00", closed: false },
      wednesday: { open: "09:00", close: "18:00", closed: false },
      thursday: { open: "09:00", close: "18:00", closed: false },
      friday: { open: "09:00", close: "18:00", closed: false },
      saturday: { open: "09:00", close: "18:00", closed: false },
      sunday: { open: "09:00", close: "18:00", closed: true },
    },
    // Credit & Payment Terms
    defaultCreditDays: 30,
    paymentTerms: "Net 30",
    autoSendInvoice: false,
    // Security
    twoFactorEnabled: false,
    sessionTimeout: 30,
    whatsappEnabled: false,
    whatsappProvider: WHATSAPP_PROVIDERS.DIRECT,
    whatsappApiKey: "",
    whatsappApiSecret: "",
    whatsappPhoneNumberId: "",
    whatsappBusinessAccountId: "",
    whatsappAccessToken: "",
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioWhatsAppFrom: "",
    whatsappVerified: false,
    // Documents
    gstCertificateUrl: "",
    panCardUrl: "",
    businessLicenseUrl: "",
    tradeLicenseUrl: "",
    // Verification status
    gstVerified: false,
    panVerified: false,
    businessVerified: false,
    bankVerified: false,
  });
  const [activeSection, setActiveSection] = useState("owner");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  // Document upload state
  const [documents, setDocuments] = useState({
    gstCertificate: null,
    panCard: null,
    businessLicense: null,
    tradeLicense: null,
  });
  const [documentPreviews, setDocumentPreviews] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  
  // Profile history state
  const [profileHistory, setProfileHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Active sessions state
  const [activeSessions, setActiveSessions] = useState([]);

  // Check URL for section parameter
  useEffect(() => {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const params = new URLSearchParams(hash.substring(qIndex + 1));
      const section = params.get('section');
      if (section) {
        const validSections = ["owner", "business", "tax", "banking", "branding", "notifications", "whatsapp", "credit", "hours", "security", "integrations", "preferences"];
        if (validSections.includes(section)) {
          setActiveSection(section);
        }
      }
    }
  }, []);

  const auth = getAuth();
  const user = auth.currentUser;
  
  // Load profile history
  useEffect(() => {
    const loadHistory = async () => {
      if (!user) return;
      setLoadingHistory(true);
      try {
        const historyRef = collection(db, "businesses", user.uid, "profileHistory");
        const q = query(historyRef, orderBy("timestamp", "desc"), limit(20));
        const snapshot = await getDocs(q);
        setProfileHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error loading history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };
    if (activeSection === "security") {
      loadHistory();
    }
  }, [user, activeSection]);
  
  // Load active sessions (mock data for now - can be enhanced with real session tracking)
  useEffect(() => {
    if (activeSection === "security" && user) {
      setActiveSessions([
        {
          id: "current",
          device: navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop",
          location: "Current Session",
          lastActive: new Date().toISOString(),
          current: true,
        },
      ]);
    }
  }, [user, activeSection]);

  // Calculate profile completion percentage
  const profileCompletion = useMemo(() => {
    const fields = [
      formData.ownerName,
      formData.email,
      formData.phone,
      formData.businessName,
      formData.address,
      formData.city,
      formData.state,
      formData.pincode,
      formData.gstNumber,
      formData.flypId,
      formData.logoUrl,
      formData.bankName,
      formData.bankAccountNumber,
      formData.upiId,
    ];
    const completed = fields.filter(f => f && f.trim() !== "").length;
    return Math.round((completed / fields.length) * 100);
  }, [formData]);

  // Navigation items with icons
  const navItems = [
    { id: "owner", label: t("profile.ownerInfo") || "Owner Info", icon: FaUser, color: "from-purple-500 to-pink-500" },
    { id: "business", label: t("profile.businessDetails") || "Business", icon: FaBuilding, color: "from-indigo-500 to-blue-500" },
    { id: "tax", label: "Tax Information", icon: FaFileInvoiceDollar, color: "from-orange-500 to-red-500" },
    { id: "banking", label: "Banking & Payment", icon: FaUniversity, color: "from-blue-500 to-cyan-500" },
    { id: "branding", label: t("profile.branding") || "Branding", icon: FaPalette, color: "from-pink-500 to-rose-500" },
    { id: "notifications", label: "Notifications", icon: FaBell, color: "from-yellow-500 to-orange-500" },
    { id: "whatsapp", label: "WhatsApp", icon: FaWhatsapp, color: "from-green-500 to-emerald-500" },
    { id: "credit", label: "Credit & Terms", icon: FaCreditCard, color: "from-teal-500 to-cyan-500" },
    { id: "hours", label: "Business Hours", icon: FaCalendarAlt, color: "from-violet-500 to-purple-500" },
    { id: "security", label: "Security", icon: FaLock, color: "from-red-500 to-pink-500" },
    { id: "integrations", label: "Integrations", icon: FaPlug, color: "from-indigo-500 to-blue-500" },
    { id: "preferences", label: t("profile.preferences") || "Preferences", icon: FaCog, color: "from-gray-500 to-slate-500" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const userRef = doc(db, "businesses", user.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFormData((prev) => ({
          ...prev,
          ...data,
          ownerName: data.ownerName || data.name || "",
          businessName: data.businessName || data.distributorName || "",
          distributorName: data.distributorName || data.businessName || "",
          email: data.email || user.email || "",
          panNumber: data.panNumber || "",
          whatsappEnabled: data.whatsappEnabled || false,
          whatsappProvider: data.whatsappProvider || WHATSAPP_PROVIDERS.DIRECT,
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || "",
          whatsappBusinessAccountId: data.whatsappBusinessAccountId || "",
          whatsappAccessToken: data.whatsappAccessToken || "",
          twilioAccountSid: data.twilioAccountSid || "",
          twilioAuthToken: data.twilioAuthToken || "",
          twilioWhatsAppFrom: data.twilioWhatsAppFrom || "",
          whatsappVerified: data.whatsappVerified || false,
          emailNotifications: data.emailNotifications !== undefined ? data.emailNotifications : true,
          smsNotifications: data.smsNotifications || false,
          bankName: data.bankName || "",
          bankBranch: data.bankBranch || "",
          bankAccountNumber: data.bankAccountNumber || "",
          bankIfsc: data.bankIfsc || "",
          bankAccountName: data.bankAccountName || "",
          upiId: data.upiId || "",
          businessHours: data.businessHours || prev.businessHours,
          defaultCreditDays: data.defaultCreditDays || 30,
          paymentTerms: data.paymentTerms || "Net 30",
          autoSendInvoice: data.autoSendInvoice || false,
          twoFactorEnabled: data.twoFactorEnabled || false,
          sessionTimeout: data.sessionTimeout || 30,
          gstCertificateUrl: data.gstCertificateUrl || "",
          panCardUrl: data.panCardUrl || "",
          businessLicenseUrl: data.businessLicenseUrl || "",
          tradeLicenseUrl: data.tradeLicenseUrl || "",
          gstVerified: data.gstVerified || false,
          panVerified: data.panVerified || false,
          businessVerified: data.businessVerified || false,
          bankVerified: data.bankVerified || false,
        }));
        if (data.logoUrl) {
          setLogoPreview(data.logoUrl);
        }
        // Load document previews
        if (data.gstCertificateUrl) setDocumentPreviews(prev => ({ ...prev, gstCertificate: data.gstCertificateUrl }));
        if (data.panCardUrl) setDocumentPreviews(prev => ({ ...prev, panCard: data.panCardUrl }));
        if (data.businessLicenseUrl) setDocumentPreviews(prev => ({ ...prev, businessLicense: data.businessLicenseUrl }));
        if (data.tradeLicenseUrl) setDocumentPreviews(prev => ({ ...prev, tradeLicense: data.tradeLicenseUrl }));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      let updatedData = {
        name: formData.ownerName,
        distributorName: formData.distributorName || formData.businessName,
        businessName: formData.businessName || formData.distributorName,
        profileVersion: (formData.profileVersion || 0) + 1,
        lastUpdated: new Date().toISOString(),
      };

      if (formData.phone) updatedData.phone = formData.phone;
      if (formData.address) updatedData.address = formData.address;
      if (formData.city) updatedData.city = formData.city;
      if (formData.state) updatedData.state = formData.state;
      if (formData.pincode) updatedData.pincode = formData.pincode;
      if (formData.gstNumber) updatedData.gstNumber = formData.gstNumber;
      if (formData.panNumber) updatedData.panNumber = formData.panNumber;
      if (formData.invoicePreference) updatedData.invoicePreference = formData.invoicePreference;
      if (formData.businessMode) updatedData.businessMode = formData.businessMode;
      if (formData.whatsappAlerts !== undefined) updatedData.whatsappAlerts = formData.whatsappAlerts;
      if (formData.emailNotifications !== undefined) updatedData.emailNotifications = formData.emailNotifications;
      if (formData.smsNotifications !== undefined) updatedData.smsNotifications = formData.smsNotifications;
      if (formData.bankName) updatedData.bankName = formData.bankName;
      if (formData.bankBranch) updatedData.bankBranch = formData.bankBranch;
      if (formData.bankAccountNumber) updatedData.bankAccountNumber = formData.bankAccountNumber;
      if (formData.bankIfsc) updatedData.bankIfsc = formData.bankIfsc;
      if (formData.bankAccountName) updatedData.bankAccountName = formData.bankAccountName;
      if (formData.upiId) updatedData.upiId = formData.upiId;
      if (formData.businessHours) updatedData.businessHours = formData.businessHours;
      if (formData.defaultCreditDays) updatedData.defaultCreditDays = formData.defaultCreditDays;
      if (formData.paymentTerms) updatedData.paymentTerms = formData.paymentTerms;
      if (formData.autoSendInvoice !== undefined) updatedData.autoSendInvoice = formData.autoSendInvoice;
      if (formData.twoFactorEnabled !== undefined) updatedData.twoFactorEnabled = formData.twoFactorEnabled;
      if (formData.sessionTimeout) updatedData.sessionTimeout = formData.sessionTimeout;
      if (formData.gstCertificateUrl) updatedData.gstCertificateUrl = formData.gstCertificateUrl;
      if (formData.panCardUrl) updatedData.panCardUrl = formData.panCardUrl;
      if (formData.businessLicenseUrl) updatedData.businessLicenseUrl = formData.businessLicenseUrl;
      if (formData.tradeLicenseUrl) updatedData.tradeLicenseUrl = formData.tradeLicenseUrl;

      updatedData.whatsappEnabled = formData.whatsappEnabled || false;
      updatedData.whatsappProvider = formData.whatsappProvider || WHATSAPP_PROVIDERS.DIRECT;
      updatedData.whatsappPhoneNumberId = formData.whatsappPhoneNumberId || '';
      updatedData.whatsappBusinessAccountId = formData.whatsappBusinessAccountId || '';
      updatedData.whatsappAccessToken = formData.whatsappAccessToken || '';
      updatedData.twilioAccountSid = formData.twilioAccountSid || '';
      updatedData.twilioAuthToken = formData.twilioAuthToken || '';
      updatedData.twilioWhatsAppFrom = formData.twilioWhatsAppFrom || '';
      if (formData.whatsappVerified !== undefined) updatedData.whatsappVerified = formData.whatsappVerified;

      if (logoFile) {
        const storageRef = ref(storage, `logos/${user.uid}`);
        await uploadBytes(storageRef, logoFile);
        const downloadURL = await getDownloadURL(storageRef);
        updatedData.logoUrl = downloadURL;
      }

      const userRef = doc(db, "businesses", user.uid);
      const oldData = (await getDoc(userRef)).data() || {};
      
      // Track changes for history
      const changes = [];
      Object.keys(updatedData).forEach(key => {
        if (key !== 'profileVersion' && key !== 'lastUpdated' && oldData[key] !== updatedData[key]) {
          changes.push({
            field: key,
            oldValue: oldData[key] || '',
            newValue: updatedData[key] || '',
          });
        }
      });
      
      await updateDoc(userRef, updatedData);
      
      // Save to history if there are changes
      if (changes.length > 0) {
        try {
          await addDoc(collection(db, "businesses", user.uid, "profileHistory"), {
            changes,
            timestamp: serverTimestamp(),
            updatedBy: user.uid,
            section: activeSection,
          });
        } catch (histErr) {
          console.warn("Failed to save history:", histErr);
        }
      }

      toast.success(t("profile.changesSaved") || "Profile updated successfully!");
      setLogoFile(null);
    } catch (err) {
      console.error("Update failed", err);
      if (err.code === 'permission-denied') {
        toast.error("Permission denied. Please check your Firestore security rules or contact support.");
      } else if (err.code === 'unavailable') {
        toast.error("Service temporarily unavailable. Please try again.");
      } else {
        toast.error(`Failed to update profile: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const generateFlypId = async () => {
    if (!user) return;
    const confirm = window.confirm(t("profile.confirmFlypId") || "Are you sure you want to generate your unique FLYP ID? This cannot be changed later.");
    if (!confirm) return;
    const randomId = "FLYP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const userRef = doc(db, "businesses", user.uid);
    await updateDoc(userRef, { flypId: randomId });
    setFormData((prev) => ({ ...prev, flypId: randomId }));
    toast.success("✅ " + (t("profile.flypIdCreated") || "Your FLYP ID has been created!"));
  };

  // Password change handler
  const handlePasswordChange = async () => {
    if (!user || changingPassword) return;
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    
    setChangingPassword(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwordData.newPassword);
      
      // Log password change to history
      await addDoc(collection(db, "businesses", user.uid, "profileHistory"), {
        changes: [{ field: "password", oldValue: "***", newValue: "***" }],
        timestamp: serverTimestamp(),
        updatedBy: user.uid,
        section: "security",
        action: "password_changed",
      });
      
      toast.success("Password changed successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error("Password change failed", err);
      if (err.code === "auth/wrong-password") {
        toast.error("Current password is incorrect");
      } else if (err.code === "auth/weak-password") {
        toast.error("New password is too weak");
      } else {
        toast.error(`Failed to change password: ${err.message}`);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // Document upload handler
  const handleDocumentUpload = async (docType, file) => {
    if (!user || !file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }
    
    setUploadingDoc(docType);
    try {
      const storageRef = ref(storage, `documents/${user.uid}/${docType}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Map document types to formData fields
      const docFieldMap = {
        gstCertificate: "gstCertificateUrl",
        panCard: "panCardUrl",
        businessLicense: "businessLicenseUrl",
        tradeLicense: "tradeLicenseUrl",
      };
      
      const docField = docFieldMap[docType];
      if (docField) {
        // Update formData with document URL
        setFormData((prev) => ({ ...prev, [docField]: downloadURL }));
        
        // Update Firestore
        const userRef = doc(db, "businesses", user.uid);
        await updateDoc(userRef, { [docField]: downloadURL });
        
        // Log to history
        try {
          await addDoc(collection(db, "businesses", user.uid, "profileHistory"), {
            changes: [{ field: docField, oldValue: "", newValue: "Document uploaded" }],
            timestamp: serverTimestamp(),
            updatedBy: user.uid,
            section: "tax",
            action: "document_uploaded",
          });
        } catch (histErr) {
          console.warn("Failed to save document upload history:", histErr);
        }
      }
      
      // Update preview
      setDocumentPreviews((prev) => ({ ...prev, [docType]: downloadURL }));
      
      const docName = docType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
      toast.success(`${docName} uploaded successfully!`);
    } catch (err) {
      console.error("Document upload failed", err);
      toast.error(`Failed to upload ${docType}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  // Calculate verification status
  const verificationStatus = useMemo(() => {
    const status = {
      gst: { verified: false, hasDocument: false },
      pan: { verified: false, hasDocument: false },
      business: { verified: false, hasDocument: false },
      bank: { verified: false, hasDocument: false },
    };
    
    // Check if documents exist
    if (formData.gstCertificateUrl) status.gst.hasDocument = true;
    if (formData.panCardUrl) status.pan.hasDocument = true;
    if (formData.businessLicenseUrl) status.business.hasDocument = true;
    
    // Check if data exists (simplified verification - in production, this would check against verification service)
    if (formData.gstNumber && formData.gstNumber.length === 15) status.gst.verified = true;
    if (formData.panNumber && formData.panNumber.length === 10) status.pan.verified = true;
    if (formData.businessName && formData.address) status.business.verified = true;
    if (formData.bankAccountNumber && formData.bankIfsc) status.bank.verified = true;
    
    return status;
  }, [formData]);

  if (loading) {
  return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-white">{t("profile.loadingProfile") || "Loading profile..."}</p>
        </div>
      </div>
    );
  }

  // Form Field Component
  const FormField = ({ label, name, type = "text", value, onChange, placeholder, icon: Icon, required = false, disabled = false, rows }) => {
    const isValid = required ? value && value.trim() !== "" : true;
    const InputComponent = rows ? "textarea" : "input";
    
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
          {Icon && <Icon className="w-4 h-4 text-indigo-400" />}
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
        <InputComponent
          name={name}
          type={type}
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`w-full bg-slate-800/80 border ${
            isValid ? "border-white/10" : "border-red-500/50"
          } text-white placeholder-gray-500 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        />
        {required && !isValid && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <FaExclamationCircle className="w-3 h-3" />
            This field is required
          </p>
        )}
              </div>
    );
  };

  // Stat Card Component
  const StatCard = ({ icon: Icon, label, value, color = "indigo" }) => {
    const getColorClasses = (c) => {
      switch (c) {
        case "green":
          return {
            gradient: "from-green-500/20 to-green-600/10",
            border: "border-green-500/30",
            bg: "bg-green-500/20",
            text: "text-green-400",
          };
        case "yellow":
          return {
            gradient: "from-yellow-500/20 to-yellow-600/10",
            border: "border-yellow-500/30",
            bg: "bg-yellow-500/20",
            text: "text-yellow-400",
          };
        case "gray":
          return {
            gradient: "from-gray-500/20 to-gray-600/10",
            border: "border-gray-500/30",
            bg: "bg-gray-500/20",
            text: "text-gray-400",
          };
        default:
          return {
            gradient: "from-indigo-500/20 to-indigo-600/10",
            border: "border-indigo-500/30",
            bg: "bg-indigo-500/20",
            text: "text-indigo-400",
          };
      }
    };
    const colors = getColorClasses(color);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-br ${colors.gradient} border ${colors.border} rounded-xl p-4 backdrop-blur-sm`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold text-white mt-1">{value}</p>
              </div>
          <div className={`p-3 rounded-lg ${colors.bg}`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            {t("profile.title") || "Profile Settings"}
          </h1>
          <p className="text-gray-400 mt-1">Manage your business profile and preferences</p>
              </div>
        <div className="flex items-center gap-3">
          {/* Profile Completion Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 rounded-xl px-4 py-3 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <FaChartLine className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{profileCompletion}%</span>
                  <span className="text-xs text-gray-400">Complete</span>
                </div>
                <div className="w-24 bg-slate-800/50 rounded-full h-1.5 mt-1 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profileCompletion}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
          <div className="px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-lg">
            <span className="text-sm text-indigo-300 font-medium">🏢 Distributor</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="space-y-2 sticky top-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-${item.color.split('-')[1]}-500/50`
                      : "bg-slate-800/60 border border-white/10 text-gray-300 hover:bg-slate-700/60"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-400"}`} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-2 h-2 bg-white rounded-full"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
              initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
              {/* Owner Information Section */}
            {activeSection === "owner" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <FaUser className="w-6 h-6 text-purple-400" />
                      </div>
                      {t("profile.ownerInformation") || "Owner Information"}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      label={t("profile.ownerName") || "Owner Name"}
                      name="ownerName"
                      value={formData.ownerName}
                      onChange={handleChange}
                      placeholder={t("profile.enterOwnerName") || "Enter owner name"}
                      icon={FaUser}
                      required
                    />
                    <FormField
                      label={t("profile.emailAddress") || "Email Address"}
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t("profile.enterEmail") || "Enter email address"}
                      icon={FaEnvelope}
                      required
                    />
                    <FormField
                      label={t("profile.phoneNumber") || "Phone Number"}
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder={t("profile.enterPhoneNumber") || "Enter phone number"}
                      icon={FaPhone}
                      required
                    />
                  </div>

                  {/* FLYP ID Card */}
                  <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                          <FaIdCard className="w-5 h-5 text-indigo-400" />
                </div>
                        <div>
                          <h3 className="font-semibold text-white flex items-center gap-2">
                    FLYP ID
                            <FaInfoCircle className="w-4 h-4 text-indigo-400" title="Your unique business identifier" />
                          </h3>
                          <p className="text-xs text-gray-400">Your unique business identifier</p>
                        </div>
                      </div>
                    </div>
                  {formData.flypId ? (
                      <div className="flex items-center gap-3">
                      <input
                        disabled
                        value={formData.flypId}
                          className="flex-1 bg-slate-800/60 border border-white/10 text-gray-300 cursor-not-allowed px-4 py-3 rounded-lg font-mono"
                      />
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                          <FaCheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-green-300 font-medium">Linked</span>
                        </div>
                    </div>
                  ) : (
                    <button
                      onClick={generateFlypId}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                    >
                        <FaIdCard className="w-4 h-4" />
                        Generate My FLYP ID
                    </button>
                  )}
                </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                    </motion.button>
                </div>
              </div>
            )}

              {/* Business Details Section */}
            {activeSection === "business" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <FaBuilding className="w-6 h-6 text-indigo-400" />
                      </div>
                      {t("profile.businessDetails") || "Business Details"}
                    </h2>
                    {verificationStatus.business.verified && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <FaCheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-300 font-medium">Business Verified</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      label={t("profile.businessName") || "Business Name"}
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      placeholder={t("profile.businessName") || "Enter business name"}
                      icon={FaBuilding}
                      required
                    />
                    <FormField
                      label={t("profile.distributorName") || "Distributor Name"}
                      name="distributorName"
                      value={formData.distributorName}
                      onChange={handleChange}
                      placeholder={t("profile.distributorName") || "Enter distributor name"}
                      icon={FaBuilding}
                    />
                    <div className="md:col-span-2">
                      <FormField
                        label={t("retailers.address") || "Address"}
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                        placeholder={t("retailers.address") || "Enter business address"}
                        icon={FaMapMarkerAlt}
                      rows={3}
                        required
                    />
                  </div>
                    <FormField
                      label={t("retailers.city") || "City"}
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                      placeholder={t("retailers.city") || "Enter city"}
                      icon={FaCity}
                      required
                    />
                    <FormField
                      label={t("retailers.state") || "State"}
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                      placeholder={t("retailers.state") || "Enter state"}
                      icon={FaGlobe}
                      required
                    />
                    <FormField
                      label={t("retailers.pincode") || "Pincode"}
                        name="pincode"
                        value={formData.pincode}
                        onChange={handleChange}
                      placeholder={t("retailers.pincode") || "Enter pincode"}
                      icon={FaMapMarkerAlt}
                      required
                    />
                    <FormField
                      label={t("profile.gstNumber") || "GST Number"}
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      placeholder={t("profile.gstNumber") || "Enter GST number"}
                      icon={FaShieldAlt}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FaBuilding className="w-4 h-4 text-indigo-400" />
                        {t("profile.businessType") || "Business Type"}
                      </label>
                    <input
                      name="businessType"
                      value={formData.businessType}
                      disabled
                        className="w-full bg-slate-700/50 border border-white/10 text-gray-400 cursor-not-allowed px-4 py-3 rounded-lg"
                    />
                  </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FaEdit className="w-4 h-4 text-indigo-400" />
                        {t("profile.invoicePreference") || "Invoice Preference"}
                      </label>
                    <select
                      name="invoicePreference"
                      value={formData.invoicePreference}
                      onChange={handleChange}
                        className="w-full bg-slate-800/80 border border-white/10 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Minimal">{t("profile.invoiceMinimal") || "Minimal"}</option>
                      <option value="Detailed">{t("profile.invoiceDetailed") || "Detailed"}</option>
                      <option value="Modern">{t("profile.invoiceModern") || "Modern"}</option>
                    </select>
                  </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-300 mb-1">{t("profile.businessMode") || "Business Mode"}</p>
                          <p className="text-xs text-gray-400">Set your business availability</p>
                        </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.businessMode === "Online"}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            businessMode: e.target.checked ? "Online" : "Offline",
                          }))
                        }
                      />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:bg-green-500 transition-all"></div>
                          <span className="ml-3 text-sm font-medium text-white">{formData.businessMode}</span>
                    </label>
                  </div>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-300 mb-1">{t("profile.whatsappAlerts") || "WhatsApp Alerts"}</p>
                          <p className="text-xs text-gray-400">Enable notification alerts</p>
                        </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.whatsappAlerts}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, whatsappAlerts: e.target.checked }))
                        }
                      />
                          <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:bg-blue-500 transition-all"></div>
                          <span className="ml-3 text-sm font-medium text-white">
                            {formData.whatsappAlerts ? t("common.yes") || "Yes" : t("common.no") || "No"}
                      </span>
                    </label>
                  </div>
                </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                    </motion.button>
                </div>
              </div>
            )}

              {/* Branding Section */}
              {activeSection === "branding" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                    <div className="p-2 bg-pink-500/20 rounded-lg">
                      <FaPalette className="w-6 h-6 text-pink-400" />
                    </div>
                    {t("profile.branding") || "Branding"}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FaUpload className="w-4 h-4 text-pink-400" />
                        {t("profile.logo") || "Business Logo"}
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="w-full bg-slate-800/80 border border-white/10 text-white placeholder-gray-500 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-pink-500/20 file:text-pink-300 hover:file:bg-pink-500/30 cursor-pointer"
                        />
                      </div>
                      {logoPreview && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-4"
                        >
                          <div className="relative inline-block">
                            <img
                              src={logoPreview}
                              alt="Logo Preview"
                              className="w-32 h-32 rounded-2xl ring-4 ring-pink-500/30 shadow-xl object-cover"
                            />
                            <div className="absolute -top-2 -right-2 p-2 bg-green-500 rounded-full">
                              <FaCheck className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">{t("profile.logoPreview") || "Logo preview"}</p>
                        </motion.div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                        <h3 className="text-sm font-medium text-gray-300 mb-3">Profile Metadata</h3>
                        <div className="space-y-2 text-sm">
                          {formData.lastUpdated && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 flex items-center gap-2">
                                <FaClock className="w-3 h-3" />
                                Last Updated
                              </span>
                              <span className="text-white">
                                {new Date(formData.lastUpdated).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {formData.profileVersion > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 flex items-center gap-2">
                                <FaAward className="w-3 h-3" />
                                Profile Version
                              </span>
                              <span className="text-white">v{formData.profileVersion}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <motion.button
                      onClick={handleSave}
                      disabled={isSaving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        isSaving ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaSave className="w-4 h-4" />
                      {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* WhatsApp Section - First-Time User Onboarding */}
            {activeSection === "whatsapp" && (
              <WhatsAppOnboardingSection 
                formData={formData}
                setFormData={setFormData}
                user={user}
              />
            )}

              {/* Preferences Section */}
            {activeSection === "tax" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <FaFileInvoiceDollar className="w-6 h-6 text-orange-400" />
                    </div>
                    Tax Information
                  </h2>
                  {/* Verification Status Badges */}
                  <div className="flex items-center gap-2">
                    {verificationStatus.gst.verified && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <FaCheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-300 font-medium">GST Verified</span>
                      </div>
                    )}
                    {verificationStatus.pan.verified && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                        <FaCheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-300 font-medium">PAN Verified</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <FormField
                      label="GST Number"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      placeholder="Enter GST number (e.g., 27ABCDE1234F1Z5)"
                      icon={FaShieldAlt}
                    />
                    {formData.gstNumber && formData.gstNumber.length === 15 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                        <FaCheckCircle className="w-3 h-3" />
                        <span>Valid GST format</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <FormField
                      label="PAN Number"
                      name="panNumber"
                      value={formData.panNumber}
                      onChange={handleChange}
                      placeholder="Enter PAN number (e.g., ABCDE1234F)"
                      icon={FaIdCard}
                    />
                    {formData.panNumber && formData.panNumber.length === 10 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                        <FaCheckCircle className="w-3 h-3" />
                        <span>Valid PAN format</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Upload Section */}
                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaCertificate className="w-5 h-5 text-orange-400" />
                    Business Documents
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GST Certificate */}
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        GST Certificate
                        {documentPreviews.gstCertificate && (
                          <span className="ml-2 text-green-400 text-xs">✓ Uploaded</span>
                        )}
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleDocumentUpload("gstCertificate", file);
                          }
                        }}
                        disabled={uploadingDoc === "gstCertificate"}
                        className="w-full bg-slate-700/50 border border-white/10 text-white text-sm px-3 py-2 rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-500/20 file:text-orange-300 hover:file:bg-orange-500/30 cursor-pointer disabled:opacity-50"
                      />
                      {documentPreviews.gstCertificate && (
                        <a
                          href={documentPreviews.gstCertificate}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <FaFilePdf className="w-3 h-3" />
                          View Document
                        </a>
                      )}
                    </div>

                    {/* PAN Card */}
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        PAN Card
                        {documentPreviews.panCard && (
                          <span className="ml-2 text-green-400 text-xs">✓ Uploaded</span>
                        )}
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleDocumentUpload("panCard", file);
                          }
                        }}
                        disabled={uploadingDoc === "panCard"}
                        className="w-full bg-slate-700/50 border border-white/10 text-white text-sm px-3 py-2 rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-500/20 file:text-orange-300 hover:file:bg-orange-500/30 cursor-pointer disabled:opacity-50"
                      />
                      {documentPreviews.panCard && (
                        <a
                          href={documentPreviews.panCard}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <FaFilePdf className="w-3 h-3" />
                          View Document
                        </a>
                      )}
                    </div>

                    {/* Business License */}
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Business License
                        {documentPreviews.businessLicense && (
                          <span className="ml-2 text-green-400 text-xs">✓ Uploaded</span>
                        )}
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleDocumentUpload("businessLicense", file);
                          }
                        }}
                        disabled={uploadingDoc === "businessLicense"}
                        className="w-full bg-slate-700/50 border border-white/10 text-white text-sm px-3 py-2 rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-500/20 file:text-orange-300 hover:file:bg-orange-500/30 cursor-pointer disabled:opacity-50"
                      />
                      {documentPreviews.businessLicense && (
                        <a
                          href={documentPreviews.businessLicense}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <FaFilePdf className="w-3 h-3" />
                          View Document
                        </a>
                      )}
                    </div>

                    {/* Trade License */}
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Trade License
                        {documentPreviews.tradeLicense && (
                          <span className="ml-2 text-green-400 text-xs">✓ Uploaded</span>
                        )}
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleDocumentUpload("tradeLicense", file);
                          }
                        }}
                        disabled={uploadingDoc === "tradeLicense"}
                        className="w-full bg-slate-700/50 border border-white/10 text-white text-sm px-3 py-2 rounded-lg file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-500/20 file:text-orange-300 hover:file:bg-orange-500/30 cursor-pointer disabled:opacity-50"
                      />
                      {documentPreviews.tradeLicense && (
                        <a
                          href={documentPreviews.tradeLicense}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <FaFilePdf className="w-3 h-3" />
                          View Document
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-300 font-medium mb-1">Tax Information</p>
                      <p className="text-xs text-gray-400">Your GST and PAN numbers are used for invoicing and compliance. Upload certificates for verification.</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <FaSave className="w-4 h-4" />
                    {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                  </motion.button>
                </div>
              </div>
            )}

            {activeSection === "banking" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <FaUniversity className="w-6 h-6 text-blue-400" />
                    </div>
                    Banking & Payment
                  </h2>
                  {verificationStatus.bank.verified && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <FaCheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-300 font-medium">Bank Verified</span>
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FaUniversity className="w-5 h-5 text-blue-400" />
                      Bank Account Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        label="Bank Name"
                        name="bankName"
                        value={formData.bankName}
                        onChange={handleChange}
                        placeholder="Enter bank name"
                        icon={FaUniversity}
                      />
                      <FormField
                        label="Branch"
                        name="bankBranch"
                        value={formData.bankBranch}
                        onChange={handleChange}
                        placeholder="Enter branch name"
                        icon={FaMapMarkerAlt}
                      />
                      <FormField
                        label="Account Number"
                        name="bankAccountNumber"
                        type="text"
                        value={formData.bankAccountNumber}
                        onChange={handleChange}
                        placeholder="Enter account number"
                        icon={FaCreditCard}
                      />
                      <FormField
                        label="IFSC Code"
                        name="bankIfsc"
                        value={formData.bankIfsc}
                        onChange={handleChange}
                        placeholder="Enter IFSC code"
                        icon={FaIdCard}
                      />
                      <div className="md:col-span-2">
                        <FormField
                          label="Account Holder Name"
                          name="bankAccountName"
                          value={formData.bankAccountName}
                          onChange={handleChange}
                          placeholder="Enter account holder name"
                          icon={FaUser}
                        />
                    </div>
                  </div>
                  </div>
                  <div className="border-t border-white/10 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <FaCreditCard className="w-5 h-5 text-green-400" />
                      UPI Payment
                    </h3>
                    <FormField
                      label="UPI ID"
                      name="upiId"
                      value={formData.upiId}
                      onChange={handleChange}
                      placeholder="Enter UPI ID (e.g., username@paytm)"
                      icon={FaCreditCard}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <FaSave className="w-4 h-4" />
                    {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                  </motion.button>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <FaBell className="w-6 h-6 text-yellow-400" />
                  </div>
                  Notification Preferences
                </h2>
                <div className="space-y-4">
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-300 mb-1 flex items-center gap-2">
                          <FaEnvelope className="w-4 h-4 text-blue-400" />
                          Email Notifications
                        </p>
                        <p className="text-xs text-gray-400">Receive order updates and alerts via email</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.emailNotifications}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, emailNotifications: e.target.checked }))
                          }
                        />
                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-500 transition-all"></div>
                        <span className="ml-3 text-sm font-medium text-white">
                          {formData.emailNotifications ? "Enabled" : "Disabled"}
                  </span>
                      </label>
                    </div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                  <div>
                        <p className="font-medium text-gray-300 mb-1 flex items-center gap-2">
                          <FaPhone className="w-4 h-4 text-green-400" />
                          SMS Notifications
                        </p>
                        <p className="text-xs text-gray-400">Receive important alerts via SMS</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                    <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.smsNotifications}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, smsNotifications: e.target.checked }))
                          }
                        />
                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:bg-green-500 transition-all"></div>
                        <span className="ml-3 text-sm font-medium text-white">
                          {formData.smsNotifications ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-300 mb-1 flex items-center gap-2">
                          <FaWhatsapp className="w-4 h-4 text-green-400" />
                          WhatsApp Alerts
                        </p>
                        <p className="text-xs text-gray-400">Receive order and payment notifications on WhatsApp</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.whatsappAlerts}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, whatsappAlerts: e.target.checked }))
                          }
                        />
                        <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:bg-green-500 transition-all"></div>
                        <span className="ml-3 text-sm font-medium text-white">
                          {formData.whatsappAlerts ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <FaSave className="w-4 h-4" />
                    {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                  </motion.button>
                </div>
                      </div>
                    )}

            {activeSection === "credit" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                  <div className="p-2 bg-teal-500/20 rounded-lg">
                    <FaCreditCard className="w-6 h-6 text-teal-400" />
                  </div>
                  Credit & Payment Terms
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    label="Default Credit Days"
                    name="defaultCreditDays"
                    type="number"
                    value={formData.defaultCreditDays}
                    onChange={handleChange}
                    placeholder="30"
                    icon={FaClock}
                  />
                  <FormField
                    label="Payment Terms"
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    placeholder="Net 30"
                    icon={FaFileInvoiceDollar}
                  />
                </div>
                <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-300 mb-1">Auto-send Invoices</p>
                      <p className="text-xs text-gray-400">Automatically send invoices to retailers after delivery</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.autoSendInvoice}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, autoSendInvoice: e.target.checked }))
                        }
                      />
                      <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500 rounded-full peer peer-checked:bg-teal-500 transition-all"></div>
                      <span className="ml-3 text-sm font-medium text-white">
                        {formData.autoSendInvoice ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <FaSave className="w-4 h-4" />
                    {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                  </motion.button>
                </div>
              </div>
            )}

            {activeSection === "hours" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                  <div className="p-2 bg-violet-500/20 rounded-lg">
                    <FaCalendarAlt className="w-6 h-6 text-violet-400" />
                  </div>
                  Business Hours
                </h2>
                <div className="space-y-4">
                  {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                    <div key={day} className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={!formData.businessHours[day]?.closed}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  businessHours: {
                                    ...prev.businessHours,
                                    [day]: { ...prev.businessHours[day], closed: !e.target.checked },
                                  },
                                }))
                              }
                            />
                            <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-500 rounded-full peer peer-checked:bg-violet-500 transition-all"></div>
                          </label>
                          <span className="font-medium text-white capitalize">{day}</span>
                        </div>
                        {!formData.businessHours[day]?.closed && (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={formData.businessHours[day]?.open || "09:00"}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  businessHours: {
                                    ...prev.businessHours,
                                    [day]: { ...prev.businessHours[day], open: e.target.value },
                                  },
                                }))
                              }
                              className="bg-slate-700/50 border border-white/10 text-white px-3 py-2 rounded-lg"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                              type="time"
                              value={formData.businessHours[day]?.close || "18:00"}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  businessHours: {
                                    ...prev.businessHours,
                                    [day]: { ...prev.businessHours[day], close: e.target.value },
                                  },
                                }))
                              }
                              className="bg-slate-700/50 border border-white/10 text-white px-3 py-2 rounded-lg"
                            />
                          </div>
                        )}
                        {formData.businessHours[day]?.closed && (
                          <span className="text-sm text-gray-400">Closed</span>
                    )}
                  </div>
                </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4 border-t border-white/10">
                  <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <FaSave className="w-4 h-4" />
                    {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                  </motion.button>
                </div>
              </div>
            )}

            {activeSection === "security" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <FaLock className="w-6 h-6 text-red-400" />
                  </div>
                  Security Settings
                </h2>

                {/* Password Change */}
                <div className="bg-slate-800/60 rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaKey className="w-5 h-5 text-red-400" />
                    Change Password
                  </h3>
                  <div className="space-y-4">
                  <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FaLock className="w-4 h-4 text-red-400" />
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.current ? "text" : "password"}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                          className="w-full bg-slate-700/50 border border-white/10 text-white px-4 py-3 rounded-lg pr-10"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showPassword.current ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FaKey className="w-4 h-4 text-red-400" />
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.new ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full bg-slate-700/50 border border-white/10 text-white px-4 py-3 rounded-lg pr-10"
                          placeholder="Enter new password (min 6 characters)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showPassword.new ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <FaKey className="w-4 h-4 text-red-400" />
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.confirm ? "text" : "password"}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full bg-slate-700/50 border border-white/10 text-white px-4 py-3 rounded-lg pr-10"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showPassword.confirm ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <motion.button
                      onClick={handlePasswordChange}
                      disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                        changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      <FaKey className="w-4 h-4" />
                      {changingPassword ? "Changing Password..." : "Change Password"}
                    </motion.button>
                  </div>
                </div>

                {/* Two-Factor Authentication */}
                <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-300 mb-1">Two-Factor Authentication</p>
                      <p className="text-xs text-gray-400">Add an extra layer of security to your account</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.twoFactorEnabled}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, twoFactorEnabled: e.target.checked }))
                        }
                      />
                      <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500 rounded-full peer peer-checked:bg-red-500 transition-all"></div>
                      <span className="ml-3 text-sm font-medium text-white">
                        {formData.twoFactorEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>
                  {formData.twoFactorEnabled && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs text-blue-300">
                        <FaInfoCircle className="inline w-3 h-3 mr-1" />
                        2FA setup instructions will be sent to your email when enabled.
                      </p>
                    </div>
                  )}
                </div>

                {/* Session Timeout */}
                <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                      <FaClock className="w-4 h-4 text-red-400" />
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      name="sessionTimeout"
                      value={formData.sessionTimeout}
                      onChange={handleChange}
                      min="5"
                      max="120"
                      className="w-full bg-slate-700/50 border border-white/10 text-white px-4 py-2 rounded-lg"
                    />
                    <p className="text-xs text-gray-400">Automatically log out after inactivity</p>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaDesktop className="w-5 h-5 text-red-400" />
                    Active Sessions
                  </h3>
                  <div className="space-y-3">
                    {activeSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {session.device === "Mobile" ? (
                            <FaMobile className="w-5 h-5 text-gray-400" />
                          ) : (
                            <FaDesktop className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{session.device}</p>
                            <p className="text-xs text-gray-400">{session.location}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(session.lastActive).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {session.current ? (
                          <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-300">
                            Current
                          </span>
                        ) : (
                          <button className="text-red-400 hover:text-red-300">
                            <FaTrash className="w-4 h-4" />
                          </button>
                    )}
                  </div>
                    ))}
                </div>
                </div>

                {/* Profile Change History */}
                <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaHistory className="w-5 h-5 text-red-400" />
                    Profile Change History
                  </h3>
                  {loadingHistory ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                      <p className="text-sm text-gray-400 mt-2">Loading history...</p>
                    </div>
                  ) : profileHistory.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No changes recorded yet</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {profileHistory.map((entry) => (
                        <div key={entry.id} className="p-3 bg-slate-700/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400">
                              {entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleString() : new Date(entry.timestamp).toLocaleString()}
                            </span>
                            <span className="text-xs text-blue-400 capitalize">{entry.section || "general"}</span>
                          </div>
                          <div className="space-y-1">
                            {entry.changes?.slice(0, 3).map((change, idx) => (
                              <div key={idx} className="text-xs text-gray-300">
                                <span className="font-medium">{change.field}:</span>{" "}
                                <span className="text-red-400 line-through">{change.oldValue || "empty"}</span> →{" "}
                                <span className="text-green-400">{change.newValue || "empty"}</span>
                              </div>
                            ))}
                            {entry.changes?.length > 3 && (
                              <p className="text-xs text-gray-500">+{entry.changes.length - 3} more changes</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <motion.button
                    onClick={handleSave}
                    disabled={isSaving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      isSaving ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <FaSave className="w-4 h-4" />
                    {isSaving ? t("common.loading") || "Saving..." : t("profile.saveChanges") || "Save Changes"}
                  </motion.button>
                </div>
              </div>
            )}

            {activeSection === "integrations" && (
              <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <FaPlug className="w-6 h-6 text-indigo-400" />
                  </div>
                  Integrations & API
                </h2>
                <div className="space-y-4">
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                    <h3 className="font-medium text-white mb-2">API Configuration</h3>
                    <p className="text-sm text-gray-400 mb-4">Manage your API keys and webhook settings</p>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FaInfoCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-blue-300 font-medium mb-1">API Access</p>
                          <p className="text-xs text-gray-400">API integrations are managed through your developer dashboard. Contact support for API access.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/60 rounded-xl p-4 border border-white/10">
                    <h3 className="font-medium text-white mb-2">Webhook URLs</h3>
                    <p className="text-sm text-gray-400 mb-4">Configure webhooks for real-time event notifications</p>
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <FaInfoCircle className="w-5 h-5 text-indigo-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-indigo-300 font-medium mb-1">Webhook Setup</p>
                          <p className="text-xs text-gray-400">Webhook configuration is available for enterprise plans. Contact your account manager.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "preferences" && (
                <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gray-500/20 rounded-lg">
                      <FaCog className="w-6 h-6 text-gray-400" />
                    </div>
                    {t("profile.preferences") || "Preferences"}
                  </h2>
                  <div className="bg-slate-800/60 rounded-xl p-6 border border-white/10">
                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-white">
                      <FaGlobe className="w-5 h-5 text-indigo-400" />
                      {t("language.changeLanguage") || "Change Language"}
                    </h4>
                    <p className="text-sm text-gray-400 mb-4">
                      {t("language.currentLanguage") || "Select your preferred language"}
                    </p>
                    <div className="flex justify-center items-center">
                      <LanguageSwitcher />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
};

export default DistributorProfileSettings;
