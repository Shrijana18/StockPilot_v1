# 🚨 CRITICAL: Set Firebase Secrets Now!

## Problem Found

**Error:** `Invalid OAuth access token - Cannot parse access token`

**Root Cause:** System User Token is NOT set in Firebase Secrets!

**Status:** Secret doesn't exist (404 error when checking)

---

## ✅ Solution: Set Firebase Secrets

### **Step 1: Get Your System User Token**

**From your `.env` file:**
```bash
cd functions
cat .env | grep META_SYSTEM_USER_TOKEN
```

**Or from Meta Business Suite:**
1. Go to: `https://business.facebook.com/settings/system-users`
2. Click on "FLYP Employee"
3. If token exists, copy it
4. If not, generate a new one

---

### **Step 2: Set Firebase Secrets**

**Run these commands (replace with your actual values):**

```bash
# Set System User Token
echo "YOUR_SYSTEM_USER_TOKEN_FROM_ENV" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN

# Set App Secret
echo "YOUR_APP_SECRET_FROM_ENV" | firebase functions:secrets:set META_APP_SECRET
```

**Or interactively (safer):**

```bash
# Set System User Token
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
# Paste your token when prompted, then press Enter

# Set App Secret
firebase functions:secrets:set META_APP_SECRET
# Paste your secret when prompted, then press Enter
```

---

### **Step 3: Verify Secrets Are Set**

```bash
# Check System User Token (will prompt for confirmation)
firebase functions:secrets:access META_SYSTEM_USER_TOKEN

# Check App Secret (will prompt for confirmation)
firebase functions:secrets:access META_APP_SECRET
```

---

### **Step 4: Test Again**

1. Go to your app
2. Click "Setup Webhook"
3. Should work now! ✅

---

## 🔍 Quick Check: Get Values from .env

**To get your current values:**

```bash
cd functions
echo "System User Token:"
grep META_SYSTEM_USER_TOKEN .env

echo ""
echo "App Secret:"
grep META_APP_SECRET .env
```

**Then use those values in the commands above.**

---

## 📝 Important Notes

1. **Secrets are required for production:** `.env` only works locally
2. **Functions auto-reload secrets:** No need to redeploy after setting
3. **Secrets are secure:** They're encrypted and not visible in logs

---

## ✅ After Setting Secrets

**The webhook setup should work!**

The error will be fixed because:
- ✅ System User Token will be available
- ✅ Meta API calls will work
- ✅ Webhook subscription will succeed

---

## 🚀 Quick Fix (Copy-Paste Ready)

**Get your values first:**
```bash
cd functions
cat .env | grep -E "META_SYSTEM_USER_TOKEN|META_APP_SECRET"
```

**Then set secrets:**
```bash
# Replace YOUR_TOKEN and YOUR_SECRET with actual values from .env
echo "YOUR_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
echo "YOUR_SECRET" | firebase functions:secrets:set META_APP_SECRET
```

**Test:**
- Go to app → Click "Setup Webhook"
- Should work! ✅

---

**This is the missing piece! Set the secrets and it will work! 🎯**

