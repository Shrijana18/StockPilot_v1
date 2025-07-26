

import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import dayjs from 'dayjs';

const DailySmartSummary = ({ distributorId }) => {
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProfit: 0,
    avgProfitPercent: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      const todayStart = dayjs().startOf('day').toDate();
      const todayEnd = dayjs().endOf('day').toDate();

      const ordersRef = collection(db, 'businesses', distributorId, 'orderRequests');
      const q = query(
        ordersRef,
        where('status', '==', 'Delivered'),
        where('timestamp', '>=', Timestamp.fromDate(todayStart)),
        where('timestamp', '<=', Timestamp.fromDate(todayEnd))
      );

      const querySnapshot = await getDocs(q);
      let totalOrders = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        totalOrders += 1;
        totalRevenue += data.totalAmount || 0;

        if (Array.isArray(data.items)) {
          data.items.forEach(item => {
            const unitProfit = (item.unitPrice || 0) - (item.price || 0);
            totalProfit += unitProfit * (parseInt(item.quantity) || 0);
          });
        }
      });

      const avgProfitPercent = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

      setSummary({
        totalOrders,
        totalRevenue,
        totalProfit,
        avgProfitPercent,
      });
    };

    if (distributorId) {
      fetchData();
    }
  }, [distributorId]);

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-2">📆 Today’s Smart Summary</h2>
      <p>✅ Orders Delivered: <strong>{summary.totalOrders}</strong></p>
      <p>💰 Revenue: <strong>₹{summary.totalRevenue}</strong></p>
      <p>📊 Profit: <strong>₹{summary.totalProfit}</strong> ({summary.avgProfitPercent}% avg profit)</p>
    </div>
  );
};

export default DailySmartSummary;