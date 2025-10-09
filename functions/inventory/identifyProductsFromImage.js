const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const axios = require("axios");

module.exports = onRequest(async (req, res) => {
  // ✅ Handle preflight CORS manually
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).send("");
  }

  cors(req, res, async () => {
    try {
      // ✅ Ensure CORS headers on all responses
      res.set("Access-Control-Allow-Origin", "*");

      const { base64Image, imageBase64, imageUrl, contextPrompt } = req.body || {};
      let b64 = base64Image || imageBase64 || "";
      if (!b64 && imageUrl) {
        try {
          const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
          b64 = Buffer.from(imgResp.data, "binary").toString("base64");
        } catch (e) {
          return res.status(400).json({ success: false, message: "Failed to fetch imageUrl" });
        }
      }
      if (!b64) {
        return res.status(400).json({ success: false, message: "Missing image data (base64Image/imageBase64 or imageUrl)" });
      }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ success: false, message: "Missing OpenAI API key" });
      }

      const model = process.env.OPENAI_MODEL || "gpt-4o";
      const endpoint = "https://api.openai.com/v1/chat/completions";

      const systemPrompt = `You are an expert multi-product detection AI for Indian retail.
Return ONLY a strict JSON object:
{ "items": [ { "productName":"", "brand":"", "category":"", "unit":"", "hsnCode":"", "gstRate":"", "confidence":0.0 } ] }
Rules:
- No commentary or markdown. Just the JSON object.
- 'confidence' must be between 0 and 1.
- Use concise strings and avoid duplicate items.`;

      const userPrompt = contextPrompt
        ? `Use this context: ${contextPrompt}`
        : "Identify all distinct retail products visible in this image.";

      const MAX_CTX = 220;
      const compactUser = (userPrompt || "").toString().slice(0, MAX_CTX);

      const detailLevel = "high"; // better for shelves; we'll fall back to "low" if empty
      const messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: compactUser || "Identify all distinct retail products visible in this image." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: detailLevel } }
          ],
        },
      ];

      const payload = {
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        top_p: 0.2,
        max_tokens: 900,
      };

      async function callOpenAI(msgs) {
        const r = await axios.post(endpoint, { model, messages: msgs, response_format: { type: "json_object" }, temperature: 0.1, top_p: 0.2, max_tokens: 900 }, {
          headers: { Authorization: `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
          timeout: 45000,
        });
        const txt = r.data?.choices?.[0]?.message?.content?.trim() || "{}";
        let parsed;
        try { parsed = JSON.parse(txt); }
        catch {
          // try to extract an object { ... }
          const matchObj = txt.match(/\{[\s\S]*\}$/);
          if (matchObj) { try { parsed = JSON.parse(matchObj[0]); } catch {} }
        }
        if (Array.isArray(parsed)) parsed = { items: parsed }; // allow legacy array
        const items = parsed && Array.isArray(parsed.items) ? parsed.items : [];
        return { items, raw: txt };
      }

      // First attempt with high detail
      let { items: itemsArray, raw: rawText } = await callOpenAI(messages);
      // Fallback once with low detail if nothing detected
      if (!itemsArray.length) {
        const fallbackMsgs = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: compactUser || "Identify all distinct retail products visible in this image." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "low" } }
            ],
          },
        ];
        const fb = await callOpenAI(fallbackMsgs);
        itemsArray = fb.items;
        if (!itemsArray.length) rawText = fb.raw || rawText;
      }

      // Normalize minimal fields (optional: ensure numbers are sane)
      const products = itemsArray.map((p) => ({
        productName: p?.productName || "",
        brand: p?.brand || "",
        category: p?.category || "",
        unit: p?.unit || "",
        hsnCode: p?.hsnCode || "",
        gstRate: p?.gstRate ?? "",
        confidence: typeof p?.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0,
      }));

      const total = products.length;

      // Return both new and legacy keys for compatibility
      return res.status(200).json({
        success: true,
        ok: true,
        products,
        items: products,
        total,
        count: total,
      });
    } catch (error) {
      console.error("identifyProductsFromImage Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to identify multiple products",
      });
    }
  });
});