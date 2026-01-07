# AI Inventory Generator Setup Guide

## Problem
The AI inventory generator was throwing errors because `OPENAI_API_KEY` was not configured as a Firebase secret.

## Solution
Updated the `generateInventoryByBrand` function to properly use Firebase Functions v2 secrets and created a setup script.

## Steps to Fix

### 1. Set OpenAI API Key as Firebase Secret

You have two options:

#### Option A: Use the Setup Script (Recommended)
```bash
cd functions
./set-openai-secret.sh
```

The script will:
- Check for `OPENAI_API_KEY` in your `.env` file
- Prompt you to enter it if not found
- Set it as a Firebase secret

#### Option B: Set Manually
```bash
# Replace YOUR_OPENAI_API_KEY with your actual API key
echo "YOUR_OPENAI_API_KEY" | firebase functions:secrets:set OPENAI_API_KEY
```

**Get your OpenAI API Key:**
- Visit: https://platform.openai.com/api-keys
- Create a new API key if you don't have one
- Copy the key (it starts with `sk-`)

### 2. Verify Secret is Set
```bash
firebase functions:secrets:access OPENAI_API_KEY
```

### 3. Deploy the Updated Function
```bash
# Deploy only the inventory function
firebase deploy --only functions:generateInventoryByBrand

# Or deploy all functions
firebase deploy --only functions
```

### 4. Test the Function
1. Go to your distributor dashboard
2. Navigate to "Add Inventory" → "AI Autogen" tab
3. Fill in the form:
   - Brand Name
   - Product Category
   - Product Types (optional)
   - Quantity (10, 20, 30, or 50)
4. Click "Magic Generate"
5. The AI should now generate inventory items

### 5. Check Logs (if issues persist)
```bash
firebase functions:log --only generateInventoryByBrand
```

## What Was Changed

1. **Updated `functions/inventory/generateInventoryByBrand.js`:**
   - Added `defineSecret` import from `firebase-functions/params`
   - Declared `OPENAI_API_KEY_SECRET` using `defineSecret("OPENAI_API_KEY")`
   - Added `secrets: [OPENAI_API_KEY_SECRET]` to function configuration
   - Updated error message to guide users to set the secret

2. **Created `functions/set-openai-secret.sh`:**
   - Script to easily set the OpenAI API key as a Firebase secret
   - Checks `.env` file first, then prompts for input if needed
   - Validates the input before setting

## Troubleshooting

### Error: "OpenAI API key not configured"
- **Solution:** Make sure you've set the secret using the script or manually
- **Verify:** Run `firebase functions:secrets:access OPENAI_API_KEY`

### Error: "No inventory returned"
- **Possible causes:**
  - Invalid API key
  - API rate limits exceeded
  - Network issues
- **Check logs:** `firebase functions:log --only generateInventoryByBrand`

### Function not updating after deployment
- Make sure you've set the secret BEFORE deploying
- Redeploy: `firebase deploy --only functions:generateInventoryByBrand`

## Notes

- The OpenAI API key is stored securely as a Firebase secret
- For local development, you can still use `.env` file
- The function uses `gpt-4o-mini` model by default (configurable via `OPENAI_MODEL` env var)
- The function supports generating 6-50 products per request

