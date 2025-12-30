import { getStorage, ref, getDownloadURL, uploadBytes, getBlob } from "firebase/storage";
import React from "react";
import { useState, useEffect } from "react";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import fetchGoogleImages from "../../../utils/fetchGoogleImages";
import { logInventoryChange } from "../../../utils/logInventoryChange";
import { collection as fsCollection, query, orderBy, onSnapshot as fsOnSnapshot } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
// Removed useAuth because we will pass userId as prop
import EditProductModal from "../../inventory/EditProductModal";
import QRCodeGenerator from "../../inventory/QRCodeGenerator";
import AddColumnInventory from "../../inventory/AddColumnInventory";
import LocationPicker from "./LocationPicker";
import SmartShelfView from "./SmartShelfView";
import SmartStoreDesigner from "./SmartStoreDesigner";
import ViewStore from "./ViewStore";
import SmartOrderCreator from "./SmartOrderCreator";
import RestockOrderHistory from "./RestockOrderHistory";

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
  { id: "status", label: "Status", minWidth: 100, align: "center" },
  { id: "location", label: "Location", minWidth: 180 },
  { id: "source", label: "Source", minWidth: 120 },
  { id: "qr", label: "QR", minWidth: 80 },
  { id: "delete", label: "Delete", minWidth: 80 },
  { id: "edit", label: "Edit", minWidth: 80 },
];
const LS_KEY = "FLYP_INVENTORY_COLUMNS_V2_DISTRIBUTOR";
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


  // Recently Modified tab state
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [selectedTab, setSelectedTab] = useState("view");
  // QR modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTargetProduct, setQrTargetProduct] = useState(null);
  // Location management states
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationTargetProduct, setLocationTargetProduct] = useState(null);
  const [locationFilter, setLocationFilter] = useState("");
  // Unified Smart Store Designer state
  const [showSmartStoreDesigner, setShowSmartStoreDesigner] = useState(false);
  const [showViewStore, setShowViewStore] = useState(false);
  const [storeDesignerMode, setStoreDesignerMode] = useState('designer'); // 'designer' or 'viewer'
  // Smart Order Creator state
  const [showSmartOrderCreator, setShowSmartOrderCreator] = useState(false);
  const [showRestockOrderHistory, setShowRestockOrderHistory] = useState(false);
  // Tools dropdown state
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  // Column preferences state
  const [columns, setColumns] = useState(COLUMN_DEFAULTS);
  const [hiddenCols, setHiddenCols] = useState(new Set());
  // Custom columns
  const [customColumns, setCustomColumns] = useState([]); // [{id,label,minWidth,type,key}]
  const [showCustomColumnsModal, setShowCustomColumnsModal] = useState(false);

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

  const [viewMode, setViewMode] = useState("list");
  const db = getFirestore();

  const saveColumnPrefs = async (uid, order, hidden) => {
    try {
      // Persist to Firestore
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
        p.category?.toLowerCase().includes(s) ||
        p.location?.fullPath?.toLowerCase().includes(s);
      const matchesStatus = !statusFilter || getStatus(p.quantity) === statusFilter;
      // Multi-select: match if product's brand is in selected brands (OR logic)
      const matchesBrand =
        brandFilter.length === 0 || (p.brand && brandFilter.includes(p.brand));
      // Location filter
      const matchesLocation = !locationFilter || 
        (p.location?.fullPath?.toLowerCase().includes(locationFilter.toLowerCase()) ||
         p.location?.shelf === locationFilter ||
         p.location?.rack === locationFilter ||
         p.location?.aisle === locationFilter);
      return matchesSearch && matchesStatus && matchesBrand && matchesLocation;
    });
    setFiltered(result);
  }, [search, products, statusFilter, brandFilter, locationFilter]);

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

  const handleLocationSave = async (location) => {
    if (!locationTargetProduct) return;
    try {
      const productRef = doc(db, "businesses", userId, "products", locationTargetProduct.id);
      
      // Ensure location format matches SmartStoreDesigner structure
      // LocationPicker should return: { floor, aisle, rack, shelf, lane, fullPath }
      // But we'll normalize it to ensure compatibility
      const normalizedLocation = location ? {
        floor: location.floor || null,
        aisle: location.aisle || null,
        rack: location.rack || null,
        shelf: location.shelf || null,
        lane: location.lane || null,
        fullPath: location.fullPath || (location.floor || location.aisle || location.rack || location.shelf || location.lane 
          ? [location.floor, location.aisle, location.rack, location.shelf, location.lane].filter(Boolean).join(' > ')
          : null)
      } : null;
      
      await updateDoc(productRef, { location: normalizedLocation });
      toast.success("Location updated successfully! Changes will sync to Store Designer.");
      setShowLocationPicker(false);
      setLocationTargetProduct(null);
      
      // Force a small delay to ensure Firestore has processed the update
      // The onSnapshot listeners in both components will pick up the change automatically
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save location");
    }
  };

  const handleLocationClick = (product) => {
    setLocationTargetProduct(product);
    setShowLocationPicker(true);
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
    <div className="text-white px-0 md:px-0 py-4 md:py-6">
      {/* Enhanced Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        {/* Main Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search products by name, brand, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 pl-12 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all shadow-lg"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-lg">🔍</span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Row - Compact and Organized */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70 whitespace-nowrap">Status:</span>
            <select
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
              onChange={(e) => setStatusFilter(e.target.value)}
              value={statusFilter}
            >
              <option value="">All</option>
              <option value="In Stock">✅ In Stock</option>
              <option value="Low">⚠️ Low Stock</option>
            </select>
          </div>

          {/* Sort Controls */}
          {sortKey && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/70 whitespace-nowrap">Sort:</span>
              <select
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                onChange={(e) => setSortKey(e.target.value)}
                value={sortKey}
              >
                <option value="">None</option>
                <option value="quantity">📊 Quantity</option>
                <option value="costPrice">💰 Cost Price</option>
                <option value="sellingPrice">💵 Selling Price</option>
                <option value="mrp">🏷️ MRP</option>
              </select>
              {sortKey && (
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all text-sm"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              )}
            </div>
          )}

          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70 whitespace-nowrap">📍 Location:</span>
            <input
              type="text"
              placeholder="Search location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
            />
          </div>

          {/* Brand Filter */}
          <div className="relative">
            <button
              className="px-3 py-2 rounded-lg min-w-[140px] text-left bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all hover:bg-white/15"
              type="button"
              onClick={() => setShowBrandDropdown((prev) => !prev)}
            >
              <span className="text-white/70">🏷️ </span>
              {brandFilter.length === 0
                ? "All Brands"
                : brandFilter.length === 1
                ? brandFilter[0]
                : `${brandFilter.length} selected`}
              <span className="ml-1 text-white/50">▼</span>
            </button>
            {showBrandDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowBrandDropdown(false)}
                />
                <div className="absolute left-0 mt-2 bg-[#0b0f14] border border-white/20 rounded-xl shadow-2xl z-20 p-3 min-w-[220px] max-h-64 overflow-y-auto backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="text-sm font-semibold text-white">Select Brands</span>
                    <button
                      className="text-xs text-emerald-300 hover:text-emerald-200 font-medium"
                      type="button"
                      onClick={() => setBrandFilter([])}
                    >
                      Clear All
                    </button>
                  </div>
                  {availableBrands.length === 0 ? (
                    <div className="text-xs text-white/50 px-2 py-4 text-center">No brands available</div>
                  ) : (
                    <div className="space-y-1">
                      {availableBrands.map((brand, idx) => (
                        <label key={idx} className="flex items-center px-3 py-2 cursor-pointer hover:bg-white/10 rounded-lg transition-colors group">
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
                            className="mr-3 w-4 h-4 rounded border-white/30 text-emerald-500 focus:ring-emerald-400"
                          />
                          <span className="text-sm text-white group-hover:text-emerald-300 transition-colors">{brand}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Active Filters Display */}
          {(statusFilter || sortKey || locationFilter || brandFilter.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-white/70">Active filters:</span>
              {statusFilter && (
                <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-400/30">
                  {statusFilter}
                  <button onClick={() => setStatusFilter("")} className="ml-1 hover:text-white">×</button>
                </span>
              )}
              {sortKey && (
                <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs border border-blue-400/30">
                  Sort: {sortKey} {sortOrder === 'asc' ? '↑' : '↓'}
                  <button onClick={() => setSortKey("")} className="ml-1 hover:text-white">×</button>
                </span>
              )}
              {locationFilter && (
                <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs border border-purple-400/30">
                  📍 {locationFilter}
                  <button onClick={() => setLocationFilter("")} className="ml-1 hover:text-white">×</button>
                </span>
              )}
              {brandFilter.length > 0 && (
                <span className="px-2 py-1 rounded-lg bg-orange-500/20 text-orange-300 text-xs border border-orange-400/30">
                  🏷️ {brandFilter.length} brand{brandFilter.length > 1 ? 's' : ''}
                  <button onClick={() => setBrandFilter([])} className="ml-1 hover:text-white">×</button>
                </span>
              )}
              <button
                onClick={() => {
                  setStatusFilter("");
                  setSortKey("");
                  setLocationFilter("");
                  setBrandFilter([]);
                  setSearch("");
                }}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs border border-white/20 transition-all"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex mb-2 gap-2 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTab("view")}
            className={`px-4 py-2 rounded-lg border transition-all ${
              selectedTab === "view" 
                ? "bg-emerald-500 text-slate-900 border-emerald-400 font-semibold shadow-lg" 
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            📦 Inventory
          </button>
          <button
            onClick={() => setSelectedTab("shelf")}
            className={`px-4 py-2 rounded-lg border transition-all ${
              selectedTab === "shelf" 
                ? "bg-emerald-500 text-slate-900 border-emerald-400 font-semibold shadow-lg" 
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            🗂️ Smart Shelf View
          </button>
          <button
            onClick={() => setSelectedTab("recent")}
            className={`px-4 py-2 rounded-lg border transition-all ${
              selectedTab === "recent" 
                ? "bg-emerald-500 text-slate-900 border-emerald-400 font-semibold shadow-lg" 
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            🕐 Recently Modified
          </button>
          <button
            onClick={() => setSelectedTab("restock")}
            className={`px-4 py-2 rounded-lg border transition-all ${
              selectedTab === "restock" 
                ? "bg-emerald-500 text-slate-900 border-emerald-400 font-semibold shadow-lg" 
                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            📋 Restock Orders
          </button>
        </div>
        
        {/* Quick Actions - Only show when viewing inventory */}
        {selectedTab === "view" && (
          <div className="ml-auto flex gap-2">
            {/* Quick Order Creator - Prominent for low stock */}
            {products.filter(p => {
              const qty = parseInt(p.quantity) || 0;
              return qty <= 5;
            }).length > 0 && (
              <button
                onClick={() => {
                  setShowSmartOrderCreator(true);
                }}
                className="px-4 py-2 rounded-lg border bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-white font-semibold shadow-lg animate-pulse"
                title="Quick order for low stock items"
              >
                ⚡ Quick Order ({products.filter(p => {
                  const qty = parseInt(p.quantity) || 0;
                  return qty <= 5;
                }).length} low stock)
              </button>
            )}
          </div>
        )}

        {/* Tools Dropdown - Less frequently used features */}
        <div className="ml-auto relative">
          <button
            onClick={() => setShowToolsDropdown(!showToolsDropdown)}
            className="px-4 py-2 rounded-lg border bg-white/5 border-white/10 text-white hover:bg-white/10 transition-all flex items-center gap-2"
            title="Additional tools"
          >
            🛠️ Tools
            <span className="text-xs">▼</span>
          </button>
          {showToolsDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowToolsDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-white/10 bg-[#0B0F14] shadow-2xl z-20 overflow-hidden">
                <button
                  onClick={() => {
                    setStoreDesignerMode('designer');
                    setShowSmartStoreDesigner(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  🧠 Smart Store Designer
                </button>
                <button
                  onClick={() => {
                    setShowViewStore(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  👁️ View Store Layout
                </button>
                <div className="border-t border-white/10" />
                <button
                  onClick={() => {
                    setShowRestockOrderHistory(true);
                    setShowToolsDropdown(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  📋 Order History
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inventory Tab Content */}
      {selectedTab === "view" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              className={`px-4 py-1 mr-2 rounded-lg border ${viewMode === "list" ? "bg-emerald-600 text-white border-emerald-500" : "bg-white/5 text-white/80 border-white/10 hover:text-white"}`}
              onClick={() => setViewMode("list")}
            >
              List View
            </button>
            <button
              className={`px-4 py-1 rounded-lg border ${viewMode === "grid" ? "bg-emerald-600 text-white border-emerald-500" : "bg-white/5 text-white/80 border-white/10 hover:text-white"}`}
              onClick={() => setViewMode("grid")}
            >
              Grid View
            </button>
          </div>

          {viewMode === "list" ? (
            <>
          {/* Table Header with Stats */}
          <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-gradient-to-r from-white/5 to-white/3 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all duration-200 text-sm font-medium flex items-center gap-2"
                onClick={() => setShowCustomColumnsModal(true)}
                type="button"
                title="Manage columns"
              >
                <span>⚙️</span>
                <span>Manage Columns</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <div className="text-sm text-white/80">
                <span className="font-semibold text-emerald-400">{filtered.length}</span>
                <span className="text-white/60"> of </span>
                <span className="font-semibold">{products.length}</span>
                <span className="text-white/60"> products</span>
                {filtered.length !== products.length && (
                  <span className="ml-2 text-xs text-white/50">
                    ({products.length - filtered.length} hidden by filters)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {products.filter(p => {
                const qty = parseInt(p.quantity) || 0;
                return qty <= 5;
              }).length > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-medium">
                  ⚠️ {products.filter(p => {
                    const qty = parseInt(p.quantity) || 0;
                    return qty <= 5;
                  }).length} low stock items
                </div>
              )}
            </div>
          </div>
              {/* Responsive Table Container */}
              <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5 backdrop-blur-xl shadow-2xl">
                {/* Desktop/Tablet View - Horizontal Scroll */}
                <div className="overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin' }}>
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full text-xs sm:text-sm md:text-base">
                      <thead className="bg-gradient-to-r from-white/15 via-white/10 to-white/15 text-left sticky top-0 z-10 backdrop-blur-md border-b-2 border-white/20">
                        <tr>
                          {columns.filter(c => !hiddenCols.has(c.id)).map(col => (
                            <th
                              key={col.id}
                              className={
                                "px-3 py-3 sm:px-4 sm:py-4 text-white font-semibold border-r border-white/10 last:border-r-0 " +
                                (col.id === "status" ? "text-center" : "text-left") +
                                " whitespace-nowrap"
                              }
                              style={{ 
                                minWidth: col.minWidth ? `${col.minWidth}px` : 'auto',
                                maxWidth: col.id === 'location' ? '350px' : col.id === 'productName' ? '250px' : 'auto'
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <span>{col.label}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filtered.map((p, idx) => (
                          <tr 
                            key={p.id} 
                            className="border-b border-white/5 hover:bg-white/10 transition-all duration-200 group/row bg-white/0 hover:bg-gradient-to-r hover:from-white/5 hover:to-white/0"
                            style={{
                              animation: `fadeIn 0.3s ease-out ${idx * 0.02}s both`
                            }}
                          >
                        {columns.filter(c => !hiddenCols.has(c.id)).map(col => {
                          switch (col.id) {
                            case "qr":
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0">
                                  <button
                                    onClick={() => { setQrTargetProduct(p); setShowQrModal(true); }}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-400/30 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                                    title="Generate QR"
                                  >
                                    Generate
                                  </button>
                                </td>
                              );
                            case "image":
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0">
                      <div
                        className="inline-block cursor-pointer"
                        onClick={() => handleImageClick(p)}
                        title="Click to upload image"
                      >
                      <img
                        src={p.imageUrl || "/placeholder.png"}
                        alt="product"
                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-cover border-2 border-white/20 ring-2 ring-white/10 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                      />
                    </div>
                  </td>
                              );
                            case "productName":
                              return (
                  <td
                                  key={col.id}
                                  className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 max-w-[220px] sm:max-w-[250px]"
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
                      <span className="text-sm sm:text-base font-medium text-white group-hover/row:text-emerald-300 transition-colors">{p.productName}</span>
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
                    className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 max-w-[150px] sm:max-w-[180px] break-words whitespace-normal"
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
                                    <span className="text-xs sm:text-sm text-white/80">{p[col.id] || "-"}</span>
                    )}
                  </td>
                              );
                            case "quantity":
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 text-center" onClick={() => startEdit(p.id, "quantity", p.quantity)}>
                    {editingCell.rowId === p.id && editingCell.field === "quantity" ? (
                      <input
                        type="number"
                        className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={() => saveEdit(p.id, "quantity", Number(editedValue))}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm sm:text-base font-semibold text-white">{p.quantity || 0}</span>
                    )}
                  </td>
                              );
                            case "costPrice":
                            case "sellingPrice":
                            case "mrp":
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0" onClick={() => startEdit(p.id, col.id, p[col.id])}>
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
                                    p[col.id] !== undefined ? <span className="text-sm sm:text-base font-medium text-white/90">₹{Number(p[col.id]).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : <span className="text-white/40">-</span>
                    )}
                  </td>
                              );
                            case "gstRate":
                              // Display gstRate from either field; prefer explicit gstRate, fallback to taxRate
                              const currentGst = p.gstRate !== undefined && p.gstRate !== null ? p.gstRate : p.taxRate;
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 text-center" onClick={() => startEdit(p.id, "gstRate", currentGst)}>
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
                                    <span className="text-sm sm:text-base font-medium text-white/80">{currentGst !== undefined && currentGst !== null ? `${currentGst}%` : "-"}</span>
                                    )}
                  </td>
                              );
                            case "status": {
                              const st = getStatus(p.quantity);
                              const badgeText = st === "In Stock" ? "In\u00A0Stock" : st; // keep on one line
                              const isLow = st === "Low";
                              const isOut = st === "Unknown" || (parseInt(p.quantity) || 0) === 0;
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    <span
                                      title={st}
                                      className={
                                        "inline-flex items-center justify-center min-w-[80px] sm:min-w-[90px] h-7 sm:h-8 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-bold shadow-md " +
                                        (isLow ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white border border-rose-400/50" : 
                                         isOut ? "bg-gradient-to-r from-gray-500 to-gray-600 text-white border border-gray-400/50" :
                                         "bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-900 border border-emerald-300/50")
                                      }
                                    >
                                      {badgeText}
                                    </span>
                                    {(isLow || isOut) && (
                                      <button
                                        onClick={() => {
                                          setShowSmartOrderCreator(true);
                                          // The SmartOrderCreator will handle pre-filtering
                                        }}
                                        className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-400/30 transition-all"
                                        title="Quick add to restock order"
                                      >
                                        ⚡
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            case "location":
                              // Display location - fullPath contains the readable names (e.g., "Floor 1 > Aisle A1 > Rack 1")
                              const locationPath = p.location?.fullPath;
                              
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 min-w-[200px] sm:min-w-[220px] max-w-[300px] sm:max-w-[350px]">
                                  {locationPath ? (
                                    <div className="flex items-start gap-2 group/loc">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-emerald-400 text-sm flex-shrink-0">📍</span>
                                          <span 
                                            className="text-xs text-emerald-300 font-medium break-words whitespace-normal leading-relaxed" 
                                            title={locationPath}
                                          >
                                            {locationPath}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleLocationClick(p)}
                                        className="text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 opacity-0 group-hover/loc:opacity-100 transition-opacity flex-shrink-0"
                                        title="Change location"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleLocationClick(p)}
                                      className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/70 border border-white/20 hover:border-white/30 transition-all flex items-center gap-1"
                                    >
                                      <span>📍</span>
                                      <span>Set Location</span>
                                    </button>
                                  )}
                                </td>
                              );
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
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 text-center">
                    <button
                      onClick={() => handleDelete(p)}
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-2 rounded-lg transition-all duration-200"
                      title="Delete Item"
                    >
                      🗑️
                    </button>
                  </td>
                              );
                            case "edit":
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0">
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
                                  className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 max-w-[180px] break-words whitespace-normal"
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
                                    <span className="text-xs sm:text-sm text-white/80">{p[col.id] || "-"}</span>
                                  )}
                                </td>
                              );
                          }
                        })}
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                        <td colSpan={columns.filter(c => !hiddenCols.has(c.id)).length} className="text-center px-3 py-8 sm:py-12 text-white/70">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-4xl">📦</span>
                            <p className="text-base sm:text-lg font-medium">{products.length === 0 ? "No products found" : "Loading inventory..."}</p>
                            {products.length > 0 && <p className="text-sm text-white/50">Try adjusting your filters</p>}
                          </div>
                        </td>
                </tr>
              ) : null}
            </tbody>
                  </table>
                  </div>
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
                <div key={item.id} className="p-4 rounded-xl border border-white/10 bg-white/5 shadow-lg flex flex-col hover:bg-white/10 transition-colors">
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
                        className="w-full h-32 object-contain rounded border border-white/20 bg-white/5"
                      />
                    </button>
                  </div>
                  <h3 className="font-semibold mb-1">{item.productName}</h3>
                  <p className="text-sm text-white/70 mb-1">{item.brand} | {item.category}</p>
                  <p className="text-sm mb-1">
                    Qty: {item.quantity} {item.sellingPrice !== undefined && <>| ₹{item.sellingPrice}</>}
                  </p>
                  { (item.mrp !== undefined || item.gstRate !== undefined || item.taxRate !== undefined) && (
                    <p className="text-sm mb-1">
                      {item.mrp !== undefined && <>MRP: ₹{item.mrp}</>}
                      {(item.mrp !== undefined) && (item.gstRate !== undefined || item.taxRate !== undefined) && <> &nbsp;|&nbsp; </>}
                      {(item.gstRate !== undefined || item.taxRate !== undefined) && <>GST: {(item.gstRate ?? item.taxRate)}%</>}
                  </p>
                  )}
                  <p className="text-xs text-white/60 mb-1">
                    SKU: {item.sku || "N/A"} | Unit: {item.unit || "N/A"}
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
                      className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15 text-white"
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

      {/* Smart Shelf View Tab Content */}
      {selectedTab === "shelf" && (
        <SmartShelfView userId={userId} products={products} />
      )}

      {/* Recently Modified Tab Content */}
      {selectedTab === "recent" && (
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-3">Recent Inventory Modifications</h2>
          {inventoryLogs.length === 0 ? (
            <p className="text-white/60">No recent modifications found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventoryLogs.map((mod, index) => (
                <div key={index} className="shadow rounded-xl p-4 text-sm border border-white/10 bg-white/5 text-white">
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

      {/* Restock Orders Tab Content */}
      {selectedTab === "restock" && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Restock Order Management</h2>
            <button
              onClick={() => setShowSmartOrderCreator(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-white font-semibold shadow-lg"
            >
              ➕ Create New Order
            </button>
          </div>
          <RestockOrderHistory userId={userId} onClose={() => {}} embedded={true} />
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
      {/* QR Modal */}
      {showQrModal && qrTargetProduct && (
        <QRCodeGenerator
          product={qrTargetProduct}
          onClose={() => {
            setShowQrModal(false);
            setQrTargetProduct(null);
          }}
        />
      )}


      {/* Location Picker Modal */}
      {showLocationPicker && locationTargetProduct && (
        <LocationPicker
          userId={userId}
          productId={locationTargetProduct.id}
          currentLocation={locationTargetProduct.location}
          onSave={handleLocationSave}
          onCancel={() => {
            setShowLocationPicker(false);
            setLocationTargetProduct(null);
          }}
        />
      )}

      {/* Unified Smart Store Designer */}
      {showSmartStoreDesigner && (
        <SmartStoreDesigner
          userId={userId}
          products={products}
          mode={storeDesignerMode}
          onClose={() => setShowSmartStoreDesigner(false)}
        />
      )}
      {showViewStore && (
        <ViewStore
          userId={userId}
          products={products}
          onClose={() => setShowViewStore(false)}
        />
      )}
      {showSmartOrderCreator && (
        <SmartOrderCreator
          userId={userId}
          products={products}
          onClose={() => setShowSmartOrderCreator(false)}
          preSelectLowStock={selectedTab === "view"}
        />
      )}
      {showRestockOrderHistory && selectedTab !== "restock" && (
        <RestockOrderHistory
          userId={userId}
          onClose={() => setShowRestockOrderHistory(false)}
        />
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
        // Use Unsplash API directly
        try {
          const accessKey = 'n_BViYvOrSv2B6zb_SIHtZu3fnUEijs_KVuD7IXYTVc';
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${searchTerm}&client_id=${accessKey}`
          );
          const data = await res.json();
          results = data.results?.map(r => r.urls?.regular || r.urls?.small) || [];
        } catch (err) {
          console.error('Unsplash error:', err);
          results = [];
        }
      } else {
        const fetchGoogleImages2 = (await import("../../../utils/fetchGoogleImages")).default;
        results = await fetchGoogleImages2(searchTerm);
      }
      setImageResults(results);
    } catch (error) {
      console.error("Image search error:", error);
    }
    setLoading(false);
  };

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onClose = () => {
    setShowImageModal(false);
    setImageTargetProduct(null);
    setImageUploadFile(null);
    setImageUploadError("");
    setImagePreviewUrl(null);
    setSearchTerm("");
    setImageResults([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[95%] max-w-2xl rounded-2xl border border-white/10 bg-[#0B0F14]/95 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold leading-tight">Update Product Image</h2>
            <p className="text-xs text-white/60 mt-0.5">{imageTargetProduct?.productName || "Product"}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Source toggle */}
          <div className="inline-flex rounded-full bg-white/10 p-1 border border-white/10">
            <button
              onClick={() => setImageSource("unsplash")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${imageSource === 'unsplash' ? 'bg-emerald-500 text-white' : 'text-white/80 hover:text-white'}`}
            >
              Unsplash
            </button>
            <button
              onClick={() => setImageSource("google")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${imageSource === 'google' ? 'bg-emerald-500 text-white' : 'text-white/80 hover:text-white'}`}
            >
              Google
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`Search ${imageSource === 'unsplash' ? 'Unsplash' : 'Google'}…`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/15 placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110"
              onClick={handleImageSearch}
              type="button"
              disabled={loading}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Results */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-1">
            {imageResults.map((imgUrl, index) => (
              <button
                key={index}
                type="button"
                className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5 hover:border-emerald-400/50"
                onClick={() => {
                  setImageUploadFile(null);
                  setImageUploadError("");
                  setImagePreviewUrl(imgUrl);
                }}
              >
                <img
                  src={imgUrl}
                  alt="search result"
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.src = "/placeholder.png")}
                />
                <span className="absolute inset-0 hidden group-hover:block bg-black/20" />
              </button>
            ))}
            {imageResults.length === 0 && (
              <div className="col-span-full text-center text-sm text-white/60">No images yet — try a different query.</div>
            )}
          </div>

          {/* File picker & preview */}
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20"
              disabled={imageUploadLoading}
            />
            {(imagePreviewUrl || imageUploadFile) && (
              <div className="flex items-center justify-center">
                <img
                  src={imagePreviewUrl || ''}
                  alt="Preview"
                  className="max-h-48 max-w-full rounded-lg border border-white/10 bg-white/5 object-contain"
                />
              </div>
            )}
            {imageUploadError && (
              <div className="text-rose-400 text-sm">{imageUploadError}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15"
            disabled={imageUploadLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleImageUpload}
            className={`px-4 py-2 rounded-lg ${ (imageUploadFile || imagePreviewUrl) && !imageUploadLoading ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-white/10 cursor-not-allowed'} `}
            disabled={!(imageUploadFile || imagePreviewUrl) || imageUploadLoading}
          >
            {imageUploadLoading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};