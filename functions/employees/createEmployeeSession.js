const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps || admin.apps.length === 0) {
  try { admin.initializeApp(); } catch (_) {}
}

/**
 * Creates an employee session with selfie verification
 * Input: { distributorId, employeeId, selfieUrl }
 * Output: { success: boolean, sessionId: string, message: string }
 */
module.exports = onCall({ region: "us-central1" }, async (request) => {
  try {
    const auth = request.auth;
    if (!auth?.uid) {
      return {
        success: false,
        message: "Authentication required"
      };
    }

    const { selfieUrl, distributorId: providedDistributorId } = request.data || {};

    if (!selfieUrl) {
      return {
        success: false,
        message: "Missing required field: selfieUrl"
      };
    }

    // Use auth.uid as the trusted employeeId (from the custom token)
    // This is the Firestore document ID set when creating the custom token
    const trustedEmployeeId = auth.uid;
    
    // Get distributorId from request data (preferred), then custom claims, then ID token
    let distributorId = providedDistributorId;
    
    if (!distributorId) {
      // Try custom claims from auth.token
      distributorId = auth.token?.distributorId;
    }
    
    if (!distributorId) {
      // Fallback: try to verify the ID token to get custom claims
      try {
        const authHeader = request.rawRequest?.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const idToken = authHeader.split('Bearer ')[1];
          const decodedToken = await admin.auth().verifyIdToken(idToken, true);
          distributorId = decodedToken.distributorId;
        }
      } catch (err) {
        console.warn('[createEmployeeSession] Failed to get distributorId from token:', err);
      }
    }
    
    console.log('[createEmployeeSession] Looking for employee:', {
      trustedEmployeeId,
      distributorId,
      hasProvidedDistributorId: !!providedDistributorId
    });
    
    // If still no distributorId, search across all distributors for this employee
    const db = admin.firestore();
    let employeeDoc = null;
    let foundDistributorId = distributorId;
    
    if (distributorId) {
      // Try with provided/claimed distributorId first
      const employeeRef = db.collection('businesses').doc(distributorId)
        .collection('distributorEmployees').doc(trustedEmployeeId);
      employeeDoc = await employeeRef.get();
      
      if (!employeeDoc.exists) {
        console.log('[createEmployeeSession] Employee not found at provided distributorId, searching...');
        employeeDoc = null;
      }
    }
    
    // If not found, search across all distributors
    if (!employeeDoc || !employeeDoc.exists) {
      console.log('[createEmployeeSession] Searching for employee across all distributors...');
      const businessesSnapshot = await db.collection('businesses').get();
      
      for (const businessDoc of businessesSnapshot.docs) {
        const employeeRef = businessDoc.ref.collection('distributorEmployees').doc(trustedEmployeeId);
        const docSnap = await employeeRef.get();
        
        if (docSnap.exists) {
          employeeDoc = docSnap;
          foundDistributorId = businessDoc.id;
          console.log('[createEmployeeSession] Found employee at distributorId:', foundDistributorId);
          break;
        }
      }
    }
    
    if (!employeeDoc || !employeeDoc.exists) {
      console.error('[createEmployeeSession] Employee not found. auth.uid:', trustedEmployeeId, 'searched distributorId:', distributorId);
      return {
        success: false,
        message: "Employee not found"
      };
    }
    
    distributorId = foundDistributorId; // Use the found distributorId

    const employeeData = employeeDoc.data();
    if (employeeData.status !== 'active') {
      return {
        success: false,
        message: "Employee is not active"
      };
    }

    // Create session document using trusted employeeId
    const sessionId = `session_${Date.now()}`;
    const sessionData = {
      employeeId: trustedEmployeeId,
      distributorId: distributorId,
      selfieUrl,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      location: null,
    };
    
    console.log('[createEmployeeSession] Creating session:', sessionId, 'for employee:', trustedEmployeeId, 'at distributor:', distributorId);

    const sessionRef = db.collection('businesses').doc(distributorId)
      .collection('employeeSessions').doc(sessionId);
    await sessionRef.set(sessionData);

    // Update employee document with session info
    await employeeDoc.ref.update({
      currentSessionId: sessionId,
      currentSessionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSessionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      sessionActive: true,
    });
    
    console.log('[createEmployeeSession] Session created and employee updated successfully');

    return {
      success: true,
      sessionId,
      message: "Session created successfully"
    };

  } catch (error) {
    console.error("createEmployeeSession error:", error);
    return {
      success: false,
      message: error.message || "Failed to create session"
    };
  }
});

