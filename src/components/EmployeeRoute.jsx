import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { empAuth } from '../firebase/firebaseConfig';
import { getEmployeeSession } from '../utils/employeeSession';
import { getDistributorEmployeeSession } from '../utils/distributorEmployeeSession';

// Lightweight guard for employee-only areas.
// kind: 'retailer' | 'distributor' determines the login route fallback
const EmployeeRoute = ({ kind = 'retailer' }) => {
  const hasRedirectGuard = typeof window !== 'undefined' && (
    sessionStorage.getItem('flyp_distributor_employee_redirect') === 'true' ||
    sessionStorage.getItem('employeeRedirect') === '1'
  );

  if (hasRedirectGuard) {
    return <div className="text-center mt-20 text-gray-500">Loading...</div>;
  }

  // Prefer explicit employee auth if present; otherwise allow trusted session for PIN flows
  const employeeAuthed = Boolean(empAuth?.currentUser);
  const retailerEmpSession = getEmployeeSession();
  const distEmpSession = getDistributorEmployeeSession();

  const hasAccess = employeeAuthed || retailerEmpSession || distEmpSession;
  if (!hasAccess) {
    const fallback = kind === 'distributor' ? '/distributor-employee-login' : '/employee-login';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};

export default EmployeeRoute;


