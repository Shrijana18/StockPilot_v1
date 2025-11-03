# Firebase Email Setup Guide

## Quick Fix: Use Firebase Default Email Sender

**This is the easiest solution and works immediately!**

### Steps:

1. **Go to Firebase Console:**
   - Navigate to: `https://console.firebase.google.com/project/stockpilotv1/authentication/emails`

2. **Edit Email Address Verification Template:**
   - Click the **Edit** (pencil icon) next to "Email address verification"
   
3. **Change Sender Settings:**
   - **From:** Change to `noreply@stockpilotv1.firebaseapp.com`
   - **Sender name:** Keep "FLYP Team" (or change as needed)
   - **Reply to:** Can keep `admin@flypnow.com` or remove it

4. **Remove Custom SMTP (if configured):**
   - Go to **SMTP Settings** (left sidebar)
   - Either **disable** custom SMTP or **leave it empty**
   - Save

5. **Save Changes:**
   - Click **Save** on the email template

### Result:
✅ Emails will now send immediately  
✅ No password required  
✅ Works reliably  
✅ You can switch to custom SMTP later

---

## Alternative: Set Up Custom SMTP (If Needed Later)

### If Using Gmail (`admin@flypnow.com` with Gmail):

1. **Enable 2-Step Verification:**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification if not already enabled

2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it: "Firebase Authentication"
   - Click "Generate"
   - **Copy the 16-character password** (you'll see it only once!)

3. **Configure in Firebase:**
   - Go to Firebase Console → Authentication → SMTP Settings
   - **SMTP host:** `smtp.gmail.com`
   - **SMTP port:** `587`
   - **SMTP username:** `admin@flypnow.com`
   - **SMTP password:** Paste the App Password (16 characters)
   - **Security mode:** `STARTTLS`
   - Save

### If Using Other Email Providers:

**For cPanel/Shared Hosting:**
- Check your hosting control panel → Email Accounts
- Look for "Email Client Configuration" or "SMTP Settings"
- Use the SMTP server provided by your host
- Generate an app-specific password from your email provider

**For Microsoft 365:**
- Go to: https://admin.microsoft.com/
- Users → Active users → Select user → Mail → Email apps
- Enable SMTP AUTH if needed
- Generate App Password from Security settings

**For Zoho Mail:**
- Go to: https://accounts.zoho.com/
- Security → App Passwords
- Generate password for "Mail" app
- Use SMTP: `smtp.zoho.com`, Port: `587`

---

## Current Status (After Our Fixes):

✅ **Registration works** - Users can register and get redirected to dashboard  
✅ **Login works** - Email verification doesn't block login anymore  
✅ **Email verification** - Still recommended but optional  
✅ **Default sender ready** - Just need to switch in Firebase Console

---

## Testing Email Verification:

After switching to default Firebase sender:
1. Register a new account
2. Check inbox (and spam folder) for verification email
3. Click the verification link
4. Email will be verified ✅

**Note:** If emails still don't arrive, check:
- Spam/Junk folder
- Firebase Console → Usage tab (check email quota)
- Firebase project billing (Blaze plan required for production email)

---

## Quick Command to Check Firebase Email Status:

```bash
# Check if custom domain is causing issues
firebase functions:config:get
```

---

**Recommendation:** Start with Firebase default sender, then set up custom SMTP later when you have the credentials ready!

