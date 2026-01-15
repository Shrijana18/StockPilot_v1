/**
 * MSG91 OTP Service
 * Handles OTP sending and verification using Firebase Callable Functions
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/firebaseConfig';

const functions = getFunctions(app, 'us-central1');
const sendOtpCallable = httpsCallable(functions, 'sendOtp');
const verifyOtpCallable = httpsCallable(functions, 'verifyOtp');

/**
 * Normalize phone number to E.164 format (+91XXXXXXXXXX)
 */
export const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (digits.length !== 10) {
    throw new Error('Phone number must be 10 digits');
  }
  return `+91${digits}`;
};

/**
 * Send OTP via Firebase Callable Function
 * @param {string} phone - Phone number in E.164 format (+91XXXXXXXXXX) or 10 digits
 * @param {Function} onSuccess - Optional callback when OTP is sent successfully
 * @param {Function} onError - Optional callback when OTP sending fails
 * @returns {Promise<void>}
 */
export const sendOtp = async (phone, onSuccess, onError) => {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);

    // Call Firebase function
    const result = await sendOtpCallable({ phone: normalizedPhone });
    
    if (result.data?.success) {
      console.log('[MSG91] OTP sent successfully');
      onSuccess?.(result.data);
      return;
    } else {
      throw new Error(result.data?.message || 'Failed to send OTP');
    }
  } catch (error) {
    console.error('[MSG91] OTP send error:', error);
    const errorMsg = error?.message || error?.details || 'Failed to send OTP';
    onError?.(error);
    throw new Error(errorMsg);
  }
};

/**
 * Verify OTP using Firebase Callable Function
 * @param {string} phone - Phone number in E.164 format or 10 digits
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<boolean>} - True if OTP is verified successfully
 */
export const verifyOtp = async (phone, otp) => {
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);

    // Validate OTP format
    if (!otp || !/^\d{6}$/.test(String(otp))) {
      throw new Error('OTP must be 6 digits');
    }

    // Call Firebase function
    const result = await verifyOtpCallable({
      phone: normalizedPhone,
      otp: String(otp),
    });

    return result.data?.ok === true || result.data?.verified === true;
  } catch (error) {
    console.error('[MSG91] OTP verification error:', error);
    const errorMsg = error?.message || error?.details || 'OTP verification failed';
    throw new Error(errorMsg);
  }
};

/**
 * Resend OTP
 * @param {string} phone - Phone number
 * @param {Function} onSuccess - Optional callback on success
 * @param {Function} onError - Optional callback on error
 * @returns {Promise<void>}
 */
export const resendOtp = async (phone, onSuccess, onError) => {
  return sendOtp(phone, onSuccess, onError);
};
