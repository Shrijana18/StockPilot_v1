import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

/**
 * World's First Smartest Inventory Designer
 * Advanced Virtual Store Builder with drag-drop product placement,
 * real-time sync, grid snapping, and intelligent features
 */
const VirtualStoreBuilder = ({ userId, products, onClose }) => {
  const [mode, setMode] = useState('builder');
  const [elements, setElements] = useState([]);
  const [storeImageUrl, setStoreImageUrl] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 1200 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedElement, setSelectedElement] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [showProductPalette, setShowProductPalette] = useState(false);
  const [searchProducts, setSearchProducts] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  // Load store layout
  useEffect(() => {
    loadStoreLayout();
  }, [userId]);

  // Real-time product sync
  useEffect(() => {
    if (!userId) return;
    const productsRef = collection(db, 'businesses', userId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      // Update elements with latest product data
      setElements(prev => prev.map(el => {
        const updatedProducts = el.products?.map(p => {
          const productDoc = snapshot.docs.find(d => d.id === p.id);
          return productDoc ? { ...p, ...productDoc.data() } : p;
        }) || [];
        return { ...el, products: updatedProducts };
      }));
    });
    return () => unsubscribe();
  }, [userId]);

  const loadStoreLayout = async () => {
    try {
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      const snap = await getDoc(layoutRef);
      if (snap.exists()) {
        const data = snap.data();
        setElements(data.elements || []);
        setStoreImageUrl(data.backgroundImageUrl || null);
        setCanvasSize(data.canvasSize || { width: 1600, height: 1200 });
        saveToHistory();
      }
    } catch (error) {
      console.error('Error loading store layout:', error);
    }
  };

  const saveToHistory = () => {
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(JSON.stringify(elements));
    historyIndexRef.current = historyRef.current.length - 1;
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  };

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setElements(JSON.parse(historyRef.current[historyIndexRef.current]));
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setElements(JSON.parse(historyRef.current[historyIndexRef.current]));
    }
  };

  const saveStoreLayout = async () => {
    try {
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      await setDoc(layoutRef, {
        elements,
        backgroundImageUrl: storeImageUrl,
        canvasSize,
        updatedAt: Date.now(),
      }, { merge: true });
      toast.success('Store layout saved!');
    } catch (error) {
      console.error('Error saving store layout:', error);
      toast.error('Failed to save layout');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `storeLayouts/${userId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setStoreImageUrl(url);
      toast.success('Store image uploaded!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const snapToGridValue = (value) => {
    return snapToGrid ? Math.round(value / gridSize) * gridSize : value;
  };

  const addElement = (type, template = null) => {
    const defaultSizes = {
      rack: { width: 200, height: 100 },
      shelf: { width: 150, height: 50 },
      aisle: { width: 300, height: 400 },
      floor: { width: 500, height: 500 },
      wall: { width: 50, height: 200 },
    };

    const size = template || defaultSizes[type] || { width: 200, height: 100 };
    
    const newElement = {
      id: `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      x: snapToGridValue(100),
      y: snapToGridValue(100),
      width: size.width,
      height: size.height,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${elements.filter(e => e.type === type).length + 1}`,
      products: [],
      rotation: 0,
      color: getElementColor(type),
      zIndex: elements.length,
    };
    
    setElements([...elements, newElement]);
    saveToHistory();
    setSelectedElement(newElement.id);
  };

  const getElementColor = (type) => {
    const colors = {
      rack: '#3b82f6',
      shelf: '#10b981',
      aisle: '#a855f7',
      floor: '#eab308',
      wall: '#6b7280',
    };
    return colors[type] || '#ffffff';
  };

  const handleMouseDown = (e, element, isResizeHandle = false) => {
    if (mode !== 'builder') return;
    e.stopPropagation();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x;
    const y = (e.clientY - rect.top) / zoom - pan.y;
    
    setSelectedElement(element.id);
    setIsDragging(!isResizeHandle);
    setIsResizing(isResizeHandle);
    setDragOffset({
      x: x - (isResizeHandle ? element.x + element.width : element.x),
      y: y - (isResizeHandle ? element.y + element.height : element.y),
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!selectedElement) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x;
    const y = (e.clientY - rect.top) / zoom - pan.y;

    setElements(prev => prev.map(el => {
      if (el.id !== selectedElement) return el;
      
      if (isResizing) {
        const newWidth = Math.max(50, snapToGridValue(x - el.x + dragOffset.x));
        const newHeight = Math.max(30, snapToGridValue(y - el.y + dragOffset.y));
        return { ...el, width: newWidth, height: newHeight };
      } else if (isDragging) {
        const newX = Math.max(0, Math.min(snapToGridValue(x - dragOffset.x), canvasSize.width - el.width));
        const newY = Math.max(0, Math.min(snapToGridValue(y - dragOffset.y), canvasSize.height - el.height));
        return { ...el, x: newX, y: newY };
      }
      return el;
    }));
  }, [selectedElement, isDragging, isResizing, dragOffset, zoom, pan, canvasSize, snapToGrid, gridSize]);

  const handleMouseUp = () => {
    if (isDragging || isResizing) {
      saveToHistory();
    }
    setIsDragging(false);
    setIsResizing(false);
  };

  // Drop product onto element
  const handleDropProduct = async (e, elementId) => {
    e.preventDefault();
    if (!draggedProduct) return;

    const product = products.find(p => p.id === draggedProduct);
    if (!product) return;

    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    // Check if product already assigned
    if (element.products?.find(p => p.id === product.id)) {
      toast.info('Product already assigned to this location');
      return;
    }

    // Add product to element
    const updatedElements = elements.map(el => {
      if (el.id === elementId) {
        const newProducts = [...(el.products || []), {
          id: product.id,
          name: product.productName,
          sku: product.sku,
          quantity: product.quantity,
          imageUrl: product.imageUrl,
          unit: product.unit,
        }];
        return { ...el, products: newProducts };
      }
      return el;
    });
    setElements(updatedElements);

    // Auto-sync: Update product location in Firestore
    try {
      const productRef = doc(db, 'businesses', userId, 'products', product.id);
      const location = {
        floor: element.type === 'floor' ? element.id : null,
        aisle: element.type === 'aisle' ? element.id : null,
        rack: element.type === 'rack' ? element.id : null,
        shelf: element.type === 'shelf' ? element.id : null,
        fullPath: element.label,
      };
      await updateDoc(productRef, { location });
      toast.success(`Product placed on ${element.label}!`);
    } catch (error) {
      console.error('Error syncing location:', error);
      toast.error('Failed to sync location');
    }

    setDraggedProduct(null);
    saveToHistory();
  };

  const removeProductFromElement = async (elementId, productId) => {
    const updatedElements = elements.map(el => {
      if (el.id === elementId) {
        return { ...el, products: el.products?.filter(p => p.id !== productId) || [] };
      }
      return el;
    });
    setElements(updatedElements);

    // Remove location from product
    try {
      const productRef = doc(db, 'businesses', userId, 'products', productId);
      await updateDoc(productRef, { location: null });
    } catch (error) {
      console.error('Error removing location:', error);
    }

    saveToHistory();
  };

  const deleteElement = (elementId) => {
    const element = elements.find(el => el.id === elementId);
    if (element?.products?.length > 0) {
      // Remove location from all products in this element
      element.products.forEach(async (p) => {
        try {
          const productRef = doc(db, 'businesses', userId, 'products', p.id);
          await updateDoc(productRef, { location: null });
        } catch (error) {
          console.error('Error removing location:', error);
        }
      });
    }
    setElements(elements.filter(el => el.id !== elementId));
    setSelectedElement(null);
    saveToHistory();
  };

  const getStockStatusColor = (quantity) => {
    const qty = Number(quantity || 0);
    if (qty === 0) return 'bg-red-500';
    if (qty <= lowStockThreshold) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const filteredProductsForPalette = products.filter(p => {
    if (!searchProducts) return true;
    const query = searchProducts.toLowerCase();
    return p.productName?.toLowerCase().includes(query) ||
           p.sku?.toLowerCase().includes(query) ||
           p.brand?.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[98%] h-[95vh] flex flex-col text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B0F14]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">🏪 Smart Inventory Designer</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={historyIndexRef.current <= 0}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndexRef.current >= historyRef.current.length - 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                title="Redo (Ctrl+Y)"
              >
                ↷ Redo
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProductPalette(!showProductPalette)}
              className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-sm font-medium"
            >
              📦 Products ({products.length})
            </button>
            <button
              onClick={saveStoreLayout}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium"
            >
              💾 Save Layout
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Tools */}
          <div className="w-72 border-r border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
            <div className="space-y-4">
              {/* Grid Controls */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold mb-2">Grid & Snap</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs">Show Grid</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs">Snap to Grid</span>
                  </label>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Grid Size: {gridSize}px</label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="5"
                      value={gridSize}
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Add Elements */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold mb-2">Add Elements</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addElement('rack')}
                    className="px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-xs"
                  >
                    📦 Rack
                  </button>
                  <button
                    onClick={() => addElement('shelf')}
                    className="px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 text-xs"
                  >
                    🗄️ Shelf
                  </button>
                  <button
                    onClick={() => addElement('aisle')}
                    className="px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-xs"
                  >
                    🛤️ Aisle
                  </button>
                  <button
                    onClick={() => addElement('wall')}
                    className="px-3 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 border border-gray-400/30 text-xs"
                  >
                    🧱 Wall
                  </button>
                </div>
              </div>

              {/* Canvas Settings */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold mb-2">Canvas</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Zoom: {Math.round(zoom * 100)}%</label>
                    <input
                      type="range"
                      min="0.25"
                      max="2"
                      step="0.05"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Width: {canvasSize.width}px</label>
                    <input
                      type="number"
                      value={canvasSize.width}
                      onChange={(e) => setCanvasSize({ ...canvasSize, width: Number(e.target.value) })}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Height: {canvasSize.height}px</label>
                    <input
                      type="number"
                      value={canvasSize.height}
                      onChange={(e) => setCanvasSize({ ...canvasSize, height: Number(e.target.value) })}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Upload Image */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold mb-2">Store Image</h3>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20"
                />
              </div>

              {/* Selected Element Properties */}
              {selectedElement && (() => {
                const element = elements.find(el => el.id === selectedElement);
                if (!element) return null;
                return (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30">
                    <h3 className="text-sm font-semibold mb-2">Selected: {element.label}</h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/60">Products:</span>
                        <span className="font-semibold">{element.products?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Size:</span>
                        <span>{element.width} × {element.height}px</span>
                      </div>
                      <button
                        onClick={() => deleteElement(element.id)}
                        className="w-full px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Main Canvas */}
          <div className="flex-1 relative overflow-hidden bg-gray-900">
            <div
              ref={canvasRef}
              className="absolute inset-0 overflow-auto"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                backgroundImage: storeImageUrl ? `url(${storeImageUrl})` : 'none',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Grid */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                                     linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
                    transform: `translate(${pan.x * zoom}px, ${pan.y * zoom}px)`,
                  }}
                />
              )}

              {/* Canvas Content */}
              <div
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'top left',
                  width: `${canvasSize.width}px`,
                  height: `${canvasSize.height}px`,
                  position: 'relative',
                }}
              >
                {elements.map((element) => {
                  const isSelected = selectedElement === element.id;
                  const elementProducts = element.products || [];
                  const hasLowStock = elementProducts.some(p => Number(p.quantity || 0) <= lowStockThreshold);
                  const hasOutOfStock = elementProducts.some(p => Number(p.quantity || 0) === 0);
                  
                  return (
                    <div
                      key={element.id}
                      onMouseDown={(e) => handleMouseDown(e, element)}
                      onDrop={(e) => handleDropProduct(e, element.id)}
                      onDragOver={(e) => e.preventDefault()}
                      className={`absolute border-2 cursor-move transition-all ${
                        isSelected ? 'ring-4 ring-emerald-400 z-50' : 'z-10'
                      } ${
                        hasOutOfStock ? 'border-red-400 bg-red-500/20' :
                        hasLowStock ? 'border-yellow-400 bg-yellow-500/20' :
                        elementProducts.length > 0 ? 'border-emerald-400 bg-emerald-500/20' :
                        'border-white/30 bg-white/5'
                      }`}
                      style={{
                        left: `${element.x}px`,
                        top: `${element.y}px`,
                        width: `${element.width}px`,
                        height: `${element.height}px`,
                        zIndex: element.zIndex,
                      }}
                    >
                      {/* Element Label */}
                      <div className="absolute top-0 left-0 right-0 p-1.5 bg-black/70 text-xs font-medium flex items-center justify-between">
                        <span>{element.label}</span>
                        {elementProducts.length > 0 && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            hasOutOfStock ? 'bg-red-500' :
                            hasLowStock ? 'bg-yellow-500' :
                            'bg-emerald-500'
                          }`}>
                            {elementProducts.length}
                          </span>
                        )}
                      </div>

                      {/* Products on Element */}
                      <div className="absolute top-8 left-0 right-0 bottom-0 p-1 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-1">
                          {elementProducts.map((product) => {
                            const qty = Number(product.quantity || 0);
                            return (
                              <div
                                key={product.id}
                                className="relative group p-1 rounded bg-black/50 hover:bg-black/70 transition"
                                title={`${product.name} - Qty: ${qty}`}
                              >
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-full h-12 object-cover rounded mb-1"
                                  />
                                ) : (
                                  <div className="w-full h-12 bg-white/10 rounded mb-1 flex items-center justify-center text-xs">
                                    📦
                                  </div>
                                )}
                                <div className="text-[10px] truncate">{product.name}</div>
                                <div className={`absolute top-1 right-1 w-3 h-3 rounded-full ${getStockStatusColor(qty)}`} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeProductFromElement(element.id, product.id);
                                  }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition text-[10px]"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {elementProducts.length === 0 && (
                          <div className="text-center text-white/40 text-xs py-4">
                            Drop products here
                          </div>
                        )}
                      </div>

                      {/* Resize Handle */}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => handleMouseDown(e, element, true)}
                          className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 cursor-nwse-resize"
                          style={{ transform: 'translate(50%, 50%)' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Product Palette Sidebar */}
          {showProductPalette && (
            <div className="w-80 border-l border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2">Product Inventory</h3>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchProducts}
                  onChange={(e) => setSearchProducts(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm"
                />
                <div className="mt-2">
                  <label className="text-xs text-white/60">Low Stock Threshold:</label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-sm mt-1"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[calc(95vh-200px)] overflow-y-auto">
                {filteredProductsForPalette.map((product) => {
                  const qty = Number(product.quantity || 0);
                  return (
                    <div
                      key={product.id}
                      draggable
                      onDragStart={() => setDraggedProduct(product.id)}
                      onDragEnd={() => setDraggedProduct(null)}
                      className={`p-2 rounded-lg border cursor-move transition ${
                        draggedProduct === product.id ? 'border-emerald-400 bg-emerald-500/20' :
                        'border-white/20 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.productName}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center text-xl">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{product.productName}</div>
                          <div className="text-[10px] text-white/60">{product.sku}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStockStatusColor(qty)}`}>
                              {qty} {product.unit}
                            </span>
                            {product.location && (
                              <span className="text-[10px] text-emerald-300">📍 Placed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VirtualStoreBuilder;
