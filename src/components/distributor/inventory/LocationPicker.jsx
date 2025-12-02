import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

/**
 * LocationPicker - Smart location management for products
 * Supports hierarchical location: Floor > Aisle > Rack > Shelf
 */
const LocationPicker = ({ userId, productId, currentLocation, onSave, onCancel }) => {
  const [floors, setFloors] = useState([]);
  const [aisles, setAisles] = useState([]);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  
  const [selectedFloor, setSelectedFloor] = useState(currentLocation?.floor || '');
  const [selectedAisle, setSelectedAisle] = useState(currentLocation?.aisle || '');
  const [selectedRack, setSelectedRack] = useState(currentLocation?.rack || '');
  const [selectedShelf, setSelectedShelf] = useState(currentLocation?.shelf || '');
  const [customLocation, setCustomLocation] = useState(currentLocation?.custom || '');
  
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState(''); // 'floor', 'aisle', 'rack', 'shelf'
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadLocations();
  }, [userId]);

  useEffect(() => {
    if (selectedFloor) loadAisles(selectedFloor);
  }, [selectedFloor]);

  useEffect(() => {
    if (selectedFloor && selectedAisle) loadRacks(selectedFloor, selectedAisle);
  }, [selectedFloor, selectedAisle]);

  useEffect(() => {
    if (selectedFloor && selectedAisle && selectedRack) {
      loadShelves(selectedFloor, selectedAisle, selectedRack);
    }
  }, [selectedFloor, selectedAisle, selectedRack]);

  const loadLocations = async () => {
    try {
      const storeLayoutRef = doc(db, 'businesses', userId, 'storeLayout', 'main');
      const snap = await getDoc(storeLayoutRef);
      if (snap.exists()) {
        const data = snap.data();
        setFloors(data.floors || []);
      } else {
        // Initialize with default floor
        await setDoc(storeLayoutRef, {
          floors: [{ id: 'floor1', name: 'Ground Floor', createdAt: Date.now() }],
          aisles: {},
          racks: {},
          shelves: {},
        });
        setFloors([{ id: 'floor1', name: 'Ground Floor' }]);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadAisles = async (floorId) => {
    try {
      const storeLayoutRef = doc(db, 'businesses', userId, 'storeLayout', 'main');
      const snap = await getDoc(storeLayoutRef);
      if (snap.exists()) {
        const data = snap.data();
        const floorAisles = data.aisles?.[floorId] || [];
        setAisles(floorAisles);
      }
    } catch (error) {
      console.error('Error loading aisles:', error);
    }
  };

  const loadRacks = async (floorId, aisleId) => {
    try {
      const storeLayoutRef = doc(db, 'businesses', userId, 'storeLayout', 'main');
      const snap = await getDoc(storeLayoutRef);
      if (snap.exists()) {
        const data = snap.data();
        const key = `${floorId}_${aisleId}`;
        const aisleRacks = data.racks?.[key] || [];
        setRacks(aisleRacks);
      }
    } catch (error) {
      console.error('Error loading racks:', error);
    }
  };

  const loadShelves = async (floorId, aisleId, rackId) => {
    try {
      const storeLayoutRef = doc(db, 'businesses', userId, 'storeLayout', 'main');
      const snap = await getDoc(storeLayoutRef);
      if (snap.exists()) {
        const data = snap.data();
        const key = `${floorId}_${aisleId}_${rackId}`;
        const rackShelves = data.shelves?.[key] || [];
        setShelves(rackShelves);
      }
    } catch (error) {
      console.error('Error loading shelves:', error);
    }
  };

  const createLocation = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const storeLayoutRef = doc(db, 'businesses', userId, 'storeLayout', 'main');
      const snap = await getDoc(storeLayoutRef);
      const data = snap.exists() ? snap.data() : { floors: [], aisles: {}, racks: {}, shelves: {} };

      const newItem = {
        id: `${createType}_${Date.now()}`,
        name: newName.trim(),
        createdAt: Date.now(),
      };

      if (createType === 'floor') {
        await setDoc(storeLayoutRef, {
          ...data,
          floors: [...(data.floors || []), newItem],
        }, { merge: true });
        setFloors([...floors, newItem]);
      } else if (createType === 'aisle' && selectedFloor) {
        const floorAisles = data.aisles?.[selectedFloor] || [];
        await setDoc(storeLayoutRef, {
          ...data,
          aisles: {
            ...data.aisles,
            [selectedFloor]: [...floorAisles, newItem],
          },
        }, { merge: true });
        setAisles([...aisles, newItem]);
      } else if (createType === 'rack' && selectedFloor && selectedAisle) {
        const key = `${selectedFloor}_${selectedAisle}`;
        const aisleRacks = data.racks?.[key] || [];
        await setDoc(storeLayoutRef, {
          ...data,
          racks: {
            ...data.racks,
            [key]: [...aisleRacks, newItem],
          },
        }, { merge: true });
        setRacks([...racks, newItem]);
      } else if (createType === 'shelf' && selectedFloor && selectedAisle && selectedRack) {
        const key = `${selectedFloor}_${selectedAisle}_${selectedRack}`;
        const rackShelves = data.shelves?.[key] || [];
        await setDoc(storeLayoutRef, {
          ...data,
          shelves: {
            ...data.shelves,
            [key]: [...rackShelves, newItem],
          },
        }, { merge: true });
        setShelves([...shelves, newItem]);
      }

      setNewName('');
      setIsCreating(false);
      setCreateType('');
      toast.success(`${createType.charAt(0).toUpperCase() + createType.slice(1)} created!`);
    } catch (error) {
      console.error('Error creating location:', error);
      toast.error('Failed to create location');
    }
  };

  const handleSave = () => {
    const location = {
      floor: selectedFloor,
      aisle: selectedAisle,
      rack: selectedRack,
      shelf: selectedShelf,
      custom: customLocation,
      fullPath: [
        floors.find(f => f.id === selectedFloor)?.name,
        aisles.find(a => a.id === selectedAisle)?.name,
        racks.find(r => r.id === selectedRack)?.name,
        shelves.find(s => s.id === selectedShelf)?.name,
      ].filter(Boolean).join(' > '),
    };
    onSave(location);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#0B0F14] rounded-2xl border border-white/10 w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto text-white shadow-2xl">
        <div className="sticky top-0 bg-[#0B0F14] border-b border-white/10 px-6 py-4 flex justify-between items-center">
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
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">Select Aisle</option>
                  {aisles.map((aisle) => (
                    <option key={aisle.id} value={aisle.id}>
                      {aisle.name}
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
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">Select Rack</option>
                  {racks.map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name}
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
                  onChange={(e) => setSelectedShelf(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                >
                  <option value="">Select Shelf</option>
                  {shelves.map((shelf) => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.name}
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
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-medium"
          >
            Save Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;

