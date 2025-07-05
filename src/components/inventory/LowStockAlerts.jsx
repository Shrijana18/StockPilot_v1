// src/components/inventory/LowStockAlerts.jsx

import React, { useEffect, useState } from "react";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { app } from "../../firebase/firebaseConfig";

const LowStockAlerts = () => {
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    const fetchLowStockItems = async () => {
      const db = getFirestore(app);
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (!user) return;

      try {
        const productsRef = collection(db, "businesses", user.uid, "products");
        const q = query(productsRef, where("quantity", "<=", 5)); // Alert if quantity <= 5
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        setLowStockItems(results);
      } catch (error) {
        console.error("Error fetching low stock items:", error);
      }
    };

    fetchLowStockItems();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-red-600 mb-4">Low Stock Alerts</h2>
      {lowStockItems.length === 0 ? (
        <p className="text-gray-500">🎉 All products are well-stocked!</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {lowStockItems.map((item) => (
            <li key={item.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-md font-medium text-gray-800">{item.name}</p>
                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
              </div>
              <span className="text-sm font-semibold text-red-600">
                {item.quantity} left
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LowStockAlerts;