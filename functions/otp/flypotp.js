const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Attach Firebase secrets securely
const MSG91_API_KEY = defineSecret("MSG91_API_KEY");

// Firestore ref
const db = admin.firestore();

// Helper: normalize +91 numbers
const normalizeIN = (raw) => {
  const ten = String(raw || "").replace(/[^0-9]/g, "").slice(-10);
  if (ten.length !== 10) throw new HttpsError("invalid-argument", "Phone must be 10 digits");
  return `+91${ten}`;
};

// ========== SEND OTP ==========
exports.sendOtp = onCall(
  { region: "us-central1", secrets: [MSG91_API_KEY] },
  async (request) => {
    try {
      const rawPhone = request.data?.phone;
      if (!rawPhone) throw new HttpsError("invalid-argument", "Missing phone");

      const e164 = normalizeIN(rawPhone);
      // Remove + sign, keep country code (e.g., 919876543210)
      const mobile = e164.replace("+", ""); 

      const payload = {
        authkey: MSG91_API_KEY.value(),
        mobile: mobile,
        otp_length: 6,
        template_id: "6966924c16a75d490559f884" // Your correct Template ID
      };

      const resp = await fetch("https://control.msg91.com/api/v5/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await resp.json().catch(() => ({}));
      
      // 🔍 DEBUG LOG: Check this in Google Cloud Logs if it fails!
      console.log("[MSG91 Response]:", JSON.stringify(body));

      if (!resp.ok || body.type === "error") {
        throw new HttpsError("internal", body.message || "Failed to send OTP");
      }
      
      return { success: true, message: "OTP sent successfully" };
    } catch (err) {
      console.error("[sendOtp] Error:", err);
      throw new HttpsError("internal", err.message);
    }
  }
);

// ========== VERIFY OTP ==========
exports.verifyOtp = onCall(
  { region: "us-central1", secrets: [MSG91_API_KEY] },
  async (request) => {
    try {
      const rawPhone = request.data?.phone;
      const otp = request.data?.otp;
      
      if (!rawPhone || !otp) throw new HttpsError("invalid-argument", "Missing data");

      const e164 = normalizeIN(rawPhone);
      const mobile = e164.replace("+", ""); 

      // Verification uses GET request
      const authKey = MSG91_API_KEY.value();
      const url = `https://control.msg91.com/api/v5/otp/verify?authkey=${authKey}&mobile=${mobile}&otp=${otp}`;

      const resp = await fetch(url, {
        method: "GET"
      });

      const body = await resp.json().catch(() => ({}));

      if (!resp.ok || body.type === "error") {
         throw new HttpsError("permission-denied", body.message || "Invalid OTP");
      }

      // Mark verified in Firestore
      const idxRef = db.doc(`phoneIndex/${e164}`);
      await idxRef.set(
        { verifiedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      return { ok: true, verified: true };
    } catch (err) {
      console.error("[verifyOtp] Error:", err);
      throw new HttpsError("permission-denied", "OTP verification failed");
    }
  }
);