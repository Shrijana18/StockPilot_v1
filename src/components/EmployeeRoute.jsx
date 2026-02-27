import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { empAuth } from '../firebase/firebaseConfig';
import { getEmployeeSession, isEmployeeRedirect, clearEmployeeRedirect } from '../utils/employeeSession';
import { getDistributorEmployeeSession, clearDistributorEmployeeRedirect, isDistributorEmployeeRedirect } from '../utils/distributorEmployeeSession';

// Lightweight guard for employee-only areas.
// kind: 'retailer' | 'distributor' determines the login route fallback
const EmployeeRoute = ({ kind = 'retailer' }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // CRITICAL: If we just came from login with session in state, grant access immediately.
    // This bypasses Android WebView localStorage timing issues.
    const state = location.state;
    if (state?.fromLogin && state?.session) {
      const session = state.session;
      const hasRetailerSession = kind === 'retailer' && session.retailerId && session.employeeId;
      const hasDistSession = kind === 'distributor' && session.distributorId && session.employeeId;
      if (hasRetailerSession || hasDistSession) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }
    }

    // Check for redirect guard - if present, wait a bit for auth to complete
    const hasRedirectGuard = typeof window !== 'undefined' && (
      isDistributorEmployeeRedirect() ||
      isEmployeeRedirect()
    );

    if (hasRedirectGuard) {
      // Wait for auth state with polling and listener
      let resolved = false;
      let timeoutId = null;
      let unsubscribe = null;

      const resolveAccess = (hasIt) => {
        if (resolved) return;
        resolved = true;
        
        if (timeoutId) clearTimeout(timeoutId);
        if (unsubscribe) unsubscribe();
        
        // Clear redirect guard
        if (isDistributorEmployeeRedirect()) {
          clearDistributorEmployeeRedirect();
        }
        if (isEmployeeRedirect()) {
          clearEmployeeRedirect();
        }
        
        setHasAccess(hasIt);
        setIsChecking(false);
      };

      // Set up auth state listener
      unsubscribe = empAuth.onAuthStateChanged((user) => {
        if (resolved) return;
        
        const employeeAuthed = Boolean(user);
        const retailerEmpSession = getEmployeeSession();
        const distEmpSession = getDistributorEmployeeSession();
        // Check session access based on kind - more specific check
        const hasCorrectSession = (kind === 'retailer' && retailerEmpSession) || (kind === 'distributor' && distEmpSession);
        // In Android, session is sufficient. In web, prefer auth but allow session.
        const access = hasCorrectSession || employeeAuthed;
        
        if (access) {
          resolveAccess(true);
        }
      });

      // Also poll as backup (for slow networks)
      const checkAuth = () => {
        if (resolved) return;
        
        const employeeAuthed = Boolean(empAuth?.currentUser);
        const retailerEmpSession = getEmployeeSession();
        const distEmpSession = getDistributorEmployeeSession();
        // Check session access based on kind - more specific check
        const hasCorrectSession = (kind === 'retailer' && retailerEmpSession) || (kind === 'distributor' && distEmpSession);
        // In Android, session is sufficient. In web, prefer auth but allow session.
        const access = hasCorrectSession || employeeAuthed;
        
        // Debug logging (can be removed in production)
        if (!access && hasRedirectGuard) {
          console.log('[EmployeeRoute] Checking auth:', {
            employeeAuthed,
            hasRetailerSession: !!retailerEmpSession,
            hasDistSession: !!distEmpSession,
            hasCorrectSession,
            currentUser: empAuth?.currentUser?.uid || 'none',
            kind
          });
        }
        
        if (access) {
          resolveAccess(true);
        }
      };
      
      // Check immediately and periodically (more frequent for mobile)
      checkAuth();
      const interval = setInterval(checkAuth, 100); // Check every 100ms for faster response
      
      // Timeout after 10 seconds (longer for mobile/slow networks after page reload)
      timeoutId = setTimeout(() => {
        if (!resolved) {
          checkAuth(); // Final check
          console.warn('[EmployeeRoute] Auth check timeout after 10 seconds');
          // Don't immediately deny - check one more time with session (check both types)
          const finalRetailerSession = getEmployeeSession();
          const finalDistSession = getDistributorEmployeeSession();
          const finalSession = (kind === 'retailer' && finalRetailerSession) || (kind === 'distributor' && finalDistSession);
          if (finalSession) {
            console.log('[EmployeeRoute] Found session on timeout, allowing access');
            resolveAccess(true);
          } else {
            console.warn('[EmployeeRoute] No session found on timeout, denying access');
            resolveAccess(false);
          }
        }
      }, 10000);

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (interval) clearInterval(interval);
        if (unsubscribe) unsubscribe();
      };
    } else {
      // No redirect guard - but still check for session (user might have navigated directly or session wasn't cleared)
      // On Capacitor, give more time to allow localStorage to be readable after navigate
      // This handles cases where navigate() happens before localStorage is fully committed
      const isCapacitor = typeof window !== 'undefined' && window.Capacitor;
      const initialDelay = isCapacitor ? 300 : 0; // Longer delay on Capacitor for localStorage
      
      const checkAccess = () => {
        const retailerEmpSession = getEmployeeSession();
        const distEmpSession = getDistributorEmployeeSession();
        const employeeAuthed = Boolean(empAuth?.currentUser);
        
        // Check session access based on kind
        const hasSessionAccess = (kind === 'retailer' && retailerEmpSession) || (kind === 'distributor' && distEmpSession);
        
        // Allow access if session exists OR auth exists
        // Session is sufficient - dashboard will restore auth if needed
        // For Android apps using React Router navigate (no page reload), session should be immediately available
        // In Android, prioritize session over auth (auth might not be immediately available)
        const hasAccess = hasSessionAccess || employeeAuthed;
      
        // If no access immediately, wait a bit for session to be available (Android/Capacitor apps)
        // This handles cases where localStorage might not be immediately available after navigate
        if (!hasAccess) {
          // On Capacitor, be more lenient - check multiple times with increasing delays
          // This handles WebView localStorage timing quirks
          let retryCount = 0;
          const maxRetries = isCapacitor ? 5 : 2;
          
          const checkAgain = () => {
            retryCount++;
            const retryRetailerSession = getEmployeeSession();
            const retryDistSession = getDistributorEmployeeSession();
            const retryAuth = Boolean(empAuth?.currentUser);
            const retrySessionAccess = (kind === 'retailer' && retryRetailerSession) || (kind === 'distributor' && retryDistSession);
            // In Android, session is sufficient. In web, prefer both but allow session only.
            const retryAccess = retrySessionAccess || retryAuth;
            
            if (retryAccess) {
              console.log('[EmployeeRoute] Access granted on retry:', {
                hasSession: retrySessionAccess,
                hasAuth: retryAuth,
                kind,
                isCapacitor,
                retryCount
              });
              setHasAccess(true);
              setIsChecking(false);
            } else if (retryCount < maxRetries) {
              // Try again with exponential backoff
              const delay = isCapacitor ? (100 * retryCount) : 200;
              setTimeout(checkAgain, delay);
            } else {
              console.log('[EmployeeRoute] Access denied after all retries:', {
                hasRetailerSession: !!retryRetailerSession,
                hasDistSession: !!retryDistSession,
                hasAuth: retryAuth,
                currentUser: empAuth?.currentUser?.uid || 'none',
                kind,
                isCapacitor,
                retryCount
              });
              setHasAccess(false);
              setIsChecking(false);
            }
          };
          
          // Start first retry after short delay
          const retryDelay = isCapacitor ? 100 : 200;
          setTimeout(checkAgain, retryDelay);
          return; // Don't set state yet, wait for retry
        }
        
        // Log for debugging
        console.log('[EmployeeRoute] Access granted:', {
          hasSession: hasSessionAccess,
          hasAuth: employeeAuthed,
          kind
        });
        
        setHasAccess(hasAccess);
        setIsChecking(false);
      };
      
      // Run check after initial delay (if any)
      if (initialDelay > 0) {
        setTimeout(checkAccess, initialDelay);
      } else {
        checkAccess();
      }
    }
  }, [location, kind]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    // Always redirect to role selection if no access
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default EmployeeRoute;


