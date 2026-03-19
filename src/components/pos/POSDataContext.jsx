import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const POSDataContext = createContext();

// Simple in-memory cache per business session
const cache = new Map();

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

  // Load all POS data in parallel, cache per uid
  useEffect(() => {
    if (!uid) return;
    const cacheKey = `pos-${uid}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      setData({ ...cached, loading: false, error: null });
      setReady(true);
      return;
    }

    let activeStaff = true;
    const staffUnsub = onSnapshot(
      collection(db, "businesses", uid, "pos-staff"),
      snap => {
        if (!activeStaff) return;
        const staff = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false);
        setData(prev => {
          const updated = { ...prev, posStaff: staff };
          cache.set(cacheKey, updated);
          return updated;
        });
      },
      err => console.warn("[POSDataContext] pos-staff:", err?.code)
    );

    const loadOnce = async () => {
      try {
        const [catsSnap, itemsSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, "businesses", uid, "categories")),
          getDocs(collection(db, "businesses", uid, "items")),
          getDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings")),
        ]);

        const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const items = itemsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.available !== false);
        const posSettings = settingsSnap.exists() ? settingsSnap.data() : null;

        const payload = { categories, items, posStaff: data.posStaff, posSettings, loading: false, error: null };
        cache.set(cacheKey, payload);
        setData(payload);
        setReady(true);
      } catch (e) {
        console.error("[POSDataContext] load error:", e);
        setData(prev => ({ ...prev, loading: false, error: "Failed to load POS data" }));
        setReady(false);
      }
    };

    loadOnce();

    return () => {
      activeStaff = false;
      staffUnsub();
    };
  }, [uid]);

  const value = { uid, ready, ...data };
  return <POSDataContext.Provider value={value}>{children}</POSDataContext.Provider>;
}

export function usePOSData() {
  return useContext(POSDataContext);
}
