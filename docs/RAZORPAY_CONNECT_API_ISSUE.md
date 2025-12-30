# Razorpay Connect API - Test Mode Limitation

## Issue: Authentication Failed

The error "Razorpay API Error: Authentication failed" when creating merchant accounts is likely due to **Razorpay Connect API limitations**.

## Root Cause

**Razorpay Connect API (for creating sub-merchant accounts) has the following limitations:**

1. **Test Mode Limitation**: 
   - Connect API may **not be fully available** in test mode
   - Test API keys (`rzp_test_*`) might not have Connect API permissions
   - You may need **live mode API keys** to use Connect API

2. **Connect API Enablement**:
   - Connect API is a **premium feature** that requires:
     - Approval from Razorpay support
     - Business verification
     - Live mode account activation
   - It's not automatically enabled for all accounts

## Solutions

### Option 1: Enable Connect API (Recommended for Production)

1. **Contact Razorpay Support**:
   - Email: support@razorpay.com
   - Request: "Enable Razorpay Connect API for my account"
   - Provide: Your business details and use case

2. **Switch to Live Mode**:
   - Get live API keys from Razorpay Dashboard
   - Update `.env` file:
     ```bash
     RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
     RAZORPAY_KEY_SECRET=your_live_secret
     ```
   - Redeploy functions:
     ```bash
     firebase deploy --only functions:createMerchantAccount
     ```

### Option 2: Use Test Mode with Simulated Accounts (For Development)

If you want to test the flow without Connect API, you can temporarily simulate account creation:

1. **Modify the function** to return a mock account ID in test mode
2. **Use this only for development/testing**
3. **Switch to real Connect API for production**

### Option 3: Use Razorpay Payment Links (Alternative)

Instead of creating sub-merchant accounts, you can:
- Use Razorpay Payment Links API (works in test mode)
- Generate payment links directly
- Collect payments to your main Razorpay account
- Handle settlements manually or via Razorpay dashboard

## Current Status

✅ **Code is Fixed**: 
- Using Razorpay SDK (proper method)
- Better error handling
- Clear error messages

❌ **API Access Issue**:
- Test keys may not support Connect API
- Need live keys or Razorpay support approval

## Next Steps

1. **For Development/Testing**:
   - Contact Razorpay support to enable Connect API in test mode
   - OR use mock/simulated accounts for testing

2. **For Production**:
   - Get live API keys
   - Enable Connect API
   - Update environment variables
   - Redeploy functions

## Error Messages Explained

- **"Authentication failed"**: API keys are invalid OR Connect API not enabled
- **"Access Denied"**: Connect API not enabled for your account
- **"Validation Error"**: Missing or invalid business/bank details

## Verification

To verify if Connect API is enabled:
1. Check Razorpay Dashboard → Settings → API Keys
2. Look for "Connect API" section
3. Contact support if not visible

## References

- [Razorpay Connect Documentation](https://razorpay.com/docs/connect/)
- [Razorpay Support](https://razorpay.com/support/)





