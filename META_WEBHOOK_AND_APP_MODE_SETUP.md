# Meta Webhook & App Mode Setup Guide

## 🎯 What You Need to Configure in Meta

### **1. App Mode: Development vs Live**

**Current Status:** Your app is in **Development** mode (as shown in screenshot)

**What this means:**
- ✅ **Development Mode:** Perfect for testing and development
- ✅ You can test with test phone numbers
- ✅ Limited to test users/numbers
- ⚠️ **Live Mode:** Required for production use with real users

**When to switch to Live:**
- After App Review is approved
- When you're ready for production
- When you want to send messages to real users (not just test numbers)

**How to switch to Live:**
1. Go to: Meta Developer Console → Your App
2. Find "App Mode" toggle (top right, next to App ID)
3. Click "Live" toggle
4. You may need to complete App Review first

**For now:** Keep it in **Development** mode until App Review is approved ✅

---

### **2. Webhook Configuration (REQUIRED)**

**From your screenshot, you're on the Webhooks page - perfect!**

**Step-by-Step Webhook Setup:**

1. **Select Product:**
   - In the "Select product" dropdown, choose **"WhatsApp"** (not "User")
   - This is important - you need WhatsApp webhooks, not User webhooks

2. **Fill in Webhook Details:**

   **Callback URL:**
   ```
   https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
   ```
   
   **Verify Token:**
   ```
   flyp_tech_provider_webhook_token
   ```
   
   **Important:** This token must match exactly what's in your `.env` file:
   ```
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token
   ```

3. **Subscription Fields:**
   - After clicking "Verify and save", you'll be able to select subscription fields
   - Select these fields:
     - ✅ `messages` - Receive incoming messages
     - ✅ `message_status` - Receive message delivery status
     - ✅ `message_template_status_update` - Receive template status updates

4. **Click "Verify and save"**
   - Meta will send a GET request to your webhook URL
   - Your function will verify the token
   - If successful, you'll see "Verified" status

5. **Verify Status:**
   - After saving, you should see "Webhook verified" or similar
   - Check Firebase Functions logs to confirm verification

---

### **3. WhatsApp Product Configuration**

**Go to:** WhatsApp → Configuration

**Configure:**
1. **Webhook URL:** Same as above
2. **Verify Token:** Same as above
3. **Subscription Fields:** Same as above

---

## 🔧 Troubleshooting Webhook Verification

### **Issue: Webhook verification fails**

**Possible causes:**
1. Function not deployed yet
2. Wrong webhook URL
3. Token mismatch
4. Function not accessible

**Solutions:**
1. **Deploy function first:**
   ```bash
   firebase deploy --only functions:whatsappTechProviderWebhook
   ```

2. **Verify webhook URL is correct:**
   - Check Firebase Console → Functions
   - Copy the exact function URL
   - Must be: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`

3. **Verify token matches:**
   - Check `.env`: `WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token`
   - Must match exactly in Meta webhook settings

4. **Check function logs:**
   ```bash
   firebase functions:log --only whatsappTechProviderWebhook
   ```

---

## 📋 Complete Setup Checklist

### **Meta Developer Console:**
- [ ] App is in Development mode (OK for now)
- [ ] Webhook configured in Webhooks section
- [ ] Product selected: "WhatsApp" (not "User")
- [ ] Callback URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
- [ ] Verify Token: `flyp_tech_provider_webhook_token`
- [ ] Subscription fields selected: `messages`, `message_status`, `message_template_status_update`
- [ ] Webhook shows "Verified" status

### **Firebase:**
- [ ] Functions deployed successfully
- [ ] `whatsappTechProviderWebhook` function is accessible
- [ ] Environment variables set (`.env` for local, Secrets for production)

---

## 🚀 Next Steps After Webhook Setup

1. **Test Webhook:**
   - Send a test message from Meta
   - Check Firebase logs to see if webhook receives it

2. **Test WABA Creation:**
   - Use your frontend to call `createClientWABA`
   - Verify WABA is created in Meta Business Suite

3. **Test Message Sending:**
   - Use test phone numbers
   - Send a message via `sendMessageViaTechProvider`
   - Check webhook receives status updates

---

## ⚠️ Important Notes

1. **Development Mode:**
   - You can test with test phone numbers
   - Limited to test users
   - Perfect for development and App Review demo

2. **Live Mode:**
   - Required for production
   - Requires App Review approval
   - Can send to real users

3. **Webhook:**
   - Must be configured for message status updates
   - Must be accessible from internet (not localhost)
   - Token must match exactly

---

**Ready to configure? Follow the steps above! 🎯**

