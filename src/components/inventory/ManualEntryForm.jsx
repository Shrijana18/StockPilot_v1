import React, { useState } from "react";
import { db, storage } from "../../firebase/firebaseConfig";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth, getCurrentUserId } from "../../context/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { logInventoryChange } from "../../utils/logInventoryChange";
import PricingModeFields from "./PricingModeFields";
import { PRICING_MODES, buildPricingSave } from "../../utils/pricing";


const ManualEntryForm = () => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    productName: "",
    sku: "",
    brand: "",
    category: "",
    quantity: "",
    costPrice: "",
    sellingPrice: "",
    unit: "",
    description: "",
    image: null,
  });

  // Pricing mode state (backward-compatible: default LEGACY keeps current behavior)
  const [pricingMode, setPricingMode] = useState(PRICING_MODES.LEGACY);
  const [pricingValues, setPricingValues] = useState({
    mrp: "",
    basePrice: "",
    taxRate: "",
    legacySellingPrice: "",
    hsnCode: "",
    taxSource: "",
    taxConfidence: "",
  });
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      const file = files[0];
      setFormData({ ...formData, image: file });
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleAutoSuggest = async () => {
    try {
      // Do not overwrite a manually entered HSN
      if (pricingValues.hsnCode && String(pricingValues.hsnCode).trim()) {
        toast.info("HSN already filled. Clear it first to use AI.");
        return;
      }
      // Require at least product name
      if (!formData.productName?.trim()) {
        toast.warn("Enter Product Name first.");
        return;
      }
      if (isSuggesting) return;
      setIsSuggesting(true);

      const response = await fetch('https://us-central1-stockpilotv1.cloudfunctions.net/generateHSNAndGST', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: formData.productName,
          brand: formData.brand,
          category: formData.category,
          unit: formData.unit,
        }),
      });

      let payloadText = '';
      try { payloadText = await response.clone().text(); } catch (_) {}

      if (!response.ok) {
        let details = '';
        try { const j = JSON.parse(payloadText || '{}'); details = j.details || j.error || ''; } catch (_) {}
        if (response.status === 429) {
          toast.error(`Rate limited by AI: ${details || 'Please wait a moment and try again.'}`);
          return;
        }
        throw new Error(`Failed to fetch HSN and GST (${response.status}) ${details || payloadText || ''}`);
      }

      const data = await response.json();
      setPricingValues((prev) => ({
        ...prev,
        hsnCode: data.hsn || "",
        taxRate: data.gst !== undefined ? data.gst : "",
        taxSource: "AI",
        taxConfidence: data.taxConfidence || data.confidence || "",
      }));
      toast.success("✨ HSN & GST auto-suggest applied!");
    } catch (error) {
      console.error("Auto-suggest error:", error);
      toast.error("❌ Failed to auto-suggest HSN & GST.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userId = getCurrentUserId();
    if (!userId) return;

    setUploading(true);

    const { productName, sku, quantity, costPrice } = formData;

    // Mode-specific pricing validation
    let pricingError = "";
    if (pricingMode === PRICING_MODES.LEGACY) {
      if (!pricingValues.legacySellingPrice && !formData.sellingPrice) {
        pricingError = "Please enter Selling Price.";
      }
    } else if (pricingMode === PRICING_MODES.MRP_INCLUSIVE) {
      if (!pricingValues.mrp) pricingError = "Please enter MRP (incl. GST).";
      // GST % optional in MRP mode; if blank, we'll treat it as 0%
    } else if (pricingMode === PRICING_MODES.BASE_PLUS_TAX) {
      if (!pricingValues.basePrice) pricingError = "Please enter Unit/Base Price.";
      // GST % optional in Base+GST mode; if blank, we'll treat it as 0%
    }

    if (!productName || !sku || !quantity || !costPrice || pricingError) {
      toast.error(pricingError || "Please fill all required fields");
      setUploading(false);
      return;
    }

    try {
      // Build pricing payload from selected mode (keeps sellingPrice as final)
      const pricingPayload = buildPricingSave(
        pricingMode,
        {
          mrp: Number(pricingValues.mrp),
          basePrice: Number(pricingValues.basePrice),
          taxRate: Number(pricingValues.taxRate),
          legacySellingPrice: Number(
            pricingValues.legacySellingPrice !== "" ? pricingValues.legacySellingPrice : formData.sellingPrice
          ),
        }
      );

      let imageUrl = "";
      if (formData.image) {
        const imageRef = ref(storage, `inventory/${userId}/${Date.now()}_${formData.image.name}`);
        await uploadBytes(imageRef, formData.image);
        imageUrl = await getDownloadURL(imageRef);
      }

      const productRef = doc(collection(db, "businesses", userId, "products"));
      await setDoc(productRef, {
        productName: formData.productName,
        sku: formData.sku,
        brand: formData.brand,
        category: formData.category,
        quantity: Number(formData.quantity),
        costPrice: Number(formData.costPrice),
        // Pricing (final sellingPrice always present)
        sellingPrice: pricingPayload.sellingPrice,
        pricingMode: pricingPayload.pricingMode,
        ...(pricingPayload.mrp !== undefined ? { mrp: pricingPayload.mrp } : {}),
        ...(pricingPayload.basePrice !== undefined ? { basePrice: pricingPayload.basePrice } : {}),
        ...(pricingPayload.taxRate !== undefined ? { taxRate: pricingPayload.taxRate } : {}),
        ...(pricingValues.hsnCode ? { hsnCode: pricingValues.hsnCode } : {}),
        ...(pricingValues.taxSource ? { taxSource: pricingValues.taxSource } : {}),
        ...(pricingValues.taxConfidence ? { taxConfidence: Number(pricingValues.taxConfidence) } : {}),
        unit: formData.unit,
        description: formData.description,
        imageUrl, // ✅ Only storing URL
        id: productRef.id,
        createdAt: serverTimestamp(),
        addedBy: userId,
      });

      await logInventoryChange({
        productId: productRef.id,
        sku: formData.sku,
        previousData: {}, // since it's a new product
        updatedData: {
          productName: formData.productName,
          sku: formData.sku,
          brand: formData.brand,
          category: formData.category,
          quantity: Number(formData.quantity),
          costPrice: Number(formData.costPrice),
          sellingPrice: pricingPayload.sellingPrice,
          pricingMode: pricingPayload.pricingMode,
          ...(pricingPayload.mrp !== undefined ? { mrp: pricingPayload.mrp } : {}),
          ...(pricingPayload.basePrice !== undefined ? { basePrice: pricingPayload.basePrice } : {}),
          ...(pricingPayload.taxRate !== undefined ? { taxRate: pricingPayload.taxRate } : {}),
          ...(pricingValues.hsnCode ? { hsnCode: pricingValues.hsnCode } : {}),
          ...(pricingValues.taxSource ? { taxSource: pricingValues.taxSource } : {}),
          ...(pricingValues.taxConfidence ? { taxConfidence: Number(pricingValues.taxConfidence) } : {}),
          unit: formData.unit,
          description: formData.description,
          imageUrl,
        },
        action: "created",
        source: "manual",
      });

      toast.success("✅ Product added successfully!");

      setFormData({
        productName: "",
        sku: "",
        brand: "",
        category: "",
        quantity: "",
        costPrice: "",
        sellingPrice: "",
        unit: "",
        description: "",
        image: null,
      });
      setPricingMode(PRICING_MODES.LEGACY);
      setPricingValues({
        mrp: "",
        basePrice: "",
        taxRate: "",
        legacySellingPrice: "",
        hsnCode: "",
        taxSource: "",
        taxConfidence: "",
      });
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("❌ Failed to add product. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 mt-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Add Inventory Manually</h2>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <input
          type="text"
          name="productName"
          placeholder="Product Name"
          value={formData.productName}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="sku"
          placeholder="SKU"
          value={formData.sku}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="brand"
          placeholder="Brand"
          value={formData.brand}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="category"
          placeholder="Category"
          value={formData.category}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="number"
          name="quantity"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="number"
          name="costPrice"
          placeholder="Cost Price"
          value={formData.costPrice}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        {/* Pricing Block (replaces single Selling Price field) */}
        <div className="col-span-2 rounded-xl border border-white/15 bg-white/5 p-3">
          <div className="text-sm font-medium text-white/90 mb-2">Pricing</div>
          <PricingModeFields
            mode={pricingMode}
            setMode={setPricingMode}
            values={pricingValues}
            onChange={(patch) => setPricingValues((v) => ({ ...v, ...patch }))}
            productName={formData.productName}
            category={formData.category}
          />
        </div>

        {/* HSN & GST Auto-Suggest Section (clean layout) */}
        <div className="col-span-2 rounded-xl border border-white/15 bg-white/5 p-3">
          <div className="text-sm font-medium text-white/90 mb-2">Tax Details</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            {/* HSN */}
            <div>
              <label className="text-xs text-white/60 flex items-center gap-2">
                <span>HSN Code</span>
                {pricingValues.taxSource === "AI" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">✨ AI Suggested</span>
                )}
              </label>
              <input
                type="text"
                name="hsnCode"
                placeholder="Enter HSN (leave blank to Auto‑Suggest)"
                value={pricingValues.hsnCode}
                onChange={(e) => setPricingValues((v) => ({ ...v, hsnCode: e.target.value }))}
                className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-white/50">Not sure? Click <span className="font-medium">Auto‑Suggest</span>.</p>
                {pricingValues.hsnCode?.toString().trim() && (
                  <button
                    type="button"
                    onClick={() => setPricingValues((v) => ({ ...v, hsnCode: "", taxSource: "", taxConfidence: "" }))}
                    className="text-xs text-sky-300 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {/* GST % */}
            <div>
              <label className="text-xs text-white/60">GST %</label>
              <input
                type="number"
                name="taxRate"
                placeholder="GST %"
                value={pricingValues.taxRate}
                onChange={(e) => setPricingValues((v) => ({ ...v, taxRate: e.target.value }))}
                className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            {/* Action */}
            <div className="md:justify-self-end">
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={
                  isSuggesting ||
                  !formData.productName?.trim() ||
                  (pricingValues.hsnCode && String(pricingValues.hsnCode).trim())
                }
                title={
                  (pricingValues.hsnCode && String(pricingValues.hsnCode).trim())
                    ? "HSN is already filled manually. Clear it to use AI."
                    : (!formData.productName?.trim() ? "Enter Product Name first" : "Let AI suggest HSN & GST")
                }
                className="w-full md:w-auto px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSuggesting ? 'Suggesting…' : 'Auto‑Suggest'}
              </button>
            </div>
          </div>
        </div>

        <input
          type="text"
          name="unit"
          placeholder="Unit (e.g., box, piece)"
          value={formData.unit}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 col-span-2"
        />
        <div className="col-span-2">
          <input
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
            className="mb-2 p-2 rounded bg-white/10 border border-white/20 text-white file:bg-white/10 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded cursor-pointer"
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Product preview"
              className="h-24 w-24 object-cover rounded border border-white/20 ring-1 ring-white/10"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] col-span-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default ManualEntryForm;
