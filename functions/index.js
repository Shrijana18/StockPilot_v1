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

// Feature flags to control enrichment strategies
const USE_GPT_ENRICH = (process.env.USE_GPT_ENRICH || "true").toLowerCase() === "true";  // GPT normalization ON by default
// ---------- External search providers ----------
const KG_API_KEY = process.env.GOOGLE_KG_API_KEY || "";
const CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const CSE_CX  = process.env.GOOGLE_CSE_CX  || "";

// OpenAI model controls
const OPENAI_MODEL_VISION = process.env.OPENAI_MODEL_VISION || process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_MODEL_NORM   = process.env.OPENAI_MODEL_NORM   || "gpt-4o-mini";
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

// Google Knowledge Graph API enrichment
async function fetchKGEntities(query) {
  if (!KG_API_KEY || !query) return null;
  try {
    const r = await axios.get("https://kgsearch.googleapis.com/v1/entities:search", {
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
      productName: name,
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
    const url = "https://www.googleapis.com/customsearch/v1";
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
          productName,
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

// AI Inventory generation from a single brand (region: us-central1)
exports.generateInventoryByBrand = onRequest({ region: "us-central1" }, (req, res) => {
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

      const endpoint = "https://api.openai.com/v1/chat/completions";
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
            const m = rawText.match(/\[\s*\{[\s\S]*?\}\s*\]/);
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
      const endpoint = "https://api.openai.com/v1/chat/completions";
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
// ---------- Product Identification from Image (visual-first + KG + CSE) ----------
exports.identifyProductFromImage = onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      let { imageBase64, imageUrl } = req.body || {};
      if (!imageBase64 && typeof req.body === "string") {
        try {
          const parsed = JSON.parse(req.body);
          imageBase64 = parsed.imageBase64;
          imageUrl = parsed.imageUrl;
        } catch {}
      }
      if (!imageBase64 && !imageUrl) {
        return res.status(400).json({ ok: false, error: "Provide imageBase64 or imageUrl in body." });
      }

      // ---- Image content ----
      let imageContent = imageBase64;
      if (!imageContent && imageUrl) {
        const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
        imageContent = Buffer.from(imgResp.data, "binary").toString("base64");
      }
      if (!imageContent) return res.status(400).json({ ok: false, error: "Failed to read image data." });

      // ---- Cache by image hash ----
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(imageContent).digest("hex");
      const db = admin.firestore();
      const cacheRef = db.collection("productVisionCache").doc(`hash:${hash}`);
      const cached = await cacheRef.get();
      if (cached.exists) {
        return res.status(200).json({ ok: true, cached: true, ...cached.data() });
      }

      // ---- A) Visual-first guess (OpenAI Vision) ----
      let visionGuess = null;
      try {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (openaiApiKey) {
          const endpoint = "https://api.openai.com/v1/chat/completions";
          const sys = `You are a retail product identifier. Look at the image and identify exact product (brand → variant). 
Return ONLY JSON: { "productName": "...", "brand": "...", "category": "...", "size": "", "confidence": 0.0 }`;
          const userContent = [
            { type: "text", text: "Identify this product and return JSON." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageContent}` } }
          ];
          const resp = await axios.post(endpoint, {
            model: OPENAI_MODEL_VISION,
            messages: [
              { role: "system", content: sys },
              { role: "user", content: userContent }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
          }, {
            headers: { "Authorization": `Bearer ${openaiApiKey}` },
            timeout: 15000
          });
          const txt = resp?.data?.choices?.[0]?.message?.content?.trim() || "{}";
          visionGuess = JSON.parse(txt);
        }
      } catch (e) {
        console.warn("[identifyProductFromImage] Vision failed:", e.message);
      }

      // ---- B) OCR for size/barcode ----
      const [docText] = await client.documentTextDetection({ image: { content: imageContent } });
      let lines = [];
      if (docText?.fullTextAnnotation?.text) {
        lines = docText.fullTextAnnotation.text.split(/\n+/).map(t => t.trim()).filter(Boolean);
      }

      const RE_SIZE = /\b(\d+(?:\.\d+)?\s?(ml|g|kg|l|oz|capsules|tablets|pcs|pack))\b/i;
      const RE_BARCODE = /\b(\d{8}|\d{12,14})\b/g;
      let sizeFromOCR = "";
      for (const l of lines) { const m = l.match(RE_SIZE); if (m) { sizeFromOCR = m[0]; break; } }
      let scannedCode = "";
      const joined = lines.join(" ");
      let m; while ((m = RE_BARCODE.exec(joined)) !== null) { scannedCode = m[1]; }

      // ---- C) Merge base ----
      let best = {
        brand: visionGuess?.brand || "",
        productName: visionGuess?.productName || "",
        category: visionGuess?.category || "",
        size: visionGuess?.size || sizeFromOCR,
        code: scannedCode,
        source: "vision-ai",
        confidence: visionGuess?.confidence || 0.6
      };

      // ---- D) Barcode lookup ----
      if (best.code) {
        try {
          const PROJECT = process.env.GCLOUD_PROJECT || "stockpilotv1";
          const REGION_HOST = `https://asia-south1-${PROJECT}.cloudfunctions.net`;
          const barcodeResp = await axios.post(`${REGION_HOST}/lookupBarcode`, { code: best.code }, { timeout: 10000 });
          if (barcodeResp.data?.ok && barcodeResp.data.data) {
            best = { ...best, ...barcodeResp.data.data, source: "barcode" };
          }
        } catch {}
      }

      // ---- E) KG enrichment ----
      try {
        if (KG_API_KEY) {
          const query = [best.brand, best.productName, best.size].filter(Boolean).join(" ");
          const kg = await fetchKGEntities(query);
          if (kg) best = { ...best, ...kg, source: best.source ? `${best.source}+kg` : "kg" };
        }
      } catch (e) {}

      // ---- F) CSE enrichment ----
      try {
        if (CSE_KEY && CSE_CX) {
          const q = [best.brand, best.productName, best.size].filter(Boolean).join(" ");
          const results = await fetchCSE(q, 3);
          if (results.length) {
            const top = results[0];
            const ogMeta = await fetchOG(top.link);
            const title = (ogMeta["og:title"] || top.title || "").replace(/Amazon\.in|Flipkart|Buy Online/gi, "").trim();
            const snippet = ogMeta["og:description"] || top.snippet || "";
            best.productName = title.replace(/\|.*$/, "").trim();
            const mrpMatch = (snippet.match(/₹\s*([0-9]{2,6})/));
            if (mrpMatch) best.mrp = mrpMatch[1];
            best.description = ""; // avoid long desc to save tokens
            best.source = best.source ? `${best.source}+cse` : "cse";
          }
        }
      } catch (e) {}

      // ---- G) GPT normalization (only if missing key fields) ----
      if (USE_GPT_ENRICH && process.env.OPENAI_API_KEY) {
        const needNormalization = !(best.productName && best.brand && best.size);
        if (needNormalization) {
          try {
            const compact = `product=${best.productName}; brand=${best.brand}; size=${best.size}`;
            const usr = `Correct/complete product fields. OCR hints:\n${lines.slice(0,3).join("\n")}\nDetected:\n${compact}`;
            const payload = {
              model: OPENAI_MODEL_NORM,
              messages: [
                { role: "system", content: `Return ONLY JSON: { "productName": string, "brand": string, "category": string, "size": string, "unit": string }` },
                { role: "user", content: usr }
              ],
              response_format: { type: "json_object" },
              temperature: 0.1
            };
            const gptResp = await axios.post("https://api.openai.com/v1/chat/completions", payload, {
              headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
              timeout: 10000
            });
            const txt = gptResp?.data?.choices?.[0]?.message?.content?.trim() || "{}";
            const gptJson = JSON.parse(txt);
            best.productName = gptJson.productName || best.productName;
            best.brand = gptJson.brand || best.brand;
            best.category = gptJson.category || best.category;
            best.size = gptJson.size || best.size;
            best.unit = gptJson.unit || best.unit;
          } catch (e) {}
        }
      }

      // ---- H) Strong unit building ----
      const NUM_UNIT_RE = /\b\d+(?:\.\d+)?\s?(ml|g|kg|l|oz|capsules|tablets|pcs|pack)\b/i;
      const amount = (best.size && (best.size.match(NUM_UNIT_RE)?.[0])) || "";
      const containerMatch = (best.productName.match(/\b(bottle|jar|pack|tube|strip|carton|pouch)\b/i));
      const container = containerMatch ? containerMatch[1] : "";
      best.unit = [amount, container].filter(Boolean).join(" ").trim();

      // ---- HSN/GST (rule-based quick fallback) ----
      if (!best.hsn || !best.gst) {
        if (/shampoo|lotion|cream|cosmetic/i.test(best.productName)) {
          best.gst = 18;
          best.hsn = "3304";
        }
      }

      // ---- Save cache ----
      await cacheRef.set({ best, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      // ---- Response ----
      const autofill = {
        productName: best.productName || "",
        brand: best.brand || "",
        category: best.category || "",
        sku: best.code || "",
        unit: best.unit || "",
        hsn: best.hsn || "",
        gst: best.gst || "",
        mrp: best.mrp || ""
      };
      return res.status(200).json({ ok: true, best, autofill });
    } catch (err) {
      console.error("identifyProductFromImage error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
});