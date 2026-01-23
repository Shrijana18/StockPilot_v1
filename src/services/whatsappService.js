/**
 * WhatsApp Business API Service for Indian Market
 * Supports multiple providers: Meta WhatsApp Business API, Twilio, and direct WhatsApp Web links
 * Optimized for Indian phone number format (+91)
 */

import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, functions } from '../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { WHATSAPP_WEBHOOK_VERIFY_TOKEN } from '../config/whatsappConfig';

// WhatsApp Business API Configuration
const WHATSAPP_PROVIDERS = {
  META: 'meta', // Meta WhatsApp Business API (official)
  META_TECH_PROVIDER: 'meta_tech_provider', // Meta Tech Provider (new gateway)
  TWILIO: 'twilio', // Twilio WhatsApp API
  DIRECT: 'direct', // Direct WhatsApp Web link (fallback)
};

/**
 * Format Indian phone number to WhatsApp format
 * @param {string} phone - Phone number (with or without country code)
 * @returns {string} - Formatted phone number with +91
 */
export function formatIndianPhone(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 91, keep it
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  
  // If starts with 0, remove it and add 91
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If 10 digits, add 91
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  
  // If already has country code
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  
  return null;
}

/**
 * Get WhatsApp Business API configuration from distributor profile
 * @param {string} distributorId - Distributor user ID
 * @returns {Promise<Object>} - WhatsApp configuration
 */
export async function getWhatsAppConfig(distributorId) {
  try {
    const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
    if (!businessDoc.exists()) {
      return null;
    }
    
    const data = businessDoc.data();
    return {
      enabled: data.whatsappEnabled || false,
      provider: data.whatsappProvider || WHATSAPP_PROVIDERS.DIRECT,
      apiKey: data.whatsappApiKey || '',
      apiSecret: data.whatsappApiSecret || '',
      phoneNumberId: data.whatsappPhoneNumberId || '',
      businessAccountId: data.whatsappBusinessAccountId || '',
      accessToken: data.whatsappAccessToken || '',
      twilioAccountSid: data.twilioAccountSid || '',
      twilioAuthToken: data.twilioAuthToken || '',
      twilioWhatsAppFrom: data.twilioWhatsAppFrom || '',
      verified: data.whatsappVerified || false,
      lastVerifiedAt: data.whatsappLastVerifiedAt || null,
      // Tech Provider specific fields
      createdVia: data.whatsappCreatedVia || null,
      webhookConfigured: data.whatsappWebhookConfigured || false,
    };
  } catch (error) {
    console.error('Error fetching WhatsApp config:', error);
    return null;
  }
}

/**
 * Send WhatsApp message using Meta WhatsApp Business API
 * @param {Object} config - WhatsApp configuration
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Object} template - Optional template data
 * @returns {Promise<Object>} - API response
 */
/**
 * Send WhatsApp message using Meta WhatsApp Business API
 * Supports text, images, documents, and templates
 */
async function sendViaMetaAPI(config, to, message, template = null, options = {}) {
  const phoneNumberId = config.phoneNumberId;
  const accessToken = config.accessToken;
  
  if (!phoneNumberId || !accessToken) {
    throw new Error('Meta WhatsApp API credentials not configured');
  }
  
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  let payload;
  
  // Handle image attachment
  if (options.imageUrl) {
    payload = {
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'image',
      image: {
        link: options.imageUrl, // Direct URL to image
        caption: message || '', // Optional caption
      },
    };
  }
  // Handle document attachment
  else if (options.documentUrl) {
    payload = {
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'document',
      document: {
        link: options.documentUrl,
        filename: options.filename || 'document',
        caption: message || '',
      },
    };
  }
  // Handle template message
  else if (template) {
    payload = {
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language || 'en' },
        components: template.components || [],
      },
    };
  }
  // Regular text message
  else {
    payload = {
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'text',
      text: { body: message },
    };
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMessage = data.error?.message || 'Failed to send WhatsApp message';
      const errorCode = data.error?.code || data.error?.error_subcode;
      const errorSubcode = data.error?.error_subcode;
      
      // Preserve error code in error message for better handling
      const error = new Error(errorMessage);
      error.code = errorCode;
      error.subcode = errorSubcode;
      error.metaError = data.error;
      
      // Map specific error codes
      if (errorCode === 10 || errorSubcode === 10) {
        error.permissionError = true;
      }
      if (errorCode === 131030 || errorSubcode === 131030) {
        error.recipientError = true;
      }
      
      throw error;
    }
    
    return { 
      success: true, 
      messageId: data.messages?.[0]?.id, 
      data,
      // Meta API provides status tracking
      canTrackStatus: true,
    };
  } catch (error) {
    console.error('Meta WhatsApp API error:', error);
    throw error;
  }
}

/**
 * Send WhatsApp message using Twilio API
 * @param {Object} config - Twilio configuration
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<Object>} - API response
 */
async function sendViaTwilio(config, to, message) {
  const accountSid = config.twilioAccountSid;
  const authToken = config.twilioAuthToken;
  const from = config.twilioWhatsAppFrom || 'whatsapp:+14155238886'; // Twilio sandbox
  
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }
  
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append('From', from);
  formData.append('To', `whatsapp:${to}`);
  formData.append('Body', message);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to send WhatsApp message via Twilio');
    }
    
    return { success: true, messageId: data.sid, data };
  } catch (error) {
    console.error('Twilio WhatsApp API error:', error);
    throw error;
  }
}

/**
 * Generate direct WhatsApp Web link (fallback method)
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {string} - WhatsApp Web URL
 */
function generateDirectLink(to, message) {
  const formattedPhone = to.replace(/[^0-9]/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

/**
 * Main function to send WhatsApp message
 * @param {string} distributorId - Distributor user ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Object} options - Additional options (template, metadata, etc.)
 * @returns {Promise<Object>} - Result object with success status and method used
 */
export async function sendWhatsAppMessage(distributorId, to, message, options = {}) {
  try {
    // Format phone number
    const formattedPhone = formatIndianPhone(to);
    if (!formattedPhone) {
      throw new Error('Invalid phone number format');
    }
    
    // Get WhatsApp configuration
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      // Fallback to direct link
      const directLink = generateDirectLink(formattedPhone, message);
      const result = {
        success: true,
        method: 'direct',
        link: directLink,
        message: 'WhatsApp not configured. Use direct link.',
      };
      
      // Log message even for direct link mode
      if (options.logMessage !== false) {
        try {
          await logWhatsAppMessage(distributorId, formattedPhone, message, result, options);
        } catch (logError) {
          console.warn('Could not log WhatsApp message (non-critical):', logError);
        }
      }
      
      return result;
    }
    
    // Send based on provider
    let result;
    switch (config.provider) {
      case WHATSAPP_PROVIDERS.META_TECH_PROVIDER:
        // Use Tech Provider gateway (new centralized approach)
        try {
          const sendMessage = httpsCallable(functions, 'sendMessageViaTechProvider');
          const techProviderResult = await sendMessage({
            to: formattedPhone,
            message,
            template: options.template || null,
            options: {
              imageUrl: options.metadata?.imageUrl || null,
              documentUrl: options.metadata?.documentUrl || null,
              filename: options.metadata?.filename || null,
              metadata: options.metadata || {},
            },
          });
          
          result = {
            success: techProviderResult.data?.success || false,
            messageId: techProviderResult.data?.messageId || null,
            method: 'tech_provider',
            data: techProviderResult.data?.data || {},
            canTrackStatus: true,
          };
        } catch (error) {
          console.error('Tech Provider send error:', error);
          throw error;
        }
        break;
      case WHATSAPP_PROVIDERS.META:
        // Meta API supports rich media - pass image/document URLs if available
        result = await sendViaMetaAPI(
          config, 
          formattedPhone, 
          message, 
          options.template,
          {
            imageUrl: options.metadata?.imageUrl || null,
            documentUrl: options.metadata?.documentUrl || null,
            filename: options.metadata?.filename || null,
          }
        );
        break;
      case WHATSAPP_PROVIDERS.TWILIO:
        result = await sendViaTwilio(config, formattedPhone, message);
        break;
      case WHATSAPP_PROVIDERS.DIRECT:
      default:
        const directLink = generateDirectLink(formattedPhone, message);
        const directResult = {
          success: true,
          method: 'direct',
          link: directLink,
        };
        
        // Log message for direct link mode
        if (options.logMessage !== false) {
          try {
            await logWhatsAppMessage(distributorId, formattedPhone, message, directResult, options);
          } catch (logError) {
            console.warn('Could not log WhatsApp message (non-critical):', logError);
          }
        }
        
        return directResult;
    }
    
    // Always log message in Firestore (skip if permission error to avoid blocking)
    // Default to true unless explicitly set to false
    if (options.logMessage !== false) {
      try {
        await logWhatsAppMessage(distributorId, formattedPhone, message, result, {
          ...options,
          // Ensure imageUrl is included in metadata
          metadata: {
            ...(options.metadata || {}),
            imageUrl: options.metadata?.imageUrl || null,
          }
        });
      } catch (logError) {
        // Don't fail the send if logging fails (permission issues)
        console.warn('Could not log WhatsApp message (non-critical):', logError);
      }
    }
    
    return {
      success: true,
      method: config.provider,
      ...result,
    };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    // Fallback to direct link on error
    const formattedPhone = formatIndianPhone(to);
    if (formattedPhone) {
      const directLink = generateDirectLink(formattedPhone, message);
      // Check if it's a recipient not allowed error
      const isRecipientError = error.message?.includes('#131030') || 
                               error.message?.includes('not in allowed list') ||
                               error.code === 131030 ||
                               error.subcode === 131030;
      
      return {
        success: false,
        error: error.message,
        errorCode: isRecipientError ? 'RECIPIENT_NOT_ALLOWED' : undefined,
        method: 'direct_fallback',
        link: directLink,
      };
    }
    throw error;
  }
}

/**
 * Log WhatsApp message in Firestore
 * @param {string} distributorId - Distributor user ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Object} result - Send result
 * @param {Object} options - Additional metadata
 */
// Helper function to remove undefined values from object
function removeUndefined(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== undefined);
  }
  const cleaned = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = removeUndefined(obj[key]);
    }
  }
  return cleaned;
}

async function logWhatsAppMessage(distributorId, to, message, result, options = {}) {
  try {
    const messagesRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
    
    // Build metadata object, filtering out undefined values
    const metadata = {
      ...(options.metadata || {}),
      // Ensure imageUrl is always included if present
      imageUrl: options.metadata?.imageUrl || null,
      videoUrl: options.metadata?.videoUrl || null,
      linkUrl: options.metadata?.linkUrl || null,
      productIds: options.metadata?.productIds || [],
      productCount: options.metadata?.productCount || 0,
      retailerId: options.metadata?.retailerId || null,
      retailerName: options.metadata?.retailerName || null,
      templateId: options.metadata?.templateId || null,
      templateName: options.metadata?.templateName || null,
    };
    
    // Remove undefined values from metadata
    const cleanedMetadata = removeUndefined(metadata);
    
    await addDoc(messagesRef, {
      to,
      message,
      status: result.success !== false ? 'sent' : 'failed', // Default to sent if not explicitly failed
      method: result.method || 'unknown',
      messageId: result.messageId || null,
      orderId: options.orderId || null,
      messageType: options.messageType || 'general',
      createdAt: serverTimestamp(),
      metadata: cleanedMetadata,
    });
  } catch (error) {
    console.error('Error logging WhatsApp message:', error);
    // Don't throw - logging failure shouldn't break the flow
  }
}

/**
 * Send order status update via WhatsApp
 * @param {string} distributorId - Distributor user ID
 * @param {Object} order - Order object
 * @param {string} newStatus - New order status
 * @returns {Promise<Object>} - Send result
 */
export async function sendOrderStatusUpdate(distributorId, order, newStatus) {
  const retailerPhone = order.retailerPhone || order.phone;
  if (!retailerPhone) {
    throw new Error('Retailer phone number not found');
  }
  
  const statusMessages = {
    QUOTED: `📋 *Proforma Invoice Sent*\n\nYour order #${order.id || 'N/A'} has been quoted. Please review and accept the proforma invoice.`,
    ACCEPTED: `✅ *Order Accepted*\n\nYour order #${order.id || 'N/A'} has been accepted and is being processed.`,
    PACKED: `📦 *Order Packed*\n\nYour order #${order.id || 'N/A'} has been packed and is ready for dispatch.`,
    SHIPPED: `🚚 *Order Shipped*\n\nYour order #${order.id || 'N/A'} has been shipped. Tracking details will be shared soon.`,
    OUT_FOR_DELIVERY: `🚛 *Out for Delivery*\n\nYour order #${order.id || 'N/A'} is out for delivery and will reach you soon!`,
    DELIVERED: `✅ *Order Delivered*\n\nYour order #${order.id || 'N/A'} has been delivered successfully. Thank you for your business!`,
    REJECTED: `❌ *Order Rejected*\n\nUnfortunately, your order #${order.id || 'N/A'} could not be processed. Please contact us for assistance.`,
  };
  
  const message = statusMessages[newStatus] || `📦 *Order Update*\n\nYour order #${order.id || 'N/A'} status has been updated to: ${newStatus}`;
  
  // Add order details if available
  let fullMessage = message;
  if (order.totalAmount) {
    fullMessage += `\n\n💰 Total Amount: ₹${order.totalAmount.toFixed(2)}`;
  }
  if (order.items && order.items.length > 0) {
    fullMessage += `\n\n📋 Items:\n${order.items.slice(0, 5).map(item => `• ${item.name || item.productName} (${item.quantity || 1})`).join('\n')}`;
    if (order.items.length > 5) {
      fullMessage += `\n...and ${order.items.length - 5} more items`;
    }
  }
  
  fullMessage += `\n\n_Powered by FLYP_`;
  
  return await sendWhatsAppMessage(distributorId, retailerPhone, fullMessage, {
    orderId: order.id,
    messageType: 'order_status_update',
    metadata: { status: newStatus, orderId: order.id },
  });
}

/**
 * Send stock refill reminder (single product)
 * @param {string} distributorId - Distributor user ID
 * @param {Object} product - Product object with low stock
 * @param {string} retailerPhone - Retailer phone number
 * @returns {Promise<Object>} - Send result
 */
export async function sendStockRefillReminder(distributorId, product, retailerPhone) {
  if (!retailerPhone) {
    throw new Error('Retailer phone number required');
  }
  
  const message = `📦 *Stock Refill Reminder*\n\nHello!\n\nYour product *${product.name || 'N/A'}* is running low on stock.\n\n📊 Current Stock: ${product.quantity || 0} ${product.unit || 'units'}\n\n💡 We recommend placing an order soon to avoid stockout.\n\n_Powered by FLYP_`;
  
  return await sendWhatsAppMessage(distributorId, retailerPhone, message, {
    messageType: 'stock_reminder',
    metadata: { productId: product.id, productName: product.name, currentStock: product.quantity },
  });
}

/**
 * Send bulk stock refill reminder (multiple products in one message)
 * @param {string} distributorId - Distributor user ID
 * @param {Array<Object>} products - Array of product objects with low stock
 * @param {string} retailerPhone - Retailer phone number
 * @param {string} retailerName - Retailer name (optional)
 * @returns {Promise<Object>} - Send result
 */
export async function sendBulkStockRefillReminder(distributorId, products, retailerPhone, retailerName = '') {
  if (!retailerPhone) {
    throw new Error('Retailer phone number required');
  }
  
  if (!products || products.length === 0) {
    throw new Error('At least one product required');
  }
  
  // Build message with all products
  let message = `📦 *Stock Refill Reminder*\n\n`;
  if (retailerName) {
    message += `Hello *${retailerName}*,\n\n`;
  } else {
    message += `Hello!\n\n`;
  }
  
  if (products.length === 1) {
    const product = products[0];
    message += `Your product *${product.name || 'N/A'}* is running low on stock.\n\n`;
    message += `📊 *Current Stock:* ${product.quantity || 0} ${product.unit || 'units'}\n\n`;
  } else {
    message += `You have *${products.length} products* running low on stock:\n\n`;
    products.forEach((product, index) => {
      message += `${index + 1}. *${product.name || 'Unnamed Product'}*\n`;
      message += `   📊 Stock: ${product.quantity || 0} ${product.unit || 'units'}\n\n`;
    });
  }
  
  message += `💡 We recommend placing an order soon to avoid stockout.\n\n`;
  message += `Reply to this message to place your order!\n\n`;
  message += `_Powered by FLYP_`;
  
  return await sendWhatsAppMessage(distributorId, retailerPhone, message, {
    messageType: 'bulk_stock_reminder',
    metadata: { 
      productIds: products.map(p => p.id),
      productNames: products.map(p => p.name),
      productCount: products.length
    },
  });
}

/**
 * Send promotional offer/broadcast
 * @param {string} distributorId - Distributor user ID
 * @param {Array<string>} phoneNumbers - Array of recipient phone numbers
 * @param {Object} offer - Offer details
 * @returns {Promise<Object>} - Results for all recipients
 */
export async function sendPromotionalOffer(distributorId, phoneNumbers, offer) {
  const message = `🎉 *Special Offer!*\n\n${offer.title || 'Exciting Offer'}\n\n${offer.description || ''}\n\n💰 Discount: ${offer.discount || 'N/A'}\n📅 Valid Until: ${offer.validUntil || 'N/A'}\n\n${offer.terms || ''}\n\n_Powered by FLYP_`;
  
  const results = [];
  for (const phone of phoneNumbers) {
    try {
      const result = await sendWhatsAppMessage(distributorId, phone, message, {
        messageType: 'promotional',
        metadata: { offerId: offer.id, offerTitle: offer.title },
      });
      results.push({ phone, ...result });
    } catch (error) {
      results.push({ phone, success: false, error: error.message });
    }
  }
  
  return { results, total: phoneNumbers.length, successful: results.filter(r => r.success).length };
}

/**
 * Verify WhatsApp Business API connection
 * @param {string} distributorId - Distributor user ID
 * @returns {Promise<Object>} - Verification result
 */
export async function verifyWhatsAppConnection(distributorId) {
  try {
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      return { verified: false, error: 'WhatsApp not enabled. Please enable it first.' };
    }
    
    // For Direct Link provider, no need to test API
    if (config.provider === WHATSAPP_PROVIDERS.DIRECT) {
      return { verified: true, method: 'direct', message: 'Direct Link mode - no API testing needed' };
    }
    
    // Test with a dummy message to the distributor's own number
    const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
    if (!businessDoc.exists()) {
      return { verified: false, error: 'Business profile not found' };
    }
    
    const businessData = businessDoc.data();
    const testPhone = businessData.phone;
    
    if (!testPhone) {
      return { verified: false, error: 'No phone number found in your profile. Please add a phone number first.' };
    }
    
    // Send a test message
    try {
      const result = await sendWhatsAppMessage(
        distributorId,
        testPhone,
        '✅ WhatsApp Business API connection verified successfully! This is a test message from FLYP.',
        { logMessage: false }
      );
      
      if (result.success) {
        // Update verification status (only if not using direct link)
        try {
          await updateDoc(doc(db, 'businesses', distributorId), {
            whatsappVerified: true,
            whatsappLastVerifiedAt: serverTimestamp(),
          });
        } catch (updateError) {
          console.warn('Could not update verification status (non-critical):', updateError);
          // Don't fail verification if update fails - the message was sent successfully
        }
        
        return { verified: true, method: result.method };
      }
      
      // Handle specific Meta API errors gracefully when result.success is false
      const errorMessage = result.error || '';
      
      // Error #10: Application does not have permission
      if (result.errorCode === 'PERMISSION_DENIED' || 
          errorMessage.includes('#10') || 
          errorMessage.includes('does not have permission')) {
        return { 
          verified: false, 
          error: 'Application does not have permission. Request Production Access in Meta Business Suite.',
          errorCode: 'PERMISSION_DENIED',
          credentialsValid: true,
          instructions: 'Go to Meta Business Suite → WhatsApp → API Setup → Request Production Access'
        };
      }
      
      // Error #131030: Recipient not in allowed list
      if (result.errorCode === 'RECIPIENT_NOT_ALLOWED' || 
          errorMessage.includes('#131030') || 
          errorMessage.includes('not in allowed list')) {
        // Credentials are valid, but recipient number needs to be added to allowed list
        return { 
          verified: false, 
          error: 'Recipient phone number not in allowed list. Add recipient numbers in Meta Business Suite.',
          errorCode: 'RECIPIENT_NOT_ALLOWED',
          credentialsValid: true, // Indicate credentials are correct
          instructions: 'Go to Meta Business Suite → WhatsApp → API Setup → Add recipient phone numbers'
        };
      }
      
      return { verified: false, error: result.error || 'Verification failed' };
    } catch (sendError) {
      // Handle errors thrown from sendWhatsAppMessage
      const errorMessage = sendError.message || '';
      
      // Error #10: Permission denied
      if (sendError.code === 10 || sendError.subcode === 10 || 
          sendError.permissionError ||
          errorMessage.includes('#10') || 
          errorMessage.includes('does not have permission')) {
        return { 
          verified: false, 
          error: 'Application does not have permission. Request Production Access in Meta Business Suite.',
          errorCode: 'PERMISSION_DENIED',
          credentialsValid: true,
          instructions: 'Go to Meta Business Suite → WhatsApp → API Setup → Request Production Access. This usually takes 24-48 hours for approval.'
        };
      }
      
      // Error #131030: Recipient not allowed
      if (sendError.code === 131030 || sendError.subcode === 131030 ||
          sendError.recipientError ||
          errorMessage.includes('#131030') || 
          errorMessage.includes('not in allowed list')) {
        return { 
          verified: false, 
          error: 'Recipient phone number not in allowed list. Add recipient numbers in Meta Business Suite.',
          errorCode: 'RECIPIENT_NOT_ALLOWED',
          credentialsValid: true,
          instructions: 'Go to Meta Business Suite → WhatsApp → API Setup → Add recipient phone numbers'
        };
      }
      
      throw sendError; // Re-throw other errors
    }
  } catch (error) {
    console.error('Error verifying WhatsApp connection:', error);
    // Provide more helpful error messages
    if (error.code === 'permission-denied') {
      return { verified: false, error: 'Permission denied. Please check your Firestore security rules.' };
    }
    return { verified: false, error: error.message || 'Unknown error occurred' };
  }
}

/**
 * Get message status from Meta API
 * @param {string} distributorId - Distributor user ID
 * @param {string} messageId - Message ID from Meta API
 * @returns {Promise<Object>} - Message status
 */
export async function getMessageStatus(distributorId, messageId) {
  try {
    const config = await getWhatsAppConfig(distributorId);
    if (!config || config.provider !== WHATSAPP_PROVIDERS.META) {
      return { error: 'Meta API not configured' };
    }

    const phoneNumberId = config.phoneNumberId;
    const accessToken = config.accessToken;
    
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages/${messageId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to get message status');
    }
    
    return { success: true, status: data.status, data };
  } catch (error) {
    console.error('Error getting message status:', error);
    return { error: error.message };
  }
}

/**
 * Upload media to Meta for WhatsApp
 * @param {string} distributorId - Distributor user ID
 * @param {string} mediaUrl - URL of the media to upload
 * @param {string} type - Media type: image, document, video, audio
 * @returns {Promise<Object>} - Media ID
 */
export async function uploadMedia(distributorId, mediaUrl, type = 'image') {
  try {
    const config = await getWhatsAppConfig(distributorId);
    if (!config || config.provider !== WHATSAPP_PROVIDERS.META) {
      return { error: 'Meta API not configured' };
    }

    const businessAccountId = config.businessAccountId;
    const accessToken = config.accessToken;
    
    // First, upload media
    const uploadUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/media`;
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: mediaUrl,
        type: type,
        messaging_product: 'whatsapp',
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload media');
    }
    
    return { success: true, mediaId: data.id, data };
  } catch (error) {
    console.error('Error uploading media:', error);
    return { error: error.message };
  }
}

/**
 * Send message template
 * @param {string} distributorId - Distributor user ID
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Template name (must be approved)
 * @param {string} languageCode - Language code (default: en)
 * @param {Array} components - Template components (parameters, buttons, etc.)
 * @returns {Promise<Object>} - Send result
 */
export async function sendTemplateMessage(distributorId, to, templateName, languageCode = 'en', components = []) {
  try {
    const formattedPhone = formatIndianPhone(to);
    if (!formattedPhone) {
      throw new Error('Invalid phone number format');
    }

    const config = await getWhatsAppConfig(distributorId);
    if (!config || config.provider !== WHATSAPP_PROVIDERS.META) {
      throw new Error('Meta API not configured');
    }

    const result = await sendViaMetaAPI(
      config,
      formattedPhone,
      '',
      {
        name: templateName,
        language: { code: languageCode },
        components: components,
      }
    );

    // Log message
    if (result.success) {
      try {
        await logWhatsAppMessage(distributorId, formattedPhone, `[Template: ${templateName}]`, result, {
          messageType: 'template',
          metadata: { templateName, languageCode },
        });
      } catch (logError) {
        console.warn('Could not log template message:', logError);
      }
    }

    return result;
  } catch (error) {
    console.error('Error sending template message:', error);
    throw error;
  }
}

/**
 * Get webhook URL for this app
 * @returns {string} - Webhook URL
 */
export function getWebhookUrl() {
  // This should match your Firebase Cloud Function URL
  const projectId = 'stockpilotv1';
  const region = 'us-central1';
  return `https://${region}-${projectId}.cloudfunctions.net/whatsappWebhook`;
}

/**
 * Setup webhook in Meta (requires manual setup in Meta Business Suite)
 * This function provides instructions, as webhook setup requires Meta Business Suite access
 * @param {string} distributorId - Distributor user ID
 * @returns {Promise<Object>} - Setup instructions
 */
export async function getWebhookSetupInstructions(distributorId) {
  const config = await getWhatsAppConfig(distributorId);
  if (!config || ![WHATSAPP_PROVIDERS.META, WHATSAPP_PROVIDERS.META_TECH_PROVIDER].includes(config.provider)) {
    return { error: 'Meta API not configured' };
  }

  const webhookUrl = getWebhookUrl();
  const verifyToken = WHATSAPP_WEBHOOK_VERIFY_TOKEN; // Must match functions/whatsapp/webhook.js

  return {
    instructions: [
      '1. Go to Meta Business Suite → Settings → WhatsApp → Configuration',
      '2. Click "Edit" next to Webhook',
      `3. Enter Webhook URL: ${webhookUrl}`,
      `4. Enter Verify Token: ${verifyToken}`,
      '5. Select subscription fields: messages, message_status',
      '6. Click "Verify and Save"',
    ],
    webhookUrl,
    verifyToken,
    subscriptionFields: ['messages', 'message_status'],
  };
}

export { WHATSAPP_PROVIDERS };

