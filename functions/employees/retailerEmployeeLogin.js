const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Universal Retailer Employee Login - Works with or without retailerId
 * Authenticates a retailer employee using their employeeId and PIN.
 * Input: { retailerId (optional), employeeId, pin }
 * Output: { success: boolean, employeeData: object, message: string, customToken: string }
 */
module.exports = onCall(async (request) => {
  try {
    const { retailerId, employeeId, pin } = request.data;

    if (!employeeId || !pin) {
      return {
        success: false,
        message: "Missing employeeId or PIN",
      };
    }

    let employeeDoc = null;
    let foundRetailerId = null;

    // If retailerId is provided, search directly (faster)
    if (retailerId) {
      const employeesRef = admin.firestore()
        .collection('businesses')
        .doc(retailerId)
        .collection('employees');
      
      // Try to find by flypEmployeeId first (FLYP-RETAIL-xxx format)
      const normalizedEmployeeId = employeeId.toUpperCase();
      const querySnapshot = await employeesRef
        .where('flypEmployeeId', '==', normalizedEmployeeId)
        .get();
      
      if (!querySnapshot.empty) {
        employeeDoc = querySnapshot.docs[0];
        foundRetailerId = retailerId;
      } else {
        // Fallback: try document ID (document ID is the flypEmployeeId itself)
        const docRef = employeesRef.doc(normalizedEmployeeId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          employeeDoc = docSnap;
          foundRetailerId = retailerId;
        }
      }
    } else {
      // Search across all retailers (for universal login without retailerId)
      // This allows employees to login with just ID and PIN
      const businessesSnapshot = await admin.firestore().collection('businesses').get();
      
      for (const businessDoc of businessesSnapshot.docs) {
        const employeesRef = businessDoc.ref.collection('employees');
        
        // Try flypEmployeeId first (FLYP-RETAIL-xxx format)
        const normalizedEmployeeId = employeeId.toUpperCase();
        let querySnapshot = await employeesRef
          .where('flypEmployeeId', '==', normalizedEmployeeId)
          .get();
        
        if (querySnapshot.empty) {
          // Fallback: try document ID (document ID is the flypEmployeeId itself)
          const docRef = employeesRef.doc(normalizedEmployeeId);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            employeeDoc = docSnap;
            foundRetailerId = businessDoc.id;
            break;
          }
        } else {
          employeeDoc = querySnapshot.docs[0];
          foundRetailerId = businessDoc.id;
          break;
        }
      }
    }

    if (!employeeDoc || !foundRetailerId) {
      return {
        success: false,
        message: "Login failed. Employee not found.",
      };
    }

    const employeeData = employeeDoc.data();

    // Verify status
    if (String(employeeData.status || "").toLowerCase() !== "active") {
      return {
        success: false,
        message: "Login failed. Employee is not active.",
      };
    }

    // Verify PIN - Support both new format (plain pin) and old format (hashed)
    let pinValid = false;
    
    if (employeeData.pin) {
      // New format: plain PIN with expiration
      pinValid = employeeData.pin === pin;
      
      // Check PIN expiration
      if (pinValid && employeeData.pinExpiresAt) {
        const expiresAt = employeeData.pinExpiresAt.toDate 
          ? employeeData.pinExpiresAt.toDate() 
          : new Date(employeeData.pinExpiresAt);
        if (new Date() > expiresAt) {
          return {
            success: false,
            message: "Login failed. PIN has expired. Please contact your manager.",
          };
        }
      }
    } else if (employeeData.pinHash && employeeData.pinSalt) {
      // Old format: hashed PIN (backward compatibility)
      const crypto = require("crypto");
      const computed = crypto
        .createHash("sha256")
        .update(`${pin}:${employeeData.pinSalt}`)
        .digest("hex");
      pinValid = computed === employeeData.pinHash;
    } else {
      return {
        success: false,
        message: "Login failed. Employee PIN not set.",
      };
    }

    if (!pinValid) {
      return {
        success: false,
        message: "Login failed. Invalid PIN.",
      };
    }

    // Update last login time and online status
    await employeeDoc.ref.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      online: true,
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Generate custom Firebase Auth token for the employee
    // Use employeeDoc.id as UID (document ID) so request.auth.uid matches the employee document ID
    const customToken = await admin.auth().createCustomToken(employeeDoc.id, {
      retailerId: foundRetailerId,
      businessId: foundRetailerId, // Also include as businessId for Firestore rules compatibility
      employeeId: employeeDoc.id,
      isRetailerEmployee: true,
      accessSections: employeeData.accessSections || {},
      flypEmployeeId: employeeData.flypEmployeeId || employeeDoc.id,
    });

    // Return employee data (excluding sensitive info like PIN)
    const { pin: _, pinHash: __, pinSalt: ___, ...safeEmployeeData } = employeeData;

    return {
      success: true,
      employeeData: {
        ...safeEmployeeData,
        id: employeeDoc.id,
        retailerId: foundRetailerId,
        flypEmployeeId: employeeData.flypEmployeeId || employeeDoc.id,
      },
      message: "Login successful!",
      customToken: customToken,
    };
  } catch (error) {
    console.error("Retailer Employee Login Cloud Function Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during login.",
    };
  }
});
