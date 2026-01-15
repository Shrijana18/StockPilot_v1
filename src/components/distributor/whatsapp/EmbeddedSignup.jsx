/**
 * Embedded Signup Wrapper
 * Single UI source of truth backed by WhatsAppConnection.
 */

import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebase/firebaseConfig';
import WhatsAppConnection from './WhatsAppConnection';

const defaultFormData = {
  whatsappEnabled: false,
  whatsappProvider: 'meta_tech_provider',
  whatsappBusinessAccountId: '',
  whatsappPhoneNumberId: '',
  whatsappPhoneNumber: '',
  whatsappPhoneRegistered: false,
  whatsappPhoneVerificationStatus: 'not_registered',
  whatsappVerified: false,
  whatsappAccountReviewStatus: 'PENDING',
};

const EmbeddedSignup = ({ onSetupComplete }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [formData, setFormData] = useState(defaultFormData);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setUser(nextUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      const snapshot = await getDoc(doc(db, 'businesses', user.uid));
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFormData(prev => ({
          ...prev,
          whatsappEnabled: data.whatsappEnabled || false,
          whatsappProvider: data.whatsappProvider || 'meta_tech_provider',
          whatsappBusinessAccountId: data.whatsappBusinessAccountId || '',
          whatsappPhoneNumberId: data.whatsappPhoneNumberId || '',
          whatsappPhoneNumber: data.whatsappPhoneNumber || '',
          whatsappPhoneRegistered: data.whatsappPhoneRegistered || false,
          whatsappPhoneVerificationStatus: data.whatsappPhoneVerificationStatus || 'not_registered',
          whatsappVerified: data.whatsappVerified || false,
          whatsappAccountReviewStatus: data.whatsappAccountReviewStatus || 'PENDING',
        }));
      }
    };
    load();
  }, [user?.uid]);

  useEffect(() => {
    if (!onSetupComplete || !formData.whatsappBusinessAccountId || notifiedRef.current) return;
    notifiedRef.current = true;
    onSetupComplete({
      success: true,
      wabaId: formData.whatsappBusinessAccountId,
      phoneNumberId: formData.whatsappPhoneNumberId,
      phoneNumber: formData.whatsappPhoneNumber,
    });
  }, [formData.whatsappBusinessAccountId, formData.whatsappPhoneNumberId, formData.whatsappPhoneNumber, onSetupComplete]);

  return (
    <WhatsAppConnection user={user} formData={formData} setFormData={setFormData} />
  );
};

export default EmbeddedSignup;
