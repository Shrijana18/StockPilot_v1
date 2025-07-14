

import React, { useState } from 'react';
import SearchDistributor from '../distributor/SearchDistributor';
import ViewSentRequests from '../distributor/ViewSentRequests';
import RetailerConnectedDistributors from './RetailerConnectedDistributors';

const DistributorPanel = () => {
  const [activeSubTab, setActiveSubTab] = useState('search');

  const renderSubTab = () => {
    switch (activeSubTab) {
      case 'search':
        return <SearchDistributor />;
      case 'sent':
        return <ViewSentRequests />;
      case 'connected':
        return <RetailerConnectedDistributors />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeSubTab === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveSubTab('search')}
        >
          Search Distributors
        </button>
        <button
          className={`px-4 py-2 rounded ${activeSubTab === 'sent' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveSubTab('sent')}
        >
          Sent Requests
        </button>
        <button
          className={`px-4 py-2 rounded ${activeSubTab === 'connected' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveSubTab('connected')}
        >
          Send Order
        </button>
      </div>
      {renderSubTab()}
    </div>
  );
};

export default DistributorPanel;