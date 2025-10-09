const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const crypto = require("crypto");

/**
 * Callable: employeeLogin
 * Input: { flypId?: string, employeeId?: string, phone: string, password: string }
 *  - password is the PIN (4–6 digits)
 * Output: { success, retailerId, employeeId, role, permissions, employeePath }
 *
 * Notes:
 * - No Firebase Auth required; validates against Firestore docs.
 * - Phones are normalized to E164-like for IN numbers: 10-digit -> +91XXXXXXXXXX
 *   (but will also accept already-stored +91 or plain 10 digit).
 */
function normalizePhone(raw) {
  const s = String(raw || "");
  const digits = s.replace(/\D+/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
  return s.startsWith("+") ? s : (digits ? `+${digits}` : "");
}

exports.employeeLogin = onRequest({ region: "us-central1" }, (req, res) => {
  cors(req, res, async () => {
    // Explicitly allow CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
      }
      const { retailerId: rawRetailerId, flypId, employeeId, phone, password } = req.body || {};
      const retailerId = String(rawRetailerId || '').trim();
      const empId = String(flypId || employeeId || '').trim().toUpperCase();
      const pin = String(password || "").trim();
      const phoneInput = normalizePhone(phone);

      if (!empId || !phoneInput || !pin) {
        return res.status(400).json({ success: false, message: "Missing Employee ID, phone or PIN" });
      }
      if (!/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ success: false, message: "PIN must be 4–6 digits" });
      }

      // Accept only canonical IDs like EMP-123 / EMP-123456
      if (!/^EMP-\d{3,}$/.test(empId)) {
        return res.status(400).json({ success: false, message: 'Invalid Employee ID format' });
      }

      const db = admin.firestore();
      console.log('employeeLogin: request received', { empId, retailerId, ip: req.ip });

      // Always prefer direct lookup under /businesses/{retailerId}/employees/{empId}
      if (!retailerId) {
        return res.status(400).json({ success: false, message: "Missing retailerId in request" });
      }

      let empDoc = null;
      try {
        const empRef = db.doc(`businesses/${retailerId}/employees/${empId}`);
        const empSnap = await empRef.get();
        if (!empSnap.exists) {
          console.warn("Employee not found:", empId);
          return res.status(404).json({ success: false, message: "Employee not found" });
        }
        empDoc = empSnap;
      } catch (e) {
        console.error("Error fetching employee document:", e);
        return res.status(500).json({ success: false, message: "Failed to fetch employee document" });
      }
      const emp = empDoc.data() || {};

      // Normalize stored phone too and compare
      const storedPhone = normalizePhone(emp.phone || "");
      if (!storedPhone || storedPhone !== phoneInput) {
        return res.status(403).json({ success: false, message: "Phone mismatch" });
      }

      // Verify status
      if (String(emp.status || "").toLowerCase() !== "active") {
        return res.status(403).json({ success: false, message: "Employee is not active" });
      }

      // Verify PIN using salt + sha256(pin:salt)
      const salt = emp.pinSalt || "";
      const hash = emp.pinHash || "";
      if (!salt || !hash) {
        return res.status(403).json({ success: false, message: "Employee PIN not set" });
      }
      const computed = crypto
        .createHash("sha256")
        .update(`${pin}:${salt}`)
        .digest("hex");
      if (computed !== hash) {
        return res.status(403).json({ success: false, message: "Invalid PIN" });
      }

      // Extract retailerId from the parent path: businesses/{retailerId}/employees/{empId}
      const parentPath = empDoc.ref.parent.parent; // businesses/{retailer}
      const resolvedRetailerId = retailerId || (parentPath ? parentPath.id : "");
      const employeePath = empDoc.ref.path; // for optional client-side presence updates

      return res.json({
        success: true,
        retailerId: resolvedRetailerId,
        employeeId: emp.flypEmployeeId || empId,
        role: emp.role || "Staff",
        permissions: emp.permissions || { billing: false, inventory: false, analytics: false },
        employeePath,
      });
    } catch (error) {
      console.error("employeeLogin Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to login employee",
      });
    }
  });
});