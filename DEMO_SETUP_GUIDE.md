# Demo Setup Guide - WhatsApp Tech Provider

## 🎯 For Meta App Review Video

**YES, you need a working setup with real/test numbers for the demo video!**

Meta reviewers want to see:
- ✅ Actual functionality working
- ✅ Real API calls
- ✅ Successful message sending
- ✅ Proper error handling

---

## 📋 What's Missing & Needs to be Configured

### **Required Environment Variables:**

1. **META_APP_ID** - Your Meta App ID (from Meta Developer Console)
2. **META_APP_SECRET** - Your Meta App Secret (from Meta Developer Console)
3. **META_SYSTEM_USER_TOKEN** - System User Access Token (for Tech Provider)
4. **BASE_URL** - Your app URL (e.g., `https://stockpilotv1.web.app` or `http://localhost:5173` for local)
5. **WHATSAPP_WEBHOOK_VERIFY_TOKEN** - Webhook verification token (you can set any string)

---

## 🔧 Setup Steps

### **Step 1: Get Meta App Credentials**

1. **Go to Meta Developer Console:**
   - URL: `https://developers.facebook.com/apps/{YOUR_APP_ID}/settings/basic`
   - Your App ID: `1902565950686087` (from screenshot)

2. **Get App ID:**
   - Already have it: `1902565950686087`

3. **Get App Secret:**
   - Go to: Settings → Basic
   - Click "Show" next to App Secret
   - Copy the secret

4. **Create System User (For Tech Provider):**
   - Go to: Meta Business Suite → Business Settings → System Users
   - Create System User: "FLYP Employee" (or "FLYP WhatsApp Manager")
   - **System User Role: Select "Employee"** ✅ (NOT Admin - Employee is correct for Tech Provider)
   - After creating, assign your app to the system user:
     - Click on the system user
     - Click "Assign Assets" or "Add Assets"
     - Select your app and assign it
   - Generate token:
     - Click "Generate New Token"
     - Select your app
     - Set expiration
     - **In "Assign permissions" step**, select:
       - `whatsapp_business_management`
       - `whatsapp_business_messaging`
       - `business_management`
     - Generate token
   - **Copy this token** - this is your `META_SYSTEM_USER_TOKEN`
   - **Note:** If you see "No permissions available", you need to assign the app to the system user first (see above)

---

### **Step 2: Configure Local Development (.env file)**

Create a `.env` file in the `functions/` directory:

```bash
# Navigate to functions directory
cd functions

# Create .env file
touch .env
```

Add these variables to `functions/.env`:

```env
# Meta App Credentials
META_APP_ID=1902565950686087
META_APP_SECRET=your_app_secret_here

# System User Token (for Tech Provider)
META_SYSTEM_USER_TOKEN=your_system_user_token_here

# Base URL (for local development)
BASE_URL=http://localhost:5173

# Webhook Verify Token (can be any string)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token
```

**⚠️ IMPORTANT:** Add `.env` to `.gitignore` (already should be there)

---

### **Step 3: Configure Firebase Functions (Production)**

For production/deployed functions, use Firebase Secrets:

```bash
# Set secrets (sensitive data)
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
firebase functions:secrets:set META_APP_SECRET

# Set config (non-sensitive)
firebase functions:config:set meta.app_id="1902565950686087"
firebase functions:config:set base.url="https://stockpilotv1.web.app"
firebase functions:config:set whatsapp.webhook_verify_token="flyp_tech_provider_webhook_token"
```

**Note:** For Firebase Functions v2, secrets are accessed differently. Update the code to use secrets properly.

---

### **Step 4: Update Functions to Use Secrets Properly**

The current code uses `process.env` which works for:
- ✅ Local development (with `.env` file)
- ❌ Production (needs Firebase Secrets)

We need to update the functions to support both.

---

## 🎬 Demo Setup Options

### **Option 1: Use Test Numbers (Recommended for Demo)**

Meta provides test numbers for development:
- Go to: WhatsApp Manager → Phone Numbers
- Use test numbers (they don't require verification)
- Can send to your own WhatsApp number for testing

**Pros:**
- ✅ No phone verification needed
- ✅ Works immediately
- ✅ Perfect for demo

**Cons:**
- ⚠️ Limited to test numbers only

### **Option 2: Use Real Phone Number**

1. Add your phone number in Meta Business Suite
2. Complete OTP verification
3. Use real number for demo

**Pros:**
- ✅ Shows real functionality
- ✅ More impressive for review

**Cons:**
- ⚠️ Requires phone verification
- ⚠️ Takes more time

---

## 🔍 What Needs to be Fixed

### **1. Environment Variable Access**

**Current Issue:**
- Functions use `process.env` which doesn't work in production
- Need to use Firebase Secrets for production

**Solution:**
- Update `getEnvVar()` function to check Firebase Secrets first
- Fall back to `process.env` for local development

### **2. Missing Configuration**

**Current Status:**
- ❌ No `.env` file in functions/
- ❌ No Firebase Secrets configured
- ❌ System User Token not set

**Action Required:**
- Create `.env` file
- Set Firebase Secrets
- Get System User Token from Meta

### **3. Webhook Configuration**

**Current Status:**
- Webhook URL needs to be configured in Meta
- Webhook verify token needs to match

**Action Required:**
- Configure webhook in Meta Developer Console
- Use the same verify token in both places

---

## 📝 Quick Setup Checklist

### **For Local Development (Demo Recording):**

- [ ] Create `functions/.env` file
- [ ] Add `META_APP_ID=1902565950686087`
- [ ] Add `META_APP_SECRET` (get from Meta)
- [ ] Add `META_SYSTEM_USER_TOKEN` (create System User, get token)
- [ ] Add `BASE_URL=http://localhost:5173`
- [ ] Add `WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token`
- [ ] Test locally: `npm run serve` in functions directory
- [ ] Test WABA creation
- [ ] Test message sending

### **For Production (After Demo):**

- [ ] Set Firebase Secrets: `META_SYSTEM_USER_TOKEN`, `META_APP_SECRET`
- [ ] Set Firebase Config: `meta.app_id`, `base.url`, `whatsapp.webhook_verify_token`
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Configure webhook in Meta Developer Console
- [ ] Test in production

---

## 🎥 Demo Video Requirements

### **What to Show:**

1. **Setup Flow (30 seconds):**
   - Navigate to Profile Settings → WhatsApp
   - Click "Create WhatsApp Business Account"
   - Show automatic WABA creation
   - Show phone number addition
   - Show webhook setup

2. **Actual Message Sending (60 seconds):**
   - Navigate to WhatsApp Hub
   - Compose a message
   - Select retailers
   - Click "Send Message"
   - **Show actual message being sent** (use test number or your own)
   - Show success confirmation
   - Show message in WhatsApp (on phone or WhatsApp Web)

3. **Value Demonstration (30 seconds):**
   - Show dashboard with stats
   - Show inbox with received messages
   - Show campaign management

### **What You Need:**

- ✅ Working Tech Provider setup
- ✅ Test phone number or your own number
- ✅ At least one test retailer with phone number
- ✅ Functions running (local or deployed)
- ✅ Environment variables configured

---

## 🚨 Current Errors & Fixes

### **Error 1: System User Token not configured**

```
Error: System User Token not configured. Please set META_SYSTEM_USER_TOKEN environment variable.
```

**Fix:**
1. Create System User in Meta Business Suite
2. Generate token
3. Add to `functions/.env`: `META_SYSTEM_USER_TOKEN=your_token_here`
4. Restart Firebase Functions emulator

### **Error 2: Missing or insufficient permissions**

```
FirebaseError: Missing or insufficient permissions.
```

**Fix:**
1. Check Firestore security rules
2. Ensure user is authenticated
3. Check collection permissions

### **Error 3: Failed to load resource (400 error)**

```
Failed to load resource: the server responded with a status of 400
```

**Fix:**
1. Check if functions are deployed
2. Check if environment variables are set
3. Check function logs: `firebase functions:log`

---

## 🔧 Next Steps

1. **Create `.env` file** in `functions/` directory
2. **Get Meta credentials** (App ID, App Secret, System User Token)
3. **Test locally** with Firebase emulator
4. **Record demo** showing actual functionality
5. **Deploy to production** after demo is approved

---

## 📞 Need Help?

If you encounter issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Check Meta Developer Console for errors
3. Verify all environment variables are set
4. Test with Firebase emulator first

---

**Ready to set up? Let's configure everything step by step! 🚀**

