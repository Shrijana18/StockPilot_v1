import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';

const CustomerOnboarding = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const ref = collection(db, `businesses/${currentUser.uid}/connectionRequests`);
      const snap = await getDocs(ref);
      const result = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRequests(result);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
    setLoading(false);
  };

  const handleAccept = async (retailer) => {
    try {
      // Update connection in distributor's account
      await setDoc(doc(db, `businesses/${currentUser.uid}/connections/${retailer.id}`), {
        ...retailer,
        connectedAt: new Date().toISOString(),
        status: 'active',
      });

      // Update retailer's connection mirror
      await setDoc(doc(db, `businesses/${retailer.id}/connectedDistributors/${currentUser.uid}`), {
        distributorId: currentUser.uid,
        distributorName: currentUser.displayName || 'Distributor',
        connectedAt: new Date().toISOString(),
        status: 'active',
      });

      alert(`Accepted connection with ${retailer.retailerName}`);
      fetchRequests();
    } catch (err) {
      console.error('Error accepting connection:', err);
      alert('Failed to accept request.');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Incoming Retailer Requests</h2>
      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">No incoming requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="border rounded p-4 flex justify-between items-center shadow-sm"
            >
              <div>
                <p className="font-medium">{req.retailerName}</p>
                <p className="text-sm text-gray-600">{req.message}</p>
                <p className="text-xs text-gray-400">Retailer ID: {req.retailerId}</p>
              </div>
              <button
                onClick={() => handleAccept(req)}
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Accept
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomerOnboarding;
