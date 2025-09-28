import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage.jsx';
import AppLanding from './pages/AppLanding.jsx';
import RetailerDashboard from './views/RetailerDashboard.jsx';
import DistributorDashboard from './components/DistributorDashboard.jsx';
import ProductOwnerDashboard from './components/ProductOwnerDashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Billing from './pages/Billing.jsx';
import AllInvoices from './pages/AllInvoices.jsx';
import AuthPage from './pages/AuthPage.jsx';
import EmployeeLogin from './components/employee/EmployeeLogin.jsx';

import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute.jsx';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthContext } from './context/AuthContext';

import AppShell from './app/shells/AppShell.jsx';
import WebShell from './app/shells/WebShell.jsx';
import { usePlatform } from './hooks/usePlatform.js';

import { App as CapacitorApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';

const App = () => {
  const { isNativeApp } = usePlatform();

  useEffect(() => {
    if (!isNativeApp) return;

    let exitConfirmed = false;

    const handler = async () => {
      if (!exitConfirmed) {
        exitConfirmed = true;
        await Toast.show({ text: 'Press back again to exit' });
        setTimeout(() => {
          exitConfirmed = false;
        }, 2000);
      } else {
        CapacitorApp.exitApp();
      }
    };

    CapacitorApp.addListener('backButton', handler);

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [isNativeApp]);

  return (
    <AuthProvider>
      {isNativeApp ? (
        <AppShell
          headerContent={
            <div className="flex items-center w-full">
              <span className="text-base font-semibold tracking-tight">Supply Chain OS</span>
              <span className="ml-2 text-white/60 text-sm">(App)</span>
            </div>
          }
          showFab
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<AppLanding />} />
            <Route path="/auth/*" element={<AuthPage />} />
            <Route path="/login" element={<Navigate to="/auth?type=login" replace />} />
            <Route path="/register" element={<Navigate to="/auth?type=register" replace />} />
            <Route path="/employee-login" element={<EmployeeLogin />} />

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
        </AppShell>
      ) : (
        <WebShell
          headerContent={
            <div className="flex items-center w-full">
              <span className="text-xl font-semibold tracking-tight">StockPilot</span>
              <span className="ml-3 text-white/60">Dashboard</span>
            </div>
          }
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/*" element={<AuthPage />} />
            <Route path="/login" element={<Navigate to="/auth?type=login" replace />} />
            <Route path="/register" element={<Navigate to="/auth?type=register" replace />} />
            <Route path="/employee-login" element={<EmployeeLogin />} />

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
        </WebShell>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
};

export default App;