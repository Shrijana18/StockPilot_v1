

import { useState } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const AIAutogenForm = ({ distributorId }) => {
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Handles generating product ideas using OpenAI via Cloud Function
  const handleGenerate = async () => {
    if (!category || !brand) return;
    setLoading(true);

    try {
      const response = await fetch("https://us-central1-stockpilotv1.cloudfunctions.net/generateInventoryAI", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, brand })
      });

      const data = await response.json();
      if (Array.isArray(data.products)) {
        setProducts(data.products);
      } else {
        alert("No product suggestions found.");
      }
    } catch (err) {
      console.error("AI generation failed:", err);
      alert("Failed to generate inventory.");
    }

    setLoading(false);
  };

  // Saves all generated products to Firestore
  const handleSaveAll = async () => {
    if (!products.length) return;

    const promises = products.map((item) =>
      addDoc(collection(db, "businesses", distributorId, "products"), {
        ...item,
        timestamp: serverTimestamp()
      })
    );

    try {
      await Promise.all(promises);
      alert("Generated products saved!");
      setProducts([]);
    } catch (err) {
      console.error("Saving failed:", err);
      alert("Failed to save products.");
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Category (e.g. Snacks)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="input"
      />
      <input
        type="text"
        placeholder="Brand (e.g. Lay's)"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        className="input"
      />
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? "Generating..." : "Generate Products"}
      </button>

      {products.length > 0 && (
        <>
          <div className="border p-2 rounded">
            <h3 className="font-semibold mb-2">Suggested Products</h3>
            <ul className="space-y-2">
              {products.map((item, index) => (
                <li key={index} className="bg-gray-50 p-2 rounded border">
                  {item.productName} — ₹{item.sellingPrice} ({item.quantity})
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Save All Products
          </button>
        </>
      )}
    </div>
  );
};

export default AIAutogenForm;