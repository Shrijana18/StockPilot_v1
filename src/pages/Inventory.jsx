// src/pages/Inventory.jsx

import React, { useState } from "react";
import AddInventoryOptions from "../components/inventory/AddInventoryOptions";
import ViewInventory from "../components/inventory/ViewInventory";
import ItemGroups from "../components/inventory/ItemGroups";
import LowStockAlerts from "../components/inventory/LowStockAlerts";

const Inventory = () => {
  const [activeTab, setActiveTab] = useState("add");

  const renderTab = () => {
    try {
      switch (activeTab) {
        case "add":
          return <AddInventoryOptions />;
        case "view":
          return <ViewInventory />;
        case "groups":
          return <ItemGroups />;
        case "alerts":
          return <LowStockAlerts />;
        default:
          return <div className="text-rose-300">Invalid tab selected</div>;
      }
    } catch (error) {
      return (
        <div className="text-rose-300">
          An error occurred while rendering the tab: {error.message}
        </div>
      );
    }
  };

  const tabClasses = (tabName) =>
    `px-4 py-2 rounded-xl transition ${
      activeTab === tabName
        ? 'bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]'
        : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'
    }`;

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Inventory Management</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button className={tabClasses("add")} onClick={() => setActiveTab("add")}>
          ➕ Add Inventory
        </button>
        <button className={tabClasses("view")} onClick={() => setActiveTab("view")}>
          📦 View Inventory
        </button>
        <button className={tabClasses("groups")} onClick={() => setActiveTab("groups")}>
          🧩 Item Groups
        </button>
        <button className={tabClasses("alerts")} onClick={() => setActiveTab("alerts")}>
          ⚠️ Low Stock Alerts
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 min-h-[200px] rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">{renderTab()}</div>
    </div>
  );
};

export default Inventory;