import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import ErrorBoundary from './ErrorBoundary';

// Lazy load 3D components to prevent breaking the app if there are compatibility issues
const Store3DView = lazy(() => {
  return import('./Store3DView').catch((error) => {
    console.error('Failed to load Store3DView:', error);
    // Return a simple fallback component
    return {
      default: () => (
        <div className="flex items-center justify-center h-full text-white/60">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">🎮</div>
            <p className="text-lg mb-2 font-semibold">3D View Unavailable</p>
            <p className="text-sm mb-4">React Three Fiber is not loading properly</p>
            <div className="text-xs text-white/50 space-y-1">
              <p>• Try refreshing the page</p>
              <p>• Ensure all dependencies are installed</p>
              <p>• Check browser console for details</p>
            </div>
            <p className="text-xs text-white/40 mt-4">Error: {error?.message || 'Unknown error'}</p>
          </div>
        </div>
      )
    };
  });
});

/**
 * SmartStoreDesigner - Unified Intelligent Store Design System
 * Features:
 * - Hierarchical structure: Floor → Aisle → Rack → Shelf → Lane
 * - Category-based organization
 * - Photo overlay mode
 * - Dark store support
 * - AI-powered layout suggestions
 * - Real-time sync with inventory
 * - Drag-drop product placement
 * - Color-coded stock status
 */

const SmartStoreDesigner = ({ userId, products = [], onClose, mode = 'designer' }) => {
  // Mode: 'designer' (build), 'viewer' (view only)
  const [activeMode, setActiveMode] = useState(mode);
  
  // Update activeMode when mode prop changes
  useEffect(() => {
    setActiveMode(mode);
  }, [mode]);
  
  // Store categories - simplified universal list
  const STORE_CATEGORIES = [
    'Healthcare', 'Grocery', 'Dairy', 'Beverages', 'Personal Care', 'Household',
    'Snacks', 'Pharma', 'Electronics', 'Stationery', 'Bakery', 'Frozen',
    'Clothing', 'Home & Garden', 'Automotive', 'Sports', 'Toys', 'Books'
  ];
  
  const [viewMode, setViewMode] = useState('2d'); // '2d', '3d'
  const [cameraMode, setCameraMode] = useState('orbit'); // 'orbit', 'first-person', 'top-down'
  
  // Product location search
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductLocation, setSelectedProductLocation] = useState(null);
  
  // Silent notification system - only show critical errors
  const [criticalNotifications, setCriticalNotifications] = useState([]);
  const showCriticalNotification = useCallback((message, type = 'error') => {
    const id = Date.now();
    setCriticalNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setCriticalNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);
  
  // Store structure
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedAisle, setSelectedAisle] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  
  
  // Canvas & UI
  const [canvasSize, setCanvasSize] = useState({ width: 2000, height: 1500 });
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  
  // Products & Interaction
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [showProductPalette, setShowProductPalette] = useState(false);
  const [searchProducts, setSearchProducts] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  
  // Canvas ref
  const canvasRef = useRef(null);
  
  // Drag and Drop for Elements
  const handleElementDragStart = useCallback((e, elementType, elementId) => {
    if (activeMode !== 'designer') return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('elementType', elementType);
    e.dataTransfer.setData('elementId', elementId);
    setDraggedProduct(elementId); // Reuse for element dragging
  }, [activeMode]);

  const handleElementDrop = useCallback((e, targetFloorId, targetX, targetY) => {
    e.preventDefault();
    const elementType = e.dataTransfer.getData('elementType');
    const elementId = e.dataTransfer.getData('elementId');
    
    if (!elementType || !elementId) return;
    
    const snappedX = snapToGrid ? Math.round(targetX / gridSize) * gridSize : targetX;
    const snappedY = snapToGrid ? Math.round(targetY / gridSize) * gridSize : targetY;
    
    // Move element to new position
    if (elementType === 'aisle') {
      setFloors(prevFloors => {
        isLocalChangeRef.current = true;
        const updatedFloors = prevFloors.map(floor => {
          if (floor.id !== targetFloorId) return floor;
          return {
            ...floor,
            aisles: (floor.aisles || []).map(aisle => 
              aisle.id === elementId 
                ? { ...aisle, x: snappedX, y: snappedY }
                : aisle
            )
          };
        });
        saveToHistory(updatedFloors);
        // Don't auto-save - user must click Save button
        return updatedFloors;
      });
      toast.success('Aisle moved!');
    }
    setDraggedProduct(null);
  }, [snapToGrid, gridSize]);

  // Product location finder - search products and show their location
  const findProductLocation = useMemo(() => {
    if (!productSearchQuery.trim()) return null;
    
    const queryLower = productSearchQuery.toLowerCase();
    const foundProduct = products.find(p => 
      p.productName?.toLowerCase().includes(queryLower) ||
      p.sku?.toLowerCase().includes(queryLower)
    );
    
    if (!foundProduct || !foundProduct.location) return null;
    
    const location = foundProduct.location;
    const path = [];
    
    // Find floor
    const floor = floors.find(f => f.id === location.floor);
    if (floor) {
      path.push({ type: 'floor', id: floor.id, name: floor.name });
      
      // Find aisle
      const aisle = floor.aisles?.find(a => a.id === location.aisle);
      if (aisle) {
        path.push({ type: 'aisle', id: aisle.id, name: aisle.name });
        
        // Find rack
        const rack = aisle.racks?.find(r => r.id === location.rack);
        if (rack) {
          path.push({ type: 'rack', id: rack.id, name: rack.name });
          
          // Find shelf
          const shelf = rack.shelves?.find(s => s.id === location.shelf);
          if (shelf) {
            path.push({ type: 'shelf', id: shelf.id, name: shelf.name });
            
            // Find lane
            const lane = shelf.lanes?.find(l => l.id === location.lane);
            if (lane) {
              path.push({ type: 'lane', id: lane.id, name: lane.name });
            }
          }
        }
      }
    }
    
    return {
      product: foundProduct,
      path,
      fullPath: location.fullPath || path.map(p => p.name).join(' > ')
    };
  }, [productSearchQuery, products, floors]);
  
  // History for undo/redo
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  
  // Track if we're making local changes to prevent reload from overwriting
  const isLocalChangeRef = useRef(false);
  const loadLayoutOnMountRef = useRef(true);

  // Helper function - must be defined before useCallback hooks
  // Uses functional update to get latest floors value
  const saveToHistory = useCallback((floorsToSave = null) => {
    const floorsToStore = floorsToSave || floors;
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(JSON.stringify(floorsToStore));
    historyIndexRef.current = historyRef.current.length - 1;
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  }, [floors]);

  // Sync products to layout based on their location - handles both old and new location formats
  // MUST be defined before useEffect hooks that use it
  const syncProductsToLayout = useCallback((productList) => {
    if (!productList || productList.length === 0) return;
    
    setFloors(prevFloors => {
      if (!prevFloors || prevFloors.length === 0) return prevFloors;
      
      return prevFloors.map(floor => {
        // Find products at floor level (if any)
        const floorProducts = productList.filter(p => 
          p.location?.floor === floor.id || 
          (p.location?.floor && typeof p.location.floor === 'string' && p.location.floor.includes(floor.id))
        );
        
        return {
          ...floor,
          aisles: (floor.aisles || []).map(aisle => {
            // Find products at aisle level
            const aisleProducts = productList.filter(p => 
              p.location?.aisle === aisle.id ||
              (p.location?.aisle && typeof p.location.aisle === 'string' && p.location.aisle.includes(aisle.id))
            );
            
            return {
              ...aisle,
              racks: (aisle.racks || []).map(rack => {
                // Find products at rack level
                const rackProducts = productList.filter(p => 
                  p.location?.rack === rack.id ||
                  (p.location?.rack && typeof p.location.rack === 'string' && p.location.rack.includes(rack.id))
                );
                
                return {
                  ...rack,
                  shelves: (rack.shelves || []).map(shelf => {
                    // Find products at shelf level (not in lanes)
                    const shelfProducts = productList.filter(p => {
                      const hasShelfMatch = p.location?.shelf === shelf.id ||
                        (p.location?.shelf && typeof p.location.shelf === 'string' && p.location.shelf.includes(shelf.id));
                      const hasLane = p.location?.lane;
                      return hasShelfMatch && !hasLane;
                    });
                    
                    return {
                      ...shelf,
                      lanes: (shelf.lanes || []).map(lane => {
                        // Find products in this specific lane
                        const laneProducts = productList.filter(p => 
                          p.location?.lane === lane.id ||
                          (p.location?.lane && typeof p.location.lane === 'string' && p.location.lane.includes(lane.id)) ||
                          (p.location?.shelf === shelf.id && p.location?.lane === lane.id)
                        );
                        return { ...lane, products: laneProducts };
                      }),
                      products: shelfProducts,
                    };
                  }),
                  products: rackProducts,
                };
              }),
              products: aisleProducts,
            };
          }),
        };
      });
    });
  }, []);

  // Load store layout - must be defined before useEffect that uses it
  const loadStoreLayout = useCallback(async () => {
    // Don't reload if we just made a local change
    if (isLocalChangeRef.current) {
      console.log('Skipping loadStoreLayout - local change in progress');
      return;
    }
    
    try {
      console.log('Loading store layout from Firestore...');
      // Try loading from virtualStore/layout first (new unified structure)
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      const snap = await getDoc(layoutRef);
      
      if (snap.exists()) {
        const data = snap.data();
        setFloors(data.floors || []);
        setCanvasSize(data.canvasSize || { width: 2000, height: 1500 });
        
        // Sync products after loading layout
        if (products && products.length > 0) {
          setTimeout(() => syncProductsToLayout(products), 100);
        }
        return;
      }
      
      // Fallback: Try loading from storeLayout/main (old LocationPicker structure)
      const oldLayoutRef = doc(db, 'businesses', userId, 'storeLayout', 'main');
      const oldSnap = await getDoc(oldLayoutRef);
      
      if (oldSnap.exists()) {
        const oldData = oldSnap.data();
        // Convert old structure to new structure
        const convertedFloors = (oldData.floors || []).map(floor => ({
          id: floor.id || `floor_${Date.now()}`,
          name: floor.name || 'Floor 1',
          aisles: (oldData.aisles?.[floor.id] || []).map((aisle, idx) => ({
            id: aisle.id || `aisle_${Date.now()}_${idx}`,
            name: aisle.name || `Aisle ${idx + 1}`,
            category: aisle.category || '',
            racks: (oldData.racks?.[`${floor.id}_${aisle.id}`] || []).map((rack, rIdx) => ({
              id: rack.id || `rack_${Date.now()}_${rIdx}`,
              name: rack.name || `Rack ${rIdx + 1}`,
              shelves: (oldData.shelves?.[`${floor.id}_${aisle.id}_${rack.id}`] || []).map((shelf, sIdx) => ({
                id: shelf.id || `shelf_${Date.now()}_${sIdx}`,
                name: shelf.name || `Shelf ${sIdx + 1}`,
                lanes: [],
                products: [],
              })),
              products: [],
            })),
            products: [],
          })),
          x: 0,
          y: 0,
          width: canvasSize.width,
          height: canvasSize.height,
        }));
        
        setFloors(convertedFloors);
        
        // Migrate to new structure
        await setDoc(layoutRef, {
          floors: convertedFloors,
          canvasSize,
          migratedFrom: 'storeLayout/main',
          updatedAt: Date.now(),
        }, { merge: true });
        
        // Sync products after loading
        if (products && products.length > 0) {
          setTimeout(() => syncProductsToLayout(products), 100);
        }
      }
    } catch (error) {
      console.error('Error loading store layout:', error);
      toast.error('Failed to load store layout');
    }
  }, [userId, products, syncProductsToLayout, canvasSize]);

  // Load store layout - only on mount or userId change, not when loadStoreLayout function changes
  useEffect(() => {
    if (userId) {
      // Reset the flag when userId changes to allow loading
      loadLayoutOnMountRef.current = true;
      const loadLayout = async () => {
        await loadStoreLayout();
        loadLayoutOnMountRef.current = false;
      };
      loadLayout();
    }
  }, [userId]); // Removed loadStoreLayout from dependencies to prevent re-loading on every change
  
  // Sync products when floors are loaded
  useEffect(() => {
    if (floors.length > 0 && products && products.length > 0) {
      syncProductsToLayout(products);
    }
  }, [floors.length, products, syncProductsToLayout]);

  // Real-time product sync - updates layout when products change
  useEffect(() => {
    if (!userId) return;
    const productsRef = collection(db, 'businesses', userId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      // Update products in store structure
      const updatedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Only sync if we have floors loaded
      if (floors.length > 0) {
        syncProductsToLayout(updatedProducts);
      }
    });
    return () => unsubscribe();
  }, [userId, floors.length, syncProductsToLayout]);

  const saveStoreLayout = async (floorsToSave = null, silent = false) => {
    try {
      const floorsToStore = floorsToSave || floors;
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      await setDoc(layoutRef, {
        floors: floorsToStore,
        canvasSize,
        updatedAt: Date.now(),
      }, { merge: true });
      if (!silent) {
        toast.success('Store layout saved!');
      }
    } catch (error) {
      console.error('Error saving store layout:', error);
      if (!silent) {
        toast.error('Failed to save layout');
      }
    }
  };

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setFloors(JSON.parse(historyRef.current[historyIndexRef.current]));
    }
  };

  const redo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setFloors(JSON.parse(historyRef.current[historyIndexRef.current]));
    }
  };



  // Add Floor
  const addFloor = () => {
    try {
      console.log('addFloor called, current floors:', floors.length);
      isLocalChangeRef.current = true;
      const newFloor = {
        id: `floor_${Date.now()}`,
        name: `Floor ${floors.length + 1}`,
        aisles: [],
        x: 0,
        y: 0,
        width: canvasSize.width,
        height: canvasSize.height,
      };
      // Use functional update to ensure we have the latest state
      setFloors(prevFloors => {
        const updatedFloors = [...prevFloors, newFloor];
        saveToHistory(updatedFloors);
        // Don't auto-save - user must click Save button
        return updatedFloors;
      });
      setSelectedFloor(newFloor.id);
      toast.success(`Floor "${newFloor.name}" created! Click Save to persist changes.`);
    } catch (error) {
      console.error('Error adding floor:', error);
      toast.error('Failed to add floor');
      isLocalChangeRef.current = false;
    }
  };

  // Add Aisle to Floor
  const addAisle = (floorId, category = null) => {
    try {
      const floor = floors.find(f => f.id === floorId);
      if (!floor) {
        toast.error('Please select a floor first');
        return;
      }

      isLocalChangeRef.current = true;
      const aisleNumber = (floor.aisles || []).length + 1;
      const newAisle = {
        id: `aisle_${Date.now()}`,
        name: `Aisle ${String.fromCharCode(64 + aisleNumber)}${aisleNumber}`,
        category: category || '',
        racks: [],
        x: 100 + (aisleNumber - 1) * 250,
        y: 100,
        width: 200,
        height: 800,
        color: category ? getCategoryColorLocal(category) : '#a855f7',
        products: [],
      };

      setFloors(prevFloors => {
        const updatedFloors = prevFloors.map(f => 
          f.id === floorId 
            ? { ...f, aisles: [...(f.aisles || []), newAisle] }
            : f
        );
        saveToHistory(updatedFloors);
        // Don't auto-save - user must click Save button
        return updatedFloors;
      });
      setSelectedAisle(newAisle.id);
      // Silent feedback - no toast
    } catch (error) {
      console.error('Error adding aisle:', error);
      showCriticalNotification('Failed to add aisle');
      isLocalChangeRef.current = false;
    }
  };

  // Add Rack to Aisle
  const addRack = (floorId, aisleId) => {
    try {
      const floor = floors.find(f => f.id === floorId);
      if (!floor) {
        toast.error('Floor not found');
        return;
      }
      const aisle = (floor.aisles || []).find(a => a.id === aisleId);
      if (!aisle) {
        toast.error('Aisle not found');
        return;
      }

      const rackNumber = (aisle.racks || []).length + 1;
      const newRack = {
        id: `rack_${Date.now()}`,
        name: `Rack ${rackNumber}`,
        shelves: [],
        x: aisle.x + 20 + (rackNumber - 1) * 60,
        y: aisle.y + 50,
        width: 50,
        height: 200,
        products: [],
      };

      const updatedFloors = floors.map(f => 
        f.id === floorId 
          ? { 
              ...f, 
              aisles: (f.aisles || []).map(a => 
                a.id === aisleId 
                  ? { ...a, racks: [...(a.racks || []), newRack] }
                  : a
              )
            }
          : f
      );
      setFloors(updatedFloors);
      saveToHistory(updatedFloors);
      toast.success(`Rack "${newRack.name}" created!`);
    } catch (error) {
      console.error('Error adding rack:', error);
      toast.error('Failed to add rack');
    }
  };

  // Add Shelf to Rack
  const addShelf = (floorId, aisleId, rackId, shelfCount = 1) => {
    try {
      const floor = floors.find(f => f.id === floorId);
      if (!floor) {
        toast.error('Floor not found');
        return;
      }
      const aisle = (floor.aisles || []).find(a => a.id === aisleId);
      if (!aisle) {
        toast.error('Aisle not found');
        return;
      }
      const rack = (aisle.racks || []).find(r => r.id === rackId);
      if (!rack) {
        toast.error('Rack not found');
        return;
      }

      const shelves = [];
      const shelfHeight = (rack.height - 20) / shelfCount;
      
      for (let i = 0; i < shelfCount; i++) {
        shelves.push({
          id: `shelf_${Date.now()}_${i}`,
          name: `Shelf ${i + 1}`,
          lanes: [],
          x: rack.x,
          y: rack.y + 10 + (i * shelfHeight),
          width: rack.width,
          height: shelfHeight - 5,
          products: [],
        });
      }

      const updatedFloors = floors.map(f => 
        f.id === floorId 
          ? { 
              ...f, 
              aisles: (f.aisles || []).map(a => 
                a.id === aisleId 
                  ? { 
                      ...a, 
                      racks: (a.racks || []).map(r => 
                        r.id === rackId 
                          ? { ...r, shelves: [...(r.shelves || []), ...shelves] }
                          : r
                      )
                    }
                  : a
              )
            }
          : f
      );
      setFloors(updatedFloors);
      saveToHistory(updatedFloors);
      toast.success(`${shelfCount} shelf${shelfCount > 1 ? 's' : ''} created!`);
    } catch (error) {
      console.error('Error adding shelf:', error);
      toast.error('Failed to add shelf');
    }
  };

  // Add Product Lane to Shelf
  const addLane = (floorId, aisleId, rackId, shelfId, laneCount = 1) => {
    try {
      const floor = floors.find(f => f.id === floorId);
      if (!floor) {
        toast.error('Floor not found');
        return;
      }
      const aisle = (floor.aisles || []).find(a => a.id === aisleId);
      if (!aisle) {
        toast.error('Aisle not found');
        return;
      }
      const rack = (aisle.racks || []).find(r => r.id === rackId);
      if (!rack) {
        toast.error('Rack not found');
        return;
      }
      const shelf = (rack.shelves || []).find(s => s.id === shelfId);
      if (!shelf) {
        toast.error('Shelf not found');
        return;
      }

      const lanes = [];
      const laneWidth = shelf.width / laneCount;
      
      for (let i = 0; i < laneCount; i++) {
        lanes.push({
          id: `lane_${Date.now()}_${i}`,
          name: `Lane ${i + 1}`,
          x: shelf.x + (i * laneWidth),
          y: shelf.y,
          width: laneWidth - 2,
          height: shelf.height,
          products: [],
        });
      }

      const updatedFloors = floors.map(f => 
        f.id === floorId 
          ? { 
              ...f, 
              aisles: (f.aisles || []).map(a => 
                a.id === aisleId 
                  ? { 
                      ...a, 
                      racks: (a.racks || []).map(r => 
                        r.id === rackId 
                          ? { 
                              ...r, 
                              shelves: (r.shelves || []).map(s => 
                                s.id === shelfId 
                                  ? { ...s, lanes: [...(s.lanes || []), ...lanes] }
                                  : s
                              )
                            }
                          : r
                      )
                    }
                  : a
              )
            }
          : f
      );
      setFloors(updatedFloors);
      saveToHistory(updatedFloors);
      toast.success(`${laneCount} lane${laneCount > 1 ? 's' : ''} created!`);
    } catch (error) {
      console.error('Error adding lane:', error);
      toast.error('Failed to add lane');
    }
  };

  // Category colors
  const getCategoryColorLocal = useCallback((category) => {
    const colors = {
      'Healthcare': '#10b981',
      'Grocery': '#f59e0b',
      'Dairy': '#3b82f6',
      'Beverages': '#ef4444',
      'Personal Care': '#8b5cf6',
      'Household': '#06b6d4',
      'Snacks': '#f97316',
      'Pharma': '#ec4899',
      'Electronics': '#6366f1',
      'Stationery': '#14b8a6',
      'Bakery': '#d97706',
      'Frozen': '#0ea5e9',
    };
    return colors[category] || '#a855f7';
  }, []);

  // AI-Powered Smart Layout Suggestions
  const generateSmartSuggestions = useCallback(() => {
    const productList = products || [];
    if (productList.length === 0) {
      return {
        suggestions: [],
        message: 'Add products first to get smart layout suggestions',
      };
    }

    // Analyze products by category
    const categoryAnalysis = {};
    productList.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!categoryAnalysis[cat]) {
        categoryAnalysis[cat] = {
          category: cat,
          products: [],
          totalQuantity: 0,
          uniqueBrands: new Set(),
        };
      }
      categoryAnalysis[cat].products.push(p);
      categoryAnalysis[cat].totalQuantity += Number(p.quantity || 0);
      if (p.brand) categoryAnalysis[cat].uniqueBrands.add(p.brand);
    });

    // Generate suggestions
    const suggestions = Object.values(categoryAnalysis).map((analysis, index) => {
      const productCount = analysis.products.length;
      const avgQuantity = analysis.totalQuantity / productCount;
      
      // Calculate optimal structure
      const suggestedRacks = Math.max(1, Math.ceil(productCount / 50));
      const suggestedShelvesPerRack = Math.max(2, Math.ceil(productCount / (suggestedRacks * 20)));
      const suggestedLanesPerShelf = Math.max(1, Math.ceil(productCount / (suggestedRacks * suggestedShelvesPerRack * 10)));
      
      return {
        category: analysis.category,
        productCount,
        totalQuantity: analysis.totalQuantity,
        uniqueBrands: analysis.uniqueBrands.size,
        suggestedAisle: `Aisle ${String.fromCharCode(65 + index)}${index + 1}`,
        suggestedRacks,
        suggestedShelvesPerRack,
        suggestedLanesPerShelf,
        priority: productCount > 30 ? 'high' : productCount > 15 ? 'medium' : 'low',
        color: getCategoryColorLocal(analysis.category),
      };
    }).sort((a, b) => b.productCount - a.productCount);

    return {
      suggestions,
      totalProducts: productList.length,
      totalCategories: suggestions.length,
      estimatedAisles: suggestions.length,
      estimatedRacks: suggestions.reduce((sum, s) => sum + s.suggestedRacks, 0),
    };
  }, [products]);

  // Apply smart layout
  const applySmartLayout = () => {
    const analysis = generateSmartSuggestions();
    if (analysis.suggestions.length === 0) {
      toast.info(analysis.message || 'No suggestions available');
      return;
    }

    // Create floor if none exists
    let floorId = selectedFloor;
    let currentFloors = floors;
    
    if (!floorId || floors.length === 0) {
      const newFloor = {
        id: `floor_${Date.now()}`,
        name: 'Main Floor',
        aisles: [],
        x: 0,
        y: 0,
        width: canvasSize.width,
        height: canvasSize.height,
      };
      currentFloors = [newFloor];
      floorId = newFloor.id;
      setSelectedFloor(floorId);
      setFloors(currentFloors);
    }

    // Create aisles with racks and shelves
    const newAisles = analysis.suggestions.map((suggestion, index) => {
      const aisle = {
        id: `aisle_${Date.now()}_${index}`,
        name: suggestion.suggestedAisle,
        category: suggestion.category,
        racks: [],
        x: 100 + (index * 250),
        y: 100,
        width: 200,
        height: 800,
        color: getCategoryColorLocal(suggestion.category),
        products: [],
      };

      // Add racks to aisle
      for (let r = 0; r < suggestion.suggestedRacks; r++) {
        const rack = {
          id: `rack_${Date.now()}_${index}_${r}`,
          name: `Rack ${r + 1}`,
          shelves: [],
          x: aisle.x + 20 + (r * 60),
          y: aisle.y + 50,
          width: 50,
          height: aisle.height - 100,
          products: [],
        };

        // Add shelves to rack
        for (let s = 0; s < suggestion.suggestedShelvesPerRack; s++) {
          const shelfHeight = (rack.height - 20) / suggestion.suggestedShelvesPerRack;
          const shelf = {
            id: `shelf_${Date.now()}_${index}_${r}_${s}`,
            name: `Shelf ${s + 1}`,
            lanes: [],
            x: rack.x,
            y: rack.y + 10 + (s * shelfHeight),
            width: rack.width,
            height: shelfHeight - 5,
            products: [],
          };

          // Add lanes to shelf
          for (let l = 0; l < suggestion.suggestedLanesPerShelf; l++) {
            const laneWidth = shelf.width / suggestion.suggestedLanesPerShelf;
            shelf.lanes.push({
              id: `lane_${Date.now()}_${index}_${r}_${s}_${l}`,
              name: `Lane ${l + 1}`,
              x: shelf.x + (l * laneWidth),
              y: shelf.y,
              width: laneWidth - 2,
              height: shelf.height,
              products: [],
            });
          }

          rack.shelves.push(shelf);
        }

        aisle.racks.push(rack);
      }

      return aisle;
    });

    // Update floors - use functional update to ensure we have the latest state
    isLocalChangeRef.current = true;
    setFloors(prevFloors => {
      const updatedFloors = prevFloors.map(f => 
        f.id === floorId 
          ? { ...f, aisles: newAisles }
          : f
      );
      saveToHistory(updatedFloors);
      // Don't auto-save - user must click Save button
      return updatedFloors;
    });
    setAiSuggestions(analysis);
    toast.success(`Smart layout created! ${analysis.estimatedAisles} aisles, ${analysis.estimatedRacks} racks. Click Save to persist changes.`);
  };

  // Drop product onto location
  const handleDropProduct = async (e, locationPath) => {
    e.preventDefault();
    if (!draggedProduct) return;

    const productList = products || [];
    const product = productList.find(p => p.id === draggedProduct);
    if (!product) return;

    const [floorId, aisleId, rackId, shelfId, laneId] = locationPath.split('/');
    
    // Update floors structure
    const updatedFloors = floors.map(floor => {
      if (floor.id !== floorId) return floor;
      return {
        ...floor,
        aisles: (floor.aisles || []).map(aisle => {
          if (aisle.id !== aisleId) return aisle;
          return {
            ...aisle,
            racks: (aisle.racks || []).map(rack => {
              if (rack.id !== rackId) return rack;
              return {
                ...rack,
                shelves: (rack.shelves || []).map(shelf => {
                  if (shelf.id !== shelfId) return shelf;
                  if (laneId) {
                    // Add to specific lane
                    return {
                      ...shelf,
                      lanes: (shelf.lanes || []).map(lane => {
                        if (lane.id !== laneId) return lane;
                        if (!lane.products.find(p => p.id === product.id)) {
                          return {
                            ...lane,
                            products: [...(lane.products || []), {
                              id: product.id,
                              name: product.productName,
                              sku: product.sku,
                              quantity: product.quantity,
                              imageUrl: product.imageUrl,
                            }]
                          };
                        }
                        return lane;
                      })
                    };
                  } else {
                    // Add to shelf
                    if (!shelf.products.find(p => p.id === product.id)) {
                      return {
                        ...shelf,
                        products: [...(shelf.products || []), {
                          id: product.id,
                          name: product.productName,
                          sku: product.sku,
                          quantity: product.quantity,
                          imageUrl: product.imageUrl,
                        }]
                      };
                    }
                  }
                  return shelf;
                })
              };
            })
          };
        })
      };
    });
    setFloors(updatedFloors);

    // Sync to product location in Firestore - format compatible with LocationPicker
    try {
      const productRef = doc(db, 'businesses', userId, 'products', product.id);
      const locationPathArray = locationPath.split('/');
      
      // Get names for full path
      const floor = floors.find(f => f.id === locationPathArray[0]);
      const aisle = floor?.aisles?.find(a => a.id === locationPathArray[1]);
      const rack = aisle?.racks?.find(r => r.id === locationPathArray[2]);
      const shelf = rack?.shelves?.find(s => s.id === locationPathArray[3]);
      const lane = shelf?.lanes?.find(l => l.id === locationPathArray[4]);
      
      const location = {
        floor: locationPathArray[0] || null,
        aisle: locationPathArray[1] || null,
        rack: locationPathArray[2] || null,
        shelf: locationPathArray[3] || null,
        lane: locationPathArray[4] || null,
        fullPath: [
          floor?.name,
          aisle?.name,
          rack?.name,
          shelf?.name,
          lane?.name,
        ].filter(Boolean).join(' > ') || getLocationPathString(locationPathArray),
      };
      
      await updateDoc(productRef, { location });
      
      // Trigger sync to update layout immediately - reload from Firestore
      setTimeout(async () => {
        try {
          const productsRef = collection(db, 'businesses', userId, 'products');
          const snapshot = await getDocs(productsRef);
          const updatedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          syncProductsToLayout(updatedProducts);
        } catch (err) {
          console.error('Error refreshing products:', err);
        }
      }, 200);
      
      toast.success(`Product placed at ${location.fullPath}!`);
    } catch (error) {
      console.error('Error syncing location:', error);
      toast.error('Failed to sync location');
    }

    setDraggedProduct(null);
    // Note: floors state is updated above, so we use current floors
    saveToHistory(updatedFloors);
  };

  const getLocationPathString = (pathArray) => {
    const floor = floors.find(f => f.id === pathArray[0]);
    if (!floor) return 'Unknown';
    const aisle = (floor.aisles || []).find(a => a.id === pathArray[1]);
    if (!aisle) return floor.name;
    const rack = (aisle.racks || []).find(r => r.id === pathArray[2]);
    if (!rack) return `${floor.name} > ${aisle.name}`;
    const shelf = (rack.shelves || []).find(s => s.id === pathArray[3]);
    if (!shelf) return `${floor.name} > ${aisle.name} > ${rack.name}`;
    const lane = (shelf.lanes || []).find(l => l.id === pathArray[4]);
    if (lane) return `${floor.name} > ${aisle.name} > ${rack.name} > ${shelf.name} > ${lane.name}`;
    return `${floor.name} > ${aisle.name} > ${rack.name} > ${shelf.name}`;
  };

  const getStockStatusColor = (quantity) => {
    const qty = Number(quantity || 0);
    if (qty === 0) return 'bg-red-500';
    if (qty <= lowStockThreshold) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };


  const renderHierarchicalView = () => {
    if (!floors || floors.length === 0) {
      return (
        <div className="text-white/60 text-center py-20">
          <p className="text-lg mb-2">No store layout yet</p>
          <p className="text-sm">Create a floor and start building your store, or use Smart Suggestions</p>
        </div>
      );
    }
    
    return floors.map(floor => (
      <div 
        key={floor.id} 
        className={`absolute border-2 rounded-xl transition-all ${
          selectedFloor === floor.id 
            ? 'border-emerald-400 bg-emerald-500/10 shadow-2xl shadow-emerald-500/30' 
            : 'border-dashed border-white/20 bg-white/5'
        }`}
        style={{ 
          left: `${floor.x}px`, 
          top: `${floor.y}px`,
          width: `${Math.max(floor.width, 400)}px`,
          height: `${Math.max(floor.height, 300)}px`,
        }}
      >
        {/* Floor label - Clean and prominent */}
        <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg z-10 ${
          selectedFloor === floor.id 
            ? 'bg-emerald-500 text-slate-900 border-2 border-emerald-300' 
            : 'bg-black/90 text-white border border-white/30'
        }`}>
          <div className="flex items-center gap-2">
            <span>🏢 {floor.name}</span>
            {floor.aisles && floor.aisles.length > 0 && (
              <span className="text-[10px] opacity-75 px-1.5 py-0.5 bg-white/20 rounded">
                {(floor.aisles || []).length} aisle{(floor.aisles || []).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {/* Show message if floor has no aisles */}
        {(!floor.aisles || floor.aisles.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white/60 text-sm bg-black/60 backdrop-blur-sm px-6 py-4 rounded-xl border border-white/20 shadow-xl">
              <p className="mb-2 font-semibold text-base">Empty Floor</p>
              <p className="text-xs text-white/70">Add aisles to this floor to get started</p>
            </div>
          </div>
        )}
        {(floor.aisles || []).map(aisle => {
          const aisleProducts = (aisle.products || []).concat(
            ...(aisle.racks || []).flatMap(rack => 
              (rack.products || []).concat(
                ...(rack.shelves || []).flatMap(shelf => 
                  (shelf.products || []).concat(
                    ...(shelf.lanes || []).flatMap(lane => lane.products || [])
                  )
                )
              )
            )
          );
          const hasLowStock = aisleProducts.some(p => Number(p.quantity || 0) > 0 && Number(p.quantity || 0) <= lowStockThreshold);
          const hasOutOfStock = aisleProducts.some(p => Number(p.quantity || 0) === 0);
          
          // Store floor.id in a const to avoid closure issues
          const currentFloorId = floor.id;
          
          return (
            <div
              key={aisle.id}
              className="absolute border-2 rounded-lg transition-all group"
              style={{
                left: `${aisle.x}px`,
                top: `${aisle.y}px`,
                width: `${aisle.width}px`,
                height: `${aisle.height}px`,
                borderColor: aisle.color,
                backgroundColor: `${aisle.color}20`,
                cursor: activeMode === 'designer' ? 'move' : 'default',
              }}
              draggable={activeMode === 'designer'}
              onDragStart={(e) => handleElementDragStart(e, 'aisle', aisle.id)}
              onDrop={activeMode === 'designer' ? (e) => handleDropProduct(e, `${currentFloorId}/${aisle.id}`) : undefined}
              onDragOver={activeMode === 'designer' ? (e) => e.preventDefault() : undefined}
              onClick={activeMode === 'designer' ? () => setSelectedAisle(aisle.id) : undefined}
            >
              {/* Aisle Header */}
              <div className="absolute top-0 left-0 right-0 p-2 bg-black/80 rounded-t-lg">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>{aisle.name}</span>
                  <div className="flex items-center gap-1">
                    {aisleProducts.length > 0 && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        hasOutOfStock ? 'bg-red-500' :
                        hasLowStock ? 'bg-yellow-500' :
                        'bg-emerald-500'
                      }`}>
                        {aisleProducts.length}
                      </span>
                    )}
                    {activeMode === 'designer' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Use the floor.id from outer scope (stored in currentFloorId)
                          isLocalChangeRef.current = true;
                          setFloors(prev => {
                            const updatedFloors = prev.map(f => 
                              f.id === currentFloorId 
                                ? { ...f, aisles: (f.aisles || []).filter(a => a.id !== aisle.id) }
                                : f
                            );
                            saveToHistory(updatedFloors);
                            // Don't auto-save - user must click Save button
                            return updatedFloors;
                          });
                          setSelectedAisle(null);
                          toast.success('Aisle removed. Click Save to persist changes.');
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-1 py-0.5 text-red-400 hover:text-red-300 text-xs"
                        title="Delete aisle"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                {aisle.category && (
                  <div className="text-[10px] text-white/70">{aisle.category}</div>
                )}
              </div>

              {/* Racks */}
              <div className="absolute top-10 left-0 right-0 bottom-0 p-2 overflow-y-auto">
                {(aisle.racks || []).map(rack => (
                  <div
                    key={rack.id}
                    className="absolute border border-white/30 bg-white/10"
                    style={{
                      left: `${rack.x - aisle.x}px`,
                      top: `${rack.y - aisle.y}px`,
                      width: `${rack.width}px`,
                      height: `${rack.height}px`,
                    }}
                    onDrop={activeMode === 'designer' ? (e) => handleDropProduct(e, `${currentFloorId}/${aisle.id}/${rack.id}`) : undefined}
                    onDragOver={activeMode === 'designer' ? (e) => e.preventDefault() : undefined}
                  >
                    <div className="absolute top-0 left-0 right-0 p-1 bg-black/60 text-[10px] text-center">
                      {rack.name}
                    </div>

                    {/* Shelves */}
                    {(rack.shelves || []).map(shelf => (
                      <div
                        key={shelf.id}
                        className="absolute border-t border-white/20 bg-white/5"
                        style={{
                          left: '0px',
                          top: `${shelf.y - rack.y}px`,
                          width: '100%',
                          height: `${shelf.height}px`,
                        }}
                        onDrop={activeMode === 'designer' ? (e) => handleDropProduct(e, `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}`) : undefined}
                        onDragOver={activeMode === 'designer' ? (e) => e.preventDefault() : undefined}
                      >
                        {/* Product Lanes */}
                        {(shelf.lanes || []).map(lane => (
                          <div
                            key={lane.id}
                            className="absolute border-l border-white/10"
                            style={{
                              left: `${lane.x - shelf.x}px`,
                              top: '0px',
                              width: `${lane.width}px`,
                              height: '100%',
                            }}
                            onDrop={activeMode === 'designer' ? (e) => handleDropProduct(e, `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}`) : undefined}
                            onDragOver={activeMode === 'designer' ? (e) => e.preventDefault() : undefined}
                          >
                            {/* Products in Lane */}
                            <div className="p-0.5 space-y-0.5">
                              {(lane.products || []).map(product => (
                                <div
                                  key={product.id}
                                  className="relative p-0.5 rounded bg-black/40"
                                  title={`${product.name} - Qty: ${product.quantity}`}
                                >
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="w-full h-8 object-cover rounded" />
                                  ) : (
                                    <div className="w-full h-8 bg-white/10 rounded flex items-center justify-center text-xs">📦</div>
                                  )}
                                  <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${getStockStatusColor(product.quantity)}`} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Products on Shelf (if no lanes) */}
                        {(!shelf.lanes || shelf.lanes.length === 0) && shelf.products && shelf.products.length > 0 && (
                          <div className="p-1 grid grid-cols-2 gap-0.5">
                            {shelf.products.map(product => (
                              <div
                                key={product.id}
                                className="relative p-0.5 rounded bg-black/40"
                                title={`${product.name} - Qty: ${product.quantity}`}
                              >
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-6 object-cover rounded" />
                                ) : (
                                  <div className="w-full h-6 bg-white/10 rounded flex items-center justify-center text-[10px]">📦</div>
                                )}
                                <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${getStockStatusColor(product.quantity)}`} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    ));
  };

  // Show suggestions panel
  useEffect(() => {
    if (showSuggestions) {
      const analysis = generateSmartSuggestions();
      setAiSuggestions(analysis);
    }
  }, [showSuggestions, generateSmartSuggestions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Delete selected element on Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAisle && activeMode === 'designer') {
        const floor = floors.find(f => f.aisles?.some(a => a.id === selectedAisle));
        if (floor) {
          setFloors(prev => prev.map(f => 
            f.id === floor.id 
              ? { ...f, aisles: f.aisles.filter(a => a.id !== selectedAisle) }
              : f
          ));
          setSelectedAisle(null);
          toast.success('Aisle deleted');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedAisle, floors, activeMode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[98%] h-[96vh] flex flex-col text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B0F14]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">🧠 Smart Store Designer</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveMode('designer')}
                className={`px-3 py-1.5 rounded-lg text-sm ${activeMode === 'designer' ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                🏗️ Design
              </button>
              <button
                onClick={() => setActiveMode('viewer')}
                className={`px-3 py-1.5 rounded-lg text-sm ${activeMode === 'viewer' ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                👁️ View
              </button>
            </div>
            {/* View Mode Switcher */}
            <div className="flex items-center gap-2 border-l border-white/20 pl-4 ml-4">
              <span className="text-xs text-white/60">View:</span>
              <button
                onClick={() => setViewMode('2d')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '2d' 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                title="2D View"
              >
                📐 2D
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  viewMode === '3d' 
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                title="3D View"
              >
                🎮 3D
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeMode === 'designer' && (
              <>
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-sm"
                >
                  💡 AI Suggestions
                </button>
                <button
                  onClick={undo}
                  disabled={historyIndexRef.current <= 0}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm"
                  title="Undo"
                >
                  ↶
                </button>
                <button
                  onClick={redo}
                  disabled={historyIndexRef.current >= historyRef.current.length - 1}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm"
                  title="Redo"
                >
                  ↷
                </button>
              </>
            )}
            <button
              onClick={() => setShowProductPalette(!showProductPalette)}
              className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-sm"
            >
              📦 Products ({products.length})
            </button>
            <button
              onClick={saveStoreLayout}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium"
            >
              💾 Save
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl w-8 h-8">×</button>
          </div>
        </div>
        
        {/* Critical Notifications - Only show errors */}
        {criticalNotifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2">
            {criticalNotifications.map(notif => (
              <div
                key={notif.id}
                className={`px-4 py-3 rounded-lg shadow-xl backdrop-blur-sm border animate-in slide-in-from-right ${
                  notif.type === 'error' 
                    ? 'bg-red-500/90 border-red-400 text-white' 
                    : 'bg-emerald-500/90 border-emerald-400 text-white'
                }`}
              >
                {notif.message}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          {activeMode === 'designer' ? (
            <div className="w-80 border-r border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
              {/* Product Location Finder */}
              <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-400/30">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  🔍 Find Product Location
                </h3>
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm mb-2"
                />
                {findProductLocation && (
                  <div className="mt-2 p-2 rounded bg-white/5 text-xs">
                    <div className="font-medium text-emerald-300 mb-1">
                      {findProductLocation.product.productName}
                    </div>
                    <div className="text-white/70 mb-2">
                      📍 {findProductLocation.fullPath}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {findProductLocation.path.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (p.type === 'floor') setSelectedFloor(p.id);
                            if (p.type === 'aisle') setSelectedAisle(p.id);
                            setSelectedProductLocation(p.id);
                          }}
                          className={`px-2 py-1 rounded text-[10px] ${
                            selectedProductLocation === p.id
                              ? 'bg-emerald-500'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Suggestions Panel */}
              {showSuggestions && aiSuggestions && (
                <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-400/30">
                  <h3 className="text-sm font-semibold mb-2">💡 AI Layout Suggestions</h3>
                  <div className="text-xs text-white/60 mb-2">
                    {aiSuggestions.totalProducts} products • {aiSuggestions.totalCategories} categories
                  </div>
                  <button
                    onClick={applySmartLayout}
                    className="w-full px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-sm font-medium mb-3"
                  >
                    ✨ Auto-Generate Layout
                  </button>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {aiSuggestions.suggestions.map((s, idx) => (
                      <div key={idx} className="p-2 rounded bg-white/5 text-xs">
                        <div className="font-medium flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color }} />
                          {s.category}
                        </div>
                        <div className="text-[10px] text-white/60 mt-1">
                          {s.productCount} products → {s.suggestedAisle}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {s.suggestedRacks} racks, {s.suggestedShelvesPerRack} shelves/rack, {s.suggestedLanesPerShelf} lanes/shelf
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Floor Management */}
              <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">Floors</h3>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Add Floor button clicked');
                      addFloor();
                    }}
                    className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-xs cursor-pointer active:scale-95 transition-transform"
                    type="button"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {floors.length === 0 ? (
                    <div className="text-xs text-white/60 p-2">No floors yet. Click + Add to create one.</div>
                  ) : (
                    floors.map(floor => (
                      <div
                        key={floor.id}
                        className={`p-2 rounded cursor-pointer text-xs group ${
                          selectedFloor === floor.id ? 'bg-emerald-500/20 border border-emerald-400' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div 
                          onClick={() => setSelectedFloor(floor.id)}
                          className="flex items-center justify-between"
                        >
                          <span>{floor.name} ({(floor.aisles || []).length} aisles)</span>
                          {activeMode === 'designer' && floors.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete ${floor.name}? This will remove all aisles on this floor.`)) {
                                  isLocalChangeRef.current = true;
                                  setFloors(prev => {
                                    const updatedFloors = prev.filter(f => f.id !== floor.id);
                                    saveToHistory(updatedFloors);
                                    // Don't auto-save - user must click Save button
                                    return updatedFloors;
                                  });
                                  if (selectedFloor === floor.id) {
                                    setSelectedFloor(floors.find(f => f.id !== floor.id)?.id || null);
                                  }
                                  toast.success(`${floor.name} removed. Click Save to persist changes.`);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 text-red-400 hover:text-red-300 text-xs ml-2"
                              title="Delete floor"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Aisle Management */}
              {selectedFloor && (() => {
                const floor = floors.find(f => f.id === selectedFloor);
                if (!floor) return null;
                return (
                  <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Aisles</h3>
                      <div className="flex gap-1">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addAisle(selectedFloor, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20"
                          defaultValue=""
                        >
                          <option value="">+ Category</option>
                          {STORE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!selectedFloor) {
                              toast.error('Please select a floor first');
                              return;
                            }
                            addAisle(selectedFloor);
                          }}
                          className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-xs cursor-pointer active:scale-95 transition-transform"
                          type="button"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(!floor.aisles || floor.aisles.length === 0) ? (
                        <div className="text-xs text-white/60 p-2">No aisles yet. Add one to get started.</div>
                      ) : (
                        floor.aisles.map(aisle => (
                          <div
                            key={aisle.id}
                            onClick={() => setSelectedAisle(aisle.id)}
                            className={`p-2 rounded cursor-pointer text-xs ${
                              selectedAisle === aisle.id ? 'bg-emerald-500/20 border border-emerald-400' : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div className="font-medium">{aisle.name}</div>
                            {aisle.category && (
                              <div className="text-[10px] text-white/60">{aisle.category}</div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!selectedFloor) {
                                    toast.error('Please select a floor first');
                                    return;
                                  }
                                  addRack(selectedFloor, aisle.id);
                                }}
                                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] cursor-pointer"
                                type="button"
                              >
                                + Rack
                              </button>
                              <span className="text-[10px] text-white/60">({(aisle.racks || []).length} racks)</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Rack/Shelf Management */}
              {selectedFloor && (() => {
                const floor = floors.find(f => f.id === selectedFloor);
                if (!floor || !floor.aisles || floor.aisles.length === 0) return null;
                
                const displayAisle = floor.aisles.find(a => a.id === selectedAisle) || floor.aisles[0];
                if (!displayAisle) return null;
                return (
                  <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold mb-2">Racks in {displayAisle.name}</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(!displayAisle.racks || displayAisle.racks.length === 0) ? (
                        <div className="text-xs text-white/60 p-2">No racks yet. Add racks to organize shelves.</div>
                      ) : (
                        displayAisle.racks.map(rack => (
                          <div key={rack.id} className="p-2 rounded bg-white/5 text-xs">
                            <div className="font-medium">{rack.name}</div>
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const count = prompt('How many shelves?', '4');
                                  if (count && !isNaN(parseInt(count))) {
                                    addShelf(selectedFloor, displayAisle.id, rack.id, parseInt(count));
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] cursor-pointer"
                                type="button"
                              >
                                + Shelf
                              </button>
                              <span className="text-[10px] text-white/60">({(rack.shelves || []).length} shelves)</span>
                            </div>
                            {(rack.shelves || []).map(shelf => (
                              <div key={shelf.id} className="ml-2 mt-1 p-1 rounded bg-black/20 text-[10px]">
                                <div>{shelf.name}</div>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const count = prompt('How many lanes?', '2');
                                    if (count && !isNaN(parseInt(count))) {
                                      addLane(selectedFloor, displayAisle.id, rack.id, shelf.id, parseInt(count));
                                    }
                                  }}
                                  className="px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] mt-0.5 cursor-pointer"
                                  type="button"
                                >
                                  + Lane
                                </button>
                                <span className="text-[9px] text-white/60 ml-1">
                                  ({(shelf.lanes || []).length} lanes, {(shelf.products || []).length} products)
                                </span>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}


              {/* Canvas Settings */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold mb-2">Settings</h3>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                    Show Grid
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
                    Snap to Grid
                  </label>
                  <div>
                    <label className="text-white/60 mb-1 block">Zoom: {Math.round(zoom * 100)}%</label>
                    <input
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-80 border-r border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
              <h3 className="text-sm font-semibold mb-4">👁️ Store View</h3>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Floors</div>
                  <div className="text-sm font-medium">{floors.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Total Aisles</div>
                  <div className="text-sm font-medium">
                    {floors.reduce((sum, f) => sum + (f.aisles || []).length, 0)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Total Products</div>
                  <div className="text-sm font-medium">{products.length}</div>
                </div>
                {floors.length > 0 && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-white/60 mb-2">Floors</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {floors.map(floor => (
                        <div key={floor.id} className="text-xs p-2 rounded bg-white/5">
                          <div className="font-medium">{floor.name}</div>
                          <div className="text-white/60">{(floor.aisles || []).length} aisles</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-400/30">
                  <div className="text-xs text-white/60 mb-1">💡 Tip</div>
                  <div className="text-xs text-white/80">
                    Switch to Design mode to edit the store layout
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Canvas */}
          <div className="flex-1 relative overflow-hidden bg-gray-900">
            {/* 3D View Mode */}
            {viewMode === '3d' && (
              <div className="absolute inset-0">
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-full text-white/60">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
                        <p>Loading 3D View...</p>
                      </div>
                    </div>
                  }>
                    <Store3DView
                      floors={floors}
                      selectedFloor={selectedFloor}
                      onFloorSelect={setSelectedFloor}
                      selectedAisle={selectedAisle}
                      onAisleSelect={setSelectedAisle}
                      viewMode={cameraMode}
                    />
                  </Suspense>
                </ErrorBoundary>
                {/* Camera Mode Switcher */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/60">Camera:</span>
                    <button
                      onClick={() => setCameraMode('orbit')}
                      className={`px-2 py-1 rounded text-xs ${cameraMode === 'orbit' ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      Orbit
                    </button>
                    <button
                      onClick={() => setCameraMode('first-person')}
                      className={`px-2 py-1 rounded text-xs ${cameraMode === 'first-person' ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      First Person
                    </button>
                    <button
                      onClick={() => setCameraMode('top-down')}
                      className={`px-2 py-1 rounded text-xs ${cameraMode === 'top-down' ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      Top Down
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            
            {/* 2D View Mode */}
            {viewMode === '2d' && (
            <div
              ref={canvasRef}
              className="absolute inset-0 overflow-auto"
              onDrop={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = (e.clientX - rect.left) / zoom - pan.x;
                const y = (e.clientY - rect.top) / zoom - pan.y;
                if (selectedFloor) {
                  handleElementDrop(e, selectedFloor, x, y);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
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

              {/* Store Layout */}
              <div
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'top left',
                  width: `${canvasSize.width}px`,
                  height: `${canvasSize.height}px`,
                  position: 'relative',
                }}
              >
                {renderHierarchicalView()}
              </div>
            </div>
            )}
          </div>

          {/* Product Palette */}
          {showProductPalette && (
            <div className="w-80 border-l border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
              <h3 className="text-sm font-semibold mb-2">Product Inventory</h3>
              <input
                type="text"
                placeholder="Search products..."
                value={searchProducts}
                onChange={(e) => setSearchProducts(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm mb-2"
              />
              <div className="space-y-2 max-h-[calc(96vh-200px)] overflow-y-auto">
                {(!products || products.length === 0) ? (
                  <div className="text-xs text-white/60 p-4 text-center">No products in inventory</div>
                ) : (
                  products
                    .filter(p => 
                      !searchProducts || 
                      p.productName?.toLowerCase().includes(searchProducts.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(searchProducts.toLowerCase())
                    )
                    .map(product => (
                      <div
                        key={product.id}
                        draggable
                        onDragStart={() => setDraggedProduct(product.id)}
                        onDragEnd={() => setDraggedProduct(null)}
                        className="p-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 cursor-move"
                      >
                        <div className="flex items-start gap-2">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.productName} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center">📦</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{product.productName}</div>
                            <div className="text-[10px] text-white/60">{product.sku}</div>
                            <div className={`inline-block px-1.5 py-0.5 rounded text-[10px] mt-1 ${getStockStatusColor(product.quantity)}`}>
                              {product.quantity} {product.unit}
                            </div>
                            {product.location && (
                              <div className="text-[10px] text-emerald-300 mt-0.5">📍 {product.location.fullPath || 'Placed'}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartStoreDesigner;

