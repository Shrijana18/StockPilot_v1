import React, { useState, useRef, useEffect } from "react";
import { db, storage } from "../../firebase/firebaseConfig";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { lookupBarcode } from "../../utils/barcodeLookup";
import { identifyProductFromImage, fileToBase64 } from "../../utils/imageIdentify";
import { useAuth, getCurrentUserId } from "../../context/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { logInventoryChange } from "../../utils/logInventoryChange";
import PricingModeFields from "./PricingModeFields";
import { PRICING_MODES, buildPricingSave } from "../../utils/pricing";
import ProductBarcode from "./ProductBarcode";


const ManualEntryForm = () => {
  const { currentUser } = useAuth();
  // Magic Scan (Live) state and refs
  const [magicLiveOpen, setMagicLiveOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
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
  const [barcode, setBarcode] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [isBarcodeLoading, setIsBarcodeLoading] = useState(false);
  const [isMagicScanLoading, setIsMagicScanLoading] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState([]);
  const [autoSource, setAutoSource] = useState(""); // e.g., "vision", "openfoodfacts", "digit-eyes"
  // Prefill product fields using scanned barcode:
  // 1) Check this business's inventory for an existing product with the same barcode (prevents duplicates; fast).
  // 2) If not found, call the Cloud Function to fetch public metadata (best-effort).
  const prefillFromCode = async (scanned) => {
    const code = String(scanned || "").trim();
    if (!code) return;
    try {
      setBarcode(code);
      setIsBarcodeLoading(true);
      setAutoSource("");
      const userId = getCurrentUserId();
      if (!userId) return;
      // 1) Your inventory first
      const qRef = query(
        collection(db, "businesses", userId, "products"),
        where("barcode", "==", code)
      );
      const snap = await getDocs(qRef);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setFormData((v) => ({
          ...v,
          productName: d.productName || v.productName,
          brand: d.brand || v.brand,
          category: d.category || v.category,
          sku: d.sku || v.sku,
          unit: d.unit || v.unit,
          description: d.description || v.description,
        }));
        setAutoSource("your-inventory");
        setImageSuggestions([]);
        toast.info("This barcode already exists in your inventory. Pre-filled from your record.");
        return;
      }
      // 2) Public catalog fallback (Cloud Function)
      try {
        const info = await lookupBarcode(code);
        setFormData((v) => ({
          ...v,
          productName: info.productName || v.productName,
          brand: info.brand || v.brand,
          category: info.category || v.category,
          unit: info.size || v.unit,
        }));
        setAutoSource(info.source || "catalog");
        setImageSuggestions([]);
        // Optional image preview from catalog
        // if (info.imageUrl) setPreviewUrl(info.imageUrl);
        toast.success("✨ Auto-filled from barcode lookup. Please confirm price & tax.");
      } catch (e) {
        // No public info found
        toast.warn("No public info found for this code. Please enter details manually.");
      }
    } catch (err) {
      console.warn("prefillFromCode error:", err);
      toast.error("Failed to look up product details.");
    } finally {
      setIsBarcodeLoading(false);
    }
  };


  // Apply normalized autofill payload coming from the Cloud Function
  const applyAutofill = (autofill = {}) => {
    setFormData((v) => ({
      ...v,
      productName: autofill.productName || v.productName,
      brand: autofill.brand || v.brand,
      category: autofill.category || v.category,
      sku: autofill.sku || v.sku,
      unit: autofill.unit || v.unit,
      description: autofill.description || v.description,
    }));
    // HSN/GST
    if (autofill.hsn) {
      setPricingValues((prev) => ({ ...prev, hsnCode: autofill.hsn, taxSource: "AI" }));
    }
    if (autofill.gst !== undefined && autofill.gst !== null && autofill.gst !== "") {
      setPricingValues((prev) => ({ ...prev, taxRate: autofill.gst }));
    }
    // Pricing fields (prefer priceMRP for MRP, price for legacy selling)
    if (autofill.priceMRP !== undefined && autofill.priceMRP !== null && autofill.priceMRP !== "") {
      setPricingValues((prev) => ({ ...prev, mrp: autofill.priceMRP }));
    } else if (autofill.mrp !== undefined && autofill.mrp !== null && autofill.mrp !== "") {
      setPricingValues((prev) => ({ ...prev, mrp: autofill.mrp }));
    }
    if (autofill.price !== undefined && autofill.price !== null && autofill.price !== "") {
      setPricingValues((prev) => ({ ...prev, legacySellingPrice: autofill.price }));
    }
  };

  // Magic Scan handler
  // Helper to apply "best" result from magic scan
  const applyMagicBest = async (best) => {
    setAutoSource(best.source || "vision");
    // Cloud Function now returns a normalized `autofill` payload too
    if (best.autofill) {
      applyAutofill(best.autofill);
    }

    // Suggestions/labels fallback logic
    let suggestionsArr = [];
    if (Array.isArray(best.suggestions) && best.suggestions.length > 0) {
      suggestionsArr = best.suggestions;
    } else if (Array.isArray(best.labels) && best.labels.length > 0) {
      suggestionsArr = best.labels;
    }
    // Merge unique with any current suggestions
    setImageSuggestions((prev) => {
      const merged = Array.from(new Set([...(prev || []), ...(suggestionsArr || [])]));
      return merged;
    });

    // If we detected a barcode in the image, reuse the robust barcode prefill flow.
    if (best.code) {
      await prefillFromCode(best.code);
      setBarcode(best.code);
    }

    // Apply any fields we got without overwriting what user already typed.
    setFormData((v) => ({
      ...v,
      productName: best.productName || v.productName,
      brand: best.brand || v.brand,
      category: best.category || best.category || v.category,
      sku: best.sku || v.sku,
      unit: best.unit || best.size || v.unit,
      description: best.description || v.description,
    }));
    // HSN/GST
    if (best.hsn) {
      setPricingValues((prev) => ({ ...prev, hsnCode: best.hsn, taxSource: best.taxSource || "AI", taxConfidence: best.confidence || "" }));
    }
    if (best.gst !== undefined) {
      setPricingValues((prev) => ({ ...prev, taxRate: best.gst }));
    }
    // MRP/price fields (prefer priceMRP/mrp for mrp, price for legacy)
    if (
      best.priceMRP !== undefined &&
      best.priceMRP !== null &&
      best.priceMRP !== ""
    ) {
      setPricingValues((prev) => ({ ...prev, mrp: best.priceMRP }));
    } else if (
      best.mrp !== undefined &&
      best.mrp !== null &&
      best.mrp !== ""
    ) {
      setPricingValues((prev) => ({ ...prev, mrp: best.mrp }));
    }
    if (
      best.price !== undefined &&
      best.price !== null &&
      best.price !== "" &&
      pricingMode === PRICING_MODES.LEGACY &&
      (pricingValues.legacySellingPrice === "" || pricingValues.legacySellingPrice === undefined)
    ) {
      setPricingValues((prev) => ({
        ...prev,
        legacySellingPrice: best.price,
      }));
    }
    // Optional: show catalog/vision image as preview if user hasn't uploaded one
    if (!previewUrl && best.imageUrl) {
      setPreviewUrl(best.imageUrl);
    }
  };

  // Magic Scan (photo upload)
  const handleMagicScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsMagicScanLoading(true);
      // Convert file to base64 (no data: prefix)
      const base64 = await fileToBase64(file);
      const result = await identifyProductFromImage({ base64 });
      const autofill = result?.autofill;
      if (autofill) applyAutofill(autofill);
      const best = result?.best || {};
      await applyMagicBest({ ...best, suggestions: result?.suggestions });
      toast.success("✨ Magic Scan completed! Fields auto-filled.");
    } catch (err) {
      console.error("Magic Scan image identify error:", err);
      toast.warn("Could not identify the image. Please enter details manually.");
    } finally {
      setIsMagicScanLoading(false);
      // reset input so same file can be chosen again if needed
      e.target.value = "";
    }
  };

  // Magic Scan (Live camera capture)
  const handleMagicCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    try {
      setIsMagicScanLoading(true);
      // Draw current video frame to canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Convert to base64 (no data: prefix)
      const base64 = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");
      const result = await identifyProductFromImage({ base64 });
      const autofill = result?.autofill;
      if (autofill) applyAutofill(autofill);
      const best = result?.best || {};
      await applyMagicBest({ ...best, suggestions: result?.suggestions });
      toast.success("✨ Magic Scan completed! Fields auto-filled.");
      setMagicLiveOpen(false);
    } catch (err) {
      console.error("Magic Scan live camera error:", err);
      toast.warn("Could not identify the image. Please enter details manually.");
    } finally {
      setIsMagicScanLoading(false);
    }
  };

  // Camera lifecycle for Magic Scan (Live)
  useEffect(() => {
    if (!magicLiveOpen) {
      // Stop camera if open
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }
    // Open camera
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err) => {
        toast.error("Could not access camera: " + (err?.message || err));
        setMagicLiveOpen(false);
      });
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [magicLiveOpen]);

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
        ...(barcode ? { barcode } : {}),
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
          ...(barcode ? { barcode } : {}),
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
      setBarcode("");
      setScanOpen(false);
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("❌ Failed to add product. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 mt-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      {/* FLYP Magic Scan — hero action (separate from manual form) */}
      <div className="mb-4 p-4 rounded-xl border border-white/15 bg-gradient-to-r from-purple-600/30 via-pink-500/20 to-orange-400/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-white flex items-center gap-2">
              <span className="text-lg">✨</span> FLYP Magic Scan
            </div>
            <p className="text-xs text-white/80 mt-1">
              Point your camera or upload a photo — we’ll magically read the product and auto‑fill details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMagicLiveOpen(true)}
              className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 via-pink-400 to-orange-400 shadow-lg hover:shadow-xl text-sm flex items-center gap-2"
              title="Scan live with camera"
            >
              📷 Magic Scan (Live)
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('magic-photo-input-top')?.click()}
              className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 via-pink-400 to-orange-400 shadow-lg hover:shadow-xl text-sm flex items-center gap-2"
              title="Upload a product photo"
            >
              🖼️ Upload Photo
            </button>
            <input
              id="magic-photo-input-top"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleMagicScan}
            />
          </div>
        </div>
      </div>
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
        {/* Barcode / QR */}
        <div className="md:col-span-1">
          <input
            type="text"
            name="barcode"
            placeholder="Barcode / QR (optional)"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.trim())}
            className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="px-3 py-2 rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm"
              title="Scan with camera"
            >
              Scan Barcode / QR
            </button>
            <button
              type="button"
              onClick={() => prefillFromCode(barcode)}
              disabled={!barcode || isBarcodeLoading}
              className="px-3 py-2 rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm disabled:opacity-50"
              title="Lookup details for the typed code"
            >
              Fetch details
            </button>
          </div>
          {isBarcodeLoading && (
            <p className="mt-1 text-xs text-white/60">Looking up product details…</p>
          )}
          {isMagicScanLoading && (
            <p className="mt-1 text-xs text-pink-200 animate-pulse">✨ Scanning magically…</p>
          )}
          {autoSource && !isBarcodeLoading && !isMagicScanLoading && (
            <p className="mt-1 text-xs text-emerald-300/90">
              Auto‑filled from{" "}
              <span className="font-semibold">
                {(() => {
                  // Normalize source labels
                  const src = (autoSource || "").toLowerCase();
                  if (src.includes("vision+kg+search")) return "vision + KG + web";
                  if (src.includes("vision+kg")) return "vision + KG";
                  if (src.includes("vision+search")) return "vision + web";
                  if (src.includes("kg+search")) return "KG + web";
                  if (src === "vision") return "vision";
                  if (src === "kg") return "KG";
                  if (src === "search" || src === "web") return "web";
                  if (src === "your-inventory") return "your inventory";
                  if (src === "openfoodfacts") return "OpenFoodFacts";
                  if (src === "digit-eyes") return "Digit-Eyes";
                  return autoSource;
                })()}
              </span>
            </p>
          )}
          {!!imageSuggestions.length && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-white/70">Did you mean:</span>
              {imageSuggestions
                .filter((s, idx, arr) => s && arr.indexOf(s) === idx)
                .slice(0, 5)
                .map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData((v) => ({ ...v, productName: s }))}
                    className="text-xs px-2 py-1 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white"
                    title="Use this as Product Name"
                  >
                    {s.length > 36 ? s.slice(0, 34) + "…" : s}
                  </button>
                ))}
            </div>
          )}
        </div>
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
        <ProductBarcode
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onDetected={({ rawValue }) => {
            setScanOpen(false);
            prefillFromCode(rawValue);
          }}
        />
      </form>
      {/* Fullscreen animated overlay during Magic Scan */}
      {isMagicScanLoading && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="w-[min(520px,90vw)] rounded-2xl border border-white/20 bg-white/10 p-6 text-center shadow-2xl">
            <div className="relative h-28 overflow-hidden rounded-xl border border-white/20 bg-black/40 mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[scan_2s_linear_infinite]" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full animate-pulse opacity-30 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.25),transparent_40%),radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.15),transparent_40%)]" />
              </div>
            </div>
            <div className="text-white font-semibold">Analyzing product with FLYP Magic…</div>
            <div className="text-white/80 text-xs mt-1">Reading labels, brand &amp; size • Finding HSN/GST • Looking up catalogs</div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      {/* Magic Scan (Live) Modal */}
      {magicLiveOpen && (
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="w-[min(420px,95vw)] rounded-2xl border border-white/20 bg-white/10 p-6 text-center shadow-2xl relative">
            <div className="font-bold text-lg text-white flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">📷</span> Magic Scan (Live)
            </div>
            <div className="text-xs text-white/80 mb-3">Align the product in the camera view. Tap <b>Scan Now</b> to capture and analyze.</div>
            <div className="relative rounded-xl overflow-hidden border border-white/20 bg-black/40 mb-4 flex items-center justify-center min-h-[220px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-[220px] object-contain bg-black"
                style={{ background: "#000" }}
              />
              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleMagicCapture}
                className="px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 via-pink-400 to-orange-400 shadow-lg hover:shadow-xl text-base flex items-center gap-2"
                disabled={isMagicScanLoading}
              >
                {isMagicScanLoading ? "Scanning..." : "Scan Now"}
              </button>
              <button
                type="button"
                onClick={() => setMagicLiveOpen(false)}
                className="px-4 py-2 rounded-xl font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 text-base"
                disabled={isMagicScanLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualEntryForm;
