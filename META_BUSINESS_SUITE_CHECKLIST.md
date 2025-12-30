# Meta Business Suite Setup Checklist

## 🎯 Quick Reference Guide

This is a step-by-step checklist for what you need to do in Meta Business Suite to become a Tech Provider.

---

## ✅ Step 1: Complete App Review (CRITICAL)

### **Location:**
- URL: `https://developers.facebook.com/apps/{YOUR_APP_ID}/app-review`
- Or: Meta Business Suite → Apps → Your App → App Review

### **Actions:**
1. [ ] Click "Request Permissions" or "Add Permissions"
2. [ ] Request these permissions:
   - [ ] `whatsapp_business_management` ✅
   - [ ] `whatsapp_business_messaging` ✅
   - [ ] `business_management` ✅
3. [ ] Fill out the review form:
   - **Use Case:** "We are a Tech Provider building a B2B platform where distributors can send WhatsApp messages to retailers. We need to manage WhatsApp Business Accounts on behalf of our clients."
   - **Screenshots:** Upload screenshots of your platform
   - **Video (optional):** Show how your platform works
4. [ ] Submit for review
5. [ ] Wait for approval (24-48 hours typically)

### **Status Check:**
- Go to App Review page
- Look for: ✅ "Approved" status for each permission

---

## ✅ Step 2: Complete Tech Provider Onboarding

### **Location:**
- URL: `https://developers.facebook.com/apps/{YOUR_APP_ID}/whatsapp-business/wa-dev-quickstart`
- Or: WhatsApp Quickstart page → "Become a Tech Provider" card

### **Actions:**
1. [ ] Click "Continue Onboarding" button (shown in your screenshot)
2. [ ] Fill out Tech Provider application:
   - Business details
   - Use case description
   - Expected number of clients
   - Accept Tech Provider terms
3. [ ] Submit application
4. [ ] Wait for approval (3-7 business days)

### **Status Check:**
- Go to Quickstart page
- Look for: ✅ "Tech Provider" status or badge

---

## ✅ Step 3: Create System User

### **Location:**
- URL: `https://business.facebook.com/settings/system-users`
- Or: Meta Business Suite → Business Settings → System Users

### **Actions:**
1. [ ] Click "Add" button
2. [ ] Create System User:
   - **Name:** "FLYP WhatsApp Manager"
   - **Role:** System User
3. [ ] Assign permissions:
   - [ ] `whatsapp_business_management`
   - [ ] `whatsapp_business_messaging`
   - [ ] `business_management`
4. [ ] Click "Generate New Token"
5. [ ] Select your app
6. [ ] Select permissions (same as above)
7. [ ] Click "Generate Token"
8. [ ] **⚠️ IMPORTANT:** Copy and save the token securely
9. [ ] Store in Firebase Secrets:
   ```bash
   firebase functions:secrets:set META_SYSTEM_USER_TOKEN
   ```

### **Status Check:**
- Go to System Users page
- Look for: ✅ "FLYP WhatsApp Manager" with active token

---

## ✅ Step 4: Configure OAuth Redirect URIs

### **Location:**
- URL: `https://developers.facebook.com/apps/{YOUR_APP_ID}/settings/basic`
- Or: App Settings → Basic

### **Actions:**
1. [ ] Scroll to "Valid OAuth Redirect URIs"
2. [ ] Add these URIs:
   ```
   https://stockpilotv1.web.app/whatsapp/tech-provider/callback
   https://stockpilotv1.web.app/whatsapp/connect/callback
   ```
3. [ ] Click "Save Changes"

### **Status Check:**
- Verify URIs are listed in settings

---

## ✅ Step 5: Add App Domains

### **Location:**
- Same as Step 4: App Settings → Basic

### **Actions:**
1. [ ] Scroll to "App Domains"
2. [ ] Add domains:
   ```
   stockpilotv1.web.app
   stockpilotv1.firebaseapp.com
   ```
3. [ ] Click "Save Changes"

### **Status Check:**
- Verify domains are listed

---

## ✅ Step 6: Configure Webhook

### **Location:**
- URL: `https://developers.facebook.com/apps/{YOUR_APP_ID}/whatsapp-business/wa-dev-quickstart`
- Or: WhatsApp → Configuration → Webhooks

### **Actions:**
1. [ ] Click "Edit" or "Configure" next to Webhook
2. [ ] Enter Webhook URL:
   ```
   https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
   ```
3. [ ] Enter Verify Token:
   ```
   flyp_tech_provider_webhook_token
   ```
4. [ ] Select Subscription Fields:
   - [ ] `messages`
   - [ ] `message_status`
   - [ ] `message_template_status_update`
5. [ ] Click "Verify and Save"
6. [ ] Verify webhook shows ✅ "Verified" status

### **Status Check:**
- Go to Webhook settings
- Look for: ✅ "Verified" status

---

## ✅ Step 7: Enable Embedded Signup (Optional but Recommended)

### **Location:**
- URL: `https://developers.facebook.com/apps/{YOUR_APP_ID}/whatsapp-business/wa-dev-quickstart`
- Or: WhatsApp → Configuration → Embedded Signup

### **Actions:**
1. [ ] Click "Enable Embedded Signup"
2. [ ] Configure settings:
   - Business name
   - Default timezone
   - Default language
3. [ ] Save settings

### **Status Check:**
- Look for: ✅ "Embedded Signup Enabled"

---

## ✅ Step 8: Set Environment Variables

### **Location:**
- Firebase Console → Functions → Configuration
- Or: Terminal (Firebase CLI)

### **Actions:**
1. [ ] Set `META_APP_ID`:
   ```bash
   firebase functions:config:set meta.app_id="YOUR_APP_ID"
   ```

2. [ ] Set `META_APP_SECRET`:
   ```bash
   firebase functions:config:set meta.app_secret="YOUR_APP_SECRET"
   ```

3. [ ] Set `META_SYSTEM_USER_TOKEN` (as secret):
   ```bash
   firebase functions:secrets:set META_SYSTEM_USER_TOKEN
   ```

4. [ ] Set `BASE_URL`:
   ```bash
   firebase functions:config:set base.url="https://stockpilotv1.web.app"
   ```

5. [ ] Set `META_TECH_PROVIDER_MODE`:
   ```bash
   firebase functions:config:set meta.tech_provider_mode="true"
   ```

6. [ ] Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN`:
   ```bash
   firebase functions:config:set whatsapp.webhook_verify_token="flyp_tech_provider_webhook_token"
   ```

### **Status Check:**
- Go to Firebase Functions → Configuration
- Verify all variables are set

---

## ✅ Step 9: Deploy Functions

### **Location:**
- Terminal (Firebase CLI)

### **Actions:**
1. [ ] Deploy Tech Provider functions:
   ```bash
   firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
   ```

2. [ ] Verify deployment:
   - Check Firebase Functions dashboard
   - All functions should show "Deployed" status

### **Status Check:**
- Go to Firebase Functions dashboard
- Look for: ✅ All functions deployed successfully

---

## ✅ Step 10: Test Setup

### **Actions:**
1. [ ] Test WABA creation:
   - Use test account
   - Try creating WABA via your platform
   - Verify WABA appears in Meta Business Suite

2. [ ] Test phone number addition:
   - Add phone number via your platform
   - Verify phone number appears in WhatsApp Manager

3. [ ] Test message sending:
   - Send test message
   - Verify message is delivered

4. [ ] Test webhook:
   - Send test message
   - Check Firebase Functions logs for webhook events

### **Status Check:**
- All tests pass ✅
- No errors in Firebase Functions logs
- Messages sending successfully

---

## 📊 Summary Checklist

### **Meta Business Suite:**
- [ ] App Review completed and approved
- [ ] Tech Provider onboarding completed
- [ ] System User created with token
- [ ] OAuth redirect URIs configured
- [ ] App domains added
- [ ] Webhook configured and verified
- [ ] Embedded Signup enabled (optional)

### **Firebase:**
- [ ] Environment variables set
- [ ] System User token stored as secret
- [ ] Functions deployed
- [ ] Webhook URL accessible

### **Testing:**
- [ ] WABA creation works
- [ ] Phone number addition works
- [ ] Message sending works
- [ ] Webhook receiving events

---

## 🆘 Troubleshooting

### **Issue: App Review Rejected**
- Review feedback from Meta
- Address concerns
- Resubmit with more details

### **Issue: System User Token Not Working**
- Regenerate token
- Verify permissions are correct
- Check token hasn't expired

### **Issue: Webhook Not Verifying**
- Check webhook URL is accessible
- Verify token matches exactly
- Check Firebase Functions logs

### **Issue: WABA Creation Fails**
- Check System User permissions
- Verify Business Manager setup
- Check Firebase Functions logs

---

## 📞 Support Resources

1. **Meta Developer Documentation:**
   - https://developers.facebook.com/docs/whatsapp

2. **Tech Provider Guide:**
   - https://developers.facebook.com/docs/whatsapp/cloud-api/overview

3. **Firebase Functions Logs:**
   - Firebase Console → Functions → Logs

4. **Meta Business Suite:**
   - https://business.facebook.com

---

**Last Updated:** 2024
**Status:** Ready for Setup

