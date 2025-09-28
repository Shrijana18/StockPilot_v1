import React, { useState, useRef } from "react";

const InvoiceSettings = ({ settings, onChange, grandTotal }) => {
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

  // Nested updates for extras and driver without breaking existing logic
  const updateExtras = (patch) =>
    onChange({
      ...settings,
      extras: { ...(settings.extras || {}), ...patch },
    });

  const updateDriver = (patch) =>
    onChange({
      ...settings,
      driver: { ...(settings.driver || {}), ...patch },
    });

  // --- Smart Split Payment Helpers ---
  const totalTarget = Number(
    grandTotal ?? settings?.cartTotals?.finalTotal ?? settings?.finalTotal ?? 0
  );

  const editingRef = useRef(null); // 'cash' | 'upi' | 'card' | null

  const getSplit = () => ({
    cash: Number(settings?.splitPayment?.cash || 0),
    upi: Number(settings?.splitPayment?.upi || 0),
    card: Number(settings?.splitPayment?.card || 0),
  });

  const handleSplitChange = (field, raw) => {
    const value = Number(raw || 0);
    const prev = settings?.splitPayment || {};
    onChange({
      ...settings,
      splitPayment: { ...prev, [field]: value },
    });
  };

  const fillRemaining = (priority = ["upi", "card", "cash"]) => {
    const sp = settings?.splitPayment || {};
    const cash = Number(sp.cash || 0);
    const upi = Number(sp.upi || 0);
    const card = Number(sp.card || 0);
    const remain = Math.max(0, totalTarget - (cash + upi + card));
    if (remain <= 0) return;

    const target = priority.find(
      (k) => k !== editingRef.current && !Number(sp[k])
    );

    if (!target) return;
    onChange({
      ...settings,
      splitPayment: { ...sp, [target]: remain },
    });
  };

  const splitRemaining = () => {
    const { cash, upi, card } = getSplit();
    return Math.max(0, totalTarget - (cash + upi + card));
  };

  const [showExtras, setShowExtras] = useState(Boolean(settings?.extras));

  return (
    <div className="p-4 md:p-6 rounded-xl space-y-6 mb-6 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-lg font-semibold mb-2 text-white">Invoice Settings</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
          <label className="flex flex-col">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                name="includeGST"
                checked={settings.includeGST}
                onChange={handleChange}
                className="accent-emerald-400"
              />
              Include GST
            </span>
            {settings.includeGST && (
              <input
                type="number"
                name="gstRate"
                value={settings.gstRate || ""}
                onChange={handleChange}
                className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 mt-2"
                placeholder="% GST"
              />
            )}
          </label>
        </div>
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
          <label className="flex flex-col">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                name="includeCGST"
                checked={settings.includeCGST}
                onChange={handleChange}
                className="accent-emerald-400"
              />
              Include CGST
            </span>
            {settings.includeCGST && (
              <input
                type="number"
                name="cgstRate"
                value={settings.cgstRate || ""}
                onChange={handleChange}
                className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 mt-2"
                placeholder="% CGST"
              />
            )}
          </label>
        </div>
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
          <label className="flex flex-col">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                name="includeSGST"
                checked={settings.includeSGST}
                onChange={handleChange}
                className="accent-emerald-400"
              />
              Include SGST
            </span>
            {settings.includeSGST && (
              <input
                type="number"
                name="sgstRate"
                value={settings.sgstRate || ""}
                onChange={handleChange}
                className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 mt-2"
                placeholder="% SGST"
              />
            )}
          </label>
        </div>
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
          <label className="flex flex-col">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                name="includeIGST"
                checked={settings.includeIGST}
                onChange={handleChange}
                className="accent-emerald-400"
              />
              Include IGST
            </span>
            {settings.includeIGST && (
              <input
                type="number"
                name="igstRate"
                value={settings.igstRate || ""}
                onChange={handleChange}
                className="px-2 py-1 rounded w-20 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 mt-2"
                placeholder="% IGST"
              />
            )}
          </label>
        </div>
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
                value={settings.splitPayment?.cash ?? ""}
                onFocus={() => (editingRef.current = 'cash')}
                onBlur={() => { editingRef.current = null; fillRemaining(["upi", "card"]); }}
                onChange={(e) => handleSplitChange('cash', e.target.value)}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="₹ — type amount; use Fill remaining"
                inputMode="decimal"
                step="0.01"
                min="0"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">UPI Amount</span>
              <input
                type="number"
                name="splitUPI"
                value={settings.splitPayment?.upi ?? ""}
                onFocus={() => (editingRef.current = 'upi')}
                onBlur={() => { editingRef.current = null; fillRemaining(["card", "cash"]); }}
                onChange={(e) => handleSplitChange('upi', e.target.value)}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="₹ — type amount; use Fill remaining"
                inputMode="decimal"
                step="0.01"
                min="0"
              />
            </label>
            <label className="flex flex-col space-y-1">
              <span className="mb-1 font-medium text-white/80">Card Amount</span>
              <input
                type="number"
                name="splitCard"
                value={settings.splitPayment?.card ?? ""}
                onFocus={() => (editingRef.current = 'card')}
                onBlur={() => { editingRef.current = null; fillRemaining(["upi", "cash"]); }}
                onChange={(e) => handleSplitChange('card', e.target.value)}
                className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="₹ — type amount; use Fill remaining"
                inputMode="decimal"
                step="0.01"
                min="0"
              />
            </label>
            {/* Remaining hint and fill button */}
            <div className="sm:col-span-3 flex items-center gap-3 text-sm text-white/70">
              <span>Remaining balance: ₹{splitRemaining().toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              {splitRemaining() > 0 && (
                <button
                  type="button"
                  onClick={() => fillRemaining()}
                  className="px-2 py-1 rounded border border-white/20 bg-white/10 hover:bg-white/15 text-white"
                >
                  Fill remaining
                </button>
              )}
            </div>
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

      {/* Delivery & Extras */}
      <div className="mt-2 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Delivery & Extras</h3>
          <button
            type="button"
            onClick={() => setShowExtras((s) => !s)}
            className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
          >
            {showExtras ? "Hide" : "Show"}
          </button>
        </div>

        {showExtras && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Delivery Fee */}
              <label className="flex flex-col">
                <span className="mb-1 font-medium text-white/80">Delivery Fee</span>
                <input
                  type="number"
                  name="deliveryFee"
                  value={settings?.extras?.deliveryFee ?? ""}
                  onChange={(e) => updateExtras({ deliveryFee: parseFloat(e.target.value || 0) })}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="₹"
                />
              </label>

              {/* Packaging Fee */}
              <label className="flex flex-col">
                <span className="mb-1 font-medium text-white/80">Packaging Fee</span>
                <input
                  type="number"
                  name="packagingFee"
                  value={settings?.extras?.packagingFee ?? ""}
                  onChange={(e) => updateExtras({ packagingFee: parseFloat(e.target.value || 0) })}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="₹"
                />
              </label>

              {/* Insurance */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col">
                  <span className="mb-1 font-medium text-white/80">Insurance Type</span>
                  <select
                    name="insuranceType"
                    value={settings?.extras?.insuranceType || "none"}
                    onChange={(e) => updateExtras({ insuranceType: e.target.value })}
                    className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <option value="none">None</option>
                    <option value="flat">Flat</option>
                    <option value="percent">Percent of Subtotal</option>
                  </select>
                </label>
                <label className="flex flex-col">
                  <span className="mb-1 font-medium text-white/80">Insurance Value</span>
                  <input
                    type="number"
                    name="insuranceValue"
                    value={settings?.extras?.insuranceValue ?? ""}
                    onChange={(e) => updateExtras({ insuranceValue: parseFloat(e.target.value || 0) })}
                    className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="₹ or %"
                  />
                </label>
              </div>
            </div>

            {/* Driver Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="flex flex-col">
                <span className="mb-1 font-medium text-white/80">Driver Name</span>
                <input
                  type="text"
                  name="driverName"
                  value={settings?.driver?.name || ""}
                  onChange={(e) => updateDriver({ name: e.target.value })}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="e.g., Ramesh"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 font-medium text-white/80">Driver Phone</span>
                <input
                  type="text"
                  name="driverPhone"
                  value={settings?.driver?.phone || ""}
                  onChange={(e) => updateDriver({ phone: e.target.value })}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="10-digit"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 font-medium text-white/80">Vehicle / ID</span>
                <input
                  type="text"
                  name="driverVehicle"
                  value={settings?.driver?.vehicle || ""}
                  onChange={(e) => updateDriver({ vehicle: e.target.value })}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="MH12AB1234"
                />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 font-medium text-white/80">Tracking / Ref</span>
                <input
                  type="text"
                  name="driverTracking"
                  value={settings?.driver?.tracking || ""}
                  onChange={(e) => updateDriver({ tracking: e.target.value })}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  placeholder="Optional"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceSettings;