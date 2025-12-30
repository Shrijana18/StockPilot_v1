# Quick Setup: WhatsApp OAuth Environment Variables

## 🚨 The Problem

The error "Meta App credentials not configured" means Firebase Functions can't find `META_APP_ID` and `META_APP_SECRET`.

## ✅ Quick Fix (3 Steps)

### Step 1: Get Your Meta App Credentials

1. Go to https://developers.facebook.com/apps
2. Select your app (or create one)
3. Go to **Settings → Basic**
4. Copy **App ID** and **App Secret**

### Step 2: Set Environment Variables

#### For Local Development:

```bash
cd functions
./setup-whatsapp-env.sh
```

Or manually create `functions/.env`:
```env
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
BASE_URL=https://stockpilotv1.web.app
```

#### For Production (Firebase Functions v2):

**Option A: Firebase Console (Easiest)**
1. Go to https://console.firebase.google.com
2. Select your project: `stockpilotv1`
3. Go to **Functions** → **Configuration**
4. Click **Add Variable**
5. Add:
   - `META_APP_ID` = your_app_id
   - `META_APP_SECRET` = your_app_secret
   - `BASE_URL` = https://stockpilotv1.web.app

**Option B: Firebase CLI**
```bash
# Set environment variables
firebase functions:config:set \
  meta.app_id="YOUR_APP_ID" \
  meta.app_secret="YOUR_APP_SECRET" \
  base.url="https://stockpilotv1.web.app"

# Deploy
firebase deploy --only functions
```

**Option C: Using gcloud (For Firebase Functions v2)**
```bash
gcloud functions deploy whatsappConnectStart \
  --set-env-vars META_APP_ID=your_app_id,META_APP_SECRET=your_secret,BASE_URL=https://stockpilotv1.web.app
```

### Step 3: Configure OAuth Redirect URI

1. In Meta App Settings → **Facebook Login → Settings**
2. Add to **Valid OAuth Redirect URIs**:
   ```
   https://stockpilotv1.web.app/whatsapp/connect/callback
   ```

## 🧪 Test It

1. **Local**: `firebase emulators:start --only functions`
2. **Production**: `firebase deploy --only functions:whatsappConnectStart,functions:whatsappConnectCallback`
3. Try clicking "Connect WhatsApp Business API" button

## ✅ Success Checklist

- [ ] Environment variables set in Firebase Console or `.env` file
- [ ] OAuth redirect URI added to Meta App
- [ ] Functions deployed
- [ ] No more "Meta App credentials not configured" error
- [ ] OAuth flow redirects to Meta successfully

## 🐛 Still Not Working?

1. **Check logs**: `firebase functions:log`
2. **Verify variables**: Check Firebase Console → Functions → Configuration
3. **Test locally first**: Use emulator with `.env` file
4. **Check Meta App**: Ensure WhatsApp product is added

