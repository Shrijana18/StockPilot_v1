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
    <div className="p-4 text-white">
      <h2 className="text-lg font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Search Distributors</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, city or ID"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 rounded-xl w-full bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
        />
        <button onClick={handleSearch} className="px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div>
        {results.length === 0 && !loading && (
          <p className="text-white/70">No distributors found.</p>
        )}
        {results.map((dist) => (
          <div
            key={dist.id}
            className="p-3 rounded-xl mb-2 flex justify-between items-center bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          >
            <div>
              <p className="font-medium text-white">{dist.businessName}</p>
              <p className="text-sm text-white/70">Owner: {dist.ownerName}</p>
              <p className="text-sm text-white/60">City: {dist.city}</p>
              <p className="text-sm text-white/60">Phone: {dist.phone}</p>
              <p className="text-sm text-white/60">ID: {dist.id}</p>
            </div>
            {dist.requestStatus === 'connected' ? (
              <span className="px-3 py-1 rounded text-slate-900 bg-emerald-400">Connected</span>
            ) : dist.requestStatus === 'accepted' ? (
              <span className="px-3 py-1 rounded text-slate-900 bg-emerald-300">Accepted</span>
            ) : dist.requestStatus === 'pending' ? (
              <span className="px-3 py-1 rounded bg-white/20 text-white/80">Request Sent</span>
            ) : (
              <button
                onClick={() => {
                  setSelectedDistributor(dist);
                  setShowModal(true);
                }}
                className="px-3 py-1 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
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