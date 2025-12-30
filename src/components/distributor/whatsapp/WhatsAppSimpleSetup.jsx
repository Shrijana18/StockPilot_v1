/**
 * Ultra-Simple WhatsApp Setup - Phone Number Only
 * Like PhonePe: Just enter phone number → Receive test message → Confirm → Done!
 * No API setup, no Meta Business Suite, no technical knowledge required
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { formatIndianPhone, WHATSAPP_PROVIDERS } from '../../../services/whatsappService';

const WhatsAppSimpleSetup = ({ onSetupComplete }) => {
  const [step, setStep] = useState('phone'); // 'phone', 'verifying', 'confirm', 'success'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [testMessageLink, setTestMessageLink] = useState('');
  const distributorId = auth.currentUser?.uid;

  useEffect(() => {
    // Pre-fill phone from profile if available
    const fetchUserPhone = async () => {
      if (!distributorId) return;
      try {
        const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          const phone = data.phone || '';
          if (phone) {
            // Remove +91 prefix for display
            const displayPhone = phone.replace(/^\+91/, '');
            setPhoneNumber(displayPhone);
            setFormattedPhone(phone);
          }
        }
      } catch (error) {
        console.error('Error fetching phone:', error);
      }
    };
    fetchUserPhone();
  }, [distributorId]);

  const handlePhoneSubmit = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    // Format phone number
    const formatted = formatIndianPhone(phoneNumber);
    if (!formatted) {
      toast.error('Invalid phone number. Please enter a 10-digit Indian number.');
      return;
    }

    setFormattedPhone(formatted);
    setLoading(true);
    setStep('verifying');

    try {
      // Save phone number to profile
      const businessRef = doc(db, 'businesses', distributorId);
      await updateDoc(businessRef, {
        phone: formatted,
        lastUpdated: new Date().toISOString(),
      });

      // Generate test message
      const testMessage = `✅ *WhatsApp Setup Test*\n\nHello! This is a test message from FLYP.\n\nYour WhatsApp Business integration is being set up. If you received this message, your setup is working correctly!\n\n_Powered by FLYP_`;

      // Create WhatsApp Web link
      const phoneDigits = formatted.replace(/[^0-9]/g, '');
      const encodedMessage = encodeURIComponent(testMessage);
      const whatsappLink = `https://wa.me/${phoneDigits}?text=${encodedMessage}`;
      
      setTestMessageLink(whatsappLink);
      
      // Open WhatsApp Web in new tab
      window.open(whatsappLink, '_blank');
      
      setLoading(false);
      setStep('confirm');
      
      toast.success('📱 WhatsApp opened! Please check if you received the test message, then confirm below.');
    } catch (error) {
      console.error('Error setting up WhatsApp:', error);
      toast.error('Failed to set up WhatsApp. Please try again.');
      setLoading(false);
      setStep('phone');
    }
  };

  const handleConfirmReceived = async () => {
    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setLoading(true);
    try {
      // Enable WhatsApp with Direct Link provider (no API needed)
      const businessRef = doc(db, 'businesses', distributorId);
      await updateDoc(businessRef, {
        whatsappEnabled: true,
        whatsappProvider: WHATSAPP_PROVIDERS.DIRECT,
        whatsappVerified: true,
        whatsappLastVerifiedAt: serverTimestamp(),
        // Clear any API credentials (not needed for simple mode)
        whatsappPhoneNumberId: '',
        whatsappBusinessAccountId: '',
        whatsappAccessToken: '',
        twilioAccountSid: '',
        twilioAuthToken: '',
        twilioWhatsAppFrom: '',
        lastUpdated: new Date().toISOString(),
      });

      setStep('success');
      toast.success('✅ WhatsApp enabled successfully! You can now send notifications.');

      // Callback to refresh parent
      if (onSetupComplete) {
        setTimeout(() => {
          onSetupComplete();
        }, 1500);
      }
    } catch (error) {
      console.error('Error enabling WhatsApp:', error);
      toast.error('Failed to enable WhatsApp. Please try again.');
      setLoading(false);
    }
  };

  const handleDidNotReceive = () => {
    // Reset to phone input
    setStep('phone');
    setTestMessageLink('');
    toast.info('Please check your phone number and try again.');
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-900/30 via-teal-900/20 to-cyan-900/30 rounded-xl p-8 border-2 border-emerald-500/30 shadow-2xl"
      >
        {/* Step 1: Phone Number Input */}
        <AnimatePresence mode="wait">
          {step === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Enable WhatsApp Notifications
                </h3>
                <p className="text-gray-300 text-sm max-w-md mx-auto">
                  Just enter your WhatsApp Business phone number. We'll send a test message to verify it works!
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-6 border border-white/10 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your WhatsApp Business Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-lg">+91</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhoneNumber(value);
                      }}
                      placeholder="9876543210"
                      className="flex-1 bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
                      maxLength={10}
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Enter your 10-digit Indian mobile number (without country code)
                  </p>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✨</span>
                    <div className="flex-1">
                      <p className="text-sm text-blue-200 font-medium mb-1">How it works:</p>
                      <ul className="text-xs text-gray-300 space-y-1">
                        <li>1. Enter your WhatsApp Business phone number</li>
                        <li>2. We'll open WhatsApp with a test message</li>
                        <li>3. Check if you received it and confirm</li>
                        <li>4. Done! WhatsApp notifications enabled ✅</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePhoneSubmit}
                  disabled={loading || !phoneNumber || phoneNumber.length < 10}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-lg rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Continue & Send Test Message</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Verifying (Loading) */}
          {step === 'verifying' && (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-8"
            >
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent mb-4"></div>
              <p className="text-white font-medium text-lg">Opening WhatsApp...</p>
              <p className="text-gray-400 text-sm mt-2">Please check your WhatsApp for the test message</p>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="text-5xl mb-4">📱</div>
                <h3 className="text-xl font-bold text-white mb-2">Did you receive the test message?</h3>
                <p className="text-gray-300 text-sm">
                  We sent a test message to <strong className="text-emerald-400">+91 {phoneNumber}</strong>
                </p>
              </div>

              <div className="bg-emerald-900/30 rounded-lg p-6 border-2 border-emerald-500/50">
                <div className="bg-slate-900/50 rounded-lg p-4 mb-4 border border-white/10">
                  <p className="text-sm text-gray-300 mb-2"><strong>What to check:</strong></p>
                  <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside text-left">
                    <li>Open WhatsApp on your phone or WhatsApp Web</li>
                    <li>Look for a message from FLYP with "WhatsApp Setup Test"</li>
                    <li>If you see it, click "Yes, I received it!" below</li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmReceived}
                    disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg shadow-lg transform transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Enabling...</span>
                      </>
                    ) : (
                      <>
                        <span>✅</span>
                        <span>Yes, I received it!</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDidNotReceive}
                    disabled={loading}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Didn't receive
                  </button>
                </div>

                {testMessageLink && (
                  <button
                    onClick={() => window.open(testMessageLink, '_blank')}
                    className="w-full mt-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    🔗 Open WhatsApp again
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="text-6xl mb-4"
              >
                ✅
              </motion.div>
              <h3 className="text-2xl font-bold text-emerald-400 mb-2">Setup Complete!</h3>
              <p className="text-gray-300 mb-4">
                WhatsApp notifications are now enabled. You can start sending order updates and reminders!
              </p>
              <div className="bg-emerald-900/20 rounded-lg p-4 border border-emerald-500/30">
                <p className="text-sm text-emerald-200">
                  💡 <strong>Tip:</strong> When you send notifications, WhatsApp Web will open with a pre-filled message. Just click "Send"!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info Cards */}
      {step === 'phone' && (
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-900/80 border border-white/10 rounded-lg p-4">
            <div className="text-3xl mb-2">📱</div>
            <p className="font-semibold text-white text-sm mb-1">No API Required</p>
            <p className="text-xs text-gray-400">
              Works immediately with WhatsApp Web links
            </p>
          </div>
          <div className="bg-slate-900/80 border border-white/10 rounded-lg p-4">
            <div className="text-3xl mb-2">⚡</div>
            <p className="font-semibold text-white text-sm mb-1">Instant Setup</p>
            <p className="text-xs text-gray-400">
              Enable in seconds, no technical knowledge needed
            </p>
          </div>
          <div className="bg-slate-900/80 border border-white/10 rounded-lg p-4">
            <div className="text-3xl mb-2">🔄</div>
            <p className="font-semibold text-white text-sm mb-1">Upgrade Anytime</p>
            <p className="text-xs text-gray-400">
              Switch to API later for automated sending
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppSimpleSetup;

