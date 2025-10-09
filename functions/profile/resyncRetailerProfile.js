

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Callable: resyncRetailerProfile
 * Manually propagates the latest retailer profile data to all connected distributors.
 */
module.exports = onCall(async (request) => {
  try {
    const context = request.auth;
    if (!context || !context.uid) {
      throw new Error("Unauthorized. Please sign in again.");
    }

    const retailerId = context.uid;
    const db = admin.firestore();

    // Fetch retailer business profile
    const retailerRef = db.collection("businesses").doc(retailerId);
    const retailerSnap = await retailerRef.get();
    if (!retailerSnap.exists) {
      throw new Error("Retailer profile not found");
    }

    const retailerData = retailerSnap.data();
    const retailerProfile = {
      businessName: retailerData.businessName || "",
      ownerName: retailerData.ownerName || "",
      phone: retailerData.phone || "",
      email: retailerData.email || "",
      address: retailerData.address || "",
      gstNumber: retailerData.gstNumber || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Find connected distributors under this retailer
    const connectedRef = retailerRef.collection("connectedDistributors");
    const connectedSnap = await connectedRef.get();

    if (connectedSnap.empty) {
      return { success: true, message: "No connected distributors to sync." };
    }

    let updatedCount = 0;
    const batch = db.batch();

    connectedSnap.forEach((doc) => {
      const distributorId = doc.data().distributorId;
      if (!distributorId) return;

      const distConnRef = db
        .collection("businesses")
        .doc(distributorId)
        .collection("connectedRetailers")
        .doc(retailerId);

      batch.set(distConnRef, {
        retailerId,
        ...retailerProfile,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      updatedCount++;
    });

    await batch.commit();

    return {
      success: true,
      message: `Resynced profile to ${updatedCount} distributor(s).`,
      syncedCount: updatedCount,
    };
  } catch (error) {
    console.error("resyncRetailerProfile Error:", error);
    return {
      success: false,
      message: error.message || "Failed to resync retailer profile",
    };
  }
});