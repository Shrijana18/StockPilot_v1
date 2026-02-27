import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { getEmployeeSession, isEmployeePath } from './utils/employeeSession.js';
import { getDistributorEmployeeSession, isDistributorEmployeePath } from './utils/distributorEmployeeSession.js';

import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute.jsx';
import EmployeeRoute from './components/EmployeeRoute.jsx';
import LoadingScreen from './components/common/LoadingScreen.jsx';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthContext } from './context/AuthContext';

import AppShell from './app/shells/AppShell.jsx';
import WebShell from './app/shells/WebShell.jsx';
import { usePlatform } from './hooks/usePlatform.js';

import { App as CapacitorApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const AppLanding = lazy(() => import('./pages/AppLanding.jsx'));
const RetailerDashboard = lazy(() => import('./views/RetailerDashboard.jsx'));
const DistributorDashboard = lazy(() => import('./components/DistributorDashboard.jsx'));
const MobileDistributorDashboard = lazy(() => import('./app/views/MobileDistributorDashboard.jsx'));
const MobileRetailerDashboard = lazy(() => import('./app/views/MobileRetailerDashboard.jsx'));
const ProductOwnerDashboard = lazy(() => import('./components/ProductOwnerDashboard.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const Billing = lazy(() => import('./pages/Billing.jsx'));
const AllInvoices = lazy(() => import('./pages/AllInvoices.jsx'));
const LeadManagement = lazy(() => import('./pages/LeadManagement.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const PublicInvoiceView = lazy(() => import('./pages/PublicInvoiceView.jsx'));
const EmployeeLogin = lazy(() => import('./components/employee/EmployeeLogin.jsx'));
const EmployeeDashboard = lazy(() => import('./components/employee/EmployeeDashboard.jsx'));
const DistributorEmployeeLogin = lazy(() => import('./pages/DistributorEmployeeLogin.jsx'));
const DistributorEmployeeDashboard = lazy(() => import('./components/distributor/employees/DistributorEmployeeDashboard.jsx'));
const WhatsAppConnectSuccess = lazy(() => import('./pages/WhatsAppConnectSuccess.jsx'));
const WhatsAppConnectError = lazy(() => import('./pages/WhatsAppConnectError.jsx'));

// Customer Marketplace App
const CustomerApp = lazy(() => import('./customer/CustomerApp.jsx'));

const PageFallback = () => <LoadingScreen />;

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
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Customer Marketplace App - Separate app for end customers */}
              <Route path="/shop/*" element={<CustomerApp />} />
              
              {/* Public Routes */}
              <Route path="/" element={<AppLanding />} />
              <Route path="/auth/*" element={<AuthPage />} />
              <Route path="/login" element={<Navigate to="/auth?type=login" replace />} />
              <Route path="/register" element={<Navigate to="/auth?type=register" replace />} />
              <Route path="/invoice/:distributorId/:invoiceId" element={<PublicInvoiceView />} />
              <Route path="/whatsapp/connect/success" element={<WhatsAppConnectSuccess />} />
              <Route path="/whatsapp/connect/error" element={<WhatsAppConnectError />} />
              <Route path="/leads" element={<LeadManagement />} />
              <Route path="/employee-login" element={<EmployeeLogin />} />
              <Route element={<EmployeeRoute kind="retailer" />}>
                <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
              </Route>
              <Route path="/distributor-employee-login" element={<DistributorEmployeeLogin />} />
              <Route element={<EmployeeRoute kind="distributor" />}>
                <Route path="/distributor-employee-dashboard" element={<DistributorEmployeeDashboard />} />
              </Route>

              {/* Protected Routes */}
              {/* Retailer - Use Mobile Dashboard for Native App */}
              <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<MobileRetailerDashboard />} />
              </Route>
              {/* Distributor - Use Mobile Dashboard for Native App */}
              <Route element={<PrivateRoute requireRole="distributor" />}>
                <Route path="/distributor-dashboard" element={<MobileDistributorDashboard />} />
              </Route>
              {/* Product Owner */}
              <Route element={<PrivateRoute requireRole="productowner" />}>
                <Route path="/product-owner-dashboard" element={<ProductOwnerDashboard />} />
              </Route>
              <Route element={<PrivateRoute />}>
                <Route path="/inventory" element={<Inventory />} />
              </Route>
              <Route element={<PrivateRoute />}>
                <Route path="/billing" element={<Billing />} />
              </Route>
              <Route element={<PrivateRoute />}>
                <Route path="/invoices" element={<AllInvoices />} />
              </Route>

              {/* Future routes can be conditionally rendered based on role */}
              <Route path="*" element={<Navigate to="/auth?type=login" replace />} />
            </Routes>
          </Suspense>
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
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Customer Marketplace App - Separate app for end customers */}
              <Route path="/shop/*" element={<CustomerApp />} />
              
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/*" element={<AuthPage />} />
              <Route path="/login" element={<Navigate to="/auth?type=login" replace />} />
              <Route path="/register" element={<Navigate to="/auth?type=register" replace />} />
              <Route path="/invoice/:distributorId/:invoiceId" element={<PublicInvoiceView />} />
              <Route path="/whatsapp/connect/success" element={<WhatsAppConnectSuccess />} />
              <Route path="/whatsapp/connect/error" element={<WhatsAppConnectError />} />
              <Route path="/leads" element={<LeadManagement />} />
              <Route path="/employee-login" element={<EmployeeLogin />} />
              <Route element={<EmployeeRoute kind="retailer" />}>
                <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
              </Route>
              <Route path="/distributor-employee-login" element={<DistributorEmployeeLogin />} />
              <Route element={<EmployeeRoute kind="distributor" />}>
                <Route path="/distributor-employee-dashboard" element={<DistributorEmployeeDashboard />} />
              </Route>

              {/* Protected Routes */}
              {/* Retailer (no explicit role required) */}
              <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<RetailerDashboard />} />
              </Route>
              {/* Distributor */}
              <Route element={<PrivateRoute requireRole="distributor" />}>
                <Route path="/distributor-dashboard" element={<DistributorDashboard />} />
              </Route>
              {/* Product Owner */}
              <Route element={<PrivateRoute requireRole="productowner" />}>
                <Route path="/product-owner-dashboard" element={<ProductOwnerDashboard />} />
              </Route>
              <Route element={<PrivateRoute />}>
                <Route path="/inventory" element={<Inventory />} />
              </Route>
              <Route element={<PrivateRoute />}>
                <Route path="/billing" element={<Billing />} />
              </Route>
              <Route element={<PrivateRoute />}>
                <Route path="/invoices" element={<AllInvoices />} />
              </Route>

              {/* Future routes can be conditionally rendered based on role */}
              <Route path="*" element={<Navigate to="/auth?type=login" replace />} />
            </Routes>
          </Suspense>
        </WebShell>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
};

export default App;