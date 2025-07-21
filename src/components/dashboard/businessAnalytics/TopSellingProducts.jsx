

import React, { useEffect, useState } from 'react';
import { useAnalyticsFilter } from "../../../context/AnalyticsFilterContext";
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const TopSellingProducts = () => {
  const [topProducts, setTopProducts] = useState([]);
  const { selectedProduct, selectedDate } = useAnalyticsFilter();

  useEffect(() => {
    const fetchTopSellingProducts = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);

        const productSalesMap = {};

        snapshot.forEach(doc => {
          const data = doc.data();
          // Date filter
          if (selectedDate) {
            const invoiceDate = new Date(data.timestamp || data.issuedAt?.toDate?.() || data.issuedAt);
            const formatted = invoiceDate.toISOString().split('T')[0];
            if (formatted !== selectedDate) return;
          }
          const cart = data.cartItems || data.cart || [];

          cart.forEach(item => {
            // Product filter
            if (selectedProduct && item.sku !== selectedProduct) return;
            const key = item.sku || item.name || item.id;
            if (!key) return;

            const quantity = Number(item.quantity || 0);
            if (quantity <= 0) return;

            if (!productSalesMap[key]) {
              productSalesMap[key] = {
                name: item.name || "Unnamed",
                sku: item.sku || "-",
                brand: item.brand || "—",
                unit: item.unit || "—",
                quantity: 0,
              };
            }

            productSalesMap[key].quantity += quantity;
          });
        });

        const sortedProducts = Object.values(productSalesMap)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        setTopProducts(sortedProducts);
      } catch (error) {
        console.error('Error fetching top-selling products:', error);
      }
    };

    fetchTopSellingProducts();
  }, [selectedProduct, selectedDate]);

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Top Selling Products</h2>
      {topProducts.length === 0 ? (
        <p className="text-gray-500">No data available</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const product = payload[0].payload;
                    return (
                      <div className="bg-white shadow-md rounded px-3 py-2 border text-sm">
                        <p className="font-semibold">{product.name}</p>
                        <p>Brand: {product.brand}</p>
                        <p>SKU: {product.sku}</p>
                        <p>Unit: {product.unit}</p>
                        <p>Items Sold: {product.quantity}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="quantity" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};

export default TopSellingProducts;