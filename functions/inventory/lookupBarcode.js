

const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const axios = require("axios");

/**
 * Normalized product shape returned to clients:
 * {
 *   success: true,
 *   source: "openfoodfacts" | "digit-eyes" | "fallback",
 *   barcode: "8901234567890",
 *   productName: "Amul Taaza Toned Milk",
 *   brand: "Amul",
 *   category: "Dairy",
 *   unit: "1L Pack",
 *   imageUrl: "https://...",
 *   ingredients: "Milk",
 *   nutrition: { calories: 60, protein_g: 3, fat_g: 3, carbs_g: 5 },
 *   raw: {...} // raw source payload (optional for debugging)
 * }
 */

function toUnitFromQty(qty, unit) {
  if (!qty && !unit) return "";
  const q = (qty ?? "").toString().trim();
  const u = (unit ?? "").toString().trim();
  return [q, u].filter(Boolean).join(" ").trim();
}

function firstNonEmpty(...vals) {
  return vals.find(v => v !== undefined && v !== null && String(v).trim() !== "") ?? "";
}

function safeNum(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

async function openFoodFactsLookup(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await axios.get(url, { timeout: 12000 });
  const data = res.data || {};
  if (data.status !== 1 || !data.product) {
    return null;
  }
  const p = data.product || {};

  // map basic fields
  const productName = firstNonEmpty(p.product_name, p.generic_name, p.abbreviated_product_name);
  const brand = firstNonEmpty(
    p.brands_tags?.[0],
    p.brands?.split(",")?.[0],
    p.brands
  );
  const category = firstNonEmpty(
    p.categories_old?.split(",")?.slice(-1)?.[0],
    p.categories_tags?.slice(-1)?.[0],
    p.categories?.split(",")?.slice(-1)?.[0]
  );
  const imageUrl = firstNonEmpty(p.image_front_small_url, p.image_front_url, p.image_url);

  const qty = firstNonEmpty(p.quantity, p.product_quantity);
  // Sometimes quantity like "100 g" or "1 L". Keep as-is to avoid bad parses.
  const unit = toUnitFromQty(qty, "");

  const ingredients = p.ingredients_text || "";
  const nutr = p.nutriments || {};
  const nutrition = {
    calories: safeNum(nutr["energy-kcal_100g"]) ?? safeNum(nutr["energy-kcal_serving"]) ?? undefined,
    protein_g: safeNum(nutr["proteins_100g"]) ?? safeNum(nutr["proteins_serving"]) ?? undefined,
    fat_g: safeNum(nutr["fat_100g"]) ?? safeNum(nutr["fat_serving"]) ?? undefined,
    carbs_g: safeNum(nutr["carbohydrates_100g"]) ?? safeNum(nutr["carbohydrates_serving"]) ?? undefined,
    sugar_g: safeNum(nutr["sugars_100g"]) ?? safeNum(nutr["sugars_serving"]) ?? undefined,
    sodium_mg: safeNum(nutr["sodium_100g"]) ? Math.round(nutr["sodium_100g"] * 1000) : undefined,
  };

  return {
    success: true,
    source: "openfoodfacts",
    barcode,
    productName,
    brand,
    category,
    unit,
    imageUrl,
    ingredients,
    nutrition,
    raw: process.env.NODE_ENV === "production" ? undefined : data
  };
}

async function digitEyesLookup(barcode) {
  const appKey = process.env.DIGITEYES_APP_KEY;
  const appId = process.env.DIGITEYES_APP_ID;
  if (!appKey || !appId) return null;

  // NOTE: Digit-Eyes typically requires HMAC signature; here we assume an app gateway or pre-signed URL.
  // If you have a proxy endpoint, replace the URL below.
  const url = `https://digit-eyes-proxy.example.com/lookup?upc=${encodeURIComponent(barcode)}&appid=${encodeURIComponent(appId)}&appkey=${encodeURIComponent(appKey)}`;
  try {
    const res = await axios.get(url, { timeout: 8000 });
    const d = res.data || {};
    if (!d || (!d.description && !d.brand)) return null;

    return {
      success: true,
      source: "digit-eyes",
      barcode,
      productName: firstNonEmpty(d.description, d.description2),
      brand: d.brand || "",
      category: d.category || "",
      unit: d.size || "",
      imageUrl: d.image ?? "",
      ingredients: d.ingredients ?? "",
      nutrition: undefined,
      raw: process.env.NODE_ENV === "production" ? undefined : d
    };
  } catch (e) {
    return null;
  }
}

module.exports = onRequest(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).send("");
  }

  cors(req, res, async () => {
    try {
      res.set("Access-Control-Allow-Origin", "*");

      const { barcode, code } = req.body || {};
      const barcodeCode = (barcode || code || "").toString().replace(/[^\d]/g, "");
      
      if (!barcodeCode) {
        return res.status(400).json({
          success: false,
          message: "Missing barcode"
        });
      }
      
      if (barcodeCode.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Barcode too short"
        });
      }

      // Try OpenFoodFacts first, with a retry for transient 5xx.
      let result = null;
      let attempts = 2;
      while (attempts-- > 0) {
        try {
          result = await openFoodFactsLookup(barcodeCode);
          if (result) break;
        } catch (e) {
          // Retry once for transient errors
          if (attempts === 0) throw e;
          await new Promise(r => setTimeout(r, 900));
        }
      }

      // Fallback to Digit-Eyes if configured
      if (!result) {
        result = await digitEyesLookup(barcodeCode);
      }

      if (!result) {
        return res.status(200).json({
          success: false,
          source: "fallback",
          barcode: barcodeCode,
          message: "No product found for this barcode"
        });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("lookupBarcode Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to lookup barcode"
      });
    }
  });
});