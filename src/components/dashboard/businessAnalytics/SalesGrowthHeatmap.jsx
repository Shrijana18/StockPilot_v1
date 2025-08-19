

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
    <div className="p-5 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Sales Growth (Last 30 Days)</h2>
      <div className="grid grid-cols-5 gap-2 text-center text-sm">
        {Object.entries(dailySales).map(([date, total], index) => (
          <div key={index} className="p-2 rounded border border-white/10 bg-white/5 hover:bg-white/10 transition">
            <div className="font-medium text-white/90">{format(new Date(date), 'MMM d')}</div>
            <div className="font-semibold text-emerald-300">₹{total.toFixed(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalesGrowthHeatmap;