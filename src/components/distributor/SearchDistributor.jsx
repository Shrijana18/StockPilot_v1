import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';
import SendRequestModal from './SendRequestModal';

const checkIfRequestExists = async (retailerId, distributorId) => {
  const retailerRef = doc(db, 'businesses', retailerId, 'sentRequests', distributorId);
  const distributorRef = doc(db, 'businesses', distributorId, 'connectionRequests', retailerId);

  const [retailerSnap, distributorSnap] = await Promise.all([getDoc(retailerRef), getDoc(distributorRef)]);

  if (retailerSnap.exists() && distributorSnap.exists()) {
    const retailerStatus = retailerSnap.data().status;
    const distributorStatus = distributorSnap.data().status;
    if (retailerStatus === 'accepted' && distributorStatus === 'accepted') {
      return 'connected';
    }
    return retailerStatus || distributorStatus || null;
  } else if (retailerSnap.exists()) {
    return retailerSnap.data().status;
  } else if (distributorSnap.exists()) {
    return distributorSnap.data().status;
  }
  return null;
};

const SearchDistributor = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    const q = query(collection(db, 'businesses'), where('role', '==', 'Distributor'));
    let querySnapshot = [];
    try {
      querySnapshot = await getDocs(q);
    } catch (error) {
      console.error("🔥 Firestore search error:", error.message);
      alert("Permission error or network issue. Please check your Firebase rules or connection.");
      setLoading(false);
      return;
    }

    const matched = [];
    const retailerId = auth.currentUser?.uid;

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      if (
        data.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.phone?.includes(searchTerm) ||
        data.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        id === searchTerm
      ) {
        const requestStatus = await checkIfRequestExists(retailerId, id);
        matched.push({ id, ...data, requestStatus });
      }
    }

    setResults(matched);
    setLoading(false);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Search Distributors</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, city or ID"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
        <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div>
        {results.length === 0 && !loading && (
          <p className="text-gray-500">No distributors found.</p>
        )}
        {results.map((dist) => (
          <div
            key={dist.id}
            className="border p-3 rounded mb-2 shadow-sm flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{dist.businessName}</p>
              <p className="text-sm text-gray-600">Owner: {dist.ownerName}</p>
              <p className="text-sm text-gray-500">City: {dist.city}</p>
              <p className="text-sm text-gray-500">Phone: {dist.phone}</p>
              <p className="text-sm text-gray-500">ID: {dist.id}</p>
            </div>
            {dist.requestStatus === 'connected' ? (
              <span className="bg-green-500 text-white px-3 py-1 rounded">Connected</span>
            ) : dist.requestStatus === 'accepted' ? (
              <span className="bg-green-400 text-white px-3 py-1 rounded">Accepted</span>
            ) : dist.requestStatus === 'pending' ? (
              <span className="bg-gray-400 text-white px-3 py-1 rounded">Request Sent</span>
            ) : (
              <button
                onClick={() => {
                  setSelectedDistributor(dist);
                  setShowModal(true);
                }}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Send Request
              </button>
            )}
          </div>
        ))}
      </div>
      {showModal && selectedDistributor && (
        <SendRequestModal
          distributor={selectedDistributor}
          onClose={() => {
            setShowModal(false);
            setSelectedDistributor(null);
          }}
        />
      )}
    </div>
  );
};

export default SearchDistributor;