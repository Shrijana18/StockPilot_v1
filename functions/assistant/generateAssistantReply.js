

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

/**
 * Callable: generateAssistantReply
 * Input: { prompt: string, role?: string, source?: string }
 * Output: { success, reply, replyTimestamp }
 * 
 * Reads prompt (either passed directly or from Firestore), 
 * sends it to OpenAI (or Gemini fallback), 
 * and returns AI-generated response.
 */
module.exports = onCall(async (request) => {
  try {
    const { prompt, role = "Retailer", source = "dashboard" } = request.data || {};
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      throw new Error("Invalid or missing prompt");
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const endpoint = "https://api.openai.com/v1/chat/completions";

    const systemPrompt = `
You are FLYP Assistant — an AI that helps retailers, distributors, and product owners
manage billing, inventory, customers, and analytics in India’s supply chain ecosystem.
Be concise, practical, and business-aware. Reply conversationally but with precision.
If question relates to GST, billing, or inventory, provide contextual advice and avoid disclaimers.
`;

    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Role: ${role}\nSource: ${source}\n\nQuery:\n${prompt}` },
      ],
      temperature: 0.3,
    };

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });

    const reply =
      response.data?.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I couldn't generate a response.";

    // Optionally log or save to Firestore
    const db = admin.firestore();
    const uid = request.auth?.uid || "system";
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("assistantQueries").add({
      userId: uid,
      role,
      source,
      prompt,
      reply,
      createdAt: timestamp,
    });

    return {
      success: true,
      reply,
      replyTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("generateAssistantReply Error:", error);
    return {
      success: false,
      message: error.message || "Failed to generate assistant reply",
    };
  }
});