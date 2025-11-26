

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';

const BrandPerformanceTracker = ({ distributorId }) => {
  const [brandStats, setBrandStats] = useState([]);

  useEffect(() => {
    const fetchBrandStats = async () => {
      const ordersRef = collection(db, 'businesses', distributorId, 'orderRequests');
      const snapshot = await getDocs(ordersRef);

      const brandMap = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'Delivered' && Array.isArray(data.items)) {
          data.items.forEach(item => {
            const brand = item.brand || 'Unknown';
            const quantity = parseInt(item.quantity) || 0;
            const revenue = (item.unitPrice || 0) * quantity;
            const cost = (item.price || 0) * quantity;
            const profit = revenue - cost;

            if (!brandMap[brand]) {
              brandMap[brand] = { quantity: 0, revenue: 0, profit: 0 };
            }

            brandMap[brand].quantity += quantity;
            brandMap[brand].revenue += revenue;
            brandMap[brand].profit += profit;
          });
        }
      });

      const brandList = Object.entries(brandMap).map(([brand, data]) => ({
        brand,
        ...data,
      }));

      brandList.sort((a, b) => b.profit - a.profit);

      setBrandStats(brandList);
    };

    if (distributorId) {
      fetchBrandStats();
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
        <span>📊</span> Brand Performance Tracker
      </h2>
      {brandStats.length === 0 ? (
        <p className="text-white/60">No brand data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/20">
                <th className="py-2 px-3 text-white/80">Brand</th>
                <th className="py-2 px-3 text-right text-white/80">Units Sold</th>
                <th className="py-2 px-3 text-right text-white/80">Revenue</th>
                <th className="py-2 px-3 text-right text-white/80">Profit</th>
                <th className="py-2 px-3 text-right text-white/80">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {brandStats.map((b, index) => {
                const margin = b.revenue > 0 ? (b.profit / b.revenue) * 100 : 0;
                return (
                  <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 text-white font-medium">{b.brand}</td>
                    <td className="py-2 px-3 text-right text-white">{b.quantity.toLocaleString("en-IN")}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                      {formatCurrency(b.revenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-purple-400 font-semibold">
                      {formatCurrency(b.profit)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          margin >= 20
                            ? "bg-emerald-500/20 text-emerald-300"
                            : margin >= 10
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BrandPerformanceTracker;