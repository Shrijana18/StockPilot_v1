#!/bin/bash
# Set Razorpay secrets for Firebase Cloud Functions
# Run from project root: ./scripts/set-razorpay-secrets.sh
#
# You need:
# - RAZORPAY_KEY_ID (from Razorpay Dashboard → API Keys)
# - RAZORPAY_KEY_SECRET (from Razorpay Dashboard → API Keys)
# - RAZORPAY_WEBHOOK_SECRET (from Razorpay Dashboard → Webhooks → your webhook's Secret)

set -e

echo "🔐 Setting Razorpay Firebase secrets..."
echo ""

if [ -z "$RAZORPAY_KEY_ID" ]; then
  read -p "Enter Razorpay Key ID (rzp_live_... or rzp_test_...): " RAZORPAY_KEY_ID
fi
if [ -z "$RAZORPAY_KEY_SECRET" ]; then
  read -sp "Enter Razorpay Key Secret: " RAZORPAY_KEY_SECRET
  echo ""
fi
if [ -z "$RAZORPAY_WEBHOOK_SECRET" ]; then
  read -sp "Enter RAZORPAY_WEBHOOK_SECRET (from Razorpay webhook setup): " RAZORPAY_WEBHOOK_SECRET
  echo ""
fi

if [ -z "$RAZORPAY_KEY_ID" ] || [ -z "$RAZORPAY_KEY_SECRET" ] || [ -z "$RAZORPAY_WEBHOOK_SECRET" ]; then
  echo "❌ All three secrets are required."
  exit 1
fi

# Use echo -n to avoid trailing newline (causes Razorpay 401 auth failure)
echo -n "$RAZORPAY_KEY_ID" | firebase functions:secrets:set RZP_CUSTOMER_KEY_ID
echo "✅ RZP_CUSTOMER_KEY_ID set"

echo -n "$RAZORPAY_KEY_SECRET" | firebase functions:secrets:set RZP_CUSTOMER_KEY_SECRET
echo "✅ RZP_CUSTOMER_KEY_SECRET set"

echo -n "$RAZORPAY_WEBHOOK_SECRET" | firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
echo "✅ RAZORPAY_WEBHOOK_SECRET set"

echo ""
echo "🎉 Razorpay secrets set. Deploy checkout functions:"
echo "   firebase deploy --only functions:createRazorpayOrder,functions:razorpayWebhook"
