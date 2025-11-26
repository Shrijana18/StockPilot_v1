

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

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>📆</span> Today's Smart Summary
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <p className="text-xs text-white/60 mb-1">Orders Delivered</p>
          <p className="text-2xl font-bold text-emerald-400">{summary.totalOrders}</p>
        </div>
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-xs text-white/60 mb-1">Revenue</p>
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.totalRevenue)}</p>
        </div>
        <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <p className="text-xs text-white/60 mb-1">Profit</p>
          <p className="text-2xl font-bold text-purple-400">{formatCurrency(summary.totalProfit)}</p>
          <p className="text-xs text-purple-300 mt-1">{summary.avgProfitPercent}% avg margin</p>
        </div>
      </div>
    </div>
  );
};

export default DailySmartSummary;