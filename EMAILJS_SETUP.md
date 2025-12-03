# EmailJS Setup Instructions

## Quick Setup Guide

To enable email sending from the demo form, you need to set up EmailJS (free service):

### Step 1: Create EmailJS Account
1. Go to https://www.emailjs.com/
2. Sign up for a free account (allows 200 emails/month)

### Step 2: Add Email Service
1. In EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Choose your email provider (Gmail, Outlook, etc.) or use **Custom SMTP**
4. Follow the setup instructions
5. **Copy your Service ID** (e.g., `service_xxxxx`)

### Step 3: Create Email Template
1. Go to **Email Templates** in EmailJS dashboard
2. Click **Create New Template**
3. Use this template:

**Template Name:** Demo Request

**Subject:** New Demo Request - {{from_name}}

**Content:**
```
New Demo Request from FLYP Landing Page

Name: {{name}}
Business Category: {{business_category}}
Role: {{role}}
Phone: {{phone}}
Email: {{email}}

Submitted at: {{submitted_at}}

---
This email was sent from the FLYP landing page demo form.
```

4. Set **To Email:** `admin@flypnow.com`
5. **Copy your Template ID** (e.g., `template_xxxxx`)

### Step 4: Get Public Key
1. Go to **Account** → **General**
2. Copy your **Public Key** (e.g., `xxxxxxxxxxxxx`)

### Step 5: Configure Environment Variables
1. Copy `.env.example` to `.env` in your project root:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` file and replace the placeholder values:
   ```
   VITE_EMAILJS_SERVICE_ID=service_abc123
   VITE_EMAILJS_TEMPLATE_ID=template_xyz789
   VITE_EMAILJS_PUBLIC_KEY=abcdefghijklmnop
   ```

3. **Important:** Add `.env` to `.gitignore` to keep your keys secure!

### Step 6: Test
1. Fill out the demo form on your landing page
2. Submit it
3. Check `admin@flypnow.com` inbox for the email

## How It Works

The form now uses EmailJS to send emails directly to `admin@flypnow.com` without opening the user's email client. The code automatically:
- Validates all required fields
- Formats the submission data
- Sends it via EmailJS to your email
- Shows a success message to the user

All submissions will be sent to: **admin@flypnow.com**

## Troubleshooting

- **Emails not sending?** Check EmailJS dashboard for error logs
- **Rate limit?** Free plan allows 200 emails/month
- **Need more emails?** Upgrade to paid plan or use custom SMTP

## Security Note

The Public Key is safe to expose in frontend code. EmailJS uses it to authenticate requests, but it's designed to be public.

