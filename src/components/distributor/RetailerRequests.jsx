import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const RetailerRequests = ({ db, auth }) => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const fetchRequests = async () => {
      const user = auth.currentUser;
      if (!user) return;

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
            ...retailerData,
          };
        })
      );

      setRequests(enrichedRequests);
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
    await updateDoc(requestRef, { status });
    console.log("✅ Updated distributor's connectionRequests status to:", status);

    const sentRef = doc(db, `businesses/${retailerId}/sentRequests/${distributorId}`);
    try {
      await updateDoc(sentRef, { status });
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
      } catch (err) {
        console.error("❌ Failed to create connected entries:", err.message);
      }
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === retailerId ? { ...r, status } : r))
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Incoming Retailer Requests</h2>
      {requests.length === 0 ? (
        <p className="text-gray-600">No requests found.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((req) => (
            <li key={req.id} className="bg-white shadow p-4 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{req.businessName}</p>
                  <p className="text-sm text-gray-600">{req.ownerName} ({req.email})</p>
                  <p className="text-sm text-gray-500">Status: <span className="font-medium">{req.status}</span></p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleUpdateStatus(req.retailerId, "accepted")}
                    disabled={req.status === "accepted"}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(req.retailerId, "rejected")}
                    disabled={req.status === "rejected"}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RetailerRequests;
