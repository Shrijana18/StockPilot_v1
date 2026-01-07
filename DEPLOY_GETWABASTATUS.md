# Deploy getWABAStatus Function

## ✅ Function Status
- ✅ Function created: `functions/whatsapp/techProvider.js` → `exports.getWABAStatus`
- ✅ Function exported: `functions/index.js` → `exports.getWABAStatus = whatsappTechProvider.getWABAStatus`

## 🚀 Deployment Options

### Option 1: Deploy Only getWABAStatus Function (Recommended)
```bash
cd functions
firebase deploy --only functions:getWABAStatus
```

### Option 2: Deploy All WhatsApp Tech Provider Functions
```bash
cd functions
firebase deploy --only functions:getWABAStatus,functions:getClientWABA,functions:getWhatsAppSetupStatus,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook,functions:sendMessageViaTechProvider
```

### Option 3: Deploy All Functions
```bash
cd functions
firebase deploy --only functions
```

## 📋 Prerequisites

### 1. Check Firebase Login
```bash
firebase login
firebase projects:list
```

### 2. Set Project
```bash
firebase use stockpilotv1
```

### 3. Verify Secrets (Required)
The function uses `META_SYSTEM_USER_TOKEN` secret. Check if it's set:
```bash
firebase functions:secrets:list
```

If not set, set it:
```bash
echo "your-system-user-token" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
```

## 🔍 Verify Deployment

After deployment, verify the function is available:
```bash
firebase functions:list | grep getWABAStatus
```

## 🧪 Test the Function

The function will be automatically called by the frontend component (`WhatsAppOnboardingSection`) when:
1. User has a connected WABA account
2. Component polls for status every 30 seconds
3. User clicks "Refresh Status" button

## 📝 Function Details

- **Function Name**: `getWABAStatus`
- **Type**: Callable Function (onCall)
- **Region**: us-central1
- **Memory**: 256MiB
- **Timeout**: 30 seconds
- **Secrets Required**: META_SYSTEM_USER_TOKEN
- **Returns**: 
  - Account review status (APPROVED, PENDING, REJECTED, etc.)
  - Phone verification status
  - Overall account readiness
  - Pending actions list

## 🎯 What It Does

1. Fetches WABA details from Meta API including `account_review_status`
2. Gets phone numbers and their verification status
3. Determines overall account readiness
4. Returns comprehensive status object for frontend display

## ✅ Deployment Checklist

- [x] Function created in `techProvider.js`
- [x] Function exported in `index.js`
- [ ] Secrets configured (META_SYSTEM_USER_TOKEN)
- [ ] Function deployed to Firebase
- [ ] Tested from frontend

## 🐛 Troubleshooting

If deployment fails:
1. Check Firebase CLI version: `firebase --version`
2. Check if logged in: `firebase projects:list`
3. Check secrets: `firebase functions:secrets:list`
4. Check function logs: `firebase functions:log --only getWABAStatus`

