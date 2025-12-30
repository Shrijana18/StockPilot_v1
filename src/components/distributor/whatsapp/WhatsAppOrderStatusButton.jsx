/**
 * Button component to manually send WhatsApp order status update
 */

import React, { useState } from 'react';
import { sendOrderStatusUpdate, getWhatsAppConfig } from '../../../services/whatsappService';
import { auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

const WhatsAppOrderStatusButton = ({ order, status, className = '' }) => {
  const [sending, setSending] = useState(false);
  const distributorId = auth.currentUser?.uid;

  const handleSendWhatsApp = async () => {
    if (!distributorId || !order || !status) {
      toast.error('Missing information to send WhatsApp message');
      return;
    }

    // Check if WhatsApp is enabled
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.warning('WhatsApp Business API is not configured. Please set it up in Profile Settings.');
      return;
    }

    if (!order.retailerPhone) {
      toast.error('Retailer phone number not found');
      return;
    }

    setSending(true);
    try {
      const result = await sendOrderStatusUpdate(distributorId, order, status);
      
      if (result.success) {
        if (result.method === 'direct' || result.method === 'direct_fallback') {
          // Open WhatsApp Web link
          if (result.link) {
            window.open(result.link, '_blank');
            toast.success('Opening WhatsApp...');
          }
        } else {
          toast.success('WhatsApp notification sent successfully!');
        }
      } else {
        toast.error(result.error || 'Failed to send WhatsApp message');
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Failed to send WhatsApp notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      onClick={handleSendWhatsApp}
      disabled={sending || !order?.retailerPhone}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Send WhatsApp notification to retailer"
    >
      <span>💬</span>
      {sending ? 'Sending...' : 'Send WhatsApp'}
    </button>
  );
};

export default WhatsAppOrderStatusButton;

