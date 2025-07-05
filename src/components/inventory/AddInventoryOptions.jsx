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
          className="space-y-4 mt-6 bg-white p-6 rounded shadow"
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
          <input type="text" name="productName" placeholder="Product Name" className="w-full border p-2 rounded" required />
          <input type="text" name="sku" placeholder="SKU" className="w-full border p-2 rounded" />
          <input type="text" name="brand" placeholder="Brand" className="w-full border p-2 rounded" />
          <input type="text" name="category" placeholder="Category" className="w-full border p-2 rounded" />
          <input type="number" name="quantity" placeholder="Quantity" className="w-full border p-2 rounded" required />
          <input type="text" name="unit" placeholder="Unit (e.g. pcs, box)" className="w-full border p-2 rounded" />
          <input type="number" name="costPrice" placeholder="Cost Price" className="w-full border p-2 rounded" />
          <input type="number" name="sellingPrice" placeholder="Selling Price" className="w-full border p-2 rounded" />
          <textarea name="description" placeholder="Description" className="w-full border p-2 rounded" />

          <input type="file" name="productImage" accept="image/*" className="w-full border p-2 rounded" />

          <div className="flex justify-between mt-4">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Submit</button>
            <button type="button" onClick={() => setSelectedForm(null)} className="bg-red-500 text-white px-4 py-2 rounded">Cancel</button>
          </div>
        </form>
      );
    }

    if (selectedForm === "ocr") {
      return (
        <div className="mt-6 text-gray-500">OCR form coming soon.</div>
      );
    }

    if (selectedForm === "ai") {
      return (
        <div className="mt-6 text-gray-500">AI auto-generation coming soon.</div>
      );
    }

    return null;
  };

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Inventory Input Method</h2>
      <div className="flex gap-4">
        <button onClick={() => setSelectedForm("manual")} className="bg-blue-600 text-white px-4 py-2 rounded">Manual Entry</button>
        <button onClick={() => setSelectedForm("ocr")} className="bg-yellow-600 text-white px-4 py-2 rounded">OCR Upload</button>
        <button onClick={() => setSelectedForm("ai")} className="bg-purple-600 text-white px-4 py-2 rounded">AI Generate</button>
      </div>

      {renderForm()}
    </div>
  );
};

export default AddInventoryOptions;