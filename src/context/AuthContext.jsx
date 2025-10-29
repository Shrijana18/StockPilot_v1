import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // One-time guard: when employee flow just redirected to /employee-dashboard,
      // skip this auth tick to avoid race between signOut and dashboard mount.
      if (isEmployeeRedirect()) {
        try { clearEmployeeRedirect(); } catch (_) {}
        // When we just switched into employee flow, keep primary app signed-out state.
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      // One-time guard: when distributor employee flow just redirected to /distributor-employee-dashboard,
      // skip this auth tick to avoid race between signOut and dashboard mount.
      if (isDistributorEmployeeRedirect()) {
        try { clearDistributorEmployeeRedirect(); } catch (_) {}
        // When we just switched into distributor employee flow, keep primary app signed-out state.
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      const empSession = getEmployeeSession();
      const distEmpSession = getDistributorEmployeeSession();
      const isEmpArea = isEmployeePath(typeof window !== 'undefined' ? window.location.pathname : '');
      const isDistEmpArea = isDistributorEmployeePath(typeof window !== 'undefined' ? window.location.pathname : '');

      // ✅ Employee-aware handling: if we are in employee area or have an employee session,
      // allow Firebase-authenticated employee to proceed; otherwise keep bypass behavior.
      if (isEmpArea || empSession) {
        if (firebaseUser) {
          // Employee now signs in via Custom Token, so honor this session
          setUser(firebaseUser);
          setRole('employee');
        } else {
          // Legacy/unauthenticated employee flow: keep bypassing
          setUser(null);
          setRole(null);
        }
        setLoading(false);
        return;
      }

      // ✅ Distributor Employee-aware handling: if we are in distributor employee area or have a distributor employee session,
      // allow Firebase-authenticated distributor employee to proceed; otherwise keep bypass behavior.
      if (isDistEmpArea || distEmpSession) {
        if (firebaseUser) {
          // Distributor Employee now signs in via Custom Token, so honor this session
          setUser(firebaseUser);
          setRole('distributor-employee');
        } else {
          // Legacy/unauthenticated distributor employee flow: keep bypassing
          setUser(null);
          setRole(null);
        }
        setLoading(false);
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
          const docRef = doc(db, 'businesses', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          const userData = docSnap.exists() ? docSnap.data() : null;
          
          // Check for both 'role' and 'businessType' fields (some users have businessType)
          const rawRole = userData?.role || userData?.businessType || null;
          const normalizedRole = rawRole
            ? String(rawRole).toLowerCase().replace(/\s|_/g, '')
            : null;
          
          console.log("[AuthContext] User UID:", firebaseUser.uid);
          console.log("[AuthContext] Raw role:", rawRole);
          console.log("[AuthContext] Normalized role:", normalizedRole);
          console.log("[AuthContext] Full user data:", userData);
          
          // CRITICAL FIX: Ensure we don't set distributor-employee role for main users
          if (normalizedRole === 'distributor-employee') {
            console.warn("[AuthContext] Detected distributor-employee role for main user, this should not happen");
            setRole(null);
          } else {
            setRole(normalizedRole);
          }
          // 🧩 Fallback: if Firestore role not ready yet, honor post-signup hint temporarily
          if (!normalizedRole && typeof window !== 'undefined') {
            const pending = sessionStorage.getItem('postSignupRole');
            if (pending) setRole(pending.toLowerCase().replace(/\s+/g, ''));
          }
        } catch (err) {
          console.warn('[Auth] Role fetch failed for uid', firebaseUser.uid, err?.message || err);
          setRole(null);
        }
      } else {
        // Signed-out
        setRole(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, setUser, setRole, setLoading }}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
};

export default AuthContext;