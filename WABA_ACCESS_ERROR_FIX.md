# 🔍 WABA Access Error - Fix Guide

## ❌ Error Message

```
Object with ID '849529957927153' does not exist, cannot be loaded due to missing permissions, or does not support this operation.
```

## 🎯 Root Cause

**The WABA ID `849529957927153` was created via OAuth (legacy method), not via Tech Provider.**

**Why this matters:**
- WABAs created via OAuth belong to the user's Meta account
- System User (Tech Provider) doesn't have access to them
- Tech Provider can only manage WABAs it creates itself

---

## ✅ Solution: Two Options

### **Option 1: Create New WABA via Tech Provider (Recommended)**

**This is the correct way for Tech Provider setup:**

1. **Go to your app:** Profile Settings → WhatsApp
2. **Step 1:** Click "Create WABA" (via Tech Provider)
3. **Step 2:** Request Phone Number
4. **Step 3:** Setup Webhook

**This will:**
- ✅ Create WABA that System User can access
- ✅ Allow webhook setup to work
- ✅ Enable full Tech Provider functionality

---

### **Option 2: Grant System User Access (If you need to keep existing WABA)**

**If you must use the existing WABA:**

1. **Go to Meta Business Suite:**
   - `https://business.facebook.com/settings/system-users`
   
2. **Find your System User:** "FLYP Employee"

3. **Assign WABA to System User:**
   - Go to: Business Settings → WhatsApp Accounts
   - Find WABA: `849529957927153`
   - Click "Assign Assets"
   - Select your System User
   - Grant permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`

4. **Try webhook setup again**

**Note:** This is more complex and may not work for all operations.

---

## 🧪 Quick Test

**To verify which WABAs the System User can access:**

1. **Check Firebase logs:**
   ```bash
   firebase functions:log --only getClientWABA
   ```

2. **Or call the function:**
   - Use "Get WABA" button in your app
   - It will show accessible WABAs

---

## 📝 What Happened

**Your WABA was created via:**
- ❌ OAuth (legacy method) - User's own Meta app
- ✅ Should be: Tech Provider - System User creates it

**Result:**
- System User can't access OAuth-created WABAs
- Webhook setup fails with "missing permissions"

---

## ✅ Recommended Action

**Create a new WABA via Tech Provider:**

1. **Clear old WABA ID** (optional, in Firestore):
   ```javascript
   // In Firestore: businesses/{uid}
   // Remove or clear: whatsappBusinessAccountId
   ```

2. **Create new WABA:**
   - Use "Create WABA" button (Step 1)
   - This creates WABA via Tech Provider
   - System User will have full access

3. **Complete setup:**
   - Request phone number (Step 2)
   - Setup webhook (Step 3) ✅

---

## 🎯 Summary

**Problem:** WABA created via OAuth, System User can't access it  
**Solution:** Create new WABA via Tech Provider  
**Action:** Use "Create WABA" button in your app

---

**Try creating a new WABA via Tech Provider, then setup webhook! 🚀**

