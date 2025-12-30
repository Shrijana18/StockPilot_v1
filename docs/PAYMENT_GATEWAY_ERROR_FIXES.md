# Payment Gateway Setup - Error Fixes

## Issues Identified and Fixed

### 1. Phone Number Validation Issue ✅

**Problem:**
- User was entering phone number with country code (`+919828738372`)
- Validation expected exactly 10 digits starting with 6-9
- Phone input was stripping non-digits but not handling country code properly

**Fix:**
- Updated phone input to accept both formats:
  - `9828738372` (10 digits)
  - `+919828738372` (with country code)
- Validation now extracts last 10 digits for validation
- Phone number is normalized to 10 digits before sending to backend

**Code Changes:**
```javascript
// Before: Only accepted 10 digits
onChange={(e) => handleChange("phone", e.target.value.replace(/\D/g, ""))}
maxLength={10}

// After: Handles +91 prefix
onChange={(e) => {
  let value = e.target.value.replace(/[^\d+]/g, "");
  if (value.startsWith("+91")) {
    value = "+91" + value.slice(3).replace(/\D/g, "").slice(0, 10);
  } else {
    value = value.replace(/\D/g, "").slice(0, 10);
  }
  handleChange("phone", value);
}}
```

### 2. Error Handling Improvements ✅

**Problem:**
- Generic error messages didn't help users understand what went wrong
- Cloud Function errors weren't properly categorized

**Fix:**
- Added specific error messages for different error types:
  - `functions/not-found`: Service not available
  - `functions/permission-denied`: Permission issues
  - `functions/unauthenticated`: Auth issues
  - Network errors: Connection/timeout issues
- Improved Cloud Function error responses with detailed messages

**Code Changes:**
```javascript
// Frontend error handling
if (error.code === "functions/not-found") {
  errorMessage = "Payment gateway service is not available. Please contact support.";
} else if (error.code === "functions/permission-denied") {
  errorMessage = "You don't have permission to create a merchant account.";
} else if (error.code === "functions/unauthenticated") {
  errorMessage = "Please log in again to continue.";
}

// Backend error handling
if (!businessInfo || !contactInfo || !bankInfo) {
  return {
    success: false,
    error: "Missing required information. Please fill all fields.",
  };
}
```

### 3. Input Validation Enhancements ✅

**Problem:**
- Validation messages weren't clear enough
- Some edge cases weren't handled

**Fix:**
- Improved validation messages
- Better phone number extraction (handles country codes)
- More specific field validation messages

## Common Errors and Solutions

### Error: "Payment gateway service is not available"

**Cause:** Cloud Function not deployed or not accessible

**Solution:**
1. Deploy Cloud Functions:
   ```bash
   firebase deploy --only functions:createMerchantAccount
   ```
2. Check Firebase Console → Functions to verify deployment
3. Check function logs for errors

### Error: "Please enter a valid 10-digit Indian phone number"

**Cause:** Phone number format issue

**Solution:**
- Enter phone number as: `9828738372` (10 digits)
- Or with country code: `+919828738372`
- System will automatically extract 10 digits

### Error: "Missing required information"

**Cause:** One or more required fields are empty

**Solution:**
- Fill all fields marked with `*`
- Check that:
  - Business Name, Type, Category are filled
  - GSTIN is 15 characters
  - PAN is 10 characters
  - All contact fields are filled
  - All bank details are filled

### Error: "User ID mismatch"

**Cause:** Authentication issue

**Solution:**
- Refresh the page
- Log out and log back in
- Check browser console for auth errors

## Testing Checklist

- [ ] Phone number accepts 10 digits without country code
- [ ] Phone number accepts +91 prefix
- [ ] Validation shows clear error messages
- [ ] Cloud Function is deployed and accessible
- [ ] All required fields are validated
- [ ] Error messages are user-friendly
- [ ] Success message appears after account creation

## Debugging Steps

1. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed requests

2. **Check Firebase Functions Logs:**
   ```bash
   firebase functions:log --only createMerchantAccount
   ```

3. **Verify Function Deployment:**
   - Go to Firebase Console → Functions
   - Verify `createMerchantAccount` is listed
   - Check if it's enabled

4. **Test Function Locally:**
   ```bash
   firebase emulators:start --only functions
   ```

## Next Steps

1. **Deploy Cloud Functions:**
   ```bash
   cd functions
   npm install
   firebase deploy --only functions:createMerchantAccount,functions:generatePaymentLink
   ```

2. **Set Environment Variables:**
   ```bash
   firebase functions:config:set razorpay.key_id="YOUR_KEY" razorpay.key_secret="YOUR_SECRET"
   ```

3. **Test the Flow:**
   - Fill out the onboarding form
   - Submit and verify merchant account creation
   - Check Firestore for merchant account data

## Support

If errors persist:
1. Check Firebase Console → Functions → Logs
2. Review browser console for frontend errors
3. Verify all environment variables are set
4. Check Firestore rules allow writes to billing preferences

