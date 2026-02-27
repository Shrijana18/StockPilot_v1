import { getStorage, ref, getDownloadURL, uploadBytes, getBlob } from "firebase/storage";
import React from "react";
import { useState, useEffect } from "react";
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import fetchGoogleImages from "../../utils/fetchGoogleImages";
import { logInventoryChange } from "../../utils/logInventoryChange";
import { collection as fsCollection, query, orderBy, onSnapshot as fsOnSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
// Removed useAuth because we will pass userId as prop
import EditProductModal from "./EditProductModal";
import AddColumnInventory from "./AddColumnInventory";
import QRCodeGenerator from "./QRCodeGenerator";
import LocationPicker from "../distributor/inventory/LocationPicker";
import SmartShelfView from "../distributor/inventory/SmartShelfView";
import SmartStoreDesigner from "../distributor/inventory/SmartStoreDesigner";
import ViewStore from "../distributor/inventory/ViewStore";
import SmartOrderCreator from "../distributor/inventory/SmartOrderCreator";
import RestockOrderHistory from "../distributor/inventory/RestockOrderHistory";
import { getStockDisplay, formatLooseProductStock, calculateSellingUnitPrice, calculateSellingUnitStock, validateLooseProductConfig } from "../../utils/looseProductUtils";

// === Column Preferences: same structure as distributor ViewInventory ===
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
  { id: "mrp", label: "MRP", minWidth: 110 },
  { id: "gstRate", label: "GST %", minWidth: 90 },
  { id: "isLooseProduct", label: "Loose", minWidth: 90, align: "center" },
  { id: "status", label: "Status", minWidth: 100, align: "center" },
  { id: "location", label: "Location", minWidth: 180 },
  { id: "source", label: "Source", minWidth: 120 },
  { id: "qr", label: "QR", minWidth: 80 },
  { id: "delete", label: "Delete", minWidth: 80 },
  { id: "edit", label: "Edit", minWidth: 80 },
];
const LS_KEY = "FLYP_INVENTORY_COLUMNS_V2_RETAILER";
const prefDocPath = (uid) => [`businesses`, uid, `preferences`, `inventoryColumns`];

const toSafeKey = (name = "") =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Inline edit input: keeps value in local state so the table doesn't re-render on every keystroke (smoother UX)
const InlineEditInput = ({
  initialValue,
  onSave,
  type = "text",
  step,
  className = "w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-shadow",
  parseSave = (v) => v,
}) => {
  const [value, setValue] = React.useState(initialValue ?? "");
  const handleBlur = () => {
    const out = type === "number" ? (parseFloat(value) || 0) : value;
    onSave(parseSave(out));
  };
  return (
    <input
      type={type}
      step={step}
      className={className}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      autoFocus
    />
  );
};

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkField, setBulkField] = useState("quantity");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
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
  // Location filter (same as distributor)
  const [locationFilter, setLocationFilter] = useState("");
  // Location management states
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationTargetProduct, setLocationTargetProduct] = useState(null);
  // Unified Smart Store Designer state
  const [showSmartStoreDesigner, setShowSmartStoreDesigner] = useState(false);
  const [showViewStore, setShowViewStore] = useState(false);
  const [storeDesignerMode, setStoreDesignerMode] = useState("designer");
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
        // Merge any missing default columns that weren't in saved order
        const existingIds = new Set(ordered.map(c => c.id));
        const missingDefaults = COLUMN_DEFAULTS.filter(c => !existingIds.has(c.id));
        const merged = [...ordered, ...missingDefaults];
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
        // Merge any missing default columns that weren't in saved order
        const existingIds = new Set(ordered.map(c => c.id));
        const missingDefaults = COLUMN_DEFAULTS.filter(c => !existingIds.has(c.id));
        const merged = [...ordered, ...missingDefaults];
        setColumns(merged);
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
      const matchesBrand =
        brandFilter.length === 0 || (p.brand && brandFilter.includes(p.brand));
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
      // Optimistic UI: update local list so the new value shows immediately without waiting for Firestore
      const normalized = field === "quantity" || field === "gstRate" || field === "costPrice" || field === "sellingPrice" || field === "mrp" ? Number(value) : value;
      setProducts((prev) => prev.map((p) => (p.id === rowId ? { ...p, [field]: normalized, ...(field === "gstRate" ? { taxRate: normalized } : {}) } : p)));
      setFiltered((prev) => prev.map((p) => (p.id === rowId ? { ...p, [field]: normalized, ...(field === "gstRate" ? { taxRate: normalized } : {}) } : p)));
    } catch (err) {
      console.error("Error updating inventory field:", err);
    } finally {
      setEditingCell({ rowId: null, field: null });
      setEditedValue("");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size >= filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());
  const bulkFields = [
    { id: "quantity", label: "Qty", type: "number" },
    { id: "hsnCode", label: "HSN Code", type: "text" },
    { id: "unit", label: "Unit", type: "text" },
    { id: "brand", label: "Brand", type: "text" },
    { id: "category", label: "Category", type: "text" },
  ];
  const applyBulkUpdate = async () => {
    if (selectedIds.size === 0 || bulkValue === "" && bulkField !== "quantity") return;
    setBulkApplying(true);
    try {
      const field = bulkField;
      const value = bulkField === "quantity" ? (parseFloat(bulkValue) || 0) : String(bulkValue).trim();
      const ids = Array.from(selectedIds);
      const refs = ids.map((id) => doc(db, "businesses", userId, "products", id));
      const productsFromState = ids.map((id) => filtered.find((x) => x.id === id));
      const { calculateSellingUnitStock } = await import("../../utils/looseProductUtils");
      const batch = writeBatch(db);
      for (let i = 0; i < ids.length; i++) {
        const originalData = productsFromState[i] || {};
        let updatePayload;
        if (field === "quantity" && originalData.isLooseProduct) {
          const conversionFactor = originalData.conversionFactor || 1;
          const stockInSellingUnit = calculateSellingUnitStock(Number(value) || 0, conversionFactor);
          updatePayload = { quantity: Number(value), stockInSellingUnit };
        } else {
          updatePayload = field === "gstRate" ? { [field]: value, taxRate: value } : { [field]: value };
        }
        batch.update(refs[i], updatePayload);
      }
      await batch.commit();
      const normalized = field === "quantity" ? Number(value) : value;
      const count = ids.length;
      setProducts((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, [field]: normalized, ...(field === "gstRate" ? { taxRate: normalized } : {}) } : p)));
      setFiltered((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, [field]: normalized, ...(field === "gstRate" ? { taxRate: normalized } : {}) } : p)));
      setSelectedIds(new Set());
      setBulkValue("");
      toast.success(`Updated ${count} product(s).`);
      productsFromState.forEach((originalData, i) => {
        const data = originalData || {};
        const updatedData = { ...data, [field]: normalized, ...(field === "gstRate" ? { taxRate: normalized } : {}) };
        if (field === "quantity" && data.isLooseProduct) {
          const conversionFactor = data.conversionFactor || 1;
          updatedData.stockInSellingUnit = calculateSellingUnitStock(Number(value) || 0, conversionFactor);
        }
        logInventoryChange({ userId, productId: ids[i], sku: data.sku || "N/A", productName: data.productName || "N/A", brand: data.brand || "N/A", category: data.category || "N/A", previousData: data, updatedData, action: "updated", source: "bulk-edit" }).catch(() => {});
      });
    } catch (err) {
      console.error("Bulk update error:", err);
      toast.error("Bulk update failed. Please try again.");
    } finally {
      setBulkApplying(false);
    }
  };

  const applyBulkSyncSellFromMrp = async () => {
    if (selectedIds.size === 0) return;
    setBulkApplying(true);
    try {
      const toUpdate = Array.from(selectedIds)
        .map((id) => ({ id, p: filtered.find((x) => x.id === id) }))
        .filter(({ p }) => p && Number.isFinite(Number(p.mrp)));
      if (toUpdate.length === 0) {
        toast.success("No products had MRP to sync.");
        setBulkApplying(false);
        return;
      }
      const refs = toUpdate.map(({ id }) => doc(db, "businesses", userId, "products", id));
      const batch = writeBatch(db);
      toUpdate.forEach(({ p }, i) => {
        batch.update(refs[i], { sellingPrice: Number(p.mrp) });
      });
      await batch.commit();
      const count = toUpdate.length;
      const byId = new Set(toUpdate.map(({ id }) => id));
      setProducts((prev) => prev.map((x) => (byId.has(x.id) ? { ...x, sellingPrice: Number(filtered.find((f) => f.id === x.id)?.mrp) } : x)));
      setFiltered((prev) => prev.map((x) => (byId.has(x.id) ? { ...x, sellingPrice: Number(filtered.find((f) => f.id === x.id)?.mrp) } : x)));
      setSelectedIds(new Set());
      toast.success(`Synced Sell ← MRP for ${count} product(s).`);
      toUpdate.forEach(({ id, p }) => {
        const originalData = { ...p };
        const updatedData = { ...p, sellingPrice: Number(p.mrp) };
        logInventoryChange({ userId, productId: id, sku: p.sku || "N/A", productName: p.productName || "N/A", brand: p.brand || "N/A", category: p.category || "N/A", previousData: originalData, updatedData, action: "updated", source: "bulk-sync-sell-from-mrp" }).catch(() => {});
      });
    } catch (err) {
      console.error("Bulk sync error:", err);
      toast.error("Sync failed. Please try again.");
    } finally {
      setBulkApplying(false);
    }
  };

  const applyBulkSyncMrpFromSell = async () => {
    if (selectedIds.size === 0) return;
    setBulkApplying(true);
    try {
      const toUpdate = Array.from(selectedIds)
        .map((id) => ({ id, p: filtered.find((x) => x.id === id), sellVal: Number(filtered.find((x) => x.id === id)?.sellingPrice) }))
        .filter(({ p, sellVal }) => p && Number.isFinite(sellVal));
      if (toUpdate.length === 0) {
        toast.success("No products had Sell price to sync.");
        setBulkApplying(false);
        return;
      }
      const refs = toUpdate.map(({ id }) => doc(db, "businesses", userId, "products", id));
      const batch = writeBatch(db);
      toUpdate.forEach(({ sellVal }, i) => {
        batch.update(refs[i], { mrp: sellVal });
      });
      await batch.commit();
      const count = toUpdate.length;
      const byId = new Map(toUpdate.map(({ id, sellVal }) => [id, sellVal]));
      setProducts((prev) => prev.map((x) => (byId.has(x.id) ? { ...x, mrp: byId.get(x.id) } : x)));
      setFiltered((prev) => prev.map((x) => (byId.has(x.id) ? { ...x, mrp: byId.get(x.id) } : x)));
      setSelectedIds(new Set());
      toast.success(`Synced MRP ← Sell for ${count} product(s).`);
      toUpdate.forEach(({ id, p, sellVal }) => {
        const originalData = { ...p };
        const updatedData = { ...p, mrp: sellVal };
        logInventoryChange({ userId, productId: id, sku: p.sku || "N/A", productName: p.productName || "N/A", brand: p.brand || "N/A", category: p.category || "N/A", previousData: originalData, updatedData, action: "updated", source: "bulk-sync-mrp-from-sell" }).catch(() => {});
      });
    } catch (err) {
      console.error("Bulk sync error:", err);
      toast.error("Sync failed. Please try again.");
    } finally {
      setBulkApplying(false);
    }
  };

  const handleLocationSave = async (location) => {
    if (!locationTargetProduct) return;
    try {
      const productRef = doc(db, "businesses", userId, "products", locationTargetProduct.id);
      const normalizedLocation = location ? {
        floor: location.floor || null,
        aisle: location.aisle || null,
        rack: location.rack || null,
        shelf: location.shelf || null,
        lane: location.lane || null,
        fullPath: location.fullPath || (location.floor || location.aisle || location.rack || location.shelf || location.lane
          ? [location.floor, location.aisle, location.rack, location.shelf, location.lane].filter(Boolean).join(" > ")
          : null),
      } : null;
      await updateDoc(productRef, { location: normalizedLocation });
      toast.success("Location updated successfully! Changes will sync to Store Designer.");
      setShowLocationPicker(false);
      setLocationTargetProduct(null);
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

  return (
    <div className="text-white px-0 md:px-0 py-4 md:py-6">
      {/* Enhanced Search and Filter Bar - same layout as distributor */}
      <div className="mb-6 space-y-4">
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

        <div className="flex flex-wrap items-center gap-3">
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
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all text-sm"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            )}
          </div>

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

          <div className="relative">
            <button
              className="px-3 py-2 rounded-lg min-w-[140px] text-left bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all hover:bg-white/15"
              type="button"
              onClick={() => setShowBrandDropdown((prev) => !prev)}
            >
              <span className="text-white/70">🏷️ </span>
              {brandFilter.length === 0 ? "All Brands" : brandFilter.length === 1 ? brandFilter[0] : `${brandFilter.length} selected`}
              <span className="ml-1 text-white/50">▼</span>
            </button>
            {showBrandDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowBrandDropdown(false)} />
                <div className="absolute left-0 mt-2 bg-[#0b0f14] border border-white/20 rounded-xl shadow-2xl z-20 p-3 min-w-[220px] max-h-64 overflow-y-auto backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="text-sm font-semibold text-white">Select Brands</span>
                    <button className="text-xs text-emerald-300 hover:text-emerald-200 font-medium" type="button" onClick={() => setBrandFilter([])}>Clear All</button>
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
                              if (e.target.checked) setBrandFilter([...brandFilter, brand]);
                              else setBrandFilter(brandFilter.filter((b) => b !== brand));
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

          <button
            onClick={() => setShowImageModalAI(true)}
            className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] text-sm"
          >
            Search with AI
          </button>
        </div>

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
                Sort: {sortKey} {sortOrder === "asc" ? "↑" : "↓"}
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
                🏷️ {brandFilter.length} brand{brandFilter.length > 1 ? "s" : ""}
                <button onClick={() => setBrandFilter([])} className="ml-1 hover:text-white">×</button>
              </span>
            )}
            <button
              onClick={() => { setStatusFilter(""); setSortKey(""); setLocationFilter(""); setBrandFilter([]); setSearch(""); }}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs border border-white/20 transition-all"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation - same as distributor */}
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
            {products.filter(p => {
              const qty = parseInt(p.quantity) || 0;
              return qty <= 5;
            }).length > 0 && (
              <button
                onClick={() => setShowSmartOrderCreator(true)}
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

        {/* Tools Dropdown - same as distributor */}
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
                    setStoreDesignerMode("designer");
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

      {/* Inventory Tab Content - same structure as distributor */}
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
          {/* Table Header with Stats - same as distributor */}
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
              {products.filter(p => { const qty = parseInt(p.quantity) || 0; return qty <= 5; }).length > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-medium">
                  ⚠️ {products.filter(p => { const qty = parseInt(p.quantity) || 0; return qty <= 5; }).length} low stock items
                </div>
              )}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-3 px-4 py-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-emerald-300">{selectedIds.size} selected</span>
              <select
                value={bulkField}
                onChange={(e) => setBulkField(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
                {bulkFields.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-800 text-white">{f.label}</option>
                ))}
              </select>
              <span className="text-white/70 text-sm">to</span>
              <input
                type={bulkField === "quantity" ? "number" : "text"}
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkField === "quantity" ? "e.g. 10" : "value"}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 w-28 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
              <button
                onClick={applyBulkUpdate}
                disabled={bulkApplying || (bulkField === "quantity" ? bulkValue === "" : !bulkValue.trim())}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {bulkApplying ? "Updating…" : "Apply"}
              </button>
              <span className="text-white/40 text-sm">|</span>
              <button
                onClick={applyBulkSyncSellFromMrp}
                disabled={bulkApplying}
                className="px-3 py-1.5 rounded-lg border border-amber-400/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-sm transition"
                title="Set Sell price = MRP for selected"
              >
                Sync Sell ← MRP
              </button>
              <button
                onClick={applyBulkSyncMrpFromSell}
                disabled={bulkApplying}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 text-sm transition"
                title="Set MRP = Sell price for selected"
              >
                Sync MRP ← Sell
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 text-sm transition"
              >
                Clear selection
              </button>
            </div>
          )}

              <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5 backdrop-blur-xl shadow-2xl">
                <div className="overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent" style={{ scrollbarWidth: "thin" }}>
                  <div className="inline-block min-w-full align-middle">
                  <table className="w-full text-xs sm:text-sm md:text-base">
                  <thead className="bg-gradient-to-r from-white/15 via-white/10 to-white/15 text-left sticky top-0 z-10 backdrop-blur-md border-b-2 border-white/20">
                    <tr>
                      <th className="px-2 py-3 w-10 border-r border-white/10 text-center">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedIds.size === filtered.length}
                          onChange={toggleSelectAll}
                          className="rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-400/50"
                          title="Select all on page"
                        />
                      </th>
                      {columns.filter(c => !hiddenCols.has(c.id)).map(col => (
                        <th
                          key={col.id}
                          className={
                            "px-3 py-3 sm:px-4 sm:py-4 text-white font-semibold border-r border-white/10 last:border-r-0 " +
                            (col.id === "status" || col.id === "isLooseProduct" ? "text-center" : "text-left") +
                            " whitespace-nowrap"
                          }
                          style={{
                            minWidth: col.minWidth ? `${col.minWidth}px` : "auto",
                            maxWidth: col.id === "location" ? "350px" : col.id === "productName" ? "250px" : "auto",
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
                        className={`border-b border-white/5 hover:bg-white/10 transition-all duration-200 group/row ${selectedIds.has(p.id) ? "bg-emerald-500/10" : "bg-white/0"} hover:bg-gradient-to-r hover:from-white/5 hover:to-white/0`}
                        style={{ animation: `fadeIn 0.3s ease-out ${idx * 0.02}s both` }}
                      >
                        <td className="px-2 py-3 border-r border-white/5 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-white/30 bg-white/10 text-emerald-500 focus:ring-emerald-400/50"
                          />
                        </td>
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
                                  className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 max-w-[220px] sm:max-w-[250px] break-words whitespace-normal min-h-[2.5rem]"
                                  onClick={() => startEdit(p.id, "productName", p.productName)}
                                >
                                  {editingCell.rowId === p.id && editingCell.field === "productName" ? (
                                    <InlineEditInput
                                      initialValue={p.productName ?? ""}
                                      onSave={(v) => saveEdit(p.id, "productName", v)}
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
                                  className="p-2 max-w-[180px] break-words whitespace-normal min-h-[2.5rem]"
                                  onClick={() => startEdit(p.id, col.id, p[col.id])}
                                >
                                  {editingCell.rowId === p.id && editingCell.field === col.id ? (
                                    <InlineEditInput
                                      initialValue={p[col.id] ?? ""}
                                      onSave={(v) => saveEdit(p.id, col.id, v)}
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
                                <td key={col.id} className="p-2 min-h-[2.5rem] align-middle" onClick={() => startEdit(p.id, "quantity", p.quantity)}>
                                  {editingCell.rowId === p.id && editingCell.field === "quantity" ? (
                                    <InlineEditInput
                                      type="number"
                                      step={p.isLooseProduct ? "0.01" : "1"}
                                      initialValue={p.quantity ?? ""}
                                      onSave={(v) => saveEdit(p.id, "quantity", Number(v))}
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
                                <td key={col.id} className="p-2 min-h-[2.5rem] align-middle" onClick={() => startEdit(p.id, col.id, p[col.id])}>
                                  {editingCell.rowId === p.id && editingCell.field === col.id ? (
                                    <InlineEditInput
                                      type="number"
                                      step="0.01"
                                      initialValue={p[col.id] ?? ""}
                                      onSave={(v) => saveEdit(p.id, col.id, Number(v))}
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
                                <td key={col.id} className="p-2 min-h-[2.5rem] align-middle" onClick={() => startEdit(p.id, "gstRate", currentGst)}>
                                  {editingCell.rowId === p.id && editingCell.field === "gstRate" ? (
                                    <InlineEditInput
                                      type="number"
                                      step="0.01"
                                      initialValue={currentGst ?? ""}
                                      onSave={(v) => saveEdit(p.id, "gstRate", Number(v))}
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
                              const badgeText = st === "In Stock" ? "In\u00A0Stock" : st;
                              const isLow = st === "Low";
                              const isOut = st === "Unknown" || (parseInt(p.quantity) || 0) === 0;
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle text-center border-r border-white/5 last:border-r-0 whitespace-nowrap">
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
                                        onClick={() => setShowSmartOrderCreator(true)}
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
                            case "location": {
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
                            }
                            case "source":
                              return (
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0 min-w-[100px] max-w-[120px] text-center">
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
                                <td key={col.id} className="px-3 py-3 sm:px-4 sm:py-4 align-middle border-r border-white/5 last:border-r-0">
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
                                  className="p-2 max-w-[180px] break-words whitespace-normal min-h-[2.5rem]"
                                  onClick={() => startEdit(p.id, col.id, p[col.id])}
                                >
                                  {editingCell.rowId === p.id && editingCell.field === col.id ? (
                                    <InlineEditInput
                                      initialValue={p[col.id] ?? ""}
                                      onSave={(v) => saveEdit(p.id, col.id, v)}
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
                        <td colSpan={columns.filter(c => !hiddenCols.has(c.id)).length + 1} className="text-center p-4 text-white/70">
                          {products.length === 0 ? "No products found." : "Loading inventory..."}
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
                      availableColumns={[...COLUMN_DEFAULTS, ...customColumns]}
                      hiddenCols={hiddenCols}
                      onToggle={(id) => {
                        const next = new Set(hiddenCols);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setHiddenCols(next);
                        // Ensure all default columns are in the order
                        const allDefaultIds = COLUMN_DEFAULTS.map(c => c.id);
                        const currentOrder = columns.map(c => c.id);
                        const missingDefaults = allDefaultIds.filter(id => !currentOrder.includes(id));
                        const finalOrder = [...currentOrder, ...missingDefaults];
                        setColumns([...columns, ...COLUMN_DEFAULTS.filter(c => missingDefaults.includes(c.id))]);
                        // Save immediately (order = current cols ids)
                        saveColumnPrefs(userId, finalOrder, Array.from(next));
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

      {/* Smart Shelf View Tab Content */}
      {selectedTab === "shelf" && (
        <SmartShelfView userId={userId} products={products} />
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