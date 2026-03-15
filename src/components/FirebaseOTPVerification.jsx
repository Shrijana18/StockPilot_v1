import React, { useState, useEffect, useRef } from 'react';
import { PhoneAuthProvider, linkWithCredential, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

/**
 * FirebaseOTPVerification
 *
 * Sends and verifies phone OTP using the MAIN Firebase auth instance.
 * - First login: linkWithPhoneNumber (links phone + keeps email session intact)
 * - Subsequent logins: PhoneAuthProvider.verifyPhoneNumber + reauthenticateWithCredential
 *
 * Props:
 *  phone      – raw phone number (10-digit, +91..., or E.164)
 *  onVerified – called with E.164 phone on success
 *  onError    – called with Error on failure
 *  onCancel   – called when user cancels
 */

const toE164 = (raw = '') => {
  const s = String(raw).trim();
  const digits = s.replace(/[^0-9]/g, '');
  if (s.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  return '+' + digits;
};

const FirebaseOTPVerification = ({ phone, onVerified, onError, onCancel }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const inputRefs = useRef([]);
  const verificationIdRef = useRef(null);

  const formattedPhone = toE164(phone);

  useEffect(() => {
    const timer = setTimeout(() => sendOTP(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const sendOTP = async () => {
    setSending(true);
    setError('');
    verificationIdRef.current = null;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Session expired. Please login again.');
      console.log('[FirebaseOTP] currentUser uid:', currentUser.uid, 'phone:', currentUser.phoneNumber);

      // phoneEnforcementState: OFF — direct REST API call, no reCAPTCHA needed
      const apiKey = auth.app.options.apiKey;
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: formattedPhone }),
        }
      );
      const data = await resp.json();
      console.log('[FirebaseOTP] sendVerificationCode status:', resp.status, data.error?.message || 'OK');
      if (!resp.ok) {
        const code = data.error?.message || 'UNKNOWN';
        const e = new Error(code);
        e.code = 'auth/' + code.toLowerCase().replace(/_/g, '-');
        throw e;
      }
      verificationIdRef.current = data.sessionInfo;
      console.log('[FirebaseOTP] OTP sent, sessionInfo:', data.sessionInfo?.substring(0, 20) + '...');

      setOtpSent(true);
      setResendTimer(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error('[FirebaseOTP] send error', err?.code, err?.message);
      let msg = 'Failed to send OTP. Please try again.';
      if (err?.code === 'auth/invalid-phone-number') msg = 'Invalid phone number. Contact support.';
      else if (err?.code === 'auth/too-many-requests') msg = 'Too many attempts. Please wait.';
      else if (err?.code === 'auth/quota-exceeded') msg = 'SMS quota exceeded. Try later.';
      else if (err?.code === 'auth/captcha-check-failed') msg = 'Verification failed. Please refresh.';
      else if (err?.message?.includes('Session expired')) msg = err.message;
      setError(msg);
      onError?.(err);
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async (code) => {
    if (code.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Session expired. Please login again.');
      if (!verificationIdRef.current) throw new Error('OTP not sent. Please tap Resend.');

      const credential = PhoneAuthProvider.credential(verificationIdRef.current, code);

      try {
        // First time: link phone number to existing email/password account
        await linkWithCredential(currentUser, credential);
        console.log('[FirebaseOTP] phone linked successfully');
      } catch (linkErr) {
        if (
          linkErr.code === 'auth/provider-already-linked' ||
          linkErr.code === 'auth/credential-already-in-use'
        ) {
          // Phone already linked — re-authenticate instead
          await reauthenticateWithCredential(currentUser, credential);
          console.log('[FirebaseOTP] reauthenticated successfully');
        } else {
          throw linkErr;
        }
      }

      onVerified?.(formattedPhone);
    } catch (err) {
      console.error('[FirebaseOTP] verify error', err?.code, err?.message);
      let msg = 'Incorrect OTP. Please try again.';
      if (err?.code === 'auth/code-expired') msg = 'OTP has expired. Request a new one.';
      else if (err?.code === 'auth/invalid-verification-code') msg = 'Incorrect OTP.';
      else if (err?.message?.includes('Session expired')) msg = err.message;
      setError(msg);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      onError?.(err);
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== '')) verifyOTP(next.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      navigator.clipboard?.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        if (!digits.length) return;
        const next = ['', '', '', '', '', ''];
        digits.forEach((d, i) => { if (i < 6) next[i] = d; });
        setOtp(next);
        if (next.every((d) => d !== '')) verifyOTP(next.join(''));
        else inputRefs.current[Math.min(digits.length, 5)]?.focus();
      });
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-1">Verify your phone</h3>
        <p className="text-sm text-white/70">
          {sending
            ? 'Sending OTP…'
            : <>6-digit code sent to <span className="font-medium text-white">{formattedPhone}</span></>}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* OTP boxes */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={verifying || sending || !otpSent}
            className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-semibold rounded-xl bg-white/10 text-white border-2 transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
              digit && !error
                ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                : 'border-white/20 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30'
            }`}
          />
        ))}
      </div>

      {/* Resend */}
      <div className="text-center">
        {resendTimer > 0 ? (
          <p className="text-xs text-white/50">Resend in {resendTimer}s</p>
        ) : (
          <button
            type="button"
            onClick={sendOTP}
            disabled={sending || verifying}
            className="text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending…' : 'Resend OTP'}
          </button>
        )}
      </div>

      {/* Verifying indicator */}
      {verifying && (
        <div className="flex items-center justify-center gap-2 text-sm text-white/60">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Verifying…
        </div>
      )}

      {/* Sending indicator */}
      {sending && !otpSent && (
        <div className="flex items-center justify-center gap-2 text-sm text-white/60">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Sending OTP…
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={verifying}
            className="flex-1 py-2.5 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => verifyOTP(otp.join(''))}
          disabled={verifying || otp.join('').length !== 6 || !otpSent}
          className="flex-1 py-2.5 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {verifying ? 'Verifying…' : 'Verify OTP'}
        </button>
      </div>
    </div>
  );
};

export default FirebaseOTPVerification;
