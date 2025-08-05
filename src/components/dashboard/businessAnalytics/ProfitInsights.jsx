import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ProfitInsights = () => {
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [highestMargin, setHighestMargin] = useState(null);
  const [mostRevenue, setMostRevenue] = useState(null);
  const [highMarginLowRevenue, setHighMarginLowRevenue] = useState(null);
  const [totalTopPercent, setTotalTopPercent] = useState(0);

  const [viewMode, setViewMode] = useState({
    margin: "list",
    revenue: "list",
    lowMargin: "list",
    profit: "list"
  });
  const [productLimit, setProductLimit] = useState(5);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
      const productsRef = collection(db, 'businesses', user.uid, 'products');
      const [invoiceSnap, productSnap] = await Promise.all([getDocs(invoicesRef), getDocs(productsRef)]);

      const productMap = {};
      productSnap.forEach(doc => {
        productMap[doc.id] = doc.data();
      });

      const brands = [...new Set(Object.values(productMap).map(p => p.brand))];
      const categories = [...new Set(Object.values(productMap).map(p => p.category))];

      let revenue = 0;
      let profit = 0;
      const profitMap = {};

      invoiceSnap.forEach(doc => {
        const data = doc.data();
        if (data.paymentMode === 'credit' && data.isPaid !== true) return;

        const invoiceRevenue = Number(data.totalAmount) || 0;
        revenue += invoiceRevenue;

        const cart = Array.isArray(data.cartItems) ? data.cartItems : [];
        cart.forEach(item => {
          const product = productMap[item.id];
          if (!product) return;

          const cost = Number(product.costPrice || 0);
          const sell = Number(item.price || 0);
          const qty = Number(item.quantity || 0);
          const itemProfit = (sell - cost) * qty;
          const itemRevenue = sell * qty;
          profit += itemProfit;

          const key = item.sku || item.name;
          if (!profitMap[key]) {
            profitMap[key] = {
              name: item.name,
              sku: item.sku,
              brand: product.brand || '—',
              unit: product.unit || '—',
              profit: 0,
              revenue: 0,
              margin: 0,
              cost: 0
            };
          }

          profitMap[key].profit += itemProfit;
          profitMap[key].revenue += itemRevenue;
          profitMap[key].cost = profitMap[key].revenue - profitMap[key].profit;
        });
      });

      const sorted = Object.values(profitMap)
        .map(p => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

      const highestMargin = sorted.reduce((a, b) => (a.margin > b.margin ? a : b));
      const mostRevenue = sorted.reduce((a, b) => (a.revenue > b.revenue ? a : b));
      const highMarginLowRevenue = sorted.filter(p => p.margin > 30).sort((a, b) => a.revenue - b.revenue)[0];
      const topProfit = sorted.slice(0, 3);
      const topProfitSum = topProfit.reduce((sum, p) => sum + p.profit, 0);
      const totalTopPercent = (topProfitSum / profit) * 100;

      setTotalRevenue(revenue);
      setTotalProfit(profit);
      setTopProducts(sorted);
      setHighestMargin(highestMargin);
      setMostRevenue(mostRevenue);
      setHighMarginLowRevenue(highMarginLowRevenue);
      setTotalTopPercent(totalTopPercent);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-5">Loading Profit Insights...</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Profit Insights</h2>

      <div className="flex gap-4 mb-4">
        <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="border p-1 rounded">
          <option>All</option>
          {[...new Set(topProducts.map(p => p.brand))].map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="border p-1 rounded">
          <option>All</option>
          {[...new Set(topProducts.map(p => p.category))].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-4 items-center">
        <label className="text-sm font-medium">Products to show:</label>
        <input
          type="number"
          min={1}
          value={productLimit}
          onChange={(e) => setProductLimit(Number(e.target.value))}
          className="border rounded px-2 py-1 w-20"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { key: 'margin', title: '🔝 Highest Margin Products', data: [...topProducts].sort((a, b) => b.margin - a.margin) },
          { key: 'revenue', title: '💰 Most Revenue Products', data: [...topProducts].sort((a, b) => b.revenue - a.revenue) },
          { key: 'lowMargin', title: '📉 High Margin, Low Revenue', data: [...topProducts].filter(p => p.margin > 30).sort((a, b) => a.revenue - b.revenue) },
          { key: 'profit', title: '📊 Top Profit Contributors', data: [...topProducts].sort((a, b) => b.profit - a.profit) }
        ].map(section => (
          <div key={section.key} className="bg-white shadow rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{section.title}</h3>
              <button
                className="text-blue-500 text-sm"
                onClick={() => setViewMode(prev => ({ ...prev, [section.key]: prev[section.key] === "list" ? "chart" : "list" }))}
              >
                {viewMode[section.key] === "list" ? "📊 Chart" : "📋 List"}
              </button>
            </div>
            {viewMode[section.key] === "list" ? (
              <ul className="list-disc list-inside text-sm">
                {section.data.slice(0, productLimit).map((item, i) => (
                  <li key={i}>
                    {item.name} | Profit: ₹{item.profit.toFixed(2)} | Margin: {item.margin.toFixed(1)}%
                  </li>
                ))}
              </ul>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={section.data.slice(0, productLimit)}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="profit" fill="#22c55e" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
          <p className="font-semibold">🔝 Highest Margin Product</p>
          <p className="text-sm text-gray-700">{highestMargin?.name} ({highestMargin?.margin.toFixed(1)}%)</p>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <p className="font-semibold">💰 Most Revenue Product</p>
          <p className="text-sm text-gray-700">{mostRevenue?.name} (₹{mostRevenue?.revenue.toFixed(2)})</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <p className="font-semibold">📉 High Margin, Low Revenue</p>
          <p className="text-sm text-gray-700">{highMarginLowRevenue?.name} (₹{highMarginLowRevenue?.revenue.toFixed(2)})</p>
        </div>
        <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded">
          <p className="font-semibold">📊 Top 3 = {totalTopPercent.toFixed(1)}%</p>
          <p className="text-sm text-gray-700">of Total Profit</p>
        </div>
      </div>

      <p><strong>Total Revenue:</strong> ₹{totalRevenue.toFixed(2)}</p>
      <p><strong>Total Profit:</strong> ₹{totalProfit.toFixed(2)}</p>
      <p><strong>Profit Margin:</strong> {(totalProfit / totalRevenue * 100).toFixed(1)}%</p>

    </div>
  );
};

export default ProfitInsights;