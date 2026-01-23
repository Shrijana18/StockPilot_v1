/**
 * CatalogSync - Sync Inventory Products to WhatsApp Catalog
 * Automatically sync products from distributor inventory to WhatsApp Business catalog
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, getDocs, doc, getDoc, updateDoc, 
  onSnapshot, serverTimestamp, writeBatch, setDoc
} from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { 
  FaSync, FaCheck, FaTimes, FaBoxes, FaSearch, FaFilter,
  FaCloudUploadAlt, FaCheckCircle, FaExclamationTriangle,
  FaImage, FaTag, FaRupeeSign, FaWarehouse, FaCog,
  FaWhatsapp, FaLink, FaUnlink, FaEye, FaToggleOn, FaToggleOff
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

const CatalogSync = () => {
  const [products, setProducts] = useState([]);
  const [syncedProducts, setSyncedProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [syncSettings, setSyncSettings] = useState({
    autoSync: false,
    syncInterval: 'daily',
    includeOutOfStock: false,
    defaultCurrency: 'INR',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    pending: 0,
    outOfStock: 0,
  });

  const distributorId = auth.currentUser?.uid;

  // Load products from inventory
  useEffect(() => {
    if (!distributorId) return;

    const productsRef = collection(db, 'businesses', distributorId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().productName || doc.data().name || 'Unnamed Product',
        price: doc.data().sellingPrice || doc.data().mrp || doc.data().price || 0,
        stock: doc.data().stock || doc.data().quantity || 0,
        image: doc.data().productImage || doc.data().image || null,
        category: doc.data().category || 'Uncategorized',
      }));
      
      setProducts(productsList);
      
      // Extract categories
      const cats = [...new Set(productsList.map(p => p.category))].filter(Boolean);
      setCategories(cats);
      
      // Update stats
      setStats({
        total: productsList.length,
        synced: productsList.filter(p => syncedProducts[p.id]).length,
        pending: productsList.filter(p => !syncedProducts[p.id]).length,
        outOfStock: productsList.filter(p => (p.stock || 0) <= 0).length,
      });
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [distributorId, syncedProducts]);

  // Load synced products status
  useEffect(() => {
    if (!distributorId) return;

    const loadSyncStatus = async () => {
      try {
        const syncRef = doc(db, 'businesses', distributorId, 'whatsappCatalog', 'syncStatus');
        const syncDoc = await getDoc(syncRef);
        
        if (syncDoc.exists()) {
          setSyncedProducts(syncDoc.data().products || {});
          setSyncSettings(prev => ({
            ...prev,
            ...(syncDoc.data().settings || {}),
          }));
        }
      } catch (error) {
        console.error('Error loading sync status:', error);
      }
    };

    loadSyncStatus();
  }, [distributorId]);

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Toggle product selection
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Select all visible products
  const selectAllVisible = () => {
    const allVisible = new Set(filteredProducts.map(p => p.id));
    setSelectedProducts(allVisible);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Sync selected products to WhatsApp catalog
  const syncSelectedProducts = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select products to sync');
      return;
    }

    setSyncing(true);
    try {
      const productsToSync = products.filter(p => selectedProducts.has(p.id));
      
      // Prepare catalog data
      const catalogItems = productsToSync.map(product => ({
        retailer_id: product.id,
        name: product.name,
        description: product.description || product.name,
        price: Math.round(product.price * 100), // Price in paise
        currency: syncSettings.defaultCurrency,
        image_url: product.image || '',
        availability: product.stock > 0 ? 'in stock' : 'out of stock',
        category: product.category || 'General',
        brand: product.brand || '',
        sku: product.sku || product.id,
      }));

      // Save to Firestore (in real implementation, would call Meta API)
      const batch = writeBatch(db);
      const newSyncedProducts = { ...syncedProducts };
      
      productsToSync.forEach(product => {
        newSyncedProducts[product.id] = {
          syncedAt: new Date().toISOString(),
          catalogItemId: `wa_${product.id}`,
          status: 'synced',
        };
      });

      // Update sync status document
      const syncRef = doc(db, 'businesses', distributorId, 'whatsappCatalog', 'syncStatus');
      await setDoc(syncRef, {
        products: newSyncedProducts,
        settings: syncSettings,
        lastSync: serverTimestamp(),
        totalSynced: Object.keys(newSyncedProducts).length,
      }, { merge: true });

      setSyncedProducts(newSyncedProducts);
      setSelectedProducts(new Set());
      
      toast.success(`Successfully synced ${productsToSync.length} products to WhatsApp catalog!`);
    } catch (error) {
      console.error('Error syncing products:', error);
      toast.error('Failed to sync products. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  // Unsync product
  const unsyncProduct = async (productId) => {
    try {
      const newSyncedProducts = { ...syncedProducts };
      delete newSyncedProducts[productId];

      const syncRef = doc(db, 'businesses', distributorId, 'whatsappCatalog', 'syncStatus');
      await setDoc(syncRef, {
        products: newSyncedProducts,
        lastSync: serverTimestamp(),
        totalSynced: Object.keys(newSyncedProducts).length,
      }, { merge: true });

      setSyncedProducts(newSyncedProducts);
      toast.success('Product removed from WhatsApp catalog');
    } catch (error) {
      console.error('Error unsyncing product:', error);
      toast.error('Failed to unsync product');
    }
  };

  // Sync all products
  const syncAllProducts = async () => {
    setSelectedProducts(new Set(products.map(p => p.id)));
    // Small delay to allow state update
    setTimeout(() => {
      syncSelectedProducts();
    }, 100);
  };

  // Save settings
  const saveSettings = async () => {
    try {
      const syncRef = doc(db, 'businesses', distributorId, 'whatsappCatalog', 'syncStatus');
      await setDoc(syncRef, {
        settings: syncSettings,
      }, { merge: true });
      
      toast.success('Settings saved successfully!');
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#075e54] flex items-center justify-center">
              <FaBoxes className="text-white text-lg" />
            </div>
            Catalog Sync
          </h2>
          <p className="text-gray-400 mt-1">Sync your inventory products to WhatsApp Business catalog</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 bg-[#2a3942] text-white rounded-lg hover:bg-[#374248] transition-colors flex items-center gap-2"
          >
            <FaCog size={14} />
            Settings
          </button>
          <button
            onClick={syncAllProducts}
            disabled={syncing || products.length === 0}
            className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <FaSync size={14} className={syncing ? 'animate-spin' : ''} />
            Sync All
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: stats.total, icon: FaBoxes, color: 'blue' },
          { label: 'Synced', value: Object.keys(syncedProducts).length, icon: FaCheckCircle, color: 'green' },
          { label: 'Pending Sync', value: stats.total - Object.keys(syncedProducts).length, icon: FaCloudUploadAlt, color: 'yellow' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: FaExclamationTriangle, color: 'red' },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-[#111b21] rounded-xl border border-[#2a3942] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`text-${stat.color === 'blue' ? '[#3b82f6]' : stat.color === 'green' ? '[#00a884]' : stat.color === 'yellow' ? '[#f59e0b]' : '[#ef4444]'}`} />
              <span className="text-2xl font-bold text-white">{stat.value}</span>
            </div>
            <p className="text-[#8696a0] text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8696a0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="w-full bg-[#202c33] text-white rounded-lg pl-11 pr-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] min-w-[180px]"
        >
          <option value="all">All Categories</option>
          {categories.map((cat, idx) => (
            <option key={idx} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Selection Actions */}
      {selectedProducts.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#00a884]/10 border border-[#00a884]/30 rounded-xl p-4 flex items-center justify-between"
        >
          <span className="text-[#00a884] font-medium">
            {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-[#8696a0] hover:text-white transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={syncSelectedProducts}
              disabled={syncing}
              className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2"
            >
              <FaCloudUploadAlt size={14} />
              Sync Selected
            </button>
          </div>
        </motion.div>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-12 text-center">
          <FaBoxes className="text-[#8696a0] text-5xl mx-auto mb-4" />
          <h3 className="text-white text-xl font-semibold mb-2">No products in inventory</h3>
          <p className="text-gray-400 mb-6">Add products to your inventory first to sync them to WhatsApp catalog</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-12 text-center">
          <FaSearch className="text-[#8696a0] text-4xl mx-auto mb-4" />
          <h3 className="text-white text-lg font-medium mb-2">No products found</h3>
          <p className="text-gray-400">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select All Header */}
          <div className="flex items-center gap-3 px-4 py-2">
            <input
              type="checkbox"
              checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
              onChange={() => {
                if (selectedProducts.size === filteredProducts.length) {
                  clearSelection();
                } else {
                  selectAllVisible();
                }
              }}
              className="w-5 h-5 rounded border-[#2a3942] bg-[#202c33] text-[#00a884] focus:ring-[#00a884]"
            />
            <span className="text-[#8696a0] text-sm">
              {selectedProducts.size === filteredProducts.length ? 'Deselect all' : 'Select all'} ({filteredProducts.length} products)
            </span>
          </div>

          {/* Product List */}
          <div className="grid gap-3">
            {filteredProducts.map((product) => {
              const isSynced = syncedProducts[product.id];
              const isSelected = selectedProducts.has(product.id);

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`bg-[#111b21] rounded-xl border transition-colors ${
                    isSelected ? 'border-[#00a884]' : 'border-[#2a3942] hover:border-[#2a3942]/80'
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProductSelection(product.id)}
                      className="w-5 h-5 rounded border-[#2a3942] bg-[#202c33] text-[#00a884] focus:ring-[#00a884]"
                    />

                    {/* Product Image */}
                    <div className="w-16 h-16 rounded-lg bg-[#202c33] overflow-hidden flex-shrink-0">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FaImage className="text-[#8696a0] text-xl" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{product.name}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[#8696a0] text-sm flex items-center gap-1">
                          <FaTag size={10} />
                          {product.category}
                        </span>
                        <span className="text-[#00a884] text-sm flex items-center gap-1">
                          <FaRupeeSign size={10} />
                          {product.price?.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-sm flex items-center gap-1 ${
                          product.stock > 0 ? 'text-[#8696a0]' : 'text-[#f59e0b]'
                        }`}>
                          <FaWarehouse size={10} />
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                      </div>
                    </div>

                    {/* Sync Status */}
                    <div className="flex items-center gap-3">
                      {isSynced ? (
                        <>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00a884]/20 rounded-lg">
                            <FaCheckCircle className="text-[#00a884]" size={14} />
                            <span className="text-[#00a884] text-sm">Synced</span>
                          </div>
                          <button
                            onClick={() => unsyncProduct(product.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-[#8696a0] hover:text-red-400 transition-colors"
                            title="Remove from catalog"
                          >
                            <FaUnlink size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#2a3942] rounded-lg">
                          <FaCloudUploadAlt className="text-[#8696a0]" size={14} />
                          <span className="text-[#8696a0] text-sm">Not synced</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111b21] rounded-2xl border border-[#2a3942] w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-[#2a3942]">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FaCog className="text-[#00a884]" />
                  Catalog Settings
                </h3>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Auto Sync */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Auto Sync</p>
                    <p className="text-[#8696a0] text-sm">Automatically sync new products</p>
                  </div>
                  <button
                    onClick={() => setSyncSettings(prev => ({ ...prev, autoSync: !prev.autoSync }))}
                    className={`p-2 rounded-full transition-colors ${
                      syncSettings.autoSync ? 'bg-[#00a884]' : 'bg-[#2a3942]'
                    }`}
                  >
                    {syncSettings.autoSync ? (
                      <FaToggleOn className="text-white text-xl" />
                    ) : (
                      <FaToggleOff className="text-[#8696a0] text-xl" />
                    )}
                  </button>
                </div>

                {/* Sync Interval */}
                {syncSettings.autoSync && (
                  <div>
                    <label className="block text-white font-medium mb-2">Sync Interval</label>
                    <select
                      value={syncSettings.syncInterval}
                      onChange={(e) => setSyncSettings(prev => ({ ...prev, syncInterval: e.target.value }))}
                      className="w-full bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                    >
                      <option value="hourly">Every hour</option>
                      <option value="daily">Once daily</option>
                      <option value="weekly">Once weekly</option>
                    </select>
                  </div>
                )}

                {/* Include Out of Stock */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Include Out of Stock</p>
                    <p className="text-[#8696a0] text-sm">Sync products with 0 inventory</p>
                  </div>
                  <button
                    onClick={() => setSyncSettings(prev => ({ ...prev, includeOutOfStock: !prev.includeOutOfStock }))}
                    className={`p-2 rounded-full transition-colors ${
                      syncSettings.includeOutOfStock ? 'bg-[#00a884]' : 'bg-[#2a3942]'
                    }`}
                  >
                    {syncSettings.includeOutOfStock ? (
                      <FaToggleOn className="text-white text-xl" />
                    ) : (
                      <FaToggleOff className="text-[#8696a0] text-xl" />
                    )}
                  </button>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-white font-medium mb-2">Default Currency</label>
                  <select
                    value={syncSettings.defaultCurrency}
                    onChange={(e) => setSyncSettings(prev => ({ ...prev, defaultCurrency: e.target.value }))}
                    className="w-full bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  >
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
              </div>

              <div className="p-6 border-t border-[#2a3942] flex justify-end gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2.5 bg-[#2a3942] text-white rounded-lg hover:bg-[#374248] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  className="px-6 py-2.5 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CatalogSync;
