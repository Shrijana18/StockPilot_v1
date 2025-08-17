import React, { useState } from "react";

const inputClass = "mb-2 w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-transparent";

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
Start the response with the following header row exactly:

| Product Name | Brand | Category | SKU | Price (INR) | Unit |

Each product must follow this format and ensure the **Unit** column includes both quantity and container type (e.g., "100ml Bottle", "250g Jar", "50ml Tube").
Do not include any text above or below the table.

Brand: ${brandName}
Category: ${category}
Known Types: ${productTypes}
SKU Pattern: ${skuHint}
Region Context: ${regionNote}
Additional Notes: ${description}
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
    <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] space-y-6 text-white">
      <h2 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">🧠 Advanced Inventory Generator</h2>

      <fieldset className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur">
        <legend className="text-md font-semibold px-2 text-white/80">Brand Information</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white/80">Brand Name</label>
            <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white/80">Product Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white/80">Known Product Types</label>
            <input
              type="text"
              value={productTypes}
              onChange={(e) => setProductTypes(e.target.value)}
              className={inputClass}
              placeholder="e.g. Front Load, Cream Biscuit"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white/80">Quantity of Products</label>
            <select value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-white/80">Brand Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur">
        <legend className="text-md font-semibold px-2 text-white/80">SKU Pattern</legend>
        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Optional SKU Pattern</label>
          <input
            type="text"
            value={skuHint}
            onChange={(e) => setSkuHint(e.target.value)}
            className={inputClass}
            placeholder="e.g. RL-TEA-*, SMG-WM-*"
          />
        </div>
      </fieldset>

      <fieldset className="border border-white/10 rounded-xl p-4 bg-white/5 backdrop-blur">
        <legend className="text-md font-semibold px-2 text-white/80">Region Context</legend>
        <div>
          <label className="block text-sm font-medium mb-1 text-white/80">Smart Region Note (optional)</label>
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
        <label className="block text-sm font-medium mb-1 mt-4 text-white/80">🧾 Prompt Preview (Editable)</label>
        <textarea
          rows={6}
          value={promptOverride || generatePrompt()}
          onChange={(e) => setPromptOverride(e.target.value)}
          className="w-full rounded p-2 text-sm font-mono bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-transparent"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className={`mt-3 px-4 py-2 rounded-xl font-semibold ${loading ? 'opacity-60 cursor-not-allowed text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400' : 'text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]'}`}
      >
        {loading ? '⏳ Generating...' : '🚀 Generate Inventory'}
      </button>
    </div>
  );
};

export default AdvancedBrandInputForm;