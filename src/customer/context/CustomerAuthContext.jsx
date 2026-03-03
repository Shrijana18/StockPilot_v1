/**
 * CustomerAuthContext - Simple Authentication for Customer App
 * For development: Skip OTP, use phone + name directly
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { app } from '../../firebase/firebaseConfig';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore/lite';
import { Capacitor } from '@capacitor/core';
import {
  shouldUseRestFallback,
  getDocumentRest,
  upsertDocumentRest,
  deleteDocumentRest,
} from '../services/firestoreRestClient';

const IS_NATIVE_APP = Capacitor?.isNativePlatform?.() === true;
const customerDb = getFirestore(app);

const fetchDoc = (ref) => getDoc(ref);

const Storage = {
  async get(key) {
    if (IS_NATIVE_APP) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key });
        return value;
      } catch { /* fall through */ }
    }
    return localStorage.getItem(key);
  },
  async set(key, value) {
    if (IS_NATIVE_APP) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key, value });
        return;
      } catch { /* fall through */ }
    }
    localStorage.setItem(key, value);
  },
  async remove(key) {
    if (IS_NATIVE_APP) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.remove({ key });
        return;
      } catch { /* fall through */ }
    }
    localStorage.removeItem(key);
  }
};

const CustomerAuthContext = createContext();

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return context;
};

export const CustomerAuthProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check for saved customer session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const savedCustomerId = await Storage.get('flyp_customer_id');
        if (savedCustomerId) {
          // Firestore can hang in iOS WebView on first load; add a timeout
          // so the app still renders in guest mode instead of stuck on splash.
          const sessionTimeout = IS_NATIVE_APP ? 10000 : 20000;
          const customerDoc = await Promise.race([
            shouldUseRestFallback()
              ? getDocumentRest(`customers/${savedCustomerId}`)
              : fetchDoc(doc(customerDb, 'customers', savedCustomerId)),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('session_timeout')), sessionTimeout)
            )
          ]);
          const exists = shouldUseRestFallback() ? !!customerDoc : customerDoc.exists();
          if (exists) {
            const data = shouldUseRestFallback() ? customerDoc : customerDoc.data();
            setCustomer({ 
              uid: savedCustomerId, 
              phoneNumber: data.phone || '' 
            });
            setCustomerData(data);
          } else {
            await Storage.remove('flyp_customer_id');
          }
        }
      } catch (error) {
        console.error('[CustomerAuth] Session check failed:', error?.message);
        // Don't remove stored ID on timeout — let user retry login later
        if (error?.message !== 'session_timeout') {
          await Storage.remove('flyp_customer_id');
        }
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Simple login with phone + name (no OTP for dev)
  const simpleLogin = async (phone, name) => {
    setLoginLoading(true);
    setError(null);
    const formattedPhone = phone.replace(/\D/g, '');
    const customerId = `customer_${formattedPhone}`;

    console.log('[CustomerAuth] Starting login:', { customerId, isNative: IS_NATIVE_APP });

    const doFirestoreLogin = async () => {
      console.log('[CustomerAuth] Fetching customer document...');
      const customerRef = shouldUseRestFallback() ? null : doc(customerDb, 'customers', customerId);
      const customerDoc = shouldUseRestFallback()
        ? await getDocumentRest(`customers/${customerId}`)
        : await fetchDoc(customerRef);

      let data;
      const exists = shouldUseRestFallback() ? !!customerDoc : customerDoc.exists();
      if (exists) {
        console.log('[CustomerAuth] Existing customer found');
        data = shouldUseRestFallback() ? customerDoc : customerDoc.data();
        if (name && name !== data.name) {
          console.log('[CustomerAuth] Updating customer name...');
          if (shouldUseRestFallback()) {
            await upsertDocumentRest(`customers/${customerId}`, { ...data, name, updatedAt: new Date().toISOString() });
          } else {
            await updateDoc(customerRef, { name, updatedAt: serverTimestamp() });
          }
          data.name = name;
        }
      } else {
        console.log('[CustomerAuth] Creating new customer...');
        data = {
          name: name || 'Customer',
          phone: `+91${formattedPhone}`,
          email: '',
          addresses: [],
          paymentMethods: [],
          settings: {
            pushNotifications: true,
            emailNotifications: false,
            smsNotifications: false,
            orderUpdates: true,
            offers: true,
          },
          totalOrders: 0,
          totalSavings: 0,
          loyaltyPoints: 0,
          referralCode: `FLYP${customerId.slice(-6).toUpperCase()}`,
          createdAt: shouldUseRestFallback() ? new Date().toISOString() : serverTimestamp(),
          isActive: true
        };
        if (shouldUseRestFallback()) {
          await upsertDocumentRest(`customers/${customerId}`, data);
        } else {
          await setDoc(customerRef, data);
        }
        console.log('[CustomerAuth] New customer created successfully');
      }
      return { data, isNewUser: !exists };
    };

    // Retry wrapper — the first Firestore call in an iOS WebView session can
    // fail or hang while the SDK warms up, so retry once before giving up.
    const withRetry = async (fn, retries = IS_NATIVE_APP ? 2 : 1) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const timeoutMs = IS_NATIVE_APP ? 15000 : 25000;
          const result = await Promise.race([
            fn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Connection timed out. Please check your network and try again.')), timeoutMs)
            )
          ]);
          return result;
        } catch (err) {
          console.warn(`[CustomerAuth] Attempt ${attempt}/${retries} failed:`, err?.message);
          if (attempt === retries) throw err;
          // Short pause before retry to let the SDK stabilize
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    };

    try {
      const result = await withRetry(doFirestoreLogin);

      console.log('[CustomerAuth] Login successful, saving session');
      await Storage.set('flyp_customer_id', customerId);
      setCustomer({ uid: customerId, phoneNumber: `+91${formattedPhone}` });
      setCustomerData(result.data);

      return { success: true, isNewUser: result.isNewUser };
    } catch (err) {
      console.error('[CustomerAuth] Login error:', err);
      const msg = err?.message || 'Login failed. Please try again.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoginLoading(false);
    }
  };

  // Update customer profile
  const updateProfile = async (updates) => {
    try {
      if (!customer) throw new Error('Not logged in');
      
      if (shouldUseRestFallback()) {
        const existing = await getDocumentRest(`customers/${customer.uid}`);
        await upsertDocumentRest(`customers/${customer.uid}`, {
          ...(existing || {}),
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const customerRef = doc(customerDb, 'customers', customer.uid);
        await updateDoc(customerRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      }
      
      setCustomerData(prev => ({ ...prev, ...updates }));
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  };

  // Add delivery address
  const addAddress = async (address) => {
    try {
      if (!customer) throw new Error('Not logged in');
      
      const newAddress = {
        id: Date.now().toString(),
        ...address,
        createdAt: new Date().toISOString()
      };

      const addresses = [...(customerData?.addresses || [])];
      
      // If this is first address or marked as default, set as default
      if (addresses.length === 0 || address.isDefault) {
        addresses.forEach(addr => addr.isDefault = false);
        newAddress.isDefault = true;
      }
      
      addresses.push(newAddress);
      
      await updateProfile({ addresses });
      return { success: true, address: newAddress };
    } catch (error) {
      console.error('Error adding address:', error);
      return { success: false, error: error.message };
    }
  };

  // Set default address
  const setDefaultAddress = async (addressId) => {
    try {
      const addresses = (customerData?.addresses || []).map(addr => ({
        ...addr,
        isDefault: addr.id === addressId
      }));
      
      await updateProfile({ addresses });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await Storage.remove('flyp_customer_id');
      setCustomer(null);
      setCustomerData(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Delete account and all associated data (Apple Guideline 5.1.1(v))
  const deleteAccount = async () => {
    try {
      if (!customer?.uid) return { success: false, error: 'Not logged in' };
      if (shouldUseRestFallback()) {
        await deleteDocumentRest(`customers/${customer.uid}`);
      } else {
        const customerRef = doc(customerDb, 'customers', customer.uid);
        await deleteDoc(customerRef);
      }
      await Storage.remove('flyp_customer_id');
      setCustomer(null);
      setCustomerData(null);
      return { success: true };
    } catch (error) {
      console.error('Error deleting account:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <CustomerAuthContext.Provider value={{
      customer,
      customerData,
      loading,
      loginLoading,
      error,
      setError,
      simpleLogin,
      updateProfile,
      addAddress,
      setDefaultAddress,
      logout,
      deleteAccount,
      isLoggedIn: !!customer
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export default CustomerAuthContext;
