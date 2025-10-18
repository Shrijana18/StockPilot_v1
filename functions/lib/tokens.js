// functions/lib/tokens.js
// Small helpers for creating/verifying invite tokens.
// Converted to CommonJS for Firebase Functions compatibility.

const crypto = require("crypto");

/**
 * Generate a cryptographically-strong random token.
 * @param {number} bytes - number of random bytes (default 32 => 43 char base64url)
 * @returns {string} URL-safe base64 token
 */
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url"); // Node 16+
}

/**
 * SHA-256 hash (hex) of an input string.
 * Do NOT store raw tokens in the database; store only their hashes.
 * @param {string} input
 * @returns {string} hex-encoded sha256 hash
 */
function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Convenience helper to check whether a presented token matches a stored hash.
 * @param {string} tokenHash - hex sha256 stored in Firestore
 * @param {string} token - raw token presented by client
 * @returns {boolean}
 */
function verifyToken(tokenHash, token) {
  try {
    const presented = Buffer.from(sha256(token), "utf8");
    const stored = Buffer.from(tokenHash, "utf8");
    // constant-time comparison when lengths match
    return stored.length === presented.length && crypto.timingSafeEqual(stored, presented);
  } catch {
    // Fall back (length mismatch etc.)
    return false;
  }
}

/**
 * Create an invite bundle: raw token (return to client), its hash (store),
 * and an expiry timestamp (Date object).
 * @param {number} daysValid - days until expiry (default 14)
 * @returns {{ token: string, tokenHash: string, expiresAt: Date }}
 */
function generateInvite(daysValid = 14) {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
  return { token, tokenHash, expiresAt };
}

module.exports = {
  randomToken,
  sha256,
  verifyToken,
  generateInvite,
};