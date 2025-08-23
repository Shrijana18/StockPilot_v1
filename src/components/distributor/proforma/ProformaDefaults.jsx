import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { computeChargesFromDefaults, resolveTaxType } from "../../../services/proformaDefaults";
import { toast } from "react-toastify";

/**
 * ProformaDefaults.jsx
 * Distributor-side screen to manage Global Proforma Defaults
 * - Safe, non-breaking
 * - Prefills existing defaults (or sane base)
 * - Live preview of charges for a sample subtotal
 *
 * NOTE:
 * Retailer overrides table and Assign-in-bulk modal are separate files:
 *   - src/components/distributor/proforma/RetailerDefaultsTable.jsx
 *   - src/components/distributor/proforma/AssignDefaultsModal.jsx
 * We intentionally don't import them here yet to avoid build errors until you add those files.
 */

const formatINR = (amt = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amt || 0));

const NumberInput = ({ label, name, value, onChange, step = "0.01", min = "0", hint, compact = false }) => (
  <div className={compact ? "flex flex-col gap-0.5" : "flex flex-col gap-1"}>
    <label className={compact ? "text-xs font-medium text-white" : "text-sm font-medium text-white"}>{label}</label>
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      className={`w-full rounded-lg border border-white/15 bg-white/5 px-3 ${compact ? "py-1.5 text-[13px]" : "py-2 text-sm"} text-white placeholder-white/40 outline-none focus:border-indigo-400 text-right`}
      name={name}
      value={value ?? ""}
      onChange={(e) => onChange(name, e.target.value === "" ? "" : Number(e.target.value))}
    />
    {hint ? <p className={compact ? "text-[11px] text-white/60" : "text-xs text-white/60"}>{hint}</p> : null}
  </div>
);

const Switch = ({ label, checked, onChange, compact = false }) => (
  <label className="inline-flex items-center gap-3">
    <span className={compact ? "text-xs font-medium text-white" : "text-sm font-medium text-white"}>{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${compact ? "h-5 w-9" : "h-6 w-11"} items-center rounded-full transition ${
        checked ? "bg-indigo-600" : "bg-white/30"
      }`}
    >
      <span
        className={`inline-block ${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transform rounded-full bg-white transition ${
          checked ? (compact ? "translate-x-5" : "translate-x-6") : (compact ? "translate-x-1" : "translate-x-1")
        }`}
      />
    </button>
  </label>
);

// --- Firestore helpers (read/write under distributor business) ---
async function getGlobalDefaultsSafe(distributorId) {
  if (!distributorId) return {};
  // Use a document under the orderSettings collection
  const ref = doc(db, "businesses", distributorId, "orderSettings", "global");
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() || {};
  } catch (e) {
    console.error("getGlobalDefaultsSafe error", e);
  }
  return {};
}

async function setGlobalDefaultsSafe(distributorId, payload) {
  if (!distributorId) throw new Error("Missing distributorId");
  // Write to the 'global' document inside orderSettings
  const ref = doc(db, "businesses", distributorId, "orderSettings", "global");
  await setDoc(ref, payload, { merge: true });
}

export default function ProformaDefaults({ compact = false, distributorId: distributorIdProp, retailerId = null, scope = "global" } = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [autodetectTaxType, setAutodetectTaxType] = useState(true);
  const [taxType, setTaxType] = useState(null); // "CGST_SGST" | "IGST" | null
  const [skipProforma, setSkipProforma] = useState(false);

  const [gstRate, setGstRate] = useState(18);
  const [cgstRate, setCgstRate] = useState(9);
  const [sgstRate, setSgstRate] = useState(9);
  const [igstRate, setIgstRate] = useState(18);

  const [deliveryFee, setDeliveryFee] = useState(0);
  const [packingFee, setPackingFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [otherFee, setOtherFee] = useState(0);

  const [discountPct, setDiscountPct] = useState(0);
  const [discountAmt, setDiscountAmt] = useState(0);

  const [roundRule, setRoundRule] = useState("nearest"); // nearest|up|down

  // Live preview input & output
  const [sampleSubTotal, setSampleSubTotal] = useState(10000);
  const [preview, setPreview] = useState(null);

  const distributorId = distributorIdProp || auth?.currentUser?.uid || null;
// --- Retailer override Firestore helpers ---
async function getRetailerOverrideSafe(distributorId, retailerId) {
  if (!distributorId || !retailerId) return {};
  // Store retailer overrides as docs under /orderSettings/global/retailerOverrides/{retailerId}
  const ref = doc(db, "businesses", distributorId, "orderSettings", "global", "retailerOverrides", retailerId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() || {};
  } catch (e) {
    console.error("getRetailerOverrideSafe error", e);
  }
  return {};
}

async function setRetailerOverrideSafe(distributorId, retailerId, payload) {
  if (!distributorId || !retailerId) throw new Error("Missing distributorId/retailerId");
  const ref = doc(db, "businesses", distributorId, "orderSettings", "global", "retailerOverrides", retailerId);
  await setDoc(ref, payload, { merge: true });
}

  // merged "defaults" object for compute function
  const defaultsObj = useMemo(
    () => ({
      enabled,
      autodetectTaxType,
      taxType,
      gstRate,
      cgstRate,
      sgstRate,
      igstRate,
      deliveryFee,
      packingFee,
      insuranceFee,
      otherFee,
      discountPct,
      discountAmt,
      roundRule,
      skipProforma,
    }),
    [
      enabled,
      autodetectTaxType,
      taxType,
      gstRate,
      cgstRate,
      sgstRate,
      igstRate,
      deliveryFee,
      packingFee,
      insuranceFee,
      otherFee,
      discountPct,
      discountAmt,
      roundRule,
      skipProforma,
    ]
  );

  // Load defaults on mount
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!distributorId) return;
        setLoading(true);

        if (scope === "retailer" && retailerId) {
          const [globalData, overrideData] = await Promise.all([
            getGlobalDefaultsSafe(distributorId),
            getRetailerOverrideSafe(distributorId, retailerId),
          ]);

          const src = { ...globalData, ...overrideData };

          setEnabled(Boolean(src.enabled));
          setAutodetectTaxType(Boolean(src.autodetectTaxType));
          setTaxType(src.taxType ?? null);

          setGstRate(asNum(src.gstRate, 18));
          setCgstRate(asNum(src.cgstRate, 9));
          setSgstRate(asNum(src.sgstRate, 9));
          setIgstRate(asNum(src.igstRate, 18));

          setDeliveryFee(asNum(src.deliveryFee, 0));
          setPackingFee(asNum(src.packingFee, 0));
          setInsuranceFee(asNum(src.insuranceFee, 0));
          setOtherFee(asNum(src.otherFee, 0));

          setDiscountPct(clampPct(asNum(src.discountPct, 0)));
          setDiscountAmt(asNum(src.discountAmt, 0));

          setRoundRule(["nearest", "up", "down"].includes(src.roundRule) ? src.roundRule : "nearest");
          setSkipProforma(Boolean(src.skipProforma));
        } else {
          const data = await getGlobalDefaultsSafe(distributorId);

          setEnabled(Boolean(data.enabled));
          setAutodetectTaxType(Boolean(data.autodetectTaxType));
          setTaxType(data.taxType ?? null);

          setGstRate(asNum(data.gstRate, 18));
          setCgstRate(asNum(data.cgstRate, 9));
          setSgstRate(asNum(data.sgstRate, 9));
          setIgstRate(asNum(data.igstRate, 18));

          setDeliveryFee(asNum(data.deliveryFee, 0));
          setPackingFee(asNum(data.packingFee, 0));
          setInsuranceFee(asNum(data.insuranceFee, 0));
          setOtherFee(asNum(data.otherFee, 0));

          setDiscountPct(clampPct(asNum(data.discountPct, 0)));
          setDiscountAmt(asNum(data.discountAmt, 0));

          setRoundRule(["nearest", "up", "down"].includes(data.roundRule) ? data.roundRule : "nearest");
          setSkipProforma(Boolean(data.skipProforma));
        }
      } catch (err) {
        console.error("Load defaults failed:", err);
        safeToast("Failed to load defaults");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [distributorId, scope, retailerId]);

  // Recompute preview whenever inputs change
  useEffect(() => {
    try {
      if (!enabled) {
        setPreview(null);
        return;
      }
      const out = computeChargesFromDefaults({
        itemsSubTotal: asNum(sampleSubTotal, 0),
        defaults: defaultsObj,
        distributorProfile: null, // tax autodetect uses profile state codes; you can pass them later
        retailerProfile: null,
      });
      setPreview(out);
    } catch (e) {
      console.warn("Preview computation failed", e);
      setPreview(null);
    }
  }, [defaultsObj, sampleSubTotal, enabled]);

  const handleSave = async () => {
    if (!distributorId) {
      safeToast("Not authenticated. Please re-login.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        enabled,
        autodetectTaxType,
        taxType,
        gstRate: asNum(gstRate, 0),
        cgstRate: asNum(cgstRate, 0),
        sgstRate: asNum(sgstRate, 0),
        igstRate: asNum(igstRate, 0),
        deliveryFee: asNum(deliveryFee, 0),
        packingFee: asNum(packingFee, 0),
        insuranceFee: asNum(insuranceFee, 0),
        otherFee: asNum(otherFee, 0),
        discountPct: clampPct(asNum(discountPct, 0)),
        discountAmt: asNum(discountAmt, 0),
        roundRule,
        skipProforma: Boolean(skipProforma),
      };

      if (scope === "retailer" && retailerId) {
        await setRetailerOverrideSafe(distributorId, retailerId, payload);
      } else {
        await setGlobalDefaultsSafe(distributorId, payload);
      }
      safeToast("Defaults saved");
    } catch (err) {
      console.error("Save defaults failed:", err);
      safeToast("Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  // UI
  return (
    <div className={`grid grid-cols-1 ${compact ? "gap-4" : "gap-6"} md:grid-cols-12`}>
      {/* Left: Form */}
      <div className={`col-span-12 md:col-span-7 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
        <div className={`sm:col-span-2 flex items-center justify-between ${compact ? "mb-1" : "mb-0"}`}>
          <h3 className={compact ? "text-sm font-semibold text-white" : "text-sm md:text-base font-semibold text-white"}>
            {scope === "retailer" ? "Defaults (Retailer Override)" : "Global Defaults"}
          </h3>
          <Switch label="Enabled" checked={enabled} onChange={setEnabled} compact={compact} />
          <span className="flex-1" />
          <Switch label="Skip Proforma (direct Order)" checked={skipProforma} onChange={setSkipProforma} compact={compact} />
        </div>

        <Switch label="Autodetect Tax Type (by state)" checked={autodetectTaxType} onChange={setAutodetectTaxType} compact={compact} />

        <div className="flex flex-col gap-1">
          <label className={compact ? "text-xs font-medium text-white" : "text-sm font-medium text-white"}>Tax Type (fallback)</label>
          <select
            className={`w-full rounded-lg border border-white/15 bg-white/5 px-3 ${compact ? "py-1.5 text-[13px]" : "py-2 text-sm"} text-white outline-none focus:border-indigo-400`}
            value={taxType ?? ""}
            onChange={(e) => setTaxType(e.target.value || null)}
          >
            <option value="">Auto / Not Set</option>
            <option value="CGST_SGST">CGST + SGST</option>
            <option value="IGST">IGST</option>
          </select>
          <p className={compact ? "text-[11px] text-white/60" : "text-xs text-white/60"}>If Autodetect is ON and state codes are known, intrastate → CGST/SGST, interstate → IGST.</p>
        </div>

        {/* Rates */}
        <NumberInput compact={compact} label="GST (Single) %" name="gstRate" value={gstRate} onChange={(_, v) => setGstRate(safeNum(v))} hint="Used for IGST when CGST/SGST not specified" />
        <NumberInput compact={compact} label="CGST %" name="cgstRate" value={cgstRate} onChange={(_, v) => setCgstRate(safeNum(v))} />
        <NumberInput compact={compact} label="SGST %" name="sgstRate" value={sgstRate} onChange={(_, v) => setSgstRate(safeNum(v))} />
        <NumberInput compact={compact} label="IGST %" name="igstRate" value={igstRate} onChange={(_, v) => setIgstRate(safeNum(v))} />

        {/* Fees */}
        <NumberInput compact={compact} label="Delivery Fee (₹)" name="deliveryFee" value={deliveryFee} onChange={(_, v) => setDeliveryFee(safeNum(v))} />
        <NumberInput compact={compact} label="Packing Fee (₹)" name="packingFee" value={packingFee} onChange={(_, v) => setPackingFee(safeNum(v))} />
        <NumberInput compact={compact} label="Insurance Fee (₹)" name="insuranceFee" value={insuranceFee} onChange={(_, v) => setInsuranceFee(safeNum(v))} />
        <NumberInput compact={compact} label="Other Fee (₹)" name="otherFee" value={otherFee} onChange={(_, v) => setOtherFee(safeNum(v))} />

        {/* Discount */}
        <NumberInput compact={compact} label="Discount %" name="discountPct" value={discountPct} onChange={(_, v) => setDiscountPct(clampPct(safeNum(v)))} hint="0 to 100" />
        <NumberInput compact={compact} label="Discount Amount (₹)" name="discountAmt" value={discountAmt} onChange={(_, v) => setDiscountAmt(safeNum(v))} hint="If both % and amount are set, higher discount is applied." />

        {/* Rounding */}
        <div className="flex flex-col gap-1">
          <label className={compact ? "text-xs font-medium text-white" : "text-sm font-medium text-white"}>Rounding</label>
          <select className={`w-full rounded-lg border border-white/15 bg-white/5 px-3 ${compact ? "py-1.5 text-[13px]" : "py-2 text-sm"} text-white outline-none focus:border-indigo-400`} value={roundRule} onChange={(e) => setRoundRule(e.target.value)}>
            <option value="nearest">Nearest ₹</option>
            <option value="up">Round Up</option>
            <option value="down">Round Down</option>
          </select>
        </div>

        <div className={`sm:col-span-2 flex items-center justify-end gap-3 ${compact ? "pt-1" : "pt-2"}`}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm ${
              saving || loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {saving ? "Saving..." : "Save Defaults"}
          </button>
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="col-span-12 md:col-span-5 lg:col-span-4">
        <div className={`rounded-lg border border-white/10 bg-white/5 ${compact ? "p-3" : "p-4"}`}>
          <div className={`mb-3 flex items-center justify-between gap-3 ${compact ? "mb-2" : "mb-3"}`}>
            <h3 className={compact ? "text-xs font-semibold text-white" : "text-sm font-semibold text-white"}>Live Preview</h3>
            <div className={compact ? "w-36" : "w-40"}>
              <NumberInput compact={compact} label="Sample Subtotal (₹)" name="sampleSubtotal" value={sampleSubTotal} onChange={(_, v) => setSampleSubTotal(safeNum(v))} step="1" min="0" />
            </div>
          </div>

          {!enabled ? (
            <p className="text-sm text-white/60">Defaults are disabled. Turn them on to preview.</p>
          ) : preview ? (
            <div className={compact ? "text-[13px]" : "text-sm"}>
              <PreviewRow k="Tax Type" v={resolveTaxType({ defaults: defaultsObj })} compact={compact} />
              <PreviewRow k="Subtotal" v={formatINR(preview.subTotal)} compact={compact} />
              {Number(preview.discountAmt) > 0 && (
                <PreviewRow k="Discount Applied" v={`- ${formatINR(preview.discountAmt)}`} compact={compact} />
              )}
              {Number(preview.delivery) > 0 && <PreviewRow k="Delivery" v={formatINR(preview.delivery)} compact={compact} />}
              {Number(preview.packing) > 0 && <PreviewRow k="Packing" v={formatINR(preview.packing)} compact={compact} />}
              {Number(preview.insurance) > 0 && <PreviewRow k="Insurance" v={formatINR(preview.insurance)} compact={compact} />}
              {Number(preview.other) > 0 && <PreviewRow k="Other" v={formatINR(preview.other)} compact={compact} />}

              <div className="my-2 border-t border-dashed border-white/15" />

              <PreviewRow k="Taxable Base" v={formatINR(preview.taxableBase)} compact={compact} />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <MiniStat label="CGST" value={formatINR(preview.taxBreakup?.cgst || 0)} compact={compact} />
                <MiniStat label="SGST" value={formatINR(preview.taxBreakup?.sgst || 0)} compact={compact} />
                <MiniStat label="IGST" value={formatINR(preview.taxBreakup?.igst || 0)} compact={compact} />
              </div>

              <div className="my-2 border-t border-dashed border-white/15" />
              <PreviewRow k="Taxes" v={formatINR(preview.taxes)} compact={compact} />
              <PreviewRow k="Round Off" v={formatINR(preview.roundOff)} compact={compact} />
              <PreviewRow k="Grand Total" v={formatINR(preview.grandTotal)} strong compact={compact} />
            </div>
          ) : (
            <p className="text-sm text-white/60">No preview available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ k, v, strong = false, compact = false }) {
  return (
    <div className={compact ? "flex items-center justify-between py-0.5" : "flex items-center justify-between py-1"}>
      <span className="text-white/70">{k}</span>
      <span className={strong ? "font-semibold text-white" : "text-white"}>{v}</span>
    </div>
  );
}

function MiniStat({ label, value, compact = false }) {
  return (
    <div className={compact ? "rounded-md bg-white/5 p-1.5 text-center shadow-sm border border-white/10" : "rounded-md bg-white/5 p-2 text-center shadow-sm border border-white/10"}>
      <div className={compact ? "text-[10px] uppercase tracking-wide text-white/60" : "text-[11px] uppercase tracking-wide text-white/60"}>{label}</div>
      <div className={compact ? "text-[13px] font-semibold text-white" : "text-sm font-semibold text-white"}>{value}</div>
    </div>
  );
}

// Utilities
function asNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function safeNum(x) {
  if (x === "" || x === null || typeof x === "undefined") return "";
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function clampPct(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
function safeToast(msg) {
  try {
    toast.dismiss();
    toast(msg, { type: "success" });
  } catch {
    // react-toastify not mounted -> fallback
    console.log(msg);
  }
}