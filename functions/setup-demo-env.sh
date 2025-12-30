#!/bin/bash

# Quick Setup Script for WhatsApp Tech Provider Demo
# This script helps you set up environment variables for local development

echo "🚀 WhatsApp Tech Provider - Demo Setup"
echo "======================================"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

echo "📋 Please provide the following information:"
echo ""

# App ID (already known)
read -p "Meta App ID [1902565950686087]: " APP_ID
APP_ID=${APP_ID:-1902565950686087}

# App Secret
read -p "Meta App Secret: " APP_SECRET
if [ -z "$APP_SECRET" ]; then
    echo "❌ App Secret is required!"
    exit 1
fi

# System User Token
echo ""
echo "💡 To get System User Token:"
echo "   1. Go to: https://business.facebook.com/settings/system-users"
echo "   2. Create System User with permissions:"
echo "      - whatsapp_business_management"
echo "      - whatsapp_business_messaging"
echo "      - business_management"
echo "   3. Generate token"
echo ""
read -p "System User Token: " SYSTEM_TOKEN
if [ -z "$SYSTEM_TOKEN" ]; then
    echo "❌ System User Token is required!"
    exit 1
fi

# Base URL
read -p "Base URL [http://localhost:5173]: " BASE_URL
BASE_URL=${BASE_URL:-http://localhost:5173}

# Webhook Token
read -p "Webhook Verify Token [flyp_tech_provider_webhook_token]: " WEBHOOK_TOKEN
WEBHOOK_TOKEN=${WEBHOOK_TOKEN:-flyp_tech_provider_webhook_token}

# Create .env file
cat > .env << EOF
# Meta App Credentials
META_APP_ID=${APP_ID}
META_APP_SECRET=${APP_SECRET}

# System User Token (for Tech Provider)
META_SYSTEM_USER_TOKEN=${SYSTEM_TOKEN}

# Base URL
BASE_URL=${BASE_URL}

# Webhook Verify Token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=${WEBHOOK_TOKEN}
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Start Firebase emulator: firebase emulators:start --only functions"
echo "   2. Start your app: npm run dev (in root directory)"
echo "   3. Test setup in Profile Settings → WhatsApp"
echo ""
echo "🎥 Ready for demo recording!"

