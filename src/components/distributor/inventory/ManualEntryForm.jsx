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
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded shadow">
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          name="productName"
          placeholder="Product Name"
          value={form.productName}
          onChange={handleChange}
          className="border p-2 rounded w-full"
          required
        />
        <input
          type="text"
          name="sku"
          placeholder="SKU"
          value={form.sku}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          name="brand"
          placeholder="Brand"
          value={form.brand}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
        <input
          type="number"
          name="quantity"
          placeholder="Quantity"
          value={form.quantity}
          onChange={handleChange}
          className="border p-2 rounded w-full"
          required
        />
        <input
          type="number"
          name="costPrice"
          placeholder="Cost Price"
          value={form.costPrice}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
        <input
          type="number"
          name="sellingPrice"
          placeholder="Selling Price"
          value={form.sellingPrice}
          onChange={handleChange}
          className="border p-2 rounded w-full"
          required
        />
        <input
          type="text"
          name="unit"
          placeholder="Unit (e.g., kg, box)"
          value={form.unit}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
      </div>
      <textarea
        name="description"
        placeholder="Description"
        value={form.description}
        onChange={handleChange}
        className="border p-2 rounded w-full"
      />
      <div className="flex items-center space-x-4">
        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
      </div>
      {preview && (
        <div className="mt-2">
          <img
            src={preview}
            alt="Preview"
            className="h-32 w-32 object-cover border rounded"
          />
        </div>
      )}
      <div className="mt-4">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
          disabled={loading}
        >
          {loading ? "Saving..." : "Add Product"}
        </button>
      </div>
    </form>
  );
};

export default ManualEntryForm;