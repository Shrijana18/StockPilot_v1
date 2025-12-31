# Meta Embedded Signup Configuration Guide

## ✅ Which Login Configuration to Use

### **Answer: Use "WhatsApp embedded sign-up configuration with 60-day expiry token"**

**Config ID: `777298265371694`** (This is what you're currently using ✅)

**Why:**
- This configuration is **specifically designed** for WhatsApp Embedded Signup
- It includes the proper permissions (`whatsapp_business_management`)
- It's configured with the correct token duration (60 days)
- It's optimized for the Embedded Signup flow

**NOT the "FLYP Config" (`1393396902449966`):**
- This appears to be a general Facebook Login configuration
- It's not specifically configured for WhatsApp Embedded Signup
- It may not have the required WhatsApp permissions

---

## 🎯 Features and Feature Type

### **Feature Type:**
**Use `"whatsapp_business_app_onboarding"`** ✅ (You're already using this)

This is the correct feature type for Embedded Signup. It tells Meta that you're using the flow specifically for WhatsApp Business Account onboarding.

### **Optional Features:**

You have these optional features available in the Meta dashboard:
- `marketing_messages_lite` - For sending marketing messages (optional)
- `app_only_install` - For app-only installation (optional)

**Recommendation:**
- **Leave both unchecked** unless you specifically need them
- For basic WhatsApp messaging, you don't need these features
- You can always enable them later if needed

### **Session Info Version:**
Use version **`3`** ✅ (You're already using this)

### **ES Version:**
Use version **`v3`** ✅ (You're already using this)

---

## 🌐 Localhost Testing Support

### **Yes, you CAN test on localhost, but with requirements:**

#### **1. Add Localhost to Facebook Login Settings:**

Go to your Meta App Dashboard:
1. Navigate to **Facebook Login for Business > Settings**
2. Scroll to **Valid OAuth Redirect URIs**
3. Add these URIs:
   ```
   http://localhost:5173
   http://localhost:3000
   http://localhost:8080
   https://localhost:5173
   https://localhost:3000
   ```
   (Add whatever ports you use for local development)

4. Scroll to **Allowed Domains for the JavaScript SDK**
5. Add:
   ```
   localhost
   ```

6. Click **Save Changes**

#### **2. HTTPS Requirement:**

**⚠️ Important:** Meta requires HTTPS for the Facebook SDK. However:

**For Development Mode:**
- Meta's Embedded Signup **may work** with `http://localhost` in Development mode
- But it's **recommended** to use HTTPS even for localhost

**Solutions for HTTPS on Localhost:**

**Option A: Use ngrok (Recommended)**
```bash
# Install ngrok
npm install -g ngrok

# Start your local dev server (e.g., on port 5173)
npm run dev

# In another terminal, expose it via HTTPS
ngrok http 5173

# Use the https URL from ngrok (e.g., https://abc123.ngrok.io)
# Add this URL to Facebook Login settings instead of localhost
```

**Option B: Use Vite's built-in HTTPS**
```javascript
// vite.config.js
export default {
  server: {
    https: true,
    port: 5173
  }
}
```

Then access via: `https://localhost:5173`

#### **3. App Mode:**

- Your app is in **Development mode** ✅ (as shown in your dashboard)
- This is correct for testing
- You can test Embedded Signup in Development mode
- Switch to **Live mode** only when ready for production

---

## 📋 Complete Configuration Checklist

### ✅ What You Have Correctly Configured:

1. **Config ID:** `777298265371694` (WhatsApp Embedded Signup config) ✅
2. **Feature Type:** `whatsapp_business_app_onboarding` ✅
3. **Session Info Version:** `3` ✅
4. **ES Version:** `v3` ✅
5. **App ID:** `1902565950686087` ✅

### ⚠️ What You Need to Do:

1. **Add localhost to OAuth settings** (if testing locally):
   - Go to Facebook Login > Settings
   - Add localhost URIs to Valid OAuth Redirect URIs
   - Add localhost to Allowed Domains

2. **Optional: Set up HTTPS for localhost** (recommended):
   - Use ngrok or Vite HTTPS
   - Add the HTTPS URL to OAuth settings

3. **Verify Optional Features:**
   - Leave features unchecked unless needed
   - Current setup without features is fine

---

## 🔗 Your Current Embedded Signup URL

Your current URL is correctly configured:

```
https://business.facebook.com/messaging/whatsapp/onboard/
  ?app_id=1902565950686087
  &config_id=777298265371694
  &extras=%7B%22featureType%22%3A%22whatsapp_business_app_onboarding%22%2C%22sessionInfoVersion%22%3A%223%22%2C%22version%22%3A%22v3%22%7D
```

Decoded extras parameter:
```json
{
  "featureType": "whatsapp_business_app_onboarding",
  "sessionInfoVersion": "3",
  "version": "v3"
}
```

**This is correct!** ✅

---

## 🚀 Testing Recommendations

### **For Local Development:**

1. **Quick Test (HTTP):**
   - Add `http://localhost:PORT` to OAuth settings
   - Try the Embedded Signup flow
   - May work in Development mode, but not guaranteed

2. **Recommended Test (HTTPS):**
   - Use ngrok to create HTTPS tunnel
   - Add ngrok URL to OAuth settings
   - Test the complete flow
   - This is the most reliable method

### **For Production:**

1. Add your production domain to OAuth settings
2. Switch app to Live mode
3. Test Embedded Signup flow
4. Everything should work seamlessly

---

## 📝 Summary

**Login Configuration:** ✅ Use `777298265371694` (WhatsApp embedded sign-up config)

**Features:** ✅ Leave optional features unchecked (current setup is fine)

**Feature Type:** ✅ Use `whatsapp_business_app_onboarding` (already correct)

**Localhost Support:** ✅ Yes, but:
- Add localhost to OAuth settings
- Use HTTPS (via ngrok) for best results
- Can test in Development mode

**Production:** ✅ Test after deployment, but localhost testing is recommended first

