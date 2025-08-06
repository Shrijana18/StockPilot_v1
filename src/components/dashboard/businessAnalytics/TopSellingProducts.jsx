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

  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="text-xl font-semibold mb-4">Top Selling Products</h2>
      <div className="flex gap-4 mb-3 flex-wrap">
        <div>
          <label className="block text-sm font-medium">Top N Products:</label>
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
            className="border rounded px-2 py-1 w-24 text-sm placeholder-gray-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Filter by Brand:</label>
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
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Filter by Category:</label>
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
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Time Range:</label>
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
          />
        </div>
      </div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1 rounded"
        >
          {viewMode === 'chart' ? 'Show as Table' : 'Show as Chart'}
        </button>
        <button
          onClick={() => setPlayAnimation(!playAnimation)}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded ml-2"
        >
          {playAnimation ? 'Stop Animation' : 'Play Animation'}
        </button>
      </div>
      {topProducts.length === 0 ? (
        <p className="text-gray-500">No data available</p>
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
                    className="text-indigo-600 font-bold text-sm"
                    style={{ width: `${100 / topProducts.length}%`, textAlign: 'center' }}
                  >
                    #{product.rank}
                  </div>
                ))}
              </div>
            </ResponsiveContainer>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Rank</th>
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Product Name</th>
                    <th className="border px-3 py-2 text-left text-sm font-semibold">SKU</th>
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Brand</th>
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Unit</th>
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Items Sold</th>
                    <th className="border px-3 py-2 text-left text-sm font-semibold">Sales Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(product => (
                    <tr key={product.rank} className="odd:bg-white even:bg-gray-50">
                      <td className="border px-3 py-2 text-sm">{product.rank}</td>
                      <td className="border px-3 py-2 text-sm">{product.name}</td>
                      <td className="border px-3 py-2 text-sm">{product.sku}</td>
                      <td className="border px-3 py-2 text-sm">{product.brand}</td>
                      <td className="border px-3 py-2 text-sm">{product.unit}</td>
                      <td className="border px-3 py-2 text-sm">{product.quantity}</td>
                      <td className="border px-3 py-2 text-sm">
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
          <div className="mt-4 border-t pt-3 text-sm text-gray-700 flex justify-between flex-wrap gap-6">
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