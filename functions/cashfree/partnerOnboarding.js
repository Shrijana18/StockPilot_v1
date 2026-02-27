/**
 * Cashfree Partner – Create sub-merchant and embeddable onboarding link.
 * Uses Partner API key from Firebase Secret: CASHFREE_PARTNER_API_KEY.
 *
 * Do NOT put the API key in code. Set it once:
 *   firebase functions:secrets:set CASHFREE_PARTNER_API_KEY
 * Then redeploy functions.
 */

const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

const CASHFREE_PARTNER_API_KEY = defineSecret("CASHFREE_PARTNER_API_KEY");

const BASE_URL = process.env.CASHFREE_PARTNER_BASE_URL || "https://api.cashfree.com/partners";
const API_VERSION = "2023-01-01";

function getPartnerApiKey() {
  try {
    return CASHFREE_PARTNER_API_KEY.value() || process.env.CASHFREE_PARTNER_API_KEY;
  } catch (e) {
    return process.env.CASHFREE_PARTNER_API_KEY;
  }
}

/**
 * Shared logic: create Cashfree sub-merchant and return embeddable onboarding link.
 * Used by both callable and HTTP endpoint.
 */
async function createMerchantAndOnboardingLinkLogic(uid) {
  const apiKey = getPartnerApiKey();
  if (!apiKey) {
    throw new Error("Cashfree Partner API key not configured. Set CASHFREE_PARTNER_API_KEY secret.");
  }

  const db = admin.firestore();
  const businessRef = db.doc(`businesses/${uid}`);
  const businessSnap = await businessRef.get();
  if (!businessSnap.exists) {
    throw new Error("Business profile not found. Save your profile first.");
  }
  const biz = businessSnap.data();
  const email = (biz.email || "").trim();
  const merchantName = (biz.businessName || biz.ownerName || "Store").trim();
  const phone = (biz.phone || "").trim().replace(/\D/g, "").slice(0, 10) || "0000000000";
  const siteUrl = (biz.merchant_site_url || "https://flypnow.com/" || "").trim();

  if (!email) {
    throw new Error("Email is required. Please complete Owner Info in profile.");
  }

  const merchantId = uid;
  const headers = {
    "Content-Type": "application/json",
    "x-partner-apikey": apiKey,
    "x-api-version": API_VERSION,
  };

  const createUrl = `${BASE_URL}/merchants`;
  const createBody = {
    merchant_id: merchantId,
    merchant_email: email,
    merchant_name: merchantName,
    poc_phone: phone,
    merchant_site_url: siteUrl || "https://flypnow.com/",
  };

  let createRes;
  try {
    createRes = await fetch(createUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody),
    });
  } catch (e) {
    console.error("Cashfree create merchant request failed:", e);
    throw new Error("Payment provider unavailable. Please try again.");
  }

  const createData = await createRes.json().catch(() => ({}));
  const getErrMsg = (obj) => (obj && (obj.message || obj.error || obj.error_description || obj.reason || (typeof obj === "string" ? obj : ""))) || "";

  if (createRes.status === 409 && (createData.message || "").toLowerCase().includes("already exists")) {
    // merchant already exists
  } else if (!createRes.ok) {
    const errMsg = getErrMsg(createData) || createRes.statusText || "Failed to create merchant";
    console.error("Cashfree create merchant error:", createRes.status, createData);
    throw new Error(errMsg);
  }

  const onboardingStatus = createData.onboarding_status || biz.cashfreeOnboardingStatus || "Pending";

  const returnUrl = process.env.VITE_APP_URL || "https://flypnow.com/dashboard";
  const linkUrl = `${BASE_URL}/merchants/${encodeURIComponent(merchantId)}/onboarding_link`;
  const linkBody = { type: "account_onboarding", return_url: returnUrl };

  let onboardingLink = null;
  let linkError = null;

  try {
    const linkRes = await fetch(linkUrl, { method: "POST", headers, body: JSON.stringify(linkBody) });
    const linkData = await linkRes.json().catch(() => ({}));
    if (linkRes.ok && linkData.onboarding_link) {
      onboardingLink = linkData.onboarding_link;
    } else {
      linkError = getErrMsg(linkData) || linkRes.statusText || "Could not generate setup link";
      console.warn("Cashfree onboarding link failed:", linkRes.status, linkData);
    }
  } catch (e) {
    linkError = e.message || "Could not generate setup link";
    console.error("Cashfree onboarding link request failed:", e);
  }

  try {
    await businessRef.set(
      {
        cashfreeMerchantId: merchantId,
        cashfreeOnboardingStatus: onboardingStatus,
        cashfreeOnboardingLinkUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("Cashfree: Firestore update failed after merchant created:", e.message);
    // Do not throw – merchant was created; return success so frontend gets link/merchantId
  }

  if (onboardingLink) {
    return { success: true, onboardingLink, merchantId, onboardingStatus };
  }
  return {
    success: true,
    merchantId,
    onboardingStatus,
    message: linkError
      ? `Merchant created. ${linkError} Complete KYC from Cashfree Partner Dashboard (Merchants → your account → Complete KYC) or contact your Cashfree account manager to enable the feature.`
      : "Merchant created. Complete KYC from Cashfree Partner Dashboard.",
  };
}

/**
 * Callable (may have CORS issues from localhost on some SDK versions).
 */
exports.cashfreeCreateMerchantAndOnboardingLink = onCall(
  {
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 30,
    cors: true,
    secrets: [CASHFREE_PARTNER_API_KEY],
  },
  async (request) => {
    if (!request.auth) throw new Error("Unauthorized");
    return createMerchantAndOnboardingLinkLogic(request.auth.uid);
  }
);

/** Set CORS headers so browser (e.g. localhost) can call this endpoint. */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin || req.headers.Origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

/**
 * HTTP endpoint – single implementation for Cashfree create merchant + onboarding link.
 * CORS handled explicitly so localhost and production can call it.
 * Call with: POST, Header: Authorization: Bearer <Firebase ID token>
 */
async function handleCashfreeHttp(req, res) {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const idToken = authHeader.split("Bearer ")[1];
  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await createMerchantAndOnboardingLinkLogic(uid);
    res.status(200).json(result);
  } catch (e) {
    console.error("Cashfree HTTP error:", e.message);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}

exports.cashfreeCreateMerchantAndOnboardingLinkHttp = onRequest(
  {
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 30,
    secrets: [CASHFREE_PARTNER_API_KEY],
  },
  (req, res) => {
    return handleCashfreeHttp(req, res).catch((err) => {
      console.error("Cashfree HTTP unhandled:", err);
      if (!res.headersSent) {
        setCorsHeaders(req, res);
        res.status(500).json({ error: "Internal error" });
      }
    });
  }
);

/**
 * Cashfree Partner webhook: MERCHANT_ONBOARDING_STATUS.
 * Configure in Partner Dashboard → Developers → Webhook:
 *   URL: https://asia-south1-stockpilotv1.cloudfunctions.net/cashfreeMerchantOnboardingWebhook
 *   Event: MERCHANT_ONBOARDING_STATUS (search "Merchant" or "Onboarding").
 *
 * Verifies signature and updates businesses/{merchant_id} when status is ACTIVE.
 */
function verifyWebhookSignature(payloadRaw, signature, timestamp, apiKey) {
  if (!signature || !apiKey) return false;
  const signedPayload = `${timestamp}.${payloadRaw}`;
  const expected = crypto.createHmac("sha256", apiKey).update(signedPayload).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(signature, "base64"), Buffer.from(expected, "base64"));
}

exports.cashfreeMerchantOnboardingWebhook = onRequest(
  {
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 15,
    secrets: [CASHFREE_PARTNER_API_KEY],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody && req.rawBody.toString ? req.rawBody.toString() : JSON.stringify(req.body));
    const signature = req.headers["x-cashfree-signature"] || req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-cashfree-timestamp"] || req.headers["x-webhook-timestamp"];

    let apiKey;
    try {
      apiKey = CASHFREE_PARTNER_API_KEY.value() || process.env.CASHFREE_PARTNER_API_KEY;
    } catch (e) {
      apiKey = process.env.CASHFREE_PARTNER_API_KEY;
    }

    if (apiKey && signature && timestamp && !verifyWebhookSignature(rawBody, signature, timestamp, apiKey)) {
      console.warn("Cashfree webhook signature verification failed");
      res.status(401).send("Invalid signature");
      return;
    }

    let body;
    try {
      body = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    } catch (e) {
      res.status(400).send("Invalid JSON");
      return;
    }

    if (body.type !== "MERCHANT_ONBOARDING_STATUS") {
      res.status(200).send("OK");
      return;
    }

    const data = body.data || {};
    const merchantId = data.merchant_id;
    const onboardingStatus = data.onboarding_status;

    if (!merchantId) {
      res.status(200).send("OK");
      return;
    }

    const db = admin.firestore();
    const businessRef = db.doc(`businesses/${merchantId}`);
    await businessRef.set(
      {
        cashfreeOnboardingStatus: onboardingStatus,
        cashfreeActive: onboardingStatus === "ACTIVE",
        cashfreeWebhookUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log("Cashfree webhook: merchant", merchantId, "status", onboardingStatus);
    res.status(200).send("OK");
  }
);

/** Aliases for backward compatibility – frontend or cached builds may call these URLs. */
exports.cashfreeCreateMerchantAndOnboarding1 = exports.cashfreeCreateMerchantAndOnboardingLinkHttp;
exports.cashfreeCreateMerchantAndOnboarding = exports.cashfreeCreateMerchantAndOnboardingLinkHttp;
