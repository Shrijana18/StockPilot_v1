import React, { useState } from "react";
import CreateInvoice from "../components/billing/CreateInvoice";
import ViewInvoices from "../components/billing/ViewInvoices";

const Billing = () => {
  const [activeTab, setActiveTab] = useState("create");

  return (
    <section className="px-4 py-6 md:px-6 max-w-6xl mx-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <h1 className="text-xl md:text-2xl font-bold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Billing Dashboard</h1>

      <div className="flex flex-wrap justify-center mb-6 gap-2 bg-white/5 backdrop-blur-xl p-2 rounded-2xl border border-white/10">
        <button
          className={`px-4 py-2 rounded-l-xl transition ${
            activeTab === "create"
              ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              : "bg-white/10 text-white hover:bg-white/15 border border-white/15"
          }`}
          onClick={() => setActiveTab("create")}
        >
          Create Invoice
        </button>
        <button
          className={`px-4 py-2 rounded-r-xl transition ${
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
    </section>
  );
};

export default Billing;