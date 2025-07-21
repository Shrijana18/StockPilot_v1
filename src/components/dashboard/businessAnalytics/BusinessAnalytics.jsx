


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
      <div className="p-6 space-y-8">
        <h1 className="text-2xl font-bold text-gray-800">📊 Business Analytics Dashboard</h1>
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
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Select Product:</label>
        <select
          className="mt-1 block w-60 rounded border-gray-300 shadow-sm"
          value={selectedProduct || ''}
          onChange={(e) => setSelectedProduct(e.target.value)}
        >
          <option value="">All Products</option>
          <option value="SKU1">SKU1</option>
          <option value="SKU2">SKU2</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700">Select Date:</label>
        <input
          type="date"
          className="mt-1 block w-48 rounded border-gray-300 shadow-sm"
          value={selectedDate || ''}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
    </div>
  );
};