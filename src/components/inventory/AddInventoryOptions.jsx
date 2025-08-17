import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../../firebase/firebaseConfig";

const AddInventoryOptions = () => {
  const [selectedForm, setSelectedForm] = useState(null);

  const renderForm = () => {
    if (selectedForm === "manual") {
      return (
        <form
          className="space-y-4 mt-6 p-6 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
          onSubmit={async (e) => {
            e.preventDefault();
            const auth = getAuth();
            const db = getFirestore(app);
            const user = auth.currentUser;
            if (!user) {
              alert("User not authenticated");
              return;
            }

            const formData = new FormData(e.target);
            const product = {
              productName: formData.get("productName"),
              sku: formData.get("sku"),
              brand: formData.get("brand"),
              category: formData.get("category"),
              quantity: parseInt(formData.get("quantity")),
              unit: formData.get("unit"),
              costPrice: parseFloat(formData.get("costPrice")),
              sellingPrice: parseFloat(formData.get("sellingPrice")),
              description: formData.get("description"),
              timestamp: serverTimestamp(),
            };

            try {
              await addDoc(collection(db, "businesses", user.uid, "products"), product);
              alert("Product added successfully!");
              e.target.reset();
              setSelectedForm(null);
            } catch (error) {
              console.error("Error adding product:", error);
              alert("Failed to add product.");
            }
          }}
          id="add-product-form"
        >
          <input type="text" name="productName" placeholder="Product Name" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" required />
          <input type="text" name="sku" placeholder="SKU" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <input type="text" name="brand" placeholder="Brand" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <input type="text" name="category" placeholder="Category" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <input type="number" name="quantity" placeholder="Quantity" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" required />
          <input type="text" name="unit" placeholder="Unit (e.g. pcs, box)" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <input type="number" name="costPrice" placeholder="Cost Price" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <input type="number" name="sellingPrice" placeholder="Selling Price" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <textarea name="description" placeholder="Description" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />

          <input type="file" name="productImage" accept="image/*" className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />

          <div className="flex justify-between mt-4">
            <button type="submit" className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]">Submit</button>
            <button type="button" onClick={() => setSelectedForm(null)} className="px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15">Cancel</button>
          </div>
        </form>
      );
    }

    if (selectedForm === "ocr") {
      return (
        <div className="mt-6 text-white/70">OCR form coming soon.</div>
      );
    }

    if (selectedForm === "ai") {
      return (
        <div className="mt-6 text-white/70">AI auto-generation coming soon.</div>
      );
    }

    return null;
  };

  return (
    <div className="mt-6 text-white">
      <h2 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Select Inventory Input Method</h2>
      <div className="flex gap-4">
        <button
          onClick={() => setSelectedForm("manual")}
          className={`px-4 py-2 rounded-xl transition ${selectedForm === "manual" ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]" : "bg-white/10 text-white hover:bg-white/15 border border-white/15"}`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setSelectedForm("ocr")}
          className={`px-4 py-2 rounded-xl transition ${selectedForm === "ocr" ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]" : "bg-white/10 text-white hover:bg-white/15 border border-white/15"}`}
        >
          OCR Upload
        </button>
        <button
          onClick={() => setSelectedForm("ai")}
          className={`px-4 py-2 rounded-xl transition ${selectedForm === "ai" ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]" : "bg-white/10 text-white hover:bg-white/15 border border-white/15"}`}
        >
          AI Generate
        </button>
      </div>

      {renderForm()}
    </div>
  );
};

export default AddInventoryOptions;