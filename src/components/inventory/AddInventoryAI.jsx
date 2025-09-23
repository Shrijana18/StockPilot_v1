import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { app } from "../../firebase/firebaseConfig.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { logInventoryChange } from "../../utils/logInventoryChange";

import AdvancedBrandInputForm from "./AdvancedBrandInputForm";

// --- UI helpers: typing dots & progress timeline ---
const TypingDots = () => (
  <span className="inline-flex gap-1 align-baseline ml-2">
    {[0,1,2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
        style={{ animationDelay: `${i*120}ms` }}
      />
    ))}
  </span>
);

const ProgressTimeline = ({ step }) => {
  const steps = useMemo(() => ([
    "Understanding brand",
    "Finding SKUs",
    "Pricing",
    "Taxes & HSN",
    "Building items"
  ]), []);
  return (
    <div className="w-full max-w-3xl mx-auto mb-6">
      <div className="flex items-center justify-between text-xs text-white/70 mb-2">
        {steps.map((s, idx) => (
          <span key={idx} className={`${idx === step ? "text-emerald-300" : ""}`}>{s}</span>
        ))}
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded">
        <div
          className="h-1.5 rounded bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all"
          style={{ width: `${((step+1)/steps.length)*100}%` }}
        />
      </div>
    </div>
  );
};

// --- Animated AI overlay (bars + sparkles + sweep) ---
const AILoaderOverlay = ({ message = "Creating inventory…", step = 0 }) => (
  <div className="fixed inset-0 z-[70] overflow-hidden pointer-events-none">
    {/* Backdrop that blurs and darkens the whole viewport */}
    <div className="absolute inset-0 bg-black/55 backdrop-blur-xl backdrop-saturate-150" />

    {/* Subtle vignette */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,.18),transparent_60%)]" />

    {/* Centered loader content */}
    <div className="relative h-full w-full flex flex-col items-center justify-center">
      {/* animated bars */}
      <div className="relative w-72 h-24 mb-6">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 w-2 rounded-t bg-cyan-300/80 animate-[bar_1.6s_ease-in-out_infinite]"
            style={{
              left: `${i * 12}px`,
              height: `${10 + (i % 5) * 12}px`,
              animationDelay: `${i * 55}ms`,
            }}
          />
        ))}
      </div>

      {/* message */}
      <div className="text-cyan-200/95 font-semibold tracking-wide text-lg drop-shadow">
        {message} <TypingDots />
      </div>

      {/* timeline */}
      <div className="mt-4 w-full max-w-xl px-6">
        <div className="flex items-center justify-between text-xs text-white/70 mb-2">
          {["Understanding brand","Finding SKUs","Pricing","Taxes & HSN","Building items"].map((s, idx) => (
            <span key={idx} className={`${idx <= step ? "text-emerald-300" : ""}`}>{s}</span>
          ))}
        </div>
        <div className="h-1.5 w-full bg-white/15 rounded">
          <div
            className="h-1.5 rounded bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all"
            style={{ width: `${((step+1)/5)*100}%` }}
          />
        </div>
      </div>

      {/* lightweight sparkles (kept minimal for performance) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => {
          const left = 5 + i * 9;
          const delay = i * 180;
          const size = 2 + (i % 3);
          const duration = 1800 + (i % 5) * 140;
          const top = 70 + (i % 4) * 4;
          return (
            <span
              key={i}
              className="ai-sparkle"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: size,
                height: size,
                animation: `sparkleRise ${duration}ms ${delay}ms linear infinite`
              }}
            />
          );
        })}
      </div>
    </div>

    <style>{`@keyframes bar { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }`}</style>
  </div>
);

const AddInventoryAI = ({ userId }) => {
  const [businessDescription, setBusinessDescription] = useState("");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [progressStep, setProgressStep] = useState(0);
  const [showBurst, setShowBurst] = useState(false);

  const db = getFirestore(app);

  useEffect(() => {
    if (!isLoading) return;
    setProgressStep(0);
    const id = setInterval(() => {
      setProgressStep((s) => (s + 1) % 5);
    }, 900);
    return () => clearInterval(id);
  }, [isLoading]);

  // ---- Helpers to call CF + normalize different response shapes (Gemini/OpenAI) ----
  const CF_URL = "https://us-central1-stockpilotv1.cloudfunctions.net/generateInventoryByBrand";

  const normalizeItems = (data) => {
    // Prefer the canonical shape { inventory: [...] }
    let items =
      data?.inventory ||
      data?.items ||
      data?.result?.inventory ||
      data?.result?.items ||
      [];

    if (!Array.isArray(items)) items = [];
    // Map to UI shape and tolerate different key casings
    return items
      .filter((it) => (it?.productName || it?.name) && (it?.sku || it?.SKU))
      .map((it) => {
        const productName = it.productName || it.name || "";
        const brand = it.brand || "";
        const category = it.category || "Food";
        const sku = it.sku || it.SKU || "";
        const unit = it.unit || it.Unit || "";
        const price = it.price ?? it.mrp ?? it.sellingPrice ?? "";
        const hsnCode = it.hsnCode || it.hsn || it.HSN || "";
        const gstRate = it.gstRate ?? it.gst ?? it.GST ?? "";
        const pricingMode = it.pricingMode || it.PricingMode || "";
        const basePrice = it.basePrice ?? "";
        const mrp = it.mrp ?? "";
        const costPrice = it.costPrice ?? "";

        return {
          productName,
          brand,
          category,
          sku,
          unit,
          quantity: it.quantity ?? "",
          costPrice,
          sellingPrice: price,
          imageUrl: it.imageUrl || "",
          hsnCode,
          gstRate,
          pricingMode,
          basePrice,
          mrp,
          source: it.source || "ai",
        };
      });
  };

  const callGenerateAPI = async (payload) => {
    const res = await fetch(CF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Try to parse JSON even on non-2xx to surface backend error details
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = data?.error || `Request failed with ${res.status}`;
      throw new Error(msg);
    }
    return data;
  };

  // Prompt-based inventory generation handler for AdvancedBrandInputForm
  const handlePromptInventoryGeneration = async (payload) => {
    // payload is expected to be an object from AdvancedBrandInputForm, containing at least a 'prompt' field
    const prompt = payload?.prompt;
    if (!prompt || prompt.trim().length === 0) {
      toast.error("Prompt is empty.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await callGenerateAPI(payload);
      const responses = normalizeItems(data);
      setInventoryList(responses);
      if (responses.length === 0) {
        toast.info("No inventory returned. Try adjusting prompt.");
      }
    } catch (error) {
      console.error("Prompt-based inventory error:", error);
      toast.error(`Failed to fetch inventory: ${error.message}`);
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
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1200);
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
        try {
          const data = await callGenerateAPI({ brand });
          const items = normalizeItems(data);
          responses.push(...items);
        } catch (e) {
          console.error(`Error generating inventory for brand "${brand}":`, e);
          // Continue with other brands instead of failing the whole batch
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
  /* --- constrained inputs for safer editing --- */
  const GST_OPTIONS = [0, 5, 12, 18, 28];
  const PRICING_OPTIONS = ["MRP_INCLUSIVE", "BASE_PLUS_GST"];

  return (
    <div
      className={`relative p-6 max-w-6xl mx-auto text-white rounded-3xl shadow-2xl overflow-hidden clean-ai-bg ${isLoading ? 'ai-loading' : ''}`}
    >
      {/* Floating background stickers/messages - visual enhancement */}
      {!isLoading && (
        <div className="absolute inset-0 pointer-events-none select-none z-0">
          <div
            className="ai-floating-sticker"
            style={{
              left: "6%",
              top: "18%",
              fontSize: "2.4rem",
              opacity: 0.08,
              color: "#fff",
              filter: "blur(0.5px)",
              fontWeight: 700,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="inline-block align-middle mr-2" aria-hidden focusable="false">
              <ellipse cx="24" cy="24" rx="20" ry="14" fill="#38bdf8" fillOpacity="0.18"/>
              <ellipse cx="24" cy="24" rx="13" ry="8" fill="#a21caf" fillOpacity="0.11"/>
              <ellipse cx="24" cy="24" rx="8" ry="5" fill="#22d3ee" fillOpacity="0.14"/>
              <circle cx="24" cy="24" r="6" fill="#fff" fillOpacity="0.17"/>
              <ellipse cx="19" cy="21" rx="1.5" ry="2" fill="#fff" fillOpacity="0.35"/>
              <ellipse cx="29" cy="21" rx="1.5" ry="2" fill="#fff" fillOpacity="0.35"/>
            </svg>
            AI understands your brand
          </div>
          <div
            className="ai-floating-sticker"
            style={{
              right: "8%",
              top: "37%",
              fontSize: "2.1rem",
              opacity: 0.08,
              color: "#fff",
              fontWeight: 700,
              textShadow: "0 2px 12px #22d3ee88",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="inline-block align-middle mr-2" aria-hidden focusable="false">
              <g opacity="0.19">
                <circle cx="17" cy="17" r="16" stroke="#38bdf8" strokeWidth="2"/>
                <path d="M13 17a4 4 0 1 1 8 0" stroke="#f472b6" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="13" cy="17" r="1.2" fill="#f472b6"/>
                <circle cx="21" cy="17" r="1.2" fill="#f472b6"/>
              </g>
            </svg>
            Suggests HSN &amp; GST
          </div>
          <div
            className="ai-floating-sticker"
            style={{
              left: "52%",
              bottom: "11%",
              fontSize: "2.2rem",
              opacity: 0.08,
              color: "#fff",
              fontWeight: 700,
              textShadow: "0 2px 16px #38bdf8",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none" className="inline-block align-middle mr-2" aria-hidden focusable="false">
              <g opacity="0.17">
                <rect x="9" y="9" width="20" height="20" rx="4" fill="#e0e7ff"/>
                <rect x="13" y="13" width="12" height="12" rx="2" fill="#38bdf8"/>
                <circle cx="19" cy="19" r="2.5" fill="#fff"/>
              </g>
            </svg>
            Finds SKUs
          </div>
        </div>
      )}

      {isLoading && <AILoaderOverlay message="Creating inventory" step={progressStep} />}

      <div className={`relative z-10 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex justify-center mb-6">
          <div className="relative inline-flex items-center gap-2">
            {/* Magical animated AI icon */}
            <span className="ai-orb" aria-hidden />
            <div className="px-6 py-2 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 rounded-full shadow-[0_0_10px_#8de5ff] text-slate-900 font-semibold text-lg select-none">
              ⚡ AI Inventory Generator Active
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center mb-4 text-white/80">
            <span>Thinking up your inventory</span>
            <TypingDots />
          </div>
        )}

        <h2 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 drop-shadow-[0_0_10px_rgba(131,204,255,0.7)] select-none">
          AI-Based Inventory Generator
        </h2>

        {isLoading && <ProgressTimeline step={progressStep} />}

        <div className="mb-10 max-w-3xl mx-auto p-6 bg-gradient-to-tr from-indigo-900/70 via-purple-900/60 to-blue-900/70 rounded-2xl shadow-lg shadow-cyan-700/60 hover:shadow-cyan-500/90 transform hover:scale-[1.02] transition-transform duration-300">
          <div className="p-4 bg-[#0e1e3e] rounded-xl shadow-[0_0_30px_#3bc9dbaa]">
            <AdvancedBrandInputForm onGenerate={handlePromptInventoryGeneration} />
          </div>
        </div>

        {inventoryList.length > 0 && (
          <div className="overflow-x-auto p-6 rounded-3xl bg-gradient-to-tr from-indigo-900/40 via-purple-900/30 to-blue-900/40 border-2 border-gradient-to-r border-cyan-400/60 shadow-lg shadow-cyan-700/50 backdrop-blur-md">
            <table className="min-w-full mt-6 text-sm border border-white/20 bg-white/5 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-white/10 text-white/80 select-none sticky top-0 z-10 backdrop-blur-md">
                  <th className="px-3 py-2 border-b border-white/20 text-left w-[38%]">Item</th>
                  <th className="px-3 py-2 border-b border-white/20 text-left w-[19%]">Tax &amp; Mode</th>
                  <th className="px-3 py-2 border-b border-white/20 text-left w-[31%]">Pricing</th>
                  <th className="px-3 py-2 border-b border-white/20 text-center w-[12%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {inventoryList.map((item, idx) => (
                  <tr
                    key={idx}
                    className="align-top hover:bg-gradient-to-r hover:from-cyan-700/30 hover:via-blue-700/20 hover:to-purple-700/20 border-t border-white/20 transition-colors duration-300"
                  >
                    {/* Item column: stacked */}
                    <td className="border px-3 py-2 align-top">
                      <div className="space-y-1">
                        <input
                          value={item.productName ?? ""}
                          onChange={(e) => handleFieldChange(idx, "productName", e.target.value)}
                          className="w-full text-[15px] font-semibold rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                          placeholder="Product name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={item.brand ?? ""}
                            onChange={(e) => handleFieldChange(idx, "brand", e.target.value)}
                            className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Brand"
                          />
                          <input
                            value={item.category ?? ""}
                            onChange={(e) => handleFieldChange(idx, "category", e.target.value)}
                            className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Category"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={item.sku ?? ""}
                            onChange={(e) => handleFieldChange(idx, "sku", e.target.value)}
                            className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="SKU"
                          />
                          <input
                            value={item.unit ?? ""}
                            onChange={(e) => handleFieldChange(idx, "unit", e.target.value)}
                            className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Unit"
                          />
                        </div>
                      </div>
                    </td>
                    {/* Tax & Mode column: HSN, GST, Pricing Mode */}
                    <td className="border px-2 py-2 align-top">
                      <div className="grid grid-cols-3 gap-2">
                        {/* HSN */}
                        <input
                          value={item.hsnCode ?? ""}
                          onChange={(e) => handleFieldChange(idx, "hsnCode", e.target.value)}
                          className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                          placeholder="HSN"
                        />
                        {/* GST dropdown */}
                        <select
                          value={item.gstRate ?? ""}
                          onChange={(e) => handleFieldChange(idx, "gstRate", Number(e.target.value))}
                          className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                        >
                          <option value="" className="bg-slate-900">GST</option>
                          {GST_OPTIONS.map((g) => (
                            <option key={g} value={g} className="bg-slate-900">{g}</option>
                          ))}
                        </select>
                        {/* Pricing Mode */}
                        <select
                          value={item.pricingMode ?? ""}
                          onChange={(e) => handleFieldChange(idx, "pricingMode", e.target.value)}
                          className="w-full rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                        >
                          <option value="" className="bg-slate-900">Mode</option>
                          {PRICING_OPTIONS.map((p) => (
                            <option key={p} value={p} className="bg-slate-900">{p}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    {/* Pricing column: Base, MRP, Qty, Cost, Price */}
                    <td className="border px-2 py-2 align-top">
                      <div className="grid grid-cols-5 gap-2">
                        {/* Base */}
                        <div className="flex flex-col items-start">
                          <label className="text-[11px] text-white/60 mb-0.5 ml-0.5">Base</label>
                          <input
                            value={item.basePrice ?? ""}
                            onChange={(e) => handleFieldChange(idx, "basePrice", e.target.value)}
                            className="w-16 rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Base"
                          />
                        </div>
                        {/* MRP */}
                        <div className="flex flex-col items-start">
                          <label className="text-[11px] text-white/60 mb-0.5 ml-0.5">MRP</label>
                          <input
                            value={item.mrp ?? ""}
                            onChange={(e) => handleFieldChange(idx, "mrp", e.target.value)}
                            className="w-16 rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="MRP"
                          />
                        </div>
                        {/* Qty */}
                        <div className="flex flex-col items-start">
                          <label className="text-[11px] text-white/60 mb-0.5 ml-0.5">Qty</label>
                          <input
                            value={item.quantity ?? ""}
                            onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                            className="w-12 rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Qty"
                          />
                        </div>
                        {/* Cost */}
                        <div className="flex flex-col items-start">
                          <label className="text-[11px] text-white/60 mb-0.5 ml-0.5">Cost</label>
                          <input
                            value={item.costPrice ?? ""}
                            onChange={(e) => handleFieldChange(idx, "costPrice", e.target.value)}
                            className="w-16 rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Cost"
                          />
                        </div>
                        {/* Price */}
                        <div className="flex flex-col items-start">
                          <label className="text-[11px] text-white/60 mb-0.5 ml-0.5">Price</label>
                          <input
                            value={item.sellingPrice ?? ""}
                            onChange={(e) => handleFieldChange(idx, "sellingPrice", e.target.value)}
                            className="w-16 rounded px-2 py-1 bg-transparent border border-white/10 focus:border-cyan-400 text-white placeholder-white/60 focus:outline-none"
                            placeholder="Price"
                          />
                        </div>
                      </div>
                    </td>
                    {/* Action column */}
                    <td className="px-2 py-2 border text-center align-top">
                      <button
                        className="text-rose-400 hover:text-rose-300 font-bold transition-colors duration-300"
                        onClick={() => {
                          const updated = [...inventoryList];
                          updated.splice(idx, 1);
                          setInventoryList(updated);
                        }}
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex gap-6 justify-center">
              <button
                onClick={handleAddToInventory}
                className="px-6 py-3 rounded-2xl font-semibold text-slate-900 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 shadow-[0_0_15px_#60e0ff] hover:shadow-[0_0_25px_#60e0ff] animate-pulse transition-shadow duration-500"
              >
                ➕ Add to Inventory
              </button>

              <button
                onClick={() => setInventoryList([])}
                className="px-6 py-3 rounded-2xl border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-colors duration-300"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      {/* content wrapper end */}
      </div>

      {showBurst && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          {Array.from({ length: 28 }).map((_, i) => {
            const left = Math.random()*100;
            const duration = 700 + Math.random()*600;
            const size = 6 + Math.random()*6;
            const delay = Math.random()*150;
            const translateY = 120 + Math.random()*160;
            const hue = Math.floor(Math.random()*360);
            return (
              <span
                key={i}
                className="absolute top-1/3"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size,
                  background: `hsl(${hue} 90% 60%)`,
                  borderRadius: 2,
                  transform: `translateY(${translateY}px)`,
                  opacity: 0,
                  animation: `confetti-fall ${duration}ms ${delay}ms forwards`,
                }}
              />
            );
          })}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0); opacity: 1; }
              100% { transform: translateY(140px); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <style>{`
/* Animated, clean AI background */
.clean-ai-bg {
  background:
    linear-gradient(120deg, #0b1220 0%, #181e2e 60%, #101826 100%),
    radial-gradient(ellipse 600px 300px at 18% 0%, rgba(16,185,129,0.16), transparent 70%),
    radial-gradient(ellipse 600px 400px at 110% 115%, rgba(59,130,246,0.13), transparent 70%),
    conic-gradient(from 180deg at 60% 40%, #a21caf22 0deg, #38bdf822 90deg, #f472b622 180deg, #38bdf822 270deg, #a21caf22 360deg);
  position: relative; isolation: isolate;
  overflow: hidden;
}
  .ai-loading.clean-ai-bg { animation: hueShift 40s linear infinite; }
  .ai-loading .ai-floating-sticker { opacity: 0 !important; }
@keyframes hueShift { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }

.clean-ai-bg:after {
  content: "";
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 120px rgba(0,0,0,.45);
}

/* Magical header orb (lightweight) */
.ai-orb {
  width:16px;height:16px;margin-right:10px;border-radius:9999px;display:inline-block;
  background: radial-gradient(circle at 30% 30%, #fff 0 25%, #67e8f9 45%, #22d3ee 70%, transparent 72%);
  box-shadow:0 0 12px #22d3ee,0 0 24px rgba(103,232,249,.35);
  transform:translateZ(0);will-change:filter,transform;
  animation:orbBreath 2.8s ease-in-out infinite;
}
@keyframes orbBreath { 0%,100%{filter:saturate(120%) brightness(1)} 50%{filter:saturate(160%) brightness(1.15)} }
@media (prefers-reduced-motion: reduce) { .ai-orb { animation:none } }

/* Floating stickers/messages - animated, faint, not interactive */
  .ai-floating-sticker {
    position: absolute;
    z-index: 1;
    opacity: 0.08;
    pointer-events: none;
    user-select: none;
    font-family: inherit;
    font-weight: 700;
    white-space: nowrap;
    animation: aiFloatY 14s ease-in-out infinite, aiFloatRotate 22s linear infinite;
    will-change: transform, opacity;
    mix-blend-mode: luminosity;
  }
.ai-floating-sticker:nth-child(1) { animation-delay: 0s, 0s; }
.ai-floating-sticker:nth-child(2) { animation-delay: 2.2s, 3s; }
.ai-floating-sticker:nth-child(3) { animation-delay: 5.5s, 7s; }
@keyframes aiFloatY {
  0% { transform: translateY(0px) scale(1); }
  20% { transform: translateY(-8px) scale(1.02);}
  40% { transform: translateY(6px) scale(0.98);}
  60% { transform: translateY(-7px) scale(1.03);}
  80% { transform: translateY(5px) scale(0.97);}
  100% { transform: translateY(0px) scale(1);}
}
@keyframes aiFloatRotate { 0% { transform: rotate(-2deg);} 100% { transform: rotate(2deg);} }

/* Overlay sparkles & sweep */
  .ai-sparkle {
    position:absolute;
    background:radial-gradient(circle,#fff 0 35%, rgba(125,211,252,.9) 60%, transparent 70%);
    border-radius:9999px;
    opacity:.9;
    filter:drop-shadow(0 0 6px #67e8f9);
  }
  /* Ensure sweep uses GPU and stays above content */
  .ai-sweep { will-change: transform; z-index: 1; }
@keyframes sparkleRise {
  0% { transform: translateY(0) scale(.9); opacity:.9; }
  100% { transform: translateY(-80px) scale(1.1); opacity:0; }
}
.ai-sweep {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.04), transparent);
  transform: translateX(-100%);
  animation: sweepAcross 2200ms ease-in-out infinite;
}
@keyframes sweepAcross {
  0%,100% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
}

/* Confetti fallback already defined above */
      `}</style>
    </div>
  );
};

export default AddInventoryAI;