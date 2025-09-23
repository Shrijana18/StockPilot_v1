import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const CustomerInsights = () => {
  const [customerStats, setCustomerStats] = useState([]);

  useEffect(() => {
    const fetchInvoices = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
      const snap = await getDocs(ref);

      const invoices = snap.docs.map(doc => doc.data());

      const grouped = {};

      invoices.forEach(inv => {
        const c = inv.customer || {};
        // Use custId for grouping if present, fallback to phone/email/name
        const key = c.custId || c.phone || c.email || c.name;

        if (!grouped[key]) {
          grouped[key] = {
            custId: c.custId,
            name: c.name,
            phone: c.phone,
            email: c.email,
            visits: 0,
            totalSpend: 0,
            products: {},
          };
        }

        grouped[key].visits += 1;
        grouped[key].totalSpend += inv.totalAmount || 0;

        (inv.cartItems || []).forEach(item => {
          if (!grouped[key].products[item.name]) {
            grouped[key].products[item.name] = 0;
          }
          grouped[key].products[item.name] += item.quantity;
        });
      });

      setCustomerStats(Object.values(grouped));
    };

    fetchInvoices();
  }, []);

  return (
    <div className="p-4 bg-black/70 rounded-lg border border-white/20 shadow-lg">
      <h2 className="text-3xl font-extrabold mb-6 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        Customer Insights
      </h2>
      <div className="space-y-4">
        {customerStats.map((c, i) => (
          <div key={i} className="border border-white/10 p-4 rounded-lg shadow bg-slate-900/60 text-white">
            <p className="font-semibold text-white">{c.name} ({c.phone})</p>
            <p className="text-gray-300">Total Visits: {c.visits}</p>
            <p className="text-gray-300">Total Spend: ₹{c.totalSpend.toFixed(2)}</p>
            <p className="text-gray-300">Top Products: {Object.entries(c.products).map(([p, q]) => `${p} (${q})`).join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerInsights;