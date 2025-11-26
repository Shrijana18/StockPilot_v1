const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Restores Firebase authentication for a distributor employee using their session data.
 * This allows automatic auth restoration after page reload without requiring PIN again.
 * Input: { distributorId, employeeId }
 * Output: { success: boolean, customToken: string, message: string }
 */
module.exports = onCall(async (request) => {
  try {
    const { distributorId, employeeId } = request.data;

    if (!employeeId || !distributorId) {
      return {
        success: false,
        message: "Missing employeeId or distributorId",
      };
    }

    // Get the employee document
    const employeeRef = admin.firestore()
      .collection('businesses')
      .doc(distributorId)
      .collection('distributorEmployees')
      .doc(employeeId);

    const employeeDoc = await employeeRef.get();

    if (!employeeDoc.exists) {
      return {
        success: false,
        message: "Employee not found.",
      };
    }

    const employeeData = employeeDoc.data();

    // Validate that employee is active
    if (employeeData.status !== "active") {
      return {
        success: false,
        message: "Employee is not active.",
      };
    }

    // Generate a new custom Firebase Auth token for the employee
    // This allows them to restore authentication without entering PIN again
    const customToken = await admin.auth().createCustomToken(employeeDoc.id, {
      distributorId: distributorId,
      employeeId: employeeDoc.id,
      isDistributorEmployee: true,
      accessSections: employeeData.accessSections || {},
    });

    // Update last login time (soft update, don't require full login)
    try {
      await employeeRef.update({
        lastRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
        online: true,
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
    console.error("Restore Distributor Employee Auth Cloud Function Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred while restoring authentication.",
    };
  }
});

