import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import SmartStoreDesigner from './SmartStoreDesigner';

/**
 * ViewStore - Clean, intelligent store viewer
 * Features:
 * - Search products and see their exact location
 * - Visual store layout with product indicators
 * - Real-time inventory sync
 * - Clean, focused interface
 */
const ViewStore = ({ userId, products = [], onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [storeLayout, setStoreLayout] = useState(null);
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'

  // Load store layout
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
        const snap = await getDoc(layoutRef);
        if (snap.exists()) {
          setStoreLayout(snap.data());
        }
      } catch (error) {
        console.error('Error loading store layout:', error);
      }
    };
    if (userId) {
      loadLayout();
    }
  }, [userId]);

  // Real-time product sync
  useEffect(() => {
    if (!userId) return;
    const productsRef = collection(db, 'businesses', userId, 'products');
    const unsubscribe = onSnapshot(productsRef, () => {
      // Layout will update automatically through SmartStoreDesigner
    });
    return () => unsubscribe();
  }, [userId]);

  // Find product location
  const findProductLocation = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const queryLower = searchQuery.toLowerCase();
    const foundProduct = products.find(p => 
      p.productName?.toLowerCase().includes(queryLower) ||
      p.sku?.toLowerCase().includes(queryLower) ||
      p.brand?.toLowerCase().includes(queryLower)
    );
    
    if (!foundProduct || !foundProduct.location) return null;
    
    return {
      product: foundProduct,
      location: foundProduct.location,
      fullPath: foundProduct.location.fullPath || 'Location not specified'
    };
  }, [searchQuery, products]);

  // Products with locations
  const productsWithLocations = useMemo(() => {
    return products.filter(p => p.location && p.location.fullPath);
  }, [products]);

  // Products without locations
  const productsWithoutLocations = useMemo(() => {
    return products.filter(p => !p.location || !p.location.fullPath);
  }, [products]);

  // Handle product search and highlight
  const handleProductSelect = (product) => {
    setSelectedProduct(product.id);
    setSearchQuery(product.productName || product.sku || '');
    
    // Scroll to product in layout if it has location
    if (product.location) {
      toast.info(`📍 ${product.productName} is located at: ${product.location.fullPath}`);
    } else {
      toast.warning(`⚠️ ${product.productName} has no location assigned`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[98%] h-[96vh] flex flex-col text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B0F14]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">👁️ View Store</h2>
            <div className="text-sm text-white/60">
              Search products to find their exact location
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl w-8 h-8">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Product Search & Location Info */}
          <div className="w-80 border-r border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
            <h3 className="text-sm font-semibold mb-4">🔍 Find Product Location</h3>
            
            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by product name, SKU, or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>

            {/* Search Results */}
            {findProductLocation && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30">
                <div className="flex items-start gap-2 mb-2">
                  {findProductLocation.product.imageUrl ? (
                    <img 
                      src={findProductLocation.product.imageUrl} 
                      alt={findProductLocation.product.productName}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center text-lg">📦</div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{findProductLocation.product.productName}</div>
                    <div className="text-xs text-white/60">{findProductLocation.product.sku}</div>
                  </div>
                </div>
                <div className="mt-2 p-2 rounded bg-black/40">
                  <div className="text-xs text-emerald-300 font-semibold mb-1">📍 Location:</div>
                  <div className="text-sm text-white">{findProductLocation.fullPath}</div>
                  <div className="mt-2 text-xs text-white/60">
                    Qty: {findProductLocation.product.quantity} {findProductLocation.product.unit}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="mb-4 space-y-2">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xs text-white/60 mb-1">Products with Location</div>
                <div className="text-lg font-semibold text-emerald-400">{productsWithLocations.length}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xs text-white/60 mb-1">Products without Location</div>
                <div className="text-lg font-semibold text-yellow-400">{productsWithoutLocations.length}</div>
              </div>
            </div>

            {/* Products List - Quick Access */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold mb-2 text-white/60">Quick Access</h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {productsWithLocations.slice(0, 20).map(product => (
                  <button
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className={`w-full text-left p-2 rounded text-xs transition-all ${
                      selectedProduct === product.id
                        ? 'bg-emerald-500/20 border border-emerald-400'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <div className="font-medium truncate">{product.productName}</div>
                    <div className="text-[10px] text-white/60 truncate">{product.location.fullPath}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Help */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-400/30">
              <div className="text-xs text-white/60 mb-1">💡 Tip</div>
              <div className="text-xs text-white/80">
                Search for any product to see its exact location in your store
              </div>
            </div>
          </div>

          {/* Main View - Store Layout */}
          <div className="flex-1 relative overflow-hidden bg-gray-900">
            <SmartStoreDesigner
              userId={userId}
              products={products}
              mode="viewer"
              onClose={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewStore;

