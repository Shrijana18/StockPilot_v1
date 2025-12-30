#!/bin/bash

# Script to set Firebase Secrets for Meta WhatsApp Tech Provider
# This will set META_SYSTEM_USER_TOKEN and META_APP_SECRET

echo "🔐 Setting Firebase Secrets for Meta WhatsApp Tech Provider"
echo "============================================================"
echo ""

# Check if we're in the right directory
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please run this script from the functions/ directory"
    exit 1
fi

# Try to get values from .env
META_APP_SECRET=$(grep "^META_APP_SECRET=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
META_SYSTEM_USER_TOKEN=$(grep "^META_SYSTEM_USER_TOKEN=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")

# Check if values are placeholders
if [[ "$META_APP_SECRET" == *"your_app_secret"* ]] || [[ "$META_APP_SECRET" == "" ]]; then
    echo "⚠️  META_APP_SECRET in .env appears to be a placeholder"
    echo "Please enter your actual App Secret:"
    read -sp "META_APP_SECRET: " META_APP_SECRET
    echo ""
fi

if [[ "$META_SYSTEM_USER_TOKEN" == *"your_system_user_token"* ]] || [[ "$META_SYSTEM_USER_TOKEN" == "" ]]; then
    echo "⚠️  META_SYSTEM_USER_TOKEN in .env appears to be a placeholder"
    echo "Please enter your actual System User Token:"
    read -sp "META_SYSTEM_USER_TOKEN: " META_SYSTEM_USER_TOKEN
    echo ""
fi

# Validate values
if [ -z "$META_APP_SECRET" ] || [ "$META_APP_SECRET" == "your_app_secret_here" ]; then
    echo "❌ Error: META_APP_SECRET is required!"
    exit 1
fi

if [ -z "$META_SYSTEM_USER_TOKEN" ] || [ "$META_SYSTEM_USER_TOKEN" == "your_system_user_token_here" ]; then
    echo "❌ Error: META_SYSTEM_USER_TOKEN is required!"
    exit 1
fi

echo ""
echo "📝 Setting Firebase Secrets..."
echo ""

# Set META_SYSTEM_USER_TOKEN
echo "Setting META_SYSTEM_USER_TOKEN..."
echo "$META_SYSTEM_USER_TOKEN" | firebase functions:secrets:set META_SYSTEM_USER_TOKEN
if [ $? -eq 0 ]; then
    echo "✅ META_SYSTEM_USER_TOKEN set successfully!"
else
    echo "❌ Failed to set META_SYSTEM_USER_TOKEN"
    exit 1
fi

echo ""

# Set META_APP_SECRET
echo "Setting META_APP_SECRET..."
echo "$META_APP_SECRET" | firebase functions:secrets:set META_APP_SECRET
if [ $? -eq 0 ]; then
    echo "✅ META_APP_SECRET set successfully!"
else
    echo "❌ Failed to set META_APP_SECRET"
    exit 1
fi

echo ""
echo "✅ All Firebase Secrets set successfully!"
echo ""
echo "Next steps:"
echo "1. Test 'Setup Webhook' button in your app"
echo "2. Check Firebase logs if needed: firebase functions:log --only setupWebhookForClient"
echo ""

