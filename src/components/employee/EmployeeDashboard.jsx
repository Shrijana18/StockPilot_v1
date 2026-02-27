import React, { useEffect, useMemo, useState } from 'react';
import POSBilling from '../pos/panel/POSBilling.jsx';
import DeliveryOrders from './DeliveryOrders.jsx';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { empDB as db, empAuth, empFunctions } from '../../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { getEmployeeSession, clearEmployeeSession, isEmployeeRedirect, clearEmployeeRedirect, clearPendingEmployeeSession } from '../../utils/employeeSession';
import { logoutUser } from '../../utils/authUtils';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import { 
  FaBox, FaFileInvoice, FaChartLine, FaTruck, 
  FaSignOutAlt, FaUser, FaClock, FaCheckCircle,
  FaBars, FaTimes, FaHome, FaArrowLeft
} from 'react-icons/fa';

const EmployeeDashboard = () => {
  const [employee, setEmployee] = useState(null);
  const [now, setNow] = useState(new Date());
  const sess = getEmployeeSession();
  const retailerId = sess?.retailerId || '';
  const employeeId = sess?.employeeId || '';

  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);
  const [posFullscreen, setPosFullscreen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!employee?.id || !retailerId) return;
    const empRef = doc(db, 'businesses', retailerId, 'employees', employee.id);
    const unsub = onSnapshot(empRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const access = data.accessSections || {};
        const mapped = Object.entries(access)
          .filter(([_, allowed]) => allowed)
          .map(([key]) => ({ 
            key, 
            label: key === 'delivery' ? 'Delivery' : key.charAt(0).toUpperCase() + key.slice(1) 
          }));
        setSections(mapped);
      }
    });
    return () => unsub();
  }, [employee, retailerId]);

  useEffect(() => {
    try {
      if (isEmployeeRedirect()) {
        clearEmployeeRedirect();
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Shorter delay for faster feedback - check immediately
    const timer = setTimeout(() => {
      console.log('[EmployeeDashboard] 🔍 Checking session and starting load...');
      const s = getEmployeeSession();
      // CRITICAL: Ensure retailerId and employeeId are strings, not objects
      const rid = String(s?.retailerId || '').trim();
      const eid = String(s?.employeeId || '').trim();
      
      console.log('[EmployeeDashboard] Session check:', {
        hasSession: !!s,
        retailerId: rid,
        retailerIdType: typeof rid,
        employeeId: eid,
        employeeIdType: typeof eid,
        sessionKeys: s ? Object.keys(s) : [],
        rawRetailerId: s?.retailerId,
        rawEmployeeId: s?.employeeId
      });
      
      // For Android apps using React Router navigate, auth might not be immediately available
      // Allow dashboard to load with just session - auth will be restored in background
      const hasAuth = Boolean(empAuth?.currentUser);
      const isCapacitor = typeof window !== 'undefined' && window.Capacitor;
      
      console.log('[EmployeeDashboard] Auth check:', {
        hasAuth,
        currentUser: empAuth?.currentUser?.uid || 'none',
        isCapacitor
      });

      // In Android, only require session (auth can be restored). In web, require both for security.
      if (!s || !rid || !eid) {
        // No valid session - redirect immediately
        console.log('[EmployeeDashboard] ❌ Missing session, redirecting to role selection');
        clearEmployeeSession();
        if (!hasNavigated) {
          setHasNavigated(true);
          // Use window.location for Android compatibility
          window.location.href = '/';
        }
        return;
      }
      
      console.log('[EmployeeDashboard] ✅ Session found, proceeding with load');

      // In web version, also check auth. In Android, allow loading with session only.
      if (!isCapacitor && !hasAuth) {
        console.log('[EmployeeDashboard] Missing auth in web version, redirecting to role selection');
        clearEmployeeSession();
        if (!hasNavigated) {
          setHasNavigated(true);
          window.location.href = '/';
        }
        return;
      }

      // Load employee data using session (works even if Firebase auth is lost after page reload)
      let authUnsubscribe = null;
      let loaded = false;
      
      const loadEmployeeData = async (retId, empId) => {
        if (loaded) {
          console.log('[EmployeeDashboard] ⚠️ loadEmployeeData already called, skipping');
          return; // Prevent double loading
        }
        loaded = true;
        
        // CRITICAL: Ensure retId and empId are strings, not objects
        const retailerIdStr = String(retId || '').trim();
        const employeeIdStr = String(empId || '').trim();
        
        if (!retailerIdStr || !employeeIdStr) {
          console.error('[EmployeeDashboard] ❌ Invalid parameters for loadEmployeeData:', {
            retId: retailerIdStr,
            empId: employeeIdStr,
            retIdType: typeof retailerIdStr,
            empIdType: typeof employeeIdStr,
            originalRetId: retId,
            originalEmpId: empId
          });
          clearEmployeeSession();
          if (!hasNavigated) {
            setHasNavigated(true);
            window.location.href = '/';
          }
          return;
        }
        
        // CRITICAL: Verify auth before attempting Firestore read
        if (!empAuth || !empAuth.currentUser) {
          console.error('[EmployeeDashboard] ❌ Cannot load data: No auth available', {
            hasEmpAuth: !!empAuth,
            hasCurrentUser: !!empAuth?.currentUser
          });
          clearEmployeeSession();
          if (!hasNavigated) {
            setHasNavigated(true);
            window.location.href = '/';
          }
          return;
        }
        
        // CRITICAL: Ensure authUid is a string, not an object
        const authUid = String(empAuth.currentUser.uid || '').trim();
        if (!authUid) {
          console.error('[EmployeeDashboard] ❌ Auth UID is invalid:', {
            currentUser: empAuth.currentUser,
            uid: empAuth.currentUser?.uid,
            uidType: typeof empAuth.currentUser?.uid
          });
          clearEmployeeSession();
          if (!hasNavigated) {
            setHasNavigated(true);
            window.location.href = '/';
          }
          return;
        }
        
        console.log('[EmployeeDashboard] 📥 Starting to load employee data:', { 
          retId: retailerIdStr, 
          empId: employeeIdStr, 
          retIdType: typeof retailerIdStr,
          empIdType: typeof employeeIdStr,
          hasAuth: !!empAuth.currentUser,
          authUid: authUid,
          authUidType: typeof authUid
        });
        
        try {
          // CRITICAL FIX: Use employeeId from session - need to find the actual document ID
          // The custom token uses employeeDoc.id as UID, which may differ from flypEmployeeId
          // First try to find by flypEmployeeId, then use document ID
          let employeeDocId = employeeIdStr;
          let empRef = doc(db, 'businesses', retailerIdStr, 'employees', employeeIdStr);
          console.log('[EmployeeDashboard] 🔍 Attempting to fetch employee doc:', { 
            path: `businesses/${retailerIdStr}/employees/${employeeIdStr}`,
            hasAuth: !!empAuth.currentUser,
            authUid: authUid,
            authUidType: typeof authUid
          });
          
          let empSnap;
          try {
            empSnap = await getDoc(empRef);
          } catch (docError) {
            console.error('[EmployeeDashboard] ❌ getDoc failed:', docError);
            console.error('[EmployeeDashboard] getDoc error details:', {
              code: docError?.code,
              message: docError?.message,
              name: docError?.name
            });
            // If permission denied, try to restore auth and retry once
            if (docError?.code === 'permission-denied' && !empAuth.currentUser) {
              console.log('[EmployeeDashboard] 🔄 Permission denied, attempting auth restore and retry...');
              const authRestored = await restoreAuthIfNeeded();
              if (authRestored) {
                console.log('[EmployeeDashboard] 🔄 Retrying getDoc after auth restore...');
                empSnap = await getDoc(empRef);
              } else {
                throw docError; // Re-throw if auth restore failed
              }
            } else {
              throw docError; // Re-throw other errors
            }
          }
          
          if (!empSnap.exists()) {
            console.log('[EmployeeDashboard] 📋 Doc not found by ID, querying by flypEmployeeId:', employeeIdStr.toUpperCase());
            // Try querying by flypEmployeeId
            const employeesRef = collection(db, 'businesses', retailerIdStr, 'employees');
            const q = query(employeesRef, where('flypEmployeeId', '==', employeeIdStr.toUpperCase()), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              empRef = querySnapshot.docs[0].ref;
              employeeDocId = querySnapshot.docs[0].id;
              empSnap = querySnapshot.docs[0];
              console.log('[EmployeeDashboard] ✅ Found employee by flypEmployeeId:', employeeDocId);
            } else {
              console.warn('[EmployeeDashboard] ❌ Employee not found by ID or flypEmployeeId');
            }
          } else {
            employeeDocId = empId;
            console.log('[EmployeeDashboard] ✅ Found employee by document ID');
          }
          
          if (!empSnap.exists()) {
            console.warn('[EmployeeDashboard] Employee document not found:', { retId, empId, employeeDocId });
            clearEmployeeSession();
            if (!hasNavigated) {
              setHasNavigated(true);
              navigate('/', { replace: true }); // Go to role selection
            }
            return;
          }
          
          const data = empSnap.data();
          console.log('[EmployeeDashboard] ✅ Employee data loaded successfully:', { id: employeeDocId, name: data.name });
          setEmployee({ id: employeeDocId, ...data });
          try {
            await setDoc(empRef, { lastSeen: serverTimestamp(), online: true }, { merge: true });
            console.log('[EmployeeDashboard] ✅ Presence updated');
          } catch (e) {
            console.warn('Presence update failed (non-fatal):', e);
          }
        } catch (e) {
          console.error('[EmployeeDashboard] ❌ Failed to load employee:', e);
          console.error('[EmployeeDashboard] Error details:', {
            code: e?.code,
            message: e?.message,
            stack: e?.stack
          });
          clearEmployeeSession();
          if (!hasNavigated) {
            setHasNavigated(true);
            navigate('/', { replace: true }); // Go to role selection
          }
        }
      };

      // CRITICAL: Restore Firebase authentication automatically if we have a session but no auth
      // This is essential for Firestore security rules to work (request.auth.uid)
      let restoringAuth = false; // Prevent concurrent restoration attempts
      const restoreAuthIfNeeded = async () => {
        // Prevent concurrent restoration attempts
        if (restoringAuth) {
          console.warn('[EmployeeDashboard] ⚠️ Auth restoration already in progress, skipping duplicate call');
          return false;
        }
        
        // Only restore if auth is truly missing
        if (empAuth.currentUser) {
          console.log('[EmployeeDashboard] ✅ Auth already exists, skipping restore:', empAuth.currentUser.uid);
          return true;
        }
        
        restoringAuth = true;
        
        if (!s || !eid || !rid) {
          console.warn('[EmployeeDashboard] ⚠️ Cannot restore auth: missing session data', { hasSession: !!s, eid, rid });
          restoringAuth = false;
          return false;
        }
        
        console.log('[EmployeeDashboard] 🔄 Attempting to restore Firebase authentication...');
        try {
          // Call Cloud Function to get a new custom token based on session
          // CRITICAL: Ensure we're passing strings, not objects
          const retailerIdStr = String(rid || '').trim();
          const employeeIdStr = String(eid || '').trim();
          
          if (!retailerIdStr || !employeeIdStr) {
            console.error('[EmployeeDashboard] ❌ Invalid retailerId or employeeId:', {
              retailerId: retailerIdStr,
              employeeId: employeeIdStr,
              retailerIdType: typeof retailerIdStr,
              employeeIdType: typeof employeeIdStr
            });
            restoringAuth = false;
            return false;
          }
          
          console.log('[EmployeeDashboard] 📞 Calling restoreRetailerEmployeeAuth:', { 
            retailerId: retailerIdStr, 
            employeeId: employeeIdStr,
            retailerIdType: typeof retailerIdStr,
            employeeIdType: typeof employeeIdStr
          });
          const restoreAuth = httpsCallable(empFunctions, 'restoreRetailerEmployeeAuth');
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auth restore timeout after 10s')), 10000)
          );
          
          let result;
          try {
            result = await Promise.race([
              restoreAuth({ retailerId: retailerIdStr, employeeId: employeeIdStr }),
              timeoutPromise
            ]);
          } catch (raceError) {
            console.error('[EmployeeDashboard] ❌ Promise.race failed:', raceError);
            if (raceError?.message?.includes('timeout')) {
              console.error('[EmployeeDashboard] ❌ Auth restore timed out after 10s');
            }
            restoringAuth = false;
            return false;
          }

          if (result.data?.success && result.data?.customToken) {
            const customToken = result.data.customToken;
            // Validate token before using it
            if (typeof customToken !== 'string' || customToken.trim().length === 0) {
              console.error('[EmployeeDashboard] ❌ Invalid custom token received:', typeof customToken, customToken?.length);
              restoringAuth = false;
              return false;
            }
            console.log('[EmployeeDashboard] 🔑 Received custom token, signing in...', { tokenLength: customToken.length });
            // Sign in with the custom token to restore authentication
            try {
              // Validate empAuth instance before using it
              if (!empAuth) {
                console.error('[EmployeeDashboard] ❌ empAuth instance is null/undefined');
                restoringAuth = false;
                return false;
              }
              
              // Validate empAuth is a proper Firebase Auth instance
              if (typeof empAuth !== 'object' || !empAuth.app) {
                console.error('[EmployeeDashboard] ❌ empAuth is not a valid Firebase Auth instance:', {
                  type: typeof empAuth,
                  hasApp: !!empAuth?.app,
                  empAuthKeys: empAuth ? Object.keys(empAuth) : []
                });
                restoringAuth = false;
                return false;
              }
              
              // Validate token one more time right before use
              if (!customToken || typeof customToken !== 'string' || customToken.trim().length === 0) {
                console.error('[EmployeeDashboard] ❌ Token invalid right before signIn:', {
                  hasToken: !!customToken,
                  type: typeof customToken,
                  length: customToken?.length,
                  isEmpty: customToken?.trim().length === 0
                });
                restoringAuth = false;
                return false;
              }
              
              // Check if already signed in - if so, sign out first to avoid conflicts
              if (empAuth.currentUser) {
                console.log('[EmployeeDashboard] ⚠️ Already signed in, signing out first:', empAuth.currentUser.uid);
                try {
                  await signOut(empAuth);
                  // Wait a bit for sign out to complete
                  await new Promise(resolve => setTimeout(resolve, 200));
                } catch (signOutError) {
                  console.warn('[EmployeeDashboard] Sign out failed (non-fatal):', signOutError);
                }
              }
              
              console.log('[EmployeeDashboard] 🔑 About to call signInWithCustomToken...', {
                tokenLength: customToken.length,
                tokenPrefix: customToken.substring(0, 20) + '...',
                authAppName: empAuth.app?.name,
                authAppId: empAuth.app?.options?.appId,
                hasCurrentUser: !!empAuth.currentUser
              });
              
              // Double-check auth and token right before the call
              if (!empAuth || !customToken) {
                console.error('[EmployeeDashboard] ❌ CRITICAL: Auth or token became invalid right before signIn!', {
                  hasAuth: !!empAuth,
                  hasToken: !!customToken
                });
                restoringAuth = false;
                return false;
              }
              
              await signInWithCustomToken(empAuth, customToken);
              // Verify auth was set
              if (!empAuth.currentUser) {
                console.error('[EmployeeDashboard] ❌ Auth not set after signInWithCustomToken');
                restoringAuth = false;
                return false;
              }
              console.log('[EmployeeDashboard] ✅ Firebase authentication restored successfully:', empAuth.currentUser.uid);
              restoringAuth = false;
              return true;
            } catch (signInError) {
              restoringAuth = false;
              console.error('[EmployeeDashboard] ❌ signInWithCustomToken failed:', signInError);
              console.error('[EmployeeDashboard] SignIn error details:', {
                code: signInError?.code,
                message: signInError?.message,
                name: signInError?.name,
                stack: signInError?.stack
              });
              
              // Provide more specific error messages
              if (signInError?.code === 'auth/argument-error') {
                console.error('[EmployeeDashboard] ❌ auth/argument-error - This means invalid auth instance or token!', {
                  hasAuth: !!empAuth,
                  authType: typeof empAuth,
                  hasApp: !!empAuth?.app,
                  hasToken: !!customToken,
                  tokenType: typeof customToken,
                  tokenLength: customToken?.length
                });
              }
              return false;
            }
            } else {
              console.warn('[EmployeeDashboard] ⚠️ Failed to restore auth:', result.data?.message || 'No token received', {
                success: result.data?.success,
                hasToken: !!result.data?.customToken
              });
              restoringAuth = false;
              return false;
            }
          } catch (err) {
            restoringAuth = false;
            console.error('[EmployeeDashboard] ❌ Error restoring auth:', err);
            console.error('[EmployeeDashboard] Error details:', {
              code: err?.code,
              message: err?.message,
              name: err?.name,
              stack: err?.stack
            });
            return false;
          }
        };

      // PRODUCTION FIX: Restore auth FIRST, then load employee data
      // This ensures Firestore rules can validate the request properly
      if (!loaded && eid && rid) {
        // Add timeout to prevent infinite loading (reduced to 8 seconds for faster feedback)
        const loadTimeout = setTimeout(() => {
          if (!loaded) {
            console.error('[EmployeeDashboard] Load timeout after 8s - redirecting to role selection');
            clearEmployeeSession();
            if (!hasNavigated) {
              setHasNavigated(true);
              // Use window.location for Android compatibility
              window.location.href = '/';
            }
          }
        }, 8000); // 8 second timeout

        // Restore Firebase authentication FIRST (blocking for initial load)
        (async () => {
          try {
            console.log('[EmployeeDashboard] 🚀 Starting load sequence:', { 
              hasAuth: !!empAuth.currentUser, 
              retailerId: rid, 
              employeeId: eid 
            });
            
            // Only restore auth if it's actually missing
            // On Capacitor, auth from login should persist, so only restore if truly missing
            const isCapacitor = typeof window !== 'undefined' && window.Capacitor;
            const hasValidAuth = empAuth?.currentUser && empAuth.currentUser.uid;
            
            // Check if session was just created (within last 5 seconds) - if so, auth should be fresh from login
            // Session has 'ts' field that stores timestamp
            const sessionAge = s?.ts ? Date.now() - s.ts : Infinity;
            const isFreshLogin = sessionAge < 5000; // 5 seconds
            
            if (!hasValidAuth) {
              // If it's a fresh login, wait a bit for auth to propagate before trying to restore
              if (isFreshLogin) {
                console.log('[EmployeeDashboard] ⏳ Fresh login detected, waiting for auth to propagate...', { sessionAge });
                await new Promise(resolve => setTimeout(resolve, 500));
                // Check again after waiting
                if (empAuth?.currentUser) {
                  console.log('[EmployeeDashboard] ✅ Auth appeared after wait:', empAuth.currentUser.uid);
                } else {
                  console.log('[EmployeeDashboard] 🔐 Auth still missing after wait, restoring...');
                  const authRestored = await restoreAuthIfNeeded();
                  if (!authRestored) {
                    console.error('[EmployeeDashboard] ❌ Auth restoration failed, redirecting');
                    clearTimeout(loadTimeout);
                    clearEmployeeSession();
                    if (!hasNavigated) {
                      setHasNavigated(true);
                      window.location.href = '/';
                    }
                    return;
                  }
                }
              } else {
                console.log('[EmployeeDashboard] 🔐 No auth found, restoring...', { isCapacitor, sessionAge });
                const authRestored = await restoreAuthIfNeeded();
                if (!authRestored) {
                  console.error('[EmployeeDashboard] ❌ Auth restoration failed, redirecting');
                  clearTimeout(loadTimeout);
                  clearEmployeeSession();
                  if (!hasNavigated) {
                    setHasNavigated(true);
                    window.location.href = '/';
                  }
                  return;
                }
              }
              
              // Wait a bit for auth to propagate to Firestore rules
              console.log('[EmployeeDashboard] ⏳ Waiting for auth to propagate to Firestore...');
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Verify auth is actually set
              if (!empAuth?.currentUser) {
                console.error('[EmployeeDashboard] ❌ Auth still not set after restore, redirecting');
                clearTimeout(loadTimeout);
                clearEmployeeSession();
                if (!hasNavigated) {
                  setHasNavigated(true);
                  window.location.href = '/';
                }
                return;
              }
              console.log('[EmployeeDashboard] ✅ Auth propagated, currentUser:', empAuth.currentUser.uid);
            } else {
              console.log('[EmployeeDashboard] ✅ Auth already present, skipping restore:', empAuth.currentUser.uid);
              // Still wait a bit to ensure Firestore rules recognize the auth
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Verify auth is still valid before loading data
            if (!empAuth.currentUser) {
              console.error('[EmployeeDashboard] ❌ Auth lost before loading data, redirecting');
              clearTimeout(loadTimeout);
              clearEmployeeSession();
              if (!hasNavigated) {
                setHasNavigated(true);
                window.location.href = '/';
              }
              return;
            }
            
            // Then load employee data (now with auth in place)
            const currentSession = getEmployeeSession();
            console.log('[EmployeeDashboard] 📥 Loading employee data with auth:', {
              authUid: empAuth.currentUser.uid,
              retailerId: rid,
              employeeId: eid,
              sessionEmployeeId: currentSession?.employeeId,
              sessionRetailerId: currentSession?.retailerId
            });
            
            try {
              await loadEmployeeData(rid, eid);
              clearTimeout(loadTimeout); // Clear timeout on success
              console.log('[EmployeeDashboard] ✅ Load sequence completed successfully');
            } catch (loadError) {
              clearTimeout(loadTimeout);
              console.error('[EmployeeDashboard] ❌ loadEmployeeData failed:', loadError);
              console.error('[EmployeeDashboard] Load error details:', {
                code: loadError?.code,
                message: loadError?.message,
                name: loadError?.name
              });
              // Don't redirect on load error - let the timeout or user retry
              // The error might be temporary (network, etc.)
            }
          } catch (error) {
            clearTimeout(loadTimeout);
            console.error('[EmployeeDashboard] ❌ Error during load sequence:', error);
            console.error('[EmployeeDashboard] Error details:', {
              code: error?.code,
              message: error?.message,
              name: error?.name,
              stack: error?.stack
            });
            clearEmployeeSession();
            if (!hasNavigated) {
              setHasNavigated(true);
              // Use window.location for Android compatibility
              window.location.href = '/';
            }
          }
        })();
      }

      // Set up auth state listener to monitor auth restoration
      authUnsubscribe = onAuthStateChanged(
        empAuth, 
        (user) => {
          if (user) {
            console.log('[EmployeeDashboard] ✅ Firebase authentication active:', user.uid);
          } else {
            console.log('[EmployeeDashboard] ⚠️ Firebase auth state changed: no user');
          }
        },
        (error) => {
          // Handle auth state change errors
          console.error('[EmployeeDashboard] ❌ Auth state change error:', error);
          console.error('[EmployeeDashboard] Auth state error details:', {
            code: error?.code,
            message: error?.message,
            name: error?.name
          });
        }
      );

      return () => {
        if (authUnsubscribe) authUnsubscribe();
      };
    }, 500);

    return () => clearTimeout(timer);
  }, [hasNavigated, navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Don't auto-select first section - show overview/dashboard first
  // User can manually select a section from the tabs
  // useEffect(() => {
  //   if (sections.length && !activeTab) setActiveTab(sections[0].key);
  // }, [sections, activeTab]);

  const handleLogout = async () => {
    try {
      console.log('[EmployeeDashboard] 🚪 Starting logout process...');
      
      // Update employee presence status
      if (retailerId && employeeId) {
        try {
          await setDoc(
            doc(db, 'businesses', retailerId, 'employees', employeeId),
            { online: false, lastSeen: serverTimestamp() },
            { merge: true }
          );
          console.log('[EmployeeDashboard] ✅ Presence updated');
        } catch (e) {
          console.warn('[EmployeeDashboard] Presence clear failed (non-fatal):', e);
        }
      }

      // Sign out from Firebase and clear all sessions (like distributor employee)
      await logoutUser('employee');
      console.log('[EmployeeDashboard] ✅ Logout user called');
      
      // CRITICAL: Clear pending session immediately (for native apps)
      clearPendingEmployeeSession();
      
      // CRITICAL: Use window.location.href for hard navigation to force full page reload
      // This ensures all React state is cleared and RoleSelection won't see stale session
      const isCapacitor = typeof window !== 'undefined' && window.Capacitor;
      if (isCapacitor) {
        // For native apps, use window.location to force full reload
        console.log('[EmployeeDashboard] 🔄 Using hard navigation for native app');
        window.location.href = '/';
      } else {
        // For web, also use hard navigation to ensure clean state
        console.log('[EmployeeDashboard] 🔄 Using hard navigation for web');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('[EmployeeDashboard] ❌ Logout error:', error);
      // Even if there's an error, clear session and redirect with hard navigation
      clearEmployeeSession();
      clearPendingEmployeeSession();
      clearEmployeeRedirect();
      // Force hard navigation to ensure clean state
      window.location.href = '/';
    }
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    if (activeTab) {
      setActiveTab('');
    } else {
      navigate('/', { replace: true });
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  const getSectionIcon = (key) => {
    switch (key) {
      case 'inventory': return FaBox;
      case 'billing': return FaFileInvoice;
      case 'analytics': return FaChartLine;
      case 'delivery': return FaTruck;
      default: return FaBox;
    }
  };

  const renderActiveSection = () => {
    // Show dashboard overview if no tab is selected
    if (!activeTab) {
      return (
        <div className="space-y-4">
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-white mb-2">Welcome, {employee.name || 'Employee'}!</h2>
            <p className="text-white/60 text-sm mb-6">Select a section from above to get started</p>
          </div>
          
          {/* Quick Access Cards */}
          {sections.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map(s => {
                const Icon = getSectionIcon(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveTab(s.key)}
                    className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition">
                        <Icon className="text-emerald-400 text-lg" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{s.label}</h3>
                        <p className="text-xs text-white/60 mt-1">
                          {s.key === 'delivery' && 'View and manage delivery orders'}
                          {s.key === 'billing' && 'Create invoices and process payments'}
                          {s.key === 'inventory' && 'Manage stock and products'}
                          {s.key === 'analytics' && 'View sales and performance data'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    
    if (activeTab === 'billing') {
      const emp = getEmployeeSession();
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <FaFileInvoice className="text-emerald-400 text-sm" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Billing POS</h3>
                <p className="text-xs text-white/60">Create and manage invoices</p>
              </div>
            </div>
            <button
              onClick={() => setPosFullscreen((v) => !v)}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              {posFullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>

          <div
            className={
              posFullscreen
                ? 'fixed inset-0 z-50 bg-slate-950/95 backdrop-blur px-2 sm:px-4 py-2 sm:py-4'
                : 'rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3 shadow-sm'
            }
          >
            {posFullscreen && (
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="flex items-center gap-2 text-slate-200 text-sm">
                  <FaFileInvoice className="text-sm" /> <span className="font-medium">Billing POS</span>
                </div>
                <button
                  onClick={() => setPosFullscreen(false)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            )}
            <div className={posFullscreen ? 'h-[calc(100vh-4.5rem)] sm:h-[calc(100vh-5.5rem)] overflow-auto rounded-xl' : 'rounded-xl'}>
              <POSBilling
                retailerId={emp?.retailerId}
                employeeId={emp?.employeeId}
                employeeName={employee?.name || 'Employee'}
                role={employee?.role || 'Staff'}
              />
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === 'delivery') {
      return <DeliveryOrders />;
    }
    if (activeTab === 'inventory') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <FaBox className="text-emerald-400 text-sm" />
              <h3 className="text-sm font-semibold text-white">Update Stock</h3>
            </div>
            <p className="text-xs text-white/60">Quickly adjust quantities and scan barcodes</p>
          </div>
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <FaBox className="text-amber-400 text-sm" />
              <h3 className="text-sm font-semibold text-white">Low Stock Alerts</h3>
            </div>
            <p className="text-xs text-white/60">View items below threshold</p>
          </div>
        </div>
      );
    }
    if (activeTab === 'analytics') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <FaChartLine className="text-cyan-400 text-sm" />
              <h3 className="text-sm font-semibold text-white">Today's Sales</h3>
            </div>
            <p className="text-xs text-white/60">Revenue, items sold, and average order value</p>
          </div>
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <FaChartLine className="text-purple-400 text-sm" />
              <h3 className="text-sm font-semibold text-white">Top Items</h3>
            </div>
            <p className="text-xs text-white/60">Best performers for quick restock</p>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
        <p className="text-white/60 text-sm">No sections assigned yet. Ask your manager to grant permissions.</p>
      </div>
    );
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-3">
        <div className="animate-spin h-10 w-10 border-3 border-emerald-500 border-t-transparent rounded-full"></div>
        <p className="text-white/60 text-sm">Loading your workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Premium Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Profile & Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/30 border border-emerald-400/30">
                  {employee.name?.charAt(0)?.toUpperCase() || 'E'}
                </div>
                {employee.online && (
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-lg shadow-emerald-400/50 animate-pulse"></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold bg-gradient-to-r from-white via-emerald-100 to-cyan-100 bg-clip-text text-transparent truncate">{employee.name || 'Employee'}</h1>
                <p className="text-xs text-white/60 truncate font-mono">
                  {employee.flypEmployeeId || employee.id || '-'} • <span className="text-emerald-400">{employee.role || 'Employee'}</span>
                </p>
              </div>
            </div>

            {/* Right: Navigation & Actions */}
            <div className="flex items-center gap-2">
              {/* Back Button - Show when in a section */}
              {activeTab && (
                <button
                  onClick={handleGoBack}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105"
                  title="Go Back"
                >
                  <FaArrowLeft className="text-white/70 text-sm" />
                </button>
              )}
              {/* Home Button */}
              <button
                onClick={handleGoHome}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105"
                title="Home / Main Menu"
              >
                <FaHome className="text-white/70 text-sm" />
              </button>
              {!isMobile && (
                <div className="text-xs text-white/60 hidden sm:block px-2">
                  {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-all hover:scale-105"
                title="Logout"
              >
                <FaSignOutAlt className="text-red-400 text-sm" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main 
        className="relative z-10 px-4 py-4 pb-24"
        style={{ 
          paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom))' : '80px'
        }}
      >
        {/* Premium Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${employee.online ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-gray-400'}`}></div>
              <span className="text-xs text-white/60 font-medium">Status</span>
            </div>
            <p className="text-sm font-bold text-white">{employee.online ? 'Online' : 'Offline'}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <div className="flex items-center gap-2 mb-2">
              <FaClock className="text-cyan-400 text-xs" />
              <span className="text-xs text-white/60 font-medium">Last Seen</span>
            </div>
            <p className="text-sm font-bold text-white truncate">{formatLastSeen(employee.lastSeen)}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md shadow-lg hover:shadow-xl transition-all hover:scale-105 sm:col-span-1 col-span-2"
          >
            <div className="flex items-center gap-2 mb-2">
              <FaUser className="text-emerald-400 text-xs" />
              <span className="text-xs text-white/60 font-medium">Access</span>
            </div>
            <p className="text-sm font-bold text-white truncate">
              {sections.length} {sections.length === 1 ? 'Section' : 'Sections'}
            </p>
          </motion.div>
        </div>

        {/* Tab Navigation - Compact */}
        {sections.length > 0 && (
          <div className="mb-4">
            {/* Show "Dashboard" as first tab if no active tab */}
            {!activeTab && (
              <div className="mb-2">
                <button
                  onClick={() => setActiveTab('')}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium"
                >
                  Dashboard Overview
                </button>
              </div>
            )}
            {isMobile ? (
              // Mobile: Horizontal scrollable tabs
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {sections.map(s => {
                  const Icon = getSectionIcon(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveTab(s.key)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        activeTab === s.key
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/40 border border-emerald-400/30'
                          : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Icon className="text-sm" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              // Desktop: Standard tabs
              <div className="flex gap-2 border-b border-white/10">
                {sections.map(s => {
                  const Icon = getSectionIcon(s.key);
                  return (
                  <button
                    key={s.key}
                    onClick={() => setActiveTab(s.key)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-t-lg text-sm font-medium transition-all relative ${
                      activeTab === s.key
                        ? 'text-emerald-400 bg-gradient-to-b from-white/10 to-white/5 border-b-2 border-emerald-400'
                        : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                      <Icon className="text-sm" />
                      <span>{s.label}</span>
                      {activeTab === s.key && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active Section Content */}
        <div className="mt-4">
          {renderActiveSection()}
        </div>
      </main>

      {/* Mobile Bottom Navigation (if multiple sections) */}
      {isMobile && sections.length > 1 && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-white/10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-around px-2 py-2">
            {sections.map(s => {
              const Icon = getSectionIcon(s.key);
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-lg transition-all ${
                    isActive
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  <Icon className="text-lg" />
                  <span className="text-xs font-medium">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!isMobile && (
        <div className="fixed bottom-4 left-4 right-4 max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Need more access? Contact your manager</span>
            <span>{now.toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
