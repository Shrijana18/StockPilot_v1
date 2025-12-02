import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';

/**
 * Advanced Virtual Store Viewer with real-time sync
 * Shows products with color-coded stock status and interactive placement
 */
const VirtualStoreViewer = ({ userId, products, onClose }) => {
  const [viewMode, setViewMode] = useState('2d');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [storeLayout, setStoreLayout] = useState(null);
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  useEffect(() => {
    loadStoreLayout();
  }, [userId]);

  useEffect(() => {
    // Real-time product sync
    if (!userId) return;
    const productsRef = collection(db, 'businesses', userId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const updatedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      filterProducts(updatedProducts);
    });
    return () => unsubscribe();
  }, [userId, searchQuery, showLowStockOnly]);

  const loadStoreLayout = async () => {
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

  const filterProducts = (productList = products) => {
    let filtered = productList;

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.fullPath?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (showLowStockOnly) {
      filtered = filtered.filter(p => Number(p.quantity || 0) <= lowStockThreshold);
    }

    setFilteredProducts(filtered);
  };

  useEffect(() => {
    filterProducts();
  }, [searchQuery, showLowStockOnly, products]);

  const getProductsByElement = (elementId) => {
    return filteredProducts.filter(p => {
      const loc = p.location || {};
      return loc.shelf === elementId || 
             loc.rack === elementId || 
             loc.aisle === elementId ||
             loc.floor === elementId;
    });
  };

  const getLocationColor = (elementProducts) => {
    if (!elementProducts || elementProducts.length === 0) return 'bg-gray-500/20 border-gray-400';
    
    const lowStockCount = elementProducts.filter(p => Number(p.quantity || 0) > 0 && Number(p.quantity || 0) <= lowStockThreshold).length;
    const outOfStockCount = elementProducts.filter(p => Number(p.quantity || 0) === 0).length;
    const inStockCount = elementProducts.filter(p => Number(p.quantity || 0) > lowStockThreshold).length;

    if (outOfStockCount > 0) return 'bg-red-500/30 border-red-400';
    if (lowStockCount > 0 && inStockCount === 0) return 'bg-yellow-500/30 border-yellow-400';
    if (lowStockCount > 0) return 'bg-orange-500/30 border-orange-400';
    return 'bg-emerald-500/30 border-emerald-400';
  };

  const getStockStatusColor = (quantity) => {
    const qty = Number(quantity || 0);
    if (qty === 0) return 'bg-red-500 text-white';
    if (qty <= lowStockThreshold) return 'bg-yellow-500 text-white';
    return 'bg-emerald-500 text-white';
  };

  const render2DView = () => {
    if (!storeLayout || !storeLayout.elements || storeLayout.elements.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-white/60">
          <div className="text-center">
            <p className="text-lg mb-2">No store layout found</p>
            <p className="text-sm">Create a layout in the Virtual Store Builder first</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-auto bg-gray-900">
        <div
          ref={canvasRef}
          style={{
            width: `${storeLayout.canvasSize?.width || 1200}px`,
            height: `${storeLayout.canvasSize?.height || 800}px`,
            position: 'relative',
            backgroundImage: storeLayout.backgroundImageUrl ? `url(${storeLayout.backgroundImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'top left',
          }}
        >
          {storeLayout.elements.map((element) => {
            const elementProducts = getProductsByElement(element.id);
            const isSelected = selectedLocation === element.id;
            const totalQty = elementProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
            const lowStockProducts = elementProducts.filter(p => Number(p.quantity || 0) > 0 && Number(p.quantity || 0) <= lowStockThreshold);
            const outOfStockProducts = elementProducts.filter(p => Number(p.quantity || 0) === 0);

            return (
              <div
                key={element.id}
                onClick={() => setSelectedLocation(isSelected ? null : element.id)}
                className={`absolute border-2 cursor-pointer transition-all group ${
                  isSelected ? 'ring-4 ring-emerald-400 z-50' : 'z-10'
                } ${getLocationColor(elementProducts)}`}
                style={{
                  left: `${element.x}px`,
                  top: `${element.y}px`,
                  width: `${element.width}px`,
                  height: `${element.height}px`,
                }}
              >
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-2 bg-black/80 text-xs font-medium flex items-center justify-between">
                  <span className="truncate">{element.label}</span>
                  <div className="flex items-center gap-1">
                    {outOfStockProducts.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500 text-[10px] font-semibold">
                        {outOfStockProducts.length} Out
                      </span>
                    )}
                    {lowStockProducts.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500 text-[10px] font-semibold">
                        {lowStockProducts.length} Low
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[10px] font-semibold">
                      {elementProducts.length} Items
                    </span>
                  </div>
                </div>

                {/* Products Grid */}
                <div className="absolute top-8 left-0 right-0 bottom-0 p-2 overflow-y-auto">
                  {elementProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {elementProducts.map((product) => {
                        const qty = Number(product.quantity || 0);
                        return (
                          <div
                            key={product.id}
                            className="relative p-1.5 rounded bg-black/60 hover:bg-black/80 transition group/item"
                            title={`${product.productName} - ${qty} ${product.unit || ''}`}
                          >
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.productName}
                                className="w-full h-16 object-cover rounded mb-1"
                              />
                            ) : (
                              <div className="w-full h-16 bg-white/10 rounded mb-1 flex items-center justify-center text-2xl">
                                📦
                              </div>
                            )}
                            <div className="text-[10px] font-medium truncate mb-0.5">{product.productName}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-white/60">{product.sku}</span>
                              <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${getStockStatusColor(qty)}`}>
                                {qty}
                              </span>
                            </div>
                            {/* Status Indicator */}
                            <div className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-black ${
                              qty === 0 ? 'bg-red-500' :
                              qty <= lowStockThreshold ? 'bg-yellow-500' :
                              'bg-emerald-500'
                            }`} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-white/40 text-xs py-8">
                      No products assigned
                      <div className="text-[10px] mt-1">Click to see details</div>
                    </div>
                  )}
                </div>

                {/* Hover Info */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80 text-xs opacity-0 group-hover:opacity-100 transition">
                  <div className="flex items-center justify-between">
                    <span>Total Qty: {totalQty}</span>
                    <span>Products: {elementProducts.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const render3DView = () => {
    if (!storeLayout || !storeLayout.elements) {
      return (
        <div className="flex items-center justify-center h-full text-white/60">
          <div className="text-center">
            <p className="text-lg mb-2">No store layout found</p>
            <p className="text-sm">Create a layout in the Virtual Store Builder first</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-auto bg-gray-900 perspective-1000">
        <div className="transform-style-3d p-8">
          {storeLayout.elements.map((element, index) => {
            const elementProducts = getProductsByElement(element.id);
            const depth = index * 30;

            return (
              <div
                key={element.id}
                className="inline-block m-4 transform-gpu"
                style={{
                  transform: `translateZ(${depth}px) rotateY(${index * 8}deg)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                <div
                  className={`border-2 ${getLocationColor(elementProducts)}`}
                  style={{
                    width: `${element.width}px`,
                    height: `${element.height}px`,
                  }}
                >
                  <div className="p-2 text-xs font-medium bg-black/70">
                    {element.label}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1">
                    {elementProducts.length} products
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[98%] h-[95vh] flex flex-col text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B0F14]">
          <h2 className="text-xl font-semibold">👁️ Virtual Store Viewer</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('2d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  viewMode === '2d' ? 'bg-emerald-500 text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                2D View
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  viewMode === '3d' ? 'bg-emerald-500 text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                3D View
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center gap-4 bg-white/5">
          <input
            type="text"
            placeholder="Search products or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Low Stock Only</span>
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60">Threshold:</label>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded bg-white/10 border border-white/20 text-sm"
            />
          </div>
          <div className="text-sm text-white/70">
            {filteredProducts.length} products
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60">Zoom:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-hidden relative">
          {viewMode === '2d' ? render2DView() : render3DView()}
        </div>

        {/* Selected Location Details */}
        {selectedLocation && (() => {
          const element = storeLayout?.elements?.find(el => el.id === selectedLocation);
          const elementProducts = getProductsByElement(selectedLocation);
          if (!element) return null;

          return (
            <div className="border-t border-white/10 p-4 bg-white/5 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">📍 {element.label}</h3>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className="text-white/60 hover:text-white"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded bg-white/5">
                  <div className="text-xs text-white/60">Total Products</div>
                  <div className="text-lg font-semibold">{elementProducts.length}</div>
                </div>
                <div className="p-2 rounded bg-white/5">
                  <div className="text-xs text-white/60">Total Quantity</div>
                  <div className="text-lg font-semibold">
                    {elementProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0)}
                  </div>
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {elementProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.productName}</p>
                      <p className="text-xs text-white/60">{product.sku}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`text-sm font-semibold ${
                        Number(product.quantity || 0) === 0 ? 'text-red-400' :
                        Number(product.quantity || 0) <= lowStockThreshold ? 'text-yellow-400' : 'text-emerald-400'
                      }`}>
                        {product.quantity} {product.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default VirtualStoreViewer;
