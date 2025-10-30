import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth, db, empAuth } from '../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getEmployeeSession, isEmployeePath, clearEmployeeSession, isEmployeeRedirect, clearEmployeeRedirect } from '../utils/employeeSession';
import { getDistributorEmployeeSession, isDistributorEmployeePath, clearDistributorEmployeeSession, isDistributorEmployeeRedirect, clearDistributorEmployeeRedirect } from '../utils/distributorEmployeeSession';

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
export const getCurrentUserId = () => auth.currentUser?.uid || null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Migrate any legacy distributor-employee redirect flag from localStorage to sessionStorage
    // This avoids a persistent stuck-login on some browsers/devices after a redirect.
    try {
      const legacyKey = 'flyp_distributor_employee_redirect';
      if (localStorage.getItem(legacyKey) === 'true' && !sessionStorage.getItem(legacyKey)) {
        sessionStorage.setItem(legacyKey, 'true');
        localStorage.removeItem(legacyKey);
      }
    } catch (_) {}

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Only log significant state changes
      if (firebaseUser && !user) {
        console.log("[AuthContext] User signed in:", firebaseUser.uid);
      } else if (!firebaseUser && user) {
        console.log("[AuthContext] User signed out");
      }
      
      // Add production debugging
      const isProduction = window.location.hostname !== 'localhost';
      if (isProduction) {
        console.log("[AuthContext] Production environment - Firebase user:", firebaseUser?.uid || "null");
      }
      
      // One-time guard: when employee flow just redirected to /employee-dashboard,
      // skip this auth tick to avoid race between signOut and dashboard mount.
      if (isEmployeeRedirect()) {
        console.log("[AuthContext] Employee redirect detected, clearing and bypassing");
        try { clearEmployeeRedirect(); } catch (_) {}
        // When we just switched into employee flow, keep primary app signed-out state.
        setUser(null);
        setRole(null);
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      // One-time guard: when distributor employee flow just redirected to /distributor-employee-dashboard,
      // skip this auth tick to avoid race between signOut and dashboard mount.
      if (isDistributorEmployeeRedirect()) {
        console.log("[AuthContext] Distributor employee redirect detected, clearing and bypassing");
        try { clearDistributorEmployeeRedirect(); } catch (_) {}
        // When we just switched into distributor employee flow, keep primary app signed-out state.
        setUser(null);
        setRole(null);
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      const empSession = getEmployeeSession();
      const distEmpSession = getDistributorEmployeeSession();
      const isEmpArea = isEmployeePath(typeof window !== 'undefined' ? window.location.pathname : '');
      const isDistEmpArea = isDistributorEmployeePath(typeof window !== 'undefined' ? window.location.pathname : '');

      // ✅ Employee-aware handling: if we are in employee area or have an employee session,
      // use employee auth instance
      if (isEmpArea || empSession) {
        if (empAuth.currentUser) {
          // Check if this is an employee with custom claims
          if (empAuth.currentUser.customClaims?.isEmployee) {
            setUser(empAuth.currentUser);
            setRole('employee');
          } else {
            setUser(null);
            setRole(null);
          }
        } else {
          setUser(null);
          setRole(null);
        }
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      // ✅ Distributor Employee-aware handling: if we are in distributor employee area or have a distributor employee session,
      // use employee auth instance
      if (isDistEmpArea || distEmpSession) {
        if (empAuth.currentUser) {
          // Check if this is a distributor employee with custom claims
          if (empAuth.currentUser.customClaims?.isDistributorEmployee) {
            setUser(empAuth.currentUser);
            setRole('distributor-employee');
          } else {
            setUser(null);
            setRole(null);
          }
        } else {
          setUser(null);
          setRole(null);
        }
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Optional: make sure token is fresh for backend calls
          await firebaseUser.getIdToken(true);
        } catch (err) {
          console.warn('[Auth] Failed to refresh ID token:', err?.message || err);
        }

        try {
          console.log("[AuthContext] Fetching user data from Firestore for UID:", firebaseUser.uid);
          const docRef = doc(db, 'businesses', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          console.log("[AuthContext] Document exists:", docSnap.exists());
          const userData = docSnap.exists() ? docSnap.data() : null;
          console.log("[AuthContext] User data:", userData);
          
          // Check for both 'role' and 'businessType' fields (some users have businessType)
          const rawRole = userData?.role || userData?.businessType || null;
          const normalizedRole = rawRole
            ? String(rawRole).toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
            : null;
          
          console.log("[AuthContext] User role detected:", rawRole, "->", normalizedRole);
          
          // Set the normalized role for main users
          // distributor-employee should only come from custom claims, not from Firestore role
          if (normalizedRole === 'distributor-employee') {
            console.warn("[AuthContext] Detected distributor-employee role in Firestore, this should not happen for main users");
            // If somehow a main user has distributor-employee role in Firestore, treat as distributor
            setRole('distributor');
          } else {
            setRole(normalizedRole);
          }
          
          console.log("[AuthContext] Role set to:", normalizedRole);
          // 🧩 Fallback: if Firestore role not ready yet, honor post-signup hint temporarily
          if (!normalizedRole && typeof window !== 'undefined') {
            const pending = sessionStorage.getItem('postSignupRole');
            if (pending) setRole(pending.toLowerCase().replace(/\s+/g, ''));
          }
        } catch (err) {
          console.warn('[Auth] Role fetch failed for uid', firebaseUser.uid, err?.message || err);
          setRole(null);
        }
        
        setLoading(false);
        setAuthLoading(false);
      } else {
        // Signed-out
        setRole(null);
        setLoading(false);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading: authLoading, setUser, setRole, setLoading }}>
      {authLoading ? (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;