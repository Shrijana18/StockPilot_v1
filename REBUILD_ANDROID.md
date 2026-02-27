# How to Rebuild Android App with Updated Code

## ✅ Changes Were Made
- ✅ Code updated in `src/customer/views/CustomerHome.jsx`
- ✅ Assets synced to `android-customer/app/src/main/assets/public/`
- ✅ Build completed successfully

## ⚠️ Why You Still See the Issue
The Android app is using **cached assets** or needs a **full rebuild**. Just syncing files isn't enough - you need to rebuild the app.

## 🔧 Steps to Fix in Android Studio

### Option 1: Clean & Rebuild (Recommended)
1. In Android Studio, go to **Build** → **Clean Project**
2. Wait for clean to complete
3. Go to **Build** → **Rebuild Project**
4. Once rebuild completes, click **Run** ▶️ (or press `Shift+F10`)
5. The app will reinstall on your emulator with fresh assets

### Option 2: Uninstall & Reinstall
1. On your emulator, long-press the FLYP Shop app icon
2. Select **Uninstall**
3. In Android Studio, click **Run** ▶️ to install fresh

### Option 3: Clear App Data
1. On emulator: **Settings** → **Apps** → **FLYP Shop** → **Storage** → **Clear Data**
2. Restart the app

## 🚀 Quick Command (Terminal)
If you prefer terminal, run:
```bash
cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1
npm run android:customer
cd android-customer
./gradlew clean
./gradlew assembleDebug
```

Then in Android Studio, just click Run ▶️

## 📱 Verify Changes
After rebuilding, you should see:
- ✅ Tighter spacing between sections
- ✅ "Stores Near You" section appears immediately after categories
- ✅ No large empty gaps
- ✅ Better mobile-optimized layout

## 🔍 If Still Not Working
Check Android Studio Logcat for errors:
- Look for JavaScript errors
- Check if Firebase is connecting
- Verify stores are loading from database
