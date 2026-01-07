# Firestore Rules for WhatsApp Account Data

## ✅ Current Rule Status

The existing Firestore rule at line 121-126 allows users to update their own business profile, including all WhatsApp fields:

```javascript
allow update: if isAuthed()
  && isSelf(userId)
  && isEmailVerified()
  && request.resource.data.ownerId == resource.data.ownerId
  && emailUnchanged(request.resource.data)
  && (!('phone' in request.resource.data) || isValidPhoneFormat(request.resource.data.phone));
```

## 📋 WhatsApp Fields Being Saved

### From Frontend (User-Initiated Updates)
These fields are saved when user completes embedded signup:
- `whatsappBusinessAccountId` - WABA ID from Meta
- `whatsappPhoneNumberId` - Phone number ID
- `whatsappPhoneNumber` - Display phone number
- `whatsappProvider` - Provider type (meta_tech_provider)
- `whatsappEnabled` - Whether WhatsApp is enabled
- `whatsappCreatedVia` - How account was created (embedded_signup)
- `whatsappCreatedAt` - Creation timestamp
- `whatsappPhoneRegistered` - Whether phone is registered
- `whatsappPhoneVerificationStatus` - Verification status (pending, verified, etc.)
- `whatsappVerified` - Overall verification status
- `whatsappAccountReviewStatus` - Account review status (PENDING, APPROVED, etc.)
- `embeddedSignupData` - Complete embedded signup response object
- `whatsappAccessToken` - Access token (if provided by Meta)
- `whatsappOAuthCode` - OAuth code (if provided by Meta)
- `metaBusinessId` - Meta Business Manager ID (if provided)

### From Webhook (Cloud Function Updates)
These fields are updated automatically by webhook handlers:
- `whatsappAccountReviewStatus` - Updated when Meta reviews account
- `whatsappAccountReviewUpdatedAt` - Timestamp of review update
- `whatsappPhoneNumberId` - Updated when phone is verified
- `whatsappPhoneNumber` - Updated when phone is verified
- `whatsappPhoneRegistered` - Updated when phone is registered
- `whatsappPhoneVerificationStatus` - Updated when verification status changes
- `whatsappVerified` - Updated when account/phone is verified
- `whatsappPhoneUpdatedAt` - Timestamp of phone update

### Existing Fields (Already Documented)
- `whatsappLastSyncedAt` - Last sync timestamp
- `whatsappConnectedAt` - Connection timestamp
- `whatsappWebhookUrl` - Webhook URL
- `whatsappWebhookConfigured` - Whether webhook is configured
- `whatsappWebhookConfiguredAt` - Webhook configuration timestamp

## 🔒 Security Considerations

### User-Initiated Updates
- ✅ **Allowed**: User can update their own WhatsApp fields
- ✅ **Restrictions**: 
  - Must be authenticated
  - Must be the owner (isSelf)
  - Email must be verified
  - ownerId cannot change
  - email cannot change
  - phone format must be valid (if phone is being updated)

### Cloud Function Updates (Webhook)
- ✅ **Allowed**: Cloud Functions use Admin SDK, which bypasses Firestore rules
- ✅ **Security**: Webhook handlers verify:
  - WABA ID matches user's account
  - Only updates fields related to account review/phone verification
  - Uses authenticated system user token

## ✅ Rule Verification

The current rule **correctly allows** all WhatsApp fields to be updated because:

1. **No field restrictions**: The rule doesn't restrict which fields can be updated, only who can update them
2. **Owner-only**: Only the business owner can update their profile
3. **Email verification**: Ensures user is verified
4. **Immutable fields**: ownerId and email cannot be changed (security)

## 📝 Updated Comment

The comment in `firestore.rules` has been updated to document all WhatsApp fields:

```javascript
// - WhatsApp: whatsappBusinessAccountId, whatsappPhoneNumberId, whatsappPhoneNumber, whatsappPhoneRegistered,
//   whatsappPhoneVerificationStatus, whatsappProvider, whatsappEnabled, whatsappLastSyncedAt, whatsappConnectedAt,
//   whatsappWebhookUrl, whatsappWebhookConfigured, whatsappWebhookConfiguredAt, whatsappCreatedVia, whatsappCreatedAt,
//   whatsappAccountReviewStatus, whatsappAccountReviewUpdatedAt, whatsappPhoneUpdatedAt, whatsappVerified,
//   embeddedSignupData, whatsappAccessToken, whatsappOAuthCode, metaBusinessId
```

## 🎯 Conclusion

**No rule changes needed!** The existing rule already allows all WhatsApp fields to be saved. The comment has been updated for documentation purposes.

## 🔍 Testing

To verify the rules work correctly:

1. **User Update Test**:
   - User completes embedded signup
   - Frontend calls `updateDoc()` with WhatsApp fields
   - ✅ Should succeed (user is authenticated, is owner, email verified)

2. **Webhook Update Test**:
   - Meta sends webhook with account review update
   - Cloud Function updates Firestore using Admin SDK
   - ✅ Should succeed (Admin SDK bypasses rules)

3. **Unauthorized Update Test**:
   - User A tries to update User B's WhatsApp fields
   - ✅ Should fail (not isSelf)

