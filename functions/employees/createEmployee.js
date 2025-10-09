const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

/**
 * Callable: createEmployee
 * Allows retailer/distributor owners to create employees with unique IDs and secure PINs.
 * Returns: { success, flypEmployeeId, name, role, pin }
 */
module.exports = onCall(async (request) => {
  try {
    const { name, email = "", phone = "", role = "Staff", permissions = {}, pin: providedPin } = request.data || {};
    const context = request.auth;

    if (!context || !context.uid) {
      throw new Error("User not authenticated");
    }
    if (!name) {
      throw new Error("Missing required field: name");
    }

    const retailerId = context.uid;
    const db = admin.firestore();

    // Helper: Generate unique employee ID
    function makeEmpId() {
      const n = Math.floor(100000 + Math.random() * 900000); // 6 digits
      return `EMP-${n}`;
    }

    // Helper: Hash PIN with salt
    function hashPin(pin) {
      const salt = crypto.randomBytes(12).toString("hex");
      const hash = crypto.createHash("sha256").update(String(pin) + ":" + salt).digest("hex");
      return { salt, hash };
    }

    // Validate or generate PIN
    let pin = String(providedPin || Math.floor(100000 + Math.random() * 900000));
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error("PIN must be 4–6 digits.");
    }

    // Prevent duplicate email/phone under the same business
    if (email) {
      const dupEmailSnap = await db
        .collection("businesses")
        .doc(retailerId)
        .collection("employees")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!dupEmailSnap.empty) {
        throw new Error("An employee with this email already exists.");
      }
    }

    if (phone) {
      const dupPhoneSnap = await db
        .collection("businesses")
        .doc(retailerId)
        .collection("employees")
        .where("phone", "==", phone)
        .limit(1)
        .get();
      if (!dupPhoneSnap.empty) {
        throw new Error("An employee with this phone already exists.");
      }
    }

    // Generate a unique employee ID
    let flypEmployeeId = makeEmpId();
    let exists = true;
    while (exists) {
      const docRef = db.collection("businesses").doc(retailerId)
        .collection("employees").doc(flypEmployeeId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        exists = false;
        break;
      }
      flypEmployeeId = makeEmpId();
    }

    const { salt: pinSalt, hash: pinHash } = hashPin(pin);

    const empRef = db.collection("businesses").doc(retailerId)
      .collection("employees").doc(flypEmployeeId);

    const payload = {
      flypEmployeeId,
      name,
      email,
      phone,
      role,
      permissions: {
        billing: false,
        inventory: false,
        analytics: false,
        ...permissions,
      },
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: retailerId,
      pinSalt,
      pinHash,
    };

    await empRef.set(payload, { merge: false });

    return {
      success: true,
      flypEmployeeId,
      name,
      role,
      pin, // return only once for owner to share
      message: "Employee created successfully. Share Employee ID and PIN with your staff.",
    };
  } catch (error) {
    console.error("createEmployee Error:", error);
    return {
      success: false,
      message: error.message || "Failed to create employee",
    };
  }
});
