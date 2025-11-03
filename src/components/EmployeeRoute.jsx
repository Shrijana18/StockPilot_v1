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
      // Give auth time to complete (custom token sign-in is async)
      const checkAuth = () => {
        const employeeAuthed = Boolean(empAuth?.currentUser);
        const retailerEmpSession = getEmployeeSession();
        const distEmpSession = getDistributorEmployeeSession();
        const access = employeeAuthed || retailerEmpSession || distEmpSession;
        
        if (access) {
          // Clear redirect guard once we confirm access
          if (sessionStorage.getItem('flyp_distributor_employee_redirect') === 'true') {
            clearDistributorEmployeeRedirect();
          }
          setHasAccess(true);
          setIsChecking(false);
        } else {
          // Keep checking for up to 2 seconds
          setTimeout(() => {
            setHasAccess(access);
            setIsChecking(false);
            if (sessionStorage.getItem('flyp_distributor_employee_redirect') === 'true') {
              clearDistributorEmployeeRedirect();
            }
          }, 2000);
        }
      };
      
      // Check immediately and then again after a short delay
      checkAuth();
      const timeout = setTimeout(checkAuth, 500);
      return () => clearTimeout(timeout);
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


