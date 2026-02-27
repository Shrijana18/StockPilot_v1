/**
 * Parse OCR or PDF-extracted text into product rows for price-list style documents.
 * Handles formats like "Product Code", "Size", "Price per pc.", section headers (PIPE SDR-11, etc.).
 */
function parsePriceListText(fullText) {
  if (!fullText || typeof fullText !== "string") return [];
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const products = [];
  let currentCategory = "";
  let currentProductName = "";

  // Section header patterns (e.g. "PIPE SDR-11 (3 METRE LENGTH)", "PIPE SCHEDULE 40")
  const sectionPattern = /^([A-Z][A-Z0-9\s\-\.]+(?:\([^)]+\))?)\s*$/i;
  // Product code: alphanumeric with optional ^ (e.g. M511110301^, M511130302^)
  const codePattern = /^[A-Z]?\d{5,}[A-Z0-9^]*$/i;
  // Price: number with optional comma thousands and 2 decimal (e.g. 312.00, 1,515.00)
  const pricePattern = /^[\d,]+\.?\d*$/;

  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalized = line.replace(/\s+/g, " ").trim();

    // Detect section/category (e.g. "PIPE SDR-11 (3 METRE LENGTH)", "PIPE SCHEDULE 40")
    if (sectionPattern.test(normalized) && normalized.length > 4 && normalized.length < 80) {
      const match = normalized.match(/^([A-Z][A-Z0-9\s\-\.]+?)(?:\s*\([^)]*\))?\s*$/i);
      if (match) {
        const candidate = match[1].trim();
        const lower = candidate.toLowerCase();
        if (!lower.includes("price") && !lower.includes("size (") && !lower.includes("product code") && !lower.includes("std. pkg")) {
          currentProductName = candidate;
          currentCategory = candidate;
        }
      }
    }

    // Product code (e.g. M511110301^)
    if (codePattern.test(normalized) && normalized.length >= 6) {
      const sku = normalized.replace(/\^/g, "").trim();
      // Look ahead/ahead for price on same line or next lines
      let price = null;
      const restOfLine = line.split(/\s+/).filter((t) => t !== normalized);
      for (const token of restOfLine) {
        const p = token.replace(/,/g, "");
        if (pricePattern.test(p) && parseFloat(p) > 0) {
          price = parseFloat(p);
          break;
        }
      }
      if (price === null && i + 1 < lines.length) {
        const next = lines[i + 1].trim().replace(/,/g, "");
        if (pricePattern.test(next) && parseFloat(next) > 0) price = parseFloat(next);
      }
      if (price === null && i + 2 < lines.length) {
        const n2 = lines[i + 2].trim().replace(/,/g, "");
        if (pricePattern.test(n2) && parseFloat(n2) > 0) price = parseFloat(n2);
      }
      const key = `${sku}-${price}`;
      if (!seen.has(key) && price != null) {
        seen.add(key);
        products.push({
          productName: currentProductName ? `${currentProductName} ${sku}` : sku,
          name: currentProductName ? `${currentProductName} ${sku}` : sku,
          sku,
          category: currentCategory || "General",
          brand: "",
          quantity: "1",
          unit: "pcs",
          costPrice: price,
          price: price,
          sellingPrice: price,
          mrp: price,
          description: "",
        });
      }
    }

    // Standalone price line (sometimes price is on its own line after code)
    const priceMatch = normalized.match(/^([\d,]+\.?\d{2})$/);
    if (priceMatch && products.length > 0) {
      const p = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (p > 0) {
        const last = products[products.length - 1];
        if (last.costPrice == null || last.costPrice === 0) {
          last.costPrice = p;
          last.price = p;
          last.sellingPrice = p;
          last.mrp = p;
        }
      }
    }
  }

  // Fallback: line-based parsing for "word word ... number" lines (e.g. "Colgate Paste 100g 45.00")
  if (products.length === 0) {
    const wordThenPrice = /^(.+?)\s+([\d,]+\.?\d{2})$/;
    for (const line of lines) {
      const m = line.match(wordThenPrice);
      if (m && m[1].trim().length > 2) {
        const name = m[1].trim();
        const price = parseFloat(m[2].replace(/,/g, ""));
        if (price > 0 && price < 1e6) {
          products.push({
            productName: name,
            name,
            sku: "",
            category: "General",
            brand: "",
            quantity: "1",
            unit: "pcs",
            costPrice: price,
            price: price,
            sellingPrice: price,
            mrp: price,
            description: "",
          });
        }
      }
    }
  }

  return products;
}

module.exports = { parsePriceListText };
