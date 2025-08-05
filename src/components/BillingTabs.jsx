import React, { useState } from "react";
import GenerateInvoice from "./billing/CreateInvoice";
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
    <div className="px-4 py-6 md:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] space-y-6">
      <div className="flex gap-2 flex-wrap md:flex-nowrap mb-4">
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