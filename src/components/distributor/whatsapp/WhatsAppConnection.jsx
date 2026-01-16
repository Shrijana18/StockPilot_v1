/**
 * WhatsApp Connection Component
 * Handles embedded signup flow with Facebook SDK integration
 * 
 * Uses the proper FB.login() method as per Meta documentation:
 * https://developers.facebook.com/docs/whatsapp/embedded-signup
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, functions, auth } from "../../../firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { toast } from "react-toastify";
import { 
  FaWhatsapp, FaFacebook, FaArrowRight, FaSpinner, 
  FaExclamationTriangle, FaCheckCircle, FaInfoCircle,
  FaShieldVirus, FaRocket, FaUsers, FaBullhorn, FaChartBar, FaLock,
  FaFlask, FaMobileAlt, FaSync
} from "react-icons/fa";
import WhatsAppStatus from "./WhatsAppStatus";
import { 
  META_APP_ID,
  META_CONFIG_ID,
  FB_LOGIN_CONFIG, 
  FB_LOGIN_SCOPES,
  EMBEDDED_SIGNUP_URL,
  WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI,
  initFacebookSDK,
  isFBSDKReady,
  EMBEDDED_SIGNUP_EVENTS
} from "../../../config/whatsappConfig";

// Test Account Configuration - Values from Meta Developer Dashboard
const TEST_WABA_CONFIG = {
  wabaId: "849529957927153",
  phoneNumberId: "954998794358933",
  phoneNumber: "+1 555 191 5256",
  displayName: "Test Number",
  testRecipient: "+918329690931",
  tempAccessToken: "EAAbCX6enA4cBQWvjDMZCNC0YK9GB4ZAiEZA0SqHEYVWMBX3z4Ui1cjzZAQsWbdpZAEf3e7YUv2WP1sRDPlCcFGRlUzhJfUU83ohwDE2ABzyqQ4UmMF8ZAmfbvGTZCwDFr6DUVikI6BKhpiSkv4rr3NLAoZCMMBlnWLZBVpzzqdjGNzix6iDyrrEojyZBUSnSao7cRVndTQ2lBuhNUPjZBr6DqUbARZAnKM5oBXnCqHfggpPgRxrjKCFkfUtgCdlZAz5bJgLzwM3ST9evmhUZAPZAJgse7Cuj0iHws4M7ZBiue5zE5gZDZD",
};

const WhatsAppConnection = ({ user, formData, setFormData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  
  // 2FA PIN States
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pendingWabaData, setPendingWabaData] = useState(null);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [pinError, setPinError] = useState(null); // For showing "incorrect PIN" message
  
  // Manual entry states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualWabaId, setManualWabaId] = useState("");
  const [manualPhoneNumberId, setManualPhoneNumberId] = useState("");
  const [manualPhoneNumber, setManualPhoneNumber] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  
  // Test mode states
  const [showTestModal, setShowTestModal] = useState(false);
  const [settingUpTest, setSettingUpTest] = useState(false);

  const sessionIdRef = useRef(null);

  const isConnected = formData.whatsappEnabled && formData.whatsappBusinessAccountId;

  // Initialize Facebook SDK on mount
  useEffect(() => {
    const initSDK = async () => {
      try {
        await initFacebookSDK();
        setSdkReady(true);
        console.log("✅ Facebook SDK initialized");
      } catch (err) {
        console.warn("Facebook SDK initialization failed:", err);
        // SDK may still work if loaded via index.html
        if (isFBSDKReady()) {
          setSdkReady(true);
        }
      }
    };
    initSDK();
  }, []);

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
            whatsappTestMode: userData.whatsappTestMode || false,
            whatsappCreatedVia: userData.whatsappCreatedVia || '',
          }));
          
          // Skip Meta API call for test mode
          if (!userData.whatsappTestMode && userData.whatsappCreatedVia !== 'test_mode_setup') {
            setTimeout(() => fetchWABAStatus(), 1000);
          }
          
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
    
    // Skip for test mode
    if (formData.whatsappTestMode || formData.whatsappCreatedVia === 'test_mode_setup') {
      setStatusData({
        waba: { id: formData.whatsappBusinessAccountId, isEnabled: true },
        accountReview: { status: 'APPROVED', isApproved: true },
        phone: { 
          phoneNumberId: formData.whatsappPhoneNumberId,
          phoneNumber: formData.whatsappPhoneNumber,
          verified: true,
          registered: true,
        },
        overall: { ready: true, needsAction: false, pendingActions: [] }
      });
      return;
    }

    setCheckingStatus(true);
    try {
      const getWABAStatus = httpsCallable(functions, 'getWABAStatus');
      const result = await getWABAStatus();
      
      if (result.data?.success && result.data.status) {
        const status = result.data.status;
        setStatusData(status);
        
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

  /**
   * Handle Embedded Signup Message from Facebook SDK
   * This callback is registered with FB.login() and handles the response
   */
  const handleEmbeddedSignupMessage = useCallback((event) => {
    // Only process messages from Facebook domains
    const trustedOrigins = [
      "https://business.facebook.com",
      "https://www.facebook.com", 
      "https://facebook.com",
    ];
    
    if (!trustedOrigins.some(origin => event.origin.startsWith(origin))) {
      return;
    }

    const data = event.data;
    
    // Handle WA_EMBEDDED_SIGNUP events from Meta SDK
    if (data?.type === "WA_EMBEDDED_SIGNUP") {
      console.log("📨 Meta SDK Event:", data.event, data);
      
      if (data.event === EMBEDDED_SIGNUP_EVENTS.FINISH) {
        // FINISH event contains WABA data
        const wabaId = data.data?.waba_id;
        const phoneNumberId = data.data?.phone_number_id;
        
        if (wabaId) {
          console.log("✅ Signup finished with WABA:", wabaId);
          processSignupResult({
            wabaId,
            phoneNumberId,
            source: "sdk_finish_event"
          });
        } else {
          // FINISH without WABA ID - need to detect
          console.log("⚠️ FINISH event without WABA ID, running detection...");
          handleCheckForAccount();
        }
      } else if (data.event === EMBEDDED_SIGNUP_EVENTS.CANCEL) {
        console.log("❌ Signup cancelled by user");
        setLoading(false);
        toast.info("WhatsApp setup cancelled");
      } else if (data.event === EMBEDDED_SIGNUP_EVENTS.ERROR) {
        console.error("❌ Signup error:", data.data);
        setLoading(false);
        setError(data.data?.error_message || "Signup failed");
        toast.error("WhatsApp signup failed. Please try again.");
      }
    }
  }, []);

  // Listen for postMessage events from Meta SDK
  useEffect(() => {
    window.addEventListener("message", handleEmbeddedSignupMessage);
    return () => window.removeEventListener("message", handleEmbeddedSignupMessage);
  }, [handleEmbeddedSignupMessage]);

  /**
   * Process signup result from SDK or code exchange
   */
  const processSignupResult = async (data) => {
    const { wabaId, phoneNumberId, code, source } = data;
    
    setLoading(true);
    
    try {
      const exchangeCodeForWABA = httpsCallable(functions, "exchangeCodeForWABA");
      
      const result = await exchangeCodeForWABA({
        code: code || null,
        wabaId: wabaId || null,
        phoneNumberId: phoneNumberId || null,
      });

      if (result.data?.requirePin) {
        console.log("🔐 PIN required for phone registration");
        setPendingWabaData({
          wabaId: result.data.wabaId,
          phoneNumberId: result.data.phoneNumberId,
          phoneNumber: result.data.phoneNumber,
        });
        setPinError(result.data.pinIncorrect ? "Incorrect PIN. Please try again." : null);
        setShowPinModal(true);
        setLoading(false);
        
        if (result.data.pinIncorrect) {
          toast.error("Incorrect PIN. Please enter your correct WhatsApp PIN.");
        } else {
          toast.info("Please enter a 6-digit PIN to register your phone number.");
        }
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
          whatsappCreatedVia: 'embedded_signup_sdk',
          whatsappPhoneRegistered: result.data.registrationSuccess || false,
          whatsappVerified: false,
          whatsappAccountReviewStatus: 'PENDING',
        }));

        toast.success('WhatsApp Business Account connected successfully!');
        setTimeout(() => fetchWABAStatus(), 2000);
      } else if (!result.data?.detected) {
        // No WABA found yet - user might not have completed setup
        toast.info("Setup incomplete. Please complete the signup in the popup window, then click 'Check for My Account'.");
      }
    } catch (err) {
      console.error("Error processing signup:", err);
      toast.error("Failed to complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Main connect handler - Uses Facebook SDK's FB.login()
   * This is the proper way to implement Embedded Signup per Meta docs
   */
  const handleConnect = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create session in Firestore for tracking
      const sessionId = `embedded_${user.uid}_${Date.now()}`;
      sessionIdRef.current = sessionId;
      
      await setDoc(doc(db, 'whatsappOAuthSessions', sessionId), {
        uid: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        type: 'embedded_signup_sdk',
      });

      // Check if Facebook SDK is available
      // NOTE: FB.login() requires HTTPS - skip SDK on localhost and use popup fallback
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!isLocalhost && typeof window.FB !== "undefined" && window.FB.login) {
        console.log("🔗 Starting Facebook SDK login...");
        
        // Use FB.login with the proper Embedded Signup configuration
        window.FB.login(
          (response) => {
            console.log("📥 FB.login response:", response);
            
            if (response.status === "connected") {
              // Successfully connected
              const authResponse = response.authResponse;
              
              if (authResponse?.code) {
                // Got auth code - exchange it for WABA details
                console.log("✅ Got auth code, exchanging for WABA...");
                processSignupResult({ 
                  code: authResponse.code,
                  source: "fb_login_code" 
                });
              } else if (authResponse?.accessToken) {
                // Got access token directly (rare)
                console.log("⚠️ Got access token instead of code, detecting WABA...");
                handleCheckForAccount();
              } else {
                console.log("⚠️ Connected but no code/token, running detection...");
                handleCheckForAccount();
              }
            } else if (response.status === "not_authorized") {
              // User didn't authorize the app
              console.log("❌ User did not authorize the app");
              setLoading(false);
              toast.warning("Please authorize FLYP to connect your WhatsApp Business Account.");
            } else {
              // User closed popup or other issue
              console.log("❌ FB.login failed:", response.status);
              setLoading(false);
              
              // Try fallback detection after a delay
              setTimeout(() => {
                toast.info("Checking if setup was completed...");
                handleCheckForAccount();
              }, 2000);
            }
          },
          {
            // Embedded Signup Configuration
            config_id: META_CONFIG_ID,
            response_type: "code",
            override_default_response_type: true,
            scope: FB_LOGIN_SCOPES,
            extras: {
              setup: {},
              featureType: "",
              sessionInfoVersion: "3",
            },
          }
        );
      } else {
        // Fallback: Open popup with URL
        // Used when FB SDK is not available OR on localhost (HTTPS required for FB.login)
        console.log(isLocalhost 
          ? "⚠️ Localhost detected - using popup fallback (FB.login requires HTTPS)"
          : "⚠️ FB SDK not available, using popup fallback"
        );
        openPopupFallback(sessionId);
      }
    } catch (err) {
      console.error('Error starting signup:', err);
      setError('Failed to start signup. Please try again.');
      setLoading(false);
      toast.error('Failed to start WhatsApp signup');
    }
  };

  /**
   * Fallback: Open signup in popup window
   * Used when FB SDK is not available
   */
  const openPopupFallback = (sessionId) => {
    const signupUrl = `${EMBEDDED_SIGNUP_URL}&state=${sessionId}&redirect_uri=${encodeURIComponent(WHATSAPP_EMBEDDED_SIGNUP_REDIRECT_URI)}`;
    
    console.log('🔗 Opening Signup Popup (fallback)...');

    const width = 900;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      signupUrl,
      'WhatsAppEmbeddedSignup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup || popup.closed) {
      console.warn('Popup blocked, redirecting...');
      window.location.href = signupUrl;
      return;
    }

    // Monitor popup close
    const checkInterval = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkInterval);
        console.log("📋 Popup closed, checking for account...");
        setTimeout(() => handleCheckForAccount(), 1500);
      }
    }, 1000);
  };

  // Handle Manual PIN Submission
  const handlePinSubmit = async () => {
    if (!pinInput || pinInput.length !== 6) {
      toast.error("Please enter a valid 6-digit PIN");
      return;
    }
    
    setSubmittingPin(true);
    setPinError(null);
    
    try {
      const saveWABADirect = httpsCallable(functions, 'saveWABADirect');
      
      const requestData = {
        ...pendingWabaData,
        pin: pinInput
      };

      const result = await saveWABADirect(requestData);
      
      if (result.data?.requirePin) {
        // PIN was incorrect
        if (result.data.pinIncorrect) {
          setPinError("Incorrect PIN. Make sure you're entering your WhatsApp Two-Step Verification PIN.");
          toast.error("Incorrect PIN. Please try again.");
        } else {
          setPinError("PIN required. Please enter a valid 6-digit PIN.");
        }
        setPinInput("");
        setSubmittingPin(false);
        return;
      }

      if (result.data?.success) {
        setShowPinModal(false);
        setPendingWabaData(null);
        setPinInput("");
        setPinError(null);
        
        setFormData(prev => ({
          ...prev,
          whatsappBusinessAccountId: result.data.wabaId,
          whatsappPhoneNumberId: result.data.phoneNumberId,
          whatsappPhoneNumber: result.data.phoneNumber,
          whatsappEnabled: true,
          whatsappPhoneRegistered: true,
          whatsappPhoneVerificationStatus: 'valid'
        }));

        toast.success("🎉 Phone registered successfully! Your WhatsApp is ready.");
        setTimeout(() => fetchWABAStatus(), 1000);
      }
    } catch (err) {
      console.error("PIN submission error:", err);
      setPinError("Failed to register. Please try again.");
      toast.error("Failed to register phone. Please try again.");
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
      // Direct Firestore save for manual entry (more reliable than Cloud Function)
      const wabaId = manualWabaId.trim();
      const phoneNumberId = manualPhoneNumberId.trim() || null;
      const phoneNumber = manualPhoneNumber.trim() || null;
      
      console.log("📝 Saving WABA manually:", { wabaId, phoneNumberId, phoneNumber });
      
      const userRef = doc(db, 'businesses', user.uid);
      const wabaData = {
        ownerId: user.uid,
        whatsappBusinessAccountId: wabaId,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappPhoneNumber: phoneNumber,
        whatsappProvider: "meta_tech_provider",
        whatsappEnabled: true,
        whatsappCreatedVia: "manual_entry",
        whatsappCreatedAt: serverTimestamp(),
        whatsappPhoneRegistered: false, // Will be true after PIN registration
        whatsappPhoneVerificationStatus: phoneNumberId ? "pending" : "not_registered",
        whatsappVerified: false,
        whatsappAccountReviewStatus: "PENDING",
        whatsappStatusLastChecked: serverTimestamp(),
      };
      
      await setDoc(userRef, wabaData, { merge: true });
      
      console.log("✅ WABA saved to Firestore");

      // Update local state
      setFormData(prev => ({
        ...prev,
        whatsappBusinessAccountId: wabaId,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappPhoneNumber: phoneNumber,
        whatsappEnabled: true,
        whatsappProvider: "meta_tech_provider",
        whatsappCreatedVia: "manual_entry",
        whatsappPhoneRegistered: false,
        whatsappPhoneVerificationStatus: phoneNumberId ? "pending" : "not_registered",
        whatsappVerified: false,
        whatsappAccountReviewStatus: "PENDING",
      }));

      toast.success("✅ WhatsApp details saved! Fetching status...");
      setShowManualModal(false);
      setManualWabaId("");
      setManualPhoneNumberId("");
      setManualPhoneNumber("");
      
      // Fetch status from Meta API (this will also register the phone)
      setTimeout(() => fetchWABAStatus(), 1500);
      
    } catch (err) {
      console.error("Manual save failed:", err);
      toast.error("Failed to save WhatsApp details: " + (err.message || "Please try again."));
    } finally {
      setSavingManual(false);
    }
  };

  // Setup Test Account
  const handleSetupTestAccount = async () => {
    if (!user) {
      toast.error("Please log in to continue");
      return;
    }

    if (!TEST_WABA_CONFIG.phoneNumberId || TEST_WABA_CONFIG.phoneNumberId.length < 10) {
      toast.error("⚠️ Test mode not configured! Phone Number ID is missing.");
      return;
    }

    if (!TEST_WABA_CONFIG.tempAccessToken || TEST_WABA_CONFIG.tempAccessToken.length < 50) {
      toast.error("⚠️ Temporary Access Token not configured!");
      return;
    }

    setSettingUpTest(true);
    try {
      const userRef = doc(db, 'businesses', user.uid);
      
      const testWabaData = {
        ownerId: user.uid,
        whatsappBusinessAccountId: TEST_WABA_CONFIG.wabaId,
        whatsappPhoneNumberId: TEST_WABA_CONFIG.phoneNumberId,
        whatsappPhoneNumber: TEST_WABA_CONFIG.phoneNumber,
        whatsappEnabled: true,
        whatsappProvider: "meta_tech_provider",
        whatsappCreatedVia: "test_mode_setup",
        whatsappCreatedAt: serverTimestamp(),
        whatsappPhoneRegistered: true,
        whatsappPhoneVerificationStatus: "VERIFIED",
        whatsappVerified: true,
        whatsappAccountReviewStatus: "APPROVED",
        whatsappStatusLastChecked: serverTimestamp(),
        whatsappTestMode: true,
        whatsappTestRecipient: TEST_WABA_CONFIG.testRecipient,
        whatsappTestAccessToken: TEST_WABA_CONFIG.tempAccessToken,
      };

      await setDoc(userRef, testWabaData, { merge: true });

      setFormData(prev => ({
        ...prev,
        whatsappBusinessAccountId: TEST_WABA_CONFIG.wabaId,
        whatsappPhoneNumberId: TEST_WABA_CONFIG.phoneNumberId,
        whatsappPhoneNumber: TEST_WABA_CONFIG.phoneNumber,
        whatsappEnabled: true,
        whatsappProvider: "meta_tech_provider",
        whatsappCreatedVia: "test_mode_setup",
        whatsappPhoneRegistered: true,
        whatsappPhoneVerificationStatus: "VERIFIED",
        whatsappVerified: true,
        whatsappAccountReviewStatus: "APPROVED",
        whatsappTestMode: true,
      }));

      setShowTestModal(false);
      toast.success("🧪 Test account connected!");
      toast.warning(`⏰ Token expires in ~60 minutes.`, { autoClose: 10000 });
      
    } catch (err) {
      console.error("Error setting up test account:", err);
      toast.error("Failed to setup test account.");
    } finally {
      setSettingUpTest(false);
    }
  };

  // Disconnect WhatsApp Account
  const handleDisconnect = async () => {
    if (!user) return;
    
    const confirmDisconnect = window.confirm(
      formData.whatsappTestMode 
        ? "Disconnect test mode? You can reconnect anytime."
        : "Are you sure you want to disconnect your WhatsApp Business Account?"
    );
    
    if (!confirmDisconnect) return;

    try {
      const userRef = doc(db, 'businesses', user.uid);
      
      await setDoc(userRef, {
        ownerId: user.uid,
        whatsappBusinessAccountId: null,
        whatsappPhoneNumberId: null,
        whatsappPhoneNumber: null,
        whatsappEnabled: false,
        whatsappProvider: null,
        whatsappCreatedVia: null,
        whatsappCreatedAt: null,
        whatsappPhoneRegistered: false,
        whatsappPhoneVerificationStatus: null,
        whatsappVerified: false,
        whatsappAccountReviewStatus: null,
        whatsappStatusLastChecked: null,
        whatsappTestMode: false,
        whatsappTestRecipient: null,
      }, { merge: true });

      setFormData(prev => ({
        ...prev,
        whatsappBusinessAccountId: null,
        whatsappPhoneNumberId: null,
        whatsappPhoneNumber: null,
        whatsappEnabled: false,
        whatsappProvider: null,
        whatsappCreatedVia: null,
        whatsappPhoneRegistered: false,
        whatsappPhoneVerificationStatus: null,
        whatsappVerified: false,
        whatsappAccountReviewStatus: null,
        whatsappTestMode: false,
      }));

      setStatusData(null);
      toast.success("WhatsApp disconnected.");
      
    } catch (err) {
      console.error("Error disconnecting:", err);
      toast.error("Failed to disconnect.");
    }
  };

  // Manual account detection
  const handleCheckForAccount = async () => {
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
        toast.info('No new account found. Make sure you completed the setup in the popup.');
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
        onDisconnect={handleDisconnect}
        isTestMode={formData.whatsappTestMode || formData.whatsappCreatedVia === 'test_mode_setup'}
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
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 rounded-2xl p-6 overflow-y-auto"
          >
            <div className="w-full max-w-md text-center">
              <div className="mx-auto w-14 h-14 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-yellow-500/50">
                <FaLock className="text-yellow-400 text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Phone Registration PIN</h3>
              
              {/* Explanation Box */}
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-5 text-left">
                <p className="text-sm text-blue-300 font-semibold mb-2">📱 What is this PIN?</p>
                <div className="text-xs text-gray-300 space-y-2">
                  <p>
                    <strong className="text-white">If your phone number already has WhatsApp 2-Step Verification:</strong><br/>
                    Enter your existing 6-digit PIN (the one you set in WhatsApp Settings → Two-step verification).
                  </p>
                  <p>
                    <strong className="text-white">If your phone number is new to WhatsApp Business:</strong><br/>
                    Create a new 6-digit PIN. This will become your two-step verification PIN for security.
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4">
                Enter a 6-digit PIN to complete phone registration:
              </p>
              
              {/* Error Message */}
              {pinError && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-300 flex items-center gap-2">
                    <FaExclamationTriangle className="flex-shrink-0" />
                    {pinError}
                  </p>
                </div>
              )}
              
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value.replace(/[^0-9]/g, '')); setPinError(null); }}
                placeholder="• • • • • •"
                className={`w-full bg-slate-800 border rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] text-white mb-4 focus:ring-2 focus:ring-green-500 outline-none font-mono ${pinError ? 'border-red-500' : 'border-white/20'}`}
                autoFocus
              />
              
              <p className="text-xs text-gray-500 mb-6">
                💡 Remember this PIN! You'll need it if you ever re-register this number.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPinModal(false); setPinInput(""); setPendingWabaData(null); }}
                  className="flex-1 px-4 py-3 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition"
                  disabled={submittingPin}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinSubmit}
                  disabled={submittingPin || pinInput.length !== 6}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {submittingPin ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <FaCheckCircle />
                      <span>Register Phone</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Help Link */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  Having trouble? Check{" "}
                  <a 
                    href="https://faq.whatsapp.com/1278661612895630" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-400 hover:underline"
                  >
                    WhatsApp's 2-Step Verification guide
                  </a>
                </p>
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
                Paste your WABA details from Meta Business Manager.
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

      {/* TEST MODE MODAL */}
      <AnimatePresence>
        {showTestModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 rounded-2xl p-6"
          >
            <div className="w-full max-w-md text-center">
              <div className="mx-auto w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-purple-500/50">
                <FaFlask className="text-purple-400 text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">🧪 Test Mode Setup</h3>
              <p className="text-sm text-gray-400 mb-4">
                Use Meta's test account to explore features without real setup.
              </p>
              
              <div className="bg-slate-800/80 border border-purple-500/30 rounded-xl p-4 mb-4 text-left">
                <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                  <FaMobileAlt /> Test Account Details
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">WABA ID:</span>
                    <span className="text-white font-mono">{TEST_WABA_CONFIG.wabaId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-white font-mono">{TEST_WABA_CONFIG.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Test Recipient:</span>
                    <span className="text-green-400 font-mono">{TEST_WABA_CONFIG.testRecipient}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-6 text-left">
                <p className="text-xs text-yellow-300 font-semibold mb-2">⚠️ Limitations:</p>
                <ul className="text-xs text-gray-300 space-y-1 ml-4 list-disc">
                  <li>Can only send to whitelisted test numbers</li>
                  <li>Token expires in ~60 minutes</li>
                  <li>For demo purposes only</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTestModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition"
                  disabled={settingUpTest}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetupTestAccount}
                  disabled={settingUpTest}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {settingUpTest ? <FaSpinner className="animate-spin" /> : <><FaFlask /> Activate</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
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
          Unlock WhatsApp Business Platform features with Meta Tech Provider integration
        </motion.p>
      </div>

      {/* SDK Status Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-center justify-center gap-2 mb-4"
      >
        <div className={`w-2 h-2 rounded-full ${sdkReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
        <span className="text-xs text-gray-500">
          {sdkReady ? 'Facebook SDK Ready' : 'Loading SDK...'}
        </span>
      </motion.div>

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
          As an official Meta Tech Provider, FLYP unlocks all WhatsApp features
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
                <p>If you've created your WhatsApp Business Account but don't see it here, click below to detect it.</p>
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
                <FaSync />
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

          {/* Test Mode Button */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-3">
              <div className="flex items-start gap-3">
                <FaFlask className="text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-300">
                  <p className="font-semibold text-purple-300 mb-1">🧪 Developer/Demo Mode</p>
                  <p>Want to explore features without connecting a real account?</p>
                </div>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowTestModal(true)}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20"
            >
              <FaFlask />
              <span>Use Test Account (Demo Mode)</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default WhatsAppConnection;
