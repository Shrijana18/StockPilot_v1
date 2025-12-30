#!/bin/bash

# Deploy Meta WhatsApp Tech Provider Functions
# This script sets up Firebase Secrets and deploys functions

echo "🚀 Meta WhatsApp Tech Provider Deployment"
echo "=========================================="
echo ""

# Check if Firebase is logged in
if ! firebase projects:list &>/dev/null; then
    echo "❌ Error: Not logged in to Firebase"
    echo "Please run: firebase login"
    exit 1
fi

echo "✅ Firebase CLI ready"
echo ""

# Step 1: Set Firebase Secrets
echo "📝 Step 1: Setting Firebase Secrets"
echo "-----------------------------------"
echo ""
echo "⚠️  You'll be prompted to enter your secrets."
echo ""

# Set System User Token
echo "Setting META_SYSTEM_USER_TOKEN..."
read -sp "Enter META_SYSTEM_USER_TOKEN: " SYSTEM_TOKEN
echo ""
if [ -z "$SYSTEM_TOKEN" ]; then
    echo "⚠️  Skipping META_SYSTEM_USER_TOKEN (you can set it later)"
else
    echo "$SYSTEM_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
    echo "✅ META_SYSTEM_USER_TOKEN set"
fi

echo ""

# Set App Secret
echo "Setting META_APP_SECRET..."
read -sp "Enter META_APP_SECRET: " APP_SECRET
echo ""
if [ -z "$APP_SECRET" ]; then
    echo "⚠️  Skipping META_APP_SECRET (you can set it later)"
else
    echo "$APP_SECRET" | firebase functions:secrets:set META_APP_SECRET
    echo "✅ META_APP_SECRET set"
fi

echo ""

# Step 2: Set Firebase Config
echo "📝 Step 2: Setting Firebase Config"
echo "-----------------------------------"

firebase functions:config:set meta.app_id="1902565950686087"
echo "✅ meta.app_id set"

firebase functions:config:set base.url="https://stockpilotv1.web.app"
echo "✅ base.url set"

firebase functions:config:set whatsapp.webhook_verify_token="flyp_tech_provider_webhook_token"
echo "✅ whatsapp.webhook_verify_token set"

echo ""

# Step 3: Deploy Functions
echo "📝 Step 3: Deploying Functions"
echo "-----------------------------"
echo ""

read -p "Deploy all functions or just WhatsApp functions? (all/whatsapp) [whatsapp]: " DEPLOY_CHOICE
DEPLOY_CHOICE=${DEPLOY_CHOICE:-whatsapp}

if [ "$DEPLOY_CHOICE" = "all" ]; then
    echo "Deploying all functions..."
    firebase deploy --only functions
else
    echo "Deploying WhatsApp Tech Provider functions..."
    firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure webhook in Meta Developer Console"
echo "2. Test WABA creation from your frontend"
echo "3. Test message sending"
echo ""

