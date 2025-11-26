

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
    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>📦</span> Inventory Drain Forecast
      </h2>
      {forecastData.length === 0 ? (
        <p className="text-white/60">No data available for forecast.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/20">
                <th className="py-2 px-3 text-white/80">Product</th>
                <th className="py-2 px-3 text-right text-white/80">Stock</th>
                <th className="py-2 px-3 text-right text-white/80">Avg Sold/Day</th>
                <th className="py-2 px-3 text-right text-white/80">Est. Days Left</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.map((item, index) => {
                const daysLeft = typeof item.daysLeft === "number" ? item.daysLeft : Infinity;
                const isCritical = daysLeft < 7;
                const isLow = daysLeft < 30;
                return (
                  <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 text-white font-medium">{item.name}</td>
                    <td className="py-2 px-3 text-right text-white">{item.currentStock}</td>
                    <td className="py-2 px-3 text-right text-white/60">{item.avgDailySale}</td>
                    <td className="py-2 px-3 text-right">
                      {daysLeft === Infinity ? (
                        <span className="text-white/40">∞</span>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isCritical
                              ? "bg-red-500/20 text-red-300"
                              : isLow
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {daysLeft} days
                        </span>
                      )}
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

export default InventoryDrainForecast;