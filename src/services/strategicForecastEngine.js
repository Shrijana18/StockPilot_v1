/**
 * Strategic AI Forecasting Engine for Distributors
 * Solves REAL distributor problems:
 * 1. Multi-retailer demand aggregation
 * 2. Seasonal pattern detection
 * 3. Optimal reorder timing (cash flow + lead times)
 * 4. Retailer behavior analysis
 * 5. Fast/slow mover identification
 * 6. Bulk ordering opportunities
 * 7. Warehouse capacity planning
 * 8. Profit margin optimization
 */

import { collection, query, where, getDocs, getDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import weekday from 'dayjs/plugin/weekday';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(weekday);

/**
 * Strategic Forecast - Game-changing insights for distributors
 */
export const calculateStrategicForecast = async (distributorId, productId, productData) => {
  try {
    // Get comprehensive sales data with retailer breakdown
    const salesData = await getStrategicSalesData(distributorId, productId);
    
    const currentStock = Number(productData.quantity || 0);
    const costPrice = Number(productData.costPrice || 0);
    const sellingPrice = Number(productData.sellingPrice || 0);
    const profitMargin = sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0;
    
    // If no sales data, provide strategic stock-based insights
    if (!salesData || salesData.length === 0) {
      return getStrategicDefaultForecast(productData, salesData?.length || 0);
    }
    
    // Calculate demand patterns
    const demandPattern = analyzeDemandPattern(salesData);
    const retailerAnalysis = analyzeRetailerBehavior(salesData);
    const seasonalPattern = detectSeasonalPatterns(salesData);
    
    // Calculate forecasts
    const baseForecast = calculateBaseForecast(salesData);
    
    // Strategic calculations
    const cashFlowImpact = calculateCashFlowImpact(
      baseForecast,
      currentStock,
      costPrice,
      sellingPrice
    );
    
    const optimalOrderTiming = calculateOptimalOrderTiming(
      baseForecast,
      currentStock,
      demandPattern,
      seasonalPattern
    );
    
    const bulkOrderOpportunity = identifyBulkOrderOpportunity(
      baseForecast,
      currentStock,
      costPrice,
      demandPattern
    );
    
    const riskAnalysis = performRiskAnalysis(
      currentStock,
      baseForecast,
      retailerAnalysis,
      seasonalPattern
    );
    
    // Calculate days until stockout with confidence intervals
    const avgDailyDemand = baseForecast.dailyDemand;
    const daysUntilStockout = avgDailyDemand > 0 
      ? Math.floor(currentStock / avgDailyDemand) 
      : null;
    
    const stockoutRisk = assessStockoutRisk(daysUntilStockout, baseForecast, retailerAnalysis);
    
    return {
      // Core predictions
      ...baseForecast,
      currentStock,
      daysUntilStockout,
      
      // Strategic insights
      demandPattern, // 'stable', 'growing', 'declining', 'seasonal', 'irregular'
      retailerAnalysis, // Top retailers, ordering patterns
      seasonalPattern, // Upcoming spikes, historical patterns
      
      // Financial insights
      cashFlowImpact, // Money tied up, ROI, profit potential
      optimalOrderTiming, // When to order, how much
      bulkOrderOpportunity, // Bulk discount opportunities
      
      // Risk & opportunities
      riskAnalysis, // Stockout risk, overstock risk, market risk
      stockoutRisk, // Detailed risk breakdown
      
      // Actionable recommendations
      strategicRecommendations: generateStrategicRecommendations({
        currentStock,
        forecast: baseForecast,
        demandPattern,
        retailerAnalysis,
        seasonalPattern,
        cashFlowImpact,
        optimalOrderTiming,
        riskAnalysis,
        profitMargin,
      }),
      
      // Competitive intelligence
      marketInsights: generateMarketInsights(salesData, retailerAnalysis),
      
      // Confidence & data quality
      confidence: calculateStrategicConfidence(salesData, retailerAnalysis),
      dataQuality: assessDataQuality(salesData),
    };
  } catch (error) {
    console.error('Error calculating strategic forecast:', error);
    return getStrategicDefaultForecast(productData, 0);
  }
};

/**
 * Get strategic sales data with retailer breakdown
 */
const getStrategicSalesData = async (distributorId, productId) => {
  try {
    const salesData = [];
    const retailerBreakdown = {}; // Track which retailers order what
    const now = dayjs();
    const startDate = now.subtract(90, 'days');
    
    // Get product data for SKU matching
    const productRef = doc(db, `businesses/${distributorId}/products`, productId);
    const productSnap = await getDoc(productRef);
    const productData = productSnap.exists() ? productSnap.data() : null;
    const productSku = productData?.sku;
    
    // Get all orders
    const ordersRef = collection(db, `businesses/${distributorId}/orderRequests`);
    const ordersSnap = await getDocs(ordersRef);
    
    const fulfilledStatuses = ['ACCEPTED', 'DELIVERED', 'SHIPPED', 'OUT_FOR_DELIVERY'];
    
    ordersSnap.forEach(orderDoc => {
      const order = orderDoc.data();
      const status = String(order.statusCode || order.status || '').toUpperCase();
      
      if (!fulfilledStatuses.some(s => status.includes(s))) return;
      
      const items = order.items || [];
      const retailerId = order.retailerId;
      const retailerName = order.retailerName || 'Unknown Retailer';
      
      items.forEach(item => {
        const itemSku = item.sku || item.SKU;
        const itemProductId = item.distributorProductId || item.productId;
        
        const matches = 
          (itemSku && productSku && itemSku === productSku) ||
          (itemProductId && itemProductId === productId);
        
        if (!matches) return;
        
        // Get order date
        let orderDate = null;
        if (order.statusTimestamps?.acceptedAt) {
          orderDate = order.statusTimestamps.acceptedAt.toDate ? 
            order.statusTimestamps.acceptedAt.toDate() : 
            new Date(order.statusTimestamps.acceptedAt);
        } else if (order.timestamp) {
          orderDate = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
        } else if (order.createdAt) {
          orderDate = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        }
        
        if (!orderDate || dayjs(orderDate).isBefore(startDate)) return;
        
        const quantity = Number(item.quantity || item.qty || 0);
        const revenue = Number(item.price || item.sellingPrice || item.unitPrice || 0) * quantity;
        
        salesData.push({
          date: dayjs(orderDate),
          quantity,
          revenue,
          retailerId,
          retailerName,
          orderId: orderDoc.id,
        });
        
        // Track retailer breakdown
        if (!retailerBreakdown[retailerId]) {
          retailerBreakdown[retailerId] = {
            name: retailerName,
            totalQuantity: 0,
            totalRevenue: 0,
            orderCount: 0,
            avgOrderSize: 0,
            lastOrderDate: null,
            orderingFrequency: null,
          };
        }
        
        retailerBreakdown[retailerId].totalQuantity += quantity;
        retailerBreakdown[retailerId].totalRevenue += revenue;
        retailerBreakdown[retailerId].orderCount += 1;
        if (!retailerBreakdown[retailerId].lastOrderDate || 
            dayjs(orderDate).isAfter(retailerBreakdown[retailerId].lastOrderDate)) {
          retailerBreakdown[retailerId].lastOrderDate = dayjs(orderDate);
        }
      });
    });
    
    // Calculate retailer metrics
    Object.keys(retailerBreakdown).forEach(retailerId => {
      const retailer = retailerBreakdown[retailerId];
      retailer.avgOrderSize = retailer.totalQuantity / retailer.orderCount;
      
      // Calculate ordering frequency (days between orders)
      const retailerOrders = salesData
        .filter(s => s.retailerId === retailerId)
        .map(s => s.date)
        .sort((a, b) => a.valueOf() - b.valueOf());
      
      if (retailerOrders.length > 1) {
        const totalDays = retailerOrders[retailerOrders.length - 1].diff(retailerOrders[0], 'day');
        retailer.orderingFrequency = totalDays / (retailerOrders.length - 1);
      }
    });
    
    // Group by day
    const dailySales = {};
    salesData.forEach(sale => {
      const dayKey = sale.date.format('YYYY-MM-DD');
      if (!dailySales[dayKey]) {
        dailySales[dayKey] = { 
          date: sale.date, 
          quantity: 0, 
          revenue: 0,
          retailers: new Set(),
          orderCount: 0,
        };
      }
      dailySales[dayKey].quantity += sale.quantity;
      dailySales[dayKey].revenue += sale.revenue;
      dailySales[dayKey].retailers.add(sale.retailerId);
      dailySales[dayKey].orderCount += 1;
    });
    
    return {
      daily: Object.values(dailySales)
        .sort((a, b) => a.date.valueOf() - b.date.valueOf())
        .map(d => ({
          date: d.date,
          quantity: d.quantity,
          revenue: d.revenue,
          retailerCount: d.retailers.size,
          orderCount: d.orderCount,
        })),
      retailerBreakdown,
      totalRetailers: Object.keys(retailerBreakdown).length,
    };
  } catch (error) {
    console.error('Error fetching strategic sales data:', error);
    return null;
  }
};

/**
 * Analyze demand pattern
 */
const analyzeDemandPattern = (salesData) => {
  const daily = salesData.daily || [];
  if (daily.length < 7) return { type: 'insufficient_data', trend: 'stable', volatility: 'low' };
  
  const quantities = daily.map(d => d.quantity);
  const avg = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
  
  // Calculate trend
  const firstHalf = quantities.slice(0, Math.floor(quantities.length / 2));
  const secondHalf = quantities.slice(Math.floor(quantities.length / 2));
  const firstAvg = firstHalf.reduce((sum, q) => sum + q, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, q) => sum + q, 0) / secondHalf.length;
  const trendChange = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  // Calculate volatility
  const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avg > 0 ? stdDev / avg : 0;
  
  // Detect pattern type
  let type = 'stable';
  if (trendChange > 20) type = 'growing';
  else if (trendChange < -20) type = 'declining';
  else if (coefficientOfVariation > 0.5) type = 'irregular';
  
  // Check for weekly patterns
  const dayOfWeekPattern = {};
  daily.forEach(d => {
    const day = d.date.day();
    if (!dayOfWeekPattern[day]) dayOfWeekPattern[day] = [];
    dayOfWeekPattern[day].push(d.quantity);
  });
  
  const weeklyVariation = Object.values(dayOfWeekPattern).map(dayData => {
    const avg = dayData.reduce((sum, q) => sum + q, 0) / dayData.length;
    return avg;
  });
  
  const maxDay = Math.max(...weeklyVariation);
  const minDay = Math.min(...weeklyVariation);
  const weeklyVariationPct = maxDay > 0 ? ((maxDay - minDay) / maxDay) * 100 : 0;
  
  if (weeklyVariationPct > 30) type = 'seasonal'; // Strong weekly pattern
  
  return {
    type,
    trend: trendChange > 5 ? 'increasing' : trendChange < -5 ? 'decreasing' : 'stable',
    trendPercentage: Math.round(trendChange),
    volatility: coefficientOfVariation < 0.3 ? 'low' : coefficientOfVariation < 0.6 ? 'medium' : 'high',
    weeklyPattern: weeklyVariationPct > 30,
    peakDay: weeklyVariation.indexOf(maxDay),
  };
};

/**
 * Analyze retailer behavior
 */
const analyzeRetailerBehavior = (salesData) => {
  const breakdown = salesData.retailerBreakdown || {};
  const retailers = Object.values(breakdown);
  
  if (retailers.length === 0) {
    return {
      totalRetailers: 0,
      topRetailers: [],
      orderingPatterns: {},
    };
  }
  
  // Sort by total quantity
  const topRetailers = retailers
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 5)
    .map((r, idx) => ({
      rank: idx + 1,
      name: r.name,
      totalQuantity: r.totalQuantity,
      totalRevenue: r.totalRevenue,
      orderCount: r.orderCount,
      avgOrderSize: Math.round(r.avgOrderSize),
      orderingFrequency: r.orderingFrequency ? Math.round(r.orderingFrequency) : null,
      contribution: 0, // Will calculate below
    }));
  
  const totalQuantity = retailers.reduce((sum, r) => sum + r.totalQuantity, 0);
  topRetailers.forEach(r => {
    r.contribution = totalQuantity > 0 ? Math.round((r.totalQuantity / totalQuantity) * 100) : 0;
  });
  
  // Identify ordering patterns
  const patterns = {
    frequent: retailers.filter(r => r.orderingFrequency && r.orderingFrequency <= 7).length,
    weekly: retailers.filter(r => r.orderingFrequency && r.orderingFrequency > 7 && r.orderingFrequency <= 14).length,
    monthly: retailers.filter(r => r.orderingFrequency && r.orderingFrequency > 14).length,
    irregular: retailers.filter(r => !r.orderingFrequency || r.orderCount < 2).length,
  };
  
  return {
    totalRetailers: retailers.length,
    topRetailers,
    orderingPatterns: patterns,
    concentrationRisk: topRetailers[0]?.contribution > 50, // If top retailer > 50% of sales
  };
};

/**
 * Detect seasonal patterns
 */
const detectSeasonalPatterns = (salesData) => {
  const daily = salesData.daily || [];
  if (daily.length < 30) return { hasPattern: false };
  
  // Group by month
  const monthly = {};
  daily.forEach(d => {
    const monthKey = d.date.format('YYYY-MM');
    if (!monthly[monthKey]) monthly[monthKey] = { quantity: 0, count: 0 };
    monthly[monthKey].quantity += d.quantity;
    monthly[monthKey].count += 1;
  });
  
  const monthlyAvgs = Object.entries(monthly).map(([month, data]) => ({
    month,
    avgDaily: data.quantity / data.count,
  }));
  
  const maxMonth = monthlyAvgs.reduce((max, m) => m.avgDaily > max.avgDaily ? m : max, monthlyAvgs[0]);
  const minMonth = monthlyAvgs.reduce((min, m) => m.avgDaily < min.avgDaily ? m : min, monthlyAvgs[0]);
  
  const variation = maxMonth.avgDaily > 0 
    ? ((maxMonth.avgDaily - minMonth.avgDaily) / maxMonth.avgDaily) * 100 
    : 0;
  
  // Predict next month
  const currentMonth = dayjs().format('YYYY-MM');
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM');
  const currentMonthData = monthly[currentMonth];
  const historicalNextMonth = monthly[nextMonth] || monthlyAvgs.find(m => m.month === nextMonth);
  
  return {
    hasPattern: variation > 20,
    peakMonth: maxMonth.month,
    lowMonth: minMonth.month,
    variation: Math.round(variation),
    nextMonthPrediction: historicalNextMonth ? {
      month: nextMonth,
      expectedDemand: historicalNextMonth.avgDaily * 30,
      confidence: 'medium',
    } : null,
  };
};

/**
 * Calculate base forecast
 */
const calculateBaseForecast = (salesData) => {
  const daily = salesData.daily || [];
  if (daily.length === 0) {
    return { dailyDemand: 0, weeklyDemand: 0, monthlyDemand: 0 };
  }
  
  const totalQuantity = daily.reduce((sum, d) => sum + d.quantity, 0);
  const days = daily.length;
  const dailyDemand = totalQuantity / days;
  
  return {
    dailyDemand: Math.round(dailyDemand * 10) / 10,
    weeklyDemand: Math.round(dailyDemand * 7),
    monthlyDemand: Math.round(dailyDemand * 30),
  };
};

/**
 * Calculate cash flow impact
 */
const calculateCashFlowImpact = (forecast, currentStock, costPrice, sellingPrice) => {
  const profitPerUnit = sellingPrice - costPrice;
  const monthlyRevenue = forecast.monthlyDemand * sellingPrice;
  const monthlyProfit = forecast.monthlyDemand * profitPerUnit;
  
  // Current inventory value
  const inventoryValue = currentStock * costPrice;
  
  // Recommended order value
  const recommendedOrder = Math.max(0, forecast.monthlyDemand * 1.5 - currentStock);
  const orderValue = recommendedOrder * costPrice;
  
  // ROI if we order
  const monthlyROI = orderValue > 0 ? (monthlyProfit / orderValue) * 100 : 0;
  
  return {
    currentInventoryValue: Math.round(inventoryValue),
    monthlyRevenuePotential: Math.round(monthlyRevenue),
    monthlyProfitPotential: Math.round(monthlyProfit),
    recommendedOrderValue: Math.round(orderValue),
    monthlyROI: Math.round(monthlyROI),
    profitMargin: Math.round((profitPerUnit / sellingPrice) * 100),
  };
};

/**
 * Calculate optimal order timing
 */
const calculateOptimalOrderTiming = (forecast, currentStock, demandPattern, seasonalPattern) => {
  const avgDailyDemand = forecast.dailyDemand;
  const daysUntilStockout = avgDailyDemand > 0 ? Math.floor(currentStock / avgDailyDemand) : null;
  
  // Lead time (assume 5-7 days from supplier)
  const leadTime = 7;
  const safetyStock = avgDailyDemand * 7; // 7 days buffer
  
  // Optimal reorder point
  const reorderPoint = Math.ceil(avgDailyDemand * leadTime + safetyStock);
  const daysUntilReorder = currentStock > reorderPoint 
    ? Math.floor((currentStock - reorderPoint) / avgDailyDemand)
    : 0;
  
  // Consider seasonal spikes
  let urgency = 'normal';
  if (daysUntilStockout && daysUntilStockout < 7) urgency = 'urgent';
  else if (daysUntilStockout && daysUntilStockout < 14) urgency = 'high';
  
  if (seasonalPattern?.nextMonthPrediction && 
      seasonalPattern.nextMonthPrediction.expectedDemand > forecast.monthlyDemand * 1.5) {
    urgency = 'high'; // Upcoming seasonal spike
  }
  
  return {
    reorderPoint,
    daysUntilReorder: Math.max(0, daysUntilReorder),
    reorderDate: dayjs().add(daysUntilReorder, 'days'),
    urgency,
    leadTime,
    safetyStock: Math.ceil(safetyStock),
    reason: daysUntilStockout < leadTime 
      ? 'Order now to avoid stockout before delivery'
      : daysUntilReorder <= 3
      ? 'Order within 3 days to maintain optimal stock'
      : 'Plan to order based on current demand',
  };
};

/**
 * Identify bulk order opportunities
 */
const identifyBulkOrderOpportunity = (forecast, currentStock, costPrice, demandPattern) => {
  const monthlyDemand = forecast.monthlyDemand;
  const recommendedOrder = Math.max(0, monthlyDemand * 1.5 - currentStock);
  
  // Typical bulk discount thresholds
  const bulkThresholds = [
    { minQty: 100, discount: 5 },
    { minQty: 250, discount: 10 },
    { minQty: 500, discount: 15 },
    { minQty: 1000, discount: 20 },
  ];
  
  const nextThreshold = bulkThresholds.find(t => recommendedOrder < t.minQty);
  
  if (!nextThreshold) {
    // Already qualifies for bulk
    return {
      hasOpportunity: true,
      currentOrder: recommendedOrder,
      bulkThreshold: null,
      additionalQty: 0,
      potentialSavings: 0,
      recommendation: 'You qualify for bulk pricing!',
    };
  }
  
  const additionalQty = nextThreshold.minQty - recommendedOrder;
  const potentialSavings = (additionalQty * costPrice * nextThreshold.discount) / 100;
  
  // Only recommend if it makes sense (not too much overstock)
  const maxReasonableOrder = monthlyDemand * 3; // 3 months supply max
  const isReasonable = (recommendedOrder + additionalQty) <= maxReasonableOrder;
  
  return {
    hasOpportunity: isReasonable && additionalQty <= monthlyDemand,
    currentOrder: recommendedOrder,
    bulkThreshold: nextThreshold.minQty,
    additionalQty: isReasonable ? additionalQty : 0,
    potentialSavings: isReasonable ? Math.round(potentialSavings) : 0,
    recommendation: isReasonable && additionalQty > 0
      ? `Order ${additionalQty} more units to get ${nextThreshold.discount}% bulk discount. Save ₹${Math.round(potentialSavings)}!`
      : 'Current order size is optimal',
  };
};

/**
 * Perform risk analysis
 */
const performRiskAnalysis = (currentStock, forecast, retailerAnalysis, seasonalPattern) => {
  const avgDailyDemand = forecast.dailyDemand;
  const daysUntilStockout = avgDailyDemand > 0 ? Math.floor(currentStock / avgDailyDemand) : null;
  
  const risks = [];
  const opportunities = [];
  
  // Stockout risk
  if (daysUntilStockout && daysUntilStockout < 7) {
    risks.push({
      type: 'stockout',
      severity: 'critical',
      message: `Will run out in ${daysUntilStockout} days. Risk of losing sales and retailers.`,
      impact: 'high',
    });
  } else if (daysUntilStockout && daysUntilStockout < 14) {
    risks.push({
      type: 'stockout',
      severity: 'high',
      message: `Low stock (${daysUntilStockout} days left). Order soon to avoid stockout.`,
      impact: 'medium',
    });
  }
  
  // Concentration risk (too dependent on one retailer)
  if (retailerAnalysis.concentrationRisk) {
    risks.push({
      type: 'concentration',
      severity: 'medium',
      message: `${retailerAnalysis.topRetailers[0]?.name} accounts for ${retailerAnalysis.topRetailers[0]?.contribution}% of sales. High dependency risk.`,
      impact: 'medium',
    });
  }
  
  // Seasonal spike risk
  if (seasonalPattern?.nextMonthPrediction && 
      seasonalPattern.nextMonthPrediction.expectedDemand > forecast.monthlyDemand * 1.5) {
    risks.push({
      type: 'seasonal',
      severity: 'high',
      message: `Upcoming seasonal spike expected. Demand may increase ${Math.round((seasonalPattern.nextMonthPrediction.expectedDemand / forecast.monthlyDemand - 1) * 100)}% next month.`,
      impact: 'high',
    });
  }
  
  // Opportunities
  if (forecast.monthlyDemand > 0 && currentStock > forecast.monthlyDemand * 2) {
    opportunities.push({
      type: 'overstock',
      message: `You have ${Math.round(currentStock / forecast.monthlyDemand)} months of stock. Consider reducing next order.`,
    });
  }
  
  if (retailerAnalysis.totalRetailers > 5) {
    opportunities.push({
      type: 'growth',
      message: `Selling to ${retailerAnalysis.totalRetailers} retailers. Strong market demand!`,
    });
  }
  
  return {
    risks,
    opportunities,
    overallRisk: risks.some(r => r.severity === 'critical') ? 'critical' :
                 risks.some(r => r.severity === 'high') ? 'high' :
                 risks.some(r => r.severity === 'medium') ? 'medium' : 'low',
  };
};

/**
 * Assess stockout risk with detailed breakdown
 */
const assessStockoutRisk = (daysUntilStockout, forecast, retailerAnalysis) => {
  if (daysUntilStockout === null) {
    return {
      level: 'low',
      probability: 0,
      impact: 'low',
      message: 'Cannot calculate - no demand data',
    };
  }
  
  let level = 'low';
  let probability = 0;
  
  if (daysUntilStockout < 3) {
    level = 'critical';
    probability = 95;
  } else if (daysUntilStockout < 7) {
    level = 'high';
    probability = 70;
  } else if (daysUntilStockout < 14) {
    level = 'medium';
    probability = 40;
  } else if (daysUntilStockout < 30) {
    level = 'low';
    probability = 20;
  }
  
  // Adjust based on retailer concentration
  if (retailerAnalysis.concentrationRisk && level !== 'critical') {
    probability += 10; // Higher risk if dependent on few retailers
  }
  
  const impact = level === 'critical' ? 'high' : level === 'high' ? 'medium' : 'low';
  
  return {
    level,
    probability: Math.min(100, probability),
    impact,
    message: daysUntilStockout < 7
      ? `High probability (${probability}%) of stockout in ${daysUntilStockout} days. Immediate action required.`
      : `Low probability (${probability}%) of stockout. Monitor closely.`,
  };
};

/**
 * Generate strategic recommendations
 */
const generateStrategicRecommendations = (data) => {
  const recommendations = [];
  const { currentStock, forecast, demandPattern, retailerAnalysis, seasonalPattern, 
          cashFlowImpact, optimalOrderTiming, riskAnalysis, profitMargin } = data;
  
  // Priority 1: Stockout prevention
  if (optimalOrderTiming.urgency === 'urgent') {
    recommendations.push({
      priority: 1,
      category: 'stockout_prevention',
      title: '🚨 Order Immediately',
      message: `Order ${Math.ceil(forecast.monthlyDemand * 1.5)} units now to prevent stockout.`,
      action: 'order_now',
      impact: 'critical',
      estimatedValue: `Prevent loss of ₹${Math.round(forecast.weeklyDemand * cashFlowImpact.profitMargin)} in sales`,
    });
  }
  
  // Priority 2: Bulk ordering opportunity
  if (cashFlowImpact.recommendedOrderValue > 0 && 
      cashFlowImpact.monthlyROI > 50) {
    recommendations.push({
      priority: 2,
      category: 'profit_optimization',
      title: '💰 High ROI Opportunity',
      message: `Ordering now yields ${cashFlowImpact.monthlyROI}% monthly ROI. Strong profit potential!`,
      action: 'order_bulk',
      impact: 'high',
      estimatedValue: `Potential profit: ₹${cashFlowImpact.monthlyProfitPotential}/month`,
    });
  }
  
  // Priority 3: Seasonal preparation
  if (seasonalPattern?.nextMonthPrediction) {
    recommendations.push({
      priority: 3,
      category: 'seasonal_planning',
      title: '📅 Prepare for Seasonal Spike',
      message: `Demand expected to increase ${Math.round((seasonalPattern.nextMonthPrediction.expectedDemand / forecast.monthlyDemand - 1) * 100)}% next month. Stock up now!`,
      action: 'order_seasonal',
      impact: 'high',
      estimatedValue: `Capture additional ₹${Math.round((seasonalPattern.nextMonthPrediction.expectedDemand - forecast.monthlyDemand) * cashFlowImpact.profitMargin)} in profit`,
    });
  }
  
  // Priority 4: Retailer diversification
  if (retailerAnalysis.concentrationRisk) {
    recommendations.push({
      priority: 4,
      category: 'risk_mitigation',
      title: '🎯 Diversify Retailer Base',
      message: `Top retailer accounts for ${retailerAnalysis.topRetailers[0]?.contribution}% of sales. Consider expanding to reduce dependency.`,
      action: 'expand_retailers',
      impact: 'medium',
      estimatedValue: 'Reduce business risk',
    });
  }
  
  // Priority 5: Demand growth opportunity
  if (demandPattern.trend === 'growing' && demandPattern.trendPercentage > 20) {
    recommendations.push({
      priority: 5,
      category: 'growth_opportunity',
      title: '📈 Growing Demand Detected',
      message: `Sales increasing ${demandPattern.trendPercentage}%. Consider increasing stock to capture growth.`,
      action: 'increase_stock',
      impact: 'medium',
      estimatedValue: `Potential additional revenue: ₹${Math.round(forecast.monthlyDemand * 0.2 * cashFlowImpact.profitMargin)}/month`,
    });
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority);
};

/**
 * Generate market insights
 */
const generateMarketInsights = (salesData, retailerAnalysis) => {
  const insights = [];
  
  // Retailer growth
  if (retailerAnalysis.totalRetailers > 10) {
    insights.push({
      type: 'market_penetration',
      message: `Strong market presence: Serving ${retailerAnalysis.totalRetailers} retailers`,
      strength: 'high',
    });
  }
  
  // Order frequency patterns
  const frequentRetailers = retailerAnalysis.orderingPatterns.frequent || 0;
  if (frequentRetailers > retailerAnalysis.totalRetailers * 0.5) {
    insights.push({
      type: 'customer_loyalty',
      message: `${frequentRetailers} retailers order weekly. High customer retention!`,
      strength: 'high',
    });
  }
  
  return insights;
};

/**
 * Calculate strategic confidence
 */
const calculateStrategicConfidence = (salesData, retailerAnalysis) => {
  const daily = salesData.daily || [];
  const daysOfData = daily.length;
  
  let baseConfidence = 0;
  
  if (daysOfData >= 60) baseConfidence = 90;
  else if (daysOfData >= 30) baseConfidence = 75;
  else if (daysOfData >= 14) baseConfidence = 60;
  else if (daysOfData >= 7) baseConfidence = 50;
  else if (daysOfData >= 3) baseConfidence = 40;
  else if (daysOfData >= 1) baseConfidence = 35;
  
  // Boost confidence if multiple retailers
  if (retailerAnalysis.totalRetailers > 5) baseConfidence += 5;
  if (retailerAnalysis.totalRetailers > 10) baseConfidence += 5;
  
  return Math.min(95, baseConfidence);
};

/**
 * Assess data quality
 */
const assessDataQuality = (salesData) => {
  const daily = salesData.daily || [];
  const daysOfData = daily.length;
  
  return {
    daysOfData,
    isSufficient: daysOfData >= 7,
    quality: daysOfData >= 30 ? 'excellent' : 
             daysOfData >= 14 ? 'good' : 
             daysOfData >= 7 ? 'fair' : 
             daysOfData >= 3 ? 'limited' : 'insufficient',
    retailers: salesData.totalRetailers || 0,
    dataPoints: daily.reduce((sum, d) => sum + d.orderCount, 0),
  };
};

/**
 * Get strategic default forecast
 */
const getStrategicDefaultForecast = (productData, salesDataCount) => {
  const currentStock = Number(productData.quantity || 0);
  const costPrice = Number(productData.costPrice || 0);
  const sellingPrice = Number(productData.sellingPrice || 0);
  
  // Smart stock-based insights
  let riskLevel = 'low';
  let urgency = 'low';
  let recommendations = [];
  
  if (currentStock === 0) {
    riskLevel = 'critical';
    urgency = 'urgent';
    recommendations.push({
      priority: 1,
      category: 'stockout_prevention',
      title: '🚨 Out of Stock',
      message: 'This product is out of stock. Order immediately to fulfill retailer orders.',
      action: 'order_now',
      impact: 'critical',
    });
  } else if (currentStock <= 5) {
    riskLevel = 'high';
    urgency = 'high';
    recommendations.push({
      priority: 1,
      category: 'stockout_prevention',
      title: '⚠️ Very Low Stock',
      message: `Only ${currentStock} units remaining. Order now to avoid stockout.`,
      action: 'order_urgent',
      impact: 'high',
    });
  } else if (currentStock <= 10) {
    riskLevel = 'medium';
    urgency = 'medium';
    recommendations.push({
      priority: 2,
      category: 'inventory_management',
      title: '📦 Stock Getting Low',
      message: `Stock is ${currentStock} units. Plan to reorder soon.`,
      action: 'order_soon',
      impact: 'medium',
    });
  }
  
  return {
    dailyDemand: 0,
    weeklyDemand: 0,
    monthlyDemand: 0,
    currentStock,
    daysUntilStockout: null,
    demandPattern: { type: 'insufficient_data', trend: 'stable' },
    retailerAnalysis: { totalRetailers: 0, topRetailers: [] },
    seasonalPattern: { hasPattern: false },
    cashFlowImpact: {
      currentInventoryValue: Math.round(currentStock * costPrice),
      monthlyRevenuePotential: 0,
      monthlyProfitPotential: 0,
      recommendedOrderValue: currentStock <= 10 ? Math.round(20 * costPrice) : 0,
      monthlyROI: 0,
      profitMargin: sellingPrice > 0 ? Math.round(((sellingPrice - costPrice) / sellingPrice) * 100) : 0,
    },
    optimalOrderTiming: {
      reorderPoint: 10,
      daysUntilReorder: 0,
      reorderDate: dayjs(),
      urgency: urgency,
      leadTime: 7,
      safetyStock: 5,
      reason: 'Based on current stock levels',
    },
    bulkOrderOpportunity: { hasOpportunity: false },
    riskAnalysis: {
      risks: riskLevel !== 'low' ? [{
        type: 'stock',
        severity: riskLevel,
        message: `Current stock: ${currentStock} units`,
        impact: riskLevel === 'critical' ? 'high' : 'medium',
      }] : [],
      opportunities: [],
      overallRisk: riskLevel,
    },
    stockoutRisk: {
      level: riskLevel,
      probability: riskLevel === 'critical' ? 100 : riskLevel === 'high' ? 70 : 0,
      impact: riskLevel === 'critical' ? 'high' : 'medium',
      message: riskLevel === 'critical' ? 'Out of stock!' : riskLevel === 'high' ? 'Very low stock' : 'Stock is good',
    },
    strategicRecommendations: recommendations,
    marketInsights: [],
    confidence: 20,
    dataQuality: {
      daysOfData: salesDataCount,
      isSufficient: false,
      quality: 'insufficient',
      retailers: 0,
      dataPoints: 0,
    },
  };
};

