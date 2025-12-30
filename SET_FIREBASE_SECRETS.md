# Set Firebase Secrets - Quick Guide

## ✅ Functions Deployed Successfully!

All functions are live, but they need secrets to work. Here's how to set them:

---

## 🔐 Step 1: Set Firebase Secrets

### **For Production (Required):**

```bash
# Set System User Token (CRITICAL for Tech Provider)
firebase functions:secrets:set META_SYSTEM_USER_TOKEN

# When prompted, paste your System User Token
# (Get it from: Meta Business Suite → System Users → Generate Token)
```

```bash
# Set App Secret
firebase functions:secrets:set META_APP_SECRET

# When prompted, paste your App Secret
# (Get it from: Meta Developer Console → Settings → Basic → Show App Secret)
```

### **For Local Development (.env file):**

Create `functions/.env`:

```env
META_APP_ID=1902565950686087
META_APP_SECRET=your_app_secret_here
META_SYSTEM_USER_TOKEN=your_system_user_token_here
BASE_URL=http://localhost:5173
WHATSAPP_WEBHOOK_VERIFY_TOKEN=flyp_tech_provider_webhook_token
```

---

## 📋 Quick Setup Commands

### **Option 1: Use Setup Script (Easiest)**

```bash
cd functions
./setup-demo-env.sh
```

### **Option 2: Manual Setup**

```bash
cd functions
touch .env
# Then add the variables above
```

---

## 🎯 What Each Secret Does

| Secret | Purpose | Where to Get |
|--------|---------|--------------|
| `META_APP_ID` | Your Meta App ID | Already have: `1902565950686087` |
| `META_APP_SECRET` | OAuth authentication | Meta Developer Console → Settings → Basic |
| `META_SYSTEM_USER_TOKEN` | **Tech Provider** - Manage WABAs | Meta Business Suite → System Users → Generate Token |
| `BASE_URL` | OAuth redirect URL | Your app URL |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification | You set it (any string) |

---

## ✅ After Setting Secrets

1. **Test Locally:**
   ```bash
   cd functions
   firebase emulators:start --only functions
   ```

2. **Test in Production:**
   - Functions will automatically use secrets
   - No need to redeploy after setting secrets

---

## 🚨 Important Notes

1. **Secrets are Secure:**
   - Never commit `.env` to git (already in `.gitignore`)
   - Secrets are encrypted in Firebase
   - Only accessible to your functions

2. **Local vs Production:**
   - **Local:** Use `.env` file
   - **Production:** Use Firebase Secrets

3. **After Setting Secrets:**
   - Functions will work immediately
   - No redeployment needed
   - Test to verify

---

## 🎬 Ready for Demo!

Once secrets are set:
- ✅ Functions will work in production
- ✅ Tech Provider setup will work
- ✅ Message sending will work
- ✅ Ready to record demo video!

---

**Set the secrets and you're ready to go! 🚀**


