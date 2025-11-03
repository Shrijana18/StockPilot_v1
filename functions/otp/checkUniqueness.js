// functions/otp/checkUniqueness.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// E.164 India (+91) validator
const isE164IN = (phone) => typeof phone === 'string' && /^\+91\d{10}$/.test(phone);

// Basic email validator
const isValidEmail = (email) => typeof email === 'string' && email.includes('@') && email.length > 3;

/**
 * Callable function to check phone/email uniqueness for registration.
 * - Allows unauthenticated access (needed for pre-registration validation)
 * - Returns whether phone/email is available
 * - Rate limited to prevent abuse
 */
exports.checkUniqueness = onCall(
  {
    cors: true,
    enforceAppCheck: false,
    rateLimits: {
      maxCallsPerMinute: 30, // Lower limit for unauthenticated calls
    },
  },
  async (request) => {
    const { phone, email } = request.data || {};

    // Validate input
    if (!phone && !email) {
      throw new HttpsError('invalid-argument', 'Provide either phone or email to check.');
    }

    const results = {
      phone: { checked: false, available: false },
      email: { checked: false, available: false },
    };

    // Check phone uniqueness
    if (phone) {
      if (!isE164IN(phone)) {
        throw new HttpsError('invalid-argument', 'Phone must be E.164 format for India, e.g., +919876543210.');
      }

      try {
        const phoneQuery = await db
          .collection('businesses')
          .where('phone', '==', phone)
          .limit(1)
          .get();

        results.phone = {
          checked: true,
          available: phoneQuery.empty,
        };
      } catch (error) {
        console.error('[checkUniqueness] phone query error:', error);
        throw new HttpsError('internal', 'Failed to check phone availability.');
      }
    }

    // Check email uniqueness
    if (email) {
      if (!isValidEmail(email)) {
        throw new HttpsError('invalid-argument', 'Invalid email format.');
      }

      try {
        const emailQuery = await db
          .collection('businesses')
          .where('email', '==', email.trim().toLowerCase())
          .limit(1)
          .get();

        results.email = {
          checked: true,
          available: emailQuery.empty,
        };
      } catch (error) {
        console.error('[checkUniqueness] email query error:', error);
        throw new HttpsError('internal', 'Failed to check email availability.');
      }
    }

    return {
      success: true,
      ...results,
    };
  }
);

