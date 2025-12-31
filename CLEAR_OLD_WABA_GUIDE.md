# Clear Old Shared WABA - Migration Guide

## 🎯 Problem

Users who previously connected to the old shared WABA (1403499024706435 - FLYP Corporation Private Limited) are seeing that WABA in their profile settings instead of creating their own individual WABA.

## ✅ Solution

The system now:
1. **Only shows individual WABAs** - Functions check for `whatsappCreatedVia === "individual_setup"`
2. **Hides old shared WABAs** - Old WABAs are filtered out
3. **Prompts for individual setup** - If user has old WABA, they see "Create Your WhatsApp Business Account" button

## 🔧 How It Works

### Backend Changes:

1. **`getClientWABA`** - Only returns WABAs with `createdVia === "individual_setup"`
2. **`getWhatsAppSetupStatus`** - Only shows individual WABAs, returns `needsIndividualSetup: true` for old WABAs
3. **`createIndividualWABA`** - Creates new WABA and subscribes Tech Provider App automatically
4. **`checkPhoneRegistrationStatus`** - Only checks individual WABAs

### Frontend Changes:

1. **WhatsAppTechProviderSetup** - Shows warning if old WABA detected
2. **IndividualWABASetup** - Shows setup form when needed
3. **WhatsAppHub** - Shows setup when no individual WABA exists

## 📋 Migration Steps for Existing Users

### Option 1: Automatic (Recommended)
Users will automatically see:
- Warning message about old WABA
- "Create Your WhatsApp Business Account" button
- Setup form to create new individual WABA

### Option 2: Manual Cleanup (If Needed)
If you want to clear old WABA references from Firestore:

```javascript
// Run this in Firebase Console or via Cloud Function
const businesses = await db.collection('businesses').get();
for (const doc of businesses.docs) {
  const data = doc.data();
  if (data.whatsappBusinessAccountId && data.whatsappCreatedVia !== 'individual_setup') {
    // Clear old WABA reference
    await doc.ref.update({
      whatsappBusinessAccountId: admin.firestore.FieldValue.delete(),
      whatsappPhoneNumberId: admin.firestore.FieldValue.delete(),
      whatsappPhoneNumber: admin.firestore.FieldValue.delete(),
      whatsappEnabled: false,
      whatsappCreatedVia: admin.firestore.FieldValue.delete(),
    });
  }
}
```

## ✅ Verification

After migration:
1. User should see "Create Your WhatsApp Business Account" button
2. User creates new individual WABA
3. New WABA is subscribed to Tech Provider App automatically
4. User completes OTP verification
5. User can use all WhatsApp features

## 🎯 Key Points

- ✅ Each user gets their own WABA
- ✅ All WABAs are under FLYP Tech Provider App (App ID: 1902565950686087)
- ✅ Old shared WABA is hidden/ignored
- ✅ System prompts users to create individual WABA
- ✅ Tech Provider App is automatically subscribed to new WABAs

