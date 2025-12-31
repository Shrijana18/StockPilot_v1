# Meta Setup Checklist - Fix "Business Manager Not Found" Error

## 🚨 Current Error

**Error:** "Business Manager not found. Please ensure System User has access to a Business Manager."

## ✅ Quick Fix Steps

### Step 1: Verify Business Manager Exists

1. Go to: https://business.facebook.com/settings/business-info
2. Check if you have a **Business Manager ID**
3. If not, create one:
   - Go to https://business.facebook.com/
   - Click "Create Account"
   - Fill in business details

### Step 2: Assign System User to Business Manager

1. Go to: https://business.facebook.com/settings/system-users
2. Find your **System User** (the one with the token)
3. Click **"Assign Assets"** or **"Add Assets"**
4. Select **"Business Manager"**
5. Select your Business Manager
6. Grant these permissions:
   - ✅ **Business Management**
   - ✅ **WhatsApp Business Management**
   - ✅ **WhatsApp Business Messaging**
7. Click **"Save Changes"**

### Step 3: Add App to Business Manager

1. Go to: https://business.facebook.com/settings/business-info
2. Scroll to **"Apps"** section
3. Click **"Add"** or **"Connect App"**
4. Enter your App ID: **1902565950686087** (FLYP Tech Provider)
5. Click **"Add"**

### Step 4: Verify System User Token

1. Test the token:
   ```bash
   curl "https://graph.facebook.com/v22.0/me?access_token=YOUR_SYSTEM_USER_TOKEN&fields=business"
   ```
2. Should return Business Manager ID
3. If not, System User doesn't have access

## 🔍 Alternative: Use Business Manager ID Directly

If you know your Business Manager ID, you can set it as an environment variable:

```bash
# In Firebase Functions
firebase functions:config:set meta.business_manager_id="YOUR_BM_ID"

# Or in .env (for local)
META_BUSINESS_MANAGER_ID=YOUR_BM_ID
```

The code will automatically use this if other methods fail.

## 📋 Verification Checklist

- [ ] Business Manager exists in Meta Business Suite
- [ ] Business Manager ID is known
- [ ] System User is assigned to Business Manager
- [ ] System User has required permissions
- [ ] Tech Provider App is added to Business Manager
- [ ] System User token is valid
- [ ] Test API call returns Business Manager ID

## 🎯 How Other Platforms Do It

### AiSensy / 360dialog Approach:

1. **They have a Business Manager** - Created once, used for all clients
2. **System User has access** - Assigned with full permissions
3. **All WABAs created under same Business Manager** - But each client gets their own WABA
4. **App subscription** - Tech Provider App is subscribed to all WABAs

### Our Implementation:

✅ Matches industry standard
✅ Creates WABA under Tech Provider Business Manager
✅ Subscribes Tech Provider App automatically
✅ Each user gets their own WABA
✅ Phone number registration per WABA

## 🚀 After Fix

Once Business Manager is set up:

1. User enters phone number + business name
2. System creates WABA under your Business Manager
3. Tech Provider App is subscribed automatically
4. OTP sent to user
5. User verifies OTP
6. Phone connected and ready!

## 📞 Still Having Issues?

If error persists:

1. **Check System User Permissions:**
   - Go to Business Settings → System Users
   - Verify all permissions are granted

2. **Check Business Manager Association:**
   - Business Settings → Business Info
   - Verify app is listed

3. **Test API Directly:**
   ```bash
   curl "https://graph.facebook.com/v22.0/me/businesses?access_token=YOUR_TOKEN"
   ```

4. **Check Token Validity:**
   ```bash
   curl "https://graph.facebook.com/v22.0/me?access_token=YOUR_TOKEN"
   ```

## ✅ Meta Fully Supports This!

**YES** - Meta allows Tech Providers to:
- ✅ Create WABAs for clients
- ✅ Manage multiple WABAs
- ✅ Each client gets their own WABA
- ✅ All under Tech Provider's Business Manager

This is the standard Tech Provider model used by all major platforms!

