import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OrderRequests from "./orders/OrderRequests";
import PendingOrders from "./orders/PendingOrders";
import TrackOrders from "./orders/TrackOrders";
import PassiveOrders from "./orders/PassiveOrders";


const DispatchTracker = () => {
  const [activeTab, setActiveTab] = useState("requests");

  // Map between our internal ids and URL tab names
  const idToUrlTab = {
    requests: 'order-requests',
    create: 'create-order',
    pending: 'pending-orders',
    completed: 'track-orders',
  };
  const urlTabToId = {
    'order-requests': 'requests',
    'create-order': 'create',
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
          ? "bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
          : "bg-white/10 text-white border border-white/15 hover:bg-white/15"
      } px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 border focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50`}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );

  return (
    <div className="p-6 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl text-white">
      <div className="relative mb-4">
        <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Dispatch Tracker</h2>
        <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
      </div>

      <div className="mb-6 sticky top-[72px] z-30">
        <div className="inline-flex gap-2 p-1 rounded-full border border-white/15 bg-[#0B0F14]/80 supports-[backdrop-filter]:bg-[#0B0F14]/60 backdrop-blur-xl shadow-lg" role="tablist" aria-label="Dispatch sections">
          <TabButton id="requests" active={activeTab === "requests"} onClick={setTabAndHash}>
            Order Requests
          </TabButton>
          <TabButton id="create" active={activeTab === "create"} onClick={setTabAndHash}>
            Create Order
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
        {activeTab === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PassiveOrders />
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