import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import { useAnalyticsFilter } from "../../../context/AnalyticsFilterContext";
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#22c55e', '#f97316', '#06b6d4', '#e11d48'];

const ProfitInsights = () => {
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [topProfitItems, setTopProfitItems] = useState([]);
  const [revenueVsProfit, setRevenueVsProfit] = useState([]);

  const { selectedProduct, selectedDate } = useAnalyticsFilter();

  useEffect(() => {
    const fetchProfitData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);

        const productProfitMap = {};
        let total = 0;
        let totalRevenueAll = 0;

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const cart = Array.isArray(data.cartItems) ? data.cartItems : [];

          const invoiceDateObj = data.timestamp?.toDate?.();
          const invoiceDate = invoiceDateObj?.toISOString().split('T')[0];
          if (selectedDate && invoiceDate !== selectedDate) continue;

          for (const item of cart) {
            if (selectedProduct && item.sku !== selectedProduct) continue;

            const productId = item.id;
            if (!productId) continue;

            const productRef = doc(db, 'businesses', user.uid, 'products', productId);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) continue;

            const product = productSnap.data();
            const costPrice = Number(product?.costPrice || 0);
            const sellingPrice = parseFloat(item?.price || "0");
            const quantity = Number(item?.quantity || 0);

            if (costPrice === 0 || sellingPrice === 0) {
              console.log('Unexpected cost or price:', {
                product,
                item,
                costPrice,
                sellingPrice
              });
            }

            const profit = (sellingPrice - costPrice) * quantity;
            const revenue = sellingPrice * quantity;
            total += profit;
            totalRevenueAll += revenue;

            const key = item.sku || item.name;
            if (!productProfitMap[key]) {
              productProfitMap[key] = {
                name: item.name,
                sku: item.sku,
                brand: product.brand || '—',
                unit: product?.unit?.trim() || '—',
                profit: 0,
                revenue: 0
              };
            }

            productProfitMap[key].profit += profit;
            productProfitMap[key].revenue += revenue;
          }
        }

        const sortedProfitItems = Object.values(productProfitMap)
          .filter(item => item.profit > 0)
          .sort((a, b) => b.profit - a.profit)
          .slice(0, 5);

        setTotalProfit(total);
        setTotalRevenue(totalRevenueAll);
        const overallMargin = totalRevenueAll > 0 ? (total / totalRevenueAll) * 100 : 0;

        setTopProfitItems(sortedProfitItems);
        setRevenueVsProfit(sortedProfitItems.map(item => ({
          name: item.name,
          revenue: item.revenue,
          profit: item.profit,
          margin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0
        })));
      } catch (error) {
        console.error('Error calculating profit:', error);
      }
    };

    fetchProfitData();
  }, [selectedProduct, selectedDate]);

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Profit Insights</h2>
      <p><strong>Total Revenue:</strong> ₹{totalRevenue.toFixed(2)}</p>
      <p><strong>Total Profit:</strong> ₹{totalProfit.toFixed(2)}</p>
      <p><strong>Profit Margin:</strong> {((totalProfit / totalRevenue) * 100).toFixed(1)}%</p>

      <div className="my-6" style={{ width: '100%', height: 280, display: 'flex', gap: '2rem' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={topProfitItems}
              dataKey="profit"
              nameKey="name"
              outerRadius={100}
              label
            >
              {topProfitItems.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueVsProfit} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              formatter={(value, name, props) => {
                const item = revenueVsProfit.find(i => i.name === props.payload.name);
                if (name === 'Margin') return [`${item?.margin.toFixed(1)}%`, 'Margin'];
                return [`₹${value.toFixed(2)}`, name];
              }}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#4f46e5" name="Revenue" />
            <Bar dataKey="profit" fill="#22c55e" name="Profit" />
            <Bar dataKey="margin" fill="#facc15" name="Margin" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <h3 className="font-medium mb-2">Top Profit Generating Products:</h3>
        <ul className="list-disc list-inside">
          {topProfitItems.map((item, index) => (
            <li key={index}>
              {item.name} | Brand: {item.brand} | Unit: {item.unit} | SKU: {item.sku} | Profit: ₹{item.profit.toFixed(2)}
            </li>
          ))}
          {topProfitItems.length === 0 && (
            <li className="text-gray-500">No data available</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default ProfitInsights;
