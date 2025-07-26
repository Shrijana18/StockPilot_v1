

import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import dayjs from 'dayjs';

const InventoryDrainForecast = ({ distributorId }) => {
  const [forecastData, setForecastData] = useState([]);

  useEffect(() => {
    const fetchForecast = async () => {
      const ordersRef = collection(db, 'businesses', distributorId, 'orderRequests');
      const snapshot = await getDocs(ordersRef);

      const productSales = {};

      // Accumulate sales over the last 7 days
      const today = dayjs();
      const oneWeekAgo = today.subtract(7, 'day');

      snapshot.forEach(doc => {
        const data = doc.data();
        const orderDate = dayjs(data.timestamp?.toDate?.() || data.timestamp);

        if (orderDate.isAfter(oneWeekAgo) && Array.isArray(data.items)) {
          data.items.forEach(item => {
            const id = item.distributorProductId;
            const quantity = parseInt(item.quantity) || 0;
            if (!productSales[id]) {
              productSales[id] = { name: item.productName, sold: 0 };
            }
            productSales[id].sold += quantity;
          });
        }
      });

      const result = [];

      for (const productId in productSales) {
        const productDocRef = doc(db, 'businesses', distributorId, 'products', productId);
        const productSnap = await getDoc(productDocRef);
        const productData = productSnap.data();

        if (productData) {
          const currentStock = parseInt(productData.quantity || 0);
          const avgDailySale = productSales[productId].sold / 7;
          const daysLeft = avgDailySale > 0 ? Math.floor(currentStock / avgDailySale) : '∞';

          result.push({
            name: productSales[productId].name,
            currentStock,
            avgDailySale: avgDailySale.toFixed(1),
            daysLeft,
          });
        }
      }

      setForecastData(result);
    };

    if (distributorId) fetchForecast();
  }, [distributorId]);

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-2">📦 Inventory Drain Forecast</h2>
      {forecastData.length === 0 ? (
        <p>No data available for forecast.</p>
      ) : (
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Product</th>
              <th className="py-1">Stock</th>
              <th className="py-1">Avg Sold/Day</th>
              <th className="py-1">Est. Days Left</th>
            </tr>
          </thead>
          <tbody>
            {forecastData.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="py-1">{item.name}</td>
                <td className="py-1">{item.currentStock}</td>
                <td className="py-1">{item.avgDailySale}</td>
                <td className="py-1">{item.daysLeft}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InventoryDrainForecast;