# Complete Fix: Webhook Setup Error

## 🚨 Error Found

**Error:** `Invalid OAuth access token - Cannot parse access token`

**Root Cause:** 
1. System User Token not set in Firebase Secrets (for production)
2. `.env` file might still have placeholder values

---

## ✅ Step-by-Step Fix

### **Step 1: Verify .env File Has Real Values**

**Check your `.env` file:**
```bash
cd functions
cat .env | grep -E "META_SYSTEM_USER_TOKEN|META_APP_SECRET"
```

**If you see placeholders like:**
- `META_SYSTEM_USER_TOKEN=your_system_user_token_here`
- `META_APP_SECRET=your_app_secret_here`

**Then you need to replace them with actual values!**

**Edit `.env` file:**
```bash
cd functions
nano .env  # or use your editor
```

**Replace:**
- `your_system_user_token_here` → Your actual System User Token
- `your_app_secret_here` → Your actual App Secret

**Save and close.**

---

### **Step 2: Get Your Actual Values**

**If you don't have them:**

#### **A. Get System User Token:**

1. Go to: `https://business.facebook.com/settings/system-users`
2. Click on "FLYP Employee"
3. Click "Generate New Token" (or view existing)
4. Copy the token

#### **B. Get App Secret:**

1. Go to: `https://developers.facebook.com/apps/1902565950686087/settings/basic`
2. Click "Show" next to App Secret
3. Copy the secret

---

### **Step 3: Update .env File**

**Edit `functions/.env`:**

```env
META_APP_ID=1902565950686087
META_APP_SECRET=YOUR_ACTUAL_APP_SECRET_HERE
META_SYSTEM_USER_TOKEN=YOUR_ACTUAL_SYSTEM_USER_TOKEN_HERE
BASE_URL=http://localhost:5173
WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token
```

**Replace the placeholders with actual values!**

---

### **Step 4: Set Firebase Secrets (CRITICAL for Production!)**

**Even if `.env` works locally, production needs Firebase Secrets!**

**Set System User Token:**
```bash
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
# Paste your actual System User Token when prompted
# Press Enter
```

**Set App Secret:**
```bash
firebase functions:secrets:set META_APP_SECRET
# Paste your actual App Secret when prompted
# Press Enter
```

**Or set directly (replace with actual values):**
```bash
echo "YOUR_ACTUAL_SYSTEM_USER_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
echo "YOUR_ACTUAL_APP_SECRET" | firebase functions:secrets:set META_APP_SECRET
```

---

### **Step 5: Verify Secrets Are Set**

```bash
# This will show the secret (you'll need to confirm)
firebase functions:secrets:access META_SYSTEM_USER_TOKEN
```

**Expected:** Should show your token (or prompt for confirmation)

---

### **Step 6: Test Webhook Setup**

1. **Go to your app**
2. **Click "Setup Webhook"**
3. **Should work now!** ✅

---

## 🔍 Troubleshooting

### **Issue: Still getting "Invalid OAuth access token"**

**Check:**
1. ✅ `.env` has real values (not placeholders)
2. ✅ Firebase Secrets are set
3. ✅ Token is valid (not expired)
4. ✅ Token has correct permissions

**Verify token is valid:**
- Check in Meta Business Suite
- Regenerate if needed

---

### **Issue: Secret not found**

**Solution:**
- Make sure you ran `firebase functions:secrets:set`
- Check you're in the correct Firebase project
- Try setting again

---

## 📋 Quick Checklist

- [ ] `.env` file has actual values (not placeholders)
- [ ] System User Token is valid
- [ ] App Secret is valid
- [ ] Firebase Secret `META_SYSTEM_USER_TOKEN` is set
- [ ] Firebase Secret `META_APP_SECRET` is set
- [ ] Tested "Setup Webhook" button

---

## 🚀 Quick Fix Commands

**1. Update .env (if needed):**
```bash
cd functions
nano .env  # Replace placeholders with actual values
```

**2. Set Firebase Secrets:**
```bash
# Get values from .env first
cd functions
TOKEN=$(grep META_SYSTEM_USER_TOKEN .env | cut -d'=' -f2)
SECRET=$(grep META_APP_SECRET .env | cut -d'=' -f2)

# Set secrets
echo "$TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
echo "$SECRET" | firebase functions:secrets:set META_APP_SECRET
```

**3. Test:**
- Go to app → Click "Setup Webhook"
- Should work! ✅

---

## ✅ Summary

**Problem:** System User Token not accessible in production  
**Solution:** 
1. Update `.env` with real values
2. Set Firebase Secrets
3. Test again

**After this, webhook setup will work!** 🎯

---

**Do this now and the error will be fixed! 🚀**

