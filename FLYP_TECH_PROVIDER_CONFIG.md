# FLYP Tech Provider Configuration

## ✅ Current Setup (As Configured)

### 1. **Business Manager**
- **Name:** FLYP Corporation Private Limited
- **Business Manager ID:** `1337356574811477`
- **Portfolio:** FLYP Tech Provider Manager Portfolio

### 2. **System Users**
- **FLYP Employee** (ID: `61585723414650`)
  - Has access to Business Manager
  - Permissions: Business Management, WhatsApp Business Management, WhatsApp Business Messaging
  - Access Token: Configured in Firebase Secrets
  
- **FLYP Shri** (ID: `61585528485890`)
  - Admin access
  - Full permissions

### 3. **Tech Provider App**
- **App Name:** FLYP Tech Provider
- **App ID:** `1902565950686087`
- **App Secret:** Configured
- **Mode:** Development (can switch to Live later)
- **Type:** Business

### 4. **Existing WABAs** (Under Business Manager)
- Satya Market
- Test WhatsApp Business Account
- FLYP Corporation Private Limited
- FLYP Trial

## 🎯 User Flow (How It Works)

### Step 1: User Submits Info
```
User enters in FLYP frontend:
- Phone Number: 9876543210 (new number, not used with WhatsApp)
- Business Name: "Harsha Traders" (from FLYP profile)
```

### Step 2: System Creates WABA
```
Backend (createIndividualWABA):
1. Gets Business Manager ID: 1337356574811477
2. Creates WABA under this Business Manager
3. WABA Name: "Harsha Traders"
4. WABA is owned by FLYP Tech Provider Business Manager
```

### Step 3: Subscribe Tech Provider App
```
Backend automatically:
1. Subscribes App (1902565950686087) to new WABA
2. Subscribes fields: messages, message_status, message_template_status_update
3. This allows FLYP platform to manage the WABA
```

### Step 4: Phone Registration
```
Backend:
1. Requests phone number registration
2. Sends OTP to user's phone
3. User enters OTP in frontend
4. System verifies OTP
5. Phone number connected to WABA
```

### Step 5: Ready to Use
```
User can now:
- Send messages via their WABA
- Receive messages
- Use all WhatsApp features
- All managed through FLYP platform
```

## 📋 Code Configuration

### Environment Variables Needed:

```bash
# System User Token (Already configured in Firebase Secrets)
META_SYSTEM_USER_TOKEN=your_token_here

# App ID (Optional - defaults to 1902565950686087)
META_APP_ID=1902565950686087

# Business Manager ID (Optional - will be auto-detected)
META_BUSINESS_MANAGER_ID=1337356574811477
```

### How Business Manager is Detected:

1. **First:** Checks `META_BUSINESS_MANAGER_ID` environment variable
2. **Second:** Tries `/me?fields=business` (System User's business)
3. **Third:** Tries `/me/businesses` (list of businesses)
4. **Fourth:** Tries from App (if app has associated Business Manager)

## ✅ Verification

### Test Business Manager Access:

```bash
# Using System User token
curl "https://graph.facebook.com/v22.0/me/businesses?access_token=YOUR_SYSTEM_USER_TOKEN"
```

Should return Business Manager ID: `1337356574811477`

### Test WABA Creation:

```bash
# Create test WABA
curl -X POST "https://graph.facebook.com/v22.0/1337356574811477/owned_whatsapp_business_accounts?access_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test WABA", "timezone_id": "Asia/Kolkata"}'
```

## 🎯 Key Points

- ✅ All WABAs created under FLYP Business Manager (1337356574811477)
- ✅ Tech Provider App (1902565950686087) is subscribed to all WABAs
- ✅ System User (FLYP Employee) manages all WABAs
- ✅ Each user gets their own WABA
- ✅ Phone numbers registered per WABA
- ✅ All managed through FLYP platform

## 🚀 Next Steps

1. **Deploy Functions:**
   ```bash
   firebase deploy --only functions:createIndividualWABA,functions:verifyPhoneOTP,functions:getWhatsAppSetupStatus
   ```

2. **Test Flow:**
   - User enters phone + business name
   - WABA created under Business Manager
   - App subscribed automatically
   - OTP sent and verified
   - Ready to use!

3. **Verify in Meta Business Suite:**
   - Go to Business Settings → Accounts → WhatsApp accounts
   - New WABA should appear
   - Verify App is subscribed

