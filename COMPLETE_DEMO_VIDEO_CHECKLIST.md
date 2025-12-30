# Complete Demo Video Checklist - Meta App Review

## 🎯 Goal: Record Working Demo Video for Meta Tech Provider App Review

---

## ✅ What's Already Done

1. **Backend Functions:**
   - ✅ All WhatsApp Tech Provider functions deployed
   - ✅ Memory issues fixed
   - ✅ Functions accessible

2. **Environment Variables:**
   - ✅ `.env` file configured with all values
   - ✅ Firebase Config set

3. **Frontend:**
   - ✅ WhatsApp Tech Provider Setup component exists
   - ✅ UI components ready

---

## 🔧 What Needs to be Fixed

### **Issue 1: Webhook Setup Error**

**Error:** `businessDoc.exists is not a function`

**Status:** Backend function looks correct, but error suggests version mismatch or incorrect usage.

**Action:** The backend function is correct. This might be a transient error. Let's verify the function works.

---

## 📋 Complete Setup Checklist

### **1. Meta Developer Console Settings**

#### **A. Webhook Configuration (REQUIRED - You're on this page!)**

**Current Status:** On Webhooks page, but not configured yet

**Action Items:**
- [ ] **Change Product:** Select "WhatsApp" (not "User") from dropdown
- [ ] **Callback URL:** `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
- [ ] **Verify Token:** `flyp_tech_provider_webhook_token`
- [ ] **Click "Verify and save"**
- [ ] **Select Subscription Fields:**
  - [ ] `messages`
  - [ ] `message_status`
  - [ ] `message_template_status_update`
- [ ] **Verify webhook shows "Verified" status**

#### **B. App Mode**

**Current Status:** Development mode ✅ (Correct for demo)

**Action:** Keep in Development mode for demo video ✅

**Note:** Switch to Live mode only after App Review approval

#### **C. WhatsApp Product Settings**

**Location:** WhatsApp → Configuration

**Check:**
- [ ] Webhook URL matches function URL
- [ ] Verify token matches
- [ ] Subscription fields selected

---

### **2. Firebase Functions**

#### **A. Functions Deployment**

**Status:** ✅ All functions deployed

**Verify:**
- [ ] `createClientWABA` - Working
- [ ] `getClientWABA` - Working (memory fixed)
- [ ] `requestPhoneNumber` - Working (memory fixed)
- [ ] `sendMessageViaTechProvider` - Working
- [ ] `setupWebhookForClient` - Working (memory fixed)
- [ ] `whatsappTechProviderWebhook` - Working

#### **B. Environment Variables**

**Local (.env):**
- [x] `META_APP_ID=1902565950686087`
- [x] `META_APP_SECRET` (you have it)
- [x] `META_SYSTEM_USER_TOKEN` (you have it)
- [x] `BASE_URL=http://localhost:5173`
- [x] `WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token`

**Production (Firebase Secrets):**
- [ ] Set `META_SYSTEM_USER_TOKEN` (for production)
- [ ] Set `META_APP_SECRET` (for production)

**Note:** For demo video, local `.env` is enough if testing locally.

---

### **3. Frontend Testing**

#### **A. Test Setup Flow**

**Steps to Test:**
1. [ ] Navigate to Profile Settings → WhatsApp
2. [ ] Click "Create WhatsApp Business Account"
3. [ ] Verify WABA is created (check console/logs)
4. [ ] Add phone number
5. [ ] Setup webhook
6. [ ] Verify all steps complete successfully

#### **B. Test Message Sending**

**Steps to Test:**
1. [ ] Navigate to WhatsApp Hub
2. [ ] Compose a test message
3. [ ] Select a test retailer (or your own number)
4. [ ] Send message
5. [ ] Verify message is received
6. [ ] Check status updates

---

### **4. Meta Business Suite**

#### **A. System User**

**Status:** ✅ Created as "FLYP Employee"

**Verify:**
- [ ] System User exists
- [ ] Token generated
- [ ] App assigned to System User
- [ ] Permissions granted:
  - [ ] `whatsapp_business_management`
  - [ ] `whatsapp_business_messaging`
  - [ ] `business_management`

#### **B. Test Phone Number**

**For Demo Video:**
- [ ] Use Meta test phone number (recommended)
- [ ] OR use your own phone number (requires verification)

**How to get test number:**
1. Go to Meta Business Suite → WhatsApp Manager
2. Use test numbers provided by Meta
3. No verification needed for test numbers

---

### **5. Demo Video Requirements**

#### **A. Pre-Recording Setup**

- [ ] Test account created and logged in
- [ ] All 3 steps work (WABA, Phone, Webhook)
- [ ] At least one test retailer with phone number
- [ ] Test message sending works
- [ ] Screen recording software ready
- [ ] Audio quality checked

#### **B. Video Content**

**Scene 1: Introduction (0:00 - 0:20)**
- [ ] Show FLYP dashboard
- [ ] Navigate to Profile Settings → WhatsApp
- [ ] Explain use case

**Scene 2: Setup Flow (0:20 - 1:30)**
- [ ] Click "Create WhatsApp Business Account"
- [ ] Show WABA creation (success message)
- [ ] Add phone number
- [ ] Setup webhook
- [ ] Show "WhatsApp API Ready!" message

**Scene 3: Send Message (1:30 - 2:00)**
- [ ] Navigate to WhatsApp Hub
- [ ] Compose message
- [ ] Select retailers
- [ ] Send message
- [ ] Show success confirmation
- [ ] Show message received (on phone/WhatsApp Web)

**Scene 4: Value Summary (2:00 - 2:30)**
- [ ] Show dashboard stats
- [ ] Show message history
- [ ] Show inbox

---

## 🚨 Critical Issues to Fix Before Recording

### **Issue 1: Webhook Setup Error**

**Error:** `businessDoc.exists is not a function`

**Possible Causes:**
1. Function not deployed correctly
2. Version mismatch
3. Firestore document issue

**Fix Steps:**
1. Check Firebase Functions logs
2. Verify function is deployed
3. Test function directly
4. Check Firestore document exists

**Test Command:**
```bash
firebase functions:log --only setupWebhookForClient
```

### **Issue 2: Meta Webhook Not Configured**

**Status:** Not configured yet

**Action:** Configure webhook in Meta Developer Console (you're on this page!)

---

## 📝 Step-by-Step: Configure Meta Webhook (Do This Now!)

1. **On the Webhooks page (where you are now):**
   - Change "Select product" dropdown from "User" to **"WhatsApp"**

2. **Fill in:**
   - **Callback URL:** `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
   - **Verify Token:** `flyp_tech_provider_webhook_token`

3. **Click "Verify and save"**

4. **After verification, select subscription fields:**
   - `messages`
   - `message_status`
   - `message_template_status_update`

5. **Verify status shows "Verified"**

---

## 🎬 Recording Checklist

### **Before Recording:**
- [ ] All functions working
- [ ] Webhook configured in Meta
- [ ] Test account ready
- [ ] Test phone number ready
- [ ] Screen recording software ready
- [ ] Audio quality checked
- [ ] Script ready

### **During Recording:**
- [ ] Clear narration
- [ ] Smooth transitions
- [ ] Show actual functionality
- [ ] No errors in console
- [ ] Success messages visible

### **After Recording:**
- [ ] Video is clear (1080p+)
- [ ] Audio is clear
- [ ] All key points covered
- [ ] Video length: 2-3 minutes
- [ ] Upload to YouTube/Vimeo (unlisted)
- [ ] Add description

---

## 🔍 Testing Flow for Demo

### **Test 1: Complete Setup**
1. Login as distributor
2. Go to Profile Settings → WhatsApp
3. Click "Create WhatsApp Business Account"
4. Wait for success
5. Add phone number
6. Setup webhook
7. Verify all steps complete

### **Test 2: Send Message**
1. Go to WhatsApp Hub
2. Compose message
3. Select retailer
4. Send
5. Verify message received
6. Check status updates

---

## ✅ Final Checklist Before Recording

### **Meta:**
- [ ] Webhook configured and verified
- [ ] App in Development mode
- [ ] System User token working
- [ ] Test phone number ready

### **Firebase:**
- [ ] All functions deployed
- [ ] Environment variables set
- [ ] Functions accessible
- [ ] No errors in logs

### **Frontend:**
- [ ] Setup flow works
- [ ] Message sending works
- [ ] UI is clean
- [ ] No console errors

### **Testing:**
- [ ] Complete setup tested
- [ ] Message sending tested
- [ ] Status updates working
- [ ] All features functional

---

## 🚀 Next Steps (Priority Order)

1. **NOW:** Configure webhook in Meta (you're on this page!)
2. **Fix:** Webhook setup error (check logs)
3. **Test:** Complete setup flow end-to-end
4. **Test:** Message sending
5. **Record:** Demo video
6. **Submit:** App Review with video

---

**You're almost there! Configure the webhook first, then test everything! 🎯**

