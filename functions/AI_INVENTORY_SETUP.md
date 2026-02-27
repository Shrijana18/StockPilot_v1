# AI Inventory Generator Setup Guide (Gemini)

## Two separate Google API keys

- **GEMINI_API_KEY** – Used for Gemini (Generative Language API): AI inventory “Magic Generate”, product identification, and **AI Catalogue Parser** (Parse with AI). Set via `firebase functions:secrets:set GEMINI_API_KEY`.
- **GOOGLE_API_KEY** – Used for **other** Google APIs: Custom Search (CSE), Maps, etc. Set via `firebase functions:secrets:set GOOGLE_API_KEY`. Frontend can use `VITE_GOOGLE_API_KEY` for Custom Search / Maps.

Do not use the same key for both. Gemini requires a key with Generative Language API enabled; the other key is for Custom Search / Maps.

## Why AI inventory fails with "Gemini API Request Failed"

The AI inventory feature (retailer and distributor "Magic Generate") calls the Cloud Function `generateInventoryByBrand`, which uses **Google Gemini** (Generative Language API). It fails with HTTP 500 / "Gemini API Request Failed" when:

1. **GEMINI_API_KEY is not set** – Firebase secret missing.
2. **API key invalid or wrong** – Key typo (e.g. `Alza` instead of `AIza`), expired, or from wrong project.
3. **Generative Language API not enabled** – Must be enabled in the Google Cloud project that owns the API key.
4. **API key restrictions** – Key restricted in a way that blocks the Cloud Function’s requests.

## Use your API key (e.g. from Google Cloud Console screenshot)

If you have an API key from Google Cloud Console (e.g. project **stockpilot-ai** / stockpilot-ai-476610):

### 1. Check the key format

- Valid Google API keys start with **`AIza`** (capital **I**, then lowercase **z**, then **a**).
- If you copied it and it shows **`Alza`** (lowercase L), fix it to **`AIza`** before saving.

### 2. Enable Generative Language API (for that project)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project that owns the key (e.g. **stockpilot-ai**).
2. Go to **APIs & Services** → **Library**.
3. Search for **Generative Language API** and open it.
4. Click **Enable** if it’s not already enabled.

### 3. Set the key as a Firebase secret

Your Cloud Function runs in the **Firebase** project (e.g. **stockpilotv1**). Set the Gemini key there:

**Option A: Using the script (from repo root or `functions/`)**

```bash
cd functions
./set-gemini-secret.sh
```

When prompted, paste your API key (the one from the second screenshot, e.g. from stockpilot-ai).

**Option B: Set manually**

```bash
cd /path/to/StockPilot_v1
echo "YOUR_ACTUAL_KEY_FROM_GOOGLE_CLOUD_CONSOLE" | firebase functions:secrets:set GEMINI_API_KEY
```

Use the key from your Google Cloud Console (e.g. stockpilot-ai Credentials page). **Important:** The key must start with **AIza** (capital I). If you copied it and it shows **Alza** (lowercase L), correct it before pasting.

### 4. Redeploy the function

```bash
firebase deploy --only functions:generateInventoryByBrand
```

### 5. Test

1. In the app: Retailer or Distributor dashboard → Add Inventory → AI / “Magic Generate”.
2. Fill Known Product Types, Quantity, etc. and click **Magic Generate**.
3. If it still fails, check the browser console and the function logs (below).

## Verify secret and logs

```bash
# Confirm the secret is set (shows that it exists; value is hidden)
firebase functions:secrets:access GEMINI_API_KEY

# View function logs
firebase functions:log --only generateInventoryByBrand
```

## Troubleshooting

| Symptom | What to do |
|--------|------------|
| **"Gemini API key not configured"** | Set the secret: `firebase functions:secrets:set GEMINI_API_KEY` then redeploy. |
| **"API key invalid or not found"** / 400 | Fix key: must start with **AIza** (not Alza). Re-copy from Google Cloud Console, set secret again, redeploy. |
| **"Gemini API access denied"** / 403 | Enable **Generative Language API** in the Google Cloud project that owns the API key; check API key restrictions. |
| **500 / "Gemini API Request Failed"** (no 400/403) | Check `firebase functions:log --only generateInventoryByBrand` for the exact Gemini error (rate limit, model name, etc.). |

## What the function uses

- **Secret name:** `GEMINI_API_KEY` (Firebase Functions secret).
- **API:** `https://generativelanguage.googleapis.com/v1beta` with model `gemini-2.5-flash` (default). Set `GEMINI_MODEL` env to use e.g. `gemini-3-flash-preview` or `gemini-2.0-flash`.
- **Code:** `functions/inventory/generateInventoryByBrand.js`, `functions/ocr/parseCatalogueWithAI.js`, and other AI functions read the key via `defineSecret("GEMINI_API_KEY")`.

## AI Catalogue Parser (Parse with AI)

The **Parse with AI** flow in Add Inventory uses the Cloud Function `parseCatalogueWithAI`. It uses the same **GEMINI_API_KEY** secret. After setting the secret once, redeploy all functions that use it:

```bash
firebase deploy --only functions:parseCatalogueWithAI,functions:generateInventoryByBrand
```

Supports: images (photos of catalogues, handwritten lists, whiteboards) and PDFs (text extracted then sent to Gemini). For scanned PDFs with little extractable text, the UI suggests uploading a screenshot as image for better results.

## Notes

- The API key can be created in one Google Cloud project (e.g. **stockpilot-ai**) and used by the Firebase project (e.g. **stockpilotv1**) by setting `GEMINI_API_KEY` in that Firebase project’s secrets.
- For local development you can use a `functions/.env` file with `GEMINI_API_KEY=your_key` when running the emulator.
- The function generates 6–50 products per request.
