# FLYP Employee App - Android & iOS Build Guide

## Overview
This guide explains how to build and deploy the FLYP Employee (Delivery Partner) app for both Android and iOS platforms.

## App Details
- **App Name**: FLYP Employee
- **Bundle ID (Android)**: `com.flypnow.employee`
- **Bundle ID (iOS)**: `com.flypnow.employee`
- **App Type**: Delivery Partner / Employee Management App

## Prerequisites
- Node.js >= 22.12.0
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)
- Capacitor CLI installed globally (optional, but recommended)

## Available NPM Scripts

### Development
```bash
npm run dev:employee          # Start dev server on port 5175
```

### Build
```bash
npm run build:employee        # Build web app for production
```

### Android
```bash
npm run android:employee              # Build and sync assets to Android
npm run android:employee -- --apk     # Build and create debug APK
npm run android:employee -- --install  # Build APK and install on connected device
npm run android:employee:release      # Build release AAB for Play Store
```

### iOS
```bash
npm run setup:ios:employee    # Initial iOS setup (run once)
npm run ios:employee          # Build and sync assets to iOS
npm run ios:employee -- --open # Build and open Xcode automatically
```

## Building for Android

### First Time Setup
1. Ensure Android Studio is installed
2. The `android-employee` directory should already exist (created from main android project)

### Build Process
1. **Build web app:**
   ```bash
   npm run build:employee
   ```

2. **Sync to Android:**
   ```bash
   npm run android:employee
   ```

3. **Open in Android Studio:**
   - Open `android-employee` folder in Android Studio
   - Wait for Gradle sync to complete
   - Select your device/emulator
   - Click Run ▶️

### Build APK Directly
```bash
npm run android:employee -- --apk
```
APK will be at: `android-employee/app/build/outputs/apk/debug/app-debug.apk`

### Install on Connected Device
```bash
npm run android:employee -- --install
```
This will build the APK and automatically install it on your connected Android device.

### Release Build (for Play Store)
```bash
npm run android:employee:release
```
This creates an AAB (Android App Bundle) file ready for Play Store submission.

## Building for iOS

### First Time Setup
1. Ensure Xcode is installed (macOS only)
2. Run setup script once:
   ```bash
   npm run setup:ios:employee
   ```

### Build Process
1. **Build web app:**
   ```bash
   npm run build:employee
   ```

2. **Sync to iOS:**
   ```bash
   npm run ios:employee
   ```

3. **Open in Xcode:**
   ```bash
   npm run ios:employee -- --open
   ```
   Or manually:
   - Open `ios-employee/App/App.xcworkspace` in Xcode
   - Select your device or simulator
   - Click Run ▶️

### Important iOS Notes
- You need a valid Apple Developer account to build for physical devices
- For simulator, no account needed
- Make sure to configure signing in Xcode project settings

## Project Structure

```
StockPilot_v1/
├── android-employee/          # Android project for employee app
├── ios-employee/              # iOS project for employee app
├── src/
│   ├── app/
│   │   └── EmployeeApp.jsx   # Main employee app component
│   ├── employee-main.jsx     # Employee app entry point
│   └── components/employee/   # Employee components
├── index.employee.html        # Employee app HTML entry
├── vite.employee.config.js    # Vite config for employee app
└── scripts/
    ├── build-employee-android.js
    ├── build-employee-ios.js
    └── setup-employee-ios.js
```

## Features Included

✅ Employee login with FLYP-RETAIL-XXXXXX ID format
✅ Delivery management dashboard
✅ Real-time chat with customers
✅ Order pickup and delivery tracking
✅ Route navigation with Google Maps
✅ Unread message notifications
✅ Offline support (with Firebase persistence)

## Troubleshooting

### Android Build Issues
- **Gradle sync fails**: Make sure Android SDK is properly installed
- **APK not found**: Check `android-employee/app/build/outputs/apk/debug/`
- **Installation fails**: Enable USB debugging on device, check ADB connection

### iOS Build Issues
- **Xcode won't open**: Make sure `ios-employee/App/App.xcworkspace` exists
- **Signing errors**: Configure signing in Xcode project settings
- **Pod install fails**: Run `cd ios-employee/App && pod install`

### Web Build Issues
- **Build fails**: Check for syntax errors in `src/app/EmployeeApp.jsx`
- **Assets not found**: Ensure `index.employee.html` exists in root

## Next Steps

1. **Test on Device:**
   - Android: Connect device, run `npm run android:employee -- --install`
   - iOS: Open Xcode, select device, click Run

2. **Configure App Icons:**
   - Update icons in `android-employee/app/src/main/res/`
   - Update icons in `ios-employee/App/App/Assets.xcassets/`

3. **Configure App Signing:**
   - Android: Set up keystore for release builds
   - iOS: Configure signing in Xcode

4. **Submit to Stores:**
   - Google Play: Build release AAB and submit
   - App Store: Archive in Xcode and submit via App Store Connect

## Support

For issues or questions, check:
- Android: `android-employee/` directory
- iOS: `ios-employee/` directory
- Build scripts: `scripts/build-employee-*.js`
