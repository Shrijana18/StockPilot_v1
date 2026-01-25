# iOS App Store Publishing Guide - FLYP Shop

This guide explains how to publish your iOS customer app (FLYP Shop) to the Apple App Store and make it publicly available.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Apple Developer Account](#apple-developer-account)
3. [App Store Connect Setup](#app-store-connect-setup)
4. [App Configuration](#app-configuration)
5. [Certificates & Provisioning Profiles](#certificates--provisioning-profiles)
6. [Building for Release](#building-for-release)
7. [App Store Submission](#app-store-submission)
8. [App Review Process](#app-review-process)
9. [Alternative: TestFlight Beta Testing](#alternative-testflight-beta-testing)
10. [Costs & Pricing](#costs--pricing)

---

## Prerequisites

Before you can publish to the App Store, you need:

1. **macOS computer** with Xcode installed
2. **Apple ID** (free account)
3. **Apple Developer Program membership** ($99/year) - **REQUIRED for App Store**
4. **App Store Connect access** (comes with Developer Program)
5. **App ready for release** (fully tested and functional)

---

## Apple Developer Account

### What is it?

The **Apple Developer Program** is Apple's paid membership program that allows you to:
- Publish apps to the App Store
- Distribute apps to users
- Access beta testing via TestFlight
- Use advanced app capabilities
- Get technical support

### Types of Accounts

| Account Type | Cost | App Store Publishing | TestFlight | Device Limit |
|-------------|------|---------------------|------------|--------------|
| **Free Apple ID** | $0 | ❌ No | ❌ No | Limited (7 days) |
| **Apple Developer Program** | $99/year | ✅ Yes | ✅ Yes | Unlimited |
| **Enterprise Program** | $299/year | ❌ No | ❌ No | Internal only |

**For App Store publishing, you NEED the $99/year Apple Developer Program.**

### How to Enroll

1. **Go to**: https://developer.apple.com/programs/
2. **Click**: "Enroll" button
3. **Sign in** with your Apple ID
4. **Choose entity type**:
   - **Individual**: Personal account (faster approval, 1-2 days)
   - **Organization**: Company account (requires D-U-N-S number, 1-2 weeks)
5. **Complete enrollment**:
   - Provide contact information
   - Accept agreements
   - Pay $99/year (auto-renewable)
6. **Wait for approval** (usually 24-48 hours)

### After Enrollment

Once approved, you'll have access to:
- **App Store Connect**: https://appstoreconnect.apple.com
- **Developer Portal**: https://developer.apple.com/account
- **Certificates, Identifiers & Profiles**: For code signing

---

## App Store Connect Setup

App Store Connect is where you manage your apps, submit for review, and track analytics.

### Step 1: Create App Record

1. **Login**: https://appstoreconnect.apple.com
2. **Go to**: "My Apps" → Click "+" → "New App"
3. **Fill in details**:
   - **Platform**: iOS
   - **Name**: "FLYP Shop" (or your preferred name)
   - **Primary Language**: English (or your choice)
   - **Bundle ID**: Select `com.flypnow.shop` (create if needed)
   - **SKU**: Unique identifier (e.g., "flyp-shop-001")
   - **User Access**: Full Access (or Limited if you have a team)

### Step 2: Configure App Information

#### App Information Tab
- **Name**: FLYP Shop
- **Subtitle**: Quick delivery from local stores (optional)
- **Category**: 
  - Primary: Food & Drink or Shopping
  - Secondary: (optional)
- **Privacy Policy URL**: Required (must be publicly accessible)
- **Support URL**: Your support website/email

#### Pricing and Availability
- **Price**: Free or Paid (set price tier)
- **Availability**: All countries or specific regions
- **App Availability Date**: When to release

### Step 3: Prepare App Store Listing

You'll need to provide:

1. **App Screenshots** (required):
   - iPhone 6.7" (iPhone 14 Pro Max): 1290 x 2796 pixels
   - iPhone 6.5" (iPhone 11 Pro Max): 1242 x 2688 pixels
   - iPhone 5.5" (iPhone 8 Plus): 1242 x 2208 pixels
   - iPad Pro 12.9": 2048 x 2732 pixels
   - At least 3 screenshots per device size

2. **App Icon**: 1024 x 1024 pixels (already have this!)

3. **App Preview Video** (optional but recommended):
   - 15-30 seconds
   - Shows app in action
   - MP4 or MOV format

4. **Description**: 
   - Up to 4000 characters
   - Explain what your app does
   - Highlight key features

5. **Keywords**: 
   - Up to 100 characters
   - Comma-separated
   - Used for App Store search

6. **Promotional Text** (optional):
   - Up to 170 characters
   - Can be updated without resubmission

7. **What's New** (for updates):
   - Release notes
   - What changed in this version

---

## App Configuration

### Update Bundle ID in Xcode

1. **Open**: `ios-customer/App/App.xcworkspace` in Xcode
2. **Select**: Project in Navigator → "App" target
3. **Go to**: "Signing & Capabilities" tab
4. **Set**: 
   - **Team**: Your Apple Developer team
   - **Bundle Identifier**: `com.flypnow.shop`
   - **Automatically manage signing**: ✅ Checked

### Update Version Numbers

1. **In Xcode**: Select "App" target → "General" tab
2. **Set**:
   - **Version**: `1.0.0` (user-facing)
   - **Build**: `1` (internal, increment for each submission)

Or update in `Info.plist`:
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
<key>CFBundleVersion</key>
<string>1</string>
```

### Configure App Capabilities

In Xcode → "Signing & Capabilities":
- Add capabilities you need (Push Notifications, In-App Purchase, etc.)
- Configure associated services

---

## Certificates & Provisioning Profiles

### Automatic Signing (Recommended)

Xcode can automatically manage certificates and provisioning profiles:

1. **In Xcode**: Project → Target → "Signing & Capabilities"
2. **Check**: "Automatically manage signing"
3. **Select**: Your Team
4. **Xcode will**:
   - Create certificates automatically
   - Generate provisioning profiles
   - Handle renewals

### Manual Signing (Advanced)

If you need manual control:

1. **Developer Portal**: https://developer.apple.com/account
2. **Certificates**: Create Distribution Certificate
3. **Identifiers**: Verify Bundle ID exists
4. **Profiles**: Create App Store Distribution Profile
5. **Download** and install in Xcode

---

## Building for Release

### Step 1: Archive the App

1. **In Xcode**: Select "Any iOS Device" or "Generic iOS Device" (not a simulator)
2. **Product** → **Archive**
3. **Wait** for archive to complete (may take a few minutes)
4. **Organizer window** will open automatically

### Step 2: Validate Archive

Before uploading, validate your archive:

1. **In Organizer**: Select your archive
2. **Click**: "Validate App"
3. **Select**: Distribution method → "App Store Connect"
4. **Follow**: Validation wizard
5. **Fix**: Any issues found

### Step 3: Distribute App

1. **In Organizer**: Select validated archive
2. **Click**: "Distribute App"
3. **Choose**: "App Store Connect"
4. **Select**: Distribution options
5. **Upload**: Archive will be uploaded (may take 10-30 minutes)

### Alternative: Command Line Build

You can also build from command line:

```bash
# Build archive
xcodebuild -workspace ios-customer/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/App.xcarchive \
  archive

# Export for App Store
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist
```

---

## App Store Submission

### Step 1: Upload Build

After distributing from Xcode:
1. **Wait**: 10-30 minutes for processing
2. **Check**: App Store Connect → "TestFlight" or "App Store" tab
3. **Build appears**: Under "Build" section

### Step 2: Complete App Store Listing

1. **Go to**: App Store Connect → Your App → "App Store" tab
2. **Complete** all required sections:
   - Screenshots
   - Description
   - Keywords
   - Support URL
   - Marketing URL (optional)
   - Privacy Policy URL (required)
   - Category
   - Age Rating

### Step 3: Select Build

1. **In App Store tab**: Scroll to "Build" section
2. **Click**: "+" to add build
3. **Select**: Your uploaded build
4. **Save**

### Step 4: Submit for Review

1. **Review**: All information is complete
2. **Scroll**: To top of page
3. **Click**: "Submit for Review"
4. **Answer**: Export compliance questions (if applicable)
5. **Confirm**: Submission

### Step 5: Review Status

You'll see status updates:
- **Waiting for Review**: In queue
- **In Review**: Apple is reviewing
- **Pending Developer Release**: Approved, waiting for you
- **Ready for Sale**: Live on App Store
- **Rejected**: Issues found (you'll get feedback)

---

## App Review Process

### What Apple Reviews

Apple reviews apps for:
- **Functionality**: App works as described
- **Content**: Follows App Store guidelines
- **Design**: Meets quality standards
- **Legal**: Compliance with laws
- **Privacy**: Privacy policy and data handling
- **Technical**: No crashes, proper permissions

### Review Time

- **First submission**: 1-3 days typically
- **Updates**: Usually faster (24-48 hours)
- **Rejections**: Fix and resubmit (adds time)

### Common Rejection Reasons

1. **Missing Privacy Policy**: Required for apps that collect data
2. **Crashes**: App crashes during testing
3. **Incomplete Information**: Missing screenshots, descriptions
4. **Guideline Violations**: Content or functionality issues
5. **Metadata Issues**: Misleading descriptions or keywords

### If Rejected

1. **Read**: Rejection reason carefully
2. **Fix**: Issues mentioned
3. **Resubmit**: With explanation of fixes
4. **Appeal**: If you disagree (via Resolution Center)

---

## Alternative: TestFlight Beta Testing

Before public release, test with real users via TestFlight:

### Benefits

- **Free**: Included with Developer Program
- **Up to 10,000 testers**: Internal + External
- **No App Review**: For internal testers (up to 100)
- **Real device testing**: On actual iPhones/iPads
- **Feedback collection**: Built-in feedback tools

### Setup TestFlight

1. **Upload build**: Same as App Store (use "TestFlight" distribution)
2. **Add testers**:
   - **Internal**: Team members (up to 100)
   - **External**: Public testers (up to 10,000, requires review)
3. **Send invites**: Testers get email with TestFlight app link
4. **Collect feedback**: Testers can report issues

### TestFlight Review (External Testers)

- **First build**: Requires App Review (1-2 days)
- **Subsequent builds**: Usually faster (few hours)
- **Review is lighter**: Focus on functionality, not polish

---

## Costs & Pricing

### One-Time Costs

- **Apple Developer Program**: $99/year (required)
- **App development**: Your time/costs
- **Design assets**: Screenshots, videos (optional)

### Ongoing Costs

- **Developer Program renewal**: $99/year
- **App maintenance**: Updates, bug fixes
- **Server costs**: If app uses backend (Firebase, etc.)

### App Store Fees

- **Free apps**: No fee (but still need Developer Program)
- **Paid apps**: Apple takes 30% commission (15% after first year for subscriptions)
- **In-App Purchases**: 30% commission (15% after first year)

### Revenue Share

- **First year**: Apple takes 30%, you get 70%
- **After first year** (subscriptions): Apple takes 15%, you get 85%
- **Small Business Program**: If revenue < $1M/year, you get 85% from start

---

## Step-by-Step Checklist

### Before Starting

- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Wait for approval (24-48 hours)
- [ ] Have Apple ID ready
- [ ] Prepare app icon (1024x1024)
- [ ] Prepare screenshots
- [ ] Write app description
- [ ] Create privacy policy URL

### Development Phase

- [ ] Configure Bundle ID: `com.flypnow.shop`
- [ ] Set up code signing in Xcode
- [ ] Test app thoroughly
- [ ] Fix all bugs
- [ ] Set version numbers (1.0.0, Build 1)

### Pre-Submission

- [ ] Build archive in Xcode
- [ ] Validate archive
- [ ] Fix validation errors
- [ ] Create App Store Connect app record
- [ ] Complete app information
- [ ] Upload screenshots
- [ ] Write description and keywords
- [ ] Add privacy policy URL

### Submission

- [ ] Distribute archive to App Store Connect
- [ ] Wait for processing (10-30 min)
- [ ] Select build in App Store Connect
- [ ] Complete all required fields
- [ ] Submit for review
- [ ] Answer export compliance questions

### Post-Submission

- [ ] Monitor review status
- [ ] Respond to any questions from Apple
- [ ] If rejected, fix issues and resubmit
- [ ] Once approved, app goes live!

---

## Quick Start Commands

### Build and Archive

```bash
# 1. Build customer web app
npm run build:customer

# 2. Sync to iOS
npm run ios:customer

# 3. Open Xcode
open ios-customer/App/App.xcworkspace

# 4. In Xcode:
#    - Select "Any iOS Device"
#    - Product → Archive
#    - Distribute App → App Store Connect
```

### Update Version

```bash
# Update version in Info.plist or Xcode
# Version: 1.0.0 (user-facing)
# Build: 1, 2, 3... (increment for each submission)
```

---

## Important Notes

1. **Privacy Policy**: Required if your app collects any user data (even analytics)
2. **App Review**: Can take 1-3 days for first submission
3. **Updates**: Each update requires new build number
4. **Rejections**: Common, don't panic - fix and resubmit
5. **TestFlight**: Great way to test before public release
6. **Support**: Apple provides support via App Store Connect

---

## Resources

- **Apple Developer**: https://developer.apple.com
- **App Store Connect**: https://appstoreconnect.apple.com
- **App Store Review Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/
- **TestFlight**: https://developer.apple.com/testflight/

---

## Support

If you encounter issues:

1. **Apple Developer Support**: Available via App Store Connect
2. **Developer Forums**: https://developer.apple.com/forums/
3. **Documentation**: https://developer.apple.com/documentation/

---

**Good luck with your App Store submission! 🚀**
