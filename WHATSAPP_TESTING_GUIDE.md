# 🧪 WhatsApp Tech Provider - Testing Guide

## ✅ Current Status

**Your setup shows:**
- ✅ WABA Status: Created
- ✅ Phone Number: Configured
- ✅ Webhook: Active

**Everything is ready! Now let's test it.**

---

## 🔍 Step 1: Verify Webhook in Meta App Dashboard

**Important:** The webhook URL must be configured in Meta App Dashboard.

### **Check Webhook Configuration:**

1. **Go to Meta App Dashboard:**
   - `https://developers.facebook.com/apps/1902565950686087`

2. **Navigate to WhatsApp:**
   - Left sidebar → **WhatsApp** → **Configuration**

3. **Check Webhook:**
   - **Webhook URL:** Should be: `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook`
   - **Verify Token:** Should be: `flyp_tech_provider_webhook_token`
   - **Webhook Fields:** Should include:
     - ✅ `messages`
     - ✅ `message_status`
     - ✅ `message_template_status_update`

4. **If not configured:**
   - Click **"Edit"** or **"Add Callback URL"**
   - Enter Webhook URL: `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook`
   - Enter Verify Token: `flyp_tech_provider_webhook_token`
   - Subscribe to fields: `messages`, `message_status`, `message_template_status_update`
   - Click **"Verify and Save"**

---

## 🧪 Step 2: Test Sending a Message

### **Option A: Test via Your App (If you have a UI)**

1. **Find the send message feature** in your app
2. **Send a test message** to your WhatsApp number
3. **Check if it arrives**

### **Option B: Test via Firebase Function (Direct)**

**Using Firebase Console or curl:**

```bash
# Get your phone number ID from Firestore
# Then call the function:

curl -X POST \
  https://us-central1-stockpilotv1.cloudfunctions.net/sendMessageViaTechProvider \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_AUTH_TOKEN" \
  -d '{
    "data": {
      "to": "+91XXXXXXXXXX",
      "message": "Test message from FLYP Tech Provider"
    }
  }'
```

**Note:** You need to be authenticated (Firebase Auth token).

---

## 📱 Step 3: Test Receiving Messages (Webhook)

### **Test Incoming Message:**

1. **Send a message TO your WhatsApp Business Number:**
   - From your personal WhatsApp
   - Send: "Hello" or any message
   - To: Your WhatsApp Business Number

2. **Check Webhook Logs:**
   ```bash
   firebase functions:log --only whatsappTechProviderWebhook
   ```

3. **Expected:**
   - ✅ Webhook receives the message
   - ✅ Message is logged in Firebase
   - ✅ Status updates are received

---

## 🔍 Step 4: Verify Webhook Endpoint

### **Check Webhook Function:**

**Webhook URL:** `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook`

**Test webhook verification (GET request):**
```bash
curl "https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook?hub.mode=subscribe&hub.verify_token=flyp_tech_provider_webhook_token&hub.challenge=test123"
```

**Expected response:** `test123` (echoes the challenge)

---

## 📊 Step 5: Check Message Status Updates

**After sending a message, check:**

1. **Firebase Logs:**
   ```bash
   firebase functions:log --only whatsappTechProviderWebhook
   ```

2. **Look for:**
   - ✅ Message sent confirmation
   - ✅ Delivery status updates
   - ✅ Read receipts (if enabled)

---

## ✅ Step 6: Verify in Meta Business Suite

### **Check WhatsApp Manager:**

1. **Go to:** `https://business.facebook.com/latest/inbox`

2. **Select your WABA:**
   - "Test WhatsApp Business Account" (ID: `849529957927153`)

3. **Check:**
   - ✅ Messages are visible
   - ✅ Status shows "Connected"
   - ✅ Phone number is active

---

## 🎯 Quick Test Checklist

- [ ] Webhook URL configured in Meta App Dashboard
- [ ] Verify Token matches (`flyp_tech_provider_webhook_token`)
- [ ] Webhook fields subscribed (messages, message_status, etc.)
- [ ] Test sending a message (outgoing)
- [ ] Test receiving a message (incoming webhook)
- [ ] Check Firebase logs for webhook events
- [ ] Verify message status updates are received

---

## 🐛 Troubleshooting

### **If messages don't send:**

1. **Check phone number:**
   - Verify phone number ID in Firestore
   - Ensure phone number is approved in Meta

2. **Check permissions:**
   - System User has "Full control"
   - App has WhatsApp permissions

3. **Check logs:**
   ```bash
   firebase functions:log --only sendMessageViaTechProvider
   ```

### **If webhook doesn't receive messages:**

1. **Verify webhook URL:**
   - Check Meta App Dashboard
   - Ensure URL is accessible (not localhost)

2. **Check verify token:**
   - Must match: `flyp_tech_provider_webhook_token`

3. **Check webhook fields:**
   - Must include: `messages`, `message_status`

4. **Test webhook endpoint:**
   ```bash
   # Should return challenge
   curl "https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook?hub.mode=subscribe&hub.verify_token=flyp_tech_provider_webhook_token&hub.challenge=test123"
   ```

---

## 📝 Important Notes

1. **Webhook URL must be HTTPS:**
   - ✅ `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook`
   - ❌ `http://localhost:5173/...` (won't work)

2. **Phone Number:**
   - Must be approved by Meta
   - Must be linked to WABA

3. **Message Templates:**
   - For first message to a user, use approved template
   - After user replies, you can send free-form messages

---

## ✅ Summary

**What to check:**
1. ✅ Webhook configured in Meta App Dashboard
2. ✅ Test sending a message
3. ✅ Test receiving a message
4. ✅ Check Firebase logs
5. ✅ Verify status updates

**Everything is set up! Start testing! 🚀**

