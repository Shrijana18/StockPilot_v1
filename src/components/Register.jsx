import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, GoogleAuthProvider, signInWithPopup, sendEmailVerification, linkWithCredential, EmailAuthProvider, updateProfile, fetchSignInMethodsForEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { app } from "../firebase/firebaseConfig";
import ReactDOM from 'react-dom';

const auth = getAuth(app);
// ---- Local debug helper (optional): bypass app verification on localhost ----
// Disabled by default. To enable for test numbers only, set VITE_BYPASS_PHONE_RECAPTCHA=true in your .env.
try {
  if (
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    import.meta.env?.VITE_BYPASS_PHONE_RECAPTCHA === 'true'
  ) {
    // This disables the reCAPTCHA requirement for testing WITH TEST PHONE NUMBERS ONLY.
    // DO NOT enable when sending real OTPs; the server will reject with MALFORMED token.
    // @ts-ignore
    auth.settings.appVerificationDisabledForTesting = true;
    console.info('[Auth] appVerificationDisabledForTesting enabled on localhost via env flag');
  }
} catch (e) {
  // ignore if settings is undefined in older SDKs
}
const db = getFirestore(app);



// Generate human-friendly FLYP ID like FLYP-ABCDE
const genFlypId = () => `FLYP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

// --- Minimal GSTIN validator (optional field). Accept empty. If present, quick pattern + length check.
function validateGSTIN(raw) {
  if (!raw) return { ok: true, reason: '' };
  const gst = raw.toUpperCase().trim();
  if (gst.length !== 15) return { ok: false, reason: 'GSTIN must be 15 characters' };
  // Basic shape: 2 digits + 10 PAN chars + 1 entity + 'Z' + 1 check
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/i.test(gst)) {
    return { ok: false, reason: 'Format looks invalid' };
  }
  return { ok: true, reason: '' };
}

// --- Phone helpers (India) ---
const ONLY_DIGITS = /[^0-9]/g;
function sanitize10Digits(v = "") {
  return (v || "").replace(ONLY_DIGITS, "").slice(0, 10);
}
function toE164IN(tenDigit) {
  return tenDigit ? `+91${tenDigit}` : "";
}

const Icon = ({ name, className = "" }) => {
  // tiny inline icon set (no deps)
  const common = "h-5 w-5";
  if (name === 'user') {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (name === 'mail') {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h16v16H4z" stroke="currentColor" fill="none"/>
        <path d="M22 6l-10 7L2 6" />
      </svg>
    );
  }
  if (name === 'lock') {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="11" width="18" height="10" rx="2"/>
        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      </svg>
    );
  }
  if (name === 'gst') {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    );
  }
  if (name === 'spark') {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M5 19l3.5-3.5M15.5 8.5L19 5"/>
      </svg>
    );
  }
  if (name === 'google') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={`${className}`} aria-hidden>
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.156,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,14,24,14c3.059,0,5.842,1.156,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.793,2.238-2.231,4.166-4.093,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C35.271,39.205,44,33.5,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
      </svg>
    );
  }
  if (name === 'arrow-right') {
    return (
      <svg className={`${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 12h14" />
        <path d="M13 5l7 7-7 7" />
      </svg>
    );
  }
  return null;
};

const Register = ({ role = 'retailer' }) => {
  // Minimal, fast onboarding
  const [form, setForm] = useState({
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    gstin: '',
    agree: false,
    role: '', // Add role to form state for dynamic selection
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ error: '', success: '' });
  // GPU-safe glow without React re-renders (prevents FirebaseUI unmount)
  const glowRef = useRef(null);
  const mouseRAF = useRef(null);
  const navigate = useNavigate();
  const onMouseMove = (e) => {
    if (!glowRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    if (mouseRAF.current) cancelAnimationFrame(mouseRAF.current);
    mouseRAF.current = requestAnimationFrame(() => {
      glowRef.current.style.background = `radial-gradient(240px circle at ${xPct}% ${yPct}%, rgba(56,189,248,.20), transparent 60%)`;
    });
  };


  const formRef = useRef(null);





  const gstStatus = useMemo(() => validateGSTIN(form.gstin), [form.gstin]);

  const onChange = (e) =>
    setForm((p) => {
      const { name, type, value, checked } = e.target;
      let v = type === 'checkbox' ? checked : value;
      if (name === 'phone') v = sanitize10Digits(v);
      return { ...p, [name]: v };
    });



  const buildPayload = (userId) => {
    const nowIso = new Date().toISOString();
    // Use selected role from form, fallback to prop, fallback to "Retailer"
    const selectedRole = (form.role || role || "Retailer").charAt(0).toUpperCase() + (form.role || role || "Retailer").slice(1);
    const e164Phone = toE164IN(sanitize10Digits(form.phone));
    return {
      // Identity
      ownerId: userId,
      name: (form.ownerName || '').trim(),
      ownerName: (form.ownerName || '').trim(),

      // Contact
      email: (form.email || '').trim(),
      phone: e164Phone,
      whatsappAlerts: false,

      // Business meta (defaults — user completes later in Profile Settings)
      role: selectedRole,
      businessType: selectedRole,
      businessName: '',
      businessMode: 'Online',
      invoicePreference: 'Minimal',

      // Address (kept blank at signup)
      address: '',
      city: '',
      state: '',
      country: 'India',
      zipcode: '',

      // GST & Branding
      gstNumber: (form.gstin || '').toUpperCase().trim(),
      logoUrl: '',

      // System fields
      flypId: genFlypId(),
      profileVersion: 1,
      createdAt: nowIso,
      lastUpdated: nowIso,
    };
  };

  const createBusinessDoc = async (uid) => {
    const payload = buildPayload(uid);
    await setDoc(doc(db, 'businesses', uid), payload, { merge: true });
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setMsg({ error: '', success: '' });
    const e164Phone = toE164IN(sanitize10Digits(form.phone));
    if (sanitize10Digits(form.phone).length !== 10) {
      return setMsg({ error: 'Please enter a valid 10-digit Indian mobile number.', success: '' });
    }

    if (!form.agree) return setMsg({ error: 'Please accept Terms & Privacy to continue.', success: '' });
    if (!gstStatus.ok) return setMsg({ error: `GSTIN error: ${gstStatus.reason}`, success: '' });
    if (form.password !== form.confirmPassword) return setMsg({ error: 'Passwords do not match.', success: '' });

    try {
      setLoading(true);
      // Check if phone number is unique in Firestore
      const phoneQuery = query(collection(db, 'businesses'), where('phone', '==', e164Phone));
      const phoneSnap = await getDocs(phoneQuery);
      if (!phoneSnap.empty) {
        return setMsg({ error: 'Phone number already registered. Please sign in instead.', success: '' });
      }

      // Check if email is unique in Firestore
      const emailQuery = query(collection(db, 'businesses'), where('email', '==', form.email.trim()));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        return setMsg({ error: 'Email already registered. Please sign in instead.', success: '' });
      }

      const userCred = await import('firebase/auth').then(({ createUserWithEmailAndPassword }) =>
        createUserWithEmailAndPassword(auth, form.email.trim(), form.password)
      );
      const user = userCred.user;

      await updateProfile(user, { displayName: (form.ownerName || '').trim() });
      await createBusinessDoc(user.uid);
      await sendEmailVerification(user);

      setMsg({ error: '', success: 'Account created. Redirecting to dashboard…' });
      // Use selected role from form, fallback to prop, fallback to "Retailer"
      const selectedRole = (form.role || role || "Retailer").charAt(0).toUpperCase() + (form.role || role || "Retailer").slice(1);
      setTimeout(() => {
        if (selectedRole === "Retailer") {
          navigate("/dashboard");
        } else if (selectedRole === "Distributor") {
          navigate("/distributor-dashboard");
        } else if (selectedRole === "Product Owner") {
          navigate("/product-owner-dashboard");
        } else {
          navigate("/dashboard"); // Fallback in case role is missing
        }
      }, 2000);
    } catch (err) {
      console.error(err);
      if (err?.code === 'auth/email-already-in-use') {
        return setMsg({ error: 'Email already registered. Please sign in.', success: '' });
      }
      setMsg({ error: err?.message || 'Signup failed', success: '' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setMsg({ error: '', success: '' });
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Check if user already exists with a different provider
      const methods = await fetchSignInMethodsForEmail(auth, user.email);
      if (methods.includes("password") && !methods.includes("google.com")) {
        setMsg({ error: "This email is already registered manually. Please login using email and password.", success: '' });
        setLoading(false);
        return;
      }
      // ---- Firestore logic to ensure user info is stored ----
      // Check if user doc exists in /businesses; if not, create with default details
      const { getDoc, setDoc, doc: fsDoc, serverTimestamp } = await import('firebase/firestore');
      const dbInstance = db;
      const businessRef = fsDoc(dbInstance, "businesses", user.uid);
      const businessSnap = await getDoc(businessRef);
      // Use selected role from form state if present, fallback to prop, fallback to "Retailer"
      const selectedRole = (form.role || role || "Retailer").charAt(0).toUpperCase() + (form.role || role || "Retailer").slice(1);
      if (!businessSnap.exists()) {
        await setDoc(businessRef, {
          ownerId: user.uid,
          ownerName: user.displayName || "",
          email: user.email || "",
          phone: user.phoneNumber || "",
          role: selectedRole,
          createdAt: serverTimestamp(),
          profileVersion: 1,
          whatsappAlerts: false,
          state: "",
          zipcode: "",
          gstnumber: "",
          invoicePreference: "Minimal",
          logoUrl: "",
        });
      }
      // ---- End Firestore logic ----
      setMsg({ error: '', success: 'Signed in with Google. Redirecting…' });
      // Use selected role from form, fallback to prop, fallback to "Retailer"
      const roleToNavigate = selectedRole;
      setTimeout(() => {
        if (roleToNavigate === "Retailer") {
          navigate("/dashboard");
        } else if (roleToNavigate === "Distributor") {
          navigate("/distributor-dashboard");
        } else if (roleToNavigate === "Product Owner") {
          navigate("/product-owner-dashboard");
        } else {
          navigate("/dashboard"); // Fallback in case role is missing
        }
      }, 1500);
    } catch (error) {
      if (error?.code && error?.message) {
        console.error("Sign-in error:", error.code, error.message);
      } else {
        console.error(error);
      }
      setMsg({ error: error?.message || 'Google sign-in failed', success: '' });
    } finally {
      setLoading(false);
    }
  };

  // Use selected role from form, fallback to prop
  const roleName = (form.role || role || "Retailer").charAt(0).toUpperCase() + (form.role || role || "Retailer").slice(1);
  const hero = roleName === 'Retailer'
    ? [
        { title: 'Auto‑billing in seconds', text: 'Scan, bill, and auto‑deduct stock — no spreadsheet drama.' },
        { title: 'Smart Inventory', text: 'OCR + AI onboarding. Track low‑stock. Forecast drain.' },
        { title: 'Connect to Distributors', text: 'Send requests, compare, and track delivery to doorstep.' },
      ]
    : [
        { title: 'Order Queue to Dispatch', text: 'Accept, schedule, ship. Full traceability.' },
        { title: 'Inventory at a Glance', text: 'Live stock, slow movers, brand performance.' },
        { title: 'Retailer Network', text: 'Manage connections and automate reorders.' },
      ];

  const scrollToForm = () => {
    try {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Page background (single source of truth) */}
      <div className="absolute inset-0 -z-10">
        {/* base color */}
        <div className="absolute inset-0 bg-[#0b1220]" />
        {/* radial washes */}
        <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_15%_10%,rgba(56,189,248,0.12),transparent_60%)]" />
        <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_85%_90%,rgba(217,70,239,0.10),transparent_60%)]" />
        {/* vignette */}
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] bg-black/30 pointer-events-none" />
        {/* subtle noise */}
        <div className="absolute inset-0 opacity-[0.05] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22%20viewBox=%220%200%20160%20160%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.8%22%20numOctaves=%222%22/%3E%3C/filter%3E%3Crect%20width=%22160%22%20height=%22160%22%20filter=%22url(%23n)%22%20opacity=%220.6%22/%3E%3C/svg%3E')]" />
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
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" />
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

            <button onClick={scrollToForm} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-cyan-200 hover:text-white hover:bg-cyan-400/20 transition">
              Go to registration
              <Icon name="arrow-right" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* RIGHT: Register card (primary) */}
        <div className="flex items-center justify-center">
          <div onMouseMove={onMouseMove} className="w-full max-w-md relative">
            {/* Cursor‑reactive glow */}
            <div
              ref={glowRef}
              className="pointer-events-none absolute -inset-16 rounded-[32px] blur-3xl opacity-40 transition-opacity"
            />
            {/* Glow behind card */}
            <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-fuchsia-500/30 blur-2xl" />

            <div className="relative rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
              {/* Start here badge */}
              <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-900 bg-gradient-to-r from-emerald-300 to-cyan-300 shadow">
                Start here
              </div>

              {/* Header */}
              <div className="px-6 pt-6 text-center">
                <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-white text-3xl font-extrabold tracking-tight">Create your FLYP account</h1>
                <p className="text-slate-300 mt-1 text-sm">30‑second signup. Finish the rest later in Profile Settings.</p>
              </div>

              {/* Role strip */}
              <div className="px-6 mt-5 flex items-center justify-between text-xs">
                <div className="text-slate-300">
                  Joining as{' '}
                  <span className="font-semibold text-white">{roleName}</span>
                  {/* Role selection UI */}
              <select
                name="role"
                value={form.role || roleName}
                onChange={onChange}
                className="ml-2 px-2 py-1 rounded bg-slate-900/60 border border-white/20 text-cyan-200 text-xs"
                style={{ minWidth: 90 }}
              >
                <option value="Retailer">Retailer</option>
                <option value="Distributor">Distributor</option>
                <option value="Product Owner">Product Owner</option>
              </select>
                </div>
                <div className="px-2 py-1 rounded-md bg-slate-900/40 border border-white/10 text-cyan-300 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
                  <span>Protected by Firebase</span>
                </div>
              </div>

              {/* Google */}
              <div className="px-6 mt-4">
                <button onClick={handleGoogle} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 bg-white text-slate-900 font-medium shadow hover:shadow-md transition active:scale-[0.99]">
                  <Icon name="google" className="h-5 w-5" />
                  Continue with Google
                </button>
                <div className="my-5 flex items-center gap-3 text-slate-400">
                  <div className="h-px flex-1 bg-white/15" />
                  <span className="text-[11px] uppercase tracking-widest">or</span>
                  <div className="h-px flex-1 bg-white/15" />
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleEmailSignup} className="px-6 pb-6">
                {msg.error && <div className="mb-3 text-red-300 text-sm">{msg.error}</div>}
                {msg.success && <div className="mb-3 text-emerald-300 text-sm">{msg.success}</div>}

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
                  className="peer w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyan-400/40 transition"
                />
              </label>

                {/* Phone */}
                <div className="mt-3">
                  <label className="block text-sm mb-1 text-slate-200">Phone</label>
                  <div className="flex items-center rounded-xl bg-white/10 text-white border border-white/15 focus-within:ring-2 focus-within:ring-cyan-400/80 focus-within:border-cyan-400/40">
                    <span className="pl-3 pr-2 text-slate-300/90 select-none">+91</span>
                    <div className="h-6 w-px bg-white/10" />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="9876543210"
                      value={form.phone}
                      onChange={onChange}
                      required
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      autoComplete="tel-national"
                      className="w-full bg-transparent px-3 py-3 outline-none placeholder-white/60"
                      aria-label="10-digit Indian mobile number"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Enter 10 digits. Country code is fixed to India (+91).</p>
                </div>

                {/* Email */}
                <label className="group relative block mt-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="mail" /></span>
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={onChange}
                    required
                    className="peer w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyan-400/40 transition"
                  />
                </label>

              {/* Password */}
              <label className="group relative block mt-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="lock" /></span>
                <input
                  type="password"
                  name="password"
                  placeholder="Password (min 6 chars)"
                  value={form.password}
                  onChange={onChange}
                  required
                  minLength={6}
                  className="peer w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyan-400/40 transition"
                />
              </label>

              {/* Confirm Password */}
              <label className="group relative block mt-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/80"><Icon name="lock" /></span>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={onChange}
                  required
                  minLength={6}
                  className="peer w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyan-400/40 transition"
                />
              </label>

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
                      className="w-full pl-11 pr-3 py-3 rounded-xl bg-white/10 text-white border border-white/15 placeholder-white/60 outline-none focus:ring-2 focus:ring-cyan-400/80 focus:border-cyan-400/40 transition uppercase"
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
                  disabled={loading || sanitize10Digits(form.phone).length !== 10}
                  className="mt-5 w-full relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 py-3 font-semibold text-white shadow-lg transition [--shine:linear-gradient(120deg,transparent,rgba(255,255,255,.6),transparent)] hover:shadow-cyan-500/30 hover:-translate-y-0.5 transition-transform active:scale-[.99] disabled:opacity-60"
                >
                  <span className="relative z-10">{loading ? 'Creating account…' : 'Create account'}</span>
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