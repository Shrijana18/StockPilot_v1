const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps || admin.apps.length === 0) {
  try { admin.initializeApp(); } catch (_) {}
}

// Securely logs an employee activity under a distributor.
// Input: { distributorId, employeeId, type, targetId, meta }
// Writes to: businesses/{distributorId}/employeeActivity/{autoId}
module.exports = onCall({ region: "us-central1" }, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const { distributorId, employeeId, type, targetId, meta } = request.data || {};
  if (!distributorId || !employeeId || !type) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  // Only distributor owner (primary app) or distributor employee (emp auth) can log
  // Allow both: owner uid equals distributorId OR custom claim isDistributorEmployee is true
  const isOwner = auth.uid === distributorId;
  let isDistEmp = false;
  try {
    const token = await admin.auth().verifyIdToken(request.rawRequest.headers.authorization?.split('Bearer ')[1] || '', true);
    isDistEmp = !!token.isDistributorEmployee;
  } catch (_) {}

  if (!isOwner && !isDistEmp) {
    throw new HttpsError("permission-denied", "Not allowed");
  }

  const db = admin.firestore();
  const col = db.collection("businesses").doc(distributorId).collection("employeeActivity");
  const now = admin.firestore.FieldValue.serverTimestamp();
  await col.add({
    employeeId,
    type,          // e.g., 'addRetailer', 'createOrder', 'updateOrder'
    targetId: targetId || null, // retailerId / orderId
    meta: meta || {},
    createdAt: now,
  });

  return { success: true };
});


