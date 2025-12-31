# Meta Facebook Login Settings - Complete Checklist

## 🔍 Current Status Analysis

Based on your Meta Developer Dashboard screenshots, here's what needs to be updated:

---

## ✅ Settings That Are CORRECT (No Changes Needed)

1. **Client OAuth login:** ✅ Yes (Correct)
2. **Web OAuth login:** ✅ Yes (Correct)
3. **Enforce HTTPS:** ✅ Yes (Correct - Strongly recommended)
4. **Embedded browser OAuth login:** ✅ Yes (Correct - Needed for popup)
5. **Use Strict Mode for redirect URIs:** ✅ Yes (Correct - Strongly recommended)
6. **Login with the JavaScript SDK:** ✅ Yes (Correct - Required)
7. **Force Web OAuth reauthentication:** ✅ No (Correct - Not needed)
8. **Login from devices:** ✅ No (Correct - Not needed for web)
9. **App Mode:** ✅ Development (Correct for testing)

---

## ⚠️ Settings That NEED TO BE UPDATED

### 1. **Allowed Domains for the JavaScript SDK** ⚠️ NEEDS UPDATE

**Current Status:**
- Only has: `https://flypnow.com/`

**What to Add:**
Add `localhost` to the list. The field should contain:
```
https://flypnow.com/
localhost
```

**How to Update:**
1. Go to **Facebook Login for Business > Settings**
2. Find **"Allowed Domains for the JavaScript SDK"**
3. Click the 'x' next to `https://flypnow.com/` to remove it temporarily (or keep it)
4. Type `localhost` and press Enter or click Add
5. Make sure both domains are listed:
   - `https://flypnow.com/`
   - `localhost`

**Why:** This allows the JavaScript SDK to work on localhost during development.

---

### 2. **Valid OAuth Redirect URIs** ⚠️ NEEDS UPDATE

**Current Status:**
- Appears to be **EMPTY** in your settings

**What to Add:**
Add these URIs (one per line):
```
https://flypnow.com/
https://flypnow.com
http://localhost:5173
https://localhost:5173
```

**How to Update:**
1. Go to **Facebook Login for Business > Settings**
2. Scroll to **"Valid OAuth Redirect URIs"**
3. Click in the text area
4. Add each URI on a new line:
   ```
   https://flypnow.com/
   https://flypnow.com
   http://localhost:5173
   https://localhost:5173
   ```
5. Click **Save Changes** (usually at the bottom of the page)

**Why:** 
- Production domain (`flypnow.com`) for live app
- Localhost URIs for local development testing
- Port 5173 is your Vite dev server port

**Note:** Since "Use Strict Mode for redirect URIs" is enabled, these must match EXACTLY.

---

## 📋 Complete Settings Summary

### OAuth Settings (All Correct ✅):
- ✅ Client OAuth login: **Yes**
- ✅ Web OAuth login: **Yes**
- ✅ Enforce HTTPS: **Yes**
- ✅ Embedded browser OAuth login: **Yes**
- ✅ Use Strict Mode for redirect URIs: **Yes**
- ✅ Login with the JavaScript SDK: **Yes**

### Domain/URI Settings (Need Updates ⚠️):

**Allowed Domains for the JavaScript SDK:**
```
Current: https://flypnow.com/
Needs:   https://flypnow.com/
         localhost
```

**Valid OAuth Redirect URIs:**
```
Current: (empty)
Needs:   https://flypnow.com/
         https://flypnow.com
         http://localhost:5173
         https://localhost:5173
```

---

## 🚀 Step-by-Step Update Instructions

### Step 1: Update Allowed Domains
1. Navigate to: **Facebook Login for Business > Settings**
2. Find: **"Allowed Domains for the JavaScript SDK"**
3. Add `localhost` (keep `https://flypnow.com/` as well)
4. Should show:
   - `https://flypnow.com/`
   - `localhost`

### Step 2: Update Valid OAuth Redirect URIs
1. In the same settings page, find: **"Valid OAuth Redirect URIs"**
2. Click in the text area
3. Add these URIs (one per line):
   ```
   https://flypnow.com/
   https://flypnow.com
   http://localhost:5173
   https://localhost:5173
   ```
4. Click **Save Changes**

### Step 3: Verify Settings
After saving, verify:
- ✅ Both domains are in "Allowed Domains"
- ✅ All 4 URIs are in "Valid OAuth Redirect URIs"
- ✅ "Use Strict Mode" is still enabled
- ✅ "Enforce HTTPS" is still enabled

---

## 🧪 Testing After Updates

### Test on Localhost:
1. Start your dev server: `npm run dev` (runs on port 5173)
2. Open: `http://localhost:5173`
3. Try the Embedded Signup flow
4. Should work now! ✅

### Test on Production:
1. Deploy to `https://flypnow.com`
2. Try the Embedded Signup flow
3. Should work! ✅

---

## ⚠️ Important Notes

### About HTTPS on Localhost:
- Meta **prefers HTTPS** but may allow HTTP localhost in Development mode
- If you get HTTPS errors on localhost, use one of these:
  
  **Option A: Use ngrok (Recommended)**
  ```bash
  ngrok http 5173
  # Use the https URL from ngrok
  # Add that URL to "Valid OAuth Redirect URIs"
  ```

  **Option B: Configure Vite HTTPS**
  ```javascript
  // vite.config.js
  export default {
    server: {
      https: true,
      port: 5173
    }
  }
  ```
  Then use `https://localhost:5173`

### About Strict Mode:
- "Use Strict Mode for redirect URIs" is **enabled** ✅
- This means URIs must match **EXACTLY**
- Make sure there are no trailing slashes differences
- `https://flypnow.com/` and `https://flypnow.com` are different!

---

## ✅ Final Checklist

Before testing, verify:

- [ ] `localhost` added to "Allowed Domains for the JavaScript SDK"
- [ ] `https://flypnow.com/` still in "Allowed Domains"
- [ ] `https://flypnow.com/` added to "Valid OAuth Redirect URIs"
- [ ] `https://flypnow.com` added to "Valid OAuth Redirect URIs" (no trailing slash)
- [ ] `http://localhost:5173` added to "Valid OAuth Redirect URIs"
- [ ] `https://localhost:5173` added to "Valid OAuth Redirect URIs"
- [ ] Clicked "Save Changes"
- [ ] Verified all settings saved correctly

---

## 🎯 Summary

**What's Good:** ✅
- All OAuth toggles are correctly set
- Strict mode is enabled (good for security)
- HTTPS enforcement is enabled

**What Needs Fixing:** ⚠️
1. Add `localhost` to "Allowed Domains for the JavaScript SDK"
2. Add production and localhost URIs to "Valid OAuth Redirect URIs"

**After Updates:** ✅
- You can test Embedded Signup on localhost
- Production will continue to work
- Everything will be properly configured

