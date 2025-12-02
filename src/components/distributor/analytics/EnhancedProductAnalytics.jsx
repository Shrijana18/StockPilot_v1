import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import dayjs from "dayjs";
import { motion } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const EnhancedProductAnalytics = ({ distributorId, dateRange, filters, onDateRangeChange, onFiltersChange }) => {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState("overview");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [localDateRange, setLocalDateRange] = useState(dateRange || {
    start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD"),
  });
  const [localFilters, setLocalFilters] = useState(filters || {
    brand: "",
    category: "",
    minProfit: 0,
  });

  useEffect(() => {
    if (dateRange) setLocalDateRange(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (filters) setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!distributorId) return;

    setLoading(true);
    const unsubscribers = [];

    // Subscribe to products
    const productsUnsub = onSnapshot(
      collection(db, `businesses/${distributorId}/products`),
      (snapshot) => {
        const productsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProducts(productsData);
      }
    );
    unsubscribers.push(productsUnsub);

    // Subscribe to orders
    const ordersUnsub = onSnapshot(
      collection(db, `businesses/${distributorId}/orderRequests`),
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
        setLoading(false);
      }
    );
    unsubscribers.push(ordersUnsub);

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [distributorId]);

  const calculateOrderTotal = (order) => {
    if (order?.chargesSnapshot?.breakdown?.grandTotal) {
      return Number(order.chargesSnapshot.breakdown.grandTotal);
    }
    if (order?.items) {
      return order.items.reduce((sum, item) => {
        const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const qty = Number(item.quantity || item.qty || 0);
        return sum + price * qty;
      }, 0);
    }
    return 0;
  };

  const filteredOrders = useMemo(() => {
    const range = localDateRange || dateRange;
    if (!range || !range.start || !range.end) return orders;
    const start = dayjs(range.start).startOf("day");
    const end = dayjs(range.end).endOf("day");
    return orders.filter((order) => {
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );
      // Include orders that fall within the date range (inclusive)
      return (orderDate.isAfter(start.subtract(1, "second")) || orderDate.isSame(start)) && 
             (orderDate.isBefore(end.add(1, "second")) || orderDate.isSame(end));
    });
  }, [orders, localDateRange, dateRange]);

  // Enhanced product metrics with geographic data - START WITH ALL PRODUCTS
  const productMetrics = useMemo(() => {
    const metrics = {};
    const productMap = {};

    // First, initialize metrics for ALL products in inventory
    products.forEach((product) => {
      const productId = product.id;
      const createdAt = product.createdAt?.toDate?.() || product.createdAt || product.timestamp?.toDate?.() || product.timestamp;
      const daysInInventory = createdAt ? dayjs().diff(dayjs(createdAt), "day") : 0;
      const currentStock = Number(product.quantity || 0);
      const costPrice = Number(product.costPrice || product.price || product.distributorPrice || 0);
      const sellingPrice = Number(product.sellingPrice || product.mrp || 0);
      const totalInventoryCost = currentStock * costPrice;
      const totalInventoryValue = currentStock * sellingPrice;
      const potentialProfit = totalInventoryValue - totalInventoryCost;

      metrics[productId] = {
        id: productId,
        name: product.name || product.productName || "Unknown",
        sku: product.sku || "N/A",
        brand: product.brand || "N/A",
        category: product.category || "N/A",
        // Sales data (will be populated from orders)
        totalSold: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        // Inventory data
        currentStock,
        costPrice,
        sellingPrice,
        totalInventoryCost,
        totalInventoryValue,
        potentialProfit,
        daysInInventory,
        // Additional metrics
        ordersCount: 0,
        geographicData: {}, // { state: { city: { qty, revenue } } }
        trend: [],
        lastSoldDate: null,
        avgSellingPrice: 0,
        turnoverRate: 0, // How fast inventory turns over
      };
      productMap[productId] = product;
    });

    // Debug: Log order counts
    console.log("[ProductAnalytics] Total products in inventory:", products.length);
    console.log("[ProductAnalytics] Total orders:", filteredOrders.length);
    console.log("[ProductAnalytics] Orders with items:", filteredOrders.filter(o => o.items && Array.isArray(o.items)).length);
    
    // Create a lookup map for products by name+brand and SKU for fallback matching
    const productByNameBrand = {};
    const productBySku = {};
    products.forEach((p) => {
      const name = (p.name || p.productName || "").toLowerCase().trim();
      const brand = (p.brand || "").toLowerCase().trim();
      const sku = (p.sku || "").toLowerCase().trim();
      if (name && brand) {
        productByNameBrand[`${name}::${brand}`] = p;
      }
      if (sku) {
        productBySku[sku] = p;
      }
    });

    // Now, enrich with sales data from orders
    let deliveredOrdersCount = 0;
    let processedItemsCount = 0;
    let matchedItemsCount = 0;
    
    filteredOrders.forEach((order) => {
      if (!order.items || !Array.isArray(order.items)) return;
      
      // Check if order is delivered (handle multiple status formats)
      const status = String(order.status || "").toUpperCase();
      const statusCode = String(order.statusCode || "").toUpperCase();
      const isDelivered = 
        status === "DELIVERED" || 
        statusCode === "DELIVERED" ||
        status === "INVOICED" ||
        statusCode === "INVOICED" ||
        String(order.status || "").toLowerCase() === "delivered" ||
        String(order.statusCode || "").toLowerCase() === "delivered";
      
      if (!isDelivered) {
        return;
      }
      
      deliveredOrdersCount++;

      const retailerState = order.retailerState || order.state || "Unknown";
      const retailerCity = order.retailerCity || order.city || "Unknown";
      const orderDate = dayjs(
        order.timestamp?.toDate?.() || order.timestamp || order.createdAt?.toDate?.() || order.createdAt
      );

      order.items.forEach((item) => {
        // Try multiple possible product ID fields
        let productId = item.distributorProductId || item.productId || item.inventoryId || item.id;
        let matchedProduct = null;
        
        // If we have a product ID, try to find it in inventory
        if (productId) {
          matchedProduct = productMap[productId];
        }
        
        // If no product ID or product not found, try to match by name and brand
        if (!matchedProduct) {
          const itemName = (item.productName || item.name || "").toLowerCase().trim();
          const itemBrand = (item.brand || "").toLowerCase().trim();
          const itemSku = (item.sku || "").toLowerCase().trim();
          
          // Try SKU first (most reliable)
          if (itemSku && productBySku[itemSku]) {
            matchedProduct = productBySku[itemSku];
            productId = matchedProduct.id;
            console.log("[ProductAnalytics] Matched product by SKU:", itemSku, "->", productId);
          }
          // Then try name+brand
          else if (itemName && itemBrand) {
            const key = `${itemName}::${itemBrand}`;
            if (productByNameBrand[key]) {
              matchedProduct = productByNameBrand[key];
              productId = matchedProduct.id;
              console.log("[ProductAnalytics] Matched product by name+brand:", itemName, itemBrand, "->", productId);
            }
          }
          
          // If still no match, try fuzzy matching
          if (!matchedProduct && itemName) {
            matchedProduct = products.find((p) => {
              const pName = (p.name || p.productName || "").toLowerCase().trim();
              return pName && itemName && (pName.includes(itemName) || itemName.includes(pName));
            });
            if (matchedProduct) {
              productId = matchedProduct.id;
              console.log("[ProductAnalytics] Matched product by fuzzy name:", itemName, "->", productId);
            }
          }
          
          if (!matchedProduct) {
            console.log("[ProductAnalytics] Could not match product:", {
              itemName: item.productName || item.name,
              itemBrand: item.brand,
              itemSku: item.sku,
              productId: item.distributorProductId || item.productId
            });
            // Still process the item even if we can't match - create a temporary entry
          }
        }
        
        if (!productId) {
          // Use a temporary ID if we can't match
          productId = `temp_${item.productName || item.name || 'unknown'}_${item.brand || 'unknown'}`;
        }

        // If product not in inventory, create a temporary entry
        if (!metrics[productId]) {
          // Use matchedProduct if available, otherwise try productMap
          const product = matchedProduct || productMap[productId] || {};
          metrics[productId] = {
            id: productId,
            name: item.productName || item.name || product?.name || product?.productName || "Unknown",
            sku: item.sku || product?.sku || "N/A",
            brand: item.brand || product?.brand || "N/A",
            category: item.category || product?.category || "N/A",
            totalSold: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            currentStock: product ? Number(product.quantity || 0) : 0,
            costPrice: product ? Number(product.costPrice || product.price || product.distributorPrice || 0) : 0,
            sellingPrice: product ? Number(product.sellingPrice || product.mrp || 0) : 0,
            totalInventoryCost: product ? Number(product.quantity || 0) * Number(product.costPrice || product.price || product.distributorPrice || 0) : 0,
            totalInventoryValue: product ? Number(product.quantity || 0) * Number(product.sellingPrice || product.mrp || 0) : 0,
            potentialProfit: 0,
            daysInInventory: product && product.createdAt ? dayjs().diff(dayjs(product.createdAt?.toDate?.() || product.createdAt), "day") : 0,
            ordersCount: 0,
            geographicData: {},
            trend: [],
            lastSoldDate: null,
            avgSellingPrice: 0,
            turnoverRate: 0,
          };
          if (product && product.quantity) {
            metrics[productId].potentialProfit = metrics[productId].totalInventoryValue - metrics[productId].totalInventoryCost;
          }
        }

        // Get product data for calculations (use matched product or from metrics)
        const productData = matchedProduct || productMap[productId] || metrics[productId] || {};
        const qty = Number(item.quantity || item.qty || 0);
        const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
        const costPrice = Number(
          productData.costPrice || 
          productData.price || 
          productData.distributorPrice || 
          metrics[productId]?.costPrice || 
          0
        );
        const revenue = sellingPrice * qty;
        const cost = costPrice * qty;
        const profit = revenue - cost;
        
        processedItemsCount++;
        if (matchedProduct || productMap[productId]) {
          matchedItemsCount++;
        }
        
        console.log("[ProductAnalytics] Processing sale:", {
          productId,
          productName: metrics[productId].name,
          qty,
          sellingPrice,
          costPrice,
          revenue,
          profit,
          retailerState,
          retailerCity,
          matched: !!(matchedProduct || productMap[productId])
        });

        metrics[productId].totalSold += qty;
        metrics[productId].totalRevenue += revenue;
        metrics[productId].totalCost += cost;
        metrics[productId].totalProfit += profit;
        metrics[productId].ordersCount += 1;

        // Update last sold date
        if (!metrics[productId].lastSoldDate || orderDate.isAfter(metrics[productId].lastSoldDate)) {
          metrics[productId].lastSoldDate = orderDate;
        }

        // Geographic data
        if (!metrics[productId].geographicData[retailerState]) {
          metrics[productId].geographicData[retailerState] = {};
        }
        if (!metrics[productId].geographicData[retailerState][retailerCity]) {
          metrics[productId].geographicData[retailerState][retailerCity] = { qty: 0, revenue: 0 };
        }
        metrics[productId].geographicData[retailerState][retailerCity].qty += qty;
        metrics[productId].geographicData[retailerState][retailerCity].revenue += revenue;

        // Trend data
        const daysAgo = dayjs().diff(orderDate, "day");
        if (daysAgo <= 30) {
          metrics[productId].trend.push({
            date: orderDate.format("YYYY-MM-DD"),
            sold: qty,
            revenue,
            profit,
          });
        }
      });
    });
    
    // Debug summary
    console.log("[ProductAnalytics] Summary:", {
      deliveredOrders: deliveredOrdersCount,
      processedItems: processedItemsCount,
      matchedItems: matchedItemsCount,
      productsWithSales: Object.values(metrics).filter(m => m.totalSold > 0).length,
      totalProducts: Object.keys(metrics).length
    });

    // Process trends and calculate advanced metrics
    Object.keys(metrics).forEach((productId) => {
      const m = metrics[productId];
      
      // Calculate profit margin
      m.avgProfitMargin = m.totalRevenue > 0 ? (m.totalProfit / m.totalRevenue) * 100 : 0;
      
      // Calculate average selling price
      m.avgSellingPrice = m.totalSold > 0 ? m.totalRevenue / m.totalSold : m.sellingPrice || 0;
      
      // Calculate turnover rate (how many times inventory has been sold)
      m.turnoverRate = m.currentStock > 0 && m.totalSold > 0 
        ? (m.totalSold / (m.currentStock + m.totalSold)) * 100 
        : m.totalSold > 0 ? 100 : 0;
      
      // Calculate days since last sale
      m.daysSinceLastSale = m.lastSoldDate ? dayjs().diff(m.lastSoldDate, "day") : null;
      
      // Calculate inventory age status
      if (m.daysInInventory > 90) {
        m.inventoryAgeStatus = "old";
      } else if (m.daysInInventory > 30) {
        m.inventoryAgeStatus = "moderate";
      } else {
        m.inventoryAgeStatus = "new";
      }
      
      // Calculate ROI (Return on Investment)
      m.roi = m.totalInventoryCost > 0 
        ? ((m.totalProfit + m.potentialProfit) / m.totalInventoryCost) * 100 
        : 0;

      // Aggregate trend by date
      const trendMap = {};
      m.trend.forEach((t) => {
        if (!trendMap[t.date]) {
          trendMap[t.date] = { sold: 0, revenue: 0, profit: 0 };
        }
        trendMap[t.date].sold += t.sold;
        trendMap[t.date].revenue += t.revenue;
        trendMap[t.date].profit += t.profit;
      });

      m.trend = Object.entries(trendMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });

    return Object.values(metrics);
  }, [products, filteredOrders]);

  const filteredMetrics = useMemo(() => {
    let result = productMetrics;
    const activeFilters = localFilters || filters;

    if (activeFilters?.brand && activeFilters.brand.trim()) {
      result = result.filter((p) => p.brand.toLowerCase().includes(activeFilters.brand.toLowerCase()));
    }
    if (activeFilters?.category && activeFilters.category.trim()) {
      result = result.filter((p) => p.category.toLowerCase().includes(activeFilters.category.trim().toLowerCase()));
    }
    if (activeFilters?.minProfit && activeFilters.minProfit > 0) {
      result = result.filter((p) => p.totalProfit >= activeFilters.minProfit);
    }

    return result;
  }, [productMetrics, localFilters, filters]);

  // Geographic visualization data for selected product
  const geographicData = useMemo(() => {
    if (!selectedProduct) return null;

    const product = filteredMetrics.find((p) => p.id === selectedProduct);
    if (!product || !product.geographicData) return null;

    const stateData = {};
    Object.keys(product.geographicData).forEach((state) => {
      const cities = product.geographicData[state];
      stateData[state] = {
        totalQty: 0,
        totalRevenue: 0,
        cities: Object.keys(cities).map((city) => ({
          name: city,
          qty: cities[city].qty,
          revenue: cities[city].revenue,
        })),
      };
      Object.values(cities).forEach((cityData) => {
        stateData[state].totalQty += cityData.qty;
        stateData[state].totalRevenue += cityData.revenue;
      });
    });

    return stateData;
  }, [selectedProduct, filteredMetrics]);

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getColorClasses = (color) => {
    const colorMap = {
      emerald: {
        border: "border-emerald-500/30",
        bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20",
      },
      purple: {
        border: "border-purple-500/30",
        bg: "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
      },
      blue: {
        border: "border-blue-500/30",
        bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/20",
      },
      amber: {
        border: "border-amber-500/30",
        bg: "bg-gradient-to-br from-amber-500/20 to-amber-600/20",
      },
    };
    return colorMap[color] || colorMap.emerald;
  };

  // Brand distribution
  const brandDistribution = useMemo(() => {
    const brandMap = {};
    filteredMetrics.forEach((product) => {
      const brand = product.brand || "Unknown";
      if (!brandMap[brand]) {
        brandMap[brand] = { revenue: 0, profit: 0, products: 0 };
      }
      brandMap[brand].revenue += product.totalRevenue;
      brandMap[brand].profit += product.totalProfit;
      brandMap[brand].products += 1;
    });
    return Object.entries(brandMap)
      .map(([brand, data]) => ({ brand, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredMetrics]);

  // Category distribution
  const categoryDistribution = useMemo(() => {
    const categoryMap = {};
    filteredMetrics.forEach((product) => {
      const category = product.category || "Unknown";
      if (!categoryMap[category]) {
        categoryMap[category] = { revenue: 0, profit: 0, products: 0 };
      }
      categoryMap[category].revenue += product.totalRevenue;
      categoryMap[category].profit += product.totalProfit;
      categoryMap[category].products += 1;
    });
    return Object.entries(categoryMap)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading product analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            Product Analytics
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Deep insights into product performance, trends, geographic distribution, and profitability
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Date Range Start</label>
            <input
              type="date"
              value={localDateRange.start}
              onChange={(e) => {
                const newRange = { ...localDateRange, start: e.target.value };
                setLocalDateRange(newRange);
                if (onDateRangeChange) onDateRangeChange(newRange);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Date Range End</label>
            <input
              type="date"
              value={localDateRange.end}
              onChange={(e) => {
                const newRange = { ...localDateRange, end: e.target.value };
                setLocalDateRange(newRange);
                if (onDateRangeChange) onDateRangeChange(newRange);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Filter by Brand</label>
            <input
              type="text"
              placeholder="Enter brand name"
              value={localFilters.brand}
              onChange={(e) => {
                const newFilters = { ...localFilters, brand: e.target.value };
                setLocalFilters(newFilters);
                if (onFiltersChange) onFiltersChange(newFilters);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Filter by Category</label>
            <input
              type="text"
              placeholder="Enter category"
              value={localFilters.category}
              onChange={(e) => {
                const newFilters = { ...localFilters, category: e.target.value };
                setLocalFilters(newFilters);
                if (onFiltersChange) onFiltersChange(newFilters);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const cleared = { brand: "", category: "", minProfit: 0 };
                setLocalFilters(cleared);
                if (onFiltersChange) onFiltersChange(cleared);
              }}
              className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition border border-white/20"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex flex-wrap gap-2">
        {["overview", "geographic", "trends", "brands", "categories"].map((view) => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedView === view
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { 
            label: "Total Products", 
            value: products.length, 
            subtitle: "In inventory",
            color: "emerald", 
            icon: "📦" 
          },
          { 
            label: "Products Sold", 
            value: filteredMetrics.filter(p => p.totalSold > 0).length, 
            subtitle: "With sales",
            color: "blue", 
            icon: "✨" 
          },
          {
            label: "Total Revenue",
            value: formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalRevenue, 0)),
            subtitle: "From sales",
            color: "purple",
            icon: "💰",
          },
          {
            label: "Inventory Value",
            value: formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalInventoryValue, 0)),
            subtitle: "At selling price",
            color: "amber",
            icon: "📊",
          },
        ].map((stat, idx) => {
          const colorClasses = getColorClasses(stat.color);
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-xl border ${colorClasses.border} ${colorClasses.bg} p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{stat.icon}</span>
              </div>
              <p className="text-xs text-white/60 mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              {stat.subtitle && <p className="text-xs text-white/50 mt-1">{stat.subtitle}</p>}
            </motion.div>
          );
        })}
      </div>

      {/* Additional Inventory Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Inventory Cost",
            value: formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalInventoryCost, 0)),
            subtitle: "Cost of current stock",
            color: "blue",
            icon: "💵",
          },
          {
            label: "Total Profit",
            value: formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalProfit, 0)),
            subtitle: "From sales",
            color: "purple",
            icon: "📈",
          },
          {
            label: "Potential Profit",
            value: formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.potentialProfit, 0)),
            subtitle: "If all stock sold",
            color: "emerald",
            icon: "🎯",
          },
          {
            label: "Total Units Sold",
            value: filteredMetrics.reduce((sum, p) => sum + p.totalSold, 0).toLocaleString("en-IN"),
            subtitle: "All time",
            color: "amber",
            icon: "📦",
          },
        ].map((stat, idx) => {
          const colorClasses = getColorClasses(stat.color);
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (idx + 4) * 0.1 }}
              className={`rounded-xl border ${colorClasses.border} ${colorClasses.bg} p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{stat.icon}</span>
              </div>
              <p className="text-xs text-white/60 mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              {stat.subtitle && <p className="text-xs text-white/50 mt-1">{stat.subtitle}</p>}
            </motion.div>
          );
        })}
      </div>

      {/* Overview View */}
      {selectedView === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* All Products List */}
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">All Products in Inventory</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredMetrics.length === 0 ? (
                <p className="text-white/60 text-center py-8">No products found</p>
              ) : (
                filteredMetrics
                  .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
                  .map((product, idx) => (
                    <div
                      key={product.id}
                      onClick={() => setSelectedProduct(product.id)}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          product.totalSold > 0 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-gray-500/20 text-gray-400"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{product.name}</p>
                          <p className="text-xs text-white/60">
                            {product.brand} • {product.category}
                          </p>
                          <p className="text-xs text-white/50 mt-1">
                            Stock: {product.currentStock} | Sold: {product.totalSold} | Days: {product.daysInInventory}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        {product.totalRevenue > 0 ? (
                          <>
                            <p className="font-bold text-emerald-400">{formatCurrency(product.totalRevenue)}</p>
                            <p className="text-xs text-white/60">{product.totalSold} sold</p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-blue-400">{formatCurrency(product.totalInventoryCost)}</p>
                            <p className="text-xs text-white/60">Inventory cost</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Product Performance Summary */}
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Performance Summary</h3>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Total Inventory Cost</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalInventoryCost, 0))}
                </p>
                <p className="text-xs text-white/50 mt-1">Cost of all products in stock</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Total Inventory Value</p>
                <p className="text-3xl font-bold text-emerald-400">
                  {formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalInventoryValue, 0))}
                </p>
                <p className="text-xs text-white/50 mt-1">At selling price</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Total Revenue from Sales</p>
                <p className="text-3xl font-bold text-purple-400">
                  {formatCurrency(filteredMetrics.reduce((sum, p) => sum + p.totalRevenue, 0))}
                </p>
                <p className="text-xs text-white/50 mt-1">From delivered orders</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Total Units Sold</p>
                <p className="text-3xl font-bold text-white">
                  {filteredMetrics.reduce((sum, p) => sum + p.totalSold, 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-white/50 mt-1">All time</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 mb-2">Average Days in Inventory</p>
                <p className="text-3xl font-bold text-white">
                  {filteredMetrics.length > 0
                    ? Math.round(filteredMetrics.reduce((sum, p) => sum + p.daysInInventory, 0) / filteredMetrics.length)
                    : 0}
                </p>
                <p className="text-xs text-white/50 mt-1">Across all products</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Geographic View */}
      {selectedView === "geographic" && (
        <div className="space-y-6">
          {/* Product Selector */}
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            <label className="block text-sm text-white/80 mb-2">Select Product to View Geographic Distribution</label>
            <select
              value={selectedProduct || ""}
              onChange={(e) => setSelectedProduct(e.target.value || null)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">-- Select a Product --</option>
              {filteredMetrics
                .sort((a, b) => b.totalRevenue - a.totalRevenue)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.brand})
                  </option>
                ))}
            </select>
          </div>

          {/* Geographic Distribution */}
          {selectedProduct && geographicData ? (
            Object.keys(geographicData).length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Geographic Distribution: {
                    filteredMetrics.find((p) => p.id === selectedProduct)?.name
                  }
                </h3>
                <div className="mb-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <p className="text-sm text-white/80">
                    <span className="font-semibold text-emerald-400">Top Selling Areas:</span> This product has been sold in {Object.keys(geographicData).length} state(s)
                  </p>
                </div>
                <div className="space-y-4">
                  {Object.entries(geographicData)
                    .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)
                    .map(([state, data]) => (
                      <div key={state} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-white text-lg flex items-center gap-2">
                            <span>📍</span> {state}
                          </h4>
                          <div className="text-right">
                            <p className="text-emerald-400 font-bold">{formatCurrency(data.totalRevenue)}</p>
                            <p className="text-xs text-white/60">{data.totalQty} units sold</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-white/60 mb-2">Cities in {state}:</p>
                          {data.cities.length > 0 ? (
                            data.cities
                              .sort((a, b) => b.revenue - a.revenue)
                              .map((city) => (
                                <div
                                  key={city.name}
                                  className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10 hover:bg-white/10 transition"
                                >
                                  <span className="text-white/80 font-medium">{city.name}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-white/60 text-sm">{city.qty} units</span>
                                    <span className="text-emerald-400 font-semibold">{formatCurrency(city.revenue)}</span>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <p className="text-white/60 text-sm">No city data available</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <p className="text-white/60 text-center py-8">
                  No geographic data available for this product. This product hasn't been sold yet or location data is missing.
                </p>
              </div>
            )
          ) : selectedProduct ? (
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
              <p className="text-white/60 text-center py-8">
                Loading geographic data...
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Trends View */}
      {selectedView === "trends" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredMetrics
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 4)
            .map((product) => {
              const trendData = {
                labels: product.trend.map((t) => dayjs(t.date).format("MMM DD")),
                datasets: [
                  {
                    label: "Units Sold",
                    data: product.trend.map((t) => t.sold),
                    borderColor: "rgb(16, 185, 129)",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    tension: 0.4,
                  },
                ],
              };

              return (
                <div key={product.id} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">{product.name}</h3>
                  <Line
                    data={trendData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { color: "rgba(255,255,255,0.7)" },
                          grid: { color: "rgba(255,255,255,0.1)" },
                        },
                        x: {
                          ticks: { color: "rgba(255,255,255,0.7)" },
                          grid: { color: "rgba(255,255,255,0.1)" },
                        },
                      },
                    }}
                  />
                </div>
              );
            })}
        </div>
      )}

      {/* Brands View */}
      {selectedView === "brands" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Brand Performance</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {brandDistribution.map((brand, idx) => (
                <div
                  key={brand.brand}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{brand.brand}</p>
                      <p className="text-xs text-white/60">{brand.products} products</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-400">{formatCurrency(brand.revenue)}</p>
                    <p className="text-xs text-white/60">{formatCurrency(brand.profit)} profit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Brand Revenue Distribution</h3>
            <Doughnut
              data={{
                labels: brandDistribution.slice(0, 10).map((b) => b.brand),
                datasets: [
                  {
                    data: brandDistribution.slice(0, 10).map((b) => b.revenue),
                    backgroundColor: [
                      "rgba(16, 185, 129, 0.8)",
                      "rgba(59, 130, 246, 0.8)",
                      "rgba(139, 92, 246, 0.8)",
                      "rgba(236, 72, 153, 0.8)",
                      "rgba(251, 146, 60, 0.8)",
                      "rgba(34, 197, 94, 0.8)",
                      "rgba(168, 85, 247, 0.8)",
                      "rgba(239, 68, 68, 0.8)",
                      "rgba(14, 165, 233, 0.8)",
                      "rgba(245, 158, 11, 0.8)",
                    ],
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { position: "bottom", labels: { color: "rgba(255,255,255,0.8)" } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Categories View */}
      {selectedView === "categories" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Category Performance</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {categoryDistribution.map((cat, idx) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{cat.category}</p>
                      <p className="text-xs text-white/60">{cat.products} products</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-400">{formatCurrency(cat.revenue)}</p>
                    <p className="text-xs text-white/60">{formatCurrency(cat.profit)} profit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Category Revenue Distribution</h3>
            <Bar
              data={{
                labels: categoryDistribution.slice(0, 10).map((c) => c.category),
                datasets: [
                  {
                    label: "Revenue (₹)",
                    data: categoryDistribution.slice(0, 10).map((c) => c.revenue),
                    backgroundColor: "rgba(59, 130, 246, 0.8)",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: "y",
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  x: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `₹${(value / 1000).toFixed(0)}k`,
                      color: "rgba(255,255,255,0.7)",
                    },
                    grid: { color: "rgba(255,255,255,0.1)" },
                  },
                  y: {
                    ticks: { color: "rgba(255,255,255,0.7)" },
                    grid: { color: "rgba(255,255,255,0.1)" },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Detailed Product Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">All Products Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-2 px-3 text-white/80">Product</th>
                <th className="text-left py-2 px-3 text-white/80">Brand</th>
                <th className="text-left py-2 px-3 text-white/80">Category</th>
                <th className="text-right py-2 px-3 text-white/80">Stock</th>
                <th className="text-right py-2 px-3 text-white/80">Cost Price</th>
                <th className="text-right py-2 px-3 text-white/80">Selling Price</th>
                <th className="text-right py-2 px-3 text-white/80">Inventory Cost</th>
                <th className="text-right py-2 px-3 text-white/80">Days in Inv.</th>
                <th className="text-right py-2 px-3 text-white/80">Sold</th>
                <th className="text-right py-2 px-3 text-white/80">Revenue</th>
                <th className="text-right py-2 px-3 text-white/80">Profit</th>
                <th className="text-right py-2 px-3 text-white/80">Margin %</th>
                <th className="text-right py-2 px-3 text-white/80">Orders</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics
                .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
                .map((product) => (
                  <tr key={product.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 text-white font-medium">{product.name}</td>
                    <td className="py-2 px-3 text-white/60">{product.brand}</td>
                    <td className="py-2 px-3 text-white/60">{product.category}</td>
                    <td className="py-2 px-3 text-right text-white">{product.currentStock}</td>
                    <td className="py-2 px-3 text-right text-white/60">{formatCurrency(product.costPrice)}</td>
                    <td className="py-2 px-3 text-right text-white/60">{formatCurrency(product.sellingPrice)}</td>
                    <td className="py-2 px-3 text-right text-blue-400 font-semibold">
                      {formatCurrency(product.totalInventoryCost)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.daysInInventory > 90
                            ? "bg-red-500/20 text-red-300"
                            : product.daysInInventory > 30
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {product.daysInInventory} days
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-white">{product.totalSold}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                      {formatCurrency(product.totalRevenue)}
                    </td>
                    <td className="py-2 px-3 text-right text-purple-400 font-semibold">
                      {formatCurrency(product.totalProfit)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          product.avgProfitMargin >= 30
                            ? "bg-emerald-500/20 text-emerald-300"
                            : product.avgProfitMargin >= 20
                            ? "bg-blue-500/20 text-blue-300"
                            : product.avgProfitMargin >= 10
                            ? "bg-amber-500/20 text-amber-300"
                            : product.avgProfitMargin > 0
                            ? "bg-red-500/20 text-red-300"
                            : "bg-gray-500/20 text-gray-300"
                        }`}
                      >
                        {product.avgProfitMargin > 0 ? product.avgProfitMargin.toFixed(1) : "0"}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-white/60">{product.ordersCount}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProductAnalytics;

