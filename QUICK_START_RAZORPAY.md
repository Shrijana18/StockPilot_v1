# Quick Start: Razorpay Integration

## Your Razorpay Details ✅

- **Key ID**: `rzp_test_RscD9DJN9gNgwR`
- **Secret**: `07JJaodymL793CLye7nyGGa1`
- **Business**: FLYP CORPORATION PRIVATE LIMITED
- **Status**: Test Mode (KYC pending for live mode)

## Step-by-Step Setup

### Step 1: Set Environment Variables (5 minutes)

**Option A: Using Firebase CLI (Recommended)**
```bash
cd functions
firebase functions:config:set \
  razorpay.key_id="rzp_test_RscD9DJN9gNgwR" \
  razorpay.key_secret="07JJaodymL793CLye7nyGGa1" \
  default_payment_gateway="razorpay"
```

**Option B: Using Firebase Console**
1. Go to https://console.firebase.google.com
2. Select your project → Functions → Configuration
3. Click "Add variable" and add:
   - `razorpay.key_id` = `rzp_test_RscD9DJN9gNgwR`
   - `razorpay.key_secret` = `07JJaodymL793CLye7nyGGa1`
   - `default_payment_gateway` = `razorpay`

### Step 2: Update Cloud Function Code (Already Done! ✅)

The code has been updated to use actual Razorpay API calls. The function will now:
- Call Razorpay Connect API
- Create real sub-merchant accounts
- Return actual account IDs and status

### Step 3: Install Razorpay SDK (if not already installed)

```bash
cd functions
npm install razorpay
```

### Step 4: Enable Razorpay Connect API ⚠️ IMPORTANT

**You need to contact Razorpay to enable Connect API:**

1. **Email Razorpay Support:**
   - To: support@razorpay.com
   - Subject: "Enable Connect API for Marketplace Platform"
   - Message:
     ```
     Hi Razorpay Team,
     
     We have a Razorpay account:
     - Business Name: FLYP CORPORATION PRIVATE LIMITED
     - Business ID: RsbmJOf8TM8JNR
     - Email: admin@flypnow.com
     
     We're building a marketplace/platform and need to enable 
     Razorpay Connect API to create sub-merchant accounts for 
     our users automatically.
     
     Please enable Connect API access for our account.
     
     Thank you!
     ```

2. **Alternative:** Check if already available:
   - Go to Razorpay Dashboard → Settings → Developer Controls
   - Look for "Connect" or "Sub-merchants" section
   - If you see it, Connect API might already be enabled

### Step 5: Deploy Cloud Functions

```bash
cd functions
firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink
```

### Step 6: Test the Integration

1. **Open your app** and go to Billing Settings
2. **Click "Setup Payment Gateway"**
3. **Fill out the onboarding form:**
   - Business Info (GSTIN, PAN, etc.)
   - Contact Info (email, phone, address)
   - Bank Details (account number, IFSC, etc.)
4. **Submit the form**
5. **Check results:**
   - Should see success message
   - Check Razorpay Dashboard → Accounts (if Connect is enabled)
   - Check Firebase Console → Functions → Logs for any errors

## Troubleshooting

### Error: "Connect API not enabled"

**Solution:**
- Contact Razorpay support (see Step 4)
- Wait for their response (usually 1-2 business days)
- Once enabled, try again

### Error: "Invalid API key"

**Solution:**
- Verify keys are correct (no extra spaces)
- Make sure environment variables are set correctly
- Check Firebase Console → Functions → Configuration

### Error: "Account creation failed"

**Possible causes:**
- Missing required fields
- Invalid GSTIN format (must be 15 characters)
- Invalid PAN format (must be 10 characters)
- Invalid IFSC format (must be 11 characters)

**Solution:**
- Check all fields are filled correctly
- Verify formats match requirements
- Check Cloud Function logs for specific error

## Testing Checklist

- [ ] Environment variables set in Firebase
- [ ] Razorpay SDK installed (`npm install razorpay`)
- [ ] Cloud Functions deployed
- [ ] Connect API enabled (contact support)
- [ ] Test merchant account creation
- [ ] Verify account in Razorpay Dashboard

## Next Steps After Testing

1. **Complete KYC** for live mode:
   - Go to Razorpay Dashboard → Settings → Business Profile
   - Click "Submit application"
   - Upload required documents

2. **Get Live API Keys:**
   - After KYC approval
   - Go to Settings → Developer Controls
   - Generate live keys (starts with `rzp_live_`)
   - Update environment variables

3. **Switch to Live Mode:**
   ```bash
   firebase functions:config:set \
     razorpay.key_id="rzp_live_XXXXX" \
     razorpay.key_secret="YOUR_LIVE_SECRET"
   ```

## Important Notes

⚠️ **Test Mode:**
- Test keys work for testing only
- No real money is processed
- Use test bank accounts for testing

⚠️ **Connect API:**
- Must be enabled by Razorpay support
- Usually takes 1-2 business days
- Required for creating sub-merchant accounts

⚠️ **KYC:**
- Required for live mode
- Can take 24-48 hours after submission
- Test mode works without KYC

## Support

- **Razorpay Support**: support@razorpay.com
- **Razorpay Docs**: https://razorpay.com/docs/razorpayx/connect/
- **Dashboard**: https://dashboard.razorpay.com

## Quick Commands Reference

```bash
# Set environment variables
firebase functions:config:set razorpay.key_id="rzp_test_XXX" razorpay.key_secret="SECRET"

# Install dependencies
cd functions && npm install razorpay

# Deploy functions
firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink

# View logs
firebase functions:log --only createMerchantAccount

# Check environment variables
firebase functions:config:get
```

