import { useState } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-hot-toast";

const OCRUploadForm = ({ distributorId }) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const handleScan = async () => {
    if (!imageFile) return;
    setLoading(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const fileBase64 = reader.result.split(",")[1];

      // Clean raw OCR text to remove leading serial numbers
      const cleanLines = (raw) => {
        return raw
          .trim()
          .split("\n")
          .map((line) => line.replace(/^\s*[\d\-.:]+\s*/, "").trim())
          .filter((line) => line);
      };

      if (!fileBase64) {
        toast.error("Failed to convert file.");
        setLoading(false);
        return;
      }

      try {
        const OCR_ENDPOINT =
          import.meta.env.VITE_DISTRIBUTOR_OCR_URL ||
          (import.meta.env.MODE === "development"
            ? "http://localhost:5001/stockpilotv1/asia-south1/ocrFromImage"
            : "https://asia-south1-stockpilotv1.cloudfunctions.net/ocrFromImage");

        const response = await fetch(OCR_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: fileBase64 })
        });

        const data = await response.json();
        if (data.rawText) {
          const cleanedText = cleanLines(data.rawText).join("\n");
          data.products = parseCleanedText(cleanedText); // assuming parseCleanedText is your existing parser logic
        }

        if (Array.isArray(data.products)) {
          const formatted = data.products.map((p) => ({
            productName: p?.productName || p?.name || "",
            quantity: p?.quantity || "",
            unit: p?.unit || "",
            costPrice: p?.cost || p?.costPrice || "",
            sellingPrice: "",
            brand: p?.brand || "",
            category: p?.category || "",
            description: p?.description || "",
            sku: p?.sku || "",
            imageUrl: p?.imageUrl || ""
          })).filter(p => p.productName);
          setProducts(formatted);
          toast.success("OCR scan completed!");
        } else {
          toast.error("No valid product data found.");
        }
      } catch (error) {
        console.error("OCR failed:", error);
        toast.error("Failed to scan image.");
      }

      setLoading(false);
    };

    // Allow image and PDF preview
    if (imageFile.type === "application/pdf" || imageFile.type.startsWith("image/")) {
      reader.readAsDataURL(imageFile);
    } else {
      toast.error("Unsupported file format. Please upload an image or PDF.");
      setLoading(false);
    }
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
    <div className="bg-white p-4 rounded shadow-md">
      <label className="block mb-2 font-medium">Upload Inventory Image</label>
      <input type="file" accept="image/*" onChange={handleImageChange} className="block border border-gray-300 rounded p-2" />
      {imagePreview && (
        <div className="mt-4">
          <img src={imagePreview} alt="Preview" className="max-w-xs rounded shadow" />
        </div>
      )}
      <button
        onClick={handleScan}
        disabled={!imageFile || loading}
        className={`mt-4 px-4 py-2 rounded ${
          loading || !imageFile ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        } text-white transition duration-200`}
      >
        {loading ? "Scanning..." : "Scan & Import"}
      </button>

      {products.length > 0 && (
        <>
          <div className="border p-2 rounded mt-4">
            <h3 className="font-semibold mb-2">Scanned Products</h3>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full bg-white border rounded shadow">
                <thead>
                  <tr className="bg-gray-100 text-left text-sm">
                    <th className="p-2 border">#</th>
                    <th className="p-2 border">Product Name</th>
                    <th className="p-2 border">Quantity</th>
                    <th className="p-2 border">Unit</th>
                    <th className="p-2 border">Cost Price</th>
                    <th className="p-2 border">Selling Price</th>
                    <th className="p-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item, index) => (
                    <tr key={index} className="text-sm">
                      <td className="p-2 border">{index + 1}</td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={item.productName || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].productName = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].quantity = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={item.unit || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].unit = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          value={item.costPrice || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].costPrice = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="number"
                          value={item.sellingPrice || ""}
                          onChange={(e) => {
                            const newProducts = [...products];
                            newProducts[index].sellingPrice = e.target.value;
                            setProducts(newProducts);
                          }}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-2 border">
                        <button
                          onClick={() => {
                            const newProducts = products.filter((_, i) => i !== index);
                            setProducts(newProducts);
                          }}
                          className="text-red-600 hover:text-red-800"
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
            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition duration-200"
          >
            Save All Products
          </button>
        </>
      )}
    </div>
  );
};

export default OCRUploadForm;