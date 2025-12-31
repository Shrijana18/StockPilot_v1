# Meta Business Suite Setup Requirements

## ✅ What You Need to Check/Enable in Meta Business Suite

### 1. **Tech Provider App Configuration**

**Location:** https://developers.facebook.com/apps/

**Check:**
- ✅ App ID is configured
- ✅ System User Token is set (as Firebase Secret)
- ✅ App is in "Live" mode (not Development)

### 2. **Business Manager Setup**

**Location:** https://business.facebook.com/

**Required:**
- ✅ Business Manager account exists
- ✅ System User has access to Business Manager
- ✅ System User has `whatsapp_business_management` permission

**To Check:**
1. Go to Business Settings → Users → System Users
2. Find your System User
3. Verify it has access to Business Manager
4. Check permissions include:
   - `whatsapp_business_management`
   - `business_management`

### 3. **WhatsApp Product Access**

**Location:** https://developers.facebook.com/apps/{APP_ID}/whatsapp-business/configuration

**Required:**
- ✅ WhatsApp product is added to your app
- ✅ Business Verification status (if required)
- ✅ Embedded Signup is enabled (if using)

**To Enable Embedded Signup:**
1. Go to App Dashboard → WhatsApp → Configuration
2. Scroll to "Embedded Signup" section
3. Enable if not already enabled
4. Note: This may require Business Verification

### 4. **System User Permissions**

**Location:** Business Settings → Users → System Users → [Your System User] → Assign Assets

**Required Permissions:**
- ✅ `whatsapp_business_management` - To create/manage WABAs
- ✅ `business_management` - To access Business Manager
- ✅ `whatsapp_business_messaging` - To send messages (if needed)

**To Assign:**
1. Go to Business Settings
2. Users → System Users
3. Select your System User
4. Click "Assign Assets"
5. Assign Business Manager
6. Grant permissions

### 5. **WhatsApp Business API Access**

**Location:** https://business.facebook.com/settings/whatsapp-business-accounts

**Check:**
- ✅ You can see/create WABAs
- ✅ Phone numbers can be registered
- ✅ API access is enabled

### 6. **Webhook Configuration** (For receiving messages)

**Location:** https://developers.facebook.com/apps/{APP_ID}/whatsapp-business/webhooks

**Required:**
- ✅ Webhook URL configured
- ✅ Verify Token set
- ✅ Subscription fields: `messages`, `message_status`

**Your Webhook URL:**
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

**Verify Token:**
```
flyp_whatsapp_webhook_token
```

## 🔍 Verification Checklist

Before users can create individual WABAs, verify:

- [ ] System User Token is valid and has correct permissions
- [ ] Business Manager is accessible
- [ ] WhatsApp product is added to app
- [ ] System User can create WABAs (test this)
- [ ] Phone number registration works (test with a test number)
- [ ] OTP sending works (test with a test number)

## 🧪 Testing Individual WABA Creation

### Test Flow:

1. **Test WABA Creation:**
   ```javascript
   // Call createIndividualWABA with test data
   {
     phoneNumber: "9876543210", // Test number
     businessName: "Test Business"
   }
   ```

2. **Check Response:**
   - Should return `success: true`
   - Should return `wabaId`
   - Should return `requiresOTP: true`

3. **Test OTP Verification:**
   ```javascript
   // Call verifyPhoneOTP with OTP received
   {
     otpCode: "123456" // OTP from phone
   }
   ```

4. **Verify Result:**
   - Phone number should be verified
   - WABA should be ready to use
   - User should be able to send messages

## ⚠️ Common Issues

### Issue 1: "Business Manager not found"
**Solution:**
- Ensure System User has access to Business Manager
- Check Business Manager ID is correct

### Issue 2: "Permission denied"
**Solution:**
- Check System User permissions
- Ensure `whatsapp_business_management` permission is granted

### Issue 3: "Phone number already registered"
**Solution:**
- User must use a NEW phone number
- Number cannot be used with personal WhatsApp

### Issue 4: "OTP not received"
**Solution:**
- Check phone number format
- Ensure number is valid and can receive SMS
- Try voice call option (if implemented)

## 📝 Notes

1. **Business Verification:**
   - May be required for some features
   - Usually takes 24-48 hours
   - Required for production use

2. **Rate Limits:**
   - WABA creation: Limited by Meta
   - Phone registration: Limited by Meta
   - OTP requests: Limited (usually 3-5 per hour)

3. **Phone Number Requirements:**
   - Must be new (not used with WhatsApp)
   - Must be able to receive SMS/calls
   - Must be in supported country

## ✅ Current Setup Status

Based on your existing code, you likely have:
- ✅ System User Token configured
- ✅ Business Manager access
- ✅ Basic WABA creation working

**What to verify:**
- [ ] Phone number registration endpoint works
- [ ] OTP sending works
- [ ] OTP verification works
- [ ] Individual WABA creation works for multiple users

## 🚀 Next Steps

1. **Test the new functions:**
   - `createIndividualWABA`
   - `verifyPhoneOTP`
   - `checkPhoneRegistrationStatus`

2. **Deploy functions:**
   ```bash
   firebase deploy --only functions:createIndividualWABA,functions:verifyPhoneOTP,functions:checkPhoneRegistrationStatus
   ```

3. **Test with real phone number:**
   - Use a test number
   - Complete full flow
   - Verify everything works

4. **Update frontend:**
   - Add IndividualWABASetup component
   - Integrate into WhatsApp Hub
   - Test user flow

