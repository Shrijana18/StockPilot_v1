// Utilities for handling the lightweight employee session stored in localStorage.
// This session is independent of Firebase Auth (owner login) so employees can
// use a PIN-based flow without being a Firebase user.

const KEY = 'employeeSession';

// One-time in-memory session for Android WebView: set right before navigate, read by dashboard.
// Bypasses localStorage timing; cleared after first read.
const PENDING_SESSION_KEY = '__FLYP_EMPLOYEE_PENDING_SESSION';

export function setPendingEmployeeSession(payload) {
  if (typeof window === 'undefined') return;
  try {
    window[PENDING_SESSION_KEY] = payload && typeof payload === 'object' ? { ...payload } : null;
  } catch (_e) {}
}

export function getAndClearPendingEmployeeSession() {
  if (typeof window === 'undefined') return null;
  try {
    const pending = window[PENDING_SESSION_KEY];
    window[PENDING_SESSION_KEY] = null;
    return pending && pending.retailerId && pending.employeeId ? pending : null;
  } catch (_e) {
    return null;
  }
}

export function clearPendingEmployeeSession() {
  if (typeof window === 'undefined') return;
  try {
    window[PENDING_SESSION_KEY] = null;
  } catch (_e) {}
}

/**
 * Save/overwrite the employee session. Returns the normalized session.
 * @param {Object} payload
 * @param {string} payload.retailerId
 * @param {string} payload.employeeId
 * @param {string} [payload.role]
 * @param {Object} [payload.permissions]
 * @param {string} [payload.phone]
 */
export function setEmployeeSession(payload = {}) {
  const session = {
    loggedIn: true,
    retailerId: String(payload.retailerId || ''),
    employeeId: String(payload.employeeId || ''),
    role: payload.role || 'Employee',
    permissions: payload.permissions || {},
    phone: payload.phone ? String(payload.phone) : '',
    ts: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    // Notify listeners (e.g., EmployeeDashboard) that session is persisted
    window.dispatchEvent(new Event('employeeSessionSaved'));
  } catch (_e) {
    // ignore quota or privacy mode errors
  }
  return session;
}

/**
 * Read the employee session if present and valid; otherwise returns null.
 * Checks in-memory pending session first (set right after login on native), then localStorage.
 */
export function getEmployeeSession() {
  try {
    const pending = peekPendingEmployeeSession();
    if (pending) return pending;
    const stored = localStorage.getItem(KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    console.warn('Failed to parse employee session:', e);
    return null;
  }
}

/** Peek pending session without clearing (used by getEmployeeSession and route guard). */
export function peekPendingEmployeeSession() {
  if (typeof window === 'undefined') return null;
  try {
    const p = window[PENDING_SESSION_KEY];
    return p && p.retailerId && p.employeeId ? p : null;
  } catch (_e) {
    return null;
  }
}

/** Clear the employee session from storage. */
export function clearEmployeeSession() {
  try {
    localStorage.removeItem(KEY);
  } catch (_e) {}
}

/** Convenience boolean helper. */
export function isEmployeeLoggedIn() {
  return !!getEmployeeSession();
}

/**
 * Returns true if the path is in the employee area. Useful to avoid owner
 * redirects from Auth listeners when employees are using the app.
 */
export function isEmployeePath(pathname = '') {
  return typeof pathname === 'string' && pathname.startsWith('/employee');
}

// --- One-time redirect guard for employee login (prevents AuthContext races) ---
const REDIRECT_KEY = 'flyp_employee_redirect';

export function setEmployeeRedirect() {
  try {
    sessionStorage.setItem(REDIRECT_KEY, 'true');
  } catch (e) {
    console.warn('Failed to set employee redirect flag:', e);
  }
}

export function isEmployeeRedirect() {
  try {
    return sessionStorage.getItem(REDIRECT_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function clearEmployeeRedirect() {
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
    // Backward compatibility: remove any old persistent flag
    try { localStorage.removeItem(REDIRECT_KEY); } catch (_e) {}
  } catch (e) {
    console.warn('Failed to clear employee redirect flag:', e);
  }
}

// Alias for backward compatibility
export function markEmployeeRedirect() {
  setEmployeeRedirect();
}

/** ✅ Clear everything for a clean logout or crash recovery. */
export function clearAllEmployeeState() {
  clearEmployeeSession();
  clearEmployeeRedirect();
  clearPendingEmployeeSession(); // Also clear pending session
}