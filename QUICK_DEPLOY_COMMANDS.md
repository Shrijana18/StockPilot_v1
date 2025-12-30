# Quick Deploy Commands - Run These Now

## ✅ Already Done
- ✅ Firebase Config set (meta.app_id, base.url, whatsapp.webhook_verify_token)
- ✅ .env file template created
- ✅ Functions code ready

## 🔧 Step 1: Update .env File (For Local Development)

**Edit `functions/.env` and replace placeholder values:**

```bash
cd functions
nano .env  # or use your editor
```

**Update these lines with your actual values:**
```env
META_APP_SECRET=your_actual_app_secret
META_SYSTEM_USER_TOKEN=your_actual_system_user_token
```

---

## 🔐 Step 2: Set Firebase Secrets (For Production)

**Run these commands and paste your values when prompted:**

```bash
# Set System User Token
firebase functions:secrets:set META_SYSTEM_USER_TOKEN
# When prompted, paste your META_SYSTEM_USER_TOKEN

# Set App Secret  
firebase functions:secrets:set META_APP_SECRET
# When prompted, paste your META_APP_SECRET
```

**Or use echo to set them directly:**
```bash
echo "your_actual_system_user_token" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
echo "your_actual_app_secret" | firebase functions:secrets:set META_APP_SECRET
```

---

## 🚀 Step 3: Deploy Functions

**Deploy all WhatsApp Tech Provider functions:**

```bash
firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
```

**Or deploy all functions:**
```bash
firebase deploy --only functions
```

---

## ✅ Step 4: Verify Deployment

**Check function URLs after deployment:**
```bash
firebase functions:list
```

**Check logs:**
```bash
firebase functions:log
```

---

## 📝 All Commands in One Go

```bash
# 1. Set Secrets (replace with your actual values)
echo "YOUR_SYSTEM_USER_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
echo "YOUR_APP_SECRET" | firebase functions:secrets:set META_APP_SECRET

# 2. Deploy Functions
firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
```

---

## 🎯 After Deployment

1. **Configure Webhook in Meta:**
   - Go to: https://developers.facebook.com/apps/1902565950686087/whatsapp-business/wa-dev-quickstart
   - Webhook URL: `https://us-central1-stockpilotv1.cloudfunctions.net/whatsappTechProviderWebhook`
   - Verify Token: `flyp_tech_provider_webhook_token`

2. **Test from your frontend:**
   - Call `createClientWABA` function
   - Check Firebase logs for any errors

---

**Ready? Run the commands above! 🚀**

