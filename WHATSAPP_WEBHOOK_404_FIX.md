# WhatsApp Webhook 404 Error - Diagnosis & Fix

## Current Issue

Accessing `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook` returns **404 Site Not Found**.

## Root Cause

Firebase Hosting rewrites for Cloud Functions v2 are not working. Even existing rewrites like `/whatsapp/connect/callback` return 404, indicating a systemic issue with the rewrite configuration.

## PDF Diagnosis Summary

The PDF identified several critical issues:

### 1. ✅ Missing Redirect URI in Meta App Dashboard
- **Status**: Needs manual configuration
- **Action Required**: Add redirect URIs in Meta App Dashboard:
  - `https://stockpilotv1.web.app/whatsapp/embedded-signup/callback`
  - `http://localhost:3000/whatsapp/embedded-signup/callback` (for testing)

### 2. ⚠️ Business Portfolio Completeness Check
- **Status**: Not implemented
- **Impact**: Users might try signup with incomplete Business Portfolio
- **Recommendation**: Add `verifyBusinessPortfolio` function

### 3. ⚠️ Data Access Renewal Not Automated
- **Status**: Not implemented
- **Impact**: Data Access expires every 90 days, breaking all WhatsApp functionality
- **Recommendation**: Add `checkDataAccessStatus` function

### 4. ⚠️ FINISH Event Handling Incomplete
- **Status**: Only handles FINISH event
- **Missing**: LOADING, ERROR, CANCEL, PHONE_VERIFICATION_STARTED, PHONE_VERIFICATION_FAILED
- **Recommendation**: Add comprehensive event handling

### 5. ✅ Webhook Verification Token Mismatch
- **Status**: FIXED - Unified both webhooks to use same token
- **Action Required**: Ensure Meta Dashboard uses `flyp_tech_provider_webhook_token`

### 6. ⚠️ Missing Phone Number Auto-Registration
- **Status**: Partial - assumes success without PIN verification
- **Issue**: Marks as success even when PIN is missing
- **Recommendation**: Add proper OTP fallback handling

### 7. ⚠️ No Rate Limiting on API Calls
- **Status**: Not implemented
- **Impact**: Could hit Meta API rate limits
- **Recommendation**: Add `fetchWithRetry` utility with exponential backoff

## Immediate Fix for 404 Error

### Solution 1: Use Direct Function URL (Temporary)

For Meta webhook configuration, use the direct Cloud Run URL:
```
https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app
```

This works immediately while we fix the hosting rewrites.

### Solution 2: Fix Firebase Hosting Rewrites

The issue is that Firebase Hosting rewrites need the functions to be deployed first, and there may be a timing/caching issue.

**Steps to Fix:**

1. **Verify function names match exactly:**
   ```bash
   firebase functions:list | grep whatsapp
   ```

2. **Deploy functions first:**
   ```bash
   firebase deploy --only functions:whatsappWebhook,functions:whatsappTechProviderWebhook,functions:whatsappEmbeddedSignupCallback,functions:whatsappConnectCallback
   ```

3. **Then deploy hosting:**
   ```bash
   firebase deploy --only hosting
   ```

4. **Wait 1-2 minutes for propagation**

5. **Test the rewrite:**
   ```bash
   curl -I "https://stockpilotv1.web.app/whatsapp/tech-provider/webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=123"
   ```

### Solution 3: Alternative - Use Cloud Run Direct URLs

If rewrites continue to fail, configure Meta to use direct Cloud Run URLs:

- **Webhook URL**: `https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app`
- **Verify Token**: `flyp_tech_provider_webhook_token` (or your secret value)

**Pros:**
- ✅ Works immediately
- ✅ No hosting rewrite dependency
- ✅ More reliable

**Cons:**
- ❌ Less user-friendly URL
- ❌ Harder to change if function redeploys

## Testing the Fix

### Test 1: Direct Function URL
```bash
curl "https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=123"
```
Should return: `123`

### Test 2: Hosting Rewrite (After Fix)
```bash
curl "https://stockpilotv1.web.app/whatsapp/tech-provider/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=123"
```
Should return: `123`

### Test 3: Meta Dashboard Verification
1. Go to: https://developers.facebook.com/apps/1902565950686087/webhooks/
2. Set Callback URL to either:
   - `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook` (if rewrites work)
   - `https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app` (direct URL)
3. Set Verify Token to: `flyp_tech_provider_webhook_token`
4. Click "Verify and Save"
5. Should show "Verified" status

## Next Steps

1. **Immediate**: Use direct Cloud Run URL in Meta Dashboard
2. **Short-term**: Fix Firebase Hosting rewrites
3. **Medium-term**: Implement PDF recommendations (event handling, rate limiting, etc.)
4. **Long-term**: Add monitoring and automated checks

## Verification Checklist

- [ ] Direct function URL works (tested)
- [ ] Meta Dashboard webhook verified (using direct URL)
- [ ] Firebase Hosting rewrites fixed
- [ ] Hosting rewrite URL works
- [ ] Meta Dashboard updated to use hosting URL (optional)
- [ ] All webhook events received correctly

---

**Current Status**: Direct function URL works. Hosting rewrites need investigation.
