

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
    <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h3 className="text-md font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">⚠️ Low Stock Alerts</h3>
      {lowStockItems.length === 0 ? (
        <p className="text-sm text-white/70">All items are sufficiently stocked.</p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto pr-1">
          <ul className="space-y-2 text-sm">
            {lowStockItems.map((item) => (
              <li key={item.id} className="flex justify-between border-b border-white/10 pb-1 hover:bg-white/5 rounded">
                <span>{item.productName}</span>
                <span className="text-rose-300 font-semibold">{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LowStockAlertWidget;