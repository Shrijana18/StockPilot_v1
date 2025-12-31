# Meta Tech Provider Setup - Complete Guide

## 🎯 How Meta Allows Tech Providers to Create WABAs

### ✅ **YES - Meta Fully Supports This!**

Meta's WhatsApp Business API **Tech Provider** model allows you to:
- ✅ Create WABAs on behalf of clients
- ✅ Manage multiple WABAs from one app
- ✅ Each user gets their own WABA
- ✅ All WABAs under your Tech Provider App

This is exactly how platforms like **AiSensy**, **360dialog**, **Twilio**, etc. work!

## 📋 Required Meta Setup

### 1. **Business Manager Setup** (CRITICAL)

**Location:** https://business.facebook.com/

**Required:**
- ✅ Create a Business Manager (if you don't have one)
- ✅ Add your Tech Provider App to Business Manager
- ✅ System User must have access to Business Manager

**Steps:**
1. Go to https://business.facebook.com/
2. Create Business Manager (if needed)
3. Go to **Settings → Business Info**
4. Note your **Business Manager ID**

### 2. **System User Setup** (CRITICAL)

**Location:** https://business.facebook.com/settings/system-users

**Required:**
- ✅ System User exists
- ✅ System User has access to Business Manager
- ✅ System User has these permissions:
  - `business_management`
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`

**Steps:**
1. Go to **Business Settings → Users → System Users**
2. Find your System User (or create one)
3. Click **Assign Assets**
4. Select your **Business Manager**
5. Grant permissions:
   - ✅ Business Management
   - ✅ WhatsApp Business Management
   - ✅ WhatsApp Business Messaging

### 3. **Tech Provider App Setup**

**Location:** https://developers.facebook.com/apps/{APP_ID}

**Your App ID:** 1902565950686087 (FLYP Tech Provider)

**Required:**
- ✅ App is in **Live** mode (or Development for testing)
- ✅ WhatsApp product is added
- ✅ App is added to Business Manager
- ✅ System User token is configured

**Steps:**
1. Go to **App Dashboard**
2. Ensure **WhatsApp** product is added
3. Go to **Business Settings → Apps**
4. Add your app to Business Manager
5. Verify System User can access it

## 🔧 How Other Platforms Do It

### AiSensy / 360dialog / Twilio Approach:

1. **User Registration:**
   - User provides phone number + business name
   - Platform creates WABA via Tech Provider API
   - WABA is created under Platform's Business Manager

2. **WABA Creation:**
   ```
   POST /{business_manager_id}/owned_whatsapp_business_accounts
   {
     "name": "User's Business Name",
     "timezone_id": "Asia/Kolkata"
   }
   ```

3. **Phone Registration:**
   ```
   POST /{waba_id}/request_code
   {
     "phone_number": "+91XXXXXXXXXX",
     "code_method": "SMS"
   }
   ```

4. **OTP Verification:**
   ```
   POST /{waba_id}/register_code
   {
     "code": "123456",
     "phone_number": "+91XXXXXXXXXX"
   }
   ```

5. **App Subscription:**
   ```
   POST /{waba_id}/subscribed_apps
   {
     "app_id": "1902565950686087",
     "subscribed_fields": ["messages", "message_status"]
   }
   ```

## ✅ What We've Implemented

### Our Flow (Matches Industry Standard):

1. ✅ User enters phone number + business name
2. ✅ System creates WABA under Tech Provider Business Manager
3. ✅ Tech Provider App is subscribed automatically
4. ✅ Phone number registration requested
5. ✅ OTP sent to user
6. ✅ User verifies OTP
7. ✅ Phone connected and ready

## 🚨 Current Error: "Business Manager not found"

### Why This Happens:

The System User doesn't have access to a Business Manager, or the endpoint is incorrect.

### Fix Options:

#### Option 1: Fix System User Access (Recommended)

1. Go to: https://business.facebook.com/settings/system-users
2. Find your System User
3. Click **Assign Assets**
4. Select **Business Manager**
5. Grant all permissions
6. Save

#### Option 2: Use Specific Business Manager ID

If you know your Business Manager ID, we can hardcode it:

```javascript
// In createIndividualWABA function
const businessManagerId = getEnvVar("META_BUSINESS_MANAGER_ID") || "YOUR_BM_ID";
```

#### Option 3: Create Business Manager Programmatically

We can create a Business Manager if one doesn't exist (requires additional permissions).

## 🔍 Verification Steps

### Check System User Access:

1. **Get System User Info:**
   ```bash
   curl "https://graph.facebook.com/v22.0/me?access_token=SYSTEM_USER_TOKEN&fields=business"
   ```

2. **List Businesses:**
   ```bash
   curl "https://graph.facebook.com/v22.0/me/businesses?access_token=SYSTEM_USER_TOKEN"
   ```

3. **Check Permissions:**
   - Go to Business Settings → System Users
   - Verify permissions are granted

### Check Business Manager:

1. Go to: https://business.facebook.com/settings/business-info
2. Note your **Business Manager ID**
3. Verify it's associated with your app

## 📝 Additional Setup Needed

### If Business Manager Doesn't Exist:

1. **Create Business Manager:**
   - Go to https://business.facebook.com/
   - Click "Create Account"
   - Fill in business details
   - Complete verification

2. **Add App to Business Manager:**
   - Business Settings → Apps
   - Add your Tech Provider App

3. **Assign System User:**
   - Business Settings → System Users
   - Assign to Business Manager
   - Grant permissions

### If System User Doesn't Have Access:

1. **Assign Assets:**
   - Business Settings → System Users
   - Select System User
   - Click "Assign Assets"
   - Select Business Manager
   - Grant permissions

## 🎯 Meta Requirements Summary

### ✅ What Meta Allows:

- ✅ Tech Provider can create WABAs for clients
- ✅ Each client gets their own WABA
- ✅ All WABAs under Tech Provider's Business Manager
- ✅ Tech Provider App manages all WABAs
- ✅ Phone numbers registered per WABA
- ✅ OTP verification per phone number

### ❌ What Meta Doesn't Allow:

- ❌ Sharing one WABA across multiple clients (without proper setup)
- ❌ Creating WABAs without Business Manager
- ❌ System User without proper permissions

## 🚀 Next Steps

1. **Verify Business Manager Setup:**
   - Check if Business Manager exists
   - Verify System User has access
   - Check permissions

2. **Fix System User Access:**
   - Assign Business Manager to System User
   - Grant required permissions

3. **Test WABA Creation:**
   - Try creating a test WABA
   - Verify it appears in Business Manager
   - Check app subscription

4. **Deploy Updated Code:**
   - Code now tries multiple methods to find Business Manager
   - Better error messages
   - Automatic app subscription

## 📞 Support

If you still get "Business Manager not found":
1. Check System User permissions in Meta Business Suite
2. Verify Business Manager exists
3. Ensure app is added to Business Manager
4. Check System User token is valid

