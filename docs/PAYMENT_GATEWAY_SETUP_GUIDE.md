# Payment Gateway Setup Guide - How It Works

## Overview

There are **two approaches** to implementing payment gateways for your users:

### Approach 1: White-Label/Aggregator Model (Recommended) ✅
**FLYP has ONE master account, creates sub-merchant accounts for each user**

### Approach 2: Direct Account Model
**Each user creates their own Razorpay/Stripe account and provides API keys**

---

## Approach 1: White-Label Model (What We Built)

### How It Works

```
FLYP Master Account (Razorpay/Stripe)
    ↓
Creates Sub-Merchant Accounts for Each User
    ↓
User 1 → Sub-Merchant Account 1 → Receives payments → Settled to User 1's bank
User 2 → Sub-Merchant Account 2 → Receives payments → Settled to User 2's bank
User 3 → Sub-Merchant Account 3 → Receives payments → Settled to User 3's bank
```

### Setup Required

#### For Razorpay:

1. **Create ONE FLYP Business Account on Razorpay:**
   - Go to https://razorpay.com
   - Sign up as a business
   - Complete KYC verification
   - Get your `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

2. **Enable Razorpay Connect (for Sub-Merchants):**
   - Contact Razorpay support to enable Connect API
   - This allows you to create sub-merchant accounts
   - You'll need to explain your use case (marketplace/aggregator)

3. **Set Environment Variables:**
   ```bash
   firebase functions:config:set \
     razorpay.key_id="rzp_live_XXXXXXXXXX" \
     razorpay.key_secret="YOUR_SECRET_KEY" \
     default_payment_gateway="razorpay"
   ```

4. **How Sub-Merchants Work:**
   - When user fills onboarding form → Cloud Function creates sub-merchant account
   - Razorpay creates account with user's business details
   - Payments go to FLYP master account first
   - Razorpay automatically settles to user's bank account (based on their bank details)
   - FLYP can take a platform fee (optional)

#### For Stripe:

1. **Create ONE FLYP Business Account on Stripe:**
   - Go to https://stripe.com
   - Sign up as a business
   - Complete verification
   - Get your `STRIPE_SECRET_KEY`

2. **Enable Stripe Connect:**
   - Stripe Connect is enabled by default
   - You can create "Connected Accounts" for each user
   - Two models:
     - **Express**: User completes onboarding on Stripe's hosted page
     - **Standard**: You collect all info and create account via API

3. **Set Environment Variables:**
   ```bash
   firebase functions:config:set \
     stripe.secret_key="sk_live_XXXXXXXXXX" \
     default_payment_gateway="stripe"
   ```

### Advantages of White-Label Model:

✅ **Users don't need to create their own accounts**
✅ **Simpler user experience** - just fill form
✅ **FLYP controls the payment flow**
✅ **Can take platform fees** (optional)
✅ **Unified dashboard** for all transactions
✅ **Better compliance** - FLYP handles KYC/verification

### Disadvantages:

❌ **FLYP needs to complete KYC** with payment gateway
❌ **FLYP is responsible** for all transactions
❌ **May need special approval** from Razorpay/Stripe for Connect API
❌ **Settlement timing** depends on gateway policies

---

## Approach 2: Direct Account Model

### How It Works

```
User 1 → Creates own Razorpay account → Provides API keys → FLYP uses their keys
User 2 → Creates own Razorpay account → Provides API keys → FLYP uses their keys
User 3 → Creates own Stripe account → Provides API keys → FLYP uses their keys
```

### Setup Required

1. **Each user creates their own account:**
   - User goes to Razorpay.com or Stripe.com
   - Creates business account
   - Completes KYC
   - Gets API keys

2. **User provides API keys in FLYP:**
   - User enters API keys in Billing Settings
   - FLYP stores keys securely
   - FLYP uses user's keys to process payments

3. **Code Changes Needed:**
   - Update `BillingSettings.jsx` to show API key input fields
   - Update `createMerchantAccount.js` to validate user's API keys
   - Update `generatePaymentLink.js` to use user's API keys

### Advantages:

✅ **No FLYP KYC required**
✅ **Users control their own accounts**
✅ **FLYP not responsible** for user transactions
✅ **Easier to implement** (no Connect API needed)

### Disadvantages:

❌ **Users must create accounts themselves**
❌ **More complex user experience**
❌ **FLYP stores user API keys** (security concern)
❌ **No platform fees** (unless implemented separately)
❌ **Users can change keys** without FLYP knowing

---

## Recommended Approach: White-Label Model

### Why?

1. **Better User Experience**: Users just fill a form, no external signups
2. **Platform Control**: FLYP can manage all payments centrally
3. **Revenue Opportunity**: Can charge platform fees
4. **Unified Analytics**: All payment data in one place
5. **Compliance**: FLYP handles all KYC/verification

### Implementation Steps:

#### Step 1: Create FLYP Master Account

**Razorpay:**
1. Sign up at https://razorpay.com
2. Complete business verification
3. Enable "Connect" or "Route" API (contact support)
4. Get API keys

**Stripe:**
1. Sign up at https://stripe.com
2. Complete business verification
3. Connect is enabled by default
4. Get API keys

#### Step 2: Update Cloud Functions

The code is already set up for this! Just need to:

1. **Uncomment the actual API calls** in `createMerchantAccount.js`:
   ```javascript
   // Replace the simulated response with actual Razorpay API call
   const razorpayResponse = await axios.post(
     'https://api.razorpay.com/v1/accounts',
     { /* user's business details */ },
     { auth: { username: RAZORPAY_KEY_ID, password: RAZORPAY_KEY_SECRET } }
   );
   ```

2. **Set environment variables:**
   ```bash
   cd functions
   firebase functions:config:set \
     razorpay.key_id="rzp_live_XXXXX" \
     razorpay.key_secret="YOUR_SECRET" \
     default_payment_gateway="razorpay"
   ```

3. **Deploy functions:**
   ```bash
   firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink
   ```

#### Step 3: Test the Flow

1. User fills onboarding form
2. Cloud Function creates sub-merchant account
3. Razorpay/Stripe creates account with user's details
4. User receives merchant account ID
5. User can now generate payment links

---

## Current Code Status

### ✅ Already Implemented:
- Frontend onboarding form
- Cloud Function structure
- Error handling
- Payment link generation structure

### ⚠️ Needs Completion:
- **Uncomment actual Razorpay/Stripe API calls** in Cloud Functions
- **Set environment variables** with your API keys
- **Deploy Cloud Functions**
- **Test with real API** (start with test/sandbox mode)

---

## Next Steps

1. **Choose your approach:**
   - White-label (recommended) → Create FLYP master account
   - Direct accounts → Update UI to collect user API keys

2. **If White-Label:**
   - Create Razorpay/Stripe business account
   - Enable Connect API
   - Get API keys
   - Set environment variables
   - Uncomment API calls in Cloud Functions
   - Deploy and test

3. **If Direct Accounts:**
   - Update BillingSettings to show API key fields
   - Update Cloud Functions to use user's keys
   - Remove merchant onboarding (users provide keys directly)

---

## FAQ

**Q: Do I need to create accounts for each user manually?**
A: No! With white-label model, Cloud Function creates accounts automatically via API.

**Q: Can users see their Razorpay/Stripe dashboard?**
A: With white-label model, typically no. But you can provide them access if needed.

**Q: How do settlements work?**
A: With Razorpay Connect, payments are automatically settled to user's bank account. With Stripe Connect, you control settlements.

**Q: Can FLYP take a platform fee?**
A: Yes! With white-label model, you can configure platform fees (e.g., 2% of each transaction).

**Q: What if user's account gets suspended?**
A: FLYP receives notifications and can handle it. You may want to build an admin dashboard to monitor account statuses.

---

## Support

For Razorpay Connect setup:
- Contact: support@razorpay.com
- Documentation: https://razorpay.com/docs/razorpayx/connect/

For Stripe Connect setup:
- Documentation: https://stripe.com/docs/connect
- Support: https://support.stripe.com

