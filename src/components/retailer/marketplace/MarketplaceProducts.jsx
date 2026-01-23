/**
 * MarketplaceProducts - Manage products visible on customer marketplace
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBox, FaSync, FaSearch, FaCheck, FaTimes, FaRupeeSign,
  FaToggleOn, FaToggleOff, FaCheckCircle, FaExclamationCircle,
  FaCloudUploadAlt, FaEye, FaEyeSlash, FaFilter
} from 'react-icons/fa';
import { auth } from '../../../firebase/firebaseConfig';
import {
  getRetailerProducts,
  getMarketplaceProducts,
  syncProductToMarketplace,
  bulkSyncProducts,
  removeProductFromMarketplace,
  updateProductAvailability
} from '../../../services/retailerMarketplaceService';

const MarketplaceProducts = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [view, setView] = useState('inventory'); // inventory, marketplace
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const [inventory, marketplace] = await Promise.all([
        getRetailerProducts(userId),
        getMarketplaceProducts(userId)
      ]);

      setInventoryProducts(inventory);
      setMarketplaceProducts(marketplace);
    } catch (error) {
      console.error('Error loading products:', error);
      setMessage({ type: 'error', text: 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  };

  // Get synced product IDs for quick lookup
  const syncedProductIds = new Set(marketplaceProducts.map(p => p.originalProductId || p.id));

  // Filter products
  const filteredProducts = (view === 'inventory' ? inventoryProducts : marketplaceProducts)
    .filter(p => {
      const name = (p.productName || p.name || '').toLowerCase();
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    });

  // Get unique categories
  const categories = [...new Set(inventoryProducts.map(p => p.category).filter(Boolean))];

  // Toggle product selection
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Select all filtered products
  const selectAll = () => {
    const filteredIds = filteredProducts.map(p => p.id);
    const allSelected = filteredIds.every(id => selectedProducts.includes(id));
    
    if (allSelected) {
      setSelectedProducts(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedProducts(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  // Sync selected products
  const handleSyncSelected = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || selectedProducts.length === 0) return;

    setSyncing(true);
    setMessage({ type: '', text: '' });

    try {
      const productsToSync = inventoryProducts.filter(p => selectedProducts.includes(p.id));
      const result = await bulkSyncProducts(userId, productsToSync);

      if (result.success) {
        setMessage({ type: 'success', text: `${result.count} products synced to marketplace!` });
        await loadProducts();
        setSelectedProducts([]);
      } else {
        setMessage({ type: 'error', text: result.error || 'Sync failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSyncing(false);
    }
  };

  // Sync single product
  const handleSyncProduct = async (product) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const result = await syncProductToMarketplace(userId, product);
      if (result.success) {
        setMessage({ type: 'success', text: `${product.productName || product.name} synced!` });
        await loadProducts();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  // Remove product from marketplace
  const handleRemoveProduct = async (productId) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const result = await removeProductFromMarketplace(userId, productId);
      if (result.success) {
        setMessage({ type: 'success', text: 'Product removed from marketplace' });
        await loadProducts();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  // Toggle product availability
  const handleToggleAvailability = async (productId, isAvailable) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      await updateProductAvailability(userId, productId, { isAvailable: !isAvailable });
      setMarketplaceProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, isAvailable: !isAvailable } : p)
      );
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  // Sync all products
  const handleSyncAll = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setSyncing(true);
    try {
      const result = await bulkSyncProducts(userId, inventoryProducts);
      if (result.success) {
        setMessage({ type: 'success', text: `All ${result.count} products synced!` });
        await loadProducts();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">Total Inventory</p>
          <p className="text-2xl font-bold text-white">{inventoryProducts.length}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">On Marketplace</p>
          <p className="text-2xl font-bold text-emerald-400">{marketplaceProducts.length}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">Available</p>
          <p className="text-2xl font-bold text-green-400">
            {marketplaceProducts.filter(p => p.isAvailable).length}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm">Out of Stock</p>
          <p className="text-2xl font-bold text-red-400">
            {marketplaceProducts.filter(p => !p.inStock).length}
          </p>
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-3 rounded-lg flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-red-500/20 text-red-300'
            }`}
          >
            {message.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('inventory')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              view === 'inventory'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaBox className="inline mr-2" />
            Inventory ({inventoryProducts.length})
          </button>
          <button
            onClick={() => setView('marketplace')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              view === 'marketplace'
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <FaEye className="inline mr-2" />
            Marketplace ({marketplaceProducts.length})
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {view === 'inventory' && (
            <>
              <button
                onClick={handleSyncSelected}
                disabled={syncing || selectedProducts.length === 0}
                className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition disabled:opacity-50 flex items-center gap-2"
              >
                <FaCloudUploadAlt />
                Sync Selected ({selectedProducts.length})
              </button>
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? (
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FaSync />
                )}
                Sync All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FaFilter className="text-white/40" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all" className="bg-slate-800">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Select All (for inventory view) */}
      {view === 'inventory' && filteredProducts.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
          >
            <div className={`w-5 h-5 rounded border ${
              filteredProducts.every(p => selectedProducts.includes(p.id))
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-white/30'
            } flex items-center justify-center`}>
              {filteredProducts.every(p => selectedProducts.includes(p.id)) && (
                <FaCheck className="text-white text-xs" />
              )}
            </div>
            Select All ({filteredProducts.length})
          </button>
        </div>
      )}

      {/* Products List */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <FaBox className="text-4xl text-white/20 mx-auto mb-3" />
            <p className="text-white/60">No products found</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isSynced = view === 'inventory' ? syncedProductIds.has(product.id) : true;
            const isSelected = selectedProducts.includes(product.id);

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white/5 rounded-xl p-4 border transition ${
                  isSelected ? 'border-emerald-500' : 'border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Selection Checkbox (inventory view) */}
                  {view === 'inventory' && (
                    <button
                      onClick={() => toggleProductSelection(product.id)}
                      className={`w-6 h-6 rounded border flex-shrink-0 flex items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-white/30 hover:border-emerald-400'
                      }`}
                    >
                      {isSelected && <FaCheck className="text-white text-xs" />}
                    </button>
                  )}

                  {/* Product Image */}
                  <div className="w-16 h-16 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden">
                    {product.imageUrl || product.image ? (
                      <img
                        src={product.imageUrl || product.image}
                        alt={product.productName || product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaBox className="text-white/30 text-xl" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white truncate">
                        {product.productName || product.name}
                      </h4>
                      {isSynced && view === 'inventory' && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full">
                          Synced
                        </span>
                      )}
                      {view === 'marketplace' && !product.isAvailable && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded-full">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/60">
                      <span>{product.category || 'General'}</span>
                      <span>SKU: {product.sku || 'N/A'}</span>
                      <span>Stock: {product.quantity || 0}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-emerald-400 font-semibold">
                        ₹{product.sellingPrice || product.price || 0}
                      </span>
                      {product.mrp && product.mrp > (product.sellingPrice || product.price || 0) && (
                        <span className="text-white/40 line-through text-sm">₹{product.mrp}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {view === 'inventory' ? (
                      <button
                        onClick={() => handleSyncProduct(product)}
                        disabled={isSynced}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          isSynced
                            ? 'bg-white/5 text-white/40 cursor-not-allowed'
                            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        }`}
                      >
                        {isSynced ? (
                          <>
                            <FaCheck className="inline mr-1" /> Synced
                          </>
                        ) : (
                          <>
                            <FaCloudUploadAlt className="inline mr-1" /> Sync
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleAvailability(product.id, product.isAvailable)}
                          className={`p-2 rounded-lg transition ${
                            product.isAvailable
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : 'bg-white/10 text-white/40 hover:bg-white/20'
                          }`}
                          title={product.isAvailable ? 'Hide from customers' : 'Show to customers'}
                        >
                          {product.isAvailable ? <FaEye /> : <FaEyeSlash />}
                        </button>
                        <button
                          onClick={() => handleRemoveProduct(product.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
                          title="Remove from marketplace"
                        >
                          <FaTimes />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MarketplaceProducts;
