import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { db, auth } from "../../firebase/firebaseConfig";

/**
 * RetailerRequests
 * -------------------------------------------------------
 * Adjusted to work inside RetailerPanel:
 * - Accepts optional prop `distributorId` (passed by RetailerPanel).
 * - Falls back to `auth.currentUser?.uid` if prop not provided.
 * - Uses project-level `db` and `auth` imports (no props).
 */
const RetailerRequests = ({ distributorId: distributorIdProp }) => {
  const [requests, setRequests] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRetailerId, setSelectedRetailerId] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [loading, setLoading] = useState(true);

  const resolveDistributorId = () =>
    distributorIdProp || auth?.currentUser?.uid || null;

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      const distributorId = resolveDistributorId();
      if (!distributorId) {
        setLoading(false);
        return;
      }

      try {
        const reqRef = collection(
          db,
          `businesses/${distributorId}/connectionRequests`
        );
        const snapshot = await getDocs(reqRef);

        const enrichedRequests = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const retailerId = data.retailerId;

            let retailerData = {};
            try {
              const retailerDocRef = doc(db, "businesses", retailerId);
              const retailerDocSnap = await getDoc(retailerDocRef);
              if (retailerDocSnap.exists()) {
                retailerData = retailerDocSnap.data();
              } else {
                console.warn("Retailer business doc not found for:", retailerId);
              }
            } catch (err) {
              console.error("❌ Error fetching retailer info:", err.message);
            }

            return {
              id: docSnap.id,
              retailerId,
              status: data.status,
              sentAt: data.sentAt,
              message: data.message || "",
              ...retailerData,
            };
          })
        );

        setRequests(enrichedRequests);
      } catch (e) {
        console.error("Failed to fetch requests", e);
        toast.error("Failed to load requests");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributorIdProp]);

  const handleUpdateStatus = async (retailerId, status) => {
    const distributorId = resolveDistributorId();
    if (!distributorId) return;

    const distributorDocRef = doc(db, "businesses", distributorId);
    const distributorDocSnap = await getDoc(distributorDocRef);
    const distributorData = distributorDocSnap.exists()
      ? distributorDocSnap.data()
      : {};

    const requestRef = doc(
      db,
      `businesses/${distributorId}/connectionRequests/${retailerId}`
    );
    await updateDoc(requestRef, { status, acceptedAt: serverTimestamp() });
    console.log(
      "✅ Updated distributor's connectionRequests status to:",
      status
    );

    const sentRef = doc(
      db,
      `businesses/${retailerId}/sentRequests/${distributorId}`
    );
    try {
      await updateDoc(sentRef, { status, acceptedAt: serverTimestamp() });
      console.log("✅ Updated retailer's sentRequests status to:", status);
    } catch (err) {
      console.error(
        "❌ Failed to update retailer's sentRequest:",
        err.message
      );
    }

    if (status === "accepted") {
      try {
        // Get latest retailer data
        const retailerDocRef = doc(db, "businesses", retailerId);
        const retailerDocSnap = await getDoc(retailerDocRef);
        const retailerData = retailerDocSnap.exists()
          ? retailerDocSnap.data()
          : {};

        // Add distributor to retailer's connectedDistributors
        console.log(
          "🔄 Saving distributor to retailer's connectedDistributors..."
        );
        await setDoc(
          doc(
            db,
            `businesses/${retailerId}/connectedDistributors/${distributorId}`
          ),
          {
            distributorId,
            distributorName:
              distributorData.businessName || "Unnamed Distributor",
            distributorOwner: distributorData.ownerName || "Unknown Owner",
            distributorEmail: distributorData.email || "",
            distributorPhone: distributorData.phone || "",
            city: distributorData.city || "",
            connectedAt: serverTimestamp(),
            status: "accepted",
          },
          { merge: true }
        );
        console.log("✅ Saved to retailer's connectedDistributors");

        // Add retailer to distributor's connectedRetailers
        console.log(
          "🔄 Saving retailer to distributor's connectedRetailers..."
        );
        await setDoc(
          doc(
            db,
            `businesses/${distributorId}/connectedRetailers/${retailerId}`
          ),
          {
            retailerId,
            retailerName: retailerData.businessName || "Unnamed Retailer",
            retailerEmail: retailerData.email || "",
            retailerPhone: retailerData.phone || "",
            city: retailerData.city || "",
            connectedAt: serverTimestamp(),
            status: "accepted",
          },
          { merge: true }
        );
        console.log("✅ Saved to distributor's connectedRetailers");

        // --- Compatibility mirrors for legacy readers ---
        try {
          // Compatibility write under distributors/<dist>/connectedRetailers
          await setDoc(
            doc(
              db,
              `distributors/${distributorId}/connectedRetailers/${retailerId}`
            ),
            {
              retailerId,
              retailerUid: retailerId,
              retailerName: retailerData.businessName || "Unnamed Retailer",
              retailerEmail: retailerData.email || "",
              retailerPhone: retailerData.phone || "",
              city: retailerData.city || "",
              connectedAt: serverTimestamp(),
              status: "accepted",
              relationshipStatus: "active",
            },
            { merge: true }
          );
          console.log(
            "✅ Saved to distributors/<dist>/connectedRetailers (compat)"
          );
        } catch (e) {
          console.warn(
            "⚠️ Failed to write compat connectedRetailers under distributors/",
            e?.message
          );
        }

        try {
          // Compatibility mirror under retailer doc (legacy)
          await setDoc(
            doc(
              db,
              `businesses/${retailerId}/connectedDistributorsLegacy/${distributorId}`
            ),
            {
              distributorId,
              distributorUid: distributorId,
              distributorName:
                distributorData.businessName || "Unnamed Distributor",
              distributorOwner: distributorData.ownerName || "Unknown Owner",
              distributorEmail: distributorData.email || "",
              distributorPhone: distributorData.phone || "",
              city: distributorData.city || "",
              connectedAt: serverTimestamp(),
              status: "accepted",
              relationshipStatus: "active",
            },
            { merge: true }
          );
          console.log(
            "✅ Saved compat mirror to retailer's connectedDistributorsLegacy"
          );
        } catch (e) {
          console.warn(
            "⚠️ Failed to write compat mirror under connectedDistributorsLegacy/",
            e?.message
          );
        }

        toast.success("Retailer request accepted successfully!");
      } catch (err) {
        console.error("❌ Failed to create connected entries:", err.message);
      }
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === retailerId ? { ...r, status } : r))
    );
  };

  const openRejectModal = (retailerId) => {
    setSelectedRetailerId(retailerId);
    setRejectionNote("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedRetailerId) return;

    const distributorId = resolveDistributorId();
    if (!distributorId) return;

    const requestRef = doc(
      db,
      `businesses/${distributorId}/connectionRequests/${selectedRetailerId}`
    );
    const sentRef = doc(
      db,
      `businesses/${selectedRetailerId}/sentRequests/${distributorId}`
    );

    await updateDoc(requestRef, {
      status: "rejected",
      rejectionNote,
      rejectedAt: serverTimestamp(),
    });

    await updateDoc(sentRef, {
      status: "rejected",
      rejectionNote,
      rejectedAt: serverTimestamp(),
    });

    setRequests((prev) =>
      prev.map((r) =>
        r.retailerId === selectedRetailerId ? { ...r, status: "rejected" } : r
      )
    );

    setShowRejectModal(false);
    toast.info("Retailer request rejected.");
  };

  return (
    <div className="text-white">
      <h2 className="text-2xl font-semibold mb-4 sticky top-[72px] z-10 py-2 px-3 rounded-xl border border-white/10 backdrop-blur-xl bg-[#0B0F14]/60 supports-[backdrop-filter]:bg-[#0B0F14]/50 shadow-sm animate-fade-in">
        Incoming Retailer Requests
      </h2>
      {loading ? (
        <div className="text-center py-8 text-white/60">Loading requests...</div>
      ) : requests.length === 0 ? (
        <p className="text-white/70 text-center mt-8 italic">
          You're all caught up! No new requests.
        </p>
      ) : (
        <ul className="space-y-4 animate-fade-in">
          {requests.map((req) => (
            <li
              key={req.id}
              className="bg-white/5 backdrop-blur-xl border border-white/10 text-white p-4 rounded-xl transition-transform duration-200 hover:scale-[1.005] shadow-xl"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{req.businessName}</p>
                  <p className="text-sm text-white/70">
                    {req.ownerName} ({req.email})
                  </p>
                  <p className="text-sm">
                    Status:{" "}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        req.status === "accepted"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : req.status === "rejected"
                          ? "bg-rose-500/20 text-rose-200"
                          : "bg-amber-500/20 text-amber-200"
                      }`}
                    >
                      {req.status}
                    </span>
                  </p>
                  {req.sentAt?.seconds && (
                    <p className="text-xs text-white/50 mt-1">
                      Sent at:{" "}
                      {new Date(req.sentAt.seconds * 1000).toLocaleString()}
                    </p>
                  )}
                  {req.message && (
                    <p className="text-sm italic text-white/60 mt-1">
                      Message: "{req.message}"
                    </p>
                  )}
                  {req.address && (
                    <p className="text-sm text-white/60">
                      📍 Address: {req.address}
                    </p>
                  )}
                  {req.city && (
                    <p className="text-sm text-white/60">🏙️ City: {req.city}</p>
                  )}
                  {req.phone && (
                    <p className="text-sm text-white/60">
                      📞 Phone: {req.phone}
                    </p>
                  )}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleUpdateStatus(req.retailerId, "accepted")}
                    disabled={req.status === "accepted"}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1.5 rounded-full disabled:opacity-50 transition duration-200 transform hover:scale-[1.02]"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => openRejectModal(req.retailerId)}
                    className="bg-gradient-to-r from-rose-500 to-amber-500 text-white px-3 py-1.5 rounded-full transition duration-200 transform hover:scale-[1.02]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {showRejectModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="transition-all duration-300 ease-in-out transform scale-100 bg-[#0B0F14]/90 backdrop-blur-2xl border border-white/10 text-white p-6 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-96">
            <h3 className="text-lg font-semibold mb-2">Reject Retailer</h3>
            <p className="mb-4 text-sm text-white/70">
              Are you sure you want to reject this request?
            </p>
            <textarea
              className="w-full rounded-xl p-2.5 mb-4 bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              placeholder="Optional reason for rejection..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 rounded-full text-white bg-gradient-to-r from-rose-500 to-amber-500"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetailerRequests;
