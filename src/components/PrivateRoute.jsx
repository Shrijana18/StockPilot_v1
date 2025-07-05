import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-20 text-gray-500">Loading...</div>;
  }

  return user ? children : <Navigate to="/auth" replace />;
};

export default PrivateRoute;