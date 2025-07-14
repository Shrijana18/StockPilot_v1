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
            <h3 className="text-lg font-semibold">Distributor Overview</h3>
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
            <h3 className="text-lg font-semibold">Send Enquiry</h3>
            <textarea className="w-full border p-2 rounded" rows="4" placeholder="Type your message about item, pricing or availability..."></textarea>
            <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">Send Enquiry</button>
          </div>
        );
      case 'order':
        return (
          <div className="p-4">
            <h3 className="text-lg font-semibold">Place Order</h3>
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
    <div className="bg-white rounded shadow-md mt-4">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t">
        <h2 className="text-lg font-semibold text-gray-800">
          Connected to {distributor?.businessName || distributor?.distributorName || distributor?.name || distributor?.ownerName || 'N/A'}
        </h2>
        {onBack && (
          <button onClick={onBack} className="text-sm text-blue-600 hover:underline" data-testid="back-to-distributors">
            ← Back
          </button>
        )}
      </div>
      <div className="flex border-b">
        {[
          { key: 'overview', label: 'Distributor Overview' },
          { key: 'enquiry', label: 'Send Enquiry' },
          { key: 'order', label: 'Place Order' },
          { key: 'chat', label: 'Smart Assistant' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm capitalize font-medium ${
              activeTab === key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
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