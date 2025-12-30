import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow } from "@react-google-maps/api";
import { db, auth } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import {
  FaMapMarkerAlt,
  FaDrawPolygon,
  FaSave,
  FaTrash,
  FaEdit,
  FaUser,
  FaTimes,
  FaCheck,
  FaSearch,
  FaLayerGroup,
  FaMap,
  FaPlus,
  FaBuilding,
  FaLocationArrow,
  FaExpandArrowsAlt,
  FaCompressArrowsAlt,
  FaInfoCircle,
  FaRoute,
  FaChartArea,
  FaUndo,
  FaRedo,
  FaCopy,
  FaPaste,
} from "react-icons/fa";
import TerritoryAreaSelector from "./TerritoryAreaSelector";


const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

// Default center - India center, but will adjust based on distributor locations
const getDefaultCenter = (distributors) => {
  const locations = distributors
    .map((d) => {
      if (d.location?.latitude && d.location?.longitude) {
        return {
          lat: parseFloat(d.location.latitude),
          lng: parseFloat(d.location.longitude),
        };
      }
      return null;
    })
    .filter(Boolean);

  if (locations.length === 0) {
    return { lat: 20.5937, lng: 78.9629 }; // India center
  }

  // Calculate center of all distributor locations
  const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
  const avgLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;
  
  return { lat: avgLat, lng: avgLng };
};

// Google Maps libraries - must be constant to prevent reload warnings
// NOTE: Drawing library is deprecated by Google (Aug 2025) and will be removed May 2026
// TODO: Migrate to alternative solution when Google provides one
// IMPORTANT: Must match libraries used in other components (e.g., TerritoryMapView) to avoid loader conflicts
const MAP_LIBRARIES = ["drawing", "places"];

const TerritoryManagement = ({ distributors }) => {
  // Google Maps API key - You should move this to environment variables
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const [map, setMap] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [editingTerritory, setEditingTerritory] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingManager, setDrawingManager] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [showTerritoryForm, setShowTerritoryForm] = useState(false);
  const [territoryFormData, setTerritoryFormData] = useState({
    name: "",
    assignedDistributorId: "",
    description: "",
    color: "#10b981", // Default emerald color
  });
  const [showInfoWindow, setShowInfoWindow] = useState(null);
  const polygonRef = useRef({});
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [territoryMode, setTerritoryMode] = useState("draw"); // "draw" or "search"
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const geocoderRef = useRef(null);
  const [editingTerritoryId, setEditingTerritoryId] = useState(null);
  const [showDistributorInfo, setShowDistributorInfo] = useState(null);
  const [mapMode, setMapMode] = useState("view"); // "view", "draw", "edit"
  const [selectedTerritoryForEdit, setSelectedTerritoryForEdit] = useState(null);
  const [drawingHistory, setDrawingHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const productOwnerId = auth.currentUser?.uid;

  // Fetch territories from Firestore
  useEffect(() => {
    if (!productOwnerId) return;

    const territoriesRef = collection(db, `businesses/${productOwnerId}/territories`);
    
    const unsubscribe = onSnapshot(
      territoriesRef,
      (snapshot) => {
        const territoriesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTerritories(territoriesList);
      },
      (error) => {
        console.error("Error fetching territories:", error);
        if (error.code === 'permission-denied') {
          toast.error("Permission denied. Please check Firestore rules are deployed.");
          console.error("Firestore rules need to be deployed. Run: firebase deploy --only firestore:rules");
        } else {
          toast.error("Failed to load territories: " + (error.message || "Unknown error"));
        }
      }
    );

    return () => unsubscribe();
  }, [productOwnerId]);

  // Initialize drawing manager
  useEffect(() => {
    if (!map || !isDrawing || !isLoaded || !window.google?.maps?.drawing) return;

    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        fillColor: "#10b981",
        fillOpacity: 0.3,
        strokeColor: "#10b981",
        strokeWeight: 2,
        clickable: true,
        editable: true,
        zIndex: 1,
      },
    });

    drawingManager.setMap(map);

    const polygonCompleteHandler = (polygon) => {
      const path = polygon.getPath();
      const coordinates = path.getArray().map((latLng) => ({
        lat: latLng.lat(),
        lng: latLng.lng(),
      }));

      setCurrentPath(coordinates);
      setIsDrawing(false);
      drawingManager.setDrawingMode(null);
      setShowTerritoryForm(true);

      // Store polygon reference
      polygonRef.current[`temp-${Date.now()}`] = polygon;
    };

    window.google.maps.event.addListener(
      drawingManager,
      "polygoncomplete",
      polygonCompleteHandler
    );

    setDrawingManager(drawingManager);

    return () => {
      if (drawingManager) {
        window.google.maps.event.clearInstanceListeners(drawingManager);
        drawingManager.setMap(null);
      }
    };
  }, [map, isDrawing, isLoaded]);

  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    // Initialize geocoder for reverse geocoding
    if (window.google?.maps?.Geocoder) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  }, []);

  const startDrawing = () => {
    setIsDrawing(true);
    setCurrentPath([]);
    setShowTerritoryForm(false);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setCurrentPath([]);
    if (drawingManager) {
      drawingManager.setDrawingMode(null);
    }
    // Clear temporary polygon
    Object.values(polygonRef.current).forEach((poly) => {
      if (poly && typeof poly.setMap === 'function') {
        poly.setMap(null);
      }
    });
    polygonRef.current = {};
  };

  // Ensure polygon is properly closed for drawn territories
  const ensureDrawnPolygonClosed = useCallback((path) => {
    if (!path || path.length < 3) return path;
    
    const coords = path.map(c => ({ lat: Number(c.lat), lng: Number(c.lng) }));
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

  const saveTerritory = async () => {
    if (!territoryFormData.name.trim()) {
      toast.error("Please enter a territory name");
      return;
    }

    if (currentPath.length < 3) {
      toast.error("Territory must have at least 3 points");
      return;
    }

    if (!productOwnerId) {
      toast.error("User not authenticated");
      return;
    }

    try {
      // Ensure polygon is properly closed
      const closedPath = ensureDrawnPolygonClosed(currentPath);
      
      // Validate coordinates are numbers
      const validCoordinates = closedPath
        .map(c => ({ lat: Number(c.lat), lng: Number(c.lng) }))
        .filter(c => !isNaN(c.lat) && !isNaN(c.lng));

      if (validCoordinates.length < 3) {
        toast.error("Invalid coordinates. Please redraw the territory.");
        return;
      }

      const territoryData = {
        name: territoryFormData.name,
        description: territoryFormData.description || "",
        assignedDistributorId: territoryFormData.assignedDistributorId || null,
        assignedDistributorName:
          distributors.find((d) => d.distributorId === territoryFormData.assignedDistributorId)
            ?.businessName || null,
        coordinates: validCoordinates,
        color: territoryFormData.color,
        createdAt: serverTimestamp(),
        createdBy: productOwnerId,
        updatedAt: serverTimestamp(),
      };

      const territoriesRef = collection(db, `businesses/${productOwnerId}/territories`);
      const docRef = await addDoc(territoriesRef, territoryData);

      // Update distributor's territory assignment
      if (territoryFormData.assignedDistributorId) {
        const distributorConnectionRef = doc(
          db,
          `businesses/${productOwnerId}/connectedDistributors/${territoryFormData.assignedDistributorId}`
        );
        await updateDoc(distributorConnectionRef, {
          territory: territoryFormData.name,
          territoryId: docRef.id,
          territoryCoordinates: currentPath,
          updatedAt: serverTimestamp(),
        });
      }

      toast.success("Territory saved successfully!");
      setCurrentPath([]);
      setShowTerritoryForm(false);
      setIsDrawing(false);
      setTerritoryFormData({
        name: "",
        assignedDistributorId: "",
        description: "",
        color: "#10b981",
      });

      // Clear temporary polygon
      Object.values(polygonRef.current).forEach((poly) => {
        if (poly && typeof poly.setMap === 'function') {
          poly.setMap(null);
        }
      });
      polygonRef.current = {};
    } catch (error) {
      console.error("Error saving territory:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules are deployed.");
      } else {
        toast.error("Failed to save territory: " + (error.message || "Unknown error"));
      }
    }
  };

  const deleteTerritory = async (territoryId) => {
    if (!window.confirm("Are you sure you want to delete this territory?")) return;

    try {
      const territoryRef = doc(db, `businesses/${productOwnerId}/territories/${territoryId}`);
      await deleteDoc(territoryRef);

      // Update distributor if assigned
      const territory = territories.find((t) => t.id === territoryId);
      if (territory?.assignedDistributorId) {
        const distributorConnectionRef = doc(
          db,
          `businesses/${productOwnerId}/connectedDistributors/${territory.assignedDistributorId}`
        );
        await updateDoc(distributorConnectionRef, {
          territory: null,
          territoryId: null,
          territoryCoordinates: null,
          updatedAt: serverTimestamp(),
        });
      }

      toast.success("Territory deleted successfully!");
    } catch (error) {
      console.error("Error deleting territory:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules are deployed.");
      } else {
        toast.error("Failed to delete territory: " + (error.message || "Unknown error"));
      }
    }
  };

  // Handle area selection from TerritoryAreaSelector - simplified
  const handleAreaSelect = useCallback((area, allAreas) => {
    setSelectedAreas(allAreas);
    // Map centering is handled in TerritoryAreaSelector component itself
  }, []);

  // Ensure polygon is properly closed (first and last points are the same)
  const ensurePolygonClosed = useCallback((coordinates) => {
    if (!coordinates || coordinates.length < 3) return null;
    
    // Make a copy to avoid mutating
    const coords = coordinates.map(c => ({ lat: Number(c.lat), lng: Number(c.lng) }));
    
    // Check if first and last points are the same (within small tolerance)
    const first = coords[0];
    const last = coords[coords.length - 1];
    const tolerance = 0.0001;
    
    const isClosed = Math.abs(first.lat - last.lat) < tolerance && 
                     Math.abs(first.lng - last.lng) < tolerance;
    
    if (!isClosed) {
      // Close the polygon by adding the first point at the end
      coords.push({ lat: first.lat, lng: first.lng });
    }
    
    return coords;
  }, []);

  // Combine multiple polygon boundaries into a single unified boundary
  // Uses actual polygon coordinates from each area, not just bounding boxes
  const combinePolygonBoundaries = useCallback((areas) => {
    if (!areas || areas.length === 0) return null;

    // Collect all valid polygon coordinates from all areas
    const allPolygons = [];
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    areas.forEach((area) => {
      let coords = [];
      
      // Prefer actual coordinates if available (real boundaries)
      if (area.coordinates && Array.isArray(area.coordinates) && area.coordinates.length >= 3) {
        coords = area.coordinates
          .map(c => ({
            lat: Number(c.lat),
            lng: Number(c.lng)
          }))
          .filter(c => !isNaN(c.lat) && !isNaN(c.lng));
        
        if (coords.length >= 3) {
          allPolygons.push(coords);
          // Update bounds
          coords.forEach(coord => {
            minLat = Math.min(minLat, coord.lat);
            maxLat = Math.max(maxLat, coord.lat);
            minLng = Math.min(minLng, coord.lng);
            maxLng = Math.max(maxLng, coord.lng);
          });
        }
      } else if (area.bounds) {
        // Fallback to bounds if no coordinates
        const sw = area.bounds.southwest;
        const ne = area.bounds.northeast;
        coords = [
          { lat: Number(sw.lat), lng: Number(sw.lng) },
          { lat: Number(ne.lat), lng: Number(sw.lng) },
          { lat: Number(ne.lat), lng: Number(ne.lng) },
          { lat: Number(sw.lat), lng: Number(ne.lng) },
        ];
        allPolygons.push(coords);
        minLat = Math.min(minLat, Number(sw.lat));
        maxLat = Math.max(maxLat, Number(ne.lat));
        minLng = Math.min(minLng, Number(sw.lng));
        maxLng = Math.max(maxLng, Number(ne.lng));
      } else if (area.location) {
        // Last resort: create small square around location
        const offset = 0.01;
        coords = [
          { lat: Number(area.location.lat) - offset, lng: Number(area.location.lng) - offset },
          { lat: Number(area.location.lat) + offset, lng: Number(area.location.lng) - offset },
          { lat: Number(area.location.lat) + offset, lng: Number(area.location.lng) + offset },
          { lat: Number(area.location.lat) - offset, lng: Number(area.location.lng) + offset },
        ];
        allPolygons.push(coords);
      }
    });

    if (allPolygons.length === 0) return null;

    // Combine polygons - use actual coordinates when available
    let combinedCoordinates = [];
    
    if (allPolygons.length === 1) {
      // Single polygon - use its actual coordinates directly
      combinedCoordinates = allPolygons[0];
    } else {
      // Multiple polygons - combine them by using all their actual coordinates
      // This preserves the shape of each area rather than creating a bounding box
      // We'll interleave the polygons to create a combined boundary
      const polygonsWithCoords = allPolygons.filter(p => p.length >= 3);
      
      if (polygonsWithCoords.length > 0) {
        // If all polygons have actual coordinates, combine them
        // For better visualization, we'll create a boundary that follows the outer edges
        // For now, we'll use a simplified approach: combine all points and create a hull
        
        // Get all unique boundary points from all polygons
        const allBoundaryPoints = polygonsWithCoords.flat();
        
        // Remove duplicate points (within tolerance)
        const uniquePoints = [];
        const tolerance = 0.0001;
        allBoundaryPoints.forEach(point => {
          const isDuplicate = uniquePoints.some(existing => 
            Math.abs(existing.lat - point.lat) < tolerance && 
            Math.abs(existing.lng - point.lng) < tolerance
          );
          if (!isDuplicate) {
            uniquePoints.push(point);
          }
        });
        
        // If we have actual polygon coordinates, try to preserve them
        // Otherwise create a boundary box
        if (uniquePoints.length >= 3) {
          // Sort points to create a reasonable boundary
          // Sort by angle from center point
          const centerLat = uniquePoints.reduce((sum, p) => sum + p.lat, 0) / uniquePoints.length;
          const centerLng = uniquePoints.reduce((sum, p) => sum + p.lng, 0) / uniquePoints.length;
          
          const sortedPoints = uniquePoints.sort((a, b) => {
            const angleA = Math.atan2(a.lat - centerLat, a.lng - centerLng);
            const angleB = Math.atan2(b.lat - centerLat, b.lng - centerLng);
            return angleA - angleB;
          });
          
          combinedCoordinates = sortedPoints;
        } else {
          // Fallback to bounding box
          combinedCoordinates = [
            { lat: minLat, lng: minLng },
            { lat: maxLat, lng: minLng },
            { lat: maxLat, lng: maxLng },
            { lat: minLat, lng: maxLng },
            { lat: minLat, lng: minLng },
          ];
        }
      } else {
        // No valid polygons, create bounding box
        combinedCoordinates = [
          { lat: minLat, lng: minLng },
          { lat: maxLat, lng: minLng },
          { lat: maxLat, lng: maxLng },
          { lat: minLat, lng: maxLng },
          { lat: minLat, lng: minLng },
        ];
      }
    }

    const combinedBounds = {
      southwest: { lat: minLat, lng: minLng },
      northeast: { lat: maxLat, lng: maxLng },
    };

    return {
      coordinates: ensurePolygonClosed(combinedCoordinates),
      bounds: combinedBounds,
    };
  }, [ensurePolygonClosed]);

  // Create territory from selected areas - combine all into one territory
  const createTerritoriesFromAreas = async () => {
    if (selectedAreas.length === 0) {
      toast.error("Please select at least one area");
      return;
    }

    if (!productOwnerId) {
      toast.error("User not authenticated");
      return;
    }

    try {
      // Group areas by level for better naming
      const states = selectedAreas.filter(a => a.level === 'state');
      const districts = selectedAreas.filter(a => a.level === 'district');
      const talukas = selectedAreas.filter(a => a.level === 'taluka');
      const villages = selectedAreas.filter(a => a.level === 'village');

      // Create territory name based on selections
      let territoryName = '';
      if (states.length > 0) {
        territoryName = states.map(s => s.state || s.name).join(', ');
        if (districts.length > 0) {
          territoryName += ` - ${districts.length} District${districts.length > 1 ? 's' : ''}`;
        }
        if (talukas.length > 0) {
          territoryName += ` - ${talukas.length} Taluka${talukas.length > 1 ? 's' : ''}`;
        }
        if (villages.length > 0) {
          territoryName += ` - ${villages.length} Village${villages.length > 1 ? 's' : ''}`;
        }
      } else if (districts.length > 0) {
        territoryName = districts.map(d => d.district || d.name).join(', ');
      } else if (talukas.length > 0) {
        territoryName = talukas.map(t => t.taluka || t.name).join(', ');
      } else if (villages.length > 0) {
        territoryName = villages.map(v => v.village || v.name).join(', ');
      } else {
        territoryName = 'Custom Territory';
      }

      // Combine all boundaries into one
      const combinedBoundary = combinePolygonBoundaries(selectedAreas);
      
      if (!combinedBoundary || !combinedBoundary.coordinates || combinedBoundary.coordinates.length < 3) {
        toast.error("Could not create valid boundary from selected areas. Please ensure areas have valid boundaries.");
        return;
      }

      // Collect all administrative areas
      const allStates = [...new Set(selectedAreas.map(a => a.state).filter(Boolean))];
      const allDistricts = [...new Set(selectedAreas.map(a => a.district).filter(Boolean))];
      const allTalukas = [...new Set(selectedAreas.map(a => a.taluka).filter(Boolean))];
      const allVillages = [...new Set(selectedAreas.map(a => a.village).filter(Boolean))];

      // Create description
      const descriptionParts = [];
      if (states.length > 0) descriptionParts.push(`${states.length} State${states.length > 1 ? 's' : ''}`);
      if (districts.length > 0) descriptionParts.push(`${districts.length} District${districts.length > 1 ? 's' : ''}`);
      if (talukas.length > 0) descriptionParts.push(`${talukas.length} Taluka${talukas.length > 1 ? 's' : ''}`);
      if (villages.length > 0) descriptionParts.push(`${villages.length} Village${villages.length > 1 ? 's' : ''}`);
      
      const description = `Territory covering: ${descriptionParts.join(', ')}`;

      // Calculate center point for location
      const centerLat = (combinedBoundary.bounds.southwest.lat + combinedBoundary.bounds.northeast.lat) / 2;
      const centerLng = (combinedBoundary.bounds.southwest.lng + combinedBoundary.bounds.northeast.lng) / 2;

      const territoryData = {
        name: territoryName,
        description: description,
        assignedDistributorId: null,
        administrativeLevel: states.length > 0 ? 'state' : districts.length > 0 ? 'district' : talukas.length > 0 ? 'taluka' : 'village',
        administrativeArea: {
          states: allStates.length > 0 ? allStates : null,
          districts: allDistricts.length > 0 ? allDistricts : null,
          talukas: allTalukas.length > 0 ? allTalukas : null,
          villages: allVillages.length > 0 ? allVillages : null,
        },
        selectedAreas: selectedAreas.map(a => {
          // Remove undefined values - Firestore doesn't allow them
          const areaData = {
            level: a.level || null,
          };
          if (a.name) areaData.name = a.name;
          if (a.state) areaData.state = a.state;
          if (a.district) areaData.district = a.district;
          if (a.taluka) areaData.taluka = a.taluka;
          if (a.village) areaData.village = a.village;
          if (a.placeId) areaData.placeId = a.placeId;
          if (a.id) areaData.id = a.id;
          if (a.code) areaData.code = a.code;
          return areaData;
        }),
        location: {
          lat: centerLat,
          lng: centerLng,
        },
        bounds: combinedBoundary.bounds,
        coordinates: combinedBoundary.coordinates,
        color: "#10b981", // Default emerald color
        createdAt: serverTimestamp(),
        createdBy: productOwnerId,
        updatedAt: serverTimestamp(),
      };

      const territoriesRef = collection(db, `businesses/${productOwnerId}/territories`);
      await addDoc(territoriesRef, territoryData);

      toast.success(`Successfully created territory: ${territoryName}!`);
      setSelectedAreas([]);
      setShowAreaSelector(false);
    } catch (error) {
      console.error("Error creating territory from areas:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules are deployed.");
      } else {
        toast.error("Failed to create territory: " + (error.message || "Unknown error"));
      }
    }
  };

  const updateTerritoryAssignment = async (territoryId, distributorId) => {
    try {
      const territoryRef = doc(db, `businesses/${productOwnerId}/territories/${territoryId}`);
      const distributor = distributors.find((d) => d.distributorId === distributorId);

      await updateDoc(territoryRef, {
        assignedDistributorId: distributorId || null,
        assignedDistributorName: distributor?.businessName || null,
        updatedAt: serverTimestamp(),
      });

      // Update distributor connection
      if (distributorId) {
        const distributorConnectionRef = doc(
          db,
          `businesses/${productOwnerId}/connectedDistributors/${distributorId}`
        );
        const territory = territories.find((t) => t.id === territoryId);
        await updateDoc(distributorConnectionRef, {
          territory: territory?.name || null,
          territoryId: territoryId,
          territoryCoordinates: territory?.coordinates || null,
          updatedAt: serverTimestamp(),
        });
      }

      toast.success("Territory assignment updated!");
    } catch (error) {
      console.error("Error updating territory assignment:", error);
      if (error.code === 'permission-denied') {
        toast.error("Permission denied. Please check Firestore rules are deployed.");
      } else {
        toast.error("Failed to update territory assignment: " + (error.message || "Unknown error"));
      }
    }
  };

  const polygonOptions = (territory) => {
    // Ensure we have valid coordinates
    const hasCoordinates = territory.coordinates && 
                          Array.isArray(territory.coordinates) && 
                          territory.coordinates.length >= 3;
    
    // Validate coordinates are numbers
    const validCoords = hasCoordinates ? territory.coordinates.filter(c => 
      c && typeof c.lat === 'number' && typeof c.lng === 'number' && 
      !isNaN(c.lat) && !isNaN(c.lng)
    ) : [];
    
    return {
      fillColor: territory.color || "#10b981",
      fillOpacity: 0.4, // Slightly more opaque for better visibility
      strokeColor: territory.color || "#10b981",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      clickable: true,
      draggable: false,
      editable: false,
      geodesic: false,
      zIndex: 1,
      // Only render if we have valid coordinates
      visible: validCoords.length >= 3,
    };
  };

  const onPolygonClick = (territory) => {
    setSelectedTerritory(territory);
    setShowInfoWindow(territory.id);
  };

  const onPolygonLoad = useCallback((polygon, territoryId) => {
    polygonRef.current[territoryId] = polygon;
  }, []);

  const getDistributorLocation = (distributor) => {
    if (distributor.location?.latitude && distributor.location?.longitude) {
      return {
        lat: parseFloat(distributor.location.latitude),
        lng: parseFloat(distributor.location.longitude),
      };
    }
    // Fallback: Try to geocode from address (would need geocoding service)
    return null;
  };

  // Create custom marker icon for distributors
  const createDistributorIcon = (distributor) => {
    if (!isLoaded || !window.google?.maps) {
      return {
        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      };
    }

    const businessName = distributor.businessName || distributor.distributorName || "D";
    const initials = businessName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
    
    const color = distributor.territoryId ? "#10b981" : "#3b82f6";
    
    // Create SVG icon
    const svg = `
      <svg width="40" height="50" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow-${distributor.distributorId || distributor.id}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>
        <path d="M20 0 C30 0, 40 8, 40 18 C40 28, 30 36, 20 36 C10 36, 0 28, 0 18 C0 8, 10 0, 20 0 Z" 
              fill="${color}" 
              stroke="white" 
              stroke-width="2"
              filter="url(#shadow-${distributor.distributorId || distributor.id})"/>
        <text x="20" y="24" 
              font-family="Arial, sans-serif" 
              font-size="12" 
              font-weight="bold" 
              fill="white" 
              text-anchor="middle" 
              dominant-baseline="middle">${initials}</text>
        <circle cx="20" cy="40" r="4" fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
    `;
    
    return {
      url: `data:image/svg+xml;base64,${btoa(svg)}`,
      scaledSize: new window.google.maps.Size(40, 50),
      anchor: new window.google.maps.Point(20, 50),
    };
  };

  // Edit territory - add/remove areas
  const startEditingTerritory = (territory) => {
    setSelectedTerritoryForEdit(territory);
    setEditingTerritoryId(territory.id);
    setMapMode("edit");
    setCurrentPath(territory.coordinates || []);
    setTerritoryFormData({
      name: territory.name,
      assignedDistributorId: territory.assignedDistributorId || "",
      description: territory.description || "",
      color: territory.color || "#10b981",
    });
  };

  const cancelEditing = () => {
    setEditingTerritoryId(null);
    setSelectedTerritoryForEdit(null);
    setMapMode("view");
    setCurrentPath([]);
    setIsDrawing(false);
  };

  const updateTerritoryAreas = async () => {
    if (!selectedTerritoryForEdit || currentPath.length < 3) {
      toast.error("Invalid territory or path");
      return;
    }

    try {
      const closedPath = ensureDrawnPolygonClosed(currentPath);
      const validCoordinates = closedPath
        .map((c) => ({ lat: Number(c.lat), lng: Number(c.lng) }))
        .filter((c) => !isNaN(c.lat) && !isNaN(c.lng));

      if (validCoordinates.length < 3) {
        toast.error("Invalid coordinates");
        return;
      }

      const territoryRef = doc(
        db,
        `businesses/${productOwnerId}/territories/${selectedTerritoryForEdit.id}`
      );

      await updateDoc(territoryRef, {
        coordinates: validCoordinates,
        updatedAt: serverTimestamp(),
      });

      toast.success("Territory updated successfully!");
      cancelEditing();
    } catch (error) {
      console.error("Error updating territory:", error);
      toast.error("Failed to update territory");
    }
  };

  return (
    <div className="space-y-4 text-white">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <FaMap className="text-emerald-400 text-2xl" />
              </div>
              Territory Management
            </h2>
            <p className="text-white/70 text-sm mt-2 flex items-center gap-2">
              <FaInfoCircle className="text-blue-400" />
              Map, assign, and manage territories for your distributor network
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
          {/* Enhanced Mode Toggle */}
          <div className="flex bg-white/10 rounded-lg p-1 border border-white/20 backdrop-blur-sm">
            <button
              onClick={() => {
                setTerritoryMode("draw");
                setShowAreaSelector(false);
                setIsDrawing(false);
                setMapMode("draw");
                cancelEditing();
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                territoryMode === "draw"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <FaDrawPolygon /> Draw Boundary
            </button>
            <button
              onClick={() => {
                setTerritoryMode("search");
                setShowAreaSelector(true);
                setIsDrawing(false);
                setMapMode("view");
                cancelEditing();
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                territoryMode === "search"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <FaSearch /> Search & Select
            </button>
          </div>

          {territoryMode === "draw" && !editingTerritoryId && (
            <>
              <button
                onClick={startDrawing}
                disabled={isDrawing}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition shadow-lg shadow-emerald-500/30 font-medium"
              >
                <FaDrawPolygon /> {isDrawing ? "Drawing..." : "Draw Territory"}
              </button>
              {isDrawing && (
                <button
                  onClick={cancelDrawing}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg flex items-center gap-2 transition font-medium"
                >
                  <FaTimes /> Cancel
                </button>
              )}
            </>
          )}

          {editingTerritoryId && (
            <>
              <button
                onClick={updateTerritoryAreas}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 transition shadow-lg shadow-blue-500/30 font-medium"
              >
                <FaSave /> Save Changes
              </button>
              <button
                onClick={cancelEditing}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition font-medium"
              >
                <FaTimes /> Cancel Edit
              </button>
            </>
          )}

          {territoryMode === "search" && selectedAreas.length > 0 && (
            <button
              onClick={createTerritoriesFromAreas}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 transition"
            >
              <FaPlus /> Create Territory ({selectedAreas.length} area{selectedAreas.length > 1 ? "s" : ""} selected)
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Area Selector Panel */}
      {territoryMode === "search" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-xl border border-white/10 p-6"
        >
          <TerritoryAreaSelector
            onAreaSelect={handleAreaSelect}
            map={map}
            isLoaded={isLoaded}
            googleMapsApiKey={GOOGLE_MAPS_API_KEY}
          />
        </motion.div>
      )}

      {/* Territory Form Modal */}
      <AnimatePresence>
        {showTerritoryForm && currentPath.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTerritoryForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold mb-4">Save Territory</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Territory Name *
                  </label>
                  <input
                    type="text"
                    value={territoryFormData.name}
                    onChange={(e) =>
                      setTerritoryFormData({ ...territoryFormData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="e.g., North Zone, Mumbai Region"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Assign to Distributor
                  </label>
                  <select
                    value={territoryFormData.assignedDistributorId}
                    onChange={(e) =>
                      setTerritoryFormData({
                        ...territoryFormData,
                        assignedDistributorId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <option value="">Select Distributor (Optional)</option>
                    {distributors.map((dist) => (
                      <option key={dist.distributorId || dist.id} value={dist.distributorId || dist.id}>
                        {dist.businessName || dist.distributorName || "Unnamed"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Description
                  </label>
                  <textarea
                    value={territoryFormData.description}
                    onChange={(e) =>
                      setTerritoryFormData({
                        ...territoryFormData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="Optional description..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={territoryFormData.color}
                    onChange={(e) =>
                      setTerritoryFormData({
                        ...territoryFormData,
                        color: e.target.value,
                      })
                    }
                    className="w-full h-10 bg-white/10 border border-white/20 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTerritoryForm(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTerritory}
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <FaSave /> Save Territory
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2">
          {loadError ? (
            <div className="h-[600px] bg-white/5 rounded-xl flex items-center justify-center text-red-400">
              Error loading Google Maps. Please check your API key.
            </div>
          ) : !isLoaded ? (
            <div className="h-[600px] bg-white/5 rounded-xl flex items-center justify-center">Loading map...</div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={getDefaultCenter(distributors)}
              zoom={distributors.length > 0 ? 6 : 5}
              onLoad={handleMapLoad}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                styles: [
                  {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }],
                  },
                ],
              }}
            >
              {/* Render territories */}
              {territories.map((territory) => {
                // Only render if we have valid coordinates (at least 3 points for a polygon)
                if (!territory.coordinates || !Array.isArray(territory.coordinates) || territory.coordinates.length < 3) {
                  return null;
                }
                
                // Validate and clean coordinates
                const validCoords = territory.coordinates
                  .map(c => {
                    if (!c) return null;
                    const lat = typeof c.lat === 'function' ? c.lat() : c.lat;
                    const lng = typeof c.lng === 'function' ? c.lng() : c.lng;
                    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
                      return null;
                    }
                    return { lat: Number(lat), lng: Number(lng) };
                  })
                  .filter(Boolean);
                
                if (validCoords.length < 3) {
                  console.warn(`Territory ${territory.id} has invalid coordinates, skipping render`);
                  return null;
                }
                
                // Ensure polygon is closed
                const first = validCoords[0];
                const last = validCoords[validCoords.length - 1];
                const tolerance = 0.0001;
                const isClosed = Math.abs(first.lat - last.lat) < tolerance && 
                                 Math.abs(first.lng - last.lng) < tolerance;
                const finalCoords = isClosed ? validCoords : [...validCoords, { lat: first.lat, lng: first.lng }];
                
                return (
                  <React.Fragment key={territory.id}>
                    <Polygon
                      paths={finalCoords}
                      options={polygonOptions(territory)}
                      onLoad={(polygon) => onPolygonLoad(polygon, territory.id)}
                      onClick={() => onPolygonClick(territory)}
                    />
                    {showInfoWindow === territory.id && (
                      <InfoWindow
                        position={
                          finalCoords[0] || getDefaultCenter(distributors)
                        }
                        onCloseClick={() => setShowInfoWindow(null)}
                      >
                        <div className="text-black p-2">
                          <h4 className="font-bold mb-1">{territory.name}</h4>
                          {territory.assignedDistributorName && (
                            <p className="text-sm text-gray-600">
                              Assigned to: {territory.assignedDistributorName}
                            </p>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Render distributor markers with custom icons */}
              {distributors.map((distributor) => {
                const location = getDistributorLocation(distributor);
                if (!location || !isLoaded) return null;

                const customIcon = createDistributorIcon(distributor);

                return (
                  <React.Fragment key={distributor.distributorId || distributor.id}>
                    <Marker
                      position={location}
                      title={distributor.businessName || distributor.distributorName}
                      icon={customIcon}
                      onClick={() => setShowDistributorInfo(distributor.distributorId || distributor.id)}
                    />
                    {showDistributorInfo === (distributor.distributorId || distributor.id) && (
                      <InfoWindow
                        position={location}
                        onCloseClick={() => setShowDistributorInfo(null)}
                      >
                        <div className="text-black p-3 min-w-[200px]">
                          <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <FaBuilding className="text-blue-500" />
                            {distributor.businessName || distributor.distributorName}
                          </h4>
                          {distributor.ownerName && (
                            <p className="text-sm text-gray-600 mb-1">
                              <FaUser className="inline mr-1" />
                              {distributor.ownerName}
                            </p>
                          )}
                          {distributor.city && (
                            <p className="text-sm text-gray-600 mb-1">
                              <FaMapMarkerAlt className="inline mr-1" />
                              {distributor.city}
                              {distributor.state && `, ${distributor.state}`}
                            </p>
                          )}
                          {distributor.territory && (
                            <p className="text-sm text-emerald-600 mt-2 font-medium">
                              <FaRoute className="inline mr-1" />
                              Territory: {distributor.territory}
                            </p>
                          )}
                          {distributor.phone && (
                            <p className="text-xs text-gray-500 mt-2">
                              📞 {distributor.phone}
                            </p>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </React.Fragment>
                );
              })}
            </GoogleMap>
          )}
        </div>

        {/* Enhanced Territories List */}
        <div className="space-y-3 bg-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FaLayerGroup className="text-emerald-400" />
              Territories ({territories.length})
            </h3>
            {territories.length > 0 && (
              <div className="text-xs text-white/50">
                {territories.filter((t) => t.assignedDistributorId).length} assigned
              </div>
            )}
          </div>
          {territories.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              No territories created yet. Click "Draw Territory" to create one.
            </div>
          ) : (
            territories.map((territory) => (
              <motion.div
                key={territory.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border p-4 transition-all ${
                  editingTerritoryId === territory.id
                    ? "border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold flex items-center gap-2 mb-1">
                      <div
                        className="w-4 h-4 rounded flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: territory.color || "#10b981" }}
                      />
                      <span className="truncate">{territory.name}</span>
                      {editingTerritoryId === territory.id && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                          Editing
                        </span>
                      )}
                    </h4>
                    {territory.administrativeArea?.state && (
                      <p className="text-xs text-white/50 truncate mt-1 flex items-center gap-1">
                        <FaMapMarkerAlt className="text-xs" />
                        {[
                          territory.administrativeArea.state,
                          territory.administrativeArea.district,
                          territory.administrativeArea.taluka
                        ].filter(Boolean).join(" > ")}
                      </p>
                    )}
                    {territory.assignedDistributorName && (
                      <p className="text-sm text-emerald-300 mt-2 flex items-center gap-1 font-medium">
                        <FaUser className="text-xs" />
                        {territory.assignedDistributorName}
                      </p>
                    )}
                    {territory.coordinates && (
                      <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                        <FaChartArea className="text-xs" />
                        {territory.coordinates.length} boundary points
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    {editingTerritoryId !== territory.id && (
                      <button
                        onClick={() => startEditingTerritory(territory)}
                        className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition flex-shrink-0"
                        title="Edit territory"
                      >
                        <FaEdit className="text-sm" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteTerritory(territory.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition flex-shrink-0"
                      title="Delete territory"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                </div>
                {territory.description && (
                  <p className="text-sm text-white/60 mb-3 line-clamp-2">{territory.description}</p>
                )}
                <div className="space-y-2">
                  <select
                    value={territory.assignedDistributorId || ""}
                    onChange={(e) =>
                      updateTerritoryAssignment(territory.id, e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                  >
                    <option value="">Assign to distributor...</option>
                    {distributors.map((dist) => (
                      <option
                        key={dist.distributorId || dist.id}
                        value={dist.distributorId || dist.id}
                      >
                        {dist.businessName || dist.distributorName || "Unnamed"}
                      </option>
                    ))}
                  </select>
                  {editingTerritoryId === territory.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={startDrawing}
                        className="flex-1 px-3 py-2 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 transition flex items-center justify-center gap-1"
                      >
                        <FaDrawPolygon /> Redraw Boundary
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TerritoryManagement;
