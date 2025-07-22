import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { auth } from '../../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';

const EmployeeLogin = () => {
  const [flypId, setFlypId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    signOut(auth);
  }, []);

  const handleLogin = async () => {
    const cleanFlypId = flypId.trim().toUpperCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanFlypId || !cleanPhone || !cleanPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      // Step 1: Find employee UID from flypId index
      const flypRef = doc(db, 'employeeIndex', cleanFlypId);
      const flypSnap = await getDoc(flypRef);
      if (!flypSnap.exists()) {
        toast.error('Invalid FLYP ID');
        return;
      }
      const flypData = flypSnap.data();
      const { uid, retailerId } = flypData;

      // Step 2: Fetch actual employee record using UID
      const employeeRef = doc(db, 'businesses', retailerId, 'employees', uid);
      const snap = await getDoc(employeeRef);
      if (!snap.exists()) {
        toast.error('Employee not linked to this business');
        return;
      }

      const data = snap.data();
      if (data.phone !== cleanPhone || data.password !== cleanPassword) {
        toast.error('Incorrect phone or password');
        return;
      }

      localStorage.setItem('employeeRole', data.role);
      localStorage.setItem('retailerId', retailerId);
      localStorage.setItem('employeeUID', uid);

      await updateDoc(employeeRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

      toast.success(`Welcome ${data.role}`);
      window.location.href = '/employee-dashboard';
    } catch (error) {
      console.error('Login error', error.message);
      toast.error('Login failed');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Employee Login</h2>
      <input
        className="border p-2 w-full mb-2"
        placeholder="FLYP ID"
        value={flypId}
        onChange={(e) => setFlypId(e.target.value)}
      />
      <input
        className="border p-2 w-full mb-2"
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        type="password"
        className="border p-2 w-full mb-2"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin} className="bg-green-600 text-white px-4 py-2 rounded">
        Login
      </button>
    </div>
  );
};

export default EmployeeLogin;