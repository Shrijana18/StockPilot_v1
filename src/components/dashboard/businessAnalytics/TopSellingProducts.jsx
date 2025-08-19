import React, { useEffect, useState } from 'react';
import Select from 'react-select';
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
  const [allBrands, setAllBrands] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const { selectedProduct, selectedDate } = useAnalyticsFilter();
  const [viewMode, setViewMode] = useState('chart');
  const [topN, setTopN] = useState(5);
  const [selectedBrands, setSelectedBrands] = useState(["All"]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [allTimeItemsSold, setAllTimeItemsSold] = useState(0);
  const [playAnimation, setPlayAnimation] = useState(false);
  const [timeRange, setTimeRange] = useState({ label: 'All Time', value: 'all' });

  useEffect(() => {
    const fetchTopSellingProducts = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);

        let totalAllTimeItems = 0;
        snapshot.forEach(doc => {
          const data = doc.data();

          const cart = data.cartItems || data.cart || [];
          cart.forEach(item => {
            const quantity = Number(item.quantity || 0);
            if (!isNaN(quantity)) totalAllTimeItems += quantity;
          });
        });
        setAllTimeItemsSold(totalAllTimeItems);

        const productSalesMap = {};

        const today = new Date();
        const shouldIncludeInvoice = (invoiceDate) => {
          if (!timeRange || timeRange.value === 'all') return true;

          const dateOnly = new Date(invoiceDate.toDate ? invoiceDate.toDate() : invoiceDate);
          const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

          if (timeRange.value === 'today') {
            return dateOnly.toDateString() === todayDate.toDateString();
          }

          if (timeRange.value === 'last7') {
            const lastWeek = new Date(todayDate);
            lastWeek.setDate(lastWeek.getDate() - 6);
            return dateOnly >= lastWeek && dateOnly <= todayDate;
          }

          if (timeRange.value === 'month') {
            return (
              dateOnly.getMonth() === todayDate.getMonth() &&
              dateOnly.getFullYear() === todayDate.getFullYear()
            );
          }

          return true;
        };

        snapshot.forEach(doc => {
          const data = doc.data();

          // Include all invoices, including unpaid credit ones
          const cart = data.cartItems || data.cart || [];

          if (!shouldIncludeInvoice(data.timestamp || data.issuedAt)) return;

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
                category: item.category || "—",
                quantity: 0,
              };
            }

            productSalesMap[key].quantity += quantity;
            if (!productSalesMap[key].salesTrend) {
              productSalesMap[key].salesTrend = [];
            }
            // Safer timestamp handling
            let invoiceDateRaw = data.timestamp || data.issuedAt;
            let invoiceDate;

            if (invoiceDateRaw?.toDate) {
              invoiceDate = invoiceDateRaw.toDate();
            } else if (typeof invoiceDateRaw === "string" || typeof invoiceDateRaw === "number") {
              invoiceDate = new Date(invoiceDateRaw);
            }

            if (!invoiceDate || isNaN(invoiceDate)) return;

            productSalesMap[key].salesTrend.push({ x: invoiceDate.toISOString(), y: quantity });
          });
        });

        // Filter by brand if selected (skip if "All" is selected)
        let filteredProducts = Object.values(productSalesMap);
        if (!(selectedBrands.includes("All"))) {
          if (selectedBrands.length > 0) {
            filteredProducts = filteredProducts.filter(p => selectedBrands.includes(p.brand));
          }
        }
        // Filter by category if selected (skip if "All" or empty)
        if (selectedCategory && selectedCategory !== "All") {
          filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
        }

        // Also update the brand/category list from the full filteredProducts
        setAllBrands(Array.from(new Set(filteredProducts.map(p => p.brand))).filter(b => b && b !== "—"));
        setAllCategories(Array.from(new Set(filteredProducts.map(p => p.category))).filter(c => c && c !== "—"));

        const sortedProducts = filteredProducts
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, topN)
          .map((product, index) => ({ ...product, rank: index + 1 }));

        setTopProducts(sortedProducts);
      } catch (error) {
        console.error('Error fetching top-selling products:', error);
      }
    };

    fetchTopSellingProducts();
  }, [selectedProduct, selectedDate, topN, selectedBrands, selectedCategory, timeRange]);

  const totalItemsSold = topProducts.reduce((sum, p) => sum + p.quantity, 0);
  const brandSalesMap = {};
  topProducts.forEach(p => {
    brandSalesMap[p.brand] = (brandSalesMap[p.brand] || 0) + p.quantity;
  });
  const topBrand = Object.entries(brandSalesMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // const uniqueBrands = Array.from(new Set(topProducts.map(p => p.brand))).filter(b => b && b !== "—");
  // const uniqueCategories = Array.from(new Set(topProducts.map(p => p.category))).filter(c => c && c !== "—");

  const toggleBrand = (brand) => {
    if (selectedBrands.includes(brand)) {
      setSelectedBrands(selectedBrands.filter(b => b !== brand));
    } else {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const resetBrands = () => {
    setSelectedBrands([]);
  };

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
    multiValue: (base) => ({
      ...base,
      background: 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.20)'
    }),
    multiValueLabel: (base) => ({ ...base, color: '#fff' }),
    multiValueRemove: (base) => ({
      ...base,
      color: '#fff',
      ':hover': { background: 'rgba(239,68,68,0.30)', color: '#fff' }
    }),
    input: (base) => ({ ...base, color: '#fff' }),
    placeholder: (base) => ({ ...base, color: 'rgba(255,255,255,0.60)' }),
    indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgba(255,255,255,0.20)' }),
    dropdownIndicator: (base) => ({ ...base, color: '#fff' }),
    clearIndicator: (base) => ({ ...base, color: '#fff' }),
    valueContainer: (base) => ({ ...base, paddingTop: 2, paddingBottom: 2 })
  };

return (
    <div className="p-5 rounded-lg bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Top Selling Products</h2>
      <div className="flex gap-4 mb-3 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-white/80">Top N Products:</label>
          <input
            type="number"
            min="1"
            max="50"
            value={topN || ""}
            placeholder="Enter number"
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                setTopN('');
              } else {
                const num = Number(val);
                if (!isNaN(num)) setTopN(num);
              }
            }}
            className="rounded px-2 py-1 w-24 text-sm bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Filter by Brand:</label>
          <Select
            isMulti
            options={[{ label: "All Brands", value: "All" }, ...allBrands.map(b => ({ label: b, value: b }))]}
            value={
              selectedBrands.includes("All")
                ? [{ label: "All Brands", value: "All" }]
                : selectedBrands.map(b => ({ label: b, value: b }))
            }
            onChange={(selected) => {
              if (selected.some(opt => opt.value === "All")) {
                setSelectedBrands(["All"]);
              } else {
                setSelectedBrands(selected.map(option => option.value));
              }
            }}
            placeholder="Select brands..."
            className="min-w-[180px] text-sm"
            styles={selectStyles}
            classNamePrefix="rs"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Filter by Category:</label>
          <Select
            options={[{ label: "All Categories", value: "All" }, ...allCategories.map(c => ({ label: c, value: c }))]}
            value={
              selectedCategory && selectedCategory !== "All"
                ? { label: selectedCategory, value: selectedCategory }
                : { label: "All Categories", value: "All" }
            }
            onChange={(selected) => setSelectedCategory(selected ? selected.value : "All")}
            placeholder="Select category..."
            className="min-w-[180px] text-sm"
            styles={selectStyles}
            classNamePrefix="rs"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Time Range:</label>
          <Select
            options={[
              { label: 'Today', value: 'today' },
              { label: 'Last 7 Days', value: 'last7' },
              { label: 'This Month', value: 'month' },
              { label: 'All Time', value: 'all' },
            ]}
            value={timeRange ? { label: timeRange.label, value: timeRange.value } : null}
            onChange={(selected) => setTimeRange(selected)}
            placeholder="Select time range..."
            className="min-w-[160px] text-sm"
            styles={selectStyles}
            classNamePrefix="rs"
          />
        </div>
      </div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
          className="text-sm px-3 py-1 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
        >
          {viewMode === 'chart' ? 'Show as Table' : 'Show as Chart'}
        </button>
        <button
          onClick={() => setPlayAnimation(!playAnimation)}
          className="text-sm px-3 py-1 rounded-xl font-medium ml-2 text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
        >
          {playAnimation ? 'Stop Animation' : 'Play Animation'}
        </button>
      </div>
      {topProducts.length === 0 ? (
        <p className="text-white/70">No data available</p>
      ) : (
        <>
          {viewMode === 'chart' ? (
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
                        <div className="rounded px-3 py-2 text-sm border border-white/10 bg-[#0B0F14]/80 backdrop-blur-xl text-white">
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
                <Bar dataKey="quantity" fill="#4f46e5" radius={[4, 4, 0, 0]} isAnimationActive={playAnimation}>
                  {topProducts.map((entry) => (
                    <text
                      key={`rank-${entry.rank}`}
                      x={0}
                      y={0}
                      dy={-10}
                      dx={-10}
                      fill="#4f46e5"
                      fontWeight="bold"
                      fontSize={14}
                      textAnchor="middle"
                    >
                      {entry.rank}
                    </text>
                  ))}
                </Bar>
              </BarChart>
              {/* Render rank badges above each bar */}
              <div className="flex justify-between mt-2 px-6">
                {topProducts.map(product => (
                  <div
                    key={product.rank}
                    className="text-white/80 font-bold text-sm"
                    style={{ width: `${100 / topProducts.length}%`, textAlign: 'center' }}
                  >
                    #{product.rank}
                  </div>
                ))}
              </div>
            </ResponsiveContainer>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-white/10">
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">Rank</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">Product Name</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">SKU</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">Brand</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">Unit</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">Items Sold</th>
                    <th className="px-3 py-2 text-left text-sm font-semibold text-white/80 border-b border-white/10">Sales Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(product => (
                    <tr key={product.rank} className="hover:bg-white/5 border-t border-white/10">
                      <td className="px-3 py-2 text-sm border-t border-white/10">{product.rank}</td>
                      <td className="px-3 py-2 text-sm border-t border-white/10">{product.name}</td>
                      <td className="px-3 py-2 text-sm border-t border-white/10">{product.sku}</td>
                      <td className="px-3 py-2 text-sm border-t border-white/10">{product.brand}</td>
                      <td className="px-3 py-2 text-sm border-t border-white/10">{product.unit}</td>
                      <td className="px-3 py-2 text-sm border-t border-white/10">{product.quantity}</td>
                      <td className="px-3 py-2 text-sm border-t border-white/10">
                        <ResponsiveContainer width={80} height={30}>
                          <BarChart data={product.salesTrend || []}>
                            <Bar dataKey="y" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 border-t border-white/10 pt-3 text-sm text-white/90 flex justify-between flex-wrap gap-6">
            <div>
              <p><span className="font-semibold">Total Items Sold (Filtered):</span> {totalItemsSold}</p>
              <p><span className="font-semibold">Top Brand:</span> {topBrand}</p>
            </div>
            <div>
              <p><span className="font-semibold">All Time Items Sold:</span> {allTimeItemsSold}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TopSellingProducts;