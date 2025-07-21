

import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { auth } from '../../firebase/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const EmployeeDashboard = () => {
  const [employee, setEmployee] = useState(null);
  const navigate = useNavigate();

  const retailerId = localStorage.getItem('retailerId');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !retailerId) {
        navigate('/employee-login');
        return;
      }

      const empRef = doc(db, 'businesses', retailerId, 'employees', user.uid);
      const empSnap = await getDoc(empRef);

      if (empSnap.exists()) {
        setEmployee({ id: user.uid, ...empSnap.data() });

        // Update last seen periodically
        await updateDoc(empRef, {
          lastSeen: serverTimestamp(),
          online: true
        });
      } else {
        navigate('/employee-login');
      }
    });

    return () => unsubscribe();
  }, [retailerId, navigate]);

  const handleLogout = async () => {
    if (employee && retailerId) {
      await updateDoc(doc(db, 'businesses', retailerId, 'employees', employee.id), {
        online: false,
        lastSeen: serverTimestamp()
      });
    }

    localStorage.clear();
    await signOut(auth);
    navigate('/employee-login');
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  if (!employee) {
    return <div className="p-4">Loading employee details...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">👋 Welcome, {employee.name}</h2>
      <div className="bg-white p-4 rounded shadow-md w-full max-w-xl">
        <p><strong>FLYP ID:</strong> {employee.flypId || '-'}</p>
        <p><strong>Role:</strong> {employee.role || '-'}</p>
        <p>
          <strong>Status:</strong>{' '}
          {employee.online ? (
            <span className="text-green-600 font-semibold">Online</span>
          ) : (
            <span className="text-gray-600 italic">Offline</span>
          )}
        </p>
        <p><strong>Last Seen:</strong> {formatLastSeen(employee.lastSeen)}</p>
        <button
          onClick={handleLogout}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default EmployeeDashboard;