# Webhook 404 Error - Solution

## Problem

Accessing `https://stockpilotv1.web.app/whatsapp/tech-provider/webhook` returns **404 Site Not Found**, even though:
- ✅ Function is deployed and working
- ✅ Rewrite is configured in `firebase.json`
- ✅ Hosting is deployed

## Root Cause

Firebase Hosting rewrites for **Cloud Functions v2** may not work the same way as v1 functions. The `function` property in rewrites might not properly route to v2 functions.

## Immediate Solution: Use Direct Cloud Run URL

**For Meta Dashboard webhook configuration, use the direct Cloud Run URL:**

```
https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app
```

This URL works immediately and doesn't depend on Firebase Hosting rewrites.

### Verification

Test the direct URL:
```bash
curl "https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=123"
```

Should return: `123` (when token matches) or `Forbidden` (when token doesn't match)

## Meta Dashboard Configuration

1. Go to: https://developers.facebook.com/apps/1902565950686087/webhooks/
2. Set **Callback URL** to:
   ```
   https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app
   ```
3. Set **Verify Token** to:
   ```
   flyp_tech_provider_webhook_token
   ```
   (Or your `WHATSAPP_WEBHOOK_VERIFY_TOKEN` secret value)
4. Click **Verify and Save**
5. Should show **Verified** status

## Why This Works

- ✅ Direct Cloud Run URLs are always accessible
- ✅ No dependency on Firebase Hosting rewrites
- ✅ More reliable for webhooks
- ✅ Works immediately

## Future Fix (Optional)

If you want to use the hosting URL later, you may need to:
1. Check Firebase documentation for v2 function rewrite syntax
2. Consider using `run` property with correct service IDs
3. Or wait for Firebase to fix v2 rewrite support

For now, **use the direct Cloud Run URL** - it's the most reliable solution.

## All Function URLs

- **whatsappTechProviderWebhook**: `https://whatsapptechproviderwebhook-rg2uh6cnqq-uc.a.run.app`
- **whatsappWebhook**: `https://whatsappwebhook-rg2uh6cnqq-uc.a.run.app`
- **whatsappEmbeddedSignupCallback**: `https://whatsappembeddedsignupcallback-rg2uh6cnqq-uc.a.run.app`
- **whatsappConnectCallback**: Check with `firebase functions:list`

---

**Status**: ✅ **SOLVED** - Use direct Cloud Run URL for webhook configuration.
