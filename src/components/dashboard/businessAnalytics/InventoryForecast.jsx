


import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";

const InventoryForecast = () => {
  const [lowStockForecast, setLowStockForecast] = useState([]);

  useEffect(() => {
    const fetchInventoryForecast = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const invoicesSnap = await getDocs(invoicesRef);

        const salesCount = {}; // inventoryId → quantity sold
        invoicesSnap.forEach(doc => {
          const data = doc.data();
          const cart = data.cart || [];

          cart.forEach(item => {
            const id = item.inventoryId;
            if (!id) return;

            if (!salesCount[id]) {
              salesCount[id] = 0;
            }
            salesCount[id] += item.quantity || 0;
          });
        });

        const forecast = [];

        for (const id of Object.keys(salesCount)) {
          const productRef = doc(db, 'businesses', user.uid, 'products', id);
          const productSnap = await getDoc(productRef);
          if (!productSnap.exists()) continue;

          const product = productSnap.data();
          const stock = product.quantity || 0;
          const sold = salesCount[id];

          const daysLeft = sold > 0 ? Math.floor(stock / (sold / 30)) : '∞'; // approx based on 30 days

          if (daysLeft !== '∞' && daysLeft <= 7) {
            forecast.push({
              name: product.name,
              sku: product.sku,
              quantityLeft: stock,
              avgDailySales: Math.round(sold / 30),
              daysRemaining: daysLeft
            });
          }
        }

        setLowStockForecast(forecast);
      } catch (error) {
        console.error('Error forecasting inventory:', error);
      }
    };

    fetchInventoryForecast();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Inventory Forecast</h2>
      {lowStockForecast.length === 0 ? (
        <p className="text-gray-500">No low-stock predictions at the moment.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {lowStockForecast.map((item, index) => (
            <li key={index} className="py-2">
              <p className="font-medium">{item.name} ({item.sku})</p>
              <p className="text-sm text-gray-600">
                Stock Left: {item.quantityLeft} • Avg Daily Sale: {item.avgDailySales} • Days Remaining: {item.daysRemaining}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InventoryForecast;