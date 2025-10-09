

const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

if (!OPENAI_API_KEY) {
  console.warn("[aiClient] OPENAI_API_KEY is not set. Functions depending on AI will fail.");
}

const DEFAULT_TIMEOUT = 25000;
const RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripCodeFences(text = "") {
  let t = String(text).trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(json|markdown|md|table|text)?/i, "").replace(/```$/i, "").trim();
  }
  // Remove stray fences anywhere
  t = t.replace(/```(json|markdown|md|table|text)?/gi, "");
  return t;
}

function tryParseJSON(text) {
  if (!text) return null;
  // direct attempt
  try { return JSON.parse(text); } catch {}
  // extract first JSON object/array
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  return null;
}

async function requestOpenAI(payload, { timeout = DEFAULT_TIMEOUT, retries = 2 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      const res = await axios.post(OPENAI_ENDPOINT, payload, {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout,
      });
      return res.data?.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      const status = err?.response?.status;
      attempt++;
      const canRetry = RETRY_STATUSES.has(status) && attempt <= retries;
      if (canRetry) {
        const backoff = 600 * attempt + Math.floor(Math.random() * 300);
        console.warn(`[aiClient] OpenAI ${status} - retrying in ${backoff}ms (attempt ${attempt}/${retries})`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

/**
 * chat: free-form assistant reply
 * @param {string} system
 * @param {string} user
 * @param {object} opts { model, temperature, timeout, retries }
 * @returns {string} content
 */
async function chat(system, user, opts = {}) {
  const model = opts.model || OPENAI_MODEL;
  const payload = {
    model,
    temperature: opts.temperature ?? 0.3,
    messages: [
      { role: "system", content: system || "" },
      { role: "user", content: user || "" },
    ],
  };
  const text = await requestOpenAI(payload, opts);
  return text;
}

/**
 * json: ask model to return JSON only; parses & returns JS object.
 * @param {string} system
 * @param {string} user
 * @param {object} opts { schemaHint, model, temperature }
 * @returns {object|null}
 */
async function json(system, user, opts = {}) {
  const model = opts.model || OPENAI_MODEL;
  const schemaHint = opts.schemaHint
    ? `\nReturn STRICT JSON matching this schema hint:\n${opts.schemaHint}\nDo not add commentary or code fences.`
    : `\nReturn STRICT JSON only. No code fences, no prose.`;

  const payload = {
    model,
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: "system", content: `${system || ""}${schemaHint}`.trim() },
      { role: "user", content: user || "" },
    ],
  };

  const raw = await requestOpenAI(payload, opts);
  const clean = stripCodeFences(raw);
  const parsed = tryParseJSON(clean);
  return parsed;
}

/**
 * multimodal: send image (base64) + text
 * @param {string} system
 * @param {string} text
 * @param {string} base64Image (jpeg/png)
 * @param {object} opts { model, temperature }
 * @returns {string} content
 */
async function multimodal(system, text, base64Image, opts = {}) {
  const model = opts.model || OPENAI_MODEL;
  const payload = {
    model,
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: "system", content: system || "" },
      {
        role: "user",
        content: [
          { type: "text", text: text || "" },
          { type: "image_url", image_url: `data:image/jpeg;base64,${base64Image}` },
        ],
      },
    ],
  };
  const raw = await requestOpenAI(payload, opts);
  return raw;
}

module.exports = {
  chat,
  json,
  multimodal,
  _utils: { stripCodeFences, tryParseJSON, requestOpenAI },
};