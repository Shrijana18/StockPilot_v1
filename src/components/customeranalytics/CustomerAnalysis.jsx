import React from "react";
import CustomerRetentionCard from "./CustomerRetentionCard";
import TopLoyalCustomersTable from "./TopLoyalCustomersTable";
import CustomerProductsTable from "./CustomerProductsTable";
import HourlyVisitChart from "./HourlyVisitChart";
import CustomerInsights from "../../components/customeranalytics/CustomerInsights";
import CustomerLoyaltyTags from "./CustomerLoyaltyTags";
import TopProductsChart from "./TopProductsChart";

const CustomerAnalysis = ({ custId }) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">👥 Customer Analysis</h1>
      <CustomerRetentionCard custId={custId} />
      <TopLoyalCustomersTable custId={custId} />
      <CustomerProductsTable custId={custId} />
      <HourlyVisitChart custId={custId} />
      <TopProductsChart custId={custId} />
      <CustomerInsights custId={custId} />
      <CustomerLoyaltyTags custId={custId} />
    </div>
  );
};

export default CustomerAnalysis;