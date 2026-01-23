
import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { logInventoryChange } from "../../utils/logInventoryChange";
import {
  calculateSellingUnitPrice,
  calculateSellingUnitStock,
  validateLooseProductConfig,
} from "../../utils/looseProductUtils";
import { toast } from "react-toastify";

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
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === "quantity" || name === "costPrice" || name === "sellingPrice" || 
                name === "conversionFactor" || name === "baseUnitCost" || name === "baseUnitSellingPrice" ||
                name === "sellingUnitPrice" || name === "minSellingQuantity"
          ? (value === "" ? "" : parseFloat(value))
          : value,
      };

      // Auto-calculate selling unit price and stock when loose product fields change
      if (updated.isLooseProduct && (name === "baseUnitSellingPrice" || name === "conversionFactor" || name === "quantity")) {
        const basePrice = updated.baseUnitSellingPrice || updated.sellingPrice || 0;
        const factor = updated.conversionFactor || 1;
        if (basePrice > 0 && factor > 0) {
          updated.sellingUnitPrice = calculateSellingUnitPrice(basePrice, factor);
        }
        if (updated.quantity !== undefined && factor > 0) {
          updated.stockInSellingUnit = calculateSellingUnitStock(updated.quantity, factor);
        }
      }

      return updated;
    });
  };

  const handleSave = async () => {
    if (!formData || !userId || !productId) return;

    // Validate loose product config if enabled
    if (formData.isLooseProduct) {
      const validation = validateLooseProductConfig({
        isLooseProduct: true,
        baseUnit: formData.baseUnit,
        sellingUnit: formData.sellingUnit,
        conversionFactor: parseFloat(formData.conversionFactor) || 0,
      });
      
      if (!validation.valid) {
        toast.error(validation.errors[0]);
        return;
      }

      // Recalculate loose product fields
      const conversionFactor = parseFloat(formData.conversionFactor) || 1;
      const basePrice = formData.baseUnitSellingPrice || formData.sellingPrice || 0;
      formData.sellingUnitPrice = calculateSellingUnitPrice(basePrice, conversionFactor);
      formData.stockInSellingUnit = calculateSellingUnitStock(formData.quantity || 0, conversionFactor);
    }

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

    toast.success("Product updated successfully!");
    onClose();
  };

  if (!isOpen || !formData) return null;

  const isLooseProduct = formData.isLooseProduct || false;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl shadow-2xl border border-white/10 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Edit Product</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Product Name</label>
              <input
                name="productName"
                value={formData.productName || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">SKU</label>
              <input
                name="sku"
                value={formData.sku || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
          </div>

          {/* Loose Product Toggle */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isLooseProduct}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    isLooseProduct: e.target.checked,
                    ...(e.target.checked && !prev.baseUnit ? {
                      baseUnit: prev.unit || "",
                      baseUnitCost: prev.costPrice || 0,
                      baseUnitSellingPrice: prev.sellingPrice || 0,
                      conversionFactor: 1,
                      sellingUnit: "",
                      minSellingQuantity: 1,
                    } : {}),
                  }));
                }}
                className="w-5 h-5 accent-emerald-400"
              />
              <div>
                <span className="text-white font-medium">🛒 Sell as Loose Product</span>
                <p className="text-xs text-white/60 mt-1">
                  Enable for products sold in smaller quantities (chocolates, tablets, rice by weight)
                </p>
              </div>
            </label>
          </div>

          {/* Loose Product Fields */}
          {isLooseProduct && (
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-4">
              <h3 className="text-sm font-semibold text-purple-300 mb-3">Loose Product Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Base Unit (What you buy)</label>
                  <input
                    name="baseUnit"
                    value={formData.baseUnit || ""}
                    onChange={handleChange}
                    placeholder="e.g., 1 Packet (100 pieces)"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Selling Unit (What you sell)</label>
                  <input
                    name="sellingUnit"
                    value={formData.sellingUnit || ""}
                    onChange={handleChange}
                    placeholder="e.g., 1 piece"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Conversion Factor</label>
                  <input
                    name="conversionFactor"
                    type="number"
                    step="0.01"
                    value={formData.conversionFactor || ""}
                    onChange={handleChange}
                    placeholder="e.g., 100"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                  <p className="text-xs text-white/50 mt-1">
                    How many {formData.sellingUnit || "selling units"} = 1 {formData.baseUnit || "base unit"}?
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Min. Selling Quantity</label>
                  <input
                    name="minSellingQuantity"
                    type="number"
                    step="0.01"
                    value={formData.minSellingQuantity || 1}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Base Unit Cost (₹)</label>
                  <input
                    name="baseUnitCost"
                    type="number"
                    step="0.01"
                    value={formData.baseUnitCost || formData.costPrice || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Base Unit Selling Price (₹)</label>
                  <input
                    name="baseUnitSellingPrice"
                    type="number"
                    step="0.01"
                    value={formData.baseUnitSellingPrice || formData.sellingPrice || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                </div>
              </div>

              {/* Calculated Values */}
              {formData.baseUnitSellingPrice && formData.conversionFactor && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-emerald-300 font-medium mb-1">Calculated Values</div>
                  <div className="text-sm text-white">
                    Selling Price: ₹{formData.sellingUnitPrice?.toFixed(2) || calculateSellingUnitPrice(
                      parseFloat(formData.baseUnitSellingPrice) || 0,
                      parseFloat(formData.conversionFactor) || 1
                    ).toFixed(2)} per {formData.sellingUnit || "selling unit"}
                  </div>
                  {formData.quantity !== undefined && (
                    <div className="text-xs text-white/70 mt-1">
                      Available: {formData.stockInSellingUnit || calculateSellingUnitStock(
                        parseFloat(formData.quantity) || 0,
                        parseFloat(formData.conversionFactor) || 1
                      )} {formData.sellingUnit || "selling units"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Regular Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Quantity {isLooseProduct ? "(Base Units)" : ""}</label>
              <input
                name="quantity"
                type="number"
                step={isLooseProduct ? "0.01" : "1"}
                value={formData.quantity || 0}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            {!isLooseProduct && (
              <div>
                <label className="block text-sm text-white/70 mb-1">Unit</label>
                <input
                  name="unit"
                  value={formData.unit || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                />
              </div>
            )}
            <div>
              <label className="block text-sm text-white/70 mb-1">Cost Price (₹)</label>
              <input
                name="costPrice"
                type="number"
                step="0.01"
                value={formData.costPrice || 0}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            {!isLooseProduct && (
              <div>
                <label className="block text-sm text-white/70 mb-1">Selling Price (₹)</label>
                <input
                  name="sellingPrice"
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice || 0}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;