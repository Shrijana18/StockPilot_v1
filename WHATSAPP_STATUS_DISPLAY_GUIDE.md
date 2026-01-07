# WhatsApp Account Status Display Guide

## ✅ How It Works

### 1. **Account Creation Flow**
When a user creates a WhatsApp Business Account via Embedded Signup:
1. User clicks "Connect with Facebook"
2. Meta's embedded signup popup opens
3. User completes Meta's setup flow
4. Account is created in Meta Business Manager
5. WABA ID and phone number are saved to Firestore
6. Status is automatically fetched from Meta API

### 2. **Status Display Location**
Users see their account status in:
- **Profile Settings → WhatsApp Section** (Distributor Dashboard)
- Real-time status cards showing:
  - Account Review Status (APPROVED, PENDING, REJECTED)
  - Phone Number Status (Verified, Pending Verification, Not Registered)
  - Account Details (Name, Timezone, Enabled Status)
  - Pending Actions (What needs to be done)
  - Overall Readiness (All Set! or Action Required)

### 3. **Automatic Status Updates**
- **Initial Fetch**: Status is fetched 2 seconds after account creation
- **Retry**: Status is fetched again after 5 seconds (in case Meta API needs time)
- **Polling**: Status is automatically checked every 30 seconds
- **Manual Refresh**: User can click "Refresh Status" button anytime

### 4. **What Status Shows**

#### Account Review Status
- **APPROVED** (Green) ✅ - Account is approved and ready
- **PENDING/IN_REVIEW** (Yellow) ⏳ - Review in progress (24-48 hours)
- **REJECTED** (Red) ❌ - Review was rejected

#### Phone Number Status
- **Verified** (Green) ✅ - Phone is verified and connected
- **Registered but Unverified** (Yellow) ⚠️ - Phone added but needs verification
- **Not Registered** (Gray) ❌ - No phone number added

#### Overall Status
- **Ready** ✅ - All set! Account is fully configured
- **Needs Action** ⚠️ - Shows list of pending actions

## 📊 Status Information Displayed

### Account Information Card
- WABA ID (WhatsApp Business Account ID)
- Phone Number (if registered)
- Connection Status

### Account Review Card
- Review Status (APPROVED, PENDING, REJECTED, etc.)
- Status Message
- Helpful information about review timeline

### Phone Number Card
- Phone Number (if registered)
- Verification Status
- Connection Status
- Help text for verification

### Account Details Card
- Account Name
- Enabled/Disabled Status
- Time Zone

### Pending Actions Card (if needed)
- List of actions required:
  - "Add phone number"
  - "Verify phone number"
  - "Wait for account review"
  - "Resolve account review issues"

### Ready Status Card (when all set)
- Confirmation that account is ready
- Message about available features

## 🔄 How Status Updates

1. **After Account Creation**
   - Status fetched automatically
   - Shows "Review in progress" if account is pending
   - Shows phone status if phone was added

2. **During Review**
   - Status polls every 30 seconds
   - Updates automatically when review completes
   - Shows "APPROVED" when Meta approves

3. **After Phone Verification**
   - Status updates when phone is verified
   - Shows "Verified and Connected" status
   - Overall status becomes "Ready"

## 🎯 User Experience

### For New Users (Just Created Account)
- See their WABA ID immediately
- See "Review in progress" status
- See phone number if added during signup
- Get clear guidance on next steps

### For Users with Pending Review
- See "PENDING" status with spinning indicator
- Get message: "Meta is reviewing your account. This usually takes 24-48 hours."
- See what actions are still needed

### For Users with Approved Account
- See "APPROVED" status with green checkmark
- See phone verification status
- See "All Set! Account is Ready" message
- Can start using WhatsApp features

## 🔍 Technical Details

### Function Called
- `getWABAStatus` (Cloud Function)
- Region: us-central1
- Returns comprehensive status from Meta API

### Data Fetched
- `account_review_status` from Meta API
- Phone numbers and verification status
- WABA details (name, timezone, enabled status)

### Status Updates
- Automatic polling every 30 seconds
- Manual refresh button
- Immediate fetch after account creation

## 📱 Where Users See This

1. **Distributor Profile Settings**
   - Navigate to: Profile Settings → WhatsApp
   - See full status dashboard

2. **After Account Creation**
   - Automatically shown in WhatsApp section
   - Status cards appear immediately

3. **Status Refresh**
   - Click "Refresh Status" button
   - See latest status from Meta

## ✅ Status States Explained

### Account Review Status
- **APPROVED**: Account passed Meta's review, ready to use
- **PENDING/IN_REVIEW**: Meta is currently reviewing the account
- **REJECTED**: Account review failed, needs attention
- **LIMITED**: Account has limited functionality

### Phone Verification Status
- **VERIFIED**: Phone is verified and can send messages
- **UNVERIFIED**: Phone added but not verified yet
- **PENDING**: Verification in progress
- **Not Registered**: No phone number added

### Overall Readiness
- **Ready**: Account approved + Phone verified = Full access
- **Needs Action**: One or more steps pending

## 🚀 Next Steps for Users

Based on status, users see:
1. **If Review Pending**: Wait for Meta's review (24-48 hours)
2. **If Phone Not Verified**: Complete phone verification in Meta Business Suite
3. **If All Ready**: Start using WhatsApp Business features!

