import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { db, storage } from "../../../firebase/firebaseConfig";
import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "firebase/storage";

const ManualEntryForm = () => {
  const { user: currentUser } = useAuth();
  // Early fallback if currentUser is undefined
  if (!currentUser) {
    console.warn("No current user found in context.");
    return <div className="p-4 text-red-500">Loading user info...</div>;
  }

  const [form, setForm] = useState({
    productName: "",
    sku: "",
    brand: "",
    category: "",
    quantity: "",
    costPrice: "",
    sellingPrice: "",
    unit: "",
    description: "",
    image: null
  });

  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      const file = files?.[0];
      if (!file || !(file instanceof File) || !file.name) {
        toast.error("Invalid image file.");
        return;
      }
      setForm((prev) => ({ ...prev, image: file }));

      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Debug log for currentUser
    console.log("Manual Entry - currentUser:", currentUser);

    if (!currentUser?.uid) {
      toast.error("User ID is missing in manual entry. Cannot save product.");
      setLoading(false);
      return;
    }

    const userId = currentUser.uid;

    try {
      let imageUrl = "";

      if (form.image && form.image instanceof File) {
        let fileName = form.image?.name;
        if (!fileName || typeof fileName !== "string" || fileName.trim() === "") {
          fileName = `product_${Date.now()}.jpg`;
        }

        const imageRef = ref(storage, `products/${userId}/${fileName}`);
        await uploadBytes(imageRef, form.image);
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(
        collection(db, "businesses", userId, "products"),
        {
          productName: form.productName || "",
          brand: form.brand || "",
          category: form.category || "",
          quantity: form.quantity ? Number(form.quantity) : 0,
          unit: form.unit || "",
          costPrice: form.costPrice ? Number(form.costPrice) : 0,
          sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : 0,
          description: form.description || "",
          sku: form.sku || "",
          imageUrl,
          createdAt: serverTimestamp(),
          addedBy: userId
        }
      );

      toast.success("Product added successfully!");
      setForm({
        productName: "",
        sku: "",
        brand: "",
        category: "",
        quantity: "",
        costPrice: "",
        sellingPrice: "",
        unit: "",
        description: "",
        image: null
      });
      setPreview("");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to add product.");
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          name="productName"
          placeholder="Product Name"
          value={form.productName}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
          required
        />
        <input
          type="text"
          name="sku"
          placeholder="SKU"
          value={form.sku}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
        />
        <input
          type="text"
          name="brand"
          placeholder="Brand"
          value={form.brand}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
        />
        <input
          type="text"
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
        />
        <input
          type="number"
          name="quantity"
          placeholder="Quantity"
          value={form.quantity}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
          required
        />
        <input
          type="number"
          name="costPrice"
          placeholder="Cost Price"
          value={form.costPrice}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
        />
        <input
          type="number"
          name="sellingPrice"
          placeholder="Selling Price"
          value={form.sellingPrice}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
          required
        />
        <input
          type="text"
          name="unit"
          placeholder="Unit (e.g., kg, box)"
          value={form.unit}
          onChange={handleChange}
          className="w-full rounded-lg px-3 py-2 bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
        />
      </div>
      <textarea
        name="description"
        placeholder="Description"
        value={form.description}
        onChange={handleChange}
        className="w-full rounded-lg px-3 py-2 min-h-[96px] bg-slate-800/60 border border-white/10 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/40"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <div className="rounded-lg border border-dashed border-white/20 bg-slate-800/50 p-3 hover:border-emerald-400/40 transition">
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={handleChange}
              className="w-full bg-transparent border-0 text-white file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-emerald-500/10 file:text-emerald-200 file:hover:bg-emerald-500/20 focus:outline-none"
            />
            <p className="mt-2 text-xs text-white/50">PNG or JPG preferred. Keep under ~1 MB for faster save.</p>
          </div>
        </div>
        <div>
          {preview ? (
            <img src={preview} alt="Preview" className="h-28 w-28 object-cover border border-white/20 rounded-lg shadow" />
          ) : (
            <div className="h-28 w-28 rounded-lg border border-dashed border-white/15 bg-slate-800/40 grid place-items-center text-[11px] text-white/40">No image</div>
          )}
        </div>
      </div>
      <div className="pt-2">
        <button
          type="submit"
          className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-500 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Saving..." : "Add Product"}
        </button>
      </div>
    </form>
  );
};

export default ManualEntryForm;