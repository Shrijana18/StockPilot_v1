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