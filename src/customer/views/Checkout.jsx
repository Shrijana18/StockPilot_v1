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
  FaShoppingBag, FaInfoCircle, FaSearchLocation, FaCrosshairs, FaEdit, FaTag
} from 'react-icons/fa';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { placeOrder } from '../services/orderService';
import { getStoreById } from '../services/storeService';
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

// Delivery Type Option - Dark Theme
const DeliveryTypeOption = ({ type, icon: Icon, label, description, isSelected, onSelect, disabled }) => (
  <button
    onClick={() => !disabled && onSelect(type)}
    disabled={disabled}
    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
      disabled 
        ? 'border-white/10 bg-white/5/50 opacity-50 cursor-not-allowed'
        : isSelected 
          ? 'border-[#05E06C]500 bg-[#05E06C]/10' 
          : 'border-white/10 bg-white/5/50 hover:border-white/10'
    }`}
  >
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        isSelected ? 'bg-[#05E06C]' : 'bg-slate-700'
      }`}>
        <Icon className={`text-xl ${isSelected ? 'text-white' : 'text-white/60'}`} />
      </div>
      <div className="text-center">
        <p className={`font-semibold ${isSelected ? 'text-[#05E06C]400' : 'text-white'}`}>
          {label}
        </p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
    </div>
  </button>
);

// Time Slot Option - Dark Theme
const TimeSlot = ({ slot, isSelected, onSelect }) => (
  <button
    onClick={() => onSelect(slot)}
    className={`flex-1 p-3 rounded-xl border-2 transition-all ${
      isSelected 
        ? 'border-[#05E06C]500 bg-[#05E06C]/10' 
        : 'border-white/10 bg-white/5/50'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <FaClock className={isSelected ? 'text-[#05E06C]400' : 'text-white/40'} />
      <span className={`font-medium ${isSelected ? 'text-[#05E06C]400' : 'text-white'}`}>
        {slot.label}
      </span>
    </div>
    <p className="text-xs text-white/40">{slot.description}</p>
  </button>
);

// Pickup Slot Option - Dark Theme
const PickupSlot = ({ slot, isSelected, onSelect }) => (
  <button
    onClick={() => onSelect(slot)}
    className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${
      isSelected 
        ? 'border-emerald-500 bg-emerald-500/10' 
        : 'border-white/10 bg-white/5/50 hover:border-white/20'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isSelected ? 'bg-emerald-500' : 'bg-white/[0.06]'
      }`}>
        <FaClock className={isSelected ? 'text-white text-sm' : 'text-white/40 text-sm'} />
      </div>
      <span className={`font-medium ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
        {slot.time}
      </span>
    </div>
    {isSelected && <FaCheck className="text-emerald-400" />}
  </button>
);

// Date Selector for Pickup Scheduling
const DateSelector = ({ days, selectedDate, onSelect }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
    {days.map((day, idx) => (
      <button
        key={idx}
        onClick={() => onSelect(day.date)}
        className={`flex-shrink-0 w-16 py-2 px-1 rounded-xl border-2 transition-all ${
          selectedDate?.toDateString() === day.date.toDateString()
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-white/10 bg-white/5/50 hover:border-white/20'
        }`}
      >
        <div className="text-center">
          <p className={`text-[10px] font-medium ${
            selectedDate?.toDateString() === day.date.toDateString() 
              ? 'text-emerald-400' 
              : day.isToday ? 'text-amber-400' : 'text-white/50'
          }`}>
            {day.isToday ? 'Today' : day.isTomorrow ? 'Tmrw' : day.dayName}
          </p>
          <p className={`text-lg font-bold ${
            selectedDate?.toDateString() === day.date.toDateString() 
              ? 'text-emerald-400' 
              : 'text-white'
          }`}>
            {day.dayNum}
          </p>
        </div>
      </button>
    ))}
  </div>
);

// Payment Method Option - Dark Theme
const PaymentMethod = ({ method, isSelected, onSelect, badge }) => {
  const icons = {
    COD: FaMoneyBillWave,
    UPI: FaWallet,
    CARD: FaCreditCard,
    PAY_LATER: FaClock,
    PARTIAL: FaWallet
  };
  const Icon = icons[method.id] || FaMoneyBillWave;

  const colorClasses = {
    emerald: { border: 'border-[#05E06C]500', bg: 'bg-[#05E06C]/10', icon: 'bg-[#05E06C]', text: 'text-[#05E06C]400', check: 'text-[#05E06C]400' },
    amber: { border: 'border-amber-500', bg: 'bg-amber-500/10', icon: 'bg-amber-500', text: 'text-amber-400', check: 'text-amber-400' },
    purple: { border: 'border-purple-500', bg: 'bg-purple-500/10', icon: 'bg-purple-500', text: 'text-purple-400', check: 'text-purple-400' }
  };
  const colors = colorClasses[method.color || 'emerald'];

  return (
    <button
      onClick={() => onSelect(method)}
      className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
        isSelected 
          ? `${colors.border} ${colors.bg}` 
          : 'border-white/10 bg-white/5/50'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        isSelected ? colors.icon : 'bg-slate-700'
      }`}>
        <Icon className={isSelected ? 'text-white' : 'text-white/60'} />
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className={`font-medium ${isSelected ? colors.text : 'text-white'}`}>
            {method.label}
          </p>
          {badge && (
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${badge.color}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-xs text-white/40">{method.description}</p>
      </div>
      {isSelected && <FaCheck className={colors.check} />}
    </button>
  );
};

// Address Card - Dark Theme with location indicator
const AddressCard = ({ address, isSelected, onSelect }) => (
  <button
    onClick={() => onSelect(address)}
    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
      isSelected 
        ? 'border-emerald-500 bg-emerald-500/10' 
        : 'border-white/10 bg-white/5/50'
    }`}
  >
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isSelected ? 'bg-emerald-500' : 'bg-slate-700'
      }`}>
        <FaMapMarkerAlt className={isSelected ? 'text-white' : 'text-white/60'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-white">{address.label}</p>
          {address.latitude && address.longitude && (
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-medium">
              📍 Pinned
            </span>
          )}
        </div>
        <p className="text-sm text-white/60 mt-1 line-clamp-2">{address.address}</p>
      </div>
      {isSelected && <FaCheck className="text-emerald-400 flex-shrink-0" />}
    </div>
  </button>
);

const Checkout = ({ onBack, onOrderPlaced }) => {
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

  // Build payment methods based on store settings
  const getPaymentMethods = () => {
    const methods = [];
    const payOpts = storeSettings?.paymentOptions || { cod: true, upi: true };

    if (payOpts.cod !== false) {
      methods.push({ id: 'COD', label: 'Cash on Delivery', description: 'Pay when you receive', color: 'emerald' });
    }
    if (payOpts.upi !== false) {
      methods.push({ id: 'UPI', label: 'UPI Payment', description: 'GPay, PhonePe, Paytm', color: 'emerald' });
    }
    if (payOpts.payLater) {
      methods.push({ 
        id: 'PAY_LATER', 
        label: 'Pay Later', 
        description: `Pay within ${storeSettings?.payLaterDays || 7} days`, 
        color: 'amber',
        badge: { text: 'CREDIT', color: 'bg-amber-500/20 text-amber-400' }
      });
    }
    if (payOpts.partialPayment) {
      methods.push({ 
        id: 'PARTIAL', 
        label: 'Pay Advance + Later', 
        description: `Min ${storeSettings?.minAdvancePercent || 50}% now, rest on delivery`, 
        color: 'purple',
        badge: { text: 'SPLIT', color: 'bg-purple-500/20 text-purple-400' }
      });
    }

    return methods;
  };

  const paymentMethods = getPaymentMethods();

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

      const result = await placeOrder(orderData);

      if (result.success) {
        await triggerHaptic('success');
        clearCart();
        onOrderPlaced?.(result.orderId, result.orderNumber);
      } else {
        alert(result.error || 'Failed to place order');
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#05E06C]500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pickupEnabled = storeSettings?.pickupEnabled && storeSettings?.pickupTimeSlots?.some(s => s.enabled);

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl sticky top-0 z-10 border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
          >
            <FaArrowLeft className="text-white/60" />
          </button>
          <h1 className="font-bold text-white text-lg">Checkout</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Delivery Type Selection */}
        <div>
          <h3 className="font-semibold text-white mb-3">How would you like to receive?</h3>
          
          {/* Out of Range Notice - Show when only pickup available */}
          {!storeDeliveryAvailable && pickupEnabled && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2">
              <FaMapMarkerAlt className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-400 text-xs font-semibold">Store Pickup Only</p>
                <p className="text-amber-400/70 text-[11px] mt-0.5">
                  You are {customerDistance} km away from this store. Delivery is only available within {storeSettings?.deliveryRadius || 10} km.
                  Please pick up your order from the store.
                </p>
              </div>
            </div>
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
            
            {/* Show disabled delivery card to explain why it's not available */}
            {!storeDeliveryAvailable && (
              <div className="flex-1 p-4 rounded-xl border-2 border-white/5 bg-white/5/30 opacity-50 cursor-not-allowed">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-700/50">
                    <FaTruck className="text-xl text-white/30" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white/40">Delivery</p>
                    <p className="text-xs text-red-400/60">Out of range</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {!pickupEnabled && storeDeliveryAvailable && (
            <p className="text-xs text-white/40 mt-2 flex items-center gap-1">
              <FaInfoCircle />
              Pickup not available for this store
            </p>
          )}
        </div>

        {/* Delivery Address (only for delivery and when delivery is available) */}
        <AnimatePresence>
          {deliveryType === 'delivery' && storeDeliveryAvailable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="font-semibold text-white mb-3">Delivery Address</h3>
              
              {showAddAddress ? (
                <div className="bg-white/5/50 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
                  <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-emerald-400" />
                    Add Delivery Address
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
                            <FaSearchLocation className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-400" />
                            <input
                              type="text"
                              placeholder="Search your location..."
                              className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-white/10 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </Autocomplete>
                      </div>
                    )}
                    
                    {/* Map Container */}
                    <div className="relative rounded-xl overflow-hidden border border-white/10">
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
                      className="w-full mt-3 py-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
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
                    <label className="block text-xs font-medium text-slate-400 mb-2">Save as</label>
                    <div className="flex gap-2">
                      {['Home', 'Office', 'Other'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setNewAddress({ ...newAddress, label: type })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            newAddress.label === type
                              ? 'bg-emerald-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
                      <label className="block text-xs font-medium text-slate-400 mb-1">Full Address *</label>
                      <textarea
                        rows={2}
                        placeholder="House/Flat No., Building, Street"
                        value={newAddress.address}
                        onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Landmark (Optional)</label>
                      <input
                        type="text"
                        placeholder="Near temple, opposite park, etc."
                        value={newAddress.landmark}
                        onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">City *</label>
                        <input
                          type="text"
                          placeholder="City"
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Pincode *</label>
                        <input
                          type="text"
                          placeholder="Pincode"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                          className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Location Coordinates Badge */}
                  {newAddress.latitude && newAddress.longitude && (
                    <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                      <FaMapMarkerAlt className="text-emerald-400 text-xs" />
                      <span className="text-xs text-emerald-400">
                        Location pinned • Lat: {newAddress.latitude.toFixed(4)}, Lng: {newAddress.longitude.toFixed(4)}
                      </span>
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
                        className="flex-1 py-3 border border-white/10 rounded-xl text-white/60 font-medium"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleAddAddress}
                      disabled={!newAddress.address || !newAddress.city || !newAddress.pincode}
                      className="flex-1 py-3 bg-emerald-500 text-slate-900 rounded-xl font-medium hover:bg-emerald-400 transition disabled:bg-slate-700 disabled:text-white/40"
                    >
                      Save Address
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
                  <button
                    onClick={() => setShowAddAddress(true)}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-[#05E06C]500/30 bg-[#05E06C]/5 flex items-center justify-center gap-2 text-[#05E06C]400 font-medium"
                  >
                    <FaPlus className="text-sm" />
                    Add New Address
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Time Selection */}
        <div>
          <h3 className="font-semibold text-white mb-3">
            {deliveryType === 'delivery' ? 'Delivery Time' : 'Pickup Time'}
          </h3>
          
          {deliveryType === 'delivery' ? (
            <div className="space-y-4">
              {/* Quick Delivery vs Schedule Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsScheduledDelivery(false);
                    setSelectedTimeSlot('asap');
                  }}
                  className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                    !isScheduledDelivery
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-white/10 bg-white/5/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FaTruck className={!isScheduledDelivery ? 'text-emerald-400' : 'text-white/40'} />
                    <span className={`font-medium ${!isScheduledDelivery ? 'text-emerald-400' : 'text-white'}`}>
                      Quick Delivery
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsScheduledDelivery(true);
                    setSelectedTimeSlot('scheduled');
                  }}
                  className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                    isScheduledDelivery
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-white/10 bg-white/5/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FaClock className={isScheduledDelivery ? 'text-emerald-400' : 'text-white/40'} />
                    <span className={`font-medium ${isScheduledDelivery ? 'text-emerald-400' : 'text-white'}`}>
                      Schedule
                    </span>
                  </div>
                </button>
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

              {/* Scheduled Delivery - Date & Time Selection */}
              {isScheduledDelivery && (
                <div className="space-y-4 p-4 bg-white/5/50 rounded-xl border border-white/10">
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
                              <FaInfoCircle />
                              <span>
                                {selectedDeliveryDate.toDateString() === new Date().toDateString()
                                  ? 'No more slots available today. Please select another date.'
                                  : 'No delivery slots available for this date.'}
                              </span>
                            </div>
                          );
                        }
                        
                        return availableSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedDeliverySlot(slot)}
                            className={`w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all ${
                              selectedDeliverySlot?.time === slot.time
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-white/10 bg-white/5/50 hover:border-white/20'
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
                            {selectedDeliverySlot?.time === slot.time && <FaCheck className="text-emerald-400" />}
                          </button>
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
        </div>

        {/* Payment Method */}
        <div>
          <h3 className="font-semibold text-white mb-3">Payment Method</h3>
          <div className="space-y-2">
            {paymentMethods.map((method) => (
              <PaymentMethod
                key={method.id}
                method={method}
                isSelected={selectedPayment === method.id}
                onSelect={() => setSelectedPayment(method.id)}
                badge={method.badge}
              />
            ))}
          </div>

          {/* Partial Payment Amount */}
          {selectedPayment === 'PARTIAL' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
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

          {/* Pay Later Info */}
          {selectedPayment === 'PAY_LATER' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl"
            >
              <p className="text-sm text-amber-400">
                <strong>Pay Later:</strong> Full payment of ₹{amounts.finalTotal.toFixed(2)} due within {storeSettings?.payLaterDays || 7} days
              </p>
            </motion.div>
          )}
        </div>

        {/* Special Instructions */}
        <div>
          <h3 className="font-semibold text-white mb-3">Special Instructions (Optional)</h3>
          <textarea
            placeholder="Any special requests..."
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Store offers banner */}
        {storeSettings?.storeOffers?.length > 0 && storeSettings.storeOffers.some(o => o.enabled) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <FaTag className="text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-amber-300 text-sm">Store offers applied at checkout</p>
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
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
          <h3 className="font-semibold text-white mb-4">Order Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Items ({totals.itemCount})</span>
              <span className="font-medium text-white">₹{totals.subtotal.toFixed(2)}</span>
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
              <span className="text-white/60">
                {deliveryType === 'delivery' ? 'Delivery Fee' : 'Pickup'}
              </span>
              <span className={`font-medium ${amounts.deliveryFee === 0 ? 'text-emerald-400' : 'text-white'}`}>
                {amounts.deliveryFee === 0 ? 'FREE' : `₹${amounts.deliveryFee}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Platform Fee</span>
              <span className="font-medium text-white">₹{totals.platformFee}</span>
            </div>
            
            <div className="border-t border-white/10 pt-3 mt-3">
              <div className="flex justify-between font-bold text-base">
                <span className="text-white">Total</span>
                <span className="text-emerald-400">₹{amounts.finalTotal.toFixed(2)}</span>
              </div>
              
              {(selectedPayment === 'PARTIAL' || selectedPayment === 'PAY_LATER') && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Pay Now</span>
                    <span className="font-semibold text-emerald-400">₹{amounts.payNow.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Pay Later</span>
                    <span className="font-semibold text-amber-400">₹{amounts.payLater.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={handlePlaceOrder}
          disabled={
            loading || 
            (deliveryType === 'delivery' && !selectedAddress) || 
            (deliveryType === 'delivery' && isScheduledDelivery && !selectedDeliverySlot) ||
            (deliveryType === 'pickup' && !selectedPickupSlot)
          }
          className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
            loading || 
            (deliveryType === 'delivery' && !selectedAddress) || 
            (deliveryType === 'delivery' && isScheduledDelivery && !selectedDeliverySlot) ||
            (deliveryType === 'pickup' && !selectedPickupSlot)
              ? 'bg-white/5 text-white/40 cursor-not-allowed'
              : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 transition'
          }`}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Placing Order...
            </>
          ) : (
            <>
              Place Order • ₹{amounts.payNow > 0 ? amounts.payNow.toFixed(2) : amounts.finalTotal.toFixed(2)}
              {amounts.payLater > 0 && <span className="text-white/70 text-sm ml-1">(+₹{amounts.payLater.toFixed(2)} later)</span>}
            </>
          )}
        </button>
      </div>

      <div className="h-24" />
    </div>
  );
};

export default Checkout;
