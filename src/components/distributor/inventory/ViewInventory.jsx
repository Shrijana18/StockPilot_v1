import { getStorage, ref, getDownloadURL, uploadBytes, getBlob } from "firebase/storage";
import React from "react";
import { useState, useEffect } from "react";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import fetchGoogleImages from "../../../utils/fetchGoogleImages";
import { logInventoryChange } from "../../../utils/logInventoryChange";
import { collection as fsCollection, query, orderBy, onSnapshot as fsOnSnapshot } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
// Removed useAuth because we will pass userId as prop
import EditProductModal from "../../inventory/EditProductModal";

const DeleteConfirmationModal = ({
  product,
  confirmationText,
  onChange,
  onCancel,
  onConfirm
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
    <div className="bg-white rounded shadow-lg p-6 w-[90%] md:w-[400px]">
      <h2 className="text-lg font-semibold mb-2 text-red-600">Delete Product?</h2>
      <p className="mb-4">
        Are you sure you want to delete <strong>{product?.productName || "this product"}</strong> (SKU: <strong>{product?.sku || "N/A"}</strong>)?
      </p>
      <p className="mb-2 text-sm text-gray-600">
        Type <code className="bg-gray-100 px-1 rounded border">delete</code> to confirm.
      </p>
      <input
        type="text"
        className="w-full border rounded px-3 py-1 mb-4"
        placeholder='Type "delete" to confirm'
        value={confirmationText}
        onChange={onChange}
      />
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={confirmationText.trim().toLowerCase() !== "delete"}
          className={`px-4 py-2 rounded text-white ${
            confirmationText.trim().toLowerCase() === "delete"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

// Add toast import if not present
import { toast } from "react-toastify";

const ViewInventory = ({ userId }) => {
  // Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingCell, setEditingCell] = useState({ rowId: null, field: null });
  const [editedValue, setEditedValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const [availableBrands, setAvailableBrands] = useState([]);
  // Modal states for deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetProduct, setDeleteTargetProduct] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  // Modal states for image upload
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageTargetProduct, setImageTargetProduct] = useState(null);
  const [imageUploadFile, setImageUploadFile] = useState(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  // Unsplash AI image search states
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashImages, setUnsplashImages] = useState([]);

  // Google AI Image Search Modal states
  const [showImageModalAI, setShowImageModalAI] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResults, setAiSearchResults] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Recently Modified tab state
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [selectedTab, setSelectedTab] = useState("view");

  // For compatibility with handleSelectUnsplashImage
  // We'll store the selected Unsplash image URL in imagePreviewUrl, and imageUploadFile remains null
  const handleUnsplashSearch = async () => {
    try {
      const accessKey = 'n_BViYvOrSv2B6zb_SIHtZu3fnUEijs_KVuD7IXYTVc';
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${unsplashQuery}&client_id=${accessKey}`
      );
      const data = await res.json();
      setUnsplashImages(data.results);
    } catch (err) {
      console.error('Error fetching from Unsplash:', err);
    }
  };

  const handleSelectUnsplashImage = (url) => {
    setImageUploadFile(null);
    setImageUploadError("");
    setImagePreviewUrl(url); // preview the selected Unsplash image
  };

  const handleAISearch = async () => {
    if (!aiSearchQuery) return;
    setIsAiLoading(true);
    const results = await fetchGoogleImages(aiSearchQuery);
    setAiSearchResults(results || []);
    setIsAiLoading(false);
  };
  const [viewMode, setViewMode] = useState("list");
  const db = getFirestore();

  // Prevent rendering if userId is not available
  if (!userId) {
    return <div className="text-center p-4">Loading user data...</div>;
  }

  useEffect(() => {
    if (!userId) return;
    console.log("Current user UID:", userId);
    const productRef = collection(db, "businesses", userId, "products");
    const unsubscribe = onSnapshot(productRef, async (snapshot) => {
      const storage = getStorage();
      const productList = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          let imageUrl = "";
          try {
            if (data.imageUrl) {
              imageUrl = data.imageUrl;
            } else if (data.imagePath) {
              const imageRef = ref(storage, data.imagePath);
              imageUrl = await getDownloadURL(imageRef);
            }
          } catch (err) {
            console.warn("Image fetch error for:", data.imagePath || "unknown", err.message);
          }
          return { id: doc.id, ...data, imageUrl, imagePath: data.imagePath || "" };
        })
      );
      setProducts(productList);
      setFiltered(productList);
      const uniqueBrands = [...new Set(productList.map(p => p.brand).filter(Boolean))];
      setAvailableBrands(uniqueBrands);
    });

    return () => unsubscribe(); // cleanup on unmount
  }, [userId]);

  // Fetch inventoryLogs for Recently Modified tab
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const q = query(
      fsCollection(db, `businesses/${auth.currentUser.uid}/inventoryLogs`),
      orderBy("modifiedAt", "desc")
    );
    const unsubscribe = fsOnSnapshot(q, (snapshot) => {
      setInventoryLogs(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const s = search.toLowerCase();
    const result = products.filter(p => {
      const matchesSearch =
        p.productName?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s);
      const matchesStatus = !statusFilter || getStatus(p.quantity) === statusFilter;
      // Multi-select: match if product's brand is in selected brands (OR logic)
      const matchesBrand =
        brandFilter.length === 0 || (p.brand && brandFilter.includes(p.brand));
      return matchesSearch && matchesStatus && matchesBrand;
    });
    setFiltered(result);
  }, [search, products, statusFilter, brandFilter]);

  useEffect(() => {
    if (!sortKey) {
      setFiltered((prev) => [...prev]);
      return;
    }
    // Sort the filtered list
    setFiltered((prevFiltered) => {
      const sorted = [...prevFiltered].sort((a, b) => {
        const valA = parseFloat(a[sortKey]) || 0;
        const valB = parseFloat(b[sortKey]) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
      return sorted;
    });
  }, [sortKey, sortOrder]);

  const startEdit = (rowId, field, currentValue) => {
    setEditingCell({ rowId, field });
    setEditedValue(currentValue);
  };

  const saveEdit = async (rowId, field, value) => {
    try {
      const productRef = doc(db, "businesses", userId, "products", rowId);

      // Get original data
      const originalSnap = await getDoc(productRef);
      const originalData = originalSnap.exists() ? originalSnap.data() : {};

      await updateDoc(productRef, { [field]: value });

      // Call logInventoryChange with proper Firestore field names for productName, brand, category
      await logInventoryChange({
        userId,
        productId: rowId,
        sku: originalData.sku || "N/A",
        productName: originalData.productName || "N/A",
        brand: originalData.brand || "N/A",
        category: originalData.category || "N/A",
        previousData: originalData,
        updatedData: { ...originalData, [field]: value },
        action: "updated",
        source: "inline-edit",
      });
    } catch (err) {
      console.error("Error updating inventory field:", err);
    } finally {
      setEditingCell({ rowId: null, field: null });
      setEditedValue("");
    }
  };

  const getStatus = (qty) => {
    const q = parseInt(qty);
    return isNaN(q) ? "Unknown" : q <= 5 ? "Low" : "In Stock";
  };

  // Delete modal logic
  const handleDelete = (product) => {
    setDeleteTargetProduct(product);
    setDeleteConfirmationText("");
    setShowDeleteModal(true);
  };

  // Only allow delete if user types "delete"
  const confirmDelete = async () => {
    if (!deleteTargetProduct) return;
    if (deleteConfirmationText.trim().toLowerCase() !== "delete") return;
    try {
      const productRef = doc(db, "businesses", userId, "products", deleteTargetProduct.id);
      await deleteDoc(productRef);
    } catch (err) {
      console.error("Error deleting product:", err);
    } finally {
      setShowDeleteModal(false);
      setDeleteTargetProduct(null);
      setDeleteConfirmationText("");
    }
  };

  // Image upload logic (for modal, keep as is)
  const handleImageClick = (product) => {
    setImageTargetProduct(product);
    setImageUploadFile(null);
    setImageUploadLoading(false);
    setImageUploadError("");
    setImagePreviewUrl(null);
    setShowImageModal(true);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageUploadFile(file);
    setImageUploadError("");
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  };

  // Updated handleImageUpload: supports uploading selected image from Google or Unsplash search
  const handleImageUpload = async () => {
    // The selected image can be a URL (from search) or a file upload
    if (!imageTargetProduct || (!imageUploadFile && !imagePreviewUrl)) {
      toast.error("No image selected");
      return;
    }

    setImageUploadLoading(true);
    setImageUploadError("");
    try {
      let imageUrl = null;
      let imagePath = null;
      if (imageUploadFile) {
        // If a file is uploaded, upload it to storage
        const storage = getStorage();
        const fileExt = imageUploadFile.name.split('.').pop();
        imagePath = `product_images/${userId}/${imageTargetProduct.id}.${fileExt}`;
        const storageRef = ref(storage, imagePath);
        await uploadBytes(storageRef, imageUploadFile);
        imageUrl = await getDownloadURL(storageRef);
      } else if (imagePreviewUrl) {
        // If a URL is selected (from Google/Unsplash search), use it directly
        imageUrl = imagePreviewUrl;
      }
      // update Firestore with new imageUrl (and imagePath if uploaded)
      const productRef = doc(getFirestore(), "businesses", userId, "products", imageTargetProduct.id);
      await updateDoc(productRef, imagePath ? { imageUrl, imagePath } : { imageUrl });
      toast.success("Image uploaded successfully");
      setShowImageModal(false);
      setImageTargetProduct(null);
      setImageUploadFile(null);
      setImagePreviewUrl(null);
    } catch (error) {
      console.error("Error uploading image:", error);
      setImageUploadError("Image upload failed: " + (error?.message || "Unknown error"));
      toast.error("Failed to upload image");
    } finally {
      setImageUploadLoading(false);
    }
  };

  // Grid view image upload handler
  const handleGridImageUpload = async (e, item) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `inventory/${userId}/${item.id}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(
        doc(getFirestore(), `businesses/${userId}/products/${item.id}`),
        { imageUrl: downloadURL }
      );
      toast.success(`Image updated for ${item.productName}`);
    } catch (err) {
      toast.error(`Failed to update image for ${item.productName}: ${err.message}`);
    }
  };

  // Google Image Fetch Logic for inventory table
  const handleFetchImages = async (item, index) => {
    const searchTerm = `${item.brand} ${item.productName} ${item.unit}`;
    try {
      const results = await fetchGoogleImages(searchTerm);
      if (results && results.length > 0) {
        // Update Firestore with the new imageUrl
        const productRef = doc(db, "businesses", userId, "products", item.id);
        await updateDoc(productRef, { imageUrl: results[0] });
        // Optionally update local state for immediate UI feedback
        setProducts((prev) => {
          const updated = prev.map((p, idx) =>
            idx === index ? { ...p, imageUrl: results[0] } : p
          );
          return updated;
        });
        setFiltered((prev) => {
          const updated = prev.map((p, idx) =>
            idx === index ? { ...p, imageUrl: results[0] } : p
          );
          return updated;
        });
        toast.success("Image fetched and applied!");
      } else {
        toast.info("No images found.");
      }
    } catch (err) {
      console.error("Image fetch error:", err);
      toast.error("Failed to fetch image.");
    }
  };

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
        <div className="flex items-center w-full md:w-1/3">
          <input
            type="text"
            placeholder="Search by name, brand, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-4 py-2 rounded w-full"
          />
          <button
            onClick={() => setShowImageModalAI(true)}
            className="ml-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded"
          >
            Search with AI
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border px-3 py-2 rounded"
            onChange={(e) => setSortKey(e.target.value)}
            value={sortKey}
          >
            <option value="">Sort by</option>
            <option value="quantity">Quantity</option>
            <option value="costPrice">Cost Price</option>
            <option value="sellingPrice">Selling Price</option>
          </select>
          <select
            className="border px-3 py-2 rounded"
            onChange={(e) => setSortOrder(e.target.value)}
            value={sortOrder}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <select
            className="border px-3 py-2 rounded"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low">Low</option>
          </select>
          <div className="relative">
            <button
              className="border px-3 py-2 rounded min-w-[120px] text-left bg-white"
              type="button"
              onClick={() => setShowBrandDropdown((prev) => !prev)}
            >
              {brandFilter.length === 0
                ? "All Brands"
                : brandFilter.length === 1
                ? brandFilter[0]
                : brandFilter.join(", ")}
              <span className="ml-1">&#9660;</span>
            </button>
            {showBrandDropdown && (
              <div className="absolute left-0 mt-1 bg-white border rounded shadow z-20 p-2 min-w-[140px] max-h-56 overflow-y-auto">
                {availableBrands.length === 0 && (
                  <div className="text-xs text-gray-500 px-2 py-1">No brands</div>
                )}
                {availableBrands.map((brand, idx) => (
                  <label key={idx} className="block px-2 py-1 cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={brandFilter.includes(brand)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBrandFilter([...brandFilter, brand]);
                        } else {
                          setBrandFilter(brandFilter.filter((b) => b !== brand));
                        }
                      }}
                      className="mr-2"
                    />
                    {brand}
                  </label>
                ))}
                <div className="flex justify-between mt-2">
                  <button
                    className="text-xs text-blue-500 underline"
                    type="button"
                    onClick={() => setBrandFilter([])}
                  >
                    Clear All
                  </button>
                  <button
                    className="text-xs text-gray-600 underline"
                    type="button"
                    onClick={() => setShowBrandDropdown(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex mb-2">
        <button
          onClick={() => setSelectedTab("view")}
          className={`px-4 py-2 rounded-t-md ${
            selectedTab === "view" ? "bg-white font-semibold" : "bg-gray-200"
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => setSelectedTab("recent")}
          className={`px-4 py-2 rounded-t-md ${
            selectedTab === "recent" ? "bg-white font-semibold" : "bg-gray-200"
          }`}
        >
          Recently Modified
        </button>
      </div>

      {/* Inventory Tab Content */}
      {selectedTab === "view" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              className={`px-4 py-1 mr-2 rounded ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              onClick={() => setViewMode("list")}
            >
              List View
            </button>
            <button
              className={`px-4 py-1 rounded ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              onClick={() => setViewMode("grid")}
            >
              Grid View
            </button>
          </div>

          {viewMode === "list" ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border rounded shadow-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-2">Image</th>
                <th className="p-2">Product</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Brand</th>
                <th className="p-2">Category</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Cost</th>
                <th className="p-2">Sell</th>
                <th className="p-2">Status</th>
                <th className="p-2">Source</th>
                <th className="p-2">Delete</th>
                <th className="p-2">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <div
                        className="inline-block cursor-pointer"
                        onClick={() => handleImageClick(p)}
                        title="Click to upload image"
                      >
                        <img
                          src={p.imageUrl || "/placeholder.png"}
                          alt="product"
                          className="h-10 w-10 rounded object-cover border border-gray-200"
                        />
                      </div>
                      <button
                        type="button"
                        title="Search & set image from Google"
                        className="ml-1 text-lg px-1 py-0.5 rounded hover:bg-gray-200"
                        onClick={() => handleFetchImages(p, idx)}
                        style={{ lineHeight: "1" }}
                      >
                        🔍
                      </button>
                    </div>
                  </td>
                  <td
                    className="p-2 max-w-[180px] break-words whitespace-normal"
                    onClick={() => startEdit(p.id, 'productName', p.productName)}
                  >
                    {editingCell.rowId === p.id && editingCell.field === "productName" ? (
                      <input
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "productName", editedValue)}
                        autoFocus
                      />
                    ) : (
                      p.productName
                    )}
                  </td>
                  <td
                    className="p-2 max-w-[180px] break-words whitespace-normal"
                    onClick={() => startEdit(p.id, 'sku', p.sku)}
                  >
                    {editingCell.rowId === p.id && editingCell.field === "sku" ? (
                      <input
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "sku", editedValue)}
                        autoFocus
                      />
                    ) : (
                      p.sku
                    )}
                  </td>
                  <td
                    className="p-2 max-w-[180px] break-words whitespace-normal"
                    onClick={() => startEdit(p.id, 'brand', p.brand)}
                  >
                    {editingCell.rowId === p.id && editingCell.field === "brand" ? (
                      <input
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "brand", editedValue)}
                        autoFocus
                      />
                    ) : (
                      p.brand
                    )}
                  </td>
                  <td
                    className="p-2 max-w-[180px] break-words whitespace-normal"
                    onClick={() => startEdit(p.id, 'category', p.category)}
                  >
                    {editingCell.rowId === p.id && editingCell.field === "category" ? (
                      <input
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "category", editedValue)}
                        autoFocus
                      />
                    ) : (
                      p.category
                    )}
                  </td>
                  <td className="p-2" onClick={() => startEdit(p.id, "quantity", p.quantity)}>
                    {editingCell.rowId === p.id && editingCell.field === "quantity" ? (
                      <input
                        type="number"
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "quantity", Number(editedValue))}
                        autoFocus
                      />
                    ) : (
                      p.quantity
                    )}
                  </td>
                  <td
                    className="p-2 max-w-[180px] break-words whitespace-normal"
                    onClick={() => startEdit(p.id, 'unit', p.unit)}
                  >
                    {editingCell.rowId === p.id && editingCell.field === "unit" ? (
                      <input
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "unit", editedValue)}
                        autoFocus
                      />
                    ) : (
                      p.unit
                    )}
                  </td>
                  <td className="p-2" onClick={() => startEdit(p.id, "costPrice", p.costPrice)}>
                    {editingCell.rowId === p.id && editingCell.field === "costPrice" ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "costPrice", Number(editedValue))}
                        autoFocus
                      />
                    ) : (
                      <>₹{p.costPrice}</>
                    )}
                  </td>
                  <td className="p-2" onClick={() => startEdit(p.id, "sellingPrice", p.sellingPrice)}>
                    {editingCell.rowId === p.id && editingCell.field === "sellingPrice" ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border px-1"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "sellingPrice", Number(editedValue))}
                        autoFocus
                      />
                    ) : (
                      <>₹{p.sellingPrice}</>
                    )}
                  </td>
                  <td className="p-2 min-w-[80px] text-center">
                    <span
                      className={`px-2 py-1 rounded text-white text-xs ${
                        getStatus(p.quantity) === "Low" ? "bg-red-500" : "bg-green-500"
                      }`}
                    >
                      {getStatus(p.quantity)}
                    </span>
                  </td>
                  <td className="p-2 min-w-[100px] max-w-[120px] text-center">
                    {p.sourceOrderId ? (
                      <span className="inline-block px-2 py-1 rounded text-xs bg-blue-500 text-white break-words whitespace-normal leading-snug">
                        From Order
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Item"
                    >
                      {/* Instead of icon, open confirmation modal */}
                      🗑️
                    </button>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setIsModalOpen(true);
                      }}
                      className="text-sm text-blue-600 underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="13" className="text-center p-4 text-gray-500">
                    {products.length === 0 ? "No products found." : "Loading inventory..."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded shadow flex flex-col">
                  <div className="flex justify-center mb-2">
                    <button
                      className="focus:outline-none"
                      style={{ width: "100%" }}
                      onClick={() => handleImageClick(item)}
                      title="Click to upload image"
                    >
                      <img
                        src={item.imageUrl || "/placeholder.png"}
                        alt={item.productName}
                        className="w-full h-32 object-contain rounded border border-gray-200"
                      />
                    </button>
                  </div>
                  <h3 className="font-semibold mb-1">{item.productName}</h3>
                  <p className="text-sm text-gray-600 mb-1">{item.brand} | {item.category}</p>
                  <p className="text-sm mb-1">
                    Qty: {item.quantity} | ₹{item.sellingPrice}
                  </p>
                  <p className="text-xs text-gray-600 mb-1">
                    SKU: {item.sku || "N/A"} | Unit: {item.unit || "N/A"}
                  </p>
                  <div className="flex items-center gap-2 mt-auto">
                    <span
                      className={`px-2 py-1 text-xs rounded font-semibold ${
                        (item.status || getStatus(item.quantity)) === 'In Stock'
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {item.status || getStatus(item.quantity)}
                    </span>
                    {/* Delete button triggers modal */}
                    <button
                      className="ml-auto text-red-600 hover:text-red-800 px-2"
                      title="Delete Item"
                      onClick={() => handleDelete(item)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Recently Modified Tab Content */}
      {selectedTab === "recent" && (
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-3">Recent Inventory Modifications</h2>
          {inventoryLogs.length === 0 ? (
            <p className="text-gray-500">No recent modifications found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventoryLogs.map((mod, index) => (
                <div key={index} className="bg-white shadow rounded-md p-4 text-sm">
                  <div className="font-semibold text-gray-700 mb-1">SKU: {mod.sku}</div>
                  <div>Product: {mod.productName || 'N/A'}</div>
                  <div>Brand: {mod.brand || 'N/A'}</div>
                  <div>Category: {mod.category || 'N/A'}</div>
                  <div className="mt-2 text-gray-600">
                    <span className="font-medium">Action:</span> {mod.action}<br />
                    <span className="font-medium">Source:</span> {mod.source}<br />
                    <span className="font-medium">Modified By:</span> {mod.modifiedBy || "Unknown"}<br />
                    <span className="font-medium">Time:</span> {mod.modifiedAt?.toDate?.().toLocaleString?.() || "N/A"}<br />
                    <span className="font-medium">Changes:</span>
                    <ul className="list-disc list-inside">
                      {Object.entries(mod.changes || {}).map(([key, change]) => (
                        <li key={key}>
                          {key}: {change.from ?? "N/A"} → {change.to ?? "N/A"}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          product={deleteTargetProduct}
          confirmationText={deleteConfirmationText}
          onChange={e => setDeleteConfirmationText(e.target.value)}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeleteTargetProduct(null);
            setDeleteConfirmationText("");
          }}
          onConfirm={confirmDelete}
        />
      )}
      {/* Image Upload Modal */}
      {showImageModal && (
        <UploadProductImageModal
          imageTargetProduct={imageTargetProduct}
          setShowImageModal={setShowImageModal}
          setImageTargetProduct={setImageTargetProduct}
          setImageUploadFile={setImageUploadFile}
          setImageUploadError={setImageUploadError}
          setImagePreviewUrl={setImagePreviewUrl}
          imageUploadFile={imageUploadFile}
          imageUploadLoading={imageUploadLoading}
          imageUploadError={imageUploadError}
          imagePreviewUrl={imagePreviewUrl}
          handleImageFileChange={handleImageFileChange}
          handleImageUpload={handleImageUpload}
        />
      )}
      {/* AI Image Search Modal */}
      {showImageModalAI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-11/12 max-w-2xl relative">
            <button
              onClick={() => setShowImageModalAI(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600"
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2">Search Product Images</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter product description..."
                className="flex-grow border border-gray-300 px-4 py-2 rounded"
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
              />
              <button
                onClick={handleAISearch}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {isAiLoading ? "Searching..." : "Search"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
              {aiSearchResults.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt="AI result"
                  className="w-full h-28 object-cover rounded cursor-pointer border hover:border-blue-500"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    alert("Image URL copied to clipboard!");
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewInventory;

const UploadProductImageModal = ({
  imageTargetProduct,
  setShowImageModal,
  setImageTargetProduct,
  setImageUploadFile,
  setImageUploadError,
  setImagePreviewUrl,
  imageUploadFile,
  imageUploadLoading,
  imageUploadError,
  imagePreviewUrl,
  handleImageFileChange,
  handleImageUpload,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [imageResults, setImageResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageSource, setImageSource] = useState("unsplash");

  // Unified image search handler for Unsplash/Google
  const handleImageSearch = async () => {
    setLoading(true);
    try {
      let results = [];
      if (imageSource === "unsplash") {
        results = await fetchUnsplashImages(searchTerm);
      } else {
        // Already imported from utils
        const fetchGoogleImages2 = (await import("../../../utils/fetchGoogleImages")).default;
        results = await fetchGoogleImages2(searchTerm);
      }
      setImageResults(results);
    } catch (error) {
      console.error("Image search error:", error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white rounded shadow-lg p-6 w-[95%] max-w-md">
        <h2 className="text-lg font-semibold mb-3">Upload Product Image</h2>
        <p className="mb-2 text-gray-700">
          {imageTargetProduct?.productName || "Product"}
        </p>
        {/* Toggle UI for Unsplash/Google */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setImageSource("unsplash")}
            className={`px-3 py-1 rounded ${imageSource === "unsplash" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Unsplash
          </button>
          <button
            onClick={() => setImageSource("google")}
            className={`px-3 py-1 rounded ${imageSource === "google" ? "bg-green-600 text-white" : "bg-gray-200"}`}
          >
            Google
          </button>
        </div>
        {/* Unified search input/button */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            placeholder={`Search image with ${imageSource === "unsplash" ? "Unsplash" : "Google"}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-2 py-1 rounded w-full"
          />
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded"
            onClick={handleImageSearch}
            type="button"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
        {/* Image search results */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {imageResults.map((imgUrl, index) => (
            <img
              key={index}
              src={imgUrl}
              alt="AI result"
              className="w-24 h-24 object-cover border rounded cursor-pointer hover:scale-105 transition-all"
              onClick={() => {
                setImageUploadFile(null);
                setImageUploadError("");
                setImagePreviewUrl(imgUrl);
              }}
              onError={(e) => (e.target.src = "/placeholder.jpg")}
            />
          ))}
        </div>
        {/* File upload input */}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          className="mb-3"
          disabled={imageUploadLoading}
        />
        {/* Preview area */}
        {imagePreviewUrl && (
          <div className="mb-3 flex justify-center">
            <img
              src={imagePreviewUrl}
              alt="Preview"
              className="max-h-40 max-w-full rounded border"
              style={{ objectFit: "contain" }}
            />
          </div>
        )}
        {imageUploadFile && (
          <div className="mb-2">
            <span className="text-xs text-gray-500">{imageUploadFile.name}</span>
          </div>
        )}
        {imageUploadError && (
          <div className="mb-2 text-red-600 text-sm">{imageUploadError}</div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setShowImageModal(false);
              setImageTargetProduct(null);
              setImageUploadFile(null);
              setImageUploadError("");
              setImagePreviewUrl(null);
              setSearchTerm("");
              setImageResults([]);
            }}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            disabled={imageUploadLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleImageUpload}
            className={`px-4 py-2 rounded text-white ${
              (imageUploadFile || imagePreviewUrl) && !imageUploadLoading
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            disabled={!(imageUploadFile || imagePreviewUrl) || imageUploadLoading}
          >
            {imageUploadLoading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};