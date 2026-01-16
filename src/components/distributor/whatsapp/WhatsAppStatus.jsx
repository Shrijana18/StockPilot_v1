/**
 * WhatsApp Status Component
 * Displays WABA status and account information
 */

import React, { useState } from "react";
import { 
  FaWhatsapp, FaSpinner, FaCheckCircle, FaExclamationCircle, 
  FaTimes, FaPhone, FaShieldVirus, FaBuilding, FaInfoCircle, FaExclamationTriangle,
  FaVideo, FaFlask, FaUnlink, FaKey, FaLock
} from "react-icons/fa";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../firebase/firebaseConfig";
import { toast } from "react-toastify";

const WhatsAppStatus = ({ 
  user, 
  formData, 
  setFormData, 
  statusData, 
  checkingStatus, 
  fetchWABAStatus,
  onDisconnect,
  isTestMode 
}) => {
  // Registration states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registrationPin, setRegistrationPin] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState(null);

  // Handle phone registration with PIN
  const handleRegisterPhone = async () => {
    if (!registrationPin || registrationPin.length !== 6 || !/^\d{6}$/.test(registrationPin)) {
      toast.error("Please enter a valid 6-digit PIN");
      return;
    }

    if (!formData.whatsappPhoneNumberId) {
      toast.error("Phone Number ID is missing. Please re-enter your WABA details.");
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);

    try {
      const registerPhoneNumber = httpsCallable(functions, 'registerPhoneNumber');
      const result = await registerPhoneNumber({
        phoneNumberId: formData.whatsappPhoneNumberId,
        pin: registrationPin,
      });

      if (result.data?.success) {
        toast.success("🎉 Phone registered successfully! You can now send messages.");
        setShowRegisterModal(false);
        setRegistrationPin("");
        
        // Update local state
        setFormData(prev => ({
          ...prev,
          whatsappPhoneRegistered: true,
          whatsappPhoneVerificationStatus: 'CONNECTED',
        }));

        // Refresh status
        setTimeout(() => fetchWABAStatus(), 1500);
      } else {
        // Handle error
        if (result.data?.error === 'incorrect_pin') {
          setRegisterError("Incorrect PIN. If Two-Step Verification is enabled on your WhatsApp Business number, enter your existing PIN. Otherwise, try a different 6-digit PIN.");
        } else {
          setRegisterError(result.data?.message || "Registration failed. Please try again.");
        }
        toast.error(result.data?.message || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setRegisterError(err.message || "Failed to register. Please try again.");
      toast.error("Failed to register phone number");
    } finally {
      setIsRegistering(false);
    }
  };

  // Check if phone needs registration
  const needsRegistration = formData.whatsappPhoneNumberId && 
    (statusData?.phone?.needsVerification || 
     formData.whatsappPhoneVerificationStatus === 'pending' ||
     !formData.whatsappPhoneRegistered);
  return (
    <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
      {/* Test Mode Banner */}
      {isTestMode && (
        <div className="bg-purple-900/30 border border-purple-500/50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaFlask className="text-purple-400 text-xl" />
              <div>
                <p className="text-purple-300 font-semibold">🧪 Test Mode Active</p>
                <p className="text-xs text-gray-400">Using Meta's test WABA for development. Messages only work with whitelisted numbers.</p>
              </div>
            </div>
            {onDisconnect && (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FaUnlink />
                Disconnect Test
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <FaWhatsapp className="w-6 h-6 text-green-400" />
          </div>
          WhatsApp Business
          {isTestMode && <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded ml-2">TEST</span>}
        </h2>
        <div className="flex items-center gap-2">
          {!isTestMode && (
            <button
              onClick={fetchWABAStatus}
              disabled={checkingStatus}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <FaSpinner className={checkingStatus ? 'animate-spin' : ''} />
              Refresh Status
            </button>
          )}
          {!isTestMode && (
            <button
              onClick={() => {
                window.location.href = '/distributor-dashboard#/distributor-dashboard?tab=whatsapp&review=true';
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaVideo className="text-xs" />
              Meta App Review
            </button>
          )}
          {onDisconnect && !isTestMode && (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaUnlink />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {checkingStatus && !statusData && (
        <div className="rounded-xl p-4 border-2 border-blue-500 bg-blue-900/20">
          <div className="flex items-center gap-3">
            <FaSpinner className="text-blue-400 animate-spin text-xl" />
            <div>
              <h3 className="font-bold text-white">Checking Account Status...</h3>
              <p className="text-sm text-blue-300">Fetching latest information from Meta</p>
            </div>
          </div>
        </div>
      )}

      {/* Account Info Card */}
      {formData.whatsappBusinessAccountId && (
        <div className="rounded-xl p-4 border-2 border-white/10 bg-slate-800/40">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-white flex items-center gap-2">
              <FaBuilding />
              Your WhatsApp Business Account
            </h3>
            <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">Connected</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">WABA ID:</span>
              <span className="text-white font-mono">{formData.whatsappBusinessAccountId}</span>
            </div>
            {formData.whatsappPhoneNumber && (
              <div className="flex justify-between">
                <span className="text-gray-400">Phone Number:</span>
                <span className="text-white">{formData.whatsappPhoneNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Review Status */}
      {statusData ? (
        <>
          <div className={`rounded-xl p-4 border-2 ${
            statusData.accountReview.isApproved 
              ? 'border-emerald-500 bg-emerald-900/20' 
              : statusData.accountReview.isPending
              ? 'border-yellow-500 bg-yellow-900/20'
              : 'border-red-500 bg-red-900/20'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FaShieldVirus />
                Account Review Status
              </h3>
              {statusData.accountReview.isApproved ? (
                <FaCheckCircle className="text-emerald-400 text-xl" />
              ) : statusData.accountReview.isPending ? (
                <FaSpinner className="text-yellow-400 animate-spin text-xl" />
              ) : (
                <FaExclamationTriangle className="text-red-400 text-xl" />
              )}
            </div>
            <div className="space-y-1">
              <p className={`text-sm font-medium ${
                statusData.accountReview.isApproved ? 'text-emerald-300' :
                statusData.accountReview.isPending ? 'text-yellow-300' :
                'text-red-300'
              }`}>
                {statusData.accountReview.status}
              </p>
              {statusData.accountReview.isPending && (
                <p className="text-xs text-yellow-300 mt-2">
                  ⏳ Meta is reviewing your account. This usually takes 24-48 hours.
                </p>
              )}
            </div>
          </div>

          {/* Phone Status */}
          <div className={`rounded-xl p-4 border-2 ${
            statusData.phone.verified 
              ? 'border-emerald-500 bg-emerald-900/20' 
              : statusData.phone.registered
              ? 'border-yellow-500 bg-yellow-900/20'
              : 'border-gray-500 bg-gray-900/20'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FaPhone />
                Phone Number Status
              </h3>
              {statusData.phone.verified ? (
                <FaCheckCircle className="text-emerald-400 text-xl" />
              ) : statusData.phone.registered ? (
                <FaExclamationCircle className="text-yellow-400 text-xl" />
              ) : (
                <FaTimes className="text-gray-400 text-xl" />
              )}
            </div>
            <div className="space-y-2 text-sm">
              {statusData.phone.phoneNumber ? (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Phone Number:</span>
                  <span className="text-white font-medium">{statusData.phone.phoneNumber}</span>
                </div>
              ) : (
                <p className="text-gray-400">No phone number added yet</p>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status:</span>
                <span className={`font-medium ${
                  statusData.phone.verified ? 'text-emerald-300' :
                  statusData.phone.registered ? 'text-yellow-300' :
                  'text-gray-400'
                }`}>
                  {statusData.phone.verified 
                    ? '✓ Verified and Connected' 
                    : statusData.phone.registered
                    ? `⚠ ${statusData.phone.verificationStatus} - Needs Verification`
                    : '❌ Not Registered'}
                </span>
              </div>
              {statusData.phone.needsVerification && (
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-yellow-900/30 rounded text-xs text-yellow-300">
                    💡 Your phone is verified but not registered with Cloud API. Click "Register Phone" to complete setup.
                  </div>
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FaKey />
                    Register Phone with PIN
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* WABA Details */}
          {statusData.waba && (
            <div className="rounded-xl p-4 border-2 border-white/10 bg-slate-800/40">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <FaInfoCircle />
                Account Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Account Name:</span>
                  <span className="text-white">{statusData.waba.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={statusData.waba.isEnabled ? 'text-emerald-300' : 'text-red-300'}>
                    {statusData.waba.isEnabled ? '✓ Enabled' : '❌ Disabled'}
                  </span>
                </div>
                {statusData.waba.timezone && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Time Zone:</span>
                    <span className="text-white">{statusData.waba.timezone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pending Actions */}
          {statusData.overall.needsAction && statusData.overall.pendingActions.length > 0 && (
            <div className="rounded-xl p-4 border-2 border-yellow-500 bg-yellow-900/20">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <FaInfoCircle />
                Action Required
              </h3>
              <p className="text-sm text-yellow-300 mb-2">Complete these steps to fully activate your account:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-200">
                {statusData.overall.pendingActions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {/* All Ready Status */}
          {statusData.overall.ready && (
            <div className="rounded-xl p-4 border-2 border-emerald-500 bg-emerald-900/20">
              <div className="flex items-center gap-3 mb-2">
                <FaCheckCircle className="text-emerald-400 text-2xl" />
                <h3 className="font-bold text-white text-lg">All Set! Account is Ready</h3>
              </div>
              <p className="text-sm text-emerald-300">
                Your WhatsApp Business Account is fully configured and ready to use.
              </p>
            </div>
          )}
        </>
      ) : !checkingStatus && formData.whatsappBusinessAccountId && (
        <div className="rounded-xl p-4 border-2 border-gray-500 bg-gray-900/20">
          <div className="flex items-center gap-3">
            <FaInfoCircle className="text-gray-400" />
            <div>
              <h3 className="font-bold text-white">Status Information</h3>
              <p className="text-sm text-gray-400">Click "Refresh Status" to see your account review and phone verification status</p>
            </div>
          </div>
          
          {/* Show Register button if phone ID exists but may not be registered */}
          {formData.whatsappPhoneNumberId && !formData.whatsappPhoneRegistered && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaKey />
              Register Phone Number
            </button>
          )}
        </div>
      )}

      {/* Phone Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <FaKey className="text-blue-400 text-xl" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Register Phone Number</h3>
                <p className="text-sm text-gray-400">Complete Cloud API registration</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg text-sm">
                <p className="text-blue-200 font-medium mb-2">🔐 About the 6-digit PIN:</p>
                <ul className="text-blue-300 space-y-1 text-xs">
                  <li>• If you have <strong>Two-Step Verification enabled</strong> on WhatsApp, enter your existing PIN</li>
                  <li>• If you DON'T have 2FA enabled, create a NEW 6-digit PIN (this will enable 2FA)</li>
                  <li>• Remember this PIN - you'll need it if re-registering</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enter 6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={registrationPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setRegistrationPin(value);
                    setRegisterError(null);
                  }}
                  placeholder="Enter 6-digit PIN"
                  className="w-full px-4 py-3 bg-slate-700 border border-white/10 rounded-lg text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {registrationPin.length}/6 digits
                </p>
              </div>

              {registerError && (
                <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-sm">{registerError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    setRegistrationPin("");
                    setRegisterError(null);
                  }}
                  disabled={isRegistering}
                  className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterPhone}
                  disabled={isRegistering || registrationPin.length !== 6}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRegistering ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <FaLock />
                      Register Phone
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Phone Number ID: <code className="text-gray-400">{formData.whatsappPhoneNumberId}</code>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppStatus;
