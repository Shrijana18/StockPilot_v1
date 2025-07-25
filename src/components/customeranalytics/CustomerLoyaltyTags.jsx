import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const CustomerLoyaltyTags = () => {
  const [loyaltyList, setLoyaltyList] = useState([]);

  useEffect(() => {
    const fetchLoyalty = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
      const snap = await getDocs(ref);

      const grouped = {};

      snap.docs.forEach(doc => {
        const inv = doc.data();
        const c = inv.customer || {};
        const key = c.custId || c.phone || c.email || c.name;

        if (!grouped[key]) {
          grouped[key] = {
            custId: c.custId,
            name: c.name,
            phone: c.phone,
            visits: 0,
          };
        }

        grouped[key].visits += 1;
      });

      const tagged = Object.values(grouped)
        .map(c => ({
          ...c,
          tier:
            c.visits >= 10 ? "🥇 Platinum" :
            c.visits >= 5 ? "🥈 Gold" :
            c.visits >= 1 ? "🥉 Silver" : "New",
        }))
        .sort((a, b) => b.visits - a.visits);

      setLoyaltyList(tagged);
    };

    fetchLoyalty();
  }, []);

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-lg font-bold mb-4">🎯 Customer Loyalty Tiers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loyaltyList.map((c, i) => (
          <div key={i} className="border p-4 rounded shadow-sm">
            <p className="font-semibold">{c.name} ({c.phone})</p>
            <p>Visits: {c.visits}</p>
            <p>Tier: <strong>{c.tier}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerLoyaltyTags;