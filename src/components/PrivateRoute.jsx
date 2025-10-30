import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute
 * - Waits for AuthContext to initialize (prevents "signed in but redirected" race).
 * - Optionally enforces a specific role via `requireRole` ("retailer" | "distributor" | "productowner").
 * - Honors a one-time post-signup role hint from sessionStorage to allow first entry before Firestore role write completes.
 */
const PrivateRoute = ({ requireRole }) => {
  const { user, role, initialized } = useAuth();

  // 0) Do not decide until Auth has resolved once
  if (!initialized) {
    return <div className="text-center mt-20 text-gray-500">Loading...</div>;
  }

  // Read a one-time post-signup role hint (set by Register.jsx) and normalize it
  const pending = (typeof window !== 'undefined' && sessionStorage.getItem('postSignupRole')) || null;
  const pendingNorm = pending ? pending.toLowerCase().replace(/\s+/g, '').replace(/_/g, '') : '';

  // Optional: legacy single-load redirect guards (prevents loops on employee redirect flows)
  const hasOneTimeRedirectGuard =
    typeof window !== 'undefined' &&
    (sessionStorage.getItem('flyp_distributor_employee_redirect') === 'true' ||
      sessionStorage.getItem('employeeRedirect') === '1');

  // Clear the pending hint once Auth role matches it
  if (pending && role) {
    const roleNorm = String(role).toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
    if (roleNorm === pendingNorm) {
      try {
        sessionStorage.removeItem('postSignupRole');
      } catch {}
    }
  }

  // 1) Not logged in -> go to login (unless a one-time redirect guard is active)
  if (!user) {
    if (hasOneTimeRedirectGuard) {
      return <div className="text-center mt-20 text-gray-500">Loading...</div>;
    }
    return <Navigate to="/auth?type=login" replace />;
  }

  // 2) If a specific role is required, enforce it against normalized tokens
  if (requireRole) {
    const roleNorm = (role || '').toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
    const requireNorm = String(requireRole).toLowerCase().replace(/\s+/g, '').replace(/_/g, '');

    if (roleNorm !== requireNorm) {
      // Allow entry once if pending signup role matches required role
      if (pendingNorm && pendingNorm === requireNorm) {
        return <Outlet />;
      }

      // Otherwise redirect user to their actual dashboard
      let redirectTo = '/dashboard';
      if (roleNorm === 'distributor') redirectTo = '/distributor-dashboard';
      else if (roleNorm === 'productowner') redirectTo = '/product-owner-dashboard';
      return <Navigate to={redirectTo} replace />;
    }
  }

  // 3) All good -> render nested routes
  return <Outlet />;
};

export default PrivateRoute;