# Set Firebase Secrets - Step by Step

## ⚠️ Current Issue

Your `.env` file still has placeholder values:
- `META_APP_SECRET=your_app_secret_here`
- `META_SYSTEM_USER_TOKEN=your_system_user_token_here`

**We need your ACTUAL values to set Firebase Secrets!**

---

## 🔧 Solution: Two Options

### **Option 1: Update .env First, Then Set Secrets**

**Step 1: Update `.env` file with real values**

Edit `functions/.env` and replace:
```env
META_APP_SECRET=YOUR_ACTUAL_APP_SECRET
META_SYSTEM_USER_TOKEN=YOUR_ACTUAL_SYSTEM_USER_TOKEN
```

**Step 2: Run the script to set secrets**
```bash
cd functions
./set-firebase-secrets.sh
```

---

### **Option 2: Set Secrets Directly (If you have values)**

**Run these commands with your actual values:**

```bash
# Set System User Token
echo "YOUR_ACTUAL_SYSTEM_USER_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN

# Set App Secret
echo "YOUR_ACTUAL_APP_SECRET" | firebase functions:secrets:set META_APP_SECRET
```

**Replace:**
- `YOUR_ACTUAL_SYSTEM_USER_TOKEN` → Your real System User Token
- `YOUR_ACTUAL_APP_SECRET` → Your real App Secret

---

## 📝 Where to Get Your Values

### **Get System User Token:**

1. Go to: `https://business.facebook.com/settings/system-users`
2. Click on "FLYP Employee"
3. Click "Generate New Token" (or view existing)
4. Copy the token (it's a long string starting with `EAA...`)

### **Get App Secret:**

1. Go to: `https://developers.facebook.com/apps/1902565950686087/settings/basic`
2. Click "Show" next to App Secret
3. Copy the secret

---

## 🚀 Quick Commands (After You Have Values)

**Once you have your actual values, run:**

```bash
cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1

# Set System User Token (replace with your actual token)
echo "YOUR_ACTUAL_TOKEN_HERE" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN

# Set App Secret (replace with your actual secret)
echo "YOUR_ACTUAL_SECRET_HERE" | firebase functions:secrets:set META_APP_SECRET
```

---

## ✅ After Setting Secrets

1. **Test "Setup Webhook" button** - Should work now!
2. **Check logs if needed:**
   ```bash
   firebase functions:log --only setupWebhookForClient
   ```

---

**Please provide your actual values or update the .env file, then I can help set the secrets! 🎯**

