import React, { useState } from "react";
import CreateInvoice from "../components/billing/CreateInvoice";
import ViewInvoices from "../components/billing/ViewInvoices";

const Billing = () => {
  const [activeTab, setActiveTab] = useState("create");

  return (
    <section className="px-4 py-6 md:px-6 max-w-6xl mx-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <h1 className="text-xl md:text-2xl font-bold mb-4 text-center">Billing Dashboard</h1>

      <div className="flex flex-wrap justify-center mb-6 gap-2">
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
      </div>

      {activeTab === "create" && (
        <div className="space-y-4 pb-28">
          <CreateInvoice />
        </div>
      )}
      {activeTab === "view" && <ViewInvoices />}
      {activeTab === "create" && (
        <div className="fixed bottom-4 inset-x-4 z-50 md:hidden">
          <button
            onClick={() => console.log("Create Bill tapped")}
            className="w-full bg-blue-600 text-white py-3 rounded-xl shadow-lg text-lg font-semibold"
          >
            Create Bill
          </button>
        </div>
      )}
    </section>
  );
};

export default Billing;