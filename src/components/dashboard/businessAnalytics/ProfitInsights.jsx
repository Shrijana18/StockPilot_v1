import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Select from "react-select";

const ProfitInsights = () => {
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
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

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // UI-only: react-select dark glass styles
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: 'rgba(255,255,255,0.10)',
      borderColor: 'rgba(255,255,255,0.20)',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(16,185,129,0.50)' : 'none',
      ':hover': { borderColor: 'rgba(255,255,255,0.30)' },
      color: '#fff'
    }),
    menu: (base) => ({
      ...base,
      background: 'rgba(11,15,20,0.90)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      zIndex: 1000
    }),
    menuList: (base) => ({ ...base, padding: 4 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'rgba(16,185,129,0.25)'
        : state.isFocused
        ? 'rgba(255,255,255,0.10)'
        : 'transparent',
      color: '#fff'
    }),
    singleValue: (base) => ({ ...base, color: '#fff' }),
    input: (base) => ({ ...base, color: '#fff' }),
    placeholder: (base) => ({ ...base, color: 'rgba(255,255,255,0.60)' }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(255,255,255,0.20)' }),
    dropdownIndicator: (base) => ({ ...base, color: '#fff' }),
    clearIndicator: (base) => ({ ...base, color: '#fff' }),
    valueContainer: (base) => ({ ...base, paddingTop: 2, paddingBottom: 2 })
  };

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

      const brandsArr = [...new Set(Object.values(productMap).map(p => p.brand).filter(Boolean))];
      const categoriesArr = [...new Set(Object.values(productMap).map(p => p.category).filter(Boolean))];

      let revenue = 0;
      let profit = 0;
      const profitMap = {};

      invoiceSnap.forEach(doc => {
        const data = doc.data();
        if (data.paymentMode === 'credit' && data.isPaid !== true) return;

        if ((startDate && new Date(data.createdAt) < new Date(startDate)) ||
            (endDate && new Date(data.createdAt) > new Date(endDate))) return;

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
        .sort((a, b) => b.profit - a.profit);

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
      setBrands(brandsArr);
      setCategories(categoriesArr);
      setLoading(false);
    };

    fetchData();
  }, [startDate, endDate]);

  if (loading) return <div className="p-5 text-white">Loading Profit Insights...</div>;

  return (
    <div className="p-6 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">📈 Profit Insights</h2>

      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Top N Products</label>
          <input
            type="number"
            min={1}
            value={productLimit}
            onChange={(e) => setProductLimit(Number(e.target.value))}
            className="rounded px-2 py-1 w-24 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Filter by Brand</label>
          <Select
            options={[{ label: "All Brands", value: "All" }, ...brands.map(b => ({ label: b, value: b }))]}
            value={{ label: selectedBrand, value: selectedBrand }}
            onChange={(option) => setSelectedBrand(option.value)}
            className="min-w-[180px] text-sm"
            styles={selectStyles}
            classNamePrefix="rs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Filter by Category</label>
          <Select
            options={[{ label: "All Categories", value: "All" }, ...categories.map(c => ({ label: c, value: c }))]}
            value={{ label: selectedCategory, value: selectedCategory }}
            onChange={(option) => setSelectedCategory(option.value)}
            className="min-w-[180px] text-sm"
            styles={selectStyles}
            classNamePrefix="rs"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {[
          { key: 'margin', title: '🔝 Highest Margin Products', data: [...topProducts].sort((a, b) => b.margin - a.margin) },
          { key: 'revenue', title: '💰 Most Revenue Products', data: [...topProducts].sort((a, b) => b.revenue - a.revenue) }
        ].map(section => (
          <div key={section.key} className="shadow rounded p-4 bg-white/10 backdrop-blur-xl border border-white/10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-white">{section.title}</h3>
              <button
                className="text-sm px-3 py-1 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                onClick={() => setViewMode(prev => ({ ...prev, [section.key]: prev[section.key] === "list" ? "chart" : "list" }))}
              >
                {viewMode[section.key] === "list" ? "📊 Chart" : "📋 List"}
              </button>
            </div>
            {viewMode[section.key] === "list" ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {section.data.slice(0, productLimit).map((item, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-white/10 pb-2 hover:bg-white/5 rounded">
                    <div>
                      <p className="font-medium text-white">{item.name}</p>
                      <p className="text-xs text-white/70">Revenue: ₹{item.revenue?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-300">Profit: ₹{item.profit?.toFixed(2)}</p>
                      <p className="text-xs text-white/70">Margin: {item.margin?.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
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

      <p className="text-white"><strong>Total Revenue:</strong> ₹{totalRevenue.toFixed(2)}</p>
      <p className="text-white"><strong>Total Profit:</strong> ₹{totalProfit.toFixed(2)}</p>
      <p className="text-white"><strong>Profit Margin:</strong> {(totalProfit / totalRevenue * 100).toFixed(1)}%</p>

    </div>
  );
};

export default ProfitInsights;