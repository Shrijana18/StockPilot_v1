// Lightweight client helper to call the Cloud Function that looks up product metadata by barcode.
// Returns: { code, productName, brand, category, size, imageUrl, source }
const isDev = import.meta.env?.DEV === true;

const BARCODE_LOOKUP_URL = isDev
  ? '/api/lookupBarcode' // only works in `npm run dev` with Vite proxy
  : 'https://asia-south1-stockpilotv1.cloudfunctions.net/lookupBarcode';

// Small helper to avoid white-screen hangs on iOS if a request never resolves
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 15000, ...rest } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(resource, { ...rest, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function lookupBarcode(code) {
  if (!code) throw new Error('No barcode provided');

  let resp;
  try {
    resp = await fetchWithTimeout(BARCODE_LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      timeout: 15000,
    });
  } catch (e) {
    // Surface a clean, actionable error (helps avoid silent white screens in WKWebView)
    if (e?.name === 'AbortError') {
      throw new Error('Barcode lookup timed out. Please check your connection and try again.');
    }
    throw new Error(`Network error during barcode lookup: ${e?.message || e}`);
  }

  // Attempt to parse JSON safely
  let json = {};
  try {
    json = await resp.json();
  } catch (_) {
    // no-op, handled below
  }

  if (!resp.ok || json?.ok === false) {
    const msg = json?.error || `Lookup failed (${resp.status})`;
    throw new Error(msg);
  }

  if (!json?.data) {
    throw new Error('Lookup response missing data');
  }

  return json.data;
}
