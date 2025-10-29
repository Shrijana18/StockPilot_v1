const GeminiClient = require("./geminiClient");
const axios = require("axios");

/**
 * Hybrid AI Client - Gemini Primary, ChatGPT Fallback
 * Provides the best of both worlds for product identification
 */

class HybridAI {
  constructor() {
    this.gemini = new GeminiClient();
    this.chatgptEnabled = !!process.env.OPENAI_API_KEY;
    this.preferGemini = process.env.PREFER_GEMINI !== "false";
    this.fallbackEnabled = process.env.ENABLE_CHATGPT_FALLBACK !== "false";
    
    console.log("🤖 Hybrid AI initialized:", {
      geminiAvailable: this.gemini.isAvailable(),
      chatgptEnabled: this.chatgptEnabled,
      preferGemini: this.preferGemini,
      fallbackEnabled: this.fallbackEnabled
    });
  }

  /**
   * Identify single product with hybrid approach
   */
  async identifyProduct(imageBase64, textContext = "") {
    const results = {
      primary: null,
      fallback: null,
      used: null,
      error: null
    };

    // Try Gemini first if available
    if (this.gemini.isAvailable()) {
      try {
        console.log("🔍 Trying Gemini for product identification...");
        results.primary = await this.gemini.identifyProduct(imageBase64, textContext);
        results.used = "gemini";
        console.log("✅ Gemini success:", results.primary.name);
        return results;
      } catch (error) {
        console.warn("⚠️ Gemini failed:", error.message);
        results.error = error.message;
      }
    }

    // Try ChatGPT as fallback if available
    if (this.chatgptEnabled) {
      try {
        console.log("🔍 Trying ChatGPT for product identification...");
        results.primary = await this.callChatGPT(imageBase64, textContext);
        results.used = "chatgpt";
        console.log("✅ ChatGPT success:", results.primary.name);
        return results;
      } catch (error) {
        console.warn("⚠️ ChatGPT failed:", error.message);
        results.error = error.message;
      }
    }

    // If we have any result, return it
    if (results.primary || results.fallback) {
      return results;
    }

    // Both failed
    throw new Error(`AI services failed. Gemini: ${results.error || 'N/A'}, ChatGPT: ${results.error || 'N/A'}`);
  }

  /**
   * Identify multiple products with hybrid approach
   */
  async identifyMultipleProducts(imageBase64, contextPrompt = "") {
    const results = {
      primary: null,
      fallback: null,
      used: null,
      error: null
    };

    // Try Gemini first if preferred and available
    if (this.preferGemini && this.gemini.isAvailable()) {
      try {
        console.log("🔍 Trying Gemini for multi-product identification...");
        results.primary = await this.gemini.identifyMultipleProducts(imageBase64, contextPrompt);
        results.used = "gemini";
        console.log(`✅ Gemini success: ${results.primary.length} products found`);
        return results;
      } catch (error) {
        console.warn("⚠️ Gemini failed:", error.message);
        results.error = error.message;
      }
    }

    // Try ChatGPT as primary or fallback
    if (this.chatgptEnabled) {
      try {
        console.log("🔍 Trying ChatGPT for multi-product identification...");
        results.primary = await this.callChatGPTMultiple(imageBase64, contextPrompt);
        results.used = "chatgpt";
        console.log(`✅ ChatGPT success: ${results.primary.length} products found`);
        return results;
      } catch (error) {
        console.warn("⚠️ ChatGPT failed:", error.message);
        results.error = error.message;
      }
    }

    // If both failed, try the other as fallback
    if (this.fallbackEnabled) {
      if (results.used === "gemini" && this.chatgptEnabled) {
        try {
          console.log("🔄 Trying ChatGPT as fallback...");
          results.fallback = await this.callChatGPTMultiple(imageBase64, contextPrompt);
          results.used = "chatgpt-fallback";
          console.log(`✅ ChatGPT fallback success: ${results.fallback.length} products found`);
          return results;
        } catch (error) {
          console.warn("⚠️ ChatGPT fallback failed:", error.message);
        }
      } else if (results.used === "chatgpt" && this.gemini.isAvailable()) {
        try {
          console.log("🔄 Trying Gemini as fallback...");
          results.fallback = await this.gemini.identifyMultipleProducts(imageBase64, contextPrompt);
          results.used = "gemini-fallback";
          console.log(`✅ Gemini fallback success: ${results.fallback.length} products found`);
          return results;
        } catch (error) {
          console.warn("⚠️ Gemini fallback failed:", error.message);
        }
      }
    }

    // Both failed
    throw new Error(`Both AI services failed. Gemini: ${results.error || 'N/A'}, ChatGPT: ${results.error || 'N/A'}`);
  }

  /**
   * Call ChatGPT for single product identification
   */
  async callChatGPT(imageBase64, textContext) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    const endpoint = "https://api.openai.com/v1/chat/completions";

    const systemPrompt = `You are an expert product identification AI for the Indian retail market. Analyze the product image and the provided text context. Return ONLY a strict JSON object with this exact schema: { "name": "", "brand": "", "unit": "", "category": "", "sku": "", "mrp": "", "hsn": "", "gst": null }.
Rules:
- 'name' should be the canonical product name.
- 'unit' must include quantity and container (e.g., "250 ml Bottle").
- 'sku' should be the barcode if available.
- 'mrp' is the Maximum Retail Price. If "MRP" is explicitly written, use that value. If not, use any other visible selling price. Extract only the numeric value (e.g., for "MRP ₹120.00", return "120"). If no price is visible, leave it as an empty string.
- Guess HSN/GST if confident, otherwise leave as empty string or null.
- Be brief and accurate. No commentary or markdown.`;

    const userPrompt = `Identify the product in the image using this context:\n${textContext || ""}`;

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
                detail: "low",
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      top_p: 0.2,
      max_tokens: 600,
    };

    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 25000,
    });

    const reply = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("No response from ChatGPT");

    const parsed = JSON.parse(reply);
    if (typeof parsed.mrp === "number") parsed.mrp = String(parsed.mrp);
    
    return {
      name: parsed.name || "",
      brand: parsed.brand || "",
      unit: parsed.unit || "",
      category: parsed.category || "",
      sku: parsed.sku || "",
      mrp: parsed.mrp || "",
      hsn: parsed.hsn || "",
      gst: parsed.gst || null,
      source: "gpt-4o",
      confidence: 0.9
    };
  }

  /**
   * Call ChatGPT for multiple product identification
   */
  async callChatGPTMultiple(imageBase64, contextPrompt) {
    const apiKey = process.env.OPENAI_API_KEY;
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

    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } }
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      top_p: 0.2,
      max_tokens: 900,
    };

    const response = await axios.post(endpoint, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 45000,
    });

    const reply = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("No response from ChatGPT");

    const parsed = JSON.parse(reply);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    
    return items.map(item => ({
      productName: item.productName || "",
      brand: item.brand || "",
      category: item.category || "",
      unit: item.unit || "",
      hsnCode: item.hsnCode || "",
      gstRate: item.gstRate || "",
      confidence: typeof item.confidence === "number" 
        ? Math.max(0, Math.min(1, item.confidence)) 
        : 0.9
    }));
  }

  /**
   * Get service status and configuration
   */
  getStatus() {
    return {
      gemini: {
        available: this.gemini.isAvailable(),
        model: this.gemini.getModelInfo().model
      },
      chatgpt: {
        available: this.chatgptEnabled,
        model: process.env.OPENAI_MODEL || "gpt-4o"
      },
      preferGemini: this.preferGemini,
      fallbackEnabled: this.fallbackEnabled
    };
  }
}

module.exports = HybridAI;
