import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import AIChatInterface from './AIChatInterface';
import DynamicChart from './DynamicChart';
import DataInsights from './DataInsights';
import { generateAnalyticsInsights } from '../../../utils/aiAnalyticsEngine';

const AIAnalytics = ({ onSwitchToTraditional }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [suggestedQueries, setSuggestedQueries] = useState([
    "Show me sales for last month",
    "What's my profit for this quarter?",
    "Which products are selling best?",
    "How is my inventory performing?",
    "Show revenue trends for last 6 months",
    "What are my top customers?",
    "Compare this month vs last month",
    "Show me low stock alerts"
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        loadInitialData(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadInitialData = async (userId) => {
    try {
      setIsLoading(true);
      // Load recent invoices, products, and customers (matching traditional analytics)
      const [invoices, products, customers] = await Promise.all([
        getDocs(query(collection(db, 'businesses', userId, 'finalizedInvoices'), orderBy('issuedAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'businesses', userId, 'products'), limit(100))),
        getDocs(query(collection(db, 'businesses', userId, 'customers'), limit(100)))
      ]);

      const invoicesData = invoices.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const productsData = products.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const customersData = customers.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      console.log('AI Analytics Data Loaded:', {
        invoicesCount: invoicesData.length,
        productsCount: productsData.length,
        customersCount: customersData.length,
        sampleInvoice: invoicesData[0],
        totalRevenue: invoicesData.reduce((sum, inv) => sum + (inv.grandTotal || inv.totalAmount || 0), 0)
      });

      setAnalyticsData({
        invoices: invoicesData,
        products: productsData,
        customers: customersData,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIQuery = async (query) => {
    if (!user || !analyticsData) return;

    setIsLoading(true);
    const newMessage = {
      id: Date.now(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, newMessage]);

    try {
      // Generate AI insights based on the query and data
      const insights = await generateAnalyticsInsights(query, analyticsData, user.uid);
      
      const aiResponse = {
        id: Date.now() + 1,
        type: 'ai',
        content: insights.summary,
        data: insights.data,
        chartConfig: insights.chartConfig,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error processing AI query:', error);
      const errorResponse = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuery = (query) => {
    setCurrentQuery(query);
    handleAIQuery(query);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/60">Please sign in to access AI Analytics</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 text-white min-h-0">
      {/* AI Analytics Header */}
      <motion.div 
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-400/25">
              <span className="text-lg font-bold text-slate-900">AI</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
              AI Analytics Assistant
            </h2>
            <p className="text-sm text-white/70">
              Advanced business intelligence powered by artificial intelligence
            </p>
          </div>
        </div>
        
          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchToTraditional}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-colors"
            >
              📈 Switch to Traditional
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-emerald-300">AI Ready</span>
            </div>
            <div className="text-xs text-white/50">
              {analyticsData ? `${analyticsData.invoices?.length || 0} invoices` : 'Loading...'}
            </div>
          </div>
      </motion.div>

      {/* Quick Insights Section */}
      <motion.div 
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-emerald-400 to-cyan-400 rounded-full"></div>
          <h3 className="text-lg font-semibold text-white">Quick Insights</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {suggestedQueries.map((suggestion, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSuggestedQuery(suggestion)}
              className="group relative px-3 py-2.5 text-sm rounded-lg bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/15 hover:border-emerald-400/30 transition-all duration-300 text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full group-hover:bg-cyan-400 transition-colors"></div>
                <span className="truncate text-xs sm:text-sm">{suggestion}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div 
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6"
      >
        {/* AI Chat Interface */}
        <div className="lg:col-span-2">
          <AIChatInterface
            chatHistory={chatHistory}
            currentQuery={currentQuery}
            setCurrentQuery={setCurrentQuery}
            onSendQuery={handleAIQuery}
            isLoading={isLoading}
          />
        </div>

        {/* Data Insights Sidebar */}
        <div className="space-y-4">
          <DataInsights data={analyticsData} />
        </div>
      </motion.div>

      {/* AI-Generated Visualizations */}
      <AnimatePresence>
        {chatHistory.filter(msg => msg.type === 'ai' && msg.chartConfig).length > 0 && (
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-blue-400 rounded-full"></div>
              <div>
                <h3 className="text-lg font-bold text-white">AI-Generated Analytics</h3>
                <p className="text-sm text-white/60">Advanced visualizations powered by machine learning</p>
              </div>
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-cyan-300">Live Analysis</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {chatHistory
                .filter(msg => msg.type === 'ai' && msg.chartConfig)
                .slice(-4) // Show last 4 charts
                .map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <DynamicChart
                      config={message.chartConfig}
                      data={message.chartConfig?.data || message.data}
                      title={message.content}
                    />
                  </motion.div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAnalytics;
