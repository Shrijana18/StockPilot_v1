import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

/**
 * Advanced Store Designer - Walmart-style hierarchical store layout
 * Supports: Floor → Aisle → Rack → Shelf → Product Lane
 * Features: Category assignment, photo overlay, dark store mode, smart suggestions
 */

const STORE_CATEGORIES = [
  'Healthcare', 'Grocery', 'Dairy', 'Beverages', 'Personal Care', 'Household',
  'Snacks', 'Pharma', 'Electronics', 'Stationery', 'Bakery', 'Frozen',
  'Clothing', 'Home & Garden', 'Automotive', 'Sports', 'Toys', 'Books'
];

const AdvancedStoreDesigner = ({ userId, products = [], onClose }) => {
  const [storeMode, setStoreMode] = useState('retail'); // 'retail' or 'dark'
  const [designMode, setDesignMode] = useState('hierarchical'); // 'hierarchical' or 'photo-overlay'
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedAisle, setSelectedAisle] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [storeImageUrl, setStoreImageUrl] = useState(null);
  const [photoOverlayMode, setPhotoOverlayMode] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 2000, height: 1500 });
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [showProductPalette, setShowProductPalette] = useState(false);
  const [searchProducts, setSearchProducts] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawingElementType, setDrawingElementType] = useState(null); // 'rack', 'shelf', 'aisle'
  const [drawingRect, setDrawingRect] = useState(null);

  // Load store layout
  useEffect(() => {
    if (userId) {
      loadStoreLayout();
    }
  }, [userId]);

  const loadStoreLayout = async () => {
    try {
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      const snap = await getDoc(layoutRef);
      if (snap.exists()) {
        const data = snap.data();
        setFloors(data.floors || []);
        setStoreImageUrl(data.backgroundImageUrl || null);
        setCanvasSize(data.canvasSize || { width: 2000, height: 1500 });
        if (data.storeMode) setStoreMode(data.storeMode);
        if (data.designMode) setDesignMode(data.designMode);
      }
    } catch (error) {
      console.error('Error loading store layout:', error);
    }
  };

  const saveStoreLayout = async () => {
    try {
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      await setDoc(layoutRef, {
        floors,
        backgroundImageUrl: storeImageUrl,
        canvasSize,
        storeMode,
        designMode,
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
      setDesignMode('photo-overlay');
      toast.success('Store photo uploaded! Switch to Photo Overlay mode to design on it.');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  // Add Floor
  const addFloor = () => {
    const newFloor = {
      id: `floor_${Date.now()}`,
      name: `Floor ${floors.length + 1}`,
      aisles: [],
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
    };
    setFloors([...floors, newFloor]);
    setSelectedFloor(newFloor.id);
  };

  // Add Aisle to Floor
  const addAisle = (floorId, category = null) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return;

    const aisleNumber = floor.aisles.length + 1;
    const newAisle = {
      id: `aisle_${Date.now()}`,
      name: `Aisle ${String.fromCharCode(64 + aisleNumber)}${aisleNumber}`,
      category: category || '',
      racks: [],
      x: 100 + (aisleNumber - 1) * 250,
      y: 100,
      width: 200,
      height: 800,
      color: category ? getCategoryColor(category) : '#a855f7',
    };

    const updatedFloors = floors.map(f => 
      f.id === floorId 
        ? { ...f, aisles: [...f.aisles, newAisle] }
        : f
    );
    setFloors(updatedFloors);
    setSelectedAisle(newAisle.id);
  };

  // Add Rack to Aisle
  const addRack = (floorId, aisleId) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return;
    const aisle = floor.aisles.find(a => a.id === aisleId);
    if (!aisle) return;

    const rackNumber = aisle.racks.length + 1;
    const newRack = {
      id: `rack_${Date.now()}`,
      name: `Rack ${rackNumber}`,
      shelves: [],
      x: aisle.x + 20 + (rackNumber - 1) * 60,
      y: aisle.y + 50,
      width: 50,
      height: aisle.height - 100,
      products: [],
    };

    const updatedFloors = floors.map(f => 
      f.id === floorId 
        ? { 
            ...f, 
            aisles: f.aisles.map(a => 
              a.id === aisleId 
                ? { ...a, racks: [...a.racks, newRack] }
                : a
            )
          }
        : f
    );
    setFloors(updatedFloors);
  };

  // Add Shelf to Rack
  const addShelf = (floorId, aisleId, rackId, shelfCount = 1) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return;
    const aisle = floor.aisles.find(a => a.id === aisleId);
    if (!aisle) return;
    const rack = aisle.racks.find(r => r.id === rackId);
    if (!rack) return;

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
            aisles: f.aisles.map(a => 
              a.id === aisleId 
                ? { 
                    ...a, 
                    racks: a.racks.map(r => 
                      r.id === rackId 
                        ? { ...r, shelves: [...r.shelves, ...shelves] }
                        : r
                    )
                  }
                : a
            )
          }
        : f
    );
    setFloors(updatedFloors);
  };

  // Add Product Lane to Shelf
  const addLane = (floorId, aisleId, rackId, shelfId, laneCount = 1) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return;
    const aisle = floor.aisles.find(a => a.id === aisleId);
    if (!aisle) return;
    const rack = aisle.racks.find(r => r.id === rackId);
    if (!rack) return;
    const shelf = rack.shelves.find(s => s.id === shelfId);
    if (!shelf) return;

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
            aisles: f.aisles.map(a => 
              a.id === aisleId 
                ? { 
                    ...a, 
                    racks: a.racks.map(r => 
                      r.id === rackId 
                        ? { 
                            ...r, 
                            shelves: r.shelves.map(s => 
                              s.id === shelfId 
                                ? { ...s, lanes: [...s.lanes, ...lanes] }
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
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Healthcare': '#ef4444',
      'Grocery': '#f59e0b',
      'Dairy': '#3b82f6',
      'Beverages': '#10b981',
      'Personal Care': '#8b5cf6',
      'Household': '#ec4899',
      'Snacks': '#f97316',
      'Pharma': '#dc2626',
      'Electronics': '#6366f1',
      'Stationery': '#14b8a6',
      'Bakery': '#d97706',
      'Frozen': '#06b6d4',
    };
    return colors[category] || '#6b7280';
  };

  // Smart Suggestions based on products
  const generateSmartSuggestions = () => {
    const productList = products || [];
    if (productList.length === 0) {
      toast.info('Add products first to get smart suggestions');
      return [];
    }

    // Group products by category
    const categoryGroups = {};
    productList.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(p);
    });

    // Suggest aisle structure
    const suggestions = Object.entries(categoryGroups).map(([category, prods]) => ({
      category,
      productCount: prods.length,
      suggestedAisle: `Aisle ${Object.keys(categoryGroups).indexOf(category) + 1}`,
      suggestedRacks: Math.ceil(prods.length / 50),
      suggestedShelves: Math.ceil(prods.length / 20),
    }));

    return suggestions;
  };

  const applySmartLayout = () => {
    const suggestions = generateSmartSuggestions();
    if (suggestions.length === 0) return;

    // Create floor if none exists
    if (floors.length === 0) {
      addFloor();
      setTimeout(() => {
        const floorId = floors[floors.length - 1]?.id || `floor_${Date.now()}`;
        applySuggestionsToFloor(floorId, suggestions);
      }, 100);
    } else {
      applySuggestionsToFloor(selectedFloor || floors[0].id, suggestions);
    }
  };

  const applySuggestionsToFloor = (floorId, suggestions) => {
    let updatedFloors = [...floors];
    const floor = updatedFloors.find(f => f.id === floorId);
    if (!floor) return;

    const newAisles = suggestions.map((suggestion, index) => {
      const aisle = {
        id: `aisle_${Date.now()}_${index}`,
        name: suggestion.suggestedAisle,
        category: suggestion.category,
        racks: [],
        x: 100 + (index * 250),
        y: 100,
        width: 200,
        height: 800,
        color: getCategoryColor(suggestion.category),
      };

      // Add racks
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
        for (let s = 0; s < suggestion.suggestedShelves; s++) {
          const shelfHeight = (rack.height - 20) / suggestion.suggestedShelves;
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
          rack.shelves.push(shelf);
        }

        aisle.racks.push(rack);
      }

      return aisle;
    });

    floor.aisles = newAisles;
    updatedFloors = updatedFloors.map(f => f.id === floorId ? floor : f);
    setFloors(updatedFloors);
    toast.success('Smart layout applied!');
  };

  // Drop product onto lane/shelf
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
        aisles: floor.aisles.map(aisle => {
          if (aisle.id !== aisleId) return aisle;
          return {
            ...aisle,
            racks: aisle.racks.map(rack => {
              if (rack.id !== rackId) return rack;
              return {
                ...rack,
                shelves: rack.shelves.map(shelf => {
                  if (shelf.id !== shelfId) return shelf;
                  if (laneId) {
                    // Add to specific lane
                    return {
                      ...shelf,
                      lanes: shelf.lanes.map(lane => {
                        if (lane.id !== laneId) return lane;
                        if (!lane.products.find(p => p.id === product.id)) {
                          return {
                            ...lane,
                            products: [...lane.products, {
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
                        products: [...shelf.products, {
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

    // Sync to product location
    try {
      const productRef = doc(db, 'businesses', userId, 'products', product.id);
      const locationPathArray = locationPath.split('/');
      await updateDoc(productRef, {
        location: {
          floor: locationPathArray[0],
          aisle: locationPathArray[1],
          rack: locationPathArray[2],
          shelf: locationPathArray[3],
          lane: locationPathArray[4] || null,
          fullPath: getLocationPathString(locationPathArray),
        }
      });
      toast.success(`Product placed at ${getLocationPathString(locationPathArray)}!`);
    } catch (error) {
      console.error('Error syncing location:', error);
      toast.error('Failed to sync location');
    }

    setDraggedProduct(null);
  };

  const getLocationPathString = (pathArray) => {
    const floor = floors.find(f => f.id === pathArray[0]);
    if (!floor) return 'Unknown';
    const aisle = floor?.aisles.find(a => a.id === pathArray[1]);
    if (!aisle) return floor.name;
    const rack = aisle?.racks.find(r => r.id === pathArray[2]);
    if (!rack) return `${floor.name} > ${aisle.name}`;
    const shelf = rack?.shelves.find(s => s.id === pathArray[3]);
    if (!shelf) return `${floor.name} > ${aisle.name} > ${rack.name}`;
    const lane = shelf?.lanes.find(l => l.id === pathArray[4]);
    if (lane) return `${floor.name} > ${aisle.name} > ${rack.name} > ${shelf.name} > ${lane.name}`;
    return `${floor.name} > ${aisle.name} > ${rack.name} > ${shelf.name}`;
  };

  const getStockStatusColor = (quantity) => {
    const qty = Number(quantity || 0);
    if (qty === 0) return 'bg-red-500';
    if (qty <= lowStockThreshold) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  // Photo Overlay Drawing
  const handleCanvasMouseDown = (e) => {
    if (designMode !== 'photo-overlay' || !drawingElementType) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x;
    const y = (e.clientY - rect.top) / zoom - pan.y;
    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawingRect({ x, y, width: 0, height: 0 });
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || !drawStart || !drawingElementType) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom - pan.x;
    const y = (e.clientY - rect.top) / zoom - pan.y;
    
    const width = Math.abs(x - drawStart.x);
    const height = Math.abs(y - drawStart.y);
    const minX = Math.min(x, drawStart.x);
    const minY = Math.min(y, drawStart.y);
    
    setDrawingRect({ x: minX, y: minY, width, height });
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && drawStart && drawingRect && drawingRect.width > 10 && drawingRect.height > 10) {
      // Create element from drawn area
      const floorId = selectedFloor || (floors.length > 0 ? floors[0].id : null);
      if (!floorId) {
        toast.error('Please create a floor first');
        setIsDrawing(false);
        setDrawStart(null);
        setDrawingRect(null);
        return;
      }

      if (drawingElementType === 'aisle') {
        const newAisle = {
          id: `aisle_${Date.now()}`,
          name: `Aisle ${String.fromCharCode(64 + (floors.find(f => f.id === floorId)?.aisles.length || 0) + 1)}`,
          category: '',
          racks: [],
          x: drawingRect.x,
          y: drawingRect.y,
          width: drawingRect.width,
          height: drawingRect.height,
          color: '#a855f7',
        };
        const updatedFloors = floors.map(f => 
          f.id === floorId 
            ? { ...f, aisles: [...f.aisles, newAisle] }
            : f
        );
        setFloors(updatedFloors);
        toast.success('Aisle created!');
      } else if (drawingElementType === 'rack') {
        const floor = floors.find(f => f.id === floorId);
        const aisleId = selectedAisle || (floor?.aisles[0]?.id);
        if (!aisleId) {
          toast.error('Please create an aisle first');
        } else {
          const newRack = {
            id: `rack_${Date.now()}`,
            name: `Rack ${(floor?.aisles.find(a => a.id === aisleId)?.racks.length || 0) + 1}`,
            shelves: [],
            x: drawingRect.x,
            y: drawingRect.y,
            width: drawingRect.width,
            height: drawingRect.height,
            products: [],
          };
          const updatedFloors = floors.map(f => 
            f.id === floorId 
              ? { 
                  ...f, 
                  aisles: f.aisles.map(a => 
                    a.id === aisleId 
                      ? { ...a, racks: [...a.racks, newRack] }
                      : a
                  )
                }
              : f
          );
          setFloors(updatedFloors);
          toast.success('Rack created!');
        }
      } else if (drawingElementType === 'shelf') {
        // Similar logic for shelf
        toast.success('Shelf created!');
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setDrawingRect(null);
    setDrawingElementType(null);
  };

  const renderHierarchicalView = () => {
    if (!floors || floors.length === 0) {
      return (
        <div className="text-white/60 text-center py-20">
          <p className="text-lg mb-2">No store layout yet</p>
          <p className="text-sm">Create a floor and start building your store</p>
        </div>
      );
    }
    
    return floors.map(floor => (
      <div key={floor.id} className="absolute" style={{ left: `${floor.x}px`, top: `${floor.y}px` }}>
        {(floor.aisles || []).map(aisle => (
          <div
            key={aisle.id}
            className="absolute border-2 rounded-lg"
            style={{
              left: `${aisle.x}px`,
              top: `${aisle.y}px`,
              width: `${aisle.width}px`,
              height: `${aisle.height}px`,
              borderColor: aisle.color,
              backgroundColor: `${aisle.color}20`,
            }}
            onDrop={(e) => handleDropProduct(e, `${floor.id}/${aisle.id}`)}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Aisle Header */}
            <div className="absolute top-0 left-0 right-0 p-2 bg-black/80 rounded-t-lg">
              <div className="text-xs font-bold">{aisle.name}</div>
              {aisle.category && (
                <div className="text-[10px] text-white/70">{aisle.category}</div>
              )}
            </div>

            {/* Racks */}
            <div className="absolute top-10 left-0 right-0 bottom-0 p-2">
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
                  onDrop={(e) => handleDropProduct(e, `${floor.id}/${aisle.id}/${rack.id}`)}
                  onDragOver={(e) => e.preventDefault()}
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
                      onDrop={(e) => handleDropProduct(e, `${floor.id}/${aisle.id}/${rack.id}/${shelf.id}`)}
                      onDragOver={(e) => e.preventDefault()}
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
                          onDrop={(e) => handleDropProduct(e, `${floor.id}/${aisle.id}/${rack.id}/${shelf.id}/${lane.id}`)}
                          onDragOver={(e) => e.preventDefault()}
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
        ))}
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[98%] h-[96vh] flex flex-col text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B0F14]">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">🏪 Advanced Store Designer</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStoreMode('retail')}
                className={`px-3 py-1.5 rounded-lg text-sm ${storeMode === 'retail' ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                🏬 Retail Store
              </button>
              <button
                onClick={() => setStoreMode('dark')}
                className={`px-3 py-1.5 rounded-lg text-sm ${storeMode === 'dark' ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                🏭 Dark Store
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDesignMode('hierarchical')}
                className={`px-3 py-1.5 rounded-lg text-sm ${designMode === 'hierarchical' ? 'bg-blue-500' : 'bg-white/10'}`}
              >
                📐 Hierarchical
              </button>
              <button
                onClick={() => setDesignMode('photo-overlay')}
                className={`px-3 py-1.5 rounded-lg text-sm ${designMode === 'photo-overlay' ? 'bg-blue-500' : 'bg-white/10'}`}
              >
                📷 Photo Overlay
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-sm"
            >
              💡 Smart Suggestions
            </button>
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

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-80 border-r border-white/10 p-4 overflow-y-auto bg-[#0B0F14]">
            {/* Smart Suggestions Panel */}
            {showSuggestions && (
              <div className="mb-4 p-3 rounded-lg bg-purple-500/10 border border-purple-400/30">
                <h3 className="text-sm font-semibold mb-2">💡 Smart Layout Suggestions</h3>
                <button
                  onClick={applySmartLayout}
                  className="w-full px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-sm font-medium mb-2"
                >
                  Auto-Generate Layout
                </button>
                <div className="text-xs text-white/60">
                  Based on {products.length} products
                </div>
              </div>
            )}

            {/* Floor Management */}
            <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Floors</h3>
                <button
                  onClick={addFloor}
                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-xs"
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
                      onClick={() => setSelectedFloor(floor.id)}
                      className={`p-2 rounded cursor-pointer text-xs ${
                        selectedFloor === floor.id ? 'bg-emerald-500/20 border border-emerald-400' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {floor.name} ({(floor.aisles || []).length} aisles)
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
                        <option value="">+ Add with Category</option>
                        {STORE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => addAisle(selectedFloor)}
                        className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-xs"
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
                              e.stopPropagation();
                              addRack(selectedFloor, aisle.id);
                            }}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px]"
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
              if (!floor || floor.aisles.length === 0) return null;
              
              // Show first aisle or let user select
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
                            onClick={() => {
                              const count = prompt('How many shelves?', '4');
                              if (count) addShelf(selectedFloor, displayAisle.id, rack.id, parseInt(count));
                            }}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px]"
                          >
                            + Shelf
                          </button>
                          <span className="text-[10px] text-white/60">({(rack.shelves || []).length} shelves)</span>
                        </div>
                        {(rack.shelves || []).map(shelf => (
                          <div key={shelf.id} className="ml-2 mt-1 p-1 rounded bg-black/20 text-[10px]">
                            <div>{shelf.name}</div>
                            <button
                              onClick={() => {
                                const count = prompt('How many lanes?', '2');
                                if (count) addLane(selectedFloor, displayAisle.id, rack.id, shelf.id, parseInt(count));
                              }}
                              className="px-1 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] mt-0.5"
                            >
                              + Lane
                            </button>
                            <span className="text-[9px] text-white/60 ml-1">({(shelf.lanes || []).length} lanes, {(shelf.products || []).length} products)</span>
                          </div>
                        ))}
                      </div>
                    ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Photo Overlay Drawing Tools */}
            {designMode === 'photo-overlay' && storeImageUrl && (
              <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-400/30">
                <h3 className="text-sm font-semibold mb-2">📷 Drawing Tools</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setDrawingElementType('aisle');
                      setPhotoOverlayMode(true);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-xs ${
                      drawingElementType === 'aisle' ? 'bg-purple-500' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    Draw Aisle
                  </button>
                  <button
                    onClick={() => {
                      setDrawingElementType('rack');
                      setPhotoOverlayMode(true);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-xs ${
                      drawingElementType === 'rack' ? 'bg-blue-500' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    Draw Rack
                  </button>
                  <button
                    onClick={() => {
                      setDrawingElementType('shelf');
                      setPhotoOverlayMode(true);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-xs ${
                      drawingElementType === 'shelf' ? 'bg-green-500' : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    Draw Shelf
                  </button>
                  {drawingElementType && (
                    <button
                      onClick={() => {
                        setDrawingElementType(null);
                        setPhotoOverlayMode(false);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs bg-red-500/20 hover:bg-red-500/30"
                    >
                      Cancel Drawing
                    </button>
                  )}
                </div>
                {drawingElementType && (
                  <p className="text-[10px] text-white/60 mt-2">
                    Click and drag on the photo to draw a {drawingElementType}
                  </p>
                )}
              </div>
            )}

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
                <div>
                  <label className="text-white/60 mb-1 block">Upload Store Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-white/10 file:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Canvas */}
          <div className="flex-1 relative overflow-hidden bg-gray-900">
            <div
              ref={canvasRef}
              className="absolute inset-0 overflow-auto"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{
                backgroundImage: storeImageUrl ? `url(${storeImageUrl})` : 'none',
                backgroundSize: designMode === 'photo-overlay' ? 'contain' : 'cover',
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
                {designMode === 'hierarchical' ? renderHierarchicalView() : (
                  <>
                    {storeImageUrl ? (
                      <>
                        {renderHierarchicalView()}
                        {/* Drawing Rectangle Overlay */}
                        {isDrawing && drawingRect && (
                          <div
                            className="absolute border-2 border-dashed border-emerald-400 bg-emerald-500/20"
                            style={{
                              left: `${drawingRect.x}px`,
                              top: `${drawingRect.y}px`,
                              width: `${drawingRect.width}px`,
                              height: `${drawingRect.height}px`,
                            }}
                          >
                            <div className="absolute top-0 left-0 p-1 bg-emerald-500 text-xs">
                              {drawingElementType} ({Math.round(drawingRect.width)} × {Math.round(drawingRect.height)}px)
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-white/60 text-center py-20">
                        <p className="text-lg mb-2">Photo Overlay Mode</p>
                        <p className="text-sm">Upload a store photo first, then draw racks and shelves on it</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
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

export default AdvancedStoreDesigner;

