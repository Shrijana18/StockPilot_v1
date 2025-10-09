

const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

/**
 * Returns a reference to the Firestore instance.
 */
function db() {
  return admin.firestore();
}

/**
 * Safely commits a list of batched writes, chunked in groups of 400 to avoid Firestore limits.
 * @param {Array<{ref: FirebaseFirestore.DocumentReference, data: Object, merge?: boolean}>} writes
 */
async function commitBatchSafe(writes = []) {
  if (!Array.isArray(writes) || writes.length === 0) return;
  const chunks = [];
  for (let i = 0; i < writes.length; i += 400) {
    chunks.push(writes.slice(i, i + 400));
  }
  for (const chunk of chunks) {
    const batch = admin.firestore().batch();
    for (const w of chunk) {
      batch.set(w.ref, w.data, { merge: w.merge ?? true });
    }
    await batch.commit();
  }
}

/**
 * Cleans a document object by removing undefined/null keys recursively.
 * Useful before writing to Firestore.
 */
function cleanData(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    return obj.map(cleanData).filter((v) => v !== undefined);
  }
  if (typeof obj === "object") {
    const cleaned = {};
    for (const [key, val] of Object.entries(obj)) {
      const c = cleanData(val);
      if (c !== undefined) cleaned[key] = c;
    }
    return cleaned;
  }
  return obj;
}

/**
 * Converts a Firestore Timestamp to ISO string safely.
 */
function tsToIso(ts) {
  if (!ts) return null;
  try {
    return ts.toDate().toISOString();
  } catch {
    return null;
  }
}

/**
 * Wraps a Firestore query snapshot into a list of documents with IDs.
 */
function mapSnap(snapshot) {
  if (!snapshot || snapshot.empty) return [];
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Convenience getter for a user/business document.
 * @param {string} uid
 */
async function getBusinessDoc(uid) {
  const ref = admin.firestore().collection("businesses").doc(uid);
  const snap = await ref.get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Updates the updatedAt field of a Firestore document.
 */
async function touch(ref) {
  await ref.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

module.exports = {
  db,
  commitBatchSafe,
  cleanData,
  tsToIso,
  mapSnap,
  getBusinessDoc,
  touch,
};