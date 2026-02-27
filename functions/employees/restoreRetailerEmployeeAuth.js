const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Restores Firebase authentication for a retailer employee using their session data.
 * This allows automatic auth restoration after page reload without requiring PIN again.
 * Input: { retailerId, employeeId }
 * Output: { success: boolean, customToken: string, message: string }
 */
module.exports = onCall(async (request) => {
  try {
    const { retailerId, employeeId } = request.data;

    if (!employeeId || !retailerId) {
      return {
        success: false,
        message: "Missing employeeId or retailerId",
      };
    }

    // Get the employee document - try by flypEmployeeId first, then by document ID
    const employeesRef = admin.firestore()
      .collection('businesses')
      .doc(retailerId)
      .collection('employees');

    // Try to find by flypEmployeeId first
    let employeeDoc = null;
    const querySnapshot = await employeesRef
      .where('flypEmployeeId', '==', employeeId.toUpperCase())
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      employeeDoc = querySnapshot.docs[0];
    } else {
      // Fallback: try document ID
      const docRef = employeesRef.doc(employeeId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        employeeDoc = docSnap;
      }
    }

    if (!employeeDoc || !employeeDoc.exists) {
      return {
        success: false,
        message: "Employee not found.",
      };
    }

    const employeeData = employeeDoc.data();

    // Validate that employee is active
    if (String(employeeData.status || "").toLowerCase() !== "active") {
      return {
        success: false,
        message: "Employee is not active.",
      };
    }

    // Generate a new custom Firebase Auth token for the employee
    // Use the document ID as the UID (same as in retailerEmployeeLogin)
    const customToken = await admin.auth().createCustomToken(employeeDoc.id, {
      retailerId: retailerId,
      businessId: retailerId, // Also include as businessId for Firestore rules compatibility
      employeeId: employeeDoc.id,
      isRetailerEmployee: true,
      accessSections: employeeData.accessSections || {},
      flypEmployeeId: employeeData.flypEmployeeId || employeeDoc.id,
    });

    // Update last login time (soft update, don't require full login)
    try {
      await employeeDoc.ref.update({
        lastRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
        online: true,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // Non-fatal if update fails
      console.warn('Failed to update lastRestoredAt:', e);
    }

    return {
      success: true,
      customToken: customToken,
      message: "Authentication token generated successfully",
    };
  } catch (error) {
    console.error("Restore Retailer Employee Auth Cloud Function Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred while restoring authentication.",
    };
  }
});
