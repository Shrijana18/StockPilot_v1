

// functions/otp/reservePhone.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Set global options for this functions module
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

// E.164 India (+91) validator; switch to generic E.164 if needed
const isE164IN = (phone) => typeof phone === 'string' && /^\+91\d{10}$/.test(phone);

/**
 * Callable function to reserve a phone number for a user.
 * - Ensures uniqueness via /phoneIndex/{e164} doc (server-only per security rules).
 * - Idempotent for the same uid (repeated calls are OK).
 * - Throws 'already-exists' if another uid owns the number.
 */
exports.reservePhone = onCall(
  {
    cors: true,          // allow web callable from your domains
    enforceAppCheck: false, // set true later if App Check is enabled on web
    concurrency: 5,
    rateLimits: {
      maxCallsPerMinute: 60,
    },
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const raw = String(request.data?.phone || '').trim();
    if (!isE164IN(raw)) {
      throw new HttpsError('invalid-argument', 'Phone must be E.164 format for India, e.g., +919876543210.');
    }

    const phoneRef = db.doc(`phoneIndex/${raw}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(phoneRef);
      if (snap.exists) {
        const owner = snap.get('uid');
        if (owner && owner !== uid) {
          throw new HttpsError('already-exists', 'Phone number already reserved by another user.');
        }
        // If owner matches, treat as idempotent success
        return;
      }
      tx.set(phoneRef, {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { ok: true, phone: raw };
  }
);