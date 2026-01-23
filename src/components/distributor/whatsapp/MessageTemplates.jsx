/**
 * Message Templates Component
 * Manage and create beautiful WhatsApp message templates with images, videos, and links
 * Similar to Pizza Hut style messaging
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, serverTimestamp, orderBy, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { sendWhatsAppMessage, getWhatsAppConfig } from '../../../services/whatsappService';
import { 
  FaImage, FaVideo, FaLink, FaSave, FaTrash, FaEdit, FaPlus,
  FaTimes, FaCopy, FaCheck, FaWhatsapp
} from 'react-icons/fa';

const TEMPLATE_TYPES = {
  STOCK_REMINDER: 'stock_reminder',
  PRICE_CHANGE: 'price_change',
  PRODUCT_UPDATE: 'product_update',
  PROMOTIONAL: 'promotional',
  CUSTOM: 'custom'
};

// Generate message from template with variables (exported for use in other components)
export const generateMessage = (template, variables = {}) => {
  let message = template.message || '';
  
  // Replace variables
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    message = message.replace(regex, variables[key] || '');
  });

  // Add title if exists
  if (template.title) {
    message = `*${template.title}*\n\n${message}`;
  }

  // Add link if exists
  if (template.linkUrl && template.linkText) {
    message += `\n\n🔗 ${template.linkText}: ${template.linkUrl}`;
  }

  return message;
};

const MessageTemplates = ({ onTemplateSelect, mode = 'manage' }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedQuickTemplate, setSelectedQuickTemplate] = useState(null);
  const [selectedQuickRetailers, setSelectedQuickRetailers] = useState(new Set());
  const [quickSending, setQuickSending] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const [customPhoneInput, setCustomPhoneInput] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    type: TEMPLATE_TYPES.STOCK_REMINDER,
    title: '',
    message: '',
    imageUrl: '',
    videoUrl: '',
    linkUrl: '',
    linkText: '',
    variables: [], // e.g., {productName}, {price}, {stock}
    metaApprovalStatus: 'not_required', // 'not_required', 'pending', 'approved', 'rejected', 'verified'
    metaTemplateName: '', // Meta-approved template name (if verified)
  });

  const distributorId = auth.currentUser?.uid;

  // Default templates to initialize
  const defaultTemplates = [
    {
      name: 'Stock Reminder - Low Stock Alert',
      type: TEMPLATE_TYPES.STOCK_REMINDER,
      title: '📦 Stock Reminder',
      message: `Hello!\n\nYour product *{productName}* is running low on stock.\n\n📊 Current Stock: {stock}\n\n💡 We recommend placing an order soon to avoid stockout.\n\nReply to this message to place your order!\n\n_Powered by FLYP_`,
      variables: ['productName', 'stock'],
      metaApprovalStatus: 'not_required', // Can be marked as 'verified' if already approved by Meta
      metaTemplateName: '', // Meta template name if verified
    },
    {
      name: 'Price Change Notification',
      type: TEMPLATE_TYPES.PRICE_CHANGE,
      title: '💰 Price Update',
      message: `Hello!\n\nWe have an important update regarding *{productName}*:\n\n💰 *New Price:* {newPrice}\n~~Old Price: {oldPrice}~~\n\n📉 *Discount:* {discount}%\n\n🛒 Order now to avail this special price!\n\n_Powered by FLYP_`,
      variables: ['productName', 'oldPrice', 'newPrice', 'discount'],
      metaApprovalStatus: 'not_required',
      metaTemplateName: '',
    },
    {
      name: 'Product Update Announcement',
      type: TEMPLATE_TYPES.PRODUCT_UPDATE,
      title: '🆕 Product Update',
      message: `Hello!\n\nWe have exciting news about *{productName}*:\n\n✨ {updateDetails}\n\n📦 *Price:* {price}\n📊 *Stock Available:* {stock}\n\nInterested? Reply to this message to place your order!\n\n_Powered by FLYP_`,
      variables: ['productName', 'updateDetails', 'price', 'stock'],
      metaApprovalStatus: 'not_required',
      metaTemplateName: '',
    },
    {
      name: 'Special Offer - Promotional',
      type: TEMPLATE_TYPES.PROMOTIONAL,
      title: '🎉 Special Offer!',
      message: `Hello!\n\n🎉 *{offerTitle}*\n\n{offerDescription}\n\n💰 *Discount:* {discount}\n📅 *Valid Until:* {validUntil}\n\n🛒 Don't miss out on this amazing deal!\n\nReply to this message to place your order!\n\n_Powered by FLYP_`,
      variables: ['offerTitle', 'offerDescription', 'discount', 'validUntil'],
      metaApprovalStatus: 'not_required',
      metaTemplateName: '',
    },
    {
      name: 'Bulk Stock Reminder',
      type: TEMPLATE_TYPES.STOCK_REMINDER,
      title: '📦 Multiple Products Low Stock',
      message: `Hello!\n\nYou have *{productCount} products* running low on stock:\n\n{productList}\n\n💡 We recommend placing an order soon to avoid stockout.\n\nReply to this message to place your order!\n\n_Powered by FLYP_`,
      variables: ['productCount', 'productList'],
      metaApprovalStatus: 'not_required',
      metaTemplateName: '',
    }
  ];

  // Initialize default templates if none exist
  const initializeDefaultTemplates = async () => {
    if (!distributorId) return false;

    try {
      const templatesRef = collection(db, 'businesses', distributorId, 'whatsappTemplates');
      const snapshot = await getDocs(templatesRef);
      
      // Only initialize if no templates exist
      if (snapshot.empty) {
        console.log('📝 Initializing default templates for distributor:', distributorId);
        
        // Add all default templates in parallel for faster creation
        const promises = defaultTemplates.map(template => 
          addDoc(templatesRef, {
            ...template,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isDefault: true, // Mark as default template
          })
        );
        
        await Promise.all(promises);
        
        console.log('✅ Default templates created successfully');
        toast.success('✅ Default templates created! You can customize them anytime.');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error initializing default templates:', error);
      // Show error to help debug
      toast.error(`Failed to create default templates: ${error.message}`);
      return false;
    }
  };

  // Load templates and initialize defaults
  useEffect(() => {
    if (!distributorId) return;

    let initializationAttempted = false;

    const initializeIfNeeded = async () => {
      if (initializationAttempted) return;
      initializationAttempted = true;
      
      try {
        const templatesRef = collection(db, 'businesses', distributorId, 'whatsappTemplates');
        const snapshot = await getDocs(templatesRef);
        
        console.log('🔍 Checking for existing templates...', snapshot.empty ? 'None found' : `Found ${snapshot.size} templates`);
        
        if (snapshot.empty) {
          console.log('📝 No templates found, initializing defaults...');
          const initialized = await initializeDefaultTemplates();
          if (initialized) {
            console.log('✅ Default templates initialization completed');
          }
        }
      } catch (error) {
        console.error('❌ Error checking/initializing templates:', error);
        toast.error(`Template initialization error: ${error.message}`);
      }
    };

    // Set up real-time listener first
    const templatesRef = collection(db, 'businesses', distributorId, 'whatsappTemplates');
    const q = query(templatesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const templatesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📋 Templates loaded from Firestore:', templatesList.length);
      
      // If no templates, try to initialize
      if (templatesList.length === 0 && !initializationAttempted) {
        console.log('🔄 Listener detected no templates, initializing...');
        await initializeIfNeeded();
        // Templates will appear on next snapshot update
        return;
      }
      
      setTemplates(templatesList);
      setLoading(false);
    }, (error) => {
      console.error('❌ Error in template listener:', error);
      setLoading(false);
      
      // If permission error, try initialization anyway (might work)
      if (error.code === 'permission-denied') {
        console.log('⚠️ Permission denied, but attempting initialization...');
        initializeIfNeeded();
      }
    });

    // Also check immediately (in case listener is slow)
    initializeIfNeeded();

    return () => unsubscribe();
  }, [distributorId]);

  // Load retailers for quick send
  useEffect(() => {
    if (!distributorId || mode !== 'manage') return;

    const loadRetailers = async () => {
      try {
        const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
        const snapshot = await getDocs(retailersRef);
        
        const retailerPromises = snapshot.docs.map(async (retailerDoc) => {
          const data = retailerDoc.data();
          const retailerId = retailerDoc.id;
          
          let phone = data.phone || data.retailerPhone || '';
          
          if (!phone && retailerId) {
            try {
              const retailerDocRef = doc(db, 'businesses', retailerId);
              const retailerDocSnap = await getDoc(retailerDocRef);
              if (retailerDocSnap.exists()) {
                const retailerData = retailerDocSnap.data();
                phone = retailerData.phone || retailerData.ownerPhone || '';
              }
            } catch (err) {
              console.warn('Could not fetch phone:', err);
            }
          }
          
          return {
            id: retailerId,
            ...data,
            phone: phone,
            businessName: data.businessName || data.retailerName || '',
          };
        });
        
        const retailerList = await Promise.all(retailerPromises);
        setRetailers(retailerList);
      } catch (error) {
        console.error('Error loading retailers:', error);
      }
    };

    loadRetailers();
  }, [distributorId, mode]);

  // Handle image upload
  const handleImageUpload = async (file) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const imageRef = ref(storage, `whatsapp-templates/${distributorId}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      setFormData(prev => ({ ...prev, imageUrl: url }));
      toast.success('✅ Image uploaded!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('❌ Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Handle video upload
  const handleVideoUpload = async (file) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const videoRef = ref(storage, `whatsapp-templates/${distributorId}/${Date.now()}_${file.name}`);
      await uploadBytes(videoRef, file);
      const url = await getDownloadURL(videoRef);
      setFormData(prev => ({ ...prev, videoUrl: url }));
      toast.success('✅ Video uploaded!');
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('❌ Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!formData.name || !formData.message) {
      toast.error('Please fill in template name and message');
      return;
    }

    try {
      const templateData = {
        ...formData,
        createdAt: editingTemplate ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editingTemplate) {
        await updateDoc(
          doc(db, 'businesses', distributorId, 'whatsappTemplates', editingTemplate.id),
          templateData
        );
        toast.success('✅ Template updated!');
      } else {
        await addDoc(
          collection(db, 'businesses', distributorId, 'whatsappTemplates'),
          templateData
        );
        toast.success('✅ Template created!');
      }

      setShowCreateModal(false);
      setEditingTemplate(null);
      setFormData({
        name: '',
        type: TEMPLATE_TYPES.STOCK_REMINDER,
        title: '',
        message: '',
        imageUrl: '',
        videoUrl: '',
        linkUrl: '',
        linkText: '',
        variables: []
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('❌ Failed to save template');
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId, imageUrl, videoUrl) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'businesses', distributorId, 'whatsappTemplates', templateId));

      // Delete image from storage if exists
      if (imageUrl) {
        try {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        } catch (err) {
          console.warn('Could not delete image:', err);
        }
      }

      // Delete video from storage if exists
      if (videoUrl) {
        try {
          const videoRef = ref(storage, videoUrl);
          await deleteObject(videoRef);
        } catch (err) {
          console.warn('Could not delete video:', err);
        }
      }

      toast.success('✅ Template deleted!');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('❌ Failed to delete template');
    }
  };

  // Edit template
  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      type: template.type || TEMPLATE_TYPES.STOCK_REMINDER,
      title: template.title || '',
      message: template.message || '',
      imageUrl: template.imageUrl || '',
      videoUrl: template.videoUrl || '',
      linkUrl: template.linkUrl || '',
      linkText: template.linkText || '',
      variables: template.variables || [],
      metaApprovalStatus: template.metaApprovalStatus || 'not_required',
      metaTemplateName: template.metaTemplateName || '',
    });
    setShowCreateModal(true);
  };


  // Select template (for QuickSend mode)
  const handleSelectTemplate = (template) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  // Quick Send - Send template directly
  const handleQuickSend = async () => {
    if (!selectedQuickTemplate) {
      toast.error('Please select a template');
      return;
    }

    const retailersToSend = retailers.filter(r => 
      selectedQuickRetailers.has(r.id) && r.phone
    );
    
    const customNumbers = customPhoneInput.trim().split(',').map(p => p.trim()).filter(p => p.length >= 10);
    
    if (retailersToSend.length === 0 && customNumbers.length === 0) {
      toast.error('Please select at least one retailer or enter phone numbers');
      return;
    }

    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.warning('WhatsApp not configured. Please set it up in Profile Settings.');
      return;
    }

    setQuickSending(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Send to selected retailers
      for (const retailer of retailersToSend) {
        try {
          const message = generateMessage(selectedQuickTemplate, {
            retailerName: retailer.businessName || 'Retailer'
          });
          
          const result = await sendWhatsAppMessage(
            distributorId,
            retailer.phone,
            message,
            {
              messageType: selectedQuickTemplate.type || 'custom',
              metadata: {
                templateId: selectedQuickTemplate.id,
                templateName: selectedQuickTemplate.name,
                imageUrl: selectedQuickTemplate.imageUrl,
                videoUrl: selectedQuickTemplate.videoUrl,
                linkUrl: selectedQuickTemplate.linkUrl,
                retailerId: retailer.id,
                retailerName: retailer.businessName,
              },
              logMessage: true,
            }
          );

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error sending message:', error);
          failCount++;
        }
      }

      // Send to custom phone numbers
      for (const phone of customNumbers) {
        try {
          const message = generateMessage(selectedQuickTemplate, {});
          
          const result = await sendWhatsAppMessage(
            distributorId,
            phone,
            message,
            {
              messageType: selectedQuickTemplate.type || 'custom',
              metadata: {
                templateId: selectedQuickTemplate.id,
                templateName: selectedQuickTemplate.name,
              },
              logMessage: true,
            }
          );

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error sending message:', error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`✅ Successfully sent to ${successCount} recipient(s)!`);
        setSelectedQuickTemplate(null);
        setSelectedQuickRetailers(new Set());
        setCustomPhoneInput('');
      }

      if (failCount > 0) {
        toast.warning(`⚠️ Failed to send to ${failCount} recipient(s)`);
      }
    } catch (error) {
      console.error('Error in quick send:', error);
      toast.error('❌ Failed to send messages');
    } finally {
      setQuickSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎨</span>
          <div>
            <h2 className="text-xl font-semibold text-white">
              Message Templates
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Create beautiful templates with images, videos, and links
            </p>
          </div>
        </div>
        {mode === 'manage' && (
          <button
            onClick={() => {
              setEditingTemplate(null);
              setFormData({
                name: '',
                type: TEMPLATE_TYPES.STOCK_REMINDER,
                title: '',
                message: '',
                imageUrl: '',
                videoUrl: '',
                linkUrl: '',
                linkText: '',
                variables: []
              });
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
          >
            <FaPlus /> Create Template
          </button>
        )}
      </div>

      {/* Quick Send Section - Ready to Use Templates */}
      {mode === 'manage' && templates.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-900/20 via-teal-900/10 to-cyan-900/20 border border-emerald-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <span>⚡</span>
                Quick Send - Ready to Use Templates
              </h3>
              <p className="text-sm text-gray-400">
                Select a template, choose retailers/phone numbers, and send instantly - No setup needed!
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Template Selection - Always Visible */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Step 1: Choose a Template
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.slice(0, 6).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedQuickTemplate(template);
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedQuickTemplate?.id === template.id
                        ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/50'
                        : 'bg-slate-800/60 border-white/10 hover:border-emerald-500/30 hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-white text-sm flex-1">{template.name}</h4>
                      {selectedQuickTemplate?.id === template.id && (
                        <FaCheck className="text-emerald-400 flex-shrink-0 ml-2" />
                      )}
                    </div>
                    {template.title && (
                      <p className="text-xs text-gray-300 mb-1">*{template.title}*</p>
                    )}
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">{template.message}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                        {template.type?.replace('_', ' ')}
                      </span>
                      {template.isDefault && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                      {template.metaApprovalStatus === 'verified' && (
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <FaCheck className="text-[10px]" />
                          Meta Verified
                        </span>
                      )}
                      {template.metaApprovalStatus === 'pending' && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">
                          ⏳ Pending Approval
                        </span>
                      )}
                      {template.metaApprovalStatus === 'rejected' && (
                        <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                          ❌ Rejected
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Retailer Selection */}
            {selectedQuickTemplate && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <label className="block text-sm font-medium text-gray-300">
                  Step 2: Select Retailers or Enter Phone Numbers
                </label>
                  <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg p-3 bg-slate-800/40 space-y-2">
                    {retailers.length === 0 ? (
                      <p className="text-sm text-gray-400">No retailers connected</p>
                    ) : (
                      retailers.map((retailer) => {
                        const hasPhone = !!retailer.phone;
                        return (
                          <label
                            key={retailer.id}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                              !hasPhone
                                ? 'opacity-60 cursor-not-allowed'
                                : selectedQuickRetailers.has(retailer.id)
                                ? 'bg-emerald-500/20'
                                : 'hover:bg-slate-700/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedQuickRetailers.has(retailer.id)}
                              onChange={(e) => {
                                if (!hasPhone) return;
                                const newSet = new Set(selectedQuickRetailers);
                                if (e.target.checked) {
                                  newSet.add(retailer.id);
                                } else {
                                  newSet.delete(retailer.id);
                                }
                                setSelectedQuickRetailers(newSet);
                              }}
                              disabled={!hasPhone}
                              className="rounded"
                            />
                            <span className="text-sm text-white flex-1">
                              {retailer.businessName || 'Retailer'}
                            </span>
                            {!hasPhone && (
                              <span className="text-xs text-red-400">No Phone</span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Custom Phone Numbers */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Or Enter Phone Numbers (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={customPhoneInput}
                      onChange={(e) => setCustomPhoneInput(e.target.value)}
                      placeholder="+918329690931, +919876543210"
                      className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                  </div>

                {/* Meta Template Info */}
                {selectedQuickTemplate && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs">
                    <p className="text-blue-300 mb-1">
                      <strong>📋 Template Status:</strong>
                    </p>
                    {selectedQuickTemplate.metaApprovalStatus === 'verified' ? (
                      <p className="text-green-300">
                        ✅ This template is Meta-verified and can be sent to any recipient (even outside 24-hour window)
                      </p>
                    ) : selectedQuickTemplate.metaApprovalStatus === 'pending' ? (
                      <p className="text-yellow-300">
                        ⏳ This template is pending Meta approval. It will be sent as a session message (only to users who messaged you in last 24 hours).
                      </p>
                    ) : (
                      <p className="text-gray-300">
                        ℹ️ This template will be sent as a <strong>session message</strong> (only to users who messaged you in the last 24 hours). To send to anyone, mark it as "Verified by Meta" and add the Meta template name.
                      </p>
                    )}
                  </div>
                )}

                {/* Send Button */}
                <div className="pt-2">
                  <button
                    onClick={handleQuickSend}
                    disabled={quickSending || (selectedQuickRetailers.size === 0 && !customPhoneInput.trim())}
                    className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {quickSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FaWhatsapp />
                        Send to {selectedQuickRetailers.size + (customPhoneInput.trim() ? customPhoneInput.split(',').filter(p => p.trim().length >= 10).length : 0)} Recipient(s)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Separator */}
      {mode === 'manage' && templates.length > 0 && (
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <span className="text-xs text-gray-400 uppercase tracking-wider">Or Manage Templates</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>
      )}

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-slate-900/80 border border-white/10 rounded-xl p-12 text-center">
          <FaWhatsapp className="text-[#8696a0] text-5xl mx-auto mb-4" />
          <h3 className="text-white text-lg font-semibold mb-2">No Templates Yet</h3>
          <p className="text-[#8696a0] mb-4">
            {mode === 'manage' 
              ? 'Create default templates to get started, or create your own custom template'
              : 'Create your first template to start sending beautiful messages'}
          </p>
          {mode === 'manage' && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={async () => {
                  setLoading(true);
                  const initialized = await initializeDefaultTemplates();
                  if (initialized) {
                    // Templates will appear via the listener
                    setTimeout(() => setLoading(false), 2000);
                  } else {
                    setLoading(false);
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold flex items-center gap-2"
              >
                <FaPlus /> Create Default Templates
              </button>
              <span className="text-gray-500">or</span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold"
              >
                Create Custom Template
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-slate-900/80 border border-white/10 rounded-xl overflow-hidden ${
                mode === 'select' ? 'cursor-pointer hover:border-emerald-500/50' : ''
              }`}
              onClick={mode === 'select' ? () => handleSelectTemplate(template) : undefined}
            >
              {/* Image/Video Preview */}
              {template.imageUrl && (
                <div className="relative h-40 bg-slate-800">
                  <img 
                    src={template.imageUrl} 
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                    <FaImage /> Image
                  </div>
                </div>
              )}
              {template.videoUrl && !template.imageUrl && (
                <div className="relative h-40 bg-slate-800 flex items-center justify-center">
                  <FaVideo className="text-4xl text-gray-400" />
                  <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                    <FaVideo /> Video
                  </div>
                </div>
              )}

              {/* Template Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      {template.isDefault && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded" title="Default template - you can customize it">
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded">
                      {template.type?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {template.title && (
                  <p className="text-sm text-gray-300 mb-2">*{template.title}*</p>
                )}
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                  {template.message}
                </p>
                
                {/* Features */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                  {template.imageUrl && <span className="flex items-center gap-1"><FaImage /> Image</span>}
                  {template.videoUrl && <span className="flex items-center gap-1"><FaVideo /> Video</span>}
                  {template.linkUrl && <span className="flex items-center gap-1"><FaLink /> Link</span>}
                </div>

                {/* Meta Approval Status */}
                {mode === 'manage' && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Meta Approval:</span>
                      <select
                        value={template.metaApprovalStatus || 'not_required'}
                        onChange={async (e) => {
                          try {
                            await updateDoc(
                              doc(db, 'businesses', distributorId, 'whatsappTemplates', template.id),
                              { 
                                metaApprovalStatus: e.target.value,
                                updatedAt: serverTimestamp()
                              }
                            );
                            toast.success('✅ Approval status updated');
                          } catch (error) {
                            console.error('Error updating approval status:', error);
                            toast.error('❌ Failed to update status');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs bg-slate-800/60 border border-white/10 text-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="not_required">Not Required (Session Message)</option>
                        <option value="pending">Pending Approval</option>
                        <option value="verified">Verified by Meta</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    {template.metaApprovalStatus === 'verified' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Meta Template Name (e.g., stock_reminder_v1)"
                          value={template.metaTemplateName || ''}
                          onChange={async (e) => {
                            try {
                              await updateDoc(
                                doc(db, 'businesses', distributorId, 'whatsappTemplates', template.id),
                                { 
                                  metaTemplateName: e.target.value,
                                  updatedAt: serverTimestamp()
                                }
                              );
                            } catch (error) {
                              console.error('Error updating template name:', error);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs bg-slate-800/60 border border-white/10 text-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Enter the exact template name as approved in Meta Business Manager
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {mode === 'manage' && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(template);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-600/30 text-sm flex items-center justify-center gap-2"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id, template.imageUrl, template.videoUrl);
                      }}
                      className="px-3 py-2 bg-red-600/20 border border-red-500/50 text-red-300 rounded-lg hover:bg-red-600/30 text-sm"
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                <h3 className="text-xl font-semibold text-white">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-800 text-gray-400 hover:text-white"
                >
                  <FaTimes />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Stock Reminder - Low Stock"
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Template Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Template Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={TEMPLATE_TYPES.STOCK_REMINDER}>Stock Reminder</option>
                    <option value={TEMPLATE_TYPES.PRICE_CHANGE}>Price Change</option>
                    <option value={TEMPLATE_TYPES.PRODUCT_UPDATE}>Product Update</option>
                    <option value={TEMPLATE_TYPES.PROMOTIONAL}>Promotional</option>
                    <option value={TEMPLATE_TYPES.CUSTOM}>Custom</option>
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title (Optional - shown in bold)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., 🎉 Special Offer!"
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message * (Use {`{variableName}`} for dynamic content)
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="e.g., Hello! Your product {productName} is running low. Current stock: {stock} units."
                    rows={6}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Tip: Use variables like {`{productName}`}, {`{price}`}, {`{stock}`}, {`{oldPrice}`}, {`{newPrice}`} for dynamic content
                  </p>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Image (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg"
                    disabled={uploading}
                  />
                  {formData.imageUrl && (
                    <div className="mt-2 relative">
                      <img src={formData.imageUrl} alt="Preview" className="max-w-xs rounded-lg" />
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                        className="absolute top-2 right-2 p-1 bg-red-600 rounded text-white"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  )}
                </div>

                {/* Video Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Video (Optional)
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg"
                    disabled={uploading}
                  />
                  {formData.videoUrl && (
                    <div className="mt-2">
                      <p className="text-sm text-emerald-300">✅ Video uploaded: {formData.videoUrl.substring(0, 50)}...</p>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, videoUrl: '' }))}
                        className="mt-2 px-3 py-1 bg-red-600/20 border border-red-500/50 text-red-300 rounded-lg text-sm"
                      >
                        Remove Video
                      </button>
                    </div>
                  )}
                </div>

                {/* Link */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Link URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.linkUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Link Text (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.linkText}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkText: e.target.value }))}
                      placeholder="e.g., View Catalog"
                      className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Meta Template Approval Status */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📋</span>
                    <h4 className="text-sm font-semibold text-blue-300">Meta WhatsApp Template Approval</h4>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    <strong>Note:</strong> Meta requires templates to be pre-approved before sending to users who haven't messaged you in 24 hours. 
                    If marked as "Verified by Meta", the template will use Meta's template API. Otherwise, it will be sent as a session message.
                  </p>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Approval Status
                    </label>
                    <select
                      value={formData.metaApprovalStatus || 'not_required'}
                      onChange={(e) => setFormData(prev => ({ ...prev, metaApprovalStatus: e.target.value }))}
                      className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="not_required">Not Required (Session Message Only)</option>
                      <option value="pending">Pending Meta Approval</option>
                      <option value="verified">Verified by Meta</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {formData.metaApprovalStatus === 'verified' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Meta Template Name *
                      </label>
                      <input
                        type="text"
                        value={formData.metaTemplateName || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, metaTemplateName: e.target.value }))}
                        placeholder="e.g., stock_reminder_v1 (exact name from Meta Business Manager)"
                        className="w-full bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the exact template name as it appears in your Meta Business Manager after approval.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800/60 border border-white/10 text-white rounded-lg hover:bg-slate-700/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={uploading || !formData.name || !formData.message}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FaSave /> {editingTemplate ? 'Update' : 'Create'} Template
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MessageTemplates;
export { TEMPLATE_TYPES };
