# WhatsApp Webhook Setup Guide

## ✅ What We Fixed

### 1. **Webhook Handler Now Processes Account Review Updates**
- Added handler for `account_alerts` field
- Added handler for `account_review_status` updates
- Added handler for `phone_number_verification` updates
- Automatically updates Firestore when status changes

### 2. **Automatic Webhook Setup**
- After account creation, webhook is automatically configured
- Ensures real-time status updates are received

### 3. **Complete Data Saving**
- Now saves ALL fields from embedded signup response
- Includes access tokens, OAuth codes, business IDs
- Saves initial account review status

## 📋 Meta App Webhook Configuration

### Required Webhook Fields to Subscribe

In your Meta App Dashboard → Webhooks → WhatsApp Business Account, subscribe to:

1. **`account_alerts`** ✅ (Already subscribed in your screenshot)
   - Receives account review status updates
   - Receives account approval/rejection notifications

2. **`messages`** (For incoming messages)
   - Already handled in webhook

3. **`message_status`** (For message delivery status)
   - Already handled in webhook

4. **`phone_number_verification`** (Optional but recommended)
   - Receives phone number verification status updates

### Webhook Configuration

**Callback URL:**
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

**Verify Token:**
```
flyp_tech_provider_webhook_token
```
(Or whatever you set in Firebase Secrets as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)

## 🔄 How It Works Now

### Flow 1: Account Creation
1. User completes Embedded Signup
2. postMessage received with WABA ID, Phone Number ID
3. **All data saved to Firestore** (including tokens, codes)
4. **Webhook automatically configured**
5. Status fetched and displayed

### Flow 2: Account Review Update (via Webhook)
1. Meta reviews account (24-48 hours)
2. Meta sends webhook event: `account_alerts` with review status
3. **Webhook handler processes update**
4. **Firestore updated automatically** with new status
5. Frontend polls and shows updated status

### Flow 3: Phone Verification Update (via Webhook)
1. User verifies phone number in Meta Business Suite
2. Meta sends webhook event: `phone_number_verification`
3. **Webhook handler processes update**
4. **Firestore updated automatically** with verification status
5. Frontend shows updated phone status

## 🎯 What Gets Updated Automatically

### Account Review Status
- `whatsappAccountReviewStatus`: PENDING → APPROVED/REJECTED
- `whatsappVerified`: false → true (when approved)
- `whatsappAccountReviewUpdatedAt`: Timestamp

### Phone Number Status
- `whatsappPhoneNumberId`: Phone number ID
- `whatsappPhoneNumber`: Display phone number
- `whatsappPhoneVerificationStatus`: UNVERIFIED → VERIFIED
- `whatsappPhoneRegistered`: true
- `whatsappPhoneUpdatedAt`: Timestamp

## 🔍 Testing Webhook

### Test Account Review Update
1. Create account via Embedded Signup
2. Check Firestore: `whatsappAccountReviewStatus` should be "PENDING"
3. Wait for Meta review (or manually trigger in Meta Business Suite)
4. Check webhook logs: `firebase functions:log --only whatsappTechProviderWebhook`
5. Check Firestore: Status should update to "APPROVED"

### Test Phone Verification Update
1. Add phone number in Meta Business Suite
2. Verify phone number
3. Check webhook logs for `phone_number_verification` event
4. Check Firestore: Phone status should update

## 📊 Webhook Event Structure

### Account Review Update
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "account_alerts",
      "value": {
        "account_review_status": "APPROVED",
        "event": "ACCOUNT_REVIEW_UPDATE"
      }
    }]
  }]
}
```

### Phone Verification Update
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "phone_number_verification",
      "value": {
        "phone_number_id": "PHONE_ID",
        "verification_status": "VERIFIED"
      }
    }]
  }]
}
```

## ✅ Verification Checklist

- [ ] Webhook URL configured in Meta App Dashboard
- [ ] Verify token matches Firebase Secret
- [ ] `account_alerts` field subscribed
- [ ] Webhook verified (GET request works)
- [ ] Test webhook receives events (POST requests)
- [ ] Firestore updates when status changes
- [ ] Frontend displays updated status

## 🐛 Troubleshooting

### Webhook Not Receiving Events
1. Check webhook URL is correct
2. Verify token matches
3. Check webhook is verified in Meta Dashboard
4. Check function logs: `firebase functions:log --only whatsappTechProviderWebhook`
5. Verify subscribed fields include `account_alerts`

### Status Not Updating
1. Check webhook handler logs
2. Verify WABA ID matches in Firestore
3. Check if webhook event is being received
4. Verify Firestore update permissions

### Account Not Detected
1. Check postMessage handler logs
2. Use "Check for Account" button
3. Verify `detectNewWABA` function works
4. Check Business Manager access

