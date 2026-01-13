# Meta App Dashboard Setup Instructions

## 🚨 CRITICAL: Missing Configurations

Based on your screenshots, here are the **exact steps** to fix the missing configurations:

---

## Step 1: Add Redirect URIs (MOST CRITICAL - Currently Empty!)

**Why This Is Critical**: 
- Your code shows: "No WABA found via detection" in console
- This happens when popup closes without postMessage
- Without redirect URIs, users get stuck on Facebook's page

**Steps**:

1. Go to: https://developers.facebook.com/apps/1902565950686087/business-login/settings/

2. Scroll down to **"Valid OAuth Redirect URIs"** section

3. Click in the input field and add these URIs (one per line):
   ```
   https://stockpilotv1.web.app/whatsapp/embedded-signup/callback
   http://localhost:5173/whatsapp/embedded-signup/callback
   http://localhost:3000/whatsapp/embedded-signup/callback
   ```

4. Click **"Save Changes"** button

**Important**: 
- "Use Strict Mode for redirect URIs" is enabled (Yes) - this means URIs must match **exactly**
- No trailing slashes unless specified
- Must include both production and development URLs

---

## Step 2: Update Webhook URL (Recommended)

**Current URL**: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`

**Problem**: This URL may not work due to Firebase Hosting rewrite issues (we saw 404 errors)

**Solution**: Use the direct Cloud Run URL instead

**Steps**:

1. Go to: https://developers.facebook.com/apps/1902565950686087/webhooks/

2. Select **"Whatsapp Business Account"** from the "Select product" dropdown

3. In the **"Callback URL"** field, replace the current URL with:
   ```
   https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app
   ```

4. **Verify Token** should be: `flyp_tech_provider_webhook_token`
   - (This is shown as masked dots in your screenshot - verify it matches)

5. Click **"Verify and Save"** button

6. Wait for verification - should show "Verified" status

**Why Use Cloud Run URL**:
- ✅ More reliable (doesn't depend on Firebase Hosting)
- ✅ Works immediately
- ✅ No 404 errors
- ✅ Direct access to function

---

## Step 3: Verify Webhook Fields Subscription

**Location**: Same page as Step 2 → "Webhook fields" section

**Currently Subscribed** (from your screenshot):
- ✅ `account_alerts`
- ✅ `account_review_update`
- ✅ `account_settings_update`
- ✅ `account_update`

**Additional Fields You Should Subscribe** (if not already):

1. **`messages`** - For receiving incoming messages from customers
2. **`message_status`** - For tracking message delivery status (sent, delivered, read, failed)
3. **`phone_number_name_update`** - For phone number verification updates
4. **`phone_number_verification`** - For phone verification status changes

**To Subscribe**:
- Find each field in the list
- Toggle the "Subscribe" switch to **ON** (blue)
- Ensure version is `v24.0` for all fields

**Why**: Your code subscribes to these fields programmatically, but Meta Dashboard subscription ensures they're active.

---

## Step 4: Optional - Add Deauthorize Callback

**Location**: Facebook Login for Business → Settings → Deauthorize callback URL

**Recommended URL**:
```
https://stockpilotv1.web.app/whatsapp/deauthorize
```

**Why**: Allows cleanup when users disconnect their account.

**Note**: You'll need to create this endpoint in your backend if you want to handle deauthorization.

---

## Step 5: Optional - Add Data Deletion Request URL

**Location**: Facebook Login for Business → Settings → Data Deletion Request URL

**Recommended URL**:
```
https://stockpilotv1.web.app/whatsapp/data-deletion
```

**Why**: Required for GDPR compliance.

**Note**: You'll need to create this endpoint in your backend if you want to handle data deletion requests.

---

## Verification Checklist

After completing the steps above:

### ✅ Test Redirect URI:
1. Open your app: `http://localhost:5173/distributor-dashboard`
2. Go to WhatsApp settings
3. Click "Connect with Facebook"
4. **Block the popup** (or let it close without completing)
5. Should redirect to: `https://stockpilotv1.web.app/whatsapp/embedded-signup/callback?waba_id=...`
6. If it redirects correctly → ✅ Success!

### ✅ Test Webhook:
1. Visit: `https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app?hub.mode=subscribe&hub.verify_token=flyp_tech_provider_webhook_token&hub.challenge=123`
2. Should return: `123`
3. If returns 123 → ✅ Success!

### ✅ Test Embedded Signup:
1. Complete embedded signup flow
2. Check browser console - should see WABA detected
3. Check Firestore - should have `whatsappBusinessAccountId` saved
4. If WABA is saved → ✅ Success!

---

## Current Status Summary

| Configuration | Status | Action Required |
|--------------|--------|----------------|
| Redirect URIs | ❌ **EMPTY** | **URGENT** - Add 3 URIs |
| Webhook URL | ⚠️ May not work | Update to Cloud Run URL |
| Webhook Token | ✅ Configured | Verify matches secret |
| Webhook Fields | ✅ Partially subscribed | Add messages, message_status |
| Embedded Signup Config | ✅ Configured | No action needed |
| Allowed Domains | ✅ Configured | No action needed |

---

## Why "No WABA Found via Detection" Error?

From your console screenshot, you're seeing:
```
No WABA found via detection
```

**This happens because**:
1. Popup closed without sending postMessage
2. Redirect callback doesn't work (redirect_uri not configured)
3. Fallback detection runs but can't find WABA

**After fixing Redirect URIs**:
- If popup is blocked → Redirect will work
- If popup closes → Redirect will work
- Detection will only be needed as last resort

---

## Quick Reference URLs

- **Meta App Dashboard**: https://developers.facebook.com/apps/1902565950686087/
- **Redirect URIs Settings**: https://developers.facebook.com/apps/1902565950686087/business-login/settings/
- **Webhook Settings**: https://developers.facebook.com/apps/1902565950686087/webhooks/
- **Embedded Signup Builder**: https://developers.facebook.com/apps/1902565950686087/whatsapp-business/es-integration/

---

**Priority**: 🔴 **Fix Redirect URIs FIRST** - This is blocking your embedded signup flow!
