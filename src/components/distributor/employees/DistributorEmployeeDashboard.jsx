import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { empDB, empAuth, empFunctions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { getDistributorEmployeeSession, clearDistributorEmployeeSession, isDistributorEmployeeRedirect, clearDistributorEmployeeRedirect } from '../../../utils/distributorEmployeeSession';
import { logoutUser } from '../../../utils/authUtils';
import { FiUser, FiClock, FiActivity, FiLogOut, FiCheckCircle, FiRadio, FiShield, FiFolder, FiCalendar, FiHome, FiArrowLeft } from 'react-icons/fi';

// Import distributor components
import AddRetailerModal from '../AddRetailerModal';
import PassiveOrders from '../orders/PassiveOrders';
import OrderRequests from '../orders/OrderRequests';
import PendingOrders from '../orders/PendingOrders';
import TrackOrders from '../orders/TrackOrders';
import DistributorAnalytics from '../analytics/DistributorAnalytics';
import DistributorInventory from '../DistributorInventory';
import DispatchTracker from '../DispatchTracker';
import DistributorManualBilling from '../DistributorManualBilling';
import DistributorAIForecast from '../aiForecast/DistributorAIForecast';
import StartSessionModal from './StartSessionModal';

const DistributorEmployeeDashboard = () => {
  const [employee, setEmployee] = useState(null);
  const [now, setNow] = useState(new Date());
  const sess = getDistributorEmployeeSession();
  const distributorId = sess?.distributorId || '';
  const employeeId = sess?.employeeId || '';

  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);
  const [addRetailerOpen, setAddRetailerOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [sessionActive, setSessionActive] = useState(null); // null = checking, false = not active, true = active
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    try {
      if (isDistributorEmployeeRedirect()) {
        clearDistributorEmployeeRedirect();
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Longer delay for mobile/slow networks - wait for auth state to initialize after page reload
      const timer = setTimeout(() => {
      const s = getDistributorEmployeeSession();
      // CRITICAL: Ensure IDs are strings, not objects
      const did = String(s?.distributorId || '').trim();
      const eid = String(s?.employeeId || '').trim();

      if (!s || !did || !eid) {
        // Only redirect if we've waited long enough (prevents loops)
        clearDistributorEmployeeSession();
        if (!hasNavigated) {
          setHasNavigated(true);
          navigate('/distributor-employee-login', { replace: true });
        }
        return;
      }

      // Load employee data using session (works even if Firebase auth is lost after page reload)
      let authUnsubscribe = null;
      let loaded = false;
      
      const loadEmployeeData = async (distId, empId) => {
        if (loaded) return; // Prevent double loading
        loaded = true;
        
        // CRITICAL: Ensure IDs are strings
        const distributorIdStr = String(distId || '').trim();
        const employeeIdStr = String(empId || '').trim();
        
        if (!distributorIdStr || !employeeIdStr) {
          console.error('[DistributorEmployeeDashboard] ❌ Invalid parameters:', {
            distId: distributorIdStr,
            empId: employeeIdStr
          });
          if (!hasNavigated) {
            setHasNavigated(true);
            navigate('/distributor-employee-login', { replace: true });
          }
          return;
        }
        
        // CRITICAL: Verify auth before attempting Firestore read (required for security rules)
        if (!empAuth || !empAuth.currentUser) {
          console.error('[DistributorEmployeeDashboard] ❌ Cannot load data: No auth available', {
            hasEmpAuth: !!empAuth,
            hasCurrentUser: !!empAuth?.currentUser
          });
          // Don't redirect immediately - let restoreAuthIfNeeded handle it
          return;
        }
        
        try {
          // CRITICAL FIX: Use employeeId from session directly as document ID
          // The custom token uses employeeDoc.id as UID, which equals employeeId from session
          const employeeDocId = String(empAuth.currentUser?.uid || employeeIdStr).trim();
          
          const empRef = doc(empDB, 'businesses', distributorIdStr, 'distributorEmployees', employeeDocId);
          const empSnap = await getDoc(empRef);
          if (!empSnap.exists()) {
            console.warn('[DistributorEmployeeDashboard] Employee document not found:', { 
              distId: distributorIdStr, 
              empId: employeeIdStr, 
              employeeDocId 
            });
            if (!hasNavigated) {
              setHasNavigated(true);
              navigate('/distributor-employee-login', { replace: true });
            }
            return;
          }
          const data = empSnap.data();
          setEmployee({ id: employeeIdStr, ...data });
          try {
            await setDoc(empRef, { lastSeen: serverTimestamp(), online: true }, { merge: true });
          } catch (e) {
            console.warn('Presence update failed (non-fatal):', e);
          }
        } catch (e) {
          console.error('Failed to load employee (redirecting to login):', e);
          if (!hasNavigated) {
            setHasNavigated(true);
            navigate('/distributor-employee-login', { replace: true });
          }
        }
      };

      // CRITICAL: Restore Firebase authentication automatically if we have a session but no auth
      // This is essential for Firestore security rules to work (request.auth.uid)
      let restoringAuth = false;
      const restoreAuthIfNeeded = async () => {
        // Prevent concurrent restoration attempts
        if (restoringAuth) {
          console.warn('[DistributorEmployeeDashboard] ⚠️ Auth restoration already in progress');
          return false;
        }
        
        if (empAuth.currentUser) {
          console.log('[DistributorEmployeeDashboard] ✅ Auth already exists:', empAuth.currentUser.uid);
          return true;
        }
        
        if (!s || !eid || !did) {
          console.warn('[DistributorEmployeeDashboard] ⚠️ Cannot restore auth: missing session data');
          return false;
        }
        
        restoringAuth = true;
        console.log('[DistributorEmployeeDashboard] 🔄 Attempting to restore Firebase authentication...');
        try {
          // CRITICAL: Ensure we're passing strings
          const distributorIdStr = String(did).trim();
          const employeeIdStr = String(eid).trim();
          
          // Call Cloud Function to get a new custom token based on session
          const restoreAuth = httpsCallable(empFunctions, 'restoreDistributorEmployeeAuth');
          const result = await restoreAuth({
            distributorId: distributorIdStr,
            employeeId: employeeIdStr,
          });

          if (result.data.success && result.data.customToken) {
            const customToken = result.data.customToken;
            // Validate token
            if (typeof customToken !== 'string' || customToken.trim().length === 0) {
              console.error('[DistributorEmployeeDashboard] ❌ Invalid custom token received');
              restoringAuth = false;
              return false;
            }
            
            // Sign in with the custom token to restore authentication
            if (!empAuth) {
              console.error('[DistributorEmployeeDashboard] ❌ empAuth instance is null/undefined');
              restoringAuth = false;
              return false;
            }
            
            // Check if already signed in - sign out first to avoid conflicts
            if (empAuth.currentUser) {
              try {
                await signOut(empAuth);
                await new Promise(resolve => setTimeout(resolve, 200));
              } catch (signOutError) {
                console.warn('[DistributorEmployeeDashboard] Sign out failed (non-fatal):', signOutError);
              }
            }
            
            await signInWithCustomToken(empAuth, customToken);
            
            // Verify auth was set
            if (!empAuth.currentUser) {
              console.error('[DistributorEmployeeDashboard] ❌ Auth not set after signInWithCustomToken');
              restoringAuth = false;
              return false;
            }
            
            console.log('[DistributorEmployeeDashboard] ✅ Firebase authentication restored successfully:', empAuth.currentUser.uid);
            restoringAuth = false;
            return true;
          } else {
            console.warn('[DistributorEmployeeDashboard] ⚠️ Failed to restore auth:', result.data.message);
            restoringAuth = false;
            return false;
          }
        } catch (err) {
          console.error('[DistributorEmployeeDashboard] ❌ Error restoring auth:', err);
          restoringAuth = false;
          return false;
        }
      };

      // CRITICAL FIX: In app (Capacitor), auth is in-memory and lost after navigation
      // We MUST restore auth BEFORE attempting Firestore reads, otherwise we get permission-denied
      const isCapacitor = typeof window !== 'undefined' && window.Capacitor;
      const hasAuth = Boolean(empAuth?.currentUser);
      
      // Load sequence: restore auth first (if needed), then load data
      (async () => {
        try {
          // Restore auth if missing (especially important in app)
          if (!hasAuth) {
            console.log('[DistributorEmployeeDashboard] 🔐 No auth found, restoring...');
            const authRestored = await restoreAuthIfNeeded();
            if (!authRestored) {
              console.error('[DistributorEmployeeDashboard] ❌ Auth restoration failed, redirecting');
              clearDistributorEmployeeSession();
              if (!hasNavigated) {
                setHasNavigated(true);
                navigate('/distributor-employee-login', { replace: true });
              }
              return;
            }
            // Wait for auth to propagate to Firestore rules
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify auth is still set
            if (!empAuth.currentUser) {
              console.error('[DistributorEmployeeDashboard] ❌ Auth lost after restore, redirecting');
              clearDistributorEmployeeSession();
              if (!hasNavigated) {
                setHasNavigated(true);
                navigate('/distributor-employee-login', { replace: true });
              }
              return;
            }
          } else {
            console.log('[DistributorEmployeeDashboard] ✅ Auth already present:', empAuth.currentUser.uid);
            // Still wait a bit to ensure Firestore rules recognize the auth
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Now load employee data (with auth in place)
          if (!loaded && eid && did) {
            await loadEmployeeData(did, eid);
          }
        } catch (loadError) {
          console.error('[DistributorEmployeeDashboard] ❌ Load sequence failed:', loadError);
          clearDistributorEmployeeSession();
          if (!hasNavigated) {
            setHasNavigated(true);
            navigate('/distributor-employee-login', { replace: true });
          }
        }
      })();

      // Set up auth state listener to monitor auth restoration
      authUnsubscribe = onAuthStateChanged(empAuth, (user) => {
        if (user) {
          console.log('[DistributorEmployeeDashboard] ✅ Firebase authentication active:', user.uid);
        } else {
          console.warn('[DistributorEmployeeDashboard] ⚠️ Firebase authentication not active');
        }
      });

      return () => {
        if (authUnsubscribe) authUnsubscribe();
      };
    }, 1000); // Increased from 400ms to 1000ms for mobile/slow networks

    return () => clearTimeout(timer);
  }, [hasNavigated, navigate]);

  useEffect(() => {
    if (!employee?.id || !distributorId) return;
    const empRef = doc(empDB, 'businesses', distributorId, 'distributorEmployees', employee.id);
    const unsub = onSnapshot(empRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        
        // Update employee state with latest data (including session info)
        setEmployee(prev => ({ ...prev, ...data }));
        
        const access = data.accessSections || {};
        
        // Define permission labels mapping
        const permissionLabels = {
          addRetailers: 'Add Retailers',
          createOrders: 'Create Orders',
          manageOrders: 'Manage Orders',
          trackOrders: 'Track Orders',
          analytics: 'Analytics',
          inventory: 'Inventory',
          dispatch: 'Dispatch',
          aiForecast: 'AI Forecast',
          manualBilling: 'Manual Billing',
          invoices: 'Invoices',
          productOwners: 'Product Owners',
          retailerRequests: 'Retailer Requests'
        };
        
        // Define consistent order for sections
        const sectionOrder = [
          'addRetailers',
          'retailerRequests',
          'createOrders',
          'manageOrders',
          'trackOrders',
          'inventory',
          'dispatch',
          'analytics',
          'aiForecast',
          'manualBilling',
          'invoices',
          'productOwners'
        ];
        
        // Map and sort sections by defined order
        const mapped = Object.entries(access)
          .filter(([_, allowed]) => allowed)
          .map(([key]) => ({ 
            key, 
            label: permissionLabels[key] || (key.charAt(0).toUpperCase() + key.slice(1))
          }))
          .sort((a, b) => {
            const indexA = sectionOrder.indexOf(a.key);
            const indexB = sectionOrder.indexOf(b.key);
            // If not found in order, put at end
            if (indexA === -1 && indexB === -1) return a.key.localeCompare(b.key);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
        setSections(mapped);

        // Check session status
        const isSessionActive = data.sessionActive === true && data.currentSessionId;
        const prevSessionActive = sessionActive;
        setSessionActive(isSessionActive);
        
        // If session just became active, close the modal
        if (isSessionActive && prevSessionActive === false) {
          setShowStartSessionModal(false);
        }
        
        // Don't auto-open modal - let user click button manually
      }
    }, (error) => {
      console.error('Error listening to employee document:', error);
    });
    return () => unsub();
  }, [employee, distributorId, sessionActive]);

  // Live activity feed (latest 20)
  useEffect(() => {
    if (!distributorId) return;
    const col = collection(empDB, 'businesses', distributorId, 'employeeActivity');
    const q = query(col, orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [distributorId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sections.length && !activeTab) setActiveTab(sections[0].key);
  }, [sections, activeTab]);

  // Open the AddRetailer modal when switching into the tab; allow closing via onClose
  useEffect(() => {
    if (activeTab === 'addRetailers') {
      setAddRetailerOpen(true);
    } else {
      setAddRetailerOpen(false);
    }
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      // Update employee presence status (use employeeId which is the document ID)
      const employeeDocId = employeeId || employee?.id || empAuth.currentUser?.uid;
      if (distributorId && employeeDocId) {
        try {
          await setDoc(
            doc(empDB, 'businesses', distributorId, 'distributorEmployees', employeeDocId),
            { online: false, lastSeen: serverTimestamp() },
            { merge: true }
          );
        } catch (e) {
          console.warn('Presence clear failed (non-fatal):', e);
        }
      }

      // Sign out from Firebase and clear all sessions
      await logoutUser('distributor-employee');
      
      // Navigate to role selection (main menu)
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear session and redirect
      clearDistributorEmployeeSession();
      navigate('/', { replace: true });
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
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  const Icon = {
    addRetailers: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    createOrders: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>
    ),
    manageOrders: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="6" rx="1" />
        <path d="M5 10v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        <path d="M9 14h6" />
      </svg>
    ),
    trackOrders: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v5l5-5-5-5z" />
        <path d="M3 8v5l5-5-5-5z" />
        <path d="M3 13v5l5-5-5-5z" />
        <path d="M3 18v5l5-5-5-5z" />
        <path d="M8 3h5l-5 5-5-5z" />
        <path d="M8 8h5l-5 5-5-5z" />
        <path d="M8 13h5l-5 5-5-5z" />
        <path d="M8 18h5l-5 5-5-5z" />
      </svg>
    ),
    analytics: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 19V5" />
        <path d="M10 19V9" />
        <path d="M16 19V3" />
        <path d="M22 19V12" />
      </svg>
    ),
    check: (cls='w-4 h-4') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
    ),
  };

  const renderActiveSection = () => {
    const Panel = ({ title, icon, children }) => (
      <div className="rounded-xl border border-white/10 bg-white/70 backdrop-blur shadow-sm p-4 dark:bg-white/5">
        <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
          {icon}
          <h3 className="font-semibold text-sm tracking-wide">{title}</h3>
        </div>
        <div className="text-sm text-slate-700/90 dark:text-slate-300">{children}</div>
      </div>
    );

    if (activeTab === 'addRetailers') {
      return (
        <div>
          <AddRetailerModal
            open={addRetailerOpen}
            onClose={() => setAddRetailerOpen(false)}
            distributorId={distributorId}
            createdBy={{ type: 'employee', id: employeeId, name: employee?.name || '', flypEmployeeId: employee?.flypEmployeeId || '' }}
            onCreated={async (payload) => {
              try {
                const logFn = httpsCallable(functions, 'logDistributorActivity');
                await logFn({
                  distributorId,
                  employeeId: employeeId,
                  type: 'addRetailer',
                  targetId: payload?.retailerId || null,
                  meta: { name: payload?.businessName || payload?.name || '' }
                });
              } catch (e) {
                console.warn('Activity log failed:', e?.message || e);
              }
            }}
            useCloudFunction={true}
            toast={(opts) => {
              if (opts.type === 'success') {
                console.log('Success:', opts.message);
              } else if (opts.type === 'error') {
                console.error('Error:', opts.message);
              }
            }}
            uiVariant="embedded"
            autofocus={false}
          />
        </div>
      );
    }

    if (activeTab === 'createOrders') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
              {Icon.createOrders('w-4 h-4')} <span>Create Orders</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Create passive orders for retailers in the network.
              </p>
            </div>
          </div>
          <PassiveOrders />
        </div>
      );
    }

    if (activeTab === 'manageOrders') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
              {Icon.manageOrders('w-4 h-4')} <span>Manage Orders</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Manage order requests and pending orders efficiently.
              </p>
            </div>
          </div>
          <OrderRequests />
        </div>
      );
    }

    if (activeTab === 'trackOrders') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
              {Icon.trackOrders('w-4 h-4')} <span>Track Orders</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Track and monitor order status and delivery in real-time.
              </p>
            </div>
          </div>
          <TrackOrders />
        </div>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
              {Icon.analytics('w-4 h-4')} <span>Analytics</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                View comprehensive business analytics and performance reports.
              </p>
            </div>
          </div>
          <DistributorAnalytics distributorId={distributorId} />
        </div>
      );
    }

    if (activeTab === 'inventory') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">📦</span> <span>Inventory</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                View and manage your inventory efficiently.
              </p>
            </div>
          </div>
          <DistributorInventory />
        </div>
      );
    }

    if (activeTab === 'dispatch') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">🚚</span> <span>Dispatch Tracker</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Track dispatches and deliveries in real-time.
              </p>
            </div>
          </div>
          <DispatchTracker />
        </div>
      );
    }

    if (activeTab === 'manualBilling') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">💰</span> <span>Manual Billing</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Create and manage manual bills and invoices.
              </p>
            </div>
          </div>
          <DistributorManualBilling />
        </div>
      );
    }

    if (activeTab === 'aiForecast') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">🧠</span> <span>AI Forecast</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                AI-powered forecasting and intelligent predictions.
              </p>
            </div>
          </div>
          <DistributorAIForecast />
        </div>
      );
    }

    if (activeTab === 'invoices') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">🧾</span> <span>Invoices</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                View and manage invoices efficiently.
              </p>
            </div>
          </div>
          <div className="rounded-xl border-2 border-dashed border-slate-500/30 bg-slate-800/30 p-12 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50 mb-4">
              <span className="text-3xl">🧾</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Invoices Feature Coming Soon</h3>
            <p className="text-sm text-slate-400">
              This feature is under development and will be available soon.
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === 'productOwners') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">🏭</span> <span>Product Owners</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Manage product owners and their connections.
              </p>
            </div>
          </div>
          <div className="rounded-xl border-2 border-dashed border-slate-500/30 bg-slate-800/30 p-12 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50 mb-4">
              <span className="text-3xl">🏭</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Product Owners Feature Coming Soon</h3>
            <p className="text-sm text-slate-400">
              This feature is under development and will be available soon.
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === 'retailerRequests') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 px-4 py-2 text-emerald-300 text-sm font-semibold mb-2">
                <span className="text-base">📨</span> <span>Retailer Requests</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Manage retailer connection requests and approvals.
              </p>
            </div>
          </div>
          <div className="rounded-xl border-2 border-dashed border-slate-500/30 bg-slate-800/30 p-12 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50 mb-4">
              <span className="text-3xl">📨</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Retailer Requests Feature Coming Soon</h3>
            <p className="text-sm text-slate-400">
              This feature is under development and will be available soon.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed border-slate-300/40 dark:border-white/10 p-6 text-center text-slate-600 dark:text-slate-300">
        No sections assigned yet. Ask your manager to grant permissions.
      </div>
    );
  };

  // Check session on initial load
  useEffect(() => {
    if (employee?.id && distributorId && sessionActive === null) {
      // Check if session is active
      const checkSession = async () => {
        try {
          const empRef = doc(empDB, 'businesses', distributorId, 'distributorEmployees', employee.id);
          const empSnap = await getDoc(empRef);
          if (empSnap.exists()) {
            const data = empSnap.data();
            const isActive = data.sessionActive === true && data.currentSessionId;
            setSessionActive(isActive);
            // Don't auto-open modal - let user click button manually
          } else {
            setSessionActive(false);
          }
        } catch (error) {
          console.error('Error checking session:', error);
          setSessionActive(false);
        }
      };
      checkSession();
    }
  }, [employee, distributorId, sessionActive]);

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-2 text-gray-700">
        <div className="animate-spin h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full"></div>
        <p>Fetching your workspace...</p>
      </div>
    );
  }

  // Don't block dashboard - show it even when session is not active
  // We'll show a Start Session card instead

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-400/30 shadow-lg shadow-emerald-500/10">
                  {employee?.profilePictureUrl ? (
                    <img
                      src={employee.profilePictureUrl}
                      alt={employee.name || 'Employee'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Replace image with icon on error
                        const parent = e.target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<svg class="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                        }
                      }}
                    />
                  ) : (
                    <FiUser className="w-6 h-6 text-emerald-300" />
                  )}
                </div>
                {sessionActive && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
                )}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-emerald-100 to-cyan-100 bg-clip-text text-transparent">
                  Welcome, {employee.name || 'Employee'}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-400 font-mono">FLYP ID: {employee.flypEmployeeId || employee.id || '-'}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 font-medium">
                    {employee.role || 'Employee'}
                  </span>
                </div>
              </div>
            </div>
          <div className="flex items-center gap-2">
              {/* Back Button - Show when in a section */}
              {activeTab && (
                <button
                  onClick={handleGoBack}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105"
                  title="Go Back"
                >
                  <FiArrowLeft className="text-slate-300 text-sm" />
                </button>
              )}
              {/* Home Button */}
              <button
                onClick={handleGoHome}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105"
                title="Home / Main Menu"
              >
                <FiHome className="text-slate-300 text-sm" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <FiCalendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs md:text-sm text-slate-300 font-mono">{now.toLocaleTimeString()}</span>
              </div>
              {sessionActive && (
                <button
                  onClick={() => setShowStartSessionModal(true)}
                  className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-400/30 text-emerald-300 rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
                >
                  <FiShield className="w-3.5 h-3.5" />
                  Restart Session
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Session Modal - can open when session is not active (to start) or active (to restart) */}
      <StartSessionModal
        open={showStartSessionModal}
        onClose={() => setShowStartSessionModal(false)}
        employeeId={employee.id}
        distributorId={distributorId}
        onSessionStarted={() => {
          // Force refresh of session status - the onSnapshot will pick up the change
          // But we can optimistically update to close modal faster
          setShowStartSessionModal(false);
          // Don't set sessionActive here - let onSnapshot handle it for accuracy
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            height: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.4);
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.6);
          }
        `}</style>
        {/* Start Session Card - Show when session is not active */}
        {sessionActive === false && (
          <section className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">Start Your Session</h2>
                    <p className="text-sm text-amber-200/80 mt-1">Please start a session to access all features</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mt-3">
                  For security purposes, you need to verify your identity by taking a selfie before accessing your assigned functions.
                </p>
              </div>
              <button
                onClick={() => setShowStartSessionModal(true)}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Start Session
              </button>
            </div>
          </section>
        )}

        {/* Quick info cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status Card */}
          <div className="group relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-5 hover:border-emerald-400/50 transition-all hover:shadow-xl hover:shadow-emerald-500/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-12 -mt-12 group-hover:bg-emerald-500/20 transition-colors"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-emerald-300 uppercase tracking-wider">Status</div>
                {employee.online ? (
                  <FiRadio className="w-5 h-5 text-emerald-400" />
                ) : (
                  <FiClock className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {employee.online && (
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                )}
                <div className={`text-2xl font-bold ${employee.online ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {employee.online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          </div>

          {/* Distributor ID Card */}
          <div className="group relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-5 hover:border-blue-400/50 transition-all hover:shadow-xl hover:shadow-blue-500/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12 group-hover:bg-blue-500/20 transition-colors"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-blue-300 uppercase tracking-wider">Distributor ID</div>
                <FiFolder className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-sm font-mono font-medium text-white break-all line-clamp-2">
                {distributorId}
              </div>
            </div>
          </div>

          {/* Last Seen Card */}
          <div className="group relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-5 hover:border-purple-400/50 transition-all hover:shadow-xl hover:shadow-purple-500/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full -mr-12 -mt-12 group-hover:bg-purple-500/20 transition-colors"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-purple-300 uppercase tracking-wider">Last Seen</div>
                <FiClock className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-purple-400">
                {formatLastSeen(employee.lastSeen)}
              </div>
            </div>
          </div>

          {/* Sections Card */}
          <div className="group relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-5 hover:border-cyan-400/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full -mr-12 -mt-12 group-hover:bg-cyan-500/20 transition-colors"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-cyan-300 uppercase tracking-wider">Sections</div>
                <FiActivity className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-400 mb-1">
                {sections.length}
              </div>
              <div className="text-xs text-slate-400 line-clamp-2">
                {sections.length > 0 ? sections.map(s => s.label).join(', ') : 'No sections assigned'}
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/2.5 backdrop-blur-md shadow-xl shadow-black/10 overflow-hidden">
          <div className="border-b border-white/10 bg-white/5">
            <div className="flex gap-1 px-4 pt-4 overflow-x-auto custom-scrollbar">
              {sections.map(s => {
                const iconMap = {
                  'addRetailers': Icon.addRetailers('w-4 h-4'),
                  'createOrders': Icon.createOrders('w-4 h-4'),
                  'manageOrders': Icon.manageOrders('w-4 h-4'),
                  'trackOrders': Icon.trackOrders('w-4 h-4'),
                  'analytics': Icon.analytics('w-4 h-4'),
                  'inventory': '📦',
                  'dispatch': '🚚',
                  'manualBilling': '💰',
                  'aiForecast': '🧠',
                  'invoices': '🧾',
                  'productOwners': '🏭',
                  'retailerRequests': '📨'
                };
                const isActive = activeTab === s.key;
                return (
              <button
                key={s.key}
                onClick={() => setActiveTab(s.key)}
                    className={`group relative inline-flex items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {typeof iconMap[s.key] === 'string' ? (
                      <span className="text-base">{iconMap[s.key]}</span>
                    ) : (
                      iconMap[s.key]
                    )}
                <span>{s.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30 rounded-t-full"></div>
                    )}
              </button>
                );
              })}
            {!sections.length && (
                <span className="text-xs text-slate-400 px-4 py-3">No Sections</span>
            )}
            </div>
          </div>
          <div className="p-6 md:p-8">
            {sessionActive === false ? (
              <div className="rounded-xl border-2 border-dashed border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-12 text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-400/30 mb-6">
                  <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Session Required</h3>
                <p className="text-sm text-slate-300 mb-6 max-w-md mx-auto">
                  Please start a session to access this section. You'll need to verify your identity with a selfie.
                </p>
                <button
                  onClick={() => setShowStartSessionModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 flex items-center gap-2 mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Start Session
                </button>
              </div>
            ) : (
              renderActiveSection()
            )}
          </div>
        </section>

      {/* Activity feed */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/2.5 backdrop-blur-md shadow-xl shadow-black/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <FiActivity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Recent Activity</h2>
            {activity.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-400/30">
                {activity.length}
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
        {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <FiActivity className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400 font-medium">No activity yet</p>
              <p className="text-xs text-slate-500 mt-1">Your recent actions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((a, idx) => {
                const activityIcons = {
                  'addRetailer': '👥',
                  'createOrder': '📦',
                  'updateOrder': '✏️',
                  'trackOrder': '📍',
                };
                const icon = activityIcons[a.type] || '📋';
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-400/30 flex items-center justify-center text-lg">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white capitalize">{a.type?.replace(/([A-Z])/g, ' $1').trim()}</span>
                          {a.meta?.name && (
                            <>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-300 truncate">{a.meta.name}</span>
                            </>
                          )}
                        </div>
                        {a.createdAt?.toDate && (
                          <div className="flex items-center gap-1 mt-1">
                            <FiClock className="w-3 h-3 text-slate-500" />
                            <span className="text-xs text-slate-500">
                              {a.createdAt.toDate().toLocaleString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    </div>
                  </motion.div>
                );
              })}
                </div>
        )}
        </div>
      </section>

        {/* Contact/Help & Logout */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/2.5 backdrop-blur-md">
          <div className="flex-1">
            <p className="text-sm text-slate-300 font-medium mb-1">Need more access?</p>
            <p className="text-xs text-slate-400">Contact your manager to update your permissions</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-medium shadow-lg shadow-rose-500/20 transition-all hover:shadow-xl hover:shadow-rose-500/30 flex items-center gap-2 whitespace-nowrap"
          >
            <FiLogOut className="w-4 h-4" />
            Logout
          </button>
        </section>
      </main>
    </div>
  );
};

export default DistributorEmployeeDashboard;
