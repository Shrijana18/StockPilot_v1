import React, { useState } from "react";
import { toast } from "react-toastify";
import { app } from "../../../firebase/firebaseConfig.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { logInventoryChange } from "../../../utils/logInventoryChange";

import AdvancedBrandInputForm from "../../inventory/AdvancedBrandInputForm";

const AIAutogenForm = ({ userId }) => {
  const [businessDescription, setBusinessDescription] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const db = getFirestore(app);

  // --- RENDER CONSTANTS ---
  const GST_OPTIONS = [0, 5, 12, 18, 28];
  const PRICING_OPTIONS = ["MRP_INCLUSIVE", "BASE_PLUS_GST"];

  // Prompt-based inventory generation handler for AdvancedBrandInputForm
  const handlePromptInventoryGeneration = async (payload) => {
    // payload can be either a string (legacy) or an object (new format)
    const promptText = typeof payload === 'string' ? payload : payload?.prompt;
    
    // Ensure promptText is a string and not empty
    if (!promptText || (typeof promptText !== 'string') || promptText.trim().length === 0) {
      toast.error("Prompt is empty.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("https://us-central1-stockpilotv1.cloudfunctions.net/generateInventoryByBrand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText })
      });

      const data = await response.json();
      const items = data.inventory;
      const responses = [];

      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item.productName || !item.sku) continue;

          responses.push({
            productName: item.productName || "",
            brand: item.brand || "",
            category: item.category || "Food",
            sku: item.sku || "",
            unit: item.unit || "",
            quantity: "",
            costPrice: "",
            sellingPrice: item.price || item.mrp || item.sellingPrice || "",
            pricingMode: item.pricingMode || item.PricingMode || "MRP_INCLUSIVE",
            mrp: item.mrp ?? "",
            basePrice: item.basePrice ?? "",
            taxRate: item.gstRate ?? item.gst ?? item.taxRate ?? "",
            hsnCode: item.hsnCode || item.hsn || "",
            imageUrl: item.imageUrl || "",
          });
        }
      }

      setInventoryList(responses);
      if (responses.length === 0) {
        toast.info("No inventory returned. Try adjusting prompt.");
      }
    } catch (error) {
      console.error("Prompt-based inventory error:", error);
      toast.error("Failed to fetch inventory.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!userId || inventoryList.length === 0) {
      toast.error("No inventory to upload.");
      return;
    }

    try {
      for (const item of inventoryList) {
        const docRef = await addDoc(collection(db, "businesses", userId, "products"), {
          productName: item.productName || "",
          brand: item.brand || "",
          category: item.category || "",
          sku: item.sku || "",
          unit: item.unit || "",
          quantity: Number(item.quantity) || 0,
          costPrice: Number(item.costPrice) || 0,
          sellingPrice: Number(item.sellingPrice) || 0,
          mrp: item.mrp ? Number(item.mrp) : undefined,
          pricingMode: item.pricingMode || "MRP_INCLUSIVE",
          basePrice: item.basePrice ? Number(item.basePrice) : undefined,
          taxRate: item.taxRate ? Number(item.taxRate) : undefined,
          gstRate: item.taxRate ? Number(item.taxRate) : undefined,
          hsnCode: item.hsnCode || "",
          imageUrl: item.imageUrl || "",
          source: "ai",
          createdAt: serverTimestamp(),
        });

        await logInventoryChange({
          productId: docRef.id,
          sku: item.sku,
          previousData: {},
          updatedData: item,
          action: "created",
          source: "ai",
        });
      }

      toast.success("Inventory added successfully!");
      setInventoryList([]);
    } catch (err) {
      console.error("Upload Error:", err);
      toast.error("Failed to add inventory.");
    }
  };

  const handleGenerateBrands = () => {
    const brandList = businessDescription
      .split(",")
      .map(b => b.trim())
      .filter(b => b.length > 0);
    if (brandList.length === 0) {
      toast.error("Please enter at least one brand name.");
      return;
    }
    setSelectedBrands(brandList);
    handleGenerateInventory();
  };

  const handleGenerateInventory = async () => {
    const brandList = businessDescription
      .split(",")
      .map(b => b.trim())
      .filter(b => b.length > 0);

    if (brandList.length === 0) {
      toast.error("Please enter at least one brand name.");
      return;
    }

    setIsLoading(true);

    try {
      const responses = [];

      for (const brand of brandList) {
        const response = await fetch("https://us-central1-stockpilotv1.cloudfunctions.net/generateInventoryByBrand", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ brand })
        });

        const data = await response.json();
        const items = data.inventory;

        if (!items || !Array.isArray(items)) continue;

        for (const item of items) {
          if (!item.productName || !item.sku) continue;

          responses.push({
            productName: item.productName || "",
            brand: item.brand || "",
            category: item.category || "Food",
            sku: item.sku || "",
            unit: item.unit || "",
            quantity: "",
            costPrice: "",
            sellingPrice: item.price || item.mrp || item.sellingPrice || "",
            pricingMode: item.pricingMode || item.PricingMode || "MRP_INCLUSIVE",
            mrp: item.mrp ?? "",
            basePrice: item.basePrice ?? "",
            taxRate: item.gstRate ?? item.gst ?? item.taxRate ?? "",
            hsnCode: item.hsnCode || item.hsn || "",
            imageUrl: item.imageUrl || "",
          });
        }
      }

      setInventoryList(responses);
      console.log("✅ Final Inventory List:", responses);

      if (brandList.length > 0 && responses.length === 0) {
        toast.info("No inventory returned. Try different brands.");
      }
    } catch (error) {
      console.error("Error generating inventory:", error);
      toast.error("Failed to fetch inventory.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBrandSelection = (brand) => {
    if (selectedBrands.includes(brand)) {
      setSelectedBrands(selectedBrands.filter((b) => b !== brand));
    } else {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const handleFieldChange = (index, field, value) => {
    const updatedList = [...inventoryList];
    updatedList[index][field] = value;
    setInventoryList(updatedList);
  };

  return (
    <div className="w-full">
      <style>{`
        .glass-card{background:rgba(16,23,32,0.6);border:1px solid rgba(255,255,255,0.08);box-shadow:0 6px 24px rgba(0,0,0,0.35);backdrop-filter:blur(10px);border-radius:14px}
        .soft-title{background:linear-gradient(90deg,rgba(255,255,255,.95),rgba(255,255,255,.75));-webkit-background-clip:text;background-clip:text;color:transparent}
        .ai-table th{position:sticky;top:0;background:rgba(23,33,45,.9);backdrop-filter:blur(8px);}
        .ai-input{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#eef2f7}
        .ai-input::placeholder{color:rgba(255,255,255,0.45)}
        .ai-btn{border-radius:12px;padding:.6rem 1rem;border:1px solid rgba(255,255,255,.14)}
        .ai-btn-primary{background:linear-gradient(180deg,#2dd4bf,#06b6d4);color:#0b1020;border:none}
        .ai-btn-ghost{background:rgba(255,255,255,0.06);color:#e3eef8}
        .ai-btn-danger{background:rgba(239,68,68,.15);color:#fecaca}
        .ai-btn:hover{transform:translateY(-1px)}
        .row-alt:nth-child(even){background:rgba(255,255,255,0.03)}
      `}</style>

      <div className="glass-card p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl md:text-2xl font-semibold soft-title">AI‑Based Inventory Generator</h2>
          <div className="text-xs md:text-sm text-white/60">Quickly draft items by brand or free‑text prompt. Edit before saving.</div>
        </div>

        {/* Prompt / brand builder */}
        <div className="mt-4">
          <AdvancedBrandInputForm onGenerate={handlePromptInventoryGeneration} />
        </div>

        {/* Results table */}
        {inventoryList.length > 0 && (
          <div className="mt-6 glass-card p-3 md:p-4 overflow-hidden">
            <div className="overflow-auto max-h-[52vh] rounded-lg">
              <table className="min-w-full text-sm ai-table">
                <thead>
                  <tr className="text-left text-white/80 border-b border-white/20">
                    <th className="px-3 py-3 w-[36%]">Item Details</th>
                    <th className="px-3 py-3">HSN</th>
                    <th className="px-3 py-3">GST %</th>
                    <th className="px-3 py-3">Pricing Mode</th>
                    <th className="px-3 py-3">Base</th>
                    <th className="px-3 py-3">MRP</th>
                    <th className="px-3 py-3">Qty</th>
                    <th className="px-3 py-3">Cost</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryList.map((item, idx) => (
                    <tr key={idx} className="row-alt border-t border-white/10">
                      {/* Item Details Cell */}
                      <td className="px-3 py-3">
                        <div className="space-y-1.5">
                          <input
                            value={item.productName ?? ""}
                            onChange={(e) => handleFieldChange(idx, "productName", e.target.value)}
                            className="ai-input w-full rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40 font-semibold"
                            placeholder="Product name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={item.brand ?? ""}
                              onChange={(e) => handleFieldChange(idx, "brand", e.target.value)}
                              className="ai-input w-full rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400/40"
                              placeholder="Brand"
                            />
                            <input
                              value={item.category ?? ""}
                              onChange={(e) => handleFieldChange(idx, "category", e.target.value)}
                              className="ai-input w-full rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400/40"
                              placeholder="Category"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={item.sku ?? ""}
                              onChange={(e) => handleFieldChange(idx, "sku", e.target.value)}
                              className="ai-input w-full rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400/40"
                              placeholder="SKU"
                            />
                            <input
                              value={item.unit ?? ""}
                              onChange={(e) => handleFieldChange(idx, "unit", e.target.value)}
                              className="ai-input w-full rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400/40"
                              placeholder="Unit"
                            />
                          </div>
                        </div>
                      </td>
                      {/* Other Editable Cells */}
                      <td className="px-2 py-3">
                        <input
                          value={item.hsnCode ?? ""}
                          onChange={(e) => handleFieldChange(idx, "hsnCode", e.target.value)}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                          placeholder="HSN"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <select
                          value={item.gstRate ?? item.taxRate ?? ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            handleFieldChange(idx, "gstRate", val);
                            handleFieldChange(idx, "taxRate", val);
                          }}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                        >
                          <option value="" className="bg-slate-900">—</option>
                          {GST_OPTIONS.map((g) => (
                            <option key={g} value={g} className="bg-slate-900">
                              {g}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <select
                          value={item.pricingMode ?? ""}
                          onChange={(e) => handleFieldChange(idx, "pricingMode", e.target.value)}
                          className="ai-input w-36 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                        >
                          <option value="" className="bg-slate-900">—</option>
                          {PRICING_OPTIONS.map((p) => (
                            <option key={p} value={p} className="bg-slate-900">
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.basePrice ?? ""}
                          onChange={(e) => handleFieldChange(idx, "basePrice", e.target.value)}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                          placeholder="Base"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.mrp ?? ""}
                          onChange={(e) => handleFieldChange(idx, "mrp", e.target.value)}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                          placeholder="MRP"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.quantity ?? ""}
                          onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                          placeholder="Qty"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.costPrice ?? ""}
                          onChange={(e) => handleFieldChange(idx, "costPrice", e.target.value)}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                          placeholder="Cost"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.sellingPrice ?? ""}
                          onChange={(e) => handleFieldChange(idx, "sellingPrice", e.target.value)}
                          className="ai-input w-20 rounded-md px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400/40"
                          placeholder="Price"
                        />
                      </td>
                      <td className="px-2 py-3 text-center whitespace-nowrap">
                        <button
                          className="ai-btn ai-btn-danger hover:brightness-110"
                          title="Remove row"
                          onClick={() => {
                            const updated = [...inventoryList];
                            updated.splice(idx, 1);
                            setInventoryList(updated);
                          }}
                        >
                          ✕ Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToInventory}
                disabled={isLoading}
                className="ai-btn ai-btn-primary font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Saving…" : "➕ Add to Inventory"}
              </button>
              <button
                onClick={() => setInventoryList([])}
                disabled={isLoading}
                className="ai-btn ai-btn-ghost disabled:opacity-60"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAutogenForm;