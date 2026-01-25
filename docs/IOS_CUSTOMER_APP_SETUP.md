# iOS Customer App Setup Guide

This guide explains how to set up and build the FLYP Shop (Customer Marketplace) iOS app.

## Overview

The iOS customer app is a separate iOS application with:
- **Bundle ID**: `com.flypnow.shop`
- **App Name**: FLYP Shop
- **Purpose**: Customer marketplace for end users to order from local stores

## Prerequisites

1. **macOS** with Xcode installed (latest version recommended)
2. **Node.js** >= 22.12.0
3. **CocoaPods** installed (`sudo gem install cocoapods`)
4. **Capacitor CLI** (included in dependencies)

## Initial Setup

### Step 1: Create iOS Customer App Structure

Run the setup script to initialize the `ios-customer` directory:

```bash
npm run setup:ios:customer
```

This script will:
- Create the `ios-customer` directory
- Configure it with the correct bundle ID (`com.flypnow.shop`)
- Set up the Xcode project structure
- Configure Info.plist with the app name "FLYP Shop"

**Note**: If you already have an `ios` directory (for the main business app), the script will handle it appropriately.

### Step 2: Install CocoaPods Dependencies

Navigate to the iOS customer app directory and install pods:

```bash
cd ios-customer/App
pod install
cd ../..
```

## Building the App

### Build and Sync Assets

To build the customer web app and sync it to the iOS project:

```bash
npm run ios:customer
```

This will:
1. Build the customer web app (`npm run build:customer`)
2. Prepare `index.html` from `index.customer.html`
3. Update Capacitor config for customer app
4. Sync assets to `ios-customer` using Capacitor
5. Restore original Capacitor config

### Open in Xcode

To build and automatically open Xcode:

```bash
npm run ios:customer:open
```

Or manually open:
```bash
open ios-customer/App/App.xcworkspace
```

**Important**: Always open the `.xcworkspace` file, not the `.xcodeproj` file, as CocoaPods requires the workspace.

## Running the App

### On Simulator

1. Open `ios-customer/App/App.xcworkspace` in Xcode
2. Select a simulator from the device dropdown (e.g., iPhone 15 Pro)
3. Click the Run button (▶️) or press `Cmd + R`

### On Physical Device

1. Connect your iOS device via USB
2. Open `ios-customer/App/App.xcworkspace` in Xcode
3. Select your device from the device dropdown
4. You may need to:
   - Sign in with your Apple ID in Xcode preferences
   - Select your development team in the project settings
   - Trust the developer certificate on your device
5. Click Run (▶️)

## Project Structure

```
ios-customer/
├── App/
│   ├── App/
│   │   ├── AppDelegate.swift      # Main app delegate
│   │   ├── Info.plist             # App configuration
│   │   ├── Assets.xcassets/        # App icons and images
│   │   ├── Base.lproj/             # Storyboards
│   │   └── public/                 # Web app assets (synced by Capacitor)
│   ├── App.xcodeproj/              # Xcode project
│   ├── App.xcworkspace/            # Xcode workspace (use this!)
│   └── Podfile                     # CocoaPods dependencies
```

## Configuration

### Bundle ID

The bundle ID is set to `com.flypnow.shop` in:
- `ios-customer/App/App.xcodeproj/project.pbxproj`
- `ios-customer/App/App/Info.plist` (if needed)

### App Name

The display name is set to "FLYP Shop" in:
- `ios-customer/App/App/Info.plist` (`CFBundleDisplayName`)

### Capacitor Config

The build script temporarily updates `capacitor.config.json` with customer app settings:
- `appId`: `com.flypnow.shop`
- `appName`: `FLYP Shop`
- `webDir`: `dist`
- Background color: `#0a0f1c`

After building, the original config is restored.

## Troubleshooting

### "ios-customer directory not found"

Run the setup script first:
```bash
npm run setup:ios:customer
```

### CocoaPods Issues

If you encounter CocoaPods errors:

```bash
cd ios-customer/App
pod deintegrate
pod install
cd ../..
```

### Build Errors

1. **Clean Build Folder**: In Xcode, go to `Product > Clean Build Folder` (Shift + Cmd + K)
2. **Delete Derived Data**: In Xcode preferences, delete derived data
3. **Reinstall Pods**: Run `pod install` again

### Sync Issues

If assets aren't syncing properly:

1. Manually copy `dist` folder contents to `ios-customer/App/App/public`
2. Or run `npx cap sync ios` after temporarily renaming directories

### Signing Issues

1. Open the project in Xcode
2. Select the project in the navigator
3. Go to "Signing & Capabilities"
4. Select your development team
5. Ensure "Automatically manage signing" is checked

## Development Workflow

1. **Make changes** to the customer app code in `src/customer/`
2. **Build web app**: `npm run build:customer`
3. **Sync to iOS**: `npm run ios:customer`
4. **Test in Xcode**: Open workspace and run

For faster iteration during development:
- Use `npm run dev:customer` to run the web app locally
- Test in browser first
- Then build and sync to iOS when ready

## Release Build

To create a release build:

1. Open `ios-customer/App/App.xcworkspace` in Xcode
2. Select "Any iOS Device" or "Generic iOS Device"
3. Go to `Product > Archive`
4. Follow the App Store Connect workflow

## Differences from Main iOS App

| Feature | Main App (`ios/`) | Customer App (`ios-customer/`) |
|---------|-------------------|-------------------------------|
| Bundle ID | `com.flypnow.ios` | `com.flypnow.shop` |
| App Name | FLYP | FLYP Shop |
| Entry Point | `index.html` | `index.customer.html` |
| Target Users | Business users | End customers |

## Related Scripts

- `npm run setup:ios:customer` - Initial setup
- `npm run ios:customer` - Build and sync
- `npm run ios:customer:open` - Build, sync, and open Xcode
- `npm run build:customer` - Build web app only
- `npm run dev:customer` - Run dev server

## Notes

- The build script temporarily modifies `capacitor.config.json` but restores it afterward
- The script handles directory renaming to work with Capacitor's expectations
- Always use the `.xcworkspace` file, not `.xcodeproj`
- The customer app uses the same Capacitor plugins as the main app
