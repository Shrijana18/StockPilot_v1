#!/bin/bash

# WhatsApp OAuth Environment Variables Setup Script
# This script helps you set up environment variables for WhatsApp OAuth

echo "🚀 WhatsApp OAuth Environment Variables Setup"
echo "=============================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    touch .env
    echo "# WhatsApp OAuth Configuration" >> .env
    echo "" >> .env
fi

# Prompt for META_APP_ID
if grep -q "META_APP_ID" .env; then
    echo "✅ META_APP_ID already exists in .env"
    read -p "Do you want to update it? (y/n): " update
    if [ "$update" = "y" ]; then
        read -p "Enter your Meta App ID: " app_id
        # Remove old line and add new one
        sed -i.bak '/^META_APP_ID=/d' .env
        echo "META_APP_ID=$app_id" >> .env
        echo "✅ META_APP_ID updated"
    fi
else
    read -p "Enter your Meta App ID: " app_id
    echo "META_APP_ID=$app_id" >> .env
    echo "✅ META_APP_ID added"
fi

# Prompt for META_APP_SECRET
if grep -q "META_APP_SECRET" .env; then
    echo "✅ META_APP_SECRET already exists in .env"
    read -p "Do you want to update it? (y/n): " update
    if [ "$update" = "y" ]; then
        read -p "Enter your Meta App Secret: " app_secret
        # Remove old line and add new one
        sed -i.bak '/^META_APP_SECRET=/d' .env
        echo "META_APP_SECRET=$app_secret" >> .env
        echo "✅ META_APP_SECRET updated"
    fi
else
    read -p "Enter your Meta App Secret: " app_secret
    echo "META_APP_SECRET=$app_secret" >> .env
    echo "✅ META_APP_SECRET added"
fi

# Prompt for META_SYSTEM_USER_TOKEN (for Tech Provider)
if grep -q "META_SYSTEM_USER_TOKEN" .env; then
    echo "✅ META_SYSTEM_USER_TOKEN already exists in .env"
    read -p "Do you want to update it? (y/n): " update
    if [ "$update" = "y" ]; then
        echo "💡 To get System User Token:"
        echo "   1. Go to: https://business.facebook.com/settings/system-users"
        echo "   2. Create System User with permissions:"
        echo "      - whatsapp_business_management"
        echo "      - whatsapp_business_messaging"
        echo "      - business_management"
        echo "   3. Generate token"
        read -p "Enter your System User Token: " system_token
        # Remove old line and add new one
        sed -i.bak '/^META_SYSTEM_USER_TOKEN=/d' .env
        echo "META_SYSTEM_USER_TOKEN=$system_token" >> .env
        echo "✅ META_SYSTEM_USER_TOKEN updated"
    fi
else
    echo "💡 To get System User Token (for Tech Provider):"
    echo "   1. Go to: https://business.facebook.com/settings/system-users"
    echo "   2. Create System User with permissions:"
    echo "      - whatsapp_business_management"
    echo "      - whatsapp_business_messaging"
    echo "      - business_management"
    echo "   3. Generate token"
    read -p "Enter your System User Token (or press Enter to skip): " system_token
    if [ ! -z "$system_token" ]; then
        echo "META_SYSTEM_USER_TOKEN=$system_token" >> .env
        echo "✅ META_SYSTEM_USER_TOKEN added"
    fi
fi

# Prompt for BASE_URL
if grep -q "BASE_URL" .env; then
    echo "✅ BASE_URL already exists in .env"
    read -p "Do you want to update it? (y/n): " update
    if [ "$update" = "y" ]; then
        read -p "Enter your Base URL (default: https://stockpilotv1.web.app): " base_url
        base_url=${base_url:-https://stockpilotv1.web.app}
        # Remove old line and add new one
        sed -i.bak '/^BASE_URL=/d' .env
        echo "BASE_URL=$base_url" >> .env
        echo "✅ BASE_URL updated"
    fi
else
    read -p "Enter your Base URL (default: https://stockpilotv1.web.app): " base_url
    base_url=${base_url:-https://stockpilotv1.web.app}
    echo "BASE_URL=$base_url" >> .env
    echo "✅ BASE_URL added"
fi

# Prompt for WHATSAPP_WEBHOOK_VERIFY_TOKEN
if grep -q "WHATSAPP_WEBHOOK_VERIFY_TOKEN" .env; then
    echo "✅ WHATSAPP_WEBHOOK_VERIFY_TOKEN already exists in .env"
    read -p "Do you want to update it? (y/n): " update
    if [ "$update" = "y" ]; then
        read -p "Enter Webhook Verify Token (default: flyp_tech_provider_webhook_token): " webhook_token
        webhook_token=${webhook_token:-flyp_tech_provider_webhook_token}
        # Remove old line and add new one
        sed -i.bak '/^WHATSAPP_WEBHOOK_VERIFY_TOKEN=/d' .env
        echo "WHATSAPP_WEBHOOK_VERIFY_TOKEN=$webhook_token" >> .env
        echo "✅ WHATSAPP_WEBHOOK_VERIFY_TOKEN updated"
    fi
else
    read -p "Enter Webhook Verify Token (default: flyp_tech_provider_webhook_token): " webhook_token
    webhook_token=${webhook_token:-flyp_tech_provider_webhook_token}
    echo "WHATSAPP_WEBHOOK_VERIFY_TOKEN=$webhook_token" >> .env
    echo "✅ WHATSAPP_WEBHOOK_VERIFY_TOKEN added"
fi

# Clean up backup file
rm -f .env.bak

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. For local development: Run 'firebase emulators:start --only functions'"
echo "2. For production: Set these as Firebase Functions environment variables"
echo "3. Deploy: 'firebase deploy --only functions'"
echo ""
echo "⚠️  IMPORTANT: Never commit .env file to git!"

