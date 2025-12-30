/**
 * AI-Powered Demand Forecasting Engine
 * Analyzes historical sales data to predict future demand
 * Solves real problems: stockouts, overstock, optimal reorder points
 */

import { collection, query, where, getDocs, getDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekday from 'dayjs/plugin/weekday';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekday);

/**
 * Calculate demand forecast using multiple algorithms
 */
export const calculateDemandForecast = async (userId, productId, productData, userRole = 'retailer') => {
  try {
    // Get historical sales data
    const salesData = await getHistoricalSalesData(userId, productId, userRole);
    
    // Count unique days with sales data
    const daysOfData = salesData ? salesData.length : 0;
    
    // CRITICAL: Always show predictions, even with limited data
    // Use available data to make intelligent estimates
    if (!salesData || salesData.length === 0) {
      return getDefaultForecast(productData, daysOfData);
    }
    
    // Store dataDays for return value (needed for dataProgress)
    const dataDays = salesData.length;

    // Calculate multiple forecast methods
    // Use adaptive periods based on available data - work with ANY amount of data
    const avgPeriod = dataDays >= 7 ? 7 : (dataDays >= 3 ? dataDays : Math.max(1, dataDays)); // Adaptive period
    
    const movingAverage = calculateMovingAverage(salesData, avgPeriod);
    const weightedAverage = calculateWeightedAverage(salesData, avgPeriod);
    const trendAnalysis = calculateTrendAnalysis(salesData);
    const seasonalFactor = calculateSeasonalFactor(salesData);
    
    // Combine forecasts with weights
    const forecast = combineForecasts({
      movingAverage,
      weightedAverage,
      trendAnalysis,
      seasonalFactor,
    });

    // Calculate confidence score (0-100) - More lenient with limited data
    // Even with 1 day of data, show 40% confidence (better than nothing)
    const baseConfidence = calculateConfidence(salesData, forecast);
    const confidence = dataDays < 7 
      ? Math.max(40, baseConfidence - (7 - dataDays) * 5) // Minimum 40% even with 1 day
      : baseConfidence;

    // Calculate days until stockout
    const currentStock = Number(productData.quantity || 0);
    const avgDailyDemand = forecast.dailyDemand;
    const daysUntilStockout = avgDailyDemand > 0 ? Math.floor(currentStock / avgDailyDemand) : Infinity;

    // Calculate optimal reorder point
    const reorderPoint = calculateOptimalReorderPoint(forecast, currentStock, salesData);

    // Risk assessment
    const riskLevel = assessStockoutRisk(daysUntilStockout, confidence, currentStock, forecast);

    return {
      // Core predictions
      dailyDemand: Math.round(forecast.dailyDemand * 10) / 10,
      weeklyDemand: Math.round(forecast.weeklyDemand),
      monthlyDemand: Math.round(forecast.monthlyDemand),
      
      // Stock analysis
      currentStock,
      daysUntilStockout: daysUntilStockout === Infinity ? null : daysUntilStockout,
      reorderPoint: reorderPoint.quantity,
      reorderDate: reorderPoint.date,
      
      // Confidence & risk
      confidence: Math.round(confidence),
      riskLevel, // 'low', 'medium', 'high', 'critical'
      riskMessage: getRiskMessage(riskLevel, daysUntilStockout),
      
      // Trends
      trend: trendAnalysis.direction, // 'increasing', 'decreasing', 'stable'
      trendPercentage: trendAnalysis.percentage,
      
      // Insights
      insights: generateInsights(forecast, salesData, currentStock, daysUntilStockout),
      
      // Historical context
      last7DaysSales: salesData.slice(-7).reduce((sum, d) => sum + d.quantity, 0),
      last30DaysSales: salesData.reduce((sum, d) => sum + d.quantity, 0),
      avgDailySales: salesData.length > 0 
        ? Math.round((salesData.reduce((sum, d) => sum + d.quantity, 0) / salesData.length) * 10) / 10
        : 0,
      
      // Recommendations
      recommendedOrderQuantity: calculateRecommendedOrder(forecast, currentStock, reorderPoint),
      urgency: daysUntilStockout < 7 ? 'urgent' : daysUntilStockout < 14 ? 'high' : daysUntilStockout < 30 ? 'medium' : 'low',
      
      // Data progress (for UI display)
      dataProgress: {
        daysOfData: dataDays,
        daysNeeded: Math.max(0, 7 - dataDays),
        minDaysRequired: 7,
        progressPercent: Math.min(100, (dataDays / 7) * 100),
        isReady: dataDays >= 7,
      },
    };
  } catch (error) {
    console.error('Error calculating forecast:', error);
    return getDefaultForecast(productData, 0);
  }
};

/**
 * Get historical sales data from invoices/orders
 */
const getHistoricalSalesData = async (userId, productId, userRole) => {
  try {
    const salesData = [];
    const now = dayjs();
    const startDate = now.subtract(90, 'days'); // Last 90 days
    
    if (userRole === 'retailer') {
      // For retailers: Get from finalized invoices
      const invoicesRef = collection(db, `businesses/${userId}/finalizedInvoices`);
      const invoicesQuery = query(
        invoicesRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate.toDate())),
        orderBy('createdAt', 'desc')
      );
      
      const invoicesSnap = await getDocs(invoicesQuery);
      invoicesSnap.forEach(doc => {
        const invoice = doc.data();
        const cart = invoice.cart || invoice.cartItems || [];
        
        cart.forEach(item => {
          if (item.id === productId || item.inventoryId === productId || item.sku === productId) {
            const date = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
            salesData.push({
              date: dayjs(date),
              quantity: Number(item.quantity || 0),
              revenue: Number(item.price || 0) * Number(item.quantity || 0),
            });
          }
        });
      });
    } else if (userRole === 'distributor') {
      // For distributors: Get from order requests (orders from retailers)
      // CRITICAL: Include orders that are actually fulfilled (delivered, shipped, out for delivery, accepted)
      // These represent actual sales, not just requests
      const ordersRef = collection(db, `businesses/${userId}/orderRequests`);
      
      // Get ALL orders (no date filter in query - we'll filter in code for flexibility)
      // This ensures we don't miss orders due to field name differences
      const ordersSnap = await getDocs(ordersRef);
      
      // Statuses that represent actual sales/fulfillment
      const fulfilledStatuses = [
        'DELIVERED', 'Delivered', 'delivered',
        'SHIPPED', 'Shipped', 'shipped',
        'OUT_FOR_DELIVERY', 'Out for Delivery', 'out for delivery',
        'ACCEPTED', 'Accepted', 'accepted',
        'INVOICED', 'Invoiced', 'invoiced'
      ];
      
      // First, get product data to match by SKU
      const productRef = doc(db, `businesses/${userId}/products`, productId);
      const productSnap = await getDoc(productRef);
      const productData = productSnap.exists() ? productSnap.data() : null;
      const productSku = productData?.sku;
      
      ordersSnap.forEach(orderDoc => {
        const order = orderDoc.data();
        const status = order.statusCode || order.status || '';
        const statusStr = String(status).toUpperCase();
        
        // Only include orders that are fulfilled (delivered, shipped, etc.)
        // This ensures we're counting actual sales, not just requests
        // CRITICAL: Include ACCEPTED orders since that's when stock is deducted
        const isFulfilled = fulfilledStatuses.some(s => 
          statusStr === s.toUpperCase() || 
          statusStr.includes('DELIVERED') || 
          statusStr.includes('SHIPPED') ||
          statusStr.includes('ACCEPTED')
        );
        
        // If order is not fulfilled, skip it (it's just a request, not a sale)
        if (!isFulfilled) {
          return;
        }
        
        const items = order.items || [];
        
        items.forEach(item => {
          // Enhanced matching: Try SKU first (most reliable), then productId
          const itemSku = item.sku || item.SKU;
          const itemProductId = item.distributorProductId || item.productId;
          
          // Match by SKU (most accurate) or productId
          const matches = 
            (itemSku && productSku && itemSku === productSku) ||
            (itemProductId && itemProductId === productId) ||
            (itemSku && itemSku === productId); // Fallback: productId might be SKU
          
          if (!matches) return;
          
          // Use the most appropriate date:
          // 1. acceptedAt (when order was accepted = stock deducted = actual sale)
          // 2. deliveredAt (if delivered) - most accurate for sales
          // 3. shippedAt (if shipped) - when it left warehouse
          // 4. timestamp or createdAt - fallback
          let orderDate = null;
          
          // PRIORITY: Use acceptedAt since that's when stock is actually deducted
          if (order.statusTimestamps?.acceptedAt) {
            orderDate = order.statusTimestamps.acceptedAt.toDate ? 
              order.statusTimestamps.acceptedAt.toDate() : 
              new Date(order.statusTimestamps.acceptedAt);
          } else if (order.statusTimestamps?.deliveredAt) {
            orderDate = order.statusTimestamps.deliveredAt.toDate ? 
              order.statusTimestamps.deliveredAt.toDate() : 
              new Date(order.statusTimestamps.deliveredAt);
          } else if (order.statusTimestamps?.shippedAt) {
            orderDate = order.statusTimestamps.shippedAt.toDate ? 
              order.statusTimestamps.shippedAt.toDate() : 
              new Date(order.statusTimestamps.shippedAt);
          } else if (order.timestamp) {
            orderDate = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
          } else if (order.createdAt) {
            orderDate = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
          } else {
            // Skip if no valid date
            return;
          }
          
          // Only include if date is within our range
          if (dayjs(orderDate).isBefore(startDate)) {
            return;
          }
          
            salesData.push({
              date: dayjs(orderDate),
              quantity: Number(item.quantity || item.qty || 0),
              revenue: Number(item.price || item.sellingPrice || item.unitPrice || 0) * Number(item.quantity || item.qty || 0),
              retailerId: order.retailerId, // Track which retailer for multi-retailer insights
              orderId: orderDoc.id, // Track order for analytics
            });
        });
      });
    }
    
    // Group by day and sum quantities
    const dailySales = {};
    salesData.forEach(sale => {
      const dayKey = sale.date.format('YYYY-MM-DD');
      if (!dailySales[dayKey]) {
        dailySales[dayKey] = { date: sale.date, quantity: 0, revenue: 0 };
      }
      dailySales[dayKey].quantity += sale.quantity;
      dailySales[dayKey].revenue += sale.revenue;
    });
    
    // Convert to array and sort by date
    return Object.values(dailySales)
      .sort((a, b) => a.date.valueOf() - b.date.valueOf())
      .map(d => ({ date: d.date, quantity: d.quantity, revenue: d.revenue }));
  } catch (error) {
    console.error('Error fetching historical sales:', error);
    return [];
  }
};

/**
 * Calculate simple moving average - Works with ANY amount of data
 */
const calculateMovingAverage = (salesData, period = 7) => {
  // Use available data even if less than period
  const availableData = salesData.length;
  const effectivePeriod = Math.min(period, Math.max(1, availableData));
  
  if (availableData === 0) return { dailyDemand: 0, weeklyDemand: 0, monthlyDemand: 0 };
  
  const recent = salesData.slice(-effectivePeriod);
  const total = recent.reduce((sum, d) => sum + d.quantity, 0);
  const dailyDemand = total / effectivePeriod;
  
  return {
    dailyDemand,
    weeklyDemand: dailyDemand * 7,
    monthlyDemand: dailyDemand * 30,
  };
};

/**
 * Calculate weighted moving average (recent days weighted more) - Works with ANY amount of data
 */
const calculateWeightedAverage = (salesData, period = 7) => {
  const availableData = salesData.length;
  const effectivePeriod = Math.min(period, Math.max(1, availableData));
  
  if (availableData === 0) return { dailyDemand: 0, weeklyDemand: 0, monthlyDemand: 0 };
  
  const recent = salesData.slice(-effectivePeriod);
  let weightedSum = 0;
  let weightSum = 0;
  
  recent.forEach((day, index) => {
    const weight = index + 1; // More recent = higher weight
    weightedSum += day.quantity * weight;
    weightSum += weight;
  });
  
  const dailyDemand = weightedSum / weightSum;
  
  return {
    dailyDemand,
    weeklyDemand: dailyDemand * 7,
    monthlyDemand: dailyDemand * 30,
  };
};

/**
 * Calculate trend analysis (increasing/decreasing/stable)
 */
const calculateTrendAnalysis = (salesData) => {
  if (salesData.length < 14) {
    return { direction: 'stable', percentage: 0 };
  }
  
  const firstHalf = salesData.slice(0, Math.floor(salesData.length / 2));
  const secondHalf = salesData.slice(Math.floor(salesData.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, d) => sum + d.quantity, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.quantity, 0) / secondHalf.length;
  
  const percentage = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  
  let direction = 'stable';
  if (percentage > 10) direction = 'increasing';
  else if (percentage < -10) direction = 'decreasing';
  
  return { direction, percentage: Math.round(percentage * 10) / 10 };
};

/**
 * Calculate seasonal factors (day of week patterns)
 */
const calculateSeasonalFactor = (salesData) => {
  if (salesData.length < 14) return { dailyDemand: 0, weeklyDemand: 0, monthlyDemand: 0 };
  
  // Group by day of week
  const dayOfWeekSales = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  salesData.forEach(day => {
    const dayOfWeek = day.date.day();
    dayOfWeekSales[dayOfWeek].push(day.quantity);
  });
  
  // Calculate average per day of week
  const dayAverages = {};
  Object.keys(dayOfWeekSales).forEach(day => {
    const sales = dayOfWeekSales[day];
    if (sales.length > 0) {
      dayAverages[day] = sales.reduce((sum, qty) => sum + qty, 0) / sales.length;
    }
  });
  
  // Overall average
  const overallAvg = Object.values(dayAverages).reduce((sum, avg) => sum + (avg || 0), 0) / 7;
  
  return {
    dailyDemand: overallAvg,
    weeklyDemand: overallAvg * 7,
    monthlyDemand: overallAvg * 30,
  };
};

/**
 * Combine multiple forecast methods
 */
const combineForecasts = (forecasts) => {
  // Weighted combination: weighted average (40%), moving average (30%), seasonal (20%), trend (10%)
  const dailyDemand = 
    forecasts.weightedAverage.dailyDemand * 0.4 +
    forecasts.movingAverage.dailyDemand * 0.3 +
    forecasts.seasonalFactor.dailyDemand * 0.2 +
    (forecasts.trendAnalysis.direction === 'increasing' 
      ? forecasts.movingAverage.dailyDemand * 1.1 
      : forecasts.trendAnalysis.direction === 'decreasing'
      ? forecasts.movingAverage.dailyDemand * 0.9
      : forecasts.movingAverage.dailyDemand) * 0.1;
  
  return {
    dailyDemand: Math.max(0, dailyDemand),
    weeklyDemand: dailyDemand * 7,
    monthlyDemand: dailyDemand * 30,
  };
};

/**
 * Calculate confidence score based on data quality - More lenient
 */
const calculateConfidence = (salesData, forecast) => {
  if (salesData.length === 0) return 0; // No data
  if (salesData.length < 7) {
    // Progressive confidence: 40% at 1 day, 50% at 3 days, 60% at 6 days
    // Always show something useful, even with limited data
    return Math.max(40, Math.round(40 + (salesData.length / 7) * 20));
  }
  if (salesData.length < 30) return 70; // Medium confidence (increased from 60)
  if (salesData.length < 60) return 85; // Good confidence (increased from 80)
  
  // Calculate variance (lower variance = higher confidence)
  const quantities = salesData.map(d => d.quantity);
  const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  // Lower variation = higher confidence
  const varianceScore = Math.max(0, 100 - (coefficientOfVariation * 100));
  
  return Math.min(95, Math.max(50, varianceScore));
};

/**
 * Calculate optimal reorder point
 */
const calculateOptimalReorderPoint = (forecast, currentStock, salesData) => {
  // Safety stock = 7 days of demand (buffer for uncertainty)
  const safetyStock = forecast.dailyDemand * 7;
  
  // Lead time demand (assuming 3-5 days for delivery)
  const leadTimeDays = 5;
  const leadTimeDemand = forecast.dailyDemand * leadTimeDays;
  
  // Optimal reorder point
  const reorderPoint = Math.ceil(safetyStock + leadTimeDemand);
  
  // Calculate when to reorder (days from now)
  const daysUntilReorder = currentStock > 0 
    ? Math.max(0, Math.floor((currentStock - reorderPoint) / forecast.dailyDemand))
    : 0;
  
  const reorderDate = dayjs().add(daysUntilReorder, 'days');
  
  return {
    quantity: reorderPoint,
    date: reorderDate,
    daysUntilReorder,
  };
};

/**
 * Calculate recommended order quantity
 */
const calculateRecommendedOrder = (forecast, currentStock, reorderPoint) => {
  // Order enough to cover next 30 days + safety stock
  const targetStock = forecast.monthlyDemand + (forecast.dailyDemand * 7); // 30 days + 7 days safety
  const recommendedQty = Math.max(0, Math.ceil(targetStock - currentStock));
  
  // Round to reasonable increments (e.g., 5, 10, 25, 50)
  if (recommendedQty <= 10) return recommendedQty;
  if (recommendedQty <= 25) return Math.ceil(recommendedQty / 5) * 5;
  if (recommendedQty <= 100) return Math.ceil(recommendedQty / 10) * 10;
  return Math.ceil(recommendedQty / 25) * 25;
};

/**
 * Assess stockout risk level
 */
const assessStockoutRisk = (daysUntilStockout, confidence, currentStock, forecast) => {
  if (currentStock === 0) return 'critical';
  if (daysUntilStockout === null || daysUntilStockout === Infinity) return 'low';
  
  if (daysUntilStockout < 3) return 'critical';
  if (daysUntilStockout < 7) return 'high';
  if (daysUntilStockout < 14) return 'medium';
  if (daysUntilStockout < 30) return 'low';
  
  return 'low';
};

/**
 * Get risk message - Simple and clear
 */
const getRiskMessage = (riskLevel, daysUntilStockout) => {
  if (riskLevel === 'critical') {
    return daysUntilStockout === null 
      ? 'Out of stock! Order immediately.'
      : `Will finish in ${daysUntilStockout} days! Order now.`;
  }
  if (riskLevel === 'high') {
    return `Will finish in ${daysUntilStockout} days. Order soon.`;
  }
  if (riskLevel === 'medium') {
    return `Will finish in ${daysUntilStockout} days. Plan to order.`;
  }
  return `Stock will last ${daysUntilStockout} days. You're good!`;
};

/**
 * Generate actionable insights - Simple language
 */
const generateInsights = (forecast, salesData, currentStock, daysUntilStockout) => {
  const insights = [];
  
  // Stockout warning - Simple
  if (daysUntilStockout !== null && daysUntilStockout < 7) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      message: `This will finish in ${daysUntilStockout} days. Order now to avoid running out!`,
      action: 'order_now',
    });
  }
  
  // Trend insights - Simple
  if (salesData.length >= 14) {
    const recentAvg = salesData.slice(-7).reduce((sum, d) => sum + d.quantity, 0) / 7;
    const olderAvg = salesData.slice(-14, -7).reduce((sum, d) => sum + d.quantity, 0) / 7;
    if (recentAvg > olderAvg * 1.2) {
      insights.push({
        type: 'trend',
        icon: '📈',
        message: `Great! You're selling ${Math.round(((recentAvg - olderAvg) / olderAvg) * 100)}% more this week. Customers like this product!`,
        action: 'increase_stock',
      });
    } else if (recentAvg < olderAvg * 0.8 && olderAvg > 0) {
      insights.push({
        type: 'trend',
        icon: '📉',
        message: `Sales down ${Math.round(((olderAvg - recentAvg) / olderAvg) * 100)}% this week. Maybe order less next time.`,
        action: 'reduce_stock',
      });
    }
  }
  
  // Overstock warning - Simple
  if (daysUntilStockout !== null && daysUntilStockout > 60) {
    insights.push({
      type: 'info',
      icon: '📦',
      message: `You have a lot of stock (${daysUntilStockout} days). Maybe order less next time.`,
      action: 'review_stock',
    });
  }
  
  return insights;
};

/**
 * Get default forecast when no data available OR create smart estimate from limited data
 * ALWAYS shows useful insights, never just "collecting data"
 */
const getDefaultForecast = (productData, salesDataCount = 0) => {
  const currentStock = Number(productData.quantity || 0);
  const daysOfData = salesDataCount;
  const minDaysRequired = 7;
  const daysNeeded = Math.max(0, minDaysRequired - daysOfData);
  const progressPercent = Math.min(100, (daysOfData / minDaysRequired) * 100);
  
  // MAGICAL INSIGHT: Even with no data, provide useful information based on stock levels
  // This ensures users always see value, not just "collecting data"
  
  // If stock is very low, show urgent warning regardless of data
  let daysUntilStockout = null;
  let riskLevel = 'low';
  let riskMessage = 'Stock is good!';
  let dailyDemand = 0;
  let weeklyDemand = 0;
  let monthlyDemand = 0;
  let confidence = 20; // Low confidence but still show something
  let urgency = 'low';
  
  // Smart estimates based on stock level
  if (currentStock === 0) {
    riskLevel = 'critical';
    riskMessage = 'Out of stock! Order immediately.';
    urgency = 'urgent';
    confidence = 100; // High confidence on this - it's factual
  } else if (currentStock <= 5) {
    // Very low stock - estimate based on typical patterns
    dailyDemand = 0.5; // Conservative estimate
    weeklyDemand = 3;
    monthlyDemand = 15;
    daysUntilStockout = Math.floor(currentStock / dailyDemand);
    riskLevel = daysUntilStockout < 7 ? 'critical' : 'high';
    riskMessage = `Low stock (${currentStock} units). Order soon to avoid stockout.`;
    urgency = 'high';
    confidence = 40; // Moderate confidence - based on stock level
  } else if (currentStock <= 10) {
    // Low stock - show warning
    dailyDemand = 0.3;
    weeklyDemand = 2;
    monthlyDemand = 9;
    daysUntilStockout = Math.floor(currentStock / dailyDemand);
    riskLevel = daysUntilStockout < 14 ? 'high' : 'medium';
    riskMessage = `Stock is getting low (${currentStock} units). Plan to reorder.`;
    urgency = 'medium';
    confidence = 30;
  } else {
    // Good stock - show positive message
    daysUntilStockout = null; // Can't calculate without sales data
    riskMessage = `You have ${currentStock} units in stock. Once we see sales data, we'll predict when you'll need more!`;
    confidence = 20;
  }

  return {
    dailyDemand: Math.round(dailyDemand * 10) / 10,
    weeklyDemand: Math.round(weeklyDemand),
    monthlyDemand: Math.round(monthlyDemand),
    currentStock,
    daysUntilStockout,
    reorderPoint: { 
      quantity: Math.max(10, Math.ceil(weeklyDemand * 2)), 
      date: dayjs().add(7, 'days') 
    },
    confidence,
    riskLevel,
    riskMessage,
    trend: 'stable',
    trendPercentage: 0,
    insights: generateSmartInsights(currentStock, daysOfData, daysNeeded, daysUntilStockout),
    last7DaysSales: 0,
    last30DaysSales: 0,
    avgDailySales: dailyDemand,
    recommendedOrderQuantity: currentStock <= 10 ? Math.max(20, currentStock * 2) : 0,
    urgency,
    // Data collection progress
    dataProgress: {
      daysOfData,
      daysNeeded,
      minDaysRequired,
      progressPercent,
      isReady: daysOfData >= minDaysRequired,
    },
  };
};

/**
 * Generate smart insights even with limited data
 */
const generateSmartInsights = (currentStock, daysOfData, daysNeeded, daysUntilStockout) => {
  const insights = [];
  
  // Stock-based insights (always available)
  if (currentStock === 0) {
    insights.push({
      type: 'critical',
      icon: '🚨',
      message: 'This product is out of stock! Order immediately to fulfill retailer orders.',
      action: 'order_now',
    });
  } else if (currentStock <= 5) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      message: `Very low stock (${currentStock} units). Order now to avoid stockout and lost sales.`,
      action: 'order_urgent',
    });
  } else if (currentStock <= 10) {
    insights.push({
      type: 'info',
      icon: '📦',
      message: `Stock is getting low (${currentStock} units). Consider ordering soon.`,
      action: 'order_soon',
    });
  } else {
    insights.push({
      type: 'success',
      icon: '✅',
      message: `Good stock level (${currentStock} units). We're tracking sales to predict when you'll need more.`,
      action: 'monitor',
    });
  }
  
  // Data collection insights
  if (daysOfData === 0) {
    insights.push({
      type: 'info',
      icon: '📊',
      message: 'Once retailers start ordering this product, we\'ll show accurate demand predictions and reorder suggestions!',
      action: 'wait_for_data',
    });
  } else if (daysNeeded > 0) {
    insights.push({
      type: 'info',
      icon: '📈',
      message: `We have ${daysOfData} day${daysOfData > 1 ? 's' : ''} of sales data. With ${daysNeeded} more day${daysNeeded > 1 ? 's' : ''}, predictions will be more accurate!`,
      action: 'collecting_data',
    });
  } else {
    insights.push({
      type: 'success',
      icon: '🎯',
      message: 'We have enough sales data for accurate predictions!',
      action: 'ready',
    });
  }
  
  return insights;
};

/**
 * Batch forecast for multiple products
 */
export const batchForecastProducts = async (userId, products, userRole = 'retailer') => {
  const forecasts = await Promise.all(
    products.map(async (product) => {
      const forecast = await calculateDemandForecast(userId, product.id, product, userRole);
      return {
        productId: product.id,
        productName: product.name || product.productName,
        sku: product.sku,
        ...forecast,
      };
    })
  );
  
  // Sort by urgency (critical first)
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  forecasts.sort((a, b) => {
    const aUrgency = urgencyOrder[a.riskLevel] ?? 3;
    const bUrgency = urgencyOrder[b.riskLevel] ?? 3;
    return aUrgency - bUrgency;
  });
  
  return forecasts;
};

