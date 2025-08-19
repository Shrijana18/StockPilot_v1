import React, { useState } from 'react';
import OrderStatusTab from './OrderStatusTab.jsx';
import TrackOrderTab from './TrackOrderTab.jsx';

const RetailerOrderHistory = () => {
  const [activeTab, setActiveTab] = useState('status');

  return (
    <div className="p-4 text-white">
      <h2 className="text-2xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Order History</h2>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'status'
              ? 'bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]'
              : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'
          }`}
        >
          📊 Order Status
        </button>
        <button
          onClick={() => setActiveTab('track')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'track'
              ? 'bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]'
              : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'
          }`}
        >
          🚚 Track Orders
        </button>
      </div>

      <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        {activeTab === 'status' ? (
          <OrderStatusTab />
        ) : (
          <div>
            <TrackOrderTab />
            <p className="text-white/70 text-sm mt-4 ml-1">
              Track order status across: Requested → Accepted/Rejected/Modified → Shipped → Delivered
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailerOrderHistory;