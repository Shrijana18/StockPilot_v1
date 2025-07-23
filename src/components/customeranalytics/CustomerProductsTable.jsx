

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const CustomerProductsTable = () => {
  const [data, setData] = useState([]);

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
        const key = c.phone || c.email || c.name;

        if (!grouped[key]) {
          grouped[key] = {
            name: c.name,
            phone: c.phone,
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

      const result = Object.values(grouped)
        .map(c => ({
          ...c,
          topProducts: Object.entries(c.products)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, qty]) => `${name} (${qty})`)
            .join(", ")
        }))
        .sort((a, b) => b.visits - a.visits);

      setData(result);
    };

    fetchInvoices();
  }, []);

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-lg font-bold mb-4">📊 Products Bought by Each Customer</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Customer Name</th>
              <th className="p-2 text-center">Visits</th>
              <th className="p-2 text-left">Top Products</th>
              <th className="p-2 text-right">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{c.name || "N/A"}</td>
                <td className="p-2 text-center">{c.visits}</td>
                <td className="p-2">{c.topProducts}</td>
                <td className="p-2 text-right">₹{c.totalSpend.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerProductsTable;