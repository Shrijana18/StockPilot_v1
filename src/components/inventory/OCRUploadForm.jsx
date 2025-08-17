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
      toast.info(`✅ ${file.name} selected. Ready to scan.`);
    } else {
      toast.error("File must be under 5MB and in JPG/PNG/PDF format.");
    }
  };

  const handleScan = async () => {
    if (!imageFile) {
      toast.error("No image selected.");
      return;
    }

    if (!userId) {
      console.error("handleScan: Missing userId from props or AuthContext.");
      toast.dismiss();
      toast.error("User not authenticated. Please log in again.");
      return;
    }

    setUploading(true);
    toast.loading("📤 Scanning Image with OCR...");

    try {
      // Convert image file to base64
      const toBase64 = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result.split(",")[1]); // strip data URL prefix
          reader.onerror = (error) => reject(error);
        });

      const base64 = await toBase64(imageFile);

      const OCR_FUNCTION_URL =
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OCR_FUNCTION_URL)
          || "https://asia-south1-stockpilotv1.cloudfunctions.net/ocrFromImage";

      const response = await fetch(OCR_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Cloud Function OCR failed.");
      }

      const parsedProducts = result?.products || [];

      if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
        throw new Error("No recognizable products parsed.");
      }

      const enriched = parsedProducts.map((product) => ({
        productName: cleanStr(product.name || product.productName || ""),
        brand: cleanStr(product.brand || ""),
        sku: cleanStr(product.sku || ""),
        category: cleanStr(product.category || ""),
        quantity: String(product.quantity ?? ""),
        unit: cleanStr(product.unit || "pcs"),
        costPrice: String(product.price ?? product.costPrice ?? ""),
        sellingPrice: String(product.sellingPrice ?? ""),
        description: cleanStr(product.description || ""),
        imageURL: previewURL,
      }));

      setProducts(enriched);
      toast.dismiss();
      toast.success("✅ Scan complete. Review and save.");
    } catch (err) {
      toast.dismiss();
      toast.error("❌ OCR scan failed. Check console for details.");
      console.error("OCR Scan Error:", err);
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
      <h3 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">OCR Inventory Upload</h3>
      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="mt-1 p-2 rounded bg-white/10 border border-white/20 text-white file:bg-white/10 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded cursor-pointer" />
      {previewURL && (
        <img
          src={previewURL}
          alt="Preview"
          className="mt-2 w-40 h-40 object-cover rounded border border-white/20 ring-1 ring-white/10"
        />
      )}
      <button
        onClick={handleScan}
        className="mt-4 px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={uploading || !imageFile}
      >
        {uploading ? "Scanning..." : "Scan & Import"}
      </button>

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