import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";

const InventoryForecast = () => {
  const [lowStockForecast, setLowStockForecast] = useState([]);
  const [timeRangeDays, setTimeRangeDays] = useState(30);

  useEffect(() => {
    const fetchInventoryForecast = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const invoicesSnap = await getDocs(invoicesRef);

        const now = new Date();
        const fromDate = new Date();
        fromDate.setDate(now.getDate() - timeRangeDays);

        const salesCount = {}; // inventoryId → quantity sold
        invoicesSnap.forEach(doc => {
          const data = doc.data();
          const createdAt =
            data.createdAt?.toDate?.() ??
            (typeof data.createdAt === "string" || typeof data.createdAt === "number"
              ? new Date(data.createdAt)
              : null);
          if (!createdAt || createdAt < fromDate) return;
          const cart = data.cart || data.cartItems || [];

          cart.forEach(item => {
            const id = item.inventoryId || item.id;
            if (!id) return;

            if (!salesCount[id]) {
              salesCount[id] = 0;
            }
            salesCount[id] += Number(item.quantity || 0);
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

          const avgDailySales = sold / timeRangeDays;
          const recommendedStock = avgDailySales * timeRangeDays;
          const reorderQty = Math.max(0, recommendedStock - stock);

          forecast.push({
            name: product.name,
            sku: product.sku,
            sold,
            avgDailySales: Math.round(avgDailySales),
            currentStock: stock,
            recommendedStock,
            reorderQty
          });
        }

        setLowStockForecast(forecast);
      } catch (error) {
        console.error('Error forecasting inventory:', error);
      }
    };

    fetchInventoryForecast();
  }, [timeRangeDays]);

  return (
    <div className="p-5 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <div className="mb-4">
        <label className="text-sm font-medium mr-2 text-white/80">Select Time Range:</label>
        <select
          value={timeRangeDays}
          onChange={(e) => setTimeRangeDays(Number(e.target.value))}
          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        >
          <option value={7}>Last 7 Days</option>
          <option value={15}>Last 15 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 3 Months</option>
          <option value={180}>Last 6 Months</option>
          <option value={365}>Last 1 Year</option>
        </select>
      </div>
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Inventory Forecast</h2>
      {lowStockForecast.length === 0 ? (
        <p className="text-white/70">No sales data available for the selected period.</p>
      ) : (
        <table className="min-w-full text-sm border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-white/10 text-left border-b border-white/10">
              <th className="p-2 text-white/80">Product</th>
              <th className="p-2 text-white/80">Sold</th>
              <th className="p-2 text-white/80">Daily Velocity</th>
              <th className="p-2 text-white/80">Stock</th>
              <th className="p-2 text-white/80">Recommended</th>
              <th className="p-2 text-white/80">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {lowStockForecast.map((item, index) => (
              <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                <td className="p-2 text-white/90">{item.name} ({item.sku})</td>
                <td className="p-2 text-white/90">{item.sold}</td>
                <td className="p-2 text-white/90">{item.avgDailySales}</td>
                <td className="p-2 text-white/90">{item.currentStock}</td>
                <td className="p-2 text-white/90">{item.recommendedStock}</td>
                <td className={`p-2 ${item.reorderQty > 0 ? "text-rose-300 font-semibold" : "text-white/60"}`}>
                  {item.reorderQty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InventoryForecast;