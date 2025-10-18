// functions/handlers/claimProvisionalRetailer.js
// Callable: retailer claims a provisional retailer invite (pid + token).
// Converted to CommonJS for Firebase Functions compatibility.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { verifyToken, sha256 } = require("../lib/tokens");

/**
 * Input:
 * { pid: string, token: string }
 *
 * Behavior:
 *  - Auth required (retailer must be signed in).
 *  - Verify provisional exists, not expired, not already claimed.
 *  - Verify token by comparing its sha256 to stored tokenHash (constant-time).
 *  - Link retailer user to provisional; mark provisional as claimed.
 *  - Update the distributor's connectedRetailers doc (match by provisionalId) with retailerUid.
 *  - Return status and basic linkage info (distributorId, connectedRetailerId).
 */
const claimProvisionalRetailer = onCall({ cors: true }, async (request) => {
  const db = getFirestore();

  const retailerUid = request.auth?.uid;
  if (!retailerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in to claim.");
  }

  const { pid, token } = request.data || {};
  if (!pid || typeof pid !== "string" || !token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "pid and token are required.");
  }

  const provisionalRef = db.collection("provisionalRetailers").doc(pid);
  const provisionalSnap = await provisionalRef.get();
  if (!provisionalSnap.exists) {
    throw new HttpsError("not-found", "Invite not found or already removed.");
  }
  const provisional = provisionalSnap.data();

  // Ensure not already claimed
  if (provisional.status === "claimed") {
    return {
      status: "already_claimed",
      claimedByUid: provisional.claimedByUid || null,
      distributorId: provisional.createdBy || null,
    };
  }

  // Verify expiry
  const expiresAt = provisional?.invite?.expiresAt?.toDate
    ? provisional.invite.expiresAt.toDate()
    : provisional?.invite?.expiresAt instanceof Date
    ? provisional.invite.expiresAt
    : null;

  if (!expiresAt) {
    throw new HttpsError("failed-precondition", "Invite expiry missing.");
  }
  if (expiresAt.getTime() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Invite link expired.");
  }

  // Verify token (constant-time compare)
  const storedHash = provisional?.invite?.tokenHash;
  if (!storedHash) {
    throw new HttpsError("failed-precondition", "Invite token missing.");
  }
  const ok = verifyToken(storedHash, token);
  const fallbackOk = sha256(token) === storedHash;
  if (!(ok || fallbackOk)) {
    throw new HttpsError("permission-denied", "Invalid invite token.");
  }

  const distributorId = provisional.createdBy;
  if (!distributorId) {
    throw new HttpsError("failed-precondition", "Invite has no distributor owner.");
  }

  // Find connectedRetailers entry for this provisional under distributor
  const connCol = db
    .collection("businesses")
    .doc(distributorId)
    .collection("connectedRetailers");

  const connSnap = await connCol.where("provisionalId", "==", pid).limit(1).get();
  const connRef = connSnap.empty ? connCol.doc() : connSnap.docs[0].ref;

  const now = FieldValue.serverTimestamp();

  // Apply updates in a batch for atomicity
  const batch = db.batch();

  batch.update(provisionalRef, {
    status: "claimed",
    claimedByUid: retailerUid,
    claimedAt: now,
    updatedAt: now,
    "invite.tokenHash": FieldValue.delete(),
  });

  batch.set(
    connRef,
    {
      retailerUid,
      updatedAt: now,
    },
    { merge: true }
  );

  await batch.commit();

  return {
    status: "claimed",
    distributorId,
    connectedRetailerId: connRef.id,
    retailerUid,
  };
});

module.exports = { claimProvisionalRetailer };