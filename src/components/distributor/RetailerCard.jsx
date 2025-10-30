import React, { useState, useMemo } from "react";
import ProformaDefaults from "./proforma/ProformaDefaults";

const norm = (s = "") => s.toString().trim();
const initialsOf = (name = "") =>
  (name || "R")
    .toString()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "R";

const toTitleCase = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();

const prettyStatus = (s = "") =>
  s
    .toString()
    .replace(/[-_]/g, " ")
    .replace(/\b([a-z])/gi, (m) => m.toUpperCase())
    .trim();

const StatusBadge = ({ status }) => {
  const s = (status || "").toString().toLowerCase();
  let cls = "text-white/70 border-white/10 bg-white/5";
  if (s === "accepted" || s === "active" || s === "approved") {
    cls = "text-emerald-300 border-emerald-400/40 bg-emerald-500/10";
  } else if (s === "pending" || s === "requested" || s === "invited") {
    cls = "text-amber-300 border-amber-400/40 bg-amber-500/10";
  } else if (s === "rejected" || s === "blocked" || s === "disabled") {
    cls = "text-rose-300 border-rose-400/40 bg-rose-500/10";
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-lg border ${cls}`} aria-label={`Status: ${status || "unknown"}`}>
      {prettyStatus(status) || "—"}
    </span>
  );
};

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

  const displayName = useMemo(() => {
    const name = retailer.businessName || retailer.name || "Retailer";
    return toTitleCase(name);
  }, [retailer.businessName, retailer.name]);

  const ownerLine = useMemo(() => {
    if (!retailer.name) return null;
    const b = (retailer.businessName || "").trim().toLowerCase();
    const n = retailer.name.trim();
    if (b && b === n.toLowerCase()) return null;
    return toTitleCase(n);
  }, [retailer.businessName, retailer.name]);

  const cityPretty = useMemo(() => (retailer.city ? toTitleCase(retailer.city) : "—"), [retailer.city]);
  const emailShort = useMemo(() => retailer.email || "—", [retailer.email]);

  const avatarInitials = useMemo(
    () => initialsOf(retailer.name || retailer.businessName),
    [retailer.name, retailer.businessName]
  );
  const emailHref = retailer.email ? `mailto:${norm(retailer.email)}` : null;
  const phoneHref = retailer.phone ? `tel:${norm(retailer.phone)}` : null;

  const pill = (t, label, id) => (
    <button
      key={t}
      id={id}
      role="tab"
      aria-selected={tab === t}
      aria-controls={`panel-${t}`}
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
        <div
          className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-semibold text-emerald-200 shrink-0"
          role="img"
          aria-label={`Retailer avatar ${displayName}`}
          title={displayName}
        >
          {avatarInitials}
        </div>
        <div className="min-w-0 mr-auto">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-semibold text-white truncate" title={displayName}>
              {displayName}
            </div>
            {retailer.gstNumber && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 truncate max-w-[30ch]" title={`GST: ${retailer.gstNumber}`}>
                GST: {retailer.gstNumber}
              </span>
            )}
          </div>
          {ownerLine && (
            <div className="text-[11px] text-white/60 truncate" title={ownerLine}>
              Owner: {ownerLine}
            </div>
          )}
          <div className="text-xs text-white/70 truncate" title={`${cityPretty} • ${emailShort}`}>
            {cityPretty} • {emailShort}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge status={retailer.status} />
          {phoneHref && (
            <a
              href={phoneHref}
              className="ml-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
              aria-label="Call retailer"
              title="Call"
            >
              📞
            </a>
          )}
          {emailHref && (
            <a
              href={emailHref}
              className="ml-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
              aria-label="Email retailer"
              title="Email"
            >
              ✉️
            </a>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="ml-2 px-3 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          >
            {open ? "Hide Details" : "View Details"}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-t border-white/10 pt-3 mb-3" role="tablist" aria-label="Retailer card tabs">
            {pill("overview", "Retailer Overview", "tab-overview")}
            {pill("defaults", "Set Defaults", "tab-defaults")}
            {pill("orders", "Orders", "tab-orders")}
            {pill("assistant", "Assistant", "tab-assistant")}
          </div>

          {/* Panels */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
              <Info label="Business Name" value={retailer.businessName} />
              <Info label="GST Number" value={retailer.gstNumber} />
              <Info label="Email" value={retailer.email} />
              <Info label="Phone" value={retailer.phone} />
              <Info label="City" value={toTitleCase(retailer.city || "")} />
              <Info label="Retailer ID" value={retailer.uid} mono />
            </div>
          )}

          {tab === "defaults" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3" role="tabpanel" id="panel-defaults" aria-labelledby="tab-defaults">
              <ProformaDefaults
                compact
                scope="retailer"
                distributorId={distributorId}
                retailerId={retailer.uid}
              />
            </div>
          )}

          {tab === "orders" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3" role="tabpanel" id="panel-orders" aria-labelledby="tab-orders">
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
            <div className="rounded-xl border border-white/10 bg-white/5 p-3" role="tabpanel" id="panel-assistant" aria-labelledby="tab-assistant">
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
      <div className={`mt-1 text-sm text-white ${mono ? "font-mono" : ""} truncate`} title={value || "—"}>
        {value || "—"}
      </div>
    </div>
  );
}