import React, { useEffect, useState, useCallback } from "react";
import { db } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import OrderSettings from "./OrderSettings";
import RetailerCard from "./RetailerCard";

// Helper badge for status
function StatusBadge({ status }) {
  const color =
    status === "accepted"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${color}`}
    >
      {status?.charAt(0)?.toUpperCase() + (status?.slice(1) || "")}
    </span>
  );
}

/**
 * ManageRetailers component
 * Props:
 *   distributorId (string): The current distributor's ID
 */
const ManageRetailers = ({ distributorId }) => {
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state for global/bulk Order Settings hub
  const [showOrderSettings, setShowOrderSettings] = useState(false);

  // Lock body scroll when any modal/drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (showOrderSettings) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => { document.body.style.overflow = prev || ''; };
  }, [showOrderSettings]);

  // Close on ESC
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (showOrderSettings) setShowOrderSettings(false);
    }
  }, [showOrderSettings]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!distributorId) return;
      setLoading(true);
      setError(null);
      try {
        // Read from Firestore: /businesses/{distributorId}/connectedRetailers where status == "accepted"
        const collRef = collection(
          db,
          "businesses",
          distributorId,
          "connectedRetailers"
        );
        const q = query(collRef, where("status", "==", "accepted"));
        const snap = await getDocs(q);

        const rows = [];
        for (const d of snap.docs) {
          const data = d.data() || {};
          const retailerId = d.id;

          // Hydrate from retailer business profile for nicer cards
          let profile = {};
          try {
            const profSnap = await getDoc(doc(db, "businesses", retailerId));
            if (profSnap.exists()) profile = profSnap.data() || {};
          } catch {}

          rows.push({
            id: retailerId,
            status: data.status || "accepted",
            businessName:
              data.retailerName || profile.businessName || profile.name || "Retailer",
            email: data.retailerEmail || profile.email || "",
            city: data.city || profile.city || "",
            phone: data.retailerPhone || profile.phone || "",
            connectedAt: data.connectedAt || null,
          });
        }
        if (active) setRetailers(rows);
      } catch (e) {
        console.error("Failed to fetch connectedRetailers:", e);
        if (active) setError("Failed to fetch retailers.");
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [distributorId]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Connected Retailers</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOrderSettings(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm font-medium"
          >
            Order Settings (Global & Bulk)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-500"></div>
          <span className="ml-4 text-gray-600 dark:text-gray-300">Loading...</span>
        </div>
      ) : error ? (
        <div className="text-red-500 dark:text-red-400">{error}</div>
      ) : retailers.length === 0 ? (
        <div className="text-gray-500 dark:text-gray-400 text-center py-10">
          No connected retailers found.
        </div>
      ) : (
        <div className="space-y-4">
          {retailers.map((retailer) => (
            <RetailerCard
              key={retailer.id}
              retailer={{
                uid: retailer.id,
                name: retailer.businessName,
                email: retailer.email,
                phone: retailer.phone,
                city: retailer.city,
                businessName: retailer.businessName,
                gstNumber: retailer.gstNumber,
                status: retailer.status,
              }}
              distributorId={distributorId}
              onOpenOrders={(r) => {
                // TODO: route to distributor orders filtered by retailer r.uid
                // navigate(`/distributor/orders?retailerId=${r.uid}`)
              }}
              onOpenChat={(r) => {
                // TODO: open assistant chat for this retailer
              }}
            />
          ))}
        </div>
      )}

      {/* Global/Bulk Order Settings Modal */}
      {showOrderSettings && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10" onKeyDown={handleKeyDown} tabIndex={-1}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowOrderSettings(false)} />
          <div className="relative w-[95%] max-w-6xl rounded-2xl border border-white/10 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="text-white font-semibold">Order Settings — Global & Bulk</div>
              <button
                onClick={() => setShowOrderSettings(false)}
                className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 text-sm text-white"
              >
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4 glass-scroll">
              <OrderSettings />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRetailers;