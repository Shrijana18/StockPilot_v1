

const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const axios = require("axios");

/**
 * Generates HSN and GST suggestions for a product using OpenAI.
 * Input: { productName, category, description }
 * Output: { hsnCode, gstRate, confidence }
 */
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

      const { productName, category, description } = req.body || {};
      if (!productName && !category) {
        return res.status(400).json({
          success: false,
          message: "Missing productName or category"
        });
      }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({
          success: false,
          message: "Missing OpenAI API key"
        });
      }

      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const endpoint = "https://api.openai.com/v1/chat/completions";

      const systemPrompt = `
You are an expert Indian tax and product classification assistant.
Given a product's name, category, and description, return the best-guess HSN code (4-8 digits)
and GST rate (0,5,12,18,28). Also provide a confidence score 0–1.
Always output strict JSON as:
{
  "hsnCode": "XXXX",
  "gstRate": number,
  "confidence": 0.0,
  "reason": "why you chose this"
}
Rules:
- HSN codes must be numeric 4-8 digits.
- If item is exempt (e.g., milk, fresh produce) → GST = 0.
- Common sense approach for Indian retail items.
`;

      const userPrompt = `
Product: ${productName || ""}
Category: ${category || ""}
Description: ${description || ""}
`;

      const payload = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      };

      const response = await axios.post(endpoint, payload, {
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      });

      const rawText = response.data?.choices?.[0]?.message?.content?.trim() || "";
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : null;
      }

      if (!parsed) {
        return res.status(200).json({ 
          success: false, 
          message: "No valid JSON returned", 
          raw: rawText 
        });
      }

      const hsnCode = (parsed.hsnCode || "").replace(/\D/g, "").slice(0, 8);
      const gstRate = Number(parsed.gstRate) || 0;
      const confidence = Number(parsed.confidence) || 0;

      return res.status(200).json({
        success: true,
        hsn: hsnCode,
        gst: gstRate,
        confidence,
        reason: parsed.reason || "",
      });
    } catch (error) {
      console.error("generateHSNAndGST Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to generate HSN/GST",
      });
    }
  });
});