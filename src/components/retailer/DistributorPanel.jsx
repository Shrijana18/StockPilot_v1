

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
    <div className="p-4 text-white">
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded-xl transition ${activeSubTab === 'search' ? 'bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]' : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'}`}
          onClick={() => setActiveSubTab('search')}
        >
          Search Distributors
        </button>
        <button
          className={`px-4 py-2 rounded-xl transition ${activeSubTab === 'sent' ? 'bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]' : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'}`}
          onClick={() => setActiveSubTab('sent')}
        >
          Sent Requests
        </button>
        <button
          className={`px-4 py-2 rounded-xl transition ${activeSubTab === 'connected' ? 'bg-emerald-500 text-slate-900 shadow-[0_8px_24px_rgba(16,185,129,0.35)]' : 'bg-white/10 text-white hover:bg-white/15 border border-white/15'}`}
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