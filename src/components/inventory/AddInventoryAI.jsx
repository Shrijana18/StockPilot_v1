import React, { useState } from "react";
import { toast } from "react-toastify";
import { app } from "../../firebase/firebaseConfig.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { logInventoryChange } from "../../utils/logInventoryChange";

import AdvancedBrandInputForm from "./AdvancedBrandInputForm";

const AddInventoryAI = ({ userId }) => {
  const [businessDescription, setBusinessDescription] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const db = getFirestore(app);

  // Prompt-based inventory generation handler for AdvancedBrandInputForm
  const handlePromptInventoryGeneration = async (promptText) => {
    if (!promptText || promptText.trim().length === 0) {
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
            sellingPrice: item.price || "",
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
          ...item,
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
            sellingPrice: item.price || "",
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
    <div className="p-6 max-w-6xl mx-auto text-white">
      <h2 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">AI-Based Inventory Generator</h2>

      <AdvancedBrandInputForm onGenerate={handlePromptInventoryGeneration} />

      {inventoryList.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full mt-6 text-sm border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-white/10 text-white/80">
                <th className="px-3 py-2 border-b border-white/10">Name</th>
                <th className="px-3 py-2 border-b border-white/10">Brand</th>
                <th className="px-3 py-2 border-b border-white/10">Category</th>
                <th className="px-3 py-2 border-b border-white/10">SKU</th>
                <th className="px-3 py-2 border-b border-white/10">Unit</th>
                <th className="px-3 py-2 border-b border-white/10">Qty</th>
                <th className="px-3 py-2 border-b border-white/10">Cost</th>
                <th className="px-3 py-2 border-b border-white/10">Price</th>
                <th className="px-3 py-2 border-b border-white/10">Action</th>
              </tr>
            </thead>
            <tbody>
              {inventoryList.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/5 border-t border-white/10">
                  <td className="border px-2 py-1">
                    <input
                      value={item.productName ?? "(productName)"}
                      onChange={(e) => handleFieldChange(idx, "productName", e.target.value)}
                      className="w-full rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </td>
                  <td className="border px-2 py-1">
                    <input
                      value={item.brand ?? "(brand)"}
                      onChange={(e) => handleFieldChange(idx, "brand", e.target.value)}
                      className="w-full rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </td>
                  {["category", "sku", "unit", "quantity", "costPrice", "sellingPrice"].map((field) => (
                    <td key={field} className="border px-2 py-1">
                      <input
                        value={item[field] ?? `(${field})`}
                        onChange={(e) => handleFieldChange(idx, field, e.target.value)}
                        className="w-full rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 border text-center">
                    <button
                      className="text-rose-300 hover:text-rose-200 font-bold"
                      onClick={() => {
                        const updated = [...inventoryList];
                        updated.splice(idx, 1);
                        setInventoryList(updated);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-4">
            <button
              onClick={handleAddToInventory}
              className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
            >
              ➕ Add to Inventory
            </button>

            <button
              onClick={() => setInventoryList([])}
              className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddInventoryAI;