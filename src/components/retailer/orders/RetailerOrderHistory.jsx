import React, { useState } from 'react';
import OrderStatusTab from './OrderStatusTab.jsx';
import TrackOrderTab from './TrackOrderTab.jsx';

const RetailerOrderHistory = () => {
  const [activeTab, setActiveTab] = useState('status');

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Order History</h2>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 rounded ${
            activeTab === 'status' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          📊 Order Status
        </button>
        <button
          onClick={() => setActiveTab('track')}
          className={`px-4 py-2 rounded ${
            activeTab === 'track' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          🚚 Track Orders
        </button>
      </div>

      <div>
        {activeTab === 'status' ? (
          <OrderStatusTab />
        ) : (
          <div>
            <TrackOrderTab />
            <p className="text-gray-600 text-sm mt-4 ml-1">
              Track order status across: Requested → Accepted/Rejected/Modified → Shipped → Delivered
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailerOrderHistory;