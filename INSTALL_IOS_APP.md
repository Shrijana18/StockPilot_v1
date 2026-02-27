# Install Updated iOS Customer App

## CRITICAL: Delete Old App First!

The app on your iPhone is the OLD version without Firebase configuration. You MUST delete it first.

### Step 1: Delete Old App from iPhone

1. On your iPhone, find the "FLYP" or "FLYP Shop" app
2. Long press on the app icon
3. Tap "Remove App" → "Delete App"
4. Confirm deletion

### Step 2: Install New App via Xcode

Xcode should already be open with the workspace. If not:

```bash
open -a Xcode /Users/shrijanakwade/Developer/FLYP/StockPilot_v1/ios-customer/App/App.xcworkspace
```

Then in Xcode:

1. **Select your iPhone as destination**:
   - At the top, next to the Play/Stop buttons
   - Click the device dropdown
   - Select "Shri's iPhone" (not a simulator!)

2. **Clean Build** (Important!):
   - Menu: Product → Clean Build Folder
   - Or press: Cmd + Shift + K

3. **Build and Run**:
   - Menu: Product → Run
   - Or press: Cmd + R
   - Wait for build to complete (may take 30-60 seconds)

4. **Trust Developer on iPhone** (if prompted):
   - On iPhone: Settings → General → VPN & Device Management
   - Tap on your Apple ID
   - Tap "Trust"

### Step 3: Test the App

Once installed:

1. **Test Guest Mode**:
   - Open app
   - Allow location when prompted
   - Should see "Stores Near You" with actual stores (not 0)

2. **Test Login**:
   - Tap Profile tab
   - Enter phone: 7218513559
   - Enter name: Shri J
   - Should login successfully

### What Changed?

The new version includes:
- ✅ GoogleService-Info.plist (Firebase iOS config)
- ✅ Correct Bundle ID (com.flypnow.shop)
- ✅ Network security settings
- ✅ Firebase properly initialized

### If It Still Doesn't Work

Check Xcode console for errors:
1. In Xcode, open the Console (View → Debug Area → Activate Console)
2. Look for messages starting with `[Firebase]` or `[CustomerAuth]`
3. Share any error messages

The console should show:
```
[Firebase] Initializing Firebase...
[Firebase] Firestore initialized with long polling
```

If you see connection errors, the old app might still be cached.
