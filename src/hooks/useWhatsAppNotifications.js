/**
 * React hook for WhatsApp notifications
 * Automatically sends WhatsApp messages when order status changes
 */

import { useEffect, useRef } from 'react';
import { sendOrderStatusUpdate, getWhatsAppConfig } from '../services/whatsappService';
import { auth } from '../firebase/firebaseConfig';

/**
 * Hook to send WhatsApp notification when order status changes
 * @param {Object} order - Order object
 * @param {string} previousStatus - Previous order status
 * @param {string} currentStatus - Current order status
 */
export function useOrderStatusWhatsAppNotification(order, previousStatus, currentStatus) {
  const previousStatusRef = useRef(previousStatus);
  const distributorId = auth.currentUser?.uid;

  useEffect(() => {
    // Only send notification if status actually changed
    if (
      !distributorId ||
      !order ||
      !currentStatus ||
      previousStatusRef.current === currentStatus ||
      currentStatus === previousStatus
    ) {
      previousStatusRef.current = currentStatus;
      return;
    }

    // Check if WhatsApp is enabled
    getWhatsAppConfig(distributorId).then((config) => {
      if (!config || !config.enabled) {
        // WhatsApp not configured, skip notification
        return;
      }

      // Send notification (fire and forget - don't block UI)
      sendOrderStatusUpdate(distributorId, order, currentStatus).catch((error) => {
        console.error('Failed to send WhatsApp notification:', error);
        // Don't show error to user - this is a background operation
      });
    });

    previousStatusRef.current = currentStatus;
  }, [distributorId, order, currentStatus, previousStatus]);
}

/**
 * Manual function to send WhatsApp notification for order status
 * Use this when you want to explicitly send a notification
 * @param {string} distributorId - Distributor user ID
 * @param {Object} order - Order object
 * @param {string} newStatus - New order status
 * @returns {Promise<Object>} - Send result
 */
export async function notifyOrderStatusChange(distributorId, order, newStatus) {
  try {
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      return { success: false, reason: 'WhatsApp not enabled' };
    }

    return await sendOrderStatusUpdate(distributorId, order, newStatus);
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return { success: false, error: error.message };
  }
}

