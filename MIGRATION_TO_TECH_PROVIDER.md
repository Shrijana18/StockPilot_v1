# Migration Guide: Old WhatsApp Setup → Tech Provider

## 🎯 Overview

This guide helps you migrate from the old WhatsApp setup (where users create their own Meta apps) to the new Tech Provider model (where you manage all WhatsApp accounts centrally).

---

## 📋 Pre-Migration Checklist

### **Meta Business Suite Setup:**
- [ ] Complete App Review (Step 2 in Meta Business Suite)
- [ ] Complete Tech Provider Onboarding
- [ ] Create System User
- [ ] Generate System User Token
- [ ] Configure Webhook for Tech Provider
- [ ] Update OAuth Redirect URIs

### **Code Setup:**
- [ ] Deploy new Tech Provider functions
- [ ] Set environment variables
- [ ] Test Tech Provider flow with test account
- [ ] Update frontend to use Tech Provider setup

---

## 🔄 Migration Strategy

### **Option 1: Gradual Migration (Recommended)**
- Keep old flow active for existing users
- Use Tech Provider for new users
- Gradually migrate existing users over time

### **Option 2: Complete Migration**
- Migrate all users at once
- Remove old flow completely
- Requires thorough testing

---

## 📝 Step-by-Step Migration

### **Phase 1: Setup Tech Provider Infrastructure**

1. **Complete Meta App Review:**
   ```
   - Go to: https://developers.facebook.com/apps/{APP_ID}/app-review
   - Request permissions: whatsapp_business_management, whatsapp_business_messaging
   - Submit for review
   - Wait for approval (24-48 hours)
   ```

2. **Complete Tech Provider Onboarding:**
   ```
   - Go to: WhatsApp Quickstart page
   - Click "Become a Tech Provider"
   - Complete onboarding form
   - Wait for approval (3-7 days)
   ```

3. **Create System User:**
   ```
   - Meta Business Suite → Business Settings → System Users
   - Create new System User: "FLYP WhatsApp Manager"
   - Assign permissions:
     * whatsapp_business_management
     * whatsapp_business_messaging
     * business_management
   - Generate token
   - Store in Firebase Secrets: META_SYSTEM_USER_TOKEN
   ```

4. **Set Environment Variables:**
   ```bash
   firebase functions:config:set \
     meta.system_user_token="YOUR_SYSTEM_USER_TOKEN" \
     meta.tech_provider_mode="true"
   ```

### **Phase 2: Deploy New Functions**

1. **Deploy Tech Provider Functions:**
   ```bash
   firebase deploy --only functions:createClientWABA,functions:getClientWABA,functions:requestPhoneNumber,functions:sendMessageViaTechProvider,functions:setupWebhookForClient,functions:whatsappTechProviderWebhook
   ```

2. **Verify Deployment:**
   - Check Firebase Functions dashboard
   - Test with a test account

### **Phase 3: Update Frontend**

1. **Update WhatsApp Setup Component:**
   - Replace `WhatsAppAutoSetup.jsx` with `WhatsAppTechProviderSetup.jsx`
   - Or add Tech Provider as primary option with old flow as fallback

2. **Update WhatsApp Service:**
   - Add Tech Provider mode detection
   - Route messages through Tech Provider if enabled

3. **Test Frontend:**
   - Test WABA creation
   - Test phone number addition
   - Test webhook setup
   - Test message sending

### **Phase 4: Migrate Existing Users (Optional)**

1. **Identify Users to Migrate:**
   ```javascript
   // Query users with old WhatsApp setup
   const oldUsers = await db.collection('businesses')
     .where('whatsappProvider', '==', 'meta')
     .where('whatsappCreatedVia', '!=', 'tech_provider')
     .get();
   ```

2. **Migration Script:**
   ```javascript
   // For each user:
   // 1. Create WABA via Tech Provider
   // 2. Migrate phone number
   // 3. Update provider to 'meta_tech_provider'
   // 4. Setup webhook
   ```

3. **Test Migrated Users:**
   - Verify messages can be sent
   - Verify webhooks work
   - Verify status tracking works

### **Phase 5: Cleanup (After Migration Complete)**

1. **Remove Old Functions (if not needed):**
   - `whatsappConnectStart` (if all users migrated)
   - `whatsappConnectCallback` (if all users migrated)

2. **Remove Old Components:**
   - `WhatsAppAutoSetup.jsx` (if replaced)
   - `WhatsAppAPISetup.jsx` (if replaced)

3. **Update Documentation:**
   - Update user guides
   - Update API documentation

---

## 🔧 Code Changes Required

### **1. Update `whatsappService.js`:**

Add Tech Provider mode detection:

```javascript
export async function sendWhatsAppMessage(distributorId, to, message, options = {}) {
  // Check if user is using Tech Provider
  const config = await getWhatsAppConfig(distributorId);
  
  if (config.provider === 'meta_tech_provider') {
    // Use Tech Provider gateway
    const sendMessage = httpsCallable(functions, 'sendMessageViaTechProvider');
    return await sendMessage({ to, message, options });
  } else {
    // Use old flow
    // ... existing code
  }
}
```

### **2. Update Setup Component:**

Replace or update `DistributorProfileSettings.jsx`:

```javascript
// Use Tech Provider setup by default
import WhatsAppTechProviderSetup from './whatsapp/WhatsAppTechProviderSetup';

// In component:
<WhatsAppTechProviderSetup onSetupComplete={handleSetupComplete} />
```

---

## ⚠️ Important Considerations

### **1. Data Migration:**
- Existing message history remains in Firestore
- WABA IDs will change (old WABA → new Tech Provider WABA)
- Phone numbers need to be re-verified

### **2. Downtime:**
- Minimal downtime if using gradual migration
- Plan for brief downtime if doing complete migration

### **3. Testing:**
- Test thoroughly with test accounts before migrating real users
- Test all WhatsApp features (sending, receiving, status tracking)
- Test webhook handling

### **4. Rollback Plan:**
- Keep old functions deployed during migration
- Keep old components available
- Can rollback by changing provider flag

---

## 📊 Migration Status Tracking

Create a Firestore collection to track migration:

```javascript
// Collection: whatsappMigration
{
  userId: 'user123',
  oldProvider: 'meta',
  newProvider: 'meta_tech_provider',
  migrationStatus: 'pending' | 'in_progress' | 'completed' | 'failed',
  migratedAt: timestamp,
  errors: []
}
```

---

## ✅ Post-Migration Checklist

- [ ] All users migrated successfully
- [ ] Messages sending correctly via Tech Provider
- [ ] Webhooks receiving events
- [ ] Status tracking working
- [ ] No errors in Firebase Functions logs
- [ ] Old functions removed (if applicable)
- [ ] Documentation updated
- [ ] Team trained on new setup

---

## 🆘 Troubleshooting

### **Issue: WABA Creation Fails**
- **Check:** System User token is valid
- **Check:** System User has correct permissions
- **Check:** Business Manager is properly configured

### **Issue: Phone Number Verification Fails**
- **Check:** Phone number format is correct
- **Check:** User has access to Meta Business Suite
- **Check:** OTP verification completed

### **Issue: Messages Not Sending**
- **Check:** Phone number is verified
- **Check:** WABA is in production mode
- **Check:** System User token is valid

### **Issue: Webhook Not Receiving Events**
- **Check:** Webhook URL is correct
- **Check:** Verify token matches
- **Check:** Subscription fields are correct

---

## 📞 Support

If you encounter issues during migration:
1. Check Firebase Functions logs
2. Check Meta Business Suite for errors
3. Review migration status in Firestore
4. Contact Meta Developer Support if needed

---

**Last Updated:** 2024
**Status:** Ready for Migration

