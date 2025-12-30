# Quick Demo Setup - WhatsApp Tech Provider

## 🎯 For Meta App Review Video

**YES - You need actual working setup with test/real numbers!**

Meta reviewers want to see real functionality, not just UI mockups.

---

## ⚡ Quick Setup (5 Minutes)

### **Step 1: Get Meta Credentials**

1. **App ID:** Already have it - `1902565950686087`

2. **App Secret:**
   - Go to: `https://developers.facebook.com/apps/1902565950686087/settings/basic`
   - Click "Show" next to App Secret
   - Copy it

3. **System User Token (For Tech Provider):**
   - Go to: `https://business.facebook.com/settings/system-users`
   - Click "Add" → Create System User
   - Name: "FLYP WhatsApp Manager"
   - Assign permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
     - `business_management`
   - Generate token
   - **Copy this token immediately** (you can't see it again!)

---

### **Step 2: Create .env File**

```bash
cd functions
touch .env
```

Add to `functions/.env`:

```env
META_APP_ID=1902565950686087
META_APP_SECRET=paste_your_app_secret_here
META_SYSTEM_USER_TOKEN=paste_your_system_user_token_here
BASE_URL=http://localhost:5173
WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token
```

---

### **Step 3: Test Locally**

```bash
# In functions directory
npm install
firebase emulators:start --only functions
```

In another terminal:
```bash
# In root directory
npm run dev
```

---

### **Step 4: Test Setup**

1. Open: `http://localhost:5173/distributor-dashboard?tab=profile&section=whatsapp`
2. Click "Create WhatsApp Business Account"
3. Should create WABA successfully
4. Add phone number
5. Setup webhook

---

## 🎥 For Demo Video

### **What You Need:**

1. ✅ **Working setup** (with .env configured)
2. ✅ **Test phone number** (or your own number)
3. ✅ **At least 1 test retailer** with phone number in your database
4. ✅ **Functions running** (local emulator or deployed)

### **What to Show:**

1. **Setup (30 sec):**
   - Profile Settings → WhatsApp
   - Click "Create WABA" → Success
   - Add phone → Success
   - Setup webhook → Success

2. **Send Message (60 sec):**
   - WhatsApp Hub
   - Compose message
   - Select retailer
   - Send → **Show actual message on phone/WhatsApp Web**
   - Show success confirmation

3. **Value (30 sec):**
   - Dashboard stats
   - Inbox messages
   - Campaign features

---

## 🚨 Current Error Fix

**Error:** `System User Token not configured`

**Fix:**
1. Create System User (see Step 1 above)
2. Get token
3. Add to `functions/.env`
4. Restart Firebase emulator

---

## 📝 Checklist

- [ ] App ID: `1902565950686087` ✅
- [ ] App Secret: Get from Meta
- [ ] System User Token: Create and get token
- [ ] Create `functions/.env` file
- [ ] Add all variables to `.env`
- [ ] Test locally
- [ ] Test WABA creation
- [ ] Test message sending
- [ ] Record demo video

---

## 🎬 Demo Script

**Scene 1 (30s):** Setup
- Navigate to WhatsApp settings
- Show Tech Provider option
- Click "Create WABA" → Show success
- Complete 3-step setup

**Scene 2 (60s):** Send Message
- Navigate to WhatsApp Hub
- Compose message
- Select retailer
- Send → **Show on phone/WhatsApp Web**
- Show success

**Scene 3 (30s):** Value
- Show dashboard
- Show inbox
- Show features

---

**Ready? Let's set it up! 🚀**

