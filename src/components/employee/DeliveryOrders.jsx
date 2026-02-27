/**
 * DeliveryOrders - Employee-facing component for managing assigned delivery orders
 * Redesigned for better space utilization and app compatibility
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTruck, FaMapMarkerAlt, FaPhone, FaUser, FaRupeeSign,
  FaCheckCircle, FaClock, FaSpinner, FaMotorcycle, FaBoxOpen,
  FaDirections, FaCheck, FaTimes, FaHistory, FaArrowRight, FaRoute,
  FaComments
} from 'react-icons/fa';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { getEmployeeSession } from '../../utils/employeeSession';
import {
  subscribeToEmployeeDeliveries,
  markOrderPickedUp,
  markOrderDeliveredByEmployee,
  getEmployeeDeliveryHistory
} from '../../services/deliveryEmployeeService';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { empDB as db } from '../../firebase/firebaseConfig';
import EmployeeDeliveryChat from './EmployeeDeliveryChat';

/**
 * DeliveryOrders Component
 * 
 * REQUIRED GOOGLE MAPS APIs (Enable in Google Cloud Console):
 * 1. Maps JavaScript API - For interactive maps with zoom/pan
 * 2. Directions API - For route rendering (optional but recommended)
 * 
 * API Key: Use the "Browser key (auto created by Firebase)" from Google Cloud Console
 * 
 * To enable APIs:
 * 1. Go to: https://console.cloud.google.com/apis/library?project=stockpilotv1
 * 2. Search for "Maps JavaScript API" and click "Enable"
 * 3. Search for "Directions API" and click "Enable" (for route rendering)
 */

// Google Maps API Key - Browser key from Firebase (same as used in other components)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";
const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

// Map container style - taller for better visibility
const mapContainerStyle = {
  width: '100%',
  height: '250px',
  borderRadius: '8px'
};

const DeliveryOrders = () => {
  const session = getEmployeeSession();
  const retailerId = session?.retailerId || '';
  const employeeId = session?.employeeId || '';

  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [storeLocation, setStoreLocation] = useState(null);
  const [distances, setDistances] = useState({});
  const [mapErrors, setMapErrors] = useState({});
  const [directions, setDirections] = useState({}); // Store directions for each delivery
  const [chatOrder, setChatOrder] = useState(null); // Order for which chat is open
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread messages per order

  // Load Google Maps JavaScript API
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: 'google-map-script-delivery',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch store location
  useEffect(() => {
    const fetchStoreLocation = async () => {
      if (!retailerId) return;
      try {
        const storeRef = doc(db, 'stores', retailerId);
        const storeDoc = await getDoc(storeRef);
        if (storeDoc.exists()) {
          const storeData = storeDoc.data();
          if (storeData.location) {
            setStoreLocation({
              lat: storeData.location.latitude || storeData.location._lat,
              lng: storeData.location.longitude || storeData.location._long
            });
          }
        }
      } catch (error) {
        console.error('Error fetching store location:', error);
      }
    };
    fetchStoreLocation();
  }, [retailerId]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Calculate distances for all active deliveries
  useEffect(() => {
    if (!storeLocation || activeDeliveries.length === 0) return;
    
    const newDistances = {};
    activeDeliveries.forEach((delivery) => {
      const customerLat = delivery.orderData?.deliveryAddress?.lat || delivery.orderData?.deliveryAddress?.latitude;
      const customerLng = delivery.orderData?.deliveryAddress?.lng || delivery.orderData?.deliveryAddress?.longitude;
      
      if (customerLat && customerLng) {
        const distance = calculateDistance(
          storeLocation.lat,
          storeLocation.lng,
          customerLat,
          customerLng
        );
        if (distance !== null) {
          newDistances[delivery.orderId] = {
            distance: Math.round(distance * 10) / 10, // Round to 1 decimal
            estimatedTime: Math.round(distance * 2) // Rough estimate: 2 min per km
          };
        }
      }
    });
    
    setDistances(newDistances);
  }, [storeLocation, activeDeliveries]);

  // Calculate route directions for a delivery
  const calculateRoute = (orderId, customerLat, customerLng, mapRef) => {
    if (!isMapLoaded || !storeLocation || !customerLat || !customerLng || !window.google?.maps) {
      return;
    }

    // Don't recalculate if already calculated
    if (directions[orderId]) {
      return;
    }

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const origin = new window.google.maps.LatLng(storeLocation.lat, storeLocation.lng);
      const destination = new window.google.maps.LatLng(customerLat, customerLng);

      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: window.google.maps.TravelMode.BICYCLING, // Use BICYCLING for bike routes on real roads
        },
        (result, status) => {
          if (status === 'OK' && result) {
            setDirections(prev => ({ ...prev, [orderId]: result }));
            
            // Auto-fit map to show the entire route
            if (mapRef && result.routes && result.routes[0]) {
              const bounds = new window.google.maps.LatLngBounds();
              result.routes[0].legs.forEach(leg => {
                bounds.extend(leg.start_location);
                bounds.extend(leg.end_location);
              });
              mapRef.fitBounds(bounds);
            }
          } else {
            console.warn('Directions request failed:', status);
            if (status === 'REQUEST_DENIED') {
              console.error('❌ Directions API is not enabled. Enable it at: https://console.cloud.google.com/apis/library/directions-backend.googleapis.com?project=stockpilotv1');
              console.error('Without Directions API, the route will not follow real roads.');
            } else if (status === 'ZERO_RESULTS') {
              console.warn('No route found. This might be because the locations are too close or unreachable by bike.');
            } else {
              console.error('Directions API error:', status);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  // Get Google Maps directions URL
  const getDirectionsUrl = (customerLat, customerLng) => {
    if (!storeLocation || !customerLat || !customerLng) return null;
    return `https://www.google.com/maps/dir/?api=1&origin=${storeLocation.lat},${storeLocation.lng}&destination=${customerLat},${customerLng}`;
  };

  // Subscribe to active deliveries
  useEffect(() => {
    if (!retailerId || !employeeId) {
      setLoading(false);
      return;
    }

    const normalizedEmployeeId = employeeId.toUpperCase().startsWith('EMP-') 
      ? employeeId.toUpperCase() 
      : employeeId;

    const unsubscribe = subscribeToEmployeeDeliveries(
      retailerId,
      normalizedEmployeeId,
      (deliveries) => {
        setActiveDeliveries(deliveries);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [retailerId, employeeId]);

  // Load delivery history
  useEffect(() => {
    if (!retailerId || !employeeId || !showHistory) return;

    getEmployeeDeliveryHistory(retailerId, employeeId, 20)
      .then((history) => {
        setDeliveryHistory(history);
      })
      .catch((error) => {
        console.error('Error loading delivery history:', error);
      });
  }, [retailerId, employeeId, showHistory]);

  // Track unread messages for each delivery order
  useEffect(() => {
    if (!activeDeliveries.length) return;

    const unsubscribes = activeDeliveries.map((delivery) => {
      const orderId = delivery.orderId;
      const messagesRef = collection(db, 'orderChats', orderId, 'messages');
      const q = query(messagesRef, where('senderType', '==', 'customer'), where('read', '==', false));

      return onSnapshot(q, (snapshot) => {
        const unreadCount = snapshot.size;
        setUnreadCounts(prev => ({
          ...prev,
          [orderId]: unreadCount
        }));
      }, (error) => {
        console.error(`Error tracking unread messages for order ${orderId}:`, error);
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeDeliveries]);

  // Handle pick up order
  const handlePickUp = async (orderId) => {
    try {
      setActionLoading(orderId);
      await markOrderPickedUp(retailerId, orderId, employeeId);
      setActionLoading(null);
    } catch (error) {
      console.error('Error marking order as picked up:', error);
      alert(error.message || 'Failed to mark order as picked up');
      setActionLoading(null);
    }
  };

  // Handle deliver order
  const handleDeliver = async (orderId) => {
    if (!window.confirm('Confirm delivery of this order?')) {
      return;
    }

    try {
      setActionLoading(orderId);
      await markOrderDeliveredByEmployee(retailerId, orderId, employeeId, {
        notes: '',
        signature: null,
        photo: null
      });
      setActionLoading(null);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      alert(error.message || 'Failed to mark order as delivered');
      setActionLoading(null);
    }
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return 'No address';
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.landmark,
      address.city,
      address.state,
      address.pincode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  };

  // Get status info
  const getStatusInfo = (status) => {
    const statusMap = {
      assigned: { label: 'Assigned', color: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40' },
      picked_up: { label: 'Picked Up', color: 'cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40' },
      out_for_delivery: { label: 'Out for Delivery', color: 'cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40' },
      delivered: { label: 'Delivered', color: 'green', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' }
    };
    return statusMap[status] || { label: status, color: 'gray', bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/40' };
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!retailerId || !employeeId) {
    return (
      <div className="p-6 text-center text-white/60">
        <p className="text-sm">Employee session not found. Please login again.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <FaSpinner className="animate-spin text-emerald-400 text-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FaTruck className="text-emerald-400" />
            My Deliveries
          </h2>
          <p className="text-xs text-white/60 mt-0.5">Manage your assigned orders</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            showHistory 
              ? 'bg-emerald-500 text-white' 
              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
          }`}
        >
          <FaHistory className="inline mr-1.5" />
          {showHistory ? 'Active' : 'History'}
        </button>
      </div>

      {/* Stats Cards - Compact */}
      {!showHistory && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <FaClock className="text-cyan-400 text-xs" />
              <span className="text-xs text-white/60">Active</span>
            </div>
            <p className="text-xl font-bold text-cyan-400">{activeDeliveries.length}</p>
          </div>
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <FaCheckCircle className="text-emerald-400 text-xs" />
              <span className="text-xs text-white/60">Delivered</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">{deliveryHistory.length}</p>
          </div>
        </div>
      )}

      {/* Active Deliveries */}
      {!showHistory && (
        <div className="space-y-3">
          {activeDeliveries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 rounded-xl p-8 text-center border border-white/10"
            >
              <FaBoxOpen className="text-4xl text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm">No active deliveries assigned</p>
              <p className="text-white/40 text-xs mt-1">New orders will appear here</p>
            </motion.div>
          ) : (
            activeDeliveries.map((delivery) => {
              const statusInfo = getStatusInfo(delivery.status);
              const StatusIcon = delivery.status === 'assigned' ? FaClock : 
                                delivery.status === 'picked_up' || delivery.status === 'out_for_delivery' ? FaMotorcycle : 
                                FaCheckCircle;

              return (
                <motion.div
                  key={delivery.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl border border-white/10 hover:border-emerald-500/50 transition-all overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="p-4 border-b border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border} border flex items-center gap-1.5`}>
                            <StatusIcon className="text-xs" />
                            {statusInfo.label}
                          </span>
                          <span className="text-white/40 text-xs">
                            #{delivery.orderData?.orderNumber || delivery.orderId.slice(-8)}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400">
                          ₹{delivery.orderData?.total || 0}
                        </div>
                      </div>
                      {/* Chat Button */}
                      <button
                        onClick={() => setChatOrder(delivery)}
                        className="relative p-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 hover:border-cyan-500/50 transition-all flex items-center justify-center group"
                        title="Chat with customer"
                      >
                        <FaComments className="text-cyan-400 text-sm" />
                        {unreadCounts[delivery.orderId] > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-slate-900">
                            {unreadCounts[delivery.orderId] > 9 ? '9+' : unreadCounts[delivery.orderId]}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Customer Info - Compact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 text-white/70">
                        <FaUser className="text-white/40 text-xs" />
                        <span className="truncate">{delivery.orderData?.customerName || 'Customer'}</span>
                      </div>
                      {delivery.orderData?.customerPhone && (
                        <a
                          href={`tel:${delivery.orderData.customerPhone}`}
                          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
                        >
                          <FaPhone className="text-xs" />
                          <span className="truncate">{delivery.orderData.customerPhone}</span>
                        </a>
                      )}
                      <div className="flex items-start gap-2 text-white/70 sm:col-span-2">
                        <FaMapMarkerAlt className="text-white/40 text-xs mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{formatAddress(delivery.orderData?.deliveryAddress)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Route & Distance Info */}
                  {(() => {
                    const customerLat = delivery.orderData?.deliveryAddress?.lat || delivery.orderData?.deliveryAddress?.latitude;
                    const customerLng = delivery.orderData?.deliveryAddress?.lng || delivery.orderData?.deliveryAddress?.longitude;
                    const distanceInfo = distances[delivery.orderId];
                    const directionsUrl = getDirectionsUrl(customerLat, customerLng);

                    // Show route section if we have coordinates, even if distance is still calculating
                    if (!customerLat || !customerLng || !storeLocation) return null;

                    return (
                      <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FaRoute className="text-emerald-400 text-sm" />
                            <span className="text-xs font-semibold text-white">Route Information</span>
                          </div>
                          {directionsUrl && (
                            <a
                              href={directionsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                            >
                              <FaDirections className="text-xs" />
                              {isMobile ? 'Route' : 'Full Route'}
                            </a>
                          )}
                        </div>
                        
                        {/* Distance & Time */}
                        {distanceInfo ? (
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-slate-900/50 rounded-lg p-2">
                              <div className="text-white/60 text-xs mb-0.5">Distance</div>
                              <div className="text-emerald-400 font-bold text-sm">{distanceInfo.distance} km</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-2">
                              <div className="text-white/60 text-xs mb-0.5">Est. Time</div>
                              <div className="text-cyan-400 font-bold text-sm">~{distanceInfo.estimatedTime} min</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3 text-xs text-white/50 flex items-center gap-2">
                            <FaSpinner className="animate-spin text-xs" />
                            <span>Calculating distance...</span>
                          </div>
                        )}

                        {/* Interactive Route Map */}
                        {(() => {
                          const customerLat = delivery.orderData?.deliveryAddress?.lat || delivery.orderData?.deliveryAddress?.latitude;
                          const customerLng = delivery.orderData?.deliveryAddress?.lng || delivery.orderData?.deliveryAddress?.longitude;
                          
                          if (!storeLocation || !customerLat || !customerLng) return null;

                          // Calculate center point for map
                          const mapCenter = {
                            lat: (storeLocation.lat + parseFloat(customerLat)) / 2,
                            lng: (storeLocation.lng + parseFloat(customerLng)) / 2
                          };

                          // Calculate route when map is loaded (handled in onLoad callback)

                          return (
                            <div className="rounded-lg overflow-hidden border border-white/10">
                              {mapLoadError ? (
                                <div className="w-full h-48 bg-slate-800 flex flex-col items-center justify-center">
                                  <FaMapMarkerAlt className="text-white/30 text-2xl mb-2" />
                                  <div className="text-white/50 text-xs text-center px-4 mb-2">
                                    Error loading map. Check API key.
                                  </div>
                                  {directionsUrl && (
                                    <a
                                      href={directionsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1"
                                    >
                                      <FaDirections className="text-xs" />
                                      Open in Maps
                                    </a>
                                  )}
                                </div>
                              ) : !isMapLoaded ? (
                                <div className="w-full h-48 bg-slate-800 flex items-center justify-center">
                                  <div className="text-center">
                                    <FaSpinner className="animate-spin text-emerald-400 text-2xl mx-auto mb-2" />
                                    <p className="text-white/60 text-xs">Loading map...</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  <GoogleMap
                                    mapContainerStyle={mapContainerStyle}
                                    center={mapCenter}
                                    zoom={13}
                                    onLoad={(map) => {
                                      // Calculate route automatically when map loads
                                      setTimeout(() => {
                                        calculateRoute(delivery.orderId, customerLat, customerLng, map);
                                      }, 500);
                                    }}
                                    options={{
                                      zoomControl: true,
                                      streetViewControl: false,
                                      mapTypeControl: true,
                                      fullscreenControl: true,
                                      panControl: true,
                                      disableDefaultUI: false,
                                      styles: [
                                        {
                                          featureType: "poi",
                                          elementType: "labels",
                                          stylers: [{ visibility: "off" }]
                                        }
                                      ]
                                    }}
                                  >
                                    {/* Store Marker */}
                                    <Marker
                                      position={{ lat: storeLocation.lat, lng: storeLocation.lng }}
                                      icon={{
                                        url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                                        scaledSize: new window.google.maps.Size(40, 40)
                                      }}
                                      title="Store Location"
                                      label={{
                                        text: "S",
                                        color: "white",
                                        fontWeight: "bold"
                                      }}
                                    />
                                    
                                    {/* Customer Marker */}
                                    <Marker
                                      position={{ lat: parseFloat(customerLat), lng: parseFloat(customerLng) }}
                                      icon={{
                                        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                                        scaledSize: new window.google.maps.Size(40, 40)
                                      }}
                                      title="Customer Location"
                                      label={{
                                        text: "D",
                                        color: "white",
                                        fontWeight: "bold"
                                      }}
                                    />
                                    
                                    {/* Route Directions - Automatically shows route line */}
                                    {directions[delivery.orderId] ? (
                                      <DirectionsRenderer 
                                        directions={directions[delivery.orderId]}
                                        options={{
                                          suppressMarkers: false,
                                          polylineOptions: {
                                            strokeColor: '#10b981',
                                            strokeWeight: 5,
                                            strokeOpacity: 0.8
                                          },
                                          markerOptions: {
                                            visible: false // Hide default markers since we have custom ones
                                          }
                                        }}
                                      />
                                    ) : (
                                      // Show loading state while route is being calculated
                                      // Don't show fallback polyline - wait for actual route from Directions API
                                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10 rounded-lg">
                                        <div className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
                                          <FaSpinner className="animate-spin text-emerald-400 text-sm" />
                                          <span className="text-white/80 text-xs">Calculating bike route...</span>
                                        </div>
                                      </div>
                                    )}
                                  </GoogleMap>
                                  
                                  {/* Distance Badge */}
                                  {distanceInfo && (
                                    <div className="absolute top-2 right-2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs z-10">
                                      <span className="text-emerald-400 font-semibold">{distanceInfo.distance} km</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="px-2 py-1.5 bg-slate-900/70 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-white/70">Store</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <span className="text-white/70">Customer</span>
                                  </div>
                                </div>
                                {directionsUrl && (
                                  <a
                                    href={directionsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                                  >
                                    {isMobile ? 'Maps' : 'Open in Maps'}
                                    <FaArrowRight className="text-xs" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Items - Compact */}
                  {delivery.orderData?.items && delivery.orderData.items.length > 0 && (
                    <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                      <div className="text-xs text-white/60 mb-2">Items ({delivery.orderData.items.length}):</div>
                      <div className="space-y-1.5">
                        {delivery.orderData.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-white/80 truncate flex-1">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-white/60 ml-2">₹{item.total || item.price * item.quantity}</span>
                          </div>
                        ))}
                        {delivery.orderData.items.length > 2 && (
                          <div className="text-white/40 text-xs pt-1">
                            +{delivery.orderData.items.length - 2} more items
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-4">
                    <div className="flex gap-2">
                      {delivery.status === 'assigned' && (
                        <button
                          onClick={() => handlePickUp(delivery.orderId)}
                          disabled={actionLoading === delivery.orderId}
                          className="flex-1 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                          {actionLoading === delivery.orderId ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <>
                              <FaBoxOpen />
                              Pick Up
                            </>
                          )}
                        </button>
                      )}
                      {(delivery.status === 'picked_up' || delivery.status === 'out_for_delivery') && (
                        <>
                          {delivery.orderData?.deliveryAddress?.lat && delivery.orderData?.deliveryAddress?.lng && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.orderData.deliveryAddress.lat},${delivery.orderData.deliveryAddress.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 text-sm"
                            >
                              <FaDirections />
                              {isMobile ? 'Route' : 'Directions'}
                            </a>
                          )}
                          <button
                            onClick={() => handleDeliver(delivery.orderId)}
                            disabled={actionLoading === delivery.orderId}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                          >
                            {actionLoading === delivery.orderId ? (
                              <FaSpinner className="animate-spin" />
                            ) : (
                              <>
                                <FaCheckCircle />
                                Deliver
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                    {delivery.assignedAt && (
                      <div className="text-white/40 text-xs mt-3 text-center">
                        Assigned: {formatTime(delivery.assignedAt)}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Delivery History */}
      {showHistory && (
        <div className="space-y-3">
          {deliveryHistory.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 rounded-xl p-8 text-center border border-white/10"
            >
              <FaHistory className="text-4xl text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm">No delivery history</p>
            </motion.div>
          ) : (
            deliveryHistory.map((delivery) => (
              <motion.div
                key={delivery.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-emerald-500/30 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FaCheckCircle className="text-emerald-400 text-sm" />
                      <span className="text-white font-medium text-sm">
                        Order #{delivery.orderData?.orderNumber || delivery.orderId.slice(-8)}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-emerald-400 mb-1">
                      ₹{delivery.orderData?.total || 0}
                    </div>
                    <div className="text-white/60 text-xs line-clamp-1">
                      {formatAddress(delivery.orderData?.deliveryAddress)}
                    </div>
                  </div>
                  {delivery.deliveredAt && (
                    <div className="text-white/40 text-xs text-right ml-3">
                      <div>{formatTime(delivery.deliveredAt)}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Chat Modal */}
      {chatOrder && (
        <EmployeeDeliveryChat
          order={chatOrder}
          employee={{
            name: session?.name || 'Employee',
            flypEmployeeId: session?.flypEmployeeId || employeeId
          }}
          onClose={() => setChatOrder(null)}
        />
      )}
    </div>
  );
};

export default DeliveryOrders;
