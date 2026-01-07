const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const cors = require("cors")({ origin: true });
const axios = require("axios");
const HybridAI = require("../shared/hybridAI");

// Define secrets for Firebase Functions v2
const GEMINI_API_KEY_SECRET = defineSecret("GEMINI_API_KEY");

/**
 * Enhanced Gemini API call for multiple product identification
 */
async function callGeminiMultipleDirect(imageBase64, contextPrompt = "") {
  const geminiApiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY_SECRET.value();
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
  
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
  
  const systemPrompt = `You are FLYP Magic - an expert multi-product detection AI for Indian retail. Analyze the image thoroughly and identify ALL distinct products or objects visible.

Return ONLY a strict JSON object:
{
  "items": [
    {
      "productName": "Product Name Only (short, clean name without description)",
      "brand": "Brand Name",
      "category": "Product Category (e.g., Medicine, Food & Beverages, Personal Care, Home Care, Electronics, Stationery)", 
      "unit": "Quantity Number + Unit Type (e.g., '1 Tube', '250ml Bottle', '500g Pack', '10 Tablets', '1 Piece')",
      "description": "Detailed product description including key features, ingredients, usage if visible",
      "mrp": "Maximum Retail Price (numeric value only)",
      "sellingPrice": "Selling Price if different from MRP (numeric value only)",
      "variant": "Product Variant/Size/Flavor",
      "hsnCode": "HSN Code if visible (4-8 digits)",
      "gstRate": "GST Rate if visible (numeric: 0, 5, 12, 18, or 28)",
      "confidence": 0.95
    }
  ]
}

CRITICAL RULES:
- 'productName' MUST be SHORT and CLEAN - just the product name (e.g., "Sensodyne Toothpaste", "Paracetamol Tablets"). NO long descriptions, NO marketing text.
- 'unit' MUST start with a NUMBER followed by unit type (e.g., "1 Tube", "250ml Bottle", "500g Pack", "10 Tablets", "1 Piece"). Always include quantity number.
- Identify ANY objects shown - even if not clearly labeled, use visual cues, logos, packaging to identify
- Use visual analysis: colors, shapes, packaging design, logos, text labels
- Recognize Indian brands: Dabur, Himalaya, Patanjali, Hindustan Unilever, P&G, ITC, Nestle, Sensodyne, Colgate, etc.
- Extract ALL visible text from packaging including ingredients, usage instructions
- 'category' should be specific
- 'description' should include key features, ingredients list if visible, usage instructions
- 'mrp' extract ONLY numeric value from MRP labels
- Identify ALL distinct products/objects in the image
- Avoid duplicate items - each product should appear only once
- Focus on Indian retail products and packaging standards
- Extract maximum information for each product
- NO commentary or markdown - ONLY the JSON object`;

  const userPrompt = contextPrompt 
    ? `Use this context: ${contextPrompt}\n\nIdentify all distinct products/objects and extract ALL available information. Product names should be SHORT and CLEAN. Units must include quantity number + type.`
    : "Identify all distinct products or objects visible in this image. Extract ALL available information. Product names should be SHORT and CLEAN (no descriptions). Units must include quantity number + type (e.g., '1 Tube', '250ml Bottle'). Even if product names are not clearly visible, use visual cues, logos, and packaging to identify.";

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
      maxOutputTokens: 4096,
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
      timeout: 45000
    });

    const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error("No content returned from Gemini");
    }

    console.log("🔍 Raw Gemini multi-product response:", content.substring(0, 500));

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
      console.error("❌ Multi-product JSON parse failed:", parseError.message);
      parsed = { items: [] };
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    
    return items.map(item => {
      // Clean product name - remove long descriptions, keep it short
      let cleanName = item.productName || "";
      cleanName = cleanName
        .replace(/\s*-\s*(Daily|Protection|Strong|Healthy|Fresh|Mint|Flavor|Flavour).*$/i, "")
        .replace(/\s*\(.*?\)/g, "") // Remove parentheses content
        .replace(/\s+/g, " ")
        .trim();
      
      // Ensure unit has quantity number
      let cleanUnit = item.unit || "";
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
        productName: cleanName,
        brand: item.brand || "",
        category: item.category || "",
        unit: cleanUnit,
        description: item.description || "",
        mrp: typeof item.mrp === "number" ? String(item.mrp) : (item.mrp || ""),
        sellingPrice: typeof item.sellingPrice === "number" ? String(item.sellingPrice) : (item.sellingPrice || ""),
        variant: item.variant || "",
        hsnCode: item.hsnCode || "",
        gstRate: item.gstRate || "",
        confidence: typeof item.confidence === "number" 
          ? Math.max(0, Math.min(1, item.confidence)) 
          : 0.9
      };
    });
  } catch (error) {
    console.error("Gemini Multi-Product API Error:", error.message);
    if (error.response) {
      console.error("Gemini Response:", error.response.data);
    }
    throw error;
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

      // Use Gemini direct for multi-product identification
      try {
        console.log("🚀 Starting Gemini direct multi-product identification...");
        const products = await callGeminiMultipleDirect(b64, contextPrompt);
        
        console.log(`✅ Gemini Success: ${products.length} products found`);
        
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
          aiUsed: "gemini",
          aiSource: "gemini-2.0-flash-exp"
        });
      } catch (geminiError) {
        console.warn("⚠️ Gemini direct failed, trying HybridAI fallback:", geminiError.message);
        
        // Fallback to HybridAI
        try {
          const hybridAI = new HybridAI();
          const result = await hybridAI.identifyMultipleProducts(b64, contextPrompt);
          const products = result.primary || result.fallback || [];
          
          if (!products.length) {
            return res.status(200).json({ 
              success: false, 
              message: "No products identified in the image" 
            });
          }

          return res.status(200).json({
            success: true,
            ok: true,
            products,
            items: products,
            total: products.length,
            count: products.length,
            aiUsed: result.used || "hybrid-ai",
            aiSource: result.primary?.source || result.fallback?.source || "unknown"
          });
        } catch (aiError) {
          console.error("❌ All AI methods failed:", aiError.message);
          return res.status(500).json({
            success: false,
            message: "AI identification failed: " + aiError.message
          });
        }
      }
    } catch (error) {
      console.error("identifyProductsFromImage Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to identify multiple products",
      });
    }
    });
  }
);