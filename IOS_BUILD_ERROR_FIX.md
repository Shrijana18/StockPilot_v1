# iOS Build Error Fix - Wrong Workspace

## ❌ Error
```
Unable to open base configuration reference file 
'/Users/shrijanakwade/Developer/FLYP/StockPilot_v1/ios/App/Pods/Target Support Files/CapacitorHaptics/CapacitorHaptics.debug.xcconfig'
```

## 🔍 Root Cause
Xcode is trying to build from **`ios/App/`** (distributor app) instead of **`ios-customer/App/`** (customer app).

**The Problem:**
- `ios/App/Podfile` has only 4 pods (no CapacitorHaptics)
- `ios-customer/App/Podfile` has 5 pods (includes CapacitorHaptics)
- The build is looking for CapacitorHaptics in the wrong location

## ✅ Solution

### Option 1: Use the Correct Workspace (RECOMMENDED)
**Always open the customer app workspace:**

```bash
cd /Users/shrijanakwade/Developer/FLYP/StockPilot_v1
open ios-customer/App/App.xcworkspace
```

**Verify in Xcode:**
- Check the workspace path in Xcode title bar
- Should show: `ios-customer/App/App.xcworkspace`
- Bundle ID should be: `com.flypnow.shop` (NOT `com.flypnow.ios`)

### Option 2: Fix the Distributor App (if needed)
If you need to build the distributor app (`ios/App`), add CapacitorHaptics to its Podfile:

```ruby
# In ios/App/Podfile, add to capacitor_pods:
pod 'CapacitorHaptics', :path => '../../node_modules/@capacitor/haptics'
```

Then run:
```bash
cd ios/App && pod install
```

## 📋 Quick Fix Steps

1. **Close Xcode** (if open)

2. **Open the correct workspace:**
   ```bash
   open ios-customer/App/App.xcworkspace
   ```

3. **In Xcode:**
   - Verify workspace: Check title bar shows `ios-customer/App/App.xcworkspace`
   - Clean build: `Product` → `Clean Build Folder` (Shift+Cmd+K)
   - Select device: "Shri's iPhone" or simulator
   - Build: Click Play (▶️) or press `Cmd + R`

## ⚠️ Important

**NEVER open `ios/App/App.xcworkspace`** for the customer app!

- ✅ **Customer App:** `ios-customer/App/App.xcworkspace`
- ❌ **Distributor App:** `ios/App/App.xcworkspace` (different app!)

## 🔧 Verification

After opening the correct workspace, verify:
1. **Bundle ID:** `com.flypnow.shop` (in Signing & Capabilities)
2. **Pods:** Should see 5 Capacitor pods including CapacitorHaptics
3. **Location permissions:** Should be in Info.plist (we just added them)

## ✅ Status

- ✅ Fixed Pods in `ios/App` (for distributor app)
- ✅ Customer app Pods already correct in `ios-customer/App`
- ⏳ **Action Required:** Open correct workspace (`ios-customer/App/App.xcworkspace`)
