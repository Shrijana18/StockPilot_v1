import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guard that waits for Firebase auth to resolve and (optionally) enforces a role
const PrivateRoute = ({ requireRole }) => {
  const { user, role, authLoading } = useAuth();

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
    // Send to a safe default dashboard if role doesn't match
    return <Navigate to="/dashboard" replace />;
  }

  // 4) All good -> render nested routes
  return <Outlet />;
};

export default PrivateRoute;