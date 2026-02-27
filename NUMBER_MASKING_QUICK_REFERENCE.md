# Number Masking - Quick Reference

## 🎯 How It Works

```
Retailer calls Platform Number → Platform routes to Customer
Both see Platform Number, not each other's real numbers
```

## 📋 Implementation Steps

### 1. Setup Twilio
- Create account at twilio.com
- Buy Indian phone number (+91)
- Get Account SID & Auth Token

### 2. Backend (Firebase Functions)
- Install: `npm install twilio`
- Create `createMaskedCall` function
- Create webhook handlers for call routing
- Store sessions in Firestore

### 3. Frontend
- Create `callMaskingService.js`
- Add "Call Customer (Masked)" button
- Replace direct phone links

## 💰 Cost

- Phone number: ₹500-1000/month
- Per call: ~₹2-3 (3 min average)
- Monthly (1000 calls): ~₹3,000

## 🔧 Key Components

### Backend Functions
- `createMaskedCall` - Initiates call
- `connectCall` - Routes to customer
- `callStatus` - Tracks status
- `callComplete` - Handles completion

### Frontend Service
- `initiateMaskedCall()` - Start call
- `getCallSession()` - Check status

## ✅ Benefits

- ✅ Retailer can't see customer number
- ✅ Customer can't see retailer number
- ✅ Platform controls communication
- ✅ All calls logged
- ✅ Prevents bypass attempts

## 🚀 Quick Start

```javascript
// 1. Initiate call
import { initiateMaskedCall } from './services/callMaskingService';

await initiateMaskedCall(orderId, retailerId, customerPhone);

// 2. Twilio handles routing automatically
// 3. Both parties connected through platform number
```

## 📚 Full Guide

See `NUMBER_MASKING_IMPLEMENTATION_GUIDE.md` for complete details.
