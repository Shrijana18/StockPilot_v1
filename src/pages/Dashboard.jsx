import React, { useState } from "react";
import Billing from "../pages/Billing";
import AllInvoices from "../pages/AllInvoices";
import Inventory from "../pages/Inventory";
import { useAuth } from "../context/AuthContext";
import { getAuth, signOut } from "firebase/auth";

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState("billing");
  const [billingTab, setBillingTab] = useState("generate");

  const renderBillingContent = () => {
    if (billingTab === "generate") return <Billing currentUser={currentUser} />;
    if (billingTab === "all") return <AllInvoices currentUser={currentUser} />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4 flex space-x-4 border-b border-gray-300">
        <button
          onClick={() => setActiveMainTab("billing")}
          className={`px-4 py-2 rounded-t-lg font-semibold ${
            activeMainTab === "billing"
              ? "bg-blue-600 text-white border-b-0"
              : "bg-white text-gray-700 border border-gray-300"
          }`}
        >
          Billing
        </button>
        <button
          onClick={() => setActiveMainTab("inventory")}
          className={`px-4 py-2 rounded-t-lg font-semibold ${
            activeMainTab === "inventory"
              ? "bg-blue-600 text-white border-b-0"
              : "bg-white text-gray-700 border border-gray-300"
          }`}
        >
          Inventory
        </button>
      </div>
      <div className="p-4 flex justify-end">
        <button
          onClick={async () => {
            await signOut(getAuth());
            window.location.href = "/";
          }}
          className="text-sm bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded"
        >
          Sign Out
        </button>
      </div>

      {activeMainTab === "billing" && (
        <div className="px-4">
          <div className="flex space-x-2 mb-4 border-b border-gray-300">
            <button
              onClick={() => setBillingTab("generate")}
              className={`px-4 py-2 rounded-t-lg font-medium ${
                billingTab === "generate"
                  ? "bg-blue-500 text-white border-b-0"
                  : "bg-gray-200 text-gray-700 border border-gray-300"
              }`}
            >
              Generate Invoice
            </button>
            <button
              onClick={() => setBillingTab("all")}
              className={`px-4 py-2 rounded-t-lg font-medium ${
                billingTab === "all"
                  ? "bg-blue-500 text-white border-b-0"
                  : "bg-gray-200 text-gray-700 border border-gray-300"
              }`}
            >
              All Invoices
            </button>
          </div>
          {renderBillingContent()}
        </div>
      )}

      {activeMainTab === "inventory" && (
        <div className="px-4">
          <Inventory currentUser={currentUser} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;