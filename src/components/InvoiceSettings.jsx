import React from "react";

const InvoiceSettings = ({ invoiceSettings, setInvoiceSettings }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInvoiceSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-md mb-6 space-y-4">
      <h2 className="text-lg font-semibold mb-2">Invoice Settings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            name="includeGST"
            checked={invoiceSettings.includeGST}
            onChange={handleChange}
            className="mr-1"
          />
          <span>Include GST</span>
        </label>

        <label className="flex items-center space-x-2 text-sm">
          <span>Invoice Type:</span>
          <select
            name="invoiceType"
            value={invoiceSettings.invoiceType}
            onChange={handleChange}
            className="border p-1 rounded text-sm"
          >
            <option value="retail">Retail</option>
            <option value="credit">Credit</option>
            <option value="bulk">Bulk</option>
          </select>
        </label>

        <label className="flex items-center space-x-2 text-sm">
          <span>Payment Mode:</span>
          <select
            name="paymentMode"
            value={invoiceSettings.paymentMode}
            onChange={handleChange}
            className="border p-1 rounded text-sm"
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </label>
      </div>
    </div>
  );
};

export default InvoiceSettings;
