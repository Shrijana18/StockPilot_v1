# 📱 WhatsApp Business API Setup Guide - Step by Step

## 🎯 Overview
This guide will help you get your Meta WhatsApp Business API credentials to enable automatic messaging in FLYP.

---

## 📋 Prerequisites
- A Facebook Business Account (free to create)
- A WhatsApp Business Account (can be your personal WhatsApp)
- Access to Meta Business Suite

---

## 🚀 Step-by-Step Instructions

### Step 1: Go to Meta Business Suite
1. Open your browser and go to: **https://business.facebook.com**
2. Log in with your Facebook account
3. If you don't have a Business Account, click **"Create Account"** and follow the prompts

### Step 2: Access WhatsApp Manager
1. In the left sidebar, look for **"WhatsApp"** or **"WhatsApp Manager"**
2. Click on it
3. If you don't see it, click **"All Tools"** → **"WhatsApp"**

### Step 3: Set Up WhatsApp Business API
1. In WhatsApp Manager, look for **"API Setup"** or **"Getting Started"** tab
2. Click on **"API Setup"**
3. You'll see a screen with setup instructions

### Step 4: Get Your Phone Number ID
1. On the **API Setup page** (WhatsApp Manager → API Setup tab)
2. Look for **"Phone number ID"** or **"From" number**
3. It's a long number (15-17 digits) like: `123456789012345`
4. **Copy this number** - you'll need it later

**Where to find it:**
- On the API Setup page, look for a section showing your phone number details
- The Phone Number ID is usually displayed right next to or below your phone number
- Often in a code block or highlighted box
- **Note:** This is NOT your actual phone number - it's Meta's ID for your WhatsApp number
- ⚠️ If you don't see it, you may need to add and verify a phone number first

### Step 5: Get Your Business Account ID (WABA ID)
1. **This is in a DIFFERENT place!** Go to **Meta Business Settings**
2. In Meta Business Suite, click **"Settings"** (gear icon ⚙️) in the left sidebar
3. Navigate to **"Accounts"** → **"WhatsApp Accounts"**
4. Your **WhatsApp Business Account ID** (also called WABA ID) will be displayed here
5. It's a long number (15-17 digits) like: `987654321098765`
6. **Copy this number** - you'll need it later

**Where to find it:**
- **Path:** Meta Business Suite → Settings (⚙️) → Accounts → WhatsApp Accounts
- Your account will show the Business Account ID (WABA ID)
- It's displayed prominently in the account details
- **Note:** This is different from the Phone Number ID - don't confuse them!

### Step 6: Get Your Access Token
1. Go back to **API Setup page** (WhatsApp Manager → API Setup tab)
2. Look for **"Access token"** or **"Temporary access token"** section
3. Click the **"Copy"** button next to the token
4. **⚠️ IMPORTANT:** This is a TEMPORARY token that expires in 24 hours
5. For permanent tokens, you need to create a System User (see Advanced section below)

**Where to find it:**
- On the API Setup page, look for "Access token" section
- Usually in a box with a "Copy" button next to it
- The token is a long string (200+ characters) starting with `EAA...`
- Example: `EAAxxxxxxxxxxxxxxxxxxxxx...`
- **Keep this secret!** Don't share it publicly

### Step 7: Paste Credentials in FLYP
1. Go back to FLYP Distributor Dashboard
2. Navigate to: **Profile Settings** → **WhatsApp Business**
3. Select **"Meta API - Full Automation"**
4. Paste each credential in the corresponding field:
   - **Phone Number ID** → Paste in "Phone Number ID" field
   - **Business Account ID** → Paste in "Business Account ID" field
   - **Access Token** → Paste in "Access Token" field
5. Click **"Test Connection"** button
6. If successful, you'll see a green checkmark ✅

---

## 🔧 Advanced: Getting Permanent Access Token

Temporary tokens expire in 24 hours. For production use, you need a permanent token:

### Option A: Using System User (Recommended)
1. Go to **Meta Business Settings** → **Users** → **System Users**
2. Click **"Add"** → **"Create new system user"**
3. Name it (e.g., "FLYP Integration")
4. Click **"Create system user"**
5. Click **"Assign assets"** → Select your WhatsApp Business Account
6. Grant permissions: **"WhatsApp Business Management API"**
7. Click **"Generate new token"**
8. Select your app and permissions
9. Copy the token (this one doesn't expire easily)

### Option B: Using App Access Token
1. Go to **Meta for Developers** (developers.facebook.com)
2. Select your app
3. Go to **Settings** → **Basic**
4. Copy **"App ID"** and **"App Secret"**
5. Generate token using Graph API Explorer

---

## ❓ Troubleshooting

### "I can't find WhatsApp in Business Suite"
- Make sure you have a Business Account (not just a personal Facebook account)
- Try: **business.facebook.com** → **All Tools** → **WhatsApp**

### "I don't see API Setup"
- You might need to verify your business first
- Complete the business verification process
- Make sure your WhatsApp Business Account is connected

### "Access Token expired"
- Temporary tokens expire in 24 hours
- Generate a new token or set up a System User for permanent access

### "Test Connection fails"
- Double-check all three credentials are correct
- Make sure there are no extra spaces when pasting
- Verify your WhatsApp Business Account is active
- Check that your phone number is verified in WhatsApp Business

### "I don't have a WhatsApp Business Account"
- You can convert your personal WhatsApp to Business (free)
- Download **WhatsApp Business** app on your phone
- Follow the setup process
- Connect it to your Meta Business Account

---

## 📞 Need More Help?

1. **Meta Business Help Center**: https://www.facebook.com/business/help
2. **WhatsApp Business API Docs**: https://developers.facebook.com/docs/whatsapp
3. **FLYP Support**: Contact your FLYP administrator

---

## ✅ Quick Checklist

Before you start:
- [ ] Facebook Business Account created
- [ ] WhatsApp Business Account set up
- [ ] Access to Meta Business Suite

What you'll need to copy:
- [ ] Phone Number ID (long number)
- [ ] Business Account ID (long number)
- [ ] Access Token (long string starting with EAA...)

After setup:
- [ ] All three credentials pasted in FLYP
- [ ] "Test Connection" shows success ✅
- [ ] WhatsApp enabled toggle is ON

---

## 🎉 You're Done!

Once your credentials are saved and tested, WhatsApp notifications will work automatically:
- ✅ Order status updates
- ✅ Stock refill reminders
- ✅ Promotional broadcasts
- ✅ All sent automatically - no manual clicks needed!

