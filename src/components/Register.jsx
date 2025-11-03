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
  const glowRef = useRef(null);
  const mouseRAF = useRef(null);
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

  // Left pane hero bullets
  const hero = useMemo(() => ([
    { title: 'Fast Billing', text: 'Create invoices in seconds. Cash / Card / UPI supported.' },
    { title: 'Inventory Sync', text: 'OCR / AI onboarding, auto stock updates, low‑stock alerts.' },
    { title: 'Connect & Dispatch', text: 'Retailer ↔ Distributor orders, tracking, analytics.' },
  ]), []);
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
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Page background (single source of truth) */}
      <div className="absolute inset-0 -z-10">
        {/* base color */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14]" />
        {/* radial washes */}
        <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_15%_10%,rgba(16,185,129,0.10),transparent_60%)]" />
        <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_85%_90%,rgba(6,182,212,0.08),transparent_60%)]" />
        {/* vignette */}
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_100%)] bg-black/25 pointer-events-none" />
        {/* subtle noise */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22%20viewBox=%220%200%20160%20160%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.8%22%20numOctaves=%222%22/%3E%3C/filter%3E%3Crect%20width=%22160%22%20height=%22160%22%20filter=%22url(%23n)%22%20opacity=%220.6%22/%3E%3C/svg%3E')]" />
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-10 px-6 py-10 lg:py-20 relative">
        {/* LEFT: Informational panel (non-card, no box) */}
        <div className="hidden lg:block">
          <div className="max-w-xl pr-4">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 text-[11px] tracking-widest uppercase text-cyan-200/90">
              <Icon name="spark" /> Why FLYP for {roleName}
            </div>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white leading-tight">
              Register in seconds. Operate without clutter.
            </h2>
            <p className="mt-2 text-slate-300/95 text-sm leading-relaxed">
              The panel on the right is the <span className="font-semibold text-white">only registration form</span>. This left side is a quick overview to help you understand what you'll get after sign‑up.
            </p>

            {/* Key benefits as simple bullets (not boxed) */}
            <div className="mt-6 space-y-4">
              {hero.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
                  <div>
                    <div className="text-sm font-semibold text-white">{b.title}</div>
                    <div className="text-xs text-slate-300">{b.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick capability strips (plain text, no cards) */}
            <div className="mt-8 h-px w-full bg-white/10" />
            <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-slate-300">
              <div>
                <div className="font-semibold text-white">Billing</div>
                <div>Auto‑billing, UPI/Cash/Card, credit cycles.</div>
              </div>
              <div>
                <div className="font-semibold text-white">Inventory</div>
                <div>OCR/AI onboarding, low‑stock alerts.</div>
              </div>
              <div>
                <div className="font-semibold text-white">Connect</div>
                <div>Retailer ↔ Distributor, dispatch tracking.</div>
              </div>
            </div>

            <button onClick={scrollToForm} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-emerald-200 hover:text-white hover:bg-emerald-400/20 transition">
              Go to registration
              <Icon name="arrow-right" className="h-5 w-5" />
            </button>
            {/* Bottom action row: Back • Home • Sign In */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => navigate('/auth?type=register')}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-white/90 bg-white/5 border border-white/10 hover:bg-white/10"
              >
                <Icon name="arrow-left" className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg px-3 py-1.5 text-cyan-200 bg-white/5 border border-white/10 hover:bg-white/10"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => navigate('/auth?type=login')}
                className="rounded-lg px-3 py-1.5 text-emerald-200 bg-white/5 border border-white/10 hover:bg-white/10"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Register card (primary) */}
        <div className="flex items-center justify-center">
          <div onMouseMove={(e) => {
            if (!glowRef.current) return;
            const r = e.currentTarget.getBoundingClientRect();
            const xPct = ((e.clientX - r.left) / r.width) * 100;
            const yPct = ((e.clientY - r.top) / r.height) * 100;
            if (mouseRAF.current) cancelAnimationFrame(mouseRAF.current);
            mouseRAF.current = requestAnimationFrame(() => {
              glowRef.current.style.background = `radial-gradient(240px circle at ${xPct}% ${yPct}%, rgba(16,185,129,.18), transparent 60%)`;
            });
          }} className="w-full max-w-md relative">
            {/* Cursor‑reactive glow */}
            <div
              ref={glowRef}
              className="pointer-events-none absolute -inset-16 rounded-[32px] blur-3xl opacity-40 transition-opacity"
            />
            {/* Glow behind card */}
            <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-r from-emerald-400/25 via-teal-300/25 to-cyan-400/25 blur-2xl" />

            <div className="relative rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
              {/* Start here badge */}
              <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-900 bg-gradient-to-r from-emerald-300 to-cyan-300 shadow">
                Start here
              </div>

              {/* Header */}
              <div className="px-6 pt-6 text-center">
                <h1 className="text-2xl font-bold text-white">Create your FLYP account</h1>
                <p className="text-slate-300 mt-1 text-sm">30‑second signup. Finish the rest later in Profile Settings.</p>
              </div>

              {/* Role strip */}
              <div className="px-6 mt-5 flex items-center justify-between text-xs">
                <div className="text-slate-300">
                  Joining as{' '}
                  <span className="font-semibold text-white">{roleName}</span>
                  {/* Role selection UI: hide when coming from chooser */}
                  {cameFromChooser ? null : (
                    <select
                      name="role"
                      value={form.role || toCanonicalRole(role)}
                      onChange={onChange}
                      className="ml-2 px-2 py-1 rounded bg-slate-900/60 border border-white/20 text-emerald-200 text-xs"
                      style={{ minWidth: 110 }}
                    >
                      <option value="Retailer">Retailer</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Product Owner">Product Owner</option>
                    </select>
                  )}
                </div>
                <div className="px-2 py-1 rounded-md bg-slate-900/40 border border-white/10 text-emerald-300 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
                  <span>Protected by Firebase</span>
                </div>
              </div>

              {/* Google */}
              <div className="px-6 mt-4">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full mb-4 flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                  Continue with Google
                </button>
                <div className="flex items-center pb-2">
                  <div className="flex-1 h-px bg-white/20"></div>
                  <span className="px-3 text-xs text-white/60">or</span>
                  <div className="flex-1 h-px bg-white/20"></div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleEmailSignup} className="px-6 pb-6">
              {msg.error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-300 text-sm flex-1">{msg.error}</p>
                </div>
              )}
              {msg.success && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
                  <svg className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-emerald-300 text-sm flex-1">{msg.success}</p>
                </div>
              )}

              {/* Owner */}
              <label className="group relative block">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="user" /></span>
                <input
                  type="text"
                  name="ownerName"
                  placeholder="Owner name"
                  value={form.ownerName}
                  onChange={onChange}
                  required
                  className="peer w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-300/40 transition"
                />
              </label>

                {/* Phone */}
                <div className="mt-3">
                  <label className="block text-sm mb-1.5 text-slate-200 font-medium">Phone Number</label>
                  <div className={`flex items-center rounded-xl bg-white/10 text-white border transition-all ${
                    phoneStatus.error 
                      ? 'border-red-400/50 focus-within:ring-2 focus-within:ring-red-400/50 focus-within:border-red-400/70' 
                      : phoneStatus.validated
                      ? 'border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-400/50 focus-within:border-emerald-400/70'
                      : 'border-white/15 focus-within:ring-2 focus-within:ring-emerald-400/80 focus-within:border-emerald-300/40'
                  }`}>
                    <span className="pl-3 pr-2 text-slate-300/90 select-none font-medium">+91</span>
                    <div className="h-6 w-px bg-white/10" />
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
                      className="w-full bg-transparent px-3 py-3 outline-none placeholder-white/50 text-white"
                      aria-label="10-digit Indian mobile number"
                    />
                    {phoneStatus.checking && (
                      <div className="pr-3">
                        <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      </div>
                    )}
                    {phoneStatus.validated && !phoneStatus.checking && (
                      <div className="pr-3">
                        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <p className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                      phoneStatus.error ? 'text-red-300' : phoneStatus.validated ? 'text-emerald-300' : 'text-slate-300'
                    }`}>
                      {phoneStatus.checking && (
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      )}
                      {phoneStatus.validated && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {phoneStatus.error && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span>{phoneStatus.message}</span>
                    </p>
                  )}
                  {!phoneStatus.message && (
                    <p className="mt-1.5 text-xs text-slate-400">Enter a valid 10-digit Indian mobile number</p>
                  )}
                </div>

                {/* Email */}
                <div className="mt-3">
                  <label className="block text-sm mb-1.5 text-slate-200 font-medium">Email Address</label>
                  <div className={`relative flex items-center rounded-xl bg-white/10 text-white border transition-all ${
                    emailStatus.error 
                      ? 'border-red-400/50 focus-within:ring-2 focus-within:ring-red-400/50 focus-within:border-red-400/70' 
                      : emailStatus.validated
                      ? 'border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-400/50 focus-within:border-emerald-400/70'
                      : 'border-white/15 focus-within:ring-2 focus-within:ring-emerald-400/80 focus-within:border-emerald-300/40'
                  }`}>
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="mail" /></span>
                    <input
                      type="email"
                      name="email"
                      placeholder="your.email@example.com"
                      value={form.email}
                      onChange={onChange}
                      onBlur={handleEmailBlur}
                      required
                      className="w-full pl-11 pr-10 py-3 bg-transparent outline-none placeholder-white/50 text-white"
                    />
                    {emailStatus.checking && (
                      <div className="absolute right-3">
                        <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      </div>
                    )}
                    {emailStatus.validated && !emailStatus.checking && (
                      <div className="absolute right-3">
                        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <p className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                      emailStatus.error ? 'text-red-300' : emailStatus.validated ? 'text-emerald-300' : 'text-slate-300'
                    }`}>
                      {emailStatus.checking && (
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                      )}
                      {emailStatus.validated && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {emailStatus.error && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span>{emailStatus.message}</span>
                    </p>
                  )}
                </div>

              {/* Password */}
              <div className="mt-3">
                <label className="block text-sm mb-1.5 text-slate-200 font-medium">Password</label>
                <label className="group relative block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="lock" /></span>
                  <input
                    type="password"
                    name="password"
                    placeholder="Create a secure password"
                    value={form.password}
                    onChange={onChange}
                    required
                    minLength={6}
                    className="peer w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/50 outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-300/40 transition"
                  />
                </label>
                {form.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            passwordStrength.level <= 2 ? 'bg-red-400' : 
                            passwordStrength.level <= 4 ? 'bg-yellow-400' : 
                            'bg-emerald-400'
                          }`}
                          style={{ width: `${(passwordStrength.level / 6) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${passwordStrength.color}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {form.password.length < 6 ? 'Minimum 6 characters required' : 
                       passwordStrength.level <= 2 ? 'Consider adding uppercase, numbers, or symbols for better security' :
                       passwordStrength.level <= 4 ? 'Good! Add special characters for even stronger security' :
                       'Strong password ✓'}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="mt-3">
                <label className="block text-sm mb-1.5 text-slate-200 font-medium">Confirm Password</label>
                <label className={`group relative block ${form.confirmPassword && form.password !== form.confirmPassword ? 'error' : ''}`}>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="lock" /></span>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Re-enter your password"
                    value={form.confirmPassword}
                    onChange={onChange}
                    required
                    minLength={6}
                    className={`peer w-full pl-11 pr-10 py-3 rounded-xl bg-white/10 text-white border transition-all placeholder-white/50 outline-none focus:ring-2 focus:border-emerald-300/40 ${
                      form.confirmPassword && form.password !== form.confirmPassword
                        ? 'border-red-400/50 focus:ring-red-400/50'
                        : form.confirmPassword && form.password === form.confirmPassword
                        ? 'border-emerald-400/50 focus:ring-emerald-400/50'
                        : 'border-white/15 focus:ring-emerald-400/80'
                    }`}
                  />
                  {form.confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirmPassword ? (
                        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <p className="mt-1.5 text-xs text-red-300 flex items-center gap-1.5">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Passwords do not match
                  </p>
                )}
                {form.confirmPassword && form.password === form.confirmPassword && (
                  <p className="mt-1.5 text-xs text-emerald-300 flex items-center gap-1.5">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Passwords match
                  </p>
                )}
              </div>

                {/* GSTIN */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="gstin" className="text-slate-200 text-sm flex items-center gap-2"><Icon name="gst" /> GSTIN (optional)</label>
                    {form.gstin && (
                      <span className={`text-xs ${gstStatus.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                        {gstStatus.ok ? 'Looks valid' : gstStatus.reason}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="gst" /></span>
                    <input
                      id="gstin"
                      type="text"
                      name="gstin"
                      placeholder="E.g., 27ABCDE1234F1Z5"
                      value={form.gstin}
                      onChange={onChange}
                      className="w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-300/40 transition uppercase"
                    />
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-center gap-2 text-slate-300 text-sm mt-4">
                  <input
                    id="agree"
                    name="agree"
                    type="checkbox"
                    checked={form.agree}
                    onChange={onChange}
                    className="h-4 w-4 rounded border-white/20 bg-white/10"
                  />
                  <label className="text-sm text-gray-300">
                    I agree to the{" "}
                    <a
                      href="/terms.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-300 hover:text-blue-400"
                    >
                      Terms
                    </a>{" "}
                    and{" "}
                    <a
                      href="/privacy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-300 hover:text-blue-400"
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
                  className="mt-6 w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 py-3.5 font-semibold text-slate-900 shadow-lg transition [--shine:linear-gradient(120deg,transparent,rgba(255,255,255,.6),transparent)] hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:-translate-y-0.5 transition-transform active:scale-[.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        Creating your account...
                      </>
                    ) : (
                      'Create account'
                    )}
                  </span>
                  <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity [background-image:var(--shine)] bg-[length:250%_100%] bg-[position:-100%_0] hover:animate-[shine_1.6s_ease-in-out_infinite]" />
                </button>

                <div className="text-[11px] text-slate-400 mt-3">
                  Add business name, address, logo, and GST rates later in Profile Settings.
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>



      {/* keyframes for button shine + marquee */}
      <style>{`
        @keyframes shine{to{background-position:200% 0}}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .animate-marquee{display:inline-block;min-width:200%;animation:marquee 18s linear infinite}
      `}</style>
    </div>
  );
};

export default Register;