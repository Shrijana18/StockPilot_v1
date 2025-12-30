# 📱 WhatsApp Business API: Adding Recipient Phone Numbers

## ❌ The Error You're Seeing

**Error**: `(#131030) Recipient phone number not in allowed list`

This means:
- ✅ Your credentials are **correct and saved**
- ✅ The API connection is **working**
- ❌ The phone number you're testing with is **not in the allowed recipient list**

## 🔒 Why This Happens

Meta WhatsApp Business API has a **security feature** that restricts who you can send messages to during the testing phase. This prevents spam and ensures you only send messages to verified recipients.

## ✅ Solution: Add Recipient Phone Numbers

### Method 1: Via Meta Business Suite (Recommended)

1. **Go to Meta Business Suite**:
   - Visit: https://business.facebook.com
   - Select your WhatsApp Business Account

2. **Navigate to WhatsApp Settings**:
   - Go to **Settings** → **WhatsApp** → **API Setup**
   - Or go directly to: https://business.facebook.com/latest/whatsapp_manager/api_setup

3. **Add Recipient Numbers**:
   - Scroll down to **"Recipient phone numbers"** section
   - Click **"Add phone number"** or **"Manage phone numbers"**
   - Enter the phone number you want to send test messages to
   - Format: Include country code (e.g., `+919876543210` for India)
   - Click **"Add"** or **"Save"**

4. **Wait for Verification**:
   - Meta may send a verification code to the number
   - Enter the code to verify the number
   - Once verified, you can send messages to that number

### Method 2: Via Meta Developers Portal (API Testing)

1. **Go to Meta Developers**:
   - Visit: https://developers.facebook.com/apps
   - Select your app
   - Go to **WhatsApp** → **API Testing**

2. **Add Recipient Number**:
   - In step 3: **"Add a recipient phone number"**
   - Click the dropdown
   - Click **"Add phone number"**
   - Enter your phone number (with country code)
   - Verify the number if prompted

3. **Test**:
   - You can send test messages to this number
   - Up to 5 numbers can be added for free testing

## 📋 Step-by-Step Instructions

### For Production Use:

1. **Complete Business Verification**:
   - Go to Meta Business Suite → **Business Settings** → **Security**
   - Complete business verification (if not done)
   - This allows you to send to any number (after 24-hour window)

2. **Request Production Access**:
   - Go to **WhatsApp** → **API Setup**
   - Click **"Request Production Access"**
   - Fill out the form
   - Wait for approval (usually 24-48 hours)

3. **Add Recipient Numbers** (if still in testing):
   - Add all phone numbers you want to send to
   - Or wait for production access to send to any number

## 🧪 Testing Your Setup

After adding recipient numbers:

1. **Go back to your FLYP dashboard**
2. **Click "Save & Verify" again** in WhatsApp setup
3. **The test message should now work**

## ⚠️ Important Notes

- **Testing Phase**: You can only send to numbers in your allowed list
- **Production Phase**: After business verification, you can send to any number (with 24-hour messaging window)
- **Free Testing**: Meta provides 1,000 free conversations per month during testing
- **Phone Number Format**: Always use international format with country code (e.g., `+91` for India)

## 🔍 How to Check Your Allowed Recipients

1. Go to: https://business.facebook.com/latest/whatsapp_manager/api_setup
2. Scroll to **"Recipient phone numbers"** section
3. You'll see a list of all allowed numbers

## ✅ Quick Checklist

- [ ] Added recipient phone number in Meta Business Suite
- [ ] Verified the phone number (if required)
- [ ] Tested sending a message from FLYP
- [ ] Message delivered successfully

## 🐛 Still Not Working?

1. **Check phone number format**: Must include country code (e.g., `+919876543210`)
2. **Wait a few minutes**: Changes may take a moment to propagate
3. **Verify in Meta**: Check that the number appears in your allowed list
4. **Try a different number**: Test with a number you know is verified
5. **Check Meta Business Account status**: Ensure your account is active

## 📞 Need Help?

- **Meta Support**: https://developers.facebook.com/support
- **WhatsApp Business API Docs**: https://developers.facebook.com/docs/whatsapp

