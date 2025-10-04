// ---- OpenAI GPT JSON helper ----
/**
 * Call OpenAI chat API with a prompt and return strict JSON object.
 * @param {string} prompt
 * @returns {Promise<object|null>}
 */
async function callOpenAiJSON(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL_NORM || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model,
    messages: [
      { role: "system", content: "You are a retail product identification AI for Indian market. Given OCR text from a product photo, a detected brand (from logo), and several candidate titles from the web, return ONLY a strict JSON object in this exact schema (no markdown, no commentary):\\n{\\n  \"productName\": \"...\",\\n  \"brand\": \"...\",\\n  \"variant\": \"...\",\\n  \"category\": \"...\",\\n  \"unit\": \"...\",\\n  \"hsn\": \"\",\\n  \"gst\": null,\\n  \"mrp\": \"\",\\n  \"confidence\": \"high|medium|low\"\\n}\\nRules:\\n- productName should be short and canonical: Brand + Title (+ strength if applicable), no SEO tails, no \"Uses/Side Effects\" phrases.\\n- unit must include quantity and container if visible (e.g., \"750mg Tablet Strip\", \"200 ml Bottle\").\\n- If you are confident about HSN and GST, suggest them; if unsure, leave hsn empty string and gst null.\\n- Never include markdown or explanations, return JSON only." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2
  };
  let response;
  let retries = 2;
  while (retries > 0) {
    try {
      response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        timeout: 20000
      });
      break;
    } catch (apiError) {
      const status = apiError.response && apiError.response.status;
      if ((status === 429 || status === 503) && retries > 1) {
        retries--;
        await new Promise(r => setTimeout(r, 1200));
      } else {
        console.error("OpenAI API Request Failed:", apiError.message);
        return null;
      }
    }
  }
  let reply = "";
  try {
    reply =
      response &&
      response.data &&
      response.data.choices &&
      response.data.choices[0] &&
      response.data.choices[0].message &&
      response.data.choices[0].message.content
        ? response.data.choices[0].message.content.trim()
        : "";
  } catch (e) {
    console.error("Failed to extract OpenAI response text", e);
    return null;
  }
  // Remove code fences if present
  if (reply.startsWith("```")) {
    reply = reply.replace(/```(json|txt)?/gi, "").replace(/```/g, "").trim();
  }
  let parsed = null;
  try {
    parsed = JSON.parse(reply);
  } catch (e) {
    console.warn("Failed to parse OpenAI JSON response:", reply);
    return null;
  }
  return parsed;
}
require("dotenv").config();

const { onCall, onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const express = require("express");
const app = express();
app.use(express.json());
const admin = require("firebase-admin");
const vision = require("@google-cloud/vision");
const cors = require("cors");
const corsHandler = cors({ origin: true });

admin.initializeApp();

// ---------- Helper mappers for safe string payloads ----------
const s = (v) => (v == null ? "" : String(v));
const toProfilePayload = (uid, data) => ({
  retailerId: uid,
  retailerName: s(data.ownerName || data.businessName),
  retailerEmail: s(data.email),
  retailerPhone: s(data.phone),
  city: s(data.city || data.address),
  businessName: s(data.businessName),
  gstNumber: s(data.gstNumber),
  logoUrl: s(data.logoUrl),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const client = new vision.ImageAnnotatorClient();

const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({ region: "asia-south1", memory: "1GB", timeoutSeconds: 60 });

// Utility: lightweight title case for product/brand cleanup
function titleCase(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}

exports.ocrFromImage = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body." });
      }

      const [result] = await client.textDetection({ image: { content: imageBase64 } });
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return res.status(200).json({ products: [] });
      }

      const rawText = detections[0].description;
      const lines = rawText
        .split("\n")
        .map(line => line.trim().replace(/[•₹]/g, "").replace(/[-=]/g, " "))
        .filter(line => line && line.length > 2);

      const productRegex = /^(.+?)\s+(\d+)\s*(pcs|kg|ltr|g|ml|litres|packs|boxes)?\s*(₹?\d+)?$/i;

      const parsedProducts = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(productRegex);

        if (match) {
          const name = match[1].replace(/\s{2,}/g, " ").trim();
          const quantity = parseInt(match[2]);
          const unit = (match[3] || 'pcs').toLowerCase();
          const price = match[4] ? parseInt(match[4].replace(/[₹]/g, '')) : null;

          parsedProducts.push({ name, quantity, unit, price });
        } 
        // Handle multi-line fallback
        else if (
          i + 1 < lines.length &&
          /^\d+\s*(pcs|kg|ltr|g|ml|litres|packs|boxes)?\s*(₹?\d+)?$/i.test(lines[i + 1])
        ) {
          const name = line.replace(/\s{2,}/g, " ").trim();
          const qtyLine = lines[i + 1].trim();
          const qtyMatch = qtyLine.match(/^(\d+)\s*(pcs|kg|ltr|g|ml|litres|packs|boxes)?\s*(₹?\d+)?$/i);
          if (qtyMatch) {
            const quantity = parseInt(qtyMatch[1]);
            const unit = (qtyMatch[2] || 'pcs').toLowerCase();
            const price = qtyMatch[3] ? parseInt(qtyMatch[3].replace(/[₹]/g, '')) : null;

            parsedProducts.push({ name, quantity, unit, price });
            i++; // skip next line
          }
        }
      }

      return res.status(200).json({ products: parsedProducts });
    } catch (error) {
      console.error("OCR Error:", error);
      res.status(500).json({ error: "OCR processing failed." });
    }
  });
});

exports.createEmployee = onCall(async (request) => {
  const { name, email, password, role, phone, flypId } = request.data;
  const context = request.auth;

  if (!context || !context.uid) {
    throw new HttpsError("unauthenticated", "User not authenticated");
  }

  const retailerId = context.uid;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    await admin.firestore()
      .collection("businesses")
      .doc(retailerId)
      .collection("employees")
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        name,
        email,
        role,
        phone: phone || "",
        flypId: flypId || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("CreateEmployee Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.generateAssistantReply = onDocumentCreated("assistantQueries/{docId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const prompt = data && data.prompt;
  if (!prompt) return;

  try {
    const reply = "Assistant reply generation has been migrated to Gemini. Please update logic accordingly.";

    await event.data.ref.update({
      reply,
      replyTimestamp: new Date()
    });
  } catch (error) {
    console.error("OpenAI Reply Error:", error);
  }
});


const axios = require("axios");
const sharp = require("sharp");

// Feature flags to control enrichment strategies
const USE_GPT_ENRICH = (process.env.USE_GPT_ENRICH || "false").toLowerCase() === "true";  // GPT disabled by default
// ---------- External search providers ----------
const KG_API_KEY = process.env.GOOGLE_KG_API_KEY || "";
const CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const CSE_CX  = process.env.GOOGLE_CSE_CX  || "";

// OpenAI model controls
const OPENAI_MODEL_VISION = process.env.OPENAI_MODEL_VISION || process.env.OPENAI_MODEL || "gpt-4o"; // UPDATED to use full GPT-4o
const OPENAI_MODEL_NORM   = process.env.OPENAI_MODEL_NORM   || "gpt-4o"; // UPDATED to use full GPT-4o
// Only call GPT normalization if confidence is below this value
const GPT_NORM_CONF_THRESHOLD = Number(process.env.GPT_NORM_CONF_THRESHOLD || 0.75);

// Build a smart search query from OCR/vision signals
function buildSearchQuery({ brand = "", lines = [], size = "" }) {
  const tokens = [];
  if (brand) tokens.push(brand);
  // Pick top 3 informative lines (ignore generic container words)
  const informative = (lines || [])
    .filter(l => !/^\s*(plastic|glass|bottle|container|product|package|refill|net\s*wt)\b/i.test(l))
    .slice(0, 6);
  tokens.push(...informative.slice(0, 3));
  if (size) tokens.push(size);
  return tokens
    .map(t => String(t).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}


// Confidence scoring: brand match (0–0.4) + token overlap (0–0.4) + size match (0–0.2)
function scoreConfidence({ ocrText = "", brand = "", size = "" }, candidate) {
  const text = (ocrText || "").toLowerCase();
  const candTitle = (candidate.productName || "").toLowerCase();
  const candBrand = (candidate.brand || "").toLowerCase();
  const brandScore = brand && candBrand && candBrand.includes(brand.toLowerCase()) ? 0.4 : 0.0;
  // token overlap
  const textTokens = new Set(text.split(/[^a-z0-9]+/i).filter(t => t.length > 2));
  const candTokens = new Set(candTitle.split(/[^a-z0-9]+/i).filter(t => t.length > 2));
  let overlap = 0;
  candTokens.forEach(t => { if (textTokens.has(t)) overlap++; });
  const overlapScore = Math.min(0.4, (overlap / Math.max(4, candTokens.size)) * 0.4);
  // size match
  const sizeScore = (size && candidate.size && candidate.size.toLowerCase().includes(size.toLowerCase())) ? 0.2 : 0.0;
  return +(brandScore + overlapScore + sizeScore).toFixed(2);
}

/** ---------- Magic Scan Helpers: title clean, unit parsing, CSE bias, quick HSN/GST ---------- */
// Expanded whitelist of trusted commerce/brand domains
const HOST_WHITELIST = new Set([
  // Brand / Beauty
  "[www.bathandbodyworks.com](https://www.bathandbodyworks.com)","www.bathandbodyworks.in","[www.nykaa.com](https://www.nykaa.com)","[www.sephora.com](https://www.sephora.com)","[www.ulta.com](https://www.ulta.com)",
  // Indian pharmacy / beauty
  "[www.1mg.com](https://www.1mg.com)","pharmeasy.in","[www.netmeds.com](https://www.netmeds.com)","[www.apollo247.com](https://www.apollo247.com)","[www.medplusmart.com](https://www.medplusmart.com)",
  // Grocery / quick commerce
  "[www.bigbasket.com](https://www.bigbasket.com)","[www.blinkit.com](https://www.blinkit.com)","www.dmart.in","[www.instamart.com](https://www.instamart.com)","www.spencers.in","www.reliancesmart.in",
  // Marketplaces / retail
  "www.amazon.in","[www.amazon.com](https://www.amazon.com)","[www.flipkart.com](https://www.flipkart.com)","[www.walmart.com](https://www.walmart.com)","[www.target.com](https://www.target.com)","[www.kroger.com](https://www.kroger.com)"
]);

// NEW: stronger title cleaner
function cleanTitle(t = "") {
  let x = String(t || "")
    .replace(/&amp;/gi, "&")
    .replace(/[™®©]/g, "")
    // Kill common medical-page phrases (1mg/PharmEasy etc.)
    .replace(/\b(View\s*)?(Uses?|Side\s*Effects?|Price\s*(And)?\s*Substitutes?|Substitutes?)\b.*$/gi, "")
    // Drop everything after " | ... "
    .replace(/\s*\|\s*.*$/g, "")
    // Kill classic marketing suffixes after dash or en/em dash
    .replace(/\s*[-–—]\s*(Buy\s*Online|Buy|Shop\s*Online|Shop|Online|Best\s*Price|Price\s*in\s*India|With.*|at.*|Offers?.*|Deals?.*|Reviews?|Ratings?)\b.*$/gi, "")
    // Remove trailing marketing suffixes even without dash
    .replace(/\b(Online|at\s+\w+.*|Price\s*in\s*India|Best\s*Price|With\s+.*|Offers?.*|Deals?.*|Reviews?|Ratings?)\b.*$/gi, "")
    // Remove leading "Order/Buy/Shop"
    .replace(/^\s*(Order|Buy|Shop)\s+/i, "")
    // Remove marketplace/site mentions and any tail after them
    .replace(/\b(Amazon(\.in)?|Flipkart|JioMart|Meesho|BigBasket|Nykaa|Pharm?easy|1mg|Dmart|Reliance\s*Smart|Spencers)\b.*$/ig, "")
    // Collapse spaces
    .replace(/\s+/g, " ")
    .trim();

  // Smart Title Case but keep short acronyms fully uppercased
  const keepCaps = (w) => w.length <= 4 && /^[A-Z0-9]+$/.test(w);
  x = x
    .split(" ")
    .map(w => keepCaps(w) ? w : (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");

  // Prefer trimming right after a complete size phrase (drops SEO tails we missed)
  const sizeCut = x.match(/(.+?\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|tablets?|capsules?)\b(?:\s*(?:bottle|jar|tube|strip|sachet|box|pouch|can|carton|pack))?)/i);
  if (sizeCut) x = sizeCut[1].trim();

  // As a last resort, cut at dash/pipe/bullet if still very long
  if (x.length > 90) x = x.split(/[-–—|•]/)[0].trim();

  return x;
}

// Helper: filter out medical-page junk titles
function isMedicalJunk(t = "") {
  return /(uses?|side\s*effects?|substitutes?)/i.test(String(t));
}

// NEW: canonical naming (Brand + Title [+ Size])
function canonicalizeName(brand = "", title = "") {
  let b = String(brand || "").trim();
  let t = String(title || "").trim();

  // Remove duplicated brand at start of title
  if (b) {
    const reBrand = new RegExp("^" + b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+", "i");
    t = t.replace(reBrand, "");
  }

  // Collapse spaces
  t = t.replace(/\s+/g, " ").trim();

  // Compose: Brand + Title (keep brand in title case)
  let out = (b ? `${titleCase(b)} ` : "") + t;

  // If a size phrase exists, trim after it
  const m = out.match(/(.+?\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|tablets?|capsules?)\b(?:\s*(?:bottle|jar|tube|strip|sachet|box|pouch|can|carton|pack))?)/i);
  if (m) out = m[1].trim();

  // Final fallback shorten
  if (out.length > 90) out = out.split(/[-–—|•]/)[0].trim();

  return out;
}

function parseCanonicalUnit(text = "", fallbackContainer = "") {
  const s = String(text || "").replace(/\s+/g, " ");
  // 2x200ml, 6 x 75 g
  const multi = s.match(/\b(\d{1,2})\s*[xX]\s*(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs|tablets?|capsules?)\b/i);
  if (multi) {
    const count = multi[1], qty = multi[2], u = multi[3].toLowerCase();
    const unit = (u === "l") ? "L" : (u === "kg" ? "kg" : u);
    return `${count} x ${qty} ${unit}`;
  }
  const single = s.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs|tablets?|capsules?)\b/i);
  let qtyPart = "";
  if (single) {
    let n = single[1], u = single[2].toLowerCase();
    u = (u === "l") ? "L" : (u === "tablets" ? "tablets" : u);
    qtyPart = `${n} ${u}`;
  }
  const cont = (s.match(/\b(bottle|jar|tube|strip|sachet|box|pouch|can|carton|pack)\b/i)?.[1] || fallbackContainer || "").toLowerCase();
  return [qtyPart, cont].filter(Boolean).join(" ").trim();
}

// --- Fast perceptual hash (aHash) for near-duplicate matching and reuse ---
async function computeAHash(buf){
  try{
    const img = await sharp(buf).resize(8,8, { fit: 'fill' }).greyscale().raw().toBuffer();
    const mean = img.reduce((a,b)=>a+b,0)/img.length;
    let bits = "";
    for (const v of img) bits += v > mean ? "1":"0";
    // convert to hex
    return bits.match(/.{1,4}/g).map(n=>parseInt(n,2).toString(16)).join("");
  }catch(e){
    console.warn("aHash failed:", e?.message || e);
    return "";
  }
}

function biasQuery(q) {
  const allow = [
    "site:bathandbodyworks.com","site:bathandbodyworks.in","site:nykaa.com","site:sephora.com","site:ulta.com",
    "site:1mg.com","site:pharmeasy.in","site:netmeds.com","site:apollo247.com","site:medplusmart.com",
    "site:bigbasket.com","site:blinkit.com","site:dmart.in","site:instamart.com","site:spencers.in","site:reliancesmart.in",
    "site:amazon.in","site:amazon.com","site:flipkart.com","site:walmart.com","site:target.com","site:kroger.com"
  ].join(" OR ");
  return `${q} (${allow})`;
}

function quickHsnGst(name = "", cat = "") {
  const t = `${name} ${cat}`.toLowerCase();
  const hit = (re) => re.test(t);
  if (hit(/\b(shampoo|lotion|cream|cosmetic|serum|makeup|lipstick|kajal)\b/)) return {hsn:"3304", gst:18};
  if (hit(/\b(soap|detergent|handwash)\b/)) return {hsn:"3401", gst:18};
  if (hit(/\b(ors|rehydration|oral rehydration)\b/)) return {hsn:"3004", gst:5};
  if (hit(/\b(tablets?|capsules?|syrup|medic(ine|ament)|ointment)\b/)) return {hsn:"3004", gst:12};
  if (hit(/\b(protein|nutrition|nutraceutical|health mix|meal replacement)\b/)) return {hsn:"2106", gst:18};
  if (hit(/\b(juice|drink|beverage|electrolyte|isotonic)\b/)) return {hsn:"2202", gst:12};
  return null;
}

// Google Knowledge Graph API enrichment
async function fetchKGEntities(query) {
  if (!KG_API_KEY || !query) return null;
  try {
    const r = await axios.get("[https://kgsearch.googleapis.com/v1/entities:search](https://kgsearch.googleapis.com/v1/entities:search)", {
      params: { query, key: KG_API_KEY, limit: 5, indent: true },
      timeout: 8000
    });
    const data = r.data || {};
    const items = Array.isArray(data.itemListElement) ? data.itemListElement : [];
    if (!items.length) return null;

    // Prefer Product, then Brand, then Thing
    function pick(items, type) {
      return items.find(it => {
        const types = it?.result?.["@type"];
        return Array.isArray(types) ? types.includes(type) : types === type;
      });
    }
    let chosen = pick(items, "Product") || pick(items, "Brand") || items[0];

    const res = chosen?.result || {};
    const name = res.name || "";
    const description = res.description || "";
    const articleBody = res?.detailedDescription?.articleBody || "";
    const imageUrl = res?.image?.contentUrl || "";

    // naive size and brand guesses from name/description
    const mSize = (name && name.match(/\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|pack|tablets|capsules)\b/i))
               || (description && description.match(/\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|pack|tablets|capsules)\b/i))
               || (articleBody && articleBody.match(/\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|pack|tablets|capsules)\b/i));
    const size = mSize ? mSize[0] : "";

    // very light category guess
    let category = "";
    const types = res["@type"];
    const cats = Array.isArray(types) ? types : (types ? [types] : []);
    if (cats.length) {
      category = String(cats.find(t => typeof t === "string" && t !== "Thing") || "");
      category = category.replace(/Product$/i, "").replace(/Brand$/i, "").trim();
    }

    // brand guess from result name (best effort only)
    let brand = "";
    if (cats.includes("Brand")) {
      brand = name;
    }

    return {
      productName: cleanTitle(name),
      brand,
      category,
      size,
      imageUrl,
      description: articleBody || description,
      source: "google-kg"
    };
  } catch (e) {
    console.warn("[KG] fetch failed:", e.message || e);
    return null;
  }
}

// ---- Google Custom Search (CSE) + OG helpers ----
async function fetchCSE(query, num = 3) {
  try {
    if (!CSE_KEY || !CSE_CX) return [];
    const url = "[https://www.googleapis.com/customsearch/v1](https://www.googleapis.com/customsearch/v1)";
    const r = await axios.get(url, {
      params: { key: CSE_KEY, cx: CSE_CX, q: query, num }
    });
    return (r.data.items || []).map(it => ({
      title: it.title,
      link: it.link,
      snippet: it.snippet,
      og: it.pagemap || {}
    }));
  } catch (e) {
    console.warn("[CSE] fetch failed:", e.message || e);
    return [];
  }
}

async function fetchOG(url) {
  try {
    const r = await axios.get(url, { timeout: 6000 });
    const html = r.data || "";
    const meta = {};
    const re = /<meta[^>]+(property|name)=[\"']([^\"']+)[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      meta[m[2]] = m[3];
    }
    return meta;
  } catch {
    return {};
  }
}

// ---------- Barcode → Product metadata lookup (cache + multi-provider) ----------
exports.lookupBarcode = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    // Preflight
    if (req.method === "OPTIONS") return res.status(204).send("");
    try {
      const code =
        (req.body && req.body.code && String(req.body.code).trim()) ||
        (req.query && req.query.code && String(req.query.code).trim()) ||
        "";
      if (!code) {
        return res.status(400).json({ ok: false, error: "Missing 'code' in body or query" });
      }

      const db = admin.firestore();
      const docRef = db.collection("globalBarcodes").doc(code);

      // 1) Firestore cache first
      const snap = await docRef.get();
      if (snap.exists) {
        return res.status(200).json({ ok: true, source: "cache", data: snap.data() });
      }

      // Helper: get server timestamp
      const fetchedAt = admin.firestore.FieldValue.serverTimestamp();

      // Helper: normalize output
      function normalize({
        code,
        productName = "",
        brand = "",
        category = "",
        size = "",
        imageUrl = "",
        source = "",
        confidence = 0.7,
        fetchedAt,
        description = ""
      }) {
        return {
          code,
          productName: cleanTitle(productName),
          brand,
          category,
          size,
          imageUrl,
          source,
          confidence,
          fetchedAt,
          description
        };
      }

      let data = null;
      let provider = "";
      let confidence = 0.7;

      // 2) Provider: OpenFoodFacts (free, no API key)
      try {
        const api = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
        const r = await axios.get(api, { timeout: 8000 });
        const j = r.data;
        if (j && j.status === 1 && j.product) {
          const p = j.product;
          data = normalize({
            code,
            productName: p.product_name || p.generic_name || "",
            brand: (p.brands ? String(p.brands).split(",")[0] : "").trim(),
            category:
              (Array.isArray(p.categories_tags) && p.categories_tags.length
                ? String(p.categories_tags[0]).replace(/^..:/, "")
                : ""),
            size: p.quantity || "",
            imageUrl: p.image_front_small_url || p.image_url || "",
            source: "openfoodfacts",
            confidence: 0.7,
            fetchedAt
          });
          provider = "openfoodfacts";
          confidence = 0.7;
        }
      } catch (err) {
        // Continue to next provider
      }

      // 3) Provider: Digit-Eyes (requires API key)
      if (!data && process.env.DIGITEYES_APP_ID && process.env.DIGITEYES_AUTH_KEY) {
        try {
          const appId = encodeURIComponent(process.env.DIGITEYES_APP_ID);
          const signature = encodeURIComponent(process.env.DIGITEYES_AUTH_KEY);
          const api = `https://www.digit-eyes.com/gtin/v2_0/?upc=${encodeURIComponent(code)}&appid=${appId}&signature=${signature}&language=en`;
          console.log(`[Digit-Eyes] Requesting URL: ${api}`);
          const r = await axios.get(api, { timeout: 8000 });
          const j = r.data;
          // If no error field, treat as found
          if (j && !j.error) {
            data = normalize({
              code,
              productName: j.description || "",
              brand: j.brand || "",
              category: j.category || "",
              size: j.size || "",
              imageUrl: j.image || "",
              source: "digit-eyes",
              confidence: 0.72,
              fetchedAt,
              description: j.descriptionLong || j.description || j.manufacturer || ""
            });
            provider = "digit-eyes";
            confidence = 0.72;
          }
        } catch (err) {
          if (err.response && err.response.data) {
            console.error("[Digit-Eyes] Error response:", err.response.data);
          } else {
            console.error("[Digit-Eyes] Error:", err.message || err);
          }
          // Continue to next provider
        }
      }

      if (!data) {
        // Not found in any provider
        return res.status(200).json({ ok: false, reason: "NOT_FOUND" });
      }

      // Save to Firestore cache
      try {
        await docRef.set(data, { merge: true });
      } catch (err) {
        // Ignore cache error
      }

      return res.status(200).json({ ok: true, source: data.source, data });
    } catch (e) {
      console.error("lookupBarcode error:", e);
      return res.status(500).json({ ok: false, error: e.message || "Lookup failed" });
    }
  });
});

exports.employeeLogin = onCall(async (request) => {
  const { flypId, phone, password } = request.data;

  if (!flypId || !phone || !password) {
    throw new HttpsError("invalid-argument", "Missing fields");
  }

  const db = admin.firestore();
  let employeeDoc = null;
  let employeeData = null;
  let retailerId = null;

  const businessesSnapshot = await db.collection("businesses").get();

  for (const businessDoc of businessesSnapshot.docs) {
    const employeesRef = businessDoc.ref.collection("employees");
    const employeeSnapshot = await employeesRef
      .where("flypId", "==", flypId)
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (!employeeSnapshot.empty) {
      employeeDoc = employeeSnapshot.docs[0];
      employeeData = employeeDoc.data();
      retailerId = businessDoc.id;
      break;
    }
  }

  if (!employeeData) {
    throw new HttpsError("not-found", "Employee not found");
  }

  if (employeeData.password !== password) {
    throw new HttpsError("unauthenticated", "Incorrect password");
  }

  return {
    success: true,
    employeeId: employeeData.uid,
    name: employeeData.name,
    role: employeeData.role,
    retailerId,
  };
});

// AI Inventory generation from a single brand (region: us-central1, 1GiB, 120s)
exports.generateInventoryByBrand = onRequest({ region: "us-central1", memory: "1GiB", timeoutSeconds: 120 }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { prompt, brand, brandName, category, knownTypes, quantity, description } = req.body || {};

      let requestedQty = Number(quantity) || 10;
      if (requestedQty < 6) requestedQty = 6;
      if (requestedQty > 50) requestedQty = 50;

      let userPrompt = prompt;
      if (!userPrompt) {
        userPrompt = `
Generate ${requestedQty} products for this brand.
Brand: ${brand || brandName || ""}
Category: ${category || ""}
Known Types: ${knownTypes || "all"}
Description: ${description || ""}
`.trim();
      }

      // ---- OpenAI: extended table with HSN / GST / Pricing Mode / Base / MRP ----
      const openaiApiKey = process.env.OPENAI_API_KEY;
      const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
      if (!openaiApiKey) {
        console.error("Missing OPENAI_API_KEY");
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      const systemPrompt = `You are an expert inventory assistant for Indian retail.
Return ONLY a markdown table with the exact header:
| Product Name | Brand | Category | SKU | Unit | HSN | GST (%) | Pricing Mode | Base Price | MRP | Cost |

Rules:
- GST (%) must be one of: 0, 5, 12, 18, 28.
- Pricing Mode must be either "MRP_INCLUSIVE" or "BASE_PLUS_GST".
- If Pricing Mode = MRP_INCLUSIVE and MRP is given but Base Price missing → leave Base Price blank (system computes).
- If Pricing Mode = BASE_PLUS_GST and Base Price is given but MRP missing → leave MRP blank (system computes).
- Unit must include quantity + container (e.g., "100ml Bottle", "250g Jar", "1kg Pack", "50ml Tube").
- HSN must be a realistic Indian HSN (4–8 digits). If unsure, best guess.
- Cost is optional (approx market-estimate or blank).
- Output ONLY the table. No notes, no code fences.`;

      const userMsg = `Make a product list for this prompt and output exactly the table described:
${userPrompt}`;

      const endpoint = "[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)";
      const payload = {
        model: openaiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg }
        ],
        temperature: 0.3
      };

      let response;
      let retries = 2;
      while (retries > 0) {
        try {
          response = await axios.post(endpoint, payload, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiApiKey}`
            },
            timeout: 20000
          });
          break; // success
        } catch (apiError) {
          const status = apiError.response && apiError.response.status;
          if ((status === 429 || status === 503) && retries > 1) {
            console.warn(`${status} from OpenAI, retrying...`);
            retries--;
            await new Promise(r => setTimeout(r, 1200));
          } else {
            console.error("OpenAI API Request Failed:", apiError.message);
            return res.status(500).json({ error: "OpenAI API Request Failed", details: apiError.message });
          }
        }
      }

      let rawText = "";
      try {
        rawText =
          response &&
          response.data &&
          response.data.choices &&
          response.data.choices[0] &&
          response.data.choices[0].message &&
          response.data.choices[0].message.content
            ? response.data.choices[0].message.content.trim()
            : "";

        // Strip code fences if any
        if (rawText.startsWith("```")) {
          rawText = rawText.replace(/```(markdown|md|table|json)?/gi, "").replace(/```/g, "").trim();
        }

        // Extended header detection
        const headerRegex = /\|\s*Product\s*Name\s*\|\s*Brand\s*\|\s*Category\s*\|\s*SKU\s*\|\s*Unit\s*\|\s*HSN\s*\|\s*GST\s*\(%\)\s*\|\s*Pricing\s*Mode\s*\|\s*Base\s*Price\s*\|\s*MRP\s*\|\s*Cost\s*\|/i;

        // JSON fallback if the model returns JSON (rare)
        if (!headerRegex.test(rawText)) {
          let jsonParsed = null;
          try { jsonParsed = JSON.parse(rawText); } catch {}
          if (!Array.isArray(jsonParsed)) {
            const m = rawText.match(/$begin:math:display$\\s*\\{[\\s\\S]*?\\}\\s*$end:math:display$/);
            if (m) { try { jsonParsed = JSON.parse(m[0]); } catch {} }
          }
          if (Array.isArray(jsonParsed)) {
            const rows = jsonParsed.map(it => {
              const productName = it.productName || it.name || "";
              const brandVal    = it.brand || "";
              const categoryVal = it.category || "";
              const sku         = it.sku || it.SKU || "";
              const unit        = it.unit || it.Unit || "";
              const hsnCode     = it.hsnCode || it.hsn || it.HSN || "";
              const gstRate     = it.gstRate ?? it.gst ?? it.GST ?? "";
              const pricingMode = it.pricingMode || it.PricingMode || "MRP_INCLUSIVE";
              const basePrice   = it.basePrice ?? "";
              const mrp         = it.mrp ?? "";
              const costPrice   = it.costPrice ?? it.cost ?? "";
              return `| ${productName} | ${brandVal} | ${categoryVal} | ${sku} | ${unit} | ${hsnCode} | ${gstRate} | ${pricingMode} | ${basePrice} | ${mrp} | ${costPrice} |`;
            });
            rawText = [
              "| Product Name | Brand | Category | SKU | Unit | HSN | GST (%) | Pricing Mode | Base Price | MRP | Cost |",
              "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
              ...rows
            ].join("\n");
          }
        }

        if (!headerRegex.test(rawText)) {
          console.error("OpenAI response did not contain a valid extended table header");
          return res.status(500).json({ error: "No valid inventory table found" });
        }
      } catch (e) {
        console.error("Error extracting OpenAI response text", e);
        return res.status(500).json({ error: "Error extracting OpenAI response" });
      }

      // ---- Helpers for normalization ----
      function toNum(v){
        if (v === null || v === undefined || v === '') return null;
        const n = Number(String(v).toString().replace(/[^\d.]/g, ''));
        return Number.isFinite(n) ? n : null;
      }
      const GST_ALLOWED = [0,5,12,18,28];
      function clampGstRate(rate){
        const n = toNum(rate) ?? 0;
        if (GST_ALLOWED.includes(n)) return n;
        // snap to nearest
        let best = 0, d = Infinity;
        for (const r of GST_ALLOWED){
          const dd = Math.abs(r - n);
          if (dd < d){ d = dd; best = r; }
        }
        return best;
      }
      function compute(base){
        const gstRate = clampGstRate(base.gstRate);
        const mode = base.pricingMode === 'BASE_PLUS_GST' ? 'BASE_PLUS_GST' : 'MRP_INCLUSIVE';
        let basePrice = toNum(base.basePrice);
        let mrp = toNum(base.mrp);
        if (mode === 'MRP_INCLUSIVE'){
          if (mrp != null && basePrice == null){ basePrice = +(mrp / (1 + gstRate/100)).toFixed(2); }
          else if (mrp == null && basePrice != null){ mrp = +(basePrice * (1 + gstRate/100)).toFixed(2); }
        } else {
          if (basePrice != null && mrp == null){ mrp = +(basePrice * (1 + gstRate/100)).toFixed(2); }
          else if (basePrice == null && mrp != null){ basePrice = +(mrp / (1 + gstRate/100)).toFixed(2); }
        }
        const taxAmount = (mrp != null && basePrice != null) ? +(mrp - basePrice).toFixed(2) : null;
        return { gstRate, pricingMode: mode, basePrice, mrp, taxAmount };
      }

      // ---- Parse the table into rows ----
      const tableStartIndex = rawText.indexOf("| Product Name");
      const table = tableStartIndex !== -1 ? rawText.slice(tableStartIndex).trim() : "";
      const lines = table
        .split("\n")
        .filter(line =>
          line.includes("|") &&
          !/^[-|]+$/.test(line) &&
          !(line.toLowerCase().startsWith("| product name"))
        );

      const inventoryList = lines.map(line => {
        const parts = line
          .replace(/^\|/, "")           // remove leading |
          .replace(/\|$/, "")           // remove trailing |
          .split("|")
          .map(p => p.trim().replace(/\*.*?\*/g, ""));

        if (parts.length < 11) return null;
        if (parts.some(p => p.includes("*"))) return null; // skip corrupted rows

        // Columns: | Product Name | Brand | Category | SKU | Unit | HSN | GST (%) | Pricing Mode | Base Price | MRP | Cost |
        const base = {
          productName: parts[0] || "",
          brand: parts[1] || "",
          category: parts[2] || "General",
          sku: parts[3] || "",
          unit: parts[4] || "",
          hsnCode: parts[5] || "",
          gstRate: parts[6] || "",
          pricingMode: parts[7] || "MRP_INCLUSIVE",
          basePrice: parts[8] || "",
          mrp: parts[9] || "",
          costPrice: parts[10] || "",
          imageUrl: "",
        };
        const computed = compute(base);
        return {
          ...base,
          ...computed,
          // keep sellingPrice aligned to MRP for UI compatibility
          price: computed.mrp ?? null,
          sellingPrice: computed.mrp ?? null,
        };
      }).filter(item => item && item.productName && item.sku);

      if (inventoryList.length === 0) {
        return res.status(200).json({ inventory: [], message: "No clean rows parsed" });
      }

      return res.status(200).json({ inventory: inventoryList });
    } catch (error) {
      console.error("generateInventoryByBrand Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Parse Invoice File via OCR + Gemini
exports.parseInvoiceFile = onRequest({ region: "us-central1" }, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { fileUrl } = req.body;
      if (!fileUrl || typeof fileUrl !== "string") {
        return res.status(400).json({ error: "Missing or invalid fileUrl" });
      }

      // Download image as buffer
      const imageResponse = await axios.get(fileUrl, { responseType: "arraybuffer" });
      const imageBase64 = Buffer.from(imageResponse.data, "binary").toString("base64");

      // OCR using Google Vision
      const [result] = await client.textDetection({ image: { content: imageBase64 } });
      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return res.status(200).json({ message: "No text found", structuredInvoice: {} });
      }

      const rawText = detections[0].description;

      const geminiPrompt = `
You are an invoice extraction AI. Output only a strict JSON object. No markdown, no extra commentary. Use this format:

{
  "customerName": "...",
  "customerPhone": "...",
  "invoiceDate": "...",
  "productList": [
    {
      "name": "...",
      "quantity": ...,
      "unit": "...",
      "price": ...
    }
  ],
  "subtotal": ...,
  "tax": ...,
  "total": ...
}

Raw OCR Text:
"""
${rawText}
"""`;

      const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent",
        {
          contents: [{ parts: [{ text: geminiPrompt }] }],
        },
        {
          headers: { "Content-Type": "application/json" },
          params: { key: process.env.GEMINI_API_KEY },
        }
      );

      let reply = "";
      const candidates = response.data && response.data.candidates;
      if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts.length > 0) {
        reply = candidates[0].content.parts[0].text.trim();
        if (reply.startsWith("```")) {
          reply = reply.replace(/```(json|txt)?/gi, "").replace(/```/g, "").trim();
        }
        console.log("🧾 Cleaned Gemini reply:\n", reply);
      }

      // Try to parse reply to JSON
      let structuredInvoice = {};
      try {
        structuredInvoice = JSON.parse(reply);
      } catch (e) {
        console.warn("❌ Failed to parse Gemini response:", reply);
        structuredInvoice = { error: true, rawText, rawReply: reply };
      }

      return res.status(200).json({ structuredInvoice });
    } catch (error) {
      console.error("parseInvoiceFile Error:", error.message);
      return res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });
});
// Legacy alias for backward compatibility
exports.parse = exports.parseInvoiceFile;

// Generate HSN and GST using OpenAI Chat API
exports.generateHSNAndGST = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    // Early return for preflight
    if (req.method === 'OPTIONS') { return res.status(204).send(''); }
    try {
      const { productName, brand, category, unit } = req.body;
      if (!productName) {
        return res.status(400).json({ error: "Missing productName in request body." });
      }

      // Compose system and user messages
      const systemPrompt = `You are a GST and HSN classification expert for Indian products. Given product details, respond ONLY with a strict JSON object in this format:
{
  "hsn": "...",
  "gst": ...,
  "confidence": "...",
  "reference": "..."
}
No markdown, no commentary, no explanations. If unsure, make your best guess and mention so in confidence.`;
      const userPrompt = `Product Name: ${productName}
Brand: ${brand || ""}
Category: ${category || ""}
Unit: ${unit || ""}`;

      const openaiApiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      if (!openaiApiKey) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }
      const endpoint = "[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)";
      const payload = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      };

      let response;
      let retries = 2;
      let lastError;
      while (retries > 0) {
        try {
          response = await axios.post(endpoint, payload, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiApiKey}`,
            },
            timeout: 18000,
          });
          break; // success
        } catch (apiError) {
          lastError = apiError;
          const status = apiError.response && apiError.response.status;
          if ((status === 429 || status === 503) && retries > 1) {
            console.warn(`${status} error from OpenAI, retrying...`);
            retries--;
            await new Promise(r => setTimeout(r, 1200));
          } else {
            console.error("OpenAI API Request Failed:", apiError.message);
            return res.status(500).json({ error: "OpenAI API Request Failed", details: apiError.message });
          }
        }
      }

      let reply = "";
      try {
        reply =
          response &&
          response.data &&
          response.data.choices &&
          response.data.choices[0] &&
          response.data.choices[0].message &&
          response.data.choices[0].message.content
            ? response.data.choices[0].message.content.trim()
            : "";
      } catch (e) {
        console.error("Failed to extract OpenAI response text", e);
        return res.status(500).json({ error: "Failed to extract OpenAI response" });
      }
      // Remove code fences if present
      if (reply.startsWith("```")) {
        reply = reply.replace(/```(json|txt)?/gi, "").replace(/```/g, "").trim();
      }
      let parsed = {};
      try {
        parsed = JSON.parse(reply);
      } catch (e) {
        console.warn("Failed to parse OpenAI HSN/GST response:", reply);
        parsed = { error: true, rawReply: reply };
      }
      // Guard against missing fields and provide safe defaults
      const out = {
        hsn: typeof parsed.hsn === 'string' ? parsed.hsn : '',
        gst: parsed.gst !== undefined && parsed.gst !== null ? parsed.gst : '',
        confidence: typeof parsed.confidence === 'string' ? parsed.confidence : 'low',
        reference: typeof parsed.reference === 'string' ? parsed.reference : ''
      };
      return res.status(200).json(out);
    } catch (err) {
      console.error("generateHSNAndGST Error:", err);
      return res.status(500).json({ error: "Internal server error", details: err.message });
    }
  });
});

// ---------- Profile → Connected Distributors fan-out (server-side, idempotent) ----------
const PROFILE_FIELDS_TO_WATCH = [
  "ownerName","businessName","email","phone","city","address","gstNumber","logoUrl"
];

exports.syncRetailerProfileToDistributors = onDocumentUpdated("businesses/{retailerUid}", async (event) => {
  const retailerUid = event.params.retailerUid;
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};

  // Exit early if no relevant field changed
  const changed = PROFILE_FIELDS_TO_WATCH.some(
    (k) => (before[k] || "") !== (after[k] || "")
  );
  if (!changed) return;

  const db = admin.firestore();

  // Read accepted connections owned by this retailer
  const connsSnap = await db
    .collection("businesses")
    .doc(retailerUid)
    .collection("connectedDistributors")
    .where("status", "==", "accepted")
    .get();

  if (connsSnap.empty) return;

  const payload = toProfilePayload(retailerUid, after);

  // Batch in safe chunks under 500
  const refs = connsSnap.docs.map((d) =>
    db.doc(`businesses/${d.id}/connectedRetailers/${retailerUid}`)
  );

  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch();
    refs.slice(i, i + 450).forEach((ref) => {
      batch.set(ref, payload, { merge: true });
    });
    await batch.commit();
  }

  // --- NEW: Update all connectedRetailers/{retailerUid} in all distributors ---
  try {
    const connectedRetailersSnapshots = await db
      .collectionGroup('connectedRetailers')
      .where('retailerId', '==', retailerUid)
      .get();

    const updatedData = {
      retailerName: after.ownerName || after.businessName || '',
      retailerEmail: after.email || '',
      retailerPhone: after.phone || '',
      businessName: after.businessName || '',
      gstNumber: after.gstNumber || '',
      logoUrl: after.logoUrl || '',
      city: after.city || after.address || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await Promise.all(
      connectedRetailersSnapshots.docs.map(doc =>
        doc.ref.update(updatedData)
      )
    );
  } catch (err) {
    console.error("Error updating all connectedRetailers with latest retailer info:", err);
  }
});

// ---------- Callable: Manual resync for legacy/backfill ----------
exports.resyncRetailerProfile = onCall(async (request) => {
  const context = request.auth;
  if (!context || !context.uid) {
    throw new HttpsError("unauthenticated", "Login required");
  }
  const uid = context.uid;
  const db = admin.firestore();

  // Load current profile
  const profileSnap = await db.doc(`businesses/${uid}`).get();
  if (!profileSnap.exists) {
    throw new HttpsError("not-found", "Profile document not found");
  }

  const payload = toProfilePayload(uid, profileSnap.data());

  // Load accepted distributor connections
  const connsSnap = await db
    .collection("businesses")
    .doc(uid)
    .collection("connectedDistributors")
    .where("status", "==", "accepted")
    .get();

  if (connsSnap.empty) return { updated: 0 };

  const refs = connsSnap.docs.map((d) =>
    db.doc(`businesses/${d.id}/connectedRetailers/${uid}`)
  );

  let updated = 0;
  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch();
    refs.slice(i, i + 450).forEach((ref) => {
      batch.set(ref, payload, { merge: true });
      updated++;
    });
    await batch.commit();
  }

  // --- NEW: Update all connectedRetailers/{retailerUid} in all distributors ---
  try {
    const connectedRetailersSnapshots = await db
      .collectionGroup('connectedRetailers')
      .where('retailerId', '==', uid)
      .get();

    const updatedData = {
      retailerName: payload.retailerName || '',
      retailerEmail: payload.retailerEmail || '',
      retailerPhone: payload.retailerPhone || '',
      businessName: payload.businessName || '',
      gstNumber: payload.gstNumber || '',
      logoUrl: payload.logoUrl || '',
      city: payload.city || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await Promise.all(
      connectedRetailersSnapshots.docs.map(doc =>
        doc.ref.update(updatedData)
      )
    );
  } catch (err) {
    console.error("Error updating all connectedRetailers with latest retailer info:", err);
  }

  return { updated };
});

// =================================================================================================
// ===== NEW, REWRITTEN identifyProductFromImage FOR MAX ACCURACY =====
// =================================================================================================
/**
 * NEW: Calls OpenAI's GPT-4o multimodal model for product identification.
 * This is a streamlined helper function for the main logic.
 */
async function callMultimodalAI(imageBase64, textContext) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY for multimodal call.");
    return null;
  }

  const model = "gpt-4o"; // Using the full, most capable model
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const systemPrompt = `You are an expert product identification AI for the Indian retail market. Analyze the product image and the provided text context. Return ONLY a strict JSON object with this exact schema: { "name": "...", "brand": "...", "unit": "...", "category": "...", "sku": "...", "mrp": "...", "hsn": "...", "gst": null }.
Rules:
- 'name' should be the canonical product name.
- 'unit' must include quantity and container (e.g., "250 ml Bottle").
- 'sku' should be the barcode if available.
- 'mrp' is the Maximum Retail Price. If "MRP" is explicitly written, use that value. If not, use any other visible selling price. Extract only the numeric value (e.g., for "MRP ₹120.00", return "120"). If no price is visible, leave it as an empty string.
- Guess HSN/GST if confident, otherwise leave as empty string or null.
- Be brief and accurate. No commentary or markdown.`;

  const userPrompt = `Identify the product in the image using this context:
${textContext}`;

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
              detail: "low" // Use "low" for cost-efficiency, can be "high" if needed
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1, // Low temperature for factual, deterministic output
    max_tokens: 2048,
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000, // Increased timeout for multimodal model
    });

    const reply = response?.data?.choices?.[0]?.message?.content?.trim();
    if (reply) {
      // Minor correction: The model sometimes returns numbers for MRP. Let's ensure it's a string.
      const parsed = JSON.parse(reply);
      if (typeof parsed.mrp === 'number') {
        parsed.mrp = String(parsed.mrp);
      }
      return parsed;
    }
    return null;
  } catch (apiError) {
    console.error("OpenAI Multimodal API Request Failed:", apiError.message);
    if (apiError.response) console.error("Response data:", apiError.response.data);
    return null;
  }
}

exports.identifyProductFromImage = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // --- Phase 0: Input Handling & Boilerplate (Largely Unchanged) ---
      let { imageBase64, imageUrl, barcode: clientBarcode, framesBase64 } = req.body || {};
      if (!imageBase64 && typeof req.body === "string") {
        try { const parsed = JSON.parse(req.body); imageBase64 = parsed.imageBase64; imageUrl = parsed.imageUrl; clientBarcode = parsed.barcode || clientBarcode; framesBase64 = parsed.framesBase64 || framesBase64; } catch {}
      }
      if (!imageBase64 && !imageUrl && !(Array.isArray(framesBase64) && framesBase64.length)) {
        return res.status(400).json({ ok: false, error: "Provide imageBase64, imageUrl or framesBase64[] in body." });
      }

      // Best Frame Selection from Burst
      if (Array.isArray(framesBase64) && framesBase64.length) {
        const burst = framesBase64.slice(0, 5);
        let bestIdx = 0, bestScore = -1;
        for (let i = 0; i < burst.length; i++) {
          try {
            const [anno] = await client.annotateImage({ image: { content: burst[i] }, features: [{ type: "TEXT_DETECTION" }, { type: "LOGO_DETECTION" }] });
            const score = (anno?.textAnnotations?.[0]?.description || "").length + ((anno?.logoAnnotations?.[0]?.score || 0) * 300);
            if (score > bestScore) { bestScore = score; bestIdx = i; }
          } catch {}
        }
        imageBase64 = burst[bestIdx];
      }

      // Image content loading & hashing
      let imageContent = imageBase64;
      if (!imageContent && imageUrl) {
        const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
        imageContent = Buffer.from(imgResp.data, "binary").toString("base64");
      }
      if (!imageContent) return res.status(400).json({ ok: false, error: "Failed to read image data." });

      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(imageContent).digest("hex");
      const db = admin.firestore();
      const cacheRef = db.collection("productVisionCache").doc(`hash:${hash}`);
      
      const cached = await cacheRef.get();
      if (cached.exists) {
        return res.status(200).json({ ok: true, cached: true, ...cached.data() });
      }

      // --- Phase 1: Gather All Text-Based Evidence ---

      // 1a. Get Raw OCR Text using Google Vision
      const [textResult] = await client.textDetection({ image: { content: imageContent } });
      const ocrJoined = textResult?.textAnnotations?.[0]?.description?.replace(/\n/g, " ") || "";
      
      // 1b. Extract Barcode from OCR text or use client-provided
      const RE_BARCODE = /\b(\d{8}|\d{12,14})\b/g;
      let scannedCode = clientBarcode || "";
      if (!scannedCode) {
        let m; while ((m = RE_BARCODE.exec(ocrJoined)) !== null) scannedCode = m[1];
      }

      // 1c. (Unconditional) Barcode Lookup
      let barcodeInfo = null;
      if (scannedCode) {
        try {
          const PROJECT = process.env.GCLOUD_PROJECT || "stockpilotv1";
          const REGION_HOST = `https://asia-south1-${PROJECT}.cloudfunctions.net`;
          const barcodeResp = await axios.post(`${REGION_HOST}/lookupBarcode`, { code: scannedCode }, { timeout: 10000 });
          if (barcodeResp.data?.ok && barcodeResp.data.data) {
            barcodeInfo = barcodeResp.data.data;
          }
        } catch (e) { console.warn("Barcode lookup failed:", e.message); }
      }
      
      // 1d. (Unconditional) Whitelisted Web Search (CSE)
      let webResults = [];
      if (CSE_KEY && CSE_CX) {
        const searchQuery = biasQuery(ocrJoined.slice(0, 180));
        try {
          const cseRes = await fetchCSE(searchQuery, 2); // Fetch top 2 results
          webResults = cseRes.map(r => ({ title: r.title, snippet: r.snippet }));
        } catch (e) { console.warn("CSE fetch failed:", e.message); }
      }

      // --- Phase 2: Consolidated Multimodal AI Call ---

      // Construct a single, context-rich prompt for GPT-4o
      const textContext = `
      Raw OCR Text: "${ocrJoined}"
      Detected Barcode: ${scannedCode || "None"}
      Barcode Lookup Data: ${barcodeInfo ? JSON.stringify(barcodeInfo) : "None"}
      Web Search Results: ${webResults.length > 0 ? JSON.stringify(webResults) : "None"}
      `;

      const aiResult = await callMultimodalAI(imageContent, textContext);

      if (!aiResult || !aiResult.name) {
        // Fallback or error
        return res.status(500).json({ ok: false, error: "AI failed to identify the product." });
      }

      // --- Phase 3: Post-Processing, Caching, and Response ---

      // The AI result is now our primary source of truth
      let best = {
        productName: aiResult.name || "",
        brand: aiResult.brand || "",
        variant: aiResult.variant || "", // Model might not return this, defaults to empty
        category: aiResult.category || "",
        unit: aiResult.unit || "",
        code: aiResult.sku || scannedCode || "", // Prioritize AI's SKU, fallback to scanned
        mrp: aiResult.mrp || "",
        hsn: aiResult.hsn || "",
        gst: aiResult.gst !== undefined ? aiResult.gst : null,
        source: "gpt-4o",
        confidence: 0.9 // High confidence as it's from the best model
      };

      // Run final cleanup and canonicalization on the AI's output
      best.productName = cleanTitle(best.productName);
      best.brand = titleCase(best.brand);
      best.productName = canonicalizeName(best.brand, best.productName);
      best.unit = parseCanonicalUnit(best.unit || best.productName); // Ensure unit is parsed well

      // Save a compressed copy for telemetry
      try {
        const bucket = admin.storage().bucket();
        const imgBuf = Buffer.from(imageContent, "base64");
        const small = await sharp(imgBuf).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
        await bucket.file(`scans/${hash}.jpg`).save(small, { contentType: "image/jpeg", resumable: false });
      } catch (e) { console.warn("Scan save failed:", e?.message); }
      
      // Cache the final, cleaned result
      await cacheRef.set({ best, imagePath: `scans/${hash}.jpg`, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      // Prepare the final response for the client
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

      return res.status(200).json({ ok: true, best, autofill });

    } catch (err) {
      console.error("identifyProductFromImage error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
});

// -------- Multi-product detection from single image (boxes -> crops -> reuse single-product pipeline) --------
// -------- Multi-product detection from single image (Google-only) --------
// =================================================================================================
// ===== NEW, REWRITTEN identifyProductsFromImage FOR MAX ACCURACY (BATCH MODE) =====
// =================================================================================================
exports.identifyProductsFromImage = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      let { imageBase64, imageUrl } = req.body || {};
      if (!imageBase64 && typeof req.body === "string") {
        try { const parsed = JSON.parse(req.body); imageBase64 = parsed.imageBase64; imageUrl = parsed.imageUrl; } catch {}
      }
      if (!imageBase64 && !imageUrl) {
        return res.status(400).json({ ok: false, error: "Provide imageBase64 or imageUrl" });
      }

      let imageContent = imageBase64;
      if (!imageContent && imageUrl) {
        const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
        imageContent = Buffer.from(imgResp.data, "binary").toString("base64");
      }
      if (!imageContent) {
        return res.status(400).json({ ok: false, error: "Failed to read image data." });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("Missing OPENAI_API_KEY for multi-product call.");
        return res.status(500).json({ ok: false, error: "OpenAI API key not configured." });
      }
      
      const model = "gpt-4o";
      const endpoint = "https://api.openai.com/v1/chat/completions";

      const systemPrompt = `You are an expert multi-product detection AI for Indian retail. Analyze the image and identify every distinct product visible. Return ONLY a strict JSON object with a single key "items" which is an array of product objects.
      Schema for each product object: { "productName": "...", "brand": "...", "unit": "...", "category": "...", "barcode": "...", "mrp": "...", "confidence": 0.0 }.
      Rules:
      - For each item, 'mrp' should be the Maximum Retail Price (MRP) if visible. If not, use any other visible selling price. Extract only the numeric value (e.g., for "MRP ₹120.00", return "120"). If no price is visible, leave it as an empty string.
      - Be accurate. If you can't identify a detail, leave it as an empty string.
      - Confidence is a score from 0.0 (low) to 1.0 (high) representing your certainty.
      - Do not include products that are blurry, unidentifiable, or not actual retail items.
      - Do not return commentary or markdown. Return only the JSON object.`;

      const payload = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify all retail products in this image." },
              {
                type: "image_url",
                image_url: { 
                  url: `data:image/jpeg;base64,${imageContent}`,
                  // High detail is necessary for the AI to distinguish multiple small items
                  detail: "high" 
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      };

      const response = await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        // This is a complex task, so we need a longer timeout
        timeout: 45000, 
      });

      const reply = response?.data?.choices?.[0]?.message?.content?.trim();
      let parsed = { items: [] };
      if (reply) {
        try {
          parsed = JSON.parse(reply);
        } catch (e) {
          console.error("Failed to parse multi-product AI response:", e);
          return res.status(500).json({ ok: false, error: "AI returned invalid data." });
        }
      }

      const items = Array.isArray(parsed.items) ? parsed.items : [];
      
      // Add a 'source' field and ensure 'mrp' is a string for consistency
      const finalItems = items.map(item => ({
         ...item,
         mrp: String(item.mrp || ''), // Ensure mrp is always a string
         source: "gpt-4o-batch"
      }));

      return res.status(200).json({ ok: true, count: finalItems.length, items: finalItems });

    } catch (err) {
      console.error("identifyProductsFromImage error:", err);
      // Provide a more helpful error message to the frontend if possible
      const errorMessage = err.response?.data?.error?.message || err.message || "Multi-product scan failed";
      return res.status(500).json({ ok: false, error: errorMessage });
    }
  });
});