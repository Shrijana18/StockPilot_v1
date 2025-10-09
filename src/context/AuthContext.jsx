import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getEmployeeSession, isEmployeePath, clearEmployeeSession, isEmployeeRedirect, clearEmployeeRedirect } from '../utils/employeeSession';

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
        setLoading(false);
        return;
      }
      const empSession = getEmployeeSession();
      const isEmpArea = isEmployeePath(typeof window !== 'undefined' ? window.location.pathname : '');

      // ✅ Full bypass for employee flows (either in employee route OR an employee session exists)
      if (isEmpArea || empSession) {
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        console.log('Authenticated user UID:', firebaseUser.uid);

        // ✅ Keep token always fresh for callable functions
        try {
          await firebaseUser.getIdToken(true);
          firebaseUser.onIdTokenChanged?.(async (updatedUser) => {
            if (updatedUser) {
              await updatedUser.getIdToken(true);
            }
          });
        } catch (err) {
          console.warn('Failed to refresh ID token:', err);
        }

        const docRef = doc(db, 'businesses', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role);
        }
      } else {
        console.log('User signed out or no user authenticated.');
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