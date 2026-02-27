/**
 * MobileRetailerDashboard - Native App Experience for Retailers
 * Features: Home, Marketplace, Inventory, Billing, Manage Employee, Profile.
 * POS and other advanced features are on web only.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import MobileBottomNav from '../components/MobileBottomNav';
import MobileHeader from '../components/MobileHeader';
import RetailerMobileHomeScreen from './RetailerMobileHomeScreen';

const MarketplaceSetup = lazy(() => import('../../components/retailer/marketplace/MarketplaceSetup'));
const MarketplaceProducts = lazy(() => import('../../components/retailer/marketplace/MarketplaceProducts'));
const CustomerOrders = lazy(() => import('../../components/retailer/marketplace/CustomerOrders'));
const ViewInventory = lazy(() => import('../../components/inventory/ViewInventory'));
const ManualEntryForm = lazy(() => import('../../components/inventory/ManualEntryForm'));
const OCRUploadForm = lazy(() => import('../../components/inventory/OCRUploadForm'));
const AddInventoryAI = lazy(() => import('../../components/inventory/AddInventoryAI'));
const Billing = lazy(() => import('../../pages/Billing'));
const ManageEmployee = lazy(() => import('../../components/employee/ManageEmployee'));
const ProfileSettings = lazy(() => import('../../components/profile/ProfileSettings'));

const TabLoading = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      <span className="text-gray-400 text-sm">Loading...</span>
    </div>
  </div>
);

const TAB_CONFIG = {
  home: { title: 'FLYP', subtitle: 'Retailer', showBack: false, isMainTab: true },
  marketplace: { title: 'Marketplace', subtitle: 'Store & orders', showBack: false, isMainTab: true },
  inventory: { title: 'Inventory', subtitle: 'Products & stock', showBack: false, isMainTab: true },
  billing: { title: 'Billing', subtitle: 'Invoices', showBack: false, isMainTab: true },
  employees: { title: 'Manage Employee', subtitle: 'Team', showBack: true, isMainTab: false },
  profile: { title: 'Profile', subtitle: 'Settings', showBack: false, isMainTab: true },
};

const MobileRetailerDashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [previousTab, setPreviousTab] = useState(null);
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, employees: 0 });
  const [marketplaceTab, setMarketplaceTab] = useState('orders');
  const [inventoryTab, setInventoryTab] = useState('view');
  const [addMethod, setAddMethod] = useState('manual');

  const retailerId = auth.currentUser?.uid;

  // Lock body scroll and match app background so no colour mismatch at top/bottom
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.height = '100%';
    document.body.style.backgroundColor = '#0B0F14';
    document.documentElement.style.backgroundColor = '#0B0F14';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.height = '';
      document.documentElement.style.height = '';
      document.body.style.backgroundColor = prevBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, []);

  useEffect(() => {
    if (!retailerId) return;

    const fetchData = async () => {
      try {
        const [businessSnap, productsSnap, employeesSnap] = await Promise.all([
          getDoc(doc(db, 'businesses', retailerId)),
          getDocs(collection(db, 'businesses', retailerId, 'products')),
          getDocs(collection(db, 'businesses', retailerId, 'employees')),
        ]);

        if (businessSnap.exists()) {
          setUserData(businessSnap.data());
        }

        // Optional: orders/revenue from invoices if you have that collection
        let orders = 0;
        let revenue = 0;
        try {
          const invoicesSnap = await getDocs(collection(db, 'businesses', retailerId, 'invoices'));
          orders = invoicesSnap.size;
          invoicesSnap.docs.forEach((d) => {
            const amt = d.data().paidAmount ?? d.data().total ?? 0;
            revenue += Number(amt);
          });
        } catch (_) {}

        setStats({
          products: productsSnap.size,
          orders,
          revenue,
          employees: employeesSnap.size,
        });
      } catch (err) {
        console.error('Error fetching retailer data:', err);
      }
    };

    fetchData();
  }, [retailerId]);

  const handleTabChange = (tabId) => {
    setPreviousTab(activeTab);
    setActiveTab(tabId);
  };

  const handleBack = () => {
    if (previousTab) {
      setActiveTab(previousTab);
      setPreviousTab(null);
    } else {
      setActiveTab('home');
    }
  };

  const currentConfig = TAB_CONFIG[activeTab] || TAB_CONFIG.home;

  const renderContent = () => (
    <Suspense fallback={<TabLoading />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="min-h-full"
        >
          {activeTab === 'home' && (
            <RetailerMobileHomeScreen
              onNavigate={handleTabChange}
              userData={userData}
              stats={stats}
            />
          )}

          {activeTab === 'marketplace' && (
            <div className="space-y-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Section</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 scrollbar-hide">
                {[
                  { id: 'orders', label: 'Orders', icon: '🛒' },
                  { id: 'products', label: 'Products', icon: '📦' },
                  { id: 'setup', label: 'Setup', icon: '⚙️' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMarketplaceTab(t.id)}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                      marketplaceTab === t.id
                        ? 'bg-emerald-500 text-slate-900'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <div className="min-h-0">
                {marketplaceTab === 'orders' && <CustomerOrders />}
                {marketplaceTab === 'products' && <MarketplaceProducts />}
                {marketplaceTab === 'setup' && <MarketplaceSetup />}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Section</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 scrollbar-hide">
                {[
                  { id: 'view', label: 'View' },
                  { id: 'add', label: 'Add' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInventoryTab(t.id)}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                      inventoryTab === t.id ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {inventoryTab === 'view' && retailerId && <ViewInventory userId={retailerId} />}
              {inventoryTab === 'add' && retailerId && (
                <div className="space-y-4">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Add method</p>
                  <div className="flex gap-2 flex-wrap">
                    {['manual', 'ocr', 'ai'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAddMethod(m)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium ${
                          addMethod === m ? 'bg-emerald-500 text-slate-900' : 'bg-white/10 text-white'
                        }`}
                      >
                        {m === 'manual' ? 'Manual' : m === 'ocr' ? 'OCR' : 'AI'}
                      </button>
                    ))}
                  </div>
                  {addMethod === 'manual' && <ManualEntryForm userId={retailerId} />}
                  {addMethod === 'ocr' && <OCRUploadForm userId={retailerId} />}
                  {addMethod === 'ai' && <AddInventoryAI userId={retailerId} />}
                </div>
              )}
            </div>
          )}

          {activeTab === 'billing' && <Billing />}
          {activeTab === 'employees' && <ManageEmployee />}
          {activeTab === 'profile' && <ProfileSettings />}
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );

  const bottomNavTab =
    ['home', 'marketplace', 'inventory', 'billing', 'employees', 'profile'].includes(activeTab)
      ? activeTab
      : 'home';

  return (
    <div
      className="fixed inset-0 z-10 h-[100dvh] max-h-[100dvh] bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] flex flex-col overflow-hidden"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      <MobileHeader
        title={currentConfig.title}
        subtitle={currentConfig.subtitle}
        showBack={currentConfig.showBack}
        onBackPress={handleBack}
        showSearch={activeTab === 'inventory'}
      />

      <main
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{
          paddingTop: 'calc(62px + max(env(safe-area-inset-top) - 12px, 2px))',
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-3 pt-3 pb-3">{renderContent()}</div>
      </main>

      <MobileBottomNav
        activeTab={bottomNavTab}
        onTabChange={handleTabChange}
        userRole="retailer"
      />
    </div>
  );
};

export default MobileRetailerDashboard;
