

import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";

const SmartSuggestionsPanel = () => {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const generateSuggestions = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const productsRef = collection(db, 'businesses', user.uid, 'products');

        const invoicesSnap = await getDocs(invoicesRef);
        const productsSnap = await getDocs(productsRef);

        let totalRevenue = 0;
        const productSalesMap = {};
        const lowStockProducts = [];

        invoicesSnap.forEach(doc => {
          const data = doc.data();
          totalRevenue += data.totalAmount || 0;

          const cart = data.cart || [];
          cart.forEach(item => {
            const key = item.sku || item.name;
            if (!key) return;

            if (!productSalesMap[key]) {
              productSalesMap[key] = 0;
            }
            productSalesMap[key] += item.quantity || 0;
          });
        });

        productsSnap.forEach(doc => {
          const product = doc.data();
          if ((product.quantity || 0) < 10) {
            lowStockProducts.push(product.name);
          }
        });

        const topProducts = Object.entries(productSalesMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([name, qty]) => `Consider bundling "${name}" in offers. High sales volume.`);

        const lowStockTips = lowStockProducts.map(name => `Restock soon: "${name}" is running low.`);

        const insights = [
          `🧠 Total Revenue so far: ₹${totalRevenue.toFixed(0)}.`,
          ...topProducts,
          ...lowStockTips,
        ];

        setSuggestions(insights);
      } catch (error) {
        console.error('Error generating smart suggestions:', error);
      }
    };

    generateSuggestions();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Smart Suggestions</h2>
      <ul className="list-disc list-inside space-y-1">
        {suggestions.map((text, index) => (
          <li key={index} className="text-gray-700">{text}</li>
        ))}
        {suggestions.length === 0 && (
          <li className="text-gray-500">Generating suggestions...</li>
        )}
      </ul>
    </div>
  );
};

export default SmartSuggestionsPanel;