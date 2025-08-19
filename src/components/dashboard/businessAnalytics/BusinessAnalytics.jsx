


import { AnalyticsFilterProvider, useAnalyticsFilter } from '../../../context/AnalyticsFilterContext';
import React from 'react';
import RevenueOverview from './RevenueOverview';
import TopSellingProducts from './TopSellingProducts';
import ProfitInsights from './ProfitInsights';
import InventoryForecast from './InventoryForecast';
import InvoiceTypeBreakdown from './InvoiceTypeBreakdown';
import SalesGrowthHeatmap from './SalesGrowthHeatmap';
import SmartSuggestionsPanel from './SmartSuggestionsPanel';

const BusinessAnalytics = () => {
  return (
    <AnalyticsFilterProvider>
      <div className="p-6 space-y-8 text-white">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">📊 Business Analytics Dashboard</h1>
        <FilterControls />
        <RevenueOverview />
        <TopSellingProducts />
        <ProfitInsights />
        <InventoryForecast />
        <InvoiceTypeBreakdown />
        <SalesGrowthHeatmap />
        <SmartSuggestionsPanel />
      </div>
    </AnalyticsFilterProvider>
  );
};

export default BusinessAnalytics;

const FilterControls = () => {
  const { selectedProduct, setSelectedProduct, selectedDate, setSelectedDate } = useAnalyticsFilter();

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4 p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10">
      <div>
        <label className="text-sm font-medium text-white/80">Select Product:</label>
        <select
          className="mt-1 block w-60 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          value={selectedProduct || ''}
          onChange={(e) => setSelectedProduct(e.target.value)}
        >
          <option value="">All Products</option>
          <option value="SKU1">SKU1</option>
          <option value="SKU2">SKU2</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-white/80">Select Date:</label>
        <input
          type="date"
          className="mt-1 block w-48 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          value={selectedDate || ''}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
    </div>
  );
};