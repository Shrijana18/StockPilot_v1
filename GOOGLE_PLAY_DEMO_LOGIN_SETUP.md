# Google Play Console - Demo Login Details Setup

## 🚨 Issue
Your app was rejected because **demo or guest account details** were not provided. Google Play reviewers need valid login credentials to test your app.

## 📍 Where to Add Demo Login Details

### Step-by-Step Instructions:

1. **Go to Google Play Console**
   - Visit: https://play.google.com/console
   - Sign in with your developer account

2. **Navigate to Your App**
   - Select your app: **FLYP-OrderNow** (com.flypnow.shop)

3. **Go to App Content Section**
   
   **Method 1 (Recommended):**
   - In the left sidebar, click on **"Policy"** → **"App content"**
   - Look for **"App access"** in the list of items
   - Click on **"App access"** or **"App access declaration"**
   
   **Method 2 (Alternative):**
   - Go to **"Publishing overview"** (left sidebar)
   - Scroll down to the **"App content"** section
   - Find **"App access"** in the list
   - Click on it

4. **Configure App Access**
   - You'll see a form asking: **"Does your app require users to sign in or register?"**
   - Select: **"Yes, my app requires users to sign in or register"**
   - This will reveal fields for login credentials

5. **Provide Login Credentials**
   - **Username/Phone Number:** 
     - For your customer app: Enter the test phone number (e.g., `9999999999`)
     - Format: 10-digit phone number
   - **Password:** 
     - If your app uses phone + name (no password), leave blank or enter "N/A"
     - Add note in instructions that no password is needed
   - **Additional instructions:** 
     ```
     Login Method: Phone Number + Name
     Phone: [Your test phone number]
     Name: Demo User (or any name)
     Note: This app uses phone number authentication. Enter the phone number and any name on the login screen. No password required.
     This is a customer account for testing the marketplace features including browsing stores, viewing products, and placing orders.
     ```

## 📝 What Information to Provide

### Required Information:

1. **Demo Account Credentials:**
   - **Email/Username:** Create a test account specifically for Google reviewers
   - **Password:** Provide a clear, working password
   - **Account Type:** Specify if it's a retailer, distributor, or customer account

2. **Account Access Details:**
   - Explain what features are available with this account
   - Mention if there are any restrictions or limitations
   - Provide any special instructions (e.g., "Use this account to test customer ordering features")

3. **Additional Instructions (if needed):**
   - If your app has multiple user roles, explain which role this account has
   - If certain features require additional setup, mention it here
   - If there are any test data or sample stores/products available, mention them

## ✅ Recommended Demo Account Setup

### For FLYP-OrderNow Customer App

Your customer app uses **phone number + name** authentication. Here's what to provide:

#### Option 1: Create a Test Customer Account

1. **Create a test customer account** in your app using:
   - **Phone Number:** Use a test number (e.g., `9999999999` or `9876543210`)
   - **Name:** "Google Play Reviewer" or "Demo User"
   
2. **In Google Play Console, provide:**
   - **Phone Number:** `9999999999` (or your test number)
   - **Name:** `Demo User` (or any name)
   - **Additional Instructions:** 
     ```
     This is a customer account for FLYP-OrderNow marketplace app.
     Login method: Enter phone number and name on the login screen.
     No password required - the app uses phone number authentication.
     This account can browse stores, view products, and place test orders.
     ```

#### Option 2: Use Existing Test Account

If you already have a test customer account:
- Note the phone number used
- Ensure the account is active and working
- Test that it can access all major features (browse stores, view products, etc.)
- Document any limitations in the additional instructions field

#### Option 3: Provide Guest Access Instructions

If your app supports guest browsing:
- Select: **"No, my app does not require users to sign in"**
- Explain in additional instructions that reviewers can browse without login
- If certain features require login, mention which ones and provide credentials

### Important Notes for Phone Number Authentication:

- **Format:** Provide the phone number in the format your app expects (10 digits for India: `9999999999`)
- **Instructions:** Clearly explain that the app uses phone number + name, not email/password
- **Testing:** Make sure the test phone number works in your app before submitting
- **Availability:** Ensure test stores/products are available for reviewers to see

## 🔍 Quick Navigation Path

**Direct Path:**
```
Google Play Console 
→ Select App (FLYP-OrderNow)
→ Policy (left sidebar)
→ App content
→ App access
```

**Alternative Path:**
```
Google Play Console
→ Select App
→ Publishing overview
→ Scroll to "App content" section
→ Click "App access"
```

## 📋 Checklist Before Submitting

- [ ] Demo account created and tested
- [ ] Login credentials are correct and working
- [ ] Account has access to all major app features
- [ ] Instructions are clear and complete
- [ ] Credentials added in "App access" section
- [ ] Changes saved
- [ ] App resubmitted for review

## 🚀 After Adding Credentials

1. **Save the changes** in the App access section
2. **Go back to Publishing overview**
3. **Click "Send changes to Google for review"**
4. **Wait for review** (usually 1-3 days)

## ⚠️ Important Notes

- **Security:** Use a dedicated demo account, not a production account
- **Validity:** Ensure the account remains active during the review process
- **Testing:** Test the credentials yourself before submitting
- **Clarity:** Provide clear instructions if the app has complex login flows
- **Multiple Roles:** If your app has different user types, mention which one the demo account represents

## 📞 If You Need Help

If you can't find the "App access" section:
1. Make sure you're in the correct app (FLYP-OrderNow)
2. Check that you're on the "Policy" → "App content" page
3. Look for any section related to "Login credentials" or "Testing credentials"
4. The section might be under "Store presence" → "App access" in some console versions

## 🔗 Direct Links (After Login)

Once logged into Play Console, you can navigate directly to:
- **App Content:** `https://play.google.com/console/u/0/developers/[YOUR_DEV_ID]/app/[APP_ID]/policy/app-content`
- **Publishing Overview:** `https://play.google.com/console/u/0/developers/[YOUR_DEV_ID]/app/[APP_ID]/publishing`

Replace `[YOUR_DEV_ID]` and `[APP_ID]` with your actual IDs.

---

## 📋 Quick Copy-Paste Template

Use this template when filling out the App access form:

### For Phone Number Authentication (Customer App):

**Question: Does your app require users to sign in or register?**
- ✅ **Yes, my app requires users to sign in or register**

**Username/Phone:**
```
9999999999
```
(Replace with your actual test phone number)

**Password:**
```
N/A - App uses phone number + name authentication
```

**Additional Instructions:**
```
FLYP-OrderNow Customer App - Demo Account

Login Method: Phone Number + Name (No password required)

Steps to Login:
1. Open the app
2. Enter phone number: 9999999999
3. Enter any name (e.g., "Demo User")
4. Tap Login

Account Type: Customer account for marketplace
Features Available: Browse stores, view products, add to cart, place orders

Note: This is a test account created specifically for Google Play review. The app uses phone number authentication, not email/password.
```

---

## 🎯 Quick Action Steps

1. ✅ **Create test customer account** in your app (if not exists)
   - Use phone: `9999999999` (or your preferred test number)
   - Name: `Demo User`

2. ✅ **Test the login** yourself to ensure it works

3. ✅ **Go to Play Console** → Your App → **Policy** → **App content** → **App access**

4. ✅ **Fill in the form** using the template above

5. ✅ **Save changes**

6. ✅ **Go to Publishing overview** → **Send changes to Google for review**

7. ✅ **Wait for review** (typically 1-3 business days)

---

**Next Steps:**
1. Create or identify a demo account
2. Navigate to App access section in Play Console
3. Add the credentials using the template above
4. Save and resubmit for review
