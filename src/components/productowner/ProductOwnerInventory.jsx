import React, { useEffect, useState } from "react";
import { db, auth, storage } from "../../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  FaPlus,
  FaSearch,
  FaBox,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaFilter,
  FaImage,
  FaTimes,
  FaBarcode,
  FaWeight,
  FaRuler,
  FaTag,
  FaWarehouse,
  FaLayerGroup,
  FaTh,
  FaList,
  FaSort,
  FaChevronDown,
  FaChevronUp,
  FaInfoCircle,
} from "react-icons/fa";

const ProductOwnerInventory = () => {
  const [activeTab, setActiveTab] = useState("view");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [uploading, setUploading] = useState(false);
  const [productImages, setProductImages] = useState([]);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: "",
    unit: "units",
    costPrice: "",
    sellingPrice: "",
    mrp: "",
    productionStatus: "inMaking",
    description: "",
    brand: "",
    hsn: "",
    gst: "",
    // Advanced fields
    barcode: "",
    weight: "",
    weightUnit: "kg",
    dimensions: {
      length: "",
      width: "",
      height: "",
      unit: "cm",
    },
    supplier: "",
    supplierCode: "",
    expiryDate: "",
    batchNumber: "",
    location: "",
    minStockLevel: "",
    maxStockLevel: "",
    tags: "",
    color: "",
    size: "",
    material: "",
  });

  useEffect(() => {
    const fetchProducts = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;

      setLoading(true);
      try {
        const productsRef = collection(db, `businesses/${productOwnerId}/products`);
        const unsubscribe = onSnapshot(productsRef, (snapshot) => {
          const productsList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setProducts(productsList);
          setFilteredProducts(productsList);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error("Error fetching products:", err);
        toast.error("Failed to load products");
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name || p.productName || "").toLowerCase().includes(query) ||
          (p.sku || "").toLowerCase().includes(query) ||
          (p.brand || "").toLowerCase().includes(query) ||
          (p.category || "").toLowerCase().includes(query) ||
          (p.barcode || "").toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (p) => (p.productionStatus || p.status || "inMaking") === statusFilter
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => (p.category || "") === categoryFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case "name":
          aVal = (a.name || a.productName || "").toLowerCase();
          bVal = (b.name || b.productName || "").toLowerCase();
          break;
        case "quantity":
          aVal = Number(a.quantity || 0);
          bVal = Number(b.quantity || 0);
          break;
        case "costPrice":
          aVal = Number(a.costPrice || a.cost || 0);
          bVal = Number(b.costPrice || b.cost || 0);
          break;
        case "sellingPrice":
          aVal = Number(a.sellingPrice || a.price || 0);
          bVal = Number(b.sellingPrice || b.price || 0);
          break;
        case "createdAt":
          aVal = a.createdAt?.toDate?.()?.getTime() || 0;
          bVal = b.createdAt?.toDate?.()?.getTime() || 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    setFilteredProducts(filtered);
  }, [searchQuery, statusFilter, categoryFilter, products, sortBy, sortOrder]);

  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) {
      toast.error("User not authenticated");
      setUploading(false);
      return;
    }

    try {
      const uploadedUrls = [];
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.warning(`Image ${file.name} is too large (max 5MB)`);
          continue;
        }

        const imageRef = ref(
          storage,
          `products/${productOwnerId}/${Date.now()}_${file.name}`
        );
        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);
        uploadedUrls.push(url);
      }

      setProductImages([...productImages, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error("Error uploading images:", error);
      toast.error("Failed to upload images");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    setProductImages(productImages.filter((_, i) => i !== index));
  };

  // Helper function to remove undefined values from object (Firestore doesn't accept undefined)
  const removeUndefined = (obj) => {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) {
      toast.error("User not authenticated");
      return;
    }

    if (!newProduct.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      setUploading(true);
      const productData = {
        name: newProduct.name,
        productName: newProduct.name, // For compatibility
        sku: newProduct.sku || `SKU-${Date.now()}`,
        category: newProduct.category,
        quantity: Number(newProduct.quantity) || 0,
        unit: newProduct.unit,
        costPrice: Number(newProduct.costPrice) || 0,
        cost: Number(newProduct.costPrice) || 0, // For compatibility
        sellingPrice: Number(newProduct.sellingPrice) || 0,
        price: Number(newProduct.sellingPrice) || 0, // For compatibility
        mrp: newProduct.mrp ? Number(newProduct.mrp) : undefined,
        productionStatus: newProduct.productionStatus,
        status: newProduct.productionStatus, // For compatibility
        description: newProduct.description,
        brand: newProduct.brand,
        hsn: newProduct.hsn || undefined,
        hsnCode: newProduct.hsn || undefined, // For compatibility
        gst: newProduct.gst ? Number(newProduct.gst) : undefined,
        taxRate: newProduct.gst ? Number(newProduct.gst) : undefined, // For compatibility
        imageUrl: productImages[0] || undefined,
        imageUrls: productImages.length > 0 ? productImages : undefined,
        // Advanced fields
        barcode: newProduct.barcode || undefined,
        weight: newProduct.weight ? Number(newProduct.weight) : undefined,
        weightUnit: newProduct.weightUnit,
        dimensions: (newProduct.dimensions?.length || newProduct.dimensions?.width || newProduct.dimensions?.height)
          ? newProduct.dimensions
          : undefined,
        supplier: newProduct.supplier || undefined,
        supplierCode: newProduct.supplierCode || undefined,
        expiryDate: newProduct.expiryDate || undefined,
        batchNumber: newProduct.batchNumber || undefined,
        location: newProduct.location || undefined,
        minStockLevel: newProduct.minStockLevel
          ? Number(newProduct.minStockLevel)
          : undefined,
        maxStockLevel: newProduct.maxStockLevel
          ? Number(newProduct.maxStockLevel)
          : undefined,
        tags: newProduct.tags
          ? newProduct.tags.split(",").map((t) => t.trim())
          : undefined,
        color: newProduct.color || undefined,
        size: newProduct.size || undefined,
        material: newProduct.material || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Remove undefined values before saving (Firestore doesn't accept undefined)
      const cleanProductData = removeUndefined(productData);

      await addDoc(collection(db, `businesses/${productOwnerId}/products`), cleanProductData);

      toast.success("Product added successfully!");
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error("Error adding product:", err);
      toast.error("Failed to add product. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      setUploading(true);
      const productRef = doc(
        db,
        `businesses/${productOwnerId}/products`,
        editingProduct.id
      );

      const productData = {
        name: newProduct.name,
        productName: newProduct.name,
        sku: newProduct.sku,
        category: newProduct.category,
        quantity: Number(newProduct.quantity) || 0,
        unit: newProduct.unit,
        costPrice: Number(newProduct.costPrice) || 0,
        cost: Number(newProduct.costPrice) || 0,
        sellingPrice: Number(newProduct.sellingPrice) || 0,
        price: Number(newProduct.sellingPrice) || 0,
        mrp: newProduct.mrp ? Number(newProduct.mrp) : undefined,
        productionStatus: newProduct.productionStatus,
        status: newProduct.productionStatus,
        description: newProduct.description,
        brand: newProduct.brand,
        hsn: newProduct.hsn || undefined,
        hsnCode: newProduct.hsn || undefined,
        gst: newProduct.gst ? Number(newProduct.gst) : undefined,
        taxRate: newProduct.gst ? Number(newProduct.gst) : undefined,
        imageUrl: productImages[0] || editingProduct.imageUrl || undefined,
        imageUrls:
          productImages.length > 0
            ? productImages
            : editingProduct.imageUrls || undefined,
        barcode: newProduct.barcode || undefined,
        weight: newProduct.weight ? Number(newProduct.weight) : undefined,
        weightUnit: newProduct.weightUnit,
        dimensions: (newProduct.dimensions?.length || newProduct.dimensions?.width || newProduct.dimensions?.height)
          ? newProduct.dimensions
          : undefined,
        supplier: newProduct.supplier || undefined,
        supplierCode: newProduct.supplierCode || undefined,
        expiryDate: newProduct.expiryDate || undefined,
        batchNumber: newProduct.batchNumber || undefined,
        location: newProduct.location || undefined,
        minStockLevel: newProduct.minStockLevel
          ? Number(newProduct.minStockLevel)
          : undefined,
        maxStockLevel: newProduct.maxStockLevel
          ? Number(newProduct.maxStockLevel)
          : undefined,
        tags: newProduct.tags
          ? newProduct.tags.split(",").map((t) => t.trim())
          : undefined,
        color: newProduct.color || undefined,
        size: newProduct.size || undefined,
        material: newProduct.material || undefined,
        updatedAt: serverTimestamp(),
      };

      // Remove undefined values before saving (Firestore doesn't accept undefined)
      const cleanProductData = removeUndefined(productData);

      await updateDoc(productRef, cleanProductData);

      toast.success("Product updated successfully!");
      setEditingProduct(null);
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error("Error updating product:", err);
      toast.error("Failed to update product. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${productName}"? This action cannot be undone.`
      )
    )
      return;

    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      await deleteDoc(doc(db, `businesses/${productOwnerId}/products`, productId));
      toast.success("Product deleted successfully!");
    } catch (err) {
      console.error("Error deleting product:", err);
      toast.error("Failed to delete product. Please try again.");
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    const existingImages =
      product.imageUrls || (product.imageUrl ? [product.imageUrl] : []);
    setProductImages(existingImages);

    setNewProduct({
      name: product.name || product.productName || "",
      sku: product.sku || "",
      category: product.category || "",
      quantity: product.quantity || "",
      unit: product.unit || "units",
      costPrice: product.costPrice || product.cost || "",
      sellingPrice: product.sellingPrice || product.price || "",
      mrp: product.mrp || "",
      productionStatus: product.productionStatus || product.status || "inMaking",
      description: product.description || "",
      brand: product.brand || "",
      hsn: product.hsn || product.hsnCode || "",
      gst: product.gst || product.taxRate || "",
      barcode: product.barcode || "",
      weight: product.weight || "",
      weightUnit: product.weightUnit || "kg",
      dimensions: product.dimensions || {
        length: "",
        width: "",
        height: "",
        unit: "cm",
      },
      supplier: product.supplier || "",
      supplierCode: product.supplierCode || "",
      expiryDate: product.expiryDate || "",
      batchNumber: product.batchNumber || "",
      location: product.location || "",
      minStockLevel: product.minStockLevel || "",
      maxStockLevel: product.maxStockLevel || "",
      tags: product.tags ? product.tags.join(", ") : "",
      color: product.color || "",
      size: product.size || "",
      material: product.material || "",
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setNewProduct({
      name: "",
      sku: "",
      category: "",
      quantity: "",
      unit: "units",
      costPrice: "",
      sellingPrice: "",
      mrp: "",
      productionStatus: "inMaking",
      description: "",
      brand: "",
      hsn: "",
      gst: "",
      barcode: "",
      weight: "",
      weightUnit: "kg",
      dimensions: { length: "", width: "", height: "", unit: "cm" },
      supplier: "",
      supplierCode: "",
      expiryDate: "",
      batchNumber: "",
      location: "",
      minStockLevel: "",
      maxStockLevel: "",
      tags: "",
      color: "",
      size: "",
      material: "",
    });
    setProductImages([]);
    setShowAdvancedFields(false);
  };

  const updateProductionStatus = async (productId, newStatus) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      const productRef = doc(db, `businesses/${productOwnerId}/products`, productId);
      await updateDoc(productRef, {
        productionStatus: newStatus,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success("Status updated successfully!");
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Failed to update status.");
    }
  };

  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "inMaking":
      case "in_production":
        return "bg-orange-400/20 text-orange-300 border-orange-400/30";
      case "built":
      case "completed":
      case "ready":
        return "bg-emerald-400/20 text-emerald-300 border-emerald-400/30";
      case "dispatched":
      case "shipped":
        return "bg-blue-400/20 text-blue-300 border-blue-400/30";
      default:
        return "bg-gray-400/20 text-gray-300 border-gray-400/30";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "inMaking":
      case "in_production":
        return <FaClock className="text-orange-400" />;
      case "built":
      case "completed":
      case "ready":
        return <FaCheckCircle className="text-emerald-400" />;
      case "dispatched":
      case "shipped":
        return <FaBox className="text-blue-400" />;
      default:
        return <FaExclamationTriangle className="text-gray-400" />;
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    resetForm();
    setShowAddModal(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4 md:p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Product Inventory</h2>
          <p className="text-white/70 text-sm mt-1">
            Manage your product catalog and production status
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center gap-2 transition shadow-lg hover:shadow-emerald-500/50"
        >
          <FaPlus /> Add Product
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { id: "view", label: "View Inventory" },
          { id: "categories", label: "Categories" },
          { id: "lowstock", label: "Low Stock Alerts" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 transition relative ${
              activeTab === tab.id
                ? "text-emerald-300 font-semibold"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
              />
            )}
          </button>
        ))}
      </div>

      {/* Filters and View Controls */}
      {activeTab === "view" && (
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
              <input
                type="text"
                placeholder="Search products by name, SKU, brand, category, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              <option value="all">All Status</option>
              <option value="inMaking">In Making</option>
              <option value="built">Built</option>
              <option value="dispatched">Dispatched</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <FaSort className="text-white/50" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              >
                <option value="name">Sort by Name</option>
                <option value="quantity">Sort by Quantity</option>
                <option value="costPrice">Sort by Cost</option>
                <option value="sellingPrice">Sort by Price</option>
                <option value="createdAt">Sort by Date</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition"
              >
                {sortOrder === "asc" ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition ${
                viewMode === "grid"
                  ? "bg-emerald-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              <FaTh />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition ${
                viewMode === "list"
                  ? "bg-emerald-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              <FaList />
            </button>
          </div>
        </div>
      )}

      {/* View Inventory Tab */}
      {activeTab === "view" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {loading ? (
            <div className="text-center py-12 text-white/50">
              <FaBox className="inline-block text-4xl mb-4 animate-pulse" />
              <p>Loading products...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => {
                  const status =
                    product.productionStatus || product.status || "inMaking";
                  const productName = product.name || product.productName || "Unnamed Product";
                  const imageUrl =
                    product.imageUrl ||
                    product.imageUrls?.[0] ||
                    null;
                  const isLowStock = product.minStockLevel
                    ? (product.quantity || 0) < product.minStockLevel
                    : false;

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-4 hover:bg-white/10 hover:border-emerald-400/30 transition-all shadow-lg hover:shadow-xl"
                    >
                      {/* Product Image */}
                      <div className="relative mb-3 aspect-square rounded-lg overflow-hidden bg-white/5">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FaImage className="text-4xl text-white/20" />
                          </div>
                        )}
                        {isLowStock && (
                          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <FaExclamationTriangle /> Low Stock
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          {getStatusIcon(status)}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="space-y-2">
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {productName}
                          </h3>
                          {product.brand && (
                            <p className="text-sm text-white/70">{product.brand}</p>
                          )}
                          {product.sku && (
                            <p className="text-xs text-white/50 mt-1">
                              SKU: {product.sku}
                            </p>
                          )}
                          {product.barcode && (
                            <p className="text-xs text-white/50 flex items-center gap-1">
                              <FaBarcode /> {product.barcode}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/50">Category:</span>
                            <span>{product.category || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Stock:</span>
                            <span className={isLowStock ? "text-red-400 font-semibold" : ""}>
                              {product.quantity || 0} {product.unit || "units"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Cost:</span>
                            <span>₹{product.costPrice || product.cost || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Price:</span>
                            <span className="font-semibold text-emerald-300">
                              ₹{product.sellingPrice || product.price || 0}
                            </span>
                          </div>
                          {product.mrp && product.mrp !== product.sellingPrice && (
                            <div className="flex justify-between">
                              <span className="text-white/50">MRP:</span>
                              <span className="line-through text-white/50">
                                ₹{product.mrp}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mb-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                        </div>

                        <div className="flex gap-2 mb-3">
                          <select
                            value={status}
                            onChange={(e) =>
                              updateProductionStatus(product.id, e.target.value)
                            }
                            className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                          >
                            <option value="inMaking">In Making</option>
                            <option value="built">Built</option>
                            <option value="dispatched">Dispatched</option>
                          </select>
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-white/10">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm transition flex items-center justify-center gap-1"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteProduct(product.id, productName)
                            }
                            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 text-sm transition"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const status =
                    product.productionStatus || product.status || "inMaking";
                  const productName = product.name || product.productName || "Unnamed Product";
                  const imageUrl =
                    product.imageUrl || product.imageUrls?.[0] || null;

                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex gap-4">
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FaImage className="text-2xl text-white/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                          <div>
                            <h3 className="font-semibold">{productName}</h3>
                            <p className="text-sm text-white/70">
                              {product.brand || "No brand"}
                            </p>
                            {product.sku && (
                              <p className="text-xs text-white/50">SKU: {product.sku}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-sm text-white/50">Category</span>
                            <p>{product.category || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-sm text-white/50">Stock</span>
                            <p>
                              {product.quantity || 0} {product.unit || "units"}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-white/50">Cost/Price</span>
                            <p>
                              ₹{product.costPrice || product.cost || 0} / ₹
                              {product.sellingPrice || product.price || 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-white/50">Status</span>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(status)}
                              <span className="text-xs">{status}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded text-blue-300 text-sm transition"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteProduct(product.id, productName)
                              }
                              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded text-red-300 text-sm transition"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-12 text-white/50">
              <FaBox className="inline-block text-5xl mb-4 text-white/20" />
              <p className="text-lg mb-2">No products found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first product to get started"}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Categories Tab */}
      {activeTab === "categories" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((category) => {
                const categoryProducts = products.filter(
                  (p) => p.category === category
                );
                const totalValue = categoryProducts.reduce(
                  (sum, p) =>
                    sum +
                    (p.quantity || 0) * (p.costPrice || p.cost || 0),
                  0
                );
                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl p-4 hover:bg-white/10 transition cursor-pointer"
                    onClick={() => {
                      setCategoryFilter(category);
                      setActiveTab("view");
                    }}
                  >
                    <FaLayerGroup className="text-2xl mb-2 text-emerald-400" />
                    <h3 className="font-semibold mb-1">{category}</h3>
                    <p className="text-sm text-white/70">
                      {categoryProducts.length} product{categoryProducts.length !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      ₹{totalValue.toLocaleString()}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No categories found. Add products to create categories.
            </div>
          )}
        </motion.div>
      )}

      {/* Low Stock Alerts Tab */}
      {activeTab === "lowstock" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {products.filter((p) => {
            if (p.minStockLevel) {
              return (p.quantity || 0) < p.minStockLevel;
            }
            return (p.quantity || 0) < 10;
          }).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products
                .filter((p) => {
                  if (p.minStockLevel) {
                    return (p.quantity || 0) < p.minStockLevel;
                  }
                  return (p.quantity || 0) < 10;
                })
                .map((product) => {
                  const productName = product.name || product.productName || "Unnamed Product";
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-xl border border-orange-400/30 bg-gradient-to-br from-orange-400/10 to-orange-400/5 backdrop-blur-xl p-4 hover:border-orange-400/50 transition"
                    >
                      <div className="flex items-start gap-3">
                        <FaExclamationTriangle className="text-orange-400 text-xl flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{productName}</h3>
                          <p className="text-sm text-white/70 mb-2">
                            Current stock: {product.quantity || 0}{" "}
                            {product.unit || "units"}
                          </p>
                          {product.minStockLevel && (
                            <p className="text-xs text-orange-300">
                              Minimum required: {product.minStockLevel}{" "}
                              {product.unit || "units"}
                            </p>
                          )}
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="mt-3 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 rounded text-orange-300 text-sm transition"
                          >
                            Update Stock
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              <FaCheckCircle className="inline-block text-4xl mb-4 text-emerald-400/50" />
              <p className="text-lg">No low stock alerts</p>
              <p className="text-sm">All products are well stocked!</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              if (!uploading) {
                setShowAddModal(false);
                setEditingProduct(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl border border-white/10 p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <h3 className="text-2xl font-bold">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>
                <button
                  onClick={() => {
                    if (!uploading) {
                      setShowAddModal(false);
                      setEditingProduct(null);
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                  disabled={uploading}
                >
                  <FaTimes />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto pr-2">
                <form
                  onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}
                  className="space-y-6"
                >
                  {/* Basic Information Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                      <FaInfoCircle /> Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm text-white/70 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newProduct.name}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, name: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          placeholder="Enter product name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">SKU</label>
                        <input
                          type="text"
                          value={newProduct.sku}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, sku: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          placeholder="Auto-generated if empty"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Barcode
                        </label>
                        <input
                          type="text"
                          value={newProduct.barcode}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, barcode: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          placeholder="EAN, UPC, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Brand</label>
                        <input
                          type="text"
                          value={newProduct.brand}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, brand: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Category
                        </label>
                        <input
                          type="text"
                          value={newProduct.category}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              category: e.target.value,
                            })
                          }
                          list="categories-list"
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                        <datalist id="categories-list">
                          {categories.map((cat) => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Production Status
                        </label>
                        <select
                          value={newProduct.productionStatus}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              productionStatus: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        >
                          <option value="inMaking">In Making</option>
                          <option value="built">Built</option>
                          <option value="dispatched">Dispatched</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm text-white/70 mb-1">
                          Description
                        </label>
                        <textarea
                          value={newProduct.description}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              description: e.target.value,
                            })
                          }
                          rows={3}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 resize-none"
                          placeholder="Product description, features, etc."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Images Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                      <FaImage /> Product Images (Max 5)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {productImages.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Product ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border border-white/20"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 p-1 bg-red-500/80 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition"
                          >
                            <FaTimes className="text-white text-xs" />
                          </button>
                        </div>
                      ))}
                      {productImages.length < 5 && (
                        <label className="aspect-square border-2 border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400/50 transition bg-white/5 hover:bg-white/10">
                          <FaImage className="text-2xl mb-2 text-white/50" />
                          <span className="text-xs text-white/70 text-center px-2">
                            Add Image
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) =>
                              handleImageUpload(Array.from(e.target.files))
                            }
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      )}
                    </div>
                    {uploading && (
                      <p className="text-sm text-white/50">Uploading images...</p>
                    )}
                  </div>

                  {/* Stock & Pricing Section */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                      <FaWarehouse /> Stock & Pricing
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={newProduct.quantity}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              quantity: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">Unit</label>
                        <select
                          value={newProduct.unit}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, unit: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        >
                          <option value="units">Units</option>
                          <option value="kg">Kg</option>
                          <option value="g">Grams</option>
                          <option value="liters">Liters</option>
                          <option value="ml">ML</option>
                          <option value="pieces">Pieces</option>
                          <option value="boxes">Boxes</option>
                          <option value="packs">Packs</option>
                          <option value="pairs">Pairs</option>
                          <option value="dozen">Dozen</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={newProduct.location}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              location: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          placeholder="Warehouse, Shelf, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Cost Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.costPrice}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              costPrice: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Selling Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.sellingPrice}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              sellingPrice: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          MRP (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.mrp}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, mrp: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Min Stock Level
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newProduct.minStockLevel}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              minStockLevel: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          Max Stock Level
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={newProduct.maxStockLevel}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              maxStockLevel: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tax Information */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-emerald-400">Tax Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          HSN Code
                        </label>
                        <input
                          type="text"
                          value={newProduct.hsn}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, hsn: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                          placeholder="Harmonized System Nomenclature"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-white/70 mb-1">
                          GST Rate (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={newProduct.gst}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, gst: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Advanced Fields Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                      className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition"
                    >
                      {showAdvancedFields ? <FaChevronUp /> : <FaChevronDown />}
                      Advanced Fields (Dimensions, Weight, Supplier, etc.)
                    </button>

                    <AnimatePresence>
                      {showAdvancedFields && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden space-y-4 mt-4"
                        >
                          {/* Dimensions */}
                          <div className="space-y-2">
                            <label className="block text-sm text-white/70 flex items-center gap-2">
                              <FaRuler /> Dimensions
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newProduct.dimensions.length}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    dimensions: {
                                      ...newProduct.dimensions,
                                      length: e.target.value,
                                    },
                                  })
                                }
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                placeholder="Length"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newProduct.dimensions.width}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    dimensions: {
                                      ...newProduct.dimensions,
                                      width: e.target.value,
                                    },
                                  })
                                }
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                placeholder="Width"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newProduct.dimensions.height}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    dimensions: {
                                      ...newProduct.dimensions,
                                      height: e.target.value,
                                    },
                                  })
                                }
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                placeholder="Height"
                              />
                              <select
                                value={newProduct.dimensions.unit}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    dimensions: {
                                      ...newProduct.dimensions,
                                      unit: e.target.value,
                                    },
                                  })
                                }
                                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              >
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                                <option value="inch">inch</option>
                                <option value="ft">ft</option>
                              </select>
                            </div>
                          </div>

                          {/* Weight */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1 flex items-center gap-2">
                                <FaWeight /> Weight
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newProduct.weight}
                                  onChange={(e) =>
                                    setNewProduct({
                                      ...newProduct,
                                      weight: e.target.value,
                                    })
                                  }
                                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                />
                                <select
                                  value={newProduct.weightUnit}
                                  onChange={(e) =>
                                    setNewProduct({
                                      ...newProduct,
                                      weightUnit: e.target.value,
                                    })
                                  }
                                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                >
                                  <option value="kg">kg</option>
                                  <option value="g">g</option>
                                  <option value="lb">lb</option>
                                  <option value="oz">oz</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">
                                Color
                              </label>
                              <input
                                type="text"
                                value={newProduct.color}
                                onChange={(e) =>
                                  setNewProduct({ ...newProduct, color: e.target.value })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          {/* Size and Material */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1">Size</label>
                              <input
                                type="text"
                                value={newProduct.size}
                                onChange={(e) =>
                                  setNewProduct({ ...newProduct, size: e.target.value })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                placeholder="S, M, L, XL, etc."
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">
                                Material
                              </label>
                              <input
                                type="text"
                                value={newProduct.material}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    material: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          {/* Supplier Information */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1">
                                Supplier
                              </label>
                              <input
                                type="text"
                                value={newProduct.supplier}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    supplier: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">
                                Supplier Code
                              </label>
                              <input
                                type="text"
                                value={newProduct.supplierCode}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    supplierCode: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          {/* Batch & Expiry */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-white/70 mb-1">
                                Batch Number
                              </label>
                              <input
                                type="text"
                                value={newProduct.batchNumber}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    batchNumber: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-white/70 mb-1">
                                Expiry Date
                              </label>
                              <input
                                type="date"
                                value={newProduct.expiryDate}
                                onChange={(e) =>
                                  setNewProduct({
                                    ...newProduct,
                                    expiryDate: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          {/* Tags */}
                          <div>
                            <label className="block text-sm text-white/70 mb-1 flex items-center gap-2">
                              <FaTag /> Tags (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={newProduct.tags}
                              onChange={(e) =>
                                setNewProduct({ ...newProduct, tags: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              placeholder="tag1, tag2, tag3"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        if (!uploading) {
                          setShowAddModal(false);
                          setEditingProduct(null);
                          resetForm();
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                      disabled={uploading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={uploading}
                    >
                      {uploading
                        ? "Saving..."
                        : editingProduct
                        ? "Update Product"
                        : "Add Product"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProductOwnerInventory;
