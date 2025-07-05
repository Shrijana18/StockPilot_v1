// src/firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ✅ Your actual Firebase config — DO NOT modify unless changing project
const firebaseConfig = {
  apiKey: "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE",
  authDomain: "stockpilotv1.firebaseapp.com",
  databaseURL: "https://stockpilotv1-default-rtdb.firebaseio.com",
  projectId: "stockpilotv1",
  storageBucket: "stockpilotv1.appspot.com",
  messagingSenderId: "30934537475",
  appId: "1:30934537475:web:84a2f76609dbb1db290536",
  measurementId: "G-SENFJ2HSBW"
};

// ✅ Initialize and export
export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
