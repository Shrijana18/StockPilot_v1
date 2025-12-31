# How to Check Firebase Function Logs

## Issue: "Body is unusable: Body has already been read"

**FIXED**: The error was caused by reading the response body twice. This has been fixed.

## Where to Check Logs

### Option 1: Firebase Console (Easiest)
1. Go to: https://console.firebase.google.com/project/stockpilotv1/functions/logs
2. Select function: `subscribeAppToWABA` or `checkEmbeddedSignupStatus`
3. Set time range to "Last hour" or "Last 24 hours"
4. Look for console.log outputs

### Option 2: Google Cloud Console
1. Go to: https://console.cloud.google.com/logs/query
2. Select project: `stockpilotv1`
3. Use this query:
```
resource.type="cloud_function"
resource.labels.function_name="subscribeAppToWABA"
resource.labels.region="us-central1"
```
4. Set time range to last hour

### Option 3: Firebase CLI
```bash
firebase functions:log
```

## What to Look For

After clicking "Subscribe App to WABA", look for:
- `"Subscribing app ... to WABA ..."`
- `"Subscription request body: ..."`
- `"Subscription successful: ..."`
- `"Verification response: ..."`
- `"Verification result: ..."`

## Manual Verification Steps

### 1. Check App Subscription in Meta Business Suite
1. Go to: https://business.facebook.com/settings
2. Navigate to: **Business Settings → Apps**
3. Find your app: `1902565950686087`
4. Click on it
5. Go to **WhatsApp → Configuration**
6. Check if it shows as connected to WABA `849529957927153`

### 2. Check Webhook Fields in Meta Developer Dashboard
1. Go to: https://developers.facebook.com/apps/1902565950686087/whatsapp-business/wa-configurations/
2. Scroll to **"Webhook fields"** section
3. Verify `messages` is toggled ON (Subscribed)
4. Look for any status-related fields

### 3. Verify System User Permissions
1. Go to: https://business.facebook.com/settings
2. Navigate to: **Business Settings → System Users**
3. Find your System User
4. Check it has:
   - `whatsapp_business_management` permission
   - Access to WABA `849529957927153`

## Expected Behavior After Fix

1. **Subscribe App to WABA** should work without "Body is unusable" error
2. **Webhook fields** should display correctly (not `[object Object]`)
3. **App subscription** should be detected after clicking subscribe
4. **Logs** should appear in Firebase Console

## If Still Not Working

1. **Clear browser cache** and refresh
2. **Wait 5-10 seconds** after clicking subscribe before refreshing
3. **Check Firebase Function logs** for detailed error messages
4. **Verify in Meta Dashboard** that subscription actually happened

