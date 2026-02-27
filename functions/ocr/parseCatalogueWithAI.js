/**
 * AI Catalogue Parser – Gemini-powered extraction for any catalogue, price list, or handwritten list.
 * Accepts image (base64) or PDF (base64). Uses Gemini multimodal for images; for PDFs extracts text
 * then sends to Gemini for structured extraction. Returns products in the same schema as ocrFromFile.
 *
 * Set GEMINI_API_KEY Firebase secret to your Gemini API key (e.g. AIzaSy...).
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

let pdfParse;
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  pdfParse = null;
}

const GEMINI_API_KEY_SECRET = defineSecret("GEMINI_API_KEY");

function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.set("Access-Control-Max-Age", "86400");
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function normalizePayload(body) {
  const pdfBase64 = body.pdfBase64 || body.fileBase64;
  const imageBase64 = body.imageBase64 || body.base64Image;
  const mime = (body.mimeType || body.mime || "").toLowerCase();
  if (pdfBase64 && (mime === "application/pdf" || !imageBase64)) {
    return { type: "pdf", base64: pdfBase64 };
  }
  if (imageBase64) {
    return { type: "image", base64: imageBase64, mime: mime || "image/jpeg" };
  }
  if (body.fileBase64) {
    return {
      type: mime === "application/pdf" ? "pdf" : "image",
      base64: body.fileBase64,
      mime: mime || "image/jpeg",
    };
  }
  return null;
}

async function extractTextFromPdf(buffer) {
  if (!pdfParse) throw new Error("PDF support not available: pdf-parse not installed.");
  const data = await pdfParse(buffer);
  return data.text || "";
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting product inventory from any document: printed catalogues, price lists, PDFs, photos of handwritten lists, whiteboards, or mixed layouts for Indian retail.

Your task: Extract EVERY product line from the document. Return a JSON array of product objects. Output ONLY the raw JSON array—no commentary, no markdown code blocks, no \`\`\`json wrapper.

Schema—each object MUST have these keys (use empty string "" or 0 if not found):
- productName (string): Human-readable name, e.g. "CPVC Pipe SDR 11 1/2 inch", "Elbow 90° 3/4 inch", "Ashirvad Pipe 25mm". NEVER output only a code like "70000247"—always combine product type + size/code (e.g. "CPVC Pipe 1/2 inch - 70000247").
- brand (string): Brand from header, title, watermark, or row. If one brand appears for the whole document (e.g. "Ashirvad", "India Gate"), use it for ALL rows.
- category (string): e.g. "Plumbing Pipes", "Fittings", "Groceries", "Personal Care".
- sku (string): Part number / product code / SKU, e.g. "70000247", "ASH-CPVC-1/2".
- unit (string): "pcs", "Meter", "Box", "1 Meter", "100ml Bottle", etc.
- quantity (string or number): Default "1" if not specified.
- costPrice (number or string): Cost/price per unit.
- sellingPrice (number or string): Selling price or MRP per unit.
- mrp (number or string): MRP; when document has only one price column, use the same value as sellingPrice.
- hsnCode (string): HSN code (4–8 digits) if visible (e.g. in section headers like "HSN CODE: 39172390").
- gstRate (number or string): GST % (0, 5, 12, 18, 28) if visible.
- description (string): Short product type or description (e.g. "Reducer Tee", "CPVC fitting"); else "".

Rules:
- Tables: each data row is one product. Map every column: Size → productName/sku, Part No. → sku, MRP/Rate/Price → sellingPrice and mrp, Std. Pkg./Box Qty → quantity/unit.
- PRICING IS REQUIRED when visible: If the document has ANY price column (e.g. "MRP", "MRP Incl. of all Taxes", "Rate", "Price", "MRP \`/pc"), you MUST put that numeric value into both sellingPrice and mrp for that row. Never leave costPrice, sellingPrice, or mrp empty when a price is shown in the row. Strip Rs, ₹, commas; output numbers only.
- Unit: When the document says "per pc", "/pc", "pc", or "Std. Pkg.", use unit "pcs". Use "Box" or stated unit when shown.
- Brand: Prefer brand from document header/logo (e.g. Ashirvad, FlowGuard). If "Design Registered Only with Ashirvad" or similar appears, you may use "Ashirvad" as brand. If the user provided a brand hint, prefer it when the document is ambiguous.
- description: When product type is clear (e.g. Reducer Tee, Cross Tee), set description to that or category (e.g. "CPVC fitting").
- productName must always be human-readable (e.g. "Reducer Tee 1/2 x 1/2 x 3/4 inch" not just a code).
- DENSE / MULTI-TABLE PAGES: The image may contain MANY product tables or sections (e.g. Female Adapter, Male Adapter, End Cap, Tank Nipple, Union, Valve, each with its own table). You MUST extract EVERY row from EVERY table. Use each section heading as the product type (e.g. "Female Adapter Plastic Threaded", "Tank Nipple"). Combine all rows into ONE JSON array. Do NOT return an empty array if you see any table with Size, Part No., MRP, or similar columns—extract every data row. Ignore sidebar labels (New, Speciality, Revised) and footer text; focus on table data.
- Output ONLY the JSON array. Example: [{"productName":"Reducer Tee 1/2 x 1/2 x 3/4 inch","brand":"Ashirvad","category":"Fittings","sku":"70000462","unit":"pcs","quantity":"1","costPrice":77,"sellingPrice":77,"mrp":77,"hsnCode":"39172390","gstRate":"","description":"Reducer Tee"}, ...]`;

function buildUserContextLine(body) {
  const ctx = body.context || body.contextHint;
  const brand = body.brandHint || body.brand;
  const category = body.categoryHint || body.category;
  const parts = [];
  if (typeof ctx === "string" && ctx.trim()) parts.push(ctx.trim());
  if (typeof brand === "string" && brand.trim()) parts.push(`Brand: ${brand.trim()}`);
  if (typeof category === "string" && category.trim()) parts.push(`Category: ${category.trim()}`);
  return parts.length ? `\n\nUser-provided context (use to set or prefer these values): ${parts.join(". ")}` : "";
}

async function callGeminiWithImage(imageBase64, mimeType, userContextLine = "") {
  const geminiApiKey = GEMINI_API_KEY_SECRET.value();
  if (!geminiApiKey || typeof geminiApiKey !== "string" || !geminiApiKey.trim()) {
    throw new Error("GEMINI_API_KEY secret not set. Configure it in Firebase: firebase functions:secrets:set GEMINI_API_KEY");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

  const mime = (mimeType || "image/jpeg").toLowerCase();
  const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const finalMime = allowedMime.includes(mime) ? mime : "image/jpeg";

  const payload = {
    contents: [{
      parts: [
        { text: `${EXTRACTION_SYSTEM_PROMPT}\n\nExtract all products from this image (catalogue, price list, or handwritten list). Include every price column value as sellingPrice and mrp.${userContextLine}\n\nReturn ONLY a JSON array of product objects.` },
        {
          inline_data: {
            mime_type: finalMime,
            data: imageBase64,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: 0.2,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const maxRetries = 2;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 90000,
      });
      const text =
        res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (text) return text;
      const blockReason = res?.data?.candidates?.[0]?.finishReason;
      if (blockReason && blockReason !== "STOP") throw new Error(blockReason);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && (err.response?.status === 429 || err.code === "ECONNABORTED")) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Gemini returned empty response");
}

const DENSE_FALLBACK_PROMPT = `This image is a product catalogue (e.g. SWR/drainage, CPVC, plumbing) with one or more tables. You MUST extract every row from every table. Look for columns: Size (cm), Size (inch), Part No., Std. Pkg., Box Qty., MRP, "MRP Incl. of all Taxes/length", "MRP Incl. of all Taxes/pc". Section headings may be: Single Socket, Plain Bend, Coupler, Reducer Offset, Repair Coupler, Reducing Tee, Single Y, etc. Use that heading as product type (productName/description). Put Part No. in sku, MRP in sellingPrice and mrp. Use unit "pcs" or "length"/"Mtr." as shown. Return ONLY a JSON array of objects with keys: productName, brand, category, sku, unit, quantity, costPrice, sellingPrice, mrp, hsnCode, gstRate, description. Do NOT return an empty array. Extract every data row from every table.`;

async function callGeminiWithImageRetryDense(imageBase64, mimeType, userContextLine) {
  const t0 = Date.now();
  const first = await callGeminiWithImage(imageBase64, mimeType, userContextLine);
  const arr = parseJsonArray(first);
  console.log(`parseCatalogueWithAI: first pass took ${((Date.now() - t0) / 1000).toFixed(1)}s, products=${arr.length}`);
  if (arr.length > 0) return first;
  console.warn("parseCatalogueWithAI: first pass returned 0 products, retrying with dense-catalogue prompt");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY_SECRET.value()}`;
  const mime = (mimeType || "image/jpeg").toLowerCase();
  const finalMime = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime) ? mime : "image/jpeg";
  const payload = {
    contents: [{
      parts: [
        { text: `${DENSE_FALLBACK_PROMPT}${userContextLine}\n\nReturn ONLY the JSON array, no other text.` },
        { inline_data: { mime_type: finalMime, data: imageBase64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };
  const t1 = Date.now();
  const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" }, timeout: 90000 });
  const text = res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const retryArr = parseJsonArray(text);
  console.log(`parseCatalogueWithAI: retry took ${((Date.now() - t1) / 1000).toFixed(1)}s, products=${retryArr.length}`);
  return text || first;
}

async function callGeminiWithText(extractedText, userContextLine = "") {
  const geminiApiKey = GEMINI_API_KEY_SECRET.value();
  if (!geminiApiKey || typeof geminiApiKey !== "string" || !geminiApiKey.trim()) {
    throw new Error("GEMINI_API_KEY secret not set.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: `${EXTRACTION_SYSTEM_PROMPT}\n\nBelow is raw text extracted from a PDF catalogue or price list. Extract all products; include every price as sellingPrice and mrp.${userContextLine}\n\nReturn ONLY a JSON array of product objects.\n\n---\n${extractedText}\n---`,
      }],
    }],
    generationConfig: {
      temperature: 0.2,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const maxRetries = 2;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 90000,
      });
      const text =
        res?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (text) return text;
      const blockReason = res?.data?.candidates?.[0]?.finishReason;
      if (blockReason && blockReason !== "STOP") throw new Error(blockReason);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && (err.response?.status === 429 || err.code === "ECONNABORTED")) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Gemini returned empty response");
}

function parseJsonArray(raw) {
  let str = (raw || "").trim();
  if (!str) return [];
  const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) str = codeBlock[1].trim();
  const open = str.indexOf("[");
  const close = str.lastIndexOf("]");
  if (open !== -1 && close !== -1 && close > open) {
    str = str.slice(open, close + 1);
  }
  str = str.replace(/,(\s*[}\]])/g, "$1");
  try {
    const arr = JSON.parse(str);
    return Array.isArray(arr) ? arr : [];
  } catch (e1) {
    try {
      const singleObj = str.match(/\{[\s\S]*\}/);
      if (singleObj) {
        const obj = JSON.parse(singleObj[0]);
        return [obj];
      }
    } catch (e2) {
      // ignore
    }
    console.warn("parseCatalogueWithAI: JSON parse failed", e1.message);
    return [];
  }
}

function normalizeProduct(p) {
  const num = (v) => {
    if (v === "" || v == null) return undefined;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v) => (v != null ? String(v).trim() : "");
  return {
    productName: str(p.productName || p.name || p.product),
    name: str(p.productName || p.name || p.product),
    brand: str(p.brand),
    category: str(p.category || "General"),
    sku: str(p.sku || p.partNo || p.partNumber || p.code),
    unit: str(p.unit || "pcs"),
    quantity: p.quantity != null ? String(p.quantity) : "1",
    costPrice: num(p.costPrice ?? p.cost ?? p.price) ?? "",
    sellingPrice: num(p.sellingPrice ?? p.sell ?? p.mrp ?? p.price) ?? "",
    mrp: num(p.mrp) ?? "",
    price: num(p.costPrice ?? p.cost ?? p.price ?? p.sellingPrice ?? p.mrp) ?? "",
    hsnCode: str(p.hsnCode || p.hsn),
    gstRate: p.gstRate != null ? p.gstRate : (p.gst != null ? p.gst : ""),
    description: str(p.description),
  };
}

module.exports = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [GEMINI_API_KEY_SECRET],
    invoker: "public",
  },
  (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    (async () => {
      try {
        const body = typeof req.body === "object" ? req.body : {};
        const payload = normalizePayload(body);
        if (!payload || !payload.base64) {
          return res.status(400).json({
            success: false,
            error: "Missing file. Send imageBase64 or pdfBase64 (and optionally mimeType).",
            products: [],
          });
        }

        const buffer = Buffer.from(payload.base64, "base64");
        if (buffer.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Invalid base64 data.",
            products: [],
          });
        }

        const userContextLine = buildUserContextLine(body);

        let rawJson = "";

        if (payload.type === "image") {
          rawJson = await callGeminiWithImageRetryDense(payload.base64, payload.mime, userContextLine);
        } else {
          const text = await extractTextFromPdf(buffer);
          if (!text || text.trim().length < 50) {
            return res.status(200).json({
              success: true,
              message: "PDF text too short or empty. Try uploading as image (screenshot) for better AI parsing.",
              products: [],
            });
          }
          rawJson = await callGeminiWithText(text, userContextLine);
        }

        const arr = parseJsonArray(rawJson);
        const products = arr.map(normalizeProduct).filter((p) => p.productName || p.sku);

        return res.status(200).json({
          success: true,
          products,
          total: products.length,
        });
      } catch (error) {
        console.error("parseCatalogueWithAI Error:", error);
        const message = error.response?.data?.error?.message || error.message || "AI parsing failed";
        return res.status(500).json({
          success: false,
          error: message,
          products: [],
        });
      }
    })().catch((err) => {
      console.error("parseCatalogueWithAI Unhandled:", err);
      res.status(500).json({ success: false, error: "AI parsing failed", products: [] });
    });
  }
);
