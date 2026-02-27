import { useState } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-hot-toast";

const OCRUploadForm = ({ distributorId }) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brandHint, setBrandHint] = useState("");
  const [categoryHint, setCategoryHint] = useState("");

  // Enhanced parser: handles lines with or without commas, and prevents index-related crashes
  const parseCleanedText = (cleanedText) => {
    const lines = cleanedText.split("\n");
    return lines
      .filter((line) => typeof line === "string" && line.trim() !== "")
      .map((line) => {
        const parts = line.split(",").map((part) => part.trim());

        if (parts.length >= 4) {
          return {
            productName: parts[0] || "",
            quantity: parts[1] || "",
            unit: parts[2] || "",
            cost: parts[3] || "",
            brand: parts[4] || "",
            category: parts[5] || "",
            description: parts[6] || "",
            sku: parts[7] || "",
            imageUrl: parts[8] || ""
          };
        } else {
          // Fallback for simple lines like: "Toothbrush Colgate 10 pcs"
          const words = line.trim().split(" ");
          const qty = words.find((w) => !isNaN(w));
          const unit = words.find((w) =>
            ["pcs", "kg", "ltr", "box", "unit"].some((u) => w.toLowerCase().includes(u))
          );
          return {
            productName: line.replace(qty, "").replace(unit, "").trim(),
            quantity: qty || "1",
            unit: unit || "",
            cost: "",
            brand: "",
            category: "",
            description: "",
            sku: "",
            imageUrl: ""
          };
        }
      });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (e) => reject(e);
    });

  const handleScan = async (useAI = false) => {
    if (!imageFile) return;
    if (imageFile.type !== "application/pdf" && !imageFile.type.startsWith("image/")) {
      toast.error("Unsupported file format. Please upload an image or PDF.");
      return;
    }
    setLoading(true);

    try {
      const fileBase64 = await toBase64(imageFile);
      if (!fileBase64) {
        toast.error("Failed to convert file.");
        setLoading(false);
        return;
      }

      const isPdf = imageFile.type === "application/pdf";
      const url = useAI
        ? (import.meta.env.VITE_PARSE_CATALOGUE_AI_URL || "https://us-central1-stockpilotv1.cloudfunctions.net/parseCatalogueWithAI")
        : (import.meta.env.VITE_OCR_FILE_URL || import.meta.env.VITE_DISTRIBUTOR_OCR_URL || "https://us-central1-stockpilotv1.cloudfunctions.net/ocrFromFile");

      const body = isPdf
        ? { pdfBase64: fileBase64, mimeType: "application/pdf" }
        : { imageBase64: fileBase64 };
      if (useAI) {
        if (brandHint?.trim()) body.brandHint = brandHint.trim();
        if (categoryHint?.trim()) body.categoryHint = categoryHint.trim();
      }

      const controller = useAI ? new AbortController() : null;
      const timeoutId = useAI ? setTimeout(() => controller?.abort(), 130000) : null;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (timeoutId) clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.error || (useAI ? "AI parse failed." : "Scan failed."));
        setLoading(false);
        return;
      }

      let productList = data.products || [];
      if (!useAI && (!Array.isArray(productList) || productList.length === 0)) {
        const cleanLines = (raw) =>
          (raw || "")
            .trim()
            .split("\n")
            .map((line) => line.replace(/^\s*[\d\-.:]+\s*/, "").trim())
            .filter((line) => line);
        const ocrText = data?.text || "";
        if (ocrText) productList = parseCleanedText(cleanLines(ocrText).join("\n"));
      }

      if (Array.isArray(productList) && productList.length > 0) {
        const formatted = productList.map((p) => ({
          productName: p?.productName || p?.name || "",
          quantity: p?.quantity ?? "1",
          unit: p?.unit || "",
          costPrice: p?.cost ?? p?.costPrice ?? "",
          sellingPrice: p?.sellingPrice ?? p?.price ?? p?.mrp ?? "",
          mrp: p?.mrp ?? "",
          brand: p?.brand || "",
          category: p?.category || "",
          description: p?.description || "",
          sku: p?.sku || "",
          imageUrl: p?.imageUrl || ""
        })).filter((p) => p.productName);
        setProducts(formatted);
        toast.success(useAI ? "AI parse complete!" : (isPdf ? "PDF extracted!" : "OCR scan completed!"));
      } else {
        toast.error(useAI ? "AI found no products. Try cropping to one table section or a clearer image." : "No valid product data found. Try **Parse with AI** for catalogues.");
      }
    } catch (error) {
      console.error(useAI ? "AI parse failed:" : "OCR/PDF failed:", error);
      const isTimeout = error?.name === "AbortError";
      toast.error(isTimeout ? "Parsing took too long (max 2 min). Try a smaller crop or one section." : (useAI ? "AI parse failed." : "Failed to scan file."));
    }

    setLoading(false);
  };

  const handleSaveAll = async () => {
    if (!products.length) return;

    if (!distributorId) {
      toast.error("Distributor ID missing. Cannot save.");
      return;
    }

    const validProducts = products.filter(
      (item) => item && typeof item.productName === "string" && item.productName.trim() !== ""
    );

    console.log("Saving for distributorId:", distributorId);
    console.log("Valid products to save:", validProducts);

    if (!validProducts.length) {
      toast.error("No valid products to save.");
      return;
    }

    const promises = validProducts.map((item) => {
      return addDoc(collection(db, "businesses", distributorId, "products"), {
        productName: item.productName?.trim() || "",
        brand: item.brand?.trim() || "",
        category: item.category?.trim() || "",
        quantity: Number(item.quantity) || 0,
        unit: item.unit?.trim() || "",
        costPrice: Number(item.costPrice) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,
        mrp: item.mrp ? Number(item.mrp) : undefined,
        description: item.description?.trim() || "",
        sku: item.sku?.trim() || "",
        imageUrl: item.imageUrl || "",
        createdAt: serverTimestamp()
      }).catch((err) => {
        console.error("Failed to add product:", item, err);
      });
    });

    try {
      await Promise.all(promises);
      console.log("Products saved successfully.");
      toast.success("All products saved!");
      setProducts([]);
    } catch (err) {
      console.error("Saving failed:", err);
      toast.error("Failed to save products.");
    }
  };

  return (
    <div className="space-y-4">
      <label className="block mb-1 text-sm font-medium text-white/80">Upload Image or Price-List PDF</label>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleImageChange}
        className="block w-full rounded-lg bg-slate-800/60 border border-white/10 text-white placeholder-white/50 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
      />
      {imagePreview && (
        <div className="mt-3">
          {imageFile?.type === "application/pdf" ? (
            <div className="px-3 py-2 rounded-lg border border-white/10 bg-slate-800/40 text-white/90 text-sm">
              📄 PDF: {imageFile?.name || "Uploaded"} — ready to extract
            </div>
          ) : (
            <img src={imagePreview} alt="Preview" className="max-w-xs rounded-lg border border-white/10 shadow-lg" />
          )}
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-white/60 mb-0.5">Brand hint (optional)</label>
          <input
            type="text"
            value={brandHint}
            onChange={(e) => setBrandHint(e.target.value)}
            placeholder="e.g. Ashirvad"
            className="w-full px-2 py-1.5 rounded bg-slate-800/60 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-0.5">Category hint (optional)</label>
          <input
            type="text"
            value={categoryHint}
            onChange={(e) => setCategoryHint(e.target.value)}
            placeholder="e.g. CPVC plumbing, Fittings"
            className="w-full px-2 py-1.5 rounded bg-slate-800/60 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-white/50">Optional hints help the AI set brand/category when the catalogue is unclear.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => handleScan(false)}
          disabled={!imageFile || loading}
          className={`px-4 py-2 rounded-lg text-sm transition ${
            loading || !imageFile ? "bg-slate-700/60 text-white/60 cursor-not-allowed" : "bg-white/20 hover:bg-white/30 text-white border border-white/20"
          }`}
        >
          {loading ? "Scanning…" : "Quick OCR"}
        </button>
        <button
          onClick={() => handleScan(true)}
          disabled={!imageFile || loading}
          className={`px-4 py-2 rounded-lg text-sm transition ${
            loading || !imageFile ? "bg-slate-700/60 text-white/60 cursor-not-allowed" : "bg-emerald-500/90 hover:bg-emerald-500 text-white shadow-[0_6px_20px_rgba(16,185,129,.35)]"
          }`}
          title="Best for catalogues, price lists, handwritten lists"
        >
          {loading ? "Parsing…" : "Parse with AI"}
        </button>
      </div>
      <p className="mt-2 text-xs text-white/50">Use <strong>Parse with AI</strong> for catalogues or handwritten lists.</p>

      {products.length > 0 && (
        <>
          <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur-sm p-3">
            <h3 className="font-semibold mb-2 text-white/90">Scanned Products</h3>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full bg-transparent rounded">
                <thead>
                  <tr className="text-left text-xs bg-slate-800/60">
                    <th className="p-2 border border-white/10 text-white/80">#</th>
                    <th className="p-2 border border-white/10 text-white/80">Product Name</th>
                    <th className="p-2 border border-white/10 text-white/80">Quantity</th>
                    <th className="p-2 border border-white/10 text-white/80">Unit</th>
                    <th className="p-2 border border-white/10 text-white/80">Cost Price</th>
                    <th className="p-2 border border-white/10 text-white/80">MRP</th>
                    <th className="p-2 border border-white/10 text-white/80">Selling Price</th>
                    <th className="p-2 border border-white/10 text-white/80">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item, index) => (
                    <tr key={index} className="text-sm">
                      <td className="p-2 border border-white/10 text-white/90">{index + 1}</td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <input
                          type="text"
                          value={item.productName || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].productName = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full rounded-md bg-slate-800/60 border border-white/10 text-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30"
                        />
                      </td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].quantity = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full rounded-md bg-slate-800/60 border border-white/10 text-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30"
                        />
                      </td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <input
                          type="text"
                          value={item.unit || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].unit = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full rounded-md bg-slate-800/60 border border-white/10 text-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30"
                        />
                      </td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <input
                          type="number"
                          value={item.costPrice || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].costPrice = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full rounded-md bg-slate-800/60 border border-white/10 text-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30"
                        />
                      </td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <input
                          type="number"
                          value={item.mrp || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].mrp = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full rounded-md bg-slate-800/60 border border-white/10 text-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30"
                        />
                      </td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <input
                          type="number"
                          value={item.sellingPrice || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].sellingPrice = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full rounded-md bg-slate-800/60 border border-white/10 text-white p-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/30"
                        />
                      </td>
                      <td className="p-2 border border-white/10 text-white/90">
                        <button
                          onClick={() => {
                            const newProducts = products.filter((_, i) => i !== index);
                            setProducts(newProducts);
                          }}
                          className="text-red-300 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button
            onClick={handleSaveAll}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white shadow-[0_6px_20px_rgba(16,185,129,.35)] transition"
          >
            Save All Products
          </button>
        </>
      )}
    </div>
  );
};

export default OCRUploadForm;