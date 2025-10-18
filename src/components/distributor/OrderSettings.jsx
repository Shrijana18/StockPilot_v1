import React, { useState, useEffect, useCallback } from "react";
import { auth } from "../../firebase/firebaseConfig";
import ProformaDefaults from "../distributor/proforma/ProformaDefaults";
import RetailerDefaultsTable from "../distributor/proforma/RetailerDefaultsTable";
import AssignDefaultsModal from "../distributor/proforma/AssignDefaultsModal";

/**
 * OrderSettings.jsx — Clean version
 * --------------------------------------------------------------
 * A minimal, focused hub:
 *  • One large card for Global Defaults (with your existing live preview)
 *  • A compact toolbar for Bulk Assign + Review Overrides
 *  • Overrides are shown in a modal so the main page stays clean
 */
export default function OrderSettings(props = {}) {
  const distributorId = auth?.currentUser?.uid || null;
  // --- scope awareness (retailer vs global) ---
  const scope = props.scope || (props.retailerId ? "retailer" : "global");
  const isRetailer = scope === "retailer";
  const hideGlobalCtas = !!props.hideGlobalCtas;

  const [assignOpen, setAssignOpen] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (assignOpen || overridesOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prev || "";
    }
    return () => { document.body.style.overflow = prev || ""; };
  }, [assignOpen, overridesOpen]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      if (overridesOpen) setOverridesOpen(false);
      if (assignOpen) setAssignOpen(false);
    }
  }, [overridesOpen, assignOpen]);

  return (
    <div className="order-settings-root p-4 md:p-6 lg:p-8">
      <style>{`
        .order-settings-root .card { border-radius: 12px; }
        .order-settings-root .section-title { margin-bottom: 0.5rem; }
        .order-settings-root .muted { color: rgba(255,255,255,0.6); }
      `}</style>
      {/* Header */}
      <header className="mb-4 md:mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white">Order Settings</h1>
          {isRetailer ? (
            <p className="mt-1 text-sm text-white/70">
              Define defaults for <strong>this retailer only</strong>. These values override your global defaults when creating proformas or orders for this retailer.
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/70">
              Define your <strong>default</strong> taxes &amp; charges for proformas. Use <strong>Bulk Assign</strong> for many retailers and <strong>Review Overrides</strong> to fine‑tune individual retailers.
            </p>
          )}
        </div>

        {/* Toolbar */}
        {!isRetailer && !hideGlobalCtas && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOverridesOpen(true)}
              className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 text-sm font-medium text-white"
            >
              Review Overrides
            </button>
            <button
              onClick={() => setAssignOpen(true)}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-medium text-white"
            >
              Bulk Assign Defaults
            </button>
          </div>
        )}
      </header>

      {/* Retailer/Global Defaults — Clean, two-column layout */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 elevate">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            {isRetailer ? "Retailer Defaults" : "Global Defaults"}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/70">
              {isRetailer ? "Retailer Specific" : "Applies to all"}
            </span>
          </h2>
          <span className="text-xs subtle">Baseline for new proformas; individual overrides take precedence</span>
        </div>
        <div className="space-y-4 compact-form">
          <ProformaDefaults distributorId={distributorId} />
          <div className="text-xs subtle pt-1">
            Tip: Per‑retailer overrides take priority over global defaults. Turn on “Enabled” to activate default charges/percentages.
          </div>
        </div>
      </section>

      {/* Overrides Modal (kept out of the main flow for cleanliness) */}
      {overridesOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Retailer Overrides"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setOverridesOpen(false)} />
          <div className="relative w-[98%] max-w-[1080px] h-[90vh] rounded-2xl border border-white/10 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
            {/* Sticky header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0B0F14]/95">
              <div className="text-white font-semibold">Retailer Overrides</div>
              <button
                onClick={() => setOverridesOpen(false)}
                className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 text-sm text-white"
              >
                Close
              </button>
            </div>
            {/* Scrollable body */}
            <div className="h-[calc(90vh-104px)] overflow-y-auto p-4 md:p-5 glass-scroll">
              <RetailerDefaultsTable distributorId={distributorId} />
            </div>
            {/* Sticky footer */}
            <div className="px-5 py-3 border-t border-white/10 bg-[#0B0F14]/95 flex items-center justify-end">
              <button
                onClick={() => setOverridesOpen(false)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk assign modal */}
      <AssignDefaultsModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        distributorId={distributorId}
        // Recommended layout props consumed inside the modal (non-breaking if ignored)
        containerClassName="w-[98%] max-w-[1080px] h-[90vh]"
        bodyClassName="h-[calc(90vh-104px)] overflow-y-auto"
      />
    </div>
  );
}