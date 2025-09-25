import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { app } from "../../firebase/firebaseConfig.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { logInventoryChange } from "../../utils/logInventoryChange";

import AdvancedBrandInputForm from "./AdvancedBrandInputForm";

// --- UI helpers: typing dots ---
const TypingDots = () => (
  <span className="inline-flex items-center gap-1 align-baseline ml-2">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
        style={{ animationDelay: `${i * 120}ms`, animationDuration: '1.2s' }}
      />
    ))}
  </span>
);

// --- Enhanced, animated AI overlay ---
const AILoaderOverlay = ({ message = "Creating inventory…", step = 0, className = "" }) => (
  <div className={`fixed inset-0 z-[70] overflow-hidden ${className}`}>
    {/* Backdrop that blurs and darkens the whole viewport */}
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xl" />

    {/* Animated Grid Background */}
    <div className="absolute inset-0 ai-grid-pattern" />

    {/* Subtle vignette */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,.15),transparent_60%)]" />

    {/* Centered loader content */}
    <div className="relative h-full w-full flex flex-col items-center justify-center text-center">
      
      {/* Animated Glowing Orb */}
      <div className="relative w-48 h-48 mb-6 flex items-center justify-center">
        {Array.from({ length: 4 }).map((_, i) => (
           <div
             key={i}
             className="absolute rounded-full border-2 border-cyan-300/30 animate-pulse-orb"
             style={{
               inset: `${i * 20}px`,
               animationDelay: `${i * 200}ms`,
               animationDuration: '2s'
             }}
           />
        ))}
        <svg className="absolute w-16 h-16 text-cyan-300 animate-spin-slow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      {/* message */}
      <div className="text-cyan-200/95 font-semibold tracking-wide text-xl drop-shadow">
        {message} <TypingDots />
      </div>

      {/* timeline */}
      <div className="mt-8 w-full max-w-xl px-6">
        <div className="flex items-center justify-between text-xs text-white/70 mb-2">
          {["Understanding brand", "Finding SKUs", "Pricing", "Taxes & HSN", "Building items"].map((s, idx) => (
            <span key={idx} className={`transition-colors duration-500 ${idx <= step ? "text-emerald-300 font-medium" : ""}`}>{s}</span>
          ))}
        </div>
        <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 transition-all duration-500 ease-out"
            style={{ width: `${((step + 1) / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  </div>
);


const AddInventoryAI = ({ userId }) => {
  // --- STATE MANAGEMENT ---
  const [businessDescription, setBusinessDescription] = useState("");
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isShowingLoader, setIsShowingLoader] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [showBurst, setShowBurst] = useState(false);

  const db = getFirestore(app);

  // --- LIFECYCLE & ANIMATION HOOKS ---

  // Effect to smoothly transition the loader in and out
  useEffect(() => {
    if (isLoading) {
      setIsShowingLoader(true);
    } else {
      const timer = setTimeout(() => setIsShowingLoader(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Effect to cycle through progress steps during loading
  useEffect(() => {
    if (!isLoading) return;
    setProgressStep(0);
    const id = setInterval(() => {
      setProgressStep((s) => (s + 1) % 5);
    }, 900);
    return () => clearInterval(id);
  }, [isLoading]);


  // --- API & DATA HANDLING ---
  const CF_URL = "https://us-central1-stockpilotv1.cloudfunctions.net/generateInventoryByBrand";

  const normalizeItems = (data) => {
    let items = data?.inventory || data?.items || data?.result?.inventory || data?.result?.items || [];
    if (!Array.isArray(items)) items = [];

    return items
      .filter((it) => (it?.productName || it?.name) && (it?.sku || it?.SKU))
      .map((it) => ({
        productName: it.productName || it.name || "",
        brand: it.brand || "",
        category: it.category || "General",
        sku: it.sku || it.SKU || "",
        unit: it.unit || it.Unit || "",
        quantity: it.quantity ?? "",
        costPrice: it.costPrice ?? "",
        sellingPrice: it.price ?? it.mrp ?? it.sellingPrice ?? "",
        imageUrl: it.imageUrl || "",
        hsnCode: it.hsnCode || it.hsn || it.HSN || "",
        gstRate: it.gstRate ?? it.gst ?? it.GST ?? "",
        pricingMode: it.pricingMode || it.PricingMode || "MRP_INCLUSIVE",
        basePrice: it.basePrice ?? "",
        mrp: it.mrp ?? "",
        source: it.source || "ai",
      }));
  };

  const callGenerateAPI = async (payload) => {
    const res = await fetch(CF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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

  const handlePromptInventoryGeneration = async (payload) => {
    const prompt = payload?.prompt;
    if (!prompt || prompt.trim().length === 0) {
      toast.error("Prompt cannot be empty.");
      return;
    }

    setIsLoading(true);
    setInventoryList([]); // Clear previous results
    try {
      const data = await callGenerateAPI(payload);
      const responses = normalizeItems(data);
      setInventoryList(responses);
      if (responses.length === 0) {
        toast.info("AI couldn't generate items. Try rephrasing your prompt.");
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
      toast.error("There is no inventory to upload.");
      return;
    }

    const toastId = toast.loading("Adding items to inventory...");
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
      
      toast.update(toastId, { render: "Inventory added successfully!", type: "success", isLoading: false, autoClose: 5000 });
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 2000);
      setInventoryList([]);
    } catch (err) {
      console.error("Upload Error:", err);
      toast.update(toastId, { render: "Failed to add inventory.", type: "error", isLoading: false, autoClose: 5000 });
    }
  };
  
  const handleFieldChange = (index, field, value) => {
    const updatedList = [...inventoryList];
    updatedList[index][field] = value;
    setInventoryList(updatedList);
  };
  
  const handleRemoveItem = (index) => {
    setInventoryList(prevList => prevList.filter((_, i) => i !== index));
  }

  // --- RENDER CONSTANTS ---
  const GST_OPTIONS = [0, 5, 12, 18, 28];
  const PRICING_OPTIONS = ["MRP_INCLUSIVE", "BASE_PLUS_GST"];

  return (
    <div className="relative p-4 sm:p-6 max-w-7xl mx-auto text-white rounded-3xl shadow-2xl overflow-hidden clean-ai-bg isolate animate-fade-in-up">
      
      {/* Conditionally render the loader with smooth transitions */}
      {isShowingLoader && (
        <AILoaderOverlay 
            message="Crafting your inventory" 
            step={progressStep}
            className={isLoading ? 'animate-fade-in' : 'animate-fade-out'}
        />
      )}

      {/* Main content area */}
      <div className={`relative z-10 transition-opacity duration-300 ${isLoading ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
        
        <header className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-900/50 border border-cyan-400/20 rounded-full shadow-lg shadow-cyan-500/10 mb-4">
                <span className="ai-orb" aria-hidden />
                <span className="font-semibold text-cyan-300">AI Generator Active</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400">
                AI-Powered Inventory
            </h1>
        </header>

        {/* Input Form Section */}
        <div className="mb-10 max-w-3xl mx-auto p-1 bg-gradient-to-br from-cyan-400/50 via-purple-500/50 to-pink-500/50 rounded-2xl shadow-lg shadow-cyan-700/20 transition-all duration-300 hover:shadow-cyan-500/40 hover:scale-[1.01] input-glow-container">
          <div className="p-6 bg-[#0e1e3e] rounded-xl">
            <AdvancedBrandInputForm onGenerate={handlePromptInventoryGeneration} isLoading={isLoading} />
          </div>
        </div>

        {/* Results Table Section */}
        {inventoryList.length > 0 && (
          <div className="animate-fade-in-up" style={{animationDuration: '0.5s'}}>
            <div className="overflow-x-auto p-4 sm:p-6 rounded-2xl bg-slate-900/50 border border-white/10 shadow-xl shadow-black/20 backdrop-blur-lg">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/20 text-white/80 select-none">
                    <th className="px-3 py-3 text-left w-[36%]">Item Details</th>
                    <th className="px-3 py-3 text-left">HSN</th>
                    <th className="px-3 py-3 text-left">GST %</th>
                    <th className="px-3 py-3 text-left">Pricing Mode</th>
                    <th className="px-3 py-3 text-left">Base</th>
                    <th className="px-3 py-3 text-left">MRP</th>
                    <th className="px-3 py-3 text-left">Qty</th>
                    <th className="px-3 py-3 text-left">Cost</th>
                    <th className="px-3 py-3 text-left">Price</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryList.map((item, idx) => (
                    <tr
                      key={item.sku + idx}
                      className="align-top border-t border-white/10 transition-colors duration-300 hover:bg-cyan-500/10 animate-slide-in-up"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      {/* Item Details Cell */}
                      <td className="px-3 py-3">
                        <div className="space-y-1.5">
                          <input
                            value={item.productName ?? ""}
                            onChange={(e) => handleFieldChange(idx, "productName", e.target.value)}
                            className="editable-input font-semibold text-base text-white"
                            placeholder="Product name"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={item.brand ?? ""} onChange={(e) => handleFieldChange(idx, "brand", e.target.value)} className="editable-input" placeholder="Brand" />
                            <input value={item.category ?? ""} onChange={(e) => handleFieldChange(idx, "category", e.target.value)} className="editable-input" placeholder="Category" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={item.sku ?? ""} onChange={(e) => handleFieldChange(idx, "sku", e.target.value)} className="editable-input" placeholder="SKU" />
                            <input value={item.unit ?? ""} onChange={(e) => handleFieldChange(idx, "unit", e.target.value)} className="editable-input" placeholder="Unit" />
                          </div>
                        </div>
                      </td>

                      {/* Other Editable Cells */}
                      <td className="px-2 py-3"><input value={item.hsnCode ?? ""} onChange={(e) => handleFieldChange(idx, "hsnCode", e.target.value)} className="editable-input w-20" placeholder="HSN" /></td>
                      <td className="px-2 py-3">
                        <select value={item.gstRate ?? ""} onChange={(e) => handleFieldChange(idx, "gstRate", Number(e.target.value))} className="editable-input w-20">
                          <option value="" className="bg-slate-900">—</option>
                          {GST_OPTIONS.map((g) => (<option key={g} value={g} className="bg-slate-900">{g}</option>))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <select value={item.pricingMode ?? ""} onChange={(e) => handleFieldChange(idx, "pricingMode", e.target.value)} className="editable-input w-36">
                          <option value="" className="bg-slate-900">—</option>
                          {PRICING_OPTIONS.map((p) => (<option key={p} value={p} className="bg-slate-900">{p}</option>))}
                        </select>
                      </td>
                      <td className="px-2 py-3"><input type="number" value={item.basePrice ?? ""} onChange={(e) => handleFieldChange(idx, "basePrice", e.target.value)} className="editable-input w-20" placeholder="Base" /></td>
                      <td className="px-2 py-3"><input type="number" value={item.mrp ?? ""} onChange={(e) => handleFieldChange(idx, "mrp", e.target.value)} className="editable-input w-20" placeholder="MRP" /></td>
                      <td className="px-2 py-3"><input type="number" value={item.quantity ?? ""} onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)} className="editable-input w-20" placeholder="Qty" /></td>
                      <td className="px-2 py-3"><input type="number" value={item.costPrice ?? ""} onChange={(e) => handleFieldChange(idx, "costPrice", e.target.value)} className="editable-input w-20" placeholder="Cost" /></td>
                      <td className="px-2 py-3"><input type="number" value={item.sellingPrice ?? ""} onChange={(e) => handleFieldChange(idx, "sellingPrice", e.target.value)} className="editable-input w-20" placeholder="Price" /></td>
                      
                      {/* Action Cell */}
                      <td className="px-2 py-3 text-center">
                        <button
                          className="w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-full transition-all duration-300"
                          onClick={() => handleRemoveItem(idx)}
                          aria-label="Remove item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleAddToInventory}
                  className="px-8 py-3 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-cyan-300 to-purple-400 button-glow-effect"
                >
                  Add All to Inventory
                </button>
                <button
                  onClick={() => setInventoryList([])}
                  className="px-8 py-3 rounded-xl border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white backdrop-blur-md transition-all duration-300"
                >
                  Clear List
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Confetti Burst */}
      {showBurst && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          {Array.from({ length: 40 }).map((_, i) => {
            const size = Math.random() * 8 + 4;
            const hue = 150 + Math.random() * 60;
            return (
              <span
                key={i}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-confetti-burst"
                style={{
                  width: size,
                  height: size,
                  background: `hsl(${hue}, 90%, 65%)`,
                  '--angle': `${Math.random() * 360}deg`,
                  '--distance': `${Math.random() * 150 + 50}px`,
                  animationDuration: `${Math.random() * 0.5 + 0.5}s`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* --- STYLES & ANIMATIONS --- */}
      <style>{`
        /* Enhanced AI background */
        .clean-ai-bg {
          background-color: #0b1220;
          background-image:
            radial-gradient(ellipse 50% 40% at 20% 0%, rgba(16,185,129,0.12), transparent),
            radial-gradient(ellipse 50% 40% at 80% 100%, rgba(59,130,246,0.12), transparent);
        }

        /* Animated grid pattern for loader */
        .ai-grid-pattern {
            background-image: 
                linear-gradient(rgba(20, 83, 45, 0.2) 1px, transparent 1px), 
                linear-gradient(90deg, rgba(20, 83, 45, 0.2) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: pan-grid 20s linear infinite;
        }

        /* Magical header orb */
        .ai-orb {
            width:12px; height:12px; border-radius:9999px; display:inline-block;
            background: radial-gradient(circle at 30% 30%, #fff 0 25%, #67e8f9 45%, #22d3ee 70%, transparent 72%);
            box-shadow: 0 0 10px #22d3ee, 0 0 20px rgba(103,232,249,.35);
            animation: orb-breath 2.8s ease-in-out infinite;
        }

        /* Table Input Styling */
        .editable-input {
            width: 100%;
            background-color: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            padding: 6px 8px;
            color: #E2E8F0; /* slate-200 */
            transition: all 0.2s ease-in-out;
            outline: none;
        }
        .editable-input:focus {
            background-color: rgba(255,255,255,0.1);
            border-color: #22d3ee; /* cyan-400 */
            box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.3);
        }
        select.editable-input {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E');
            background-repeat: no-repeat;
            background-position: right 0.7em top 50%;
            background-size: 0.65em auto;
        }

        /* Premium button glow effect */
        .button-glow-effect {
            position: relative;
            transition: all 0.3s ease;
            overflow: hidden;
        }
        .button-glow-effect::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 150%;
            padding-top: 150%;
            background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
            border-radius: 50%;
            opacity: 0;
            transition: all 0.5s ease;
        }
        .button-glow-effect:hover::before {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
        }
        .button-glow-effect:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        /* --- KEYFRAME ANIMATIONS --- */
        @keyframes pan-grid {
            0% { background-position: 0% 0%; }
            100% { background-position: 50px 50px; }
        }
        @keyframes pulse-orb {
            0%, 100% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 2s linear infinite; }
        
        @keyframes orb-breath { 
            0%,100% { filter:saturate(120%) brightness(1); transform: scale(1); } 
            50% { filter:saturate(160%) brightness(1.2); transform: scale(1.05); } 
        }

        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        
        @keyframes fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
        .animate-fade-out { animation: fade-out 0.5s ease-in forwards; }

        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }

        @keyframes slide-in-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in-up {
            opacity: 0;
            animation: slide-in-up 0.4s ease-out forwards;
        }

        /* Confetti Burst Animation */
        @keyframes confetti-burst {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
            80% { transform: translate(calc(-50% + cos(var(--angle)) * var(--distance)), calc(-50% + sin(var(--angle)) * var(--distance))) scale(1); opacity: 1; }
            100% { opacity: 0; }
        }
        .animate-confetti-burst {
          animation-name: confetti-burst;
          animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
};

export default AddInventoryAI;
