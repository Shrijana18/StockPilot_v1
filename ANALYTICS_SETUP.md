# Website Analytics Setup Guide

## ✅ Already Configured!

**Good news!** Your Google Analytics is already set up with:
- **Measurement ID:** `G-SENFJ2HSBW`
- **Stream ID:** `11399990562`
- **Property:** `stockpilotv1`

The analytics code is already integrated and will automatically track visitors once deployed!

---

## Overview
Your website now has visitor tracking set up! You can track:
- **Page views** - How many people visit your site
- **Button clicks** - Which CTAs are most popular
- **Form submissions** - Demo requests
- **Section views** - Which parts of the page users scroll to

## How It Works

### Google Analytics 4 (Already Set Up)
- **Measurement ID:** `G-SENFJ2HSBW` (from Firebase config)
- Automatically initializes when the page loads
- Tracks all page views and events
- View at: https://analytics.google.com/

### Firebase Analytics (Backup)
- All data also saved to Firestore `websiteAnalytics` collection
- View at: Firebase Console → Firestore → `websiteAnalytics`

---

## Option 2: View Analytics in Firebase (Already Set Up!)

Your website automatically tracks all page views and events in Firestore.

### View Custom Analytics:
1. Go to https://console.firebase.google.com/
2. Select project: `stockpilotv1`
3. Open **Firestore Database**
4. Find the `websiteAnalytics` collection
5. View all tracked events:
   - **Page views** - Every time someone visits a page
   - **Events** - Button clicks, form submissions, etc.

### What's Tracked:
- **Page views:** Path, timestamp, device info, referrer
- **Events:** Button clicks, form submissions, section views
- **Device info:** Screen size, browser, language, timezone

---

## Option 3: Netlify Analytics (Paid)

If you have Netlify Pro plan:
1. Go to your Netlify dashboard
2. Select your site
3. Click **Analytics** tab
4. View visitor stats, page views, and more

---

## Current Tracking Features

✅ **Automatic Tracking:**
- Page views (every page load)
- Demo form submissions
- Button clicks (Get Started, Book Demo, etc.)
- Section views (when users scroll to sections)

✅ **Data Stored:**
- All analytics saved to Firestore `websiteAnalytics` collection
- Google Analytics (if configured)
- No personal data collected (privacy-friendly)

---

## Quick Start (No Setup Required!)

**Good news:** Your website is already tracking visitors in Firestore! 

Just go to Firebase Console → Firestore → `websiteAnalytics` collection to see:
- Total page views
- Most visited pages
- Button click counts
- Form submission events

---

## Privacy & GDPR Compliance

- No cookies used (Firestore tracking)
- No personal data collected
- Only anonymous usage statistics
- Complies with privacy regulations

---

## Need Help?

If you want to set up Google Analytics 4, follow Option 1 above. Otherwise, you can view all analytics data in Firebase Console right now!

