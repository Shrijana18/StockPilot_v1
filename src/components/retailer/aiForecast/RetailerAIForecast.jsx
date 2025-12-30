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
} from 'react-icons/fa';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { batchForecastProducts } from '../../../services/aiForecastingEngine';
import { toast } from 'react-toastify';

const RetailerAIForecast = () => {
  const [products, setProducts] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
      const forecastData = await batchForecastProducts(userId, productsList, 'retailer');
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

  // Get summary stats
  const criticalProducts = forecasts.filter(f => f.riskLevel === 'critical');
  const highRiskProducts = forecasts.filter(f => f.riskLevel === 'high');
  const totalAtRisk = criticalProducts.length + highRiskProducts.length;
  const totalRecommendedOrders = forecasts.reduce((sum, f) => sum + (f.recommendedOrderQuantity || 0), 0);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <p className="text-xs text-blue-200/70 mb-1">(In your shop)</p>
              <p className="text-2xl font-bold text-white mt-1">{forecasts.length}</p>
            </div>
            <FaBox className="text-blue-400 text-2xl" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm">Order from Distributor</p>
              <p className="text-xs text-emerald-200/70 mb-1">(Recommended)</p>
              <p className="text-2xl font-bold text-white mt-1">{totalRecommendedOrders}</p>
            </div>
            <FaShoppingCart className="text-emerald-400 text-2xl" />
          </div>
        </motion.div>
      </div>

      {/* Products List - Simple & Clear */}
      {forecasts.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10">
          <FaInfoCircle className="text-4xl text-white/40 mx-auto mb-4" />
          <p className="text-white/60">No products found. Add products to get smart predictions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {forecasts.map((forecast, index) => (
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
  const hasData = forecast.confidence > 30; // Only show predictions if we have enough data

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
                  <p className="text-xl font-bold text-white">{forecast.weeklyDemand || 0} units</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Order This Much</p>
                  <p className="text-xl font-bold text-emerald-400">{forecast.recommendedOrderQuantity || 0} units</p>
                </div>
              </>
            )}
          </div>

          {/* Simple Message */}
          <div className="mt-3 pt-3 border-t border-white/10">
            {hasData ? (
              <p className={`text-sm ${
                status.type === 'urgent' ? 'text-red-300' :
                status.type === 'warning' ? 'text-amber-300' :
                'text-emerald-300'
              }`}>
                {status.message}
                {forecast.recommendedOrderQuantity > 0 && (
                  <span className="ml-2">→ Order {forecast.recommendedOrderQuantity} units from distributor</span>
                )}
              </p>
            ) : (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-sm text-white/70 flex items-center gap-2">
                  <FaInfoCircle className="text-blue-400" />
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white">Collecting Sales Data</span>
                      {forecast.dataProgress && (
                        <span className="text-xs text-blue-400">
                          {forecast.dataProgress.daysOfData} / {forecast.dataProgress.minDaysRequired} days
                        </span>
                      )}
                    </div>
                    {forecast.dataProgress && (
                      <div className="space-y-2">
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${forecast.dataProgress.progressPercent}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          />
                        </div>
                        <p className="text-xs text-white/60">
                          {forecast.dataProgress.daysOfData === 0
                            ? `Need ${forecast.dataProgress.daysNeeded} days of sales to unlock predictions`
                            : `${forecast.dataProgress.daysNeeded} more day${forecast.dataProgress.daysNeeded > 1 ? 's' : ''} needed`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </p>
              </div>
            )}
          </div>

          {/* Trend - Simple */}
          {hasData && forecast.trend !== 'stable' && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              {forecast.trend === 'increasing' ? (
                <>
                  <FaArrowUp className="text-emerald-400" />
                  <span className="text-emerald-300">Sales going up! Customers buying more.</span>
                </>
              ) : (
                <>
                  <FaArrowDown className="text-red-400" />
                  <span className="text-red-300">Sales going down. Customers buying less.</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Extraordinary Data Collection Guide Component for Retailers
const RetailerDataCollectionGuide = ({ forecast }) => {
  const dataProgress = forecast.dataProgress || {
    daysOfData: 0,
    daysNeeded: 7,
    minDaysRequired: 7,
    progressPercent: 0,
    isReady: false,
  };

  const handleNavigateToBilling = () => {
    window.location.hash = '#/dashboard?tab=billing';
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
              <strong className="text-white">Sales data</strong> means when you sell this product to your customers. 
              Every time you create a bill/invoice and sell this product, we track it. 
              This helps us predict how much you'll need to order from distributors!
            </p>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <FaChartLine className="text-emerald-400" />
            Sales Data Collection Progress
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
              <span className="font-semibold text-white">You need to start selling this product!</span>
              <br />
              We need at least <strong className="text-emerald-400">{dataProgress.minDaysRequired} days</strong> of sales 
              (bills where you sold this product) to make accurate predictions.
            </p>
          ) : (
            <p className="text-white/80 text-sm">
              Great progress! You have <strong className="text-emerald-400">{dataProgress.daysOfData} day{dataProgress.daysOfData > 1 ? 's' : ''}</strong> of sales data.
              <br />
              Need <strong className="text-amber-400">{dataProgress.daysNeeded} more day{dataProgress.daysNeeded > 1 ? 's' : ''}</strong> to unlock smart predictions!
            </p>
          )}
        </div>
      </div>

      {/* Action Steps */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
          <FaBox className="text-purple-400" />
          How to Get Sales Data (3 Simple Steps)
        </h4>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Add Product to Your Stock</p>
              <p className="text-white/70 text-sm mb-2">
                Make sure this product is in your inventory so you can sell it to customers.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Sell to Customers</p>
              <p className="text-white/70 text-sm mb-2">
                Use the Billing section to create bills and sell this product to your customers.
              </p>
              <button
                onClick={handleNavigateToBilling}
                className="text-sm px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-300 transition"
              >
                Go to Billing →
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Wait for Data Collection</p>
              <p className="text-white/70 text-sm">
                Every time you sell this product, we track it automatically. 
                After {dataProgress.minDaysRequired} days of sales, you'll get smart predictions!
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
              The more you sell this product, the better our predictions become! 
              Keep selling to customers and we'll track everything automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SimpleProductDetail = ({ forecast, onClose }) => {
  const hasData = forecast.confidence > 30;

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
        className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">{forecast.productName}</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Simple Status Box */}
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

          {hasData ? (
            <>
              {/* How Much You Sell */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <FaBox className="text-blue-400" />
                  How Much You Sell
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Per Day</p>
                    <p className="text-xl font-bold text-white">{forecast.dailyDemand} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">This Week</p>
                    <p className="text-xl font-bold text-white">{forecast.weeklyDemand} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">This Month</p>
                    <p className="text-xl font-bold text-white">{forecast.monthlyDemand} units</p>
                  </div>
                </div>
              </div>

              {/* Past Sales */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="font-semibold text-white mb-3">Past Sales</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Last 7 Days</p>
                    <p className="text-lg font-bold text-white">{forecast.last7DaysSales} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Last 30 Days</p>
                    <p className="text-lg font-bold text-white">{forecast.last30DaysSales} units</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Average Per Day</p>
                    <p className="text-lg font-bold text-white">{forecast.avgDailySales} units</p>
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              {forecast.recommendedOrderQuantity > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-300 mb-2 flex items-center gap-2">
                    <FaShoppingCart className="text-emerald-400" />
                    Our Recommendation
                  </h4>
                  <p className="text-white/80 mb-3">
                    Based on how much you sell, we suggest you order:
                  </p>
                  <div className="bg-white/10 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-400">{forecast.recommendedOrderQuantity}</p>
                    <p className="text-sm text-white/60 mt-1">units from distributor</p>
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    This will keep you stocked for about 30 days
                  </p>
                </div>
              )}
            </>
          ) : (
            <RetailerDataCollectionGuide forecast={forecast} />
          )}

          {/* Action Button */}
          {hasData && forecast.recommendedOrderQuantity > 0 && (
            <button
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition"
            >
              <FaShoppingCart />
              Order {forecast.recommendedOrderQuantity} units from Distributor
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default RetailerAIForecast;
