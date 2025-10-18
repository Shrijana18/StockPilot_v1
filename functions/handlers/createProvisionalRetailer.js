// functions/handlers/createProvisionalRetailer.js
// Callable function: distributor creates a provisional retailer + secure invite.
// Converted to CommonJS to match existing Firebase Functions setup.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { generateInvite } = require("../lib/tokens");

/** Resolve the client base URL for invite links */
function getClientBaseUrl() {
  // Prefer env var (set via hosting provider or emulator)
  if (process.env.APP_CLIENT_BASE_URL) return process.env.APP_CLIENT_BASE_URL;

  // If running on emulator, default to local dev URL
  if (process.env.FUNCTIONS_EMULATOR) return "http://localhost:5173";

  // Last resort: change this to your production origin
  return "https://yourapp.com";
}

/** Basic server-side sanitization (non-breaking; keep it light) */
function cleanString(v) {
  return (typeof v === "string" ? v : "").trim();
}
function normalizePhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  // Example: India default (+91). Adjust as needed or pass country code from client.
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (!digits.startsWith("+")) return `+${digits}`;
  return digits;
}

/**
 * Input shape:
 * {
 *   distributorId: string,
 *   payload: {
 *     businessName: string, ownerName?: string,
 *     email?: string, phone?: string,
 *     gst?: string, address?: string
 *   }
 * }
 */
const createProvisionalRetailer = onCall({ cors: true }, async (request) => {
  const db = getFirestore();

  // ---- Auth checks ----
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const { distributorId, payload } = request.data || {};
  if (!distributorId || typeof distributorId !== "string") {
    throw new HttpsError("invalid-argument", "distributorId is required.");
  }
  if (callerUid !== distributorId) {
    throw new HttpsError("permission-denied", "You can only create retailers for your own business.");
  }

  // ---- Validate payload ----
  const businessName = cleanString(payload?.businessName);
  const ownerName = cleanString(payload?.ownerName);
  const email = cleanString(payload?.email);
  const phone = normalizePhone(payload?.phone);
  const gst = cleanString(payload?.gst).toUpperCase();
  const address = cleanString(payload?.address);

  if (!businessName) {
    throw new HttpsError("invalid-argument", "businessName is required.");
  }
  if (!email && !phone) {
    throw new HttpsError("invalid-argument", "Provide at least one of email or phone.");
  }

  // ---- Invite bundle ----
  const { token, tokenHash, expiresAt } = generateInvite(14);

  // ---- Write documents (batch) ----
  const provisionalRef = db.collection("provisionalRetailers").doc();
  const connectedRef = db
    .collection("businesses")
    .doc(distributorId)
    .collection("connectedRetailers")
    .doc();

  const now = FieldValue.serverTimestamp();

  const provisionalData = {
    createdBy: distributorId,
    businessName,
    ownerName: ownerName || null,
    retailerEmail: email || null,
    retailerPhone: phone || null,
    gst: gst || null,
    address: address || null,
    status: "provisional",
    invite: {
      tokenHash,
      expiresAt,
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  const connectedData = {
    provisionalId: provisionalRef.id,
    retailerName: businessName,
    retailerEmail: email || null,
    retailerPhone: phone || null,
    status: "accepted",
    source: "provisioned",
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(provisionalRef, provisionalData);
  batch.set(connectedRef, connectedData);

  await batch.commit();

  // ---- Invite link ----
  const base = getClientBaseUrl();
  const inviteUrl = `${base.replace(/\/+$/, "")}/claim?pid=${provisionalRef.id}&t=${encodeURIComponent(token)}`;

  return {
    provisionalId: provisionalRef.id,
    connectedRetailerId: connectedRef.id,
    inviteUrl,
    expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : null,
  };
});

module.exports = { createProvisionalRetailer };
