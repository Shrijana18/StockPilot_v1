/**
 * Customer App Entry Point
 * Standalone entry for FLYP Shop - Customer facing marketplace app
 * Enhanced with error handling to prevent Play Console rejection
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import CustomerApp from './customer/CustomerApp';
import './index.css';
import './customer/customer.css';

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
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent default error handling for network/Firebase errors
  // These shouldn't crash the app
  if (event.reason?.code === 'permission-denied' || 
      event.reason?.code === 'unavailable' ||
      event.reason?.message?.includes('network') ||
      event.reason?.message?.includes('Failed to fetch')) {
    console.warn('Network/Firebase error handled gracefully');
    event.preventDefault();
    return false;
  }
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
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: linear-gradient(to bottom, #0a0f1c, #0f172a); color: white; text-align: center;">
        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 20px; display: flex; align-items: center; justify-center; margin-bottom: 24px; font-size: 36px; font-weight: 700;">F</div>
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">FLYP Shop</h1>
        <p style="color: rgba(255,255,255,0.6); margin-bottom: 24px;">Unable to load the app</p>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #10B981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Reload App</button>
      </div>
    `;
  }
};

// Render app with error handling
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    renderFallback();
  } else {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <CustomerApp />
      </React.StrictMode>
    );
    
    // Hide splash after a short delay to ensure app is rendered
    setTimeout(hideSplash, 500);
  }
} catch (error) {
  console.error('Failed to render app:', error);
  renderFallback();
  hideSplash();
}

// Register service worker for PWA (non-blocking)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, but app continues to work
    });
  });
}
