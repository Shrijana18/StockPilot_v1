const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Authenticates a distributor employee using their employeeId and PIN.
 * Input: { distributorId, employeeId, pin }
 * Output: { success: boolean, employeeData: object, message: string }
 */
module.exports = onCall(async (request) => {
  try {
    const { distributorId, employeeId, pin } = request.data;

    if (!distributorId || !employeeId || !pin) {
      return {
        success: false,
        message: "Missing distributorId, employeeId, or PIN",
      };
    }

    // Search by flypEmployeeId field, not document ID
    const employeesRef = admin.firestore().collection('businesses').doc(distributorId).collection('distributorEmployees');
    const querySnapshot = await employeesRef.where('flypEmployeeId', '==', employeeId).get();

    if (querySnapshot.empty) {
      return {
        success: false,
        message: "Login failed. Employee not found.",
      };
    }

    const employeeDoc = querySnapshot.docs[0];
    const employeeData = employeeDoc.data();

    // Verify PIN
    if (employeeData.pin !== pin) {
      return {
        success: false,
        message: "Login failed. Invalid PIN.",
      };
    }

    // Check PIN expiration
    if (employeeData.pinExpiresAt && employeeData.pinExpiresAt.toDate() < new Date()) {
      return {
        success: false,
        message: "Login failed. PIN has expired. Please contact your distributor.",
      };
    }

    // Update last login time and online status
    await employeeDoc.ref.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      online: true,
    });

    // Generate custom Firebase Auth token for the employee
    const customToken = await admin.auth().createCustomToken(employeeDoc.id, {
      distributorId: distributorId,
      employeeId: employeeDoc.id,
      isDistributorEmployee: true,
      accessSections: employeeData.accessSections,
    });

    // Return employee data (excluding sensitive info like PIN)
    const { pin: _, ...safeEmployeeData } = employeeData;

    return {
      success: true,
      employeeData: {
        ...safeEmployeeData,
        id: employeeDoc.id,
        distributorId: distributorId,
      },
      message: "Login successful!",
      customToken: customToken,
    };
  } catch (error) {
    console.error("Distributor Employee Login Cloud Function Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during login.",
    };
  }
});
