import React, { useState } from "react";
import { getFirestore, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ORDER_STATUSES } from "../../constants/orderStatus";
import { toast } from "react-toastify";

/**
 * AcceptProformaButton (Retailer-side)
 *
 * Props:
 * - distributorId: string (required)
 * - retailerId: string (required)
 * - orderId: string (required)
 * - disabled?: boolean
 * - hasProforma?: boolean (pass !!order.proforma)
 * - distributorPath?: string  // optional explicit doc path for distributor mirror
 * - onAccepted?: (orderId: string, patch: object) => void
 */
export default function AcceptProformaButton({
  distributorId,
  retailerId,
  orderId,
  disabled,
  hasProforma = true,
  distributorPath,
  onAccepted,
}) {
  const db = getFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function updateDistributorMirror(patch) {
    // If explicit path provided, try that first
    const tryPaths = distributorPath
      ? [distributorPath]
      : [
          // Your current schema
          `businesses/${distributorId}/orderRequests/${orderId}`,
          // Alternate schema used in some screens
          `distributors/${distributorId}/receivedOrders/${orderId}`,
        ];

    for (const p of tryPaths) {
      try {
        await setDoc(doc(db, p), patch, { merge: true });
        return true; // success
      } catch (e) {
        // Ignore permission/not-found on mirrors; primary write already succeeded
        if (process.env.NODE_ENV !== "production") {
          console.warn("Mirror update failed for", p, e);
        }
      }
    }
    return false;
  }

  async function handleAccept() {
    if (disabled || isLoading) return;

    if (!hasProforma) {
      toast.error("No proforma found to accept. Please refresh and try again.");
      return;
    }

    setIsLoading(true);
    try {
      const patch = {
        statusCode: ORDER_STATUSES.ACCEPTED,
        status: "Accepted", // legacy label compatibility for existing filters
        statusTimestamps: { acceptedAt: serverTimestamp() },
        proformaLocked: true,
        updatedAt: serverTimestamp(),
        // Hints for downstream UIs / functions
        acceptedBy: retailerId,
        acceptedSource: "RETAILER",
        promotionReady: true,
      };

      // Primary write: Retailer-owned doc (must succeed)
      await updateDoc(doc(db, `businesses/${retailerId}/sentOrders/${orderId}`), patch);

      // Fire-and-forget mirror. Failure here should not affect UX.
      updateDistributorMirror(patch);

      // Optimistic UI update in parent
      onAccepted?.(orderId, { status: "Accepted", statusCode: ORDER_STATUSES.ACCEPTED, proformaLocked: true, acceptedAt: new Date() });

      toast.success("Proforma accepted. The distributor can now proceed to pack/ship.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error accepting proforma:", error);
      toast.error(
        error?.code === "permission-denied"
          ? "You don't have permission to accept this order from this screen."
          : "Failed to accept proforma. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => !disabled && hasProforma && setIsModalOpen(true)}
        disabled={disabled || isLoading || !hasProforma}
        className={`rounded-lg px-4 py-2 font-semibold text-white ${
          disabled || isLoading || !hasProforma
            ? "bg-emerald-500/60 cursor-not-allowed"
            : "bg-emerald-500/90 hover:bg-emerald-500"
        }`}
        title={!hasProforma ? "Proforma not available" : "Accept Proforma"}
      >
        {isLoading ? "Accepting..." : "Accept Proforma"}
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isLoading && setIsModalOpen(false)}
          />

          {/* Dialog */}
          <div className="relative z-[101] w-full max-w-md rounded-2xl bg-[#1b2330] border border-white/10 shadow-xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Accept this Proforma?</h3>
            <p className="text-sm text-white/80 mb-4">
              This will lock prices and taxes for this order. The distributor can proceed to packing & shipping.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => !isLoading && setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg font-semibold text-white ${
                  isLoading ? "bg-emerald-500/60 cursor-not-allowed" : "bg-emerald-500/90 hover:bg-emerald-500"
                }`}
              >
                {isLoading ? "Accepting..." : "Confirm & Accept"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
