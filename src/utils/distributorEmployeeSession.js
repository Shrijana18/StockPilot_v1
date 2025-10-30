const DISTRIBUTOR_EMPLOYEE_SESSION_KEY = 'flyp_distributor_employee_session';
// Use sessionStorage for one-time redirect guard (avoid persisting across browser restarts)
const DISTRIBUTOR_EMPLOYEE_REDIRECT_KEY = 'flyp_distributor_employee_redirect';

export const getDistributorEmployeeSession = () => {
  try {
    const stored = localStorage.getItem(DISTRIBUTOR_EMPLOYEE_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    console.warn('Failed to parse distributor employee session:', e);
    return null;
  }
};

export const setDistributorEmployeeSession = (session) => {
  try {
    localStorage.setItem(DISTRIBUTOR_EMPLOYEE_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Failed to store distributor employee session:', e);
  }
};

export const clearDistributorEmployeeSession = () => {
  try {
    localStorage.removeItem(DISTRIBUTOR_EMPLOYEE_SESSION_KEY);
  } catch (e) {
    console.warn('Failed to clear distributor employee session:', e);
  }
};

export const isDistributorEmployeeRedirect = () => {
  try {
    return sessionStorage.getItem(DISTRIBUTOR_EMPLOYEE_REDIRECT_KEY) === 'true';
  } catch (e) {
    return false;
  }
};

export const setDistributorEmployeeRedirect = () => {
  try {
    sessionStorage.setItem(DISTRIBUTOR_EMPLOYEE_REDIRECT_KEY, 'true');
  } catch (e) {
    console.warn('Failed to set distributor employee redirect flag:', e);
  }
};

export const clearDistributorEmployeeRedirect = () => {
  try {
    sessionStorage.removeItem(DISTRIBUTOR_EMPLOYEE_REDIRECT_KEY);
    // Backward compatibility: remove any old persistent flag
    try { localStorage.removeItem(DISTRIBUTOR_EMPLOYEE_REDIRECT_KEY); } catch (_e) {}
  } catch (e) {
    console.warn('Failed to clear distributor employee redirect flag:', e);
  }
};

export const isDistributorEmployeePath = () => {
  try {
    const path = window.location.pathname;
    return path === '/distributor-employee-dashboard' || path === '/distributor-employee-login';
  } catch (e) {
    return false;
  }
};
