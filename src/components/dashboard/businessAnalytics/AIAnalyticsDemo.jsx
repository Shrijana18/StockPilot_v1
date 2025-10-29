import React, { useState } from 'react';
import { motion } from 'framer-motion';

const AIAnalyticsDemo = () => {
  const [selectedDemo, setSelectedDemo] = useState(null);

  const demos = [
    {
      id: 'sales',
      title: 'Sales Analysis',
      query: 'Show me sales for last month',
      description: 'Analyze sales performance and trends',
      icon: '📈',
      features: ['Revenue tracking', 'Trend analysis', 'Period comparison']
    },
    {
      id: 'profit',
      title: 'Profit Insights',
      query: 'What\'s my profit for this quarter?',
      description: 'Deep dive into profitability metrics',
      icon: '💰',
      features: ['Profit margins', 'Cost analysis', 'ROI calculations']
    },
    {
      id: 'products',
      title: 'Product Performance',
      query: 'Which products are selling best?',
      description: 'Identify top-performing products',
      icon: '🏆',
      features: ['Top sellers', 'Product ranking', 'Sales volume']
    },
    {
      id: 'inventory',
      title: 'Inventory Management',
      query: 'How is my inventory performing?',
      description: 'Monitor stock levels and alerts',
      icon: '📦',
      features: ['Stock levels', 'Low stock alerts', 'Inventory turnover']
    },
    {
      id: 'customers',
      title: 'Customer Analysis',
      query: 'What are my top customers?',
      description: 'Understand customer behavior and value',
      icon: '👥',
      features: ['Customer ranking', 'Spending patterns', 'Lifetime value']
    },
    {
      id: 'trends',
      title: 'Trend Analysis',
      query: 'Show revenue trends for last 6 months',
      description: 'Visualize business growth patterns',
      icon: '📊',
      features: ['Growth trends', 'Seasonal patterns', 'Forecasting']
    }
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">🤖 AI Analytics Demo</h2>
        <p className="text-white/70">See how AI can transform your business data into actionable insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {demos.map((demo) => (
          <motion.div
            key={demo.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedDemo(demo)}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">{demo.icon}</div>
              <div>
                <h3 className="font-semibold text-white">{demo.title}</h3>
                <p className="text-xs text-white/60">{demo.description}</p>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-xs text-white/50 mb-1">Try asking:</div>
              <div className="text-sm text-emerald-300 font-mono bg-black/20 rounded px-2 py-1">
                "{demo.query}"
              </div>
            </div>
            
            <div className="space-y-1">
              {demo.features.map((feature, index) => (
                <div key={index} className="text-xs text-white/70 flex items-center gap-2">
                  <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                  {feature}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Selected Demo Details */}
      {selectedDemo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{selectedDemo.icon}</div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedDemo.title}</h3>
                <p className="text-white/70">{selectedDemo.description}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDemo(null)}
              className="text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-white mb-3">Example Query</h4>
              <div className="bg-black/20 rounded-lg p-4 mb-4">
                <div className="text-emerald-300 font-mono text-sm">
                  "{selectedDemo.query}"
                </div>
              </div>
              
              <h4 className="font-semibold text-white mb-3">AI Response</h4>
              <div className="bg-white/5 rounded-lg p-4 text-sm text-white/80">
                {getDemoResponse(selectedDemo.id)}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-3">Generated Visualizations</h4>
              <div className="space-y-3">
                {getDemoCharts(selectedDemo.id).map((chart, index) => (
                  <div key={index} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      <span className="text-sm font-medium text-white">{chart.title}</span>
                    </div>
                    <div className="text-xs text-white/60">{chart.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const getDemoResponse = (demoId) => {
  const responses = {
    sales: "Your sales for last month: ₹2,45,000 from 156 orders (avg: ₹1,570 per order). Revenue increased by 12% compared to previous month with strongest performance in the third week.",
    profit: "Your profit for this quarter: ₹73,500 (30% margin). This represents a 8% increase from last quarter. Top profit drivers were electronics and accessories categories.",
    products: "Top selling products: iPhone 14 (45 units), Samsung Galaxy (32 units), AirPods (28 units). iPhone 14 generated ₹6,75,000 in revenue, representing 27% of total sales.",
    inventory: "Inventory status: 89% in stock, 8% low stock, 3% out of stock. 12 products need restocking including iPhone 14, MacBook Air, and AirPods Pro. Recommend ordering 50+ units for low stock items.",
    customers: "Top customers: Rajesh Kumar (₹45,000), Priya Sharma (₹38,500), Amit Patel (₹32,000). These 3 customers represent 47% of your total revenue. Average customer lifetime value is ₹8,500.",
    trends: "Revenue trends for last 6 months show consistent growth: Jan ₹1,80,000, Feb ₹1,95,000, Mar ₹2,10,000, Apr ₹2,25,000, May ₹2,35,000, Jun ₹2,45,000. 36% overall growth with 4.2% monthly average increase."
  };
  return responses[demoId] || "AI analysis would appear here...";
};

const getDemoCharts = (demoId) => {
  const charts = {
    sales: [
      { title: "Sales Trend Chart", description: "Line chart showing daily sales over the period" },
      { title: "Revenue Breakdown", description: "Bar chart comparing different product categories" }
    ],
    profit: [
      { title: "Profit Margin Chart", description: "Bar chart showing profit margins by category" },
      { title: "Cost vs Revenue", description: "Stacked bar chart comparing costs and revenue" }
    ],
    products: [
      { title: "Top Products Chart", description: "Horizontal bar chart of best-selling products" },
      { title: "Product Performance", description: "Scatter plot showing quantity vs revenue" }
    ],
    inventory: [
      { title: "Inventory Status Pie", description: "Pie chart showing stock distribution" },
      { title: "Low Stock Alerts", description: "Table listing products needing restocking" }
    ],
    customers: [
      { title: "Customer Ranking", description: "Bar chart of top customers by spending" },
      { title: "Customer Value Analysis", description: "Scatter plot of order count vs total value" }
    ],
    trends: [
      { title: "Growth Trend Line", description: "Line chart showing revenue growth over time" },
      { title: "Monthly Comparison", description: "Bar chart comparing month-over-month growth" }
    ]
  };
  return charts[demoId] || [];
};

export default AIAnalyticsDemo;
