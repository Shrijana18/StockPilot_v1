

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

/**
 * Trigger: Sync retailer profile to all connected distributors
 * Fires on create/update of /businesses/{retailerId}
 * Writes to: /businesses/{distributorId}/connectedRetailers/{retailerId}
 */
module.exports = onDocumentWritten({
  document: "businesses/{retailerId}",
  region: "asia-south1",
  memory: "256MiB",
  timeoutSeconds: 120,
}, async (event) => {
  const before = event.data?.before?.data() || null;
  const after = event.data?.after?.data() || null;

  // If deleted, do nothing (you can optionally handle cleanup here)
  if (!after) return;

  // If nothing meaningful changed, skip to save writes
  const changed =
    !before ||
    ["businessName", "ownerName", "phone", "email", "address", "gstNumber", "logoUrl"]
      .some((k) => (before?.[k] || "") !== (after?.[k] || ""));
  if (!changed) return;

  const retailerId = event.params.retailerId;
  const db = admin.firestore();

  // Retailer profile fields to propagate
  const profile = {
    businessName: after.businessName || "",
    ownerName: after.ownerName || "",
    phone: after.phone || "",
    email: after.email || "",
    address: after.address || "",
    gstNumber: after.gstNumber || "",
    logoUrl: after.logoUrl || "",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Find connected distributors under retailer
  const connSnap = await db
    .collection("businesses")
    .doc(retailerId)
    .collection("connectedDistributors")
    .get();

  if (connSnap.empty) return;

  // Write to each distributor's connectedRetailers subcollection
  const chunks = [];
  const docs = connSnap.docs
    .map((d) => d.data())
    .filter((d) => d && d.distributorId)
    // Prefer syncing only accepted links if status exists
    .filter((d) => (d.status ? String(d.status).toLowerCase() === "accepted" : true));

  for (let i = 0; i < docs.length; i += 400) {
    chunks.push(docs.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    for (const rec of chunk) {
      const distributorId = rec.distributorId;
      const targetRef = db
        .collection("businesses")
        .doc(distributorId)
        .collection("connectedRetailers")
        .doc(retailerId);

      batch.set(
        targetRef,
        {
          retailerId,
          ...profile,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
});