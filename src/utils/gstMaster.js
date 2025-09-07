

// src/utils/gstMaster.js
// Lightweight GST suggestion helper (offline, no API)
// Goal: provide a reasonable default GST% + HSN from product/category text.
// This is OPTIONAL metadata; user can always override.
//
// ⚠️ NOTE: Rates are indicative/common for retail contexts and may vary by value caps or notifications.
// Keep this list small and opinionated. You can extend it safely later.

export const GST_SUGGESTIONS = [
  // ---- FMCG / Grocery ----
  { hsn: "1905", rate: 18, keywords: ["biscuit", "cookie", "wafer"], description: "Bread, pastry, cakes, biscuits" },
  { hsn: "1905", rate: 5,  keywords: ["bread", "khari"], description: "Bread (often 5%—check local notifications)" },
  { hsn: "0401", rate: 5,  keywords: ["milk", "dairy"], description: "Milk & dairy (many are exempt/5%, verify exact item)" },
  { hsn: "0403", rate: 12, keywords: ["curd", "lassi", "buttermilk", "yogurt"], description: "Fermented dairy (curd, lassi)" },
  { hsn: "0406", rate: 12, keywords: ["cheese"], description: "Cheese" },
  { hsn: "1006", rate: 0,  keywords: ["rice", "basmati"], description: "Rice (often nil if unpacked)" },
  { hsn: "1101", rate: 5,  keywords: ["atta", "flour", "maida", "wheat flour"], description: "Flours (packaged often 5%)" },
  { hsn: "0910", rate: 5,  keywords: ["haldi", "turmeric", "masala"], description: "Spices (e.g., turmeric) often 5%" },
  { hsn: "0902", rate: 5,  keywords: ["tea", "chai"], description: "Tea" },
  { hsn: "0901", rate: 5,  keywords: ["coffee"], description: "Coffee" },
  { hsn: "1701", rate: 5,  keywords: ["sugar"], description: "Sugar" },
  { hsn: "1704", rate: 18, keywords: ["chocolate", "toffee", "candy"], description: "Sugar confectionery / chocolate" },
  { hsn: "2202", rate: 18, keywords: ["soft drink", "cola", "juice", "energy drink"], description: "Soft drinks / beverages (non-alcoholic)" },

  // ---- Personal care / OTC ----
  { hsn: "3305", rate: 18, keywords: ["shampoo", "hair oil"], description: "Hair preparations (shampoo, oils)" },
  { hsn: "3306", rate: 18, keywords: ["toothpaste", "oral", "mouthwash"], description: "Oral/dental" },
  { hsn: "3304", rate: 18, keywords: ["cosmetic", "cream", "makeup", "lipstick", "kajal"], description: "Beauty/makeup preparations" },
  { hsn: "3401", rate: 18, keywords: ["soap", "detergent"], description: "Soap & detergents" },

  // ---- Apparel / Textiles (simplified) ----
  // Apparel has value slabs; we default to 12% as a mid-signal suggestion.
  { hsn: "61xx", rate: 12, keywords: ["tshirt", "shirt", "jeans", "trouser", "kurti", "saree", "cloth", "garment", "apparel"], description: "Apparel (value-based slabs apply)" },
  { hsn: "62xx", rate: 12, keywords: ["jacket", "blazer", "dress", "skirt", "suit"], description: "Apparel (woven)" },

  // ---- Electronics (retail baseline, may vary by item) ----
  { hsn: "8517", rate: 18, keywords: ["mobile", "smartphone", "cellphone"], description: "Telephone sets / mobiles" },
  { hsn: "8528", rate: 18, keywords: ["tv", "television", "monitor"], description: "Monitors/Televisions" },
  { hsn: "8504", rate: 18, keywords: ["charger", "adapter", "power supply"], description: "Power supplies/chargers" },
  { hsn: "8507", rate: 18, keywords: ["battery"], description: "Batteries" },

  // ---- Hardware / Electrical ----
  { hsn: "8536", rate: 18, keywords: ["switch", "mcb", "socket"], description: "Electrical apparatus for switching" },
  { hsn: "7318", rate: 18, keywords: ["screw", "nut", "bolt", "fastener"], description: "Screws, bolts, nuts" },

  // ---- Agriculture / Tools (broad hints) ----
  { hsn: "8201", rate: 12, keywords: ["shovel", "spade", "hoe"], description: "Hand tools for agriculture" },
];

/**
 * Normalize text for matching.
 */
function norm(text) {
  return String(text || "").toLowerCase().trim();
}

/**
 * Suggest GST % and HSN from productName/category keywords.
 * @param {{ name?: string, category?: string }} params
 * @returns {{ rate: number, hsn: string, description?: string, source: "keyword_suggested", confidence: number } | null}
 */
export function suggestGst(params = {}) {
  const name = norm(params.name);
  const cat = norm(params.category);
  const hay = `${name} ${cat}`.trim();
  if (!hay) return null;

  let best = null;
  let bestScore = 0;

  for (const entry of GST_SUGGESTIONS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (!kw) continue;
      const k = norm(kw);
      if (k.length === 0) continue;
      // simple contains match
      if (hay.includes(k)) score += Math.min(1, k.length / 10); // weight longer keywords a bit more
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best || bestScore === 0) return null;

  // clamp confidence between 0.5 and 0.95 to reflect heuristic nature
  const confidence = Math.max(0.5, Math.min(0.95, 0.6 + bestScore / 3));

  return {
    rate: best.rate,
    hsn: best.hsn,
    description: best.description,
    source: "keyword_suggested",
    confidence,
  };
}