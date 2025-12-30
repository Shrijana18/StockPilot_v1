import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
// Icon helper component (hoisted)
function Icon({ name = '', className = 'h-4 w-4' }) {
  const common = { className, xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };
  switch (name) {
    case 'spark':
      return <svg {...common}><path d="M12 3l1.8 5.5L19 10l-5.2 1.5L12 17l-1.8-5.5L5 10l5.2-1.5L12 3z"/></svg>;
    case 'arrow-right':
      return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-left':
      return <svg {...common}><path d="M19 12H5m6 7l-7-7 7-7"/></svg>;
    case 'user':
      return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'mail':
      return <svg {...common}><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>;
    case 'lock':
      return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'gst':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/></svg>;
    case 'google':
      return <svg viewBox="0 0 48 48" className={className}><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12.9 12.9 0 0 1 11 24 13 13 0 1 0 37 33l6.6 5A21 21 0 1 1 45 24c0-1.2-.1-2.3-.4-3.5z"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
}
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  fetchSignInMethodsForEmail,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from "../firebase/firebaseConfig";

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');
const reservePhone = httpsCallable(functions, 'reservePhone');
const checkUniqueness = httpsCallable(functions, 'checkUniqueness');

// Generate FLYP ID
const genFlypId = () => `FLYP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

// GSTIN validator
function validateGSTIN(raw) {
  if (!raw) return { ok: true, reason: '' };
  const gst = raw.toUpperCase().trim();
  if (gst.length !== 15) return { ok: false, reason: 'GSTIN must be 15 characters' };
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/i.test(gst)) {
    return { ok: false, reason: 'Format looks invalid' };
  }
  return { ok: true, reason: '' };
}

// Phone helpers
const ONLY_DIGITS = /[^0-9]/g;
function sanitize10Digits(v = "") {
  return (v || "").replace(ONLY_DIGITS, "").slice(0, 10);
}
function toE164IN(tenDigit) {
  return tenDigit ? `+91${tenDigit}` : "";
}

// Role helpers
const normalizeRoleKey = (s = '') => String(s).toLowerCase().replace(/\s+/g, '');
const toCanonicalRole = (key = '') => {
  const k = normalizeRoleKey(key);
  if (k === 'distributor') return 'Distributor';
  if (k === 'productowner' || k === 'product owner') return 'Product Owner';
  return 'Retailer';
};

const Register = ({ role = 'retailer' }) => {
  const phoneInputRef = useRef(null);

  // URL role and derived labels
  const [form, setForm] = useState({
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    gstin: '',
    agree: false,
    role: '',
  });
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const roleParam = params.get('role') || '';
  const roleName = useMemo(() => toCanonicalRole(form.role || role), [form.role, role]);
  const cameFromChooser = Boolean(roleParam);

  // Role-specific color themes matching choose role page
  const roleTheme = useMemo(() => {
    const normalized = normalizeRoleKey(roleName);
    if (normalized === 'distributor') {
      return {
        primary: 'orange',
        secondary: 'amber',
        gradient: 'from-orange-500/20 to-amber-500/20',
        borderGradient: 'from-orange-400/50 to-amber-400/50',
        hoverGlow: 'group-hover:shadow-orange-500/20',
        textGradient: 'from-orange-400 via-amber-400 to-yellow-400',
        accent: 'orange-400',
        accentLight: 'orange-300',
        glow: 'orange-500/40',
        bgGradient: 'from-orange-500/10 via-amber-500/10 to-yellow-500/10',
        accentColor: 'rgb(251, 146, 60)', // orange-400
        accentLightColor: 'rgb(253, 186, 116)', // orange-300
        primaryColor: 'rgb(249, 115, 22)', // orange-500
        secondaryColor: 'rgb(245, 158, 11)', // amber-500
      };
    } else if (normalized === 'productowner') {
      return {
        primary: 'red',
        secondary: 'pink',
        gradient: 'from-red-500/20 to-pink-500/20',
        borderGradient: 'from-red-400/50 to-pink-400/50',
        hoverGlow: 'group-hover:shadow-red-500/20',
        textGradient: 'from-red-400 via-pink-400 to-rose-400',
        accent: 'red-400',
        accentLight: 'red-300',
        glow: 'red-500/40',
        bgGradient: 'from-red-500/10 via-pink-500/10 to-rose-500/10',
        accentColor: 'rgb(248, 113, 113)', // red-400
        accentLightColor: 'rgb(252, 165, 165)', // red-300
        primaryColor: 'rgb(239, 68, 68)', // red-500
        secondaryColor: 'rgb(236, 72, 153)', // pink-500
      };
    } else {
      // Retailer (default)
      return {
        primary: 'pink',
        secondary: 'rose',
        gradient: 'from-pink-500/20 to-rose-500/20',
        borderGradient: 'from-pink-400/50 to-rose-400/50',
        hoverGlow: 'group-hover:shadow-pink-500/20',
        textGradient: 'from-pink-400 via-rose-400 to-fuchsia-400',
        accent: 'pink-400',
        accentLight: 'pink-300',
        glow: 'pink-500/40',
        bgGradient: 'from-pink-500/10 via-rose-500/10 to-fuchsia-500/10',
        accentColor: 'rgb(244, 114, 182)', // pink-400
        accentLightColor: 'rgb(249, 168, 212)', // pink-300
        primaryColor: 'rgb(236, 72, 153)', // pink-500
        secondaryColor: 'rgb(244, 63, 94)', // rose-500
      };
    }
  }, [roleName]);

  // Role-specific content
  const roleContent = useMemo(() => {
    const normalized = normalizeRoleKey(roleName);
    if (normalized === 'distributor') {
      return {
        badge: 'Why FLYP for Distributors',
        title: 'Manage your supply chain with ease',
        subtitle: 'Connect with retailers, track orders, manage inventory, and handle credit cycles all in one place.',
        features: [
          { icon: '📦', title: 'Order Management', text: 'Receive and process retailer orders instantly. Track order status in real-time.' },
          { icon: '🚚', title: 'Dispatch & Delivery', text: 'Manage dispatches, track deliveries, and update order status automatically.' },
          { icon: '💰', title: 'Credit Management', text: 'Track credit limits, payment cycles, and outstanding balances for each retailer.' },
        ],
        capabilities: [
          { label: 'Orders', desc: 'Real-time order processing' },
          { label: 'Dispatch', desc: 'Track deliveries & status' },
          { label: 'Credit', desc: 'Manage credit cycles' },
        ]
      };
    } else if (normalized === 'productowner' || normalized === 'productowner') {
      return {
        badge: 'Why FLYP for Product Owners',
        title: 'Own your brand, track everything',
        subtitle: 'Monitor distributor performance, track sales, manage inventory across your network, and grow your brand.',
        features: [
          { icon: '📊', title: 'Performance Analytics', text: 'Track distributor performance, sales metrics, and market insights in real-time.' },
          { icon: '🌐', title: 'Network Management', text: 'Manage your distributor network, track inventory levels, and optimize supply chain.' },
          { icon: '📈', title: 'Growth Insights', text: 'Get detailed reports on sales trends, product performance, and market opportunities.' },
        ],
        capabilities: [
          { label: 'Analytics', desc: 'Performance tracking' },
          { label: 'Network', desc: 'Distributor management' },
          { label: 'Insights', desc: 'Sales & growth data' },
        ]
      };
    } else {
      // Retailer (default)
      return {
        badge: 'Why FLYP for Retailers',
        title: 'Sell smarter, grow faster',
        subtitle: 'Fast billing, smart inventory management, and seamless ordering from distributors. Everything you need to run your retail business.',
        features: [
          { icon: '⚡', title: 'Fast Billing', text: 'Create invoices in seconds. Cash / Card / UPI supported. Print or share digitally.' },
          { icon: '📱', title: 'Smart Inventory', text: 'OCR / AI onboarding, auto stock updates, low‑stock alerts, and smart reordering.' },
          { icon: '🛒', title: 'Easy Ordering', text: 'Order from distributors with one click. Track orders, manage credit, and streamline procurement.' },
        ],
        capabilities: [
          { label: 'Billing', desc: 'Fast invoicing & payments' },
          { label: 'Inventory', desc: 'OCR & AI onboarding' },
          { label: 'Orders', desc: 'Distributor ordering' },
        ]
      };
    }
  }, [roleName]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ error: '', success: '' });
  const [phoneStatus, setPhoneStatus] = useState({ validated: false, checking: false, message: '', error: false });
  const [emailStatus, setEmailStatus] = useState({ validated: false, checking: false, message: '', error: false });

  const navigate = useNavigate();

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    let v = type === 'checkbox' ? checked : value;
    if (name === 'phone') v = sanitize10Digits(v);
    setForm((p) => ({ ...p, [name]: v }));
  };

  // Phone + email uniqueness validation
  const validatePhoneUniqueness = useCallback(async (phoneValue) => {
    const ten = sanitize10Digits(phoneValue);
    if (ten.length !== 10) return false;
    setPhoneStatus({ validated: false, checking: true, message: 'Checking...', error: false });
    try {
      const result = await checkUniqueness({ phone: toE164IN(ten) });
      if (!result.data?.phone?.available) {
        setPhoneStatus({ validated: false, checking: false, message: 'Phone already registered.', error: true });
        return false;
      }
      setPhoneStatus({ validated: true, checking: false, message: '✓ Available', error: false });
      return true;
    } catch (e) {
      setPhoneStatus({ validated: false, checking: false, message: 'Unable to verify phone.', error: true });
      return false;
    }
  }, []);

  const validateEmailUniqueness = useCallback(async (emailValue) => {
    const email = emailValue.trim();
    if (!email.includes('@')) return false;
    setEmailStatus({ validated: false, checking: true, message: 'Checking...', error: false });
    try {
      const result = await checkUniqueness({ email: email.toLowerCase() });
      if (!result.data?.email?.available) {
        setEmailStatus({ validated: false, checking: false, message: 'Email already registered.', error: true });
        return false;
      }
      setEmailStatus({ validated: true, checking: false, message: '✓ Available', error: false });
      return true;
    } catch {
      setEmailStatus({ validated: false, checking: false, message: 'Unable to verify email.', error: true });
      return false;
    }
  }, []);

  // Blur handlers that call the server-side uniqueness checks
  const handlePhoneBlur = useCallback(() => {
    const ten = sanitize10Digits(form.phone);
    if (ten.length !== 10) {
      setPhoneStatus({ validated: false, checking: false, message: '', error: false });
      return false;
    }
    return validatePhoneUniqueness(ten);
  }, [form.phone, validatePhoneUniqueness]);

  const handleEmailBlur = useCallback(() => {
    const email = (form.email || '').trim();
    if (!email || !email.includes('@')) {
      setEmailStatus({ validated: false, checking: false, message: '', error: false });
      return false;
    }
    return validateEmailUniqueness(email);
  }, [form.email, validateEmailUniqueness]);

  // GST status derived from input
  const gstStatus = useMemo(() => validateGSTIN(form.gstin), [form.gstin]);

  // Naive password strength meter
  const passwordStrength = useMemo(() => {
    const pwd = form.password || '';
    let level = 0;
    if (pwd.length >= 6) level += 2;
    if (/[A-Z]/.test(pwd)) level += 1;
    if (/[a-z]/.test(pwd)) level += 1;
    if (/[0-9]/.test(pwd)) level += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) level += 1;
    const text =
      level <= 2 ? 'Weak' :
      level <= 4 ? 'Medium' : 'Strong';
    const color =
      level <= 2 ? 'text-red-300' :
      level <= 4 ? 'text-yellow-300' : 'text-emerald-300';
    return { level, text, color };
  }, [form.password]);

  // Scroll helper for the left panel CTA
  const scrollToForm = useCallback(() => {
    const formEl = document.querySelector('form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Build Firestore payload
  const buildPayload = (uid) => {
    const now = new Date().toISOString();
    const selectedRole = toCanonicalRole(form.role || role || 'Retailer');
    // Normalize email to lowercase for Firestore rules comparison
    const normalizedEmail = (form.email || '').trim().toLowerCase();
    const payload = {
      ownerId: uid,
      ownerName: (form.ownerName || '').trim(),
      name: (form.ownerName || '').trim(),
      email: normalizedEmail,
      phone: toE164IN(sanitize10Digits(form.phone)),
      gstNumber: (form.gstin || '').toUpperCase().trim(),
      role: selectedRole,
      businessType: selectedRole,
      flypId: genFlypId(),
      createdAt: now,
      lastUpdated: now,
      profileVersion: 1,
      whatsappAlerts: false,
      businessMode: 'Online',
      invoicePreference: 'Minimal',
      logoUrl: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
      zipcode: '',
    };
    return payload;
  };

  const ensureFreshToken = async (user) => {
    try {
      await user.getIdToken(true);
    } catch {}
  };

  const createBusinessDoc = async (user) => {
    let payload = null;
    let authEmail = null;
    try {
      // Ensure we have fresh auth token before creating document
      const token = await user.getIdToken(true);
      authEmail = (user.email || '').toLowerCase().trim();
      
      if (!authEmail) {
        throw new Error('User email not found in auth token');
      }
      
      payload = buildPayload(user.uid);
      
      // Verify email matches auth token (required by Firestore rules)
      // Both should be lowercase from normalization
      const payloadEmail = (payload.email || '').toLowerCase().trim();
      if (!payloadEmail) {
        throw new Error('Email missing in payload');
      }
      
      if (authEmail !== payloadEmail) {
        throw new Error(`Email mismatch: token has "${authEmail}" but payload has "${payloadEmail}"`);
      }
      
      await setDoc(doc(db, 'businesses', user.uid), payload, { merge: false });
    } catch (err) {
      // Only log critical errors
      if (err?.code === 'permission-denied') {
        console.error('[Register] Permission denied:', err?.message);
      } else {
        console.error('[Register] Document creation failed:', err?.message);
      }
      throw err;
    }
  };

  // Retry wrapper for document creation with token refresh
  const safeCreateBusinessDoc = async (user) => {
    try {
      await createBusinessDoc(user);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('permission') || msg.includes('Missing')) {
        // Retry once after refreshing token
        await new Promise(r => setTimeout(r, 1500));
        await ensureFreshToken(user);
        await createBusinessDoc(user);
        return;
      }
      throw err;
    }
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setMsg({ error: '', success: '' });

    if (sanitize10Digits(form.phone).length !== 10)
      return setMsg({ error: 'Enter valid 10-digit phone number', success: '' });
    if (!form.agree)
      return setMsg({ error: 'Accept Terms & Privacy to continue', success: '' });
    if (form.password !== form.confirmPassword)
      return setMsg({ error: 'Passwords do not match', success: '' });

    setLoading(true);
    try {
      // Create Auth account
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const userCred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      const user = userCred.user;
      await updateProfile(user, { displayName: (form.ownerName || '').trim() });

      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (current) => {
          if (current?.uid === user.uid) {
            unsub();
            resolve();
          }
        });
      });

      // Reserve phone server-side (REQUIRED - Firestore rules need this)
      const e164Phone = toE164IN(sanitize10Digits(form.phone));
      try {
        await reservePhone({ phone: e164Phone });
      } catch (e) {
        // Clean up auth account if phone reservation fails
        try { await user.delete(); } catch (_) {}
        try { await auth.signOut(); } catch (_) {}
        
        // Check for phone already exists error (could be in code, details, or message)
        const code = e?.code || '';
        const message = String(e?.message || '');
        const details = e?.details || {};
        
        // Firebase callable functions return 'already-exists' code for 409 conflicts
        if (code === 'already-exists' || 
            code === 'failed-precondition' ||
            message.toLowerCase().includes('already') ||
            message.toLowerCase().includes('reserved')) {
          return setMsg({ 
            error: 'Phone number already registered. Please sign in or use a different number.', 
            success: '' 
          });
        }
        
        return setMsg({ 
          error: `Could not reserve phone number: ${message || 'Please try again.'}`, 
          success: '' 
        });
      }

      // Wait for phoneIndex to propagate (Firestore rules need to see it)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create business document with retry logic
      await ensureFreshToken(user);
      
      let docCreated = false;
      try {
        await safeCreateBusinessDoc(user);
        docCreated = true;
      } catch (docErr) {
        // Retry once more
        try {
          await new Promise(r => setTimeout(r, 2000));
          await ensureFreshToken(user);
          await safeCreateBusinessDoc(user);
          docCreated = true;
        } catch (retryErr) {
          // Clean up auth account
          try { await user.delete(); } catch (_) {}
          try { await auth.signOut(); } catch (_) {}
          return setMsg({ 
            error: `Registration failed: Could not create profile. ${retryErr?.message || 'Please try again.'}`, 
            success: '' 
          });
        }
      }

      // Verify document was created
      let docSnap = null;
      let tries = 0;
      while (tries < 10) {
        docSnap = await getDoc(doc(db, "businesses", user.uid));
        if (docSnap.exists()) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
        tries++;
      }

      if (!docSnap || !docSnap.exists()) {
        // Clean up auth account
        try { await user.delete(); } catch (_) {}
        try { await auth.signOut(); } catch (_) {}
        return setMsg({ 
          error: 'Registration incomplete: Profile could not be created. Please try again.', 
          success: '' 
        });
      }

      const selectedRole = toCanonicalRole(form.role || role);
      const normalizedRole = selectedRole.toLowerCase();
      sessionStorage.setItem('postSignupRole', normalizedRole);

      // Show "Creating account..." message and navigate directly without page refresh
      setMsg({ success: 'Creating account...', error: '' });
      
      // Clear postSignupRole after a short delay to allow navigation
      setTimeout(() => {
        sessionStorage.removeItem('postSignupRole');
      }, 3000);
      
      // Navigate immediately without setTimeout to avoid landing page flash
      if (normalizedRole === 'retailer') {
        navigate('/dashboard', { replace: true });
      } else if (normalizedRole === 'distributor') {
        navigate('/distributor-dashboard', { replace: true });
      } else {
        navigate('/product-owner-dashboard', { replace: true });
      }
    } catch (err) {
      sessionStorage.removeItem('postSignupRole'); // Clean up on error
      setMsg({ error: err?.message || 'Signup failed.', success: '' });
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const dbRef = doc(db, 'businesses', user.uid);
      const snap = await getDoc(dbRef);
      const selectedRole = toCanonicalRole(form.role || role);

      await ensureFreshToken(user);
      if (!snap.exists()) {
        const now = new Date().toISOString();
        const phoneGoogle = (user.phoneNumber && user.phoneNumber.startsWith('+'))
          ? user.phoneNumber
          : toE164IN(sanitize10Digits(user.phoneNumber || ''));
        await setDoc(dbRef, {
          ownerId: user.uid,
          ownerName: user.displayName || '',
          name: user.displayName || '',
          email: (user.email || '').trim(),
          phone: phoneGoogle,
          gstNumber: '',
          role: selectedRole,
          businessType: selectedRole,
          flypId: genFlypId(),
          createdAt: now,
          lastUpdated: now,
          profileVersion: 1,
          whatsappAlerts: false,
          businessMode: 'Online',
          invoicePreference: 'Minimal',
          logoUrl: '',
          address: '',
          city: '',
          state: '',
          country: 'India',
          zipcode: ''
        }, { merge: false });
      }

      // Ensure Firestore document exists before redirect
      let tries = 0;
      let docSnap = null;
      while (tries < 10) {
        docSnap = await getDoc(doc(db, "businesses", user.uid));
        if (docSnap.exists()) break;
        await new Promise((r) => setTimeout(r, 500));
        tries++;
      }

      const normalizedRole = selectedRole.toLowerCase();
      sessionStorage.setItem('postSignupRole', normalizedRole);
      
      // Show "Creating account..." message and navigate directly
      setMsg({ success: 'Creating account...', error: '' });
      
      // Clear postSignupRole after a short delay to allow navigation
      setTimeout(() => {
        sessionStorage.removeItem('postSignupRole');
      }, 3000);
      
      if (docSnap && docSnap.exists()) {
        // Navigate immediately without setTimeout to avoid landing page flash
        if (normalizedRole === 'retailer') {
          navigate('/dashboard', { replace: true });
        } else if (normalizedRole === 'distributor') {
          navigate('/distributor-dashboard', { replace: true });
        } else {
          navigate('/product-owner-dashboard', { replace: true });
        }
      } else {
        setMsg({ error: 'Account setup incomplete. Please try again.', success: '' });
        sessionStorage.removeItem('postSignupRole');
        setLoading(false);
      }
    } catch (error) {
      setMsg({ error: error.message || 'Google sign-in failed.', success: '' });
      setLoading(false);
    }
  };

  useEffect(() => {
    const picked = normalizeRoleKey(roleParam);
    if (picked) setForm((p) => ({ ...p, role: toCanonicalRole(picked) }));
  }, [roleParam]);


  return (
    <div className="min-h-screen w-full h-screen relative overflow-hidden flex flex-col">
      {/* Enhanced Page background with animated gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a]" />
        <div className="absolute inset-0 [background:radial-gradient(ellipse_80%_50%_at_20%_20%,rgba(16,185,129,0.08),transparent_70%)] animate-pulse-slow" />
        <div className="absolute inset-0 [background:radial-gradient(ellipse_80%_50%_at_80%_80%,rgba(6,182,212,0.06),transparent_70%)] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 [background:radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.05),transparent_80%)]" />
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] bg-black/25 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22%20viewBox=%220%200%20160%20160%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.8%22%20numOctaves=%222%22/%3E%3C/filter%3E%3Crect%20width=%22160%22%20height=%22160%22%20filter=%22url(%23n)%22%20opacity=%220.6%22/%3E%3C/svg%3E')]" />
      </div>

      {/* Moving Branding Features - Floating Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-5">
        {/* Floating Icons */}
        <div className="absolute top-20 left-[10%] w-16 h-16 rounded-full bg-emerald-500/10 blur-xl animate-float" style={{ animationDelay: '0s', animationDuration: '6s' }} />
        <div className="absolute top-40 right-[15%] w-12 h-12 rounded-full bg-teal-500/10 blur-xl animate-float" style={{ animationDelay: '2s', animationDuration: '8s' }} />
        <div className="absolute bottom-32 left-[20%] w-20 h-20 rounded-full bg-cyan-500/10 blur-xl animate-float" style={{ animationDelay: '4s', animationDuration: '7s' }} />
        <div className="absolute top-60 right-[25%] w-14 h-14 rounded-full bg-emerald-500/10 blur-xl animate-float" style={{ animationDelay: '1s', animationDuration: '9s' }} />
        
        {/* Animated Particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-emerald-400/30 animate-pulse-slow" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 rounded-full bg-teal-400/30 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 rounded-full bg-cyan-400/30 animate-pulse-slow" style={{ animationDelay: '2.5s' }} />
      </div>

      {/* Top Navigation Bar - Role-themed */}
      <div className="relative z-50 w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (cameFromChooser) {
                navigate('/auth?type=register', { replace: true });
              } else {
                navigate('/');
              }
            }}
            className="group flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 backdrop-blur-sm"
            style={{
              backgroundColor: `${roleTheme.primaryColor}15`,
              borderColor: `${roleTheme.accentColor}30`,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${roleTheme.primaryColor}25`;
              e.currentTarget.style.borderColor = `${roleTheme.accentColor}50`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${roleTheme.primaryColor}15`;
              e.currentTarget.style.borderColor = `${roleTheme.accentColor}30`;
            }}
            aria-label="Go back"
          >
            <Icon name="arrow-left" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" style={{ color: roleTheme.accentLightColor }} />
            <span className="hidden sm:inline">{cameFromChooser ? 'Choose Role' : 'Home'}</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 backdrop-blur-sm"
            style={{
              backgroundColor: `${roleTheme.primaryColor}15`,
              borderColor: `${roleTheme.accentColor}30`,
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${roleTheme.primaryColor}25`;
              e.currentTarget.style.borderColor = `${roleTheme.accentColor}50`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${roleTheme.primaryColor}15`;
              e.currentTarget.style.borderColor = `${roleTheme.accentColor}30`;
            }}
            aria-label="Go to home"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: roleTheme.accentLightColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden sm:inline">Home</span>
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm" style={{
          backgroundColor: `${roleTheme.primaryColor}15`,
          borderColor: `${roleTheme.accentColor}30`,
          borderWidth: '1px',
          borderStyle: 'solid',
        }}>
          <img 
            src="/assets/flyp_logo.png" 
            alt="FLYP" 
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'inline';
            }}
          />
          <Icon name="spark" className="h-3 w-3" style={{ color: roleTheme.accentColor, display: 'none' }} />
        </div>
      </div>

      {/* Full-width container - perfectly fitted - NO max-width */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-0 relative overflow-y-auto overflow-x-hidden">
        {/* LEFT: Enhanced Branding Panel with Animations */}
        <div className="hidden lg:flex flex-col justify-start lg:justify-center px-6 lg:px-8 xl:px-10 py-6 lg:py-8 relative overflow-hidden min-h-full">
          {/* Animated background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/3 via-transparent to-transparent animate-gradient-shift" />
          
          <div className="relative z-10 w-full space-y-4 lg:space-y-5 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            {/* Enhanced Badge with role theme */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${roleTheme.gradient} border ${roleTheme.borderGradient} text-[11px] tracking-widest uppercase font-medium backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:scale-105 animate-bounce-subtle`} style={{ borderColor: `${roleTheme.accentColor}50`, color: roleTheme.accentLightColor }}>
              <Icon name="spark" className="h-3 w-3 animate-pulse" style={{ color: roleTheme.accentColor }} />
              {roleContent.badge}
            </div>
            
            {/* Headline with role-themed gradient */}
            <h1 className={`text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1] animate-fadeInUp bg-gradient-to-r ${roleTheme.textGradient} bg-clip-text text-transparent`} style={{ animationDelay: '0.3s' }}>
              {roleContent.title}
            </h1>
            
            {/* Subtitle */}
            <p className="text-sm lg:text-base text-slate-300/80 leading-relaxed animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
              {roleContent.subtitle}
            </p>

            {/* Additional Info Section with role theme */}
            <div className={`mt-4 p-4 rounded-xl bg-gradient-to-br ${roleTheme.gradient} backdrop-blur-sm animate-fadeInUp transition-all duration-300`} style={{ animationDelay: '0.45s', borderColor: `${roleTheme.accentColor}30`, borderWidth: '1px', borderStyle: 'solid' }}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${roleTheme.accentColor}20`, borderColor: `${roleTheme.accentColor}50`, borderWidth: '1px', borderStyle: 'solid' }}>
                  ⚡
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1" style={{ color: roleTheme.accentLightColor }}>Quick Setup</div>
                  <div className="text-xs text-slate-300/70 leading-relaxed">
                    Get started in 30 seconds. Complete your business profile anytime from Settings.
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Feature Cards with staggered animations */}
            <div className="mt-4 lg:mt-6 space-y-2.5 lg:space-y-3">
              {roleContent.features.map((feature, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-3 group/item p-3 rounded-lg border border-white/10 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] animate-fadeInUp"
                  style={{ 
                    animationDelay: `${0.5 + i * 0.1}s`,
                    background: `linear-gradient(to bottom right, ${roleTheme.primaryColor}33, ${roleTheme.secondaryColor}33)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${roleTheme.accentColor}50`;
                    e.currentTarget.style.boxShadow = `0 10px 15px -3px ${roleTheme.accentColor}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300 animate-float" style={{ animationDelay: `${i * 0.5}s`, animationDuration: '4s', backgroundColor: `${roleTheme.accentColor}15`, borderColor: `${roleTheme.accentColor}30`, borderWidth: '1px', borderStyle: 'solid' }}>
                    {feature.icon}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="text-sm font-semibold text-white mb-1 transition-colors duration-300 group-hover/item:" style={{ color: 'inherit' }} onMouseEnter={(e) => e.target.style.color = roleTheme.accentLightColor} onMouseLeave={(e) => e.target.style.color = 'white'}>{feature.title}</div>
                    <div className="text-xs text-slate-300/70 leading-relaxed group-hover/item:text-slate-200 transition-colors duration-300">{feature.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Enhanced Capabilities Grid with moving effects */}
            <div className="mt-4 lg:mt-6 pt-4 lg:pt-5 border-t border-white/5 animate-fadeInUp" style={{ animationDelay: '0.8s' }}>
              <div className="grid grid-cols-3 gap-3 lg:gap-4">
                {roleContent.capabilities.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="text-center p-2 rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                    style={{ animationDelay: `${0.9 + idx * 0.1}s` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(to bottom right, ${roleTheme.primaryColor}33, ${roleTheme.secondaryColor}33)`;
                      e.currentTarget.style.boxShadow = `0 10px 15px -3px ${roleTheme.accentColor}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="text-xs font-semibold text-white mb-1 transition-colors duration-300" onMouseEnter={(e) => e.target.style.color = roleTheme.accentLightColor} onMouseLeave={(e) => e.target.style.color = 'white'}>{item.label}</div>
                    <div className="text-[10px] text-slate-400/70 leading-relaxed group-hover:text-slate-300 transition-colors duration-300">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Additional Stats/Info Section with role theme */}
            <div className={`mt-4 lg:mt-6 p-3 lg:p-4 rounded-xl bg-gradient-to-br ${roleTheme.bgGradient} backdrop-blur-sm animate-fadeInUp transition-all duration-300`} style={{ animationDelay: '1s', borderColor: `${roleTheme.accentColor}30`, borderWidth: '1px', borderStyle: 'solid' }}>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-lg lg:text-xl font-bold" style={{ color: roleTheme.accentColor }}>30s</div>
                  <div className="text-[10px] text-slate-400">Quick Setup</div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="text-center flex-1">
                  <div className="text-lg lg:text-xl font-bold" style={{ color: roleTheme.accentColor }}>100%</div>
                  <div className="text-[10px] text-slate-400">Secure</div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="text-center flex-1">
                  <div className="text-lg lg:text-xl font-bold" style={{ color: roleTheme.accentColor }}>24/7</div>
                  <div className="text-[10px] text-slate-400">Support</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Enhanced Register Card with Perfect Fit - No Centering to Prevent Overlap */}
        <div className="flex items-start lg:items-center justify-center w-full px-4 sm:px-5 lg:px-6 xl:px-8 py-4 lg:py-6 overflow-y-auto">
          <div 
            className="w-full max-w-lg relative animate-fadeInUp my-auto"
            style={{ animationDelay: '0.3s' }}
          >
            {/* Subtle role-themed border glow - much reduced */}
            <div 
              className="absolute -inset-[1px] rounded-3xl pointer-events-none transition-opacity duration-500"
              style={{
                background: `linear-gradient(135deg, ${roleTheme.accentColor}20, ${roleTheme.secondaryColor}20)`,
                opacity: 0.3,
                filter: 'blur(8px)',
              }}
            />

            <div 
              className="relative rounded-3xl backdrop-blur-2xl shadow-2xl overflow-hidden transition-all duration-300"
              style={{
                borderColor: `${roleTheme.accentColor}30`,
                borderWidth: '1px',
                borderStyle: 'solid',
                background: `linear-gradient(to bottom right, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${roleTheme.accentColor}50`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${roleTheme.accentColor}30`;
              }}
            >
              {/* Subtle role-themed gradient overlay - very light */}
              <div 
                className="absolute inset-0 pointer-events-none rounded-3xl"
                style={{
                  background: `linear-gradient(to bottom right, ${roleTheme.primaryColor}08, ${roleTheme.secondaryColor}08)`,
                }}
              />
              
              {/* Enhanced Start here badge with role theme - positioned cleanly */}
              <div 
                className="absolute top-4 left-6 px-3 py-1 rounded-full text-[10px] font-semibold shadow-lg hover:scale-105 transition-transform duration-200 z-20"
                style={{
                  backgroundColor: roleTheme.accentLightColor,
                  color: '#0a0e1a',
                  borderColor: roleTheme.accentColor,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                ✨ Start here
              </div>

              {/* Enhanced Header with role theme */}
              <div className="px-5 sm:px-6 pt-7 sm:pt-8 pb-3 sm:pb-4 text-center relative z-10 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                <div className="flex items-center justify-center gap-4 mb-2">
                  <img 
                    src="/assets/flyp_logo.png" 
                    alt="FLYP" 
                    className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 object-contain"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  <h1 className={`text-xl lg:text-2xl font-bold bg-gradient-to-r ${roleTheme.textGradient} bg-clip-text text-transparent`}>
                    Create your account
                  </h1>
                </div>
                <p className="text-slate-300/70 text-xs leading-relaxed">
                  30‑second signup. Finish the rest later in Profile Settings.
                </p>
              </div>

              {/* Enhanced Role strip */}
              <div className="px-5 sm:px-6 mt-1 mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs relative z-10 animate-fadeInUp" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-xs">Joining as</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-semibold text-xs">
                    {roleName}
                  </span>
                  {/* Role selection UI: hide when coming from chooser */}
                  {cameFromChooser ? null : (
                    <select
                      name="role"
                      value={form.role || toCanonicalRole(role)}
                      onChange={onChange}
                      className="ml-1.5 px-2 py-0.5 rounded bg-slate-900/40 border border-white/10 text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-white/20"
                      style={{ minWidth: 110 }}
                    >
                      <option value="Retailer">Retailer</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Product Owner">Product Owner</option>
                    </select>
                  )}
                </div>
                <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1.5 text-[10px] font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                  <span>Protected</span>
                </div>
              </div>

              {/* Enhanced Google Sign-in with animation */}
              <div className="px-5 sm:px-6 mt-1 relative z-10 animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full mb-4 flex items-center justify-center gap-2.5 py-3 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-50 hover:shadow-lg hover:shadow-white/20 active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed min-h-[44px] touch-target border border-white/10 text-sm hover:scale-[1.02]"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" />
                  Continue with Google
                </button>
                <div className="flex items-center pb-3">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-white/10"></div>
                  <span className="px-3 text-[11px] text-white/50 font-medium">or</span>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/10 to-white/10"></div>
                </div>
              </div>

              {/* Enhanced Form with animations */}
              <form onSubmit={handleEmailSignup} className="px-5 sm:px-6 pb-5 sm:pb-6 relative z-10 space-y-3 animate-fadeInUp" style={{ animationDelay: '0.7s' }}>
              {msg.error && (
                <div className="mb-3 p-3 rounded-lg bg-red-500/10 border-2 border-red-500/40 flex items-start gap-2 backdrop-blur-sm animate-shake hover:bg-red-500/15 transition-colors duration-200">
                  <svg className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-xs flex-1 font-medium leading-relaxed">{msg.error}</p>
                </div>
              )}
              {msg.success && (
                <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/40 flex items-start gap-2 backdrop-blur-sm animate-fadeInUp">
                  <svg className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-emerald-300 text-xs flex-1 font-medium leading-relaxed">{msg.success}</p>
                </div>
              )}

              {/* Compact Grid Layout for Name and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Compact Owner Name Field */}
                <div>
                  <label className="block text-xs mb-1.5 text-slate-200 font-semibold">Owner Name</label>
                  <label className="group relative block">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80 transition-colors" style={{ color: 'inherit' }}>
                      <Icon name="user" className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      name="ownerName"
                      placeholder="Full name"
                      value={form.ownerName}
                      onChange={onChange}
                      required
                      autoComplete="name"
                      className="peer w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/10 text-white text-sm border-2 border-white/15 placeholder-white/50 outline-none focus:ring-2 transition-all duration-300 min-h-[42px] backdrop-blur-sm hover:bg-white/15"
                      onFocus={(e) => {
                        e.target.style.borderColor = roleTheme.accentColor;
                        e.target.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}60`;
                        e.target.parentElement.querySelector('span').style.color = roleTheme.accentColor;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.target.style.boxShadow = 'none';
                        e.target.parentElement.querySelector('span').style.color = 'rgba(203, 213, 225, 0.8)';
                      }}
                      onMouseEnter={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = `${roleTheme.accentColor}50`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Compact Phone Field */}
                <div>
                  <label className="block text-xs mb-1.5 text-slate-200 font-semibold">Phone Number</label>
                  <div 
                    className="flex items-center rounded-lg bg-white/10 text-white border-2 transition-all min-h-[42px] backdrop-blur-sm"
                    style={{
                      borderColor: phoneStatus.error 
                        ? 'rgba(248, 113, 113, 0.6)' 
                      : phoneStatus.validated
                        ? `${roleTheme.accentColor}99`
                        : 'rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    <span className="pl-3 pr-2 text-slate-300/90 select-none font-bold text-sm border-r border-white/10">+91</span>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      name="phone"
                      placeholder="9876543210"
                      value={form.phone}
                      onChange={onChange}
                      onBlur={handlePhoneBlur}
                      required
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      autoComplete="tel-national"
                      className="w-full bg-transparent px-3 py-2.5 outline-none placeholder-white/50 text-white text-sm flex-1"
                      aria-label="10-digit Indian mobile number"
                      onFocus={(e) => {
                        e.target.parentElement.style.borderColor = roleTheme.accentColor;
                        e.target.parentElement.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}60`;
                      }}
                      onBlur={(e) => {
                        e.target.parentElement.style.boxShadow = 'none';
                        handlePhoneBlur();
                      }}
                    />
                    {phoneStatus.checking && (
                      <div className="pr-3">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: roleTheme.accentColor }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      </div>
                    )}
                    {phoneStatus.validated && !phoneStatus.checking && (
                      <div className="pr-3">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: roleTheme.accentColor }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {phoneStatus.error && !phoneStatus.checking && (
                      <div className="pr-3">
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                    {phoneStatus.message && (
                      <p className="mt-1 text-[10px] flex items-center gap-1" style={{
                        color: phoneStatus.error ? 'rgb(252, 165, 165)' : phoneStatus.validated ? roleTheme.accentLightColor : 'rgb(203, 213, 225)'
                      }}>
                        {phoneStatus.checking && (
                          <svg className="animate-spin h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                        )}
                        {phoneStatus.validated && (
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {phoneStatus.error && (
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span>{phoneStatus.message}</span>
                      </p>
                    )}
                    {!phoneStatus.message && (
                      <p className="mt-1 text-[10px] text-slate-400">10-digit mobile number</p>
                    )}
                </div>
              </div>

              {/* Compact Grid Layout for Email and Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Compact Email Field */}
                <div>
                  <label className="block text-xs mb-1.5 text-slate-200 font-semibold">Email Address</label>
                  <div 
                    className="relative flex items-center rounded-lg bg-white/10 text-white border-2 transition-all min-h-[42px] backdrop-blur-sm"
                    style={{
                      borderColor: emailStatus.error 
                        ? 'rgba(248, 113, 113, 0.6)' 
                      : emailStatus.validated
                        ? `${roleTheme.accentColor}99`
                        : 'rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80 transition-colors" style={{ color: 'inherit' }}>
                      <Icon name="mail" className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      name="email"
                      placeholder="your.email@example.com"
                      value={form.email}
                      onChange={onChange}
                      onBlur={handleEmailBlur}
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-10 py-2.5 bg-transparent outline-none placeholder-white/50 text-white text-sm hover:bg-white/5 transition-colors duration-300"
                      onFocus={(e) => {
                        e.target.parentElement.querySelector('span').style.color = roleTheme.accentColor;
                      }}
                      onBlur={(e) => {
                        e.target.parentElement.querySelector('span').style.color = 'rgba(203, 213, 225, 0.8)';
                        handleEmailBlur();
                      }}
                    />
                    {emailStatus.checking && (
                      <div className="absolute right-3">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: roleTheme.accentColor }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      </div>
                    )}
                    {emailStatus.validated && !emailStatus.checking && (
                      <div className="absolute right-3">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: roleTheme.accentColor }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {emailStatus.error && !emailStatus.checking && (
                      <div className="absolute right-3">
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {emailStatus.message && (
                    <p className="mt-1 text-[10px] flex items-center gap-1" style={{
                      color: emailStatus.error ? 'rgb(252, 165, 165)' : emailStatus.validated ? roleTheme.accentLightColor : 'rgb(203, 213, 225)'
                    }}>
                      {emailStatus.checking && (
                        <svg className="animate-spin h-2.5 w-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      )}
                      {emailStatus.validated && (
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {emailStatus.error && (
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span>{emailStatus.message}</span>
                    </p>
                  )}
                </div>

                {/* Compact Password Field */}
                <div>
                  <label className="block text-xs mb-1.5 text-slate-200 font-semibold">Password</label>
                  <label className="group relative block">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80 transition-colors" style={{ color: 'inherit' }}>
                      <Icon name="lock" className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      name="password"
                      placeholder="Create password"
                      value={form.password}
                      onChange={onChange}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="peer w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/10 text-white border-2 border-white/15 placeholder-white/50 outline-none focus:ring-2 transition-all duration-300 text-sm min-h-[42px] backdrop-blur-sm hover:bg-white/15"
                      onFocus={(e) => {
                        e.target.style.borderColor = roleTheme.accentColor;
                        e.target.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}60`;
                        e.target.parentElement.querySelector('span').style.color = roleTheme.accentColor;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.target.style.boxShadow = 'none';
                        e.target.parentElement.querySelector('span').style.color = 'rgba(203, 213, 225, 0.8)';
                      }}
                      onMouseEnter={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = `${roleTheme.accentColor}50`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        }
                      }}
                    />
                  </label>
                  {form.password && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              passwordStrength.level <= 2 ? 'bg-red-400' : 
                              passwordStrength.level <= 4 ? 'bg-yellow-400' : 
                              'bg-emerald-400'
                            }`}
                            style={{ width: `${(passwordStrength.level / 6) * 100}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${passwordStrength.color}`}>
                          {passwordStrength.text}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Compact Confirm Password Field */}
              <div>
                <label className="block text-xs mb-1.5 text-slate-200 font-semibold">Confirm Password</label>
                <label className={`group relative block ${form.confirmPassword && form.password !== form.confirmPassword ? 'error' : ''}`}>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80 transition-colors" style={{ color: 'inherit' }}>
                      <Icon name="lock" className="h-4 w-4" />
                    </span>
                    <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={onChange}
                    required
                    minLength={6}
                    autoComplete="new-password"
                      className="peer w-full pl-10 pr-10 py-2.5 rounded-lg bg-white/10 text-white border-2 transition-all duration-300 placeholder-white/50 outline-none focus:ring-2 text-sm min-h-[42px] backdrop-blur-sm hover:bg-white/15"
                      style={{
                        borderColor: form.confirmPassword && form.password !== form.confirmPassword
                          ? 'rgba(248, 113, 113, 0.6)'
                          : form.confirmPassword && form.password === form.confirmPassword
                          ? `${roleTheme.accentColor}99`
                          : 'rgba(255, 255, 255, 0.15)'
                      }}
                      onFocus={(e) => {
                        if (form.confirmPassword && form.password === form.confirmPassword) {
                          e.target.style.borderColor = roleTheme.accentColor;
                          e.target.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}60`;
                          e.target.parentElement.querySelector('span').style.color = roleTheme.accentColor;
                        } else if (form.confirmPassword && form.password !== form.confirmPassword) {
                          e.target.style.borderColor = 'rgba(248, 113, 113, 0.8)';
                          e.target.style.boxShadow = '0 0 0 2px rgba(248, 113, 113, 0.5)';
                        } else {
                          e.target.style.borderColor = roleTheme.accentColor;
                          e.target.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}60`;
                          e.target.parentElement.querySelector('span').style.color = roleTheme.accentColor;
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.boxShadow = 'none';
                        e.target.parentElement.querySelector('span').style.color = 'rgba(203, 213, 225, 0.8)';
                      }}
                    />
                  {form.confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirmPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: roleTheme.accentColor }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                  )}
                </label>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="mt-1 text-[10px] text-red-300 flex items-center gap-1">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Passwords do not match
                  </p>
                )}
                {form.confirmPassword && form.password === form.confirmPassword && (
                  <p className="mt-1 text-[10px] flex items-center gap-1" style={{ color: roleTheme.accentLightColor }}>
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Passwords match
                  </p>
                )}
              </div>

                {/* Compact GSTIN Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label htmlFor="gstin" className="text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                      <Icon name="gst" className="h-4 w-4" /> 
                      GSTIN <span className="text-[10px] font-normal text-slate-400">(optional)</span>
                    </label>
                    {form.gstin && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gstStatus.ok ? 'text-emerald-300 bg-emerald-500/10' : 'text-red-300 bg-red-500/10'}`}>
                        {gstStatus.ok ? '✓ Valid' : gstStatus.reason}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80">
                      <Icon name="gst" className="h-4 w-4" />
                    </span>
                    <input
                      id="gstin"
                      type="text"
                      name="gstin"
                      placeholder="E.g., 27ABCDE1234F1Z5"
                      value={form.gstin}
                      onChange={onChange}
                      autoComplete="off"
                      className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/10 text-white border-2 border-white/15 placeholder-white/60 outline-none focus:ring-2 transition-all duration-300 uppercase text-sm min-h-[42px] backdrop-blur-sm hover:bg-white/15"
                      onFocus={(e) => {
                        e.target.style.borderColor = roleTheme.accentColor;
                        e.target.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}60`;
                        e.target.parentElement.querySelector('span').style.color = roleTheme.accentColor;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.target.style.boxShadow = 'none';
                        e.target.parentElement.querySelector('span').style.color = 'rgba(203, 213, 225, 0.8)';
                      }}
                      onMouseEnter={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = `${roleTheme.accentColor}50`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Compact Terms Checkbox */}
                <div className="flex items-start gap-2 text-slate-300 pt-1">
                  <input
                    id="agree"
                    name="agree"
                    type="checkbox"
                    checked={form.agree}
                    onChange={onChange}
                    className="mt-0.5 h-4 w-4 rounded border-2 border-white/30 bg-white/10 focus:ring-2 transition-all cursor-pointer"
                    style={{
                      accentColor: roleTheme.primaryColor,
                    }}
                    onFocus={(e) => {
                      e.target.style.boxShadow = `0 0 0 2px ${roleTheme.accentColor}50`;
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <label htmlFor="agree" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                    I agree to the{" "}
                    <a
                      href="/terms.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-cyan-300 hover:text-cyan-200 font-medium transition-colors"
                    >
                      Terms
                    </a>{" "}
                    and{" "}
                    <a
                      href="/privacy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-cyan-300 hover:text-cyan-200 font-medium transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={
                    loading || 
                    sanitize10Digits(form.phone).length !== 10 || 
                    !phoneStatus.validated || 
                    phoneStatus.checking || 
                    phoneStatus.error ||
                    !emailStatus.validated ||
                    emailStatus.checking ||
                    emailStatus.error ||
                    form.password !== form.confirmPassword ||
                    form.password.length < 6
                  }
                  className="mt-4 w-full relative overflow-hidden rounded-lg py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 min-h-[48px] touch-target no-select group"
                  style={{ 
                    background: `linear-gradient(to right, ${roleTheme.primaryColor}, ${roleTheme.secondaryColor})`,
                    boxShadow: `0 10px 15px -3px ${roleTheme.accentColor}30, 0 4px 6px -2px ${roleTheme.accentColor}20`
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 text-sm">
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create account
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] bg-[position:-100%_0] group-hover:animate-[shine_1.6s_ease-in-out_infinite]" />
                </button>

                <div className="text-[10px] text-slate-400/60 mt-3 text-center leading-relaxed">
                  Add business details later in Profile Settings.
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced keyframes for all animations */}
      <style>{`
        @keyframes shine{
          0%{background-position:-100% 0}
          100%{background-position:200% 0}
        }
        @keyframes marquee{
          0%{transform:translateX(0)}
          100%{transform:translateX(-50%)}
        }
        @keyframes shake{
          10%,90%{transform:translate3d(-1px,0,0)}
          20%,80%{transform:translate3d(2px,0,0)}
          30%,50%,70%{transform:translate3d(-2px,0,0)}
          40%,60%{transform:translate3d(2px,0,0)}
        }
        @keyframes slideInFromRight{
          from{opacity:0;transform:translateX(40px)}
          to{opacity:1;transform:translateX(0)}
        }
        @keyframes slideInFromLeft{
          from{opacity:0;transform:translateX(-40px)}
          to{opacity:1;transform:translateX(0)}
        }
        @keyframes fadeInUp{
          from{opacity:0;transform:translateY(20px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes float{
          0%,100%{transform:translateY(0px) translateX(0px)}
          25%{transform:translateY(-8px) translateX(4px)}
          50%{transform:translateY(-12px) translateX(0px)}
          75%{transform:translateY(-8px) translateX(-4px)}
        }
        @keyframes pulse-slow{
          0%,100%{opacity:1}
          50%{opacity:0.8}
        }
        @keyframes spin-slow{
          from{transform:rotate(0deg)}
          to{transform:rotate(360deg)}
        }
        @keyframes bounce-subtle{
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-4px)}
        }
        @keyframes gradient-shift{
          0%{background-position:0% 50%}
          50%{background-position:100% 50%}
          100%{background-position:0% 50%}
        }
        .animate-marquee{
          display:inline-block;
          min-width:200%;
          animation:marquee 18s linear infinite
        }
        .animate-shake{
          animation:shake 0.5s cubic-bezier(.36,.07,.19,.97) both
        }
        .animate-slideInFromRight{
          animation:slideInFromRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards
        }
        .animate-slideInFromLeft{
          animation:slideInFromLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards
        }
        .animate-fadeInUp{
          animation:fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity:0
        }
        .animate-float{
          animation:float 3s ease-in-out infinite
        }
        .animate-pulse-slow{
          animation:pulse-slow 4s ease-in-out infinite
        }
        .animate-spin-slow{
          animation:spin-slow 8s linear infinite
        }
        .animate-bounce-subtle{
          animation:bounce-subtle 2s ease-in-out infinite
        }
        .animate-gradient-shift{
          background-size:200% 200%;
          animation:gradient-shift 8s ease infinite
        }
      `}</style>
    </div>
  );
};

export default Register;