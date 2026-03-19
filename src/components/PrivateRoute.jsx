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

  const FLYPSpinner = () => (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(160deg, #071a2b 0%, #0b2944 50%, #071a2b 100%)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
          <span className="text-lg font-black text-white">F</span>
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse"
              style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  // 0) Do not decide until Auth has resolved once
  if (!initialized) {
    return <FLYPSpinner />;
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
      return <FLYPSpinner />;
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

      // Role still loading (null) - wait instead of redirecting to wrong dashboard
      // Prevents distributor/product-owner landing on retailer dashboard on first login
      if (!roleNorm && user) {
        return <FLYPSpinner />;
      }

      // Otherwise redirect user to their actual dashboard
      let redirectTo = '/dashboard';
      if (roleNorm === 'distributor') redirectTo = '/distributor-dashboard';
      else if (roleNorm === 'productowner') redirectTo = '/product-owner-dashboard';
      else if (roleNorm === 'restaurant') redirectTo = '/dashboard?mode=pos';
      return <Navigate to={redirectTo} replace />;
    }
  }

  // 3) All good -> render nested routes
  return <Outlet />;
};

export default PrivateRoute;