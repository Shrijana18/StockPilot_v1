const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

if (!admin.apps || admin.apps.length === 0) {
  try { admin.initializeApp(); } catch (_) {}
}

exports.resetPin = onCall({ region: "us-central1" }, async (request) => {
  try {
    const { employeeId: employeeKey } = request.data || {};
    const auth = request.auth;

    if (!auth?.uid) {
      throw new HttpsError("unauthenticated", "Unauthorized. Please sign in again.");
    }
    if (!employeeKey) {
      throw new HttpsError("invalid-argument", "Missing employeeId");
    }

    const retailerId = auth.uid;
    const db = admin.firestore();
    const empCol = db.collection("businesses").doc(retailerId).collection("employees");

    // Try using employeeKey as document ID
    let empRef = empCol.doc(employeeKey);
    let empSnap = await empRef.get();

    // Fallback: search by flypEmployeeId field
    if (!empSnap.exists) {
      const qSnap = await empCol.where("flypEmployeeId", "==", employeeKey).limit(1).get();
      if (qSnap.empty) {
        throw new HttpsError("not-found", "Employee not found with this ID");
      }
      empRef = qSnap.docs[0].ref;
      empSnap = qSnap.docs[0];
    }

    // Generate new random PIN (6-digit)
    const newPin = String(Math.floor(100000 + Math.random() * 900000));
    const salt = crypto.randomBytes(12).toString("hex");
    const hash = crypto.createHash("sha256").update(`${newPin}:${salt}`).digest("hex");

    await empRef.update({
      pinSalt: salt,
      pinHash: hash,
      pinResetAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      newPin,
      message: "Employee PIN reset successfully. Share this new PIN securely with the employee.",
    };
  } catch (error) {
    console.error("resetEmployeePin Error:", error);
    throw new HttpsError("internal", error.message || "Failed to reset employee PIN");
  }
});