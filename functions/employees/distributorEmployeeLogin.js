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

    if (!employeeId || !pin) {
      return {
        success: false,
        message: "Missing employeeId or PIN",
      };
    }

    let employeeDoc = null;
    let foundDistributorId = null;

    // If distributorId is provided, search directly (faster)
    if (distributorId) {
      const employeesRef = admin.firestore().collection('businesses').doc(distributorId).collection('distributorEmployees');
      const querySnapshot = await employeesRef.where('flypEmployeeId', '==', employeeId.toUpperCase()).get();
      
      if (!querySnapshot.empty) {
        employeeDoc = querySnapshot.docs[0];
        foundDistributorId = distributorId;
      }
    } else {
      // Search across all distributors (for manual entry without link)
      // This is more expensive but allows employees to login with just ID and PIN
      const businessesSnapshot = await admin.firestore().collection('businesses').get();
      
      for (const businessDoc of businessesSnapshot.docs) {
        const employeesRef = businessDoc.ref.collection('distributorEmployees');
        const querySnapshot = await employeesRef.where('flypEmployeeId', '==', employeeId.toUpperCase()).get();
        
        if (!querySnapshot.empty) {
          employeeDoc = querySnapshot.docs[0];
          foundDistributorId = businessDoc.id;
          break; // Found the employee, stop searching
        }
      }
    }

    if (!employeeDoc || !foundDistributorId) {
      return {
        success: false,
        message: "Login failed. Employee not found.",
      };
    }

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
      distributorId: foundDistributorId,
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
        distributorId: foundDistributorId,
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
