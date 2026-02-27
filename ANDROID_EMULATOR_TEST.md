# Android Emulator Testing Guide

## ✅ Build Status
- **Web App:** Built successfully ✓
- **Assets Synced:** Copied to Android project ✓
- **APK Built:** `android-customer/app/build/outputs/apk/debug/app-debug.apk` ✓

## 📱 Install & Run on Emulator

### Option 1: Using Android Studio (Recommended)

1. **Open Android Studio:**
   ```bash
   open android-customer
   ```

2. **Wait for Gradle Sync:**
   - Android Studio will automatically sync the project
   - Wait for "Gradle sync finished" message

3. **Start Emulator:**
   - Click "Device Manager" (phone icon in toolbar)
   - Click "Play" button next to your emulator (e.g., "Pixel 9a API 36.0")
   - Wait for emulator to boot

4. **Run App:**
   - Click the green "Run" button (▶️) in toolbar
   - Or press `Shift + F10`
   - App will build and install automatically

### Option 2: Using Command Line

1. **Start Emulator:**
   ```bash
   # List available emulators
   emulator -list-avds
   
   # Start emulator (replace with your AVD name)
   emulator -avd Pixel_9a_API_36 &
   ```

2. **Wait for Emulator:**
   ```bash
   # Check if emulator is ready
   adb wait-for-device
   ```

3. **Install APK:**
   ```bash
   cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1
   adb install -r android-customer/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Launch App:**
   ```bash
   adb shell am start -n com.flypnow.shop/.MainActivity
   ```

### Option 3: One-Command Install (If Emulator Running)

```bash
cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1
npm run android:customer -- --install
```

This will:
- Build web app
- Sync assets
- Build APK
- Install on connected device/emulator
- Launch app automatically

## 🧪 Testing Checklist

### Profile Page
- [ ] Profile loads correctly
- [ ] Order count shows correct number (should show 2, not 0)
- [ ] Email can be edited
- [ ] Profile picture can be uploaded
- [ ] All sections are visible (no content cut off)
- [ ] Bottom navigation doesn't overlap content

### UI/UX Compatibility
- [ ] No content cut off by bottom navigation
- [ ] Modals appear above bottom nav
- [ ] All text is readable
- [ ] Proper spacing and padding
- [ ] Safe areas respected

### Location Detection
- [ ] Location permission dialog appears
- [ ] Current location can be detected
- [ ] "Use Current Location" button works
- [ ] Falls back to Mumbai if permission denied

### Other Features
- [ ] Home page loads
- [ ] Stores display correctly
- [ ] Search works
- [ ] Cart works
- [ ] Orders page shows 2 orders

## 🔧 Troubleshooting

### Emulator Not Starting
```bash
# Check if emulator is running
adb devices

# If no devices, start emulator from Android Studio
# Or use command line:
emulator -avd <your-avd-name> &
```

### APK Installation Fails
```bash
# Uninstall existing app first
adb uninstall com.flypnow.shop

# Then install again
adb install android-customer/app/build/outputs/apk/debug/app-debug.apk
```

### App Crashes on Launch
1. Check Logcat in Android Studio for errors
2. Verify all assets were copied correctly
3. Check Firebase configuration
4. Verify location permissions in AndroidManifest.xml

### Content Still Cut Off
1. Clean build: `cd android-customer && ./gradlew clean`
2. Rebuild: `npm run android:customer -- --apk`
3. Uninstall and reinstall app

## 📋 APK Location

**Debug APK:**
```
android-customer/app/build/outputs/apk/debug/app-debug.apk
```

**Size:** ~15-20 MB (approximate)

## 🚀 Quick Start

**Fastest way to test:**
```bash
# 1. Make sure emulator is running
adb devices

# 2. Build and install in one command
npm run android:customer -- --install
```

The app will automatically:
- Build web assets
- Sync to Android
- Build APK
- Install on emulator
- Launch app

## ✅ What's Updated

- ✅ Profile enhancements (email editing, picture upload, etc.)
- ✅ Order count fix (shows actual count from database)
- ✅ App compatibility fixes (no content cut off)
- ✅ Location detection improvements
- ✅ UI/UX spacing fixes
- ✅ Modal z-index fixes

**Ready to test!** 🎉
