import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { setEmployeeSession, markEmployeeRedirect } from '../../utils/employeeSession';
import { empDB as db, empAuth } from '../../firebase/firebaseConfig';

/**
 * Employee Login
 * - Supports deep-link: /employee-login?empId=EMP-123456
 * - Validates numeric phone/PIN
 * - Shows/hides PIN
 * - Stores a lightweight session on success and redirects to /employee-dashboard
 */
const EmployeeLogin = () => {
  // --- UI state ---
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retailerId, setRetailerId] = useState('');
  const navigate = useNavigate();

  // --- helpers ---
  const normalizeEmpId = useCallback((raw = '') => {
    const v = String(raw).trim().toUpperCase();
    if (!v) return '';
    // ensure EMP- prefix (do not force exact length so we work with older IDs too)
    return v.startsWith('EMP-') ? v : `EMP-${v.replace(/^EMP-?/i, '')}`;
  }, []);

  const cleanPhone = useMemo(() => phone.replace(/\D+/g, ''), [phone]);
  const cleanPin = useMemo(() => pin.replace(/\D+/g, ''), [pin]);

  // Prefill from URL (?empId=EMP-123456) – supports legacy `empld` and optional prefill of phone/pin and retailerId
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const empIdParam = params.get('empId') || params.get('empld') || '';
      const phoneParam = params.get('phone') || '';
      const pinParam = params.get('pin') || '';
      const retailerParam = params.get('retailerId') || '';

      if (empIdParam) setEmployeeId(normalizeEmpId(empIdParam));
      if (phoneParam) setPhone(String(phoneParam));
      if (pinParam) setPin(String(pinParam));
      if (retailerParam) setRetailerId(retailerParam);
    } catch {}
  }, [normalizeEmpId]);

  // Submit on Enter
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleLogin();
  };

  const handleLogin = async () => {
    if (loading) return;

    if (!retailerId) {
      toast.error('Missing business ID. Please open the login link sent by your manager.');
      return;
    }
    const emp = normalizeEmpId(employeeId);
    const ph = cleanPhone;
    const pw = cleanPin;
    // Validate canonical EMP ID like EMP-123 or longer
    const isValidEmp = /^EMP-\d{3,}$/.test(emp);
    if (!isValidEmp) {
      toast.error('Invalid Employee ID. Use the link from your manager or enter a valid EMP-XXXX.');
      return;
    }
    // Normalize Indian phone inputs to 10 digits – accept forms like +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, spaces, dashes
    let normalizedPhone = ph.replace(/\D+/g, '');
    if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) normalizedPhone = normalizedPhone.slice(2);
    if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) normalizedPhone = normalizedPhone.slice(1);
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      toast.error('Enter a valid 10-digit phone number');
      return;
    }
    if (!/^\d{4,6}$/.test(pw)) {
      toast.error('PIN must be 4–6 digits');
      return;
    }

    if (!emp || !ph || !pw) {
      toast.error('Please fill Employee ID, Phone, and PIN');
      return;
    }

    try {
      setLoading(true);
      const endpoint = import.meta.env.VITE_EMP_LOGIN_URL || "https://us-central1-stockpilotv1.cloudfunctions.net/employeeLogin";
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailerId, flypId: emp, phone: normalizedPhone, password: pw }),
      });
      let data;
      try {
        data = await resp.json();
      } catch {
        data = { success: false, message: "Unexpected server response" };
      }
      if (!resp.ok) {
        throw new Error(data?.message || `HTTP ${resp.status}`);
      }

      if (!data.success) {
        throw new Error(data.message || 'Invalid credentials');
      }

      // Note: Employee uses separate auth instance (empAuth) so no need to sign out main user

      // 🔐 Secure Firebase session for employee using custom token (if provided)
      if (data.token) {
        const { signInWithCustomToken } = await import('firebase/auth');
        try {
          await signInWithCustomToken(empAuth, data.token);
        } catch (e) {
          console.error('Custom token sign-in failed:', e);
          toast.error('Secure sign-in failed. Please try again.');
          return;
        }
      }

      // Persist a compact session for the employee dashboard using helper
      const session = setEmployeeSession({
        retailerId: data.retailerId || '',
        employeeId: data.employeeId || emp,
        role: data.role || 'Employee',
        permissions: data.permissions || { inventory: false, billing: false, analytics: false },
        phone: normalizedPhone,
      });

      toast.success(`Welcome ${session.role}`);
      markEmployeeRedirect();
      navigate('/employee-dashboard', { replace: true });
    } catch (err) {
      // Standardize common backend failures
      console.error("Employee login failed full error:", err);
      const raw = (err?.message || '').toLowerCase();
      const msg =
        raw.includes('not-found') || raw.includes('employee record') ? 'Employee not found' :
        raw.includes('permission-denied') || raw.includes('incorrect') || raw.includes('invalid pin') ? 'Incorrect phone or PIN' :
        raw.includes('failed_precondition') ? 'Temporary issue while updating login status. Please try again.' :
        err.message || 'Login failed';
      console.error('Employee login error:', err);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(_) {}
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <div className="rounded-xl shadow-lg border border-white/10 bg-gradient-to-b from-white/5 to-black/20 backdrop-blur p-6">
        <h2 className="text-2xl font-semibold mb-6">Employee Login</h2>

        {retailerId ? (
          <div className="mb-4 text-xs text-emerald-300/90 bg-emerald-900/20 border border-emerald-400/20 rounded px-3 py-2">
            <strong>Business ID:</strong> {retailerId}
          </div>
        ) : (
          <div className="mb-4 text-xs text-amber-200/90 bg-amber-900/20 border border-amber-400/20 rounded px-3 py-2">
            Open this page using the link your manager shared so we can identify your business automatically.
          </div>
        )}

        {/* Employee ID */}
        <label className="block text-sm mb-1">Employee ID</label>
        <input
          className="border border-white/15 bg-black/20 rounded px-3 py-2 w-full mb-3 outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="EMP-123456 (or paste link)"
          value={employeeId}
          onChange={(e) => setEmployeeId(normalizeEmpId(e.target.value))}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        {/* Phone */}
        <label className="block text-sm mb-1">Phone</label>
        <input
          className="border border-white/15 bg-black/20 rounded px-3 py-2 w-full mb-3 outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="10-digit phone"
          inputMode="numeric"
          pattern="[0-9]*"
          value={cleanPhone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />

        {/* PIN */}
        <label className="block text-sm mb-1">PIN</label>
        <div className="relative mb-5">
          <input
            type={showPin ? 'text' : 'password'}
            className="border border-white/15 bg-black/20 rounded px-3 py-2 w-full pr-16 outline-none focus:ring-2 focus:ring-emerald-500/40"
            placeholder="4–6 digit PIN"
            inputMode="numeric"
            pattern="[0-9]*"
            value={cleanPin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
            onClick={() => setShowPin((s) => !s)}
            disabled={loading}
          >
            {showPin ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full bg-emerald-600 hover:bg-emerald-500 transition text-white px-4 py-2.5 rounded ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>

        <p className="text-xs text-white/60 mt-4">
          Tip: if you received a link from your manager, your Employee ID should be pre‑filled.
          If you forgot your PIN, ask your manager to reset it.
        </p>
      </div>
    </div>
  );
};

export default EmployeeLogin;