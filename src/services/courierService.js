/**
 * Courier/Delivery API Integration Service
 * Supports Indian courier services like Shiprocket, Delhivery, etc.
 */

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { sendWhatsAppMessage } from './whatsappService';

// Supported Courier Providers
export const COURIER_PROVIDERS = {
  SHIPROCKET: 'shiprocket',
  DELHIVERY: 'delhivery',
  BLUEDART: 'bluedart',
  FEDEX: 'fedex',
  MANUAL: 'manual', // Manual entry without API
};

/**
 * Get courier configuration from distributor profile
 * @param {string} distributorId - Distributor user ID
 * @returns {Promise<Object>} - Courier configuration
 */
export async function getCourierConfig(distributorId) {
  try {
    const businessDoc = await getDoc(doc(db, 'businesses', distributorId));
    if (!businessDoc.exists()) {
      return null;
    }

    const data = businessDoc.data();
    return {
      enabled: data.courierEnabled || false,
      provider: data.courierProvider || COURIER_PROVIDERS.MANUAL,
      // Shiprocket config
      shiprocketEmail: data.shiprocketEmail || '',
      shiprocketPassword: data.shiprocketPassword || '',
      shiprocketToken: data.shiprocketToken || '',
      // Delhivery config
      delhiveryApiKey: data.delhiveryApiKey || '',
      delhiveryClientId: data.delhiveryClientId || '',
      // BlueDart config
      bluedartApiKey: data.bluedartApiKey || '',
      bluedartAccountNumber: data.bluedartAccountNumber || '',
      // FedEx config
      fedexApiKey: data.fedexApiKey || '',
      fedexAccountNumber: data.fedexAccountNumber || '',
    };
  } catch (error) {
    console.error('Error fetching courier config:', error);
    return null;
  }
}

/**
 * Create shipment via Shiprocket API
 * @param {Object} config - Shiprocket configuration
 * @param {Object} shipmentData - Shipment details
 * @returns {Promise<Object>} - Shipment response
 */
async function createShiprocketShipment(config, shipmentData) {
  // First, authenticate if token not available
  let token = config.shiprocketToken;
  if (!token) {
    const authResponse = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: config.shiprocketEmail,
        password: config.shiprocketPassword,
      }),
    });

    if (!authResponse.ok) {
      throw new Error('Shiprocket authentication failed');
    }

    const authData = await authResponse.json();
    token = authData.token;

    // Save token for future use
    await updateDoc(doc(db, 'businesses', shipmentData.distributorId), {
      shiprocketToken: token,
    });
  }

  // Create shipment
  const shipmentResponse = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: shipmentData.orderId,
      order_date: shipmentData.orderDate || new Date().toISOString(),
      pickup_location: shipmentData.pickupLocation || 'Primary',
      billing_customer_name: shipmentData.billingName,
      billing_last_name: shipmentData.billingLastName || '',
      billing_address: shipmentData.billingAddress,
      billing_address_2: shipmentData.billingAddress2 || '',
      billing_city: shipmentData.billingCity,
      billing_pincode: shipmentData.billingPincode,
      billing_state: shipmentData.billingState,
      billing_country: shipmentData.billingCountry || 'India',
      billing_email: shipmentData.billingEmail,
      billing_phone: shipmentData.billingPhone,
      shipping_is_billing: shipmentData.shippingIsBilling || true,
      order_items: shipmentData.items.map((item) => ({
        name: item.name,
        sku: item.sku || '',
        units: item.quantity,
        selling_price: item.price,
      })),
      payment_method: shipmentData.paymentMethod || 'Prepaid',
      sub_total: shipmentData.subTotal,
      length: shipmentData.length || 10,
      breadth: shipmentData.breadth || 10,
      height: shipmentData.height || 10,
      weight: shipmentData.weight || 0.5,
    }),
  });

  if (!shipmentResponse.ok) {
    const errorData = await shipmentResponse.json();
    throw new Error(errorData.message || 'Failed to create shipment');
  }

  return await shipmentResponse.json();
}

/**
 * Track shipment via Shiprocket API
 * @param {Object} config - Shiprocket configuration
 * @param {string} awbCode - AWB tracking code
 * @returns {Promise<Object>} - Tracking response
 */
async function trackShiprocketShipment(config, awbCode) {
  const token = config.shiprocketToken;
  if (!token) {
    throw new Error('Shiprocket token not available');
  }

  const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to track shipment');
  }

  return await response.json();
}

/**
 * Create shipment (generic function that routes to appropriate provider)
 * @param {string} distributorId - Distributor user ID
 * @param {Object} shipmentData - Shipment details
 * @returns {Promise<Object>} - Shipment response
 */
export async function createShipment(distributorId, shipmentData) {
  const config = await getCourierConfig(distributorId);
  if (!config || !config.enabled) {
    throw new Error('Courier service not enabled');
  }

  shipmentData.distributorId = distributorId;

  switch (config.provider) {
    case COURIER_PROVIDERS.SHIPROCKET:
      return await createShiprocketShipment(config, shipmentData);
    case COURIER_PROVIDERS.MANUAL:
      // For manual entry, just return the data
      return {
        success: true,
        method: 'manual',
        trackingNumber: shipmentData.manualTrackingNumber || 'MANUAL',
        message: 'Manual entry - tracking number saved',
      };
    default:
      throw new Error(`Courier provider ${config.provider} not yet implemented`);
  }
}

/**
 * Track shipment
 * @param {string} distributorId - Distributor user ID
 * @param {string} trackingNumber - Tracking number
 * @returns {Promise<Object>} - Tracking response
 */
export async function trackShipment(distributorId, trackingNumber) {
  const config = await getCourierConfig(distributorId);
  if (!config || !config.enabled) {
    throw new Error('Courier service not enabled');
  }

  switch (config.provider) {
    case COURIER_PROVIDERS.SHIPROCKET:
      return await trackShiprocketShipment(config, trackingNumber);
    case COURIER_PROVIDERS.MANUAL:
      return {
        success: true,
        method: 'manual',
        trackingNumber,
        status: 'In Transit',
        message: 'Manual tracking - check with courier directly',
      };
    default:
      throw new Error(`Tracking not available for provider ${config.provider}`);
  }
}

/**
 * Send delivery tracking update via WhatsApp
 * @param {string} distributorId - Distributor user ID
 * @param {Object} order - Order object
 * @param {Object} trackingData - Tracking information
 * @returns {Promise<Object>} - Send result
 */
export async function sendDeliveryTrackingUpdate(distributorId, order, trackingData) {
  const retailerPhone = order.retailerPhone || order.phone;
  if (!retailerPhone) {
    throw new Error('Retailer phone number not found');
  }

  const trackingNumber = trackingData.trackingNumber || trackingData.awbCode || 'N/A';
  const trackingUrl = trackingData.trackingUrl || `https://shiprocket.co/track/${trackingNumber}`;

  const message = `🚚 *Delivery Tracking Update*\n\nYour order #${order.id || 'N/A'} has been shipped!\n\n📦 *Tracking Number:* ${trackingNumber}\n🔗 *Track Here:* ${trackingUrl}\n\n📊 *Status:* ${trackingData.status || 'In Transit'}\n\nWe'll keep you updated on the delivery status.\n\n_Powered by FLYP_`;

  return await sendWhatsAppMessage(distributorId, retailerPhone, message, {
    orderId: order.id,
    messageType: 'delivery_tracking',
    metadata: { trackingNumber, status: trackingData.status },
  });
}

export { COURIER_PROVIDERS };

