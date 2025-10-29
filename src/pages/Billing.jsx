import React, { useState } from "react";
import CreateInvoice from "../components/billing/CreateInvoice";
import ViewInvoices from "../components/billing/ViewInvoices";
import BillingSettings from "../components/billing/BillingSettings";

const Billing = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <section className="px-2 sm:px-4 py-4 sm:py-6 md:px-6 max-w-6xl mx-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
          Billing Dashboard
        </h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="ml-2 text-base sm:text-lg text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          title="Customize Billing"
        >
          ⚙
        </button>
      </div>

      <div className="flex flex-wrap justify-center mb-4 sm:mb-6 gap-1 sm:gap-2 bg-white/5 backdrop-blur-xl p-1 sm:p-2 rounded-2xl border border-white/10">
        <button
          className={`px-3 sm:px-4 py-2 rounded-l-xl transition text-sm sm:text-base ${
            activeTab === "create"
              ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              : "bg-white/10 text-white hover:bg-white/15 border border-white/15"
          }`}
          onClick={() => setActiveTab("create")}
        >
          Create Invoice
        </button>
        <button
          className={`px-3 sm:px-4 py-2 rounded-r-xl transition text-sm sm:text-base ${
            activeTab === "view"
              ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              : "bg-white/10 text-white hover:bg-white/15 border border-white/15"
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
            className="w-full text-slate-900 py-3 rounded-xl shadow-lg text-lg font-semibold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
          >
            Create Bill
          </button>
        </div>
      )}
      <BillingSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => console.log("Billing settings saved:", s)}
      />
    </section>
  );
};

export default Billing;