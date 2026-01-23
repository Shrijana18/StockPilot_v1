/**
 * MobileDistributorDashboard - Native App Experience for Distributors
 * Full-featured mobile dashboard with all distributor features
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import MobileBottomNav from '../components/MobileBottomNav';
import MobileHeader from '../components/MobileHeader';
import MobileHomeScreen from './MobileHomeScreen';

// Lazy load dashboard components for better performance
const DistributorHome = lazy(() => import('../../components/distributor/DistributorHome'));
const DistributorInventory = lazy(() => import('../../components/distributor/DistributorInventory'));
const WhatsAppHub = lazy(() => import('../../components/distributor/whatsapp/WhatsAppHub'));
const RetailerPanel = lazy(() => import('../../components/distributor/RetailerPanel'));
const DistributorProfileSettings = lazy(() => import('../../components/distributor/DistributorProfileSettings'));
const DistributorAnalytics = lazy(() => import('../../components/distributor/analytics/DistributorAnalytics'));
const DistributorInvoices = lazy(() => import('../../components/distributor/DistributorInvoices'));
const DistributorManualBilling = lazy(() => import('../../components/distributor/DistributorManualBilling'));
const DispatchTracker = lazy(() => import('../../components/distributor/DispatchTracker'));
const DistributorAIForecast = lazy(() => import('../../components/distributor/aiForecast/DistributorAIForecast'));
const ProductOwnerConnection = lazy(() => import('../../components/distributor/ProductOwnerConnection'));
const DistributorViewEmployees = lazy(() => import('../../components/distributor/employees/DistributorViewEmployees'));

// Loading placeholder
const TabLoading = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      <span className="text-gray-400 text-sm">Loading...</span>
    </div>
  </div>
);

// Tab configuration with titles and whether to show back button
const TAB_CONFIG = {
  home: { 
    title: 'FLYP', 
    subtitle: 'Distributor Dashboard',
    showBack: false,
    isMainTab: true
  },
  dashboard: { 
    title: 'Dashboard', 
    subtitle: 'Business overview',
    showBack: true,
    isMainTab: false
  },
  retailerRequests: { 
    title: 'Retailers', 
    subtitle: 'Manage connections',
    showBack: false,
    isMainTab: true
  },
  inventory: { 
    title: 'Inventory', 
    subtitle: 'Manage products',
    showBack: false,
    isMainTab: true
  },
  aiForecast: { 
    title: 'AI Forecast', 
    subtitle: 'Smart predictions',
    showBack: true,
    isMainTab: false
  },
  whatsapp: { 
    title: 'WhatsApp', 
    subtitle: 'Business messaging',
    showBack: false,
    isMainTab: true
  },
  dispatch: { 
    title: 'Dispatch', 
    subtitle: 'Track shipments',
    showBack: true,
    isMainTab: false
  },
  manualBilling: { 
    title: 'Create Invoice', 
    subtitle: 'Manual billing',
    showBack: true,
    isMainTab: false
  },
  invoices: { 
    title: 'Invoices', 
    subtitle: 'Billing history',
    showBack: true,
    isMainTab: false
  },
  productOwners: { 
    title: 'Suppliers', 
    subtitle: 'Product owners',
    showBack: true,
    isMainTab: false
  },
  analytics: { 
    title: 'Analytics', 
    subtitle: 'Business insights',
    showBack: true,
    isMainTab: false
  },
  employees: { 
    title: 'Employees', 
    subtitle: 'Team management',
    showBack: true,
    isMainTab: false
  },
  profile: { 
    title: 'Settings', 
    subtitle: 'Account settings',
    showBack: false,
    isMainTab: true
  },
};

const MobileDistributorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [previousTab, setPreviousTab] = useState(null);
  const [unreadWhatsApp, setUnreadWhatsApp] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    revenue: 0,
    products: 0
  });
  
  const distributorId = auth.currentUser?.uid;

  // Fetch business info and stats
  useEffect(() => {
    if (!distributorId) return;
    
    const fetchBusinessData = async () => {
      try {
        // Fetch business info
        const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
        if (businessDoc.exists()) {
          setUserData(businessDoc.data());
        }

        // Fetch stats
        const [productsSnap, invoicesSnap, dispatchesSnap] = await Promise.all([
          getDocs(collection(db, 'businesses', distributorId, 'products')),
          getDocs(collection(db, 'businesses', distributorId, 'invoices')),
          getDocs(query(
            collection(db, 'businesses', distributorId, 'dispatches'),
            where('status', 'in', ['pending', 'in_transit'])
          ))
        ]);

        // Calculate revenue from invoices
        let totalRevenue = 0;
        invoicesSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.paidAmount) totalRevenue += data.paidAmount;
        });

        setStats({
          totalOrders: invoicesSnap.size,
          pendingOrders: dispatchesSnap.size,
          revenue: totalRevenue,
          products: productsSnap.size
        });
      } catch (error) {
        console.error('Error fetching business data:', error);
      }
    };
    
    fetchBusinessData();
  }, [distributorId]);

  // Listen for unread WhatsApp messages
  useEffect(() => {
    if (!distributorId) return;
    
    const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
    const unsubscribe = onSnapshot(query(inboxRef), (snapshot) => {
      let unread = 0;
      snapshot.docs.forEach(doc => {
        if (!doc.data().read) unread++;
      });
      setUnreadWhatsApp(unread);
    });
    
    return () => unsubscribe();
  }, [distributorId]);

  // Listen for pending retailer requests
  useEffect(() => {
    if (!distributorId) return;
    
    const requestsRef = collection(db, 'businesses', distributorId, 'retailerRequests');
    const unsubscribe = onSnapshot(
      query(requestsRef, where('status', '==', 'pending')),
      (snapshot) => setNotificationCount(snapshot.size)
    );
    
    return () => unsubscribe();
  }, [distributorId]);

  // Handle tab change with history tracking
  const handleTabChange = (tabId) => {
    setPreviousTab(activeTab);
    setActiveTab(tabId);
  };

  // Handle back navigation
  const handleBack = () => {
    if (previousTab) {
      setActiveTab(previousTab);
      setPreviousTab(null);
    } else {
      setActiveTab('home');
    }
  };

  // Get current tab config
  const currentConfig = TAB_CONFIG[activeTab] || TAB_CONFIG.home;

  // Render active tab content
  const renderContent = () => {
    return (
      <Suspense fallback={<TabLoading />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            {/* Home - Feature Grid */}
            {activeTab === 'home' && (
              <MobileHomeScreen 
                onNavigate={handleTabChange}
                userData={userData}
                stats={stats}
              />
            )}
            
            {/* Dashboard Overview */}
            {activeTab === 'dashboard' && <DistributorHome />}
            
            {/* Retailer Panel */}
            {activeTab === 'retailerRequests' && <RetailerPanel />}
            
            {/* Inventory */}
            {activeTab === 'inventory' && <DistributorInventory />}
            
            {/* AI Forecast */}
            {activeTab === 'aiForecast' && <DistributorAIForecast />}
            
            {/* WhatsApp Hub */}
            {activeTab === 'whatsapp' && (
              <div className="h-[calc(100vh-140px)] -mx-3">
                <WhatsAppHub />
              </div>
            )}
            
            {/* Dispatch Tracker */}
            {activeTab === 'dispatch' && <DispatchTracker db={db} auth={auth} />}
            
            {/* Manual Billing */}
            {activeTab === 'manualBilling' && <DistributorManualBilling />}
            
            {/* Invoices */}
            {activeTab === 'invoices' && <DistributorInvoices />}
            
            {/* Product Owners */}
            {activeTab === 'productOwners' && <ProductOwnerConnection />}
            
            {/* Analytics */}
            {activeTab === 'analytics' && distributorId && (
              <DistributorAnalytics distributorId={distributorId} />
            )}
            
            {/* Employees */}
            {activeTab === 'employees' && <DistributorViewEmployees />}
            
            {/* Profile Settings */}
            {activeTab === 'profile' && <DistributorProfileSettings />}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14]">
      {/* Mobile Header */}
      <MobileHeader
        title={currentConfig.title}
        subtitle={currentConfig.subtitle}
        showBack={currentConfig.showBack}
        onBackPress={handleBack}
        notificationCount={notificationCount}
        showSearch={activeTab === 'inventory'}
      />

      {/* Main Content Area */}
      <div 
        className="pt-16 pb-24 px-3 overflow-y-auto"
        style={{
          minHeight: 'calc(100dvh - 64px)',
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
        }}
      >
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav
        activeTab={
          // Map current tab to bottom nav tab
          ['home', 'retailerRequests', 'inventory', 'whatsapp', 'profile'].includes(activeTab) 
            ? activeTab 
            : 'home'
        }
        onTabChange={handleTabChange}
        userRole="distributor"
        unreadCount={unreadWhatsApp}
      />
    </div>
  );
};

export default MobileDistributorDashboard;
