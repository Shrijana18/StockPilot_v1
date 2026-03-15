# Razorpay Payment Integration – Checklist

## ✅ Completed

| Item | Status |
|------|--------|
| **Cloud Functions** | |
| `createRazorpayOrder` (callable) | Code ready |
| `razorpayWebhook` (HTTP) | Code ready |
| Exported in `functions/index.js` | ✅ Done |
| **Firebase Secrets** | |
| `RZP_CUSTOMER_KEY_ID` | ✅ Set (`rzp_live_SNZFcNLArhfaCF`) |
| `RZP_CUSTOMER_KEY_SECRET` | ✅ Set |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ Set (`FLYP@108`) |
| **Customer App** | |
| Pay Now option in Checkout | ✅ Done |
| Razorpay checkout flow | ✅ Done |
| `razorpayPaymentService.js` | ✅ Done |
| Capacitor allowNavigation (Razorpay) | ✅ Done |
| **Razorpay Dashboard** | |
| Webhook URL | `https://us-central1-stockpilotv1.cloudfunctions.net/razorpayWebhook` |
| Events | payment.captured, payment.failed, payment.authorized |
| Secret | `FLYP@108` |

## ✅ Deploy (asia-south1)

Both functions deployed to **asia-south1** to avoid us-central1 quota:

- `createRazorpayOrder(asia-south1)` ✔
- `razorpayWebhook(asia-south1)` ✔

**Update Razorpay Dashboard** webhook URL to:
`https://asia-south1-stockpilotv1.cloudfunctions.net/razorpayWebhook`

## 📋 Pre-flight verification

```bash
# 1. Verify secrets
firebase functions:secrets:access RZP_CUSTOMER_KEY_ID
firebase functions:secrets:access RZP_CUSTOMER_KEY_SECRET
firebase functions:secrets:access RAZORPAY_WEBHOOK_SECRET

# 2. Deploy Razorpay functions only
firebase deploy --only functions:createRazorpayOrder,functions:razorpayWebhook

# 3. Build customer app
npm run build:customer

# 4. Test webhook (after deploy)
curl -X POST https://asia-south1-stockpilotv1.cloudfunctions.net/razorpayWebhook \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test","amount":100,"notes":{"order_id":"test"}}}}}'
# Expected: 400 Invalid signature (webhook is live and validating)
```

## 🔗 URLs (asia-south1)

| Resource | URL |
|----------|-----|
| Webhook | `https://asia-south1-stockpilotv1.cloudfunctions.net/razorpayWebhook` |
| createRazorpayOrder | Callable – `httpsCallable(getFunctions(app, "asia-south1"), 'createRazorpayOrder')` |
