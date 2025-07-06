import React, { useState } from "react";
import { db, storage } from "../../firebase/firebaseConfig";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth, getCurrentUserId } from "../../context/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
    <div className="bg-white rounded p-4 mt-4 shadow">
      <h2 className="text-lg font-semibold mb-4">Add Inventory Manually</h2>
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
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="sku"
          placeholder="SKU"
          value={formData.sku}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="brand"
          placeholder="Brand"
          value={formData.brand}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="category"
          placeholder="Category"
          value={formData.category}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="quantity"
          placeholder="Quantity"
          value={formData.quantity}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="costPrice"
          placeholder="Cost Price"
          value={formData.costPrice}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="number"
          name="sellingPrice"
          placeholder="Selling Price"
          value={formData.sellingPrice}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
        <input
          type="text"
          name="unit"
          placeholder="Unit (e.g., box, piece)"
          value={formData.unit}
          onChange={handleChange}
          className="border p-2 rounded"
        />
        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          className="border p-2 rounded col-span-2"
        />
        <div className="col-span-2">
          <input
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
            className="mb-2"
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Product preview"
              className="h-24 w-24 object-cover rounded border"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 col-span-2"
        >
          {uploading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default ManualEntryForm;
