/**
 * Checkout - Premium dark theme checkout
 * Supports: Delivery/Pickup, Pay Later, Partial Payment
 * Enhanced with Google Maps for address selection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaMapMarkerAlt, FaPlus, FaClock, FaCheck,
  FaMoneyBillWave, FaCreditCard, FaWallet, FaTruck, FaStore,
  FaShoppingBag, FaInfoCircle, FaSearchLocation, FaCrosshairs, FaEdit, FaTag,
  FaUniversity, FaLock
} from 'react-icons/fa';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { placeOrder, cancelOrder, createOrderDraft, confirmOrderAfterPayment, markOrderPaymentCancelled } from '../services/orderService';
import { getStoreById } from '../services/storeService';
import { openRazorpayCheckout } from '../services/razorpayPaymentService';
import { openPayUCheckout } from '../services/payuPaymentService';
import { computeStoreOfferDiscount } from '../../constants/marketplaceOffers';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";
const GOOGLE_MAPS_LIBRARIES = ["places"];

// Map container style for address selection
const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '12px'
};

// Map options
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

// Haptic feedback helper
const triggerHaptic = async (type = 'light') => {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch (e) {}
};

// Helper to parse time string like "10:00 AM" to minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

// Helper to check if a time slot is still available
const isSlotAvailable = (slot, bufferMinutes = 30) => {
  if (!slot?.time) return false;
  
  // Parse the slot time (e.g., "10:00 AM - 12:00 PM")
  const timeParts = slot.time.split(' - ');
  if (timeParts.length !== 2) return true; // Can't parse, show it
  
  const startTime = timeParts[0].trim();
  const slotStartMinutes = parseTimeToMinutes(startTime);
  
  // Get current time in minutes from midnight
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Slot is available if start time is at least bufferMinutes away
  return slotStartMinutes > currentMinutes + bufferMinutes;
};

// Helper to get available slots for a specific date
const getAvailableSlotsForDate = (slots, selectedDate, bufferMinutes = 30) => {
  if (!slots || !Array.isArray(slots)) return [];
  
  const enabledSlots = slots.filter(s => s.enabled);
  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  
  if (isToday) {
    // Filter out past slots for today
    return enabledSlots.filter(s => isSlotAvailable(s, bufferMinutes));
  }
  
  // For future dates, all enabled slots are available
  return enabledSlots;
};

// Helper to format date for display
const formatDateLabel = (date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

// Generate next 7 days for date selection
const getNextDays = (count = 7) => {
  const days = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      date,
      label: formatDateLabel(date),
      dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayNum: date.getDate(),
      isToday: i === 0,
      isTomorrow: i === 1
    });
  }
  
  return days;
};

// Delivery Type Option - Clean minimal card
const DeliveryTypeOption = ({ type, icon: Icon, label, description, isSelected, onSelect, disabled }) => (
  <motion.button
    onClick={() => !disabled && onSelect(type)}
    disabled={disabled}
    whileTap={!disabled ? { scale: 0.97 } : {}}
    className={`flex-1 p-4 rounded-2xl border transition-all duration-200 checkout-card-selectable ${
      disabled 
        ? 'border-white/[0.04] bg-white/[0.02] opacity-50 cursor-not-allowed'
        : isSelected 
          ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]' 
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.03]'
    }`}
  >
    <div className="flex flex-col items-center gap-2">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
        isSelected ? 'bg-emerald-500' : 'bg-white/[0.06]'
      }`}>
        <Icon className={`text-lg ${isSelected ? 'text-white' : 'text-white/50'}`} />
      </div>
      <div className="text-center">
        <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
          {label}
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">{description}</p>
      </div>
    </div>
  </motion.button>
);

// Time Slot Option - Pill style
const TimeSlot = ({ slot, isSelected, onSelect }) => (
  <motion.button
    onClick={() => onSelect(slot)}
    whileTap={{ scale: 0.97 }}
    className={`flex-1 py-3 px-4 rounded-xl border transition-all duration-200 ${
      isSelected 
        ? 'border-emerald-500/40 bg-emerald-500/10' 
        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
    }`}
  >
    <div className="flex items-center justify-center gap-2">
      <FaClock className={`text-sm ${isSelected ? 'text-emerald-400' : 'text-white/40'}`} />
      <span className={`font-medium text-sm ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
        {slot.label}
      </span>
    </div>
    <p className="text-[10px] text-white/40 mt-1 text-center">{slot.description}</p>
  </motion.button>
);

// Pickup Slot Option - Clean list item
const PickupSlot = ({ slot, isSelected, onSelect }) => (
  <motion.button
    onClick={() => onSelect(slot)}
    whileTap={{ scale: 0.99 }}
    className={`w-full py-3.5 px-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${
      isSelected 
        ? 'border-emerald-500/40 bg-emerald-500/10' 
        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
        isSelected ? 'bg-emerald-500' : 'bg-white/[0.06]'
      }`}>
        <FaClock className={isSelected ? 'text-white text-sm' : 'text-white/40 text-sm'} />
      </div>
      <span className={`font-medium text-sm ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
        {slot.time}
      </span>
    </div>
    {isSelected && <FaCheck className="text-emerald-400 text-sm" />}
  </motion.button>
);

// Date Selector - Horizontal pill scroll
const DateSelector = ({ days, selectedDate, onSelect }) => (
  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
    {days.map((day, idx) => {
      const isSelected = selectedDate?.toDateString() === day.date.toDateString();
      return (
        <motion.button
          key={idx}
          onClick={() => onSelect(day.date)}
          whileTap={{ scale: 0.95 }}
          className={`flex-shrink-0 w-14 py-2.5 px-2 rounded-xl border transition-all duration-200 ${
            isSelected ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <p className={`text-[10px] font-medium ${
            isSelected ? 'text-emerald-400' : day.isToday ? 'text-amber-400' : 'text-white/50'
          }`}>
            {day.isToday ? 'Today' : day.isTomorrow ? 'Tmrw' : day.dayName}
          </p>
          <p className={`text-base font-bold mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
            {day.dayNum}
          </p>
        </motion.button>
      );
    })}
  </div>
);

// Payment Method Option - Clean minimal row
const PaymentMethod = ({ method, isSelected, onSelect, badge }) => {
  const icons = {
    COD: FaMoneyBillWave,
    UPI: FaWallet,
    PAY_NOW_UPI: FaWallet,
    PAY_NOW_CARD: FaCreditCard,
    PAY_NOW_NETBANKING: FaUniversity,
    PAY_NOW_MORE: FaWallet,
    PAY_LATER: FaClock,
    PARTIAL: FaWallet
  };
  const Icon = icons[method.id] || FaMoneyBillWave;

  const colorMap = {
    emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', icon: 'bg-emerald-500', text: 'text-emerald-400', check: 'text-emerald-400' },
    amber: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', icon: 'bg-amber-500', text: 'text-amber-400', check: 'text-amber-400' },
    purple: { border: 'border-purple-500/40', bg: 'bg-purple-500/10', icon: 'bg-purple-500', text: 'text-purple-400', check: 'text-purple-400' }
  };
  const colors = colorMap[method.color || 'emerald'];

  return (
    <motion.button
      onClick={() => onSelect(method)}
      whileTap={{ scale: 0.99 }}
      className={`w-full p-4 rounded-xl border flex items-center gap-3 transition-all duration-200 ${
        isSelected ? `${colors.border} ${colors.bg}` : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        isSelected ? colors.icon : 'bg-white/[0.06]'
      }`}>
        <Icon className={`text-base ${isSelected ? 'text-white' : 'text-white/50'}`} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${isSelected ? colors.text : 'text-slate-200'}`}>
            {method.label}
          </p>
          {badge && (
            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${badge.color}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-xs text-white/45 mt-0.5">{method.description}</p>
      </div>
      {isSelected && <FaCheck className={`${colors.check} text-sm flex-shrink-0`} />}
    </motion.button>
  );
};

// Address Card - Clean minimal
const AddressCard = ({ address, isSelected, onSelect }) => (
  <motion.button
    onClick={() => onSelect(address)}
    whileTap={{ scale: 0.99 }}
    className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
      isSelected ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
    }`}
  >
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
        isSelected ? 'bg-emerald-500' : 'bg-white/[0.06]'
      }`}>
        <FaMapMarkerAlt className={`text-sm ${isSelected ? 'text-white' : 'text-white/50'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-slate-200">{address.label}</p>
          {address.latitude && address.longitude && (
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded-md font-medium">
              Pinned
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 mt-1 line-clamp-2">{address.address}</p>
      </div>
      {isSelected && <FaCheck className="text-emerald-400 text-sm flex-shrink-0" />}
    </div>
  </motion.button>
);

const Checkout = ({ onBack, onOrderPlaced, onPaymentCancelled }) => {
  const { cartItems, cartStore, getCartTotals, clearCart } = useCart();
  const { customer, customerData, addAddress } = useCustomerAuth();
  const totals = getCartTotals();

  // Store settings (fetched from store)
  const [storeSettings, setStoreSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Form state
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [selectedAddress, setSelectedAddress] = useState(
    customerData?.addresses?.find(a => a.isDefault) || customerData?.addresses?.[0] || null
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('asap');
  const [isScheduledDelivery, setIsScheduledDelivery] = useState(false);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState(new Date());
  const [selectedDeliverySlot, setSelectedDeliverySlot] = useState(null);
  const [selectedPickupSlot, setSelectedPickupSlot] = useState(null);
  const [selectedPickupDate, setSelectedPickupDate] = useState(new Date()); // Default to today
  const [selectedPayment, setSelectedPayment] = useState('COD');
  const [selectedUpiApp, setSelectedUpiApp] = useState('phonepe');
  const [upiId, setUpiId] = useState('');
  
  // Available dates for scheduling (delivery & pickup)
  const scheduleDays = getNextDays(7);
  const pickupDays = getNextDays(7);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(!customerData?.addresses?.length);
  const [newAddress, setNewAddress] = useState({ 
    label: 'Home', 
    address: '', 
    landmark: '',
    city: '', 
    pincode: '',
    latitude: null,
    longitude: null
  });
  
  // Google Maps state
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 }); // India center
  const [markerPosition, setMarkerPosition] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  
  // Delivery range state
  const [isWithinDeliveryRange, setIsWithinDeliveryRange] = useState(true);
  const [customerDistance, setCustomerDistance] = useState(null);
  const [storeDeliveryAvailable, setStoreDeliveryAvailable] = useState(true); // Based on current location
  
  // Haversine formula to calculate distance
  const calculateDistanceForDelivery = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Load Google Maps API
  const { isLoaded: mapsLoaded, loadError: mapsError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  
  // Map callbacks
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);
  
  const onAutocompleteLoad = useCallback((autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);
  
  // Reverse geocode helper
  const reverseGeocode = useCallback((lat, lng) => {
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const result = results[0];
          let city = '', pincode = '', addressLine = '';
          
          result.address_components.forEach(component => {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('postal_code')) {
              pincode = component.long_name;
            }
            if (component.types.includes('sublocality_level_1') || component.types.includes('sublocality')) {
              addressLine = component.long_name;
            }
          });
          
          setNewAddress(prev => ({
            ...prev,
            address: result.formatted_address,
            city: city || prev.city,
            pincode: pincode || prev.pincode,
            latitude: lat,
            longitude: lng
          }));
        }
      });
    }
  }, []);
  
  // Handle place selection from autocomplete
  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.geometry) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        setMarkerPosition({ lat, lng });
        setMapCenter({ lat, lng });
        
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(16);
        }
        
        let city = '', pincode = '';
        if (place.address_components) {
          place.address_components.forEach(component => {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('postal_code')) {
              pincode = component.long_name;
            }
          });
        }
        
        setNewAddress(prev => ({
          ...prev,
          address: place.formatted_address || '',
          city: city || prev.city,
          pincode: pincode || prev.pincode,
          latitude: lat,
          longitude: lng
        }));
      }
    }
  }, []);
  
  // Handle map click
  const onMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setMarkerPosition({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);
  
  // Handle marker drag
  const onMarkerDragEnd = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setMarkerPosition({ lat, lng });
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);
  
  // Get current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setMarkerPosition({ lat, lng });
        setMapCenter({ lat, lng });
        
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(16);
        }
        
        reverseGeocode(lat, lng);
        setGettingLocation(false);
        triggerHaptic('success');
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Could not get your location. Please search or tap on the map.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [reverseGeocode]);
  
  // Initialize map with current location when showing add address
  useEffect(() => {
    if (showAddAddress && mapsLoaded && !markerPosition) {
      getCurrentLocation();
    }
  }, [showAddAddress, mapsLoaded]);
  
  // Check delivery range when address changes
  useEffect(() => {
    if (selectedAddress && storeSettings) {
      // Get store location
      let storeLat, storeLng;
      if (storeSettings.location) {
        storeLat = storeSettings.location.latitude || storeSettings.location._lat;
        storeLng = storeSettings.location.longitude || storeSettings.location._long;
      }
      
      // Get customer address coordinates
      const customerLat = selectedAddress.latitude;
      const customerLng = selectedAddress.longitude;
      
      if (storeLat && storeLng && customerLat && customerLng) {
        const distance = calculateDistanceForDelivery(customerLat, customerLng, storeLat, storeLng);
        const roundedDistance = Math.round(distance * 10) / 10;
        setCustomerDistance(roundedDistance);
        
        // Check if within delivery radius
        const deliveryRadius = storeSettings.deliveryRadius || 10; // Default 10km
        const withinRange = roundedDistance <= deliveryRadius;
        setIsWithinDeliveryRange(withinRange);
        
        // Auto-switch to pickup if out of range and pickup is available
        if (!withinRange && storeSettings.pickupEnabled && deliveryType === 'delivery') {
          setDeliveryType('pickup');
        }
      } else {
        // Can't determine range without coordinates
        setIsWithinDeliveryRange(true);
        setCustomerDistance(null);
      }
    }
  }, [selectedAddress, storeSettings, deliveryType]);

  // Check if store delivery is available based on current location
  useEffect(() => {
    if (storeSettings && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const customerLat = position.coords.latitude;
          const customerLng = position.coords.longitude;
          
          // Get store location
          let storeLat, storeLng;
          if (storeSettings.location) {
            storeLat = storeSettings.location.latitude || storeSettings.location._lat;
            storeLng = storeSettings.location.longitude || storeSettings.location._long;
          }
          
          if (storeLat && storeLng) {
            const distance = calculateDistanceForDelivery(customerLat, customerLng, storeLat, storeLng);
            const deliveryRadius = storeSettings.deliveryRadius || 10;
            const withinRange = distance <= deliveryRadius;
            
            setStoreDeliveryAvailable(withinRange);
            setCustomerDistance(Math.round(distance * 10) / 10);
            
            // If out of range and pickup is available, auto-switch to pickup
            if (!withinRange && storeSettings.pickupEnabled) {
              setDeliveryType('pickup');
            }
          }
        },
        (error) => {
          console.log('Could not get location for range check:', error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [storeSettings]);

  // Fetch store settings
  useEffect(() => {
    const fetchStoreSettings = async () => {
      if (cartStore?.id) {
        try {
          const store = await getStoreById(cartStore.id);
          setStoreSettings(store);
          
          // Auto-select first AVAILABLE pickup slot for today
          if (store?.pickupTimeSlots?.length > 0) {
            const today = new Date();
            const availableSlots = getAvailableSlotsForDate(store.pickupTimeSlots, today, 30);
            if (availableSlots.length > 0) {
              setSelectedPickupSlot(availableSlots[0]);
            } else {
              // If no slots today, auto-select tomorrow and first slot
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              setSelectedPickupDate(tomorrow);
              const tomorrowSlots = getAvailableSlotsForDate(store.pickupTimeSlots, tomorrow, 30);
              if (tomorrowSlots.length > 0) {
                setSelectedPickupSlot(tomorrowSlots[0]);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching store settings:', error);
        } finally {
          setLoadingSettings(false);
        }
      }
    };
    
    fetchStoreSettings();
  }, [cartStore?.id]);
  
  // Update selected slot when date changes
  useEffect(() => {
    if (storeSettings?.pickupTimeSlots && selectedPickupDate) {
      const availableSlots = getAvailableSlotsForDate(storeSettings.pickupTimeSlots, selectedPickupDate, 30);
      if (availableSlots.length > 0 && !availableSlots.find(s => s.id === selectedPickupSlot?.id)) {
        setSelectedPickupSlot(availableSlots[0]);
      } else if (availableSlots.length === 0) {
        setSelectedPickupSlot(null);
      }
    }
  }, [selectedPickupDate, storeSettings?.pickupTimeSlots]);

  // Calculate advance amount for partial payment
  useEffect(() => {
    if (selectedPayment === 'PARTIAL' && storeSettings?.minAdvancePercent) {
      const minAdvance = Math.ceil((totals.total * storeSettings.minAdvancePercent) / 100);
      setAdvanceAmount(minAdvance);
    }
  }, [selectedPayment, totals.total, storeSettings?.minAdvancePercent]);

  // Quick delivery options
  const quickDeliverySlots = [
    { id: 'asap', label: 'ASAP', description: 'Within 45-60 min' },
    { id: '2hr', label: '2 Hours', description: 'Flexible delivery' },
  ];
  
  // Default delivery time slots for scheduling (store can customize these)
  const defaultDeliveryTimeSlots = storeSettings?.deliveryTimeSlots || [
    { time: '9:00 AM - 12:00 PM', enabled: true },
    { time: '12:00 PM - 3:00 PM', enabled: true },
    { time: '3:00 PM - 6:00 PM', enabled: true },
    { time: '6:00 PM - 9:00 PM', enabled: true },
  ];

  // Pay Online - includes UPI shortcuts, Cards, Net Banking, More options
  const isPayOnline = (id) => ['PAY_NOW_UPI', 'PAY_NOW_CARD', 'PAY_NOW_NETBANKING', 'PAY_NOW_MORE'].includes(id);
  const USE_PAYU = import.meta.env.VITE_USE_PAYU === 'true';

  // UPI app shortcuts (Astrotalk-style) - all map to PAY_NOW_UPI
  const UPI_SHORTCUTS = [
    { id: 'phonepe', label: 'PhonePe', icon: '/assets/payment/phonepe-icon.svg', bgColor: '#5F259F' },
    { id: 'gpay', label: 'GPay', icon: '/assets/payment/google-pay-icon.svg', bgColor: '#1A73E8' },
    { id: 'paytm', label: 'Paytm', icon: '/assets/payment/paytm-icon.svg', bgColor: '#002970' },
    { id: 'bhim', label: 'BHIM', icon: '/assets/payment/upi-payment-icon.svg', bgColor: '#00857D' },
  ];

  // Build payment methods grouped by section
  const getPaymentMethods = () => {
    const payOpts = storeSettings?.paymentOptions || { cod: true, upi: true, payNow: true };
    const sections = [];

    // Pay Online - UPI shortcuts + Cards, Net Banking, More options
    if (payOpts.payNow !== false) {
      sections.push({
        title: 'Pay Online',
        subtitle: USE_PAYU ? 'Secured by PayU' : 'Secured by Razorpay',
        hasUpiShortcuts: true,
        methods: [
          { id: 'PAY_NOW_CARD', label: 'Cards', description: 'Credit & Debit cards', color: 'emerald' },
          { id: 'PAY_NOW_NETBANKING', label: 'Net Banking', description: 'All major banks', color: 'emerald' },
          { id: 'PAY_NOW_MORE', label: 'More payment options', description: 'View all methods', color: 'emerald' },
        ],
      });
    }

    // Pay on Delivery
    const deliveryMethods = [];
    if (payOpts.cod !== false) {
      deliveryMethods.push({ id: 'COD', label: 'Cash on Delivery', description: 'Pay when you receive', color: 'emerald' });
    }
    if (payOpts.upi !== false) {
      deliveryMethods.push({ id: 'UPI', label: 'UPI on Delivery', description: 'GPay, PhonePe at doorstep', color: 'emerald' });
    }
    if (deliveryMethods.length) {
      sections.push({ title: 'Pay on Delivery', subtitle: null, methods: deliveryMethods });
    }

    // Pay Later, Partial
    const otherMethods = [];
    if (payOpts.payLater) {
      otherMethods.push({ 
        id: 'PAY_LATER', 
        label: 'Pay Later', 
        description: `Pay within ${storeSettings?.payLaterDays || 7} days`, 
        color: 'amber',
        badge: { text: 'CREDIT', color: 'bg-amber-500/20 text-amber-400' }
      });
    }
    if (payOpts.partialPayment) {
      otherMethods.push({ 
        id: 'PARTIAL', 
        label: 'Pay Advance + Later', 
        description: `Min ${storeSettings?.minAdvancePercent || 50}% now, rest on delivery`, 
        color: 'purple',
        badge: { text: 'SPLIT', color: 'bg-purple-500/20 text-purple-400' }
      });
    }
    if (otherMethods.length) {
      sections.push({ title: 'Other', subtitle: null, methods: otherMethods });
    }

    return sections;
  };

  const paymentSections = getPaymentMethods();

  // Handle add new address
  const handleAddAddress = async () => {
    if (!newAddress.address || !newAddress.city || !newAddress.pincode) {
      alert('Please fill all required fields');
      return;
    }
    
    const fullAddress = `${newAddress.address}${newAddress.landmark ? ', ' + newAddress.landmark : ''}, ${newAddress.city} - ${newAddress.pincode}`;
    
    const result = await addAddress({
      label: newAddress.label || 'Home',
      address: fullAddress,
      city: newAddress.city,
      pincode: newAddress.pincode,
      landmark: newAddress.landmark,
      latitude: newAddress.latitude,
      longitude: newAddress.longitude,
      isDefault: !customerData?.addresses?.length
    });

    if (result.success) {
      setSelectedAddress(result.address);
      setShowAddAddress(false);
      setMarkerPosition(null);
      setNewAddress({ label: 'Home', address: '', landmark: '', city: '', pincode: '', latitude: null, longitude: null });
    }
  };

  // Calculate final amounts (apply store-wide offers)
  const getFinalAmounts = () => {
    let deliveryFee = deliveryType === 'pickup' ? 0 : totals.deliveryFee;
    const { discountAmount, appliedOffer } = computeStoreOfferDiscount(
      totals.subtotal,
      storeSettings?.storeOffers || []
    );
    const subtotalAfterDiscount = Math.max(0, totals.subtotal - discountAmount);
    let finalTotal = subtotalAfterDiscount + deliveryFee + totals.platformFee;
    let payNow = finalTotal;
    let payLater = 0;

    if (selectedPayment === 'PAY_LATER') {
      payNow = 0;
      payLater = finalTotal;
    } else if (selectedPayment === 'PARTIAL') {
      payNow = advanceAmount;
      payLater = finalTotal - advanceAmount;
    } else if (isPayOnline(selectedPayment)) {
      payNow = finalTotal;
      payLater = 0;
    }

    return { deliveryFee, finalTotal, payNow, payLater, discountAmount, appliedOffer };
  };

  const amounts = getFinalAmounts();

  // Handle place order
  const handlePlaceOrder = async () => {
    if (deliveryType === 'delivery' && !selectedAddress) {
      alert('Please add a delivery address');
      return;
    }
    
    // Check delivery range
    if (deliveryType === 'delivery' && !isWithinDeliveryRange && customerDistance !== null) {
      alert(`Delivery is not available to your address. You are ${customerDistance} km away, but the store only delivers within ${storeSettings?.deliveryRadius || 10} km. Please choose Store Pickup instead.`);
      return;
    }
    if (deliveryType === 'pickup' && !selectedPickupSlot) {
      alert('Please select a pickup time slot');
      return;
    }
    
    // Validate scheduled delivery
    if (deliveryType === 'delivery' && isScheduledDelivery && !selectedDeliverySlot) {
      alert('Please select a delivery time slot');
      return;
    }

    setLoading(true);
    try {
      // Compute delivery scheduling info
      let deliveryInfo = {
        isScheduledDelivery: false,
        deliverySlot: null,
        deliveryDate: null,
        deliveryDateLabel: null
      };
      
      if (deliveryType === 'delivery') {
        // Check if user is in scheduled mode and selected a slot
        const hasScheduledSlot = isScheduledDelivery && selectedDeliverySlot && selectedDeliverySlot.time;
        
        if (hasScheduledSlot) {
          // Scheduled delivery with date and time slot
          deliveryInfo = {
            isScheduledDelivery: true,
            deliverySlot: selectedDeliverySlot.time,
            deliveryDate: selectedDeliveryDate.toISOString(),
            deliveryDateLabel: formatDateLabel(selectedDeliveryDate)
          };
          console.log('Scheduled delivery info:', deliveryInfo);
        } else {
          // Quick delivery (ASAP or 2hr)
          deliveryInfo = {
            isScheduledDelivery: false,
            deliverySlot: selectedTimeSlot,
            deliveryDate: null,
            deliveryDateLabel: null
          };
        }
      }

      const orderData = {
        customerId: customer.uid,
        customerName: customerData?.name || 'Customer',
        customerPhone: customer.phoneNumber || customerData?.phone || '',
        storeId: cartStore.id,
        storeName: cartStore.name || cartStore.businessName || 'Store',
        storePhone: storeSettings?.phone || '',
        items: cartItems.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity
        })),
        subtotal: totals.subtotal,
        discountAmount: amounts.discountAmount || 0,
        appliedOffer: amounts.appliedOffer || null,
        deliveryFee: amounts.deliveryFee,
        platformFee: totals.platformFee,
        total: amounts.finalTotal,
        orderType: deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? selectedAddress : null,
        // Customer distance from store (for ETA calculation)
        customerDistance: deliveryType === 'delivery' && customerDistance ? customerDistance : null,
        // Delivery scheduling info
        isScheduledDelivery: deliveryInfo.isScheduledDelivery,
        deliverySlot: deliveryInfo.deliverySlot,
        deliveryDate: deliveryInfo.deliveryDate,
        deliveryDateLabel: deliveryInfo.deliveryDateLabel,
        // Pickup scheduling info
        pickupSlot: deliveryType === 'pickup' ? selectedPickupSlot : null,
        pickupDate: deliveryType === 'pickup' ? selectedPickupDate.toISOString() : null,
        pickupDateLabel: deliveryType === 'pickup' ? formatDateLabel(selectedPickupDate) : null,
        pickupInstructions: deliveryType === 'pickup' ? storeSettings?.pickupInstructions : null,
        paymentMethod: selectedPayment,
        payNow: amounts.payNow,
        payLater: amounts.payLater,
        paymentDueDate: selectedPayment === 'PAY_LATER' 
          ? new Date(Date.now() + (storeSettings?.payLaterDays || 7) * 24 * 60 * 60 * 1000).toISOString()
          : null,
        specialInstructions
      };

      let result;
      if (isPayOnline(selectedPayment)) {
        // Pay Online: create DRAFT first - order only confirms after payment succeeds
        result = await createOrderDraft(orderData);
      } else {
        result = await placeOrder(orderData);
      }

      if (!result.success) {
        alert(result.error || 'Failed to place order');
        return;
      }

      // Pay Online: Open payment gateway (PayU or Razorpay)
      if (isPayOnline(selectedPayment)) {
        const payOpts = {
          orderId: result.orderId,
          amount: amounts.payNow,
          orderNumber: result.orderNumber,
          customerName: customerData?.name || 'Customer',
          customerEmail: customerData?.email || '',
          customerPhone: customer.phoneNumber || customerData?.phone || '',
          storeName: cartStore?.name || cartStore?.businessName || 'Store',
        };
        if (USE_PAYU) {
          payOpts.enforcePaymethod = selectedPayment === 'PAY_NOW_UPI' ? 'UPI' : '';
        } else {
          if (selectedPayment === 'PAY_NOW_UPI') {
            payOpts.preferredUpiApp = selectedUpiApp;
            if (selectedUpiApp === 'manual' && upiId.trim()) {
              payOpts.upiId = upiId.trim();
            }
          }
        }
        try {
          if (USE_PAYU) {
            await openPayUCheckout(payOpts);
            // PayU redirects - user lands on payment callback. Webhook updates order.
            return;
          }
          await openRazorpayCheckout(payOpts);
          await confirmOrderAfterPayment(result.orderId);
          await triggerHaptic('success');
          clearCart();
          onOrderPlaced?.(result.orderId, result.orderNumber);
        } catch (payError) {
          console.error('Razorpay error:', payError);
          const msg = payError?.message || 'Payment failed';
          const isCancelled = msg.toLowerCase().includes('cancelled');
          if (isCancelled) {
            // User closed Razorpay - mark payment cancelled, allow retry from My Orders
            await markOrderPaymentCancelled(result.orderId);
            clearCart(); // Avoid duplicate order if user taps Place Order again
            alert('Transaction cancelled. Go to My Orders and tap your order to try again.');
            onPaymentCancelled?.(result.orderId, result.orderNumber);
          } else {
            // Payment setup or other failure - cancel the draft
            try {
              await cancelOrder(result.orderId, 'Payment setup failed');
            } catch (cancelErr) {
              console.warn('Could not cancel order:', cancelErr);
            }
            alert('Payment could not be started. Please try again or choose another payment method.');
          }
          return;
        }
        return;
      }

      // COD, UPI on delivery, PAY_LATER, PARTIAL: Order placed, show success
      await triggerHaptic('success');
      clearCart();
      onOrderPlaced?.(result.orderId, result.orderNumber);
    } catch (error) {
      console.error('Order error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="customer-screen bg-[#0c0f14] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full"
        />
      </div>
    );
  }

  const pickupEnabled = storeSettings?.pickupEnabled && storeSettings?.pickupTimeSlots?.some(s => s.enabled);

  return (
    <div className="customer-screen checkout-page bg-[#0c0f14]">
      {/* Header - Minimal clean */}
      <div className="sticky top-0 z-20 bg-[#0c0f14]/80 backdrop-blur-xl border-b border-white/[0.06] flex-shrink-0">
        <div className="px-4 h-14 flex items-center gap-3" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <motion.button
            onClick={onBack}
            whileTap={{ scale: 0.92 }}
            className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center active:bg-white/[0.08]"
          >
            <FaArrowLeft className="text-slate-400 text-sm" />
          </motion.button>
          <h1 className="font-semibold text-slate-100 text-base tracking-tight">Checkout</h1>
        </div>
      </div>

      <div className="customer-scroll">
      <div className="px-4 py-5 space-y-8 customer-bottom-spacer">
        {/* Delivery Type Selection */}
        <motion.div className="checkout-section" style={{ animationDelay: '0.03s' }}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Delivery option</p>
          
          {/* Out of Range Notice */}
          {!storeDeliveryAvailable && pickupEnabled && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3"
            >
              <FaMapMarkerAlt className="text-amber-400 mt-0.5 flex-shrink-0 text-sm" />
              <div>
                <p className="text-amber-400 text-sm font-medium">Store Pickup Only</p>
                <p className="text-amber-400/80 text-xs mt-1">
                  You are {customerDistance} km away. Delivery available within {storeSettings?.deliveryRadius || 10} km. Pick up from store.
                </p>
              </div>
            </motion.div>
          )}
          
          <div className="flex gap-3">
            {/* Only show Delivery option if within range */}
            {storeDeliveryAvailable && (
              <DeliveryTypeOption
                type="delivery"
                icon={FaTruck}
                label="Delivery"
                description="To your address"
                isSelected={deliveryType === 'delivery'}
                onSelect={setDeliveryType}
              />
            )}
            
            {/* Pickup option */}
            <DeliveryTypeOption
              type="pickup"
              icon={FaShoppingBag}
              label={storeDeliveryAvailable ? "Pickup" : "Store Pickup"}
              description={storeDeliveryAvailable ? "From store" : "Only option available"}
              isSelected={deliveryType === 'pickup'}
              onSelect={setDeliveryType}
              disabled={!pickupEnabled}
            />
            
            {!storeDeliveryAvailable && (
              <div className="flex-1 p-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] opacity-60 cursor-not-allowed">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.04]">
                    <FaTruck className="text-lg text-white/30" />
                  </div>
                  <p className="font-medium text-slate-500 text-sm">Delivery</p>
                  <p className="text-[10px] text-red-400/70">Out of range</p>
                </div>
              </div>
            )}
          </div>
          
          {!pickupEnabled && storeDeliveryAvailable && (
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
              <FaInfoCircle className="text-slate-400" />
              Pickup not available for this store
            </p>
          )}
        </motion.div>

        {/* Delivery Address */}
        <AnimatePresence>
          {deliveryType === 'delivery' && storeDeliveryAvailable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="checkout-section"
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Delivery address</p>
              
              {showAddAddress ? (
                <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02]">
                  <h4 className="font-medium text-slate-200 text-sm mb-4 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-emerald-400 text-sm" />
                    Add delivery address
                  </h4>
                  
                  {/* Google Maps Section */}
                  <div className="mb-4">
                    {/* Search Box */}
                    {mapsLoaded && (
                      <div className="mb-3">
                        <Autocomplete
                          onLoad={onAutocompleteLoad}
                          onPlaceChanged={onPlaceChanged}
                          restrictions={{ country: 'in' }}
                        >
                          <div className="relative">
                            <FaSearchLocation className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/80 text-sm" />
                            <input
                              type="text"
                              placeholder="Search location..."
                              className="w-full pl-10 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30"
                            />
                          </div>
                        </Autocomplete>
                      </div>
                    )}
                    
                    {/* Map Container */}
                    <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                      {mapsError && (
                        <div className="h-[200px] flex items-center justify-center bg-red-500/10 text-red-400 text-sm">
                          <p>Error loading map</p>
                        </div>
                      )}
                      
                      {!mapsLoaded && !mapsError && (
                        <div className="h-[200px] flex items-center justify-center bg-slate-800">
                          <div className="text-center">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-white/60 text-xs">Loading map...</p>
                          </div>
                        </div>
                      )}
                      
                      {mapsLoaded && !mapsError && (
                        <GoogleMap
                          mapContainerStyle={mapContainerStyle}
                          center={mapCenter}
                          zoom={markerPosition ? 16 : 5}
                          options={mapOptions}
                          onLoad={onMapLoad}
                          onClick={onMapClick}
                        >
                          {markerPosition && (
                            <Marker
                              position={markerPosition}
                              draggable={true}
                              onDragEnd={onMarkerDragEnd}
                              icon={{
                                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                                scaledSize: new window.google.maps.Size(40, 40)
                              }}
                            />
                          )}
                        </GoogleMap>
                      )}
                      
                      {/* Map Instructions */}
                      {mapsLoaded && (
                        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                          <span className="px-2 py-1 bg-black/70 text-white text-[10px] rounded">
                            {markerPosition ? 'Drag pin to adjust' : 'Tap to place pin'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Current Location Button */}
                    <button
                      onClick={getCurrentLocation}
                      disabled={gettingLocation || !mapsLoaded}
                      className="w-full mt-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {gettingLocation ? (
                        <>
                          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          Getting location...
                        </>
                      ) : (
                        <>
                          <FaCrosshairs />
                          Use Current Location
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Address Type */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-2">Save as</label>
                    <div className="flex gap-2">
                      {['Home', 'Office', 'Other'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setNewAddress({ ...newAddress, label: type })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            newAddress.label === type
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Address Fields */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Full address *</label>
                      <textarea
                        rows={2}
                        placeholder="House/Flat No., Building, Street"
                        value={newAddress.address}
                        onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Landmark (optional)</label>
                      <input
                        type="text"
                        placeholder="Near temple, park, etc."
                        value={newAddress.landmark}
                        onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">City *</label>
                        <input
                          type="text"
                          placeholder="City"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Pincode *</label>
                        <input
                          type="text"
                          placeholder="Pincode"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                          className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Location Badge */}
                  {newAddress.latitude && newAddress.longitude && (
                    <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                      <FaMapMarkerAlt className="text-emerald-400 text-xs" />
                      <span className="text-xs text-emerald-400">Location pinned</span>
                    </div>
                  )}

                  <div className="flex gap-3 mt-5">
                    {customerData?.addresses?.length > 0 && (
                      <button
                        onClick={() => {
                          setShowAddAddress(false);
                          setMarkerPosition(null);
                          setNewAddress({ label: 'Home', address: '', landmark: '', city: '', pincode: '', latitude: null, longitude: null });
                        }}
                        className="flex-1 py-3 border border-white/[0.08] rounded-xl text-slate-400 font-medium text-sm active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleAddAddress}
                      disabled={!newAddress.address || !newAddress.city || !newAddress.pincode}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium text-sm disabled:bg-white/[0.06] disabled:text-slate-500 active:scale-[0.98]"
                    >
                      Save address
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerData?.addresses?.map((address) => (
                    <AddressCard
                      key={address.id}
                      address={address}
                      isSelected={selectedAddress?.id === address.id}
                      onSelect={setSelectedAddress}
                    />
                  ))}
                  <motion.button
                    onClick={() => setShowAddAddress(true)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center gap-2 text-emerald-400 font-medium text-sm"
                  >
                    <FaPlus className="text-sm" />
                    Add new address
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time Selection */}
        <motion.div className="checkout-section" style={{ animationDelay: '0.06s' }}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            {deliveryType === 'delivery' ? 'Delivery time' : 'Pickup time'}
          </p>
          
          {deliveryType === 'delivery' ? (
            <div className="space-y-4">
              {/* Quick vs Schedule Toggle */}
              <div className="flex gap-2">
                <motion.button
                  onClick={() => { setIsScheduledDelivery(false); setSelectedTimeSlot('asap'); }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 p-3 rounded-xl border transition-all duration-200 ${
                    !isScheduledDelivery ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FaTruck className={`text-sm ${!isScheduledDelivery ? 'text-emerald-400' : 'text-white/40'}`} />
                    <span className={`font-medium text-sm ${!isScheduledDelivery ? 'text-emerald-400' : 'text-slate-300'}`}>
                      Quick
                    </span>
                  </div>
                </motion.button>
                <motion.button
                  onClick={() => { setIsScheduledDelivery(true); setSelectedTimeSlot('scheduled'); }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex-1 p-3 rounded-xl border transition-all duration-200 ${
                    isScheduledDelivery ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FaClock className={`text-sm ${isScheduledDelivery ? 'text-emerald-400' : 'text-white/40'}`} />
                    <span className={`font-medium text-sm ${isScheduledDelivery ? 'text-emerald-400' : 'text-slate-300'}`}>
                      Schedule
                    </span>
                  </div>
                </motion.button>
              </div>

              {/* Quick Delivery Options */}
              {!isScheduledDelivery && (
                <div className="flex gap-2">
                  {quickDeliverySlots.map((slot) => (
                    <TimeSlot
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedTimeSlot === slot.id}
                      onSelect={() => setSelectedTimeSlot(slot.id)}
                    />
                  ))}
                </div>
              )}

              {/* Scheduled Delivery */}
              {isScheduledDelivery && (
                <div className="space-y-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  {/* Date Selector */}
                  <div>
                    <p className="text-xs text-white/50 mb-2">Select Delivery Date</p>
                    <DateSelector 
                      days={scheduleDays}
                      selectedDate={selectedDeliveryDate}
                      onSelect={setSelectedDeliveryDate}
                    />
                  </div>
                  
                  {/* Time Slots for Selected Date */}
                  <div>
                    <p className="text-xs text-white/50 mb-2">
                      Delivery Slots for {formatDateLabel(selectedDeliveryDate)}
                    </p>
                    <div className="space-y-2">
                      {(() => {
                        const availableSlots = getAvailableSlotsForDate(
                          defaultDeliveryTimeSlots, 
                          selectedDeliveryDate, 
                          60 // 1 hour buffer for delivery scheduling
                        );
                        
                        if (availableSlots.length === 0) {
                          return (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400 flex items-center gap-2">
                              <FaInfoCircle className="flex-shrink-0" />
                              <span>
                                {selectedDeliveryDate.toDateString() === new Date().toDateString()
                                  ? 'No more slots available today. Please select another date.'
                                  : 'No delivery slots available for this date.'}
                              </span>
                            </div>
                          );
                        }
                        
                        return availableSlots.map((slot, idx) => (
                          <motion.button
                            key={idx}
                            onClick={() => setSelectedDeliverySlot(slot)}
                            whileTap={{ scale: 0.99 }}
                            className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                              selectedDeliverySlot?.time === slot.time
                                ? 'border-emerald-500/40 bg-emerald-500/10'
                                : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                selectedDeliverySlot?.time === slot.time ? 'bg-emerald-500' : 'bg-white/[0.06]'
                              }`}>
                                <FaClock className={selectedDeliverySlot?.time === slot.time ? 'text-white text-sm' : 'text-white/40 text-sm'} />
                              </div>
                              <span className={`font-medium ${selectedDeliverySlot?.time === slot.time ? 'text-emerald-400' : 'text-white'}`}>
                                {slot.time}
                              </span>
                            </div>
                            {selectedDeliverySlot?.time === slot.time && <FaCheck className="text-emerald-400 text-sm" />}
                          </motion.button>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Selected Schedule Summary */}
                  {selectedDeliverySlot && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm">
                        <FaCheck className="text-xs" />
                        <span>
                          Scheduled for <strong>{formatDateLabel(selectedDeliveryDate)}</strong> at <strong>{selectedDeliverySlot.time}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Selector */}
              <div>
                <p className="text-xs text-white/50 mb-2">Select Date</p>
                <DateSelector 
                  days={pickupDays}
                  selectedDate={selectedPickupDate}
                  onSelect={setSelectedPickupDate}
                />
              </div>
              
              {/* Time Slots for Selected Date */}
              <div>
                <p className="text-xs text-white/50 mb-2">
                  Available Slots for {formatDateLabel(selectedPickupDate)}
                </p>
                <div className="space-y-2">
                  {(() => {
                    const availableSlots = getAvailableSlotsForDate(
                      storeSettings?.pickupTimeSlots, 
                      selectedPickupDate, 
                      30
                    );
                    
                    if (availableSlots.length === 0) {
                      return (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400 flex items-center gap-2">
                          <FaInfoCircle />
                          <span>
                            {selectedPickupDate.toDateString() === new Date().toDateString()
                              ? 'No more slots available today. Please select tomorrow or another date.'
                              : 'No pickup slots available for this date.'}
                          </span>
                        </div>
                      );
                    }
                    
                    return availableSlots.map((slot) => (
                      <PickupSlot
                        key={slot.id}
                        slot={slot}
                        isSelected={selectedPickupSlot?.id === slot.id}
                        onSelect={() => setSelectedPickupSlot(slot)}
                      />
                    ));
                  })()}
                </div>
              </div>
              
              {storeSettings?.pickupInstructions && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-400 flex items-start gap-2">
                  <FaInfoCircle className="mt-0.5 flex-shrink-0" />
                  <span>{storeSettings.pickupInstructions}</span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Payment Method */}
        <motion.div className="checkout-section" style={{ animationDelay: '0.09s' }}>
          {/* Header with security badge */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Payment method</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <FaLock className="text-emerald-400 text-[9px]" />
              <span className="text-[10px] text-emerald-400 font-semibold tracking-wide">100% Secure</span>
            </div>
          </div>

          <div className="space-y-3">

            {/* ── Pay Online Card ── */}
            {(storeSettings?.paymentOptions?.payNow !== false) && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                {/* Card Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.05]">
                  <p className="text-sm font-bold text-slate-100 tracking-tight">Pay Online</p>
                  <span className="text-[10px] text-slate-500 bg-white/[0.06] px-2 py-0.5 rounded-full font-medium">
                    {USE_PAYU ? 'Secured by PayU' : 'Secured by Razorpay'}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* UPI section label */}
                  <div className="flex items-center gap-2">
                    <img src="/assets/payment/upi-payment-icon.svg" alt="UPI" className="w-5 h-5 opacity-90" />
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">UPI</p>
                    <span className="ml-auto text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md tracking-wide">
                      RECOMMENDED
                    </span>
                  </div>

                  {/* 4 UPI App tiles — Zepto / Blinkit style */}
                  <div className="grid grid-cols-4 gap-2">
                    {UPI_SHORTCUTS.map((app) => {
                      const isSelected = selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === app.id;
                      return (
                        <motion.button
                          key={app.id}
                          type="button"
                          onClick={() => { setSelectedPayment('PAY_NOW_UPI'); setSelectedUpiApp(app.id); }}
                          whileTap={{ scale: 0.90 }}
                          className={`relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all duration-200 ${
                            isSelected
                              ? 'border-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.22)]'
                              : 'border-white/[0.08] active:border-white/[0.18]'
                          }`}
                          style={{ background: isSelected ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.025)' }}
                        >
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg z-10">
                              <FaCheck className="text-white text-[7px]" />
                            </span>
                          )}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shadow-sm"
                            style={{
                              background: app.bgColor + '28',
                              border: `1.5px solid ${app.bgColor}55`,
                            }}
                          >
                            <img src={app.icon} alt={app.label} className="w-7 h-7 object-contain" />
                          </div>
                          <span className={`text-[10px] font-semibold leading-tight text-center w-full truncate px-0.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {app.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Enter UPI ID row */}
                  <motion.button
                    type="button"
                    onClick={() => { setSelectedPayment('PAY_NOW_UPI'); setSelectedUpiApp('manual'); }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                      selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual'
                        ? 'border-emerald-500/50 bg-emerald-500/8'
                        : 'border-white/[0.07] bg-white/[0.02] active:bg-white/[0.05]'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual' ? 'bg-emerald-500' : 'bg-white/[0.07]'
                    }`}>
                      <FaWallet className={`text-sm ${selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual' ? 'text-white' : 'text-white/40'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-medium ${selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual' ? 'text-emerald-400' : 'text-slate-300'}`}>
                        Enter UPI ID
                      </p>
                      <p className="text-xs text-white/35 mt-0.5">Any UPI app · e.g. name@upi</p>
                    </div>
                    <span className={`text-base flex-shrink-0 ${selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual' ? 'text-emerald-400' : 'text-white/25'}`}>
                      {selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual' ? <FaCheck className="text-sm" /> : '›'}
                    </span>
                  </motion.button>

                  {/* Inline UPI ID input — expands when manual is selected */}
                  <AnimatePresence>
                    {selectedPayment === 'PAY_NOW_UPI' && selectedUpiApp === 'manual' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="yourname@paytm  /  @okaxis  /  @ybl"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="w-full pl-4 pr-16 py-3.5 bg-white/[0.05] border border-emerald-500/35 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <img src="/assets/payment/upi-payment-icon.svg" alt="UPI" className="h-5 w-auto opacity-45" />
                          </div>
                        </div>
                        <p className="text-[11px] text-white/30 mt-1.5 pl-1">
                          Works with PhonePe, GPay, Paytm, BHIM & all UPI apps
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── OR divider ── */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/[0.07]" />
                    <span className="text-[11px] text-white/25 font-semibold tracking-widest">OR</span>
                    <div className="flex-1 h-px bg-white/[0.07]" />
                  </div>

                  {/* Cards / NetBanking / More */}
                  <div className="space-y-2">
                    {[
                      { id: 'PAY_NOW_CARD', label: 'Credit / Debit Card', sub: 'Visa · Mastercard · RuPay', imgSrc: '/assets/payment/credit-card-color-icon.svg' },
                      { id: 'PAY_NOW_NETBANKING', label: 'Net Banking', sub: 'All major banks', Icon: FaUniversity },
                      { id: 'PAY_NOW_MORE', label: 'More payment options', sub: 'Wallets · EMI · & more', Icon: FaWallet },
                    ].map((item) => {
                      const isSel = selectedPayment === item.id;
                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => setSelectedPayment(item.id)}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
                            isSel
                              ? 'border-emerald-500/40 bg-emerald-500/8'
                              : 'border-white/[0.06] bg-white/[0.015] active:bg-white/[0.05]'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? 'bg-emerald-500' : 'bg-white/[0.07]'}`}>
                            {item.imgSrc
                              ? <img src={item.imgSrc} alt={item.label} className="w-5 h-5 object-contain" />
                              : <item.Icon className={`text-sm ${isSel ? 'text-white' : 'text-white/40'}`} />
                            }
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className={`text-sm font-medium ${isSel ? 'text-emerald-400' : 'text-slate-200'}`}>{item.label}</p>
                            <p className="text-xs text-white/35 mt-0.5">{item.sub}</p>
                          </div>
                          <span className={`text-base flex-shrink-0 ${isSel ? 'text-emerald-400' : 'text-white/25'}`}>
                            {isSel ? <FaCheck className="text-sm" /> : '›'}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Pay on Delivery Card ── */}
            {(() => {
              const pOpts = storeSettings?.paymentOptions || { cod: true, upi: true };
              const deliveryMethods = [];
              if (pOpts.cod !== false) deliveryMethods.push({ id: 'COD', label: 'Cash on Delivery', description: 'Pay when you receive', color: 'emerald' });
              if (pOpts.upi !== false) deliveryMethods.push({ id: 'UPI', label: 'UPI on Delivery', description: 'GPay, PhonePe at doorstep', color: 'emerald' });
              if (!deliveryMethods.length) return null;
              return (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                  <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
                    <p className="text-sm font-bold text-slate-100 tracking-tight">Pay on Delivery</p>
                  </div>
                  <div className="p-4 space-y-2">
                    {deliveryMethods.map((method, i) => (
                      <motion.div key={method.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <PaymentMethod
                          method={method}
                          isSelected={selectedPayment === method.id}
                          onSelect={() => setSelectedPayment(method.id)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Other Options Card (Pay Later / Partial) ── */}
            {(() => {
              const pOpts = storeSettings?.paymentOptions || {};
              const otherMethods = [];
              if (pOpts.payLater) otherMethods.push({
                id: 'PAY_LATER', label: 'Pay Later',
                description: `Pay within ${storeSettings?.payLaterDays || 7} days`,
                color: 'amber', badge: { text: 'CREDIT', color: 'bg-amber-500/20 text-amber-400' }
              });
              if (pOpts.partialPayment) otherMethods.push({
                id: 'PARTIAL', label: 'Pay Advance + Later',
                description: `Min ${storeSettings?.minAdvancePercent || 50}% now, rest on delivery`,
                color: 'purple', badge: { text: 'SPLIT', color: 'bg-purple-500/20 text-purple-400' }
              });
              if (!otherMethods.length) return null;
              return (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                  <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
                    <p className="text-sm font-bold text-slate-100 tracking-tight">Other Options</p>
                  </div>
                  <div className="p-4 space-y-2">
                    {otherMethods.map((method, i) => (
                      <motion.div key={method.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                        <PaymentMethod
                          method={method}
                          isSelected={selectedPayment === method.id}
                          onSelect={() => setSelectedPayment(method.id)}
                          badge={method.badge}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Context info based on current selection ── */}
          <AnimatePresence mode="wait">
            {selectedPayment === 'PARTIAL' && (
              <motion.div
                key="partial-info"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl"
              >
                <label className="block text-sm font-medium text-purple-400 mb-2">
                  Advance Amount (Min: ₹{Math.ceil((amounts.finalTotal * (storeSettings?.minAdvancePercent || 50)) / 100)})
                </label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => {
                    const min = Math.ceil((amounts.finalTotal * (storeSettings?.minAdvancePercent || 50)) / 100);
                    const val = Math.max(min, Math.min(amounts.finalTotal, parseInt(e.target.value) || 0));
                    setAdvanceAmount(val);
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/30 rounded-xl text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-purple-400 mt-2">
                  Remaining ₹{amounts.finalTotal - advanceAmount} to be paid on {deliveryType === 'delivery' ? 'delivery' : 'pickup'}
                </p>
              </motion.div>
            )}

            {isPayOnline(selectedPayment) && (
              <motion.div
                key="secure-info"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-3 flex items-center gap-3 p-3.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl"
              >
                <FaLock className="text-emerald-400 text-sm flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-emerald-400 font-semibold">Secure Checkout</p>
                  <p className="text-xs text-white/40 mt-0.5">256-bit encrypted · Order confirmed only after payment</p>
                </div>
                <span className="text-[11px] text-emerald-400/70 font-bold flex-shrink-0">
                  {USE_PAYU ? 'PayU' : 'Razorpay'}
                </span>
              </motion.div>
            )}

            {selectedPayment === 'PAY_LATER' && (
              <motion.div
                key="pay-later-info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl"
              >
                <p className="text-sm text-amber-400">
                  Full payment ₹{amounts.finalTotal.toFixed(2)} due within {storeSettings?.payLaterDays || 7} days
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Special Instructions */}
        <motion.div className="checkout-section" style={{ animationDelay: '0.12s' }}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Special instructions (optional)</p>
          <textarea
            placeholder="Any special requests..."
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </motion.div>

        {/* Store offers */}
        {storeSettings?.storeOffers?.length > 0 && storeSettings.storeOffers.some(o => o.enabled) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <FaTag className="text-amber-400 text-sm" />
            </div>
            <div>
              <p className="font-medium text-amber-400 text-sm">Offers applied</p>
              <p className="text-white/50 text-xs mt-0.5">
                {storeSettings.storeOffers.filter(o => o.enabled).map(o =>
                  o.type === 'percent_all'
                    ? `${o.value}% off on all orders`
                    : o.type === 'percent_above'
                      ? `${o.value}% off on orders above ₹${o.minOrderValue || 0}`
                      : null
                ).filter(Boolean).join(' • ')}
              </p>
            </div>
          </motion.div>
        )}

        {/* Order Summary */}
        <motion.div
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 checkout-section"
          style={{ animationDelay: '0.15s' }}
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Order summary</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Items ({totals.itemCount})</span>
              <span className="font-medium text-slate-200">₹{totals.subtotal.toFixed(2)}</span>
            </div>
            {amounts.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-amber-400">
                  {amounts.appliedOffer?.type === 'percent_all'
                    ? `${amounts.appliedOffer?.value}% off on all orders`
                    : amounts.appliedOffer?.type === 'percent_above'
                      ? `${amounts.appliedOffer?.value}% off (orders above ₹${amounts.appliedOffer?.minOrderValue || 0})`
                      : 'Store offer'}
                </span>
                <span className="font-medium text-amber-400">-₹{amounts.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">{deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</span>
              <span className={`font-medium ${amounts.deliveryFee === 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {amounts.deliveryFee === 0 ? 'FREE' : `₹${amounts.deliveryFee}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Platform</span>
              <span className="font-medium text-slate-200">₹{totals.platformFee}</span>
            </div>
            
            <div className="border-t border-white/[0.06] pt-3 mt-3">
              <div className="flex justify-between font-bold text-base">
                <span className="text-slate-200">Total</span>
                <span className="text-emerald-400">₹{amounts.finalTotal.toFixed(2)}</span>
              </div>
              
              {(selectedPayment === 'PARTIAL' || selectedPayment === 'PAY_LATER') && (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pay now</span>
                    <span className="font-semibold text-emerald-400">₹{amounts.payNow.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pay later</span>
                    <span className="font-semibold text-amber-400">₹{amounts.payLater.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Place Order Button - Clean CTA */}
        <motion.button
          onClick={handlePlaceOrder}
          disabled={
            loading || 
            (deliveryType === 'delivery' && !selectedAddress) || 
            (deliveryType === 'delivery' && isScheduledDelivery && !selectedDeliverySlot) ||
            (deliveryType === 'pickup' && !selectedPickupSlot)
          }
          whileTap={!(loading || (deliveryType === 'delivery' && !selectedAddress) || (deliveryType === 'delivery' && isScheduledDelivery && !selectedDeliverySlot) || (deliveryType === 'pickup' && !selectedPickupSlot)) ? { scale: 0.98 } : {}}
          className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all duration-200 ${
            loading || 
            (deliveryType === 'delivery' && !selectedAddress) || 
            (deliveryType === 'delivery' && isScheduledDelivery && !selectedDeliverySlot) ||
            (deliveryType === 'pickup' && !selectedPickupSlot)
              ? 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
              : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:bg-emerald-600'
          }`}
        >
          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full"
              />
              <span>{isPayOnline(selectedPayment) ? 'Opening payment...' : 'Placing order...'}</span>
            </>
          ) : (
            <>
              {isPayOnline(selectedPayment)
                ? `Pay ₹${amounts.payNow.toFixed(2)}`
                : `Place order · ₹${amounts.payNow > 0 ? amounts.payNow.toFixed(2) : amounts.finalTotal.toFixed(2)}`}
              {!isPayOnline(selectedPayment) && amounts.payLater > 0 && (
                <span className="text-white/80 text-sm">(+₹{amounts.payLater.toFixed(2)} later)</span>
              )}
            </>
          )}
        </motion.button>
      </div>
      </div>
    </div>
  );
};

export default Checkout;
