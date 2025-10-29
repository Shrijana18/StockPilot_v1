// Lightweight client helper to call the Cloud Function that looks up product metadata by barcode.
// Returns: { code, productName, brand, category, size, imageUrl, source }
import apiClient from "../lib/apiClient";

const isDev = import.meta.env?.DEV === true;

const FN_REGION = (typeof window !== "undefined" && window._SP_FN_REGION) || (import.meta.env?.VITE_FN_REGION) || "us-central1";
const PROJECT_ID = (typeof window !== "undefined" && window._SP_PROJECT_ID) || (import.meta.env?.VITE_PROJECT_ID) || "stockpilotv1";
const BARCODE_LOOKUP_URL = isDev
  ? "/api/lookupBarcode"
  : `https://${FN_REGION}-${PROJECT_ID}.cloudfunctions.net/lookupBarcode`;

export async function lookupBarcode(code) {
  if (!code) throw new Error('No barcode provided');

  try {
    const json = await apiClient.post(BARCODE_LOOKUP_URL, { code }, { timeoutMs: 15000, retries: 1 });
    if (json?.ok === false) {
      const msg = json?.error || json?.message || 'Lookup failed';
      throw new Error(msg);
    }
    if (!json?.data && !json?.product) {
      throw new Error('Lookup response missing data');
    }
    return json.data || json.product;
  } catch (e) {
    const msg = e?.message || String(e);
    if (/abort/i.test(msg)) {
      throw new Error('Barcode lookup timed out. Please check your connection and try again.');
    }
    throw new Error(`Network error during barcode lookup: ${msg}`);
  }
}
