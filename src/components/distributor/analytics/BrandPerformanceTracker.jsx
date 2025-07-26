

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

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-2">📊 Brand Performance Tracker</h2>
      {brandStats.length === 0 ? (
        <p>No brand data available.</p>
      ) : (
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Brand</th>
              <th className="py-1">Units Sold</th>
              <th className="py-1">Revenue</th>
              <th className="py-1">Profit</th>
            </tr>
          </thead>
          <tbody>
            {brandStats.map((b, index) => (
              <tr key={index} className="border-b">
                <td className="py-1">{b.brand}</td>
                <td className="py-1">{b.quantity}</td>
                <td className="py-1">₹{b.revenue}</td>
                <td className="py-1">₹{b.profit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BrandPerformanceTracker;