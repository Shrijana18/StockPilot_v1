import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

export const app = initializeApp(firebaseConfig);

// --- App Check temporarily disabled ---
// Phone OTP is stabilised using Firebase Auth's built-in Invisible v2 reCAPTCHA.
// If you want to re-enable App Check later, set VITE_ENABLE_APPCHECK="true" and
// provide VITE_RECAPTCHA_V3_SITE_KEY in your .env file.
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-south1");
