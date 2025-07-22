// Ensure environment variable is used for OCR endpoint
import React, { useState } from "react";
import { storage, db } from "../../firebase/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection } from "firebase/firestore";
import { toast } from "react-toastify";

const OCRUploadForm = ({ userId }) => {
  const [imageFile, setImageFile] = useState(null);
  const [previewURL, setPreviewURL] = useState("");
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (
      file &&
      file.size <= 5 * 1024 * 1024 &&
      (file.type.includes("image") || file.type === "application/pdf")
    ) {
      setImageFile(file);
      setPreviewURL(URL.createObjectURL(file));
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
       import.meta.env.VITE_REACT_APP_OCR_FUNCTION_URL ||
       (import.meta.env.MODE === "development"
         ? "http://localhost:5001/stockpilotv1/us-central1/ocrScan"
         : "https://us-central1-stockpilotv1.cloudfunctions.net/ocrScan");
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
        ...product,
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
    if (!products.length || !userId) {
      toast.error("No products to save or user not authenticated.");
      return;
    }

    try {
      const batch = products.map((p) =>
        addDoc(collection(db, "businesses", userId, "products"), {
          ...p,
          createdAt: new Date(),
        })
      );
      await Promise.all(batch);
      toast.success("Products saved to inventory.");
      setProducts([]);
      setImageFile(null);
      setPreviewURL("");
    } catch (err) {
      toast.error("Failed to save products.");
      console.error(err);
    }
  };

  const handleDeleteRow = (index) => {
    const filtered = products.filter((_, i) => i !== index);
    setProducts(filtered);
  };

  return (
    <div className="p-4 bg-white rounded shadow-md">
      {process.env.NODE_ENV === "development" && (
        <p className="text-xs text-gray-500 mb-1">
          {userId ? `User Authenticated: ${userId}` : "User not authenticated"}
        </p>
      )}
      <h3 className="text-lg font-semibold mb-2">OCR Inventory Upload</h3>
      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} />
      {previewURL && (
        <img
          src={previewURL}
          alt="Preview"
          className="mt-2 w-40 h-40 object-cover border rounded"
        />
      )}
      <button
        onClick={handleScan}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        disabled={uploading || !imageFile}
      >
        {uploading ? "Scanning..." : "Scan & Import"}
      </button>

      {products.length > 0 && (
        <>
          <table className="mt-4 w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th>Product</th>
                <th>Brand</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Cost</th>
                <th>Sell</th>
                <th>Desc</th>
                <th>🗑️</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  {["productName", "brand", "quantity", "unit", "costPrice", "sellingPrice", "description"].map((f) => (
                    <td key={f}>
                      <input
                        type="text"
                        value={p[f]}
                        onChange={(e) => handleInputChange(i, f, e.target.value)}
                        className="border w-full px-1"
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      onClick={() => handleDeleteRow(i)}
                      className="text-red-600 hover:text-red-800"
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
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
          >
            Save Products
          </button>
        </>
      )}
    </div>
  );
};

export default OCRUploadForm;