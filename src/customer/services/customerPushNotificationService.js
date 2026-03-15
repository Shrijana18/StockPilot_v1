/**
 * Push Notification Service for Customer App (FLYP Shop)
 * Handles FCM token registration for order status updates.
 * On iOS: use @capacitor-firebase/messaging for FCM token (Capacitor Push gives APNs token only).
 * On Android: use Capacitor Push (returns FCM token).
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';
import { shouldUseRestFallback, upsertDocumentRest } from './firestoreRestClient';
import { addNotificationActivity } from '../../utils/notificationActivity';

const IS_NATIVE = Capacitor?.isNativePlatform?.() === true;
const IS_IOS = Capacitor?.getPlatform?.() === 'ios';

const getDeviceId = () => {
  try {
    return localStorage.getItem('flyp_customer_device_id') || `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `device_${Date.now()}`;
  }
};

const setDeviceId = (id) => {
  try {
    localStorage.setItem('flyp_customer_device_id', id);
  } catch (_) {}
};

const saveTokenToFirestore = async (customerId, token, platform) => {
  if (!customerId || !token) return;
  const deviceId = getDeviceId();
  setDeviceId(deviceId);
  const payload = {
    token,
    platform: platform || (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'),
    updatedAt: new Date().toISOString(),
  };
  try {
    if (shouldUseRestFallback()) {
      const idToken = await auth.currentUser?.getIdToken?.(false);
      if (idToken) await upsertDocumentRest(`customers/${customerId}/fcmTokens/${deviceId}`, payload, idToken);
      else await setDoc(doc(db, 'customers', customerId, 'fcmTokens', deviceId), payload, { merge: true });
    } else {
      await setDoc(doc(db, 'customers', customerId, 'fcmTokens', deviceId), payload, { merge: true });
    }
    return true;
  } catch (err) {
    console.error('[CustomerPush] Failed to save token:', err);
    return false;
  }
};

export const removeCustomerTokenFromFirestore = async (customerId) => {
  if (!customerId) return;
  const deviceId = getDeviceId();
  try {
    if (shouldUseRestFallback()) {
      const idToken = await auth.currentUser?.getIdToken?.(false);
      if (idToken) await upsertDocumentRest(`customers/${customerId}/fcmTokens/${deviceId}`, { token: null, removedAt: new Date().toISOString() }, idToken);
    } else {
      await deleteDoc(doc(db, 'customers', customerId, 'fcmTokens', deviceId));
    }
  } catch (err) {
    console.error('[CustomerPush] Failed to remove token:', err);
  }
};

export const initCustomerPushNotifications = async (customerId, onTapNavigate) => {
  if (!IS_NATIVE || !customerId) return { success: false, error: 'Not native or no customerId' };
  try {
    if (IS_IOS) {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== 'granted') return { success: false, error: 'Permission denied' };
      const { token } = await FirebaseMessaging.getToken();
      if (token) await saveTokenToFirestore(customerId, token, 'ios');
      FirebaseMessaging.addListener('tokenReceived', async (event) => {
        if (event.token) await saveTokenToFirestore(customerId, event.token, 'ios');
      });
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const data = event.notification?.data || {};
        addNotificationActivity('customer', {
          title: event.notification?.title || 'Order Update',
          body: event.notification?.body || '',
          type: data?.type || 'general',
          data,
          read: true,
        });
        if (typeof onTapNavigate === 'function') onTapNavigate(data);
      });
      FirebaseMessaging.addListener('notificationReceived', (event) => {
        const notification = event.notification || {};
        addNotificationActivity('customer', {
          title: notification?.title || 'Order Update',
          body: notification?.body || '',
          type: notification?.data?.type || 'general',
          data: notification?.data || {},
        });
        console.log('[CustomerPush] Received:', notification);
      });
      return { success: true };
    }
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return { success: false, error: 'Permission denied' };
    await PushNotifications.register();
    PushNotifications.addListener('registration', async ({ value: token }) => {
      await saveTokenToFirestore(customerId, token, Capacitor.getPlatform());
    });
    PushNotifications.addListener('registrationError', (err) => console.error('[CustomerPush] Registration error:', err));
    PushNotifications.addListener('pushNotificationReceived', (n) => {
      addNotificationActivity('customer', {
        title: n?.title || 'Order Update',
        body: n?.body || '',
        type: n?.data?.type || 'general',
        data: n?.data || {},
      });
      console.log('[CustomerPush] Received:', n);
    });
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data || {};
      addNotificationActivity('customer', {
        title: action.notification?.title || 'Order Update',
        body: action.notification?.body || '',
        type: data?.type || 'general',
        data,
        read: true,
      });
      if (typeof onTapNavigate === 'function') onTapNavigate(data);
    });
    return { success: true };
  } catch (err) {
    console.error('[CustomerPush] Init error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
};

export const isCustomerPushSupported = () => IS_NATIVE;
