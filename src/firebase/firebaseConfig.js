import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

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

// --- Default Firebase App (for Retailer/Distributor) ---
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
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

// Disable persistence to avoid interference with Retailer login
setPersistence(empAuth, inMemoryPersistence)
  .then(() => console.info("[Employee Firebase] In-memory auth persistence enabled"))
  .catch(err => console.warn("[Employee Firebase] Persistence setup failed:", err));

// --- Optional App Check logic remains unchanged ---
if (typeof window !== 'undefined' && import.meta?.env?.VITE_ENABLE_APPCHECK === 'true') {
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
      console.info('[AppCheck] Initialized with reCAPTCHA v3');
    } catch (e) {
      console.warn('App Check init skipped:', e?.message || e);
    }
  })();
}
