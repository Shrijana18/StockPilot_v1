

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
        const key = c.custId || c.phone || c.email || c.name;

        if (!grouped[key]) {
          grouped[key] = {
            custId: c.custId,
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
    <div className="bg-slate-900/60 border border-white/10 backdrop-blur-sm shadow rounded p-4 mb-6">
      <h2 className="text-lg font-bold mb-4 text-white bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-teal-400 inline-block">
        📊 Products Bought by Each Customer
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm bg-slate-900/70 rounded">
          <thead>
            <tr>
              <th className="p-3 text-left bg-slate-800/70 text-white font-semibold border-b border-white/10">Customer Name</th>
              <th className="p-3 text-center bg-slate-800/70 text-white font-semibold border-b border-white/10">Visits</th>
              <th className="p-3 text-left bg-slate-800/70 text-white font-semibold border-b border-white/10">Top Products</th>
              <th className="p-3 text-right bg-slate-800/70 text-white font-semibold border-b border-white/10">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr
                key={i}
                className={
                  `transition-colors ${i % 2 === 0 ? "bg-slate-900/60" : "bg-slate-800/60"} hover:bg-fuchsia-900/40 border-b border-white/5`
                }
              >
                <td className="p-3 text-white">{c.name || "N/A"}</td>
                <td className="p-3 text-center text-fuchsia-200">{c.visits}</td>
                <td className="p-3 text-slate-200">{c.topProducts}</td>
                <td className="p-3 text-right text-cyan-200">₹{c.totalSpend.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerProductsTable;