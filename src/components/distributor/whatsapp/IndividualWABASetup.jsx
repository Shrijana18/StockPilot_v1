/**
 * Individual WABA Setup Component
 * Allows users to create their own WABA with phone number
 * Complete flow: WABA creation → Phone registration → OTP verification
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { 
  FaWhatsapp, 
  FaCheckCircle, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaPhone, 
  FaBuilding,
  FaKey,
  FaArrowRight,
  FaInfoCircle
} from 'react-icons/fa';

const IndividualWABASetup = ({ onSetupComplete }) => {
  const [step, setStep] = useState(1); // 1: Form, 2: OTP, 3: Success
  const [loading, setLoading] = useState(false);
  const [distributorId, setDistributorId] = useState(auth.currentUser?.uid || null);
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [wabaId, setWabaId] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState(null);

  // Get business name from profile
  useEffect(() => {
    const fetchBusinessName = async () => {
      if (!distributorId) return;
      
      try {
        const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          setBusinessName(data.businessName || data.ownerName || '');
        }
      } catch (error) {
        console.error('Error fetching business name:', error);
      }
    };

    fetchBusinessName();
  }, [distributorId]);

  // Check existing status
  useEffect(() => {
    const checkStatus = async () => {
      if (!distributorId) return;

      try {
        const checkStatus = httpsCallable(functions, 'checkPhoneRegistrationStatus');
        const result = await checkStatus();
        
        if (result.data.success) {
          if (result.data.status === 'verified') {
            setStep(3);
            setWabaId(result.data.verifiedPhone?.id);
            toast.success('WhatsApp is already connected!');
          } else if (result.data.requiresOTP) {
            setStep(2);
            setWabaId(result.data.phoneNumbers?.[0]?.id);
            toast.info('OTP verification pending');
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    checkStatus();
  }, [distributorId]);

  // Format phone number (remove non-digits)
  const formatPhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits;
    }
    return digits.slice(0, 10);
  };

  // Step 1: Create WABA and request OTP
  const handleCreateWABA = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber || phoneNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    if (!businessName.trim()) {
      toast.error('Please enter your business name');
      return;
    }

    setLoading(true);
    try {
      const createWABA = httpsCallable(functions, 'createIndividualWABA');
      const result = await createWABA({
        phoneNumber: phoneNumber,
        businessName: businessName.trim(),
      });

      if (result.data.success) {
        setWabaId(result.data.wabaId);
        setStep(2);
        toast.success('WABA created! OTP sent to your phone number.');
      }
    } catch (error) {
      console.error('Error creating WABA:', error);
      const errorMessage = error.message || 'Failed to create WABA';
      
      if (errorMessage.includes('already registered')) {
        toast.error('This phone number is already registered with WhatsApp. Please use a new number.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      const verifyOTP = httpsCallable(functions, 'verifyPhoneOTP');
      const result = await verifyOTP({
        otpCode: otpCode,
      });

      if (result.data.success) {
        setStep(3);
        toast.success('Phone number verified! WhatsApp is ready to use.');
        if (onSetupComplete) {
          onSetupComplete(result.data);
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      const errorMessage = error.message || 'Failed to verify OTP';
      
      if (errorMessage.includes('Invalid OTP')) {
        toast.error('Invalid OTP code. Please check and try again.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (!phoneNumber) return;

    setLoading(true);
    try {
      // Re-request OTP by creating WABA again (if needed) or using request_code endpoint
      toast.info('Resending OTP...');
      // Note: You might need to add a resendOTP function
      const createWABA = httpsCallable(functions, 'createIndividualWABA');
      await createWABA({
        phoneNumber: phoneNumber,
        businessName: businessName.trim(),
      });
      toast.success('OTP resent to your phone number');
    } catch (error) {
      console.error('Error resending OTP:', error);
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 text-white">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <FaWhatsapp className="text-emerald-400" />
            Individual WhatsApp Business Setup
          </h2>
          <p className="text-gray-400">
            Create your own WhatsApp Business Account with your phone number
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              {step > 1 ? <FaCheckCircle /> : '1'}
            </div>
            <span className="text-sm">Create WABA</span>
          </div>
          <FaArrowRight className={`${step >= 2 ? 'text-emerald-400' : 'text-gray-500'}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              {step > 2 ? <FaCheckCircle /> : '2'}
            </div>
            <span className="text-sm">Verify OTP</span>
          </div>
          <FaArrowRight className={`${step >= 3 ? 'text-emerald-400' : 'text-gray-500'}`} />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-400' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              {step >= 3 ? <FaCheckCircle /> : '3'}
            </div>
            <span className="text-sm">Ready</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Create WABA Form */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
            >
              <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <FaInfoCircle className="text-blue-400 mt-1" />
                  <div className="text-sm text-blue-200">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-200/80">
                      <li>Phone number must be NEW and not used with WhatsApp</li>
                      <li>You'll receive an OTP to verify the number</li>
                      <li>Business name will be shown as your WABA account name</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateWABA} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <FaBuilding className="inline mr-2" />
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your Business Name"
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    This will be your WhatsApp Business Account name
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <FaPhone className="inline mr-2" />
                    Phone Number (10 digits, new number)
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Must be a new number not registered with WhatsApp
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !phoneNumber || phoneNumber.length !== 10 || !businessName.trim()}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Creating WABA...
                    </>
                  ) : (
                    <>
                      Create WhatsApp Business Account
                      <FaArrowRight />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
            >
              <div className="mb-4 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-emerald-400 mt-1" />
                  <div className="text-sm text-emerald-200">
                    <p className="font-semibold mb-1">WABA Created Successfully!</p>
                    <p className="text-emerald-200/80">
                      We've sent a 6-digit OTP code to <strong>+91 {phoneNumber}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <FaKey className="inline mr-2" />
                    Enter OTP Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(digits);
                    }}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-3 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    Check your phone for the OTP code
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="flex-1 bg-slate-800/60 border border-white/10 text-white py-3 rounded-lg hover:bg-slate-700/60 transition-colors disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !otpCode || otpCode.length !== 6}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify OTP
                        <FaArrowRight />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900/80 border border-emerald-500/50 rounded-xl p-8 text-center"
            >
              <div className="mb-4">
                <FaCheckCircle className="text-6xl text-emerald-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-emerald-400 mb-2">
                  WhatsApp Connected Successfully!
                </h3>
                <p className="text-gray-400 mb-4">
                  Your WhatsApp Business Account is ready to use
                </p>
              </div>

              <div className="bg-slate-800/40 rounded-lg p-4 mb-4 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Business Name:</span>
                    <span className="text-white font-semibold">{businessName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone Number:</span>
                    <span className="text-white font-semibold">+91 {phoneNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">WABA ID:</span>
                    <span className="text-white font-mono text-xs">{wabaId}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onSetupComplete) {
                    onSetupComplete({ success: true });
                  }
                }}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-lg transition-all"
              >
                Go to WhatsApp Hub
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default IndividualWABASetup;

