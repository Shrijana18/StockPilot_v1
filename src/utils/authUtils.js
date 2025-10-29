import { signOut } from 'firebase/auth';
import { auth, empAuth } from '../firebase/firebaseConfig';
import { clearEmployeeSession, clearAllEmployeeState } from './employeeSession';
import { clearDistributorEmployeeSession } from './distributorEmployeeSession';

/**
 * Comprehensive logout function that clears all sessions
 * @param {string} userType - 'main', 'employee', 'distributor-employee', or 'all'
 */
export const logoutUser = async (userType = 'all') => {
  try {
    console.log(`[AuthUtils] Logging out user type: ${userType}`);
    
    if (userType === 'all' || userType === 'main') {
      // Sign out main user
      try {
        await signOut(auth);
        console.log('[AuthUtils] Main user signed out');
      } catch (error) {
        console.warn('[AuthUtils] Main user signout failed:', error);
      }
    }
    
    if (userType === 'all' || userType === 'employee') {
      // Clear employee sessions
      try {
        await signOut(empAuth);
        clearAllEmployeeState();
        console.log('[AuthUtils] Employee sessions cleared');
      } catch (error) {
        console.warn('[AuthUtils] Employee signout failed:', error);
      }
    }
    
    if (userType === 'all' || userType === 'distributor-employee') {
      // Clear distributor employee sessions
      try {
        await signOut(empAuth);
        clearDistributorEmployeeSession();
        console.log('[AuthUtils] Distributor employee sessions cleared');
      } catch (error) {
        console.warn('[AuthUtils] Distributor employee signout failed:', error);
      }
    }
    
    // Clear all session storage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('postSignupRole');
        sessionStorage.removeItem('employeeRedirect');
        sessionStorage.removeItem('flyp_distributor_employee_redirect');
        console.log('[AuthUtils] Session storage cleared');
      } catch (error) {
        console.warn('[AuthUtils] Session storage clear failed:', error);
      }
    }
    
    console.log('[AuthUtils] Logout completed successfully');
    return true;
  } catch (error) {
    console.error('[AuthUtils] Logout failed:', error);
    return false;
  }
};

/**
 * Check if any user is currently logged in
 */
export const isAnyUserLoggedIn = () => {
  try {
    // Check main user
    if (auth.currentUser) return true;
    
    // Check employee sessions
    if (empAuth.currentUser) return true;
    
    // Check localStorage sessions
    const empSession = localStorage.getItem('employeeSession');
    const distEmpSession = localStorage.getItem('flyp_distributor_employee_session');
    
    if (empSession || distEmpSession) return true;
    
    return false;
  } catch (error) {
    console.warn('[AuthUtils] Error checking login status:', error);
    return false;
  }
};

/**
 * Get current user type
 */
export const getCurrentUserType = () => {
  try {
    if (auth.currentUser) return 'main';
    if (empAuth.currentUser) {
      const claims = empAuth.currentUser.customClaims;
      if (claims?.isEmployee) return 'employee';
      if (claims?.isDistributorEmployee) return 'distributor-employee';
    }
    return null;
  } catch (error) {
    console.warn('[AuthUtils] Error getting user type:', error);
    return null;
  }
};
