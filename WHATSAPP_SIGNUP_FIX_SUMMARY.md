# WhatsApp Embedded Signup - Complete Fix Summary

## 🔍 Diagnosis

### Problem
When user "tea" created WhatsApp Business account via Meta Embedded Signup:
- ✅ Account created successfully in Meta Business Suite (shown in Meta's success page)
- ❌ Data NOT saved to Firestore
- ❌ Frontend NOT showing connected state

### Root Cause
**Meta Embedded Signup uses REDIRECT callback, NOT postMessage!**

The code was listening for `postMessage` events, but Meta actually:
1. Redirects the entire browser window (not a popup)
2. Sends data via URL query parameters in the redirect
3. Does NOT send postMessage events

## ✅ Solution Implemented

### 1. Created Callback Handler
**File**: `functions/whatsapp/embeddedSignupCallback.js`

- Receives redirect from Meta with WABA data
- Extracts user ID from `state` parameter
- Saves to Firestore immediately
- Redirects to success page

### 2. Updated Frontend Flow
**File**: `src/components/profile/ProfileSettings.jsx`

**Changes**:
- Removed popup approach (Meta doesn't support it)
- Changed to same-window redirect
- Creates session with user ID before redirect
- Passes session ID in `state` parameter
- Added `redirect_uri` to embedded signup URL

**Before**:
```javascript
const popup = window.open(EMBEDDED_SIGNUP_URL, ...);
window.addEventListener('message', handleMessage); // ❌ Never fires
```

**After**:
```javascript
// Create session with user ID
const sessionId = `embedded_${user.uid}_${Date.now()}`;
await setDoc(doc(db, 'whatsappOAuthSessions', sessionId), { uid: user.uid });

// Redirect with state parameter
const signupUrl = `${EMBEDDED_SIGNUP_URL}&state=${sessionId}`;
window.location.href = signupUrl; // ✅ Redirects, Meta sends data back via callback
```

### 3. Added Callback Route
**File**: `firebase.json`

```json
{
  "source": "/whatsapp/embedded-signup/callback",
  "function": "whatsappEmbeddedSignupCallback"
}
```

### 4. Enhanced Success Page
**File**: `src/pages/WhatsAppConnectSuccess.jsx`

- Detects pending WABAs
- Calls `detectNewWABA` as fallback
- Checks for both provider types

## 🔧 Meta App Dashboard Configuration Required

**CRITICAL STEP**: Configure callback URL in Meta App Dashboard

1. Go to: https://developers.facebook.com/apps/1902565950686087/whatsapp-business/embedded-signup
2. Set **Redirect URI** to:
   - Production: `https://stockpilotv1.web.app/whatsapp/embedded-signup/callback`
   - Or your domain: `https://yourdomain.com/whatsapp/embedded-signup/callback`
3. Save configuration

**Without this, Meta won't redirect to your callback!**

## 📋 How It Works Now

### Complete Flow:

```
1. User clicks "Connect with Facebook"
   ↓
2. Frontend creates session: whatsappOAuthSessions/{sessionId}
   - Stores: { uid: user.uid, createdAt, expiresAt }
   ↓
3. Redirects to Meta Embedded Signup URL
   - URL includes: redirect_uri + state={sessionId}
   ↓
4. User completes signup in Meta
   - Meta creates WABA
   - Meta creates phone number
   ↓
5. Meta redirects to callback URL
   - URL: /whatsapp/embedded-signup/callback?waba_id=XXX&phone_number_id=YYY&state={sessionId}
   ↓
6. Callback Handler (whatsappEmbeddedSignupCallback)
   - Extracts state (sessionId)
   - Gets user ID from session document
   - Saves WABA data to Firestore: businesses/{userId}
   - Redirects to success page
   ↓
7. Success Page
   - Verifies WABA is saved
   - Shows success message
   - Redirects to profile settings
   ↓
8. Profile Settings Page
   - Auto-detects WABA from Firestore
   - Shows connected state
   - Shows 2FA verification if needed
```

## 🚀 Deployment Steps

### 1. Deploy Callback Handler
```bash
firebase deploy --only functions:whatsappEmbeddedSignupCallback
```

### 2. Configure Meta App Dashboard
- Set redirect URI (see above)
- Save configuration

### 3. Test Flow
1. Log in as a user
2. Go to Profile Settings → WhatsApp
3. Click "Connect with Facebook"
4. Complete Meta signup
5. Verify redirect to callback
6. Verify data in Firestore
7. Verify frontend shows connected state

## 🔍 Debugging

### Check Browser Console
- Should see redirect to Meta Embedded Signup
- After completion, redirect to callback URL
- Then redirect to success page

### Check Firebase Functions Logs
```bash
firebase functions:log --only whatsappEmbeddedSignupCallback
```

Look for:
- `✅ WABA {waba_id} saved for user {uid} via embedded signup callback`

### Check Firestore
- `businesses/{userId}` should have WhatsApp fields:
  - `whatsappBusinessAccountId`
  - `whatsappPhoneNumberId`
  - `whatsappPhoneNumber`
  - `whatsappEnabled: true`
  - `whatsappProvider: "meta_tech_provider"`
  - `whatsappCreatedVia: "embedded_signup"`

### Common Issues

1. **"No user ID found" error**
   - Session expired or state parameter missing
   - Solution: Fallback to `detectNewWABA` function

2. **Callback URL not configured**
   - Meta redirects to wrong URL
   - Solution: Configure in Meta App Dashboard

3. **CORS errors**
   - Check callback handler has CORS enabled (it does)
   - Should work automatically

## 📝 Additional Notes

### Fallback Mechanism
If callback doesn't have user ID:
- Stores WABA in `pendingWABAs` collection
- Frontend `detectNewWABA` function matches by business name/phone
- Automatically saves to correct user

### Session Expiry
- Sessions expire after 10 minutes
- User must complete signup within 10 minutes
- If expired, fallback detection will still work

### Security
- Session documents are temporary
- Deleted after use
- User must be authenticated to create session
- Callback validates user exists before saving

## ✅ Verification Checklist

After deployment, verify:

- [ ] Callback handler deployed successfully
- [ ] Meta App Dashboard has callback URL configured
- [ ] User can click "Connect with Facebook"
- [ ] Redirects to Meta Embedded Signup
- [ ] After signup, redirects to callback URL
- [ ] WABA data saved to Firestore
- [ ] Success page shows
- [ ] Profile Settings shows connected state
- [ ] 2FA verification works (if needed)

## 🎯 Expected Result

After fix:
1. User completes embedded signup
2. **Immediately** redirected to callback
3. **Immediately** data saved to Firestore
4. **Immediately** redirected to success page
5. **Immediately** frontend shows connected state

No more missing data! 🎉
