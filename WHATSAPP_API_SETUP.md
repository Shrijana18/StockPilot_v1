# WhatsApp Business API Setup Guide

## 🚀 Quick Setup (3-4 Steps)

This guide helps you connect your WhatsApp Business account to unlock all API features.

## ✅ What You'll Get

- ✅ **Automated sending** - No manual clicks needed
- ✅ **Real-time status tracking** - See sent/delivered/read status
- ✅ **Rich media support** - Images, documents, videos
- ✅ **Message templates** - Pre-approved templates
- ✅ **Two-way communication** - Receive and respond to messages
- ✅ **Webhook integration** - Real-time updates
- ✅ **Bulk messaging** - Send to thousands instantly
- ✅ **Advanced analytics** - Delivery rates, read rates

## 📋 Prerequisites

- A WhatsApp Business account
- A Facebook account (to access Meta Business)
- 5-10 minutes

## 🔧 Setup Steps

### Step 1: Access Meta for Developers

1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Click "Create App" or select existing app
3. Choose "Business" as app type
4. Go to "Add Products" → Click "Set Up" next to "WhatsApp"
5. You'll see "Getting Started" with all credentials

### Step 2: Get Phone Number ID

1. Go to [Phone Numbers page](https://business.facebook.com/latest/whatsapp_manager/phone_numbers)
2. Find your phone number
3. Click the ⚙️ Settings icon next to it
4. Copy the **Phone Number ID** (15-17 digits)
   - Example: `1344922650087785`

### Step 3: Get Business Account ID (WABA ID)

1. Go to [Business Settings](https://business.facebook.com/settings)
2. Navigate to **Accounts → WhatsApp Accounts**
3. Copy the **Business Account ID** (15-17 digits)
   - Example: `987654321098765`
   - Also called "WABA ID"

### Step 4: Get Access Token

1. Go to [API Setup page](https://business.facebook.com/latest/whatsapp_manager/api_setup)
   - Or click the blue alert: "Set up Marketing Messages API for WhatsApp"
2. Find the **Access Token** section
3. Click "Copy" button or copy manually
   - Token starts with `EAA...`
   - Usually 200+ characters long

### Step 5: Enter Credentials in FLYP

1. Go to **Profile Settings → WhatsApp**
2. Select **"WhatsApp Business API"** option
3. Paste all three credentials:
   - Phone Number ID
   - Business Account ID
   - Access Token
4. Click **"Save & Verify"**
5. Wait for verification (sends a test message)

## 🔗 Correct Meta API Paths

All paths use the correct Meta WhatsApp Business API endpoints:

- **Send Messages**: `https://graph.facebook.com/v18.0/{phoneNumberId}/messages`
- **Get Message Status**: `https://graph.facebook.com/v18.0/{phoneNumberId}/messages/{messageId}`
- **Upload Media**: `https://graph.facebook.com/v18.0/{businessAccountId}/media`
- **Phone Numbers**: `https://business.facebook.com/latest/whatsapp_manager/phone_numbers`
- **API Setup**: `https://business.facebook.com/latest/whatsapp_manager/api_setup`
- **Business Settings**: `https://business.facebook.com/settings`

## 🔔 Webhook Setup (Optional - for status tracking)

To receive real-time status updates:

1. Go to Meta Business Suite → Settings → WhatsApp → Configuration
2. Click "Edit" next to Webhook
3. Enter Webhook URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappWebhook`
4. Enter Verify Token: `flyp_whatsapp_webhook_token`
5. Select subscription fields: `messages`, `message_status`
6. Click "Verify and Save"

## 📝 Notes

- **Access Token**: Temporary tokens expire in 24 hours. For permanent access, set up a System User (optional).
- **Webhook**: Not required for basic sending, but enables real-time status tracking.
- **Templates**: Must be approved by Meta before use. Create templates in Meta Business Suite.

## 🆘 Troubleshooting

### "API credentials not configured"
- Make sure all three credentials are entered correctly
- Check for extra spaces when pasting

### "Verification failed"
- Check that your Access Token is valid (not expired)
- Ensure Phone Number ID matches your WhatsApp Business number
- Verify Business Account ID is correct

### "Message sending failed"
- Check Access Token hasn't expired
- Verify phone number format is correct (+91XXXXXXXXXX)
- Ensure recipient has opted in (for template messages)

## 🎉 Success!

Once verified, all WhatsApp API features are unlocked:
- Automated message sending
- Status tracking
- Rich media
- Templates
- Two-way communication
- Webhooks
- Analytics

---

**Need Help?** Contact support or check Meta's [WhatsApp Business API documentation](https://developers.facebook.com/docs/whatsapp).

