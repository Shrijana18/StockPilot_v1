import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

/**
 * LocationPicker - Unified location management for products
 * Now syncs with SmartStoreDesigner using the same virtualStore/layout structure
 * Supports hierarchical location: Floor > Aisle > Rack > Shelf > Lane
 */
const LocationPicker = ({ userId, productId, currentLocation, onSave, onCancel }) => {
  const [floors, setFloors] = useState([]);
  const [aisles, setAisles] = useState([]);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [lanes, setLanes] = useState([]);
  
  const [selectedFloor, setSelectedFloor] = useState(currentLocation?.floor || '');
  const [selectedAisle, setSelectedAisle] = useState(currentLocation?.aisle || '');
  const [selectedRack, setSelectedRack] = useState(currentLocation?.rack || '');
  const [selectedShelf, setSelectedShelf] = useState(currentLocation?.shelf || '');
  const [selectedLane, setSelectedLane] = useState(currentLocation?.lane || '');
  const [customLocation, setCustomLocation] = useState(currentLocation?.custom || '');
  
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState(''); // 'floor', 'aisle', 'rack', 'shelf', 'lane'
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  // Load store layout from virtualStore/layout (same as SmartStoreDesigner)
  useEffect(() => {
    loadStoreLayout();
  }, [userId]);

  // Real-time sync: Listen for changes to store layout (updates when SmartStoreDesigner makes changes)
  // Only updates floors list, not dependent selections to avoid glitches
  useEffect(() => {
    if (!userId) return;
    
    const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
    const unsubscribe = onSnapshot(layoutRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const loadedFloors = data.floors || [];
        setFloors(prevFloors => {
          // Only update if structure actually changed
          const prevStr = JSON.stringify(prevFloors);
          const newStr = JSON.stringify(loadedFloors);
          if (prevStr !== newStr) {
            return loadedFloors;
          }
          return prevFloors;
        });
      }
    }, (error) => {
      console.error('Error listening to store layout:', error);
    });
    
    return () => unsubscribe();
  }, [userId]);

  // Update aisles when floor changes
  useEffect(() => {
    if (selectedFloor && floors.length > 0) {
      const floor = floors.find(f => f.id === selectedFloor);
      if (floor) {
        const floorAisles = floor.aisles || [];
        // Only update if aisles actually changed to prevent unnecessary re-renders
        setAisles(prevAisles => {
          if (JSON.stringify(prevAisles) !== JSON.stringify(floorAisles)) {
            return floorAisles;
          }
          return prevAisles;
        });
        // Only reset dependent selections if floor actually changed
        // Check if current aisle still exists in new floor
        if (selectedAisle && !floorAisles.find(a => a.id === selectedAisle)) {
          setSelectedAisle('');
          setSelectedRack('');
          setSelectedShelf('');
          setSelectedLane('');
          setRacks([]);
          setShelves([]);
          setLanes([]);
        }
      } else {
        // Floor not found, reset everything
        setSelectedAisle('');
        setSelectedRack('');
        setSelectedShelf('');
        setSelectedLane('');
        setAisles([]);
        setRacks([]);
        setShelves([]);
        setLanes([]);
      }
    } else if (!selectedFloor) {
      // No floor selected, clear everything
      setAisles([]);
      setRacks([]);
      setShelves([]);
      setLanes([]);
    }
  }, [selectedFloor, floors]);

  // Update racks when aisle changes
  useEffect(() => {
    if (selectedFloor && selectedAisle && aisles.length > 0) {
      const aisle = aisles.find(a => a.id === selectedAisle);
      if (aisle) {
        const aisleRacks = aisle.racks || [];
        // Only update if racks actually changed
        setRacks(prevRacks => {
          if (JSON.stringify(prevRacks) !== JSON.stringify(aisleRacks)) {
            return aisleRacks;
          }
          return prevRacks;
        });
        // Only reset dependent selections if rack no longer exists
        if (selectedRack && !aisleRacks.find(r => r.id === selectedRack)) {
          setSelectedRack('');
          setSelectedShelf('');
          setSelectedLane('');
          setShelves([]);
          setLanes([]);
        }
      } else {
        // Aisle not found, reset dependent
        setSelectedRack('');
        setSelectedShelf('');
        setSelectedLane('');
        setRacks([]);
        setShelves([]);
        setLanes([]);
      }
    } else if (!selectedAisle) {
      // No aisle selected, clear dependent
      setRacks([]);
      setShelves([]);
      setLanes([]);
    }
  }, [selectedAisle, aisles]);

  // Update shelves when rack changes
  useEffect(() => {
    if (selectedFloor && selectedAisle && selectedRack && racks.length > 0) {
      const rack = racks.find(r => r.id === selectedRack);
      if (rack) {
        const rackShelves = rack.shelves || [];
        // Only update if shelves actually changed
        setShelves(prevShelves => {
          if (JSON.stringify(prevShelves) !== JSON.stringify(rackShelves)) {
            return rackShelves;
          }
          return prevShelves;
        });
        // Only reset if shelf no longer exists
        if (selectedShelf && !rackShelves.find(s => s.id === selectedShelf)) {
          setSelectedShelf('');
          setSelectedLane('');
          setLanes([]);
        }
      } else {
        // Rack not found, reset dependent
        setSelectedShelf('');
        setSelectedLane('');
        setShelves([]);
        setLanes([]);
      }
    } else if (!selectedRack) {
      // No rack selected, clear dependent
      setShelves([]);
      setLanes([]);
    }
  }, [selectedRack, racks]);

  // Update lanes when shelf changes
  useEffect(() => {
    if (selectedFloor && selectedAisle && selectedRack && selectedShelf && shelves.length > 0) {
      const shelf = shelves.find(s => s.id === selectedShelf);
      if (shelf) {
        const shelfLanes = shelf.lanes || [];
        // Only update if lanes actually changed
        setLanes(prevLanes => {
          if (JSON.stringify(prevLanes) !== JSON.stringify(shelfLanes)) {
            return shelfLanes;
          }
          return prevLanes;
        });
        // Only reset if lane no longer exists
        if (selectedLane && !shelfLanes.find(l => l.id === selectedLane)) {
          setSelectedLane('');
        }
      } else {
        // Shelf not found, reset lanes
        setSelectedLane('');
        setLanes([]);
      }
    } else if (!selectedShelf) {
      // No shelf selected, clear lanes
      setLanes([]);
    }
  }, [selectedShelf, shelves]);

  const loadStoreLayout = async () => {
    try {
      setLoading(true);
      // Load from virtualStore/layout (same as SmartStoreDesigner)
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      const snap = await getDoc(layoutRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const loadedFloors = data.floors || [];
        setFloors(loadedFloors);
        
        // If current location exists, try to restore selections
        if (currentLocation?.floor) {
          const floor = loadedFloors.find(f => f.id === currentLocation.floor);
          if (floor) {
            setSelectedFloor(currentLocation.floor);
            if (currentLocation.aisle) {
              const aisle = (floor.aisles || []).find(a => a.id === currentLocation.aisle);
              if (aisle) {
                setSelectedAisle(currentLocation.aisle);
                if (currentLocation.rack) {
                  const rack = (aisle.racks || []).find(r => r.id === currentLocation.rack);
                  if (rack) {
                    setSelectedRack(currentLocation.rack);
                    if (currentLocation.shelf) {
                      const shelf = (rack.shelves || []).find(s => s.id === currentLocation.shelf);
                      if (shelf) {
                        setSelectedShelf(currentLocation.shelf);
                        if (currentLocation.lane) {
                          const lane = (shelf.lanes || []).find(l => l.id === currentLocation.lane);
                          if (lane) {
                            setSelectedLane(currentLocation.lane);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        // No layout exists - create a default floor
        const defaultFloor = {
          id: `floor_${Date.now()}`,
          name: 'Ground Floor',
          aisles: [],
          x: 0,
          y: 0,
          width: 2000,
          height: 1500,
        };
        await setDoc(layoutRef, {
          floors: [defaultFloor],
          canvasSize: { width: 2000, height: 1500 },
          updatedAt: Date.now(),
        });
        setFloors([defaultFloor]);
        setSelectedFloor(defaultFloor.id);
      }
    } catch (error) {
      console.error('Error loading store layout:', error);
      toast.error('Failed to load store layout');
    } finally {
      setLoading(false);
    }
  };

  const createLocation = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const layoutRef = doc(db, 'businesses', userId, 'virtualStore', 'layout');
      const snap = await getDoc(layoutRef);
      const data = snap.exists() ? snap.data() : { floors: [] };
      const currentFloors = [...(data.floors || [])];

      const newItem = {
        id: `${createType}_${Date.now()}`,
        name: newName.trim(),
        createdAt: Date.now(),
      };

      if (createType === 'floor') {
        const newFloor = {
          ...newItem,
          aisles: [],
          x: 0,
          y: 0,
          width: 2000,
          height: 1500,
        };
        currentFloors.push(newFloor);
        await setDoc(layoutRef, {
          ...data,
          floors: currentFloors,
          updatedAt: Date.now(),
        }, { merge: true });
        setFloors(currentFloors);
        setSelectedFloor(newItem.id);
        toast.success('Floor created!');
      } else if (createType === 'aisle' && selectedFloor) {
        const floorIndex = currentFloors.findIndex(f => f.id === selectedFloor);
        if (floorIndex === -1) {
          toast.error('Floor not found');
          return;
        }
        const floor = currentFloors[floorIndex];
        const aisleNumber = (floor.aisles || []).length + 1;
        const newAisle = {
          ...newItem,
          name: newItem.name || `Aisle ${String.fromCharCode(64 + aisleNumber)}${aisleNumber}`,
          category: '',
          racks: [],
          x: 100 + (aisleNumber - 1) * 250,
          y: 100,
          width: 200,
          height: 800,
          color: '#a855f7',
          products: [],
        };
        floor.aisles = [...(floor.aisles || []), newAisle];
        currentFloors[floorIndex] = floor;
        await setDoc(layoutRef, {
          ...data,
          floors: currentFloors,
          updatedAt: Date.now(),
        }, { merge: true });
        setFloors(currentFloors);
        setAisles(floor.aisles);
        setSelectedAisle(newAisle.id);
        toast.success('Aisle created!');
      } else if (createType === 'rack' && selectedFloor && selectedAisle) {
        const floorIndex = currentFloors.findIndex(f => f.id === selectedFloor);
        if (floorIndex === -1) {
          toast.error('Floor not found');
          return;
        }
        const floor = currentFloors[floorIndex];
        const aisleIndex = (floor.aisles || []).findIndex(a => a.id === selectedAisle);
        if (aisleIndex === -1) {
          toast.error('Aisle not found');
          return;
        }
        const aisle = floor.aisles[aisleIndex];
        const rackNumber = (aisle.racks || []).length + 1;
        const newRack = {
          ...newItem,
          name: newItem.name || `Rack ${rackNumber}`,
          shelves: [],
          x: aisle.x + 20 + (rackNumber - 1) * 60,
          y: aisle.y + 50,
          width: 50,
          height: 200,
          products: [],
        };
        // Auto-create 4 shelves
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
        aisle.racks = [...(aisle.racks || []), newRack];
        floor.aisles[aisleIndex] = aisle;
        currentFloors[floorIndex] = floor;
        await setDoc(layoutRef, {
          ...data,
          floors: currentFloors,
          updatedAt: Date.now(),
        }, { merge: true });
        setFloors(currentFloors);
        setRacks(aisle.racks);
        setSelectedRack(newRack.id);
        toast.success('Rack created with 4 shelves!');
      } else if (createType === 'shelf' && selectedFloor && selectedAisle && selectedRack) {
        const floorIndex = currentFloors.findIndex(f => f.id === selectedFloor);
        if (floorIndex === -1) {
          toast.error('Floor not found');
          return;
        }
        const floor = currentFloors[floorIndex];
        const aisleIndex = (floor.aisles || []).findIndex(a => a.id === selectedAisle);
        if (aisleIndex === -1) {
          toast.error('Aisle not found');
          return;
        }
        const aisle = floor.aisles[aisleIndex];
        const rackIndex = (aisle.racks || []).findIndex(r => r.id === selectedRack);
        if (rackIndex === -1) {
          toast.error('Rack not found');
          return;
        }
        const rack = aisle.racks[rackIndex];
        const shelfNumber = (rack.shelves || []).length + 1;
        const shelfHeight = (rack.height - 20) / (shelfNumber + 1);
        const newShelf = {
          ...newItem,
          name: newItem.name || `Shelf ${shelfNumber}`,
          lanes: [],
          x: rack.x,
          y: rack.y + 10 + ((shelfNumber - 1) * shelfHeight),
          width: rack.width,
          height: shelfHeight - 5,
          products: [],
        };
        rack.shelves = [...(rack.shelves || []), newShelf];
        aisle.racks[rackIndex] = rack;
        floor.aisles[aisleIndex] = aisle;
        currentFloors[floorIndex] = floor;
        await setDoc(layoutRef, {
          ...data,
          floors: currentFloors,
          updatedAt: Date.now(),
        }, { merge: true });
        setFloors(currentFloors);
        setShelves(rack.shelves);
        setSelectedShelf(newShelf.id);
        toast.success('Shelf created!');
      } else if (createType === 'lane' && selectedFloor && selectedAisle && selectedRack && selectedShelf) {
        const floorIndex = currentFloors.findIndex(f => f.id === selectedFloor);
        if (floorIndex === -1) {
          toast.error('Floor not found');
          return;
        }
        const floor = currentFloors[floorIndex];
        const aisleIndex = (floor.aisles || []).findIndex(a => a.id === selectedAisle);
        if (aisleIndex === -1) {
          toast.error('Aisle not found');
          return;
        }
        const aisle = floor.aisles[aisleIndex];
        const rackIndex = (aisle.racks || []).findIndex(r => r.id === selectedRack);
        if (rackIndex === -1) {
          toast.error('Rack not found');
          return;
        }
        const rack = aisle.racks[rackIndex];
        const shelfIndex = (rack.shelves || []).findIndex(s => s.id === selectedShelf);
        if (shelfIndex === -1) {
          toast.error('Shelf not found');
          return;
        }
        const shelf = rack.shelves[shelfIndex];
        const laneNumber = (shelf.lanes || []).length + 1;
        const laneWidth = shelf.width / (laneNumber + 1);
        const newLane = {
          ...newItem,
          name: newItem.name || `Lane ${laneNumber}`,
          x: shelf.x + ((laneNumber - 1) * laneWidth),
          y: shelf.y,
          width: laneWidth - 2,
          height: shelf.height,
          products: [],
        };
        shelf.lanes = [...(shelf.lanes || []), newLane];
        rack.shelves[shelfIndex] = shelf;
        aisle.racks[rackIndex] = rack;
        floor.aisles[aisleIndex] = aisle;
        currentFloors[floorIndex] = floor;
        await setDoc(layoutRef, {
          ...data,
          floors: currentFloors,
          updatedAt: Date.now(),
        }, { merge: true });
        setFloors(currentFloors);
        setLanes(shelf.lanes);
        setSelectedLane(newLane.id);
        toast.success('Lane created!');
      }

      setNewName('');
      setIsCreating(false);
      setCreateType('');
    } catch (error) {
      console.error('Error creating location:', error);
      toast.error('Failed to create location');
    }
  };

  const handleSave = () => {
    // Build full path from selected items
    const floor = floors.find(f => f.id === selectedFloor);
    const aisle = floor?.aisles?.find(a => a.id === selectedAisle);
    const rack = aisle?.racks?.find(r => r.id === selectedRack);
    const shelf = rack?.shelves?.find(s => s.id === selectedShelf);
    const lane = shelf?.lanes?.find(l => l.id === selectedLane);

    const location = {
      floor: selectedFloor || null,
      aisle: selectedAisle || null,
      rack: selectedRack || null,
      shelf: selectedShelf || null,
      lane: selectedLane || null,
      custom: customLocation || null,
      fullPath: [
        floor?.name,
        aisle?.name,
        rack?.name,
        shelf?.name,
        lane?.name,
        customLocation,
      ].filter(Boolean).join(' > ') || null,
    };
    
    onSave(location);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#0B0F14] rounded-2xl border border-white/10 p-8 text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-center">Loading store layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto text-white shadow-2xl">
        <div className="sticky top-0 bg-[#0B0F14] border-b border-white/10 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-semibold">Set Product Location</h2>
          <button
            onClick={onCancel}
            className="text-white/70 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Floor Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Floor</label>
              <button
                onClick={() => { setIsCreating(true); setCreateType('floor'); }}
                className="text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
              >
                + Add Floor
              </button>
            </div>
            {isCreating && createType === 'floor' ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Floor name (e.g., Ground Floor)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      createLocation();
                    }
                  }}
                />
                <button
                  onClick={createLocation}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                >
                  Create
                </button>
                <button
                  onClick={() => { setIsCreating(false); setNewName(''); }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={selectedFloor}
                onChange={(e) => {
                  setSelectedFloor(e.target.value);
                  setSelectedAisle('');
                  setSelectedRack('');
                  setSelectedShelf('');
                  setSelectedLane('');
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              >
                <option value="">Select Floor</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Aisle Selection */}
          {selectedFloor && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Aisle</label>
                <button
                  onClick={() => { setIsCreating(true); setCreateType('aisle'); }}
                  className="text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                >
                  + Add Aisle
                </button>
              </div>
              {isCreating && createType === 'aisle' ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Aisle name (e.g., Aisle A)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        createLocation();
                      }
                    }}
                  />
                  <button
                    onClick={createLocation}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setIsCreating(false); setNewName(''); }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={selectedAisle}
                  onChange={(e) => {
                    setSelectedAisle(e.target.value);
                    setSelectedRack('');
                    setSelectedShelf('');
                    setSelectedLane('');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">Select Aisle</option>
                  {aisles.map((aisle) => (
                    <option key={aisle.id} value={aisle.id}>
                      {aisle.name} {aisle.category ? `(${aisle.category})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Rack Selection */}
          {selectedFloor && selectedAisle && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Rack</label>
                <button
                  onClick={() => { setIsCreating(true); setCreateType('rack'); }}
                  className="text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                >
                  + Add Rack
                </button>
              </div>
              {isCreating && createType === 'rack' ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Rack name (e.g., Rack 1)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        createLocation();
                      }
                    }}
                  />
                  <button
                    onClick={createLocation}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setIsCreating(false); setNewName(''); }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={selectedRack}
                  onChange={(e) => {
                    setSelectedRack(e.target.value);
                    setSelectedShelf('');
                    setSelectedLane('');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">Select Rack</option>
                  {racks.map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name} ({(rack.shelves || []).length} shelves)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Shelf Selection */}
          {selectedFloor && selectedAisle && selectedRack && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Shelf</label>
                <button
                  onClick={() => { setIsCreating(true); setCreateType('shelf'); }}
                  className="text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                >
                  + Add Shelf
                </button>
              </div>
              {isCreating && createType === 'shelf' ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Shelf name (e.g., Shelf Top)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        createLocation();
                      }
                    }}
                  />
                  <button
                    onClick={createLocation}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setIsCreating(false); setNewName(''); }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={selectedShelf}
                  onChange={(e) => {
                    setSelectedShelf(e.target.value);
                    setSelectedLane('');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">Select Shelf</option>
                  {shelves.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.name} ({(shelf.lanes || []).length} lanes)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Lane Selection */}
          {selectedFloor && selectedAisle && selectedRack && selectedShelf && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Lane (Optional)</label>
                <button
                  onClick={() => { setIsCreating(true); setCreateType('lane'); }}
                  className="text-xs px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                >
                  + Add Lane
                </button>
              </div>
              {isCreating && createType === 'lane' ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Lane name (e.g., Lane 1)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        createLocation();
                      }
                    }}
                  />
                  <button
                    onClick={createLocation}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setIsCreating(false); setNewName(''); }}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <select
                  value={selectedLane}
                  onChange={(e) => setSelectedLane(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">No Lane (Place on Shelf)</option>
                  {lanes.map((lane) => (
                    <option key={lane.id} value={lane.id}>
                      {lane.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Custom Location */}
          <div>
            <label className="text-sm font-medium mb-2 block">Custom Location (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Near entrance, Back room, etc."
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
            />
          </div>

          {/* Location Preview */}
          {(selectedFloor || customLocation) && (
            <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-300 mb-1">Location Path:</p>
              <p className="text-sm font-medium">
                {[
                  floors.find(f => f.id === selectedFloor)?.name,
                  aisles.find(a => a.id === selectedAisle)?.name,
                  racks.find(r => r.id === selectedRack)?.name,
                  shelves.find(s => s.id === selectedShelf)?.name,
                  lanes.find(l => l.id === selectedLane)?.name,
                  customLocation,
                ].filter(Boolean).join(' > ') || 'No location set'}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#0B0F14] border-t border-white/10 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedFloor}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedFloor
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-gray-500 cursor-not-allowed'
            }`}
          >
            Save Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
