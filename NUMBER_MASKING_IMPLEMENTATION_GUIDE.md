# Number Masking Implementation Guide
## How to Enable Masked Calls Between Retailer and Customer

## 🎯 THE CONCEPT

**What is Number Masking?**
- Retailer calls a **platform number** (not customer's real number)
- Platform routes call to customer
- Customer sees **platform number** (not retailer's real number)
- Both parties communicate without seeing each other's real numbers

**Example Flow:**
```
Retailer: +91-9876543210
Customer: +91-9123456789
Platform Number: +91-8000000000

Retailer calls: +91-8000000000
Platform routes to: +91-9123456789
Customer sees: +91-8000000000 (platform number)
Retailer sees: +91-8000000000 (platform number)
Both can talk, but neither sees real numbers!
```

---

## 🔧 HOW IT WORKS TECHNICALLY

### Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Retailer  │────────▶│   Platform   │────────▶│  Customer   │
│  +91-9876   │  Call   │  +91-8000    │  Route  │  +91-9123   │
│             │────────▶│  (Masked)    │────────▶│             │
└─────────────┘         └──────────────┘         └─────────────┘
     Sees: +91-8000          Routes Call            Sees: +91-8000
     (Platform)              (Twilio/AWS)           (Platform)
```

### Technical Components

1. **Telephony Service Provider** (Twilio, AWS Connect, etc.)
   - Provides phone numbers
   - Handles call routing
   - Manages call connections

2. **Call Routing Logic** (Your Backend)
   - Maps retailer → customer
   - Creates call sessions
   - Tracks call metadata

3. **Database** (Firestore)
   - Stores call sessions
   - Maps masked numbers
   - Logs call history

---

## 🛠️ IMPLEMENTATION OPTIONS

### Option 1: Twilio Voice API (Recommended)

**Why Twilio?**
- ✅ Already have Twilio in codebase (WhatsApp integration)
- ✅ Easy to implement
- ✅ Good documentation
- ✅ Reliable service
- ✅ Pay-per-use pricing

**How It Works:**
1. Retailer calls Twilio number
2. Twilio webhook calls your backend
3. Backend returns TwiML (call instructions)
4. Twilio connects to customer
5. Both parties talk through Twilio

**Cost:** ~₹0.50-1.00 per minute (India)

---

### Option 2: AWS Connect

**Why AWS Connect?**
- ✅ Scalable
- ✅ Integrates with AWS ecosystem
- ✅ Advanced features
- ⚠️ More complex setup
- ⚠️ Higher minimum costs

**Cost:** ~₹0.40-0.80 per minute + setup costs

---

### Option 3: Indian Providers (MSG91, Exotel)

**Why Indian Providers?**
- ✅ Lower costs (~₹0.30-0.50/min)
- ✅ Local support
- ✅ Better India coverage
- ⚠️ Less documentation
- ⚠️ Integration complexity

**Providers:**
- MSG91 Voice API
- Exotel
- Knowlarity

---

## 📋 RECOMMENDED: TWILIO IMPLEMENTATION

### Step 1: Setup Twilio Account

1. **Create Twilio Account**
   - Go to https://www.twilio.com
   - Sign up for account
   - Verify phone number

2. **Get Phone Number**
   - Buy Indian phone number (+91)
   - Cost: ~₹500-1000/month
   - Or use trial number (limited)

3. **Get Credentials**
   - Account SID
   - Auth Token
   - Phone Number (e.g., +91-8000000000)

---

### Step 2: Install Twilio SDK

```bash
npm install twilio
```

---

### Step 3: Backend Implementation (Firebase Functions)

#### File: `functions/voice/callMasking.js`

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

const accountSid = functions.config().twilio.account_sid;
const authToken = functions.config().twilio.auth_token;
const twilioPhoneNumber = functions.config().twilio.phone_number; // +91-8000000000

const client = twilio(accountSid, authToken);
const db = admin.firestore();

/**
 * Create a masked call session
 * Maps retailer → customer with masked number
 */
exports.createMaskedCall = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { orderId, retailerId, customerPhone } = data;

  if (!orderId || !retailerId || !customerPhone) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    // Get retailer phone from Firestore
    const retailerDoc = await db.collection('businesses').doc(retailerId).get();
    if (!retailerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Retailer not found');
    }

    const retailerPhone = retailerDoc.data().phone;
    if (!retailerPhone) {
      throw new functions.https.HttpsError('not-found', 'Retailer phone not found');
    }

    // Create call session in Firestore
    const callSessionRef = db.collection('callSessions').doc();
    const callSession = {
      orderId,
      retailerId,
      retailerPhone: retailerPhone.replace(/\+/g, ''), // Store without +
      customerPhone: customerPhone.replace(/\+/g, ''), // Store without +
      platformPhone: twilioPhoneNumber.replace(/\+/g, ''),
      status: 'initiated',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry
      )
    };

    await callSessionRef.set(callSession);

    // Initiate call from Twilio to retailer
    // Retailer will see platform number
    const call = await client.calls.create({
      to: retailerPhone,
      from: twilioPhoneNumber,
      url: `https://your-domain.com/api/voice/connect?sessionId=${callSessionRef.id}`,
      statusCallback: `https://your-domain.com/api/voice/status?sessionId=${callSessionRef.id}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: false // Set to true if you want to record calls
    });

    // Update session with Twilio call SID
    await callSessionRef.update({
      twilioCallSid: call.sid,
      status: 'calling_retailer'
    });

    return {
      success: true,
      sessionId: callSessionRef.id,
      callSid: call.sid,
      message: 'Call initiated to retailer'
    };
  } catch (error) {
    console.error('Error creating masked call:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create call', error);
  }
});

/**
 * Twilio webhook: When retailer answers, connect to customer
 * This is called by Twilio when retailer picks up
 */
exports.connectCall = functions.https.onRequest(async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).send('Missing sessionId');
  }

  try {
    // Get call session
    const sessionDoc = await db.collection('callSessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).send('Session not found');
    }

    const session = sessionDoc.data();

    // Check if session expired
    if (session.expiresAt.toDate() < new Date()) {
      return res.status(400).send('Session expired');
    }

    // Generate TwiML to connect to customer
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Dial customer number (customer will see platform number)
    const dial = twiml.dial({
      callerId: twilioPhoneNumber, // Customer sees platform number
      record: false, // Set to true if recording needed
      action: `https://your-domain.com/api/voice/call-complete?sessionId=${sessionId}`,
      method: 'POST'
    });
    
    dial.number(`+91${session.customerPhone}`);

    // Update session status
    await db.collection('callSessions').doc(sessionId).update({
      status: 'connecting_to_customer',
      retailerAnsweredAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error connecting call:', error);
    res.status(500).send('Error connecting call');
  }
});

/**
 * Twilio webhook: Call status updates
 */
exports.callStatus = functions.https.onRequest(async (req, res) => {
  const sessionId = req.query.sessionId;
  const callStatus = req.body.CallStatus;
  const callSid = req.body.CallSid;

  if (!sessionId) {
    return res.status(400).send('Missing sessionId');
  }

  try {
    const sessionRef = db.collection('callSessions').doc(sessionId);
    
    const updateData = {
      lastStatus: callStatus,
      lastStatusUpdate: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update status based on call state
    if (callStatus === 'completed') {
      updateData.status = 'completed';
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      updateData.status = 'failed';
      updateData.failureReason = callStatus;
    } else if (callStatus === 'answered') {
      updateData.status = 'connected';
    }

    await sessionRef.update(updateData);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).send('Error');
  }
});

/**
 * Twilio webhook: When call completes
 */
exports.callComplete = functions.https.onRequest(async (req, res) => {
  const sessionId = req.query.sessionId;
  const dialCallStatus = req.body.DialCallStatus;
  const dialCallDuration = req.body.DialCallDuration;

  if (!sessionId) {
    return res.status(400).send('Missing sessionId');
  }

  try {
    await db.collection('callSessions').doc(sessionId).update({
      status: 'completed',
      customerCallStatus: dialCallStatus,
      callDuration: dialCallDuration ? parseInt(dialCallDuration) : 0,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error completing call:', error);
    res.status(500).send('Error');
  }
});
```

---

### Step 4: Frontend Integration

#### File: `src/services/callMaskingService.js`

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

/**
 * Initiate a masked call between retailer and customer
 * @param {string} orderId - Order ID
 * @param {string} retailerId - Retailer ID
 * @param {string} customerPhone - Customer phone number (+91XXXXXXXXXX)
 * @returns {Promise<Object>} - Call session info
 */
export async function initiateMaskedCall(orderId, retailerId, customerPhone) {
  try {
    const createCall = httpsCallable(functions, 'createMaskedCall');
    
    const result = await createCall({
      orderId,
      retailerId,
      customerPhone
    });

    return {
      success: true,
      sessionId: result.data.sessionId,
      callSid: result.data.callSid,
      message: result.data.message
    };
  } catch (error) {
    console.error('Error initiating masked call:', error);
    throw error;
  }
}

/**
 * Get call session status
 * @param {string} sessionId - Call session ID
 * @returns {Promise<Object>} - Session status
 */
export async function getCallSession(sessionId) {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/firebaseConfig');
    
    const sessionRef = doc(db, 'callSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) {
      throw new Error('Call session not found');
    }

    return {
      id: sessionDoc.id,
      ...sessionDoc.data()
    };
  } catch (error) {
    console.error('Error getting call session:', error);
    throw error;
  }
}
```

---

### Step 5: Update Retailer UI

#### File: `src/components/retailer/marketplace/CustomerOrders.jsx`

Add call button that uses masked calling:

```javascript
import { initiateMaskedCall } from '../../../services/callMaskingService';

// Inside the order detail modal, replace direct phone link:
{/* OLD: Direct phone link */}
{/* <a href={`tel:${order.customerPhone}`} className="...">
  <FaPhone /> {order.customerPhone}
</a> */}

{/* NEW: Masked call button */}
<button
  onClick={async () => {
    try {
      setActionLoading('calling');
      const result = await initiateMaskedCall(
        order.id,
        auth.currentUser?.uid,
        order.customerPhone
      );
      
      // Show success message
      alert(`Calling customer through platform. You'll be connected shortly.`);
      
      // Optionally: Open phone dialer with platform number
      // window.location.href = `tel:+91-8000000000`;
      
    } catch (error) {
      console.error('Call initiation failed:', error);
      alert('Failed to initiate call. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }}
  disabled={actionLoading === 'calling'}
  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
>
  <FaPhone />
  {actionLoading === 'calling' ? 'Connecting...' : 'Call Customer (Masked)'}
</button>
```

---

## 🔐 SECURITY CONSIDERATIONS

### 1. Session Expiry
- Call sessions expire after 30 minutes
- Prevents abuse of old sessions

### 2. Order Validation
- Only allow calls for active orders
- Verify retailer has access to order
- Check order status (can't call for cancelled orders)

### 3. Rate Limiting
- Limit calls per retailer per hour
- Prevent spam/abuse

### 4. Call Logging
- Log all calls in Firestore
- Track call duration
- Monitor for suspicious patterns

---

## 💰 COST ESTIMATION

### Twilio Pricing (India)

**Setup Costs:**
- Phone number: ₹500-1000/month
- Account setup: Free

**Per-Minute Costs:**
- Outbound calls: ₹0.50-1.00/minute
- Inbound calls: ₹0.30-0.60/minute

**Example Monthly Cost:**
```
1000 calls/month × 3 minutes average = 3000 minutes
3000 minutes × ₹0.75 = ₹2,250/month
+ Phone number: ₹750/month
= Total: ~₹3,000/month
```

**Cost per call:** ~₹2.25 (3 min average)

---

## 📊 ALTERNATIVE: AWS CONNECT

### Setup Steps

1. **Create AWS Connect Instance**
2. **Buy Phone Number**
3. **Configure Contact Flow**
4. **Set up Lambda Functions**
5. **Integrate with Firestore**

**Cost:** Similar to Twilio, but more complex setup

---

## 📊 ALTERNATIVE: INDIAN PROVIDERS

### MSG91 Voice API

**Setup:**
1. Sign up at https://msg91.com
2. Get API credentials
3. Buy phone number
4. Integrate API

**Cost:** ~₹0.30-0.50/minute

**Example Code:**
```javascript
const msg91 = require('msg91')(process.env.MSG91_AUTH_KEY);

// Initiate call
msg91.voice.call({
  to: customerPhone,
  from: platformPhone,
  callback: callbackUrl
}, (err, response) => {
  // Handle response
});
```

---

## 🎯 RECOMMENDED IMPLEMENTATION PLAN

### Phase 1: Basic Masking (Week 1-2)
- ✅ Setup Twilio account
- ✅ Implement backend functions
- ✅ Create call session system
- ✅ Basic UI integration

### Phase 2: Enhanced Features (Week 3-4)
- ✅ Call recording (optional)
- ✅ Call history tracking
- ✅ Session expiry
- ✅ Error handling

### Phase 3: Monitoring & Analytics (Week 5-6)
- ✅ Call analytics dashboard
- ✅ Usage tracking
- ✅ Cost monitoring
- ✅ Abuse detection

---

## 🧪 TESTING

### Test Scenarios

1. **Happy Path**
   - Retailer initiates call
   - Customer answers
   - Both can talk
   - Call completes successfully

2. **Customer Doesn't Answer**
   - Retailer calls
   - Customer doesn't pick up
   - Session expires
   - Proper error handling

3. **Session Expiry**
   - Create session
   - Wait 30+ minutes
   - Try to use session
   - Should fail gracefully

4. **Multiple Calls**
   - Retailer calls customer multiple times
   - Each creates new session
   - Previous sessions expire

---

## 📋 CHECKLIST

### Setup
- [ ] Create Twilio account
- [ ] Buy Indian phone number
- [ ] Configure Twilio credentials in Firebase
- [ ] Install Twilio SDK

### Backend
- [ ] Create `createMaskedCall` function
- [ ] Create `connectCall` webhook
- [ ] Create `callStatus` webhook
- [ ] Create `callComplete` webhook
- [ ] Set up Firestore collections

### Frontend
- [ ] Create `callMaskingService.js`
- [ ] Update retailer order UI
- [ ] Add call button
- [ ] Handle loading states
- [ ] Error handling

### Security
- [ ] Session expiry (30 min)
- [ ] Order validation
- [ ] Rate limiting
- [ ] Call logging

### Testing
- [ ] Test successful calls
- [ ] Test failed calls
- [ ] Test session expiry
- [ ] Test multiple calls

---

## 🚀 QUICK START

1. **Get Twilio Credentials**
   ```bash
   # Set in Firebase Functions config
   firebase functions:config:set \
     twilio.account_sid="YOUR_ACCOUNT_SID" \
     twilio.auth_token="YOUR_AUTH_TOKEN" \
     twilio.phone_number="+918000000000"
   ```

2. **Deploy Functions**
   ```bash
   cd functions
   npm install twilio
   firebase deploy --only functions
   ```

3. **Update Frontend**
   - Add call button in retailer UI
   - Integrate `callMaskingService.js`

4. **Test**
   - Create test order
   - Initiate call
   - Verify masking works

---

## 📚 RESOURCES

- **Twilio Voice API Docs:** https://www.twilio.com/docs/voice
- **Twilio TwiML:** https://www.twilio.com/docs/voice/twiml
- **Firebase Functions:** https://firebase.google.com/docs/functions
- **Twilio India Pricing:** https://www.twilio.com/pricing/voice

---

## ✅ SUMMARY

**How Number Masking Works:**
1. Retailer calls platform number (Twilio)
2. Twilio webhook calls your backend
3. Backend returns TwiML to connect customer
4. Customer sees platform number
5. Both parties talk without seeing real numbers

**Implementation:**
- Use Twilio Voice API (recommended)
- Create Firebase Functions for routing
- Integrate with Firestore for sessions
- Update retailer UI with call button

**Cost:** ~₹2-3 per call (3 min average)

**Time to Implement:** 1-2 weeks

**Your codebase already has Twilio integration, so this is a natural extension!** 🚀
