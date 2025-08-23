import React, { useEffect, useState } from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  getRetailerDefaults,
  setRetailerDefaults,
} from "../../../services/proformaDefaults";
import { toast } from "react-toastify";

const hasOverride = (o = {}) => {
  if (!o) return false;
  const keys = [
    "taxType","autodetectTaxType","gstRate","cgstRate","sgstRate","igstRate",
    "deliveryFee","packingFee","insuranceFee","otherFee","discountPct","discountAmt","roundRule","notes","enabled"
  ];
  return keys.some((k) => o[k] !== undefined && o[k] !== null && o[k] !== "");
};

/**
 * RetailerDefaultsTable.jsx
 * -------------------------------------------------------
 * Displays connected retailers and lets distributor view/edit
 * their specific proforma default overrides.
 */

export default function RetailerDefaultsTable({ distributorId }) {
  const [loading, setLoading] = useState(true);
  const [retailers, setRetailers] = useState([]);
  const [editing, setEditing] = useState(null); // retailerId being edited
  const [overrides, setOverrides] = useState({}); // retailerId -> override

  // Load connected retailers
  useEffect(() => {
    let active = true;
    async function load() {
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
          // Fetch retailer business profile for display
          const profileSnap = await getDoc(doc(db, "businesses", retailerId));
          const profile = profileSnap.exists() ? profileSnap.data() : {};
          const defaults = await getRetailerDefaults(distributorId, retailerId);
          arr.push({
            retailerId,
            retailerName:
              profile.businessName ||
              profile.ownerName ||
              profile.name ||
              retailerData.retailerName ||
              "Unnamed",
            retailerEmail: profile.email || retailerData.retailerEmail || "",
            override: defaults,
          });
        }
        if (active) {
          setRetailers(arr);
          const map = {};
          arr.forEach((r) => {
            map[r.retailerId] = r.override;
          });
          setOverrides(map);
        }
      } catch (err) {
        console.error("Load retailer defaults failed", err);
        toast.error("Failed to load retailer defaults");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [distributorId]);

  const handleFieldChange = (retailerId, field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [retailerId]: {
        ...prev[retailerId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (retailerId) => {
    try {
      await setRetailerDefaults(distributorId, retailerId, overrides[retailerId], {
        actorUid: auth?.currentUser?.uid,
      });
      toast.success("Overrides saved");
    } catch (err) {
      console.error("Save override failed", err);
      toast.error("Failed to save overrides");
    }
  };

  const handleClear = async (retailerId) => {
    try {
      await setRetailerDefaults(distributorId, retailerId, {
        taxType: null,
        autodetectTaxType: null,
        gstRate: null,
        cgstRate: null,
        sgstRate: null,
        igstRate: null,
        deliveryFee: null,
        packingFee: null,
        insuranceFee: null,
        otherFee: null,
        discountPct: null,
        discountAmt: null,
        roundRule: null,
        notes: null,
      });
      setOverrides((prev) => ({
        ...prev,
        [retailerId]: {},
      }));
      toast.success("Overrides cleared");
    } catch (err) {
      console.error("Clear override failed", err);
      toast.error("Failed to clear overrides");
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-white/60">Loading retailer defaults…</div>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
      <table className="min-w-full text-sm text-white">
        <thead className="bg-white/5 text-white/70">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-white/80">Retailer</th>
            <th className="px-3 py-2 text-left font-medium text-white/80">Tax Type</th>
            <th className="px-3 py-2 text-left font-medium text-white/80">GST%</th>
            <th className="px-3 py-2 text-left font-medium text-white/80">Delivery Fee</th>
            <th className="px-3 py-2 text-left font-medium text-white/80">Discount%</th>
            <th className="px-3 py-2 text-left font-medium text-white/80">Actions</th>
          </tr>
        </thead>
        <tbody>
          {retailers.map((r) => {
            const o = overrides[r.retailerId] || {};
            return (
              <tr key={r.retailerId} className="border-t border-white/10 hover:bg-white/5 transition">
                <td className="px-3 py-2">
                  <div className="font-medium text-white">{r.retailerName}</div>
                  {r.retailerEmail && (
                    <div className="text-xs text-white/60">{r.retailerEmail}</div>
                  )}
                  <div className="mt-1">
                    {hasOverride(o) ? (
                      <span className="inline-block rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">Overridden</span>
                    ) : (
                      <span className="inline-block rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">Inherits Global</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400"
                    value={o.taxType ?? ""}
                    onChange={(e) =>
                      handleFieldChange(r.retailerId, "taxType", e.target.value || null)
                    }
                  >
                    <option value="">Default</option>
                    <option value="CGST_SGST">CGST+SGST</option>
                    <option value="IGST">IGST</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-24 rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400 text-right"
                    value={o.gstRate ?? ""}
                    onChange={(e) =>
                      handleFieldChange(r.retailerId, "gstRate", e.target.value === "" ? null : Number(e.target.value))
                    }
                    inputMode="decimal"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-24 rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400 text-right"
                    value={o.deliveryFee ?? ""}
                    onChange={(e) =>
                      handleFieldChange(r.retailerId, "deliveryFee", e.target.value === "" ? null : Number(e.target.value))
                    }
                    inputMode="decimal"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-24 rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-indigo-400 text-right"
                    value={o.discountPct ?? ""}
                    onChange={(e) =>
                      handleFieldChange(r.retailerId, "discountPct", e.target.value === "" ? null : Number(e.target.value))
                    }
                    inputMode="decimal"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2 space-x-2">
                  <button
                    onClick={() => handleSave(r.retailerId)}
                    className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700 shadow"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleClear(r.retailerId)}
                    className="rounded bg-white/10 border border-white/20 px-3 py-1 text-white hover:bg-white/15"
                  >
                    Clear
                  </button>
                </td>
              </tr>
            );
          })}
          {retailers.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-3 py-4 text-center text-sm text-white/60"
              >
                No connected retailers with accepted status.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="h-1" />
    </div>
  );
}