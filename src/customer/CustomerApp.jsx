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
import ErrorBoundary from './components/ErrorBoundary';

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

// Order Success Modal - Retailer Dashboard theme
const OrderSuccessModal = ({ orderNumber, onTrack, onHome }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-sm text-center border border-white/10"
    >
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
        <span className="text-4xl">🎉</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Order Placed!</h2>
      <p className="text-white/60 mb-2">Your order has been placed successfully</p>
      <p className="text-sm text-emerald-400 font-medium mb-6">Order #{orderNumber}</p>
      
      <div className="space-y-3">
        <button
          onClick={onTrack}
          className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl font-semibold hover:bg-emerald-400 transition"
        >
          Track Order
        </button>
        <button
          onClick={onHome}
          className="w-full py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/15 border border-white/10 transition"
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
  const [pendingCheckout, setPendingCheckout] = useState(false);

  // Get user location on mount (for both guest and logged-in — required for store browsing)
  useEffect(() => {
    if (!location) {
      setLocation({ lat: 19.0760, lng: 72.8777, label: 'Mumbai' });
    }

    const getLocation = () => {
      if (!navigator.geolocation) {
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
          setLocation({ lat: 19.0760, lng: 72.8777, label: 'Mumbai' });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    };
    getLocation();
  }, []);

  // Apple Guideline 5.1.1: Guests must be able to browse without signing in. Never show login as first screen.
  const hasInitializedGuestView = React.useRef(false);
  useEffect(() => {
    if (authLoading || isLoggedIn) return;
    if (hasInitializedGuestView.current) return;
    hasInitializedGuestView.current = true;
    setCurrentView('home');
    setActiveTab('home');
  }, [authLoading, isLoggedIn]);

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

  // Handle tab change (guest: orders/profile show login screen per Apple Guideline 5.1.1)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setViewHistory([]);
    if (!isLoggedIn && (tab === 'orders' || tab === 'profile')) {
      setCurrentView('login');
      return;
    }
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

  // Require login for checkout; if guest, show login then proceed to checkout after success
  const handleCheckout = () => {
    if (isLoggedIn) {
      navigateTo('checkout');
    } else {
      setPendingCheckout(true);
      setCurrentView('login');
      setActiveTab('profile');
    }
  };

  const handleLoginSuccess = () => {
    if (pendingCheckout) {
      setPendingCheckout(false);
      navigateTo('checkout');
    } else {
      setCurrentView('home');
      setActiveTab('home');
    }
  };

  const handleContinueAsGuest = () => {
    setPendingCheckout(false);
    setCurrentView(pendingCheckout ? 'cart' : 'home');
    setActiveTab(pendingCheckout ? 'cart' : 'home');
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
      <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] flex items-center justify-center">
        <div className="text-center">
          <motion.img 
            src="/assets/flyp_logo.png" 
            alt="FLYP" 
            className="w-24 h-24 mx-auto mb-6"
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Apple Guideline 5.1.1: Allow browsing without login. Show login only for account-based flows (orders, profile, checkout).
  const showLoginView = !isLoggedIn && ['login', 'orders', 'profile', 'checkout'].includes(currentView);

  // Determine if bottom nav should be shown
  const showBottomNav = ['home', 'search', 'cart', 'orders', 'profile'].includes(currentView);

  return (
    <div className="bg-[#0B0F14] relative w-full h-screen overflow-hidden flex flex-col">
      {/* Aurora backdrop - only on main app, not login */}
      {!showLoginView && (
        <div className="pointer-events-none fixed inset-0 opacity-30 z-0">
          <div className="absolute -top-24 -left-24 w-[60vmax] h-[60vmax] rounded-full blur-3xl bg-gradient-to-tr from-emerald-500/30 via-teal-400/20 to-transparent" />
          <div className="absolute -bottom-24 -right-24 w-[50vmax] h-[50vmax] rounded-full blur-3xl bg-gradient-to-tr from-teal-500/20 via-emerald-400/15 to-transparent" />
        </div>
      )}

      {/* Main Content */}
      <main 
        className={`relative z-10 w-full flex-1 min-h-0 flex flex-col ${showLoginView ? 'overflow-hidden' : 'overflow-y-auto'}`}
        style={{ 
          paddingBottom: showBottomNav ? 'calc(80px + env(safe-area-inset-bottom))' : '0'
        }}
      >
        {/* Login (guest: orders, profile, or checkout require login per Apple 5.1.1) */}
        {showLoginView && (
          <div 
            className="w-full flex-1 min-h-0 overflow-hidden"
            style={{ position: 'fixed', inset: 0, zIndex: 20 }}
          >
            <CustomerLogin
              onLoginSuccess={handleLoginSuccess}
              onContinueAsGuest={handleContinueAsGuest}
              isCheckoutFlow={pendingCheckout}
            />
          </div>
        )}

        {/* Home */}
        {!showLoginView && currentView === 'home' && (
          <div className="bg-transparent w-full h-full">
            <CustomerHome
              location={location}
              onNavigate={handleTabChange}
              onStoreSelect={handleStoreSelect}
              onCategorySelect={(cat) => navigateTo('search')}
            />
          </div>
        )}

        {/* Store Detail */}
        {!showLoginView && currentView === 'store' && selectedStore && (
          <div className="bg-transparent">
            <StoreDetail
              storeId={selectedStore.id}
              onBack={goBack}
              onCartClick={() => navigateTo('cart')}
            />
          </div>
        )}

        {/* Search */}
        {!showLoginView && currentView === 'search' && (
          <div className="bg-transparent">
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
        {!showLoginView && currentView === 'cart' && (
          <div className="bg-transparent">
            <Cart
              onBack={goBack}
              onCheckout={handleCheckout}
              onStoreClick={(storeId) => navigateTo('store', { store: { id: storeId } })}
            />
          </div>
        )}

        {/* Checkout (only when logged in) */}
        {!showLoginView && currentView === 'checkout' && (
          <div className="bg-transparent">
            <Checkout
              onBack={goBack}
              onOrderPlaced={handleOrderPlaced}
            />
          </div>
        )}

        {/* Order Tracking */}
        {!showLoginView && currentView === 'tracking' && trackingOrderId && (
          <div className="bg-transparent">
            <OrderTracking
              orderId={trackingOrderId}
              onBack={goBack}
            />
          </div>
        )}

        {/* My Orders */}
        {!showLoginView && currentView === 'orders' && (
          <div className="bg-transparent">
            <MyOrders
              onBack={() => handleTabChange('home')}
              onOrderClick={(orderId) => navigateTo('tracking', { orderId })}
            />
          </div>
        )}

        {/* Profile */}
        {!showLoginView && currentView === 'profile' && (
          <div className="bg-transparent">
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
    <ErrorBoundary>
      <CustomerAuthProvider>
        <CartProvider>
          <CustomerAppContent />
        </CartProvider>
      </CustomerAuthProvider>
    </ErrorBoundary>
  );
};

export default CustomerApp;
