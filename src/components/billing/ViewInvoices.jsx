

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const ViewInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchInvoices = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      try {
        const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
        const snap = await getDocs(ref);
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setInvoices(data);
        setFiltered(data);
      } catch (err) {
        console.error("Error loading invoices:", err);
      }
    };
    fetchInvoices();
  }, []);

  useEffect(() => {
    const term = search.toLowerCase();
    const filtered = invoices.filter((inv) =>
      inv.customer?.name?.toLowerCase().includes(term) ||
      inv.invoiceType?.toLowerCase().includes(term)
    );
    setFiltered(filtered);
  }, [search, invoices]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">All Invoices</h2>

      <input
        type="text"
        placeholder="Search by customer or invoice type..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border px-4 py-2 mb-4 w-full md:w-1/2 rounded"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((inv) => (
          <div key={inv.id} className="border p-4 bg-white shadow rounded">
            <h3 className="font-bold text-lg mb-2">{inv.customer?.name}</h3>
            <p>Email: {inv.customer?.email}</p>
            <p>Type: {inv.invoiceType}</p>
            <p>Total: ₹{inv.total}</p>
            <p className="text-sm text-gray-400 mt-2">Date: {inv.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ViewInvoices;