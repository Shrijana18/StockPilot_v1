

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
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Invoice Type Breakdown</h2>
      {Object.keys(typeCounts).length === 0 ? (
        <p className="text-gray-500">No invoices found.</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {Object.entries(typeCounts).map(([type, count], index) => (
            <li key={index}>
              {type}: {count} invoice{count > 1 ? 's' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvoiceTypeBreakdown;