// AI Analytics Engine - Processes natural language queries and generates insights
import { collection, query, where, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

// Query patterns for natural language processing
const QUERY_PATTERNS = {
  // Sales queries
  sales: {
    patterns: [
      /sales?\s+(?:for|in|during)\s+(.+)/i,
      /(?:show|display|get)\s+(?:me\s+)?sales?\s+(?:for|in|during)\s+(.+)/i,
      /(?:what|how)\s+(?:are\s+)?(?:my\s+)?sales?\s+(?:for|in|during)\s+(.+)/i,
      /revenue\s+(?:for|in|during)\s+(.+)/i
    ],
    type: 'sales'
  },
  
  // Profit queries
  profit: {
    patterns: [
      /profit\s+(?:for|in|during)\s+(.+)/i,
      /(?:show|display|get)\s+(?:me\s+)?profit\s+(?:for|in|during)\s+(.+)/i,
      /(?:what|how)\s+(?:is|are)\s+(?:my\s+)?profit\s+(?:for|in|during)\s+(.+)/i,
      /earnings?\s+(?:for|in|during)\s+(.+)/i
    ],
    type: 'profit'
  },
  
  // Product performance
  products: {
    patterns: [
      /(?:which|what)\s+(?:are\s+)?(?:my\s+)?(?:top\s+)?(?:selling\s+)?products?/i,
      /(?:show|display|get)\s+(?:me\s+)?(?:top\s+)?(?:selling\s+)?products?/i,
      /(?:best|top)\s+(?:performing\s+)?products?/i,
      /product\s+(?:performance|sales|ranking)/i,
      // More flexible patterns
      /top\s+\d+\s+(?:selling\s+)?products?/i,
      /top\s+\d+\s+products?/i,
      /(?:top|best)\s+\d+/i,
      /products?\s+(?:selling|performance|ranking)/i,
      /(?:which|what)\s+products?\s+(?:are\s+)?(?:selling|performing)/i
    ],
    type: 'products'
  },
  
  // Inventory queries
  inventory: {
    patterns: [
      /(?:how\s+is\s+)?(?:my\s+)?inventory\s+(?:performing|doing)/i,
      /(?:show|display|get)\s+(?:me\s+)?inventory\s+(?:status|overview)/i,
      /(?:low\s+)?stock\s+(?:alerts?|status)/i,
      /inventory\s+(?:levels?|management)/i
    ],
    type: 'inventory'
  },
  
  // Customer queries
  customers: {
    patterns: [
      /(?:who\s+are\s+)?(?:my\s+)?(?:top\s+)?customers?/i,
      /(?:show|display|get)\s+(?:me\s+)?(?:top\s+)?customers?/i,
      /(?:best|top)\s+(?:performing\s+)?customers?/i,
      /customer\s+(?:analysis|insights)/i
    ],
    type: 'customers'
  },
  
  // Comparison queries
  comparison: {
    patterns: [
      /(?:compare|comparison)\s+(.+)\s+(?:vs|versus|against)\s+(.+)/i,
      /(?:this|current)\s+(.+)\s+(?:vs|versus|against)\s+(?:last|previous)\s+(.+)/i,
      /(?:show|display)\s+(?:me\s+)?(?:the\s+)?(?:difference|change)\s+(?:between|in)\s+(.+)/i
    ],
    type: 'comparison'
  },
  
  // Trend queries
  trends: {
    patterns: [
      /(?:show|display|get)\s+(?:me\s+)?(?:revenue|sales|profit)\s+trends?\s+(?:for|in|during)\s+(.+)/i,
      /(?:what|how)\s+(?:are\s+)?(?:my\s+)?(?:revenue|sales|profit)\s+trends?\s+(?:for|in|during)\s+(.+)/i,
      /(?:growth|trend)\s+(?:for|in|during)\s+(.+)/i
    ],
    type: 'trends'
  }
};

// Time period parsing
const TIME_PERIODS = {
  'last month': { months: -1 },
  'this month': { months: 0 },
  'last week': { weeks: -1 },
  'this week': { weeks: 0 },
  'last year': { years: -1 },
  'this year': { years: 0 },
  'last 3 months': { months: -3 },
  'last 6 months': { months: -6 },
  'last quarter': { months: -3 },
  'this quarter': { months: 0, isQuarter: true }
};

// Chart configuration templates
const CHART_TEMPLATES = {
  sales: {
    type: 'line',
    title: 'Sales Trend',
    xAxis: 'date',
    yAxis: 'amount',
    color: 'emerald'
  },
  profit: {
    type: 'bar',
    title: 'Profit Analysis',
    xAxis: 'period',
    yAxis: 'profit',
    color: 'cyan'
  },
  products: {
    type: 'bar',
    title: 'Top Selling Products',
    xAxis: 'product',
    yAxis: 'quantity',
    color: 'blue'
  },
  inventory: {
    type: 'pie',
    title: 'Inventory Status',
    xAxis: 'status',
    yAxis: 'count',
    color: 'purple'
  },
  customers: {
    type: 'bar',
    title: 'Top Customers',
    xAxis: 'customer',
    yAxis: 'value',
    color: 'emerald'
  },
  comparison: {
    type: 'bar',
    title: 'Comparison',
    xAxis: 'period',
    yAxis: 'value',
    color: 'orange'
  },
  trends: {
    type: 'line',
    title: 'Trend Analysis',
    xAxis: 'date',
    yAxis: 'value',
    color: 'emerald'
  }
};

// Main function to generate analytics insights
export const generateAnalyticsInsights = async (query, data, userId) => {
  try {
    console.log('AI Analytics - Processing query:', query);
    console.log('AI Analytics - Data received:', {
      invoicesCount: data?.invoices?.length || 0,
      productsCount: data?.products?.length || 0,
      customersCount: data?.customers?.length || 0,
      sampleInvoice: data?.invoices?.[0]
    });
    
    // Parse the query to determine intent
    const intent = parseQuery(query);
    console.log('AI Analytics - Parsed intent:', intent);
    
    if (!intent) {
      console.log('AI Analytics - No intent found for query:', query);
      return {
        summary: "I didn't understand your query. Try asking about:\n• Sales: 'Show me sales for last month'\n• Products: 'Top 5 selling products' or 'Which products are selling best?'\n• Profit: 'What's my profit for this quarter?'\n• Inventory: 'How is my inventory performing?'\n• Customers: 'What are my top customers?'",
        data: null,
        chartConfig: null
      };
    }

    // Process the query based on intent
    let result;
    switch (intent.type) {
      case 'sales':
        result = await processSalesQuery(intent, data, userId);
        break;
      case 'profit':
        result = await processProfitQuery(intent, data, userId);
        break;
      case 'products':
        result = await processProductsQuery(intent, data, userId);
        break;
      case 'inventory':
        result = await processInventoryQuery(intent, data, userId);
        break;
      case 'invoiceTypes':
        result = await processInvoiceTypesQuery(intent, data, userId);
        break;
      case 'customers':
        result = await processCustomersQuery(intent, data, userId);
        break;
      case 'comparison':
        result = await processComparisonQuery(intent, data, userId);
        break;
      case 'trends':
        result = await processTrendsQuery(intent, data, userId);
        break;
      default:
        result = {
          summary: "I can help you analyze sales, profit, products, inventory, customers, and trends. Try asking something like 'Show me sales for last month'.",
          data: null,
          chartConfig: null
        };
    }

    return result;
  } catch (error) {
    console.error('Error generating analytics insights:', error);
    return {
      summary: "Sorry, I encountered an error processing your request. Please try again.",
      data: null,
      chartConfig: null
    };
  }
};

// Parse natural language query to determine intent
const parseQuery = (query) => {
  // First try exact pattern matching
  for (const [key, config] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          type: config.type,
          match: match,
          timePeriod: extractTimePeriod(query),
          originalQuery: query
        };
      }
    }
  }
  
  // If no exact match, try intelligent keyword-based fallback
  return intelligentFallback(query);
};

// Intelligent fallback for queries that don't match exact patterns
const intelligentFallback = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Extract number if present (for "top 5", "top 10", etc.)
  const numberMatch = lowerQuery.match(/(\d+)/);
  const number = numberMatch ? parseInt(numberMatch[1]) : null;
  
  // Check for product-related keywords
  if (lowerQuery.includes('product') || lowerQuery.includes('selling') || 
      lowerQuery.includes('top') || lowerQuery.includes('best') ||
      lowerQuery.includes('item') || lowerQuery.includes('goods')) {
    return {
      type: 'products',
      match: [query],
      timePeriod: extractTimePeriod(query),
      originalQuery: query,
      extractedNumber: number
    };
  }
  
  // Check for sales-related keywords
  if (lowerQuery.includes('sales') || lowerQuery.includes('revenue') || 
      lowerQuery.includes('money') || lowerQuery.includes('earn')) {
    return {
      type: 'sales',
      match: [query],
      timePeriod: extractTimePeriod(query),
      originalQuery: query,
      extractedNumber: number
    };
  }
  
  // Check for profit-related keywords
  if (lowerQuery.includes('profit') || lowerQuery.includes('margin') || 
      lowerQuery.includes('earnings')) {
    return {
      type: 'profit',
      match: [query],
      timePeriod: extractTimePeriod(query),
      originalQuery: query,
      extractedNumber: number
    };
  }
  
  // Check for customer-related keywords
  if (lowerQuery.includes('customer') || lowerQuery.includes('client') || 
      lowerQuery.includes('buyer')) {
    return {
      type: 'customers',
      match: [query],
      timePeriod: extractTimePeriod(query),
      originalQuery: query,
      extractedNumber: number
    };
  }
  
  // Check for inventory-related keywords
  if (lowerQuery.includes('inventory') || lowerQuery.includes('stock') || 
      lowerQuery.includes('low stock') || lowerQuery.includes('out of stock')) {
    return {
      type: 'inventory',
      match: [query],
      timePeriod: extractTimePeriod(query),
      originalQuery: query,
      extractedNumber: number
    };
  }
  
  // Check for invoice type related keywords
  if (lowerQuery.includes('invoice type') || lowerQuery.includes('invoice breakdown') || 
      lowerQuery.includes('type breakdown') || lowerQuery.includes('invoice categories')) {
    return {
      type: 'invoiceTypes',
      match: [query],
      timePeriod: extractTimePeriod(query),
      originalQuery: query,
      extractedNumber: number
    };
  }
  
  return null;
};

// Extract time period from query
const extractTimePeriod = (query) => {
  const lowerQuery = query.toLowerCase();
  for (const [period, config] of Object.entries(TIME_PERIODS)) {
    if (lowerQuery.includes(period)) {
      return { period, config };
    }
  }
  return { period: 'all time', config: null };
};

// Process sales queries
const processSalesQuery = async (intent, data, userId) => {
  const { timePeriod } = intent;
  const invoices = data.invoices || [];
  
  // Filter invoices by time period
  const filteredInvoices = filterByTimePeriod(invoices, timePeriod);
  console.log('AI Analytics - Sales Query Debug:', {
    originalInvoicesCount: invoices.length,
    filteredInvoicesCount: filteredInvoices.length,
    timePeriod: timePeriod,
    sampleFilteredInvoice: filteredInvoices[0]
  });
  
  // Calculate sales metrics (matching RevenueOverview logic)
  const totalSales = filteredInvoices.reduce((sum, invoice) => {
    // Skip unpaid credit invoices (matching RevenueOverview logic)
    if (invoice.paymentMode === "credit" && !invoice.isPaid) return sum;
    return sum + (invoice.grandTotal || invoice.totalAmount || 0);
  }, 0);
  
  const totalOrders = filteredInvoices.filter(invoice => 
    invoice.paymentMode !== "credit" || (invoice.paymentMode === "credit" && invoice.isPaid)
  ).length;
  
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  // Calculate payment mode breakdown (matching RevenueOverview logic)
  const paymentModes = { cash: 0, upi: 0, card: 0 };
  const dateMap = {};
  
  filteredInvoices.forEach(invoice => {
    if (invoice.paymentMode === "credit" && !invoice.isPaid) return;
    
    const amount = parseFloat(invoice.grandTotal || invoice.totalAmount || 0);
    const mode = invoice.paymentMode?.toLowerCase();
    
    // Handle split payments (matching RevenueOverview logic)
    if (mode === "split") {
      const split = invoice.splitPayment || {};
      paymentModes.cash += parseFloat(split.cash || 0);
      paymentModes.upi += parseFloat(split.upi || 0);
      paymentModes.card += parseFloat(split.card || 0);
    } else if (mode === "credit" && invoice.isPaid) {
      const via = invoice.paidVia?.toLowerCase();
      if (via === "cash") paymentModes.cash += amount;
      else if (via === "upi") paymentModes.upi += amount;
      else if (via === "card") paymentModes.card += amount;
    } else if (["cash", "upi", "card"].includes(mode)) {
      paymentModes[mode] += amount;
    }
    
    // Group by date for trend analysis
    let issuedAt;
    if (invoice.issuedAt?.toDate) {
      issuedAt = invoice.issuedAt.toDate();
    } else if (typeof invoice.issuedAt === "string") {
      issuedAt = new Date(invoice.issuedAt);
    }
    if (!issuedAt || isNaN(issuedAt)) return;
    
    const dateKey = issuedAt.toISOString().split('T')[0]; // YYYY-MM-DD format
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = 0;
    }
    dateMap[dateKey] += amount;
  });
  
  // Generate chart data with trend analysis
  const revenueByDate = Object.entries(dateMap)
    .map(([date, value]) => ({ date, revenue: value }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Add growth calculations (matching RevenueOverview logic)
  for (let i = 1; i < revenueByDate.length; i++) {
    const prev = revenueByDate[i - 1].revenue;
    const curr = revenueByDate[i].revenue;
    const diff = curr - prev;
    const percent = prev === 0 ? 100 : ((diff / prev) * 100);
    revenueByDate[i].changeAmount = diff;
    revenueByDate[i].changePercent = percent.toFixed(1);
  }
  
  const chartData = revenueByDate.map(item => ({
    date: item.date,
    value: item.revenue,
    label: item.date,
    changeAmount: item.changeAmount || 0,
    changePercent: item.changePercent || 0
  }));

  return {
    summary: `Your sales ${timePeriod?.period || 'overall'}: ₹${totalSales.toLocaleString()} from ${totalOrders} orders (avg: ₹${avgOrderValue.toLocaleString()})`,
    data: {
      totalSales,
      totalOrders,
      avgOrderValue,
      paymentModes,
      period: timePeriod?.period || 'overall',
      revenueByDate
    },
    chartConfig: {
      ...CHART_TEMPLATES.sales,
      data: chartData
    }
  };
};

// Process profit queries
const processProfitQuery = async (intent, data, userId) => {
  const { timePeriod } = intent;
  const invoices = data.invoices || [];
  const products = data.products || [];
  
  const filteredInvoices = filterByTimePeriod(invoices, timePeriod);
  
  // Create product map for cost calculations (matching ProfitInsights logic)
  const productMap = {};
  products.forEach(product => {
    productMap[product.id || product.sku] = product;
  });
  
  let totalRevenue = 0;
  let totalProfit = 0;
  const profitMap = {};
  
  filteredInvoices.forEach(invoice => {
    // Skip unpaid credit invoices (matching ProfitInsights logic)
    if (invoice.paymentMode === 'credit' && invoice.isPaid !== true) return;
    
    const invoiceRevenue = Number(invoice.grandTotal || invoice.totalAmount || 0);
    totalRevenue += invoiceRevenue;
    
    const cart = Array.isArray(invoice.cartItems) ? invoice.cartItems : [];
    cart.forEach(item => {
      const product = productMap[item.id];
      if (!product) return;
      
      const cost = Number(product.costPrice || 0);
      const sell = Number(item.price || 0);
      const qty = Number(item.quantity || 0);
      const itemProfit = (sell - cost) * qty;
      const itemRevenue = sell * qty;
      totalProfit += itemProfit;
      
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
  
  // Calculate margins for each product (matching ProfitInsights logic)
  const sortedProducts = Object.values(profitMap)
    .map(p => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit);
  
  const highestMargin = sortedProducts.reduce((a, b) => (a.margin > b.margin ? a : b), { margin: 0 });
  const mostRevenue = sortedProducts.reduce((a, b) => (a.revenue > b.revenue ? a : b), { revenue: 0 });
  const highMarginLowRevenue = sortedProducts.filter(p => p.margin > 30).sort((a, b) => a.revenue - b.revenue)[0];
  
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  
  return {
    summary: `Your profit ${timePeriod?.period || 'overall'}: ₹${totalProfit.toLocaleString()} (${profitMargin.toFixed(1)}% margin)`,
    data: {
      totalProfit,
      totalRevenue,
      profitMargin,
      period: timePeriod?.period || 'overall',
      topProducts: sortedProducts.slice(0, 10),
      highestMargin,
      mostRevenue,
      highMarginLowRevenue
    },
    chartConfig: {
      ...CHART_TEMPLATES.profit,
      data: sortedProducts.slice(0, 8).map(product => ({
        label: product.name,
        value: product.profit,
        revenue: product.revenue,
        margin: product.margin
      }))
    }
  };
};

// Process products queries
const processProductsQuery = async (intent, data, userId) => {
  const allInvoices = data.invoices || [];
  const products = data.products || [];

  // Apply time window if present (aligns product ranking with asked period)
  const { timePeriod } = intent;
  const invoices = filterByTimePeriod(allInvoices, timePeriod);

  // Get the requested number of products (default to 5 if not specified)
  const requestedCount = intent.extractedNumber || 5;

  // Analyze product performance from invoices
  const productSales = {};

  const candidateItemKeys = ['items', 'cart', 'lineItems', 'products', 'invoiceItems'];
  const getItems = (inv) => {
    for (const k of candidateItemKeys) {
      const v = inv && inv[k];
      if (Array.isArray(v) && v.length) return v;
    }
    return [];
  };

  const getQty = (item) => {
    return (
      Number(item?.quantity) || Number(item?.qty) || Number(item?.units) || 0
    );
  };

  const getUnitPrice = (item) => {
    // Prefer explicit totals; fall back to price*qty
    const lineTotal = Number(item?.lineTotal || item?.total || item?.amount || item?.totalPrice || 0);
    const price = Number(item?.price || item?.rate || item?.unitPrice || 0);
    const q = getQty(item);
    if (lineTotal > 0) return q > 0 ? lineTotal / q : lineTotal; // normalize to unit for consistency
    return price;
  };

  invoices.forEach((invoice) => {
    const items = getItems(invoice);
    if (!items.length) return;
    items.forEach((item) => {
      const productName = item.name || item.productName || item.title || item.sku || 'Unknown';
      const qty = getQty(item);
      const unit = getUnitPrice(item);
      if (!productSales[productName]) {
        productSales[productName] = { quantity: 0, revenue: 0 };
      }
      productSales[productName].quantity += qty;
      productSales[productName].revenue += unit * qty;
    });
  });

  // If invoices didn't have line items, try product-level sales counters as fallback
  if (Object.keys(productSales).length === 0 && Array.isArray(products) && products.length) {
    products.forEach((p) => {
      const name = p.name || p.productName || p.title || p.sku || 'Unknown';
      const sold = Number(p.sold || p.salesCount || p.totalSold || 0);
      const revenue = Number(p.revenue || p.totalRevenue || 0);
      if (sold > 0 || revenue > 0) {
        productSales[name] = {
          quantity: (productSales[name]?.quantity || 0) + sold,
          revenue: (productSales[name]?.revenue || 0) + revenue,
        };
      }
    });
  }

  // Sort by quantity sold, tie-break on revenue
  const ranked = Object.entries(productSales)
    .map(([name, stats]) => ({ product: name, quantity: stats.quantity, revenue: stats.revenue }))
    .sort((a, b) => (b.quantity - a.quantity) || (b.revenue - a.revenue));

  const topProducts = ranked.slice(0, Math.max(requestedCount, 10));

  // Create summary based on requested count
  const displayCount = Math.min(requestedCount, topProducts.length);
  const summary = topProducts.length > 0
    ? `Top ${displayCount} selling products ${timePeriod?.period ? `(${timePeriod.period})` : ''}: ${topProducts
        .slice(0, displayCount)
        .map((p) => p.product)
        .join(', ')}`
    : 'No product sales data found.';

  return {
    summary,
    data: {
      topProducts: topProducts.slice(0, displayCount),
      totalProducts: products.length,
      totalSales: ranked.reduce((sum, p) => sum + p.revenue, 0),
      requestedCount: displayCount,
    },
    chartConfig: {
      ...CHART_TEMPLATES.products,
      data: topProducts
        .slice(0, Math.min(requestedCount, 8))
        .map((p) => ({ label: p.product, value: p.quantity, revenue: p.revenue })),
    },
  };
};

// Process inventory queries
const processInventoryQuery = async (intent, data, userId) => {
  const products = data.products || [];
  
  // Categorize inventory status
  const inventoryStatus = {
    'In Stock': 0,
    'Low Stock': 0,
    'Out of Stock': 0
  };
  
  products.forEach(product => {
    const quantity = product.quantity || 0;
    const minQuantity = product.minQuantity || 10;
    
    if (quantity === 0) {
      inventoryStatus['Out of Stock']++;
    } else if (quantity <= minQuantity) {
      inventoryStatus['Low Stock']++;
    } else {
      inventoryStatus['In Stock']++;
    }
  });
  
  const lowStockProducts = products.filter(p => 
    (p.quantity || 0) <= (p.minQuantity || 10) && (p.quantity || 0) > 0
  );
  
  return {
    summary: `Inventory status: ${inventoryStatus['In Stock']} in stock, ${inventoryStatus['Low Stock']} low stock, ${inventoryStatus['Out of Stock']} out of stock`,
    data: {
      inventoryStatus,
      lowStockProducts: lowStockProducts.slice(0, 5),
      totalProducts: products.length
    },
    chartConfig: {
      ...CHART_TEMPLATES.inventory,
      data: Object.entries(inventoryStatus).map(([status, count]) => ({
        label: status,
        value: count
      }))
    }
  };
};

// Process customers queries
const processCustomersQuery = async (intent, data, userId) => {
  const invoices = data.invoices || [];
  const customers = data.customers || [];
  
  // Apply time window if present
  const { timePeriod } = intent;
  const filteredInvoices = filterByTimePeriod(invoices, timePeriod);
  
  // Analyze customer data (matching traditional analytics logic)
  const customerMap = {};
  const customerProducts = {}; // Track products per customer
  const customerVisits = {}; // Track hourly visits
  
  filteredInvoices.forEach(invoice => {
    const customer = invoice.customer || {};
    const customerKey = customer.custId || customer.phone || customer.email || customer.name || 'Unknown';
    
    if (!customerMap[customerKey]) {
      customerMap[customerKey] = {
        custId: customer.custId,
        name: customer.name || 'Unknown',
        phone: customer.phone || 'N/A',
        email: customer.email || 'N/A',
        totalSpent: 0,
        orderCount: 0,
        avgOrderValue: 0,
        visits: 0,
        products: {}
      };
    }
    
    customerMap[customerKey].totalSpent += invoice.grandTotal || invoice.totalAmount || 0;
    customerMap[customerKey].orderCount += 1;
    customerMap[customerKey].visits += 1;
    
    // Track products per customer (matching CustomerProductsTable logic)
    (invoice.cartItems || []).forEach(item => {
      if (!customerMap[customerKey].products[item.name]) {
        customerMap[customerKey].products[item.name] = 0;
      }
      customerMap[customerKey].products[item.name] += item.quantity || 0;
    });
    
    // Track hourly visits (matching HourlyVisitChart logic)
    const timestamp = invoice.issuedAt || invoice.createdAt;
    if (timestamp) {
      const date = new Date(timestamp);
      const hour = date.getHours();
      if (!customerVisits[hour]) customerVisits[hour] = new Set();
      customerVisits[hour].add(customerKey);
    }
  });
  
  // Calculate average order value and top products per customer
  Object.values(customerMap).forEach(customer => {
    customer.avgOrderValue = customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0;
    customer.topProducts = Object.entries(customer.products)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, qty]) => `${name} (${qty})`)
      .join(", ");
  });
  
  // Sort by total spent (matching TopLoyalCustomersTable logic)
  const topCustomers = Object.values(customerMap)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);
  
  // Calculate retention metrics (matching CustomerRetentionCard logic)
  const totalCustomers = Object.keys(customerMap).length;
  const returningCustomers = Object.values(customerMap).filter(c => c.visits > 1).length;
  const retentionRate = totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100) : 0;
  
  const totalRevenue = Object.values(customerMap).reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrderValue = totalCustomers > 0 ? totalRevenue / Object.values(customerMap).reduce((sum, c) => sum + c.orderCount, 0) : 0;
  
  // Calculate hourly visit distribution
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    visits: customerVisits[i] ? customerVisits[i].size : 0
  }));
  
  return {
    summary: `Found ${totalCustomers} customers (${returningCustomers} returning, ${retentionRate.toFixed(1)}% retention) with total revenue of ₹${totalRevenue.toFixed(2)}`,
    data: {
      topCustomers: topCustomers.slice(0, 5),
      totalCustomers,
      returningCustomers,
      retentionRate,
      totalRevenue,
      avgOrderValue,
      hourlyData
    },
    chartConfig: {
      ...CHART_TEMPLATES.customers,
      data: topCustomers.slice(0, 8).map(customer => ({
        label: customer.name,
        value: customer.totalSpent,
        orders: customer.orderCount,
        visits: customer.visits
      }))
    }
  };
};

// Process invoice types queries
const processInvoiceTypesQuery = async (intent, data, userId) => {
  const invoices = data.invoices || [];
  
  // Apply time window if present
  const { timePeriod } = intent;
  const filteredInvoices = filterByTimePeriod(invoices, timePeriod);
  
  // Count invoice types (matching InvoiceTypeBreakdown logic)
  const typeCounts = {};
  
  filteredInvoices.forEach(invoice => {
    const type = invoice.invoiceType || 'Unspecified';
    if (!typeCounts[type]) {
      typeCounts[type] = 0;
    }
    typeCounts[type] += 1;
  });
  
  const totalInvoices = filteredInvoices.length;
  const typeBreakdown = Object.entries(typeCounts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalInvoices > 0 ? ((count / totalInvoices) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    summary: `Invoice breakdown: ${typeBreakdown.slice(0, 3).map(t => `${t.type} (${t.count})`).join(', ')}`,
    data: {
      typeBreakdown,
      totalInvoices,
      typeCounts
    },
    chartConfig: {
      type: 'pie',
      data: typeBreakdown.map(item => ({
        label: item.type,
        value: item.count,
        percentage: item.percentage
      })),
      title: 'Invoice Type Distribution'
    }
  };
};

// Process comparison queries
const processComparisonQuery = async (intent, data, userId) => {
  // This is a simplified implementation
  // In a real scenario, you'd parse the comparison periods more intelligently
  const invoices = data.invoices || [];
  
  // Compare this month vs last month
  const thisMonth = new Date();
  const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
  
  const thisMonthInvoices = invoices.filter(invoice => {
    const invoiceDate = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
    return invoiceDate >= new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  });
  
  const lastMonthInvoices = invoices.filter(invoice => {
    const invoiceDate = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
    return invoiceDate >= lastMonth && invoiceDate < new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  });
  
  const thisMonthRevenue = thisMonthInvoices.reduce((sum, invoice) => 
    sum + (invoice.grandTotal || invoice.totalAmount || 0), 0
  );
  
  const lastMonthRevenue = lastMonthInvoices.reduce((sum, invoice) => 
    sum + (invoice.grandTotal || invoice.totalAmount || 0), 0
  );
  
  const growth = lastMonthRevenue > 0 ? 
    ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  return {
    summary: `This month vs last month: ₹${thisMonthRevenue.toLocaleString()} vs ₹${lastMonthRevenue.toLocaleString()} (${growth > 0 ? '+' : ''}${growth.toFixed(1)}% change)`,
    data: {
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      growth: growth,
      thisMonthOrders: thisMonthInvoices.length,
      lastMonthOrders: lastMonthInvoices.length
    },
    chartConfig: {
      ...CHART_TEMPLATES.comparison,
      data: [
        { period: 'Last Month', value: lastMonthRevenue },
        { period: 'This Month', value: thisMonthRevenue }
      ]
    }
  };
};

// Process trends queries
const processTrendsQuery = async (intent, data, userId) => {
  const { timePeriod } = intent;
  const invoices = data.invoices || [];
  
  const filteredInvoices = filterByTimePeriod(invoices, timePeriod);
  const salesByDate = groupSalesByDate(filteredInvoices);
  
  const chartData = Object.entries(salesByDate)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString(),
      value: amount,
      label: new Date(date).toLocaleDateString()
    }));

  return {
    summary: `Revenue trends ${timePeriod.period}: ${chartData.length} data points showing ${chartData.length > 0 ? 'trending ' + (chartData[chartData.length - 1].value > chartData[0].value ? 'up' : 'down') : 'no data'}`,
    data: {
      trendData: chartData,
      period: timePeriod.period,
      dataPoints: chartData.length
    },
    chartConfig: {
      ...CHART_TEMPLATES.trends,
      data: chartData
    }
  };
};

// Helper functions
const filterByTimePeriod = (invoices, timePeriod) => {
  if (!timePeriod.config) return invoices;
  
  const now = new Date();
  const startDate = new Date();
  
  if (timePeriod.config.isQuarter) {
    // Handle quarter filtering (current quarter: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
    const currentQuarter = Math.floor(now.getMonth() / 3);
    startDate.setMonth(currentQuarter * 3, 1);
    startDate.setHours(0, 0, 0, 0);
  } else if (timePeriod.config.months) {
    startDate.setMonth(now.getMonth() + timePeriod.config.months);
  } else if (timePeriod.config.weeks) {
    startDate.setDate(now.getDate() + (timePeriod.config.weeks * 7));
  } else if (timePeriod.config.years) {
    startDate.setFullYear(now.getFullYear() + timePeriod.config.years);
  }
  
  return invoices.filter(invoice => {
    // Use issuedAt field like traditional analytics, with fallback to createdAt
    let invoiceDate;
    if (invoice.issuedAt?.toDate) {
      invoiceDate = invoice.issuedAt.toDate();
    } else if (typeof invoice.issuedAt === "string") {
      invoiceDate = new Date(invoice.issuedAt);
    } else if (invoice.createdAt?.toDate) {
      invoiceDate = invoice.createdAt.toDate();
    } else {
      invoiceDate = new Date(invoice.createdAt);
    }
    return invoiceDate >= startDate;
  });
};

const groupSalesByDate = (invoices) => {
  const salesByDate = {};
  
  invoices.forEach(invoice => {
    // Use issuedAt field like traditional analytics, with fallback to createdAt
    let invoiceDate;
    if (invoice.issuedAt?.toDate) {
      invoiceDate = invoice.issuedAt.toDate();
    } else if (typeof invoice.issuedAt === "string") {
      invoiceDate = new Date(invoice.issuedAt);
    } else if (invoice.createdAt?.toDate) {
      invoiceDate = invoice.createdAt.toDate();
    } else {
      invoiceDate = new Date(invoice.createdAt);
    }
    
    const dateKey = invoiceDate.toISOString().split('T')[0];
    
    if (!salesByDate[dateKey]) {
      salesByDate[dateKey] = 0;
    }
    salesByDate[dateKey] += invoice.grandTotal || invoice.totalAmount || 0;
  });
  
  return salesByDate;
};
