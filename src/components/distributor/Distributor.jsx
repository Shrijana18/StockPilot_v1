import React, { useState } from 'react';
import SearchDistributor from './SearchDistributor';
import ViewSentRequests from './ViewSentRequests';
import RetailerOrderRequestForm from '../retailer/RetailerOrderRequestForm';

const Distributor = () => {
  const [activeTab, setActiveTab] = useState('search');

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 rounded ${
            activeTab === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          Search Distributors
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded ${
            activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          Sent Requests
        </button>
        <button
          onClick={() => setActiveTab('order')}
          className={`px-4 py-2 rounded ${
            activeTab === 'order' ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          Send Order
        </button>
      </div>

      <div>
        {activeTab === 'search' && <SearchDistributor />}
        {activeTab === 'requests' && <ViewSentRequests />}
        {activeTab === 'order' && <RetailerOrderRequestForm />}
      </div>
    </div>
  );
};

export default Distributor;
