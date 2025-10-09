// Utilities for handling the lightweight employee session stored in localStorage.
// This session is independent of Firebase Auth (owner login) so employees can
// use a PIN-based flow without being a Firebase user.

const KEY = 'employeeSession';

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
 */
export function getEmployeeSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.loggedIn !== true) return null;
    if (!s.retailerId || !s.employeeId) return null;
    return s;
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
const REDIRECT_KEY = 'employeeRedirect';

export function markEmployeeRedirect() {
  try { sessionStorage.setItem(REDIRECT_KEY, '1'); } catch (_e) {}
}

export function isEmployeeRedirect() {
  try { return sessionStorage.getItem(REDIRECT_KEY) === '1'; } catch (_e) { return false; }
}

export function clearEmployeeRedirect() {
  try { sessionStorage.removeItem(REDIRECT_KEY); } catch (_e) {}
}

/** ✅ Clear everything for a clean logout or crash recovery. */
export function clearAllEmployeeState() {
  clearEmployeeSession();
  clearEmployeeRedirect();
}