const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const adminAuth = require("../shared/auth");
const axios = require("axios");
const admin = require("firebase-admin");

// Safe firebase-admin initialization
if (!admin.apps || admin.apps.length === 0) {
  try { admin.initializeApp(); } catch (_) {}
}

// Google Vision OCR
let visionClient = null;
try {
  const vision = require("@google-cloud/vision");
  visionClient = new vision.ImageAnnotatorClient();
} catch (e) {
  console.warn("[identifyProductFromImage] @google-cloud/vision not installed, OCR will be skipped.");
}

// Optional image compress
let sharp = null;
try { sharp = require("sharp"); } catch (_) { /* optional */ }

// Shared utils
let utils = null;
try {
  utils = require("../shared/utils");
} catch (_) {
  // fallback minimal utils to avoid crash
  utils = {
    titleCase: (s = "") =>
      String(s).toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase()),
    cleanTitle: (s = "") => String(s).replace(/\s+/g, " ").trim(),
    canonicalizeName: (brand = "", title = "") => {
      brand = String(brand || "").trim();
      let t = String(title || "").trim();
      if (brand) {
        const re = new RegExp("^" + brand.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s+", "i");
        t = t.replace(re, "");
      }
      t = t.replace(/\s+/g, " ").trim();
      return (brand ? `${utils.titleCase(brand)} ` : "") + t;
    },
    parseCanonicalUnit: (text = "") => {
      const s = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
      const multi = s.match(/\b(\d{1,2})\s*[xX]\s*(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs|tablets?|capsules?)\b/);
      if (multi) {
        let u = multi[3].toLowerCase();
        if (u === "l") u = "L";
        return `${multi[1]} x ${multi[2]} ${u}`;
      }
      const single = s.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs|tablets?|capsules?)\b/);
      let qty = "";
      if (single) {
        let u = single[2].toLowerCase();
        if (u === "l") u = "L";
        qty = `${single[1]} ${u}`;
      }
      const cont = (s.match(/\b(bottle|jar|pack|packet|sachet|box|tin|can|pouch|tube|carton|bag|strip)s?\b/i)?.[1] || "").toLowerCase();
      return [qty, cont].filter(Boolean).join(" ").trim();
    },
    biasQuery: (q = "") => {
      const allow = [
        "site:1mg.com","site:pharmeasy.in","site:netmeds.com","site:bigbasket.com","site:blinkit.com",
        "site:amazon.in","site:flipkart.com","site:dmart.in"
      ].join(" OR ");
      const s = String(q || "").trim();
      return s ? `${s} (${allow})` : allow;
    }
  };
}

// Optional: Google CSE (whitelisted web hints)
const CSE_KEY = process.env.CSE_KEY || process.env.GOOGLE_CSE_KEY || "";
const CSE_CX  = process.env.CSE_CX  || process.env.GOOGLE_CSE_CX  || "";
const biasQuery = (s = "") => (utils && utils.biasQuery ? utils.biasQuery(s) : String(s).slice(0,180));

// Helper to fetch Google Custom Search results
async function fetchCSE(query, num = 2) {
  if (!CSE_KEY || !CSE_CX || !query) return [];
  const url = "https://www.googleapis.com/customsearch/v1";
  try {
    const r = await axios.get(url, { params: { key: CSE_KEY, cx: CSE_CX, q: query, num } });
    const items = Array.isArray(r.data?.items) ? r.data.items : [];
    return items.map(it => ({ title: it.title, link: it.link, snippet: it.snippet }));
  } catch {
    return [];
  }
}

/**
 * Multimodal call with compact JSON output.
 * Uses gpt-4o by default (you can override via env OPENAI_MODEL).
 */
async function callMultimodalAI(imageBase64, textContext) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY for multimodal call.");
    return null;
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const systemPrompt = `You are an expert product identification AI for the Indian retail market. Analyze the product image and the provided text context. Return ONLY a strict JSON object with this exact schema: { "name": "", "brand": "", "unit": "", "category": "", "sku": "", "mrp": "", "hsn": "", "gst": null }.
Rules:
- 'name' should be the canonical product name.
- 'unit' must include quantity and container (e.g., "250 ml Bottle").
- 'sku' should be the barcode if available.
- 'mrp' is the Maximum Retail Price. If "MRP" is explicitly written, use that value. If not, use any other visible selling price. Extract only the numeric value (e.g., for "MRP ₹120.00", return "120"). If no price is visible, leave it as an empty string.
- Guess HSN/GST if confident, otherwise leave as empty string or null.
- Be brief and accurate. No commentary or markdown.`;

  const userPrompt = `Identify the product in the image using this context:\n${textContext || ""}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low",
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    top_p: 0.2,
    max_tokens: 600,
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 25000,
    });
    const reply = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return null;

    const parsed = JSON.parse(reply);
    // ensure mrp is a string
    if (typeof parsed.mrp === "number") parsed.mrp = String(parsed.mrp);
    return parsed;
  } catch (apiError) {
    console.error("OpenAI Multimodal API Request Failed:", apiError.message);
    if (apiError.response) console.error("Response data:", apiError.response.data);
    return null;
  }
}

module.exports = onRequest(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).send("");
  }

  cors(req, res, async () => {
    try {
      res.set("Access-Control-Allow-Origin", "*");

      // Optional auth: if Authorization header is present, verify token.
      // If you want to enforce auth, set REQUIRE_AUTH=true in env.
      const requireAuth = process.env.REQUIRE_AUTH_IDENTIFY === "true";
      const authHeader = req.get("Authorization") || "";
      let uid = null;
      if (authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7);
          const decoded = await admin.auth().verifyIdToken(token);
          uid = decoded.uid || null;
        } catch (_) {
          if (requireAuth) {
            return res.status(401).json({ ok: false, message: "Unauthorized" });
          }
        }
      } else if (requireAuth) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
      }

      // Accept JSON or rawBody JSON string
      let { imageBase64, imageUrl, barcode: clientBarcode, framesBase64 } = req.body || {};
      if (!imageBase64 && typeof req.body === "string") {
        try {
          const parsed = JSON.parse(req.body);
          imageBase64 = parsed.imageBase64;
          imageUrl = parsed.imageUrl;
          clientBarcode = parsed.barcode || clientBarcode;
          framesBase64 = parsed.framesBase64 || framesBase64;
        } catch {}
      }

      if (!imageBase64 && !imageUrl && !(Array.isArray(framesBase64) && framesBase64.length)) {
        return res.status(400).json({ ok: false, success: false, message: "Provide imageBase64, imageUrl or framesBase64[] in body." });
      }

      // If a burst of frames is provided, pick the best frame by OCR+logo signal
      if (Array.isArray(framesBase64) && framesBase64.length && visionClient) {
        const burst = framesBase64.slice(0, 5);
        let bestIdx = 0, bestScore = -1;
        for (let i = 0; i < burst.length; i++) {
          try {
            const [anno] = await visionClient.annotateImage({
              image: { content: burst[i] },
              features: [{ type: "TEXT_DETECTION" }, { type: "LOGO_DETECTION" }],
            });
            const score =
              (anno?.textAnnotations?.[0]?.description || "").length +
              ((anno?.logoAnnotations?.[0]?.score || 0) * 300);
            if (score > bestScore) { bestScore = score; bestIdx = i; }
          } catch {}
        }
        imageBase64 = burst[bestIdx];
      }

      // Normalize image content
      let imageContent = imageBase64;
      if (!imageContent && imageUrl) {
        const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 12000 });
        imageContent = Buffer.from(imgResp.data, "binary").toString("base64");
      }
      if (!imageContent) {
        return res.status(400).json({ ok: false, success: false, message: "Failed to read image data." });
      }

      // Cache key by image hash
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(imageContent).digest("hex");
      const db = admin.firestore();
      const cacheRef = db.collection("productVisionCache").doc(`hash:${hash}`);

      // Cache hit short-circuit
      const cached = await cacheRef.get();
      if (cached.exists) {
        const data = cached.data();
        return res.status(200).json({
          ok: true,
          success: true,
          cached: true,
          ...data,
          // Back-compat keys:
          product: data?.best || null,
        });
      }

      // Phase 1: OCR text (cheap) + barcode extraction + optional web hints
      let ocrJoined = "";
      if (visionClient) {
        try {
          const [textResult] = await visionClient.textDetection({ image: { content: imageContent } });
          ocrJoined = textResult?.textAnnotations?.[0]?.description?.replace(/\n/g, " ") || "";
        } catch (e) {
          console.warn("Vision textDetection failed:", e.message);
        }
      }

      // Extract barcode digits from OCR or client
      const RE_BARCODE = /\b(\d{8}|\d{12,14})\b/g;
      let scannedCode = clientBarcode || "";
      if (!scannedCode && ocrJoined) {
        let m; while ((m = RE_BARCODE.exec(ocrJoined)) !== null) scannedCode = m[1];
      }

      // Barcode lookup (optional)
      let barcodeInfo = null;
      if (scannedCode) {
        try {
          const PROJECT = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "stockpilotv1";
          const REGION_HOST = `https://us-central1-${PROJECT}.cloudfunctions.net`;
          const barcodeResp = await axios.post(`${REGION_HOST}/lookupBarcode`, { code: scannedCode }, { timeout: 10000 });
          if ((barcodeResp.data?.ok || barcodeResp.data?.success) && (barcodeResp.data.data || barcodeResp.data.product)) {
            barcodeInfo = barcodeResp.data.data || barcodeResp.data.product;
          }
        } catch (e) { console.warn("Barcode lookup failed:", e.message); }
      }

      // Optional CSE web hints
      let webResults = [];
      if (CSE_KEY && CSE_CX && ocrJoined) {
        const searchQuery = biasQuery(ocrJoined.slice(0,160));
        webResults = await fetchCSE(searchQuery, 2);
      }

      // Phase 2: Multimodal AI with compact text context
      const textContext =
        `OCR:"${ocrJoined}" | Barcode:${scannedCode || "None"} | ` +
        `Lookup:${barcodeInfo ? JSON.stringify(barcodeInfo) : "None"} | ` +
        `Top:${webResults.length ? JSON.stringify(webResults.map(r=>r.title).slice(0,2)) : "None"}`;

      const aiResult = await callMultimodalAI(imageContent, textContext);

      if (!aiResult || !aiResult.name) {
        return res.status(200).json({ ok: false, success: false, message: "AI failed to identify the product." });
      }

      // Phase 3: Cleanup & canonicalization
      let best = {
        productName: aiResult.name || "",
        brand: aiResult.brand || "",
        variant: aiResult.variant || "",
        category: aiResult.category || "",
        unit: aiResult.unit || "",
        code: aiResult.sku || scannedCode || "",
        mrp: aiResult.mrp || "",
        hsn: aiResult.hsn || "",
        gst: aiResult.gst !== undefined ? aiResult.gst : null,
        source: "gpt-4o",
        confidence: 0.9,
      };

      // Final cleanups using shared utils
      best.brand = utils.titleCase(best.brand);
      best.productName = utils.canonicalizeName(best.brand, utils.cleanTitle(best.productName));
      best.unit = utils.parseCanonicalUnit(best.unit || best.productName);

      // Save a compressed copy (best-effort)
      try {
        if (sharp) {
          const bucket = admin.storage().bucket();
          const imgBuf = Buffer.from(imageContent, "base64");
          const small = await sharp(imgBuf).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
          await bucket.file(`scans/${hash}.jpg`).save(small, { contentType: "image/jpeg", resumable: false });
        }
      } catch (e) { console.warn("Scan save failed:", e?.message); }

      // Cache the result
      await cacheRef.set(
        { best, imagePath: `scans/${hash}.jpg`, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      // Response with both old and new keys
      const autofill = {
        productName: best.productName,
        brand: best.brand,
        variant: best.variant,
        category: best.category,
        sku: best.code,
        unit: best.unit,
        hsn: best.hsn,
        gst: best.gst,
        mrp: best.mrp,
      };

      return res.status(200).json({
        ok: true,
        success: true,
        best,
        autofill,
        userId: uid || undefined,
        // new-key mirror for newer UI:
        product: best,
      });
    } catch (error) {
      console.error("identifyProductFromImage Error:", error);
      return res.status(400).json({
        ok: false,
        success: false,
        message: error.message || "Failed to identify product from image",
      });
    }
  });
});