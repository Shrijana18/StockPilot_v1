const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const cors = require("cors");
const axios = require("axios");

const corsHandler = cors({ origin: true });

// Define secrets for Firebase Functions v2
const GEMINI_API_KEY_SECRET = defineSecret("GEMINI_API_KEY");

module.exports = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [GEMINI_API_KEY_SECRET],
  },
  (req, res) => {
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

        // ---- Gemini API: extended table with HSN / GST / Pricing Mode / Base / MRP ----
        // Access secret via process.env (Firebase Functions v2 makes secrets available this way)
        const geminiApiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY_SECRET.value();
        const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
        if (!geminiApiKey) {
          console.error("Missing GEMINI_API_KEY");
          return res.status(500).json({ error: "Gemini API key not configured. Please set GEMINI_API_KEY as a Firebase secret." });
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

      const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
      const endpoint = `${baseUrl}/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
      
      const payload = {
        contents: [{
          parts: [
            { text: `${systemPrompt}\n\n${userMsg}` }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
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

      let response;
      let retries = 2;
      while (retries > 0) {
        try {
          response = await axios.post(endpoint, payload, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 30000
          });
          break; // success
        } catch (apiError) {
          const status = apiError.response && apiError.response.status;
          if ((status === 429 || status === 503 || status === 500) && retries > 1) {
            console.warn(`${status} from Gemini, retrying...`);
            retries--;
            await new Promise(r => setTimeout(r, 1200));
          } else {
            console.error("Gemini API Request Failed:", apiError.message);
            const errorDetails = apiError.response?.data || apiError.message;
            return res.status(500).json({ error: "Gemini API Request Failed", details: errorDetails });
          }
        }
      }

      let rawText = "";
      try {
        rawText =
          response &&
          response.data &&
          response.data.candidates &&
          response.data.candidates[0] &&
          response.data.candidates[0].content &&
          response.data.candidates[0].content.parts &&
          response.data.candidates[0].content.parts[0] &&
          response.data.candidates[0].content.parts[0].text
            ? response.data.candidates[0].content.parts[0].text.trim()
            : "";

        if (!rawText) {
          console.error("Gemini returned empty response");
          return res.status(500).json({ error: "Gemini API returned empty response" });
        }

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
            const m = rawText.match(/\{[\s\S]*?\}/);
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
          console.error("Gemini response did not contain a valid extended table header");
          console.error("Raw response:", rawText.substring(0, 500));
          return res.status(500).json({ error: "No valid inventory table found in Gemini response" });
        }
      } catch (e) {
        console.error("Error extracting Gemini response text", e);
        return res.status(500).json({ error: "Error extracting Gemini response" });
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
