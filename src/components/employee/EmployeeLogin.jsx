import React, { useState } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

const cleanFlypId = flypId?.trim?.().toUpperCase?.();
const cleanPhone = phone?.trim?.();
const cleanPassword = password?.trim?.();

const EmployeeLogin = () => {
  const [flypId, setFlypId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const cleanFlypId = flypId.trim().toUpperCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if (!cleanFlypId || !cleanPhone || !cleanPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const employeeRef = doc(db, 'employeeIndex', cleanFlypId);
      const snap = await getDoc(employeeRef);

      if (!snap.exists()) {
        toast.error('Invalid FLYP ID');
        return;
      }

      const data = snap.data();
      if (data.phone !== cleanPhone || data.password !== cleanPassword) {
        toast.error('Incorrect phone or password');
        return;
      }

      localStorage.setItem('employeeRole', data.role);
      localStorage.setItem('retailerId', data.retailerId);

      await updateDoc(doc(db, 'businesses', data.retailerId, 'employees', cleanFlypId), {
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