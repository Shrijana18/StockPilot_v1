# FLYP Retailer Notification System – Design & Architecture

## How Real-Time Push Notifications Work

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Customer App   │     │   Firebase       │     │   Retailer App      │
│  Places Order   │────▶│   Firestore      │     │   (Capacitor)       │
└─────────────────┘     │   (database)     │     └──────────┬──────────┘
                        └────────┬─────────┘                │
                                 │                          │
                        ┌────────▼─────────┐                │
                        │ Cloud Functions  │   FCM Token    │
                        │ (Trigger)        │◀───────────────┤
                        └────────┬─────────┘                │
                                 │                          │
                                 │ FCM / APNs               │
                                 │ (push payload)           │
                                 └─────────────────────────▶│
                                                            │
                                                     ┌──────▼──────┐
                                                     │ Push shown  │
                                                     │ on device   │
                                                     └─────────────┘
```

### Flow in Plain Terms

1. **Registration (one-time per device)**  
   - User enables Push Notifications in Profile Settings.  
   - App requests permission → registers with APNs (iOS) / FCM (Android).  
   - App receives an FCM token.  
   - Token is saved in Firestore: `businesses/{retailerId}/fcmTokens/{deviceId}`.  
   - Optional: `pushNotificationsEnabled: true` stored in `businesses/{retailerId}`.

2. **Event Triggers (server-side)**  
   - Cloud Function listens to Firestore changes (e.g. new document in `stores/{storeId}/customerOrders`).  
   - Or a scheduled function checks orders for packing/due reminders.

3. **Sending Push**  
   - Function fetches retailer FCM tokens from Firestore.  
   - Calls Firebase Admin SDK `messaging().send()` (or `sendEachForMulticast()`) with title, body, and optional data (e.g. `orderId`, `type`).

4. **Delivery**  
   - FCM/APNs delivers the push to the device.  
   - User sees the notification even when the app is in the background or closed.

5. **Tap Handling**  
   - User taps the notification.  
   - App opens and `pushNotificationActionPerformed` fires.  
   - App reads `data.orderId`, `data.type` and navigates (e.g. to Marketplace > Orders).

---

## Notification Types

| Type | Trigger | When | Data |
|------|---------|------|------|
| **New Order** | Firestore `onCreate`: `stores/{storeId}/customerOrders` | Customer places marketplace order | `orderId`, `orderNumber`, `total` |
| **Packing Reminder** | Scheduled (every 30–60 min) or Firestore `onUpdate` | Order in "preparing" > 30 min and not packed | `orderId` |
| **Due Time** | Scheduled (daily or every 6h) | Delivery slot / payment due within 2 hours | `orderId`, `type` (delivery / payment) |
| **Low Stock** | Firestore `onUpdate` or scheduled | Product quantity below threshold | `productId`, `sku` |
| **Distributor Order Shipped** | Firestore `onUpdate`: `businesses/{retailerId}/sentOrders` | Status changes to `Shipped` | `orderId` |

---

## Firestore Schema

```
businesses/{retailerId}
  ├── pushNotificationsEnabled: boolean   // from Profile Settings
  └── fcmTokens/{deviceId}
        ├── token: string                 // FCM token
        ├── platform: "ios" | "android"
        ├── updatedAt: timestamp
        └── appVersion: string (optional)

stores/{storeId}/customerOrders/{orderId}   // storeId = retailerId for marketplace
  └── (existing order fields)

businesses/{retailerId}/notifications/{notificationId}   // optional in-app history
  ├── type: string
  ├── title: string
  ├── body: string
  ├── data: { orderId?, productId?, ... }
  ├── read: boolean
  └── createdAt: timestamp
```

---

## Dependencies

- `@capacitor/push-notifications` – Capacitor plugin for iOS/Android push
- Firebase Admin `messaging()` – in Cloud Functions
- Firebase project: APNs key uploaded for iOS, `google-services.json` for Android

### iOS Setup (Required)

1. **Xcode**: Enable Push Notifications capability (Signing & Capabilities)
2. **Apple Developer**: Create APNs key (Auth Key) or certificate
3. **Firebase Console** → Project Settings → Cloud Messaging → Upload APNs key/cert
4. **Physical device**: Push does not work on iOS Simulator

### Android Setup

1. Add `google-services.json` to `android/app/` (from Firebase Console)
2. Push works on emulator and device

---

## Profile Settings

- New toggle: **Push Notifications** (retailer-only, show only when `isNativeApp`).
- When enabled:
  - Request permission.
  - Register for push.
  - Save FCM token in `businesses/{retailerId}/fcmTokens/{deviceId}`.
  - Set `pushNotificationsEnabled: true` in `businesses/{retailerId}`.
- When disabled:
  - Remove FCM token from Firestore.
  - Set `pushNotificationsEnabled: false`.
  - Optionally call `PushNotifications.unregister()` if supported.

---

## Cloud Functions

1. **`onNewMarketplaceOrder`** (Firestore `onCreate`)  
   - Path: `stores/{storeId}/customerOrders/{orderId}`  
   - Load retailer tokens from `businesses/{storeId}/fcmTokens`.  
   - Send push: "New order #ORD123 – ₹500".

2. **`onPackingReminder`** (scheduled, e.g. every 30 min)  
   - Query orders where status is "preparing" and `updatedAt` is older than 30 min.  
   - For each such order, send reminder to the retailer.

3. **`onDueTimeReminder`** (scheduled, e.g. every hour)  
   - Query orders with delivery slot or payment due in next 2 hours.  
   - Send reminder with orderId and type.

4. **`onDistributorOrderShipped`** (Firestore `onUpdate`)  
   - Path: `businesses/{retailerId}/sentOrders/{orderId}`  
   - On status change to "Shipped", send push to retailer.

---

## Phase 2 (Future)

- **Packing Reminder**: Scheduled function every 30 min; find orders in "preparing" > 30 min; send reminder.
- **Due Time Reminder**: Scheduled function; find orders with delivery slot / payment due in next 2 hours.
- **Low Stock Alert**: On product quantity update, if below threshold, notify retailer.
