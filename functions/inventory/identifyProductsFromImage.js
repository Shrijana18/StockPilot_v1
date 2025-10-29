const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const axios = require("axios");
const HybridAI = require("../shared/hybridAI");

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

      // Use Hybrid AI for multi-product identification
      const hybridAI = new HybridAI();
      
      try {
        console.log("🚀 Starting hybrid AI multi-product identification...");
        const result = await hybridAI.identifyMultipleProducts(b64, contextPrompt);
        
        const products = result.primary || result.fallback || [];
        console.log(`✅ AI Success using ${result.used}: ${products.length} products found`);
        
        if (!products.length) {
          return res.status(200).json({ 
            success: false, 
            message: "No products identified in the image" 
          });
        }

        const total = products.length;

        // Return both new and legacy keys for compatibility
        return res.status(200).json({
          success: true,
          ok: true,
          products,
          items: products,
          total,
          count: total,
          aiUsed: result.used,
          aiSource: result.primary?.source || result.fallback?.source || "unknown"
        });
      } catch (aiError) {
        console.error("❌ Hybrid AI failed:", aiError.message);
        return res.status(500).json({
          success: false,
          message: "AI identification failed: " + aiError.message
        });
      }
    } catch (error) {
      console.error("identifyProductsFromImage Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to identify multiple products",
      });
    }
  });
});