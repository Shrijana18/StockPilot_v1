# Meta App Dashboard Configuration Checklist

## 🔧 Required Configurations for WhatsApp Embedded Signup

Based on expert recommendations, these configurations are **CRITICAL** for the integration to work properly.

### 1. JavaScript SDK Allowlist ⚠️ CRITICAL

**Why it's needed:** Prevents the popup from sending the `waba_id` back to your site.

**Steps:**
1. Go to: https://developers.facebook.com/apps/1902565950686087/settings/basic/
2. Scroll to **"JavaScript SDK"** section
3. Click **"Manage allowlist"** or **"Add Domain"**
4. Add these domains:
   - `https://flypnow.com` (Production)
   - `https://stockpilotv1.web.app` (Production)
   - `https://localhost:5173` (Development - if testing locally)
5. Click **"Save"**

**Without this:** Meta popup will not send postMessage events to your frontend.

---

### 2. Advanced Permissions (WhatsApp Business Messaging) ⚠️ CRITICAL

**Why it's needed:** Without "Advanced Access," your Tech Provider app cannot send messages for other users.

**Steps:**
1. Go to: https://developers.facebook.com/apps/1902565950686087/appreview/permissions/
2. Find **"whatsapp_business_messaging"** permission
3. Request **"Advanced Access"** (not just Standard)
4. Submit for review if required
5. Wait for approval (can take 24-48 hours)

**Without this:** You can create WABAs but cannot send messages on behalf of users.

---

### 3. Webhook Configuration ⚠️ CRITICAL

**Why it's needed:** Required to detect when Meta approves the display name and account status changes.

**Steps:**
1. Go to: https://developers.facebook.com/apps/1902565950686087/webhooks/
2. Add webhook URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
3. Subscribe to these fields:
   - ✅ `messages` - Incoming messages
   - ✅ `message_status` - Message delivery status
   - ✅ `message_template_status_update` - Template approval status
   - ✅ `account_alerts` - Account warnings/errors
   - ✅ `phone_number_name_update` - Phone number name/status changes
   - ✅ `account_update` - Account review status changes
4. Verify webhook (Meta will send a GET request)
5. Save configuration

**Without this:** You won't receive real-time updates about account status, phone verification, etc.

---

### 4. Embedded Signup Redirect URI (Production Only)

**Why it's needed:** For redirect callback method (fallback if popup doesn't work).

**Steps:**
1. Go to: https://developers.facebook.com/apps/1902565950686087/whatsapp-business/embedded-signup
2. Set **Redirect URI** to: `https://stockpilotv1.web.app/whatsapp/embedded-signup/callback`
3. Click **"Save"**

**Note:** This is optional if using popup method (which works on localhost).

---

### 5. App Review Status

**Check:**
1. Go to: https://developers.facebook.com/apps/1902565950686087/appreview/
2. Ensure app is in **"Live"** mode (not Development)
3. All required permissions are approved

**Without this:** App may not work for users outside your test accounts.

---

## ✅ Verification Checklist

After configuring, verify:

- [ ] JavaScript SDK allowlist includes your domains
- [ ] `whatsapp_business_messaging` has Advanced Access
- [ ] Webhook is configured and verified
- [ ] Webhook subscribes to all required fields
- [ ] Embedded Signup redirect URI is set (production)
- [ ] App is in Live mode
- [ ] All permissions are approved

---

## 🧪 Testing

After configuration:

1. **Test popup method (localhost):**
   - Open popup
   - Complete signup
   - Check console for postMessage events
   - Verify data saves to Firestore

2. **Test redirect method (production):**
   - Complete signup
   - Should redirect to callback URL
   - Verify data saves to Firestore

3. **Test webhook:**
   - Check webhook logs in Firebase Functions
   - Verify webhook receives events from Meta

---

## 🔍 Troubleshooting

### Issue: "Popup blocked" or no postMessage received
- **Solution:** Check JavaScript SDK allowlist includes your domain

### Issue: "Cannot send messages" error
- **Solution:** Request Advanced Access for `whatsapp_business_messaging`

### Issue: "Webhook not receiving events"
- **Solution:** Verify webhook URL is correct and subscribed to required fields

### Issue: "Account created but not showing in UI"
- **Solution:** Check if FINISH event is being received and triggering saveWABADirect

---

## 📚 References

- [Meta Embedded Signup Guide](https://developers.facebook.com/docs/whatsapp/embedded-signup)
- [Meta Tech Provider Integration](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)
- [Meta Webhooks Guide](https://developers.facebook.com/docs/graph-api/webhooks)
