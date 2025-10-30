import React, { createContext, useEffect, useState, useContext, useMemo } from 'react';
import { auth, db, empAuth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, setPersistence, indexedDBLocalPersistence, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  getEmployeeSession,
  isEmployeePath,
  clearEmployeeSession,
  isEmployeeRedirect,
  clearEmployeeRedirect
} from '../utils/employeeSession';
import {
  getDistributorEmployeeSession,
  isDistributorEmployeePath,
  clearDistributorEmployeeSession,
  isDistributorEmployeeRedirect,
  clearDistributorEmployeeRedirect
} from '../utils/distributorEmployeeSession';

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
export const getCurrentUserId = () => auth.currentUser?.uid || null;

export const AuthProvider = ({ children }) => {
  // Keep raw auth users separate
  const [primaryUser, setPrimaryUser] = useState(null);
  const [employeeUser, setEmployeeUser] = useState(null);

  const [role, setRole] = useState(null);
  const [initialized, setInitialized] = useState(false);   // <-- guards can wait on this
  const [authLoading, setAuthLoading] = useState(true);    // kept for backward-compat with existing code

  // --- One-time: ensure persistence for primary app auth only (employee app remains in-memory by design)
  useEffect(() => {
    try { setPersistence(auth, indexedDBLocalPersistence); } catch (_) {}
  }, []);

  // --- Migrate legacy redirect flag once (prevents sticky redirect loops)
  useEffect(() => {
    try {
      const legacyKey = 'flyp_distributor_employee_redirect';
      if (localStorage.getItem(legacyKey) === 'true' && !sessionStorage.getItem(legacyKey)) {
        sessionStorage.setItem(legacyKey, 'true');
        localStorage.removeItem(legacyKey);
      }
    } catch (_) {}
  }, []);

  // --- Subscribe to primary user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setPrimaryUser(firebaseUser ?? null);
    });
    return () => unsub();
  }, []);

  // --- Subscribe to employee auth; we don't force persistence here
  useEffect(() => {
    const unsub = onAuthStateChanged(empAuth, (u) => {
      setEmployeeUser(u ?? null);
    });
    return () => unsub();
  }, []);

  // --- Core selector + role resolver
  useEffect(() => {
    (async () => {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const inEmpArea = isEmployeePath(path);
      const inDistEmpArea = isDistributorEmployeePath(path);

      // Handle one-time redirect guards (same behavior you had)
      if (isEmployeeRedirect()) {
        try { clearEmployeeRedirect(); } catch (_) {}
        setRole(null);
        setInitialized(true);
        setAuthLoading(false);
        return;
      }
      if (isDistributorEmployeeRedirect()) {
        try { clearDistributorEmployeeRedirect(); } catch (_) {}
        setRole(null);
        setInitialized(true);
        setAuthLoading(false);
        return;
      }

      // Decide which user to expose based on route
      let effectiveUser = null;
      let effectiveRole = null;

      if (inEmpArea) {
        // employee dashboard expects employee claims
        if (employeeUser) {
          try {
            const { claims } = await getIdTokenResult(employeeUser);
            if (claims?.isEmployee) {
              effectiveUser = employeeUser;
              effectiveRole = 'employee';
            }
          } catch (e) {
            console.warn('[Auth] Failed to read employee claims:', e?.message || e);
          }
        }
      } else if (inDistEmpArea) {
        if (employeeUser) {
          try {
            const { claims } = await getIdTokenResult(employeeUser);
            if (claims?.isDistributorEmployee) {
              effectiveUser = employeeUser;
              effectiveRole = 'distributor-employee';
            }
          } catch (e) {
            console.warn('[Auth] Failed to read distributor-employee claims:', e?.message || e);
          }
        }
      } else {
        // main app area → use primary user
        effectiveUser = primaryUser ?? null;

        if (primaryUser) {
          // refresh token once to keep claims fresh for CF calls
          try { await primaryUser.getIdToken(true); } catch (err) {
            console.warn('[Auth] Failed to refresh ID token:', err?.message || err);
          }

          // Fetch role from Firestore
          try {
            const docRef = doc(db, 'businesses', primaryUser.uid);
            const docSnap = await getDoc(docRef);
            const userData = docSnap.exists() ? docSnap.data() : null;

            const rawRole = userData?.role || userData?.businessType || null;
            const normalizedRole = rawRole
              ? String(rawRole).toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
              : null;

            // if a main user somehow has 'distributor-employee' in doc (shouldn't), treat as distributor
            effectiveRole = normalizedRole === 'distributoremployee' ? 'distributor' : normalizedRole;

            // fallback to post-signup hint if firestore hasn't populated yet
            if (!effectiveRole && typeof window !== 'undefined') {
              const pending = sessionStorage.getItem('postSignupRole');
              if (pending) effectiveRole = pending.toLowerCase().replace(/\s+/g, '');
            }
          } catch (err) {
            console.warn('[Auth] Role fetch failed for uid', primaryUser.uid, err?.message || err);
            effectiveRole = null;
          }
        }
      }

      setRole(effectiveRole ?? null);
      // Expose the selected user through context by mapping it into state
      // We keep primaryUser/employeeUser internally but the context value will export one user.
      // To keep API compatible, we won't add an extra state; instead we derive in value (see useMemo below).

      // Initialized once both auth states have reported at least once (or when selection is determined)
      setInitialized(true);
      setAuthLoading(false);
    })();
  }, [primaryUser, employeeUser]);

  const value = useMemo(() => {
    // Recompute the effective user synchronously for consumers
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const inEmpArea = isEmployeePath(path);
    const inDistEmpArea = isDistributorEmployeePath(path);

    let userToExpose = null;
    if (inEmpArea) {
      userToExpose = employeeUser ?? null;
    } else if (inDistEmpArea) {
      userToExpose = employeeUser ?? null;
    } else {
      userToExpose = primaryUser ?? null;
    }

    return {
      user: userToExpose,
      role,
      initialized,
      loading: !initialized,             // keep legacy flag semantics
      // preserve setters in case some screens expect them
      setUser: (u) => setPrimaryUser(u),
      setRole,
      setLoading: (v) => setAuthLoading(Boolean(v)),
    };
  }, [primaryUser, employeeUser, role, initialized]);

  return (
    <AuthContext.Provider value={value}>
      {!initialized ? (
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