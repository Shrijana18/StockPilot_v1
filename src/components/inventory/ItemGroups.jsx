// src/components/inventory/ItemGroups.jsx

import React from "react";

const ItemGroups = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Item Groups</h2>
      <p className="text-gray-600">This section will allow users to group similar items together (like variants or combos).</p>
      <div className="mt-6 border rounded p-4 bg-yellow-50 border-yellow-300">
        <p className="text-yellow-800">⚠️ Feature coming soon: Add item groups by SKU, brand, or category.</p>
      </div>
    </div>
  );
};

export default ItemGroups;