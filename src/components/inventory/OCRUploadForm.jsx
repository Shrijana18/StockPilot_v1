// Ensure environment variable is used for OCR endpoint
import React, { useState } from "react";
import { storage, db } from "../../firebase/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { toast } from "react-toastify";
import { logInventoryChange } from "../../utils/logInventoryChange";

const OCRUploadForm = ({ userId }) => {
  const [imageFile, setImageFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [brandHint, setBrandHint] = useState("");
  const [categoryHint, setCategoryHint] = useState("");

  const [saving, setSaving] = useState(false);

  // Helpers
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const cleanStr = (v) => (typeof v === 'string' ? v.trim() : '');

  const dataURLToBlob = (dataUrl) => {
    const [meta, b64] = dataUrl.split(',');
    const mime = meta.match(/data:(.*);base64/)[1] || 'application/octet-stream';
    const byteChars = atob(b64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (
      file &&
      file.size <= 5 * 1024 * 1024 &&
      (file.type.includes("image") || file.type === "application/pdf")
    ) {
      setImageFile(file);
      // Use data URL (works with CSP: img-src 'self' data: https:)
      const reader = new FileReader();
      reader.onload = () => setPreviewURL(reader.result);
      reader.onerror = () => toast.error("Failed to read file for preview.");
      reader.readAsDataURL(file);
      toast.info(file.type === "application/pdf" ? `✅ PDF selected. Ready to extract.` : `✅ ${file.name} selected. Ready to scan.`);
    } else {
      toast.error("File must be under 5MB and in JPG/PNG/PDF format.");
    }
  };

  const parseEndpoint = (useAI) =>
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_PARSE_CATALOGUE_AI_URL) ||
    "https://us-central1-stockpilotv1.cloudfunctions.net/parseCatalogueWithAI";

  const ocrEndpoint = () =>
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OCR_FILE_URL) ||
    "https://us-central1-stockpilotv1.cloudfunctions.net/ocrFromFile";

  const enrichFromResponse = (parsedProducts) =>
    (parsedProducts || []).map((product) => ({
      productName: cleanStr(product.name || product.productName || ""),
      brand: cleanStr(product.brand || ""),
      sku: cleanStr(product.sku || ""),
      category: cleanStr(product.category || ""),
      quantity: String(product.quantity ?? "1"),
      unit: cleanStr(product.unit || "pcs"),
      costPrice: String(product.price ?? product.costPrice ?? ""),
      sellingPrice: String(product.sellingPrice ?? product.mrp ?? ""),
      description: cleanStr(product.description || ""),
      imageURL: previewURL,
    }));

  const handleScan = async (useAI = false) => {
    if (!imageFile) {
      toast.error("No image selected.");
      return;
    }

    if (!userId) {
      toast.dismiss();
      toast.error("User not authenticated. Please log in again.");
      return;
    }

    setUploading(true);
    const isPdf = imageFile.type === "application/pdf";
    if (useAI) {
      toast.loading(isPdf ? "🤖 AI reading PDF catalogue…" : "🤖 AI reading image…");
    } else {
      toast.loading(isPdf ? "📄 Extracting from PDF…" : "📤 Scanning with OCR…");
    }

    try {
      const toBase64 = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = (error) => reject(error);
        });

      const base64 = await toBase64(imageFile);
      const body = isPdf
        ? { pdfBase64: base64, mimeType: "application/pdf" }
        : { imageBase64: base64 };
      if (useAI) {
        if (brandHint?.trim()) body.brandHint = brandHint.trim();
        if (categoryHint?.trim()) body.categoryHint = categoryHint.trim();
      }

      const url = useAI ? parseEndpoint(true) : ocrEndpoint();
      const controller = useAI ? new AbortController() : null;
      const timeoutId = useAI ? setTimeout(() => controller?.abort(), 130000) : null;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (timeoutId) clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || (useAI ? "AI parse failed." : "OCR failed."));
      }

      const parsedProducts = result?.products || [];

      if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
        throw new Error(
          useAI
            ? "AI found no products. Dense catalogues can take 1–2 min—if it timed out, try cropping to one table section or a clearer image."
            : "No products found. Try a clearer image, or use **Parse with AI** for catalogues."
        );
      }

      const enriched = enrichFromResponse(parsedProducts);
      setProducts(enriched);
      toast.dismiss();
      toast.success(useAI ? "✅ AI parse complete. Review and save." : "✅ Scan complete. Review and save.");
    } catch (err) {
      toast.dismiss();
      const isTimeout = err?.name === "AbortError";
      toast.error(
        isTimeout
          ? "Parsing took too long (max 2 min). Try a smaller crop or one section of the catalogue."
          : (err?.message || (useAI ? "AI parse failed." : "OCR scan failed."))
      );
      console.error(useAI ? "AI Parse Error:" : "OCR Scan Error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("User not authenticated.");
      return;
    }
    if (!products.length) {
      toast.info("Nothing to save.");
      return;
    }

    // Ensure we don't store huge data: URLs in Firestore. If previewURL is a data URL, upload once to Storage and reuse the https URL.
    let imageUrlForSave = null;
    try {
      if (previewURL && previewURL.startsWith('data:')) {
        const blob = dataURLToBlob(previewURL);
        const filename = imageFile?.name || `ocr-${Date.now()}.png`;
        const path = `businesses/${userId}/products/ocr/${Date.now()}-${filename}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        imageUrlForSave = await getDownloadURL(storageRef);
      } else if (previewURL) {
        imageUrlForSave = previewURL; // already a normal URL
      }
    } catch (e) {
      console.warn('Image upload failed, proceeding without imageURL', e);
      imageUrlForSave = null;
    }

    // Normalize + validate rows
    const rows = products
      .map((p) => ({
        productName: cleanStr(p.productName),
        brand: cleanStr(p.brand),
        sku: cleanStr(p.sku || ""),
        category: cleanStr(p.category || ""),
        quantity: toNum(p.quantity),
        unit: cleanStr(p.unit || "pcs"),
        costPrice: toNum(p.costPrice),
        sellingPrice: toNum(p.sellingPrice),
        description: cleanStr(p.description),
        imageURL: imageUrlForSave || null,
      }))
      .filter((p) => p.productName && p.quantity > 0);

    if (!rows.length) {
      toast.error("Please provide at least one valid product with name and quantity.");
      return;
    }

    setSaving(true);
    toast.loading("💾 Saving products...");

    try {
      const batch = writeBatch(db);
      const colRef = collection(db, "businesses", userId, "products");

      rows.forEach((p) => {
        const docRef = doc(colRef);
        batch.set(docRef, {
          ...p,
          ownerUid: userId,
          createdAt: serverTimestamp(),
          source: "ocr",
        });
      });

      await batch.commit();

      // Optionally log inventory changes (best-effort, non-blocking)
      try {
        for (const p of rows) {
          await logInventoryChange({
            productId: "",
            sku: p.sku || "",
            previousData: {},
            updatedData: p,
            action: "created",
            source: "ocr",
          });
        }
      } catch (e) {
        console.warn("logInventoryChange failed (non-blocking)", e);
      }

      toast.dismiss();
      toast.success(`✅ Saved ${rows.length} product${rows.length > 1 ? 's' : ''}.`);
      setProducts([]);
      setImageFile(null);
      setPreviewURL("");
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error("Failed to save products. See console.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = (index) => {
    const filtered = products.filter((_, i) => i !== index);
    setProducts(filtered);
  };

  return (
    <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      {(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'development') && (
        <p className="text-xs text-white/60 mb-1">
          {userId ? `User Authenticated: ${userId}` : "User not authenticated"}
        </p>
      )}
      <h3 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">OCR / PDF Inventory Upload</h3>
      <p className="text-xs text-white/60 mb-2">Upload an image or a price-list PDF to build inventory.</p>
      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="mt-1 p-2 rounded bg-white/10 border border-white/20 text-white file:bg-white/10 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded cursor-pointer" />
      {previewURL && (
        imageFile?.type === "application/pdf" ? (
          <div className="mt-2 px-3 py-2 rounded border border-white/20 bg-white/5 text-white/90 text-sm">
            📄 PDF: {imageFile?.name || "Uploaded"} — ready to extract
          </div>
        ) : (
          <img
            src={previewURL}
            alt="Preview"
            className="mt-2 w-40 h-40 object-cover rounded border border-white/20 ring-1 ring-white/10"
          />
        )
      )}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-white/60 mb-0.5">Brand hint (optional)</label>
          <input
            type="text"
            value={brandHint}
            onChange={(e) => setBrandHint(e.target.value)}
            placeholder="e.g. Ashirvad"
            className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-0.5">Category hint (optional)</label>
          <input
            type="text"
            value={categoryHint}
            onChange={(e) => setCategoryHint(e.target.value)}
            placeholder="e.g. CPVC plumbing, Fittings"
            className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-white/50">Optional hints help the AI set brand/category when the catalogue is unclear.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => handleScan(false)}
          className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-white/90 hover:bg-white border border-white/30 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={uploading || !imageFile}
        >
          {uploading ? "Scanning…" : "Quick OCR"}
        </button>
        <button
          onClick={() => handleScan(true)}
          className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition"
          disabled={uploading || !imageFile}
          title="Best for catalogues, price lists, and handwritten lists"
        >
          {uploading ? "Parsing…" : "Parse with AI"}
        </button>
      </div>
      <p className="mt-2 text-xs text-white/50">Use <strong>Parse with AI</strong> for catalogues, price lists, or handwritten lists.</p>

      {products.length > 0 && (
        <>
          <table className="mt-4 w-full text-sm border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-white/10 text-white/80">
                <th className="px-2 py-2 border-b border-white/10">Product</th>
                <th className="px-2 py-2 border-b border-white/10">Brand</th>
                <th className="px-2 py-2 border-b border-white/10">Qty</th>
                <th className="px-2 py-2 border-b border-white/10">Unit</th>
                <th className="px-2 py-2 border-b border-white/10">Cost</th>
                <th className="px-2 py-2 border-b border-white/10">Sell</th>
                <th className="px-2 py-2 border-b border-white/10">Desc</th>
                <th className="px-2 py-2 border-b border-white/10">🗑️</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} className="hover:bg-white/5 border-t border-white/10">
                  {["productName", "brand", "quantity", "unit", "costPrice", "sellingPrice", "description"].map((f) => (
                    <td key={f}>
                      <input
                        type={["quantity","costPrice","sellingPrice"].includes(f) ? "number" : "text"}
                        value={p[f]}
                        onChange={(e) => handleInputChange(i, f, e.target.value)}
                        className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      onClick={() => handleDeleteRow(i)}
                      className="text-rose-300 hover:text-rose-200"
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Products'}
          </button>
        </>
      )}
    </div>
  );
};

export default OCRUploadForm;