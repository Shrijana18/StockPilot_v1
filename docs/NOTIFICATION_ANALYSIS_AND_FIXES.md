# Notification System – Analysis & Fixes

## Two-Way Flow (Designed)

| Direction | Trigger | Cloud Function | Recipient |
|-----------|---------|----------------|-----------|
| **Customer → Retailer** | Customer places order in ios-customer | `onNewMarketplaceOrder` (stores/{storeId}/customerOrders onCreate) | Retailer (ios app) |
| **Retailer → Customer** | Retailer accepts/updates order | `onCustomerOrderStatusUpdate` (stores/{storeId}/customerOrders onUpdate) | Customer (ios-customer app) |

---

## Why Notifications Weren't Showing

### 1. **In-app bell had no data source** ✅ FIXED
- **Retailer**: `MobileHeader` showed `notificationCount` (default 0) but `MobileRetailerDashboard` never passed it or computed it.
- **Customer**: `CustomerHeader` uses `useState(0)` – hardcoded, never updated.
- **Fix**: Retailer bell now shows the count of **pending marketplace orders** (status = `pending`). Bell tap navigates to Marketplace → Orders.

### 2. **Retailer must enable push in Profile**
- Cloud Function checks `businesses/{retailerId}.pushNotifications === true`.
- FCM token is saved only when push is enabled in Profile Settings and the user saves.
- **Action**: Retailer must go to **Profile → Notifications → Push Notifications → Enable → Save**.

### 3. **Device Do Not Disturb**
- Lock screen screenshot shows Do Not Disturb enabled (bell with slash).
- DND blocks lock-screen and sound for push notifications.
- **Action**: User should turn off DND or allow FLYP in DND exceptions for order alerts.

### 4. **iOS push setup**
- Push requires: Xcode → Push Notifications capability, APNs key in Firebase Console, physical device.
- Simulator does not receive push.

### 5. **Cloud Functions deployment**
- Ensure `onNewMarketplaceOrder` and `onCustomerOrderStatusUpdate` are deployed: `firebase deploy --only functions`

---

## Data Flow (Verification)

### Order placement (Customer → Retailer)
1. Customer places order in ios-customer → `placeOrder()` writes to:
   - `customerOrders` (root)
   - `stores/{storeId}/customerOrders/{orderId}` ✅
2. Cloud Function `onNewMarketplaceOrder` triggers on `stores/{storeId}/customerOrders/{orderId}` onCreate.
3. Function checks `businesses/{storeId}.pushNotifications` and fetches FCM tokens from `businesses/{storeId}/fcmTokens`.
4. FCM sends push to retailer device.

### Order status update (Retailer → Customer)
1. Retailer accepts/updates order in CustomerOrders → `updateOrderStatus()` writes to `stores/{storeId}/customerOrders/{orderId}`.
2. Cloud Function `onCustomerOrderStatusUpdate` triggers on onUpdate.
3. Function reads `customerId` from order, fetches tokens from `customers/{customerId}/fcmTokens`.
4. FCM sends push to customer device.

### In-app bell (Retailer)
- Now fetches `stores/{retailerId}/customerOrders` and filters `status === 'pending'`.
- Count is shown on bell icon; tap navigates to Marketplace tab.

---

## Why notifications weren’t showing in the notification bar (fixed)

1. **iOS needs FCM tokens, not APNs tokens**  
   Cloud Functions use FCM (`sendEachForMulticast`). FCM expects **FCM registration tokens**. On iOS, `@capacitor/push-notifications` returns the **APNs device token**, which FCM does not accept. So:
   - **Retailer app**: Already fixed earlier – uses `@capacitor-firebase/messaging` on iOS to get and save FCM token.
   - **Customer app**: Was still using only Capacitor Push on iOS → saved APNs token → FCM never delivered. **Fixed**: Customer app now uses `@capacitor-firebase/messaging` on iOS for FCM token (same as retailer).

2. **Device token not forwarded (customer app)**  
   **ios-customer** `AppDelegate` did not implement `didRegisterForRemoteNotificationsWithDeviceToken` / `didFailToRegisterForRemoteNotificationsWithError`, so the device token was never passed to Capacitor/Firebase. **Fixed**: Both methods added to ios-customer `AppDelegate`.

3. **Firebase not initialized at launch**  
   FCM token can fail if Firebase isn’t configured before the messaging plugin runs. **Fixed**: `FirebaseApp.configure()` added in both **ios/App** and **ios-customer/App** `AppDelegate` in `didFinishLaunchingWithOptions`.

4. **Customer Cloud Function payload**  
   Customer push message had no explicit `aps.alert` for iOS, so the system might not show title/body in the banner. **Fixed**: `apns.payload.aps.alert: { title, body }` added in `onCustomerOrderStatusUpdate`.

5. **Customer build config**  
   Customer iOS build script now adds `PushNotifications` and `FirebaseMessaging` `presentationOptions: ["badge", "sound", "alert"]` so foreground notifications show as banners.

---

## “Real” notifications (banner + app icon badge)

To match behaviour like other apps (e.g. Blinkit): **banner at top**, **badge on app icon until user reads**.

1. **Banner**
   - Cloud Function sends APNs payload with explicit `aps.alert: { title, body }` so iOS always shows the notification in the banner (lock screen + in-app banner).
   - `FirebaseMessaging` and `PushNotifications` in `capacitor.config.json` use `presentationOptions: ["badge", "sound", "alert"]` so foreground notifications also show as banner.

2. **Badge**
   - Each push includes `aps.badge: 1` so the app icon shows a count (e.g. 1).
   - When the retailer opens **Marketplace** (i.e. “reads” orders), the app clears the icon badge via `@capawesome/capacitor-badge` so the red dot/count goes away until the next order.

3. **iOS token**
   - On iOS the app uses `@capacitor-firebase/messaging` to get an **FCM token** (not the raw APNs token) and saves it to Firestore so the Cloud Function can send via FCM → APNs.

---

## Checklist for Working Notifications

**Retailer (ios app)**
- [ ] Enable Push Notifications in Profile Settings and save.
- [ ] Xcode: **Signing & Capabilities** → add **Push Notifications** (entitlements get `aps-environment`).
- [ ] Xcode: **Signing & Capabilities** → add **Background Modes** → check **Remote notifications** (or rely on `Info.plist` `UIBackgroundModes`).
- [ ] **AppDelegate**: Must forward device token to Capacitor (`didRegisterForRemoteNotificationsWithDeviceToken` → post `capacitorDidRegisterForRemoteNotifications`). Done in this repo.
- [ ] Firebase Console: APNs auth key uploaded (Cloud Messaging).
- [ ] Test on **physical device** (not simulator).
- [ ] Device **Do Not Disturb**: Off or allow FLYP so banners can show.

**Customer (ios-customer app)**
- [ ] Customer auth / session established.
- [ ] Same iOS push setup as above.

**Backend**
- [ ] `firebase deploy --only functions` (includes notification functions).
