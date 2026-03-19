import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, getDoc, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const POSDataContext = createContext();

export function POSDataProvider({ children }) {
  const [uid, setUid] = useState(() => auth.currentUser?.uid || null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState({
    categories: [],
    items: [],
    posStaff: [],
    posSettings: null,
    loading: true,
    error: null,
  });

  // Track auth reactively
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      const newUid = u?.uid || null;
      setUid(newUid);
      if (!newUid) {
        setData(prev => ({ ...prev, loading: false, error: "Not authenticated" }));
        setReady(false);
      }
    });
    return unsub;
  }, []);

  // Real-time listeners for categories, items, and staff
  useEffect(() => {
    if (!uid) return;

    // Flags to track which collections have fired at least once
    const fired = { cats: false, items: false };
    const trySetReady = () => {
      if (fired.cats && fired.items) setReady(true);
    };

    const catsUnsub = onSnapshot(
      collection(db, "businesses", uid, "categories"),
      snap => {
        const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        fired.cats = true;
        setData(prev => ({ ...prev, categories, loading: false, error: null }));
        trySetReady();
      },
      err => {
        console.warn("[POSDataContext] categories:", err?.code);
        fired.cats = true;
        setData(prev => ({ ...prev, loading: false }));
        trySetReady();
      }
    );

    const itemsUnsub = onSnapshot(
      collection(db, "businesses", uid, "items"),
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.available !== false);
        fired.items = true;
        setData(prev => ({ ...prev, items, loading: false, error: null }));
        trySetReady();
      },
      err => {
        console.warn("[POSDataContext] items:", err?.code);
        fired.items = true;
        setData(prev => ({ ...prev, loading: false }));
        trySetReady();
      }
    );

    const staffUnsub = onSnapshot(
      collection(db, "businesses", uid, "pos-staff"),
      snap => {
        const posStaff = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false);
        setData(prev => ({ ...prev, posStaff }));
      },
      err => console.warn("[POSDataContext] pos-staff:", err?.code)
    );

    // Settings (rarely changes — one-time fetch is fine)
    getDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings"))
      .then(snap => {
        const posSettings = snap.exists() ? snap.data() : null;
        setData(prev => ({ ...prev, posSettings }));
      })
      .catch(() => {});

    return () => {
      catsUnsub();
      itemsUnsub();
      staffUnsub();
    };
  }, [uid]);

  const value = { uid, ready, ...data };
  return <POSDataContext.Provider value={value}>{children}</POSDataContext.Provider>;
}

export function usePOSData() {
  return useContext(POSDataContext);
}
