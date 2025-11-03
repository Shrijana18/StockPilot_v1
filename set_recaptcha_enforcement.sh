#!/bin/bash
# Script to set reCAPTCHA enforcement mode via REST API
# Since gcloud CLI doesn't have direct support for this

echo "🔧 Setting reCAPTCHA Enforcement Mode via REST API"
echo ""
echo "⚠️  Note: The gcloud command you tried doesn't support 'identity-platform'"
echo "   We'll use Firebase REST API instead"
echo ""
echo "📋 Your reCAPTCHA Key ID:"
echo "   6LfDEP4rAAAAADI1HEs9K5kEivA90sdZUDj3md5B"
echo ""
echo "🔗 Option 1: Use Firebase Console (EASIEST)"
echo "   https://console.firebase.google.com/project/stockpilotv1/authentication/settings/recaptcha"
echo ""
echo "🔗 Option 2: Use REST API (if Console doesn't work)"
echo ""
echo "You'll need:"
echo "1. Get an access token:"
echo "   gcloud auth print-access-token"
echo ""
echo "2. Then use this curl command:"
echo ""
cat << 'API_CALL'
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/stockpilotv1/config?updateMask=recaptchaConfig" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "recaptchaConfig": {
      "emailPasswordEnforcementState": "AUDIT",
      "phoneEnforcementState": "AUDIT",
      "managedRules": []
    }
  }'
API_CALL

echo ""
echo "✅ Or try the simpler Firebase Console method first!"

