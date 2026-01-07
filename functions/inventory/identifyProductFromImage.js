const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const cors = require("cors")({ origin: true });
const adminAuth = require("../shared/auth");
const axios = require("axios");
const admin = require("firebase-admin");
const HybridAI = require("../shared/hybridAI");

// Define secrets for Firebase Functions v2
const GEMINI_API_KEY_SECRET = defineSecret("GEMINI_API_KEY");

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
 * Enhanced Gemini API call with comprehensive product information extraction
 * Uses Firebase secrets for API key access
 */
async function callGeminiDirect(imageBase64, textContext) {
  const geminiApiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY_SECRET.value();
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
  
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
  
  const systemPrompt = `You are FLYP Magic - an expert AI product identifier for Indian retail. Analyze ANY image (product, object, or item) and extract accurate information.

Return ONLY a strict JSON object with this exact schema:
{
  "name": "Product Name Only (short, clean name without description, e.g., 'Sensodyne Toothpaste' not 'Sensodyne Daily Sensitivity Protection...')",
  "brand": "Brand Name", 
  "unit": "Quantity Number + Unit Type (e.g., '1 Tube', '250ml Bottle', '500g Pack', '10 Tablets', '1 Piece')",
  "category": "Product Category (e.g., Medicine, Food & Beverages, Personal Care, Home Care, Electronics, Stationery, Clothing)",
  "description": "Detailed product description including key features, ingredients, usage instructions if visible",
  "sku": "Barcode/SKU if visible",
  "mrp": "Maximum Retail Price (numeric value only, e.g., '120' for 'MRP ₹120.00')",
  "sellingPrice": "Selling Price if different from MRP (numeric value only)",
  "hsn": "HSN Code if visible (4-8 digits)",
  "gst": "GST Rate if visible (numeric value: 0, 5, 12, 18, or 28)",
  "variant": "Product Variant/Size/Flavor (e.g., '500mg', 'Mint flavor', 'Family pack')",
  "confidence": 0.95
}

CRITICAL RULES:
- 'name' MUST be SHORT and CLEAN - just the product name (e.g., "Sensodyne Toothpaste", "Paracetamol Tablets", "Coca Cola"). NO long descriptions, NO marketing text, NO features in the name field.
- 'unit' MUST start with a NUMBER followed by unit type (e.g., "1 Tube", "250ml Bottle", "500g Pack", "10 Tablets", "1 Piece", "2 Pieces"). Always include quantity number.
- Identify ANY object shown - even if it's not a retail product, try to identify what it is (e.g., "Pen", "Notebook", "Water Bottle", "Mobile Phone")
- Use visual analysis: colors, shapes, packaging design, logos, text labels, product appearance
- Recognize Indian brands: Dabur, Himalaya, Patanjali, Hindustan Unilever, P&G, ITC, Nestle, Sensodyne, Colgate, etc.
- Extract ALL visible text from packaging including ingredients, usage instructions, warnings
- 'category' should be specific (e.g., "Medicine", "Food & Beverages", "Personal Care", "Home Care", "Electronics", "Stationery")
- 'description' should include key features, ingredients list if visible, usage instructions, any special properties
- 'mrp' extract ONLY the numeric value from MRP labels (remove currency symbols, commas)
- 'hsn' and 'gst' only if clearly visible on packaging
- 'variant' should capture size, flavor, type, or any distinguishing feature
- 'confidence' should be 0.8-1.0 based on clarity and completeness of information extracted
- Be smart: Even if product name is not clearly visible, use visual cues, brand logos, packaging design to identify
- Focus on Indian retail products and packaging standards
- Extract maximum information - be thorough and accurate
- NO commentary, explanations, or markdown formatting - ONLY the JSON object`;

  const userPrompt = textContext 
    ? `Identify the product or object in this image using the context: ${textContext}\n\nExtract ALL available information. Product name should be SHORT and CLEAN (no descriptions). Unit must include quantity number + type (e.g., "1 Tube", "250ml Bottle").`
    : "Identify the product or object in this image. Extract ALL available information. Product name should be SHORT and CLEAN (no descriptions). Unit must include quantity number + type (e.g., '1 Tube', '250ml Bottle'). Even if product name is not clearly visible, use visual cues, logos, and packaging to identify.";

  const payload = {
    contents: [{
      parts: [
        { text: `${systemPrompt}\n\n${userPrompt}` },
        {
          inline_data: {
            mime_type: "image/jpeg",
            data: imageBase64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json"
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("No content returned from Gemini");
    }

    console.log("🔍 Raw Gemini response:", content.substring(0, 500));

    // Clean JSON
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("❌ JSON parse failed:", parseError.message);
      // Try to extract fields with regex as fallback
      const nameMatch = cleanedContent.match(/"name"\s*:\s*"([^"]+)"/);
      const brandMatch = cleanedContent.match(/"brand"\s*:\s*"([^"]+)"/);
      const categoryMatch = cleanedContent.match(/"category"\s*:\s*"([^"]+)"/);
      const descMatch = cleanedContent.match(/"description"\s*:\s*"([^"]+)"/);
      const unitMatch = cleanedContent.match(/"unit"\s*:\s*"([^"]+)"/);
      
      parsed = {
        name: nameMatch ? nameMatch[1] : "",
        brand: brandMatch ? brandMatch[1] : "",
        category: categoryMatch ? categoryMatch[1] : "",
        description: descMatch ? descMatch[1] : "",
        unit: unitMatch ? unitMatch[1] : "",
        sku: "",
        mrp: "",
        hsn: "",
        gst: null
      };
    }
    
    // Clean product name - remove long descriptions, keep it short
    let cleanName = parsed.name || "";
    // Remove common description patterns
    cleanName = cleanName
      .replace(/\s*-\s*(Daily|Protection|Strong|Healthy|Fresh|Mint|Flavor|Flavour).*$/i, "")
      .replace(/\s*\(.*?\)/g, "") // Remove parentheses content
      .replace(/\s+/g, " ")
      .trim();
    
    // Ensure unit has quantity number
    let cleanUnit = parsed.unit || "";
    if (cleanUnit && !/^\d+/.test(cleanUnit.trim())) {
      // If unit doesn't start with number, try to extract or add "1"
      const unitMatch = cleanUnit.match(/(tube|bottle|pack|tablet|piece|packet|sachet|box|tin|can|pouch|carton|bag|strip|jar|kg|g|ml|l|gm)/i);
      if (unitMatch) {
        cleanUnit = `1 ${unitMatch[0]}`;
      } else {
        cleanUnit = `1 ${cleanUnit}`;
      }
    }
    
    return {
      name: cleanName,
      brand: parsed.brand || "",
      unit: cleanUnit,
      category: parsed.category || "",
      description: parsed.description || "",
      sku: parsed.sku || "",
      mrp: typeof parsed.mrp === "number" ? String(parsed.mrp) : (parsed.mrp || ""),
      sellingPrice: typeof parsed.sellingPrice === "number" ? String(parsed.sellingPrice) : (parsed.sellingPrice || ""),
      hsn: parsed.hsn || "",
      gst: parsed.gst || null,
      variant: parsed.variant || "",
      source: "flyp-magic",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95
    };
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    if (error.response) {
      console.error("Gemini Response:", error.response.data);
    }
    throw error;
  }
}

/**
 * Hybrid AI call with Gemini primary and ChatGPT fallback
 * Uses the new HybridAI system for better accuracy and reliability
 */
async function callHybridAI(imageBase64, textContext) {
  // Try Gemini first (direct call with Firebase secrets)
  try {
    console.log("🚀 Starting Gemini direct product identification...");
    const result = await callGeminiDirect(imageBase64, textContext);
    console.log(`✅ Gemini Success:`, {
      name: result.name,
      brand: result.brand,
      category: result.category,
      description: result.description ? result.description.substring(0, 50) + "..." : ""
    });
    return result;
  } catch (geminiError) {
    console.warn("⚠️ Gemini direct failed, trying HybridAI fallback:", geminiError.message);
    
    // Fallback to HybridAI
    const hybridAI = new HybridAI();
    try {
      const result = await hybridAI.identifyProduct(imageBase64, textContext);
      const product = result.primary || result.fallback;
      if (product) {
        console.log(`✅ HybridAI Success using ${result.used}`);
        return product;
      }
    } catch (hybridError) {
      console.error("❌ HybridAI fallback also failed:", hybridError.message);
    }
    
    throw geminiError;
  }
}

module.exports = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [GEMINI_API_KEY_SECRET],
  },
  (req, res) => {
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

      const aiResult = await callHybridAI(imageContent, textContext);

      if (!aiResult || (!aiResult.name && !aiResult.productName)) {
        return res.status(200).json({ ok: false, success: false, message: "AI failed to identify the product." });
      }

      // Phase 3: Cleanup & canonicalization
      let best = {
        productName: aiResult.name || "",
        brand: aiResult.brand || "",
        variant: aiResult.variant || "",
        category: aiResult.category || "",
        unit: aiResult.unit || "",
        description: aiResult.description || "",
        code: aiResult.sku || scannedCode || "",
        mrp: aiResult.mrp || "",
        hsn: aiResult.hsn || "",
        gst: aiResult.gst !== undefined ? aiResult.gst : null,
        source: aiResult.source || "gemini-ai",
        confidence: aiResult.confidence || 0.9,
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
        description: best.description,
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
  }
);