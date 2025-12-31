# Complete Setup Flow - FLYP Tech Provider

## ✅ What We Have

### Meta Setup (Already Configured):
1. **Business Manager:** FLYP Corporation Private Limited (ID: `1337356574811477`)
2. **System User:** FLYP Employee (ID: `61585723414650`)
   - Has access to Business Manager
   - Permissions: Business Management, WhatsApp Business Management, WhatsApp Business Messaging
   - Access Token: Configured in Firebase Secrets
3. **Tech Provider App:** FLYP Tech Provider (App ID: `1902565950686087`)
   - App Secret: Configured
   - Mode: Development
   - Added to Business Manager

## 🎯 Complete User Flow

### Step 1: User Opens FLYP Dashboard
```
User navigates to: /distributor-dashboard?tab=profile
Or: WhatsApp Hub section
```

### Step 2: User Sees Individual WABA Setup
```
Frontend shows:
- "Individual WhatsApp Business Setup"
- Form with:
  - Business Name: Auto-filled from FLYP profile
  - Phone Number: User enters NEW number (not used with WhatsApp)
```

### Step 3: User Submits Info
```
User clicks "Create WABA"
Frontend calls: createIndividualWABA({ phoneNumber, businessName })
```

### Step 4: Backend Creates WABA
```
Backend (createIndividualWABA):
1. ✅ Gets Business Manager ID: 1337356574811477
   - Tries: Environment variable
   - Tries: /me/businesses (System User's businesses)
   - Tries: /me?fields=business
   - Tries: From App

2. ✅ Creates WABA under Business Manager
   POST /{businessManagerId}/owned_whatsapp_business_accounts
   {
     "name": "Harsha Traders",  // User's business name
     "timezone_id": "Asia/Kolkata"
   }
   
3. ✅ Gets WABA ID from response

4. ✅ Subscribes FLYP Tech Provider App to WABA
   POST /{wabaId}/subscribed_apps
   {
     "app_id": "1902565950686087",
     "subscribed_fields": ["messages", "message_status", "message_template_status_update"]
   }

5. ✅ Requests phone number registration
   POST /{wabaId}/request_code
   {
     "phone_number": "+919876543210",
     "code_method": "SMS"
   }

6. ✅ Stores in Firestore:
   {
     whatsappBusinessAccountId: wabaId,
     whatsappPhoneNumber: phoneNumber,
     whatsappPhoneVerificationStatus: "pending_otp",
     whatsappCreatedVia: "individual_setup",
     whatsappEnabled: false
   }

7. ✅ Returns to frontend:
   {
     success: true,
     wabaId: "123456789",
     phoneNumber: "+919876543210",
     status: "pending_otp"
   }
```

### Step 5: User Receives OTP
```
Meta sends OTP to user's phone number
User sees: "Enter 6-digit OTP" form
```

### Step 6: User Verifies OTP
```
User enters OTP: 123456
Frontend calls: verifyPhoneOTP({ otp })
```

### Step 7: Backend Verifies OTP
```
Backend (verifyPhoneOTP):
1. ✅ Gets user's WABA ID from Firestore
2. ✅ Verifies OTP with Meta
   POST /{wabaId}/register_code
   {
     "code": "123456",
     "phone_number": "+919876543210"
   }

3. ✅ Gets phoneNumberId from response
4. ✅ Updates Firestore:
   {
     whatsappPhoneNumberId: phoneNumberId,
     whatsappPhoneVerificationStatus: "verified",
     whatsappEnabled: true
   }

5. ✅ Returns success
```

### Step 8: User Can Use WhatsApp
```
User can now:
- ✅ Send messages via WhatsApp Hub
- ✅ Receive messages
- ✅ Use all WhatsApp features
- ✅ All managed through FLYP platform
```

## 📋 Code Flow Summary

### Frontend Components:
1. **IndividualWABASetup.jsx**
   - Step 1: Create WABA (phone + business name)
   - Step 2: Verify OTP
   - Step 3: Success

2. **WhatsAppHub.jsx**
   - Shows IndividualWABASetup if no WABA
   - Shows WhatsApp features if WABA exists

3. **WhatsAppTechProviderSetup.jsx**
   - Profile settings integration
   - Shows setup status

### Backend Functions:
1. **createIndividualWABA**
   - Creates WABA under Business Manager
   - Subscribes Tech Provider App
   - Requests phone registration
   - Stores in Firestore

2. **verifyPhoneOTP**
   - Verifies OTP with Meta
   - Gets phoneNumberId
   - Updates Firestore

3. **checkPhoneRegistrationStatus**
   - Checks WABA and phone status
   - Returns current state

4. **getWhatsAppSetupStatus**
   - Returns complete setup status
   - Filters out old shared WABA

5. **getClientWABA**
   - Returns user's WABA details
   - Only for individual_setup WABAs

## ✅ Key Points

1. **All WABAs under FLYP Business Manager**
   - Business Manager ID: 1337356574811477
   - Managed by System User (FLYP Employee)

2. **Tech Provider App Subscribed to All WABAs**
   - App ID: 1902565950686087
   - Automatically subscribed when WABA is created

3. **Each User Gets Their Own WABA**
   - WABA name = User's business name
   - Phone number = User's phone number
   - Stored in Firestore with `whatsappCreatedVia: "individual_setup"`

4. **Phone Number Requirements**
   - Must be NEW (not used with WhatsApp)
   - Must be able to receive SMS
   - Must verify via OTP

## 🚀 Deployment

### Deploy Functions:
```bash
firebase deploy --only functions:createIndividualWABA,functions:verifyPhoneOTP,functions:checkPhoneRegistrationStatus,functions:getWhatsAppSetupStatus,functions:getClientWABA
```

### Verify Setup:
1. Test WABA creation
2. Check Business Manager in Meta Business Suite
3. Verify App subscription
4. Test OTP flow

## 📝 Environment Variables

### Required (Already Configured):
- `META_SYSTEM_USER_TOKEN` - System User access token (Firebase Secret)
- `META_APP_SECRET` - App secret (Firebase Secret)

### Optional (Defaults Provided):
- `META_APP_ID` - Defaults to `1902565950686087`
- `META_BUSINESS_MANAGER_ID` - Auto-detected from System User

## ✅ Verification Checklist

- [x] Business Manager exists (1337356574811477)
- [x] System User has access to Business Manager
- [x] Tech Provider App added to Business Manager
- [x] System User token configured
- [x] Code updated to use FLYP setup
- [x] App subscription automatic
- [x] Phone registration flow complete
- [x] OTP verification flow complete
- [x] Firestore storage configured
- [x] Frontend components integrated

## 🎯 Ready to Test!

The complete flow is now set up. Users can:
1. Enter phone number + business name
2. WABA created under FLYP Business Manager
3. Tech Provider App subscribed automatically
4. OTP sent and verified
5. Ready to use WhatsApp in FLYP!

