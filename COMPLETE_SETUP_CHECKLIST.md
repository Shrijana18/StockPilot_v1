# Complete Setup Checklist - WhatsApp Tech Provider

## 🎯 Goal: Working Demo for Meta App Review

---

## ✅ Phase 1: Meta Business Suite Setup

### **1. Get App Credentials**
- [ ] Go to: `https://developers.facebook.com/apps/1902565950686087/settings/basic`
- [ ] Copy **App ID**: `1902565950686087` ✅ (Already have)
- [ ] Click "Show" next to App Secret
- [ ] Copy **App Secret**: `_________________`

### **2. Create System User (For Tech Provider)**
- [ ] Go to: `https://business.facebook.com/settings/system-users`
- [ ] Click "Add" button
- [ ] Create System User:
  - Name: "FLYP WhatsApp Manager"
  - Role: System User
- [ ] Assign permissions:
  - [ ] `whatsapp_business_management`
  - [ ] `whatsapp_business_messaging`
  - [ ] `business_management`
- [ ] Click "Generate New Token"
  - Select your app
  - Select permissions (same as above)
  - Click "Generate"
- [ ] **Copy token immediately** (can't see it again!): `_________________`

### **3. Configure Webhook (Optional for Demo)**
- [ ] Go to: `https://developers.facebook.com/apps/1902565950686087/webhooks/`
- [ ] Select product: "Whatsapp Business Account"
- [ ] Callback URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
- [ ] Verify Token: `flyp_tech_provider_webhook_token`
- [ ] Click "Verify and Save"

---

## ✅ Phase 2: Local Development Setup

### **1. Create .env File**

```bash
cd functions
```

**Option A: Use Setup Script (Easiest)**
```bash
./setup-demo-env.sh
```

**Option B: Manual Creation**
```bash
touch .env
```

Add to `functions/.env`:
```env
META_APP_ID=1902565950686087
META_APP_SECRET=your_app_secret_here
META_SYSTEM_USER_TOKEN=your_system_user_token_here
BASE_URL=http://localhost:5173
WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token
```

### **2. Test Locally**

**Terminal 1 - Start Firebase Emulator:**
```bash
cd functions
firebase emulators:start --only functions
```

**Terminal 2 - Start Frontend:**
```bash
# In root directory
npm run dev
```

### **3. Test Setup Flow**

1. Open: `http://localhost:5173/distributor-dashboard?tab=profile&section=whatsapp`
2. Click "Create WhatsApp Business Account" (Tech Provider)
3. Should see: "✅ WhatsApp Business Account created successfully!"
4. Click "Add Phone Number"
5. Should see: "✅ Phone number verification requested!"
6. Click "Setup Webhook"
7. Should see: "✅ Webhook configured successfully!"

---

## ✅ Phase 3: Test Message Sending

### **1. Add Test Retailer**

In your Firestore database, add a test retailer:
```javascript
// Collection: businesses/{distributorId}/connectedRetailers/{retailerId}
{
  businessName: "Test Retailer",
  phone: "+91XXXXXXXXXX", // Your test phone number
  retailerPhone: "+91XXXXXXXXXX"
}
```

### **2. Test Sending**

1. Navigate to: WhatsApp Hub
2. Click "Send Message" tab
3. Compose message: "Test message from FLYP"
4. Select test retailer
5. Click "Send Message"
6. **Check your phone/WhatsApp Web** - should receive message!

---

## ✅ Phase 4: Production Setup (After Demo)

### **1. Set Firebase Secrets**

```bash
# Set sensitive secrets
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
firebase functions:secrets:set META_APP_SECRET

# When prompted, paste the values
```

### **2. Set Firebase Config**

```bash
firebase functions:config:set meta.app_id="1902565950686087"
firebase functions:config:set base.url="https://stockpilotv1.web.app"
firebase functions:config:set whatsapp.webhook_verify_token="flyp_tech_provider_webhook_token"
```

### **3. Deploy Functions**

```bash
firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
```

---

## 🎥 Demo Video Checklist

### **Before Recording:**

- [ ] All environment variables set in `.env`
- [ ] Firebase emulator running
- [ ] Frontend running
- [ ] Test retailer added with phone number
- [ ] Test phone number ready (yours or test number)
- [ ] Screen recording software ready
- [ ] Audio quality checked

### **During Recording:**

- [ ] Show setup flow (30 seconds)
- [ ] Show actual message sending (60 seconds)
- [ ] Show message received on phone (important!)
- [ ] Show dashboard and stats (30 seconds)
- [ ] Total: 2-3 minutes

### **After Recording:**

- [ ] Video is clear and professional
- [ ] Audio is clear
- [ ] All key points covered
- [ ] Upload to YouTube/Vimeo (unlisted)
- [ ] Include link in App Review submission

---

## 🚨 Troubleshooting

### **Error: System User Token not configured**

**Solution:**
1. Check `functions/.env` exists
2. Check `META_SYSTEM_USER_TOKEN` is set
3. Restart Firebase emulator

### **Error: Missing or insufficient permissions**

**Solution:**
1. Check Firestore security rules
2. Ensure user is authenticated
3. Check collection permissions

### **Error: Failed to create WABA**

**Solution:**
1. Check System User token is valid
2. Check System User has correct permissions
3. Check Business Manager is properly configured

### **Error: Message not sending**

**Solution:**
1. Check phone number is verified in Meta
2. Check WABA is in production mode
3. Check System User token is valid
4. Check recipient number is in allowed list (for development mode)

---

## 📋 Quick Reference

### **Environment Variables Needed:**

| Variable | Where to Get | Required For |
|----------|-------------|--------------|
| `META_APP_ID` | Meta Developer Console | All functions |
| `META_APP_SECRET` | Meta Developer Console | OAuth flow |
| `META_SYSTEM_USER_TOKEN` | Meta Business Suite → System Users | Tech Provider |
| `BASE_URL` | Your app URL | OAuth callbacks |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | You set it | Webhook verification |

### **Meta URLs:**

- App Settings: `https://developers.facebook.com/apps/1902565950686087/settings/basic`
- System Users: `https://business.facebook.com/settings/system-users`
- Webhooks: `https://developers.facebook.com/apps/1902565950686087/webhooks/`
- WhatsApp Manager: `https://business.facebook.com/latest/whatsapp_manager`

---

## ✅ Final Checklist

### **For Demo:**
- [ ] `.env` file created with all variables
- [ ] Firebase emulator running
- [ ] Frontend running
- [ ] Test retailer with phone number added
- [ ] WABA created successfully
- [ ] Phone number added
- [ ] Webhook configured
- [ ] Test message sent successfully
- [ ] Message received on phone/WhatsApp Web

### **For Production:**
- [ ] Firebase Secrets set
- [ ] Firebase Config set
- [ ] Functions deployed
- [ ] Webhook configured in Meta
- [ ] Tested in production

---

## 🎉 Ready for Demo!

Once all checkboxes are done, you're ready to record your Meta App Review video!

**Key Points to Show:**
1. ✅ One-click WABA creation
2. ✅ Simple 3-step setup
3. ✅ Actual message sending
4. ✅ Message received on phone
5. ✅ Professional dashboard

---

**Good luck with your App Review! 🚀**

