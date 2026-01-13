# Meta App Dashboard Configuration Checklist

## 🔴 CRITICAL: Missing Configurations

Based on the screenshots and code analysis, here are the **required** configurations that are currently missing:

---

## 1. ✅ Valid OAuth Redirect URIs (REQUIRED - Currently Empty)

**Location**: Facebook Login for Business → Settings → Valid OAuth Redirect URIs

**Status**: ❌ **EMPTY** - This is why embedded signup redirects don't work!

**Action Required**: Add these URIs:

```
https://stockpilotv1.web.app/whatsapp/embedded-signup/callback
http://localhost:5173/whatsapp/embedded-signup/callback
http://localhost:3000/whatsapp/embedded-signup/callback
```

**Why This Matters**: 
- Meta Embedded Signup can work in two ways:
  1. **postMessage** (popup) - Works immediately ✅
  2. **Redirect callback** - Requires redirect_uri in Meta Dashboard ❌ (Currently missing)

- Without this, if the popup is blocked or closed, users get stuck on Facebook's page
- The redirect_uri **cannot** be in the URL parameter - it **must** be configured in Meta Dashboard

**Steps**:
1. Go to: https://developers.facebook.com/apps/1902565950686087/business-login/settings/
2. Scroll to "Valid OAuth Redirect URIs"
3. Add all three URIs above (one per line)
4. Click "Save Changes"

---

## 2. ⚠️ Webhook URL (Needs Update)

**Location**: Webhooks → WhatsApp Business Account → Callback URL

**Current**: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`

**Status**: ⚠️ **May not work** due to Firebase Hosting rewrite issues

**Recommended**: Use direct Cloud Run URL:
```
https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app
```

**Why**: 
- Direct Cloud Run URLs are more reliable
- Don't depend on Firebase Hosting rewrites
- Work immediately without configuration issues

**Steps**:
1. Go to: https://developers.facebook.com/apps/1902565950686087/webhooks/
2. Select "Whatsapp Business Account" from product dropdown
3. Update "Callback URL" to the Cloud Run URL above
4. Verify token should be: `flyp_tech_provider_webhook_token` (or your secret value)
5. Click "Verify and Save"

---

## 3. ✅ Webhook Verify Token

**Location**: Webhooks → WhatsApp Business Account → Verify Token

**Current**: Should be set to: `flyp_tech_provider_webhook_token`

**Status**: ✅ **Likely configured** (shown as masked dots in screenshot)

**Action**: Verify it matches your Firebase Secret `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

---

## 4. ✅ Webhook Fields Subscription

**Location**: Webhooks → WhatsApp Business Account → Webhook fields

**Current Status**: ✅ **Subscribed** (from screenshots):
- `account_alerts` ✅
- `account_review_update` ✅
- `account_settings_update` ✅
- `account_update` ✅

**Additional Fields Recommended** (if not already subscribed):
- `messages` - For incoming messages
- `message_status` - For message delivery status
- `phone_number_name_update` - For phone verification updates
- `phone_number_verification` - For phone verification status

**Check**: Ensure all required fields are subscribed for complete functionality.

---

## 5. ⚠️ Deauthorize Callback URL (Optional but Recommended)

**Location**: Facebook Login for Business → Settings → Deauthorize callback URL

**Status**: ❌ **Empty**

**Recommended**: Add callback URL for when users disconnect:
```
https://stockpilotv1.web.app/whatsapp/deauthorize
```

**Why**: Allows you to clean up user data when they disconnect their account.

---

## 6. ⚠️ Data Deletion Request URL (Optional but Recommended)

**Location**: Facebook Login for Business → Settings → Data Deletion Request URL

**Status**: ❌ **Empty**

**Recommended**: Add callback URL for GDPR compliance:
```
https://stockpilotv1.web.app/whatsapp/data-deletion
```

**Why**: Required for GDPR compliance when users request data deletion.

---

## 7. ✅ Allowed Domains for JavaScript SDK

**Location**: Facebook Login for Business → Settings → Allowed Domains

**Current**: ✅ **Configured**:
- `https://flypnow.com/`
- `https://localhost:5173/`

**Status**: ✅ **Correct** - These are for JavaScript SDK, different from redirect URIs.

---

## 8. ✅ Embedded Signup Configuration

**Location**: WhatsApp → Embedded Signup Builder

**Current**: ✅ **Configured**:
- Config ID: `844028501834041`
- Name: "Embeded Signup"
- Status: Active

**Status**: ✅ **Correct**

---

## 📋 Complete Action Checklist

### Immediate (Required for Functionality):
- [ ] **Add Valid OAuth Redirect URIs** (Critical - currently empty!)
  - [ ] `https://stockpilotv1.web.app/whatsapp/embedded-signup/callback`
  - [ ] `http://localhost:5173/whatsapp/embedded-signup/callback`
  - [ ] `http://localhost:3000/whatsapp/embedded-signup/callback`

- [ ] **Update Webhook Callback URL** (Recommended)
  - [ ] Change from: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
  - [ ] Change to: `https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app`

- [ ] **Verify Webhook Token** matches Firebase Secret

### Recommended (Best Practices):
- [ ] Add Deauthorize Callback URL
- [ ] Add Data Deletion Request URL
- [ ] Verify all required webhook fields are subscribed

### Already Configured ✅:
- [x] Embedded Signup Config ID
- [x] Allowed Domains for JavaScript SDK
- [x] Webhook fields subscription (account_alerts, account_review_update, etc.)

---

## 🔍 Verification Steps

After making changes:

1. **Test Redirect URI**:
   - Complete embedded signup flow
   - If popup is blocked, should redirect to callback URL
   - Check browser console for any redirect errors

2. **Test Webhook**:
   - Visit: `https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=123`
   - Should return: `123`
   - Check Meta Dashboard shows "Verified" status

3. **Test Embedded Signup**:
   - Open embedded signup popup
   - Complete the flow
   - Verify WABA is detected and saved
   - Check Firestore for `whatsappBusinessAccountId`

---

## 🚨 Most Critical Issue

**The "Valid OAuth Redirect URIs" field is EMPTY** - this is the #1 reason why:
- Users get stuck on Facebook's page after signup
- Redirect callbacks don't work
- Fallback detection is required

**Fix this first!**

---

## 📝 Notes

- Redirect URIs must match **exactly** (including trailing slashes)
- "Use Strict Mode for redirect URIs" is enabled - this means exact matching is required
- Webhook URL can be either Cloud Functions URL or Cloud Run URL (Cloud Run is more reliable)
- All webhook fields should be subscribed for complete functionality

---

**Status**: ⚠️ **2 Critical Issues** - Redirect URIs and Webhook URL need configuration.
