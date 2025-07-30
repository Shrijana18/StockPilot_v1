import React, { useState } from "react";

const inputClass = "mb-2 w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const AdvancedBrandInputForm = ({ onGenerate }) => {
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [productTypes, setProductTypes] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [description, setDescription] = useState("");
  const [skuHint, setSkuHint] = useState("");
  const [regionNote, setRegionNote] = useState("");
  const [promptOverride, setPromptOverride] = useState("");
  const [loading, setLoading] = useState(false);

  const generatePrompt = () => {
    return `
You are an inventory assistant. Return ONLY a markdown table of ${quantity} products.

Brand: ${brandName}
Category: ${category}
Known Types: ${productTypes}
SKU Pattern: ${skuHint}
Region Context: ${regionNote}
Additional Notes: ${description}

Strict Format:
Please ensure the **Unit** column includes both quantity and container type (e.g., "100ml Bottle", "250g Jar", "50ml Tube").

| Product Name | Brand | Category | SKU | Price (INR) | Unit |
|--------------|-------|----------|-----|-------------|------|
`.trim();
  };

  const handleGenerate = async () => {
    const promptToSend = promptOverride.trim() || generatePrompt();
    if (!brandName || !category) {
      alert("Please enter Brand Name and Category");
      return;
    }
    setLoading(true);
    await onGenerate(promptToSend);
    setLoading(false);
  };

  return (
    <div className="p-4 border rounded bg-white shadow-md space-y-6">
      <h2 className="text-lg font-semibold">🧠 Advanced Inventory Generator</h2>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Brand Information</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand Name</label>
            <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Known Product Types</label>
            <input
              type="text"
              value={productTypes}
              onChange={(e) => setProductTypes(e.target.value)}
              className={inputClass}
              placeholder="e.g. Front Load, Cream Biscuit"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantity of Products</label>
            <select value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Brand Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">SKU Pattern</legend>
        <div>
          <label className="block text-sm font-medium mb-1">Optional SKU Pattern</label>
          <input
            type="text"
            value={skuHint}
            onChange={(e) => setSkuHint(e.target.value)}
            className={inputClass}
            placeholder="e.g. RL-TEA-*, SMG-WM-*"
          />
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Region Context</legend>
        <div>
          <label className="block text-sm font-medium mb-1">Smart Region Note (optional)</label>
          <input
            type="text"
            value={regionNote}
            onChange={(e) => setRegionNote(e.target.value)}
            className={inputClass}
            placeholder="e.g. Local brand sold only in Gujarat"
          />
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium mb-1 mt-4">🧾 Prompt Preview (Editable)</label>
        <textarea
          rows={6}
          value={promptOverride || generatePrompt()}
          onChange={(e) => setPromptOverride(e.target.value)}
          className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className={`mt-3 px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? '⏳ Generating...' : '🚀 Generate Inventory'}
      </button>
    </div>
  );
};

export default AdvancedBrandInputForm;