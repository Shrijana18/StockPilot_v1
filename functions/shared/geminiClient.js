const axios = require("axios");
const functions = require("firebase-functions");

/**
 * Google Gemini Studio Client for Product Identification
 * Uses Gemini 1.5 Pro for multimodal analysis with fallback to ChatGPT
 */

class GeminiClient {
  constructor() {
    // Try environment variable first, then Firebase config, then hardcoded fallback
    this.apiKey = process.env.GEMINI_API_KEY || 
                  (typeof functions !== 'undefined' ? functions.config().gemini?.api_key : null) ||
                  "AIzaSyBSCZAPuxQ_VcqpGUsHgraHlX5r8Rxrvkw";
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    this.model = process.env.GEMINI_MODEL || 
                  (typeof functions !== 'undefined' ? functions.config().gemini?.model : null) ||
                  "gemini-2.5-flash";
    this.fallbackEnabled = process.env.ENABLE_CHATGPT_FALLBACK !== "false";
    
    console.log("🔑 Gemini API Key loaded:", this.apiKey ? "✅ Yes" : "❌ No");
  }

  /**
   * Call Gemini API for product identification
   */
  async identifyProduct(imageBase64, textContext = "") {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const systemPrompt = `You are an expert Indian retail product identifier with advanced AI vision capabilities. Use visual analysis, brand recognition, and packaging intelligence to identify products.

Return ONLY a strict JSON object with this exact schema:
{
  "name": "Complete Product Name",
  "brand": "Brand Name", 
  "unit": "Quantity and Container (e.g., '250 ml Bottle')",
  "category": "Product Category",
  "sku": "Barcode/SKU if visible",
  "mrp": "Maximum Retail Price (numeric value only)",
  "sellingPrice": "Selling Price (numeric value only)",
  "hsn": "HSN Code if visible",
  "gst": "GST Rate (numeric value only)",
  "variant": "Product Variant/Size",
  "confidence": 0.95
}

Advanced AI Rules:
- Use visual cues, colors, shapes, and packaging design for identification
- Recognize Indian brands: Dabur, Himalaya, Patanjali, Hindustan Unilever, P&G, etc.
- Identify product categories: Medicine, Food & Beverages, Personal Care, Home Care, Electronics
- Extract pricing from MRP labels, price tags, or packaging text
- Determine quantity and unit from packaging (ml, gm, kg, pieces, tablets, etc.)
- 'name' should be descriptive and complete (e.g., "Paracetamol 500mg Tablets Strip of 10")
- 'unit' must include quantity and container (e.g., "10 tablets", "500ml bottle", "1kg pack")
- 'mrp' should be the printed MRP value (extract only numbers, e.g., "120" for "MRP ₹120.00")
- 'sellingPrice' should be any selling price if different from MRP
- 'variant' should describe size, flavor, or type (e.g., "500mg", "Mint flavor", "Family pack")
- 'confidence' should be between 0.8-1.0 based on clarity of identification
- For HSN/GST, only include if clearly visible and confident
- Focus on Indian retail products and packaging standards
- No commentary, explanations, or markdown formatting`;

    const userPrompt = textContext 
      ? `Identify the product in this image using the context: ${textContext}`
      : "Identify the product in this image";

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
        topK: 32,
        topP: 0.8,
        maxOutputTokens: 1024,
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

      console.log("🔍 Raw Gemini response:", content);

      // Clean and fix common JSON issues
      let cleanedContent = content.trim();
      
      // Remove any markdown code blocks
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Fix common JSON issues
      cleanedContent = cleanedContent
        .replace(/'/g, '"')  // Replace single quotes with double quotes
        .replace(/(\w+):/g, '"$1":')  // Add quotes around property names
        .replace(/,\s*}/g, '}')  // Remove trailing commas before closing braces
        .replace(/,\s*]/g, ']'); // Remove trailing commas before closing brackets

      console.log("🔧 Cleaned JSON:", cleanedContent);

      let parsed;
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("❌ JSON parse failed:", parseError.message);
        console.error("❌ Content that failed to parse:", cleanedContent);
        
        // Fallback: try to extract basic info with regex
        const nameMatch = cleanedContent.match(/"name"\s*:\s*"([^"]+)"/);
        const brandMatch = cleanedContent.match(/"brand"\s*:\s*"([^"]+)"/);
        const categoryMatch = cleanedContent.match(/"category"\s*:\s*"([^"]+)"/);
        
        parsed = {
          name: nameMatch ? nameMatch[1] : "",
          brand: brandMatch ? brandMatch[1] : "",
          category: categoryMatch ? categoryMatch[1] : "",
          unit: "",
          sku: "",
          mrp: "",
          hsn: "",
          gst: null
        };
        
        console.log("🔄 Using fallback parsing:", parsed);
      }
      
      // Validate and clean the response
      return {
        name: parsed.name || "",
        brand: parsed.brand || "",
        unit: parsed.unit || "",
        category: parsed.category || "",
        sku: parsed.sku || "",
        mrp: typeof parsed.mrp === "number" ? String(parsed.mrp) : (parsed.mrp || ""),
        sellingPrice: typeof parsed.sellingPrice === "number" ? String(parsed.sellingPrice) : (parsed.sellingPrice || ""),
        hsn: parsed.hsn || "",
        gst: parsed.gst || null,
        variant: parsed.variant || "",
        source: "gemini-2.5-flash",
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
   * Call Gemini API for multiple product identification
   */
  async identifyMultipleProducts(imageBase64, contextPrompt = "") {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const systemPrompt = `You are an expert multi-product detection AI with advanced vision capabilities for Indian retail. Use visual analysis and brand recognition to identify all distinct products.

Return ONLY a strict JSON object:
{
  "items": [
    {
      "productName": "Complete Product Name",
      "brand": "Brand Name",
      "category": "Product Category", 
      "unit": "Quantity and Container",
      "mrp": "Maximum Retail Price (numeric value only)",
      "sellingPrice": "Selling Price (numeric value only)",
      "variant": "Product Variant/Size",
      "hsnCode": "HSN Code if visible",
      "gstRate": "GST Rate if visible",
      "confidence": 0.95
    }
  ]
}

Advanced AI Rules:
- Use visual cues, colors, shapes, and packaging design for identification
- Recognize Indian brands: Dabur, Himalaya, Patanjali, Hindustan Unilever, P&G, etc.
- Identify product categories: Medicine, Food & Beverages, Personal Care, Home Care, Electronics
- Extract pricing from MRP labels, price tags, or packaging text
- Determine quantity and unit from packaging (ml, gm, kg, pieces, tablets, etc.)
- 'productName' should be descriptive and complete
- 'unit' must include quantity and container (e.g., "10 tablets", "500ml bottle", "1kg pack")
- 'mrp' should be the printed MRP value (extract only numbers)
- 'sellingPrice' should be any selling price if different from MRP
- 'variant' should describe size, flavor, or type
- 'confidence' must be between 0.8-1.0 based on clarity of identification
- Identify all distinct retail products in the image
- Avoid duplicate items
- Focus on Indian retail products and packaging standards
- No commentary or markdown`;

    const userPrompt = contextPrompt 
      ? `Use this context: ${contextPrompt}`
      : "Identify all distinct retail products visible in this image";

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
        topK: 32,
        topP: 0.8,
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
        timeout: 45000
      });

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error("No content returned from Gemini");
      }

      console.log("🔍 Raw Gemini multi-product response:", content);

      // Clean and fix common JSON issues
      let cleanedContent = content.trim();
      
      // Remove any markdown code blocks
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Fix common JSON issues
      cleanedContent = cleanedContent
        .replace(/'/g, '"')  // Replace single quotes with double quotes
        .replace(/(\w+):/g, '"$1":')  // Add quotes around property names
        .replace(/,\s*}/g, '}')  // Remove trailing commas before closing braces
        .replace(/,\s*]/g, ']'); // Remove trailing commas before closing brackets

      console.log("🔧 Cleaned multi-product JSON:", cleanedContent);

      let parsed;
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("❌ Multi-product JSON parse failed:", parseError.message);
        console.error("❌ Content that failed to parse:", cleanedContent);
        
        // Fallback: return empty array
        parsed = { items: [] };
        console.log("🔄 Using fallback: empty products array");
      }

      const items = Array.isArray(parsed.items) ? parsed.items : [];
      
      // Validate and clean each item
      return items.map(item => ({
        productName: item.productName || "",
        brand: item.brand || "",
        category: item.category || "",
        unit: item.unit || "",
        mrp: typeof item.mrp === "number" ? String(item.mrp) : (item.mrp || ""),
        sellingPrice: typeof item.sellingPrice === "number" ? String(item.sellingPrice) : (item.sellingPrice || ""),
        variant: item.variant || "",
        hsnCode: item.hsnCode || "",
        gstRate: item.gstRate || "",
        confidence: typeof item.confidence === "number" 
          ? Math.max(0, Math.min(1, item.confidence)) 
          : 0.9
      }));

    } catch (error) {
      console.error("Gemini Multi-Product API Error:", error.message);
      if (error.response) {
        console.error("Gemini Response:", error.response.data);
      }
      throw error;
    }
  }

  /**
   * Check if Gemini is available and configured
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      model: this.model,
      provider: "google",
      available: this.isAvailable(),
      fallbackEnabled: this.fallbackEnabled
    };
  }
}

module.exports = GeminiClient;
