# Firebase reCAPTCHA Setup Guide

## Problem
The `auth/invalid-app-credential` error occurs because Firebase Phone Authentication requires reCAPTCHA site keys to be configured in Firebase Console. Without these, OTP cannot be sent.

## Solution: Configure reCAPTCHA in Firebase Console

### Step 1: Navigate to reCAPTCHA Settings
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **StockPilotV1**
3. Navigate to: **Build** → **Authentication** → **Settings** → **Fraud prevention** → **reCAPTCHA**

### Step 2: Configure reCAPTCHA Site Keys

1. **Click "Manage reCAPTCHA"** button (top right)

2. **You'll be redirected to Google Cloud Console**

3. **Create/Get reCAPTCHA Site Keys:**

   **Option A: Use Existing reCAPTCHA v3 Keys (Recommended)**
   - If you already have reCAPTCHA v3 keys, you can reuse them
   - Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
   - Create a new site or use existing
   - Select **reCAPTCHA v3**
   - Add your domains:
     - `localhost` (for development)
     - `127.0.0.1` (for local testing)
     - `flypnow.com` (your production domain)
     - `www.flypnow.com` (subdomain)

   **Option B: Let Firebase Generate Keys**
   - Firebase can auto-generate keys when you enable reCAPTCHA
   - This happens automatically when you configure the platform

4. **Back in Firebase Console:**
   - Click **"Configure site keys"**
   - Select platform: **Web**
   - Enter your reCAPTCHA v3 Site Key (from Google reCAPTCHA Admin)
   - Give it a name (e.g., "StockPilot Web")
   - Click **Save**

### Step 3: Adjust SMS Fraud Risk Threshold

**Current Issue:** Your threshold is set to "Block max (0)", which blocks ALL requests even with minimal risk.

**Fix:**
1. In the same reCAPTCHA settings page
2. Find **"SMS fraud risk threshold score"**
3. Click the **pencil/edit icon**
4. Change from **"Block max (0)"** to one of:
   - **"Block high (0.5)"** - Recommended for production (blocks only high-risk scores ≥0.5)
   - **"Block medium (0.3)"** - More lenient
   - **"Block low (0.1)"** - Very lenient (not recommended for production)

5. Click **Save**

### Step 4: Set Phone Authentication Enforcement Mode

**Current Issue:** Mode is "UNSPECIFIED"

**Fix:**
1. Find **"Phone authentication enforcement mode"**
2. Click the **pencil/edit icon**
3. Select one of:
   - **"AUDIT"** - Logs but doesn't block (good for testing)
   - **"ENFORCE"** - Blocks requests that fail reCAPTCHA (recommended for production)
4. Click **Save**

### Step 5: Verify Configuration

After configuring:

1. **Check "Configured platform site keys" table:**
   - Should show at least one entry for "Web" platform
   - Assessment count should increase after usage

2. **Test OTP Flow:**
   - Go to your registration page
   - Enter a valid 10-digit Indian phone number
   - Click "Send OTP"
   - Check browser console for reCAPTCHA logs
   - OTP should be sent successfully

## Troubleshooting

### If OTP still fails after configuration:

1. **Clear browser cache and cookies**
   - Some browsers cache reCAPTCHA scripts

2. **Check browser extensions:**
   - Ad blockers or privacy extensions may block reCAPTCHA
   - Try in incognito mode or disable extensions

3. **Verify Firebase project:**
   - Ensure you're configuring the correct project (`stockpilotv1`)
   - Check that Phone Authentication is enabled: **Authentication** → **Sign-in method** → **Phone** → Should be "Enabled"

4. **Check Authorized Domains:**
   - Go to: **Authentication** → **Settings** → **Domains** → **Authorized domains**
   - Ensure your domains are listed:
     - `localhost`
     - `127.0.0.1`
     - `flypnow.com`
     - `www.flypnow.com`

5. **SDK Version:**
   - Ensure you're using Firebase Web SDK v11+ (your `package.json` should have `firebase` >= 11.0.0)
   - Check: `npm list firebase` in your project

6. **Network Issues:**
   - Ensure `https://www.google.com/recaptcha/api.js` is accessible (not blocked by firewall)
   - Check browser console for network errors

## Additional Notes

- **reCAPTCHA v3 is invisible** - users won't see a checkbox, it runs in the background
- **reCAPTCHA v3 uses a score** (0.0 to 1.0) - lower scores indicate bot-like behavior
- **The threshold you set** determines which scores trigger SMS blocking
- **For production**, use "Block high (0.5)" to balance security and user experience

## Quick Checklist

- [ ] reCAPTCHA site keys configured for Web platform
- [ ] SMS fraud risk threshold set to "Block high (0.5)" or similar (not "Block max (0)")
- [ ] Phone authentication enforcement mode set to "ENFORCE" or "AUDIT"
- [ ] Authorized domains include localhost, 127.0.0.1, flypnow.com, www.flypnow.com
- [ ] Phone sign-in method is enabled in Firebase Authentication
- [ ] Firebase Web SDK is v11+ in package.json
- [ ] Tested OTP flow after configuration

## Still Having Issues?

If OTP still fails after completing all steps:
1. Check browser console for detailed error messages
2. Verify your Firebase API key matches your project
3. Ensure you're not hitting SMS quota limits
4. Try with a different phone number (some numbers may be flagged)
5. Check Firebase project billing status (some features require billing enabled)

