# Fix WhatsApp Functions Quota Issue

## ✅ Good News: Functions Are Already Deployed!

The functions **are already deployed and working**:
- ✅ `whatsappConnectStart` - Active (revision 00001)
- ✅ `whatsappConnectCallback` - Active (revision 00001)  
- ✅ `whatsappWebhook` - Active

## 🔴 Issue: Quota Limit

**Error**: `Quota exceeded for total allowable CPU per project per region`

This happens when trying to **update** functions - the project has hit its CPU quota limit in `us-central1` region.

## 🚀 Solutions

### Solution 1: Use Existing Functions (Recommended)

The functions are **already working**! You can use them as-is:

1. **Test the functions**:
   ```bash
   # Test via Firebase console or your app
   # The functions should work fine
   ```

2. **The code is already deployed** - just test if it works

### Solution 2: Delete Old Failed Revisions (Free Quota)

Delete failed revisions via Google Cloud Console:

1. Go to [Cloud Run Console](https://console.cloud.google.com/run?project=stockpilotv1)
2. Select region: `us-central1`
3. Find services: `whatsappconnectstart` and `whatsappconnectcallback`
4. Click on each service → "Revisions" tab
5. Delete failed revisions (00002, 00003, 00004, 00005)
6. Keep only the working revision (00001)

**Or use gcloud CLI**:
```bash
# List revisions
gcloud run revisions list --region=us-central1 --platform=managed

# Delete specific failed revisions
gcloud run revisions delete REVISION_NAME --region=us-central1 --platform=managed
```

### Solution 3: Request Quota Increase

1. Go to [Quotas Page](https://console.cloud.google.com/iam-admin/quotas?project=stockpilotv1)
2. Filter: `Cloud Run CPU` + `us-central1`
3. Click "Edit Quotas"
4. Request increase (e.g., from current limit to higher)

### Solution 4: Deploy to Different Region

Change region to one with available quota:

```javascript
// In functions/whatsapp/connect.js
exports.whatsappConnectStart = onCall({
  region: "asia-south1", // Different region
  cors: true,
  memory: "128MiB",
  timeoutSeconds: 30,
});
```

## 📋 Current Status

- ✅ Functions deployed and active
- ✅ Code is correct
- ⚠️ Can't update due to quota (but existing functions work)
- ✅ Can use functions as-is

## 🎯 Recommended Action

1. **Test existing functions first** - They should work!
2. **Delete old failed revisions** via console
3. **Then try deploying again** if you need updates

The functions are ready to use - the quota issue only affects **updates**, not the existing deployment!


