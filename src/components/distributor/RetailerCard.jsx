

import React, { useState } from "react";
import ProformaDefaults from "./proforma/ProformaDefaults";

/**
 * RetailerCard
 * Expandable, tabbed card for each connected retailer on the Distributor side.
 *
 * Props:
 *  - retailer: {
 *      uid, name, email, phone, city, businessName, gstNumber, status
 *    }
 *  - distributorId: string (current distributor UID)
 *  - onOpenOrders?: (retailer) => void
 *  - onOpenChat?: (retailer) => void
 */
export default function RetailerCard({ retailer = {}, distributorId, onOpenOrders, onOpenChat }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("overview"); // overview | defaults | orders | assistant

  const pill = (t, label) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
        tab === t
          ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B0F14]/70 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-semibold text-emerald-200">
          {(retailer.name || retailer.businessName || "R").toString().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 mr-auto">
          <div className="font-semibold text-white truncate">
            {retailer.name || retailer.businessName || "Retailer"}
          </div>
          <div className="text-xs text-white/70 truncate">
            {(retailer.city || "—")} • {(retailer.email || "—")}
          </div>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-lg border ${
            retailer.status === "Accepted"
              ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
              : retailer.status
              ? "text-amber-300 border-amber-400/40 bg-amber-500/10"
              : "text-white/70 border-white/10 bg-white/5"
          }`}
        >
          {retailer.status || "—"}
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-3 px-3 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
        >
          {open ? "Hide Details" : "View Details"}
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-t border-white/10 pt-3 mb-3">
            {pill("overview", "Retailer Overview")}
            {pill("defaults", "Set Defaults")}
            {pill("orders", "Orders")}
            {pill("assistant", "Assistant")}
          </div>

          {/* Panels */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Info label="Business Name" value={retailer.businessName} />
              <Info label="GST Number" value={retailer.gstNumber} />
              <Info label="Email" value={retailer.email} />
              <Info label="Phone" value={retailer.phone} />
              <Info label="City" value={retailer.city} />
              <Info label="Retailer ID" value={retailer.uid} mono />
            </div>
          )}

          {tab === "defaults" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <ProformaDefaults
                compact
                scope="retailer"
                distributorId={distributorId}
                retailerId={retailer.uid}
              />
            </div>
          )}

          {tab === "orders" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-white">Orders</div>
                <button
                  onClick={() => onOpenOrders?.(retailer)}
                  className="text-xs px-3 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Open Orders Page
                </button>
              </div>
              <div className="text-xs text-white/60">
                Hook this to your existing orders list or show last few orders here.
              </div>
            </div>
          )}

          {tab === "assistant" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-white">Assistant</div>
                <button
                  onClick={() => onOpenChat?.(retailer)}
                  className="text-xs px-3 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Open Chat
                </button>
              </div>
              <div className="text-xs text-white/60">
                Plug your assistantChats thread here if desired.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, mono }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className={`mt-1 text-sm text-white ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}