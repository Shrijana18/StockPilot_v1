# White-Label Payment Gateway System

## Overview

This system allows users to accept card payments **without creating their own accounts** with payment gateway providers (Razorpay, Stripe, etc.). The platform handles all merchant account creation and payment processing on behalf of users.

## How It Works

### User Flow

1. **User enables Card Payment Gateway** in Billing Settings
2. **Clicks "Setup Payment Gateway"** button
3. **Fills out onboarding form** with:
   - Business information (Name, Type, Category, GSTIN, PAN)
   - Contact information (Email, Phone, Address)
   - Bank account details (for settlements)
4. **System automatically creates merchant account** with payment gateway provider
5. **User receives payment gateway** ready to accept card payments

### Technical Flow

```
User → Onboarding Form → Firebase Cloud Function → Payment Gateway API → Merchant Account Created
                                                      ↓
                                              Firestore (Store Merchant Info)
                                                      ↓
                                              User can generate payment links
```

## Architecture

### Components

1. **MerchantOnboarding Component** (`src/components/payment/MerchantOnboarding.jsx`)
   - Multi-step form to collect business information
   - Validates all required fields
   - Calls Cloud Function to create merchant account

2. **Cloud Functions**
   - `createMerchantAccount`: Creates merchant account with payment gateway
   - `generatePaymentLink`: Generates payment links for invoices

3. **Payment Link Service** (`src/utils/paymentLinkService.js`)
   - Frontend service to generate payment links
   - Checks payment gateway availability
   - Handles payment link generation

4. **Updated BillingSettings** (`src/components/billing/BillingSettings.jsx`)
   - Shows onboarding button if no merchant account exists
   - Shows status if merchant account is active
   - Integrated with MerchantOnboarding component

## Setup Instructions

### 1. Environment Variables

Add to `functions/.env` or Firebase Functions config:

```bash
# Razorpay (for India)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
DEFAULT_PAYMENT_GATEWAY=razorpay

# Stripe (alternative)
STRIPE_SECRET_KEY=your_stripe_secret_key

# App URL (for payment callbacks)
APP_URL=https://your-app.com
```

### 2. Install Dependencies

```bash
cd functions
npm install razorpay  # For Razorpay integration
# OR
npm install stripe    # For Stripe integration
```

### 3. Deploy Cloud Functions

```bash
firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink
```

### 4. Firestore Security Rules

Update `firestore.rules` to allow merchant account creation:

```javascript
match /businesses/{businessId}/preferences/billing {
  allow read, write: if request.auth != null && request.auth.uid == businessId;
}

match /merchantAccounts/{merchantId} {
  allow read: if request.auth != null && request.auth.uid == merchantId;
  allow write: if false; // Only Cloud Functions can write
}
```

## Payment Gateway Integration

### Razorpay Integration

Razorpay supports sub-merchant accounts through their **Connect API** or **Route API**.

#### Option 1: Razorpay Connect (Recommended)

```javascript
// In createMerchantAccount.js
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create sub-merchant account
const account = await razorpay.accounts.create({
  email: contactInfo.email,
  phone: contactInfo.phone,
  legal_business_name: businessInfo.businessName,
  business_type: businessInfo.businessType,
  profile: {
    category: businessInfo.businessCategory,
    addresses: {
      registered: {
        street1: contactInfo.address,
        city: contactInfo.city,
        state: contactInfo.state,
        postal_code: contactInfo.pincode,
        country: "IN"
      }
    }
  },
  legal_info: {
    pan: businessInfo.pan,
    gst: businessInfo.gstin
  },
  bank_account: {
    ifsc: bankInfo.ifsc,
    name: bankInfo.accountHolderName,
    account_number: bankInfo.accountNumber
  }
});
```

#### Option 2: Razorpay Route API

For simpler implementation, use Route API to transfer funds to user's bank account:

```javascript
// Generate payment link with route
const paymentLink = await razorpay.paymentLinks.create({
  amount: amount * 100,
  currency: 'INR',
  description: `Payment for Invoice ${invoiceId}`,
  transfer_all: true, // Transfer all to user's account
  transfers: [{
    account: merchantAccountId,
    amount: amount * 100,
    currency: 'INR',
  }]
});
```

### Stripe Integration

Stripe uses **Connect** for sub-merchant accounts:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create connected account
const account = await stripe.accounts.create({
  type: 'express',
  country: 'IN',
  email: contactInfo.email,
  business_type: businessInfo.businessType === 'sole_proprietorship' ? 'individual' : 'company',
  company: {
    name: businessInfo.businessName,
    tax_id: businessInfo.pan,
  },
  external_account: {
    object: 'bank_account',
    country: 'IN',
    currency: 'inr',
    account_number: bankInfo.accountNumber,
    routing_number: bankInfo.ifsc,
    account_holder_name: bankInfo.accountHolderName,
  },
});
```

## Payment Link Generation

### Frontend Usage

```javascript
import { generatePaymentLink } from '../utils/paymentLinkService';

const result = await generatePaymentLink(
  invoiceId,
  amount,
  {
    name: customer.name,
    email: customer.email,
    phone: customer.phone
  }
);

if (result.success) {
  // Use result.paymentLink
  window.open(result.paymentLink);
}
```

### Backend (Cloud Function)

The `generatePaymentLink` Cloud Function:
1. Verifies user authentication
2. Checks merchant account status
3. Generates payment link via gateway API
4. Stores payment link in invoice document
5. Returns payment link to frontend

## Merchant Account Status

Merchant accounts can have the following statuses:

- **pending**: Account created, awaiting verification (24-48 hours)
- **active**: Account verified and ready to accept payments
- **suspended**: Account temporarily suspended
- **rejected**: Account creation rejected

## Webhook Handling (Future Enhancement)

To automatically update invoice status when payment is received:

1. **Set up webhook endpoint** in Cloud Functions
2. **Configure webhook URL** in Razorpay/Stripe dashboard
3. **Handle payment events**:
   - `payment.captured` → Mark invoice as paid
   - `payment.failed` → Notify user
   - `payment.refunded` → Update invoice status

Example webhook handler:

```javascript
// functions/payment/handlePaymentWebhook.js
exports.handlePaymentWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const payload = req.body;
  
  // Verify webhook signature
  const isValid = razorpay.validateWebhookSignature(
    JSON.stringify(payload),
    signature,
    process.env.RAZORPAY_WEBHOOK_SECRET
  );
  
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }
  
  // Handle payment event
  if (payload.event === 'payment.captured') {
    const payment = payload.payload.payment.entity;
    const invoiceId = payment.notes.invoice_id;
    
    // Update invoice status in Firestore
    await admin.firestore()
      .doc(`businesses/${payment.notes.user_id}/invoices/${invoiceId}`)
      .update({
        isPaid: true,
        paidOn: admin.firestore.FieldValue.serverTimestamp(),
        'payment.status': 'Paid',
        'payment.transactionId': payment.id,
      });
  }
  
  res.status(200).send('OK');
});
```

## Security Considerations

1. **Never store full bank account numbers** in Firestore
   - Store only last 4 digits for display
   - Full account numbers only in secure backend

2. **Validate all inputs** before creating merchant account
   - GSTIN format validation
   - PAN format validation
   - IFSC code validation
   - Phone number validation

3. **Use environment variables** for API keys
   - Never commit API keys to repository
   - Use Firebase Functions config for secrets

4. **Implement rate limiting** on Cloud Functions
   - Prevent abuse of merchant account creation
   - Limit payment link generation

5. **Monitor merchant accounts**
   - Track account status changes
   - Alert on suspicious activity
   - Implement fraud detection

## Testing

### Test Merchant Account Creation

```javascript
// Test in Firebase Console or via HTTP request
const testData = {
  businessInfo: {
    businessName: "Test Business",
    businessType: "sole_proprietorship",
    businessCategory: "retail",
    gstin: "27ABCDE1234F1Z5",
    pan: "ABCDE1234F"
  },
  contactInfo: {
    email: "test@example.com",
    phone: "9876543210",
    address: "123 Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001"
  },
  bankInfo: {
    accountNumber: "1234567890",
    ifsc: "BANK0001234",
    bankName: "Test Bank",
    accountHolderName: "Test Account"
  },
  userId: "test_user_id"
};
```

### Test Payment Link Generation

```javascript
const testInvoice = {
  invoiceId: "INV-TEST-123",
  amount: 1000,
  customerInfo: {
    name: "Test Customer",
    email: "customer@example.com",
    phone: "9876543210"
  }
};
```

## Troubleshooting

### Merchant Account Creation Fails

1. **Check environment variables** are set correctly
2. **Verify API credentials** are valid
3. **Check Firestore rules** allow writes
4. **Review Cloud Function logs** for errors

### Payment Links Not Generating

1. **Verify merchant account status** is "active"
2. **Check payment gateway credentials** in environment
3. **Ensure invoice exists** in Firestore
4. **Check Cloud Function logs** for API errors

### Payment Not Received

1. **Verify bank account details** are correct
2. **Check payment gateway dashboard** for transaction status
3. **Review webhook logs** if webhooks are configured
4. **Contact payment gateway support** if needed

## Future Enhancements

1. **Multi-Gateway Support**: Allow users to choose between Razorpay and Stripe
2. **Automatic Settlements**: Schedule automatic bank transfers
3. **Payment Analytics**: Dashboard showing payment trends
4. **Refund Management**: Handle refunds through the platform
5. **Recurring Payments**: Support for subscription-based payments
6. **International Payments**: Support for multiple currencies

## Support

For issues or questions:
1. Check Cloud Function logs in Firebase Console
2. Review payment gateway provider documentation
3. Check Firestore for merchant account status
4. Verify environment variables are configured

## Notes

- **Current Implementation**: Uses simulated responses for demo purposes
- **Production Ready**: Replace simulated responses with actual API calls
- **Compliance**: Ensure compliance with PCI DSS and local regulations
- **Testing**: Test thoroughly in sandbox/test mode before production

