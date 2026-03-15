/**
 * Push Notification Service for Retailer Dashboard
 * Handles FCM token registration, permission, and tap handling.
 *
 * IMPORTANT: On iOS, Capacitor's @capacitor/push-notifications returns an APNs token,
 * but Firebase Cloud Messaging requires an FCM token. We use @capacitor-firebase/messaging
 * on iOS to get the FCM token so Cloud Function can send successfully (APNs shows "sent").
 *
 * SETUP: Xcode Push Notifications + Background Modes Remote notifications;
 * Firebase Console APNs key; AppDelegate forwards device token to Capacitor.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { shouldUseRestFallback, upsertDocumentRest } from '../customer/services/firestoreRestClient';
import { auth } from '../firebase/firebaseConfig';
import { addNotificationActivity } from '../utils/notificationActivity';

const IS_NATIVE = Capacitor?.isNativePlatform?.() === true;
const IS_IOS = Capacitor?.getPlatform?.() === 'ios';

const getDeviceId = () => {
  try {
    return localStorage.getItem('flyp_device_id') || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `device_${Date.now()}`;
  }
};

const setDeviceId = (id) => {
  try {
    localStorage.setItem('flyp_device_id', id);
  } catch (_) {}
};

/**
 * Save FCM token to Firestore for Cloud Functions to use
 */
const saveTokenToFirestore = async (retailerId, token, platform) => {
  if (!retailerId || !token) return;
  const deviceId = getDeviceId();
  setDeviceId(deviceId);

  const payload = {
    token,
    platform: platform || (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'),
    updatedAt: new Date().toISOString(),
    appVersion: '1.0.0',
  };

  try {
    if (shouldUseRestFallback()) {
      const idToken = await auth.currentUser?.getIdToken?.(false);
      if (idToken) {
        await upsertDocumentRest(`businesses/${retailerId}/fcmTokens/${deviceId}`, payload, idToken);
      } else {
        // Fallback when ID token is not yet ready on native startup
        await setDoc(doc(db, 'businesses', retailerId, 'fcmTokens', deviceId), payload, { merge: true });
      }
    } else {
      await setDoc(doc(db, 'businesses', retailerId, 'fcmTokens', deviceId), payload, { merge: true });
    }
    return true;
  } catch (err) {
    console.error('[PushNotification] Failed to save token:', err);
    return false;
  }
};

/**
 * Remove FCM token from Firestore (when user disables push)
 */
export const removeTokenFromFirestore = async (retailerId) => {
  if (!retailerId) return;
  const deviceId = getDeviceId();
  try {
    if (shouldUseRestFallback()) {
      const idToken = await auth.currentUser?.getIdToken?.(false);
      if (idToken) {
        await upsertDocumentRest(`businesses/${retailerId}/fcmTokens/${deviceId}`, { token: null, removedAt: new Date().toISOString() }, idToken);
      } else {
        await deleteDoc(doc(db, 'businesses', retailerId, 'fcmTokens', deviceId));
      }
    } else {
      await deleteDoc(doc(db, 'businesses', retailerId, 'fcmTokens', deviceId));
    }
  } catch (err) {
    console.error('[PushNotification] Failed to remove token:', err);
  }
};

/**
 * Initialize push notifications and register token
 * On iOS: use Firebase Messaging plugin to get FCM token (required for FCM to send to APNs).
 * On Android: use Capacitor Push (already returns FCM token).
 */
export const initPushNotifications = async (retailerId, onTapNavigate) => {
  if (!IS_NATIVE || !retailerId) return { success: false, error: 'Not native or no retailerId' };

  try {
    if (IS_IOS) {
      // iOS: must use FCM token (Capacitor Push gives APNs token; FCM send requires FCM token)
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== 'granted') {
        return { success: false, error: 'Permission denied' };
      }
      const { token } = await FirebaseMessaging.getToken();
      if (token) {
        await saveTokenToFirestore(retailerId, token, 'ios');
      }
      FirebaseMessaging.addListener('tokenReceived', async (event) => {
        if (event.token) await saveTokenToFirestore(retailerId, event.token, 'ios');
      });
      FirebaseMessaging.addListener('notificationReceived', (event) => {
        const notification = event.notification || {};
        addNotificationActivity('retailer', {
          title: notification?.title || 'New Notification',
          body: notification?.body || '',
          type: notification?.data?.type || 'general',
          data: notification?.data || {},
        });
        console.log('[PushNotification] Received:', event.notification);
      });
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const data = event.notification?.data || {};
        addNotificationActivity('retailer', {
          title: event.notification?.title || 'Notification Opened',
          body: event.notification?.body || '',
          type: data?.type || 'general',
          data,
          read: true,
        });
        if (typeof onTapNavigate === 'function') onTapNavigate(data);
      });
      return { success: true };
    }

    // Android: Capacitor Push returns FCM token
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    await PushNotifications.register();

    PushNotifications.addListener(
      'registration',
      async ({ value: token }) => {
        await saveTokenToFirestore(retailerId, token, Capacitor.getPlatform());
      }
    );

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[PushNotification] Registration error:', err);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        addNotificationActivity('retailer', {
          title: notification?.title || 'New Notification',
          body: notification?.body || '',
          type: notification?.data?.type || 'general',
          data: notification?.data || {},
        });
        console.log('[PushNotification] Received:', notification);
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        const data = action.notification?.data || {};
        addNotificationActivity('retailer', {
          title: action.notification?.title || 'Notification Opened',
          body: action.notification?.body || '',
          type: data?.type || 'general',
          data,
          read: true,
        });
        if (typeof onTapNavigate === 'function') {
          onTapNavigate(data);
        }
      }
    );

    return { success: true };
  } catch (err) {
    console.error('[PushNotification] Init error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
};

/**
 * Check if push notifications are supported (native only)
 */
export const isPushSupported = () => IS_NATIVE;

/**
 * Clear app icon badge (e.g. when user opens Marketplace and "reads" notifications).
 * Uses @capawesome/capacitor-badge when available.
 */
export const clearAppBadge = async () => {
  if (!IS_NATIVE) return;
  try {
    const { Badge } = await import('@capawesome/capacitor-badge');
    const { isSupported } = await Badge.isSupported();
    if (isSupported) await Badge.clear();
  } catch (_) {
    // Plugin not installed or not supported – ignore
  }
};

/**
 * Set app icon badge count (e.g. pending orders). Use 0 to clear.
 */
export const setAppBadgeCount = async (count) => {
  if (!IS_NATIVE || count < 0) return;
  try {
    const { Badge } = await import('@capawesome/capacitor-badge');
    const { isSupported } = await Badge.isSupported();
    if (isSupported) await Badge.set({ count: Math.min(count, 99) });
  } catch (_) {
    // Plugin not installed or not supported – ignore
  }
};
