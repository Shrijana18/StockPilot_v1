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
          return <div className="text-red-600">Invalid tab selected</div>;
      }
    } catch (error) {
      return (
        <div className="text-red-600">
          An error occurred while rendering the tab: {error.message}
        </div>
      );
    }
  };

  const tabClasses = (tabName) =>
    `px-4 py-2 rounded transition ${
      activeTab === tabName
        ? "bg-blue-600 text-white shadow"
        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-gray-700 mb-4">Inventory Management</h1>

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
      <div className="bg-white rounded shadow p-4 min-h-[200px]">{renderTab()}</div>
    </div>
  );
};

export default Inventory;