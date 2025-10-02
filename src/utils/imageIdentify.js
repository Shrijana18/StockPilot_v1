/****
 * imageIdentify.js
 * Client helpers for Magic Scan Cloud Functions.
 *
 * Exports:
 *  - fileToBase64(file: File|Blob): Promise<string>
 *  - identifyProductFromImage({ base64?, url?, barcode?, framesBase64? }): Promise<{ ok, best, autofill, suggestions }>
 *  - identifyProductsFromImage({ base64?, imageUrl?, maxProducts?, allowVision? }): Promise<{ ok, count, items }>
 */

/**
 * Convert a File or Blob to a base64 string (without the data URL prefix).
 * Uses chunking to avoid stack limits.
 */
export async function fileToBase64(file) {
  // Prefer client-side downscale for images to avoid huge payloads (which can 500 the function)
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
      const maxW = 1200, maxH = 1200; // keep close to live frame dimensions
      let { width, height } = img;
      const scale = Math.min(1, maxW / width, maxH / height);
      if (scale < 1) { width = Math.round(width * scale); height = Math.round(height * scale); }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const outUrl = canvas.toDataURL("image/jpeg", 0.8); // compress to ~80% quality
      return outUrl.replace(/^data:[^;]+;base64,/, "");
    }
  } catch (e) {
    console.warn("fileToBase64 downscale path failed, falling back:", e?.message || e);
  }

  // Fallback path (non-images or if Canvas/DOM unavailable)
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("fileToBase64: invalid file/blob");
  }
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (e) {
    throw new Error("fileToBase64: failed to read file");
  }
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // ~32KB chunks to avoid call stack issues
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/** Ensure we send raw base64 (strip data: prefix if present). */
function stripDataPrefix(b64) {
  if (!b64) return b64;
  return String(b64).trim().replace(/^data:[^;]+;base64,/, "");
}

/**
 * POST JSON with timeout + small retry. Returns parsed JSON (or throws).
 */
async function postJSON(url, data, { timeoutMs = 15000, retries = 1 } = {}) {
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
      // brief backoff
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr || new Error("Request failed");
}

// Cloud Functions host (can be overridden at runtime if needed)
const FN_HOST = (() => {
  const w = typeof window !== "undefined" ? window : undefined;
  const fromWindow = w && (w._SP_FN_HOST || w.NEXT_PUBLIC_FN_HOST);
  const fromEnv =
    typeof process !== "undefined" && process && process.env
      ? process.env.NEXT_PUBLIC_FN_HOST
      : undefined;
  return fromWindow || fromEnv || "https://asia-south1-stockpilotv1.cloudfunctions.net";
})();

/**
 * Identify a single product from an image frame. Provide either base64 (preferred) or public URL.
 * Returns `{ ok, best, autofill, suggestions }` from the Cloud Function.
 */
export async function identifyProductFromImage(input = {}) {
  // Accept both legacy and new param names
  const {
    base64,
    imageBase64,
    url,
    imageUrl,
    barcode,
    framesBase64,
  } = input || {};

  const b64 = stripDataPrefix(base64 || imageBase64 || "");
  const imgUrl = url || imageUrl || "";

  if (!b64 && !imgUrl && !(Array.isArray(framesBase64) && framesBase64.length)) {
    throw new Error("identifyProductFromImage: provide { base64 } or { url } or { framesBase64[] }");
  }

  const fnUrl = `${FN_HOST}/identifyProductFromImage`;
  let payload;
  if (Array.isArray(framesBase64) && framesBase64.length) {
    payload = { framesBase64, barcode };
  } else {
    payload = b64 ? { imageBase64: b64, barcode } : { imageUrl: imgUrl, barcode };
  }

  const json = await postJSON(fnUrl, payload, { timeoutMs: 22000, retries: 1 });
  if (!json?.ok) {
    const msg = json?.error || "Image identify failed";
    throw new Error(msg);
  }
  return {
    ok: true,
    best: json.best || {},
    // Prefer normalized fields from best; fallback to autofill when needed
    autofill: {
      ...json.autofill,
      hsn: json.best?.hsn ?? json.autofill?.hsn,
      gst: json.best?.gst ?? json.autofill?.gst,
      unit: json.best?.unit ?? json.autofill?.unit,
      brand: json.best?.brand ?? json.autofill?.brand,
      productName: json.best?.productName ?? json.autofill?.productName,
      variant: json.best?.variant ?? json.autofill?.variant, // <-- added variant
      mrp: json.best?.mrp ?? json.autofill?.mrp,
      category: json.best?.category ?? json.autofill?.category,
      sku: json.best?.code ?? json.autofill?.sku ?? json.autofill?.barcode,
    },
    suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
    // Optional telemetry passthroughs from backend (if present)
    scanId: json.scanId || json.scan_id || null,
    imagePath: json.imagePath || json.image_path || null,
    phash: json.phash || null,
    ocrHash: json.ocrHash || null,
  };
}

/**
 * Identify multiple products from a single image frame (multi-scan).
 * Params: { base64?, imageUrl?, maxProducts? }
 * Returns `{ ok, count, items: [...] }`.
 */
export async function identifyProductsFromImage(input = {}) {
  const {
    base64,
    imageBase64,
    imageUrl,
    url,
    maxProducts = 12,
    // Multi-scan should never use GPT path
    allowVision = false,
  } = input || {};

  const b64 = stripDataPrefix(base64 || imageBase64 || "");
  const imgUrl = imageUrl || url || "";

  if (!b64 && !imgUrl) {
    throw new Error("identifyProductsFromImage: provide base64 or imageUrl");
  }
  const fnUrl = `${FN_HOST}/identifyProductsFromImage`;
  const payload = b64 ? { imageBase64: b64, maxProducts, allowVision } : { imageUrl: imgUrl, maxProducts, allowVision };

  const json = await postJSON(fnUrl, payload, { timeoutMs: 30000, retries: 1 });
  if (!json?.ok) {
    const msg = json?.error || "Multi identify failed";
    throw new Error(msg);
  }
  return json; // { ok, count, items }
}