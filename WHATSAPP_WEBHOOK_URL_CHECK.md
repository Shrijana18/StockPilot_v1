# 🔍 WhatsApp Webhook URL - Critical Check!

## ⚠️ IMPORTANT: Webhook URL Must Be Firebase Function URL

**The webhook URL in Meta App Dashboard MUST be the Firebase Function URL, NOT the frontend URL!**

---

## ✅ Correct Webhook URL

**Your webhook function is:**
- Function Name: `whatsappTechProviderWebhook`
- Region: `us-central1`
- Project: `stockpilotv1`

**Correct Webhook URL:**
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

**NOT:**
- ❌ `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook` (frontend URL)
- ❌ `http://localhost:5173/...` (local URL)

---

## 🔍 Check Meta App Dashboard

**Go to:** `https://developers.facebook.com/apps/1902565950686087`

**Navigate to:** WhatsApp → Configuration → Subscribe to webhooks

**Verify:**
1. **Callback URL:** Should be:
   ```
   https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
   ```
2. **Verify Token:** Should be:
   ```
   flyp_tech_provider_webhook_token
   ```
3. **Webhook Fields:** Should be subscribed:
   - ✅ `messages`
   - ✅ `message_status`
   - ✅ `message_template_status_update`

---

## 🧪 Test Webhook

**Test webhook verification:**
```bash
curl "https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook?hub.mode=subscribe&hub.verify_token=flyp_tech_provider_webhook_token&hub.challenge=test123"
```

**Expected response:** `test123` (echoes the challenge)

---

## 📝 Why Messages Aren't Showing

**Possible reasons:**

1. **Wrong Webhook URL** - Using frontend URL instead of Firebase Function URL
2. **No messages sent yet** - Need to send a message TO your WhatsApp Business Number
3. **Webhook not verified** - Meta hasn't verified the webhook yet
4. **WABA ID mismatch** - WABA ID in Firestore doesn't match the one sending messages

---

## ✅ Complete Setup Checklist

- [ ] Webhook URL in Meta: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
- [ ] Verify Token: `flyp_tech_provider_webhook_token`
- [ ] Fields subscribed: `messages`, `message_status`
- [ ] Webhook verified (green checkmark in Meta)
- [ ] Send a test message TO your WhatsApp Business Number
- [ ] Check Firebase logs for webhook events
- [ ] Check Firestore for messages in `whatsappInbox` collection

---

## 🧪 How to Test

1. **Send a message TO your WhatsApp Business Number:**
   - From your personal WhatsApp
   - Send: "Hello" or any message
   - To: Your WhatsApp Business Number (the one configured)

2. **Check Firebase logs:**
   ```bash
   firebase functions:log --only whatsappTechProviderWebhook
   ```
   - Should see: "✅ Stored incoming message from..."

3. **Check Firestore:**
   - Go to Firebase Console → Firestore
   - Navigate to: `businesses/{your-uid}/whatsappInbox`
   - Should see the message document

4. **Check WhatsApp Hub:**
   - Refresh browser
   - Go to Inbox tab
   - Should show the conversation

---

## 🎯 Summary

**Most likely issue:** Webhook URL in Meta App Dashboard is wrong (using frontend URL instead of Firebase Function URL)

**Fix:** Update webhook URL in Meta App Dashboard to:
```
https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook
```

**Then test by sending a message to your WhatsApp Business Number! 🚀**

