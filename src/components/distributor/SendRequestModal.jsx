import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';

const SendRequestModal = ({ distributor, onClose }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const currentUser = auth.currentUser;

  const handleSendRequest = async () => {
    if (!currentUser || !distributor?.id) {
      alert("Missing user or distributor info.");
      return;
    }

    setSending(true);
    const retailerId = currentUser.uid;
    const distId = distributor.id;

    const retailerDoc = await getDoc(doc(db, "businesses", retailerId));
    const retailerData = retailerDoc.exists() ? retailerDoc.data() : {};

    const requestPayload = {
      retailerId,
      retailerName: currentUser.displayName || 'Retailer',
      businessName: retailerData.businessName || '',
      ownerName: retailerData.ownerName || '',
      email: retailerData.email || '',
      phone: retailerData.phone || '',
      city: retailerData.city || '',
      message: message || '',
      sentAt: serverTimestamp(),
      status: 'pending',
    };

    console.log("📦 Sending request to distributor:", distId);
    console.log("🧾 Request payload:", requestPayload);

    try {
      // Save to distributor's connectionRequests
      await setDoc(doc(db, `businesses/${distId}/connectionRequests/${retailerId}`), requestPayload, { merge: true });

      // Save to retailer's sentRequests (mirrored)
      await setDoc(doc(db, `businesses/${retailerId}/sentRequests/${distId}`), {
        distributorId: distId,
        distributorName: distributor.businessName || distributor.displayName || 'Distributor',
        retailerId,
        message: message || '',
        sentAt: serverTimestamp(),
        status: 'pending',
      }, { merge: true });

      alert('✅ Connection request sent!');
      onClose();
    } catch (error) {
      console.error('❌ Error sending request:', error);
      alert('Failed to send request. Check console for details.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Connect with {distributor.businessName}</h3>
        <textarea
          className="w-full border px-3 py-2 rounded mb-4"
          placeholder="Optional message..."
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSendRequest}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={sending}
          >
            {sending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendRequestModal;
