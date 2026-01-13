# WhatsApp Embedded Signup Diagnosis & Fix

## Problem Identified

When user "tea" created a WhatsApp Business account using Meta Embedded Signup:
- ✅ Account was created successfully in Meta Business Suite
- ❌ Information was NOT stored in Firestore immediately
- ❌ Frontend did NOT show the connected state

## Root Cause

**Meta Embedded Signup uses a REDIRECT callback, NOT postMessage!**

The current implementation was listening for `postMessage` events, but Meta Embedded Signup actually:
1. Opens the signup flow in the same window (or redirects)
2. After completion, redirects to a callback URL with query parameters
3. Does NOT send postMessage events

## What Was Missing

1. **Callback URL Configuration**: The embedded signup URL needs a `redirect_uri` parameter
2. **Callback Handler**: No cloud function to receive the redirect and save data
3. **User Identification**: Need to pass user ID via `state` parameter so callback knows which user
4. **Frontend Flow**: Frontend was opening popup and listening for postMessage (wrong approach)

## Solution Implemented

### 1. Created Embedded Signup Callback Handler ✅

**File**: `functions/whatsapp/embeddedSignupCallback.js`

- Receives redirect from Meta with WABA data in query parameters
- Extracts user ID from `state` parameter (session-based)
- Saves WABA data to Firestore
- Redirects to success page

### 2. Updated Embedded Signup URL ✅

**File**: `src/components/profile/ProfileSettings.jsx`

- Added `redirect_uri` parameter pointing to callback URL
- Changed from popup to same-window redirect (Meta's requirement)
- Creates session with user ID before redirecting
- Passes session ID in `state` parameter

### 3. Added Callback Route ✅

**File**: `firebase.json`

- Added route: `/whatsapp/embedded-signup/callback` → `whatsappEmbeddedSignupCallback`

### 4. Enhanced Success Page ✅

**File**: `src/pages/WhatsAppConnectSuccess.jsx`

- Added detection for pending WABAs
- Calls `detectNewWABA` if WABA wasn't matched
- Checks for both `meta` and `meta_tech_provider` providers

## Meta App Dashboard Configuration Required

**CRITICAL**: You must configure the callback URL in Meta App Dashboard:

1. Go to: https://developers.facebook.com/apps/1902565950686087/whatsapp-business/embedded-signup
2. Set **Redirect URI** to: `https://stockpilotv1.web.app/whatsapp/embedded-signup/callback`
   (Or your production domain + `/whatsapp/embedded-signup/callback`)
3. Save the configuration

## How It Works Now

### Flow:

1. **User clicks "Connect with Facebook"**
   - Frontend creates a session document with user ID
   - Redirects to Meta Embedded Signup URL with `state` = session ID

2. **User completes signup in Meta**
   - Meta creates WABA and phone number
   - Meta redirects to callback URL with WABA data

3. **Callback Handler Receives Data**
   - Extracts user ID from `state` parameter
   - Saves WABA data to Firestore
   - Redirects to success page

4. **Success Page Verifies**
   - Checks Firestore for saved WABA
   - Shows success message
   - Redirects back to profile settings

### Fallback Mechanism:

If user ID is not available in callback:
- Stores WABA in `pendingWABAs` collection
- Frontend `detectNewWABA` function matches it by business name/phone
- Automatically saves to correct user

## Testing Checklist

- [ ] Configure callback URL in Meta App Dashboard
- [ ] Deploy cloud function `whatsappEmbeddedSignupCallback`
- [ ] Test embedded signup flow end-to-end
- [ ] Verify WABA data is saved to Firestore
- [ ] Verify frontend shows connected state
- [ ] Test fallback detection if callback fails

## Debugging

### Check Browser Console:
- Look for redirect to callback URL
- Check for any errors in callback handler

### Check Firebase Functions Logs:
```bash
firebase functions:log --only whatsappEmbeddedSignupCallback
```

### Check Firestore:
- Look for WABA data in `businesses/{userId}` document
- Check `pendingWABAs` collection if callback didn't have user ID

### Common Issues:

1. **Callback URL not configured in Meta Dashboard**
   - Meta will redirect to default URL or show error
   - Solution: Configure redirect URI in Meta App Dashboard

2. **User not logged in when callback receives data**
   - State parameter won't have valid user ID
   - Solution: Fallback to `detectNewWABA` function

3. **CORS errors**
   - Callback handler has CORS enabled
   - Should work, but check if Meta's redirect respects CORS

## Next Steps

1. **Deploy the callback handler**:
   ```bash
   firebase deploy --only functions:whatsappEmbeddedSignupCallback
   ```

2. **Configure Meta App Dashboard**:
   - Set redirect URI to your production domain
   - Test with a new user account

3. **Monitor logs**:
   - Watch Firebase Functions logs during signup
   - Check Firestore for saved data

4. **Test the flow**:
   - Create a test account
   - Complete embedded signup
   - Verify data appears in Firestore
   - Verify frontend shows connected state
