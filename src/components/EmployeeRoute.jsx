import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { empAuth } from '../firebase/firebaseConfig';
import { getEmployeeSession } from '../utils/employeeSession';
import { getDistributorEmployeeSession, clearDistributorEmployeeRedirect } from '../utils/distributorEmployeeSession';

// Lightweight guard for employee-only areas.
// kind: 'retailer' | 'distributor' determines the login route fallback
const EmployeeRoute = ({ kind = 'retailer' }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Check for redirect guard - if present, wait a bit for auth to complete
    const hasRedirectGuard = typeof window !== 'undefined' && (
      sessionStorage.getItem('flyp_distributor_employee_redirect') === 'true' ||
      sessionStorage.getItem('employeeRedirect') === '1'
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
        if (sessionStorage.getItem('flyp_distributor_employee_redirect') === 'true') {
          clearDistributorEmployeeRedirect();
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
        const access = employeeAuthed || retailerEmpSession || distEmpSession;
        
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
        const access = employeeAuthed || retailerEmpSession || distEmpSession;
        
        // Debug logging (can be removed in production)
        if (!access && hasRedirectGuard) {
          console.log('[EmployeeRoute] Checking auth:', {
            employeeAuthed,
            hasRetailerSession: !!retailerEmpSession,
            hasDistSession: !!distEmpSession,
            currentUser: empAuth?.currentUser?.uid || 'none'
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
          // Don't immediately deny - check one more time with session
          const finalSession = getDistributorEmployeeSession();
          if (finalSession) {
            console.log('[EmployeeRoute] Found session on timeout, allowing access');
            resolveAccess(true);
          } else {
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
      // No redirect guard, check immediately
      const employeeAuthed = Boolean(empAuth?.currentUser);
      const retailerEmpSession = getEmployeeSession();
      const distEmpSession = getDistributorEmployeeSession();
      setHasAccess(employeeAuthed || retailerEmpSession || distEmpSession);
      setIsChecking(false);
    }
  }, []);

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
    const fallback = kind === 'distributor' ? '/distributor-employee-login' : '/employee-login';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default EmployeeRoute;


