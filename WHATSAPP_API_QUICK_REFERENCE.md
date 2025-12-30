# 📱 WhatsApp API Setup - Quick Reference

## 🎯 Where to Find Your Credentials

### Step 1: Go to Meta Business Suite
👉 **https://business.facebook.com**

### Step 2: Navigate to WhatsApp
- Click **"WhatsApp"** in left sidebar
- OR: **"All Tools"** → **"WhatsApp"**

### Step 3: Open API Setup
- Click **"API Setup"** tab
- You'll see all your credentials here

---

## 📋 What to Copy (3 Things)

### 1️⃣ Phone Number ID
- **Location:** API Setup page → "Phone number ID"
- **Format:** Long number like `123456789012345`
- **Where to paste:** First field in FLYP

### 2️⃣ Business Account ID  
- **Location:** API Setup page → "Business account ID"
- **Format:** Long number like `123456789012345`
- **Where to paste:** Second field in FLYP

### 3️⃣ Access Token
- **Location:** API Setup page → Click "Copy" button next to "Access token"
- **Format:** Long string starting with `EAA...`
- **Where to paste:** Third field in FLYP (password field)
- **⚠️ Important:** Temporary tokens expire in 24 hours!

---

## ✅ After Pasting

1. Click **"Test Connection"** button
2. Wait for verification
3. If successful → ✅ Green checkmark appears
4. Turn ON **"Enable WhatsApp Notifications"** toggle
5. Click **"Save Changes"**

---

## 🔧 Need Permanent Token?

Temporary tokens expire in 24 hours. For permanent access:

1. Go to **Meta Business Settings** → **Users** → **System Users**
2. Click **"Add"** → **"Create new system user"**
3. Name it: "FLYP Integration"
4. Click **"Assign assets"** → Select WhatsApp Business Account
5. Grant permission: **"WhatsApp Business Management API"**
6. Click **"Generate new token"** → Copy it

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't find WhatsApp | Make sure you have a Business Account (not personal) |
| No API Setup tab | Complete business verification first |
| Token expired | Generate new token or create System User |
| Test fails | Check all 3 credentials are correct, no extra spaces |

---

## 📞 Quick Links

- **Meta Business Suite:** https://business.facebook.com
- **Full Guide:** See `WHATSAPP_API_SETUP_GUIDE.md`
- **Meta Help:** https://www.facebook.com/business/help

---

## ✨ Once Setup Complete

Your WhatsApp will automatically send:
- ✅ Order status updates
- ✅ Stock refill reminders  
- ✅ Promotional broadcasts
- ✅ All without manual clicks!

