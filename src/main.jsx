// Enable App Check debug token in development
if (import.meta.env.DEV) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './firebase/firebaseConfig';
import 'firebaseui/dist/firebaseui.css';

// Initialize i18n
import './i18n/config';

import { AuthProvider } from './context/AuthContext';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

// Use HashRouter on native (iOS/Android) - BrowserRouter causes blank screens after navigate
// because WebViews handle History API unreliably
const Router = Capacitor?.isNativePlatform?.() ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Global routing handled here */}
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>
);