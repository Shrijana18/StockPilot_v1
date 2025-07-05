import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from "../firebase/firebaseConfig";
import { useNavigate } from 'react-router-dom';

const auth = getAuth(app);
const db = getFirestore(app);

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'businesses', user.uid));
      if (!userDoc.exists()) {
        setError("⚠️ User data not found in Firestore.");
        return;
      }

      const userData = userDoc.data();
      const role = userData.role;

      // ✅ Redirect based on user role
      if (role === 'retailer') {
        navigate('/dashboard/inventory');
      } else if (role === 'distributor') {
        navigate('/dashboard/billing');
      } else {
        navigate('/dashboard/inventory'); // default fallback
      }

    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-8 bg-slate-900 text-white rounded-2xl shadow-xl w-full max-w-xl border border-slate-700">
      <h2 className="text-2xl font-bold mb-6 text-center">Welcome Back</h2>

      {error && <div className="text-red-400 mb-3 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 rounded bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 rounded bg-slate-800 text-white border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 transition-all duration-300 text-white py-2 px-4 rounded-lg mt-2">Sign In</button>
      </form>
      <div className="mt-6 text-right">
        <button
          onClick={async () => {
            await signOut(auth);
            navigate('/');
          }}
          className="text-sm text-red-400 hover:text-red-600 underline transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Login;