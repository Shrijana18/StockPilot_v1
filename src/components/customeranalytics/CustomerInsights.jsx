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
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Customer Insights</h2>
      <div className="space-y-4">
        {customerStats.map((c, i) => (
          <div key={i} className="border p-4 rounded shadow bg-white">
            <p className="font-semibold">{c.name} ({c.phone})</p>
            <p>Total Visits: {c.visits}</p>
            <p>Total Spend: ₹{c.totalSpend.toFixed(2)}</p>
            <p>Top Products: {Object.entries(c.products).map(([p, q]) => `${p} (${q})`).join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerInsights;