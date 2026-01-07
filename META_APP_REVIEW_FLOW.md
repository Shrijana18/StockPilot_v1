# Meta App Review Flow - Complete Guide

## Overview

This is a **temporary Review Dashboard** built specifically for Meta's App Review process. It demonstrates the complete integration of WhatsApp Business APIs through a simple, focused interface designed for screencast recording.

## Review Flow Structure

The dashboard has **3 sequential stages** that must be completed in order:

### Stage 1: Connection (Embedded Signup)
- **Purpose:** Connect WhatsApp Business Account using Meta's Embedded Signup
- **API Used:** Embedded Signup (Meta's official flow)
- **What Happens:**
  1. User clicks "Connect with Facebook"
  2. Meta Embedded Signup popup opens
  3. User completes signup flow
  4. **WABA_ID and Phone_Number_ID are automatically stored** in Firestore
  5. Connection status is displayed

### Stage 2: Messaging (whatsapp_business_messaging API)
- **Purpose:** Send a WhatsApp message to demonstrate messaging capability
- **API Used:** `whatsapp_business_messaging`
- **What Happens:**
  1. User selects connected WABA (displayed automatically)
  2. User enters recipient phone number (must be in WABA's allowed list)
  3. User types message text
  4. User clicks "Send Message"
  5. Message is sent via `sendMessageViaTechProvider` function
  6. Success confirmation is displayed

### Stage 3: Management (whatsapp_business_management API)
- **Purpose:** Create a message template to demonstrate management capability
- **API Used:** `whatsapp_business_management`
- **What Happens:**
  1. User selects connected WABA (displayed automatically)
  2. User fills in template form:
     - Template Name (lowercase, alphanumeric, underscores)
     - Category (UTILITY, MARKETING, AUTHENTICATION)
     - Language (en, en_US, en_GB, hi, etc.)
     - Template Body (message text with {{1}} for variables)
  3. User clicks "Create Template"
  4. Template is created via `createWhatsAppMessageTemplate` function
  5. Success confirmation is displayed

## Data Handling

### WABA_ID and Phone_Number_ID Storage

The Embedded Signup component automatically stores:
- `whatsappBusinessAccountId` (WABA_ID)
- `whatsappPhoneNumberId` (Phone_Number_ID)
- `whatsappPhoneNumber` (display phone number)

**Storage Location:** Firestore collection `businesses/{distributorId}`

**Code Reference:** `src/components/distributor/whatsapp/EmbeddedSignup.jsx` - `saveWABAData()` function

## Backend Functions

### 1. `sendMessageViaTechProvider`
- **Purpose:** Send WhatsApp messages
- **API:** `whatsapp_business_messaging`
- **Location:** `functions/whatsapp/techProvider.js`
- **Status:** ✅ Already deployed

### 2. `createWhatsAppMessageTemplate`
- **Purpose:** Create WhatsApp message templates
- **API:** `whatsapp_business_management`
- **Location:** `functions/whatsapp/techProvider.js`
- **Status:** ✅ Just deployed
- **Endpoint:** `POST /{waba-id}/message_templates`

## Screencast Requirements

Meta requires **two mandatory screencasts**:

### Screencast 1: Messaging (whatsapp_business_messaging)
**What to Record:**
1. Show the Review Dashboard
2. Navigate to Stage 2: Messaging
3. Enter recipient phone number
4. Type a test message
5. Click "Send Message"
6. **Show the message being received on a real phone** (critical!)
7. Show success confirmation

**Duration:** 1-2 minutes
**Key Point:** Must show end-to-end flow from dashboard to phone

### Screencast 2: Template Creation (whatsapp_business_management)
**What to Record:**
1. Show the Review Dashboard
2. Navigate to Stage 3: Management
3. Fill in template form:
   - Name: `order_status_update`
   - Category: `UTILITY`
   - Language: `en`
   - Body: `Hello {{1}}, your order {{2}} is ready for pickup!`
4. Click "Create Template"
5. Show success confirmation
6. **Optional:** Show template in Meta Business Suite

**Duration:** 1-2 minutes
**Key Point:** Must show the API call being made and template creation

## Accessing the Dashboard

**URL:** `/meta-app-review-demo`

**Requirements:**
- Must be logged in as a Distributor
- Route is protected by `PrivateRoute` with `requireRole="distributor"`

## Configuration

### Meta App Configuration
- **App ID:** 1902565950686087
- **Config ID:** 777298265371694
- **Embedded Signup URL:** Configured in `EmbeddedSignup.jsx`

### System User Token
- Stored in Firebase Secrets as `META_SYSTEM_USER_TOKEN`
- Used for all API calls to Meta

## Testing Checklist

Before recording screencasts:

- [ ] Can access `/meta-app-review-demo` as distributor
- [ ] Embedded Signup flow works and stores WABA_ID/Phone_Number_ID
- [ ] Can send test message (recipient must be in allowed list)
- [ ] Message is received on real phone
- [ ] Can create message template
- [ ] Template creation shows success
- [ ] All stages are accessible after connection

## Troubleshooting

### WABA Not Connecting
- Check browser console for errors
- Verify Meta App ID and Config ID are correct
- Ensure popup blockers are disabled
- Check Firebase Functions logs

### Message Not Sending
- Verify recipient phone is in WABA's allowed list
- Check phone number format (+91XXXXXXXXXX)
- Verify System User token is configured
- Check Firebase Functions logs for errors

### Template Creation Failing
- Verify template name follows rules (lowercase, alphanumeric, underscores)
- Check category is valid (UTILITY, MARKETING, AUTHENTICATION)
- Verify WABA_ID is correct
- Check System User has management permissions
- Review Firebase Functions logs

## Next Steps

1. ✅ Dashboard created
2. ✅ Backend functions deployed
3. ⏳ Test complete flow
4. ⏳ Record screencasts
5. ⏳ Submit to Meta App Review

## Important Notes

- This is a **temporary dashboard** for review purposes only
- The flow is designed to be simple and clear for Meta reviewers
- All API calls use proper authentication (System User token)
- WABA_ID and Phone_Number_ID are stored automatically from signup
- Both messaging and management APIs are demonstrated

---

**Ready for Meta App Review!** 🚀

