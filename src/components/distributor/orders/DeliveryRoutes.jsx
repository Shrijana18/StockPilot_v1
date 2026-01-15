import React, { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, query, where, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-toastify';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMap, FiNavigation, FiTruck, FiPackage, FiClock, 
  FiUser, FiMapPin, FiZap, FiRefreshCw, FiCheckCircle,
  FiX, FiPlus, FiEdit2, FiTrash2, FiPlay, FiPause,
  FiShare2, FiDownload, FiBarChart2, FiTarget, FiTrendingUp,
  FiAlertCircle, FiInfo, FiCopy, FiExternalLink
} from 'react-icons/fi';

// Use the same Google Maps API key as territory management
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";

// Route optimization using Nearest Neighbor algorithm
const optimizeRoute = (orders, startLocation) => {
  if (!orders || orders.length === 0) return [];
  if (orders.length === 1) return orders;

  const optimized = [];
  const remaining = [...orders];
  let currentLocation = startLocation;

  while (remaining.length > 0) {
    let nearest = null;
    let nearestDistance = Infinity;
    let nearestIndex = -1;

    remaining.forEach((order, index) => {
      const orderLocation = order.location;
      if (!orderLocation) return;

      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        orderLocation.lat,
        orderLocation.lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = order;
        nearestIndex = index;
      }
    });

    if (nearest) {
      optimized.push(nearest);
      remaining.splice(nearestIndex, 1);
      currentLocation = nearest.location;
    } else {
      break;
    }
  }

  return optimized;
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Geocode address to coordinates
const geocodeAddress = async (address) => {
  if (!address || !GOOGLE_MAPS_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

const DeliveryRoutes = () => {
  const [orders, setOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [mapCenter, setMapCenter] = useState({ lat: 19.0760, lng: 72.8777 }); // Default: Mumbai
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [distributorLocation, setDistributorLocation] = useState(null);
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [employees, setEmployees] = useState([]);
  const [orderLocations, setOrderLocations] = useState(new Map());
  const [routeProgress, setRouteProgress] = useState({}); // Track delivery progress
  const [isPlaying, setIsPlaying] = useState(false); // Route animation
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState(0);
  const [showRouteStats, setShowRouteStats] = useState(false);
  const [mapType, setMapType] = useState('roadmap');

  const db = getFirestore();
  const auth = getAuth();

  // Load Google Maps API - use same ID as TerritoryMapView to share loader
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'],
  });

  // Load employees
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const employeesRef = collection(db, 'businesses', user.uid, 'distributorEmployees');
      const unsubscribe = onSnapshot(employeesRef, (snapshot) => {
        const employeeData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEmployees(employeeData);
      });
      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, []);

  // Load distributor location
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const distributorRef = doc(db, 'businesses', user.uid);
        const distributorSnap = await getDoc(distributorRef);
        if (distributorSnap.exists()) {
          const data = distributorSnap.data();
          const address = data.address || `${data.city || ''}, ${data.state || ''}`;
          if (address) {
            const location = await geocodeAddress(address);
            if (location) {
              setDistributorLocation(location);
              setMapCenter(location);
            }
          }
        }
      } catch (error) {
        console.error('Error loading distributor location:', error);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Load orders that are out for delivery
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');
      const q = query(
        ordersRef,
        where('statusCode', 'in', ['SHIPPED', 'OUT_FOR_DELIVERY'])
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const orderData = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const order = { id: docSnap.id, ...data };

            // Geocode address if not already done
            const addressKey = `${order.retailerAddress || ''} ${order.retailerCity || ''} ${order.retailerState || ''}`.trim();
            if (addressKey && !orderLocations.has(order.id)) {
              const location = await geocodeAddress(addressKey);
              if (location) {
                setOrderLocations(prev => new Map(prev).set(order.id, location));
                order.location = location;
              }
            } else if (orderLocations.has(order.id)) {
              order.location = orderLocations.get(order.id);
            }

            return order;
          })
        );
        setOrders(orderData);
      });

      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, [orderLocations]);

  // Load saved routes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const routesRef = collection(db, 'businesses', user.uid, 'deliveryRoutes');
      const unsubscribe = onSnapshot(
        routesRef,
        (snapshot) => {
          const routeData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRoutes(routeData);
        },
        (error) => {
          console.error('Error loading routes:', error);
          if (error.code === 'permission-denied') {
            toast.error('Permission denied. Please check Firestore rules.');
          }
        }
      );
      return () => unsubscribe();
    });
    return () => unsubscribeAuth();
  }, []);

  // Calculate route directions
  const calculateDirections = async (routeOrders) => {
    if (!routeOrders || routeOrders.length === 0) return;
    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
      console.warn('Google Maps API not loaded');
      return;
    }

    setLoading(true);
    try {
      const waypoints = routeOrders
        .filter(o => o.location)
        .map(o => {
          try {
            return {
              location: new window.google.maps.LatLng(o.location.lat, o.location.lng),
              stopover: true,
            };
          } catch (error) {
            console.error('Error creating waypoint:', error);
            return null;
          }
        })
        .filter(Boolean);

      if (waypoints.length === 0) {
        setLoading(false);
        return;
      }

      const directionsService = new window.google.maps.DirectionsService();
      const start = distributorLocation || mapCenter;
      
      if (!start || !start.lat || !start.lng) {
        console.error('Invalid start location');
        setLoading(false);
        return;
      }

      const origin = new window.google.maps.LatLng(start.lat, start.lng);
      const destination = waypoints[waypoints.length - 1].location;
      const waypointsList = waypoints.slice(0, -1);
      
      directionsService.route(
        {
          origin: origin,
          destination: destination,
          waypoints: waypointsList.length > 0 ? waypointsList : undefined,
          optimizeWaypoints: waypointsList.length > 0,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result) {
            setDirections(result);
          } else {
            console.error('Directions request failed:', status);
            if (status !== 'ZERO_RESULTS') {
              toast.error('Failed to calculate route directions');
            }
          }
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('Error calculating directions:', error);
      toast.error('Error calculating route');
      setLoading(false);
    }
  };

  // Optimize route
  const handleOptimizeRoute = async () => {
    if (!selectedRoute) return;

    setOptimizing(true);
    try {
      const route = routes.find(r => r.id === selectedRoute);
      if (!route) return;

      const routeOrders = orders.filter(o => route.orderIds?.includes(o.id));
      const ordersWithLocation = routeOrders.filter(o => o.location);

      if (ordersWithLocation.length === 0) {
        toast.error('No orders with valid addresses found');
        setOptimizing(false);
        return;
      }

      const optimized = optimizeRoute(ordersWithLocation, distributorLocation || mapCenter);
      
      // Update route with optimized order sequence
      const routeRef = doc(db, 'businesses', auth.currentUser.uid, 'deliveryRoutes', selectedRoute);
      await updateDoc(routeRef, {
        orderIds: optimized.map(o => o.id),
        optimizedAt: new Date().toISOString(),
        optimizedSequence: optimized.map((o, idx) => ({
          orderId: o.id,
          sequence: idx + 1,
        })),
      });

      toast.success('Route optimized successfully!');
      await calculateDirections(optimized);
    } catch (error) {
      console.error('Error optimizing route:', error);
      toast.error('Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  // Create new route
  const handleCreateRoute = async () => {
    if (!newRouteName.trim()) {
      toast.error('Please enter a route name');
      return;
    }

    try {
      const routeRef = doc(collection(db, 'businesses', auth.currentUser.uid, 'deliveryRoutes'));
      await setDoc(routeRef, {
        name: newRouteName,
        employeeId: selectedEmployee || null,
        vehicle: selectedVehicle || null,
        orderIds: [],
        createdAt: new Date().toISOString(),
        status: 'active',
      });

      setNewRouteName('');
      setSelectedEmployee('');
      setSelectedVehicle('');
      setShowCreateRoute(false);
      toast.success('Route created successfully');
    } catch (error) {
      console.error('Error creating route:', error);
      toast.error('Failed to create route');
    }
  };

  // Add order to route
  const handleAddOrderToRoute = async (orderId, routeId) => {
    try {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;

      const updatedOrderIds = [...(route.orderIds || []), orderId];
      const routeRef = doc(db, 'businesses', auth.currentUser.uid, 'deliveryRoutes', routeId);
      await updateDoc(routeRef, {
        orderIds: updatedOrderIds,
      });

      toast.success('Order added to route');
    } catch (error) {
      console.error('Error adding order to route:', error);
      toast.error('Failed to add order to route');
    }
  };

  // Remove order from route
  const handleRemoveOrderFromRoute = async (orderId, routeId) => {
    try {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;

      const updatedOrderIds = (route.orderIds || []).filter(id => id !== orderId);
      const routeRef = doc(db, 'businesses', auth.currentUser.uid, 'deliveryRoutes', routeId);
      await updateDoc(routeRef, {
        orderIds: updatedOrderIds,
      });

      toast.success('Order removed from route');
      // Recalculate directions if this route is selected
      if (selectedRoute === routeId) {
        const routeOrders = orders.filter(o => updatedOrderIds.includes(o.id));
        await calculateDirections(routeOrders);
      }
    } catch (error) {
      console.error('Error removing order from route:', error);
      toast.error('Failed to remove order from route');
    }
  };

  // Start route
  const handleStartRoute = async (routeId) => {
    try {
      const routeRef = doc(db, 'businesses', auth.currentUser.uid, 'deliveryRoutes', routeId);
      await updateDoc(routeRef, {
        status: 'in-progress',
        startedAt: new Date().toISOString(),
      });
      toast.success('Route started!');
    } catch (error) {
      console.error('Error starting route:', error);
      toast.error('Failed to start route');
    }
  };

  // Complete route
  const handleCompleteRoute = async (routeId) => {
    try {
      const routeRef = doc(db, 'businesses', auth.currentUser.uid, 'deliveryRoutes', routeId);
      await updateDoc(routeRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      toast.success('Route completed!');
    } catch (error) {
      console.error('Error completing route:', error);
      toast.error('Failed to complete route');
    }
  };

  // Select route and calculate directions
  const handleSelectRoute = async (routeId) => {
    setSelectedRoute(routeId);
    const route = routes.find(r => r.id === routeId);
    if (route && route.orderIds) {
      const routeOrders = orders.filter(o => route.orderIds.includes(o.id));
      await calculateDirections(routeOrders);
    }
  };

  // Get unassigned orders
  const unassignedOrders = useMemo(() => {
    const assignedOrderIds = new Set();
    routes.forEach(route => {
      (route.orderIds || []).forEach(id => assignedOrderIds.add(id));
    });
    return orders.filter(o => !assignedOrderIds.has(o.id));
  }, [orders, routes]);

  const selectedRouteData = routes.find(r => r.id === selectedRoute);
  const selectedRouteOrders = selectedRouteData
    ? orders.filter(o => selectedRouteData.orderIds?.includes(o.id))
    : [];

  // Calculate total value for route
  const routeTotalValue = useMemo(() => {
    return selectedRouteOrders.reduce((sum, order) => {
      const total = order.proforma?.grandTotal || order.chargesSnapshot?.breakdown?.grandTotal || 0;
      return sum + Number(total);
    }, 0);
  }, [selectedRouteOrders]);

  return (
    <div className="p-4 sm:p-6 space-y-6 text-white">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight">
            🚚 Delivery Route Optimization
          </h2>
          <p className="text-white/70 mt-1.5 font-medium">Optimize delivery routes like Uber for maximum efficiency</p>
        </div>
        <button
          onClick={() => setShowCreateRoute(true)}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-semibold hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition flex items-center gap-2"
        >
          <FiPlus className="w-5 h-5" />
          Create Route
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Routes</p>
              <p className="text-2xl font-bold text-white mt-1">{routes.length}</p>
            </div>
            <FiMap className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-semibold">Active Routes</p>
              <p className="text-2xl font-bold text-white mt-1.5">
                {routes.filter(r => r.status === 'active' || r.status === 'in-progress').length}
              </p>
            </div>
            <FiNavigation className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-400/30 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-semibold">Unassigned Orders</p>
              <p className="text-2xl font-bold text-white mt-1.5">{unassignedOrders.length}</p>
            </div>
            <FiPackage className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-semibold">Total Orders</p>
              <p className="text-2xl font-bold text-white mt-1.5">{orders.length}</p>
            </div>
            <FiTruck className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Create Route Modal */}
      <AnimatePresence>
        {showCreateRoute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowCreateRoute(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900/95 border border-white/20 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Create New Route</h3>
                <button
                  onClick={() => setShowCreateRoute(false)}
                  className="text-white/60 hover:text-white"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Route Name</label>
                  <input
                    type="text"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    placeholder="e.g., Route A - North Zone"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Assign Employee (Optional)</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name || emp.flypEmployeeId || emp.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Vehicle (Optional)</label>
                  <input
                    type="text"
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    placeholder="e.g., Truck-001, Van-002"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateRoute}
                    className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateRoute(false)}
                    className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Routes & Orders */}
        <div className="lg:col-span-1 space-y-4">
          {/* Routes List */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiMap className="w-5 h-5 text-emerald-400" />
              Active Routes
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {routes.map(route => {
                const status = route.status || 'active';
                const statusColors = {
                  'active': 'bg-blue-500/20 text-blue-300 border-blue-400/30',
                  'in-progress': 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
                  'completed': 'bg-gray-500/20 text-gray-300 border-gray-400/30',
                };
                const statusLabels = {
                  'active': 'Active',
                  'in-progress': 'In Progress',
                  'completed': 'Completed',
                };
                
                const routeOrders = orders.filter(o => route.orderIds?.includes(o.id));
                const completedCount = routeOrders.filter(o => 
                  o.statusCode === 'DELIVERED' || o.status === 'Delivered'
                ).length;
                const progressPercent = routeOrders.length > 0 
                  ? Math.round((completedCount / routeOrders.length) * 100) 
                  : 0;
                
                return (
                  <motion.div
                    key={route.id}
                    onClick={() => handleSelectRoute(route.id)}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedRoute === route.id
                        ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-400/50 shadow-lg shadow-emerald-500/20'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-bold text-white truncate">{route.name || 'Unnamed Route'}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${statusColors[status] || statusColors.active}`}>
                            {statusLabels[status] || 'Active'}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        {status === 'in-progress' && routeOrders.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-white/60">Progress</span>
                              <span className="text-emerald-400 font-semibold">{progressPercent}%</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.5 }}
                                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-white/60">
                          <span className="flex items-center gap-1">
                            <FiPackage className="w-3 h-3" />
                            {routeOrders.length || 0} orders
                          </span>
                          {route.employeeId && (
                            <span className="flex items-center gap-1">
                              <FiUser className="w-3 h-3" />
                              {employees.find(e => e.id === route.employeeId)?.name || 'Employee'}
                            </span>
                          )}
                          {route.vehicle && (
                            <span className="flex items-center gap-1">
                              <FiTruck className="w-3 h-3" />
                              {route.vehicle}
                            </span>
                          )}
                        </div>
                        
                        {/* Quick Stats */}
                        {routeOrders.length > 0 && (
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className="text-emerald-400">
                              ✓ {completedCount} delivered
                            </span>
                            <span className="text-amber-400">
                              ⏱ {routeOrders.length - completedCount} pending
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        {selectedRoute === route.id && (
                          <FiCheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        )}
                        {status === 'in-progress' && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-2 h-2 bg-emerald-400 rounded-full"
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {routes.length === 0 && (
                <p className="text-white/40 text-center py-8">No routes created yet</p>
              )}
            </div>
          </div>

          {/* Unassigned Orders */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FiPackage className="w-5 h-5 text-amber-400" />
              Unassigned Orders ({unassignedOrders.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {unassignedOrders.map(order => (
                <div
                  key={order.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">{order.retailerName || 'N/A'}</p>
                      <p className="text-xs text-white/60">{order.id.substring(0, 12)}...</p>
                      <p className="text-xs text-white/60 mt-1">
                        {order.retailerCity || ''} {order.retailerState || ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {routes.map(route => (
                        <button
                          key={route.id}
                          onClick={() => handleAddOrderToRoute(order.id, route.id)}
                          className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 transition"
                          title={`Add to ${route.name}`}
                        >
                          +{route.name?.substring(0, 1) || 'R'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {unassignedOrders.length === 0 && (
                <p className="text-white/40 text-center py-8">All orders assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Map */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 h-[600px] relative">
            {!GOOGLE_MAPS_API_KEY ? (
              <div className="flex items-center justify-center h-full text-white/60">
                <div className="text-center">
                  <FiMap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Google Maps API key not configured</p>
                  <p className="text-sm mt-2">Set VITE_GOOGLE_MAPS_API_KEY in your .env file</p>
                </div>
              </div>
            ) : mapLoadError ? (
              <div className="flex items-center justify-center h-full text-white/60">
                <div className="text-center">
                  <FiMap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Error loading Google Maps</p>
                  <p className="text-sm mt-2 text-rose-400">{mapLoadError.message}</p>
                </div>
              </div>
            ) : !isMapLoaded ? (
              <div className="flex items-center justify-center h-full text-white/60">
                <div className="text-center">
                  <FiMap className="w-16 h-16 mx-auto mb-4 opacity-50 animate-pulse" />
                  <p>Loading map...</p>
                </div>
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
                center={mapCenter}
                zoom={selectedRouteOrders.length > 0 ? 12 : 10}
                options={{
                  mapTypeId: mapType,
                  styles: [
                    {
                      featureType: 'all',
                      elementType: 'geometry',
                      stylers: [{ color: '#0f172a' }],
                    },
                    {
                      featureType: 'water',
                      elementType: 'geometry',
                      stylers: [{ color: '#1e3a8a' }],
                    },
                    {
                      featureType: 'road',
                      elementType: 'geometry',
                      stylers: [{ color: '#1e293b' }, { lightness: 20 }],
                    },
                    {
                      featureType: 'road.highway',
                      elementType: 'geometry',
                      stylers: [{ color: '#334155' }, { lightness: 10 }],
                    },
                    {
                      featureType: 'landscape',
                      elementType: 'geometry',
                      stylers: [{ color: '#0f172a' }],
                    },
                    {
                      featureType: 'poi',
                      elementType: 'geometry',
                      stylers: [{ color: '#1e293b' }],
                    },
                    {
                      featureType: 'all',
                      elementType: 'labels.text.fill',
                      stylers: [{ color: '#94a3b8' }, { gamma: 0.5 }],
                    },
                    {
                      featureType: 'all',
                      elementType: 'labels.text.stroke',
                      stylers: [{ color: '#0f172a' }, { gamma: 0.5 }],
                    },
                  ],
                  disableDefaultUI: false,
                  zoomControl: true,
                  mapTypeControl: true,
                  scaleControl: true,
                  streetViewControl: false,
                  rotateControl: true,
                  fullscreenControl: true,
                }}
              >
                {/* Distributor Location */}
                {distributorLocation && isMapLoaded && (
                  <Marker
                    position={distributorLocation}
                    icon={{
                      url: 'data:image/svg+xml;base64,' + btoa(`
                        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="20" cy="20" r="15" fill="#10b981" stroke="#fff" stroke-width="2"/>
                          <rect x="12" y="14" width="16" height="12" fill="white" rx="1"/>
                          <rect x="14" y="16" width="4" height="4" fill="#10b981"/>
                          <rect x="22" y="16" width="4" height="4" fill="#10b981"/>
                          <rect x="14" y="22" width="12" height="2" fill="#10b981"/>
                        </svg>
                      `),
                      scaledSize: new window.google.maps.Size(40, 40),
                    }}
                    title="Distributor Location"
                  />
                )}

                {/* Order Markers */}
                {selectedRouteOrders.map((order, index) => {
                  if (!order.location || !isMapLoaded) return null;
                  try {
                    const isDelivered = order.statusCode === 'DELIVERED' || order.status === 'Delivered';
                    const markerColor = isDelivered ? '#10b981' : '#3b82f6';
                    const markerIcon = isDelivered ? '✓' : `${index + 1}`;
                    
                    return (
                      <Marker
                        key={order.id}
                        position={order.location}
                        label={{
                          text: markerIcon,
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: isDelivered ? '14px' : '12px',
                        }}
                        icon={{
                          url: 'data:image/svg+xml;base64,' + btoa(`
                            <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="18" cy="18" r="14" fill="${markerColor}" stroke="#fff" stroke-width="2.5"/>
                              ${isDelivered ? '<circle cx="18" cy="18" r="10" fill="#fff" opacity="0.3"/>' : ''}
                            </svg>
                          `),
                          scaledSize: new window.google.maps.Size(36, 36),
                          anchor: new window.google.maps.Point(18, 18),
                        }}
                        title={`${index + 1}. ${order.retailerName || 'Order'}${isDelivered ? ' (Delivered)' : ''}`}
                      />
                    );
                  } catch (error) {
                    console.error('Error rendering marker:', error);
                    return null;
                  }
                })}

                {/* Directions */}
                {directions && <DirectionsRenderer directions={directions} />}
              </GoogleMap>
            )}

            {/* Map Type Toggle */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <button
                onClick={() => setMapType('roadmap')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  mapType === 'roadmap'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-900/90 text-white/80 hover:bg-slate-800/90'
                }`}
              >
                Map
              </button>
              <button
                onClick={() => setMapType('satellite')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  mapType === 'satellite'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-900/90 text-white/80 hover:bg-slate-800/90'
                }`}
              >
                Satellite
              </button>
            </div>

            {/* Route Controls Overlay */}
            {selectedRoute && (
              <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-4 space-y-3 min-w-[300px] max-w-[350px] shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-white text-lg">
                      {selectedRouteData?.name || 'Route'}
                    </h4>
                    {selectedRouteData?.status === 'in-progress' && (
                      <div className="flex items-center gap-2 mt-1">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="w-2 h-2 bg-emerald-400 rounded-full"
                        />
                        <span className="text-xs text-emerald-400 font-medium">Live Tracking</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setShowRouteStats(!showRouteStats)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                      title="Route Statistics"
                    >
                      <FiBarChart2 className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => {
                        const routeInfo = `${selectedRouteData?.name}\n${selectedRouteOrders.length} orders\n${routeTotalValue.toFixed(2)} total value`;
                        navigator.clipboard.writeText(routeInfo);
                        toast.success('Route info copied!');
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                      title="Copy Route Info"
                    >
                      <FiCopy className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 flex-wrap">
                  {selectedRouteData?.status === 'active' && (
                    <button
                      onClick={() => handleStartRoute(selectedRoute)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition flex items-center justify-center gap-2"
                    >
                      <FiPlay className="w-4 h-4" />
                      Start Route
                    </button>
                  )}
                  {selectedRouteData?.status === 'in-progress' && (
                    <button
                      onClick={() => handleCompleteRoute(selectedRoute)}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition flex items-center justify-center gap-2"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      Complete
                    </button>
                  )}
                  <button
                    onClick={handleOptimizeRoute}
                    disabled={optimizing || selectedRouteData?.status === 'completed'}
                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Optimize Route"
                  >
                    <FiZap className="w-4 h-4" />
                    {optimizing ? 'Optimizing...' : 'Optimize'}
                  </button>
                </div>

                {/* Route Statistics Toggle */}
                {showRouteStats && selectedRouteOrders.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10"
                  >
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-white/60">Avg Distance</p>
                        <p className="text-white font-semibold">
                          {directions?.routes?.[0]?.legs 
                            ? `${(directions.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0) / selectedRouteOrders.length / 1000).toFixed(1)} km`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/60">Avg Time</p>
                        <p className="text-white font-semibold">
                          {directions?.routes?.[0]?.legs
                            ? `${Math.round(directions.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0) / selectedRouteOrders.length / 60)} min`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {selectedRouteOrders.length === 0 ? (
                    <p className="text-white/60 text-sm text-center py-4">No orders in this route</p>
                  ) : (
                    selectedRouteOrders.map((order, index) => {
                      const isDelivered = order.statusCode === 'DELIVERED' || order.status === 'Delivered';
                      const orderValue = order.proforma?.grandTotal || order.chargesSnapshot?.breakdown?.grandTotal || 0;
                      
                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-3 rounded-lg border transition-all ${
                            isDelivered
                              ? 'bg-emerald-500/10 border-emerald-400/30'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isDelivered
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {isDelivered ? '✓' : index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-white truncate">
                                  {order.retailerName || 'N/A'}
                                </p>
                                {isDelivered && (
                                  <FiCheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-white/60 truncate mt-0.5">
                                {order.retailerCity || ''} {order.retailerState || ''}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs">
                                <span className="text-emerald-400 font-medium">₹{Number(orderValue).toFixed(0)}</span>
                                {order.retailerPhone && (
                                  <a
                                    href={`tel:${order.retailerPhone}`}
                                    className="text-blue-400 hover:text-blue-300 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    📞 Call
                                  </a>
                                )}
                                {order.location && (
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${order.location.lat},${order.location.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FiNavigation className="w-3 h-3" />
                                    Navigate
                                  </a>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOrderFromRoute(order.id, selectedRoute);
                              }}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition flex-shrink-0"
                              title="Remove from route"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {selectedRouteOrders.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-xs text-white/60">Orders</p>
                        <p className="text-lg font-bold text-white">{selectedRouteOrders.length}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-xs text-white/60">Value</p>
                        <p className="text-lg font-bold text-emerald-400">₹{routeTotalValue.toFixed(0)}</p>
                      </div>
                    </div>
                    {directions?.routes?.[0]?.legs && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-xs text-white/60">Distance</p>
                          <p className="text-lg font-bold text-white">
                            {(directions.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000).toFixed(1)} km
                          </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2">
                          <p className="text-xs text-white/60">Est. Time</p>
                          <p className="text-lg font-bold text-white">
                            {Math.round(directions.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60)} min
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedRouteData?.employeeId && (
                      <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg p-2 border border-cyan-400/30">
                        <p className="text-xs text-white/60 mb-1">Assigned To</p>
                        <p className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                          <FiUser className="w-4 h-4" />
                          {employees.find(e => e.id === selectedRouteData.employeeId)?.name || 'Employee'}
                        </p>
                      </div>
                    )}
                    {selectedRouteData?.vehicle && (
                      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-2 border border-purple-400/30">
                        <p className="text-xs text-white/60 mb-1">Vehicle</p>
                        <p className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                          <FiTruck className="w-4 h-4" />
                          {selectedRouteData.vehicle}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryRoutes;
