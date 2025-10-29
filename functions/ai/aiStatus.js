const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const { getStatus, validateConfig } = require("../shared/aiConfig");
const HybridAI = require("../shared/hybridAI");

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

      const status = getStatus();
      const validation = validateConfig();
      
      // Test AI providers if requested
      if (req.query.test === "true") {
        const hybridAI = new HybridAI();
        const hybridStatus = hybridAI.getStatus();
        
        return res.status(200).json({
          success: true,
          status: {
            ...status,
            hybridAI: hybridStatus
          },
          validation,
          timestamp: new Date().toISOString()
        });
      }

      // Return basic status
      return res.status(200).json({
        success: true,
        status,
        validation,
        timestamp: new Date().toISOString(),
        usage: {
          gemini: "Set GEMINI_API_KEY environment variable",
          chatgpt: "Set OPENAI_API_KEY environment variable",
          toggle: "Set AI_PRIMARY=gemini or AI_PRIMARY=chatgpt"
        }
      });

    } catch (error) {
      console.error("AI Status Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to get AI status"
      });
    }
  });
});
