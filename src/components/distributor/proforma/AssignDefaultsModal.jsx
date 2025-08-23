import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { db, auth } from "../../../firebase/firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { setRetailerDefaults } from "../../../services/proformaDefaults";
import { toast } from "react-toastify";

/**
 * AssignDefaultsModal.jsx
 * -------------------------------------------------------
 * Bulk-assign retailer-specific overrides to one or more
 * connected retailers (status: "accepted").
 *
 * Props:
 *  - open: boolean
 *  - onClose: function
 *  - distributorId: string
 *  - containerClassName: string (optional, layout)
 *  - bodyClassName: string (optional, layout)
 */
export default function AssignDefaultsModal({
  open,
  onClose,
  distributorId,
  containerClassName = "w-[98%] max-w-[1080px] h-[90vh]",
  bodyClassName = "h-[calc(90vh-104px)] overflow-y-auto"
}) {
  const [loading, setLoading] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const [selected, setSelected] = useState({});
  const [form, setForm] = useState({
    enabled: true,
    taxType: "",
    autodetectTaxType: "",
    gstRate: "",
    cgstRate: "",
    sgstRate: "",
    igstRate: "",
    deliveryFee: "",
    packingFee: "",
    insuranceFee: "",
    otherFee: "",
    discountPct: "",
    discountAmt: "",
    roundRule: "",
    notes: "",
  });

  const allSelected = useMemo(
    () =>
      retailers.length > 0 &&
      retailers.every((r) => selected[r.retailerId]),
    [retailers, selected]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function loadConnected() {
      if (!distributorId) return;
      setLoading(true);
      try {
        const connRef = collection(
          db,
          "businesses",
          distributorId,
          "connectedRetailers"
        );
        const q = query(connRef, where("status", "==", "accepted"));
        const snap = await getDocs(q);
        const arr = [];
        for (const d of snap.docs) {
          const retailerId = d.id;
          const retailerData = d.data();
          const profileSnap = await getDoc(doc(db, "businesses", retailerId));
          const profile = profileSnap.exists() ? profileSnap.data() : {};
          arr.push({
            retailerId,
            retailerName:
              profile.businessName ||
              profile.ownerName ||
              profile.name ||
              retailerData.retailerName ||
              "Unnamed",
            retailerEmail: profile.email || retailerData.retailerEmail || "",
          });
        }
        if (active) {
          setRetailers(arr);
          const initSel = {};
          arr.forEach((r) => (initSel[r.retailerId] = false));
          setSelected(initSel);
        }
      } catch (err) {
        console.error("Failed to load connected retailers", err);
        toast.error("Failed to load connected retailers");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadConnected();
    return () => {
      active = false;
    };
  }, [open, distributorId]);

  const closeAndReset = () => {
    setForm({
      enabled: true,
      taxType: "",
      autodetectTaxType: "",
      gstRate: "",
      cgstRate: "",
      sgstRate: "",
      igstRate: "",
      deliveryFee: "",
      packingFee: "",
      insuranceFee: "",
      otherFee: "",
      discountPct: "",
      discountAmt: "",
      roundRule: "",
      notes: "",
    });
    setSelected({});
    onClose?.();
  };

  const toggleAll = () => {
    const next = {};
    retailers.forEach((r) => {
      next[r.retailerId] = !allSelected;
    });
    setSelected(next);
  };

  const toggleOne = (retailerId) => {
    setSelected((prev) => ({ ...prev, [retailerId]: !prev[retailerId] }));
  };

  // Converts the form into a payload where empty strings become nulls,
  // and non-empty numeric-like strings become Numbers. Leaves booleans as-is.
  const buildPayload = () => {
    const normalize = (v, numeric = false) => {
      if (v === "" || v === undefined) return null;
      if (numeric) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      if (v === "true") return true;
      if (v === "false") return false;
      return v;
    };

    return {
      enabled: form.enabled,
      taxType: form.taxType || null,
      autodetectTaxType:
        form.autodetectTaxType === "" ? null : form.autodetectTaxType === true || form.autodetectTaxType === "true",
      gstRate: normalize(form.gstRate, true),
      cgstRate: normalize(form.cgstRate, true),
      sgstRate: normalize(form.sgstRate, true),
      igstRate: normalize(form.igstRate, true),
      deliveryFee: normalize(form.deliveryFee, true),
      packingFee: normalize(form.packingFee, true),
      insuranceFee: normalize(form.insuranceFee, true),
      otherFee: normalize(form.otherFee, true),
      discountPct: normalize(form.discountPct, true),
      discountAmt: normalize(form.discountAmt, true),
      roundRule: form.roundRule || null,
      notes: form.notes || null,
    };
  };

  const handleAssign = async () => {
    try {
      setLoading(true);
      const payload = buildPayload();
      const actorUid = auth?.currentUser?.uid || null;
      const targets = retailers.filter((r) => selected[r.retailerId]);

      if (targets.length === 0) {
        toast.info("Select at least one retailer");
        return;
      }

      for (const r of targets) {
        await setRetailerDefaults(distributorId, r.retailerId, payload, { actorUid });
      }
      toast.success(`Defaults assigned to ${targets.length} retailer(s)`);
      closeAndReset();
    } catch (err) {
      console.error("Assign defaults failed", err);
      toast.error("Failed to assign defaults");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Assign Retailer Overrides (Bulk)" className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={closeAndReset} />
      {/* Modal */}
      <div className={`relative z-10 rounded-2xl border border-white/10 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden w-[98%] max-w-[1080px] ${containerClassName}`}>
        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0B0F14]/95">
          <h3 className="text-base font-semibold text-white">Assign Retailer Overrides (Bulk)</h3>
          <button onClick={closeAndReset} className="rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/15">Close</button>
        </div>

        {/* Scrollable body */}
        <div className={`p-4 md:p-5 ${bodyClassName}`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 h-full">
            {/* Left: Retailer list */}
            <div className="md:col-span-5 lg:col-span-4 flex flex-col min-h-0">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium text-white">Select Retailers</div>
                <button onClick={toggleAll} className="text-xs text-indigo-300 hover:text-indigo-200" disabled={loading || retailers.length === 0}>
                  {allSelected ? "Clear All" : "Select All"}
                </button>
              </div>
              <input
                type="text"
                placeholder="Search retailers…"
                className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-indigo-400"
                onChange={(e) => {
                  const q = e.target.value.toLowerCase();
                  setRetailers((prev) => prev.map(r => ({...r, _hidden: !(r.retailerName?.toLowerCase().includes(q) || r.retailerEmail?.toLowerCase().includes(q)) })));
                }}
              />
              <div className="flex-1 overflow-y-auto rounded border border-white/10 bg-black/20">
                {loading ? (
                  <div className="p-3 text-sm text-white/60">Loading…</div>
                ) : retailers.length === 0 ? (
                  <div className="p-3 text-sm text-white/60">No connected retailers.</div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {retailers.map((r) => (
                      r._hidden ? null : (
                      <li key={r.retailerId} className="flex items-center gap-3 p-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!selected[r.retailerId]}
                          onChange={() => toggleOne(r.retailerId)}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{r.retailerName}</div>
                          {r.retailerEmail ? (
                            <div className="truncate text-xs text-white/60">{r.retailerEmail}</div>
                          ) : null}
                        </div>
                      </li>)
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right: Form */}
            <div className="md:col-span-7 lg:col-span-8 min-h-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Toggles */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-white">Enable overrides</label>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.enabled ? "bg-indigo-600" : "bg-white/30"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-white">Autodetect Tax Type</label>
                  <select className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={form.autodetectTaxType} onChange={(e) => setForm((f) => ({ ...f, autodetectTaxType: e.target.value }))}>
                    <option value="">Leave as-is</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-white">Tax Type (fallback)</label>
                  <select className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={form.taxType} onChange={(e) => setForm((f) => ({ ...f, taxType: e.target.value }))}>
                    <option value="">Leave as-is</option>
                    <option value="CGST_SGST">CGST + SGST</option>
                    <option value="IGST">IGST</option>
                  </select>
                </div>

                {/* Rates */}
                <NumberInput label="GST (Single) %" value={form.gstRate} onChange={(v) => setForm((f) => ({ ...f, gstRate: v }))} />
                <NumberInput label="CGST %" value={form.cgstRate} onChange={(v) => setForm((f) => ({ ...f, cgstRate: v }))} />
                <NumberInput label="SGST %" value={form.sgstRate} onChange={(v) => setForm((f) => ({ ...f, sgstRate: v }))} />
                <NumberInput label="IGST %" value={form.igstRate} onChange={(v) => setForm((f) => ({ ...f, igstRate: v }))} />

                {/* Fees */}
                <NumberInput label="Delivery Fee (₹)" value={form.deliveryFee} onChange={(v) => setForm((f) => ({ ...f, deliveryFee: v }))} />
                <NumberInput label="Packing Fee (₹)" value={form.packingFee} onChange={(v) => setForm((f) => ({ ...f, packingFee: v }))} />
                <NumberInput label="Insurance Fee (₹)" value={form.insuranceFee} onChange={(v) => setForm((f) => ({ ...f, insuranceFee: v }))} />
                <NumberInput label="Other Fee (₹)" value={form.otherFee} onChange={(v) => setForm((f) => ({ ...f, otherFee: v }))} />

                {/* Discount */}
                <NumberInput label="Discount %" value={form.discountPct} onChange={(v) => setForm((f) => ({ ...f, discountPct: v }))} />
                <NumberInput label="Discount Amount (₹)" value={form.discountAmt} onChange={(v) => setForm((f) => ({ ...f, discountAmt: v }))} />

                {/* Rounding */}
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-white">Rounding</label>
                  <select className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" value={form.roundRule} onChange={(e) => setForm((f) => ({ ...f, roundRule: e.target.value }))}>
                    <option value="">Leave as-is</option>
                    <option value="nearest">Nearest ₹</option>
                    <option value="up">Round Up</option>
                    <option value="down">Round Down</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-white">Notes</label>
                  <textarea className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional internal notes" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 bg-[#0B0F14]/95">
          <div className="text-xs text-white/60">{Object.values(selected).filter(Boolean).length} selected</div>
          <div className="flex items-center gap-2">
            <button className="rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/15" onClick={closeAndReset} disabled={loading}>Cancel</button>
            <button className={`rounded-md px-3 py-2 text-sm text-white ${loading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"}`} onClick={handleAssign} disabled={loading}>
              {loading ? "Assigning…" : "Assign to Selected"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-white">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:border-indigo-400 text-right"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
