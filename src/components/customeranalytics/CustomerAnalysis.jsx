import React from "react";
import CustomerRetentionCard from "./CustomerRetentionCard";
import TopLoyalCustomersTable from "./TopLoyalCustomersTable";
import CustomerProductsTable from "./CustomerProductsTable";
import HourlyVisitChart from "./HourlyVisitChart";
import CustomerInsights from "../../components/customeranalytics/CustomerInsights";
import CustomerLoyaltyTags from "./CustomerLoyaltyTags";
import TopProductsChart from "./TopProductsChart";

const CustomerAnalysis = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">👥 Customer Analysis</h1>
      <CustomerRetentionCard />
      <TopLoyalCustomersTable />
      <CustomerProductsTable />
      <HourlyVisitChart />
      <TopProductsChart />
      <CustomerInsights />
      <CustomerLoyaltyTags />
    </div>
  );
};

export default CustomerAnalysis;