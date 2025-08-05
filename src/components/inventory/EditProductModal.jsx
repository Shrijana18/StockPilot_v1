

import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { logInventoryChange } from "../../utils/logInventoryChange";

const EditProductModal = ({ isOpen, onClose, productId, userId }) => {
  const [formData, setFormData] = useState(null);
  const [originalData, setOriginalData] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (productId && userId) {
        const docRef = doc(db, "businesses", userId, "products", productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data());
          setOriginalData(docSnap.data());
        }
      }
    };

    if (isOpen) {
      fetchProduct();
    }
  }, [isOpen, productId, userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantity" || name === "costPrice" || name === "sellingPrice"
        ? parseFloat(value)
        : value,
    }));
  };

  const handleSave = async () => {
    if (!formData || !userId || !productId) return;

    const docRef = doc(db, "businesses", userId, "products", productId);
    await updateDoc(docRef, formData);

    await logInventoryChange({
      userId,
      productId,
      sku: formData.sku,
      previousData: originalData,
      updatedData: formData,
      action: "updated",
      source: "manual-edit",
    });

    onClose();
  };

  if (!isOpen || !formData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl">
        <h2 className="text-lg font-semibold mb-4">Edit Product</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">Name</label>
            <input
              name="name"
              value={formData.name || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm">SKU</label>
            <input
              name="sku"
              value={formData.sku || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm">Quantity</label>
            <input
              name="quantity"
              type="number"
              value={formData.quantity || 0}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm">Cost Price</label>
            <input
              name="costPrice"
              type="number"
              value={formData.costPrice || 0}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm">Selling Price</label>
            <input
              name="sellingPrice"
              type="number"
              value={formData.sellingPrice || 0}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;