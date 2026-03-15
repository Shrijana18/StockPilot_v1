# PayU Payment Gateway Setup

This guide covers setting up PayU for the FLYP customer app checkout.

## PayU Dashboard - What You Already Have

From your PayU Developers dashboard:

- **API Key**: Already created (e.g. `c4DBGo`) — copy from API Keys tab
- **Salt**: Already created (e.g. `dOIRs7UuOh90hxqxB4iTRO5W98krWprx`) — copy from API Keys tab
- **Webhooks**: None configured yet — you need to create one

## Step 1: Set Firebase Secrets

Run from project root (or use `./scripts/set-payu-secrets.sh` if you create it):

```bash
# PayU Merchant Key (API Key from PayU dashboard)
echo -n "YOUR_PAYU_KEY" | firebase functions:secrets:set PAYU_MERCHANT_KEY

# PayU Salt
echo -n "YOUR_PAYU_SALT" | firebase functions:secrets:set PAYU_SALT
```

Use the Key and Salt from: **PayU Dashboard → Developers → API Keys**.

## Step 2: Create Webhook in PayU

1. Go to **PayU Dashboard** → **Developers** (left sidebar) → **Webhooks** tab
2. Click the green **Create Webhook** button
3. In the modal:
   - **Type**: Leave as **Payments**
   - **Event**: Select **Successful** (create one webhook), then create another for **Failed**
     - Or if PayU allows multiple events: select both Successful and Failed
   - **URL**: `https://asia-south1-stockpilotv1.cloudfunctions.net/payuWebhook`
4. Save. Repeat for **Failed** if PayU requires one webhook per event.

> **Note**: PayU also redirects the user's browser to surl/furl. Our Cloud Function `payuWebhook` receives that redirect and handles both the redirect flow and webhook. The surl/furl are set to the same function URL when creating the payment, so you don't need to configure them separately in PayU.

## Step 3: Configure Environment Variables

For the Cloud Function that redirects users back to your app after payment:

```bash
# Where to redirect users after PayU payment (your customer app URL)
firebase functions:config:set app.payu_redirect_base="https://order.flypnow.com"
```

Or set `PAYU_REDIRECT_BASE` in your Functions environment (`.env` or Firebase config).

**Test mode** (use PayU test environment):

```bash
firebase functions:config:set app.payu_test_mode="true"
```

Or set `PAYU_TEST_MODE=true` in your environment.

## Step 4: Enable PayU in Customer App

Add to your `.env` or build config:

```
VITE_USE_PAYU=true
```

When `VITE_USE_PAYU=true`, the Checkout will use PayU instead of Razorpay.

## Step 5: Deploy Functions

```bash
firebase deploy --only functions:createPayUOrder,functions:payuWebhook
```

## Flow Overview

1. **Checkout** → User selects "Pay Online" (or UPI shortcut)
2. **createPayUOrder** → Cloud Function generates hash and returns post params
3. **Frontend** → Submits form to `https://secure.payu.in/_payment` (or test URL)
4. **PayU** → User pays on PayU page
5. **payuWebhook** → PayU POSTs to our function; we verify hash, update order, redirect user
6. **User** → Lands on `/#/payment/success?orderId=xxx` or `/#/payment/failure?orderId=xxx`

## UPI-Only Mode

When the user selects a UPI shortcut (PhonePe, GPay, Paytm, BHIM), we pass `enforce_paymethod: "UPI"` so PayU shows only UPI options. This gives a cleaner flow similar to Blinkit/Instamart.

## Troubleshooting

- **"Transaction failed due to incorrectly calculated hash parameter"**: Almost always caused by Key/Salt mismatch. If you regenerated Salt in PayU Dashboard, you **must** update Firebase secrets:
  ```bash
  ./scripts/set-payu-secrets.sh
  # Then redeploy:
  firebase deploy --only functions:createPayUOrder,functions:payuWebhook
  ```
- **Hash mismatch**: Ensure you use **API Key** (e.g. `c4DBGo`), NOT Merchant ID (MID). Key and Salt from PayU Dashboard → Developers → API Keys must match Firebase secrets exactly.
- **Redirect not working**: Check `PAYU_REDIRECT_BASE` or `VITE_CUSTOMER_APP_URL` points to your customer app
- **Webhook not firing**: Verify webhook URL is correct and PayU can reach it (check PayU webhook logs)
