import React, { useState, useEffect, useRef } from 'react';
import { sendOtp, verifyOtp, resendOtp } from '../services/msg91OtpService';

/**
 * OTP Verification Component
 * 
 * Props:
 * @param {string} phone - Phone number to verify
 * @param {Function} onVerified - Callback when OTP is verified successfully (receives phone number)
 * @param {Function} onError - Callback when verification fails
 * @param {Function} onCancel - Callback when user cancels
 * @param {boolean} autoSend - Whether to automatically send OTP on mount (default: true)
 * @param {string} themeColor - Accent color for the UI (default: 'rgb(16, 185, 129)')
 */
const OTPVerification = ({
  phone,
  onVerified,
  onError,
  onCancel,
  autoSend = true,
  themeColor = 'rgb(16, 185, 129)',
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const inputRefs = useRef([]);

  // Auto-send OTP on mount if enabled
  useEffect(() => {
    if (autoSend && phone && !otpSent) {
      handleSendOtp();
    }
  }, [autoSend, phone]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!phone) {
      setError('Phone number is required');
      return;
    }

    setSending(true);
    setError('');
    setOtpSent(false);

    try {
      await sendOtp(
        phone,
        (data) => {
          console.log('[OTP] Sent successfully', data);
        },
        (err) => {
          throw err;
        }
      );
      setOtpSent(true);
      setResendTimer(60); // 60 seconds cooldown
    } catch (err) {
      const errorMsg = err?.message || 'Failed to send OTP. Please try again.';
      setError(errorMsg);
      onError?.(err);
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (newOtp.every((digit) => digit !== '') && newOtp.length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i + index < 6) {
            newOtp[i + index] = digit;
          }
        });
        setOtp(newOtp);
        const nextIndex = Math.min(index + digits.length, 5);
        inputRefs.current[nextIndex]?.focus();
      });
    }
  };

  const handleVerifyOtp = async (otpValue = null) => {
    const code = otpValue || otp.join('');
    if (code.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }

    if (!otpSent) {
      setError('OTP not sent. Please send OTP first.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const isValid = await verifyOtp(phone, code);
      if (isValid) {
        onVerified?.(phone);
      } else {
        throw new Error('Invalid OTP. Please try again.');
      }
    } catch (err) {
      const errorMsg = err?.message || 'OTP verification failed. Please try again.';
      setError(errorMsg);
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      onError?.(err);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    await handleSendOtp();
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-1">Verify Phone Number</h3>
        <p className="text-sm text-white/70">
          Enter the 6-digit OTP sent to{' '}
          <span className="font-medium text-white">{phone}</span>
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* OTP Input Fields */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={verifying || !otpSent}
            className="w-12 h-12 sm:w-14 sm:h-14 text-center text-lg font-semibold rounded-lg bg-white/10 text-white border-2 border-white/20 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: digit && !error ? themeColor : undefined,
            }}
          />
        ))}
      </div>

      {/* Resend OTP */}
      <div className="text-center">
        {resendTimer > 0 ? (
          <p className="text-xs text-white/60">
            Resend OTP in {resendTimer}s
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={sending || verifying}
            className="text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ color: themeColor }}
          >
            {sending ? 'Sending...' : 'Resend OTP'}
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={verifying}
            className="flex-1 py-2.5 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => handleVerifyOtp()}
          disabled={verifying || otp.join('').length !== 6 || !otpSent}
          className="flex-1 py-2.5 rounded-lg font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, ${themeColor}, ${themeColor}dd)`,
          }}
        >
          {verifying ? (
            <span className="inline-flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Verifying...
            </span>
          ) : (
            'Verify OTP'
          )}
        </button>
      </div>

      {/* Loading State for Initial Send */}
      {sending && !otpSent && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-white/70">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            Sending OTP...
          </div>
        </div>
      )}
    </div>
  );
};

export default OTPVerification;
