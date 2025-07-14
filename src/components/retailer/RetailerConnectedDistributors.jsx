import ConnectedDistributorPanel from '../distributor/ConnectedDistributorPanel';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';

const RetailerConnectedDistributors = ({ onSelect }) => {
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser) {
      fetchConnectedDistributors();
    }
  }, [currentUser]);

  // Fetch connected distributors, with improved logging and field fallback handling
  const fetchConnectedDistributors = async () => {
    setLoading(true);
    try {
      const ref = collection(db, `businesses/${currentUser.uid}/connectedDistributors`);
      const snap = await getDocs(ref);

      if (snap.empty) {
        console.warn(`[ConnectedDistributors] ❌ No connectedDistributors found for user: ${currentUser.uid}`);
        setDistributors([]);
      } else {
        // Extract and log each doc for debugging
        const result = snap.docs.map((doc) => {
          const data = doc.data() || {};
          // Fallbacks for possible undefined Firestore fields
          return {
            id: doc.id,
            distributorName: data.distributorName || 'Unnamed Distributor',
            city: data.city || 'Unknown City',
            email: data.distributorEmail || 'Not Provided',
            phone: data.distributorPhone || 'Not Provided',
            distributorOwner: data.distributorOwner || '',
            ...data
          };
        });

        // Sort alphabetically by distributorName, case-insensitive
        const sortedResult = result.sort((a, b) => {
          const nameA = a.distributorName.toLowerCase();
          const nameB = b.distributorName.toLowerCase();
          return nameA.localeCompare(nameB);
        });

        console.log(`[ConnectedDistributors] ✅ Found ${sortedResult.length} connected distributors`);
        setDistributors(sortedResult);
      }
    } catch (error) {
      console.error('[ConnectedDistributors] 🔥 Error fetching connected distributors:', error);
      setDistributors([]);
    }
    setLoading(false);
  };

  const [selectedDistributor, setSelectedDistributor] = useState(null);

  // Fetch full distributor profile and merge with stub
  const handleViewDetails = async (dist) => {
    try {
      const profileRef = doc(db, 'businesses', dist.id);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        setSelectedDistributor({ ...dist, ...profileData });
      } else {
        console.warn(`No profile found for distributor ID: ${dist.id}`);
        setSelectedDistributor(dist);
      }
    } catch (err) {
      console.error('Failed to fetch distributor profile:', err);
      setSelectedDistributor(dist);
    }
  };

  return (
    <div>
      {loading ? (
        <div className="text-center py-8">Loading connected distributors...</div>
      ) : !selectedDistributor ? (
        distributors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No connected distributors found.</div>
        ) : (
          <div>
            <h3 className="mb-2 text-lg font-semibold">View Connected Distributors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {distributors.map((dist) => (
                <div key={dist.id} className="p-4 border rounded shadow-sm">
                  <h4 className="font-medium">{dist.distributorOwner || dist.distributorName || dist.id}</h4>
                  <p className="text-sm text-gray-600">{dist.city || 'City unknown'}</p>
                  {(dist.phone || dist.email) && (
                    <p className="text-sm text-gray-700 mt-1">
                      {dist.phone && <span>Phone: {dist.phone} </span>}
                      {dist.email && <span>Email: {dist.email}</span>}
                    </p>
                  )}
                  <button
                    onClick={() => handleViewDetails(dist)}
                    className="mt-2 text-sm bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    View Details
                  </button>
                  <p className="mt-1 text-xs text-green-600 font-semibold">Connected</p>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div>
          <h3 className="mb-4 text-lg font-semibold">
            Distributor: {selectedDistributor?.distributorName || selectedDistributor?.id}
          </h3>
          <ConnectedDistributorPanel
            distributor={selectedDistributor}
            onBack={() => setSelectedDistributor(null)}
          />
        </div>
      )}
    </div>
  );
};

export default RetailerConnectedDistributors;