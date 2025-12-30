import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaChartLine, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaInfoCircle,
  FaArrowUp,
  FaArrowDown,
  FaShoppingCart,
  FaClock,
  FaBox,
  FaSpinner,
  FaUsers,
  FaLightbulb,
  FaRupeeSign,
  FaGift,
  FaCalendarAlt,
} from 'react-icons/fa';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { batchForecastProducts } from '../../../services/aiForecastingEngine';
import { calculateStrategicForecast } from '../../../services/strategicForecastEngine';
import { toast } from 'react-toastify';
import QuickOrderModal from './QuickOrderModal';

const DistributorAIForecast = () => {
  const [products, setProducts] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'critical', 'high'
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [orderForecast, setOrderForecast] = useState(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // Listen to inventory changes
    const productsRef = collection(db, `businesses/${userId}/products`);
    const unsubscribe = onSnapshot(productsRef, async (snapshot) => {
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsList);
      
      // Calculate forecasts
      if (productsList.length > 0) {
        await calculateForecasts(userId, productsList);
      } else {
        setForecasts([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const calculateForecasts = async (userId, productsList) => {
    setRefreshing(true);
    try {
      // Use strategic forecast for distributors (game-changing insights)
      const forecastPromises = productsList.map(async (product) => {
        const strategicForecast = await calculateStrategicForecast(userId, product.id, product);
        return {
          productId: product.id,
          productName: product.name || product.productName,
          sku: product.sku,
          // Core predictions
          dailyDemand: strategicForecast.dailyDemand,
          weeklyDemand: strategicForecast.weeklyDemand,
          monthlyDemand: strategicForecast.monthlyDemand,
          currentStock: strategicForecast.currentStock,
          daysUntilStockout: strategicForecast.daysUntilStockout,
          // Strategic insights
          demandPattern: strategicForecast.demandPattern,
          retailerAnalysis: strategicForecast.retailerAnalysis,
          seasonalPattern: strategicForecast.seasonalPattern,
          cashFlowImpact: strategicForecast.cashFlowImpact,
          optimalOrderTiming: strategicForecast.optimalOrderTiming,
          bulkOrderOpportunity: strategicForecast.bulkOrderOpportunity,
          riskAnalysis: strategicForecast.riskAnalysis,
          stockoutRisk: strategicForecast.stockoutRisk,
          strategicRecommendations: strategicForecast.strategicRecommendations,
          marketInsights: strategicForecast.marketInsights,
          // Legacy fields for compatibility
          confidence: strategicForecast.confidence,
          riskLevel: strategicForecast.riskAnalysis.overallRisk,
          riskMessage: strategicForecast.stockoutRisk.message,
          trend: strategicForecast.demandPattern.trend,
          trendPercentage: strategicForecast.demandPattern.trendPercentage,
          recommendedOrderQuantity: strategicForecast.optimalOrderTiming.reorderPoint,
          urgency: strategicForecast.optimalOrderTiming.urgency,
          insights: strategicForecast.strategicRecommendations,
          dataProgress: strategicForecast.dataQuality,
        };
      });
      
      const forecastData = await Promise.all(forecastPromises);
      
      // Sort by urgency (critical first)
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      forecastData.sort((a, b) => {
        const aUrgency = urgencyOrder[a.riskLevel] ?? 3;
        const bUrgency = urgencyOrder[b.riskLevel] ?? 3;
        return aUrgency - bUrgency;
      });
      
      setForecasts(forecastData);
    } catch (error) {
      console.error('Error calculating forecasts:', error);
      toast.error('Failed to calculate forecasts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || products.length === 0) return;
    await calculateForecasts(userId, products);
    toast.success('Updated!');
  };

  // Filter forecasts based on view mode
  const filteredForecasts = forecasts.filter(f => {
    if (viewMode === 'all') return true;
    if (viewMode === 'critical') return f.riskLevel === 'critical';
    if (viewMode === 'high') return f.riskLevel === 'high' || f.riskLevel === 'critical';
    return true;
  });

  // Get strategic summary stats
  const criticalProducts = forecasts.filter(f => f.riskLevel === 'critical');
  const highRiskProducts = forecasts.filter(f => f.riskLevel === 'high');
  const totalAtRisk = criticalProducts.length + highRiskProducts.length;
  const totalRecommendedOrders = forecasts.reduce((sum, f) => sum + (f.recommendedOrderQuantity || 0), 0);
  const totalWeeklyDemand = forecasts.reduce((sum, f) => sum + (f.weeklyDemand || 0), 0);
  
  // Strategic insights
  const totalRetailers = forecasts.reduce((sum, f) => sum + (f.retailerAnalysis?.totalRetailers || 0), 0);
  const totalInventoryValue = forecasts.reduce((sum, f) => sum + (f.cashFlowImpact?.currentInventoryValue || 0), 0);
  const totalMonthlyProfit = forecasts.reduce((sum, f) => sum + (f.cashFlowImpact?.monthlyProfitPotential || 0), 0);
  const thisWeekNeed = forecasts.reduce((sum, f) => {
    if (f.daysUntilStockout && f.daysUntilStockout < 7) {
      return sum + (f.weeklyDemand || 0);
    }
    return sum;
  }, 0);
  const recommendedPO = forecasts.reduce((sum, f) => {
    const rec = f.strategicRecommendations?.[0];
    if (rec && rec.action === 'order_now') {
      return sum + (f.recommendedOrderQuantity || 0);
    }
    return sum;
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-emerald-400" />
        <p className="ml-4 text-white/60">Analyzing your products...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simple Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FaChartLine className="text-emerald-400" />
            Smart Stock Predictor
          </h2>
          <p className="text-white/60 text-sm mt-1">
            See which products will finish soon and how much to order
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 rounded-lg text-white text-sm flex items-center gap-2 transition"
        >
          {refreshing ? <FaSpinner className="animate-spin" /> : '🔄'} Update
        </button>
      </div>

      {/* Simple Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-300 text-sm">Will Finish Soon</p>
              <p className="text-xs text-red-200/70 mb-1">(Less than 7 days)</p>
              <p className="text-2xl font-bold text-white mt-1">{criticalProducts.length}</p>
            </div>
            <FaExclamationTriangle className="text-red-400 text-2xl" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-300 text-sm">Order Needed</p>
              <p className="text-xs text-amber-200/70 mb-1">(Within 2 weeks)</p>
              <p className="text-2xl font-bold text-white mt-1">{highRiskProducts.length}</p>
            </div>
            <FaClock className="text-amber-400 text-2xl" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm">Total Products</p>
              <p className="text-xs text-blue-200/70 mb-1">(In your stock)</p>
              <p className="text-2xl font-bold text-white mt-1">{forecasts.length}</p>
            </div>
            <FaBox className="text-blue-400 text-2xl" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm">This Week Need</p>
              <p className="text-xs text-purple-200/70 mb-1">(From retailers)</p>
              <p className="text-2xl font-bold text-white mt-1">{thisWeekNeed || Math.round(totalWeeklyDemand)}</p>
            </div>
            <FaUsers className="text-purple-400 text-2xl" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm">Order from PO</p>
              <p className="text-xs text-emerald-200/70 mb-1">(Recommended)</p>
              <p className="text-2xl font-bold text-white mt-1">{recommendedPO || Math.round(totalRecommendedOrders)}</p>
            </div>
            <FaShoppingCart className="text-emerald-400 text-2xl" />
          </div>
        </motion.div>
      </div>

      {/* Simple Filter Tabs */}
      <div className="flex gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
        <button
          onClick={() => setViewMode('all')}
          className={`flex-1 px-4 py-2 rounded-md text-sm transition ${
            viewMode === 'all'
              ? 'bg-emerald-500 text-white'
              : 'text-white/70 hover:text-white'
          }`}
        >
          All Products
        </button>
        <button
          onClick={() => setViewMode('high')}
          className={`flex-1 px-4 py-2 rounded-md text-sm transition ${
            viewMode === 'high'
              ? 'bg-amber-500 text-white'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Need Order ({totalAtRisk})
        </button>
        <button
          onClick={() => setViewMode('critical')}
          className={`flex-1 px-4 py-2 rounded-md text-sm transition ${
            viewMode === 'critical'
              ? 'bg-red-500 text-white'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Urgent ({criticalProducts.length})
        </button>
      </div>

      {/* Products List - Simple & Clear */}
      {filteredForecasts.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10">
          <FaInfoCircle className="text-4xl text-white/40 mx-auto mb-4" />
          <p className="text-white/60">
            {viewMode === 'all' 
              ? 'No products found. Add products to get smart predictions.'
              : 'No products need attention right now. Great job!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredForecasts.map((forecast, index) => (
            <SimpleProductCard
              key={forecast.productId}
              forecast={forecast}
              index={index}
              onSelect={() => setSelectedProduct(forecast)}
            />
          ))}
        </div>
      )}

      {/* Simple Detail View */}
      <AnimatePresence>
        {selectedProduct && (
          <SimpleProductDetail
            forecast={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onOrderClick={(forecast) => {
              setOrderForecast(forecast);
              setShowQuickOrder(true);
              setSelectedProduct(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Quick Order Modal */}
      <AnimatePresence>
        {showQuickOrder && orderForecast && (
          <QuickOrderModal
            forecast={orderForecast}
            onClose={() => {
              setShowQuickOrder(false);
              setOrderForecast(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const SimpleProductCard = ({ forecast, index, onSelect }) => {
  // Simple status determination
  const getStatus = () => {
    if (forecast.daysUntilStockout === null || forecast.daysUntilStockout === Infinity) {
      return { 
        type: 'good', 
        color: 'emerald', 
        icon: <FaCheckCircle className="text-emerald-400" />,
        message: 'Stock is good'
      };
    }
    if (forecast.daysUntilStockout < 7) {
      return { 
        type: 'urgent', 
        color: 'red', 
        icon: <FaExclamationTriangle className="text-red-400" />,
        message: `Will finish in ${forecast.daysUntilStockout} days!`
      };
    }
    if (forecast.daysUntilStockout < 14) {
      return { 
        type: 'warning', 
        color: 'amber', 
        icon: <FaClock className="text-amber-400" />,
        message: `Will finish in ${forecast.daysUntilStockout} days`
      };
    }
    return { 
      type: 'good', 
      color: 'emerald', 
      icon: <FaCheckCircle className="text-emerald-400" />,
      message: `Stock will last ${forecast.daysUntilStockout} days`
    };
  };

  const status = getStatus();
  // ALWAYS show insights - even with limited data we provide value
  const hasData = forecast.confidence > 20; // Lower threshold - show predictions even with limited data
  const hasGoodData = forecast.confidence > 50; // High confidence predictions

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className={`border rounded-xl p-4 cursor-pointer hover:bg-white/5 transition ${
        status.type === 'urgent' ? 'border-red-500/50 bg-red-500/10' :
        status.type === 'warning' ? 'border-amber-500/50 bg-amber-500/10' :
        'border-emerald-500/50 bg-emerald-500/10'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Product Name & Status */}
          <div className="flex items-center gap-3 mb-3">
            {status.icon}
            <div>
              <h3 className="font-semibold text-white text-lg">{forecast.productName}</h3>
              {forecast.sku && (
                <p className="text-xs text-white/50">SKU: {forecast.sku}</p>
              )}
            </div>
          </div>

          {/* Simple Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-white/60 mb-1">You Have</p>
              <p className="text-xl font-bold text-white">{forecast.currentStock} units</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">Will Finish In</p>
              <p className={`text-xl font-bold ${
                forecast.daysUntilStockout === null || forecast.daysUntilStockout === Infinity
                  ? 'text-emerald-400'
                  : forecast.daysUntilStockout < 7
                  ? 'text-red-400'
                  : 'text-amber-400'
              }`}>
                {forecast.daysUntilStockout === null || forecast.daysUntilStockout === Infinity
                  ? 'Not soon'
                  : `${forecast.daysUntilStockout} days`
                }
              </p>
            </div>
            {hasData && (
              <>
                <div>
                  <p className="text-xs text-white/60 mb-1">Sell Per Week</p>
                  <p className="text-xl font-bold text-white">
                    {forecast.weeklyDemand || 0} units
                    {!hasGoodData && <span className="text-xs text-white/40 ml-1">(est.)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Order This Much</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {forecast.recommendedOrderQuantity || 0} units
                    {!hasGoodData && <span className="text-xs text-emerald-400/60 ml-1">(est.)</span>}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Smart Insights - Always Show Something Useful */}
          <div className="mt-3 pt-3 border-t border-white/10">
            {hasData ? (
              <div className="space-y-2">
                <p className={`text-sm font-medium ${
                status.type === 'urgent' ? 'text-red-300' :
                status.type === 'warning' ? 'text-amber-300' :
                'text-emerald-300'
              }`}>
                {status.message}
                {forecast.recommendedOrderQuantity > 0 && (
                    <span className="ml-2 text-white/80">→ Order {forecast.recommendedOrderQuantity} units</span>
                )}
              </p>
                {!hasGoodData && (
                  <p className="text-xs text-blue-300/80">
                    💡 Based on current stock levels. More accurate predictions coming as we collect sales data!
                  </p>
                )}
                </div>
            ) : (
                  <div className="space-y-2">
                {/* Show smart insights from forecast - ALWAYS show something useful */}
                {forecast.insights && forecast.insights.length > 0 && (
                  forecast.insights.map((insight, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded-lg text-sm ${
                        insight.type === 'critical' ? 'bg-red-500/20 border border-red-500/40 text-red-200' :
                        insight.type === 'warning' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200' :
                        insight.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' :
                        'bg-blue-500/20 border border-blue-500/40 text-blue-200'
                      }`}
                    >
                      <span className="mr-2">{insight.icon}</span>
                      {insight.message}
                    </div>
                  ))
                )}
                {forecast.dataProgress && forecast.dataProgress.daysOfData < forecast.dataProgress.minDaysRequired && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/70">
                        {forecast.dataProgress.daysOfData} / {forecast.dataProgress.minDaysRequired} days
                      </span>
                      <span className="text-blue-400">
                        {Math.round(forecast.dataProgress.progressPercent)}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${forecast.dataProgress.progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trend - Simple */}
          {hasData && forecast.trend !== 'stable' && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              {forecast.trend === 'increasing' ? (
                <>
                  <FaArrowUp className="text-emerald-400" />
                  <span className="text-emerald-300">Sales going up! Retailers buying more.</span>
                </>
              ) : (
                <>
                  <FaArrowDown className="text-red-400" />
                  <span className="text-red-300">Sales going down. Retailers buying less.</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Extraordinary Data Collection Guide Component
const ExtraordinaryDataCollectionGuide = ({ forecast }) => {
  const dataProgress = forecast.dataProgress || {
    daysOfData: 0,
    daysNeeded: 7,
    minDaysRequired: 7,
    progressPercent: 0,
    isReady: false,
  };

  const handleNavigateToRetailers = () => {
    window.location.hash = '#/distributor-dashboard?tab=retailer-requests';
  };

  return (
    <div className="space-y-6">
      {/* Hero Section - What is Sales Data? */}
      <div className="bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="bg-blue-500/20 rounded-full p-3">
            <FaInfoCircle className="text-3xl text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white text-lg mb-2">What is "Sales Data"?</h4>
            <p className="text-white/80 text-sm leading-relaxed">
              <strong className="text-white">Sales data</strong> means orders from retailers. 
              When retailers order this product from you, we track how much they buy and when. 
              This helps us predict how much you'll need in the future!
            </p>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <FaChartLine className="text-emerald-400" />
            Data Collection Progress
          </h4>
          <span className="text-sm text-white/60">
            {dataProgress.daysOfData} / {dataProgress.minDaysRequired} days
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-3 mb-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${dataProgress.progressPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
          />
        </div>

        {/* Status Message */}
        <div className="bg-white/5 rounded-lg p-4">
          {dataProgress.daysOfData === 0 ? (
            <p className="text-white/80 text-sm">
              <span className="font-semibold text-white">You need to start collecting data!</span>
              <br />
              We need at least <strong className="text-emerald-400">{dataProgress.minDaysRequired} days</strong> of sales 
              (orders from retailers) to make accurate predictions.
            </p>
          ) : (
            <p className="text-white/80 text-sm">
              Great progress! You have <strong className="text-emerald-400">{dataProgress.daysOfData} day{dataProgress.daysOfData > 1 ? 's' : ''}</strong> of data.
              <br />
              Need <strong className="text-amber-400">{dataProgress.daysNeeded} more day{dataProgress.daysNeeded > 1 ? 's' : ''}</strong> to unlock smart predictions!
            </p>
          )}
        </div>
      </div>

      {/* Action Steps */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
          <FaUsers className="text-purple-400" />
          How to Get Sales Data (3 Simple Steps)
        </h4>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Connect with Retailers</p>
              <p className="text-white/70 text-sm mb-2">
                Accept connection requests from retailers who want to buy from you.
              </p>
              <button
                onClick={handleNavigateToRetailers}
                className="text-sm px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-300 transition"
              >
                Go to Retailer Requests →
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Share Your Product Catalog</p>
              <p className="text-white/70 text-sm">
                Make sure retailers can see this product in your catalog. They need to see it to order it!
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Wait for Orders</p>
              <p className="text-white/70 text-sm">
                Once retailers start ordering this product, we'll automatically track the data. 
                After {dataProgress.minDaysRequired} days of orders, you'll get smart predictions!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What You'll Get */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-6">
        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
          <FaCheckCircle className="text-emerald-400" />
          What You'll Get Once You Have Data
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">Smart Predictions</p>
            <p className="text-white font-semibold">Know when to order</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">Avoid Stockouts</p>
            <p className="text-white font-semibold">Never run out</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">Save Money</p>
            <p className="text-white font-semibold">Order the right amount</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">Save Time</p>
            <p className="text-white font-semibold">Auto recommendations</p>
          </div>
        </div>
      </div>

      {/* Quick Tip */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FaInfoCircle className="text-amber-400 text-xl mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300 mb-1">💡 Quick Tip</p>
            <p className="text-white/80 text-sm">
              The more retailers order this product, the better our predictions become! 
              Share your catalog with more retailers to get more sales data faster.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SimpleProductDetail = ({ forecast, onClose, onOrderClick }) => {
  const hasData = forecast.confidence > 20; // Lower threshold to show strategic insights
  const hasStrategicData = forecast.retailerAnalysis || forecast.cashFlowImpact || forecast.strategicRecommendations;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
          <h3 className="text-xl font-bold text-white">{forecast.productName}</h3>
            {forecast.sku && <p className="text-sm text-white/50 mt-1">SKU: {forecast.sku}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Stock Status Box */}
          <div className={`rounded-lg p-4 border ${
            forecast.daysUntilStockout !== null && forecast.daysUntilStockout < 7
              ? 'bg-red-500/10 border-red-500/30'
              : forecast.daysUntilStockout !== null && forecast.daysUntilStockout < 14
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              {forecast.daysUntilStockout !== null && forecast.daysUntilStockout < 7 ? (
                <FaExclamationTriangle className="text-red-400 text-2xl" />
              ) : forecast.daysUntilStockout !== null && forecast.daysUntilStockout < 14 ? (
                <FaClock className="text-amber-400 text-2xl" />
              ) : (
                <FaCheckCircle className="text-emerald-400 text-2xl" />
              )}
              <div>
                <p className="text-lg font-semibold text-white">
                  {forecast.daysUntilStockout === null || forecast.daysUntilStockout === Infinity
                    ? 'Stock is Good'
                    : `Will Finish in ${forecast.daysUntilStockout} Days`
                  }
                </p>
                <p className="text-sm text-white/60">
                  You currently have {forecast.currentStock} units
                </p>
              </div>
            </div>
          </div>

          {/* STRATEGIC RECOMMENDATIONS - Priority Based */}
          {forecast.strategicRecommendations && forecast.strategicRecommendations.length > 0 && (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FaLightbulb className="text-purple-400" />
                Strategic Recommendations
              </h4>
              <div className="space-y-3">
                {forecast.strategicRecommendations.slice(0, 3).map((rec, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      rec.impact === 'critical' ? 'bg-red-500/20 border-red-500/40' :
                      rec.impact === 'high' ? 'bg-amber-500/20 border-amber-500/40' :
                      'bg-blue-500/20 border-blue-500/40'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{rec.title.split(' ')[0]}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm mb-1">{rec.title}</p>
                        <p className={`text-xs ${
                          rec.impact === 'critical' ? 'text-red-200' :
                          rec.impact === 'high' ? 'text-amber-200' :
                          'text-blue-200'
                        }`}>
                          {rec.message}
                        </p>
                        {rec.estimatedValue && (
                          <p className="text-xs text-emerald-300 mt-1">💰 {rec.estimatedValue}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RETAILER ANALYSIS - Game Changer */}
          {forecast.retailerAnalysis && forecast.retailerAnalysis.totalRetailers > 0 && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FaUsers className="text-blue-400" />
                Retailer Analysis
                <span className="text-xs text-white/50 ml-2">
                  ({forecast.retailerAnalysis.totalRetailers} retailer{forecast.retailerAnalysis.totalRetailers > 1 ? 's' : ''})
                </span>
              </h4>
              
              {forecast.retailerAnalysis.topRetailers && forecast.retailerAnalysis.topRetailers.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-white/60 mb-2">Top Retailers:</p>
                  {forecast.retailerAnalysis.topRetailers.slice(0, 3).map((retailer, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/5 rounded p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">#{retailer.rank}</span>
                        <span className="text-sm text-white">{retailer.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/60">{retailer.contribution}% of sales</p>
                        <p className="text-xs text-white/40">{retailer.avgOrderSize} units/order</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {forecast.retailerAnalysis.concentrationRisk && (
                <div className="bg-amber-500/20 border border-amber-500/40 rounded p-2 text-xs text-amber-200">
                  ⚠️ High dependency on top retailer. Consider diversifying.
                </div>
              )}
            </div>
          )}

          {/* DEMAND PATTERN */}
          {forecast.demandPattern && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FaChartLine className="text-emerald-400" />
                Demand Pattern
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/60 mb-1">Pattern Type</p>
                  <p className="text-sm font-semibold text-white capitalize">{forecast.demandPattern.type || 'stable'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Trend</p>
                  <p className={`text-sm font-semibold flex items-center gap-1 ${
                    forecast.demandPattern.trend === 'increasing' ? 'text-emerald-400' :
                    forecast.demandPattern.trend === 'decreasing' ? 'text-red-400' :
                    'text-white'
                  }`}>
                    {forecast.demandPattern.trend === 'increasing' && <FaArrowUp />}
                    {forecast.demandPattern.trend === 'decreasing' && <FaArrowDown />}
                    {forecast.demandPattern.trend || 'stable'}
                    {forecast.demandPattern.trendPercentage && ` (${forecast.demandPattern.trendPercentage}%)`}
                  </p>
                </div>
              </div>
            </div>
          )}

              {/* What Retailers Need */}
          {hasData && (
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <FaUsers className="text-blue-400" />
                  What Retailers Will Need
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Per Day</p>
                  <p className="text-xl font-bold text-white">{forecast.dailyDemand || 0} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">This Week</p>
                  <p className="text-xl font-bold text-white">{forecast.weeklyDemand || 0} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">This Month</p>
                  <p className="text-xl font-bold text-white">{forecast.monthlyDemand || 0} units</p>
                  </div>
                </div>
              </div>
          )}

          {/* CASH FLOW IMPACT - Strategic */}
          {forecast.cashFlowImpact && (
            <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FaRupeeSign className="text-emerald-400" />
                Cash Flow Impact
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/60 mb-1">Current Inventory Value</p>
                  <p className="text-lg font-bold text-white">₹{forecast.cashFlowImpact.currentInventoryValue?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Monthly Profit Potential</p>
                  <p className="text-lg font-bold text-emerald-400">₹{forecast.cashFlowImpact.monthlyProfitPotential?.toLocaleString() || 0}</p>
                </div>
                {forecast.cashFlowImpact.monthlyROI > 0 && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Monthly ROI</p>
                    <p className="text-lg font-bold text-blue-400">{forecast.cashFlowImpact.monthlyROI}%</p>
                  </div>
                )}
                {forecast.cashFlowImpact.profitMargin > 0 && (
                  <div>
                    <p className="text-xs text-white/60 mb-1">Profit Margin</p>
                    <p className="text-lg font-bold text-purple-400">{forecast.cashFlowImpact.profitMargin}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BULK ORDER OPPORTUNITY */}
          {forecast.bulkOrderOpportunity && forecast.bulkOrderOpportunity.hasOpportunity && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <FaGift className="text-amber-400" />
                Bulk Order Opportunity
              </h4>
              <p className="text-sm text-white/80 mb-2">{forecast.bulkOrderOpportunity.recommendation}</p>
              {forecast.bulkOrderOpportunity.potentialSavings > 0 && (
                <p className="text-lg font-bold text-emerald-400">
                  Save ₹{forecast.bulkOrderOpportunity.potentialSavings.toLocaleString()}!
                </p>
              )}
            </div>
          )}

          {/* SEASONAL PATTERN */}
          {forecast.seasonalPattern && forecast.seasonalPattern.hasPattern && (
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <FaCalendarAlt className="text-purple-400" />
                Seasonal Pattern Detected
              </h4>
              {forecast.seasonalPattern.nextMonthPrediction && (
                <div>
                  <p className="text-sm text-white/80">
                    Demand expected to increase {Math.round((forecast.seasonalPattern.nextMonthPrediction.expectedDemand / (forecast.monthlyDemand || 1) - 1) * 100)}% next month
                  </p>
                </div>
              )}
            </div>
          )}

              {/* Past Sales */}
          {hasData && (
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="font-semibold text-white mb-3">Past Sales</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Last 7 Days</p>
                  <p className="text-lg font-bold text-white">{forecast.last7DaysSales || 0} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Last 30 Days</p>
                  <p className="text-lg font-bold text-white">{forecast.last30DaysSales || 0} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Average Per Day</p>
                  <p className="text-lg font-bold text-white">{forecast.avgDailySales || 0} units</p>
                  </div>
                </div>
              </div>
          )}

              {/* Recommendation */}
              {forecast.recommendedOrderQuantity > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-300 mb-2 flex items-center gap-2">
                    <FaShoppingCart className="text-emerald-400" />
                    Our Recommendation
                  </h4>
                  <p className="text-white/80 mb-3">
                    Based on how much retailers are buying, we suggest you order:
                  </p>
                  <div className="bg-white/10 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-400">{forecast.recommendedOrderQuantity}</p>
                    <p className="text-sm text-white/60 mt-1">units from Product Owner</p>
                  </div>
              {forecast.optimalOrderTiming && (
                  <p className="text-xs text-white/50 mt-2">
                  {forecast.optimalOrderTiming.reason || 'This will keep you stocked for about 30 days'}
                  </p>
              )}
                </div>
              )}

          {/* Show data collection guide if no data */}
          {!hasData && !hasStrategicData && (
            <ExtraordinaryDataCollectionGuide forecast={forecast} />
          )}

          {/* Action Button */}
          {forecast.recommendedOrderQuantity > 0 && (
            <button
              onClick={() => {
                if (onOrderClick) {
                  onOrderClick(forecast);
                } else {
                  // Fallback if callback not provided
                  setOrderForecast(forecast);
                  setShowQuickOrder(true);
                }
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition"
            >
              <FaShoppingCart />
              Order {forecast.recommendedOrderQuantity} units from Product Owner
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DistributorAIForecast;
