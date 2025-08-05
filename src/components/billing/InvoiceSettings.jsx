import React from "react";

const InvoiceSettings = ({ settings, onChange }) => {
  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;

    let parsedValue = value;
    if (type === "number") {
      parsedValue = parseFloat(value || 0);
    }

    onChange({
      ...settings,
      [name]: type === "checkbox" ? checked : parsedValue,
    });
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-md space-y-6 mb-6">
      <h2 className="text-lg font-semibold mb-2">Invoice Settings</h2>

      <div className="flex flex-wrap gap-4">
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
            name="includeSGST"
            checked={settings.includeSGST}
            onChange={handleChange}
          />
          Include SGST
          {settings.includeSGST && (
            <input
              type="number"
              name="sgstRate"
              value={settings.sgstRate || ""}
              onChange={handleChange}
              className="border px-2 py-1 rounded w-20"
              placeholder="% SGST"
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
            <option value="split">Split</option>
            <option value="credit">Credit</option>
            <option value="advance">Advance</option>
          </select>
        </label>

        {settings.paymentMode === "split" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">Cash Amount</span>
              <input
                type="number"
                name="splitCash"
                value={settings.splitPayment?.cash || ""}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    splitPayment: {
                      ...settings.splitPayment,
                      cash: parseFloat(e.target.value || 0),
                    },
                  })
                }
                className="border px-3 py-2 rounded"
                placeholder="₹"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">UPI Amount</span>
              <input
                type="number"
                name="splitUPI"
                value={settings.splitPayment?.upi || ""}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    splitPayment: {
                      ...settings.splitPayment,
                      upi: parseFloat(e.target.value || 0),
                    },
                  })
                }
                className="border px-3 py-2 rounded"
                placeholder="₹"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">Card Amount</span>
              <input
                type="number"
                name="splitCard"
                value={settings.splitPayment?.card || ""}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    splitPayment: {
                      ...settings.splitPayment,
                      card: parseFloat(e.target.value || 0),
                    },
                  })
                }
                className="border px-3 py-2 rounded"
                placeholder="₹"
              />
            </label>
          </div>
        )}

        {settings.paymentMode === "credit" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">Credit Due Date</span>
              <input
                type="date"
                name="creditDueDate"
                value={settings.creditDueDate || ""}
                onChange={handleChange}
                className="border px-3 py-2 rounded"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">Credit Note</span>
              <input
                type="text"
                name="creditNote"
                value={settings.creditNote || ""}
                onChange={handleChange}
                className="border px-3 py-2 rounded"
                placeholder="Optional note or reference"
              />
            </label>
          </div>
        )}

        {settings.paymentMode === "advance" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">Advance Paid</span>
              <input
                type="number"
                name="advancePaid"
                value={settings.advancePaid || ""}
                onChange={handleChange}
                className="border px-3 py-2 rounded"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium">Expected Payment Completion Date</span>
              <input
                type="date"
                name="advanceDueDate"
                value={settings.advanceDueDate || ""}
                onChange={handleChange}
                className="border px-3 py-2 rounded"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceSettings;