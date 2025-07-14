

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';

const LowStockAlertWidget = ({ userId }) => {
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    const fetchLowStockItems = async () => {
      try {
        if (!userId) return;
        const q = collection(db, 'businesses', userId, 'products');
        const snapshot = await getDocs(q);
        const lowStock = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const quantity = parseInt(data.quantity, 10);
          if (quantity <= 5) {
            lowStock.push({ ...data, id: doc.id });
          }
        });
        setLowStockItems(lowStock);
      } catch (error) {
        console.error('Error fetching low stock items:', error);
      }
    };

    fetchLowStockItems();
  }, [userId]);

  return (
    <div className="bg-white rounded shadow p-4 border">
      <h3 className="text-md font-semibold mb-2 text-red-600">⚠️ Low Stock Alerts</h3>
      {lowStockItems.length === 0 ? (
        <p className="text-sm text-gray-500">All items are sufficiently stocked.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {lowStockItems.map((item) => (
            <li key={item.id} className="flex justify-between border-b pb-1">
              <span>{item.productName}</span>
              <span className="text-red-500 font-semibold">{item.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LowStockAlertWidget;