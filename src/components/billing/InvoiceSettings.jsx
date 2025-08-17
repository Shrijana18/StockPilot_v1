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
    <div className="p-4 md:p-6 rounded-xl space-y-6 mb-6 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-lg font-semibold mb-2 text-white">Invoice Settings</h2>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="includeGST"
            checked={settings.includeGST}
            onChange={handleChange}
            className="accent-emerald-400"
          />
          Include GST
          {settings.includeGST && (
            <input
              type="number"
              name="gstRate"
              value={settings.gstRate || ""}
              onChange={handleChange}
              className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
            className="accent-emerald-400"
          />
          Include CGST
          {settings.includeCGST && (
            <input
              type="number"
              name="cgstRate"
              value={settings.cgstRate || ""}
              onChange={handleChange}
              className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
            className="accent-emerald-400"
          />
          Include SGST
          {settings.includeSGST && (
            <input
              type="number"
              name="sgstRate"
              value={settings.sgstRate || ""}
              onChange={handleChange}
              className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
            className="accent-emerald-400"
          />
          Include IGST
          {settings.includeIGST && (
            <input
              type="number"
              name="igstRate"
              value={settings.igstRate || ""}
              onChange={handleChange}
              className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              placeholder="% IGST"
            />
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="mb-1 font-medium text-white/80">Invoice Type</span>
          <select
            name="invoiceType"
            value={settings.invoiceType}
            onChange={handleChange}
            className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          >
            <option value="">Select Invoice Type</option>
            <option value="retail">Retail</option>
            <option value="tax">Tax</option>
            <option value="quote">Quote</option>
            <option value="estimation">Estimation</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="mb-1 font-medium text-white/80">Payment Mode</span>
          <select
            name="paymentMode"
            value={settings.paymentMode}
            onChange={handleChange}
            className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
              <span className="mb-1 font-medium text-white/80">Cash Amount</span>
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
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="₹"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">UPI Amount</span>
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
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="₹"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">Card Amount</span>
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
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="₹"
              />
            </label>
          </div>
        )}

        {settings.paymentMode === "credit" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">Credit Due Date</span>
              <input
                type="date"
                name="creditDueDate"
                value={settings.creditDueDate || ""}
                onChange={handleChange}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">Credit Note</span>
              <input
                type="text"
                name="creditNote"
                value={settings.creditNote || ""}
                onChange={handleChange}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="Optional note or reference"
              />
            </label>
          </div>
        )}

        {settings.paymentMode === "advance" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">Advance Paid</span>
              <input
                type="number"
                name="advancePaid"
                value={settings.advancePaid || ""}
                onChange={handleChange}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">Expected Payment Completion Date</span>
              <input
                type="date"
                name="advanceDueDate"
                value={settings.advanceDueDate || ""}
                onChange={handleChange}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceSettings;