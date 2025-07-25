

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const TopLoyalCustomersTable = () => {
  const [topCustomers, setTopCustomers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
      const snap = await getDocs(ref);
      const invoices = snap.docs.map(doc => doc.data());

      const grouped = {};

      invoices.forEach(inv => {
        const c = inv.customer || {};
        // Prioritize custId for grouping to prevent duplicate customer tracking
        const key = c.custId || c.phone || c.email || c.name;

        if (!grouped[key]) {
          grouped[key] = {
            custId: c.custId,
            name: c.name,
            phone: c.phone,
            totalSpend: 0,
            orders: 0,
          };
        }

        grouped[key].orders += 1;
        grouped[key].totalSpend += inv.totalAmount || 0;
      });

      const result = Object.values(grouped)
        .map(c => ({
          ...c,
          avgOrderValue: c.orders > 0 ? (c.totalSpend / c.orders).toFixed(2) : "0.00",
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 5);

      setTopCustomers(result);
    };

    fetchData();
  }, []);

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-lg font-bold mb-4">🛍️ Top Loyal / High-Spend Customers</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-center">Orders</th>
              <th className="p-2 text-right">Total Spend</th>
              <th className="p-2 text-right">Avg Order Value</th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{c.name || "N/A"}</td>
                <td className="p-2">{c.phone || "N/A"}</td>
                <td className="p-2 text-center">{c.orders}</td>
                <td className="p-2 text-right">₹{c.totalSpend.toFixed(2)}</td>
                <td className="p-2 text-right">₹{c.avgOrderValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopLoyalCustomersTable;