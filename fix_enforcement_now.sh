#!/bin/bash
echo "🔧 Setting reCAPTCHA Enforcement Mode to AUDIT"
echo ""
echo "📋 Step 1: Getting access token..."
TOKEN=$(gcloud auth print-access-token 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token. Run: gcloud auth login"
  exit 1
fi

echo "✅ Token obtained"
echo ""
echo "📋 Step 2: Setting enforcement mode..."
echo ""

RESPONSE=$(curl -s -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/stockpilotv1/config?updateMask=recaptchaConfig" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recaptchaConfig": {
      "phoneEnforcementState": "AUDIT"
    }
  }')

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q "phoneEnforcementState"; then
  echo ""
  echo "✅ SUCCESS! Enforcement mode set to AUDIT"
  echo "⏳ Wait 2-3 minutes, then test OTP"
else
  echo ""
  echo "❌ Failed. Check error message above"
  echo ""
  echo "Common issues:"
  echo "1. Missing permissions - need 'Identity Platform Admin' role"
  echo "2. API not enabled - check Identity Toolkit API"
  echo "3. Try Firebase Console instead"
fi
