/**
 * WhatsApp Status Component
 * Displays WABA status and account information
 */

import React from "react";
import { 
  FaWhatsapp, FaSpinner, FaCheckCircle, FaExclamationCircle, 
  FaTimes, FaPhone, FaShieldVirus, FaBuilding, FaInfoCircle,
  FaVideo
} from "react-icons/fa";

const WhatsAppStatus = ({ 
  user, 
  formData, 
  setFormData, 
  statusData, 
  checkingStatus, 
  fetchWABAStatus 
}) => {
  return (
    <div className="bg-slate-900/80 border border-white/10 backdrop-blur-md rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <FaWhatsapp className="w-6 h-6 text-green-400" />
          </div>
          WhatsApp Business
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchWABAStatus}
            disabled={checkingStatus}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FaSpinner className={checkingStatus ? 'animate-spin' : ''} />
            Refresh Status
          </button>
          <button
            onClick={() => {
              window.location.href = '/distributor-dashboard#/distributor-dashboard?tab=whatsapp&review=true';
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FaVideo className="text-xs" />
            Meta App Review
          </button>
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
                <div className="mt-2 p-2 bg-yellow-900/30 rounded text-xs text-yellow-300">
                  💡 Complete phone verification in Meta Business Suite to start sending messages
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
        </div>
      )}
    </div>
  );
};

export default WhatsAppStatus;
