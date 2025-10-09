/****
 * imageIdentify.js
 * Client helpers for Magic Scan Cloud Functions (HTTP onRequest).
 *
 * Exports:
 *  - fileToBase64(file: File|Blob): Promise<string>
 *  - identifyProductFromImage({ base64?, imageBase64?, contextPrompt? }): Promise<{ ok, product, best, suggestions }>
 *  - identifyProductsFromImage({ base64?, imageBase64?, contextPrompt? }): Promise<{ ok, products, items, count, total }>
 */

/**
 * Convert a File or Blob to a base64 string (without the data URL prefix).
 * Uses downscaling for large images to keep payloads fast.
 */
export async function fileToBase64(file) {
  try {
    if (file && typeof window !== "undefined" && /image\//.test(file.type)) {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(new Error("File read error"));
        fr.readAsDataURL(file);
      });
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Image load error"));
        i.src = dataUrl;
      });
      const maxW = 768, maxH = 768;
      let { width, height } = img;
      const scale = Math.min(1, maxW / width, maxH / height);
      if (scale < 1) { width = Math.round(width * scale); height = Math.round(height * scale); }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const outUrl = canvas.toDataURL("image/jpeg", 0.72); // ~72% quality
      return outUrl.replace(/^data:[^;]+;base64,/, "");
    }
  } catch (e) {
    console.warn("fileToBase64 downscale path failed, falling back:", e?.message || e);
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("fileToBase64: invalid file/blob");
  }
  const arrayBuffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/** Strip any data: prefix so we send raw base64. */
function stripDataPrefix(b64) {
  if (!b64) return b64;
  return String(b64).trim().replace(/^data:[^;]+;base64,/, "");
}

/**
 * POST JSON with timeout + small retry. Returns parsed JSON (or throws).
 */
async function postJSON(url, data, { timeoutMs = 20000, retries = 1 } = {}) {
  const attempt = async (signal) => {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal,
    });
    let json = null;
    try { json = await resp.json(); } catch (_) { json = null; }
    if (!resp.ok) {
      const msg = (json && (json.error || json.message)) || `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    return json;
  };

  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const out = await attempt(controller.signal);
      clearTimeout(t);
      return out;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (i === retries) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr || new Error("Request failed");
}

// Cloud Functions host (configurable). Prefer runtime overrides, default to us-central1.
const FN_REGION =
  (typeof window !== "undefined" && window._SP_FN_REGION) ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FN_REGION) ||
  "us-central1";

const PROJECT_ID =
  (typeof window !== "undefined" && window._SP_PROJECT_ID) ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_PROJECT_ID) ||
  "stockpilotv1";

const FN_HOST =
  (typeof window !== "undefined" && window._SP_FN_HOST) ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_FN_HOST) ||
  `https://${FN_REGION}-${PROJECT_ID}.cloudfunctions.net`;

/**
 * Identify a single product from an image (HTTP JSON → { base64Image, contextPrompt }).
 * Returns both new fields and back-compat keys.
 */
export async function identifyProductFromImage(input = {}) {
  const { base64, imageBase64, contextPrompt = "" } = input || {};
  const b64 = stripDataPrefix(base64 || imageBase64 || "");
  if (!b64) {
    throw new Error("identifyProductFromImage: provide { base64 }");
  }

  const fnUrl = `${FN_HOST}/identifyProductFromImage`;
  const payload = { imageBase64: b64, contextPrompt };

  const data = await postJSON(fnUrl, payload, { timeoutMs: 25000, retries: 1 });
  const ok = data?.ok ?? data?.success ?? false;
  if (!ok) {
    const msg = data?.message || data?.error || "Image identify failed";
    throw new Error(msg);
  }

  // Normalize product fields from various server shapes
  const product =
    data.product ||
    data.best ||
    data.autofill ||
    {};

  return {
    ok: true,
    product,
    best: data.best || product,
    suggestions: data.suggestions || [],
    raw: data,
  };
}

/**
 * Identify multiple products from a single image (HTTP JSON → { base64Image, contextPrompt }).
 * Returns both new fields and back-compat keys.
 */
export async function identifyProductsFromImage(input = {}) {
  const { base64, imageBase64, contextPrompt = "" } = input || {};
  const b64 = stripDataPrefix(base64 || imageBase64 || "");
  if (!b64) {
    throw new Error("identifyProductsFromImage: provide { base64 }");
  }

  const fnUrl = `${FN_HOST}/identifyProductsFromImage`;
  const payload = { imageBase64: b64, contextPrompt };

  const data = await postJSON(fnUrl, payload, { timeoutMs: 40000, retries: 1 });
  const ok = data?.ok ?? data?.success ?? false;
  if (!ok) {
    const msg = data?.message || data?.error || "Multi identify failed";
    throw new Error(msg);
  }

  // Accept both { items: [...] } and { products: [...] }
  const products = Array.isArray(data.products)
    ? data.products
    : (Array.isArray(data.items) ? data.items : []);

  const total = Number(
    data.total !== undefined ? data.total :
    data.count !== undefined ? data.count :
    products.length
  );

  return {
    ok: true,
    products,
    items: products, // back-compat alias
    count: total,    // back-compat alias
    total,
    raw: data,
  };
}