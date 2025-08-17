import React, { useState } from "react";
import { db, storage } from "../../firebase/firebaseConfig";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth, getCurrentUserId } from "../../context/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { logInventoryChange } from "../../utils/logInventoryChange";

const ManualEntryForm = () => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    productName: "",
    sku: "",
    brand: "",
    category: "",
    quantity: "",
    costPrice: "",
    sellingPrice: "",
    unit: "",
    description: "",
    image: null,
  });

  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      const file = files[0];
      setFormData({ ...formData, image: file });
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userId = getCurrentUserId();
    if (!userId) return;

    setUploading(true);

    const { productName, sku, quantity, costPrice, sellingPrice } = formData;
    if (!productName || !sku || !quantity || !costPrice || !sellingPrice) {
      toast.error("Please fill all required fields");
      setUploading(false);
      return;
    }

    try {
      let imageUrl = "";
      if (formData.image) {
        const imageRef = ref(storage, `inventory/${userId}/${Date.now()}_${formData.image.name}`);
        await uploadBytes(imageRef, formData.image);
        imageUrl = await getDownloadURL(imageRef);
      }

      const productRef = doc(collection(db, "businesses", userId, "products"));
      await setDoc(productRef, {
        productName: formData.productName,
        sku: formData.sku,
        brand: formData.brand,
        category: formData.category,
        quantity: formData.quantity,
        costPrice: formData.costPrice,
        sellingPrice: formData.sellingPrice,
        unit: formData.unit,
        description: formData.description,
        imageUrl, // ✅ Only storing URL
        id: productRef.id,
        createdAt: serverTimestamp(),
        addedBy: userId,
      });

      await logInventoryChange({
        productId: productRef.id,
        sku: formData.sku,
        previousData: {}, // since it's a new product
        updatedData: {
          productName: formData.productName,
          sku: formData.sku,
          brand: formData.brand,
          category: formData.category,
          quantity: formData.quantity,
          costPrice: formData.costPrice,
          sellingPrice: formData.sellingPrice,
          unit: formData.unit,
          description: formData.description,
          imageUrl,
        },
        action: "created",
        source: "manual",
      });

      toast.success("✅ Product added successfully!");

      setFormData({
        productName: "",
        sku: "",
        brand: "",
        category: "",
        quantity: "",
        costPrice: "",
        sellingPrice: "",
        unit: "",
        description: "",
        image: null,
      });
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("❌ Failed to add product. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 mt-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Add Inventory Manually</h2>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <input
          type="text"
          name="productName"
          placeholder="Product Name"
          value={formData.productName}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="sku"
          placeholder="SKU"
          value={formData.sku}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="brand"
          placeholder="Brand"
          value={formData.brand}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="category"
          placeholder="Category"
          value={formData.category}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="number"
          name="quantity"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="number"
          name="costPrice"
          placeholder="Cost Price"
          value={formData.costPrice}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="number"
          name="sellingPrice"
          placeholder="Selling Price"
          value={formData.sellingPrice}
          onChange={handleChange}
          required
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <input
          type="text"
          name="unit"
          placeholder="Unit (e.g., box, piece)"
          value={formData.unit}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          className="p-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 col-span-2"
        />
        <div className="col-span-2">
          <input
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
            className="mb-2 p-2 rounded bg-white/10 border border-white/20 text-white file:bg-white/10 file:border-0 file:px-3 file:py-1 file:mr-3 file:rounded cursor-pointer"
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Product preview"
              className="h-24 w-24 object-cover rounded border border-white/20 ring-1 ring-white/10"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] col-span-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default ManualEntryForm;
