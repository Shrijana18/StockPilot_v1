/**
 * Send Template Message Component
 * Allows sending pre-approved WhatsApp templates that work outside 24-hour window
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions, db, auth } from '../../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaPaperPlane, FaSpinner, FaInfoCircle, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

// Pre-configured templates from Meta Dashboard
// You can fetch these dynamically via Meta API if needed
const AVAILABLE_TEMPLATES = [
  {
    id: 'account_verification',
    name: 'account_verification',
    displayName: 'Account Verification',
    category: 'Utility',
    language: 'en_US',
    description: 'Send verification message to users',
    preview: 'Hi {{1}}, Your new account has been created...',
    variables: [
      { id: '1', name: 'Customer Name', placeholder: 'John Doe', required: true }
    ]
  },
  {
    id: 'jaspers_market_order_con',
    name: 'jaspers_market_order_con',
    displayName: 'Order Confirmation',
    category: 'Utility', 
    language: 'en_US',
    description: 'Confirm orders to customers',
    preview: 'Hi {{1}}, Thank you for your order...',
    variables: [
      { id: '1', name: 'Customer Name', placeholder: 'John Doe', required: true }
    ]
  },
  {
    id: 'hello_world',
    name: 'hello_world',
    displayName: 'Hello World (Test)',
    category: 'Utility',
    language: 'en_US',
    description: 'Simple test template',
    preview: 'Hello! This is a test message from FLYP.',
    variables: []
  },
];

const SendTemplateMessage = ({ onMessageSent, preSelectedRecipient = null }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [recipientPhone, setRecipientPhone] = useState(preSelectedRecipient || '');
  const [variableValues, setVariableValues] = useState({});
  const [sending, setSending] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [showCustomTemplate, setShowCustomTemplate] = useState(false);
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateLanguage, setCustomTemplateLanguage] = useState('en_US');

  // Check if in test mode and get test recipient
  useEffect(() => {
    const checkTestMode = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const businessDoc = await getDoc(doc(db, 'businesses', user.uid));
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          if (data.whatsappTestMode) {
            setTestMode(true);
            setTestRecipient(data.whatsappTestRecipient || '');
            if (!preSelectedRecipient) {
              setRecipientPhone(data.whatsappTestRecipient || '');
            }
          }
        }
      } catch (err) {
        console.error('Error checking test mode:', err);
      }
    };

    checkTestMode();
  }, [preSelectedRecipient]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    // Initialize variable values
    const initialValues = {};
    template.variables.forEach(v => {
      initialValues[v.id] = '';
    });
    setVariableValues(initialValues);
  };

  const handleVariableChange = (variableId, value) => {
    setVariableValues(prev => ({
      ...prev,
      [variableId]: value
    }));
  };

  const buildTemplateComponents = () => {
    if (!selectedTemplate) return [];
    
    // If no variables, return empty array
    if (selectedTemplate.variables.length === 0) {
      return [];
    }

    // Build body component with parameters
    const parameters = selectedTemplate.variables.map(v => ({
      type: 'text',
      text: variableValues[v.id] || v.placeholder
    }));

    return [
      {
        type: 'body',
        parameters
      }
    ];
  };

  const handleSendTemplate = async () => {
    if (!recipientPhone.trim()) {
      toast.error('Please enter a recipient phone number');
      return;
    }

    const templateToSend = showCustomTemplate 
      ? { name: customTemplateName, language: customTemplateLanguage, variables: [] }
      : selectedTemplate;

    if (!templateToSend || (!templateToSend.name && !customTemplateName)) {
      toast.error('Please select or enter a template');
      return;
    }

    // Validate required variables
    if (!showCustomTemplate && selectedTemplate?.variables) {
      const missingRequired = selectedTemplate.variables.filter(
        v => v.required && !variableValues[v.id]?.trim()
      );
      if (missingRequired.length > 0) {
        toast.error(`Please fill in required fields: ${missingRequired.map(v => v.name).join(', ')}`);
        return;
      }
    }

    setSending(true);

    try {
      const sendMessage = httpsCallable(functions, 'sendMessageViaTechProvider');
      
      const templateData = showCustomTemplate 
        ? {
            name: customTemplateName,
            language: customTemplateLanguage,
            components: []
          }
        : {
            name: selectedTemplate.name,
            language: selectedTemplate.language,
            components: buildTemplateComponents()
          };

      const result = await sendMessage({
        to: recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`,
        message: `Template: ${templateData.name}`, // For logging purposes
        template: templateData,
        options: {
          messageType: 'template'
        }
      });

      if (result.data?.success) {
        toast.success('✅ Template message sent successfully!');
        
        // Reset form
        setSelectedTemplate(null);
        setVariableValues({});
        if (!preSelectedRecipient && !testMode) {
          setRecipientPhone('');
        }
        setCustomTemplateName('');
        setShowCustomTemplate(false);

        if (onMessageSent) {
          onMessageSent(result.data);
        }
      } else {
        toast.error('Failed to send template message');
      }
    } catch (error) {
      console.error('Error sending template:', error);
      const errorMessage = error.message || 'Failed to send template message';
      
      // Provide helpful error messages
      if (errorMessage.includes('template') && errorMessage.includes('not found')) {
        toast.error('Template not found. Make sure the template name matches exactly in Meta Dashboard.');
      } else if (errorMessage.includes('parameter')) {
        toast.error('Template parameters don\'t match. Check the variable count and format.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <FaPaperPlane className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">Send Template Message</h3>
          <p className="text-sm text-gray-400">Templates work anytime - no 24-hour window required!</p>
        </div>
      </div>

      {/* Test Mode Notice */}
      {testMode && (
        <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <FaInfoCircle className="text-purple-400 mt-0.5" />
            <div className="text-sm">
              <p className="text-purple-300 font-medium">Test Mode Active</p>
              <p className="text-purple-200/70">
                Messages can only be sent to: <span className="font-mono text-purple-300">{testRecipient}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 24-Hour Rule Explanation */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-6">
        <div className="flex items-start gap-2">
          <FaInfoCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-200/80">
            <p className="font-semibold text-blue-300 mb-1">Why use Templates?</p>
            <p>WhatsApp requires pre-approved templates for messages outside the 24-hour window. 
            Templates are approved by Meta and can be sent anytime to any user who has opted in.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Recipient Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Recipient Phone Number *
          </label>
          <input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="+918329690931"
            disabled={testMode}
            className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          {testMode && (
            <p className="text-xs text-gray-400 mt-1">
              In test mode, messages can only be sent to the whitelisted number above.
            </p>
          )}
        </div>

        {/* Template Selection Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowCustomTemplate(false)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              !showCustomTemplate 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            📋 Select Template
          </button>
          <button
            onClick={() => setShowCustomTemplate(true)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              showCustomTemplate 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            ✏️ Enter Custom
          </button>
        </div>

        {/* Pre-defined Templates */}
        {!showCustomTemplate && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Template *
            </label>
            <div className="grid gap-3">
              {AVAILABLE_TEMPLATES.map((template) => (
                <motion.button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'bg-purple-900/40 border-purple-500'
                      : 'bg-slate-800/40 border-white/10 hover:border-purple-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{template.displayName}</span>
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                          {template.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{template.description}</p>
                      <p className="text-xs text-gray-500 mt-2 font-mono">
                        Preview: {template.preview}
                      </p>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <FaCheckCircle className="text-purple-400" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Template Name */}
        {showCustomTemplate && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Template Name * (exact match from Meta Dashboard)
              </label>
              <input
                type="text"
                value={customTemplateName}
                onChange={(e) => setCustomTemplateName(e.target.value)}
                placeholder="e.g., hello_world"
                className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Language Code
              </label>
              <select
                value={customTemplateLanguage}
                onChange={(e) => setCustomTemplateLanguage(e.target.value)}
                className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="en_US">English (US)</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="gu">Gujarati</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="kn">Kannada</option>
                <option value="bn">Bengali</option>
              </select>
            </div>
          </div>
        )}

        {/* Template Variables */}
        {!showCustomTemplate && selectedTemplate && selectedTemplate.variables.length > 0 && (
          <div className="bg-slate-800/40 rounded-lg p-4 border border-white/5">
            <p className="text-sm font-medium text-gray-300 mb-3">
              Template Variables
            </p>
            <div className="space-y-3">
              {selectedTemplate.variables.map((variable) => (
                <div key={variable.id}>
                  <label className="block text-xs text-gray-400 mb-1">
                    {`{{${variable.id}}}`} - {variable.name} {variable.required && '*'}
                  </label>
                  <input
                    type="text"
                    value={variableValues[variable.id] || ''}
                    onChange={(e) => handleVariableChange(variable.id, e.target.value)}
                    placeholder={variable.placeholder}
                    className="w-full bg-slate-700/50 border border-white/10 text-white placeholder-gray-500 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Send Button */}
        <motion.button
          onClick={handleSendTemplate}
          disabled={sending || (!selectedTemplate && !customTemplateName) || !recipientPhone}
          whileHover={{ scale: sending ? 1 : 1.02 }}
          whileTap={{ scale: sending ? 1 : 0.98 }}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
        >
          {sending ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Sending Template...</span>
            </>
          ) : (
            <>
              <FaPaperPlane />
              <span>Send Template Message</span>
            </>
          )}
        </motion.button>

        {/* Warning for non-template messages */}
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <FaExclamationTriangle className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-200/80">
              <strong>Note:</strong> Only pre-approved templates from your Meta Dashboard will work. 
              Make sure the template name matches exactly and is in "Active" status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendTemplateMessage;
