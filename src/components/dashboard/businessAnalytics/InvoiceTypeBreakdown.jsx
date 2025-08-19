import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";

const InvoiceTypeBreakdown = () => {
  const [typeCounts, setTypeCounts] = useState({});

  useEffect(() => {
    const fetchInvoiceTypes = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);

        const counts = {};

        snapshot.forEach(doc => {
          const data = doc.data();
          const type = data.invoiceType || 'Unspecified';

          if (!counts[type]) {
            counts[type] = 0;
          }
          counts[type] += 1;
        });

        setTypeCounts(counts);
      } catch (error) {
        console.error('Error fetching invoice type breakdown:', error);
      }
    };

    fetchInvoiceTypes();
  }, []);

  return (
    <div className="p-5 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Invoice Type Breakdown</h2>
      {Object.keys(typeCounts).length === 0 ? (
        <p className="text-white/70">No invoices found.</p>
      ) : (
        <ul className="list-disc list-inside space-y-1 marker:text-emerald-300">
          {Object.entries(typeCounts).map(([type, count], index) => (
            <li key={index} className="text-white/90">
              {type}: {count} invoice{count > 1 ? 's' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvoiceTypeBreakdown;