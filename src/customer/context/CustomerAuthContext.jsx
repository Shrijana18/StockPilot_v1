/**
 * CustomerAuthContext - Simple Authentication for Customer App
 * For development: Skip OTP, use phone + name directly
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const IS_NATIVE_APP = Capacitor?.isNativePlatform?.() === true;

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
        const savedCustomerId = localStorage.getItem('flyp_customer_id');
        if (savedCustomerId) {
          const customerDoc = await getDoc(doc(db, 'customers', savedCustomerId));
          if (customerDoc.exists()) {
            const data = customerDoc.data();
            // Set customer with phone number from stored data
            setCustomer({ 
              uid: savedCustomerId, 
              phoneNumber: data.phone || '' 
            });
            setCustomerData(data);
          } else {
            // Clear invalid session
            localStorage.removeItem('flyp_customer_id');
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        localStorage.removeItem('flyp_customer_id');
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
      try {
        console.log('[CustomerAuth] Fetching customer document...');
        const customerRef = doc(db, 'customers', customerId);
        const customerDoc = await getDoc(customerRef);

        let data;
        if (customerDoc.exists()) {
          console.log('[CustomerAuth] Existing customer found');
          data = customerDoc.data();
          if (name && name !== data.name) {
            console.log('[CustomerAuth] Updating customer name...');
            await updateDoc(customerRef, { name, updatedAt: serverTimestamp() });
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
            createdAt: serverTimestamp(),
            isActive: true
          };
          await setDoc(customerRef, data);
          console.log('[CustomerAuth] New customer created successfully');
        }
        return { data, isNewUser: !customerDoc.exists() };
      } catch (error) {
        console.error('[CustomerAuth] Firestore operation failed:', error);
        throw error;
      }
    };

    // Timeout for app - Firestore can hang in WebView
    const timeoutMs = IS_NATIVE_APP ? 20000 : 30000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.error('[CustomerAuth] Login timeout after', timeoutMs, 'ms');
        reject(new Error('Connection timed out. Please check your network and try again.'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([doFirestoreLogin(), timeoutPromise]);

      console.log('[CustomerAuth] Login successful, saving to localStorage');
      localStorage.setItem('flyp_customer_id', customerId);
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
      
      const customerRef = doc(db, 'customers', customer.uid);
      await updateDoc(customerRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
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
      localStorage.removeItem('flyp_customer_id');
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
      const customerRef = doc(db, 'customers', customer.uid);
      await deleteDoc(customerRef);
      localStorage.removeItem('flyp_customer_id');
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
