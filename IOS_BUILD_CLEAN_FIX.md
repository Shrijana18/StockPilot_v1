# iOS Build Failure - Clean Build Fix

## 🔍 Issue
Build failing with red `Foundation` and `WebKit` frameworks in Pods navigator.

## ✅ Solution: Clean Build Process

The red frameworks are often just a visual quirk. Follow these steps:

### Step 1: Clean Build Folder
1. In Xcode: `Product` → `Clean Build Folder` (Shift+Cmd+K)
2. Wait for cleaning to complete

### Step 2: Clean Derived Data
1. In Xcode: `Xcode` → `Settings` → `Locations`
2. Click arrow next to "Derived Data" path
3. Delete the folder for your project (or all derived data)
4. Or run in terminal:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   ```

### Step 3: Close and Reopen Xcode
1. Quit Xcode completely (Cmd+Q)
2. Reopen: `open ios-customer/App/App.xcworkspace`

### Step 4: Rebuild
1. Select device: "Shri's iPhone" or simulator
2. Build: Click Play (▶️) or press `Cmd + R`

## 🔧 Alternative: Terminal Clean Build

If Xcode clean doesn't work, try terminal:

```bash
cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1/ios-customer/App

# Clean Pods
rm -rf Pods Podfile.lock

# Reinstall Pods
pod install

# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData

# Open Xcode
open App.xcworkspace
```

## ⚠️ About Red Frameworks

**Foundation** and **WebKit** being red in the Pods navigator is often:
- ✅ **Normal** - They're system frameworks, automatically linked
- ✅ **Visual quirk** - Xcode sometimes shows them as red but they work fine
- ❌ **Only a problem** if build actually fails with framework errors

## 📋 Verification

After cleaning, check:
1. ✅ Pods installed: 5 dependencies (Capacitor, CapacitorApp, CapacitorCordova, CapacitorHaptics, CapacitorToast)
2. ✅ Bundle ID: `com.flypnow.shop`
3. ✅ Version: 1.0.9 (Build 10)
4. ✅ Location permissions in Info.plist

## 🚀 Quick Fix Command

Run this one-liner to clean everything:

```bash
cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1/ios-customer/App && \
rm -rf Pods Podfile.lock && \
pod install && \
rm -rf ~/Library/Developer/Xcode/DerivedData && \
open App.xcworkspace
```

Then in Xcode:
- `Product` → `Clean Build Folder` (Shift+Cmd+K)
- Build (Cmd+R)
