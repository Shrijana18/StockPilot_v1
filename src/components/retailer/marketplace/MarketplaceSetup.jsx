/**
 * MarketplaceSetup - Configure store for customer marketplace
 * Enhanced with Google Maps based location and delivery area settings
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FaStore, FaMapMarkerAlt, FaClock, FaPhone, FaImage,
  FaSave, FaToggleOn, FaToggleOff, FaTruck, FaRupeeSign,
  FaCheckCircle, FaExclamationTriangle, FaWallet, FaShoppingBag,
  FaPlus, FaTrash, FaUpload, FaTimes, FaCamera, FaLock, FaUnlock,
  FaSearchLocation, FaRoute, FaInfoCircle
} from 'react-icons/fa';
import { auth, db, storage } from '../../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMarketplaceStore, saveMarketplaceStore, toggleStoreStatus } from '../../../services/retailerMarketplaceService';
import { GoogleMap, useJsApiLoader, Marker, Circle, Autocomplete, InfoWindow } from '@react-google-maps/api';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";

// Google Maps libraries
const GOOGLE_MAPS_LIBRARIES = ["places"];

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '12px'
};

// Default map options
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ]
};

const MarketplaceSetup = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeData, setStoreData] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Image upload states
  const [logoFile, setLogoFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'General Store',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    locationLocked: false, // Lock store location
    logoUrl: '',
    bannerUrl: '',
    // Operating hours
    openTime: '09:00',
    closeTime: '21:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    // Enhanced Delivery settings
    deliveryEnabled: true,
    deliveryRadius: 5, // in km
    minOrderValue: 100, // minimum order for delivery
    deliveryFee: 20,
    freeDeliveryAbove: 500,
    // Distance-based delivery fee
    distanceBasedFee: false,
    baseFee: 20, // base delivery fee
    perKmFee: 5, // fee per km after base distance
    baseDistance: 2, // free/base km
    // Estimated delivery time
    estimatedDeliveryPerKm: 5, // minutes per km
    baseDeliveryTime: 30, // base time in minutes
    // Time slots
    deliverySlots: ['ASAP', '2 Hours', '4 Hours', 'Same Day'],
    // Payment Options
    paymentOptions: {
      cod: true,           // Cash on Delivery
      upi: true,           // UPI Payment
      payLater: false,     // Pay Later option
      partialPayment: false // Pay advance + Pay later
    },
    payLaterDays: 7,       // Max days for pay later
    minAdvancePercent: 50, // Minimum advance payment percentage
    // Pickup Options
    pickupEnabled: false,
    pickupTimeSlots: [
      { id: '1', time: '10:00 AM - 12:00 PM', enabled: true },
      { id: '2', time: '12:00 PM - 02:00 PM', enabled: true },
      { id: '3', time: '02:00 PM - 04:00 PM', enabled: true },
      { id: '4', time: '04:00 PM - 06:00 PM', enabled: true },
      { id: '5', time: '06:00 PM - 08:00 PM', enabled: true }
    ],
    pickupInstructions: ''
  });
  
  // Google Maps state
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [showInfoWindow, setShowInfoWindow] = useState(false);
  
  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
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
  
  // Handle place selection from autocomplete
  const onPlaceChanged = useCallback(() => {
    if (formData.locationLocked) return;
    
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.geometry) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        setFormData(prev => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          address: place.formatted_address || prev.address
        }));
        
        // Extract city and pincode from address components
        if (place.address_components) {
          place.address_components.forEach(component => {
            if (component.types.includes('locality')) {
              setFormData(prev => ({ ...prev, city: component.long_name }));
            }
            if (component.types.includes('postal_code')) {
              setFormData(prev => ({ ...prev, pincode: component.long_name }));
            }
            if (component.types.includes('administrative_area_level_1')) {
              setFormData(prev => ({ ...prev, state: component.long_name }));
            }
          });
        }
        
        setMessage({ type: 'success', text: 'Location set from search. Click Lock to save permanently.' });
      }
    }
  }, [formData.locationLocked]);
  
  // Reverse geocode helper function
  const reverseGeocode = useCallback((lat, lng) => {
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          setFormData(prev => ({
            ...prev,
            address: results[0].formatted_address
          }));
          
          // Extract city, pincode and state
          results[0].address_components.forEach(component => {
            if (component.types.includes('locality')) {
              setFormData(prev => ({ ...prev, city: component.long_name }));
            }
            if (component.types.includes('postal_code')) {
              setFormData(prev => ({ ...prev, pincode: component.long_name }));
            }
            if (component.types.includes('administrative_area_level_1')) {
              setFormData(prev => ({ ...prev, state: component.long_name }));
            }
          });
        }
      });
    }
  }, []);

  // Handle map click
  const onMapClick = useCallback((e) => {
    if (formData.locationLocked) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6)
    }));
    
    // Reverse geocode to get address
    reverseGeocode(lat, lng);
    
    setShowInfoWindow(true);
    setMessage({ type: 'success', text: 'Location set! Drag the pin to adjust or click Lock to save.' });
  }, [formData.locationLocked, reverseGeocode]);
  
  // Handle marker drag end
  const onMarkerDragEnd = useCallback((e) => {
    if (formData.locationLocked) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6)
    }));
    
    // Reverse geocode to get address
    reverseGeocode(lat, lng);
    
    setShowInfoWindow(true);
    setMessage({ type: 'success', text: 'Location updated! Click Lock to save permanently.' });
  }, [formData.locationLocked, reverseGeocode]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Load business profile
      const businessDoc = await getDoc(doc(db, 'businesses', userId));
      if (businessDoc.exists()) {
        const business = businessDoc.data();
        setBusinessData(business);

        // Pre-fill from business profile
        setFormData(prev => ({
          ...prev,
          name: business.businessName || '',
          phone: business.phone || '',
          email: business.email || '',
          address: business.address || '',
          city: business.city || '',
          state: business.state || '',
          pincode: business.pincode || '',
          logoUrl: business.logoUrl || ''
        }));
      }

      // Load existing marketplace store
      const store = await getMarketplaceStore(userId);
      if (store) {
        setStoreData(store);
        setFormData(prev => ({
          ...prev,
          ...store,
          latitude: store.location?.latitude || '',
          longitude: store.location?.longitude || ''
        }));
        // Set image previews
        if (store.logoUrl) setLogoPreview(store.logoUrl);
        if (store.bannerUrl) setBannerPreview(store.bannerUrl);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load store data' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleWorkingDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day]
    }));
  };

  const handlePaymentOptionToggle = (option) => {
    setFormData(prev => ({
      ...prev,
      paymentOptions: {
        ...prev.paymentOptions,
        [option]: !prev.paymentOptions[option]
      }
    }));
  };

  const handlePickupSlotToggle = (slotId) => {
    setFormData(prev => ({
      ...prev,
      pickupTimeSlots: prev.pickupTimeSlots.map(slot =>
        slot.id === slotId ? { ...slot, enabled: !slot.enabled } : slot
      )
    }));
  };

  const addPickupSlot = () => {
    const newId = Date.now().toString();
    setFormData(prev => ({
      ...prev,
      pickupTimeSlots: [
        ...prev.pickupTimeSlots,
        { id: newId, time: 'New Time Slot', enabled: true }
      ]
    }));
  };

  const updatePickupSlotTime = (slotId, newTime) => {
    setFormData(prev => ({
      ...prev,
      pickupTimeSlots: prev.pickupTimeSlots.map(slot =>
        slot.id === slotId ? { ...slot, time: newTime } : slot
      )
    }));
  };

  const removePickupSlot = (slotId) => {
    setFormData(prev => ({
      ...prev,
      pickupTimeSlots: prev.pickupTimeSlots.filter(slot => slot.id !== slotId)
    }));
  };

  // Image upload handlers
  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Logo image must be less than 5MB' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Banner image must be less than 10MB' });
        return;
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setBannerPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file, path) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setUploadingLogo(true);
    try {
      const logoUrl = await uploadImage(logoFile, `stores/${userId}/logo`);
      setFormData(prev => ({ ...prev, logoUrl }));
      setLogoFile(null);
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage({ type: 'error', text: 'Failed to upload logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadBanner = async () => {
    if (!bannerFile) return;
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setUploadingBanner(true);
    try {
      const bannerUrl = await uploadImage(bannerFile, `stores/${userId}/banner`);
      setFormData(prev => ({ ...prev, bannerUrl }));
      setBannerFile(null);
      setMessage({ type: 'success', text: 'Banner uploaded successfully!' });
    } catch (error) {
      console.error('Error uploading banner:', error);
      setMessage({ type: 'error', text: 'Failed to upload banner' });
    } finally {
      setUploadingBanner(false);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setFormData(prev => ({ ...prev, logoUrl: '' }));
  };

  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview('');
    setFormData(prev => ({ ...prev, bannerUrl: '' }));
  };

  const handleSave = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const storePayload = {
        ...formData,
        location: {
          latitude: parseFloat(formData.latitude) || 0,
          longitude: parseFloat(formData.longitude) || 0,
          locked: formData.locationLocked || false
        },
        // Numeric conversions
        minOrderValue: parseFloat(formData.minOrderValue) || 0,
        deliveryFee: parseFloat(formData.deliveryFee) || 0,
        freeDeliveryAbove: parseFloat(formData.freeDeliveryAbove) || 0,
        deliveryRadius: parseFloat(formData.deliveryRadius) || 5,
        // Distance-based fee
        distanceBasedFee: formData.distanceBasedFee || false,
        baseFee: parseFloat(formData.baseFee) || 20,
        perKmFee: parseFloat(formData.perKmFee) || 5,
        baseDistance: parseFloat(formData.baseDistance) || 2,
        // Estimated delivery time
        baseDeliveryTime: parseFloat(formData.baseDeliveryTime) || 30,
        estimatedDeliveryPerKm: parseFloat(formData.estimatedDeliveryPerKm) || 5
      };

      // Remove individual lat/lng fields (stored in location object)
      delete storePayload.latitude;
      delete storePayload.longitude;

      const result = await saveMarketplaceStore(userId, storePayload);

      if (result.success) {
        setMessage({ type: 'success', text: 'Store settings saved successfully!' });
        setStoreData({ ...storeData, ...storePayload });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStore = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !storeData) return;

    const newStatus = !storeData.isActive;
    const result = await toggleStoreStatus(userId, newStatus);
    
    if (result.success) {
      setStoreData(prev => ({ ...prev, isActive: newStatus }));
      setMessage({ 
        type: 'success', 
        text: newStatus ? 'Store is now OPEN for orders!' : 'Store is now CLOSED'
      });
    }
  };

  const getCurrentLocation = () => {
    if (formData.locationLocked) {
      setMessage({ type: 'error', text: 'Location is locked. Unlock it first to update.' });
      return;
    }
    
    if (navigator.geolocation) {
      setMessage({ type: '', text: '' });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setFormData(prev => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6)
          }));
          
          // Reverse geocode to get address
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === 'OK' && results[0]) {
                setFormData(prev => ({
                  ...prev,
                  address: results[0].formatted_address
                }));
                
                // Extract city and pincode
                results[0].address_components.forEach(component => {
                  if (component.types.includes('locality')) {
                    setFormData(prev => ({ ...prev, city: component.long_name }));
                  }
                  if (component.types.includes('postal_code')) {
                    setFormData(prev => ({ ...prev, pincode: component.long_name }));
                  }
                  if (component.types.includes('administrative_area_level_1')) {
                    setFormData(prev => ({ ...prev, state: component.long_name }));
                  }
                });
              }
            });
          }
          
          setMessage({ type: 'success', text: 'Location captured! Click Lock to save this location permanently.' });
        },
        (error) => {
          setMessage({ type: 'error', text: 'Could not get location: ' + error.message });
        },
        { enableHighAccuracy: true }
      );
    }
  };
  
  // Toggle location lock
  const toggleLocationLock = () => {
    if (!formData.latitude || !formData.longitude) {
      setMessage({ type: 'error', text: 'Please set a location first before locking.' });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      locationLocked: !prev.locationLocked
    }));
    
    setMessage({ 
      type: 'success', 
      text: formData.locationLocked 
        ? 'Location unlocked. You can now update it.' 
        : 'Location locked! This location will be saved as your store address.'
    });
  };
  
  // Get map center
  const mapCenter = useMemo(() => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    // Default to India center
    return { lat: 20.5937, lng: 78.9629 };
  }, [formData.latitude, formData.longitude]);
  
  // Delivery radius in meters for circle
  const deliveryRadiusMeters = (parseFloat(formData.deliveryRadius) || 5) * 1000;

  const storeCategories = [
    'General Store', 'Grocery', 'Supermarket', 'Pharmacy', 'Electronics',
    'Clothing', 'Hardware', 'Stationery', 'Bakery', 'Dairy', 'Fruits & Vegetables'
  ];

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store Status Banner */}
      {storeData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center justify-between ${
            storeData.isActive
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <FaStore className={storeData.isActive ? 'text-emerald-400' : 'text-red-400'} />
            <div>
              <p className="font-semibold text-white">
                Store is {storeData.isActive ? 'OPEN' : 'CLOSED'}
              </p>
              <p className="text-sm text-white/60">
                {storeData.isActive 
                  ? 'Customers can see your store and place orders'
                  : 'Your store is hidden from customers'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleStore}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              storeData.isActive
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {storeData.isActive ? <FaToggleOn /> : <FaToggleOff />}
            {storeData.isActive ? 'Close Store' : 'Open Store'}
          </button>
        </motion.div>
      )}

      {/* Message */}
      {message.text && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-300' 
              : 'bg-red-500/20 text-red-300'
          }`}
        >
          {message.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
          {message.text}
        </motion.div>
      )}

      {/* Basic Info */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaStore className="text-emerald-400" />
          Store Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Store Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              placeholder="Your Store Name"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              {storeCategories.map(cat => (
                <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-white/60 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              placeholder="Brief description of your store..."
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Phone *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              placeholder="+91 9999999999"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              placeholder="store@example.com"
            />
          </div>
        </div>
      </div>

      {/* Store Images */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaImage className="text-emerald-400" />
          Store Images
        </h3>
        <p className="text-white/60 text-sm mb-4">
          Add images to make your store stand out to customers
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Store Logo</label>
            <p className="text-white/40 text-xs mb-3">Square image, shown on store cards and headers</p>
            
            <div className="relative">
              {logoPreview || formData.logoUrl ? (
                <div className="relative group">
                  <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-white/20 bg-white/5">
                    <img 
                      src={logoPreview || formData.logoUrl} 
                      alt="Store Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition"
                  >
                    <FaTimes size={10} />
                  </button>
                  {logoFile && (
                    <button
                      onClick={handleUploadLogo}
                      disabled={uploadingLogo}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs rounded-full hover:bg-emerald-600 transition disabled:opacity-50 flex items-center gap-1"
                    >
                      {uploadingLogo ? (
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FaUpload size={10} />
                      )}
                      {uploadingLogo ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-32 h-32 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition"
                >
                  <FaCamera className="text-white/40 text-xl" />
                  <span className="text-white/40 text-xs">Add Logo</span>
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
            </div>
            
            {!logoPreview && !formData.logoUrl && (
              <button
                onClick={() => logoInputRef.current?.click()}
                className="mt-3 px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm hover:bg-white/15 transition flex items-center gap-2"
              >
                <FaUpload size={12} />
                Choose Image
              </button>
            )}
          </div>

          {/* Banner Upload */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Store Banner / Cover</label>
            <p className="text-white/40 text-xs mb-3">Wide image (16:9), shown on store detail page</p>
            
            <div className="relative">
              {bannerPreview || formData.bannerUrl ? (
                <div className="relative group">
                  <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-white/20 bg-white/5">
                    <img 
                      src={bannerPreview || formData.bannerUrl} 
                      alt="Store Banner" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={removeBanner}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition"
                  >
                    <FaTimes size={10} />
                  </button>
                  {bannerFile && (
                    <button
                      onClick={handleUploadBanner}
                      disabled={uploadingBanner}
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs rounded-full hover:bg-emerald-600 transition disabled:opacity-50 flex items-center gap-1"
                    >
                      {uploadingBanner ? (
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FaUpload size={10} />
                      )}
                      {uploadingBanner ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition"
                >
                  <FaImage className="text-white/40 text-xl" />
                  <span className="text-white/40 text-xs">Add Banner</span>
                </button>
              )}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerSelect}
                className="hidden"
              />
            </div>
            
            {!bannerPreview && !formData.bannerUrl && (
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="mt-3 px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm hover:bg-white/15 transition flex items-center gap-2"
              >
                <FaUpload size={12} />
                Choose Image
              </button>
            )}
          </div>
        </div>
        
        <p className="text-white/40 text-xs mt-4">
          💡 Tip: High-quality images help customers recognize and trust your store
        </p>
      </div>

      {/* Location with Map */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaMapMarkerAlt className="text-emerald-400" />
          Store Location
          {formData.locationLocked && (
            <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full flex items-center gap-1">
              <FaLock className="text-[10px]" />
              Locked
            </span>
          )}
        </h3>
        
        {/* Location Lock Warning */}
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-3 ${
          formData.locationLocked 
            ? 'bg-emerald-500/10 border border-emerald-500/20' 
            : 'bg-amber-500/10 border border-amber-500/20'
        }`}>
          <FaInfoCircle className={formData.locationLocked ? 'text-emerald-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
          <div className="flex-1">
            <p className={`text-sm ${formData.locationLocked ? 'text-emerald-300' : 'text-amber-300'}`}>
              {formData.locationLocked 
                ? 'Store location is locked and saved. Customers will see this location.'
                : 'Set your exact store location and lock it to prevent accidental changes.'}
            </p>
          </div>
        </div>
        
        {/* Search Box */}
        {isLoaded && !formData.locationLocked && (
          <div className="mb-4">
            <label className="block text-sm text-white/60 mb-1">Search Location</label>
            <Autocomplete
              onLoad={onAutocompleteLoad}
              onPlaceChanged={onPlaceChanged}
              restrictions={{ country: 'in' }}
            >
              <input
                type="text"
                placeholder="Search for your store location..."
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              />
            </Autocomplete>
          </div>
        )}
        
        {/* Map Container */}
        <div className="mb-4 rounded-xl overflow-hidden border-2 border-white/20 relative">
          {loadError && (
            <div className="h-[300px] flex items-center justify-center bg-red-500/10 text-red-400">
              <p>Error loading Google Maps</p>
            </div>
          )}
          
          {!isLoaded && !loadError && (
            <div className="h-[300px] flex items-center justify-center bg-white/5">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white/60 text-sm">Loading Google Maps...</p>
              </div>
            </div>
          )}
          
          {isLoaded && !loadError && (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={formData.latitude && formData.longitude ? 15 : 5}
              options={{
                ...mapOptions,
                draggableCursor: formData.locationLocked ? 'default' : 'crosshair'
              }}
              onLoad={onMapLoad}
              onClick={onMapClick}
            >
              {/* Store Marker - Draggable when unlocked */}
              {formData.latitude && formData.longitude && (
                <>
                  <Marker
                    position={{ 
                      lat: parseFloat(formData.latitude), 
                      lng: parseFloat(formData.longitude) 
                    }}
                    icon={{
                      url: formData.locationLocked 
                        ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                        : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                      scaledSize: new window.google.maps.Size(45, 45)
                    }}
                    draggable={!formData.locationLocked}
                    onDragEnd={onMarkerDragEnd}
                    onClick={() => setShowInfoWindow(true)}
                    cursor={formData.locationLocked ? 'pointer' : 'grab'}
                    title={formData.locationLocked ? 'Your Store Location (Locked)' : 'Drag to set your store location'}
                  />
                  
                  {/* Info Window showing location details */}
                  {showInfoWindow && (
                    <InfoWindow
                      position={{ 
                        lat: parseFloat(formData.latitude), 
                        lng: parseFloat(formData.longitude) 
                      }}
                      onCloseClick={() => setShowInfoWindow(false)}
                      options={{
                        pixelOffset: new window.google.maps.Size(0, -40)
                      }}
                    >
                      <div className="p-2 min-w-[220px] max-w-[300px]">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                          <div className={`w-10 h-10 ${formData.locationLocked ? 'bg-emerald-500' : 'bg-orange-500'} rounded-full flex items-center justify-center`}>
                            <FaStore className="text-white text-lg" />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800 text-sm">
                              {formData.locationLocked ? 'Your Store Location' : 'Set Your Location'}
                            </h4>
                            <span className={`text-[10px] ${formData.locationLocked ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'} px-1.5 py-0.5 rounded inline-flex items-center gap-1`}>
                              {formData.locationLocked ? (
                                <><FaLock className="text-[8px]" /> Locked & Saved</>
                              ) : (
                                <><FaUnlock className="text-[8px]" /> Drag pin to adjust</>
                              )}
                            </span>
                          </div>
                        </div>
                        
                        {/* Store Name */}
                        {formData.name && (
                          <p className="text-sm font-semibold text-gray-700 mb-1">
                            {formData.name}
                          </p>
                        )}
                        
                        {/* Address */}
                        {formData.address && (
                          <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                            {formData.address}
                          </p>
                        )}
                        
                        {/* City & Pincode */}
                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 border-t pt-2 mt-2">
                          {formData.city && (
                            <span className="bg-gray-100 px-2 py-0.5 rounded">{formData.city}</span>
                          )}
                          {formData.pincode && (
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{formData.pincode}</span>
                          )}
                        </div>
                        
                        {/* Coordinates */}
                        <div className="mt-2 pt-2 border-t text-[10px] text-gray-400 flex justify-between">
                          <span>Lat: {parseFloat(formData.latitude).toFixed(5)}</span>
                          <span>Lng: {parseFloat(formData.longitude).toFixed(5)}</span>
                        </div>
                        
                        {/* Delivery Info */}
                        {formData.deliveryEnabled && formData.deliveryRadius && (
                          <div className="mt-2 pt-2 border-t text-xs text-emerald-600 flex items-center gap-1">
                            <FaTruck className="text-xs" />
                            Delivery Area: {formData.deliveryRadius} km radius
                          </div>
                        )}
                        
                        {/* Instructions */}
                        {!formData.locationLocked && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-[10px] text-orange-600 italic">
                              Drag the pin or click elsewhere on the map to set your exact store location, then click "Lock Location" to save.
                            </p>
                          </div>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                  
                  {/* Delivery Radius Circle */}
                  {formData.deliveryEnabled && (
                    <Circle
                      center={{ 
                        lat: parseFloat(formData.latitude), 
                        lng: parseFloat(formData.longitude) 
                      }}
                      radius={deliveryRadiusMeters}
                      options={{
                        strokeColor: '#10b981',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#10b981',
                        fillOpacity: 0.1,
                      }}
                    />
                  )}
                </>
              )}
            </GoogleMap>
          )}
          
          {/* Map Overlay for locked state */}
          {formData.locationLocked && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/90 text-white text-xs rounded-lg flex items-center gap-1 z-10">
              <FaLock className="text-[10px]" />
              Location Locked
            </div>
          )}
          
          {/* Instructions based on state */}
          {isLoaded && (
            <>
              {/* When no location set */}
              {!formData.latitude && !formData.longitude && (
                <div className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-blue-600/90 text-white text-xs rounded-lg z-10 text-center">
                  <FaMapMarkerAlt className="inline mr-1" />
                  Click on map or use search to place your store pin
                </div>
              )}
              
              {/* When location set but not locked */}
              {formData.latitude && formData.longitude && !formData.locationLocked && (
                <div className="absolute bottom-2 left-2 px-3 py-2 bg-orange-500/90 text-white text-xs rounded-lg z-10 flex items-center gap-2">
                  <FaMapMarkerAlt className="text-sm animate-bounce" />
                  <span>Drag the red pin to adjust location</span>
                </div>
              )}
              
              {/* When location is locked */}
              {formData.latitude && formData.longitude && formData.locationLocked && !showInfoWindow && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-emerald-600/90 text-white text-xs rounded-lg z-10 flex items-center gap-1">
                  <FaStore className="text-[10px]" />
                  Your Store Location - Click pin for details
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Location Controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={getCurrentLocation}
            disabled={formData.locationLocked}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
              formData.locationLocked
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
            }`}
          >
            <FaSearchLocation />
            Get Current Location
          </button>
          
          <button
            onClick={toggleLocationLock}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
              formData.locationLocked
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
            }`}
          >
            {formData.locationLocked ? <FaUnlock /> : <FaLock />}
            {formData.locationLocked ? 'Unlock Location' : 'Lock Location'}
          </button>
        </div>
        
        {/* Address Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm text-white/60 mb-1">Address *</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              placeholder="Shop address..."
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">City *</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Pincode *</label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e) => handleChange('pincode', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Latitude</label>
            <input
              type="text"
              value={formData.latitude}
              onChange={(e) => !formData.locationLocked && handleChange('latitude', e.target.value)}
              disabled={formData.locationLocked}
              className={`w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 ${
                formData.locationLocked ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              placeholder="e.g., 18.5204"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Longitude</label>
            <input
              type="text"
              value={formData.longitude}
              onChange={(e) => !formData.locationLocked && handleChange('longitude', e.target.value)}
              disabled={formData.locationLocked}
              className={`w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 ${
                formData.locationLocked ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              placeholder="e.g., 73.8567"
            />
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaClock className="text-emerald-400" />
          Operating Hours
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">Opening Time</label>
            <input
              type="time"
              value={formData.openTime}
              onChange={(e) => handleChange('openTime', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Closing Time</label>
            <input
              type="time"
              value={formData.closeTime}
              onChange={(e) => handleChange('closeTime', e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Working Days</label>
          <div className="flex flex-wrap gap-2">
            {weekDays.map(day => (
              <button
                key={day}
                onClick={() => handleWorkingDayToggle(day)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  formData.workingDays.includes(day)
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Delivery Settings */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaTruck className="text-emerald-400" />
          Delivery Settings
        </h3>
        
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => handleChange('deliveryEnabled', !formData.deliveryEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              formData.deliveryEnabled
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {formData.deliveryEnabled ? <FaToggleOn /> : <FaToggleOff />}
            Delivery {formData.deliveryEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {formData.deliveryEnabled && (
          <div className="space-y-6">
            {/* Delivery Area */}
            <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <FaRoute className="text-emerald-400" />
                Delivery Area
              </h4>
              <p className="text-white/50 text-sm mb-4">
                Set the radius where you can deliver. The green circle on the map shows your delivery area.
              </p>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-white/60 mb-1">Delivery Radius (km)</label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={formData.deliveryRadius}
                    onChange={(e) => handleChange('deliveryRadius', e.target.value)}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    value={formData.deliveryRadius}
                    onChange={(e) => handleChange('deliveryRadius', e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-white/60">km</span>
              </div>
              
              <p className="text-white/40 text-xs mt-2">
                Customers beyond {formData.deliveryRadius} km won't be able to place delivery orders
              </p>
            </div>

            {/* Order Requirements */}
            <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <FaShoppingBag className="text-blue-400" />
                Order Requirements
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Minimum Order Value (₹)</label>
                  <input
                    type="number"
                    value={formData.minOrderValue}
                    onChange={(e) => handleChange('minOrderValue', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="0 for no minimum"
                  />
                  <p className="text-white/40 text-xs mt-1">
                    Set to 0 for no minimum order requirement
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm text-white/60 mb-1">Free Delivery Above (₹)</label>
                  <input
                    type="number"
                    value={formData.freeDeliveryAbove}
                    onChange={(e) => handleChange('freeDeliveryAbove', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="0 for no free delivery"
                  />
                  <p className="text-white/40 text-xs mt-1">
                    Orders above this amount get free delivery
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery Fee Settings */}
            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <FaRupeeSign className="text-amber-400" />
                Delivery Fee
              </h4>
              
              {/* Fee Type Toggle */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => handleChange('distanceBasedFee', false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    !formData.distanceBasedFee
                      ? 'bg-amber-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  Flat Fee
                </button>
                <button
                  onClick={() => handleChange('distanceBasedFee', true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    formData.distanceBasedFee
                      ? 'bg-amber-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/15'
                  }`}
                >
                  Distance Based
                </button>
              </div>
              
              {!formData.distanceBasedFee ? (
                <div>
                  <label className="block text-sm text-white/60 mb-1">Delivery Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.deliveryFee}
                    onChange={(e) => handleChange('deliveryFee', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500"
                    placeholder="20"
                  />
                  <p className="text-white/40 text-xs mt-1">
                    Same fee for all deliveries within your area
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Base Fee (₹)</label>
                      <input
                        type="number"
                        value={formData.baseFee}
                        onChange={(e) => handleChange('baseFee', e.target.value)}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500"
                        placeholder="20"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Base Distance (km)</label>
                      <input
                        type="number"
                        value={formData.baseDistance}
                        onChange={(e) => handleChange('baseDistance', e.target.value)}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500"
                        placeholder="2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-white/60 mb-1">Per km Fee (₹)</label>
                      <input
                        type="number"
                        value={formData.perKmFee}
                        onChange={(e) => handleChange('perKmFee', e.target.value)}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500"
                        placeholder="5"
                      />
                    </div>
                  </div>
                  
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-white/60 text-sm">
                      <strong className="text-white">Example:</strong> For a customer 5 km away:
                      <br />
                      Base ₹{formData.baseFee || 20} + ({5 - (formData.baseDistance || 2)} km × ₹{formData.perKmFee || 5}) = 
                      <strong className="text-amber-400 ml-1">
                        ₹{(parseFloat(formData.baseFee) || 20) + ((5 - (parseFloat(formData.baseDistance) || 2)) * (parseFloat(formData.perKmFee) || 5))}
                      </strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Estimated Delivery Time */}
            <div className="p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <FaClock className="text-cyan-400" />
                Estimated Delivery Time
              </h4>
              <p className="text-white/50 text-sm mb-4">
                Set how delivery time is calculated for customers
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Base Preparation Time (mins)</label>
                  <input
                    type="number"
                    value={formData.baseDeliveryTime}
                    onChange={(e) => handleChange('baseDeliveryTime', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="30"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-white/60 mb-1">Minutes per km</label>
                  <input
                    type="number"
                    value={formData.estimatedDeliveryPerKm}
                    onChange={(e) => handleChange('estimatedDeliveryPerKm', e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="5"
                  />
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-white/5 rounded-lg">
                <p className="text-white/60 text-sm">
                  <strong className="text-white">Example:</strong> For a customer 3 km away:
                  <br />
                  {formData.baseDeliveryTime || 30} mins + (3 km × {formData.estimatedDeliveryPerKm || 5} mins) = 
                  <strong className="text-cyan-400 ml-1">
                    {(parseFloat(formData.baseDeliveryTime) || 30) + (3 * (parseFloat(formData.estimatedDeliveryPerKm) || 5))} mins
                  </strong>
                </p>
              </div>
            </div>
            
            {/* Customer Preview */}
            <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
              <h4 className="text-white font-medium mb-3">
                What customers will see:
              </h4>
              <div className="space-y-2">
                {parseFloat(formData.minOrderValue) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-red-400">•</span>
                    <span className="text-white/70">Minimum order: <strong className="text-white">₹{formData.minOrderValue}</strong></span>
                  </div>
                )}
                {parseFloat(formData.freeDeliveryAbove) > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-400">•</span>
                    <span className="text-white/70">Free delivery above: <strong className="text-emerald-400">₹{formData.freeDeliveryAbove}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-400">•</span>
                  <span className="text-white/70">
                    Delivery fee: <strong className="text-white">
                      {formData.distanceBasedFee 
                        ? `₹${formData.baseFee} + ₹${formData.perKmFee}/km` 
                        : `₹${formData.deliveryFee}`}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-400">•</span>
                  <span className="text-white/70">Delivers within: <strong className="text-white">{formData.deliveryRadius} km</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Options */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaWallet className="text-emerald-400" />
          Payment Options
        </h3>
        
        <p className="text-white/60 text-sm mb-4">
          Configure which payment methods customers can use at checkout
        </p>

        <div className="space-y-4">
          {/* Standard Payment Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => handlePaymentOptionToggle('cod')}
              className={`p-4 rounded-xl border-2 flex items-center gap-3 transition ${
                formData.paymentOptions?.cod
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-white/20 bg-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                formData.paymentOptions?.cod ? 'bg-emerald-500' : 'bg-white/10'
              }`}>
                <FaRupeeSign className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-medium">Cash on Delivery</p>
                <p className="text-white/50 text-xs">Pay when order is delivered</p>
              </div>
              {formData.paymentOptions?.cod ? <FaToggleOn className="text-emerald-400 text-xl" /> : <FaToggleOff className="text-white/30 text-xl" />}
            </button>

            <button
              onClick={() => handlePaymentOptionToggle('upi')}
              className={`p-4 rounded-xl border-2 flex items-center gap-3 transition ${
                formData.paymentOptions?.upi
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-white/20 bg-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                formData.paymentOptions?.upi ? 'bg-emerald-500' : 'bg-white/10'
              }`}>
                <FaWallet className="text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-medium">UPI Payment</p>
                <p className="text-white/50 text-xs">GPay, PhonePe, Paytm</p>
              </div>
              {formData.paymentOptions?.upi ? <FaToggleOn className="text-emerald-400 text-xl" /> : <FaToggleOff className="text-white/30 text-xl" />}
            </button>
          </div>

          {/* Pay Later Option */}
          <div className="border-t border-white/10 pt-4 mt-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full">Premium</span>
              Credit Options
            </h4>
            
            <div className="space-y-3">
              <button
                onClick={() => handlePaymentOptionToggle('payLater')}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition ${
                  formData.paymentOptions?.payLater
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-white/20 bg-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  formData.paymentOptions?.payLater ? 'bg-amber-500' : 'bg-white/10'
                }`}>
                  <FaClock className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-medium">Pay Later</p>
                  <p className="text-white/50 text-xs">Allow customers to pay after delivery</p>
                </div>
                {formData.paymentOptions?.payLater ? <FaToggleOn className="text-amber-400 text-xl" /> : <FaToggleOff className="text-white/30 text-xl" />}
              </button>

              {formData.paymentOptions?.payLater && (
                <div className="ml-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <label className="block text-sm text-white/60 mb-2">Payment Due In (Days)</label>
                  <input
                    type="number"
                    value={formData.payLaterDays}
                    onChange={(e) => handleChange('payLaterDays', e.target.value)}
                    min="1"
                    max="30"
                    className="w-32 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <button
                onClick={() => handlePaymentOptionToggle('partialPayment')}
                className={`w-full p-4 rounded-xl border-2 flex items-center gap-3 transition ${
                  formData.paymentOptions?.partialPayment
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/20 bg-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  formData.paymentOptions?.partialPayment ? 'bg-purple-500' : 'bg-white/10'
                }`}>
                  <FaRupeeSign className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-white font-medium">Partial Payment (Advance + Later)</p>
                  <p className="text-white/50 text-xs">Customer pays part now, rest on delivery</p>
                </div>
                {formData.paymentOptions?.partialPayment ? <FaToggleOn className="text-purple-400 text-xl" /> : <FaToggleOff className="text-white/30 text-xl" />}
              </button>

              {formData.paymentOptions?.partialPayment && (
                <div className="ml-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <label className="block text-sm text-white/60 mb-2">Minimum Advance Payment (%)</label>
                  <input
                    type="number"
                    value={formData.minAdvancePercent}
                    onChange={(e) => handleChange('minAdvancePercent', e.target.value)}
                    min="10"
                    max="90"
                    className="w-32 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-white/40 text-xs mt-1">Remaining amount to be paid on delivery</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pickup Options */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaShoppingBag className="text-emerald-400" />
          Store Pickup
        </h3>
        
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => handleChange('pickupEnabled', !formData.pickupEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              formData.pickupEnabled
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {formData.pickupEnabled ? <FaToggleOn /> : <FaToggleOff />}
            Pickup {formData.pickupEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <p className="text-white/60 text-sm mb-4">
          Allow customers to pick up orders from your store
        </p>

        {formData.pickupEnabled && (
          <div className="space-y-4">
            {/* Pickup Time Slots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm text-white/60">Pickup Time Slots</label>
                <button
                  onClick={addPickupSlot}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm hover:bg-emerald-500/30 transition"
                >
                  <FaPlus className="text-xs" />
                  Add Slot
                </button>
              </div>
              
              <div className="space-y-2">
                {formData.pickupTimeSlots?.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                      slot.enabled
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <button
                      onClick={() => handlePickupSlotToggle(slot.id)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                        slot.enabled ? 'bg-emerald-500' : 'bg-white/10'
                      }`}
                    >
                      {slot.enabled ? <FaToggleOn className="text-white" /> : <FaToggleOff className="text-white/40" />}
                    </button>
                    
                    <input
                      type="text"
                      value={slot.time}
                      onChange={(e) => updatePickupSlotTime(slot.id, e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                    
                    <button
                      onClick={() => removePickupSlot(slot.id)}
                      className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Pickup Instructions */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Pickup Instructions (Optional)</label>
              <textarea
                value={formData.pickupInstructions}
                onChange={(e) => handleChange('pickupInstructions', e.target.value)}
                rows={2}
                placeholder="e.g., Pick up from counter 2, bring order ID..."
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FaSave />
          )}
          Save Store Settings
        </button>
      </div>
    </div>
  );
};

export default MarketplaceSetup;
