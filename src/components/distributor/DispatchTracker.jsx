import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OrderRequests from "./orders/OrderRequests";
import PendingOrders from "./orders/PendingOrders";
import TrackOrders from "./orders/TrackOrders";


const DispatchTracker = () => {
  const [activeTab, setActiveTab] = useState("requests");

  // Map between our internal ids and URL tab names
  const idToUrlTab = {
    requests: 'order-requests',
    pending: 'pending-orders',
    completed: 'track-orders',
  };
  const urlTabToId = {
    'order-requests': 'requests',
    'pending-orders': 'pending',
    'track-orders': 'completed',
  };

  // Read tab from location hash on mount and whenever the hash changes
  useEffect(() => {
    const applyFromHash = () => {
      const hash = window.location.hash || '';
      const qIndex = hash.indexOf('?');
      if (qIndex === -1) return;
      const params = new URLSearchParams(hash.substring(qIndex + 1));
      const tab = (params.get('tab') || '').toLowerCase();
      if (urlTabToId[tab]) {
        setActiveTab(urlTabToId[tab]);
      }
    };
    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  // When user clicks a tab, update state and URL hash (?tab=... & optional sub=...)
  const setTabAndHash = (id) => {
    setActiveTab(id);
    try {
      const hash = window.location.hash || '#/distributor-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      const urlTab = idToUrlTab[id] || 'order-requests';
      params.set('tab', urlTab);
      // keep existing `sub` ONLY when staying on track-orders; otherwise drop it
      if (urlTab !== 'track-orders') {
        params.delete('sub');
      }
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) window.history.replaceState(null, '', newHash);
    } catch {}
  };

  const TabButton = ({ id, active, onClick, children }) => (
    <button
      onClick={() => onClick(id)}
      className={`${
        active
          ? "bg-blue-600 text-white shadow"
          : "bg-white text-gray-600 border hover:bg-gray-50"
      } px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 border`}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Dispatch Tracker</h2>

      <div className="mb-6">
        <div className="inline-flex gap-2 p-1 bg-gray-50 rounded-lg border">
          <TabButton id="requests" active={activeTab === "requests"} onClick={setTabAndHash}>
            Order Requests
          </TabButton>
          <TabButton id="pending" active={activeTab === "pending"} onClick={setTabAndHash}>
            Pending Orders
          </TabButton>
          <TabButton id="completed" active={activeTab === "completed"} onClick={setTabAndHash}>
            Track Orders
          </TabButton>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "requests" && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <OrderRequests />
          </motion.div>
        )}
        {activeTab === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PendingOrders />
          </motion.div>
        )}
        {activeTab === "completed" && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TrackOrders />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DispatchTracker;