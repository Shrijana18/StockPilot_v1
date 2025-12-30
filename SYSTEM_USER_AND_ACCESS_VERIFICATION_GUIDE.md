# System User & Access Verification Guide

## 🎯 Quick Answers to Your Questions

### **Question 1: System User Role - Employee or Admin?**

**Answer: Use "Employee" role** ✅

**Why:**
- System Users for Tech Providers should use **"Employee"** role (not Admin)
- "Employee" role is sufficient for managing WhatsApp Business Accounts on behalf of clients
- "Admin" role is typically reserved for human administrators who need full business access
- Meta's documentation recommends "Employee" for automated system access

**What you should do:**
- Keep your system user "FLYP Employee" with **Employee** role selected
- This is the correct choice for Tech Provider use case

---

### **Question 2: Where to Grant Permissions When Generating Token?**

**Answer: Permissions are granted during the "Assign permissions" step**

**Step-by-Step Process:**

1. **After creating the System User:**
   - Go to System Users page
   - Click on "FLYP Employee" (your system user)
   - Click "Generate New Token" button

2. **Step 1: Select App**
   - Select your app from the dropdown
   - Click "Next"

3. **Step 2: Set Expiration**
   - Choose token expiration (recommended: "Never" for production, or set a long expiration)
   - Click "Next"

4. **Step 3: Assign Permissions** ← **THIS IS WHERE YOU GRANT PERMISSIONS**
   - You'll see a list of available permissions
   - **Select these permissions:**
     - ✅ `whatsapp_business_management`
     - ✅ `whatsapp_business_messaging`
     - ✅ `business_management`
   - If you see "No permissions available" (like in your screenshot):
     - **This means you need to assign app roles first!**
     - Go back to System User settings
     - Click on "FLYP Employee"
     - Click "Assign Assets" or "Assign App Roles"
     - Assign the app to the system user with appropriate roles
     - Then try generating token again

5. **Step 4: Generate Token**
   - Review selected permissions
   - Click "Generate Token"
   - **⚠️ IMPORTANT:** Copy the token immediately - you won't see it again!

---

### **How to Fix "No Permissions Available" Error:**

If you see "No permissions available" when generating token:

1. **Go back to System User:**
   - Meta Business Suite → Business Settings → System Users
   - Click on "FLYP Employee"

2. **Assign App to System User:**
   - Look for "Assets" or "Apps" section
   - Click "Assign Assets" or "Add Assets"
   - Select your app
   - Assign with role: "Employee" or "Admin" (for the app, not the system user)

3. **Then Generate Token Again:**
   - Go back to token generation
   - Permissions should now be available

---

### **Question 3: Access Verification Form - How to Fill It Out**

Based on your screenshot, here's how to fill out the **Access Verification Form**:

#### **Question 1: Which options best describe your business?**

**Answer: Select "SaaS Platform"** ✅ (You already have this selected - correct!)

**Why:**
- FLYP is a SaaS platform that provides WhatsApp Business API services to distributors
- You're building a platform where clients (distributors) can use WhatsApp messaging
- This is the most accurate description for a Tech Provider

---

#### **Question 2: How will your business use Platform Data?**

**Answer Template:**

```
We are a B2B SaaS platform (StockPilot) that connects distributors with retailers across India. Our platform enables distributors to send WhatsApp messages to their retailers for order management, product catalogs, and business communication.

Platform Data Usage:
- We use WhatsApp Business API data to enable distributors to send automated messages to retailers
- We use message status data to track delivery and read receipts for distributors
- We use business account data to manage WhatsApp Business Accounts (WABAs) on behalf of our distributor clients
- All data is used exclusively within our platform to provide messaging services to our clients
- Clients use our service to communicate with their retailers about orders, products, and business updates

How it works:
1. Distributors sign up on our platform
2. We create and manage a WhatsApp Business Account for each distributor
3. Distributors can send messages to their retailers through our platform
4. We handle all technical integration with Meta's WhatsApp Business API
5. Distributors see message status and responses in our platform dashboard

This service enables distributors to scale their communication with hundreds of retailers without needing to set up their own Meta apps or manage technical credentials.
```

**Key Points to Include:**
- ✅ Clear description of your service
- ✅ How Platform Data is used
- ✅ Who benefits (distributors and retailers)
- ✅ Technical implementation (Tech Provider model)
- ✅ Keep it concise (2-3 paragraphs)

---

#### **Question 3: Does your business manage multiple business portfolios?**

**Answer: Select "No"** ✅ (You already have this selected - correct!)

**Why:**
- You're managing WhatsApp Business Accounts (WABAs) for clients, not multiple business portfolios
- Each distributor gets their own WABA, but they're all under your Tech Provider app
- This is different from managing multiple Meta Business portfolios

**Note:** If Meta asks for clarification later, you can explain that you manage multiple client WABAs under a single business portfolio.

---

#### **Question 4: Provide a link to your website**

**Answer:**
```
https://stockpilotv1.web.app
```

**Or if you have a dedicated landing page:**
```
https://stockpilotv1.web.app/whatsapp
```

**Requirements:**
- ✅ Must be a valid, accessible URL
- ✅ Should show your service/business
- ✅ Should demonstrate the WhatsApp integration (if possible)
- ✅ Make sure the website is live and accessible

**What to ensure on your website:**
- Clear description of your business
- Information about WhatsApp Business API services
- Contact information
- Terms of service (if applicable)
- Privacy policy (recommended)

---

## 📋 Complete Checklist

### **System User Setup:**
- [x] System User created: "FLYP Employee"
- [x] Role: **Employee** (correct choice)
- [ ] App assigned to System User
- [ ] Token generated with permissions:
  - [ ] `whatsapp_business_management`
  - [ ] `whatsapp_business_messaging`
  - [ ] `business_management`
- [ ] Token saved securely (will be used as `META_SYSTEM_USER_TOKEN`)

### **Access Verification Form:**
- [x] Question 1: "SaaS Platform" selected ✅
- [ ] Question 2: Use case description filled out
- [x] Question 3: "No" selected ✅
- [ ] Question 4: Website URL provided
- [ ] Form submitted

---

## 🚨 Common Issues & Solutions

### **Issue: "No permissions available" when generating token**

**Solution:**
1. Go to System User → "FLYP Employee"
2. Click "Assign Assets" or "Add Assets"
3. Select your app
4. Assign app role
5. Try generating token again

### **Issue: Can't find where to assign app to system user**

**Solution:**
1. Go to: Meta Business Suite → Business Settings → System Users
2. Click on your system user
3. Look for tabs: "Assets", "Apps", or "Permissions"
4. Click "Assign Assets" button
5. Select "Apps" tab
6. Select your app and assign

### **Issue: Access verification form rejected**

**Solution:**
- Review Meta's feedback
- Provide more detailed explanation in Question 2
- Ensure website is accessible and shows your service
- Resubmit with more details

---

## 📝 Next Steps After Completing These

1. **Save System User Token:**
   ```bash
   # Add to functions/.env
   META_SYSTEM_USER_TOKEN=your_token_here
   ```

2. **Submit Access Verification Form:**
   - Review all answers
   - Click "Submit" or "Continue"
   - Wait for Meta's review (usually 24-48 hours)

3. **Continue with App Review:**
   - After access verification is approved
   - Request permissions in App Review
   - Submit demo video

---

## 🔗 Helpful Links

- **System Users:** https://business.facebook.com/settings/system-users
- **Access Verification:** https://developers.facebook.com/apps/{YOUR_APP_ID}/access-verification/
- **App Review:** https://developers.facebook.com/apps/{YOUR_APP_ID}/app-review

---

**Last Updated:** 2024
**Status:** Ready for Implementation

