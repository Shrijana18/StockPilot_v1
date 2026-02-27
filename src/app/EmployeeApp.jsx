/**
 * EmployeeApp - Main Employee App for Delivery Partners
 * Standalone app for retailer employees (delivery partners)
 */

import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import EmployeeRoute from '../components/EmployeeRoute';

// Lazy load components
const RoleSelection = lazy(() => import('../components/employee/RoleSelection'));
const EmployeeLogin = lazy(() => import('../components/employee/EmployeeLogin'));
const EmployeeDashboard = lazy(() => import('../components/employee/EmployeeDashboard'));
const DistributorEmployeeLogin = lazy(() => import('../pages/DistributorEmployeeLogin'));
const DistributorEmployeeDashboard = lazy(() => import('../components/distributor/employees/DistributorEmployeeDashboard'));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
      <p className="text-gray-300">Loading...</p>
    </div>
  </div>
);

const EmployeeApp = () => {
  // Do NOT clear sessions here. RoleSelection handles: if valid session exists,
  // redirect to dashboard; otherwise show role picker. Session is only cleared
  // on explicit logout (in dashboard) or when user picks a role (other role cleared).
  // Clearing on / mount was causing the bug: after login redirect to / would
  // clear session and send user back to role selection.

  // Handle back button on native
  useEffect(() => {
    const checkNative = async () => {
      try {
        const platform = await CapacitorApp.getInfo();
        if (platform.platform !== 'web') {
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
        }
      } catch (error) {
        // Not a native app, ignore
      }
    };

    checkNative();
  }, []);

  const isNative = Capacitor?.isNativePlatform?.() === true;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<RoleSelection />} />
        <Route path="/employee-login" element={<EmployeeLogin />} />
        {/* On native: render dashboard without route guard so it always mounts and reads pending session */}
        {isNative ? (
          <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
        ) : (
          <Route element={<EmployeeRoute kind="retailer" />}>
            <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
          </Route>
        )}

        <Route path="/distributor-employee-login" element={<DistributorEmployeeLogin />} />
        <Route element={<EmployeeRoute kind="distributor" />}>
          <Route path="/distributor-employee-dashboard" element={<DistributorEmployeeDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default EmployeeApp;
