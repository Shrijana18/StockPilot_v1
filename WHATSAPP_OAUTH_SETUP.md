# WhatsApp Business API OAuth Setup Guide

## 🎯 What's Missing for One-Click Automation

The OAuth flow is **fully implemented** in the backend, but you need to configure **environment variables** for Firebase Functions.

## ✅ What's Already Working

1. ✅ **Backend Functions**: `whatsappConnectStart` and `whatsappConnectCallback` are implemented
2. ✅ **Frontend Routes**: Success/Error pages exist (`WhatsAppConnectSuccess.jsx`, `WhatsAppConnectError.jsx`)
3. ✅ **Firebase Hosting**: Callback route is configured in `firebase.json`
4. ✅ **Error Handling**: Proper `HttpsError` handling is in place

## ❌ What's Missing

### 1. Environment Variables Not Set

Firebase Functions need these environment variables:
- `META_APP_ID` - Your Meta App ID from developers.facebook.com
- `META_APP_SECRET` - Your Meta App Secret
- `BASE_URL` - Your production URL (optional, defaults to `https://stockpilotv1.web.app`)

## 🚀 Setup Instructions

### Step 1: Get Meta App Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Create or select your app
3. Add **WhatsApp** product to your app
4. Go to **Settings → Basic**
5. Copy your **App ID** and **App Secret**

### Step 2: Configure OAuth Redirect URI

1. In Meta App Settings, go to **Facebook Login → Settings**
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://stockpilotv1.web.app/whatsapp/connect/callback
   ```
   (For local development, also add: `http://localhost:5173/whatsapp/connect/callback`)

### Step 3: Set Firebase Functions Environment Variables

#### Option A: Using Firebase CLI (Recommended for Production)

```bash
# Set environment variables
firebase functions:config:set meta.app_id="YOUR_APP_ID" meta.app_secret="YOUR_APP_SECRET" base.url="https://stockpilotv1.web.app"

# Deploy functions
firebase deploy --only functions
```

**Note**: For Firebase Functions v2, you may need to use a different approach. Check your Firebase Functions version.

#### Option B: Using .env file (For Local Development)

Create `functions/.env` file:

```env
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
BASE_URL=https://stockpilotv1.web.app
```

The `dotenv` package is already installed (see `functions/index.js` line 6).

#### Option C: Using Firebase Secret Manager (Most Secure)

```bash
# Set secrets
firebase functions:secrets:set META_APP_ID
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set BASE_URL

# Then update connect.js to use secrets:
# const META_APP_ID = process.env.META_APP_ID || functions.secret("META_APP_ID");
```

### Step 4: Update connect.js to Use Environment Variables

The code already reads from `process.env`, but for Firebase Functions v2, you might need to access them differently.

**Current code (line 35-37 in connect.js):**
```javascript
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const BASE_URL = process.env.BASE_URL || "https://stockpilotv1.web.app";
```

This should work if environment variables are set correctly.

## 🔍 Verification Steps

1. **Check Environment Variables**:
   ```bash
   # For local testing
   cd functions
   node -e "require('dotenv').config(); console.log('META_APP_ID:', process.env.META_APP_ID ? '✅ Set' : '❌ Missing')"
   ```

2. **Test Locally**:
   ```bash
   firebase emulators:start --only functions
   ```

3. **Deploy and Test**:
   ```bash
   firebase deploy --only functions:whatsappConnectStart,functions:whatsappConnectCallback
   ```

## 📋 Complete OAuth Flow

1. **User clicks "Connect WhatsApp Business API"**
   - Frontend calls `whatsappConnectStart`
   - Function generates OAuth URL with session ID
   - User redirected to Meta OAuth

2. **User authorizes on Meta**
   - Meta redirects to `/whatsapp/connect/callback?code=...&state=...`

3. **Backend processes callback**
   - `whatsappConnectCallback` exchanges code for token
   - Fetches WABA ID and Phone Number ID
   - Stores credentials in Firestore
   - Redirects to success page

4. **User sees success**
   - `WhatsAppConnectSuccess` component shows confirmation
   - User redirected back to dashboard

## 🐛 Troubleshooting

### Error: "Meta App credentials not configured"

**Solution**: Set `META_APP_ID` and `META_APP_SECRET` environment variables.

### Error: "Invalid redirect_uri"

**Solution**: Add the callback URL to Meta App's OAuth redirect URIs.

### Error: "No WhatsApp Business Account found"

**Solution**: User needs to create a WhatsApp Business Account in Meta Business Suite.

### Error: "No phone number found"

**Solution**: User needs to add a phone number to their WhatsApp Business Account.

## 🔐 Security Notes

1. **Never commit `.env` files** to git
2. **Use Secret Manager** for production (most secure)
3. **Rotate secrets** regularly
4. **Limit App Secret access** to only necessary team members

## 📝 Next Steps After Setup

1. ✅ Set environment variables
2. ✅ Deploy functions
3. ✅ Test OAuth flow
4. ✅ Verify credentials are stored in Firestore
5. ✅ Test sending a WhatsApp message

## 🎉 Success Criteria

When everything is set up correctly:
- ✅ Clicking "Connect WhatsApp Business API" redirects to Meta
- ✅ After authorization, user is redirected back
- ✅ Credentials are automatically stored in Firestore
- ✅ User sees success message
- ✅ WhatsApp features are unlocked
