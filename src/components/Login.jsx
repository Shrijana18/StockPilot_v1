import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { sendPasswordResetEmail } from 'firebase/auth';
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

  const handleForgotPassword = async () => {
    if (!formData.email) {
      alert("Please enter your email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, formData.email);
      alert("Password reset email sent. Please check your inbox.");
    } catch (error) {
      console.error("Reset error:", error.message);
      setError("Failed to send reset email. Check your email and try again.");
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14]">
      {/* Aurora / brand glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-[60vmax] h-[60vmax] rounded-full blur-3xl bg-gradient-to-tr from-emerald-500/40 via-teal-400/30 to-cyan-400/30" />
        <div className="absolute -bottom-24 -right-24 w-[50vmax] h-[50vmax] rounded-full blur-3xl bg-gradient-to-tr from-cyan-500/30 via-sky-400/20 to-emerald-400/30" />
      </div>

      {/* Centered glass card */}
      <div className="relative z-10 flex items-center justify-center px-6 py-14 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <div className="px-7 sm:px-8 pt-8 pb-6 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2">
              <span className="text-xl font-semibold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">FLYP</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/80">Sign In</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-white/70">Continue to your dashboard</p>
          </div>

          {error && (
            <div className="mx-7 sm:mx-8 mb-3 text-rose-300 text-sm bg-rose-900/30 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-7 sm:px-8 pb-8 space-y-4">
            <div className="group">
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-300/40 transition"
              />
            </div>

            <div className="group">
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-300/40 transition"
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-emerald-300/90 hover:text-emerald-200 underline underline-offset-4"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              Sign In
            </button>

            <div className="pt-2 text-center text-xs text-white/70">
              By continuing you agree to FLYP’s <span className="underline decoration-white/30">Terms</span> & <span className="underline decoration-white/30">Privacy</span>
            </div>
          </form>

          <div className="px-7 sm:px-8 pb-6 text-right">
            <button
              onClick={async () => {
                await signOut(auth);
                navigate('/');
              }}
              className="text-xs text-red-300/90 hover:text-red-200 underline underline-offset-4 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;