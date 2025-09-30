// Lightweight client helper to call the Cloud Function that looks up product metadata by barcode.
// Returns: { code, productName, brand, category, size, imageUrl, source }
export async function lookupBarcode(code) {
  const fnUrl = "https://asia-south1-stockpilotv1.cloudfunctions.net/lookupBarcode";
  const resp = await fetch(fnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.ok) {
    const msg = json?.error || `Lookup failed (${resp.status})`;
    throw new Error(msg);
  }
  return json.data;
}
