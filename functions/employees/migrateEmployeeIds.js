const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Migration function to update existing employees with new flypEmployeeId format
 * This is a one-time migration function
 */
module.exports = onCall(async (request) => {
  try {
    const { distributorId } = request.data;

    if (!distributorId) {
      return {
        success: false,
        message: "Missing distributorId",
      };
    }

    const employeesRef = admin.firestore().collection('businesses').doc(distributorId).collection('distributorEmployees');
    const snapshot = await employeesRef.get();

    if (snapshot.empty) {
      return {
        success: true,
        message: "No employees found to migrate",
        migrated: 0
      };
    }

    let migrated = 0;
    const batch = admin.firestore().batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Only migrate if flypEmployeeId doesn't exist or is in old format
      if (!data.flypEmployeeId || !data.flypEmployeeId.startsWith('FLYP-DIST-')) {
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        const newFlypEmployeeId = `FLYP-DIST-${randomDigits}`;
        
        batch.update(doc.ref, {
          flypEmployeeId: newFlypEmployeeId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        migrated++;
      }
    }

    if (migrated > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Migration completed. ${migrated} employees updated.`,
      migrated
    };
  } catch (error) {
    console.error("Migration Error:", error);
    return {
      success: false,
      message: "Migration failed: " + error.message,
    };
  }
});
