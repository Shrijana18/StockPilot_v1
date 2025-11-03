# 🚨 CRITICAL FIXES NEEDED - Do These Now

Based on your Firebase Console screenshot, your reCAPTCHA key "FLYP OTP" is already configured, but **two critical settings are blocking OTP**:

## ⚠️ Issue #1: SMS Fraud Risk Threshold is TOO STRICT

**Current Setting:** `Block max (0)`  
**Problem:** This blocks **ALL** OTP requests, even legitimate ones!

**Fix (Firebase Console):**
1. Go to: **Authentication → Settings → reCAPTCHA**
2. Find **"SMS fraud risk threshold score"**
3. Click the **✏️ edit icon** next to "Block max (0)"
4. Select: **"Block high (0.5)"** ✅ (Recommended)
5. Click **Save**

---

## ⚠️ Issue #2: Phone Authentication Enforcement Mode is UNSPECIFIED

**Current Setting:** `RECAPTCHA_PROVIDER_ENFORCEMENT_STATE_UNSPECIFIED`  
**Problem:** Firebase doesn't know how to handle reCAPTCHA verification.

**Fix (Firebase Console):**
1. In the same **reCAPTCHA** settings page
2. Find **"Phone authentication enforcement mode"**
3. Click the **✏️ edit icon** next to "UNSPECIFIED"
4. Select: **"ENFORCE"** ✅ (Recommended for production)
   - OR **"AUDIT"** (if you want to test first - it logs but doesn't block)
5. Click **Save**

---

## ✅ Verify Domain List (Google Cloud Console)

Your key "FLYP OTP" might need domain verification:

1. **Click "Manage reCAPTCHA"** button in Firebase Console (takes you to Google Cloud)
2. **Find your "FLYP OTP" key**
3. **Click "Edit key"**
4. **Verify "Domain list" includes:**
   - ✅ `localhost`
   - ✅ `127.0.0.1`
   - ✅ `flypnow.com`
   - ✅ `www.flypnow.com`
5. **Add any missing domains** and **Save**

---

## 🧪 Test After Fixes

1. Wait 1-2 minutes for Firebase settings to propagate
2. Clear browser cache or use incognito mode
3. Go to your registration page
4. Enter phone number: `7218513559` (or any valid 10-digit number)
5. Click **"Send OTP"**
6. Should work now! 🎉

---

## 📋 Quick Checklist

- [ ] Changed SMS fraud risk threshold from "Block max (0)" to "Block high (0.5)"
- [ ] Changed phone authentication enforcement mode from "UNSPECIFIED" to "ENFORCE" or "AUDIT"
- [ ] Verified domain list in Google Cloud Console has all required domains
- [ ] Tested OTP flow successfully

---

## ❓ Still Not Working?

If OTP still fails after these fixes:

1. **Check browser console** for detailed error messages
2. **Try incognito mode** (rules out browser extensions)
3. **Verify Phone Authentication is enabled:**
   - Firebase Console → Authentication → Sign-in method
   - "Phone" should be **Enabled** ✅
4. **Check SDK version:**
   - Run: `npm list firebase`
   - Should be version **11+** (your code expects this)
5. **Test with a different phone number** (some numbers may be flagged)

---

## 📝 Notes

- Your reCAPTCHA key "FLYP OTP" is correctly linked ✅
- Site Key: `6LfDEP4rAAAAAD11HEs9K5kEivA90sdZUDj3md5B`
- The main blocker is the "Block max (0)" setting - it's blocking everything!
- After changing to "Block high (0.5)", legitimate requests should pass through

