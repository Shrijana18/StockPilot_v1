import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage.jsx';
import RetailerDashboard from './views/RetailerDashboard.jsx';
import DistributorDashboard from './components/DistributorDashboard.jsx';
import ProductOwnerDashboard from './components/ProductOwnerDashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Billing from './pages/Billing.jsx';
import AllInvoices from './pages/AllInvoices.jsx';
import AuthPage from './pages/AuthPage.jsx';

import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute.jsx';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthContext } from './context/AuthContext';

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/*" element={<AuthPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <RetailerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/distributor-dashboard"
          element={
            <PrivateRoute>
              <DistributorDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/product-owner-dashboard"
          element={
            <PrivateRoute>
              <ProductOwnerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <PrivateRoute>
              <Inventory />
            </PrivateRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <PrivateRoute>
              <Billing />
            </PrivateRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            <PrivateRoute>
              <AllInvoices />
            </PrivateRoute>
          }
        />

        {/* Future routes can be conditionally rendered based on role */}
        <Route path="*" element={<Navigate to="/auth?type=login" replace />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
};

export default App;