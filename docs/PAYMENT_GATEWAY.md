# Payment Gateway Integration Guide

## Overview

The payment gateway system allows each user to configure their own unique payment methods (UPI, Card, Bank Transfer) and send payment links directly to customers via WhatsApp or other channels.

## Features

1. **Per-User Payment Configuration**: Each user can set up their own payment gateway settings
2. **Multiple Payment Methods**: Support for UPI, Card payments, and Bank transfers
3. **Payment Link Generation**: Automatically generate payment links for customers
4. **WhatsApp Integration**: Send payment requests directly via WhatsApp
5. **Customizable Payment Messages**: Professional payment request messages with all payment options

## Architecture

### Components

1. **Payment Gateway Utilities** (`src/utils/paymentGateway.js`)
   - Generates UPI payment links
   - Creates payment request messages
   - Validates payment configurations
   - Handles payment gateway configuration

2. **Payment Link Sender** (`src/components/payment/PaymentLinkSender.jsx`)
   - UI component for sending payment links
   - Supports WhatsApp and copy-to-clipboard
   - Allows selection of payment methods to include

3. **Enhanced Billing Settings** (`src/components/billing/BillingSettings.jsx`)
   - Extended to include card payment gateway configuration
   - Multiple UPI ID support
   - Payment notification settings

### Data Structure

Payment settings are stored in Firestore at:
```
businesses/{userId}/preferences/billing
```

Structure:
```javascript
{
  payment: {
    upiId: "username@bank",           // Primary UPI ID
    upiQrUrl: "https://...",           // UPI QR Code image URL
    multipleUpiIds: ["id1@bank", ...], // Additional UPI IDs
    card: {
      enabled: true,
      gateway: "razorpay",             // razorpay, stripe, payu, etc.
      merchantId: "merchant_123",
      apiKey: "api_key_here",
      paymentLinkEnabled: true
    },
    notifications: {
      sendOnInvoice: false,
      sendOnCredit: true,
      autoSendPaymentLink: false
    }
  },
  bank: {
    bankName: "Bank Name",
    branch: "Branch Name",
    accountNumber: "1234567890",
    ifsc: "BANK0001234",
    accountName: "Account Holder Name"
  }
}
```

## Usage

### Setting Up Payment Gateway

1. **Navigate to Billing Settings**
   - Click the ⚙️ icon in Manual Billing section
   - Or access via Settings menu

2. **Configure UPI Payment**
   - Enter your primary UPI ID (format: `username@bank`)
   - Upload UPI QR code image (optional)
   - Add additional UPI IDs if needed

3. **Configure Card Payment** (Optional)
   - Enable card payment gateway
   - Select payment gateway provider (Razorpay, Stripe, etc.)
   - Enter Merchant ID and API Key
   - Enable payment link generation if supported

4. **Configure Bank Details**
   - Enter bank name, branch, account number, IFSC, and account holder name
   - These details will be included in payment requests

5. **Configure Notifications**
   - Choose when to automatically send payment links
   - Enable/disable payment reminders for credit invoices

### Sending Payment Links

#### From Invoice View

1. Open an invoice from "View Invoices" tab
2. Click "💳 Send Payment Link" button (appears for UPI, Card, or Credit invoices)
3. Select payment methods to include (UPI, Card, Bank)
4. Click "Send via WhatsApp" or "Copy Message"

#### From Invoice Creation

1. Create an invoice with payment mode: UPI, Card, or Credit
2. After saving the invoice, payment link sender will automatically open (if customer has phone number)
3. Select payment methods and send

### Payment Link Formats

#### UPI Links
- **Standard UPI**: `upi://pay?pa=UPI_ID&am=AMOUNT&cu=INR&tn=NOTE`
- **PhonePe**: `phonepe://pay?...`
- **Google Pay**: `tez://upi/pay?...`
- **Paytm**: `paytmmp://pay?...`

#### WhatsApp Message Format
```
💰 *Payment Request*

Hello Customer Name,

Invoice: *INV-123456*
Amount: *₹1,234.56*
Due Date: *15 Jan 2024*

📱 *Payment Options:*

💳 *UPI Payment:*
UPI ID: *username@bank*
Tap to pay: [UPI Link]

💳 *Card Payment:*
Pay via card: [Payment Link]

🏦 *Bank Transfer:*
Bank: Bank Name
Account: 1234567890
IFSC: BANK0001234
Account Name: Account Holder

📄 View invoice: [Invoice Link]

Thank you!
— Business Name
```

## Integration with Payment Gateways

### Razorpay Integration (Example)

To integrate with Razorpay for card payments:

1. **Install Razorpay SDK**:
```bash
npm install razorpay
```

2. **Create Payment Link** (Backend/Cloud Function):
```javascript
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: 'YOUR_KEY_ID',
  key_secret: 'YOUR_KEY_SECRET'
});

async function createPaymentLink(amount, invoiceId) {
  const options = {
    amount: amount * 100, // Amount in paise
    currency: 'INR',
    receipt: invoiceId,
    notes: {
      invoice_id: invoiceId
    }
  };
  
  const paymentLink = await razorpay.paymentLinks.create(options);
  return paymentLink.short_url;
}
```

3. **Store Payment Link in Invoice**:
```javascript
const paymentLink = await createPaymentLink(invoice.totalAmount, invoice.invoiceId);
await updateDoc(invoiceRef, {
  'payment.card.paymentLink': paymentLink
});
```

### Stripe Integration (Example)

Similar pattern for Stripe:
```javascript
const stripe = require('stripe')('sk_test_...');

async function createStripePaymentLink(amount, invoiceId) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'inr',
        product_data: { name: `Invoice ${invoiceId}` },
        unit_amount: amount * 100,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${baseUrl}/payment/success`,
    cancel_url: `${baseUrl}/payment/cancel`,
  });
  
  return session.url;
}
```

## Security Considerations

1. **API Keys**: 
   - Never store API keys in client-side code
   - Use Firebase Cloud Functions or backend server for payment link generation
   - Consider using Firebase Remote Config for non-sensitive settings

2. **Validation**:
   - Always validate payment amounts server-side
   - Verify payment status before marking invoices as paid
   - Implement webhook handlers for payment gateway callbacks

3. **Data Privacy**:
   - Encrypt sensitive payment information
   - Follow PCI DSS compliance for card data
   - Implement proper access controls

## Future Enhancements

1. **Payment Gateway Webhooks**: Auto-update invoice status on payment
2. **Payment Analytics**: Track payment success rates by method
3. **Recurring Payments**: Support for subscription-based payments
4. **Multi-Currency**: Support for international payments
5. **Payment Reminders**: Automated reminders for overdue invoices
6. **Payment Splitting**: Allow customers to pay in installments

## Troubleshooting

### Payment Links Not Working
- Verify UPI ID format: `username@bank`
- Check if payment gateway is properly configured
- Ensure customer phone number is valid

### WhatsApp Link Not Opening
- Verify phone number format (should include country code)
- Check if WhatsApp is installed on device
- Ensure phone number is clickable link

### Card Payment Links Not Generating
- Verify payment gateway credentials
- Check if payment link generation is enabled in settings
- Ensure backend/cloud function is properly configured

## Support

For issues or questions:
1. Check payment gateway provider documentation
2. Verify Firestore rules allow reading/writing payment settings
3. Check browser console for errors
4. Review Firebase Cloud Functions logs (if using)

