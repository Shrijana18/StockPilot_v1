const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Reset PIN for distributor employee
 * Input: { employeeId, distributorId }
 * Output: { success: boolean, newPin: string, message: string }
 */
module.exports = onCall(async (request) => {
  try {
    const { employeeId, distributorId } = request.data;
    
    if (!employeeId || !distributorId) {
      return {
        success: false,
        message: "Missing employeeId or distributorId"
      };
    }

    // Check if user is authenticated
    if (!request.auth) {
      return {
        success: false,
        message: "Authentication required"
      };
    }

    // Verify the user is the distributor owner
    if (request.auth.uid !== distributorId) {
      return {
        success: false,
        message: "Unauthorized: Only distributor owner can reset employee PINs"
      };
    }

    // Generate new PIN (6 digits)
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();

    // Update employee document
    const employeeRef = admin.firestore()
      .collection("businesses")
      .doc(distributorId)
      .collection("distributorEmployees")
      .doc(employeeId.toUpperCase());

    await employeeRef.update({
      pin: newPin,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      newPin: newPin,
      message: "PIN reset successfully"
    };

  } catch (error) {
    console.error("resetDistributorEmployeePin error:", error);
    return {
      success: false,
      message: error.message || "Failed to reset PIN"
    };
  }
});
