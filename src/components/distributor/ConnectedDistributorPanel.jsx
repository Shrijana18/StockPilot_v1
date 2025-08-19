import React, { useState } from 'react';
import SmartAssistant from './SmartAssistant';
import RetailerOrderRequestForm from "../retailer/RetailerOrderRequestForm";

const ConnectedDistributorPanel = ({ distributor, onBack }) => {
  if (!distributor) {
    console.warn('⚠️ No distributor passed to ConnectedDistributorPanel');
    return <div className="p-4 text-red-600">Error: No distributor selected.</div>;
  }

  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Distributor Overview</h3>
            <p><strong>Name:</strong> {distributor?.businessName || distributor?.distributorName || distributor?.name || distributor?.ownerName || 'N/A'}</p>
            <p><strong>City:</strong> {distributor?.city || 'N/A'}</p>
            <p><strong>Phone:</strong> {distributor?.phone || 'N/A'}</p>
            <p><strong>Email:</strong> {distributor?.email || 'N/A'}</p>
            <p><strong>ID:</strong> {distributor?.id || 'N/A'}</p>
          </div>
        );
      case 'enquiry':
        return (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Send Enquiry</h3>
            <textarea className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50" rows="4" placeholder="Type your message about item, pricing or availability..."></textarea>
            <button className="mt-2 px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]">Send Enquiry</button>
          </div>
        );
      case 'order':
        return (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Place Order</h3>
            <RetailerOrderRequestForm distributorId={distributor?.id} />
          </div>
        );
      case 'chat':
        return (
          <div className="p-4">
            <SmartAssistant distributor={distributor} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 rounded-t-xl">
        <h2 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
          Connected to {distributor?.businessName || distributor?.distributorName || distributor?.name || distributor?.ownerName || 'N/A'}
        </h2>
        {onBack && (
          <button onClick={onBack} className="text-sm text-white/80 hover:text-white" data-testid="back-to-distributors">
            ← Back
          </button>
        )}
      </div>
      <div className="flex border-b border-white/10">
        {[
          { key: 'overview', label: 'Distributor Overview' },
          { key: 'enquiry', label: 'Send Enquiry' },
          { key: 'order', label: 'Place Order' },
          { key: 'chat', label: 'Smart Assistant' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm capitalize font-medium ${
              activeTab === key
                ? 'text-emerald-300 border-b-2 border-emerald-400'
                : 'text-white/70 hover:text-white'
            }`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div>{renderTabContent()}</div>
    </div>
  );
};

export default ConnectedDistributorPanel;