import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from "../firebase/firebaseConfig";
import { useNavigate } from 'react-router-dom';

const auth = getAuth(app);
const db = getFirestore(app);

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // simple keyframes via a style tag injected once
  const LoadBarKeyframes = () => (
    <style>{`
      @keyframes loadbar {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(-10%); }
        100% { transform: translateX(100%); }
      }
      .animate-[loadbar_1.2s_ease-in-out_infinite] {
        animation: loadbar 1.2s ease-in-out infinite;
      }
    `}</style>
  );

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault?.();
    console.log("[Login] submit clicked");
    setError('');
    setLoading(true);
    try {
      const email = (formData.email || '').trim();
      const password = (formData.password || '').trim();
      if (!email || !password) {
        setError('Please enter email and password.');
        return;
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("[Login] firebase signIn OK, uid:", user.uid);
      const snap = await getDoc(doc(db, 'businesses', user.uid));
      console.log("[Login] role doc exists:", snap.exists());
      if (!snap.exists()) {
        setError('⚠️ User data not found in Firestore.');
        return;
      }
      const rawRole = snap.data()?.role ?? '';
      const role = String(rawRole).toLowerCase().replace(/\s|_/g, '');
      console.log("[Login] normalized role:", role);
      if (role === 'retailer') {
        navigate('/dashboard');
      } else if (role === 'distributor') {
        navigate('/distributor-dashboard');
      } else if (role === 'productowner') {
        navigate('/product-owner-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("[Login] error", err?.code, err?.message);
      const code = err?.code || '';
      let message = err?.message || 'Sign in failed. Please try again.';
      if (code === 'auth/invalid-email') message = 'Invalid email address.';
      if (code === 'auth/user-not-found') message = 'No account found with this email.';
      if (code === 'auth/wrong-password') message = 'Incorrect password.';
      if (code === 'auth/too-many-requests') message = 'Too many attempts. Please wait a minute and try again.';
      setError(message);
    } finally {
      setLoading(false);
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

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      // Keep session after refresh
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Try to read role; if missing, create a minimal doc with a safe default role
      const ref = doc(db, 'businesses', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          ownerName: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || '',
          role: 'Retailer',
          createdAt: new Date(),
          authProvider: 'google'
        }, { merge: true });
      }

      const roleRaw = (snap.exists() ? snap.data()?.role : 'Retailer') || 'Retailer';
      const role = String(roleRaw).toLowerCase().replace(/\s|_/g, '');

      if (role === 'retailer') {
        navigate('/dashboard');
      } else if (role === 'distributor') {
        navigate('/distributor-dashboard');
      } else if (role === 'productowner') {
        navigate('/product-owner-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('[Login] Google Sign-In Error:', error?.code, error?.message);
      setError(error?.message || 'Google sign-in failed. Try again or use email login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14]">
      <LoadBarKeyframes />
      {/* Aurora / brand glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-[60vmax] h-[60vmax] rounded-full blur-3xl bg-gradient-to-tr from-emerald-500/40 via-teal-400/30 to-cyan-400/30" />
        <div className="absolute -bottom-24 -right-24 w-[50vmax] h-[50vmax] rounded-full blur-3xl bg-gradient-to-tr from-cyan-500/30 via-sky-400/20 to-emerald-400/30" />
      </div>

      {/* Centered glass card */}
      <div className="relative z-10 flex items-center justify-center px-6 py-14 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] relative">
          {loading && (
            <div className="absolute left-0 top-0 h-1 w-full overflow-hidden rounded-t-3xl">
              <div className="h-full w-full animate-[loadbar_1.2s_ease-in-out_infinite] bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"></div>
            </div>
          )}
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
          <div className="px-7 sm:px-8 pb-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full mb-4 flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
              Sign in with Google
            </button>
          </div>
          <div className="flex items-center px-7 sm:px-8 pb-2">
            <div className="flex-1 h-px bg-white/20"></div>
            <span className="px-3 text-xs text-white/60">or</span>
            <div className="flex-1 h-px bg-white/20"></div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="px-7 sm:px-8 pb-8 space-y-4">
            <div className="group">
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="email"
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
                disabled={loading}
                autoComplete="current-password"
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
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
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
              disabled={loading}
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