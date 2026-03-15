# Razorpay Payment Gateway Setup

FLYP Corporation uses Razorpay as the trusted payment gateway for the ios-customer app. Customers can pay via Card, UPI, or Net Banking at checkout.

## Flow

1. **Customer** selects "Pay Now" at checkout
2. **Order** is created in Firestore (status: pending, paymentStatus: pending)
3. **createRazorpayOrder** Cloud Function creates a Razorpay order
4. **Razorpay Checkout** modal opens (Card, UPI, Net Banking)
5. **Customer** completes payment
6. **Razorpay webhook** fires → `razorpayWebhook` Cloud Function updates order to `paymentStatus: paid`

## Firebase Secrets

Set these before deploying functions:

```bash
# From project root
./scripts/set-razorpay-secrets.sh
```

Or manually (use `echo -n` to avoid trailing newline):

```bash
echo -n "rzp_live_XXX" | firebase functions:secrets:set RZP_CUSTOMER_KEY_ID
echo -n "your_key_secret" | firebase functions:secrets:set RZP_CUSTOMER_KEY_SECRET
echo -n "your_webhook_secret" | firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

- **RZP_CUSTOMER_KEY_ID**: Razorpay Key ID (for createRazorpayOrder)
- **RZP_CUSTOMER_KEY_SECRET**: Razorpay Key Secret (for createRazorpayOrder)
- **RAZORPAY_WEBHOOK_SECRET**: From Razorpay Dashboard → Webhooks → your webhook's Secret

## Razorpay Dashboard

1. **Webhook URL**: `https://asia-south1-stockpilotv1.cloudfunctions.net/razorpayWebhook`
2. **Events**: `payment.captured`, `payment.failed`, `payment.authorized`
3. **Secret**: Must match `RAZORPAY_WEBHOOK_SECRET` in Firebase

## Store Settings

Stores can enable/disable Pay Now via `paymentOptions.payNow`. Default is `true`.

In Firestore: `stores/{storeId}` → `paymentOptions: { payNow: true, cod: true, upi: true, ... }`

## Disabling Pay Now for a Store

Set `paymentOptions.payNow: false` in the store document.

## Route (Disbursement to Retailers)

For sending money to each retailer based on orders, use Razorpay Route:

1. Enable Route in Razorpay Dashboard
2. Add retailers as linked accounts
3. After `payment.captured`, call Route API to split/transfer (future enhancement)
