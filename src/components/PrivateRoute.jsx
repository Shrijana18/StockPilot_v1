import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guard that waits for Firebase auth to resolve and (optionally) enforces a role
const PrivateRoute = ({ requireRole }) => {
  const { user, role, authLoading } = useAuth();

  // Read a one-time post-signup role hint (set by Register.jsx) and normalize it
  const pending = (typeof window !== 'undefined' && sessionStorage.getItem('postSignupRole')) || null;
  const pendingNorm = (pending || '').toLowerCase().replace(/\s+/g, '');

  // If AuthContext has now loaded a role that matches the hint, clear the hint
  if (pending && role) {
    const roleNorm = (role || '').toLowerCase().replace(/\s+/g, '');
    if (roleNorm === pendingNorm) {
      try { sessionStorage.removeItem('postSignupRole'); } catch (_) {}
    }
  }

  // 1) Wait for Firebase to finish restoring the session
  if (authLoading) {
    return <div className="text-center mt-20 text-gray-500">Loading...</div>;
  }

  // 2) Not logged in -> go to login
  if (!user) {
    return <Navigate to="/auth?type=login" replace />;
  }

  // 3) If a specific role is required, enforce it against normalized role tokens
  //    (role is normalized in AuthContext to retailer | distributor | productowner)
  if (requireRole && role !== requireRole) {
    console.log("[PrivateRoute] Role check - requireRole:", requireRole, "user role:", role);
    console.log("[PrivateRoute] Pending role:", pendingNorm);
    
    // If we just signed up and the pending role matches the required role, allow access once
    if (pendingNorm && pendingNorm === requireRole) {
      console.log("[PrivateRoute] Allowing access based on pending role");
      return <Outlet />;
    }

    // Otherwise redirect the user to their actual role dashboard
    const normalizedRole = (role || "").toLowerCase().replace(/\s+/g, "");
    let redirectTo = "/dashboard";
    if (normalizedRole === "distributor") redirectTo = "/distributor-dashboard";
    else if (normalizedRole === "productowner") redirectTo = "/product-owner-dashboard";
    console.log("[PrivateRoute] Redirecting to:", redirectTo, "based on role:", normalizedRole);
    return <Navigate to={redirectTo} replace />;
  }

  // 4) All good -> render nested routes
  return <Outlet />;
};

export default PrivateRoute;