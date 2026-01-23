/**
 * Customer App Entry Point
 * Standalone entry for FLYP Shop - Customer facing marketplace app
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import CustomerApp from './customer/CustomerApp';
import './index.css';
import './customer/customer.css';

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

// Render app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <CustomerApp />
  </React.StrictMode>
);

// Hide splash after a short delay to ensure app is rendered
setTimeout(hideSplash, 500);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, but app continues to work
    });
  });
}
