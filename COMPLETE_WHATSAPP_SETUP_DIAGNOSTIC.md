# 🔍 Complete WhatsApp Setup Diagnostic

## ✅ What's Working

- ✅ Webhook fields subscribed (`messages`, `message_status`)
- ✅ Firestore permissions fixed
- ✅ Webhook verification working (GET requests successful)
- ✅ Frontend code ready

## ❌ What's Missing

**No message events are being received!**

---

## 🔍 Critical Issue: Webhook URL in Meta App Dashboard

**Your webhook function URL MUST be:**
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

**NOT:**
- ❌ `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook` (frontend URL - won't work!)
- ❌ `http://localhost:5173/...` (local URL - won't work!)

---

## ✅ Step-by-Step Fix

### **Step 1: Verify Webhook URL in Meta App Dashboard**

1. **Go to:** `https://developers.facebook.com/apps/1902565950686087`
2. **Navigate to:** WhatsApp → Configuration
3. **Scroll to:** "Subscribe to webhooks" section
4. **Check Callback URL:**
   - **Should be:** `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
   - **If different, fix it:**
     - Click "Remove subscription" or "Edit"
     - Enter: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
     - Verify Token: `flyp_tech_provider_webhook_token`
     - Click "Verify and Save"
     - Wait for green checkmark ✅

---

### **Step 2: Verify Webhook Fields Are Subscribed**

**In Meta App Dashboard → WhatsApp → Configuration:**

**Scroll to "Webhook fields" table:**

**Must be SUBSCRIBED (toggle ON):**
- ✅ `messages` - For receiving incoming messages
- ✅ `message_status` - For delivery/read status

**Optional but recommended:**
- ✅ `message_template_status_update` - For template status

---

### **Step 3: Get Your WhatsApp Business Number**

**You need to know your WhatsApp Business Number to test:**

1. **Check Firestore:**
   - Go to Firebase Console → Firestore
   - Navigate to: `businesses/{your-uid}`
   - Check field: `whatsappPhoneNumberId` or `whatsappPhoneNumber`

2. **Or check Meta Business Suite:**
   - Go to: `https://business.facebook.com/settings/whatsapp_accounts`
   - Select your WABA
   - Go to "Phone numbers" tab
   - Copy the phone number (format: +91XXXXXXXXXX)

---

### **Step 4: Send a Test Message**

**To receive messages, you MUST send a message TO your WhatsApp Business Number:**

1. **Open WhatsApp on your phone**
2. **Send a message TO your WhatsApp Business Number**
   - Example: "Hello" or "Test message"
   - This triggers the webhook to send events to your function

3. **Check Firebase logs:**
   ```bash
   firebase functions:log --only whatsappTechProviderWebhook
   ```
   - Should see: "✅ Stored incoming message from..."

---

### **Step 5: Verify Message in Firestore**

1. **Go to:** Firebase Console → Firestore
2. **Navigate to:** `businesses/{your-uid}/whatsappInbox`
3. **Should see:** Message document with:
   - `from`: Phone number (sender)
   - `text`: Message text
   - `timestamp`: When received

---

### **Step 6: Check WhatsApp Hub**

1. **Refresh browser** (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
2. **Go to:** WhatsApp Hub → Inbox tab
3. **Should show:**
   - ✅ Conversation in list
   - ✅ Message in chat view

---

## 🔍 Why Messages Aren't Showing

### **Reason 1: Wrong Webhook URL (Most Likely)**

**If webhook URL in Meta is:**
- Frontend URL (`https://stockpilotv1.web.app/...`)
- Local URL (`http://localhost:5173/...`)

**Meta can't send webhook events to these URLs!**

**Fix:** Update to Firebase Function URL:
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

---

### **Reason 2: No Messages Sent Yet**

**The webhook only receives events when:**
- Someone sends a message TO your WhatsApp Business Number
- You send a message FROM your Business Number (status updates)

**Fix:** Send a test message TO your Business Number

---

### **Reason 3: Webhook Not Verified**

**If webhook shows error or no green checkmark:**

1. **Click "Verify and Save"** in Meta App Dashboard
2. **Ensure verify token matches:** `flyp_tech_provider_webhook_token`
3. **Wait for green checkmark** ✅

---

### **Reason 4: WABA ID Mismatch**

**The webhook looks for businesses with matching WABA ID:**

1. **Check your WABA ID in Firestore:**
   - `businesses/{your-uid}/whatsappBusinessAccountId`
   - Should match the WABA ID in Meta

2. **If different:**
   - Re-run "Create WABA" or "Get WABA" function
   - This will update the WABA ID in Firestore

---

## 🧪 Complete Test Flow

### **Test 1: Webhook Verification**

```bash
curl "https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook?hub.mode=subscribe&hub.verify_token=flyp_tech_provider_webhook_token&hub.challenge=test123"
```

**Expected:** Returns `test123`

---

### **Test 2: Send Message and Check Logs**

1. **Send message TO your Business Number**
2. **Check logs:**
   ```bash
   firebase functions:log --only whatsappTechProviderWebhook
   ```
3. **Look for:**
   - "✅ Stored incoming message from..."
   - POST request logs

---

### **Test 3: Check Firestore**

1. **Go to Firebase Console → Firestore**
2. **Check:** `businesses/{your-uid}/whatsappInbox`
3. **Should see:** Message documents

---

## 📝 Complete Checklist

### **Meta App Dashboard:**
- [ ] Webhook URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
- [ ] Verify Token: `flyp_tech_provider_webhook_token`
- [ ] Webhook verified (green checkmark ✅)
- [ ] Fields subscribed: `messages`, `message_status`

### **Firebase:**
- [ ] Firestore rules deployed
- [ ] Webhook function deployed
- [ ] Secrets configured

### **Testing:**
- [ ] Know your WhatsApp Business Number
- [ ] Sent test message TO Business Number
- [ ] Checked Firebase logs for webhook events
- [ ] Checked Firestore for message documents
- [ ] Refreshed browser and checked WhatsApp Hub

---

## 🎯 Most Likely Issue

**The webhook URL in Meta App Dashboard is probably using the frontend URL instead of the Firebase Function URL!**

**Fix:** Update webhook URL in Meta App Dashboard to:
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

**Then send a test message TO your WhatsApp Business Number!**

---

## ✅ Summary

**To get messages showing:**

1. **Fix webhook URL in Meta** (use Firebase Function URL)
2. **Send test message TO your Business Number**
3. **Check Firebase logs** for webhook events
4. **Check Firestore** for message documents
5. **Refresh browser** and check WhatsApp Hub

**After these steps, messages should appear! 🚀**

