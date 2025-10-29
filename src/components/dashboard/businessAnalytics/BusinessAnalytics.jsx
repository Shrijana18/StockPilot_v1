


import { AnalyticsFilterProvider, useAnalyticsFilter } from '../../../context/AnalyticsFilterContext';
import React, { useState } from 'react';
import RevenueOverview from './RevenueOverview';
import TopSellingProducts from './TopSellingProducts';
import ProfitInsights from './ProfitInsights';
import InventoryForecast from './InventoryForecast';
import InvoiceTypeBreakdown from './InvoiceTypeBreakdown';
import SalesGrowthHeatmap from './SalesGrowthHeatmap';
import SmartSuggestionsPanel from './SmartSuggestionsPanel';
import AIAnalytics from './AIAnalytics';

const BusinessAnalytics = () => {
  const [activeTab, setActiveTab] = useState('traditional');

  // Prevent scroll jump when toggling tabs by preserving scroll position
  const switchTab = (tab) => {
    const currentY = window.scrollY;
    setActiveTab(tab);
    // Restore scroll position after DOM updates with multiple attempts
    requestAnimationFrame(() => {
      window.scrollTo({ top: currentY, behavior: 'instant' });
      // Additional restoration after a short delay to handle async content loading
      setTimeout(() => {
        window.scrollTo({ top: currentY, behavior: 'instant' });
      }, 100);
    });
  };

  return (
    <AnalyticsFilterProvider>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 text-white">
        {/* Header with Tab Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
            📊 Business Analytics Dashboard
          </h1>
          
          {/* Tab Toggle - Made more prominent */}
          <div className="flex bg-white/15 backdrop-blur-xl border-2 border-white/20 rounded-xl p-1 shadow-lg">
            <button
              onClick={() => switchTab('traditional')}
              className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'traditional'
                  ? 'bg-emerald-500 text-slate-900 shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              📈 Traditional Analytics
            </button>
            <button
              onClick={() => switchTab('ai')}
              className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'ai'
                  ? 'bg-emerald-500 text-slate-900 shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              🤖 AI Assistant
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'traditional' ? (
          <div className="space-y-6 sm:space-y-8">
            <FilterControls />
            <RevenueOverview />
            <TopSellingProducts />
            <ProfitInsights />
            <InventoryForecast />
            <InvoiceTypeBreakdown />
            <SalesGrowthHeatmap />
            <SmartSuggestionsPanel />
          </div>
        ) : (
          <AIAnalytics onSwitchToTraditional={() => switchTab('traditional')} />
        )}
      </div>
    </AnalyticsFilterProvider>
  );
};

export default BusinessAnalytics;

const FilterControls = () => {
  const { selectedProduct, setSelectedProduct, selectedDate, setSelectedDate } = useAnalyticsFilter();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10">
      <div className="w-full sm:w-auto">
        <label className="text-xs sm:text-sm font-medium text-white/80">Select Product:</label>
        <select
          className="mt-1 block w-full sm:w-60 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
          value={selectedProduct || ''}
          onChange={(e) => setSelectedProduct(e.target.value)}
        >
          <option value="">All Products</option>
          <option value="SKU1">SKU1</option>
          <option value="SKU2">SKU2</option>
        </select>
      </div>

      <div className="w-full sm:w-auto">
        <label className="text-xs sm:text-sm font-medium text-white/80">Select Date:</label>
        <input
          type="date"
          className="mt-1 block w-full sm:w-48 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
          value={selectedDate || ''}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
    </div>
  );
};