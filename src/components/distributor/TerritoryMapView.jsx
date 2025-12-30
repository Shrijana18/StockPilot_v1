import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Autocomplete } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";

const GOOGLE_MAPS_API_KEY = "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";
// IMPORTANT: Must match libraries used in TerritoryManagement to avoid loader conflicts
// Using union of all needed libraries across components
const GOOGLE_MAPS_LIBRARIES = ["drawing", "places"];

const mapContainerStyle = {
  width: "100%",
  height: "650px",
  borderRadius: "16px",
};

const defaultCenter = { lat: 20.5937, lng: 78.9629 };
const defaultZoom = 5;

// Helper: Create custom marker icon SVG with retailer initial - BIGGER SIZE
const createRetailerMarkerIcon = (name, color = "#10b981") => {
  const initial = name ? name.charAt(0).toUpperCase() : "R";
  const svg = `
    <svg width="60" height="78" viewBox="0 0 60 78" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow-${initial}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="3" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="grad-${initial}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color}dd;stop-opacity:1" />
        </linearGradient>
      </defs>
      <!-- Pin shadow -->
      <ellipse cx="30" cy="72" rx="12" ry="4" fill="#000" opacity="0.25"/>
      <!-- Pin body with gradient -->
      <path d="M30 0 C18.405 0 9 9.405 9 21 C9 33 30 60 30 60 C30 60 51 33 51 21 C51 9.405 41.595 0 30 0 Z" 
            fill="url(#grad-${initial})" 
            stroke="#ffffff" 
            stroke-width="3"
            filter="url(#shadow-${initial})"/>
      <!-- Initial circle with glow -->
      <circle cx="30" cy="27" r="15" fill="#ffffff" filter="url(#shadow-${initial})"/>
      <text x="30" y="33" font-family="Arial, sans-serif" font-size="20" font-weight="bold" 
            text-anchor="middle" fill="${color}">${initial}</text>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(60, 78),
    anchor: new window.google.maps.Point(30, 78),
  };
};

export default function TerritoryMapView({ distributorId }) {
  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script', // Same ID as TerritoryManagement to share loader
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  
  const [retailers, setRetailers] = useState([]);
  const [retailersWithCoords, setRetailersWithCoords] = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [editingRetailer, setEditingRetailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(defaultZoom);
  const [searchAddress, setSearchAddress] = useState("");
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [distributorTerritories, setDistributorTerritories] = useState([]); // Changed to array
  const [showTerritoryManager, setShowTerritoryManager] = useState(false);
  const [territorySearchAddress, setTerritorySearchAddress] = useState("");
  
  const geocoderRef = useRef(null);
  const mapRef = useRef(null);
  const clustererRef = useRef(null);
  const markersRef = useRef([]);
  const autocompleteRef = useRef(null);
  const tempMarkerRef = useRef(null);
  const territoryAutocompleteRef = useRef(null);
  const territoryMarkersRef = useRef([]); // Changed to array

  // Load distributor territories (support both single and array for backward compatibility)
  useEffect(() => {
    if (!distributorId) return;
    
    const loadTerritories = async () => {
      try {
        const distributorRef = doc(db, "businesses", distributorId);
        const snap = await getDoc(distributorRef);
        if (snap.exists()) {
          const data = snap.data();
          let territories = [];
          
          // Support both old single territory and new array format
          if (data.territories && Array.isArray(data.territories)) {
            // New format: array of territories
            territories = data.territories.map(t => ({
              id: t.id || Date.now().toString(),
              center: { lat: t.center.lat, lng: t.center.lng },
              zoom: t.zoom || 10,
              name: t.name || null,
            }));
          } else if (data.territoryCenter && data.territoryZoom) {
            // Old format: single territory - migrate to array
            territories = [{
              id: "legacy-" + Date.now(),
              center: { lat: data.territoryCenter.lat, lng: data.territoryCenter.lng },
              zoom: data.territoryZoom,
              name: data.territoryName || null,
            }];
          }
          
          setDistributorTerritories(territories);
          
          // Set map center to first territory or fallback
          if (territories.length > 0) {
            setMapCenter(territories[0].center);
            setMapZoom(territories[0].zoom);
          }
        }
      } catch (error) {
        console.error("Error loading territories:", error);
      }
    };
    
    loadTerritories();
  }, [distributorId]);

  // Load retailers
  useEffect(() => {
    if (!distributorId) {
      setLoading(false);
      return;
    }

    const collRef = collection(db, "businesses", distributorId, "connectedRetailers");
    const qRef = query(collRef, where("status", "in", ["accepted", "provisioned", "provisioned-local"]));
    
    const unsubscribe = onSnapshot(qRef, (snap) => {
      const retailerList = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: data.retailerId || d.id,
          docId: d.id,
          businessName: data.retailerName || "Retailer",
          email: data.retailerEmail || "",
          phone: data.retailerPhone || "",
          address: data.retailerAddress || data.address || "",
          city: data.retailerCity || data.city || "",
          state: data.retailerState || data.state || "",
          status: data.status || "provisioned",
          lat: data.lat || null,
          lng: data.lng || null,
          formattedAddress: data.formattedAddress || null,
        };
      });
      setRetailers(retailerList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching retailers:", error);
      toast.error("Failed to load retailers");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [distributorId]);

  // Process retailers: show saved coords immediately, geocode others
  useEffect(() => {
    if (retailers.length === 0) {
      setRetailersWithCoords([]);
      return;
    }

    const withSavedCoords = retailers.filter(r => r.lat && r.lng).map(r => ({
      ...r,
      formattedAddress: r.formattedAddress || buildAddressString(r),
    }));

    setRetailersWithCoords(withSavedCoords);

    // Auto-fit to territories or retailers
    if (distributorTerritories.length > 0) {
      const firstTerritory = distributorTerritories[0];
      setMapCenter(firstTerritory.center);
      setMapZoom(firstTerritory.zoom);
    } else if (withSavedCoords.length > 0) {
      fitMapToRetailers(withSavedCoords);
    }

    // Background geocoding
    const needsGeocoding = retailers.filter(r => !r.lat && !r.lng && (r.address || r.city || r.state));
    if (needsGeocoding.length > 0 && geocoderRef.current) {
      geocodeRetailers(needsGeocoding);
    }
  }, [retailers, distributorTerritories]);

  const buildAddressString = (retailer) => {
    const parts = [];
    if (retailer.address) parts.push(retailer.address);
    if (retailer.city) parts.push(retailer.city);
    if (retailer.state) parts.push(retailer.state);
    if (parts.length === 0) return null;
    if (!retailer.address && retailer.city && retailer.state) {
      return `${retailer.city}, ${retailer.state}, India`;
    }
    return parts.join(", ") + ", India";
  };

  const geocodeAddress = (address, geocoder) => {
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address, region: "IN" }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            formattedAddress: results[0].formatted_address,
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  };

  const geocodeRetailers = async (retailersToGeocode) => {
    setGeocoding(true);
    const geocoded = [];

    for (const retailer of retailersToGeocode) {
      try {
        const address = buildAddressString(retailer);
        if (!address) continue;

        const result = await geocodeAddress(address, geocoderRef.current);
        if (result) {
          geocoded.push({
            ...retailer,
            lat: result.lat,
            lng: result.lng,
            formattedAddress: result.formattedAddress,
          });
        }
      } catch (error) {
        console.error(`Geocoding failed for ${retailer.businessName}:`, error);
      }
    }

    setRetailersWithCoords((prev) => {
      const merged = [...prev];
      geocoded.forEach((newRetailer) => {
        const existingIndex = merged.findIndex(r => r.id === newRetailer.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newRetailer;
        } else {
          merged.push(newRetailer);
        }
      });
      return merged;
    });

    setGeocoding(false);
  };

  const fitMapToRetailers = (retailersWithCoords) => {
    if (retailersWithCoords.length === 0) return;
    if (retailersWithCoords.length === 1) {
      setMapCenter({ lat: retailersWithCoords[0].lat, lng: retailersWithCoords[0].lng });
      setMapZoom(12);
      return;
    }

    const lats = retailersWithCoords.map((r) => r.lat);
    const lngs = retailersWithCoords.map((r) => r.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    setMapCenter({ lat: centerLat, lng: centerLng });

    const latDiff = Math.max(...lats) - Math.min(...lats);
    const lngDiff = Math.max(...lngs) - Math.min(...lngs);
    const maxDiff = Math.max(latDiff, lngDiff);
    let zoom = 5;
    if (maxDiff < 0.01) zoom = 12;
    else if (maxDiff < 0.05) zoom = 10;
    else if (maxDiff < 0.1) zoom = 8;
    else if (maxDiff < 0.5) zoom = 6;
    setMapZoom(zoom);
  };

  // Function to update territory markers - defined before useCallback to avoid reference issues
  const updateTerritoryMarkers = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;
    
    // Clear existing markers
    territoryMarkersRef.current.forEach(marker => marker.setMap(null));
    territoryMarkersRef.current = [];
    
    // Add markers for each territory
    distributorTerritories.forEach((territory, index) => {
      const marker = new window.google.maps.Marker({
        position: territory.center,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6",
          fillOpacity: 0.8,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 15,
        },
        title: territory.name || `Territory ${index + 1}`,
        zIndex: 1000,
      });
      territoryMarkersRef.current.push(marker);
    });
  }, [distributorTerritories]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();
    
    // Add territory markers for all territories
    if (distributorTerritories.length > 0 && mapRef.current) {
      updateTerritoryMarkers();
    }
  }, [distributorTerritories, updateTerritoryMarkers]);

  // Update markers when territories change
  useEffect(() => {
    if (mapRef.current && distributorTerritories.length > 0) {
      updateTerritoryMarkers();
    }
  }, [distributorTerritories, updateTerritoryMarkers]);

  const onPlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    
    if (place.geometry && mapRef.current) {
      const location = place.geometry.location;
      const newCenter = { lat: location.lat(), lng: location.lng() };
      setMapCenter(newCenter);
      setMapZoom(15);
      
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setPosition(newCenter);
      } else {
        tempMarkerRef.current = new window.google.maps.Marker({
          position: newCenter,
          map: mapRef.current,
          draggable: true,
          title: "Drag to adjust",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
            scale: 10,
          },
        });
        
        tempMarkerRef.current.addListener("dragend", () => {
          const pos = tempMarkerRef.current.getPosition();
          setMapCenter({ lat: pos.lat(), lng: pos.lng() });
        });
      }
      setSearchAddress(place.formatted_address || "");
    }
  }, []);

  const onMapClick = useCallback((e) => {
    if (!showLocationEditor || !editingRetailer) return;
    
    const location = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    
    if (tempMarkerRef.current) {
      tempMarkerRef.current.setPosition(location);
    } else if (mapRef.current) {
      tempMarkerRef.current = new window.google.maps.Marker({
        position: location,
        map: mapRef.current,
        draggable: true,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 10,
        },
      });
      
      tempMarkerRef.current.addListener("dragend", () => {
        const pos = tempMarkerRef.current.getPosition();
        setMapCenter({ lat: pos.lat(), lng: pos.lng() });
      });
    }
    
    setMapCenter(location);
    
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ location }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          setSearchAddress(results[0].formatted_address);
        }
      });
    }
  }, [showLocationEditor, editingRetailer]);

  const saveLocation = async () => {
    if (!editingRetailer || !tempMarkerRef.current) {
      toast.error("Please select a location first");
      return;
    }

    const pos = tempMarkerRef.current.getPosition();
    try {
      const retailerDocRef = doc(db, "businesses", distributorId, "connectedRetailers", editingRetailer.docId);
      
      const updateData = {
        lat: pos.lat(),
        lng: pos.lng(),
        formattedAddress: searchAddress || editingRetailer.formattedAddress || null,
        locationUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(retailerDocRef, updateData);

      toast.success("✅ Location saved successfully!");
      setShowLocationEditor(false);
      setEditingRetailer(null);
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setMap(null);
        tempMarkerRef.current = null;
      }
      setSearchAddress("");
    } catch (error) {
      console.error("Error saving location:", error);
      toast.error("Failed to save. Please check permissions.");
    }
  };

  const saveTerritory = async () => {
    if (!tempMarkerRef.current || !distributorId) {
      toast.error("Please set your territory location first");
      return;
    }

    const pos = tempMarkerRef.current.getPosition();
    const currentZoom = mapRef.current?.getZoom() || 10;
    
    try {
      const newTerritory = {
        id: Date.now().toString(),
        center: { lat: pos.lat(), lng: pos.lng() },
        zoom: currentZoom,
        name: territorySearchAddress || null,
      };
      
      // Add to existing territories array
      const updatedTerritories = [...distributorTerritories, newTerritory];
      
      const distributorRef = doc(db, "businesses", distributorId);
      await updateDoc(distributorRef, {
        territories: updatedTerritories.map(t => ({
          id: t.id,
          center: t.center,
          zoom: t.zoom,
          name: t.name,
        })),
        territoryUpdatedAt: serverTimestamp(),
        // Remove old single territory fields if they exist
        territoryCenter: deleteField(),
        territoryZoom: deleteField(),
        territoryName: deleteField(),
      });

      setDistributorTerritories(updatedTerritories);
      updateTerritoryMarkers();
      
      toast.success(`✅ Territory "${newTerritory.name || 'added'}" saved!`);
      setShowTerritoryManager(false);
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setMap(null);
        tempMarkerRef.current = null;
      }
      setTerritorySearchAddress("");
    } catch (error) {
      console.error("Error saving territory:", error);
      toast.error("Failed to save territory");
    }
  };

  const removeTerritory = async (territoryId) => {
    if (!distributorId || !territoryId) return;
    
    try {
      const updatedTerritories = distributorTerritories.filter(t => t.id !== territoryId);
      
      const distributorRef = doc(db, "businesses", distributorId);
      if (updatedTerritories.length === 0) {
        // Remove all territory data
        await updateDoc(distributorRef, {
          territories: deleteField(),
          territoryCenter: deleteField(),
          territoryZoom: deleteField(),
          territoryName: deleteField(),
          territoryUpdatedAt: deleteField(),
        });
      } else {
        await updateDoc(distributorRef, {
          territories: updatedTerritories.map(t => ({
            id: t.id,
            center: t.center,
            zoom: t.zoom,
            name: t.name,
          })),
          territoryUpdatedAt: serverTimestamp(),
        });
      }

      setDistributorTerritories(updatedTerritories);
      updateTerritoryMarkers();
      toast.success("✅ Territory removed");
    } catch (error) {
      console.error("Error removing territory:", error);
      toast.error("Failed to remove territory");
    }
  };

  const openLocationEditor = (retailer) => {
    setEditingRetailer(retailer);
    setShowLocationEditor(true);
    
    if (retailer.lat && retailer.lng) {
      setMapCenter({ lat: retailer.lat, lng: retailer.lng });
      setMapZoom(15);
      
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setMap(null);
      }
      if (mapRef.current) {
        tempMarkerRef.current = new window.google.maps.Marker({
          position: { lat: retailer.lat, lng: retailer.lng },
          map: mapRef.current,
          draggable: true,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
            scale: 10,
          },
        });
        
        tempMarkerRef.current.addListener("dragend", () => {
          const pos = tempMarkerRef.current.getPosition();
          setMapCenter({ lat: pos.lat(), lng: pos.lng() });
        });
      }
      setSearchAddress(retailer.formattedAddress || "");
    } else {
      setMapCenter(distributorTerritories.length > 0 ? distributorTerritories[0].center : defaultCenter);
      setMapZoom(distributorTerritories.length > 0 ? distributorTerritories[0].zoom : 10);
    }
  };

  const openTerritoryManager = () => {
    setShowTerritoryManager(true);
    if (distributorTerritories.length > 0) {
      const firstTerritory = distributorTerritories[0];
      setMapCenter(firstTerritory.center);
      setMapZoom(firstTerritory.zoom);
      setTerritorySearchAddress(firstTerritory.name || "");
      
      if (mapRef.current && firstTerritory.center) {
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setMap(null);
        }
        tempMarkerRef.current = new window.google.maps.Marker({
          position: firstTerritory.center,
          map: mapRef.current,
          draggable: true,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 4,
            scale: 15,
          },
        });
        
        tempMarkerRef.current.addListener("dragend", () => {
          const pos = tempMarkerRef.current.getPosition();
          setMapCenter({ lat: pos.lat(), lng: pos.lng() });
        });
      }
    } else {
      setMapCenter(defaultCenter);
      setMapZoom(5);
      setTerritorySearchAddress("");
    }
  };

  // Setup markers with custom icons
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || retailersWithCoords.length === 0 || showLocationEditor || showTerritoryManager) {
      return;
    }

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Create markers with custom icons
    const markers = retailersWithCoords.map((retailer, index) => {
      // Alternate colors for visual variety
      const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
      const color = colors[index % colors.length];
      const icon = createRetailerMarkerIcon(retailer.businessName, color);
      
      const marker = new window.google.maps.Marker({
        position: { lat: retailer.lat, lng: retailer.lng },
        map: mapRef.current,
        title: retailer.businessName,
        icon: icon,
      });

      marker.addListener("click", () => {
        setSelectedRetailer(retailer);
      });

      return marker;
    });

    markersRef.current = markers;

    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers: markers,
    });

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [retailersWithCoords, showLocationEditor, showTerritoryManager]);

  const retailersNeedingLocation = useMemo(() => {
    return retailers.filter(r => !r.lat || !r.lng);
  }, [retailers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] text-white/70">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500/30 border-t-emerald-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading territory view...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Territory Management</h2>
          <p className="text-sm text-white/60">Visualize and manage your retailer network on the map</p>
        </div>
        <button
          onClick={openTerritoryManager}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all duration-200 transform hover:scale-105"
        >
          {distributorTerritories.length > 0 ? `📍 Manage Territories (${distributorTerritories.length})` : "📍 Set Territory"}
        </button>
      </div>

      {/* Premium Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl p-5 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-white/60 font-medium">Total Retailers</div>
            <div className="text-2xl">🏪</div>
          </div>
          <div className="text-3xl font-bold text-white">{retailers.length}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-xl p-5 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-emerald-200/80 font-medium">With Location</div>
            <div className="text-2xl">✅</div>
          </div>
          <div className="text-3xl font-bold text-emerald-400">{retailersWithCoords.length}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-xl p-5 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-amber-200/80 font-medium">Need Location</div>
            <div className="text-2xl">⚠️</div>
          </div>
          <div className="text-3xl font-bold text-amber-400">{retailersNeedingLocation.length}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-xl p-5 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-cyan-200/80 font-medium">Territory</div>
            <div className="text-2xl">{distributorTerritories.length > 0 ? "📍" : "❌"}</div>
          </div>
          <div className="text-lg font-bold text-cyan-400">
            {distributorTerritories.length > 0 ? `${distributorTerritories.length} Set` : "Not Set"}
          </div>
        </motion.div>
      </div>

      {/* Territory Info Cards - Show all territories */}
      {distributorTerritories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {distributorTerritories.map((territory, index) => (
            <motion.div
              key={territory.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 backdrop-blur-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-blue-200 truncate">
                      Territory {index + 1}: {territory.name || "Unnamed territory"}
                    </div>
                    <div className="text-xs text-blue-200/70">
                      {territory.center.lat.toFixed(4)}, {territory.center.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeTerritory(territory.id)}
                  className="ml-3 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-medium transition flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Map Container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-xl p-5 shadow-2xl"
      >
        {/* Location Editor Search Bar */}
        {showLocationEditor && editingRetailer && isMapLoaded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-5 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 backdrop-blur-xl"
          >
            <div className="text-sm font-semibold text-blue-200 mb-3 flex items-center gap-2">
              <span className="text-xl">📍</span>
              Set Location: {editingRetailer.businessName}
            </div>
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={onPlaceChanged}
              options={{
                componentRestrictions: { country: "in" },
                types: ["address"],
              }}
            >
              <input
                type="text"
                placeholder="🔍 Search address or click on map..."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className="w-full rounded-xl bg-white/10 border-2 border-blue-500/30 text-white placeholder-white/50 px-5 py-3 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition"
              />
            </Autocomplete>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-blue-200/70 flex items-center gap-2">
                <span>💡</span>
                <span>Click map or search, then drag marker to adjust</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowLocationEditor(false);
                    setEditingRetailer(null);
                    if (tempMarkerRef.current) {
                      tempMarkerRef.current.setMap(null);
                      tempMarkerRef.current = null;
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveLocation}
                  disabled={!tempMarkerRef.current}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 transition transform hover:scale-105"
                >
                  ✅ Save Location
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Map Loading/Error States */}
        {loadError && (
          <div className="flex items-center justify-center h-[650px] text-red-400 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="text-center p-6">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-lg font-semibold mb-2">Failed to load Google Maps</p>
              <p className="text-sm text-red-300">{loadError.message}</p>
            </div>
          </div>
        )}
        
        {!isMapLoaded && !loadError && (
          <div className="flex items-center justify-center h-[650px] text-white/70 rounded-xl bg-white/5">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500/30 border-t-emerald-500 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Loading map...</p>
            </div>
          </div>
        )}

        {/* Map */}
        {isMapLoaded && (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={onMapLoad}
            onClick={onMapClick}
            options={{
              styles: [
                {
                  featureType: "poi",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }],
                },
                // Keep natural colorful Google Maps style - only hide POI labels
              ],
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
            }}
          >
            {selectedRetailer && !showLocationEditor && (
              <InfoWindow
                position={{ lat: selectedRetailer.lat, lng: selectedRetailer.lng }}
                onCloseClick={() => setSelectedRetailer(null)}
                options={{
                  pixelOffset: new window.google.maps.Size(0, -10),
                }}
              >
                <div className="p-4 min-w-[260px] max-w-[320px]">
                  <h3 className="font-bold text-lg text-slate-900 mb-3 pr-6">{selectedRetailer.businessName}</h3>
                  
                  {selectedRetailer.formattedAddress && (
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed">{selectedRetailer.formattedAddress}</p>
                    </div>
                  )}
                  
                  <div className="space-y-2 mb-4">
                    {selectedRetailer.email && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-base">📧</span>
                        <span className="truncate">{selectedRetailer.email}</span>
                      </div>
                    )}
                    {selectedRetailer.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-base">📞</span>
                        <span>{selectedRetailer.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedRetailer(null);
                      openLocationEditor(selectedRetailer);
                    }}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                  >
                    📍 Update Location
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </motion.div>

      {/* Retailers Needing Location - Premium Design */}
      {retailersNeedingLocation.length > 0 && !showLocationEditor && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 backdrop-blur-xl p-5 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <div className="text-lg font-semibold text-amber-200">
                Retailers Needing Location ({retailersNeedingLocation.length})
              </div>
              <div className="text-xs text-amber-200/70">Set locations to visualize them on the map</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {retailersNeedingLocation.map((retailer) => (
              <motion.div
                key={retailer.id}
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">{retailer.businessName}</div>
                  <div className="text-xs text-white/60 truncate mt-1">
                    {retailer.city && retailer.state ? `${retailer.city}, ${retailer.state}` : "No address"}
                  </div>
                </div>
                <button
                  onClick={() => openLocationEditor(retailer)}
                  className="ml-3 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition transform hover:scale-105 whitespace-nowrap"
                >
                  Set Location
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Territory Manager Modal */}
      <AnimatePresence>
        {showTerritoryManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={() => {
              setShowTerritoryManager(false);
              if (tempMarkerRef.current) {
                tempMarkerRef.current.setMap(null);
                tempMarkerRef.current = null;
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-3xl border border-white/20 p-8 max-w-3xl w-[95%] max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    📍 Manage Territories ({distributorTerritories.length})
                  </h3>
                  <p className="text-sm text-white/60">
                    Add multiple territories for your business operation areas. Map will zoom to your territories automatically.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTerritoryManager(false);
                    if (tempMarkerRef.current) {
                      tempMarkerRef.current.setMap(null);
                      tempMarkerRef.current = null;
                    }
                  }}
                  className="text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>

              {isMapLoaded && (
                <div className="mb-6">
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      territoryAutocompleteRef.current = autocomplete;
                    }}
                    onPlaceChanged={() => {
                      if (territoryAutocompleteRef.current && mapRef.current) {
                        const place = territoryAutocompleteRef.current.getPlace();
                        if (place.geometry) {
                          const location = place.geometry.location;
                          const newCenter = { lat: location.lat(), lng: location.lng() };
                          setMapCenter(newCenter);
                          setMapZoom(12);
                          setTerritorySearchAddress(place.formatted_address || place.name || "");
                          if (tempMarkerRef.current) {
                            tempMarkerRef.current.setPosition(newCenter);
                          } else if (mapRef.current) {
                            tempMarkerRef.current = new window.google.maps.Marker({
                              position: newCenter,
                              map: mapRef.current,
                              draggable: true,
                              icon: {
                                path: window.google.maps.SymbolPath.CIRCLE,
                                fillColor: "#3b82f6",
                                fillOpacity: 1,
                                strokeColor: "#ffffff",
                                strokeWeight: 4,
                                scale: 15,
                              },
                            });
                            
                            tempMarkerRef.current.addListener("dragend", () => {
                              const pos = tempMarkerRef.current.getPosition();
                              setMapCenter({ lat: pos.lat(), lng: pos.lng() });
                            });
                          }
                        }
                      }
                    }}
                    options={{
                      componentRestrictions: { country: "in" },
                      types: ["(cities)"],
                    }}
                  >
                    <input
                      type="text"
                      placeholder="🔍 Search your city or area..."
                      value={territorySearchAddress}
                      onChange={(e) => setTerritorySearchAddress(e.target.value)}
                      className="w-full rounded-xl bg-white/10 border-2 border-blue-500/30 text-white placeholder-white/50 px-5 py-3 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition"
                    />
                  </Autocomplete>
                  <div className="text-xs text-white/60 mt-2 flex items-center gap-2">
                    <span>💡</span>
                    <span>Search for your area or click on the map below, then drag the blue marker to adjust</span>
                  </div>
                </div>
              )}

              {/* Existing Territories List */}
              {distributorTerritories.length > 0 && (
                <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white mb-3">Current Territories ({distributorTerritories.length}):</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {distributorTerritories.map((territory, index) => (
                      <div
                        key={territory.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {index + 1}. {territory.name || `Territory ${index + 1}`}
                          </div>
                          <div className="text-xs text-white/60">
                            {territory.center.lat.toFixed(4)}, {territory.center.lng.toFixed(4)}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove territory "${territory.name || `Territory ${index + 1}`}"?`)) {
                              removeTerritory(territory.id);
                            }
                          }}
                          className="ml-3 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-medium transition flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="text-sm text-blue-200/90">
                    <div className="font-semibold mb-2">How Multiple Territories Work:</div>
                    <ul className="space-y-1 text-xs">
                      <li>• Add multiple cities/areas as territories</li>
                      <li>• Map automatically zooms to your first territory when opened</li>
                      <li>• All territories are shown with blue markers on the map</li>
                      <li>• You can add, update, or remove territories at any time</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowTerritoryManager(false);
                    if (tempMarkerRef.current) {
                      tempMarkerRef.current.setMap(null);
                      tempMarkerRef.current = null;
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition"
                >
                  Done
                </button>
                <button
                  onClick={saveTerritory}
                  disabled={!tempMarkerRef.current}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 transition transform hover:scale-105"
                >
                  ✅ Add Territory
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
