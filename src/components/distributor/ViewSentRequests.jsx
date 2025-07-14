import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';

const ViewSentRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const ref = collection(db, `businesses/${currentUser.uid}/sentRequests`);
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const result = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRequests(result);
    });

    return () => unsubscribe();
  }, [currentUser]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Your Sent Distributor Requests</h2>
      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">You haven’t sent any requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li
              key={req.id}
              className="border rounded p-4 flex justify-between items-center shadow-sm"
            >
              <div>
                <p className="font-medium">{req.distributorName}</p>
                <p className="text-sm text-gray-600">Distributor ID: {req.distributorId}</p>
                <p className="text-sm text-gray-500">Status: {req.status}</p>
              </div>
              {req.status === 'pending' && (
                <button
                  disabled
                  className="bg-yellow-400 text-white px-3 py-1 rounded opacity-60 cursor-not-allowed"
                >
                  Pending
                </button>
              )}
              {req.status === 'active' && (
                <span className="bg-green-600 text-white px-3 py-1 rounded">
                  Connected
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ViewSentRequests;