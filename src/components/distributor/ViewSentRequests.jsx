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
  <div className="p-4 text-white">
    <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Your Sent Distributor Requests</h2>
    {loading ? (
      <p className="text-white/80">Loading...</p>
    ) : requests.length === 0 ? (
      <p className="text-white/70">You haven’t sent any requests yet.</p>
    ) : (
      <ul className="space-y-3">
        {requests.map((req) => (
          <li
            key={req.id}
            className="p-4 rounded-xl flex justify-between items-center bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          >
            <div>
              <p className="font-medium text-white">{req.distributorName}</p>
              <p className="text-sm text-white/70">Distributor ID: {req.distributorId}</p>
              <p className="text-sm text-white/60">Status: {req.status}</p>
            </div>
            {req.status === 'pending' && (
              <button
                disabled
                className="px-3 py-1 rounded-lg bg-white/20 text-white/80 cursor-not-allowed"
              >
                Pending
              </button>
            )}
            {req.status === 'active' && (
              <span className="px-3 py-1 rounded-lg text-slate-900 bg-emerald-400">
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