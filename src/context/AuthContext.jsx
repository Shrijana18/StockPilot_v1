import React, { createContext, useEffect, useState, useContext } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const getCurrentUserId = () => auth.currentUser?.uid || null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        console.log('Authenticated user UID:', firebaseUser.uid);
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