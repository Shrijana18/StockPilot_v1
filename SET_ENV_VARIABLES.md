# 🔧 Set Environment Variables for WhatsApp OAuth

## ❌ The Problem

The error "functions.config() is no longer available" happened because I tried to use old Firebase v1 config. **I've fixed that** - now it only uses `process.env`.

But you still need to **set the environment variables**.

## ✅ What You Need

From your Meta App, you need:
1. **App ID** - Found in Meta App → Settings → Basic
2. **App Secret** - Found in Meta App → Settings → Basic (click "Show" to reveal)

**Note**: The WhatsApp Business Account ID and Phone Number ID you showed are different - those are fetched automatically during OAuth. You need the **App ID** and **App Secret** from your Meta App settings.

## 🚀 Quick Setup

### Option 1: Local Development (.env file)

```bash
cd functions
nano .env
```

Add these lines:
```env
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
BASE_URL=https://stockpilotv1.web.app
```

Then test locally:
```bash
firebase emulators:start --only functions
```

### Option 2: Production (Firebase Console)

1. Go to: https://console.firebase.google.com/project/stockpilotv1/functions/config
2. Click **"Add Variable"** for each:
   - `META_APP_ID` = your Meta App ID
   - `META_APP_SECRET` = your Meta App Secret  
   - `BASE_URL` = https://stockpilotv1.web.app

3. Deploy:
```bash
firebase deploy --only functions:whatsappConnectStart,functions:whatsappConnectCallback
```

### Option 3: Using Firebase CLI (Alternative)

```bash
# Set environment variables
firebase functions:config:set \
  meta.app_id="YOUR_APP_ID" \
  meta.app_secret="YOUR_APP_SECRET" \
  base.url="https://stockpilotv1.web.app"

# Deploy
firebase deploy --only functions
```

**Note**: For Firebase Functions v2, you might need to use the Console method instead.

## 🔍 How to Find Your Meta App ID and Secret

1. Go to: https://developers.facebook.com/apps
2. Select your app
3. Go to **Settings → Basic**
4. You'll see:
   - **App ID**: A long number (e.g., `123456789012345`)
   - **App Secret**: Click "Show" to reveal it

## ✅ Verify It's Working

After setting environment variables:

1. **Check locally**:
   ```bash
   cd functions
   node -e "require('dotenv').config(); console.log('META_APP_ID:', process.env.META_APP_ID ? '✅ Set' : '❌ Missing')"
   ```

2. **Test the function**:
   - Click "Connect WhatsApp Business API" button
   - Should redirect to Meta OAuth (not show error)

## 🐛 Still Getting Errors?

1. **"Meta App credentials not configured"**
   - ✅ Environment variables not set → Set them using one of the methods above

2. **"functions.config() is no longer available"**
   - ✅ Fixed! Removed the old config fallback

3. **CSP violations for graph.facebook.com**
   - This is a separate frontend issue - need to add `graph.facebook.com` to CSP headers

## 📝 Next Steps

1. ✅ Set `META_APP_ID` and `META_APP_SECRET` environment variables
2. ✅ Deploy functions
3. ✅ Test OAuth flow
4. ✅ Fix CSP if needed (separate issue)

