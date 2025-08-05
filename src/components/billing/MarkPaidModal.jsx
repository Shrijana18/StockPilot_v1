

import React, { useState } from 'react';

const MarkPaidModal = ({ isOpen, onClose, onConfirm, invoice }) => {
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const handleConfirm = () => {
    onConfirm(paymentMethod);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Mark Invoice as Paid</h2>
        <p className="mb-2">Invoice ID: <span className="font-mono">{invoice?.invoiceId}</span></p>
        <label className="block mt-4 font-medium">Select Payment Mode:</label>
        <select
          className="border px-3 py-2 w-full mt-2 rounded"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
        </select>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-400 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Confirm Paid
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkPaidModal;