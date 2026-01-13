# Deployment Fix Guide

## Issues Encountered

### 1. Secret Environment Variable Conflict
**Error**: `Secret environment variable overlaps non secret environment variable: META_SYSTEM_USER_TOKEN`

**Cause**: Firebase Functions v2 detected that `META_SYSTEM_USER_TOKEN` is being used both as a secret (via `defineSecret`) and as a regular environment variable.

**Solution**: Ensure all functions use ONLY the secret, not regular environment variables.

### 2. CPU Quota Exceeded
**Error**: `Quota exceeded for total allowable CPU per project per region`

**Cause**: Cloud Run has a default quota limit for CPU resources per region. With many functions, you've hit this limit.

**Solutions**:
- **Option A**: Wait a few hours and retry (quotas reset periodically)
- **Option B**: Request quota increase from Google Cloud Console
- **Option C**: Deploy functions in batches (deploy only WhatsApp functions first)

## Immediate Fix Steps

### Step 1: Deploy Only WhatsApp Functions First

Deploy only the WhatsApp-related functions to avoid the quota issue:

```bash
firebase deploy --only functions:verifyPhoneOTP,functions:checkPhoneRegistrationStatus,functions:saveWABADirect,functions:detectNewWABA,functions:setupWebhookForClient,functions:getWABAStatus,functions:getWhatsAppSetupStatus,functions:getClientWABA,functions:sendMessageViaTechProvider,functions:whatsappTechProviderWebhook,functions:createWhatsAppMessageTemplate
```

### Step 2: Check for Conflicting Environment Variables

If the secret conflict persists, check if there are any Cloud Run services with regular env vars:

1. Go to [Google Cloud Console](https://console.cloud.google.com/run)
2. Check each Cloud Run service for environment variables named `META_SYSTEM_USER_TOKEN`
3. Remove any regular env vars if they exist (keep only secrets)

### Step 3: Verify Secrets Are Set

Ensure the secret is properly set:

```bash
# Check if secret exists
gcloud secrets list --filter="name:META_SYSTEM_USER_TOKEN"

# If it doesn't exist, create it:
# firebase functions:secrets:set META_SYSTEM_USER_TOKEN
```

### Step 4: Request Quota Increase (If Needed)

1. Go to [Google Cloud Console - Quotas](https://console.cloud.google.com/iam-admin/quotas)
2. Filter by "Cloud Run" and "CPU"
3. Request increase for "CPU allocation per region"
4. Wait for approval (usually instant for small increases)

## Alternative: Deploy Functions in Smaller Batches

If quota is still an issue, deploy in smaller batches:

### Batch 1: Core WhatsApp Functions
```bash
firebase deploy --only functions:verifyPhoneOTP,functions:checkPhoneRegistrationStatus,functions:saveWABADirect
```

### Batch 2: Detection and Status Functions
```bash
firebase deploy --only functions:detectNewWABA,functions:getWABAStatus,functions:getWhatsAppSetupStatus
```

### Batch 3: Webhook and Messaging
```bash
firebase deploy --only functions:setupWebhookForClient,functions:whatsappTechProviderWebhook,functions:sendMessageViaTechProvider
```

### Batch 4: Remaining Functions
```bash
firebase deploy --only functions:getClientWABA,functions:createWhatsAppMessageTemplate
```

## Verification

After deployment, verify functions are working:

```bash
# List deployed functions
firebase functions:list

# Check function logs
firebase functions:log --only verifyPhoneOTP
```

## Notes

- The secret conflict error should resolve once we ensure only secrets are used
- CPU quota issues are temporary and will resolve after quota reset or increase
- Functions that successfully deployed are still working
- Failed functions can be redeployed once issues are resolved
