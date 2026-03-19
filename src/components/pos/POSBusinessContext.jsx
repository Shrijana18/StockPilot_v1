import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const POSBusinessContext = createContext({ uid: null, bizName: "Restaurant", ready: false });

const bizCache = new Map();

export function POSBusinessProvider({ children }) {
  const [uid, setUid] = useState(() => auth.currentUser?.uid || null);
  const [bizName, setBizName] = useState("Restaurant");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUid(u?.uid || null);
      if (!u) setReady(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const cached = bizCache.get(uid);
    if (cached) {
      setBizName(cached);
      setReady(true);
      return;
    }

    getDoc(doc(db, "businesses", uid))
      .then(snap => {
        const name = snap.data()?.businessName || snap.data()?.name || "Restaurant";
        bizCache.set(uid, name);
        setBizName(name);
        setReady(true);
      })
      .catch(() => {
        setBizName("Restaurant");
        setReady(true);
      });
  }, [uid]);

  const value = { uid, bizName, ready };
  return <POSBusinessContext.Provider value={value}>{children}</POSBusinessContext.Provider>;
}

export function usePOSBusiness() {
  return useContext(POSBusinessContext);
}
