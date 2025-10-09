

const admin = require("firebase-admin");

/**
 * Ensures the callable/request context is authenticated.
 * Throws an error if no user is logged in.
 */
function requireAuth(context) {
  if (!context || !context.auth || !context.auth.uid) {
    const err = new Error("Unauthorized. Please log in again.");
    err.code = "unauthenticated";
    throw err;
  }
  return context.auth.uid;
}

/**
 * Fetches the user’s role from Firestore businesses/{uid}.
 * Returns "Retailer" if missing or default.
 */
async function getUserRole(uid) {
  const db = admin.firestore();
  const doc = await db.collection("businesses").doc(uid).get();
  if (!doc.exists) return "Retailer";
  const role = doc.data()?.role || "Retailer";
  return role;
}

/**
 * Ensures the user has one of the allowed roles.
 * Throws an error if unauthorized.
 */
async function requireRole(context, allowed = []) {
  const uid = requireAuth(context);
  const role = await getUserRole(uid);
  if (!allowed.includes(role)) {
    const err = new Error(`Access denied. Requires one of: ${allowed.join(", ")}`);
    err.code = "permission-denied";
    throw err;
  }
  return { uid, role };
}

module.exports = {
  requireAuth,
  getUserRole,
  requireRole,
};