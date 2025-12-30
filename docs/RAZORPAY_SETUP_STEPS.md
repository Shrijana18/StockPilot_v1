# Razorpay Setup - Next Steps

## Your Current Status ✅

- ✅ Razorpay account created: **FLYP CORPORATION PRIVATE LIMITED**
- ✅ Test API Keys obtained:
  - Key ID: `rzp_test_RscD9DJN9gNgwR`
  - Secret: `07JJaodymL793CLye7nyGGa1`
- ⚠️ KYC not completed (needed for live mode, but test mode works for now)

## Next Steps

### Step 1: Set Environment Variables in Firebase

Set your Razorpay test keys in Firebase Functions:

```bash
cd functions
firebase functions:config:set \
  razorpay.key_id="rzp_test_RscD9DJN9gNgwR" \
  razorpay.key_secret="07JJaodymL793CLye7nyGGa1" \
  default_payment_gateway="razorpay"
```

**Or use Firebase Console:**
1. Go to Firebase Console → Functions → Configuration
2. Add environment variables:
   - `razorpay.key_id` = `rzp_test_RscD9DJN9gNgwR`
   - `razorpay.key_secret` = `07JJaodymL793CLye7nyGGa1`
   - `default_payment_gateway` = `razorpay`

### Step 2: Enable Razorpay Connect API

**Important:** You need to contact Razorpay to enable Connect API for creating sub-merchant accounts.

1. **Contact Razorpay Support:**
   - Email: support@razorpay.com
   - Subject: "Enable Connect API for Marketplace/Platform"
   - Message: 
     ```
     Hi,
     
     We have a Razorpay account: FLYP CORPORATION PRIVATE LIMITED
     Business ID: RsbmJOf8TM8JNR
     
     We're building a marketplace/platform and need to enable 
     Razorpay Connect API to create sub-merchant accounts for 
     our users automatically.
     
     Please enable Connect API access for our account.
     
     Thanks!
     ```

2. **Alternative:** Check if Connect is already available:
   - Go to Razorpay Dashboard → Settings → Developer Controls
   - Look for "Connect" or "Sub-merchants" section
   - If available, you can use it directly

### Step 3: Uncomment Razorpay API Calls

Update `functions/payment/createMerchantAccount.js` to use actual Razorpay API:

**Current code (simulated):**
```javascript
// For demo, return simulated response
const merchantId = `merchant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
return {
  merchantId,
  status: "pending",
  gateway: "razorpay",
};
```

**Replace with actual API call:**
```javascript
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// Create sub-merchant account using Razorpay Connect
const account = await razorpay.accounts.create({
  email: data.contactInfo.email,
  phone: data.contactInfo.phone,
  legal_business_name: data.businessInfo.businessName,
  business_type: data.businessInfo.businessType,
  customer_facing_business_name: data.businessInfo.businessName,
  business_model: data.businessInfo.businessCategory,
  profile: {
    category: data.businessInfo.businessCategory,
    subcategory: "general",
    addresses: {
      registered: {
        street1: data.contactInfo.address,
        city: data.contactInfo.city,
        state: data.contactInfo.state,
        postal_code: data.contactInfo.pincode,
        country: "IN"
      }
    },
    business_model: data.businessInfo.businessCategory
  },
  legal_info: {
    pan: data.businessInfo.pan,
    gst: data.businessInfo.gstin
  },
  bank_account: {
    ifsc: data.bankInfo.ifsc,
    name: data.bankInfo.accountHolderName,
    account_number: data.bankInfo.accountNumber
  }
});

return {
  merchantId: account.id,
  status: account.status || "pending",
  gateway: "razorpay",
  accountId: account.id,
  accountStatus: account.status
};
```

### Step 4: Install Razorpay SDK

Make sure Razorpay SDK is installed:

```bash
cd functions
npm install razorpay
```

### Step 5: Deploy Cloud Functions

Deploy the updated functions:

```bash
firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink
```

### Step 6: Test the Flow

1. **Test with Test Mode:**
   - Use your test API keys (already set)
   - Fill out the onboarding form in your app
   - Submit and verify sub-merchant account is created
   - Check Razorpay Dashboard → Accounts to see created accounts

2. **Verify in Razorpay Dashboard:**
   - Go to Razorpay Dashboard
   - Look for "Accounts" or "Sub-merchants" section
   - You should see the created sub-merchant accounts

### Step 7: Complete KYC for Live Mode (Later)

When ready for production:

1. **Complete Razorpay KYC:**
   - Go to Razorpay Dashboard → Settings → Business Profile
   - Click "Submit application"
   - Complete all required documents:
     - Business PAN
     - Business GSTIN
     - Bank account details
     - Address proof
     - Business registration documents

2. **Get Live API Keys:**
   - After KYC approval, go to Settings → Developer Controls
   - Generate live API keys (starts with `rzp_live_`)
   - Update environment variables with live keys

3. **Switch to Live Mode:**
   ```bash
   firebase functions:config:set \
     razorpay.key_id="rzp_live_XXXXX" \
     razorpay.key_secret="YOUR_LIVE_SECRET"
   ```

## Testing Checklist

- [ ] Environment variables set in Firebase
- [ ] Razorpay SDK installed (`npm install razorpay`)
- [ ] API calls uncommented in `createMerchantAccount.js`
- [ ] Connect API enabled (contact support if needed)
- [ ] Cloud Functions deployed
- [ ] Test merchant account creation works
- [ ] Verify account appears in Razorpay Dashboard

## Troubleshooting

### Error: "Connect API not enabled"
**Solution:** Contact Razorpay support to enable Connect API

### Error: "Invalid API key"
**Solution:** 
- Verify keys are correct (no extra spaces)
- Make sure you're using test keys for test mode
- Check environment variables are set correctly

### Error: "Account creation failed"
**Solution:**
- Check all required fields are provided
- Verify GSTIN format (15 characters)
- Verify PAN format (10 characters)
- Check IFSC code format (11 characters)

## Next Steps After Testing

1. **Complete KYC** to get live keys
2. **Switch to live mode** for production
3. **Set up webhooks** for payment notifications
4. **Monitor account statuses** in dashboard
5. **Handle account rejections** (if any)

## Support

- Razorpay Support: support@razorpay.com
- Razorpay Docs: https://razorpay.com/docs/razorpayx/connect/
- Dashboard: https://dashboard.razorpay.com

