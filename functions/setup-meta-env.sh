#!/bin/bash

# Setup Meta WhatsApp Tech Provider Environment Variables
# This script helps you set up your .env file with Meta credentials

echo "🔧 Meta WhatsApp Tech Provider Environment Setup"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    touch .env
fi

# Function to update or add env variable
update_env_var() {
    local key=$1
    local value=$2
    local file=".env"
    
    # Check if variable exists
    if grep -q "^${key}=" "$file"; then
        # Update existing variable
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
        else
            # Linux
            sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        fi
        echo "✅ Updated ${key}"
    else
        # Add new variable
        echo "${key}=${value}" >> "$file"
        echo "✅ Added ${key}"
    fi
}

# Get values from user or use defaults
echo "Please provide your Meta credentials:"
echo ""

read -p "META_APP_ID (default: 1902565950686087): " APP_ID
APP_ID=${APP_ID:-1902565950686087}

read -p "META_APP_SECRET: " APP_SECRET
if [ -z "$APP_SECRET" ]; then
    echo "⚠️  Warning: META_APP_SECRET is required!"
    exit 1
fi

read -p "META_SYSTEM_USER_TOKEN: " SYSTEM_TOKEN
if [ -z "$SYSTEM_TOKEN" ]; then
    echo "⚠️  Warning: META_SYSTEM_USER_TOKEN is required!"
    exit 1
fi

read -p "BASE_URL (default: http://localhost:5173): " BASE_URL
BASE_URL=${BASE_URL:-http://localhost:5173}

read -p "WHATSAPP_WEBHOOK_VERIFY_TOKEN (default: flyp_tech_provider_webhook_token): " VERIFY_TOKEN
VERIFY_TOKEN=${VERIFY_TOKEN:-flyp_tech_provider_webhook_token}

echo ""
echo "Updating .env file..."

# Add comment if not exists
if ! grep -q "# Meta WhatsApp Tech Provider Configuration" .env; then
    echo "" >> .env
    echo "# Meta WhatsApp Tech Provider Configuration" >> .env
fi

# Update or add variables
update_env_var "META_APP_ID" "$APP_ID"
update_env_var "META_APP_SECRET" "$APP_SECRET"
update_env_var "META_SYSTEM_USER_TOKEN" "$SYSTEM_TOKEN"
update_env_var "BASE_URL" "$BASE_URL"
update_env_var "WHATSAPP_WEBHOOK_VERIFY_TOKEN" "$VERIFY_TOKEN"

echo ""
echo "✅ Environment variables configured!"
echo ""
echo "Next steps:"
echo "1. Test locally: npm run serve"
echo "2. Deploy to production: firebase deploy --only functions"
echo ""

