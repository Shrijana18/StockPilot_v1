import React from 'react';
import { motion } from 'framer-motion';

const DataInsights = ({ data }) => {
  if (!data) {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3">Data Overview</h3>
        <div className="text-white/60 text-sm">Loading data...</div>
      </div>
    );
  }

  const calculateInsights = () => {
    const { invoices, products, customers } = data;
    
    // Calculate total revenue
    const totalRevenue = invoices.reduce((sum, invoice) => {
      return sum + (invoice.grandTotal || invoice.totalAmount || 0);
    }, 0);

    // Calculate total profit (assuming we have cost data)
    const totalProfit = invoices.reduce((sum, invoice) => {
      const revenue = invoice.grandTotal || invoice.totalAmount || 0;
      const cost = invoice.totalCost || revenue * 0.7; // Estimate 30% profit margin
      return sum + (revenue - cost);
    }, 0);

    // Calculate average order value
    const avgOrderValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    // Count low stock products
    const lowStockProducts = products.filter(product => 
      (product.quantity || 0) <= (product.minQuantity || 10)
    ).length;

    // Calculate monthly growth (simplified)
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
    
    const thisMonthRevenue = invoices
      .filter(invoice => {
        const invoiceDate = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
        return invoiceDate >= new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      })
      .reduce((sum, invoice) => sum + (invoice.grandTotal || invoice.totalAmount || 0), 0);

    const lastMonthRevenue = invoices
      .filter(invoice => {
        const invoiceDate = invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt);
        return invoiceDate >= lastMonth && invoiceDate < new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      })
      .reduce((sum, invoice) => sum + (invoice.grandTotal || invoice.totalAmount || 0), 0);

    const growthRate = lastMonthRevenue > 0 ? 
      ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalProfit,
      avgOrderValue,
      totalOrders: invoices.length,
      totalProducts: products.length,
      totalCustomers: customers.length,
      lowStockProducts,
      growthRate,
      thisMonthRevenue,
      lastMonthRevenue
    };
  };

  const insights = calculateInsights();

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const StatCard = ({ title, value, subtitle, trend, color = 'emerald' }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-3 mb-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-white/80">{title}</h4>
        {trend && (
          <span className={`text-xs px-2 py-1 rounded ${
            trend > 0 
              ? 'bg-emerald-500/20 text-emerald-300' 
              : 'bg-rose-500/20 text-rose-300'
          }`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      <div className={`text-lg font-bold text-${color}-400`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-white/60 mt-1">{subtitle}</div>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
          Quick Insights
        </h3>
        
        <div className="space-y-3">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(insights.totalRevenue)}
            subtitle={`${insights.totalOrders} orders`}
            trend={insights.growthRate}
          />
          
          <StatCard
            title="Total Profit"
            value={formatCurrency(insights.totalProfit)}
            subtitle={`${((insights.totalProfit / insights.totalRevenue) * 100).toFixed(1)}% margin`}
            color="cyan"
          />
          
          <StatCard
            title="Avg Order Value"
            value={formatCurrency(insights.avgOrderValue)}
            subtitle="Per transaction"
            color="emerald"
          />
          
          <StatCard
            title="Products"
            value={insights.totalProducts}
            subtitle={`${insights.lowStockProducts} low stock`}
            color={insights.lowStockProducts > 0 ? 'rose' : 'emerald'}
          />
          
          <StatCard
            title="Customers"
            value={insights.totalCustomers}
            subtitle="Total registered"
            color="blue"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
          Data Status
        </h3>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-white/70">Last Updated:</span>
            <span className="text-white">
              {data.lastUpdated ? data.lastUpdated.toLocaleTimeString() : 'Unknown'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-white/70">Data Points:</span>
            <span className="text-white">
              {insights.totalOrders + insights.totalProducts + insights.totalCustomers}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-white/70">Data Quality:</span>
            <span className="text-emerald-300">Good</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
          Quick Actions
        </h3>
        
        <div className="space-y-2">
          <button className="w-full text-left text-xs text-white/70 hover:text-white transition-colors p-2 rounded hover:bg-white/5">
            📊 Export Data
          </button>
          <button className="w-full text-left text-xs text-white/70 hover:text-white transition-colors p-2 rounded hover:bg-white/5">
            🔄 Refresh Data
          </button>
          <button className="w-full text-left text-xs text-white/70 hover:text-white transition-colors p-2 rounded hover:bg-white/5">
            ⚙️ Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataInsights;
