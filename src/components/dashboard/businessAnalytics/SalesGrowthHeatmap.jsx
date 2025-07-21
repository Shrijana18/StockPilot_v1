

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import { format, subDays } from 'date-fns';

const SalesGrowthHeatmap = () => {
  const [dailySales, setDailySales] = useState({});

  useEffect(() => {
    const fetchDailySales = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);

        const salesMap = {};

        // Initialize last 30 days
        for (let i = 0; i < 30; i++) {
          const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
          salesMap[dateStr] = 0;
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.createdAt || !data.totalAmount) return;

          const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          const dateStr = format(date, 'yyyy-MM-dd');

          if (salesMap[dateStr] !== undefined) {
            salesMap[dateStr] += data.totalAmount;
          }
        });

        setDailySales(salesMap);
      } catch (error) {
        console.error('Error fetching daily sales:', error);
      }
    };

    fetchDailySales();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Sales Growth (Last 30 Days)</h2>
      <div className="grid grid-cols-5 gap-2 text-center text-sm">
        {Object.entries(dailySales).map(([date, total], index) => (
          <div key={index} className="p-2 border rounded">
            <div className="font-medium">{format(new Date(date), 'MMM d')}</div>
            <div className="text-green-700 font-semibold">₹{total.toFixed(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalesGrowthHeatmap;