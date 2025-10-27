const { onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors")({ origin: true });

// Attach Firebase secrets securely
const MSG91_API_KEY = defineSecret("MSG91_API_KEY");

// Firestore ref (single app initialized in index.js)
const db = admin.firestore();

// Helper: normalize +91 numbers
const normalizeIN = (raw) => {
  const ten = String(raw || "").replace(/[^0-9]/g, "").slice(-10);
  if (ten.length !== 10) throw new HttpsError("invalid-argument", "Phone must be 10 digits");
  return `+91${ten}`;
};

// ========== SEND OTP (Widget flow handles sending on the client) ==========
exports.sendOtp = onRequest(
  { region: "us-central1", secrets: [MSG91_API_KEY] },
  (req, res) => {
    cors(req, res, async () => {
      // Deprecated in widget flow. Keep a stub so old clients fail gracefully.
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") return res.status(204).end();
      return res
        .status(410)
        .json({ error: "Use MSG91 OTP Widget on client; server only verifies access_token." });
    });
  }
);

// ========== VERIFY OTP via MSG91 Widget access_token (HTTP + CORS) ==========
exports.verifyOtp = onRequest(
  { region: "us-central1", secrets: [MSG91_API_KEY] },
  (req, res) => {
    cors(req, res, async () => {
      try {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") return res.status(204).end();
        if (req.method !== "POST") return res.status(405).end();

        const rawPhone = req.body?.phone || req.query?.phone;
        const accessToken = req.body?.access_token || req.body?.accessToken;
        if (!rawPhone) throw new HttpsError("invalid-argument", "Missing phone");
        if (!accessToken) throw new HttpsError("invalid-argument", "Missing access_token");

        const e164 = normalizeIN(rawPhone);

        // Verify access token with MSG91 Widget API
        const resp = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authkey: MSG91_API_KEY.value(),
            "access-token": String(accessToken)
          })
        });
        const body = await resp.json().catch(() => ({}));
        const ok = resp.ok && (body.message === "Success" || /success/i.test(body.message || ""));
        if (!ok) {
          throw new HttpsError("permission-denied", body.message || "OTP invalid or expired");
        }

        // Mark as verified for this phone
        const idxRef = db.doc(`phoneIndex/${e164}`);
        await idxRef.set(
          { verifiedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );

        return res.status(200).json({ ok: true });
      } catch (err) {
        const code = err?.code === undefined ? "internal" : err.code;
        const msg = err?.message || "internal";
        console.error("[verifyOtp]", code, msg);
        return res.status(code === "permission-denied" ? 403 : 500).json({ error: msg });
      }
    });
  }
);