#!/bin/bash
# Set PayU secrets for Firebase Cloud Functions
# Run from project root: ./scripts/set-payu-secrets.sh
#
# You need from PayU Dashboard → Developers → API Keys:
# - API Key (e.g. c4DBGo)
# - Salt

set -e

echo "🔐 Setting PayU Firebase secrets..."
echo ""

if [ -z "$PAYU_MERCHANT_KEY" ]; then
  read -p "Enter PayU Merchant Key (API Key from dashboard): " PAYU_MERCHANT_KEY
fi
if [ -z "$PAYU_SALT" ]; then
  read -sp "Enter PayU Salt: " PAYU_SALT
  echo ""
fi

if [ -z "$PAYU_MERCHANT_KEY" ] || [ -z "$PAYU_SALT" ]; then
  echo "❌ Both PAYU_MERCHANT_KEY and PAYU_SALT are required."
  exit 1
fi

echo -n "$PAYU_MERCHANT_KEY" | firebase functions:secrets:set PAYU_MERCHANT_KEY
echo "✅ PAYU_MERCHANT_KEY set"

echo -n "$PAYU_SALT" | firebase functions:secrets:set PAYU_SALT
echo "✅ PAYU_SALT set"

echo ""
echo "🎉 PayU secrets set. Next: create webhook in PayU dashboard, then deploy:"
echo "   firebase deploy --only functions:createPayUOrder,functions:payuWebhook"
