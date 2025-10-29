/**
 * AI Configuration for Product Identification
 * Easy switching between Gemini and ChatGPT with environment variables
 */

const aiConfig = {
  // Primary AI Provider (gemini or chatgpt)
  primary: process.env.AI_PRIMARY || "gemini",
  
  // Fallback AI Provider (gemini or chatgpt)
  fallback: process.env.AI_FALLBACK || "chatgpt",
  
  // Enable fallback when primary fails
  enableFallback: process.env.AI_ENABLE_FALLBACK !== "false",
  
  // Gemini Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    enabled: !!process.env.GEMINI_API_KEY,
    timeout: parseInt(process.env.GEMINI_TIMEOUT) || 30000,
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 1024
  },
  
  // ChatGPT Configuration
  chatgpt: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o",
    enabled: !!process.env.OPENAI_API_KEY,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 25000,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 600
  },
  
  // Performance Settings
  performance: {
    // Cache results for this many seconds
    cacheSeconds: parseInt(process.env.AI_CACHE_SECONDS) || 3600,
    
    // Retry failed requests this many times
    maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 2,
    
    // Retry delay in milliseconds
    retryDelay: parseInt(process.env.AI_RETRY_DELAY) || 1000
  }
};

/**
 * Get the current AI configuration
 */
function getConfig() {
  return {
    ...aiConfig,
    // Add computed properties
    isGeminiAvailable: aiConfig.gemini.enabled,
    isChatGPTAvailable: aiConfig.chatgpt.enabled,
    hasAnyAI: aiConfig.gemini.enabled || aiConfig.chatgpt.enabled,
    preferredProvider: aiConfig.primary === "gemini" && aiConfig.gemini.enabled ? "gemini" : 
                      aiConfig.primary === "chatgpt" && aiConfig.chatgpt.enabled ? "chatgpt" :
                      aiConfig.gemini.enabled ? "gemini" : 
                      aiConfig.chatgpt.enabled ? "chatgpt" : null
  };
}

/**
 * Validate AI configuration
 */
function validateConfig() {
  const config = getConfig();
  const errors = [];
  
  if (!config.hasAnyAI) {
    errors.push("No AI providers configured. Set GEMINI_API_KEY or OPENAI_API_KEY");
  }
  
  if (config.primary === "gemini" && !config.isGeminiAvailable) {
    errors.push("Primary AI is set to Gemini but GEMINI_API_KEY is not configured");
  }
  
  if (config.primary === "chatgpt" && !config.isChatGPTAvailable) {
    errors.push("Primary AI is set to ChatGPT but OPENAI_API_KEY is not configured");
  }
  
  if (config.fallback === "gemini" && !config.isGeminiAvailable) {
    errors.push("Fallback AI is set to Gemini but GEMINI_API_KEY is not configured");
  }
  
  if (config.fallback === "chatgpt" && !config.isChatGPTAvailable) {
    errors.push("Fallback AI is set to ChatGPT but OPENAI_API_KEY is not configured");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    config
  };
}

/**
 * Get AI provider status
 */
function getStatus() {
  const config = getConfig();
  const validation = validateConfig();
  
  return {
    valid: validation.valid,
    errors: validation.errors,
    providers: {
      gemini: {
        enabled: config.isGeminiAvailable,
        model: config.gemini.model,
        configured: !!config.gemini.apiKey
      },
      chatgpt: {
        enabled: config.isChatGPTAvailable,
        model: config.chatgpt.model,
        configured: !!config.chatgpt.apiKey
      }
    },
    settings: {
      primary: config.primary,
      fallback: config.fallback,
      enableFallback: config.enableFallback,
      preferredProvider: config.preferredProvider
    }
  };
}

module.exports = {
  aiConfig,
  getConfig,
  validateConfig,
  getStatus
};
