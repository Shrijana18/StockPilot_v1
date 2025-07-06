import React, { useState } from "react";
import GenerateInvoice from "./billing/GenerateInvoice";
import AllInvoices from "./AllInvoices";

const BillingTabs = () => {
  const [activeTab, setActiveTab] = useState("generate");

  const renderTabContent = () => {
    if (activeTab === "generate") return <GenerateInvoice />;
    if (activeTab === "all") return <AllInvoices />;
    if (activeTab === "upload") return <div>Manual Upload Invoice - Coming Soon</div>;
    return null;
  };

  return (
    <div className="px-4">
      <div className="flex gap-4 mb-4">
        <button
          className={`py-2 px-4 rounded ${activeTab === "generate" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100"}`}
          onClick={() => setActiveTab("generate")}
        >
          Generate Invoice
        </button>
        <button
          className={`py-2 px-4 rounded ${activeTab === "all" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100"}`}
          onClick={() => setActiveTab("all")}
        >
          All Invoices
        </button>
        <button
          className={`py-2 px-4 rounded ${activeTab === "upload" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100"}`}
          onClick={() => setActiveTab("upload")}
        >
          Manual Upload
        </button>
      </div>
      {renderTabContent()}
    </div>
  );
};

export default BillingTabs;