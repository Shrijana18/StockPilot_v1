import { getStorage, ref, getDownloadURL, uploadBytes, getBlob } from "firebase/storage";
import React from "react";
import { useState, useEffect } from "react";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import fetchGoogleImages from "../../utils/fetchGoogleImages";
import { logInventoryChange } from "../../utils/logInventoryChange";
import { collection as fsCollection, query, orderBy, onSnapshot as fsOnSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
// Removed useAuth because we will pass userId as prop
import EditProductModal from "./EditProductModal";
import AddColumnInventory from "./AddColumnInventory";
import QRCodeGenerator from "./QRCodeGenerator";
import { getStockDisplay, formatLooseProductStock, calculateSellingUnitPrice, calculateSellingUnitStock, validateLooseProductConfig } from "../../utils/looseProductUtils";

// === Column Preferences: defaults + storage keys ===
const COLUMN_DEFAULTS = [
  { id: "image", label: "Image", minWidth: 70, sticky: false },
  { id: "productName", label: "Product", minWidth: 200 },
  { id: "sku", label: "SKU", minWidth: 140 },
  { id: "brand", label: "Brand", minWidth: 140 },
  { id: "category", label: "Category", minWidth: 140 },
  { id: "hsnCode", label: "HSN", minWidth: 120 },
  { id: "quantity", label: "Qty", minWidth: 90 },
  { id: "unit", label: "Unit", minWidth: 90 },
  { id: "costPrice", label: "Cost", minWidth: 110 },
  { id: "sellingPrice", label: "Sell", minWidth: 110 },
  // Newly supported optional columns:
  { id: "mrp", label: "MRP", minWidth: 110 },
  { id: "gstRate", label: "GST %", minWidth: 90 },
  { id: "isLooseProduct", label: "Loose Product", minWidth: 120, align: "center" },
  { id: "status", label: "Status", minWidth: 100, align: "center" },
  { id: "source", label: "Source", minWidth: 120 },
  { id: "qr", label: "QR", minWidth: 80 },
  { id: "delete", label: "Delete", minWidth: 80 },
  { id: "edit", label: "Edit", minWidth: 80 },
];
const LS_KEY = "FLYP_INVENTORY_COLUMNS_V2";
const prefDocPath = (uid) => [`businesses`, uid, `preferences`, `inventoryColumns`];

const toSafeKey = (name = "") =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");


const DeleteConfirmationModal = ({
  product,
  confirmationText,
  onChange,
  onCancel,
  onConfirm
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
    <div className="rounded p-6 w-[90%] md:w-[400px] bg-white/10 backdrop-blur-2xl border border-white/10 shadow-[0_12px_50px_rgba(0,0,0,0.45)]">
      <h2 className="text-lg font-semibold mb-2 text-rose-300">Delete Product?</h2>
      <p className="mb-4">
        Are you sure you want to delete <strong>{product?.productName || "this product"}</strong> (SKU: <strong>{product?.sku || "N/A"}</strong>)?
      </p>
      <p className="mb-2 text-sm text-white/70">
        Type <code className="bg-gray-100 px-1 rounded border">delete</code> to confirm.
      </p>
      <input
        type="text"
        className="w-full rounded px-3 py-2 mb-4 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        placeholder='Type "delete" to confirm'
        value={confirmationText}
        onChange={onChange}
      />
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded border border-white/20 bg-white/10 text-white hover:bg-white/15"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={confirmationText.trim().toLowerCase() !== "delete"}
          className={`px-4 py-2 rounded text-slate-900 ${
            confirmationText.trim().toLowerCase() === "delete"
              ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              : "bg-white/20 text-white/70 cursor-not-allowed"
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
  // QR modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTargetProduct, setQrTargetProduct] = useState(null);
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

  // Column preferences state
  const [columns, setColumns] = useState(COLUMN_DEFAULTS);
  const [hiddenCols, setHiddenCols] = useState(new Set());
  // Custom columns
  const [customColumns, setCustomColumns] = useState([]); // [{id,label,minWidth,type,key}]
  const [showCustomColumnsModal, setShowCustomColumnsModal] = useState(false);
  
  // Loose product quick setup modal
  const [showLooseProductModal, setShowLooseProductModal] = useState(false);
  const [looseProductTarget, setLooseProductTarget] = useState(null);
  const [looseProductConfig, setLooseProductConfig] = useState({
    baseUnit: "",
    sellingUnit: "",
    conversionFactor: "",
    baseUnitCost: "",
    baseUnitSellingPrice: "",
    minSellingQuantity: "1",
  });

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

  const saveColumnPrefs = async (uid, order, hidden) => {
    try {
      // Persist to Firestore
      const [c1, c2, c3, c4] = prefDocPath(uid);
      await setDoc(doc(getFirestore(), ...prefDocPath(uid)), {
        order,
        hidden,
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (e) {
      // Fallback to localStorage if Firestore fails
      const payload = { order, hidden, updatedAt: Date.now() };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }
  };
  const loadColumnPrefs = async (uid) => {
    try {
      const snap = await getDoc(doc(getFirestore(), ...prefDocPath(uid)));
      if (snap.exists()) {
        const data = snap.data();
        const orderFromDb = Array.isArray(data.order) ? data.order : COLUMN_DEFAULTS.map(c => c.id);
        const hiddenFromDb = Array.isArray(data.hidden) ? new Set(data.hidden) : new Set();
        const ordered = orderFromDb
          .map(id => COLUMN_DEFAULTS.find(c => c.id === id))
          .filter(Boolean);
        const merged = [...ordered]; // drop unknowns safely
        setColumns(merged);
        setHiddenCols(hiddenFromDb);
        return;
      }
    } catch (e) { /* ignore */ }
    // Fallback to localStorage or defaults
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
      try {
        const parsed = JSON.parse(ls);
        const order = Array.isArray(parsed.order) ? parsed.order : COLUMN_DEFAULTS.map(c => c.id);
        const hidden = new Set(Array.isArray(parsed.hidden) ? parsed.hidden : []);
        const ordered = order.map(id => COLUMN_DEFAULTS.find(c => c.id === id)).filter(Boolean);
        setColumns(ordered);
        setHiddenCols(hidden);
        return;
      } catch (_) { /* ignore */ }
    }
    setColumns(COLUMN_DEFAULTS);
    setHiddenCols(new Set());
  };

  // Prevent rendering if userId is not available
  if (!userId) {
    return <div className="text-center p-4">Loading user data...</div>;
  }
  useEffect(() => {
    if (userId) loadColumnPrefs(userId);
  }, [userId]);

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

  // Custom columns Firestore subscription
  useEffect(() => {
    if (!userId) return;
    const colRef = collection(db, "businesses", userId, "customColumns");
    const unsub = onSnapshot(colRef, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data() || {};
        const label = data.name || "Custom";
        const key = data.key || toSafeKey(label);
        return {
          id: key,
          label,
          minWidth: 140,
          type: data.type || "text",
          _docId: d.id,
        };
      });
      setCustomColumns(list);
      // Merge into columns list while preserving existing order from prefs when possible
      setColumns((prev) => {
        // Take existing order ids
        const existingIds = prev.map(c => c.id);
        // Any custom not present gets appended
        const appended = list.filter(c => !existingIds.includes(c.id));
        return [...prev, ...appended];
      });
    });
    return () => unsub();
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

      // Handle loose product quantity updates
      if (field === "quantity" && originalData.isLooseProduct) {
        const { calculateSellingUnitStock } = await import("../../utils/looseProductUtils");
        const conversionFactor = originalData.conversionFactor || 1;
        const stockInSellingUnit = calculateSellingUnitStock(Number(value) || 0, conversionFactor);
        await updateDoc(productRef, {
          quantity: Number(value),
          stockInSellingUnit: stockInSellingUnit,
        });
      }
      // Normalize GST field across AI (gstRate) and Manual (taxRate) flows
      else if (field === "gstRate") {
        const numeric = typeof value === "string" ? Number(value) : value;
        await updateDoc(productRef, { gstRate: numeric, taxRate: numeric });
      } else {
        await updateDoc(productRef, { [field]: value });
      }

      // Call logInventoryChange with proper Firestore field names for productName, brand, category
      await logInventoryChange({
        userId,
        productId: rowId,
        sku: originalData.sku || "N/A",
        productName: originalData.productName || "N/A",
        brand: originalData.brand || "N/A",
        category: originalData.category || "N/A",
        previousData: originalData,
        updatedData: field === "gstRate"
          ? { ...originalData, gstRate: value, taxRate: value }
          : { ...originalData, [field]: value },
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

  return (
    <div className="p-2 sm:p-4 text-white">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-3 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row items-center w-full lg:w-1/3 gap-2 sm:gap-3">
          <input
            type="text"
            placeholder="Search by name, brand, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 sm:px-4 py-2 rounded-xl w-full bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
          />
          <button
            onClick={() => setShowImageModalAI(true)}
            className="w-full sm:w-auto py-2 px-3 sm:px-4 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] text-sm"
          >
            Search with AI
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            onChange={(e) => setSortKey(e.target.value)}
            value={sortKey}
          >
            <option value="">Sort by</option>
            <option value="quantity">Quantity</option>
            <option value="costPrice">Cost Price</option>
            <option value="sellingPrice">Selling Price</option>
          </select>
          <select
            className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            onChange={(e) => setSortOrder(e.target.value)}
            value={sortOrder}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <select
            className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low">Low</option>
          </select>
          <div className="relative">
            <button
              className="px-3 py-2 rounded min-w-[120px] text-left bg-white/10 border border-white/20"
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
              <div className="absolute left-0 mt-1 z-[1000] p-2 min-w-[180px] max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0B0F14]/70 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                {availableBrands.length === 0 && (
                  <div className="text-xs text-gray-500 px-2 py-1">No brands</div>
                )}
                {availableBrands.map((brand, idx) => (
                  <label key={idx} className="block px-2 py-1 cursor-pointer hover:bg-white/10">
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
                    className="text-xs text-emerald-300 underline"
                    type="button"
                    onClick={() => setBrandFilter([])}
                  >
                    Clear All
                  </button>
                  <button
                    className="text-xs text-white/70 underline"
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
      <div className="flex mb-2 overflow-x-auto">
        <button
          onClick={() => setSelectedTab("view")}
          className={`px-3 sm:px-4 py-2 rounded-t-md transition text-sm whitespace-nowrap ${
            selectedTab === "view"
              ? "bg-emerald-500 text-slate-900 font-semibold"
              : "bg-white/10 text-white hover:bg-white/15"
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => setSelectedTab("recent")}
          className={`px-3 sm:px-4 py-2 rounded-t-md transition text-sm whitespace-nowrap ${
            selectedTab === "recent"
              ? "bg-emerald-500 text-slate-900 font-semibold"
              : "bg-white/10 text-white hover:bg-white/15"
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
              className={`px-4 py-1 mr-2 rounded transition ${viewMode === "list" ? "bg-emerald-500 text-slate-900" : "bg-white/10 text-white hover:bg-white/15"}`}
              onClick={() => setViewMode("list")}
            >
              List View
            </button>
            <button
              className={`px-4 py-1 rounded transition ${viewMode === "grid" ? "bg-emerald-500 text-slate-900" : "bg-white/10 text-white hover:bg-white/15"}`}
              onClick={() => setViewMode("grid")}
            >
              Grid View
            </button>
          </div>

          {viewMode === "list" ? (
            <>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white hover:bg-white/15"
              onClick={() => setShowCustomColumnsModal(true)}
              type="button"
              title="Manage columns"
            >
              Manage Columns
            </button>
          </div>
              <div className="overflow-x-auto w-full">
                <div className="overflow-x-auto">
                  <table className="table-fixed w-full text-xs sm:text-sm border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden min-w-[800px]">
                  <thead className="bg-white/10 text-left sticky top-0">
                    <tr>
                      {columns.filter(c => !hiddenCols.has(c.id)).map(col => (
                        <th
                          key={col.id}
                          className={
                            "p-2 text-white/80 border-b border-white/10 truncate " +
                            (col.id === "status" ? "text-center" : "")
                          }
                          style={{ minWidth: col.minWidth ? `${col.minWidth}px` : undefined }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-t border-white/10 hover:bg-white/5">
                        {columns.filter(c => !hiddenCols.has(c.id)).map(col => {
                          switch (col.id) {
                            case "qr":
                              return (
                                <td key={col.id} className="p-2">
                                  <button
                                    onClick={() => { setQrTargetProduct(p); setShowQrModal(true); }}
                                    className="px-2 py-1 text-xs rounded bg-white/10 border border-white/20 hover:bg-white/15"
                                    title="Generate QR"
                                  >
                                    Generate
                                  </button>
                                </td>
                              );
                            case "image":
                              return (
                                <td key={col.id} className="p-2">
                                  <div
                                    className="inline-block cursor-pointer"
                                    onClick={() => handleImageClick(p)}
                                    title="Click to upload image"
                                  >
                                    <img
                                      src={p.imageUrl || "/placeholder.png"}
                                      alt="product"
                                      className="h-10 w-10 rounded object-cover border border-white/20 ring-1 ring-white/10"
                                    />
                                  </div>
                                </td>
                              );
                            case "productName":
                              return (
                                <td
                                  key={col.id}
                                  className="p-2 max-w-[220px] break-words whitespace-normal"
                                  onClick={() => startEdit(p.id, "productName", p.productName)}
                                >
                                  {editingCell.rowId === p.id && editingCell.field === "productName" ? (
                                    <input
                                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      value={editedValue}
                                      onChange={(e) => setEditedValue(e.target.value)}
                                      onBlur={() => saveEdit(p.id, "productName", editedValue)}
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span>{p.productName}</span>
                                      {p.isLooseProduct && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30" title="Loose Product">
                                          🛒
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            case "sku":
                            case "brand":
                            case "category":
                            case "hsnCode":
                            case "unit":
                              return (
                                <td
                                  key={col.id}
                                  className="p-2 max-w-[180px] break-words whitespace-normal"
                                  onClick={() => startEdit(p.id, col.id, p[col.id])}
                                >
                                  {editingCell.rowId === p.id && editingCell.field === col.id ? (
                                    <input
                                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      value={editedValue}
                                      onChange={(e) => setEditedValue(e.target.value)}
                                      onBlur={() => saveEdit(p.id, col.id, editedValue)}
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {p.isLooseProduct ? (
                                        <>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                              Loose
                                            </span>
                                          </div>
                                          <div className="text-xs text-white/90">
                                            <div>Base: {p.baseUnit || p.unit || ""}</div>
                                            <div className="text-white/70">Sell: {p.sellingUnit || ""}</div>
                                          </div>
                                        </>
                                      ) : (
                                        <span>{p[col.id] || ""}</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            case "quantity":
                              const stockDisplay = getStockDisplay(p);
                              return (
                                <td key={col.id} className="p-2" onClick={() => startEdit(p.id, "quantity", p.quantity)}>
                                  {editingCell.rowId === p.id && editingCell.field === "quantity" ? (
                                    <input
                                      type="number"
                                      step={p.isLooseProduct ? "0.01" : "1"}
                                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      value={editedValue}
                                      onChange={(e) => setEditedValue(e.target.value)}
                                      onBlur={() => saveEdit(p.id, "quantity", Number(editedValue))}
                                      autoFocus
                                    />
                                  ) : (
                                    <div className="flex flex-col">
                                      <div className="font-medium">{stockDisplay.primary}</div>
                                      {p.isLooseProduct && stockDisplay.secondary && (
                                        <div className="text-xs text-white/60">{stockDisplay.secondary}</div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            case "costPrice":
                            case "sellingPrice":
                            case "mrp":
                              return (
                                <td key={col.id} className="p-2" onClick={() => startEdit(p.id, col.id, p[col.id])}>
                                  {editingCell.rowId === p.id && editingCell.field === col.id ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      value={editedValue}
                                      onChange={(e) => setEditedValue(e.target.value)}
                                      onBlur={() => saveEdit(p.id, col.id, Number(editedValue))}
                                      autoFocus
                                    />
                                  ) : (
                                    p[col.id] !== undefined ? <>₹{p[col.id]}</> : ""
                                  )}
                                </td>
                              );
                            case "gstRate":
                              // Display gstRate from either field; prefer explicit gstRate, fallback to taxRate
                              const currentGst = p.gstRate !== undefined && p.gstRate !== null ? p.gstRate : p.taxRate;
                              return (
                                <td key={col.id} className="p-2" onClick={() => startEdit(p.id, "gstRate", currentGst)}>
                                  {editingCell.rowId === p.id && editingCell.field === "gstRate" ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      value={editedValue}
                                      onChange={(e) => setEditedValue(e.target.value)}
                                      onBlur={() => saveEdit(p.id, "gstRate", Number(editedValue))}
                                      autoFocus
                                    />
                                  ) : (
                                    currentGst !== undefined && currentGst !== null ? <>{currentGst}%</> : ""
                                  )}
                                </td>
                              );
                            case "isLooseProduct":
                              return (
                                <td key={col.id} className="p-2 align-middle text-center">
                                  {p.isLooseProduct ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLooseProductTarget(p);
                                        setLooseProductConfig({
                                          baseUnit: p.baseUnit || p.unit || "",
                                          sellingUnit: p.sellingUnit || "",
                                          conversionFactor: p.conversionFactor?.toString() || "",
                                          baseUnitCost: p.baseUnitCost?.toString() || p.costPrice?.toString() || "",
                                          baseUnitSellingPrice: p.baseUnitSellingPrice?.toString() || p.sellingPrice?.toString() || "",
                                          minSellingQuantity: p.minSellingQuantity?.toString() || "1",
                                        });
                                        setShowLooseProductModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition cursor-pointer active:scale-95"
                                      title="Click to edit loose product settings"
                                    >
                                      🛒 Loose
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setLooseProductTarget(p);
                                        setLooseProductConfig({
                                          baseUnit: p.unit || "",
                                          sellingUnit: "",
                                          conversionFactor: "",
                                          baseUnitCost: p.costPrice?.toString() || "",
                                          baseUnitSellingPrice: p.sellingPrice?.toString() || "",
                                          minSellingQuantity: "1",
                                        });
                                        setShowLooseProductModal(true);
                                      }}
                                      className="text-xs px-2 py-1 rounded border border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition active:scale-95"
                                      title="Click to enable loose product"
                                    >
                                      + Enable
                                    </button>
                                  )}
                                </td>
                              );
                            case "status": {
                              const st = getStatus(p.quantity);
                              const badgeText = st === "In Stock" ? "In\u00A0Stock" : st; // keep on one line
                              const isLow = st === "Low";
                              return (
                                <td key={col.id} className="p-2 align-middle text-center whitespace-nowrap">
                                  <span
                                    title={st}
                                    className={
                                      "inline-flex items-center justify-center min-w-[72px] h-6 px-2 rounded-full text-xs font-semibold " +
                                      (isLow ? "bg-rose-500 text-white" : "bg-emerald-400 text-slate-900")
                                    }
                                  >
                                    {badgeText}
                                  </span>
                                </td>
                              );
                            }
                            case "source":
                              return (
                                <td key={col.id} className="p-2 min-w-[100px] max-w-[120px] text-center">
                                  {p.sourceOrderId ? (
                                    <span className="inline-block px-2 py-1 rounded text-xs bg-blue-500 text-white break-words whitespace-normal leading-snug">
                                      From Order
                                    </span>
                                  ) : (
                                    ""
                                  )}
                                </td>
                              );
                            case "delete":
                              return (
                                <td key={col.id} className="p-2">
                                  <button
                                    onClick={() => handleDelete(p)}
                                    className="text-rose-300 hover:text-rose-200"
                                    title="Delete Item"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              );
                            case "edit":
                              return (
                                <td key={col.id} className="p-2">
                                  <button
                                    onClick={() => {
                                      setSelectedProductId(p.id);
                                      setIsModalOpen(true);
                                    }}
                                    className="text-sm text-emerald-300 underline"
                                  >
                                    Edit
                                  </button>
                                </td>
                              );
                            default:
                              return (
                                <td
                                  key={col.id}
                                  className="p-2 max-w-[180px] break-words whitespace-normal"
                                  onClick={() => startEdit(p.id, col.id, p[col.id])}
                                >
                                  {editingCell.rowId === p.id && editingCell.field === col.id ? (
                                    <input
                                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      value={editedValue}
                                      onChange={(e) => setEditedValue(e.target.value)}
                                      onBlur={() => saveEdit(p.id, col.id, editedValue)}
                                      autoFocus
                                    />
                                  ) : (
                                    p[col.id] || ""
                                  )}
                                </td>
                              );
                          }
                        })}
                      </tr>
                    ))}
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={columns.filter(c => !hiddenCols.has(c.id)).length} className="text-center p-4 text-white/70">
                          {products.length === 0 ? "No products found." : "Loading inventory..."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  </table>
                </div>
              </div>
              {showCustomColumnsModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
                  <div className="w-[96%] max-w-2xl rounded-2xl p-4 bg-white/10 backdrop-blur-2xl border border-white/15 shadow-[0_20px_80px_rgba(0,0,0,0.5)] text-white relative">
                    <button
                      onClick={() => setShowCustomColumnsModal(false)}
                      className="absolute top-2 right-2 text-white/70 hover:text-white"
                    >
                      ✕
                    </button>
                    <AddColumnInventory
                      availableColumns={columns}
                      hiddenCols={hiddenCols}
                      onToggle={(id) => {
                        const next = new Set(hiddenCols);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setHiddenCols(next);
                        // Save immediately (order = current cols ids)
                        saveColumnPrefs(userId, columns.map(c => c.id), Array.from(next));
                      }}
                      onReset={() => {
                        setColumns(COLUMN_DEFAULTS);
                        const next = new Set();
                        setHiddenCols(next);
                        saveColumnPrefs(userId, COLUMN_DEFAULTS.map(c => c.id), []);
                      }}
                      onClose={() => setShowCustomColumnsModal(false)}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((item) => (
                <div key={item.id} className="p-4 rounded-xl flex flex-col bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
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
                        className="w-full h-32 object-contain rounded border border-white/20 ring-1 ring-white/10"
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{item.productName}</h3>
                    {item.isLooseProduct && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30" title="Loose Product">
                        🛒 Loose
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 mb-1">{item.brand} | {item.category}</p>
                  <p className="text-sm mb-1">
                    {item.isLooseProduct ? (
                      <>
                        Stock: {formatLooseProductStock(item)}
                        {item.sellingUnitPrice !== undefined && <> | ₹{item.sellingUnitPrice?.toFixed(2)}/{item.sellingUnit}</>}
                      </>
                    ) : (
                      <>
                        Qty: {item.quantity} {item.unit && item.unit} {item.sellingPrice !== undefined && <>| ₹{item.sellingPrice}</>}
                      </>
                    )}
                  </p>
                  { (item.mrp !== undefined || item.gstRate !== undefined || item.taxRate !== undefined) && (
                    <p className="text-sm mb-1">
                      {item.mrp !== undefined && <>MRP: ₹{item.mrp}</>}
                      {(item.mrp !== undefined) && (item.gstRate !== undefined || item.taxRate !== undefined) && <> &nbsp;|&nbsp; </>}
                      {(item.gstRate !== undefined || item.taxRate !== undefined) && <>GST: {(item.gstRate ?? item.taxRate)}%</>}
                    </p>
                  )}
                  <p className="text-xs text-white/60 mb-1">
                    SKU: {item.sku || "N/A"} | {item.isLooseProduct ? (
                      <>Base: {item.baseUnit || "N/A"} | Sell: {item.sellingUnit || "N/A"}</>
                    ) : (
                      <>Unit: {item.unit || "N/A"}</>
                    )}
                  </p>
                  { item.hsnCode && (
                    <p className="text-xs text-white/60 mb-1">
                      HSN: {item.hsnCode}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-auto">
                    <span
                      className={`px-2 py-1 text-xs rounded font-semibold ${(item.status || getStatus(item.quantity)) === 'In Stock' ? 'bg-emerald-500 text-slate-900' : 'bg-rose-500 text-white'}`}
                    >
                      {item.status || getStatus(item.quantity)}
                    </span>
                    <button
                      className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                      onClick={() => { setQrTargetProduct(item); setShowQrModal(true); }}
                      title="Generate QR"
                    >
                      QR
                    </button>
                    {/* Delete button triggers modal */}
                    <button
                      className="ml-auto text-rose-300 hover:text-rose-200 px-2"
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
          <h2 className="text-lg font-semibold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Recent Inventory Modifications</h2>
          {inventoryLogs.length === 0 ? (
            <p className="text-white/70">No recent modifications found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventoryLogs.map((mod, index) => (
                <div key={index} className="p-4 text-sm rounded-md bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
                  <div className="font-semibold text-white mb-1">SKU: {mod.sku}</div>
                  <div>Product: {mod.productName || 'N/A'}</div>
                  <div>Brand: {mod.brand || 'N/A'}</div>
                  <div>Category: {mod.category || 'N/A'}</div>
                  <div className="mt-2 text-white/70">
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
          <div className="p-6 rounded w-11/12 max-w-2xl relative bg-white/10 backdrop-blur-2xl border border-white/10 shadow-[0_12px_50px_rgba(0,0,0,0.45)] text-white">
            <button
              onClick={() => setShowImageModalAI(false)}
              className="absolute top-2 right-2 text-white/70 hover:text-rose-300"
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-2">Search Product Images</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter product description..."
                className="flex-grow px-4 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
              />
              <button
                onClick={handleAISearch}
                className="px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
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
                  className="w-full h-28 object-cover rounded cursor-pointer border border-white/20 hover:border-emerald-300/50 ring-1 ring-white/10"
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

      {/* QR Modal (fresh component handles its own portal/overlay/scroll lock) */}
      {showQrModal && qrTargetProduct && (
        <QRCodeGenerator
          product={qrTargetProduct}
          size={220}
          businessId={userId}
          onClose={() => {
            setShowQrModal(false);
            setQrTargetProduct(null);
          }}
        />
      )}

      {/* Loose Product Quick Setup Modal */}
      {showLooseProductModal && looseProductTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl shadow-2xl border border-white/10 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {looseProductTarget.isLooseProduct ? "Edit" : "Enable"} Loose Product
                </h2>
                <p className="text-sm text-white/60 mt-1">{looseProductTarget.productName}</p>
              </div>
              <button
                onClick={() => {
                  setShowLooseProductModal(false);
                  setLooseProductTarget(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Base Unit */}
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Base Unit <span className="text-white/50">(What you buy)</span>
                </label>
                <input
                  type="text"
                  value={looseProductConfig.baseUnit}
                  onChange={(e) => setLooseProductConfig((prev) => ({ ...prev, baseUnit: e.target.value }))}
                  placeholder="e.g., 1 Packet (100 pieces)"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>

              {/* Selling Unit */}
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  Selling Unit <span className="text-white/50">(What you sell)</span>
                </label>
                <input
                  type="text"
                  value={looseProductConfig.sellingUnit}
                  onChange={(e) => setLooseProductConfig((prev) => ({ ...prev, sellingUnit: e.target.value }))}
                  placeholder="e.g., 1 piece"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>

              {/* Conversion Factor */}
              <div>
                <label className="block text-sm text-white/70 mb-1">Conversion Factor</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={looseProductConfig.conversionFactor}
                    onChange={(e) => setLooseProductConfig((prev) => ({ ...prev, conversionFactor: e.target.value }))}
                    placeholder="e.g., 100"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const baseUnit = looseProductConfig.baseUnit.toLowerCase();
                      const sellingUnit = looseProductConfig.sellingUnit.toLowerCase();
                      
                      // Common conversions
                      const conversions = {
                        '1 packet (100 pieces)': { '1 piece': 100, 'piece': 100 },
                        '1kg': { '100g': 10, '500g': 2, 'gram': 1000, 'g': 1000 },
                        '1 strip (10 tablets)': { '1 tablet': 10, 'tablet': 10 },
                        '1 packet': { '1 piece': 100, 'piece': 100 },
                      };

                      let found = false;
                      for (const [base, sellingMap] of Object.entries(conversions)) {
                        if (baseUnit.includes(base.split('(')[0].trim()) || baseUnit.includes(base)) {
                          for (const [sell, factor] of Object.entries(sellingMap)) {
                            if (sellingUnit.includes(sell)) {
                              setLooseProductConfig((prev) => ({ ...prev, conversionFactor: factor.toString() }));
                              found = true;
                              toast.success(`Auto-calculated: 1 ${looseProductConfig.baseUnit} = ${factor} ${looseProductConfig.sellingUnit}`);
                              break;
                            }
                          }
                          if (found) break;
                        }
                      }

                      if (!found) {
                        toast.info('Could not auto-calculate. Please enter manually.');
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm"
                  >
                    Auto
                  </button>
                </div>
                <p className="text-xs text-white/50 mt-1">
                  How many {looseProductConfig.sellingUnit || "selling units"} = 1 {looseProductConfig.baseUnit || "base unit"}?
                </p>
              </div>

              {/* Base Unit Cost */}
              <div>
                <label className="block text-sm text-white/70 mb-1">Base Unit Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={looseProductConfig.baseUnitCost}
                  onChange={(e) => setLooseProductConfig((prev) => ({ ...prev, baseUnitCost: e.target.value }))}
                  placeholder={looseProductTarget.costPrice?.toString() || "Cost per base unit"}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>

              {/* Base Unit Selling Price */}
              <div>
                <label className="block text-sm text-white/70 mb-1">Base Unit Selling Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={looseProductConfig.baseUnitSellingPrice}
                  onChange={(e) => setLooseProductConfig((prev) => ({ ...prev, baseUnitSellingPrice: e.target.value }))}
                  placeholder={looseProductTarget.sellingPrice?.toString() || "Selling price per base unit"}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>

              {/* Min Selling Quantity */}
              <div>
                <label className="block text-sm text-white/70 mb-1">Min. Selling Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={looseProductConfig.minSellingQuantity}
                  onChange={(e) => setLooseProductConfig((prev) => ({ ...prev, minSellingQuantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>

              {/* Calculated Preview */}
              {looseProductConfig.baseUnitSellingPrice && looseProductConfig.conversionFactor && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-emerald-300 font-medium mb-1">Calculated Values</div>
                  <div className="text-sm text-white">
                    Selling Price: ₹{calculateSellingUnitPrice(
                      parseFloat(looseProductConfig.baseUnitSellingPrice) || 0,
                      parseFloat(looseProductConfig.conversionFactor) || 1
                    ).toFixed(2)} per {looseProductConfig.sellingUnit || "selling unit"}
                  </div>
                  {looseProductTarget.quantity !== undefined && (
                    <div className="text-xs text-white/70 mt-1">
                      Available: {calculateSellingUnitStock(
                        parseFloat(looseProductTarget.quantity) || 0,
                        parseFloat(looseProductConfig.conversionFactor) || 1
                      )} {looseProductConfig.sellingUnit || "selling units"}
                    </div>
                  )}
                </div>
              )}

              {/* Disable Loose Product Option */}
              {looseProductTarget.isLooseProduct && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const productRef = doc(db, "businesses", userId, "products", looseProductTarget.id);
                        await updateDoc(productRef, {
                          isLooseProduct: false,
                          unit: looseProductTarget.baseUnit || looseProductTarget.unit,
                          sellingPrice: looseProductTarget.baseUnitSellingPrice || looseProductTarget.sellingPrice,
                        });
                        toast.success("Loose product disabled");
                        setShowLooseProductModal(false);
                        setLooseProductTarget(null);
                      } catch (error) {
                        console.error("Error disabling loose product:", error);
                        toast.error("Failed to disable loose product");
                      }
                    }}
                    className="text-sm text-red-300 hover:text-red-200 underline"
                  >
                    Disable Loose Product Mode
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setShowLooseProductModal(false);
                  setLooseProductTarget(null);
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Validate
                  const validation = validateLooseProductConfig({
                    isLooseProduct: true,
                    baseUnit: looseProductConfig.baseUnit,
                    sellingUnit: looseProductConfig.sellingUnit,
                    conversionFactor: parseFloat(looseProductConfig.conversionFactor) || 0,
                  });

                  if (!validation.valid) {
                    toast.error(validation.errors[0]);
                    return;
                  }

                  try {
                    const conversionFactor = parseFloat(looseProductConfig.conversionFactor) || 1;
                    const baseUnitCost = parseFloat(looseProductConfig.baseUnitCost) || looseProductTarget.costPrice || 0;
                    const baseUnitSellingPrice = parseFloat(looseProductConfig.baseUnitSellingPrice) || looseProductTarget.sellingPrice || 0;
                    const sellingUnitPrice = calculateSellingUnitPrice(baseUnitSellingPrice, conversionFactor);
                    const stockInSellingUnit = calculateSellingUnitStock(looseProductTarget.quantity || 0, conversionFactor);

                    const productRef = doc(db, "businesses", userId, "products", looseProductTarget.id);
                    await updateDoc(productRef, {
                      isLooseProduct: true,
                      baseUnit: looseProductConfig.baseUnit,
                      sellingUnit: looseProductConfig.sellingUnit,
                      conversionFactor: conversionFactor,
                      stockInSellingUnit: stockInSellingUnit,
                      baseUnitCost: baseUnitCost,
                      baseUnitSellingPrice: baseUnitSellingPrice,
                      sellingUnitPrice: sellingUnitPrice,
                      minSellingQuantity: parseFloat(looseProductConfig.minSellingQuantity) || 1,
                      // Update unit to base unit
                      unit: looseProductConfig.baseUnit,
                      // Update selling price to selling unit price
                      sellingPrice: sellingUnitPrice,
                    });

                    await logInventoryChange({
                      userId,
                      productId: looseProductTarget.id,
                      sku: looseProductTarget.sku,
                      previousData: looseProductTarget,
                      updatedData: {
                        ...looseProductTarget,
                        isLooseProduct: true,
                        baseUnit: looseProductConfig.baseUnit,
                        sellingUnit: looseProductConfig.sellingUnit,
                        conversionFactor: conversionFactor,
                        stockInSellingUnit: stockInSellingUnit,
                        baseUnitCost: baseUnitCost,
                        baseUnitSellingPrice: baseUnitSellingPrice,
                        sellingUnitPrice: sellingUnitPrice,
                        minSellingQuantity: parseFloat(looseProductConfig.minSellingQuantity) || 1,
                      },
                      action: "updated",
                      source: "loose-product-quick-setup",
                    });

                    toast.success("✅ Loose product configured successfully!");
                    setShowLooseProductModal(false);
                    setLooseProductTarget(null);
                  } catch (error) {
                    console.error("Error configuring loose product:", error);
                    toast.error("Failed to configure loose product");
                  }
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 via-pink-400 to-orange-400 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition"
              >
                {looseProductTarget.isLooseProduct ? "Update" : "Enable"} Loose Product
              </button>
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

  // Google-only image search
  const handleImageSearch = async () => {
    if (!searchTerm?.trim()) return;
    setLoading(true);
    try {
      const fetchGoogleImages = (await import("../../utils/fetchGoogleImages")).default;
      const results = await fetchGoogleImages(searchTerm.trim());
      setImageResults(results || []);
    } catch (error) {
      console.error("Image search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card */}
      <div className="relative w-11/12 max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 text-white">
        {/* Close */}
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
          className="absolute top-3 right-3 rounded-md px-2 py-1 text-white/70 hover:text-white hover:bg-slate-800"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-lg font-semibold mb-1">Upload Product Image</h2>
        <p className="mb-4 text-white/70">{imageTargetProduct?.productName || "Product"}</p>

        {/* Google Search */}
        <div className="mb-4">
          <label className="block text-sm text-white/70 mb-1">Find an image with Google</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search product image on Google…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow px-3 py-2 rounded-md bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <button
              onClick={handleImageSearch}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-emerald-500 text-slate-900 font-medium hover:bg-emerald-400 disabled:opacity-60"
            >
              {loading ? "Searching…" : "Google Search"}
            </button>
          </div>
          {imageResults?.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3 max-h-48 overflow-y-auto">
              {imageResults.map((imgUrl, index) => (
                <img
                  key={index}
                  src={imgUrl}
                  alt="Search result"
                  className="w-full h-24 object-cover rounded border border-slate-700 hover:border-emerald-300/60 cursor-pointer"
                  onClick={() => {
                    setImageUploadFile(null);
                    setImageUploadError("");
                    setImagePreviewUrl(imgUrl);
                  }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ))}
            </div>
          )}
        </div>

        {/* Local Upload */}
        <div className="mb-4">
          <label className="block text-sm text-white/70 mb-1">Or upload from device</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            className="block w-full cursor-pointer rounded-md px-3 py-2 bg-slate-800 border border-slate-700 file:bg-slate-700 file:text-white file:border-0 file:px-3 file:py-1"
            disabled={imageUploadLoading}
          />
        </div>

        {/* Preview */}
        {(imagePreviewUrl || imageUploadFile) && (
          <div className="mb-4">
            <label className="block text-sm text-white/70 mb-2">Preview</label>
            <div className="flex items-center gap-3">
              {imagePreviewUrl && (
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="max-h-36 rounded border border-slate-700"
                  style={{ objectFit: "contain" }}
                />
              )}
              {imageUploadFile && (
                <div className="text-xs text-white/60">{imageUploadFile.name}</div>
              )}
            </div>
          </div>
        )}

        {imageUploadError && (
          <div className="mb-3 text-rose-300 text-sm">{imageUploadError}</div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2">
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
            className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
            disabled={imageUploadLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleImageUpload}
            className={`px-4 py-2 rounded-md font-medium ${
              (imageUploadFile || imagePreviewUrl) && !imageUploadLoading
                ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                : "bg-slate-700 text-white/70 cursor-not-allowed"
            }`}
            disabled={!(imageUploadFile || imagePreviewUrl) || imageUploadLoading}
          >
            {imageUploadLoading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};
// If you have a handleAddFieldSubmit function in this file, update its setDoc path as per instructions.
// No handleAddFieldSubmit found in this file. If present elsewhere, update accordingly.