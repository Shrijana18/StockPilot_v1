/****
 * imageIdentify.js
 * Tiny client helper to call the Cloud Function that extracts product details from an image.
 *
 * Functions:
 *  - fileToBase64(file: File): Promise<string>  -> converts a File/Blob to base64 (no data: prefix)
 *  - identifyProductFromImage({ base64?: string, url?: string }): Promise<{ ok: true, best, suggestions }>
 *
 * The Cloud Function returns:
 *  {
 *    ok: true,
 *    best: {
 *      productName, brand, category, size, sku, unit, mrp, price, hsn, gst, description, source, confidence
 *    },
 *    autofill: {
 *      productName, brand, category, sku, unit, hsn, gst, price, mrp, description
 *    },
 *    suggestions: string[]
 *  }
 */

/**
 * Convert a File or Blob to a base64 string (without the data URL prefix).
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // avoid call stack limits
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Call the identifyProductFromImage Cloud Function.
 * Provide either a raw base64 image (recommended) or a public URL.
 * @param {{ base64?: string, url?: string }} param0
 * @returns {Promise<any>} Cloud Function JSON ({ ok, best, autofill, suggestions })
 */
export async function identifyProductFromImage({ base64, url } = {}) {
  if (!base64 && !url) {
    throw new Error("identifyProductFromImage: provide either { base64 } or { url }");
  }

  const fnUrl = "https://asia-south1-stockpilotv1.cloudfunctions.net/identifyProductFromImage";
  const payload = base64 ? { imageBase64: base64 } : { imageUrl: url };

  const resp = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.ok) {
    const msg = json?.error || `Image identify failed (${resp.status})`;
    throw new Error(msg);
  }

  return {
    ok: json?.ok === true,
    best: json?.best || {},
    autofill: json?.autofill || {},
    suggestions: Array.isArray(json?.suggestions) ? json.suggestions : []
  };
}