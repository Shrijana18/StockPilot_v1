import React, { createContext, useEffect, useState, useContext, useMemo } from 'react';
import { auth, db, empAuth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, setPersistence, indexedDBLocalPersistence, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { shouldUseRestFallback, getDocumentRest } from '../customer/services/firestoreRestClient';
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
import { getCurrentPath } from '../utils/routePath';

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

  // CRITICAL: Track whether onAuthStateChanged has fired at least once.
  // Firebase restores session from IndexedDB asynchronously; if we allow the
  // role-resolution effect to run with primaryUser=null before the first auth
  // event, PrivateRoute sees initialized=true + user=null and redirects to login.
  const [primaryAuthFired, setPrimaryAuthFired] = useState(false);
  const [employeeAuthFired, setEmployeeAuthFired] = useState(false);

  const withTimeout = (promise, ms, label = 'Operation') =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
    ]);

  // --- One-time: ensure IndexedDB persistence (30-day sessions, survives refresh)
  useEffect(() => {
    if (Capacitor?.isNativePlatform?.()) return;
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

  // --- Subscribe to primary user — set fired=true on FIRST event
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setPrimaryUser(firebaseUser ?? null);
      setPrimaryAuthFired(true);
    });
    return () => unsub();
  }, []);

  // --- Subscribe to employee auth; fired tracking for employee routes
  useEffect(() => {
    const unsub = onAuthStateChanged(empAuth, (u) => {
      setEmployeeUser(u ?? null);
      setEmployeeAuthFired(true);
    });
    return () => unsub();
  }, []);

  // --- Core selector + role resolver
  // Only runs after BOTH auth listeners have fired at least once.
  // This prevents the race condition where initialized=true+user=null causes
  // PrivateRoute to redirect to /auth before Firebase restores the session.
  useEffect(() => {
    if (!primaryAuthFired || !employeeAuthFired) return; // wait for first events
    (async () => {
      const path = getCurrentPath();
      const inEmpArea = isEmployeePath(path);
      const inDistEmpArea = isDistributorEmployeePath(path);

      // Clear stale role immediately when primary user changes (prevents wrong dashboard redirect)
      // Without this, role from previous user persists until Firestore fetch completes
      if (!inEmpArea && !inDistEmpArea) {
        if (!primaryUser) {
          setRole(null);
        } else {
          // User changed (e.g. re-login with different account) - clear stale role while we fetch
          setRole(null);
        }
      }

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
          // Use fresh login role immediately if set by Login.jsx (avoids wrong dashboard redirect)
          const fresh = typeof window !== 'undefined' && sessionStorage.getItem('freshLoginRole');
          if (fresh) {
            const freshNorm = fresh.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
            setRole(freshNorm === 'distributoremployee' ? 'distributor' : freshNorm);
            try { sessionStorage.removeItem('freshLoginRole'); } catch (_) {}
          }

          // refresh token once to keep claims fresh for CF calls
          try {
            await withTimeout(primaryUser.getIdToken(true), 10000, 'Auth token refresh');
          } catch (err) {
            console.warn('[Auth] Failed to refresh ID token:', err?.message || err);
          }

          // Fetch role from Firestore (use REST on native - SDK getDoc hangs in WKWebView)
          try {
            let userData = null;
            if (shouldUseRestFallback()) {
              try {
                const idToken = await withTimeout(primaryUser.getIdToken(), 10000, 'Auth token');
                const bizDoc = await withTimeout(
                  getDocumentRest(`businesses/${primaryUser.uid}`, idToken),
                  15000,
                  'Role fetch'
                );
                userData = bizDoc || null;
              } catch (e) {
                if (!e?.message?.includes('404')) throw e;
                userData = null;
              }
            } else {
              const docRef = doc(db, 'businesses', primaryUser.uid);
              const docSnap = await getDoc(docRef);
              userData = docSnap.exists() ? docSnap.data() : null;
            }

            const rawRole = userData?.role || userData?.businessType || null;
            const normalizedRole = rawRole
              ? String(rawRole).toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
              : null;

            // if a main user somehow has 'distributor-employee' in doc (shouldn't), treat as distributor
            effectiveRole = normalizedRole === 'distributoremployee' ? 'distributor' : normalizedRole;

            // fallback: post-signup hint (freshLoginRole is consumed at start of effect)
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
  }, [primaryUser, employeeUser, primaryAuthFired, employeeAuthFired]);

  const value = useMemo(() => {
    // Recompute the effective user synchronously for consumers
    const path = getCurrentPath();
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
        <div
          className="min-h-screen flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(160deg, #071a2b 0%, #0b2944 50%, #071a2b 100%)" }}
        >
          <div className="flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/25">
              <span className="text-2xl font-black text-white select-none">F</span>
            </div>
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-emerald-400/70"
                  style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
            <p className="text-white/40 text-xs tracking-widest uppercase">Restoring session…</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;