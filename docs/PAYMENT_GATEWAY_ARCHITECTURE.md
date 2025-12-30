# Payment Gateway Architecture - How It Works

## Quick Answer

**Yes, you need to create ONE FLYP business account with Razorpay/Stripe.**

Then, using their **Connect API**, FLYP automatically creates sub-merchant accounts for each user. Users don't need to create their own accounts!

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FLYP Platform                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  FLYP Master Account (Razorpay/Stripe)              │   │
│  │  - One business account                              │   │
│  │  - API Keys: rzp_live_XXXXX / sk_live_XXXXX         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          │ Creates Sub-Merchants             │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User 1: Sub-Merchant Account                         │   │
│  │  - Account ID: acc_XXXXXXXXX                          │   │
│  │  - Bank: User 1's Bank Account                        │   │
│  │  - Settlements → User 1's Bank                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User 2: Sub-Merchant Account                         │   │
│  │  - Account ID: acc_YYYYYYYYY                          │   │
│  │  - Bank: User 2's Bank Account                        │   │
│  │  - Settlements → User 2's Bank                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User 3: Sub-Merchant Account                         │   │
│  │  - Account ID: acc_ZZZZZZZZZ                          │   │
│  │  - Bank: User 3's Bank Account                        │   │
│  │  - Settlements → User 3's Bank                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## How It Works Step-by-Step

### Step 1: FLYP Sets Up Master Account

1. **Create FLYP Business Account:**
   - Go to https://razorpay.com (or stripe.com)
   - Sign up as "FLYP" business
   - Complete KYC verification
   - Get API keys:
     - Razorpay: `rzp_live_XXXXX` and `secret_key`
     - Stripe: `sk_live_XXXXX`

2. **Enable Connect API:**
   - **Razorpay**: Contact support to enable "Connect" or "Route" API
   - **Stripe**: Connect is enabled by default

3. **Set Environment Variables:**
   ```bash
   firebase functions:config:set \
     razorpay.key_id="rzp_live_XXXXX" \
     razorpay.key_secret="YOUR_SECRET" \
     default_payment_gateway="razorpay"
   ```

### Step 2: User Fills Onboarding Form

When a user clicks "Setup Payment Gateway":
1. User fills business info (GSTIN, PAN, etc.)
2. User fills contact info (email, phone, address)
3. User fills bank account details

### Step 3: Cloud Function Creates Sub-Merchant

When user submits the form:

```javascript
// Cloud Function calls Razorpay API
POST https://api.razorpay.com/v1/accounts
{
  email: "user@example.com",
  legal_business_name: "User's Business",
  bank_account: {
    account_number: "1234567890",
    ifsc: "BANK0001234",
    name: "User Name"
  },
  // ... other details
}

// Razorpay responds:
{
  id: "acc_XXXXXXXXX",  // Sub-merchant account ID
  status: "pending"      // Will be "active" after verification
}
```

### Step 4: Sub-Merchant Account Created

- Razorpay/Stripe creates a sub-merchant account
- Account is linked to user's bank details
- Account ID is stored in Firestore
- User can now generate payment links

### Step 5: Payment Flow

```
Customer pays ₹1000
    ↓
Payment goes to FLYP Master Account
    ↓
Razorpay/Stripe processes payment
    ↓
₹1000 automatically settled to User's Bank Account
    ↓
(Optional: FLYP can deduct platform fee, e.g., ₹20)
    ↓
User receives ₹980 (or ₹1000 if no fee)
```

---

## What You Need to Do

### 1. Create FLYP Master Account

**For Razorpay:**
1. Sign up at https://razorpay.com
2. Choose "Business" account type
3. Complete business verification:
   - Business PAN
   - Business GSTIN
   - Bank account details
   - Business address proof
4. Get API keys from Dashboard → Settings → API Keys
5. **Important**: Contact Razorpay support to enable "Connect API"
   - Email: support@razorpay.com
   - Explain: "We're building a marketplace/platform and need to create sub-merchant accounts for our users"

**For Stripe:**
1. Sign up at https://stripe.com
2. Complete business verification
3. Get API keys from Dashboard → Developers → API keys
4. Connect is enabled by default (no need to contact support)

### 2. Update Cloud Functions

The code structure is ready! You just need to:

1. **Uncomment the actual API calls** in `functions/payment/createMerchantAccount.js`:
   - Lines 40-84: Uncomment Razorpay API call
   - Lines 111-143: Uncomment Stripe API call

2. **Set environment variables:**
   ```bash
   cd functions
   firebase functions:config:set \
     razorpay.key_id="rzp_live_XXXXX" \
     razorpay.key_secret="YOUR_SECRET_KEY"
   ```

3. **Deploy functions:**
   ```bash
   firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink
   ```

### 3. Test the Flow

1. Use Razorpay **test mode** first:
   - Get test keys: `rzp_test_XXXXX`
   - Test with test bank accounts
   - Verify sub-merchant creation works

2. Switch to **live mode** after testing:
   - Use live keys: `rzp_live_XXXXX`
   - Real payments will be processed

---

## Key Points

### ✅ What FLYP Needs:
- **ONE master account** with Razorpay/Stripe
- API keys from that account
- Connect API enabled (for Razorpay)

### ✅ What Users Get:
- **Automatic sub-merchant account** created via API
- **No need to sign up** with Razorpay/Stripe
- **Direct settlements** to their bank account
- **Payment links** generated automatically

### ✅ How Settlements Work:
- Customer pays → Payment goes to FLYP master account
- Razorpay/Stripe automatically settles to user's bank (based on their bank details)
- FLYP can optionally take a platform fee

### ✅ Account Status:
- **Pending**: Account created, awaiting verification (24-48 hours)
- **Active**: Account verified, ready to accept payments
- **Suspended**: Account temporarily suspended (rare)

---

## Platform Fees (Optional)

If you want to charge a platform fee (e.g., 2% per transaction):

**Razorpay Route API:**
```javascript
// When creating payment link, specify route
{
  amount: 100000, // ₹1000 in paise
  transfers: [
    {
      account: userMerchantAccountId,
      amount: 98000, // ₹980 to user
      currency: 'INR'
    },
    {
      account: flypMerchantAccountId,
      amount: 2000, // ₹20 platform fee
      currency: 'INR'
    }
  ]
}
```

**Stripe Connect:**
```javascript
// Set application fee
{
  amount: 100000,
  application_fee_amount: 2000, // ₹20 platform fee
  on_behalf_of: userMerchantAccountId
}
```

---

## Current Code Status

### ✅ Ready:
- Frontend onboarding form
- Cloud Function structure
- Error handling
- Payment link generation structure

### ⚠️ Needs Action:
1. **Create FLYP master account** with Razorpay/Stripe
2. **Get API keys** from your account
3. **Enable Connect API** (for Razorpay - contact support)
4. **Uncomment API calls** in Cloud Functions
5. **Set environment variables**
6. **Deploy and test**

---

## Next Steps

1. **Create FLYP Razorpay Account:**
   - Sign up at razorpay.com
   - Complete business verification
   - Get API keys
   - Contact support for Connect API

2. **Update Code:**
   - Uncomment Razorpay API calls in `createMerchantAccount.js`
   - Set environment variables
   - Deploy functions

3. **Test:**
   - Use test mode first
   - Create a test sub-merchant account
   - Generate a test payment link
   - Verify it works

4. **Go Live:**
   - Switch to live API keys
   - Start onboarding real users

---

## Support Contacts

**Razorpay:**
- Support: support@razorpay.com
- Connect API Docs: https://razorpay.com/docs/razorpayx/connect/
- Phone: 1800-123-1234

**Stripe:**
- Support: https://support.stripe.com
- Connect Docs: https://stripe.com/docs/connect
- Dashboard: https://dashboard.stripe.com

---

## FAQ

**Q: Do I need separate accounts for each user?**
A: No! One FLYP master account creates sub-merchants for all users automatically.

**Q: Can users see their Razorpay dashboard?**
A: Typically no with Connect API. But you can provide them access if needed.

**Q: How long does account verification take?**
A: Usually 24-48 hours for Razorpay, instant for Stripe (if info is complete).

**Q: What if a user's account gets rejected?**
A: You'll receive a webhook notification. You can notify the user and ask them to update their information.

**Q: Can I test without a real account?**
A: Yes! Use Razorpay/Stripe test mode with test API keys first.

