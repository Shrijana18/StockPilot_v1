import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OrderRequests from "./orders/OrderRequests";
import PendingOrders from "./orders/PendingOrders";
import TrackOrders from "./orders/TrackOrders";


const DispatchTracker = () => {
  const [activeTab, setActiveTab] = useState("requests");

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Dispatch Tracker</h2>

      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "requests" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("requests")}
        >
          Order Requests
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "pending" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Orders
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "completed" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("completed")}
        >
          Track Orders
        </button>
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