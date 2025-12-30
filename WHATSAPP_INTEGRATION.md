# WhatsApp Business Integration for Indian Market

## Overview

This document describes the WhatsApp Business API integration for the FLYP/StockPilot distributor dashboard, optimized for the Indian market. The integration enables distributors to send automated notifications, reminders, and promotional messages to retailers via WhatsApp.

## Features

### 1. **Order Status Updates** ✅
- Automatic WhatsApp notifications when order status changes:
  - Proforma Invoice Sent (QUOTED)
  - Order Accepted (ACCEPTED)
  - Order Packed (PACKED)
  - Order Shipped (SHIPPED)
  - Out for Delivery (OUT_FOR_DELIVERY)
  - Order Delivered (DELIVERED)
  - Order Rejected (REJECTED)

### 2. **Stock Refill Reminders** ✅
- Send WhatsApp reminders to retailers about low stock items
- Configurable low stock threshold
- Bulk selection of products and retailers
- Automatic notifications when stock falls below threshold

### 3. **Promotional Broadcasts** ✅
- Send promotional offers to multiple retailers at once
- Create custom offer messages with:
  - Title and description
  - Discount information
  - Validity period
  - Terms and conditions
- Track past promotional campaigns

### 4. **Courier/Delivery Integration** ✅
- Support for Indian courier services:
  - Shiprocket (fully integrated)
  - Delhivery (API ready)
  - BlueDart (API ready)
  - FedEx (API ready)
  - Manual entry (no API required)
- Automatic tracking updates via WhatsApp
- Delivery status notifications

## Setup Instructions

### Step 1: Configure WhatsApp Business API

1. Navigate to **Profile Settings** → **WhatsApp Business** section
2. Enable WhatsApp notifications
3. Choose your provider:
   - **Direct Link** (No setup required - uses WhatsApp Web)
   - **Meta WhatsApp Business API** (Official API - requires Facebook Business account)
   - **Twilio WhatsApp API** (Third-party provider)

### Step 2: Meta WhatsApp Business API Setup

1. Create a Facebook Business account
2. Set up WhatsApp Business API through Meta Business Manager
3. Get your credentials:
   - Phone Number ID
   - Business Account ID
   - Access Token
4. Enter these in the Profile Settings → WhatsApp Business section
5. Click "Test Connection" to verify

### Step 3: Twilio Setup (Alternative)

1. Create a Twilio account
2. Enable WhatsApp in Twilio Console
3. Get your credentials:
   - Account SID
   - Auth Token
   - WhatsApp From Number
4. Enter these in the Profile Settings → WhatsApp Business section
5. Click "Test Connection" to verify

## Usage

### Sending Order Status Updates

Order status updates are sent automatically when:
- Order status changes in the Dispatch Tracker
- Order is marked as Delivered
- Order is shipped or packed

You can also manually send updates using the "Send WhatsApp" button in the order details.

### Stock Refill Reminders

1. Go to **WhatsApp Hub** → **Stock Reminders**
2. Set your low stock threshold
3. Select products that need refilling
4. Select retailers to notify
5. Click "Send Reminders"

### Promotional Broadcasts

1. Go to **WhatsApp Hub** → **Promotions**
2. Fill in offer details:
   - Title (required)
   - Description (required)
   - Discount (optional)
   - Valid Until date (optional)
   - Terms & Conditions (optional)
3. Select retailers to send to
4. Click "Send to X Retailer(s)"

### Courier Integration

1. Configure courier service in Profile Settings (coming soon)
2. When creating a shipment, tracking information is automatically sent via WhatsApp
3. Delivery updates are sent automatically when status changes

## File Structure

```
src/
├── services/
│   ├── whatsappService.js          # Core WhatsApp API service
│   └── courierService.js            # Courier/delivery integration
├── components/
│   └── distributor/
│       ├── whatsapp/
│       │   ├── WhatsAppHub.jsx              # Main WhatsApp hub
│       │   ├── WhatsAppOrderStatusButton.jsx # Manual status update button
│       │   ├── StockRefillReminder.jsx      # Stock reminder component
│       │   └── PromotionalBroadcast.jsx     # Promotional broadcast component
│       └── DistributorProfileSettings.jsx    # WhatsApp configuration UI
└── hooks/
    └── useWhatsAppNotifications.js           # React hook for notifications
```

## API Integration Details

### WhatsApp Service Functions

- `sendWhatsAppMessage(distributorId, to, message, options)` - Send a WhatsApp message
- `sendOrderStatusUpdate(distributorId, order, newStatus)` - Send order status update
- `sendStockRefillReminder(distributorId, product, retailerPhone)` - Send stock reminder
- `sendPromotionalOffer(distributorId, phoneNumbers, offer)` - Send promotional offer
- `verifyWhatsAppConnection(distributorId)` - Verify API connection
- `getWhatsAppConfig(distributorId)` - Get WhatsApp configuration

### Courier Service Functions

- `createShipment(distributorId, shipmentData)` - Create a shipment
- `trackShipment(distributorId, trackingNumber)` - Track a shipment
- `sendDeliveryTrackingUpdate(distributorId, order, trackingData)` - Send tracking update via WhatsApp

## Indian Market Optimizations

1. **Phone Number Formatting**: Automatically formats Indian phone numbers (+91)
2. **Hindi/English Support**: Messages can be sent in Hindi or English
3. **Indian Courier Services**: Priority support for Shiprocket, Delhivery, BlueDart
4. **GST Information**: Order updates include GST details
5. **UPI Payment Links**: Can include UPI payment links in messages

## Best Practices

1. **Test First**: Always test your WhatsApp connection before sending bulk messages
2. **Personalize Messages**: Use retailer names and order details in messages
3. **Timing**: Send reminders during business hours (9 AM - 8 PM IST)
4. **Frequency**: Don't spam - limit promotional messages to once per week
5. **Compliance**: Ensure you have consent from retailers to send WhatsApp messages

## Troubleshooting

### Messages Not Sending

1. Check WhatsApp configuration in Profile Settings
2. Verify API credentials are correct
3. Test connection using "Test Connection" button
4. Check if retailer phone numbers are valid (10 digits, starts with 6-9)

### Direct Link Fallback

If API is not configured, the system automatically falls back to WhatsApp Web links. Users can click the link to open WhatsApp and send the message manually.

## Future Enhancements

- [ ] WhatsApp template message support (Meta API)
- [ ] Scheduled messages
- [ ] Message templates library
- [ ] Analytics dashboard for message delivery
- [ ] Two-way communication (receive messages from retailers)
- [ ] WhatsApp chatbot integration
- [ ] Multi-language message templates (Hindi, English, regional languages)

## Support

For issues or questions:
1. Check the Profile Settings → WhatsApp Business section
2. Verify your API credentials
3. Test connection before sending messages
4. Check browser console for error messages

---

**Note**: WhatsApp Business API requires approval from Meta for production use. For testing, you can use the Direct Link method or Twilio sandbox.

