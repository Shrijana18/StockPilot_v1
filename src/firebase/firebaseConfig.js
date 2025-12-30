import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, inMemoryPersistence, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { Capacitor } from '@capacitor/core';

// Detect Capacitor native (iOS/Android) WebView vs Web browser
const IS_NATIVE = Capacitor?.isNativePlatform?.() === true;

// Detect production environment
const IS_PRODUCTION = import.meta?.env?.MODE === 'production' || 
                     import.meta?.env?.NODE_ENV === 'production' ||
                     window.location.hostname !== 'localhost';

// On native, enable App Check debug token and avoid loading Google web scripts that can be blocked by WKWebView/CORS
if (IS_NATIVE && typeof self !== 'undefined' && import.meta?.env?.MODE !== 'production') {
  // Enable App Check debug only in non-production native builds
  // This prevents reCAPTCHA v3 from trying to load gapi in the iOS WebView and lets us run without App Check in dev
  // (Make sure you do NOT ship with this set for production builds)
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const firebaseConfig = {
  apiKey: "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE",
  authDomain: "stockpilotv1.firebaseapp.com",
  databaseURL: "https://stockpilotv1-default-rtdb.firebaseio.com",
  projectId: "stockpilotv1",
  storageBucket: "stockpilotv1.firebasestorage.app",
  messagingSenderId: "30934537475",
  appId: "1:30934537475:web:84a2f76609dbb1db290536",
  measurementId: "G-SENFJ2HSBW"
};

// On native WebView, drop authDomain to prevent Firebase Auth from loading gapi
const configForPlatform = IS_NATIVE
  ? (() => {
      const { authDomain, ...rest } = firebaseConfig;
      return rest;
    })()
  : firebaseConfig;

// --- Default Firebase App (for Retailer/Distributor) ---
export const app = getApps().length ? getApp() : initializeApp(configForPlatform);
export const auth = getAuth(app);
if (IS_NATIVE) {
  // Prevent Firebase Auth from attempting gapi-based popup/redirect flows in WKWebView
  try { auth._popupRedirectResolver = null; } catch (_) {}
  try { auth._errorFactory = { create: () => ({ message: "suppressed" }) }; } catch (_) {}
}
(async () => {
  try {
    if (IS_NATIVE) {
      await setPersistence(auth, inMemoryPersistence);
      console.info('[Firebase] Using in-memory persistence on native WebView');
    } else {
      // Explicit web persistence with safe fallbacks
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
        console.info('[Firebase] Using IndexedDB persistence (web)');
      } catch {
        try {
          await setPersistence(auth, browserLocalPersistence);
          console.info('[Firebase] Using localStorage persistence (web)');
        } catch {
          await setPersistence(auth, browserSessionPersistence);
          console.info('[Firebase] Using sessionStorage persistence (web)');
        }
      }
    }
  } catch (e) {
    console.warn('[Firebase] Failed to set persistence:', e?.message || e);
  }
})();

// Add production-specific error handling
if (IS_PRODUCTION) {
  console.info('[Firebase] Production environment detected');
  
  // Add global error handler for production
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Firebase] Unhandled promise rejection:', event.reason);
  });
  
  // Add Firebase auth state change error handling
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('[Firebase] Production auth state: User signed in');
    } else {
      console.log('[Firebase] Production auth state: User signed out');
    }
  }, (error) => {
    console.error('[Firebase] Production auth state error:', error);
  });
}
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

// --- Secondary Firebase App (for Employee Session, isolated) ---
let empApp;
const existingEmpApp = getApps().find(a => a.name === "employeeApp");
if (existingEmpApp) {
  empApp = existingEmpApp;
} else {
  empApp = initializeApp(firebaseConfig, "employeeApp");
}

export const empDB = initializeFirestore(empApp, { experimentalForceLongPolling: true });
export const empAuth = getAuth(empApp);
export const empFunctions = getFunctions(empApp, "us-central1");
if (IS_NATIVE) {
  try { empAuth._popupRedirectResolver = null; } catch (_) {}
}

// Disable persistence to avoid interference with Retailer login
setPersistence(empAuth, inMemoryPersistence)
  .then(() => console.info("[Employee Firebase] In-memory auth persistence enabled"))
  .catch(err => console.warn("[Employee Firebase] Persistence setup failed:", err));

// Only run web reCAPTCHA App Check on browser; skip on Capacitor native to avoid gapi/CORS issues
if (!IS_NATIVE && typeof window !== 'undefined' && import.meta?.env?.VITE_ENABLE_APPCHECK === 'true') {
  (async () => {
    try {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      const siteKey = import.meta?.env?.VITE_RECAPTCHA_V3_SITE_KEY;
      if (!siteKey) {
        console.warn('[AppCheck] VITE_RECAPTCHA_V3_SITE_KEY missing; skipping App Check init.');
        return;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      console.info('[AppCheck] Initialized with reCAPTCHA v3 (web only)');
    } catch (e) {
      console.warn('[AppCheck] init skipped:', e?.message || e);
    }
  })();
}
