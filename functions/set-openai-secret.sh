#!/bin/bash

# Script to set Firebase Secret for OpenAI API Key
# This will set OPENAI_API_KEY as a Firebase secret

echo "🔐 Setting Firebase Secret for OpenAI API Key"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    echo "Please run this script from the functions/ directory"
    exit 1
fi

# Try to get value from .env
OPENAI_API_KEY=$(grep "^OPENAI_API_KEY=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")

# Check if value is a placeholder or empty
if [[ "$OPENAI_API_KEY" == *"your_api_key"* ]] || [[ "$OPENAI_API_KEY" == "" ]]; then
    echo "⚠️  OPENAI_API_KEY in .env appears to be a placeholder or is missing"
    echo "Please enter your OpenAI API Key:"
    read -sp "OPENAI_API_KEY: " OPENAI_API_KEY
    echo ""
fi

# Validate value
if [ -z "$OPENAI_API_KEY" ] || [[ "$OPENAI_API_KEY" == "your_api_key_here" ]]; then
    echo "❌ Error: OPENAI_API_KEY is required!"
    echo ""
    echo "You can get your API key from: https://platform.openai.com/api-keys"
    exit 1
fi

echo ""
echo "📝 Setting Firebase Secret..."
echo ""

# Set OPENAI_API_KEY
echo "Setting OPENAI_API_KEY..."
echo "$OPENAI_API_KEY" | firebase functions:secrets:set OPENAI_API_KEY
if [ $? -eq 0 ]; then
    echo "✅ OPENAI_API_KEY set successfully!"
else
    echo "❌ Failed to set OPENAI_API_KEY"
    exit 1
fi

echo ""
echo "✅ Firebase Secret set successfully!"
echo ""
echo "Next steps:"
echo "1. Redeploy the function: firebase deploy --only functions:generateInventoryByBrand"
echo "2. Test the AI inventory generator in your app"
echo "3. Check Firebase logs if needed: firebase functions:log --only generateInventoryByBrand"
echo ""

