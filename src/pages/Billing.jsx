import React, { useState } from "react";
import CreateInvoice from "../components/billing/CreateInvoice";
import ViewInvoices from "../components/billing/ViewInvoices";
import ImportOldInvoice from "../components/billing/ImportOldInvoice";

const Billing = () => {
  const [activeTab, setActiveTab] = useState("create");

  return (
    <section className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Billing Dashboard</h1>

      <div className="flex justify-center mb-6 space-x-2">
        <button
          className={`px-4 py-2 rounded-l ${
            activeTab === "create"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setActiveTab("create")}
        >
          Create Invoice
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === "view"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setActiveTab("view")}
        >
          View Invoices
        </button>
        <button
          className={`px-4 py-2 rounded-r ${
            activeTab === "import"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-800"
          }`}
          onClick={() => setActiveTab("import")}
        >
          Import Invoice
        </button>
      </div>

      {activeTab === "create" && <CreateInvoice />}
      {activeTab === "view" && <ViewInvoices />}
      {activeTab === "import" && <ImportOldInvoice />}
    </section>
  );
};

export default Billing;