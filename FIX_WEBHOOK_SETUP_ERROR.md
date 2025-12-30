# Fix: Webhook Setup Error - "Invalid OAuth access token"

## 🚨 Error Analysis

**Error:** `Invalid OAuth access token - Cannot parse access token`

**Location:** `setupWebhookForClient` function

**Cause:** The System User Token is not accessible in production Firebase Functions.

---

## 🔍 Root Cause

The function uses `getSystemUserToken()` which reads from:
- Local: `.env` file (works for local testing)
- Production: Firebase Secrets (NOT SET YET!)

**Problem:** The token is only in `.env` file, but production functions need it in Firebase Secrets.

---

## ✅ Solution: Set Firebase Secrets

### **Step 1: Set System User Token as Firebase Secret**

**Command:**
```bash
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
```

**When prompted:**
- Paste your System User Token
- Press Enter

**Or set directly:**
```bash
echo "YOUR_SYSTEM_USER_TOKEN_HERE" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
```

### **Step 2: Set App Secret (Also Needed)**

**Command:**
```bash
firebase functions:secrets:set META_APP_SECRET
```

**When prompted:**
- Paste your App Secret
- Press Enter

---

## 🔧 How to Get Your System User Token

**If you don't have it:**

1. **Go to Meta Business Suite:**
   - URL: `https://business.facebook.com/settings/system-users`

2. **Find your System User:**
   - Look for "FLYP Employee" or your system user

3. **Generate Token:**
   - Click on the system user
   - Click "Generate New Token"
   - Select your app
   - Select permissions
   - Generate token
   - **Copy the token immediately!**

---

## 📝 Complete Fix Steps

### **1. Get Your System User Token**

**From Meta Business Suite:**
- Go to: System Users → FLYP Employee
- Generate token if needed
- Copy the token

### **2. Set Firebase Secrets**

```bash
# Set System User Token
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
# Paste token when prompted

# Set App Secret
firebase functions:secrets:set META_APP_SECRET
# Paste secret when prompted
```

### **3. Redeploy Functions (Optional but Recommended)**

After setting secrets, redeploy to ensure they're loaded:

```bash
firebase deploy --only functions:setupWebhookForClient
```

**Note:** Functions automatically pick up secrets, but redeploy ensures they're available.

### **4. Test Again**

1. Go to your app
2. Click "Setup Webhook"
3. Should work now!

---

## ✅ Verification

### **Check if Secret is Set:**

```bash
firebase functions:secrets:access META_SYSTEM_USER_TOKEN
```

**Expected:** Should show your token (or prompt for it)

### **Check Function Logs:**

```bash
firebase functions:log --only setupWebhookForClient
```

**After fixing, should see:**
- No "Invalid OAuth access token" errors
- Success messages

---

## 🎯 Quick Fix Command

**Run this (replace with your actual token):**

```bash
# Set System User Token
echo "YOUR_ACTUAL_SYSTEM_USER_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN

# Set App Secret  
echo "YOUR_ACTUAL_APP_SECRET" | firebase functions:secrets:set META_APP_SECRET

# Redeploy (optional)
firebase deploy --only functions:setupWebhookForClient
```

---

## 📋 Summary

**Problem:** System User Token not in Firebase Secrets  
**Solution:** Set `META_SYSTEM_USER_TOKEN` as Firebase Secret  
**Action:** Run the commands above  
**Result:** Webhook setup will work! ✅

---

**After setting secrets, try "Setup Webhook" again! 🚀**

