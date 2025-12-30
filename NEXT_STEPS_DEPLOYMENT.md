# Next Steps - Deployment Guide

## ✅ What's Done

1. ✅ `.env` file template created in `functions/.env`
2. ✅ `.gitignore` already configured (`.env` is ignored)
3. ✅ Functions code already supports environment variables
4. ✅ WhatsApp Tech Provider functions are ready

## 🔧 Step 1: Update .env File with Your Actual Values

**You mentioned you have:**
- ✅ App ID: `1902565950686087`
- ✅ App Secret: (you have this)
- ✅ System User Token: (you have this)

**Update `functions/.env` file:**

Replace the placeholder values with your actual credentials:

```bash
cd functions
nano .env  # or use your preferred editor
```

**Update these lines:**
```env
META_APP_SECRET=your_actual_app_secret_here
META_SYSTEM_USER_TOKEN=your_actual_system_user_token_here
```

**Or use the setup script:**
```bash
cd functions
./setup-meta-env.sh
```

---

## 🧪 Step 2: Test Locally (Optional but Recommended)

Test your functions locally before deploying:

```bash
cd functions
npm run serve
```

This will start the Firebase emulator. You can test:
- `createClientWABA` - Create WhatsApp Business Account
- `getClientWABA` - Get WABA details
- `requestPhoneNumber` - Request phone number verification
- `sendMessageViaTechProvider` - Send messages

**Note:** For local testing, you'll need to use test phone numbers from Meta.

---

## 🚀 Step 3: Deploy to Firebase

### **3.1: Set Firebase Secrets (Sensitive Data)**

For production, sensitive data should be stored as Firebase Secrets:

```bash
# Set System User Token (sensitive)
firebase functions:secrets:set META_SYSTEM_USER_TOKEN

# Set App Secret (sensitive)
firebase functions:secrets:set META_APP_SECRET
```

**When prompted, paste your actual values:**
- For `META_SYSTEM_USER_TOKEN`: Paste your system user token
- For `META_APP_SECRET`: Paste your app secret

### **3.2: Set Firebase Config (Non-Sensitive Data)**

For non-sensitive configuration:

```bash
# Set App ID (non-sensitive)
firebase functions:config:set meta.app_id="1902565950686087"

# Set Base URL
firebase functions:config:set base.url="https://stockpilotv1.web.app"

# Set Webhook Verify Token
firebase functions:config:set whatsapp.webhook_verify_token="flyp_tech_provider_webhook_token"
```

**Note:** Firebase Functions v2 uses `process.env` for secrets, so the code will automatically pick them up.

### **3.3: Deploy Functions**

Deploy all WhatsApp Tech Provider functions:

```bash
firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
```

**Or deploy all functions:**
```bash
firebase deploy --only functions
```

---

## 📋 Step 4: Configure Webhook in Meta Developer Console

After deployment, configure the webhook:

1. **Go to Meta Developer Console:**
   - URL: `https://developers.facebook.com/apps/1902565950686087/whatsapp-business/wa-dev-quickstart`

2. **Configure Webhook:**
   - Webhook URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
   - Verify Token: `flyp_tech_provider_webhook_token`
   - Subscribe to:
     - ✅ `messages`
     - ✅ `message_status`
     - ✅ `message_template_status_update`

3. **Click "Verify and Save"**

---

## ✅ Step 5: Verify Deployment

### **Check Function URLs:**

After deployment, you'll see function URLs like:
```
✔  functions[whatsappTechProviderWebhook(us-central1)]: Successful create operation.
Function URL: https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

### **Test Functions:**

1. **Test WABA Creation:**
   - Use your frontend to call `createClientWABA`
   - Check Firebase Functions logs: `firebase functions:log`

2. **Test Webhook:**
   - Meta will verify the webhook automatically
   - Check logs for verification success

---

## 🔍 Troubleshooting

### **Issue: Functions can't find environment variables**

**Solution:**
- For local: Ensure `.env` file exists in `functions/` directory
- For production: Ensure Firebase Secrets are set correctly
- Check function logs: `firebase functions:log`

### **Issue: "System User Token not configured"**

**Solution:**
- Verify `.env` file has `META_SYSTEM_USER_TOKEN` (for local)
- Verify Firebase Secret is set: `firebase functions:secrets:access META_SYSTEM_USER_TOKEN`

### **Issue: Webhook verification fails**

**Solution:**
- Ensure webhook URL is accessible (not localhost)
- Verify token matches exactly: `flyp_tech_provider_webhook_token`
- Check function logs for errors

---

## 📝 Quick Command Reference

```bash
# Update .env file
cd functions
nano .env

# Test locally
npm run serve

# Set Firebase Secrets
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
firebase functions:secrets:set META_APP_SECRET

# Set Firebase Config
firebase functions:config:set meta.app_id="1902565950686087"
firebase functions:config:set base.url="https://stockpilotv1.web.app"
firebase functions:config:set whatsapp.webhook_verify_token="flyp_tech_provider_webhook_token"

# Deploy functions
firebase deploy --only functions

# Check logs
firebase functions:log

# View secrets (to verify)
firebase functions:secrets:access META_SYSTEM_USER_TOKEN
```

---

## 🎯 Next Steps After Deployment

1. ✅ Test WABA creation from your frontend
2. ✅ Test phone number addition
3. ✅ Test message sending
4. ✅ Configure webhook in Meta
5. ✅ Record demo video for App Review

---

**Ready to deploy? Let's go! 🚀**

