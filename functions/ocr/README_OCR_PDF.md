# OCR & PDF Inventory Upload

## Overview

Retailer and distributor can build inventory from:

- **Images** (JPG, PNG, etc.) – OCR via Google Vision, then parsed into product rows.
- **PDFs** (e.g. price lists like “All Product Price List as on 01.01.26.pdf”) – text extracted with `pdf-parse`, then parsed into product rows.

## Endpoints

| Endpoint | Use |
|----------|-----|
| **ocrFromImage** (callable) | Image-only OCR; returns `{ success, text, lines }`. |
| **ocrFromFile** (HTTP POST) | Image or PDF; returns `{ success, text, products }`. Used by retailer and distributor OCR upload. |

## ocrFromFile

- **URL:** `https://us-central1-stockpilotv1.cloudfunctions.net/ocrFromFile`
- **Method:** POST
- **Body (image):** `{ "imageBase64": "<base64>" }`
- **Body (PDF):** `{ "pdfBase64": "<base64>", "mimeType": "application/pdf" }`
- **Response:** `{ success, text, lines, products }` – `products` is an array of `{ productName, sku, category, costPrice, ... }`.

## Price-list PDF parsing

The parser in `parsePriceListText.js` handles:

- Section headers (e.g. “PIPE SDR-11 (3 METRE LENGTH)”).
- Product codes (e.g. `M511110301^`).
- Prices (e.g. `312.00`, `1,515.00`).
- Fallback for “Product Name … Price” lines.

## Frontend

- **Retailer:** `src/components/inventory/OCRUploadForm.jsx` – file input `accept="image/*,.pdf"`, calls `ocrFromFile`.
- **Distributor:** `src/components/distributor/inventory/OCRUploadForm.jsx` – same.

## Deploy

```bash
firebase deploy --only functions:ocrFromFile
```
