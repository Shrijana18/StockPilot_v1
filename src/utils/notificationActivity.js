const KEY_BY_SCOPE = {
  retailer: 'flyp_retailer_notification_activity',
  customer: 'flyp_customer_notification_activity',
};

const MAX_ITEMS = 100;

const getKey = (scope) => KEY_BY_SCOPE[scope] || KEY_BY_SCOPE.retailer;

const safeRead = (scope) => {
  try {
    const raw = localStorage.getItem(getKey(scope));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (scope, items) => {
  try {
    localStorage.setItem(getKey(scope), JSON.stringify(items));
  } catch (_) {}
};

export const getNotificationActivity = (scope) => safeRead(scope);

export const addNotificationActivity = (scope, item) => {
  const current = safeRead(scope);
  const entry = {
    id: item?.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: item?.title || 'Notification',
    body: item?.body || '',
    type: item?.type || 'general',
    data: item?.data || {},
    createdAt: item?.createdAt || new Date().toISOString(),
    read: Boolean(item?.read),
  };
  const next = [entry, ...current].slice(0, MAX_ITEMS);
  safeWrite(scope, next);
  return next;
};

export const markNotificationActivityRead = (scope, id) => {
  const current = safeRead(scope);
  const next = current.map((item) => (item.id === id ? { ...item, read: true } : item));
  safeWrite(scope, next);
  return next;
};

export const markAllNotificationActivityRead = (scope) => {
  const current = safeRead(scope);
  const next = current.map((item) => ({ ...item, read: true }));
  safeWrite(scope, next);
  return next;
};

export const clearNotificationActivity = (scope) => {
  safeWrite(scope, []);
  return [];
};

export const getUnreadNotificationActivityCount = (scope) =>
  safeRead(scope).filter((item) => !item.read).length;
