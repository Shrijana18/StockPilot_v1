import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from "../firebase/firebaseConfig";
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../utils/authUtils';
import OTPVerification from './OTPVerification';
import { usePlatform } from '../hooks/usePlatform.js';

const auth = getAuth(app);
const db = getFirestore(app);

// Feature flag: Set to true to enable OTP verification (requires MSG91 DLT ID setup)
const ENABLE_OTP_VERIFICATION = false;

const Login = () => {
  const navigate = useNavigate();
  const { platform } = usePlatform();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [userPhone, setUserPhone] = useState(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

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
    
    // Add production debugging
    const isProduction = window.location.hostname !== 'localhost';
    if (isProduction) {
      console.log("[Login] Production environment detected");
    }
    
    try {
      const email = (formData.email || '').trim();
      const password = (formData.password || '').trim();
      if (!email || !password) {
        setError('Please enter email and password.');
        setLoading(false);
        return;
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("[Login] firebase signIn OK, uid:", user.uid);
      
      // Email verification removed from flow - can be added later as optional notification
      
      const snap = await getDoc(doc(db, 'businesses', user.uid));
      console.log("[Login] role doc exists:", snap.exists());
      if (!snap.exists()) {
        setError('⚠️ Account not found. Please register first.');
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      // SECURITY: Verify user owns this account (email matches)
      const userData = snap.data();
      if (userData.email && userData.email.toLowerCase() !== email.toLowerCase()) {
        setError('⚠️ Email mismatch detected. Please contact support.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      // OTP verification (temporarily disabled until MSG91 DLT ID is set up)
      if (ENABLE_OTP_VERIFICATION) {
        // Get user's phone number for OTP verification
        const phone = userData?.phone || '';
        if (phone) {
          // Show OTP verification if phone exists and not already verified
          if (!phoneVerified) {
            setUserPhone(phone);
            setPendingUser({ user, userData, snap });
            setShowOtpVerification(true);
            setLoading(false);
            return;
          }
        }
      }

      // Proceed with login (skip OTP if disabled)
      await completeLogin(user, userData);
    } catch (err) {
      console.error("[Login] error", err?.code, err?.message);
      const code = err?.code || '';
      let message = err?.message || 'Sign in failed. Please try again.';
      if (code === 'auth/invalid-email') message = 'Invalid email address.';
      if (code === 'auth/user-not-found') message = 'No account found with this email.';
      if (code === 'auth/wrong-password') message = 'Incorrect password.';
      if (code === 'auth/too-many-requests') message = 'Too many attempts. Please wait a minute and try again.';
      setError(message);
      setLoading(false);
    }
  };

  const handleOtpVerified = async (verifiedPhone) => {
    setPhoneVerified(true);
    setShowOtpVerification(false);
    
    if (pendingUser) {
      setLoading(true);
      try {
        await completeLogin(pendingUser.user, pendingUser.userData);
      } catch (err) {
        setError(err?.message || 'Login failed after OTP verification');
        setLoading(false);
      }
    }
  };

  const completeLogin = async (user, userData) => {
    // Check for both 'role' and 'businessType' fields (some users have businessType)
    const rawRole = userData?.role || userData?.businessType || '';
    const role = String(rawRole).toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
    console.log("[Login] raw role:", rawRole, "normalized role:", role);
    console.log("[Login] Full user data:", userData);
    
    // More robust role detection
    console.log("[Login] Role detection - raw:", rawRole, "normalized:", role);
    
    // Direct navigation after successful login
    let targetPath = '/dashboard';
    if (role.includes('retailer')) {
      console.log("[Login] Redirecting to retailer dashboard");
      targetPath = '/dashboard';
    } else if (role.includes('distributor')) {
      console.log("[Login] Redirecting to distributor dashboard");
      targetPath = '/distributor-dashboard';
    } else if (role.includes('productowner') || role.includes('product-owner')) {
      console.log("[Login] Redirecting to product owner dashboard");
      targetPath = '/product-owner-dashboard';
    } else {
      console.warn("[Login] Unknown role:", rawRole, "normalized:", role, "defaulting to retailer dashboard");
      targetPath = '/dashboard';
    }
    
    // Try React Router navigation first
    navigate(targetPath, { replace: true });
    
    // Fallback for production: if navigation doesn't work, use window.location
    const isProduction = window.location.hostname !== 'localhost';
    if (isProduction) {
      setTimeout(() => {
        if (window.location.pathname === '/auth?type=login' || window.location.pathname === '/auth') {
          console.log("[Login] React Router navigation failed, using window.location fallback");
          window.location.href = targetPath;
        }
      }, 1000);
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
    setError('');
    setLoading(true);
    try {
      // Open popup immediately (no await before it) so the browser doesn't block it as not user-initiated
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await completeSocialLogin(result.user);
    } catch (error) {
      console.error('[Login] Google Sign-In Error:', error?.code, error?.message);
      setError(error?.message || 'Google sign-in failed. Try again or use email login.');
    } finally {
      setLoading(false);
    }
  };

  // Apple Guideline 4.8: Sign in with Apple as equivalent option when using third-party login (e.g. Google)
  // On iOS use native Sign in with Apple (Capacitor); on web/Android use popup
  const handleAppleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      if (platform === 'ios') {
        // Native Sign in with Apple (required for iOS app review; popup often fails in WebView)
        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
        const appleResponse = await SignInWithApple.authorize({ scopes: 'email name' });
        if (!appleResponse?.identityToken) {
          throw new Error('Apple Sign In did not return an identity token.');
        }
        const provider = new OAuthProvider('apple.com');
        const credentialOptions = { idToken: appleResponse.identityToken };
        if (appleResponse.nonce) credentialOptions.rawNonce = appleResponse.nonce;
        const credential = provider.credential(credentialOptions);
        const result = await signInWithCredential(auth, credential);
        const user = result.user;
        const ref = doc(db, 'businesses', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const displayName = user.displayName || user.email?.split('@')[0] || 'User';
          await setDoc(ref, {
            ownerName: displayName,
            email: user.email || '',
            photoURL: user.photoURL || '',
            role: 'Retailer',
            createdAt: new Date(),
            authProvider: 'apple',
            ownerId: user.uid,
          }, { merge: true });
        }
        await completeSocialLogin(user);
        return;
      }
      // Open popup immediately so the browser doesn't block it
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const ref = doc(db, 'businesses', user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        await setDoc(ref, {
          ownerName: displayName,
          email: user.email || '',
          photoURL: user.photoURL || '',
          role: 'Retailer',
          createdAt: new Date(),
          authProvider: 'apple',
          ownerId: user.uid,
        }, { merge: true });
      }
      await completeSocialLogin(user);
    } catch (error) {
      console.error('[Login] Apple Sign-In Error:', error?.code, error?.message);
      if (error?.code === 'auth/operation-not-allowed') {
        setError('Sign in with Apple is not enabled for this app. Please enable it in Firebase Console → Authentication → Sign-in method → Apple, then add your Apple Services ID, Team ID, Key ID and Private Key and Save.');
      } else {
        setError(error?.message || 'Sign in with Apple failed. Try again or use email login.');
      }
    } finally {
      setLoading(false);
    }
  };

  const completeSocialLogin = async (user) => {
    const ref = doc(db, 'businesses', user.uid);
    let snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        role: 'Retailer',
        createdAt: new Date(),
        authProvider: user.providerData?.[0]?.providerId || 'google',
        ownerId: user.uid,
      }, { merge: true });
      snap = await getDoc(ref);
    }
    const userData = snap.exists() ? snap.data() : null;
    const roleRaw = userData?.role || userData?.businessType || 'Retailer';
    const role = String(roleRaw).toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
    let targetPath = '/dashboard';
    if (role.includes('distributor')) targetPath = '/distributor-dashboard';
    else if (role.includes('productowner') || role.includes('product-owner')) targetPath = '/product-owner-dashboard';
    navigate(targetPath, { replace: true });
    const isProduction = window.location.hostname !== 'localhost';
    if (isProduction) {
      setTimeout(() => {
        if (window.location.pathname === '/auth?type=login' || window.location.pathname === '/auth') {
          window.location.href = targetPath;
        }
      }, 1000);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full relative overflow-hidden bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14]">
      <LoadBarKeyframes />
      {/* Aurora / brand glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-24 -left-24 w-[60vmax] h-[60vmax] rounded-full blur-3xl bg-gradient-to-tr from-emerald-500/40 via-teal-400/30 to-cyan-400/30" />
        <div className="absolute -bottom-24 -right-24 w-[50vmax] h-[50vmax] rounded-full blur-3xl bg-gradient-to-tr from-cyan-500/30 via-sky-400/20 to-emerald-400/30" />
      </div>

      {/* Centered glass card */}
      <div className="relative z-10 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-14 safe-top safe-bottom">
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] relative">
          {loading && (
            <div className="absolute left-0 top-0 h-1 w-full overflow-hidden rounded-t-3xl">
              <div className="h-full w-full animate-[loadbar_1.2s_ease-in-out_infinite] bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"></div>
            </div>
          )}
          <div className="px-4 sm:px-7 md:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 text-center">
            <div className="mx-auto mb-3 sm:mb-4 inline-flex items-center gap-3">
              <img 
                src="/assets/flyp_logo.png" 
                alt="FLYP" 
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
                onError={(e) => e.target.style.display = 'none'}
              />
              <span className="text-xs px-2 py-0.5 rounded-full border border-white/20 text-white/80">Sign In</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Welcome back</h2>
            <p className="mt-1 text-xs sm:text-sm text-white/70">Continue to your dashboard</p>
          </div>

          {error && (
            <div className="mx-4 sm:mx-7 md:mx-8 mb-3 text-rose-300 text-xs sm:text-sm bg-rose-900/30 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="px-4 sm:px-7 md:px-8 pb-2 space-y-3">
            {platform !== 'ios' && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 sm:py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 active:scale-[0.98] transition disabled:opacity-70 disabled:cursor-not-allowed min-h-[48px] touch-target"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                Sign in with Google
              </button>
            )}
            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 sm:py-3 rounded-xl bg-black text-white font-semibold hover:bg-gray-900 active:scale-[0.98] transition disabled:opacity-70 disabled:cursor-not-allowed min-h-[48px] touch-target border border-white/20"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Sign in with Apple
            </button>
          </div>
          <div className="flex items-center px-4 sm:px-7 md:px-8 pb-2">
            <div className="flex-1 h-px bg-white/20"></div>
            <span className="px-3 text-xs text-white/60">or</span>
            <div className="flex-1 h-px bg-white/20"></div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="px-4 sm:px-7 md:px-8 pb-6 sm:pb-8 space-y-4">
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
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-300/40 transition text-base sm:text-sm min-h-[48px]"
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
                className="w-full px-4 py-3.5 sm:py-3 rounded-xl bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-300/40 transition text-base sm:text-sm min-h-[48px]"
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
              className={`w-full py-4 sm:py-3 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition focus:outline-none focus:ring-2 focus:ring-emerald-400/60 active:scale-[.98] min-h-[52px] touch-target no-select ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
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

          <div className="px-4 sm:px-7 md:px-8 pb-4 sm:pb-6 text-right">
            <button
              onClick={async () => {
                try {
                  await logoutUser('all');
                  navigate('/');
                } catch (error) {
                  console.error('Error during sign out:', error);
                  navigate('/');
                }
              }}
              disabled={loading}
              className="text-xs text-red-300/90 hover:text-red-200 underline underline-offset-4 transition py-2 px-2 min-h-[44px] touch-target"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpVerification && userPhone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8">
              <button
                onClick={() => {
                  setShowOtpVerification(false);
                  setPhoneVerified(false);
                  setPendingUser(null);
                  auth.signOut();
                }}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <OTPVerification
                phone={userPhone}
                onVerified={handleOtpVerified}
                onError={(err) => {
                  setError(err?.message || 'OTP verification failed');
                }}
                onCancel={() => {
                  setShowOtpVerification(false);
                  setPhoneVerified(false);
                  setPendingUser(null);
                  auth.signOut();
                }}
                autoSend={true}
                themeColor="rgb(16, 185, 129)"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;