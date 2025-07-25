import React from "react";

const InvoiceSettings = ({ settings, onChange }) => {
  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    onChange({
      ...settings,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  return (
    <div className="bg-white p-4 rounded shadow space-y-4">
      <h2 className="text-lg font-semibold mb-2">Invoice Settings</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="includeGST"
            checked={settings.includeGST}
            onChange={handleChange}
          />
          Include GST
          {settings.includeGST && (
            <input
              type="number"
              name="gstRate"
              value={settings.gstRate || ""}
              onChange={handleChange}
              className="border px-2 py-1 rounded w-20"
              placeholder="% GST"
            />
          )}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="includeCGST"
            checked={settings.includeCGST}
            onChange={handleChange}
          />
          Include CGST
          {settings.includeCGST && (
            <input
              type="number"
              name="cgstRate"
              value={settings.cgstRate || ""}
              onChange={handleChange}
              className="border px-2 py-1 rounded w-20"
              placeholder="% CGST"
            />
          )}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="includeIGST"
            checked={settings.includeIGST}
            onChange={handleChange}
          />
          Include IGST
          {settings.includeIGST && (
            <input
              type="number"
              name="igstRate"
              value={settings.igstRate || ""}
              onChange={handleChange}
              className="border px-2 py-1 rounded w-20"
              placeholder="% IGST"
            />
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="mb-1 font-medium">Invoice Type</span>
          <select
            name="invoiceType"
            value={settings.invoiceType}
            onChange={handleChange}
            className="border px-3 py-2 rounded"
          >
            <option value="">Select Invoice Type</option>
            <option value="retail">Retail</option>
            <option value="tax">Tax</option>
            <option value="quote">Quote</option>
            <option value="estimation">Estimation</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 font-medium">Payment Mode</span>
          <select
            name="paymentMode"
            value={settings.paymentMode}
            onChange={handleChange}
            className="border px-3 py-2 rounded"
          >
            <option value="">Select Payment Mode</option>
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