import { useState } from "react";
import OrderRequests from "./orders/OrderRequests";
import PendingOrders from "./orders/PendingOrders";
import TrackOrders from "./orders/TrackOrders";


const DispatchTracker = () => {
  const [activeTab, setActiveTab] = useState("requests");

  return (
    <div>
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

      {activeTab === "requests" && (
        <OrderRequests />
      )}
      {activeTab === "pending" && (
        <PendingOrders />
      )}
      {activeTab === "completed" && (
        <TrackOrders />
      )}
    </div>
  );
}

export default DispatchTracker;