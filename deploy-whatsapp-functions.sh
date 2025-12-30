#!/bin/bash

# Deploy WhatsApp Functions with Secrets Setup
# This script helps deploy the updated WhatsApp OAuth functions

echo "🚀 Deploying WhatsApp Functions"
echo "================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run:"
    echo "   firebase login"
    exit 1
fi

# Set project
echo "📋 Using project: stockpilotv1"
firebase use stockpilotv1

# Check if secrets are set
echo ""
echo "🔍 Checking for required secrets..."
META_APP_ID_SET=$(firebase functions:secrets:list 2>&1 | grep -q "META_APP_ID" && echo "yes" || echo "no")
META_APP_SECRET_SET=$(firebase functions:secrets:list 2>&1 | grep -q "META_APP_SECRET" && echo "yes" || echo "no")
BASE_URL_SET=$(firebase functions:secrets:list 2>&1 | grep -q "BASE_URL" && echo "yes" || echo "no")

if [ "$META_APP_ID_SET" = "no" ] || [ "$META_APP_SECRET_SET" = "no" ]; then
    echo ""
    echo "⚠️  Required secrets not found!"
    echo ""
    echo "📝 You need to set the following secrets:"
    echo "   1. META_APP_ID - Your Meta App ID"
    echo "   2. META_APP_SECRET - Your Meta App Secret"
    echo "   3. BASE_URL (optional) - Your app URL (default: https://stockpilotv1.web.app)"
    echo ""
    read -p "Do you want to set them now? (y/n): " set_secrets
    
    if [ "$set_secrets" = "y" ]; then
        # Set META_APP_ID
        if [ "$META_APP_ID_SET" = "no" ]; then
            read -p "Enter META_APP_ID: " app_id
            echo "$app_id" | firebase functions:secrets:set META_APP_ID
            echo "✅ META_APP_ID set"
        fi
        
        # Set META_APP_SECRET
        if [ "$META_APP_SECRET_SET" = "no" ]; then
            read -p "Enter META_APP_SECRET: " app_secret
            echo "$app_secret" | firebase functions:secrets:set META_APP_SECRET
            echo "✅ META_APP_SECRET set"
        fi
        
        # Set BASE_URL (optional)
        if [ "$BASE_URL_SET" = "no" ]; then
            read -p "Enter BASE_URL (or press Enter for default): " base_url
            base_url=${base_url:-https://stockpilotv1.web.app}
            echo "$base_url" | firebase functions:secrets:set BASE_URL
            echo "✅ BASE_URL set to $base_url"
        fi
    else
        echo ""
        echo "⚠️  You can set secrets manually later using:"
        echo "   echo 'your-value' | firebase functions:secrets:set SECRET_NAME"
        echo ""
        echo "Or deploy without secrets (will use .env for local, process.env for production):"
        read -p "Continue deployment anyway? (y/n): " continue_deploy
        if [ "$continue_deploy" != "y" ]; then
            echo "Deployment cancelled."
            exit 0
        fi
    fi
else
    echo "✅ All required secrets are set"
fi

# Deploy functions
echo ""
echo "🚀 Deploying WhatsApp functions..."
echo ""

cd functions
firebase deploy --only functions:whatsappConnectStart,functions:whatsappConnectCallback

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Test the OAuth flow by clicking 'Connect WhatsApp API' in your app"
    echo "   2. Check function logs: firebase functions:log --only whatsappConnectStart,whatsappConnectCallback"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi

