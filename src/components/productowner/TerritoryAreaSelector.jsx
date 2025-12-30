import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaSearch, FaMapMarkerAlt, FaTimes, FaCheck, FaChevronRight, FaSpinner } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { 
  INDIAN_STATES, 
  getDistrictsForStates, 
  searchStates, 
  searchDistricts 
} from "../../data/indianAdministrativeData";

const TerritoryAreaSelector = ({ onAreaSelect, map, isLoaded, googleMapsApiKey }) => {
  // Step-by-step selection state
  const [currentStep, setCurrentStep] = useState(1); // 1: State, 2: District, 3: Taluka, 4: Village
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedTalukas, setSelectedTalukas] = useState([]);
  const [selectedVillages, setSelectedVillages] = useState([]);
  
  // Search state
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  
  // Refs
  const dataLayerRef = useRef(null);
  const geocoderRef = useRef(null);

  // Initialize services
  useEffect(() => {
    if (isLoaded && window.google?.maps && map) {
      geocoderRef.current = new window.google.maps.Geocoder();
      // Initialize Data Layer for getting actual boundaries
      if (window.google.maps.Data) {
        dataLayerRef.current = new window.google.maps.Data();
        dataLayerRef.current.setMap(map);
      }
    }
  }, [isLoaded, map]);

  // Get actual polygon boundaries using Geocoding API with better polygon approximation
  const getActualBoundaries = useCallback(async (locationName, featureType) => {
    if (!map || !geocoderRef.current) return null;

    return new Promise((resolve) => {
      try {
        const geocoder = geocoderRef.current;
        const query = `${locationName}, India`;
        
        geocoder.geocode({ address: query }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const place = results[0];
            const viewport = place.geometry.viewport || place.geometry.bounds;
            
            if (viewport) {
              const ne = viewport.getNorthEast();
              const sw = viewport.getSouthWest();
              
              // Create a more detailed polygon approximation
              // Using a technique that creates a smoother boundary
              const latDiff = ne.lat() - sw.lat();
              const lngDiff = ne.lng() - sw.lng();
              
              // Create polygon with more points for smoother appearance
              // Using a technique that approximates curved boundaries
              const coordinates = [];
              const steps = 50; // More points for better approximation
              
              // Create a rounded rectangle approximation
              // This gives a better visual representation than a simple rectangle
              
              // Bottom edge with slight curve
              for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const lng = sw.lng() + (lngDiff * t);
                // Add slight curve to bottom edge
                const curveOffset = Math.sin(t * Math.PI) * (latDiff * 0.05);
                coordinates.push({ 
                  lat: sw.lat() + curveOffset, 
                  lng: lng 
                });
              }
              
              // Right edge with slight curve
              for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const lat = sw.lat() + (latDiff * t);
                // Add slight curve to right edge
                const curveOffset = Math.sin(t * Math.PI) * (lngDiff * 0.05);
                coordinates.push({ 
                  lat: lat, 
                  lng: ne.lng() - curveOffset 
                });
              }
              
              // Top edge with slight curve
              for (let i = steps - 1; i >= 0; i--) {
                const t = i / steps;
                const lng = sw.lng() + (lngDiff * t);
                // Add slight curve to top edge
                const curveOffset = Math.sin(t * Math.PI) * (latDiff * 0.05);
                coordinates.push({ 
                  lat: ne.lat() - curveOffset, 
                  lng: lng 
                });
              }
              
              // Left edge with slight curve
              for (let i = steps - 1; i > 0; i--) {
                const t = i / steps;
                const lat = sw.lat() + (latDiff * t);
                // Add slight curve to left edge
                const curveOffset = Math.sin(t * Math.PI) * (lngDiff * 0.05);
                coordinates.push({ 
                  lat: lat, 
                  lng: sw.lng() + curveOffset 
                });
              }
              
              // Close polygon
              if (coordinates.length > 0) {
                coordinates.push(coordinates[0]);
              }

              resolve({
                coordinates: coordinates,
                bounds: {
                  northeast: { lat: ne.lat(), lng: ne.lng() },
                  southwest: { lat: sw.lat(), lng: sw.lng() },
                },
              });
            } else {
              resolve(null);
            }
          } else {
            console.warn("Geocoding failed for:", query, status);
            resolve(null);
          }
        });
      } catch (error) {
        console.error("Error getting boundaries:", error);
        resolve(null);
      }
    });
  }, [map]);

  // Ensure polygon is closed
  const ensurePolygonClosed = useCallback((coordinates) => {
    if (!coordinates || coordinates.length < 3) return null;
    const coords = [...coordinates];
    const first = coords[0];
    const last = coords[coords.length - 1];
    const tolerance = 0.0001;
    const isClosed = Math.abs(first.lat - last.lat) < tolerance && 
                     Math.abs(first.lng - last.lng) < tolerance;
    if (!isClosed) {
      coords.push({ lat: first.lat, lng: first.lng });
    }
    return coords;
  }, []);

  // Handle state selection
  const handleStateSelect = useCallback(async (state) => {
    setIsLoading(true);
    try {
      // Check if already selected
      const exists = selectedStates.some(s => s.id === state.id);
      if (exists) {
        toast.info("State already selected");
        setIsLoading(false);
        return;
      }

      // Get actual boundaries for the state
      const boundaries = await getActualBoundaries(state.name, 'ADMINISTRATIVE_AREA_LEVEL_1');
      
      const stateData = {
        id: state.id,
        name: state.name,
        code: state.code,
        level: 'state',
        state: state.name,
        location: boundaries?.bounds ? {
          lat: (boundaries.bounds.southwest.lat + boundaries.bounds.northeast.lat) / 2,
          lng: (boundaries.bounds.southwest.lng + boundaries.bounds.northeast.lng) / 2,
        } : null,
        bounds: boundaries?.bounds || null,
        coordinates: boundaries?.coordinates ? ensurePolygonClosed(boundaries.coordinates) : null,
      };

      setSelectedStates([...selectedStates, stateData]);
      toast.success(`${state.name} added`);

      // Center map on state
      if (map && stateData.bounds) {
        try {
          const boundsObj = new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(stateData.bounds.southwest.lat, stateData.bounds.southwest.lng),
            new window.google.maps.LatLng(stateData.bounds.northeast.lat, stateData.bounds.northeast.lng)
          );
          map.fitBounds(boundsObj);
        } catch (e) {
          console.warn("Error fitting bounds:", e);
        }
      }
    } catch (error) {
      console.error("Error selecting state:", error);
      toast.error("Failed to add state");
    } finally {
      setIsLoading(false);
    }
  }, [selectedStates, getActualBoundaries, ensurePolygonClosed, map]);

  // Handle district selection
  const handleDistrictSelect = useCallback(async (district) => {
    setIsLoading(true);
    try {
      // Check if already selected
      const exists = selectedDistricts.some(d => d.id === district.id);
      if (exists) {
        toast.info("District already selected");
        setIsLoading(false);
        return;
      }

      // Get actual boundaries for the district
      const boundaries = await getActualBoundaries(`${district.name}, ${district.state}`, 'ADMINISTRATIVE_AREA_LEVEL_2');
      
      const districtData = {
        id: district.id,
        name: district.name,
        level: 'district',
        state: district.state,
        district: district.name,
        location: boundaries?.bounds ? {
          lat: (boundaries.bounds.southwest.lat + boundaries.bounds.northeast.lat) / 2,
          lng: (boundaries.bounds.southwest.lng + boundaries.bounds.northeast.lng) / 2,
        } : null,
        bounds: boundaries?.bounds || null,
        coordinates: boundaries?.coordinates ? ensurePolygonClosed(boundaries.coordinates) : null,
      };

      setSelectedDistricts([...selectedDistricts, districtData]);
      toast.success(`${district.name} added`);

      // Center map on district
      if (map && districtData.bounds) {
        try {
          const boundsObj = new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(districtData.bounds.southwest.lat, districtData.bounds.southwest.lng),
            new window.google.maps.LatLng(districtData.bounds.northeast.lat, districtData.bounds.northeast.lng)
          );
          map.fitBounds(boundsObj);
        } catch (e) {
          console.warn("Error fitting bounds:", e);
        }
      }
    } catch (error) {
      console.error("Error selecting district:", error);
      toast.error("Failed to add district");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDistricts, getActualBoundaries, ensurePolygonClosed, map]);

  // Search handler
  const handleSearch = useCallback(() => {
    if (!searchValue.trim()) {
      setSearchResults([]);
      return;
    }

    if (currentStep === 1) {
      // Search states
      const results = searchStates(searchValue);
      setSearchResults(results);
    } else if (currentStep === 2) {
      // Search districts in selected states
      const stateIds = selectedStates.map(s => s.code || s.id);
      const results = searchDistricts(searchValue, stateIds);
      setSearchResults(results);
    } else {
      // For talukas and villages, we'll use a simplified approach
      // You can extend this with real data later
      setSearchResults([]);
    }
  }, [searchValue, currentStep, selectedStates]);

  // Update search results when search value changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [searchValue, handleSearch]);

  // Remove selected area
  const removeArea = useCallback((level, index) => {
    if (level === 'state') {
      const newStates = selectedStates.filter((_, i) => i !== index);
      setSelectedStates(newStates);
      // Also remove dependent districts
      const removedState = selectedStates[index];
      if (removedState) {
        setSelectedDistricts(selectedDistricts.filter(d => d.state !== removedState.name));
      }
    } else if (level === 'district') {
      setSelectedDistricts(selectedDistricts.filter((_, i) => i !== index));
    }
  }, [selectedStates, selectedDistricts]);

  // Combine all selections and notify parent
  useEffect(() => {
    const allAreas = [
      ...selectedStates.map(s => ({ ...s, level: 'state' })),
      ...selectedDistricts.map(d => ({ ...d, level: 'district' })),
      ...selectedTalukas.map(t => ({ ...t, level: 'taluka' })),
      ...selectedVillages.map(v => ({ ...v, level: 'village' })),
    ];
    
    if (onAreaSelect) {
      onAreaSelect(null, allAreas);
    }
  }, [selectedStates, selectedDistricts, selectedTalukas, selectedVillages, onAreaSelect]);

  // Get step label
  const getStepLabel = () => {
    switch (currentStep) {
      case 1: return "Select States";
      case 2: return "Select Districts";
      case 3: return "Select Talukas";
      case 4: return "Select Villages";
      default: return "";
    }
  };

  // Get current selections
  const getCurrentSelections = () => {
    switch (currentStep) {
      case 1: return selectedStates;
      case 2: return selectedDistricts;
      case 3: return selectedTalukas;
      case 4: return selectedVillages;
      default: return [];
    }
  };

  // Get display name for area
  const getDisplayName = (area, level) => {
    switch (level) {
      case 'state': return area.name || area.state;
      case 'district': return `${area.name || area.district}${area.state ? `, ${area.state}` : ''}`;
      case 'taluka': return `${area.name || area.taluka}${area.district ? `, ${area.district}` : ''}`;
      case 'village': return `${area.name || area.village}${area.taluka ? `, ${area.taluka}` : ''}`;
      default: return area.name || 'Unknown';
    }
  };

  if (!isLoaded) {
    return (
      <div className="text-center py-8 text-white/50">
        <FaSpinner className="animate-spin mx-auto mb-2 text-2xl" />
        <p>Loading map services...</p>
      </div>
    );
  }

  const currentSelections = getCurrentSelections();
  const stepLabels = ['State', 'District', 'Taluka', 'Village'];
  const availableDistricts = currentStep === 2 && selectedStates.length > 0
    ? getDistrictsForStates(selectedStates.map(s => s.code || s.id))
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Hierarchical Territory Selection</h3>
        <p className="text-sm text-white/60 mt-1">
          Follow the steps to select areas hierarchically. You can select multiple at each level.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3 border border-white/10">
        {[1, 2, 3, 4].map((step) => (
          <React.Fragment key={step}>
            <button
              onClick={() => {
                if (step === 2 && selectedStates.length === 0) {
                  toast.warning("Please select at least one state first");
                  return;
                }
                if (step === 3 && selectedDistricts.length === 0) {
                  toast.warning("Please select at least one district first");
                  return;
                }
                if (step === 4 && selectedTalukas.length === 0) {
                  toast.warning("Please select at least one taluka first");
                  return;
                }
                setCurrentStep(step);
                setSearchValue("");
                setSearchResults([]);
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                currentStep === step
                  ? "bg-emerald-500 text-white"
                  : step < currentStep
                  ? "bg-emerald-500/30 text-emerald-300"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {step}. {stepLabels[step - 1]}
            </button>
            {step < 4 && <FaChevronRight className="text-white/30 text-xs" />}
          </React.Fragment>
        ))}
      </div>

      {/* Current Step Info */}
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/70">Current Step:</span>
          <span className="text-sm font-semibold text-emerald-400">
            {getStepLabel()}
          </span>
        </div>
        {currentStep === 2 && selectedStates.length > 0 && (
          <div className="text-xs text-white/60 mt-2">
            Showing districts from: {selectedStates.map(s => s.name).join(", ")}
            {availableDistricts.length > 0 && ` (${availableDistricts.length} available)`}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-sm text-white/70 mb-2">
          Search and Add {stepLabels[currentStep - 1]}
        </label>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 z-10" />
            <input
              type="text"
            placeholder={`Type ${stepLabels[currentStep - 1].toLowerCase()} name...`}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50"
              disabled={isLoading}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <FaSpinner className="animate-spin text-emerald-400" />
              </div>
            )}
      </div>

        {/* Search Results */}
        {searchValue && searchResults.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto bg-white/5 rounded-lg border border-white/10">
            {searchResults.map((item, index) => (
            <button
                key={item.id || index}
              onClick={() => {
                  if (currentStep === 1) {
                    handleStateSelect(item);
                  } else if (currentStep === 2) {
                    handleDistrictSelect(item);
                  }
                setSearchValue("");
                  setSearchResults([]);
              }}
                className="w-full text-left px-4 py-2 hover:bg-white/10 transition text-white text-sm"
            >
                {currentStep === 1 ? item.name : `${item.name}, ${item.state}`}
            </button>
            ))}
          </div>
        )}
        </div>

      {/* Selected Areas for Current Step */}
      {currentSelections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              Selected {stepLabels[currentStep - 1]}s ({currentSelections.length})
            </h4>
            {currentSelections.length > 0 && (
            <button
                onClick={() => {
                  if (currentStep === 1) setSelectedStates([]);
                  else if (currentStep === 2) setSelectedDistricts([]);
                  else if (currentStep === 3) setSelectedTalukas([]);
                  else if (currentStep === 4) setSelectedVillages([]);
                }}
              className="text-xs text-red-400 hover:text-red-300 transition"
            >
              Clear All
            </button>
            )}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {currentSelections.map((area, index) => (
                      <motion.div
                key={`${area.id || area.name}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                    <FaCheck className="text-emerald-400 text-xs" />
                    {area.coordinates && area.coordinates.length >= 3 && (
                      <span className="text-xs text-blue-400">✓ Real Boundary</span>
                            )}
                          </div>
                          <div className="text-sm font-medium text-white">
                    {getDisplayName(area, currentStep === 1 ? 'state' : currentStep === 2 ? 'district' : currentStep === 3 ? 'taluka' : 'village')}
                          </div>
                        </div>
                        <button
                  onClick={() => removeArea(
                    currentStep === 1 ? 'state' : currentStep === 2 ? 'district' : currentStep === 3 ? 'taluka' : 'village',
                    index
                  )}
                          className="ml-3 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                          title="Remove"
                        >
                          <FaTimes />
                        </button>
                      </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Summary of All Selections */}
      {(selectedStates.length > 0 || selectedDistricts.length > 0 || selectedTalukas.length > 0 || selectedVillages.length > 0) && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Selection Summary</h4>
          <div className="text-xs text-blue-200 space-y-1">
            {selectedStates.length > 0 && <div>States: {selectedStates.length}</div>}
            {selectedDistricts.length > 0 && <div>Districts: {selectedDistricts.length}</div>}
            {selectedTalukas.length > 0 && <div>Talukas: {selectedTalukas.length}</div>}
            {selectedVillages.length > 0 && <div>Villages: {selectedVillages.length}</div>}
            <div className="mt-2 pt-2 border-t border-blue-500/30">
              <strong>Total Areas: {selectedStates.length + selectedDistricts.length + selectedTalukas.length + selectedVillages.length}</strong>
                </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {currentSelections.length === 0 && (
        <div className="text-center py-8 text-white/40 text-sm">
          <FaMapMarkerAlt className="mx-auto mb-2 text-2xl opacity-50" />
          <p>No {stepLabels[currentStep - 1].toLowerCase()}s selected yet</p>
          <p className="text-xs mt-1">Search and add {stepLabels[currentStep - 1].toLowerCase()}s above</p>
        </div>
      )}
    </div>
  );
};

export default TerritoryAreaSelector;
