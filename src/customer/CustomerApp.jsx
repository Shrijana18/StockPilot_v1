/**
 * CustomerApp - Main Customer Marketplace App
 * Complete customer-facing app with all views
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Context Providers
import { CartProvider, useCart } from './context/CartContext';
import { CustomerAuthProvider, useCustomerAuth } from './context/CustomerAuthContext';

// Components
import CustomerBottomNav from './components/CustomerBottomNav';

// Views
import CustomerLogin from './views/CustomerLogin';
import CustomerHome from './views/CustomerHome';
import StoreDetail from './views/StoreDetail';
import ProductSearch from './views/ProductSearch';
import Cart from './views/Cart';
import Checkout from './views/Checkout';
import OrderTracking from './views/OrderTracking';
import MyOrders from './views/MyOrders';
import CustomerProfile from './views/CustomerProfile';

// Order Success Modal - Dark Theme
const OrderSuccessModal = ({ orderNumber, onTrack, onHome }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-[#101B4A] rounded-2xl p-6 w-full max-w-sm text-center border border-white/10"
    >
      <div className="w-20 h-20 rounded-full bg-[#05E06C]/10 border border-[#05E06C]/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-4xl">🎉</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Order Placed!</h2>
      <p className="text-white/60 mb-2">Your order has been placed successfully</p>
      <p className="text-sm text-[#05E06C] font-medium mb-6">Order #{orderNumber}</p>
      
      <div className="space-y-3">
        <button
          onClick={onTrack}
          className="w-full py-3 bg-[#05E06C] text-white rounded-xl font-semibold shadow-lg shadow-[#05E06C]/20"
        >
          Track Order
        </button>
        <button
          onClick={onHome}
          className="w-full py-3 border border-white/10 text-white/70 rounded-xl font-semibold hover:bg-white/5 transition"
        >
          Back to Home
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// Main App Content (inside providers)
const CustomerAppContent = () => {
  const { isLoggedIn, loading: authLoading } = useCustomerAuth();
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('home');
  const [currentView, setCurrentView] = useState('home'); // home, store, search, cart, checkout, tracking, orders, profile
  const [viewHistory, setViewHistory] = useState([]);
  
  // Data state
  const [location, setLocation] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  
  // UI state
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState('');
  const [successOrderId, setSuccessOrderId] = useState('');

  // Get user location on mount using browser's native Geolocation API
  useEffect(() => {
    const getLocation = () => {
      if (!navigator.geolocation) {
        console.log('Geolocation not supported');
        setLocation({ lat: 19.0760, lng: 72.8777, label: 'Mumbai' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            label: 'Current Location'
          });
        },
        (error) => {
          console.error('Location error:', error);
          // Default to Mumbai
          setLocation({ lat: 19.0760, lng: 72.8777, label: 'Mumbai' });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      );
    };

    if (isLoggedIn) {
      getLocation();
    }
  }, [isLoggedIn]);

  // Navigate to a view
  const navigateTo = (view, data = {}) => {
    setViewHistory(prev => [...prev, currentView]);
    setCurrentView(view);
    
    if (data.store) setSelectedStore(data.store);
    if (data.orderId) setTrackingOrderId(data.orderId);
  };

  // Go back - Enhanced with multiple fallbacks
  const goBack = () => {
    try {
      // Special handling for tracking view - usually comes from orders
      if (currentView === 'tracking') {
        // Clear tracking order ID
        setTrackingOrderId(null);
        
        // If we have history, go back to previous view
        if (viewHistory.length > 0) {
          const prevView = viewHistory[viewHistory.length - 1];
          setViewHistory(prev => prev.slice(0, -1));
          setCurrentView(prevView);
          
          // If previous view was orders, ensure orders tab is active
          if (prevView === 'orders') {
            setActiveTab('orders');
          }
        } else {
          // Default: go to orders (most common path from tracking)
          setCurrentView('orders');
          setActiveTab('orders');
        }
        return;
      }

      // For other views, use standard history
      if (viewHistory.length > 0) {
        const prevView = viewHistory[viewHistory.length - 1];
        setViewHistory(prev => prev.slice(0, -1));
        setCurrentView(prevView);
      } else {
        // Fallback: Go to home
        setCurrentView('home');
        setActiveTab('home');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback: Use browser history or force home
      if (window.history.length > 1) {
        window.history.back();
      } else {
        setCurrentView('home');
        setActiveTab('home');
        setViewHistory([]);
      }
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setViewHistory([]);
    
    switch (tab) {
      case 'home':
        setCurrentView('home');
        break;
      case 'search':
        setCurrentView('search');
        break;
      case 'cart':
        setCurrentView('cart');
        break;
      case 'orders':
        setCurrentView('orders');
        break;
      case 'profile':
        setCurrentView('profile');
        break;
      default:
        setCurrentView('home');
    }
  };

  // Handle store select
  const handleStoreSelect = (store) => {
    navigateTo('store', { store });
  };

  // Handle order placed
  const handleOrderPlaced = (orderId, orderNumber) => {
    setSuccessOrderId(orderId);
    setSuccessOrderNumber(orderNumber);
    setShowOrderSuccess(true);
  };

  // Show auth loading - FLYP Brand
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#060D2D] flex items-center justify-center">
        <div className="text-center">
          <motion.img 
            src="/assets/flyp_logo.png" 
            alt="FLYP" 
            className="w-24 h-24 mx-auto mb-6"
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="w-10 h-10 border-3 border-[#05E06C]/20 border-t-[#05E06C] rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Show login if not logged in
  if (!isLoggedIn) {
    return <CustomerLogin onLoginSuccess={() => {}} />;
  }

  // Determine if bottom nav should be shown
  const showBottomNav = ['home', 'search', 'cart', 'orders', 'profile'].includes(currentView);

  return (
    <div className="min-h-screen bg-[#060D2D]">
      {/* Header is now built into each view for mobile optimization */}

      {/* Main Content - Instant view switching */}
      <main 
        className="bg-[#060D2D] min-h-screen"
        style={{ 
          paddingBottom: showBottomNav ? 'calc(80px + env(safe-area-inset-bottom))' : '0'
        }}
      >
        {/* Home */}
        {currentView === 'home' && (
          <div className="bg-[#060D2D] min-h-screen">
            <CustomerHome
              location={location}
              onNavigate={handleTabChange}
              onStoreSelect={handleStoreSelect}
              onCategorySelect={(cat) => navigateTo('search')}
            />
          </div>
        )}

        {/* Store Detail */}
        {currentView === 'store' && selectedStore && (
          <div className="bg-[#060D2D] min-h-screen">
            <StoreDetail
              storeId={selectedStore.id}
              onBack={goBack}
              onCartClick={() => navigateTo('cart')}
            />
          </div>
        )}

        {/* Search */}
        {currentView === 'search' && (
          <div className="bg-[#060D2D] min-h-screen">
            <ProductSearch
              location={location}
              onBack={() => handleTabChange('home')}
              onStoreSelect={(storeId) => {
                navigateTo('store', { store: { id: storeId } });
              }}
            />
          </div>
        )}

        {/* Cart */}
        {currentView === 'cart' && (
          <div className="bg-[#060D2D] min-h-screen">
            <Cart
              onBack={goBack}
              onCheckout={() => navigateTo('checkout')}
              onStoreClick={(storeId) => navigateTo('store', { store: { id: storeId } })}
            />
          </div>
        )}

        {/* Checkout */}
        {currentView === 'checkout' && (
          <div className="bg-[#060D2D] min-h-screen">
            <Checkout
              onBack={goBack}
              onOrderPlaced={handleOrderPlaced}
            />
          </div>
        )}

        {/* Order Tracking */}
        {currentView === 'tracking' && trackingOrderId && (
          <div className="bg-[#060D2D] min-h-screen">
            <OrderTracking
              orderId={trackingOrderId}
              onBack={goBack}
            />
          </div>
        )}

        {/* My Orders */}
        {currentView === 'orders' && (
          <div className="bg-[#060D2D] min-h-screen">
            <MyOrders
              onBack={() => handleTabChange('home')}
              onOrderClick={(orderId) => navigateTo('tracking', { orderId })}
            />
          </div>
        )}

        {/* Profile */}
        {currentView === 'profile' && (
          <div className="bg-[#060D2D] min-h-screen">
            <CustomerProfile onBack={() => handleTabChange('home')} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && (
        <CustomerBottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {/* Order Success Modal */}
      {showOrderSuccess && (
        <OrderSuccessModal
          orderNumber={successOrderNumber}
          onTrack={() => {
            setShowOrderSuccess(false);
            navigateTo('tracking', { orderId: successOrderId });
          }}
          onHome={() => {
            setShowOrderSuccess(false);
            handleTabChange('home');
          }}
        />
      )}
    </div>
  );
};

// Main Customer App with Providers
const CustomerApp = () => {
  return (
    <CustomerAuthProvider>
      <CartProvider>
        <CustomerAppContent />
      </CartProvider>
    </CustomerAuthProvider>
  );
};

export default CustomerApp;
