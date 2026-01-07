/**
 * Meta App Review Dashboard
 * Temporary Review Dashboard for recording screencasts for Meta's App Review
 * 
 * Flow:
 * 1. Connection Stage: Embedded Signup to connect WABA
 * 2. Messaging Module: Send messages using whatsapp_business_messaging API
 * 3. Management Module: Create message templates using whatsapp_business_management API
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { 
  FaWhatsapp, 
  FaCheckCircle, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaPaperPlane,
  FaFileAlt,
  FaLink,
  FaVideo,
  FaArrowRight,
  FaInfoCircle,
  FaPhone,
  FaBuilding
} from 'react-icons/fa';
import EmbeddedSignup from './EmbeddedSignup';
import { sendWhatsAppMessage } from '../../../services/whatsappService';

const MetaAppReviewDemo = ({ embedded = false, onSetupComplete }) => {
  const [activeStage, setActiveStage] = useState('connection'); // connection, messaging, management
  const [wabaConnected, setWabaConnected] = useState(false);
  const [wabaInfo, setWabaInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  
  // Messaging state
  const [messageRecipient, setMessageRecipient] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  
  // Template creation state
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('UTILITY');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [templateBody, setTemplateBody] = useState('');
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateCreated, setTemplateCreated] = useState(false);

  const distributorId = auth.currentUser?.uid;

  // Check if WABA is already connected
  useEffect(() => {
    checkWABAConnection();
  }, [distributorId]);

  const checkWABAConnection = async () => {
    if (!distributorId) return;

    try {
      const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
      if (businessDoc.exists()) {
        const data = businessDoc.data();
        if (data.whatsappBusinessAccountId && data.whatsappPhoneNumberId) {
          setWabaConnected(true);
          setWabaInfo({
            wabaId: data.whatsappBusinessAccountId,
            phoneNumberId: data.whatsappPhoneNumberId,
            phoneNumber: data.whatsappPhoneNumber
          });
        }
      }
    } catch (error) {
      console.error('Error checking WABA connection:', error);
    }
  };

  const handleWABASetupComplete = async (result) => {
    if (result?.success) {
      setWabaConnected(true);
      setWabaInfo({
        wabaId: result.wabaId,
        phoneNumberId: result.phoneNumberId,
        phoneNumber: result.phoneNumber
      });
      toast.success('✅ WhatsApp Business Account connected!');
      // Move to messaging stage
      setActiveStage('messaging');
    }
  };

  const handleSendMessage = async () => {
    if (!messageRecipient || !messageText.trim()) {
      toast.error('Please enter recipient phone number and message');
      return;
    }

    if (!distributorId) {
      toast.error('Please log in to continue');
      return;
    }

    setSendingMessage(true);
    try {
      // Format phone number
      let formattedPhone = messageRecipient.replace(/[^0-9+]/g, '');
      if (!formattedPhone.startsWith('+')) {
        const cleaned = formattedPhone.replace(/^91/, '').replace(/^0/, '');
        formattedPhone = `+91${cleaned}`;
      }

      // Send message
      const result = await sendWhatsAppMessage(
        distributorId,
        formattedPhone,
        messageText,
        {
          messageType: 'review_demo',
          metadata: {
            demoMode: true,
            api: 'whatsapp_business_messaging'
          }
        }
      );

      if (result.success) {
        setMessageSent(true);
        const messageId = result.messageId || 'N/A';
        toast.success(`✅ Message sent successfully! Message ID: ${messageId}`);
        
        // Show detailed success info
        console.log('Message sent successfully:', {
          messageId,
          method: result.method,
          canTrackStatus: result.canTrackStatus,
          recipient: formattedPhone
        });
        
        // Show success for 5 seconds with delivery info
        setTimeout(() => {
          setMessageSent(false);
          setMessageText('');
        }, 5000);
      } else {
        // Enhanced error handling
        const errorMsg = result.error || 'Failed to send message';
        const errorCode = result.errorCode;
        
        let userMessage = errorMsg;
        if (errorCode === 'RECIPIENT_NOT_ALLOWED') {
          userMessage = 'Recipient phone number not in allowed list. Add this number to your WABA\'s allowed list in Meta Business Suite.';
        } else if (errorCode === 'PERMISSION_DENIED') {
          userMessage = 'App does not have permission. Request Production Access in Meta Business Suite.';
        }
        
        throw new Error(userMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !templateBody.trim()) {
      toast.error('Please fill in template name and body');
      return;
    }

    if (!distributorId || !wabaInfo?.wabaId) {
      toast.error('WABA not connected. Please connect first.');
      return;
    }

    setCreatingTemplate(true);
    try {
      const createTemplate = httpsCallable(functions, 'createWhatsAppMessageTemplate');
      const result = await createTemplate({
        wabaId: wabaInfo.wabaId,
        name: templateName,
        category: templateCategory,
        language: templateLanguage,
        body: templateBody
      });

      if (result.data?.success) {
        setTemplateCreated(true);
        toast.success('✅ Message template created successfully!');
        // Reset form after 3 seconds
        setTimeout(() => {
          setTemplateCreated(false);
          setTemplateName('');
          setTemplateBody('');
        }, 3000);
      } else {
        throw new Error(result.data?.error || 'Failed to create template');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error(error.message || 'Failed to create message template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6'}`}>
      <div className={`${embedded ? '' : 'max-w-6xl mx-auto'}`}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={embedded ? 'mb-6' : 'mb-8'}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={`${embedded ? 'text-2xl' : 'text-4xl'} font-bold text-white mb-2`}>
                Meta App Review Dashboard
              </h1>
              <p className="text-gray-400">
                Review flow for WhatsApp Business API integration
              </p>
            </div>
            {!embedded && (
              <button
                onClick={() => setRecording(!recording)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  recording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                <FaVideo />
                {recording ? '🔴 Recording...' : 'Start Recording'}
              </button>
            )}
          </div>

          {/* Stage Navigation */}
          <div className="flex items-center gap-4 bg-slate-800/50 rounded-lg p-4 border border-white/10">
            <button
              onClick={() => setActiveStage('connection')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStage === 'connection'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {wabaConnected ? <FaCheckCircle /> : <FaLink />}
                <span>1. Connection</span>
              </div>
            </button>
            <FaArrowRight className="text-gray-400" />
            <button
              onClick={() => setActiveStage('messaging')}
              disabled={!wabaConnected}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStage === 'messaging'
                  ? 'bg-emerald-600 text-white'
                  : wabaConnected
                  ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  : 'bg-slate-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FaPaperPlane />
                <span>2. Messaging</span>
              </div>
            </button>
            <FaArrowRight className="text-gray-400" />
            <button
              onClick={() => setActiveStage('management')}
              disabled={!wabaConnected}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStage === 'management'
                  ? 'bg-purple-600 text-white'
                  : wabaConnected
                  ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  : 'bg-slate-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FaFileAlt />
                <span>3. Management</span>
              </div>
            </button>
          </div>
        </motion.div>

        {/* Stage Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-8 border border-white/10 shadow-2xl"
          >
            {/* Connection Stage */}
            {activeStage === 'connection' && (
              <ConnectionStage
                wabaConnected={wabaConnected}
                wabaInfo={wabaInfo}
                onSetupComplete={handleWABASetupComplete}
              />
            )}

            {/* Messaging Stage */}
            {activeStage === 'messaging' && wabaConnected && (
              <MessagingStage
                wabaInfo={wabaInfo}
                messageRecipient={messageRecipient}
                setMessageRecipient={setMessageRecipient}
                messageText={messageText}
                setMessageText={setMessageText}
                sendingMessage={sendingMessage}
                messageSent={messageSent}
                onSendMessage={handleSendMessage}
              />
            )}

            {/* Management Stage */}
            {activeStage === 'management' && wabaConnected && (
              <ManagementStage
                wabaInfo={wabaInfo}
                templateName={templateName}
                setTemplateName={setTemplateName}
                templateCategory={templateCategory}
                setTemplateCategory={setTemplateCategory}
                templateLanguage={templateLanguage}
                setTemplateLanguage={setTemplateLanguage}
                templateBody={templateBody}
                setTemplateBody={setTemplateBody}
                creatingTemplate={creatingTemplate}
                templateCreated={templateCreated}
                onCreateTemplate={handleCreateTemplate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// Connection Stage Component
const ConnectionStage = ({ wabaConnected, wabaInfo, onSetupComplete }) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <FaLink />
          Stage 1: Connect WhatsApp Business Account
        </h2>
        <p className="text-gray-300 mb-4">
          Use Meta's Embedded Signup flow to connect your WhatsApp Business Account.
          This will store the WABA_ID and Phone_Number_ID for use in messaging and management features.
        </p>

        {wabaConnected ? (
          <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <FaCheckCircle className="text-3xl text-emerald-400" />
              <div>
                <h3 className="text-xl font-bold text-white">Connected!</h3>
                <p className="text-gray-300">WhatsApp Business Account is ready</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">WABA ID:</span>
                <span className="text-white font-mono">{wabaInfo?.wabaId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phone Number ID:</span>
                <span className="text-white font-mono">{wabaInfo?.phoneNumberId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Phone Number:</span>
                <span className="text-white font-mono">{wabaInfo?.phoneNumber}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-900/30 rounded-lg">
              <p className="text-sm text-blue-200">
                ✅ <strong>Data Stored:</strong> WABA_ID and Phone_Number_ID have been saved to your account.
                You can now proceed to the Messaging and Management stages.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <EmbeddedSignup onSetupComplete={onSetupComplete} />
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-200">
                <FaInfoCircle className="inline mr-2" />
                <strong>For Review:</strong> Click "Connect with Facebook" to start the Embedded Signup flow.
                After connection, WABA_ID and Phone_Number_ID will be automatically stored.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Messaging Stage Component
const MessagingStage = ({
  wabaInfo,
  messageRecipient,
  setMessageRecipient,
  messageText,
  setMessageText,
  sendingMessage,
  messageSent,
  onSendMessage
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <FaPaperPlane />
          Stage 2: Send Message (whatsapp_business_messaging API)
        </h2>
        <p className="text-gray-300 mb-4">
          Send a WhatsApp message to demonstrate the <strong>whatsapp_business_messaging</strong> API.
          Enter a phone number from your WABA's allowed list and send a test message.
        </p>

        <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Connected WABA
            </label>
            <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
              <FaBuilding className="text-emerald-400" />
              <span className="text-white font-mono text-sm">{wabaInfo?.wabaId}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recipient Phone Number
            </label>
            <input
              type="text"
              value={messageRecipient}
              onChange={(e) => setMessageRecipient(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter a phone number that's added to your WABA's allowed list
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message Text
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <button
            onClick={onSendMessage}
            disabled={sendingMessage || messageSent || !messageRecipient || !messageText.trim()}
            className={`w-full px-6 py-4 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 ${
              messageSent
                ? 'bg-emerald-600'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {sendingMessage ? (
              <>
                <FaSpinner className="animate-spin" />
                Sending...
              </>
            ) : messageSent ? (
              <>
                <FaCheckCircle />
                Message Sent Successfully!
              </>
            ) : (
              <>
                <FaPaperPlane />
                Send Message via whatsapp_business_messaging API
              </>
            )}
          </button>

          {messageSent && (
            <div className="p-4 bg-emerald-900/30 border border-emerald-500/50 rounded-lg">
              <p className="text-sm text-emerald-200">
                ✅ <strong>Success!</strong> Message sent using whatsapp_business_messaging API.
                Check the recipient's phone to verify delivery. This demonstrates the messaging capability.
              </p>
            </div>
          )}

          <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg space-y-2">
            <p className="text-sm text-blue-200">
              <FaInfoCircle className="inline mr-2" />
              <strong>For Review:</strong> Record this step showing the message being sent and received on a real phone.
              This proves the whatsapp_business_messaging API integration works end-to-end.
            </p>
            <div className="text-xs text-blue-300/80 space-y-1 mt-2">
              <p><strong>Message Delivery Troubleshooting:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Ensure recipient phone is in WABA's allowed list (Meta Business Suite → WhatsApp → API Setup)</li>
                <li>Check if WABA has production access (not just development mode)</li>
                <li>Verify phone number format: +91XXXXXXXXXX (10 digits after +91)</li>
                <li>Check message status in History tab for delivery updates</li>
                <li>If error #131030: Add recipient to allowed list in Meta Business Suite</li>
                <li>If error #10: Request Production Access in Meta App Review</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Management Stage Component
const ManagementStage = ({
  wabaInfo,
  templateName,
  setTemplateName,
  templateCategory,
  setTemplateCategory,
  templateLanguage,
  setTemplateLanguage,
  templateBody,
  setTemplateBody,
  creatingTemplate,
  templateCreated,
  onCreateTemplate
}) => {
  const templateCategories = [
    { value: 'UTILITY', label: 'Utility' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'AUTHENTICATION', label: 'Authentication' }
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'en_US', label: 'English (US)' },
    { value: 'en_GB', label: 'English (UK)' },
    { value: 'hi', label: 'Hindi' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <FaFileAlt />
          Stage 3: Create Message Template (whatsapp_business_management API)
        </h2>
        <p className="text-gray-300 mb-4">
          Create a WhatsApp message template to demonstrate the <strong>whatsapp_business_management</strong> API.
          Templates must be approved by Meta before use.
        </p>

        <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Connected WABA
            </label>
            <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
              <FaBuilding className="text-purple-400" />
              <span className="text-white font-mono text-sm">{wabaInfo?.wabaId}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., order_status_update"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use lowercase letters, numbers, and underscores only
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {templateCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Language *
              </label>
              <select
                value={templateLanguage}
                onChange={(e) => setTemplateLanguage(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Template Body *
            </label>
            <textarea
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              placeholder="Enter your template message text here..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Use {'{{1}}'} for variables. Example: "Hello {'{{1}}'}, your order {'{{2}}'} is ready!"
            </p>
          </div>

          <button
            onClick={onCreateTemplate}
            disabled={creatingTemplate || templateCreated || !templateName.trim() || !templateBody.trim()}
            className={`w-full px-6 py-4 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 ${
              templateCreated
                ? 'bg-purple-600'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {creatingTemplate ? (
              <>
                <FaSpinner className="animate-spin" />
                Creating Template...
              </>
            ) : templateCreated ? (
              <>
                <FaCheckCircle />
                Template Created Successfully!
              </>
            ) : (
              <>
                <FaFileAlt />
                Create Template via whatsapp_business_management API
              </>
            )}
          </button>

          {templateCreated && (
            <div className="p-4 bg-purple-900/30 border border-purple-500/50 rounded-lg">
              <p className="text-sm text-purple-200">
                ✅ <strong>Success!</strong> Template created using whatsapp_business_management API.
                The template will be submitted to Meta for approval.
              </p>
            </div>
          )}

          <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-200">
              <FaInfoCircle className="inline mr-2" />
              <strong>For Review:</strong> Record this step showing the template creation form and API call.
              This proves the whatsapp_business_management API integration works.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaAppReviewDemo;
