import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
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

  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: "",
    unit: "units",
    costPrice: "",
    sellingPrice: "",
    productionStatus: "inMaking",
    description: "",
    brand: "",
    hsn: "",
    gst: "",
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
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = products;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (p) => (p.productionStatus || p.status) === statusFilter
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    setFilteredProducts(filtered);
  }, [searchQuery, statusFilter, categoryFilter, products]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      const productData = {
        ...newProduct,
        quantity: Number(newProduct.quantity),
        costPrice: Number(newProduct.costPrice),
        sellingPrice: Number(newProduct.sellingPrice),
        gst: Number(newProduct.gst) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, `businesses/${productOwnerId}/products`), productData);

      alert("Product added successfully!");
      setShowAddModal(false);
      setNewProduct({
        name: "",
        sku: "",
        category: "",
        quantity: "",
        unit: "units",
        costPrice: "",
        sellingPrice: "",
        productionStatus: "inMaking",
        description: "",
        brand: "",
        hsn: "",
        gst: "",
      });
    } catch (err) {
      console.error("Error adding product:", err);
      alert("Failed to add product. Please try again.");
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      const productRef = doc(db, `businesses/${productOwnerId}/products`, editingProduct.id);
      await updateDoc(productRef, {
        ...newProduct,
        quantity: Number(newProduct.quantity),
        costPrice: Number(newProduct.costPrice),
        sellingPrice: Number(newProduct.sellingPrice),
        gst: Number(newProduct.gst) || 0,
        updatedAt: new Date().toISOString(),
      });

      alert("Product updated successfully!");
      setEditingProduct(null);
      setShowAddModal(false);
      setNewProduct({
        name: "",
        sku: "",
        category: "",
        quantity: "",
        unit: "units",
        costPrice: "",
        sellingPrice: "",
        productionStatus: "inMaking",
        description: "",
        brand: "",
        hsn: "",
        gst: "",
      });
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Failed to update product. Please try again.");
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      await deleteDoc(doc(db, `businesses/${productOwnerId}/products`, productId));
      alert("Product deleted successfully!");
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to delete product. Please try again.");
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name || "",
      sku: product.sku || "",
      category: product.category || "",
      quantity: product.quantity || "",
      unit: product.unit || "units",
      costPrice: product.costPrice || product.cost || "",
      sellingPrice: product.sellingPrice || product.price || "",
      productionStatus: product.productionStatus || product.status || "inMaking",
      description: product.description || "",
      brand: product.brand || "",
      hsn: product.hsn || "",
      gst: product.gst || "",
    });
    setShowAddModal(true);
  };

  const updateProductionStatus = async (productId, newStatus) => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    try {
      const productRef = doc(db, `businesses/${productOwnerId}/products`, productId);
      await updateDoc(productRef, {
        productionStatus: newStatus,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status.");
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-white p-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Product Inventory</h2>
          <p className="text-white/70 text-sm mt-1">
            Manage your product catalog and production status
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setNewProduct({
              name: "",
              sku: "",
              category: "",
              quantity: "",
              unit: "units",
              costPrice: "",
              sellingPrice: "",
              productionStatus: "inMaking",
              description: "",
              brand: "",
              hsn: "",
              gst: "",
            });
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg flex items-center gap-2 transition"
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
            className={`px-4 py-2 transition ${
              activeTab === tab.id
                ? "border-b-2 border-emerald-400 text-emerald-300"
                : "text-white/70 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab === "view" && (
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
            <input
              type="text"
              placeholder="Search products..."
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
            <div className="text-center py-12 text-white/50">Loading products...</div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const status = product.productionStatus || product.status || "inMaking";
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{product.name || "Unnamed Product"}</h3>
                        <p className="text-sm text-white/70">{product.brand || "No brand"}</p>
                        {product.sku && (
                          <p className="text-xs text-white/50 mt-1">SKU: {product.sku}</p>
                        )}
                      </div>
                      <div className="ml-2">{getStatusIcon(status)}</div>
                    </div>

                    <div className="space-y-2 text-sm text-white/70 mb-4">
                      <div className="flex justify-between">
                        <span className="text-white/50">Category:</span>
                        <span>{product.category || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Quantity:</span>
                        <span>
                          {product.quantity || 0} {product.unit || "units"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Cost Price:</span>
                        <span>₹{product.costPrice || product.cost || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/50">Selling Price:</span>
                        <span>₹{product.sellingPrice || product.price || 0}</span>
                      </div>
                    </div>

                    <div className="mb-4">
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
                        onChange={(e) => updateProductionStatus(product.id, e.target.value)}
                        className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs focus:outline-none"
                      >
                        <option value="inMaking">In Making</option>
                        <option value="built">Built</option>
                        <option value="dispatched">Dispatched</option>
                      </select>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-white/10">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm transition"
                      >
                        <FaEdit className="inline mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 text-sm transition"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No products found. Add your first product to get started.
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((category) => {
              const categoryProducts = products.filter((p) => p.category === category);
              return (
                <motion.div
                  key={category}
                  className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4"
                >
                  <h3 className="font-semibold mb-2">{category}</h3>
                  <p className="text-sm text-white/70">{categoryProducts.length} products</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Low Stock Alerts Tab */}
      {activeTab === "lowstock" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {products.filter((p) => (p.quantity || 0) < 10).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products
                .filter((p) => (p.quantity || 0) < 10)
                .map((product) => (
                  <motion.div
                    key={product.id}
                    className="rounded-xl border border-orange-400/30 bg-orange-400/10 backdrop-blur-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FaExclamationTriangle className="text-orange-400" />
                      <h3 className="font-semibold">{product.name}</h3>
                    </div>
                    <p className="text-sm text-white/70">
                      Current stock: {product.quantity || 0} {product.unit || "units"}
                    </p>
                  </motion.div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/50">
              No low stock alerts. All products are well stocked!
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowAddModal(false);
              setEditingProduct(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold mb-4">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <form
                onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-sm text-white/70 mb-1">Category</label>
                    <input
                      type="text"
                      value={newProduct.category}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, category: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newProduct.quantity}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, quantity: e.target.value })
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
                      <option value="liters">Liters</option>
                      <option value="pieces">Pieces</option>
                      <option value="boxes">Boxes</option>
                      <option value="packs">Packs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Production Status</label>
                    <select
                      value={newProduct.productionStatus}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, productionStatus: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    >
                      <option value="inMaking">In Making</option>
                      <option value="built">Built</option>
                      <option value="dispatched">Dispatched</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Cost Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.costPrice}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, costPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">Selling Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProduct.sellingPrice}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, sellingPrice: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={newProduct.hsn}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, hsn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1">GST %</label>
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

                <div>
                  <label className="block text-sm text-white/70 mb-1">Description</label>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingProduct(null);
                    }}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition"
                  >
                    {editingProduct ? "Update" : "Add"} Product
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProductOwnerInventory;

