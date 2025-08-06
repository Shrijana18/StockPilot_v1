import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-toastify";

const RetailerRequests = ({ db, auth }) => {
  const [requests, setRequests] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRetailerId, setSelectedRetailerId] = useState(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const reqRef = collection(db, `businesses/${user.uid}/connectionRequests`);
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
      setLoading(false);
    };

    fetchRequests();
  }, []);

  const handleUpdateStatus = async (retailerId, status) => {
    const user = auth.currentUser;
    if (!user) return;

    const distributorId = user.uid;
    const distributorDocRef = doc(db, "businesses", distributorId);
    const distributorDocSnap = await getDoc(distributorDocRef);
    const distributorData = distributorDocSnap.exists() ? distributorDocSnap.data() : {};

    const requestRef = doc(db, `businesses/${distributorId}/connectionRequests/${retailerId}`);
    await updateDoc(requestRef, { status, acceptedAt: serverTimestamp() });
    console.log("✅ Updated distributor's connectionRequests status to:", status);

    const sentRef = doc(db, `businesses/${retailerId}/sentRequests/${distributorId}`);
    try {
      await updateDoc(sentRef, { status, acceptedAt: serverTimestamp() });
      console.log("✅ Updated retailer's sentRequests status to:", status);
    } catch (err) {
      console.error("❌ Failed to update retailer's sentRequest:", err.message);
    }

    if (status === "accepted") {
      try {
        // Get latest retailer data
        const retailerDocRef = doc(db, "businesses", retailerId);
        const retailerDocSnap = await getDoc(retailerDocRef);
        const retailerData = retailerDocSnap.exists() ? retailerDocSnap.data() : {};

        // Add distributor to retailer's connectedDistributors
        console.log("🔄 Saving distributor to retailer's connectedDistributors...");
        await setDoc(doc(db, `businesses/${retailerId}/connectedDistributors/${distributorId}`), {
          distributorId,
          distributorName: distributorData.businessName || "Unnamed Distributor",
          distributorOwner: distributorData.ownerName || "Unknown Owner",
          distributorEmail: distributorData.email || "",
          distributorPhone: distributorData.phone || "",
          city: distributorData.city || "",
          connectedAt: serverTimestamp(),
          status: "accepted"
        }, { merge: true });
        console.log("✅ Saved to retailer's connectedDistributors");

        // Add retailer to distributor's connectedRetailers
        console.log("🔄 Saving retailer to distributor's connectedRetailers...");
        await setDoc(doc(db, `businesses/${distributorId}/connectedRetailers/${retailerId}`), {
          retailerId,
          retailerName: retailerData.businessName || "Unnamed Retailer",
          retailerEmail: retailerData.email || "",
          retailerPhone: retailerData.phone || "",
          city: retailerData.city || "",
          connectedAt: serverTimestamp(),
          status: "accepted"
        }, { merge: true });
        console.log("✅ Saved to distributor's connectedRetailers");

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

    const user = auth.currentUser;
    if (!user) return;

    const distributorId = user.uid;
    const requestRef = doc(db, `businesses/${distributorId}/connectionRequests/${selectedRetailerId}`);
    const sentRef = doc(db, `businesses/${selectedRetailerId}/sentRequests/${distributorId}`);

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
    <div>
      <h2 className="text-2xl font-semibold mb-4 sticky top-0 bg-white z-10 py-2 shadow-sm animate-fade-in">
        Incoming Retailer Requests
      </h2>
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading requests...</div>
      ) : requests.length === 0 ? (
        <p className="text-gray-600 text-center mt-8 italic">You're all caught up! No new requests.</p>
      ) : (
        <ul className="space-y-4 animate-fade-in">
          {requests.map((req) => (
            <li key={req.id} className="bg-white shadow p-4 rounded transition-transform duration-200 hover:scale-[1.01] hover:shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{req.businessName}</p>
                  <p className="text-sm text-gray-600">{req.ownerName} ({req.email})</p>
                  <p className="text-sm">
                    Status:{" "}
                    <span
                      className={`px-2 py-0.5 rounded-full text-white text-xs ${
                        req.status === "accepted"
                          ? "bg-green-500"
                          : req.status === "rejected"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {req.status}
                    </span>
                  </p>
                  {req.sentAt?.seconds && (
                    <p className="text-xs text-gray-400 mt-1">
                      Sent at: {new Date(req.sentAt.seconds * 1000).toLocaleString()}
                    </p>
                  )}
                  {req.message && (
                    <p className="text-sm italic text-gray-500 mt-1">
                      Message: "{req.message}"
                    </p>
                  )}
                  {req.address && (
                    <p className="text-sm text-gray-500">📍 Address: {req.address}</p>
                  )}
                  {req.city && (
                    <p className="text-sm text-gray-500">🏙️ City: {req.city}</p>
                  )}
                  {req.phone && (
                    <p className="text-sm text-gray-500">📞 Phone: {req.phone}</p>
                  )}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleUpdateStatus(req.retailerId, "accepted")}
                    disabled={req.status === "accepted"}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50 transition duration-200 transform hover:scale-105"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => openRejectModal(req.retailerId)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition duration-200 transform hover:scale-105"
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
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="transition-all duration-300 ease-in-out transform scale-100 bg-white p-6 rounded-lg shadow-md w-96">
            <h3 className="text-lg font-semibold mb-2">Reject Retailer</h3>
            <p className="mb-4 text-sm text-gray-700">Are you sure you want to reject this request?</p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 mb-4"
              placeholder="Optional reason for rejection..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="px-4 py-2 bg-red-500 text-white rounded"
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
