import React, { useState } from 'react';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

const EmployeeLogin = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  const sendOtp = async () => {
    const auth = getAuth();

    window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
      size: 'invisible'
    }, auth);

    try {
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result);
      toast.success('OTP sent successfully!');
    } catch (error) {
      console.error('OTP send error', error);
      toast.error('Failed to send OTP');
    }
  };

  const verifyOtp = async () => {
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;

      // 🔐 Now fetch their role and business info
      const employeeRef = doc(db, 'employeeIndex', user.uid);
      const snap = await getDoc(employeeRef);

      if (!snap.exists()) {
        toast.error('Employee record not found');
        return;
      }

      const data = snap.data();
      localStorage.setItem('employeeRole', data.role);
      localStorage.setItem('retailerId', data.retailerId);

      // ✅ Mark online + update last seen
      await updateDoc(doc(db, 'businesses', data.retailerId, 'employees', user.uid), {
        online: true,
        lastSeen: serverTimestamp()
      });

      toast.success(`Welcome ${data.role}`);
      window.location.href = '/employee-dashboard'; // ✅ Redirect
    } catch (error) {
      console.error('OTP verify error', error);
      toast.error('Invalid OTP');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Employee Login</h2>
      <input
        className="border p-2 w-full mb-2"
        placeholder="Phone Number (+91...)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <button onClick={sendOtp} className="bg-blue-500 text-white px-4 py-2 rounded mb-2">
        Send OTP
      </button>

      <input
        className="border p-2 w-full mb-2"
        placeholder="Enter OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
      />
      <button onClick={verifyOtp} className="bg-green-500 text-white px-4 py-2 rounded">
        Verify & Login
      </button>

      <div id="recaptcha-container"></div>
    </div>
  );
};

export default EmployeeLogin;