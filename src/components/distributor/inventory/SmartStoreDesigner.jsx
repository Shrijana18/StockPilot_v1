import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import ErrorBoundary from './ErrorBoundary';

// Lazy load 3D components to prevent breaking the app if there are compatibility issues
const Store3DView = lazy(() => {
  return Promise.resolve(import('./Store3DView')).catch((error) => {
    console.error('Failed to load Store3DView:', error);
    // Return a simple fallback component
    return {
      default: ({ floors, selectedFloor, onFloorSelect, selectedAisle, onAisleSelect, viewMode }) => (
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
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-sm"
            >
              Refresh Page
            </button>
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
  
  // Element placement mode - tracks what element is being placed
  const [placementMode, setPlacementMode] = useState(null); // 'aisle', 'rack', 'shelf', null
  const [pendingElement, setPendingElement] = useState(null); // Stores element data waiting to be placed
  
  
  // Canvas & UI
  const [canvasSize, setCanvasSize] = useState({ width: 2000, height: 1500 });
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  
  // Store image upload for photo overlay design
  const [storeImageUrl, setStoreImageUrl] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [designMode, setDesignMode] = useState('hierarchical'); // 'hierarchical' or 'photo-overlay'
  
  // Products & Interaction
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [showProductPalette, setShowProductPalette] = useState(false);
  const [searchProducts, setSearchProducts] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  
  // Product placement state
  const [hoveredLocation, setHoveredLocation] = useState(null);
  const [placementPreview, setPlacementPreview] = useState(null);
  const [selectedProductForPlacement, setSelectedProductForPlacement] = useState(null);
  const [recentlyPlacedProducts, setRecentlyPlacedProducts] = useState(new Set()); // Track recently placed products for animation
  
  // View mode search
  const [viewSearchQuery, setViewSearchQuery] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null); // Product details modal
  
  // Resize state
  const [resizingElement, setResizingElement] = useState(null); // {type: 'aisle'|'rack'|'shelf', id: string, edge: 'se'|'sw'|'ne'|'nw'|'e'|'w'|'n'|'s'}
  const [resizeStartPos, setResizeStartPos] = useState(null);
  const [resizeStartSize, setResizeStartSize] = useState(null);
  
  // Canvas ref
  const canvasRef = useRef(null);
  
  // Virtualization for large product lists (10,000+ products)
  const [visibleProductRange, setVisibleProductRange] = useState({ start: 0, end: 50 });
  const PRODUCTS_PER_PAGE = 50;
  
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
              products: aisleProducts.map(p => ({
                id: p.id,
                name: p.productName || p.name,
                sku: p.sku,
                quantity: p.quantity || 0,
                imageUrl: p.imageUrl || p.image || null,
              })),
              racks: (aisle.racks || []).map(rack => {
                // Find products at rack level
                const rackProducts = productList.filter(p => 
                  p.location?.rack === rack.id ||
                  (p.location?.rack && typeof p.location.rack === 'string' && p.location.rack.includes(rack.id))
                );
                
                return {
                  ...rack,
                  products: rackProducts.map(p => ({
                    id: p.id,
                    name: p.productName || p.name,
                    sku: p.sku,
                    quantity: p.quantity || 0,
                    imageUrl: p.imageUrl || p.image || null,
                  })),
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
                        ).map(p => ({
                          id: p.id,
                          name: p.productName || p.name,
                          sku: p.sku,
                          quantity: p.quantity || 0,
                          imageUrl: p.imageUrl || p.image || null,
                        }));
                        return { ...lane, products: laneProducts };
                      }),
                      products: shelfProducts.map(p => ({
                        id: p.id,
                        name: p.productName || p.name,
                        sku: p.sku,
                        quantity: p.quantity || 0,
                        imageUrl: p.imageUrl || p.image || null,
                      })),
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
        if (data.storeImageUrl) {
          setStoreImageUrl(data.storeImageUrl);
          setDesignMode('photo-overlay');
        }
        
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
  // This ensures location changes from ViewInventory are reflected in the store design
  useEffect(() => {
    if (!userId) return;
    const productsRef = collection(db, 'businesses', userId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      // Update products in store structure
      const updatedProducts = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Ensure imageUrl is included
        imageUrl: doc.data().imageUrl || doc.data().image || null
      }));
      
      // Update products state to trigger re-render
      if (products !== updatedProducts) {
        // Only sync if we have floors loaded
        if (floors.length > 0) {
          syncProductsToLayout(updatedProducts);
        }
      }
    });
    return () => unsubscribe();
  }, [userId, floors.length, syncProductsToLayout]);
  
  // Also sync when products prop changes (from parent component)
  useEffect(() => {
    if (products && products.length > 0 && floors.length > 0) {
      syncProductsToLayout(products);
    }
  }, [products, floors.length, syncProductsToLayout]);

  // Handle store image upload
  const handleStoreImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size should be less than 10MB');
      return;
    }

    setImageUploading(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `storeLayouts/${userId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setStoreImageUrl(url);
      setDesignMode('photo-overlay');
      
      // Save image URL to layout
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      await setDoc(layoutRef, {
        storeImageUrl: url,
        updatedAt: Date.now(),
      }, { merge: true });
      
      toast.success('Store image uploaded! You can now design on it.');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const saveStoreLayout = async (floorsToSave = null, silent = false) => {
    try {
      // Ensure we're not receiving an event object
      let floorsToStore = floorsToSave;
      if (floorsToSave && typeof floorsToSave === 'object' && floorsToSave.preventDefault) {
        // This is an event object, ignore it
        floorsToStore = null;
      }
      floorsToStore = floorsToStore || floors;
      
      // Deep clone to avoid any React synthetic events or proxies
      const cleanFloors = JSON.parse(JSON.stringify(floorsToStore));
      
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      await setDoc(layoutRef, {
        floors: cleanFloors,
        storeImageUrl,
        canvasSize,
        designMode,
        updatedAt: Date.now(),
      }, { merge: true });
      
      // Mark that we've saved, so don't reload
      isLocalChangeRef.current = false;
      
      if (!silent) {
        toast.success('Store layout saved!');
      }
    } catch (error) {
      console.error('Error saving store layout:', error);
      if (!silent) {
        toast.error(`Failed to save layout: ${error.message}`);
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

  // Add Aisle to Floor - Auto-creates floor if none exists
  const addAisle = (floorId = null, category = null, x = null, y = null) => {
    try {
      // Auto-create floor if none exists
      let targetFloorId = floorId || selectedFloor;
      let currentFloors = floors;
      
      if (!targetFloorId || floors.length === 0) {
        const newFloor = {
          id: `floor_${Date.now()}`,
          name: 'Main Floor',
          aisles: [],
          x: 0,
          y: 0,
          width: canvasSize.width,
          height: canvasSize.height,
        };
        currentFloors = [...floors, newFloor];
        targetFloorId = newFloor.id;
        setSelectedFloor(targetFloorId);
        setFloors(currentFloors);
        toast.success('✅ Floor created automatically');
      }

      const floor = currentFloors.find(f => f.id === targetFloorId);
      if (!floor) {
        toast.error('Floor not found');
        return;
      }

      isLocalChangeRef.current = true;
      const aisleNumber = (floor.aisles || []).length + 1;
      const newAisle = {
        id: `aisle_${Date.now()}`,
        name: `Aisle ${String.fromCharCode(64 + aisleNumber)}${aisleNumber}`,
        category: category || '',
        racks: [],
        x: x !== null ? x : (100 + (aisleNumber - 1) * 250),
        y: y !== null ? y : 100,
        width: 200,
        height: 800,
        color: category ? getCategoryColorLocal(category) : '#a855f7',
        products: [],
      };

      setFloors(prevFloors => {
        const updatedFloors = prevFloors.map(f => 
          f.id === targetFloorId 
            ? { ...f, aisles: [...(f.aisles || []), newAisle] }
            : f
        );
        saveToHistory(updatedFloors);
        // Don't auto-save - user must click Save button
        return updatedFloors;
      });
      setSelectedAisle(newAisle.id);
      
      // Enable placement mode if x/y not provided
      if (x === null || y === null) {
        setPlacementMode('aisle');
        setPendingElement({ floorId: targetFloorId, category });
      } else {
        toast.success(`✅ ${newAisle.name} added`);
      }
    } catch (error) {
      console.error('Error adding aisle:', error);
      showCriticalNotification('Failed to add aisle');
      isLocalChangeRef.current = false;
    }
  };

  // Add Rack to Aisle - Auto-generates shelves and auto-creates floor/aisle if needed
  const addRack = (floorId = null, aisleId = null, autoShelves = true, x = null, y = null) => {
    try {
      // Auto-create floor if none exists
      let targetFloorId = floorId || selectedFloor;
      let currentFloors = floors;
      
      if (!targetFloorId || floors.length === 0) {
        const newFloor = {
          id: `floor_${Date.now()}`,
          name: 'Main Floor',
          aisles: [],
          x: 0,
          y: 0,
          width: canvasSize.width,
          height: canvasSize.height,
        };
        currentFloors = [...floors, newFloor];
        targetFloorId = newFloor.id;
        setSelectedFloor(targetFloorId);
        setFloors(currentFloors);
        toast.success('✅ Floor created automatically');
      }

      // Auto-create aisle if none exists
      let targetAisleId = aisleId || selectedAisle;
      let floor = currentFloors.find(f => f.id === targetFloorId);
      
      if (!targetAisleId || !floor || !floor.aisles || floor.aisles.length === 0) {
        const newAisle = {
          id: `aisle_${Date.now()}`,
          name: 'Aisle A1',
          category: '',
          racks: [],
          x: x !== null ? x : 100,
          y: y !== null ? y : 100,
          width: 200,
          height: 800,
          color: '#a855f7',
          products: [],
        };
        floor = { ...floor, aisles: [...(floor.aisles || []), newAisle] };
        currentFloors = currentFloors.map(f => f.id === targetFloorId ? floor : f);
        targetAisleId = newAisle.id;
        setSelectedAisle(targetAisleId);
        setFloors(currentFloors);
        toast.success('✅ Aisle created automatically');
      }

      const aisle = floor.aisles.find(a => a.id === targetAisleId);
      if (!aisle) {
        toast.error('Aisle not found');
        return;
      }

      const rackNumber = (aisle.racks || []).length + 1;
      const newRack = {
        id: `rack_${Date.now()}`,
        name: `Rack ${rackNumber}`,
        shelves: [],
        x: x !== null ? x : (aisle.x + 20 + (rackNumber - 1) * 60),
        y: y !== null ? y : (aisle.y + 50),
        width: 50,
        height: 200,
        products: [],
      };

      // Auto-generate 4 shelves when rack is created (Walmart-style efficiency)
      if (autoShelves) {
        const shelfCount = 4;
        const shelfHeight = (newRack.height - 20) / shelfCount;
        for (let i = 0; i < shelfCount; i++) {
          newRack.shelves.push({
            id: `shelf_${Date.now()}_${i}`,
            name: `Shelf ${i + 1}`,
            lanes: [],
            x: newRack.x,
            y: newRack.y + 10 + (i * shelfHeight),
            width: newRack.width,
            height: shelfHeight - 5,
            products: [],
          });
        }
      }

      isLocalChangeRef.current = true;
      const updatedFloors = currentFloors.map(f => 
        f.id === targetFloorId 
          ? { 
              ...f, 
              aisles: (f.aisles || []).map(a => 
                a.id === targetAisleId 
                  ? { ...a, racks: [...(a.racks || []), newRack] }
                  : a
              )
            }
          : f
      );
      setFloors(updatedFloors);
      saveToHistory(updatedFloors);
      
      // Enable placement mode if x/y not provided
      if (x === null || y === null) {
        setPlacementMode('rack');
        setPendingElement({ floorId: targetFloorId, aisleId: targetAisleId });
      } else {
        toast.success(`✅ Rack "${newRack.name}" created${autoShelves ? ' with 4 shelves' : ''}!`);
      }
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

  // Remove product from location
  const removeProductFromLocation = async (productId) => {
    try {
      const productRef = doc(db, 'businesses', userId, 'products', productId);
      await updateDoc(productRef, { 
        location: null 
      });
      
      // Refresh products
      const productsRef = collection(db, 'businesses', userId, 'products');
      const snapshot = await getDocs(productsRef);
      const updatedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      syncProductsToLayout(updatedProducts);
      
      toast.success('Product location removed!');
    } catch (error) {
      console.error('Error removing location:', error);
      toast.error('Failed to remove location');
    }
  };

  // Change product location
  const changeProductLocation = async (productId, newLocationPath) => {
    await handleDropProduct(null, newLocationPath, productId);
  };

  // Drop product onto location - Enhanced with direct placement
  const handleDropProduct = async (e, locationPath, productIdOverride = null) => {
    if (e) {
    e.preventDefault();
      e.stopPropagation();
    }
    
    const productId = productIdOverride || draggedProduct;
    if (!productId) {
      console.log('No product ID available for drop');
      return;
    }

    const productList = products || [];
    const product = productList.find(p => p.id === productId);
    if (!product) {
      console.log('Product not found:', productId);
      return;
    }

    if (!locationPath) {
      console.log('No location path provided');
      return;
    }

    const [floorId, aisleId, rackId, shelfId, laneId] = locationPath.split('/');
    
    // Determine location type for better feedback
    let locationType = 'Floor';
    let locationName = '';
    if (laneId) {
      locationType = 'Lane';
      const floor = floors.find(f => f.id === floorId);
      const aisle = floor?.aisles?.find(a => a.id === aisleId);
      const rack = aisle?.racks?.find(r => r.id === rackId);
      const shelf = rack?.shelves?.find(s => s.id === shelfId);
      const lane = shelf?.lanes?.find(l => l.id === laneId);
      locationName = lane?.name || 'Lane';
    } else if (shelfId) {
      locationType = 'Shelf';
      const floor = floors.find(f => f.id === floorId);
      const aisle = floor?.aisles?.find(a => a.id === aisleId);
      const rack = aisle?.racks?.find(r => r.id === rackId);
      const shelf = rack?.shelves?.find(s => s.id === shelfId);
      locationName = shelf?.name || 'Shelf';
    } else if (rackId) {
      locationType = 'Rack';
      const floor = floors.find(f => f.id === floorId);
      const aisle = floor?.aisles?.find(a => a.id === aisleId);
      const rack = aisle?.racks?.find(r => r.id === rackId);
      locationName = rack?.name || 'Rack';
    } else if (aisleId) {
      locationType = 'Aisle';
      const floor = floors.find(f => f.id === floorId);
      const aisle = floor?.aisles?.find(a => a.id === aisleId);
      locationName = aisle?.name || 'Aisle';
    } else {
      const floor = floors.find(f => f.id === floorId);
      locationName = floor?.name || 'Floor';
    }
    
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
      
      toast.success(`✅ ${product.productName} placed at ${locationType}: ${locationName} (${location.fullPath})`);
      
      // Add to recently placed for animation effect
      setRecentlyPlacedProducts(prev => new Set([...prev, product.id]));
      setTimeout(() => {
        setRecentlyPlacedProducts(prev => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 2000);
    } catch (error) {
      console.error('Error syncing location:', error);
      toast.error('Failed to sync location');
    }

    setDraggedProduct(null);
    setPlacementPreview(null);
    setHoveredLocation(null);
    // Note: floors state is updated above, so we use current floors
    saveToHistory(updatedFloors);
  };

  // Handle drag over for visual feedback
  const handleDragOverLocation = useCallback((e, locationPath) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredLocation(locationPath);
    
    if (draggedProduct) {
      const product = products.find(p => p.id === draggedProduct);
      if (product) {
        setPlacementPreview({
          product,
          locationPath,
        });
      }
    }
  }, [draggedProduct, products]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setHoveredLocation(null);
    setPlacementPreview(null);
  }, []);

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
        className={`absolute border-2 rounded-xl transition-all duration-300 ${
          selectedFloor === floor.id 
            ? 'border-emerald-400 bg-emerald-500/10 shadow-2xl shadow-emerald-500/30' 
            : 'border-dashed border-white/20 bg-white/5'
        }`}
        style={{ 
          left: `${floor.x}px`, 
          top: `${floor.y}px`,
          width: `${Math.max(floor.width, 400)}px`,
          height: `${Math.max(floor.height, 300)}px`,
          boxShadow: selectedFloor === floor.id 
            ? '0 0 40px rgba(16, 185, 129, 0.4), 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 2px 0 rgba(255, 255, 255, 0.1)'
            : '0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          transformStyle: 'preserve-3d',
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
              className="absolute border-2 rounded-lg transition-all duration-300 group"
              style={{
                left: `${aisle.x}px`,
                top: `${aisle.y}px`,
                width: `${aisle.width}px`,
                height: `${aisle.height}px`,
                borderColor: aisle.color,
                backgroundColor: `${aisle.color}15`,
                cursor: activeMode === 'designer' ? 'move' : 'default',
                boxShadow: `
                  ${hoveredLocation === `${currentFloorId}/${aisle.id}` ? '0 0 30px rgba(16, 185, 129, 0.6),' : ''}
                  0 4px 20px rgba(0, 0, 0, 0.3),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1),
                  inset 0 -2px 10px rgba(0, 0, 0, 0.2)
                `,
                transform: hoveredLocation === `${currentFloorId}/${aisle.id}` ? 'scale(1.02) translateY(-2px)' : 'scale(1)',
                transformStyle: 'preserve-3d',
                perspective: '1000px',
              }}
              draggable={activeMode === 'designer'}
              onDragStart={(e) => handleElementDragStart(e, 'aisle', aisle.id)}
              onDrop={activeMode === 'designer' && draggedProduct ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDropProduct(e, `${currentFloorId}/${aisle.id}`);
              } : undefined}
              onDragOver={activeMode === 'designer' && draggedProduct ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragOverLocation(e, `${currentFloorId}/${aisle.id}`);
              } : undefined}
              onDragLeave={activeMode === 'designer' ? handleDragLeave : undefined}
              onClick={activeMode === 'designer' ? () => setSelectedAisle(aisle.id) : undefined}
            >
              {/* Aisle Header - Enhanced with depth */}
              <div 
                className="absolute top-0 left-0 right-0 p-2 rounded-t-lg backdrop-blur-sm"
                style={{
                  background: `linear-gradient(135deg, ${aisle.color}40 0%, ${aisle.color}20 50%, rgba(0,0,0,0.8) 100%)`,
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  borderBottom: `2px solid ${aisle.color}60`,
                }}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span className="text-white drop-shadow-lg">{aisle.name}</span>
                  <div className="flex items-center gap-1">
                    {hoveredLocation === `${currentFloorId}/${aisle.id}` && draggedProduct && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500 animate-pulse">
                        📍 Drop here (Aisle)
                      </span>
                    )}
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
              
              {/* Products on Aisle - Enhanced visualization */}
              {aisle.products && aisle.products.length > 0 && (
                <div className="absolute top-10 left-0 right-0 p-2 flex gap-2 overflow-x-auto">
                  {aisle.products.slice(0, 8).map((product, idx) => (
                    <div
                      key={product.id}
                      className="relative flex-shrink-0 group/product"
                      style={{
                        animation: `fadeInUp 0.3s ease-out ${idx * 0.05}s both`,
                      }}
                      title={`${product.name} - Qty: ${product.quantity}`}
                    >
                      <div 
                        className="relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-110 hover:z-10"
                        style={{
                          width: '48px',
                          height: '48px',
                          boxShadow: `
                            0 4px 12px rgba(0, 0, 0, 0.4),
                            0 2px 4px rgba(0, 0, 0, 0.2),
                            inset 0 1px 0 rgba(255, 255, 255, 0.2)
                          `,
                          transform: 'translateZ(10px)',
                        }}
                      >
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover cursor-pointer"
                          style={{
                            filter: 'brightness(1.1) contrast(1.05)',
                          }}
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const fullProduct = products.find(p => p.id === product.id);
                            if (fullProduct) {
                              setSelectedProductDetails(fullProduct);
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full bg-gradient-to-br from-white/20 to-white/5 rounded-lg flex items-center justify-center text-lg cursor-pointer ${product.imageUrl ? 'hidden' : ''}`}
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const fullProduct = products.find(p => p.id === product.id);
                          if (fullProduct) {
                            setSelectedProductDetails(fullProduct);
                          }
                        }}
                      >
                        📦
                      </div>
                      {/* Success animation when product is placed */}
                      {recentlyPlacedProducts.has(product.id) && (
                        <div 
                          className="absolute inset-0 rounded-lg pointer-events-none"
                          style={{
                            animation: 'pulseGlow 1s ease-out',
                            boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)',
                          }}
                        />
                      )}
                        {/* Stock status indicator */}
                        <div 
                          className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white/80 ${getStockStatusColor(product.quantity)}`}
                          style={{
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                          }}
                        />
                        {/* Hover effect */}
                        <div className="absolute inset-0 bg-emerald-500/0 group-hover/product:bg-emerald-500/20 transition-all duration-300 rounded-lg" />
                      </div>
                      {/* Product name tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover/product:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-xl border border-white/20">
                          {product.name}
                          <div className="text-[9px] text-white/70 mt-0.5">Qty: {product.quantity}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {aisle.products.length > 6 && (
                    <div className="flex-shrink-0 p-1 rounded bg-emerald-500/20 text-[8px] text-center text-emerald-300 flex items-center">
                      +{aisle.products.length - 6}
                    </div>
                  )}
                </div>
              )}

              {/* Racks */}
              <div className="absolute top-10 left-0 right-0 bottom-0 p-2 overflow-y-auto">
                {(aisle.racks || []).map(rack => {
                  // Filter rack by search in view mode
                  const rackProducts = rack.products || [];
                  const rackMatchesSearch = !viewSearchQuery || 
                    rack.name?.toLowerCase().includes(viewSearchQuery.toLowerCase()) ||
                    rackProducts.some(p => p.name?.toLowerCase().includes(viewSearchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(viewSearchQuery.toLowerCase()));
                  
                  if (activeMode === 'viewer' && !rackMatchesSearch) return null;
                  
                  return (
                  <div
                    key={rack.id}
                    className="absolute border-2 transition-all duration-300 group/rack"
                    style={{
                      left: `${rack.x - aisle.x}px`,
                      top: `${rack.y - aisle.y}px`,
                      width: `${rack.width}px`,
                      height: `${rack.height}px`,
                      borderColor: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}` ? '#10b981' : 'rgba(255, 255, 255, 0.3)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      boxShadow: `
                        ${hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}` ? '0 0 25px rgba(16, 185, 129, 0.5),' : ''}
                        0 3px 15px rgba(0, 0, 0, 0.25),
                        inset 0 1px 0 rgba(255, 255, 255, 0.15),
                        inset 0 -2px 8px rgba(0, 0, 0, 0.15)
                      `,
                      transform: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}` ? 'scale(1.05) translateY(-1px)' : 'scale(1)',
                      transformStyle: 'preserve-3d',
                      opacity: activeMode === 'viewer' && viewSearchQuery && !rackMatchesSearch ? 0.3 : 1,
                    }}
                    onDrop={activeMode === 'designer' && draggedProduct ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropProduct(e, `${currentFloorId}/${aisle.id}/${rack.id}`);
                    } : undefined}
                    onDragOver={activeMode === 'designer' && draggedProduct ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDragOverLocation(e, `${currentFloorId}/${aisle.id}/${rack.id}`);
                    } : undefined}
                    onDragLeave={activeMode === 'designer' ? handleDragLeave : undefined}
                  >
                    {/* Resize Handles for Rack */}
                    {activeMode === 'designer' && (
                      <>
                        <div
                          className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize bg-blue-500/80 hover:bg-blue-500 border border-white rounded-tl z-50"
                          style={{ transform: 'translate(50%, 50%)' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizingElement({ type: 'rack', id: rack.id, aisleId: aisle.id, floorId: currentFloorId, edge: 'se' });
                            setResizeStartPos({ x: e.clientX, y: e.clientY });
                            setResizeStartSize({ width: rack.width, height: rack.height });
                          }}
                          title="Resize rack"
                        />
                      </>
                    )}
                    <div 
                      className="absolute top-0 left-0 right-0 p-1.5 text-[10px] text-center font-semibold backdrop-blur-sm"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      <span className="text-white drop-shadow-md">{rack.name}</span>
                      {hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}` && draggedProduct && (
                        <span className="ml-2 text-emerald-300 animate-pulse font-bold">📍 Drop (Rack)</span>
                      )}
                    </div>
                    
                    {/* Products on Rack - Enhanced with realistic appearance */}
                    {rack.products && rack.products.length > 0 && (
                      <div className="absolute top-8 left-0 right-0 p-2 grid grid-cols-2 gap-1.5">
                        {rack.products.slice(0, 4).map((product, idx) => (
                          <div
                            key={product.id}
                            className="relative group/product-rack"
                            style={{
                              animation: `fadeInScale 0.4s ease-out ${idx * 0.1}s both`,
                            }}
                            title={`${product.name} - Qty: ${product.quantity}`}
                          >
                            <div 
                              className="relative rounded-md overflow-hidden transition-all duration-300 hover:scale-110 hover:z-10"
                              style={{
                                height: '40px',
                                boxShadow: `
                                  0 3px 10px rgba(0, 0, 0, 0.35),
                                  0 1px 3px rgba(0, 0, 0, 0.2),
                                  inset 0 1px 0 rgba(255, 255, 255, 0.15)
                                `,
                                transform: 'translateZ(8px)',
                              }}
                            >
                              {product.imageUrl ? (
                                <img 
                                  src={product.imageUrl} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover cursor-pointer"
                                  style={{
                                    filter: 'brightness(1.15) contrast(1.1) saturate(1.1)',
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const fullProduct = products.find(p => p.id === product.id);
                                    if (fullProduct) {
                                      setSelectedProductDetails(fullProduct);
                                    }
                                  }}
                                />
                              ) : null}
                              <div 
                                className={`w-full h-full bg-gradient-to-br from-white/25 to-white/8 rounded-md flex items-center justify-center text-sm cursor-pointer ${product.imageUrl ? 'hidden' : ''}`}
                                style={{
                                  background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const fullProduct = products.find(p => p.id === product.id);
                                  if (fullProduct) {
                                    setSelectedProductDetails(fullProduct);
                                  }
                                }}
                              >
                                📦
                              </div>
                              {/* Success animation */}
                              {recentlyPlacedProducts.has(product.id) && (
                                <div 
                                  className="absolute inset-0 rounded-md pointer-events-none"
                                  style={{
                                    animation: 'pulseGlow 1s ease-out',
                                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.7)',
                                  }}
                                />
                              )}
                              {/* Stock status with glow */}
                              <div 
                                className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white/90 ${getStockStatusColor(product.quantity)}`}
                                style={{
                                  boxShadow: `0 0 8px ${getStockStatusColor(product.quantity) === 'bg-red-500' ? 'rgba(239, 68, 68, 0.6)' : getStockStatusColor(product.quantity) === 'bg-yellow-500' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(16, 185, 129, 0.6)'}`,
                                }}
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-emerald-500/0 group-hover/product-rack:bg-emerald-500/25 transition-all duration-300" />
                            </div>
                          </div>
                        ))}
                        {rack.products.length > 4 && (
                          <div className="p-0.5 rounded bg-emerald-500/20 text-[8px] text-center text-emerald-300">
                            +{rack.products.length - 4}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Shelves */}
                    {(rack.shelves || []).map(shelf => {
                      // Filter shelf by search in view mode
                      const shelfProducts = (shelf.products || []).concat(
                        ...(shelf.lanes || []).flatMap(lane => lane.products || [])
                      );
                      const shelfMatchesSearch = !viewSearchQuery || 
                        shelf.name?.toLowerCase().includes(viewSearchQuery.toLowerCase()) ||
                        shelfProducts.some(p => p.name?.toLowerCase().includes(viewSearchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(viewSearchQuery.toLowerCase()));
                      
                      if (activeMode === 'viewer' && !shelfMatchesSearch) return null;
                      
                      return (
                      <div
                        key={shelf.id}
                        className="absolute border-t-2 transition-all duration-300 group/shelf"
                        style={{
                          left: '0px',
                          top: `${shelf.y - rack.y}px`,
                          width: '100%',
                          height: `${shelf.height}px`,
                          borderColor: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}` ? '#10b981' : 'rgba(255, 255, 255, 0.25)',
                          backgroundColor: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}` 
                            ? 'rgba(16, 185, 129, 0.15)' 
                            : 'rgba(255, 255, 255, 0.06)',
                          boxShadow: `
                            ${hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}` ? '0 0 15px rgba(16, 185, 129, 0.4),' : ''}
                            inset 0 1px 0 rgba(255, 255, 255, 0.1),
                            inset 0 -1px 5px rgba(0, 0, 0, 0.1)
                          `,
                          transform: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}` ? 'translateY(-1px)' : 'translateY(0)',
                          opacity: activeMode === 'viewer' && viewSearchQuery && !shelfMatchesSearch ? 0.3 : 1,
                        }}
                        onDrop={activeMode === 'designer' && draggedProduct ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDropProduct(e, `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}`);
                        } : undefined}
                        onDragOver={activeMode === 'designer' && draggedProduct ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDragOverLocation(e, `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}`);
                        } : undefined}
                        onDragLeave={activeMode === 'designer' ? handleDragLeave : undefined}
                      >
                        {/* Resize Handle for Shelf Height */}
                        {activeMode === 'designer' && (
                          <div
                            className="absolute bottom-0 right-2 w-6 h-2 cursor-ns-resize bg-purple-500/80 hover:bg-purple-500 border border-white rounded-t z-50"
                            style={{ transform: 'translateY(50%)' }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setResizingElement({ type: 'shelf', id: shelf.id, rackId: rack.id, aisleId: aisle.id, floorId: currentFloorId, edge: 's' });
                              setResizeStartPos({ x: e.clientX, y: e.clientY });
                              setResizeStartSize({ width: shelf.width, height: shelf.height });
                            }}
                            title="Resize shelf height"
                          />
                        )}
                        {/* Product Lanes - Enhanced with depth */}
                        {(shelf.lanes || []).map(lane => (
                          <div
                            key={lane.id}
                            className="absolute border-l-2 transition-all duration-300"
                            style={{
                              left: `${lane.x - shelf.x}px`,
                              top: '0px',
                              width: `${lane.width}px`,
                              height: '100%',
                              borderColor: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}` 
                                ? '#10b981' 
                                : 'rgba(255, 255, 255, 0.15)',
                              backgroundColor: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}` 
                                ? 'rgba(16, 185, 129, 0.15)' 
                                : 'rgba(255, 255, 255, 0.03)',
                              boxShadow: hoveredLocation === `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}`
                                ? '0 0 12px rgba(16, 185, 129, 0.4), inset 0 0 10px rgba(16, 185, 129, 0.1)'
                                : 'inset 0 0 5px rgba(0, 0, 0, 0.1)',
                            }}
                            onDrop={activeMode === 'designer' && draggedProduct ? (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDropProduct(e, `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}`);
                            } : undefined}
                            onDragOver={activeMode === 'designer' && draggedProduct ? (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDragOverLocation(e, `${currentFloorId}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}`);
                            } : undefined}
                            onDragLeave={activeMode === 'designer' ? handleDragLeave : undefined}
                          >
                            {/* Products in Lane - Enhanced visualization */}
                            <div className="p-1 space-y-1">
                              {(lane.products || []).map((product, idx) => (
                                <div
                                  key={product.id}
                                  className="relative group/product-lane"
                                  style={{
                                    animation: `slideInLeft 0.3s ease-out ${idx * 0.05}s both`,
                                  }}
                                  title={`${product.name} - Qty: ${product.quantity}`}
                                >
                                  <div 
                                    className="relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:z-10"
                                    style={{
                                      height: '36px',
                                      boxShadow: `
                                        0 2px 8px rgba(0, 0, 0, 0.3),
                                        0 1px 2px rgba(0, 0, 0, 0.2),
                                        inset 0 1px 0 rgba(255, 255, 255, 0.2)
                                      `,
                                    }}
                                  >
                                    {product.imageUrl ? (
                                      <img 
                                        src={product.imageUrl} 
                                        alt={product.name} 
                                        className="w-full h-full object-cover cursor-pointer"
                                        style={{
                                          filter: 'brightness(1.2) contrast(1.15)',
                                        }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextElementSibling.style.display = 'flex';
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const fullProduct = products.find(p => p.id === product.id);
                                          if (fullProduct) {
                                            setSelectedProductDetails(fullProduct);
                                          }
                                        }}
                                      />
                                    ) : null}
                                    <div 
                                      className={`w-full h-full bg-gradient-to-br from-white/20 to-white/5 rounded-lg flex items-center justify-center text-xs cursor-pointer ${product.imageUrl ? 'hidden' : ''}`}
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)',
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const fullProduct = products.find(p => p.id === product.id);
                                        if (fullProduct) {
                                          setSelectedProductDetails(fullProduct);
                                        }
                                      }}
                                    >
                                      📦
                                    </div>
                                    {/* Success animation */}
                                    {recentlyPlacedProducts.has(product.id) && (
                                      <div 
                                        className="absolute inset-0 rounded-lg pointer-events-none"
                                        style={{
                                          animation: 'pulseGlow 1s ease-out',
                                          boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)',
                                        }}
                                      />
                                    )}
                                    {/* Stock status */}
                                    <div 
                                      className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-white/80 ${getStockStatusColor(product.quantity)}`}
                                      style={{
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                                      }}
                                    />
                                    {/* Hover effect */}
                                    <div className="absolute inset-0 bg-emerald-500/0 group-hover/product-lane:bg-emerald-500/20 transition-all duration-300" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Products on Shelf (if no lanes) - Enhanced visualization */}
                        {(!shelf.lanes || shelf.lanes.length === 0) && shelf.products && shelf.products.length > 0 && (
                          <div className="p-2 grid grid-cols-2 gap-1.5">
                            {shelf.products.map((product, idx) => (
                              <div
                                key={product.id}
                                className="relative group/product-shelf"
                                style={{
                                  animation: `fadeInScale 0.4s ease-out ${idx * 0.08}s both`,
                                }}
                                title={`${product.name} - Qty: ${product.quantity}`}
                              >
                                <div 
                                  className="relative rounded-md overflow-hidden transition-all duration-300 hover:scale-110 hover:z-10"
                                  style={{
                                    height: '38px',
                                    boxShadow: `
                                      0 3px 10px rgba(0, 0, 0, 0.35),
                                      0 1px 3px rgba(0, 0, 0, 0.2),
                                      inset 0 1px 0 rgba(255, 255, 255, 0.15)
                                    `,
                                    transform: 'translateZ(8px)',
                                  }}
                                >
                              {product.imageUrl ? (
                                <img 
                                  src={product.imageUrl} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover cursor-pointer"
                                  style={{
                                    filter: 'brightness(1.15) contrast(1.1) saturate(1.1)',
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const fullProduct = products.find(p => p.id === product.id);
                                    if (fullProduct) {
                                      setSelectedProductDetails(fullProduct);
                                    }
                                  }}
                                />
                              ) : null}
                              <div 
                                className={`w-full h-full bg-gradient-to-br from-white/25 to-white/8 rounded-md flex items-center justify-center text-xs cursor-pointer ${product.imageUrl ? 'hidden' : ''}`}
                                style={{
                                  background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const fullProduct = products.find(p => p.id === product.id);
                                  if (fullProduct) {
                                    setSelectedProductDetails(fullProduct);
                                  }
                                }}
                              >
                                📦
                              </div>
                              {/* Success animation */}
                              {recentlyPlacedProducts.has(product.id) && (
                                <div 
                                  className="absolute inset-0 rounded-md pointer-events-none"
                                  style={{
                                    animation: 'pulseGlow 1s ease-out',
                                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.7)',
                                  }}
                                />
                              )}
                                  {/* Stock status with glow */}
                                  <div 
                                    className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white/90 ${getStockStatusColor(product.quantity)}`}
                                    style={{
                                      boxShadow: `0 0 6px ${getStockStatusColor(product.quantity) === 'bg-red-500' ? 'rgba(239, 68, 68, 0.5)' : getStockStatusColor(product.quantity) === 'bg-yellow-500' ? 'rgba(245, 158, 11, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
                                    }}
                                  />
                                  {/* Hover overlay */}
                                  <div className="absolute inset-0 bg-emerald-500/0 group-hover/product-shelf:bg-emerald-500/25 transition-all duration-300" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  );
                })}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                saveStoreLayout();
              }}
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
                          <div key={rack.id} className="p-2 rounded bg-white/5 text-xs group">
                            <div className="flex items-center justify-between">
                            <div className="font-medium">{rack.name}</div>
                              {activeMode === 'designer' && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (window.confirm(`Delete ${rack.name}? This will remove all shelves and products in this rack.`)) {
                                      isLocalChangeRef.current = true;
                                      setFloors(prev => {
                                        const updatedFloors = prev.map(f => 
                                          f.id === selectedFloor 
                                            ? { 
                                                ...f, 
                                                aisles: (f.aisles || []).map(a => 
                                                  a.id === displayAisle.id 
                                                    ? { ...a, racks: (a.racks || []).filter(r => r.id !== rack.id) }
                                                    : a
                                                )
                                              }
                                            : f
                                        );
                                        saveToHistory(updatedFloors);
                                        return updatedFloors;
                                      });
                                      toast.success(`${rack.name} removed. Click Save to persist changes.`);
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 text-red-400 hover:text-red-300 text-xs"
                                  title="Delete rack"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
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
                              <div key={shelf.id} className="ml-2 mt-1 p-1 rounded bg-black/20 text-[10px] group/shelf">
                                <div className="flex items-center justify-between">
                                <div>{shelf.name}</div>
                                  {activeMode === 'designer' && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (window.confirm(`Delete ${shelf.name}? This will remove all lanes and products on this shelf.`)) {
                                          isLocalChangeRef.current = true;
                                          setFloors(prev => {
                                            const updatedFloors = prev.map(f => 
                                              f.id === selectedFloor 
                                                ? { 
                                                    ...f, 
                                                    aisles: (f.aisles || []).map(a => 
                                                      a.id === displayAisle.id 
                                                        ? { 
                                                            ...a, 
                                                            racks: (a.racks || []).map(r => 
                                                              r.id === rack.id 
                                                                ? { ...r, shelves: (r.shelves || []).filter(s => s.id !== shelf.id) }
                                                                : r
                                                            )
                                                          }
                                                        : a
                                                    )
                                                  }
                                                : f
                                            );
                                            saveToHistory(updatedFloors);
                                            return updatedFloors;
                                          });
                                          toast.success(`${shelf.name} removed. Click Save to persist changes.`);
                                        }
                                      }}
                                      className="opacity-0 group-hover/shelf:opacity-100 transition-opacity px-1 py-0.5 text-red-400 hover:text-red-300 text-[9px]"
                                      title="Delete shelf"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
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


              {/* Store Image Upload */}
                <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-400/30">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  📷 Store Photo
                </h3>
                {storeImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <img 
                        src={storeImageUrl} 
                        alt="Store layout" 
                        className="w-full h-32 object-cover rounded-lg border border-white/20"
                      />
                    <button
                      onClick={() => {
                          setStoreImageUrl(null);
                          setDesignMode('hierarchical');
                          toast.info('Store image removed');
                      }}
                        className="absolute top-1 right-1 px-2 py-1 rounded bg-red-500/80 hover:bg-red-500 text-xs"
                    >
                        ✕
                    </button>
                    </div>
                    <div className="flex gap-2">
                    <button
                        onClick={() => setDesignMode('photo-overlay')}
                        className={`flex-1 px-2 py-1 rounded text-xs ${
                          designMode === 'photo-overlay' 
                            ? 'bg-emerald-500' 
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        Design on Photo
                    </button>
                      <button
                        onClick={() => setDesignMode('hierarchical')}
                        className={`flex-1 px-2 py-1 rounded text-xs ${
                          designMode === 'hierarchical' 
                            ? 'bg-emerald-500' 
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        Grid View
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block w-full">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStoreImageUpload}
                        disabled={imageUploading}
                        className="hidden"
                        id="store-image-upload"
                      />
                      <div className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 cursor-pointer text-center text-xs transition-all">
                        {imageUploading ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin">⏳</span>
                            Uploading...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            📤 Upload Store Photo
                          </span>
                    )}
                  </div>
                    </label>
                    <p className="text-[10px] text-white/50 mt-1 text-center">
                      Upload your store image to design on it
                    </p>
                </div>
              )}
              </div>

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
              
              {/* Search in View Mode */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Search products, aisles, racks..."
                  value={viewSearchQuery}
                  onChange={(e) => setViewSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
                {viewSearchQuery && (
                  <button
                    onClick={() => setViewSearchQuery('')}
                    className="mt-1 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Clear search
                  </button>
                )}
              </div>
              
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
                      searchQuery={productSearchQuery}
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
              onClick={(e) => {
                // Don't trigger if clicking on an element (aisle, rack, etc.)
                if (e.target.closest('.absolute.border-2') || e.target.closest('.absolute.border')) {
                  return;
                }
                
                // Click to place elements on canvas
                if (placementMode && pendingElement) {
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const x = (e.clientX - rect.left) / zoom - pan.x;
                  const y = (e.clientY - rect.top) / zoom - pan.y;
                  
                  if (placementMode === 'aisle') {
                    addAisle(pendingElement.floorId, pendingElement.category, x, y);
                  } else if (placementMode === 'rack') {
                    addRack(pendingElement.floorId, pendingElement.aisleId, true, x, y);
                  }
                  
                  setPlacementMode(null);
                  setPendingElement(null);
                  toast.success('✅ Element placed!');
                }
              }}
              style={{
                cursor: placementMode ? 'crosshair' : 'default',
                backgroundImage: designMode === 'photo-overlay' && storeImageUrl 
                  ? `url(${storeImageUrl})` 
                  : designMode === 'hierarchical'
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.95) 100%)'
                  : 'none',
                backgroundSize: designMode === 'photo-overlay' && storeImageUrl 
                  ? 'contain' 
                  : 'auto',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: designMode === 'photo-overlay' && storeImageUrl 
                  ? '#0a0a0a' 
                  : designMode === 'hierarchical'
                  ? 'transparent'
                  : 'transparent',
                position: 'relative',
              }}
            >
              {/* Ambient lighting effect for immersive feel */}
              {designMode === 'hierarchical' && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `
                      radial-gradient(circle at 20% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%)
                    `,
                    mixBlendMode: 'screen',
                  }}
                />
              )}
              {/* Placement Mode Indicator */}
              {placementMode && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-500/90 text-white px-4 py-2 rounded-lg shadow-xl border-2 border-emerald-300 flex items-center gap-3">
                  <div>
                    <div className="text-sm font-semibold">📍 Click on canvas to place {placementMode}</div>
                    <div className="text-xs opacity-90 mt-1">Or click Cancel to abort</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlacementMode(null);
                      setPendingElement(null);
                      toast.info('Placement cancelled');
                    }}
                    className="px-3 py-1 bg-red-500/80 hover:bg-red-500 rounded text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {/* Grid - only show if not in photo overlay mode or if explicitly enabled */}
              {showGrid && (!storeImageUrl || designMode === 'hierarchical') && (
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
                
                {/* Photo Overlay Mode - Direct Product Placement */}
                {designMode === 'photo-overlay' && storeImageUrl && draggedProduct && (
                  <div className="absolute inset-0 pointer-events-none z-40">
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500/90 text-white px-4 py-2 rounded-lg shadow-xl border-2 border-emerald-300">
                      <div className="text-sm font-semibold">📦 Drag product and drop on any location</div>
                      <div className="text-xs opacity-90 mt-1">Aisle • Rack • Shelf • Lane</div>
                    </div>
                  </div>
                )}
                
                {/* Placement Preview Overlay */}
                {placementPreview && draggedProduct && (
                  <div 
                    className="fixed pointer-events-none z-50 bg-emerald-500/90 text-white px-3 py-2 rounded-lg shadow-xl border-2 border-emerald-300"
                            style={{
                      left: `${placementPreview.mouseX || 0}px`,
                      top: `${placementPreview.mouseY || 0}px`,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="text-xs font-semibold">Place {placementPreview.product.productName}</div>
                    <div className="text-[10px] opacity-90">Drop to place here</div>
                          </div>
                        )}
              </div>
            </div>
            )}
          </div>

          {/* Product Palette - Optimized for 10,000+ products */}
          {showProductPalette && (
            <div className="w-80 border-l border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Product Inventory</h3>
                <span className="text-xs text-white/60">{products.length.toLocaleString()} products</span>
              </div>
              <input
                type="text"
                placeholder="Search products..."
                value={searchProducts}
                onChange={(e) => {
                  setSearchProducts(e.target.value);
                  setVisibleProductRange({ start: 0, end: PRODUCTS_PER_PAGE });
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm mb-2"
              />
              
              {/* Virtualized product list for performance */}
              <div className="space-y-2 max-h-[calc(96vh-200px)] overflow-y-auto"
                onScroll={(e) => {
                  const target = e.target;
                  const scrollTop = target.scrollTop;
                  const itemHeight = 80; // Approximate height per product
                  const start = Math.floor(scrollTop / itemHeight);
                  const end = start + PRODUCTS_PER_PAGE;
                  setVisibleProductRange({ start, end });
                }}
              >
                {(!products || products.length === 0) ? (
                  <div className="text-xs text-white/60 p-4 text-center">No products in inventory</div>
                ) : (() => {
                  const filteredProducts = products.filter(p => 
                      !searchProducts || 
                      p.productName?.toLowerCase().includes(searchProducts.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(searchProducts.toLowerCase())
                  );
                  
                  // Virtualization: only render visible products
                  const visibleProducts = filteredProducts.slice(
                    visibleProductRange.start,
                    Math.min(visibleProductRange.end, filteredProducts.length)
                  );
                  
                  return (
                    <>
                      {visibleProducts.map(product => (
                      <div
                        key={product.id}
                          draggable={activeMode === 'designer'}
                          onDragStart={(e) => {
                            if (activeMode === 'designer') {
                              setDraggedProduct(product.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', product.id);
                              // Visual feedback
                              e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedProduct(null);
                            setHoveredLocation(null);
                            setPlacementPreview(null);
                          }}
                          className={`p-2 rounded-lg border transition-all ${
                            activeMode === 'designer' 
                              ? 'border-white/20 bg-white/5 hover:bg-white/10 cursor-move hover:scale-[1.02]' 
                              : 'border-white/10 bg-white/5'
                          }`}
                      >
                        <div className="flex items-start gap-2">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.productName} className="w-12 h-12 object-cover rounded" />
                          ) : (
                              <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center text-lg">📦</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{product.productName}</div>
                            <div className="text-[10px] text-white/60">{product.sku}</div>
                            <div className={`inline-block px-1.5 py-0.5 rounded text-[10px] mt-1 ${getStockStatusColor(product.quantity)}`}>
                              {product.quantity} {product.unit}
                            </div>
                            {product.location && (
                                <div className="mt-1 space-y-1">
                                  <div className="text-[10px] text-emerald-300 flex items-center gap-1">
                                    <span>📍</span>
                                    <span className="truncate">{product.location.fullPath || 'Placed'}</span>
                                  </div>
                                  {activeMode === 'designer' && (
                                    <div className="flex gap-1 mt-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (window.confirm('Remove this product from its current location?')) {
                                            removeProductFromLocation(product.id);
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded text-[9px] bg-red-500/20 hover:bg-red-500/30 text-red-300"
                                        title="Remove location"
                                      >
                                        🗑️ Remove
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedProductForPlacement(product.id);
                                          toast.info('Drag this product to a new location or click on a location');
                                        }}
                                        className="px-2 py-0.5 rounded text-[9px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
                                        title="Change location"
                                      >
                                        📍 Change
                                      </button>
                                    </div>
                            )}
                          </div>
                              )}
                              {!product.location && activeMode === 'designer' && (
                                <div className="text-[10px] text-yellow-300 mt-1">⚠️ No location assigned</div>
                              )}
                        </div>
                      </div>
                        </div>
                      ))}
                      {filteredProducts.length > visibleProductRange.end && (
                        <div className="text-xs text-white/40 text-center py-2">
                          Showing {visibleProductRange.start + 1}-{Math.min(visibleProductRange.end, filteredProducts.length)} of {filteredProducts.length}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Product Details Modal */}
      {selectedProductDetails && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedProductDetails(null)}
        >
          <div 
            className="bg-[#0B0F14] rounded-xl border border-white/20 p-6 max-w-md w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Product Details</h3>
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="text-white/60 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Product Image */}
              {selectedProductDetails.imageUrl && (
                <div className="flex justify-center">
                  <img 
                    src={selectedProductDetails.imageUrl} 
                    alt={selectedProductDetails.productName || selectedProductDetails.name}
                    className="w-32 h-32 object-cover rounded-lg border border-white/20"
                  />
                </div>
              )}
              
              {/* Product Name */}
              <div>
                <div className="text-xs text-white/60 mb-1">Product Name</div>
                <div className="text-lg font-semibold text-white">
                  {selectedProductDetails.productName || selectedProductDetails.name || 'N/A'}
                </div>
              </div>
              
              {/* SKU */}
              {selectedProductDetails.sku && (
                <div>
                  <div className="text-xs text-white/60 mb-1">SKU</div>
                  <div className="text-sm text-white">{selectedProductDetails.sku}</div>
                </div>
              )}
              
              {/* Quantity */}
              <div>
                <div className="text-xs text-white/60 mb-1">Quantity</div>
                <div className={`text-lg font-bold ${
                  Number(selectedProductDetails.quantity || 0) === 0 ? 'text-red-400' :
                  Number(selectedProductDetails.quantity || 0) <= lowStockThreshold ? 'text-yellow-400' :
                  'text-emerald-400'
                }`}>
                  {selectedProductDetails.quantity || 0} {selectedProductDetails.unit || ''}
                </div>
              </div>
              
              {/* Location */}
              {selectedProductDetails.location && (
                <div>
                  <div className="text-xs text-white/60 mb-1">Location</div>
                  <div className="text-sm text-emerald-300 font-medium">
                    {selectedProductDetails.location.fullPath || 'N/A'}
                  </div>
                </div>
              )}
              
              {/* Brand */}
              {selectedProductDetails.brand && (
                <div>
                  <div className="text-xs text-white/60 mb-1">Brand</div>
                  <div className="text-sm text-white">{selectedProductDetails.brand}</div>
                </div>
              )}
              
              {/* Category */}
              {selectedProductDetails.category && (
                <div>
                  <div className="text-xs text-white/60 mb-1">Category</div>
                  <div className="text-sm text-white">{selectedProductDetails.category}</div>
                </div>
              )}
              
              {/* Price */}
              {selectedProductDetails.sellingPrice && (
                <div>
                  <div className="text-xs text-white/60 mb-1">Selling Price</div>
                  <div className="text-lg font-semibold text-white">
                    ₹{Number(selectedProductDetails.sellingPrice).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartStoreDesigner;

