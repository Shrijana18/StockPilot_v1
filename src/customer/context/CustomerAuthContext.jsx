/**
 * CustomerAuthContext - Simple Authentication for Customer App
 * For development: Skip OTP, use phone + name directly
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
    try {
      // Create a simple customer ID from phone number
      const formattedPhone = phone.replace(/\D/g, '');
      const customerId = `customer_${formattedPhone}`;
      
      const customerRef = doc(db, 'customers', customerId);
      const customerDoc = await getDoc(customerRef);

      let data;
      if (customerDoc.exists()) {
        // Existing customer - update name if provided
        data = customerDoc.data();
        if (name && name !== data.name) {
          await updateDoc(customerRef, { name, updatedAt: serverTimestamp() });
          data.name = name;
        }
      } else {
        // New customer - create profile
        data = {
          name: name || 'Customer',
          phone: `+91${formattedPhone}`,
          email: '',
          addresses: [],
          createdAt: serverTimestamp(),
          totalOrders: 0,
          isActive: true
        };
        await setDoc(customerRef, data);
      }

      // Save session
      localStorage.setItem('flyp_customer_id', customerId);
      
      setCustomer({ uid: customerId, phoneNumber: `+91${formattedPhone}` });
      setCustomerData(data);
      
      return { success: true, isNewUser: !customerDoc.exists() };
    } catch (error) {
      console.error('Error logging in:', error);
      return { success: false, error: error.message };
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

  return (
    <CustomerAuthContext.Provider value={{
      customer,
      customerData,
      loading,
      simpleLogin,
      updateProfile,
      addAddress,
      setDefaultAddress,
      logout,
      isLoggedIn: !!customer
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export default CustomerAuthContext;
