/**
 * Employee App Entry Point
 * Standalone entry for FLYP Employee - Delivery partner app
 * Enhanced with error handling to prevent Play Console rejection
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import EmployeeApp from './app/EmployeeApp';
import './index.css';

// Global error handler to prevent "Page not available" errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // Prevent default error handling that could cause blank page
  // Only prevent if it's a script loading error that we can handle
  if (event.filename && event.filename.includes('assets/')) {
    console.warn('Asset loading error, app will continue with fallback');
  }
  // Don't prevent all errors - let React ErrorBoundary handle component errors
  return false;
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[EmployeeApp] Unhandled promise rejection:', event.reason);
  console.error('[EmployeeApp] Rejection details:', {
    code: event.reason?.code,
    message: event.reason?.message,
    name: event.reason?.name,
    stack: event.reason?.stack
  });
  // Prevent default error handling for network/Firebase errors
  // These shouldn't crash the app
  if (event.reason?.code === 'permission-denied' || 
      event.reason?.code === 'unavailable' ||
      event.reason?.code === 'unauthenticated' ||
      event.reason?.message?.includes('network') ||
      event.reason?.message?.includes('Failed to fetch') ||
      event.reason?.message?.includes('Firebase') ||
      event.reason?.message?.includes('Firestore')) {
    console.warn('[EmployeeApp] Network/Firebase error handled gracefully, preventing crash');
    event.preventDefault();
    return false;
  }
  // For other errors, still prevent default to avoid blank page
  event.preventDefault();
  return false;
});

// Remove splash screen when app is ready
const hideSplash = () => {
  const splash = document.getElementById('splash');
  if (splash) {
    document.body.classList.add('app-loaded');
    setTimeout(() => {
      splash.remove();
    }, 300);
  }
};

// Fallback UI if app fails to load
const renderFallback = () => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(to bottom, #0f172a, #1e293b);
        color: white;
        padding: 20px;
        text-align: center;
      ">
        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          font-size: 36px;
          font-weight: 700;
        ">E</div>
        <h1 style="font-size: 24px; margin-bottom: 8px;">FLYP Employee</h1>
        <p style="color: rgba(255,255,255,0.6); margin-bottom: 24px;">
          Unable to load app. Please check your connection and try again.
        </p>
        <button 
          onclick="window.location.reload()" 
          style="
            padding: 12px 24px;
            background: #10B981;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          "
        >
          Retry
        </button>
      </div>
    `;
  }
};

// Initialize app
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    renderFallback();
  } else {
    const root = ReactDOM.createRoot(rootElement);
    
    root.render(
      <React.StrictMode>
        <HashRouter>
          <EmployeeApp />
          <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
        </HashRouter>
      </React.StrictMode>
    );

    // Hide splash screen after app renders
    setTimeout(hideSplash, 800);
  }
} catch (error) {
  console.error('Failed to initialize app:', error);
  renderFallback();
  hideSplash();
}
