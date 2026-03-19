import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const EMPTY_BIZ = {
  uid: null,
  bizName: "Restaurant",
  bizTagline: "",
  bizAddress: "",
  bizCity: "",
  bizPhone: "",
  bizEmail: "",
  bizGST: "",
  bizFSSAI: "",
  bizLogo: "",
  ready: false,
};

const POSBusinessContext = createContext(EMPTY_BIZ);

const bizCache = new Map();

export function POSBusinessProvider({ children }) {
  const [uid, setUid] = useState(() => auth.currentUser?.uid || null);
  const [biz, setBiz] = useState(EMPTY_BIZ);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUid(u?.uid || null);
      if (!u) setBiz(EMPTY_BIZ);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const cached = bizCache.get(uid);
    if (cached) { setBiz({ ...cached, ready: true }); return; }

    Promise.all([
      getDoc(doc(db, "businesses", uid)),
      getDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings")),
    ]).then(([bizSnap, settingsSnap]) => {
      const bizData = bizSnap.data() || {};
      const restSettings = settingsSnap.data()?.business || {};
      const merged = {
        uid,
        bizName:    restSettings.name    || bizData.businessName || bizData.name || "Restaurant",
        bizTagline: restSettings.tagline || bizData.tagline || "",
        bizAddress: restSettings.address || bizData.address || "",
        bizCity:    restSettings.city    || bizData.city || "",
        bizPhone:   restSettings.phone   || bizData.phone || "",
        bizEmail:   restSettings.email   || bizData.email || "",
        bizGST:     restSettings.gstNumber || bizData.gstin || "",
        bizFSSAI:   restSettings.fssaiNumber || "",
        bizLogo:    restSettings.logoUrl || "",
        ready: true,
      };
      bizCache.set(uid, merged);
      setBiz(merged);
    }).catch(() => {
      setBiz(prev => ({ ...prev, ready: true }));
    });
  }, [uid]);

  return <POSBusinessContext.Provider value={biz}>{children}</POSBusinessContext.Provider>;
}

export function usePOSBusiness() {
  return useContext(POSBusinessContext);
}

export function invalidateBizCache(uid) {
  if (uid) bizCache.delete(uid);
}
